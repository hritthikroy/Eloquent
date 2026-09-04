/**
 * PromptRenderer
 * Consumes PromptTemplate instances, injects runtime variables,
 * and emits single-line, max-token-bounded strings.
 * Handles missing variables gracefully with configurable fallback strategies.
 */

const { PromptTemplate, estimateTokenCount } = require('./template');

/**
 * Fallback strategies for missing variables
 */
const FallbackStrategy = {
  EMPTY: 'empty',           // Replace with empty string
  PRESERVE: 'preserve',     // Keep placeholder as-is
  ERROR: 'error',           // Throw error
  DEFAULT: 'default',       // Use provided default value
};

/**
 * Rendering options
 */
class RenderOptions {
  constructor(options = {}) {
    this.fallbackStrategy = options.fallbackStrategy || FallbackStrategy.EMPTY;
    this.defaultValues = options.defaultValues || {};
    this.truncateIfExceeds = options.truncateIfExceeds !== false;
    this.singleLine = options.singleLine !== false;
    this.enforceTokenLimit = options.enforceTokenLimit !== false;
    this.onWarning = options.onWarning || (() => {});
  }
}

/**
 * Main PromptRenderer class
 */
class PromptRenderer {
  /**
   * @param {PromptTemplate} template - Template to render
   */
  constructor(template) {
    if (!(template instanceof PromptTemplate)) {
      throw new Error('PromptRenderer requires a PromptTemplate instance');
    }
    this.template = template;
  }

  /**
   * Render template with provided variables
   * @param {object} variables - Variables to inject
   * @param {RenderOptions|object} options - Rendering options
   * @returns {string} Rendered prompt string
   */
  render(variables = {}, options = {}) {
    const opts = options instanceof RenderOptions ? options : new RenderOptions(options);
    
    // Validate variables
    const validation = this.template.validateVariables(variables);
    
    if (!validation.valid) {
      return this.handleMissingVariables(validation.missing, variables, opts);
    }

    // Perform substitution
    let rendered = this.template.template;
    
    this.template.getPlaceholders().forEach((placeholder) => {
      const value = this.template.resolveNestedProperty(variables, placeholder);
      const sanitized = PromptTemplate.sanitizeValue(value);
      const regex = new RegExp(`\\{\\{${placeholder.replace(/\./g, '\\.')}\\}\\}`, 'g');
      rendered = rendered.replace(regex, sanitized);
    });

    // Post-process: single-line conversion
    if (opts.singleLine) {
      rendered = this.convertToSingleLine(rendered);
    }

    // Enforce token limit
    if (opts.enforceTokenLimit) {
      rendered = this.enforceTokenLimit(rendered, opts);
    }

    return rendered;
  }

  /**
   * Handle missing variables according to fallback strategy
   * @param {string[]} missing - Missing placeholder names
   * @param {object} variables - Provided variables
   * @param {RenderOptions} opts - Rendering options
   * @returns {string} Rendered template with fallback handling
   */
  handleMissingVariables(missing, variables, opts) {
    if (opts.fallbackStrategy === FallbackStrategy.ERROR) {
      throw new Error(
        `Missing required variables: ${missing.join(', ')}. ` +
        `Available: ${Object.keys(variables).join(', ')}`
      );
    }

    // Merge variables with defaults
    const merged = { ...opts.defaultValues, ...variables };
    
    let rendered = this.template.template;

    this.template.getPlaceholders().forEach((placeholder) => {
      let value = this.template.resolveNestedProperty(merged, placeholder);
      
      if (value === undefined || value === null) {
        // Apply fallback strategy
        if (opts.fallbackStrategy === FallbackStrategy.PRESERVE) {
          // Don't sanitize when preserving placeholders
          const regex = new RegExp(`\\{\\{${placeholder.replace(/\./g, '\\.')}\\}\\}`, 'g');
          // Skip this placeholder - keep it as-is
          return;
        } else if (opts.fallbackStrategy === FallbackStrategy.EMPTY) {
          value = '';
          opts.onWarning(`Missing variable '${placeholder}', using empty string`);
        } else {
          value = '';
        }
      }

      const sanitized = PromptTemplate.sanitizeValue(value);
      const regex = new RegExp(`\\{\\{${placeholder.replace(/\./g, '\\.')}\\}\\}`, 'g');
      rendered = rendered.replace(regex, sanitized);
    });

    // Post-process
    if (opts.singleLine) {
      rendered = this.convertToSingleLine(rendered);
    }

    if (opts.enforceTokenLimit) {
      rendered = this.enforceTokenLimit(rendered, opts);
    }

    return rendered;
  }

  /**
   * Convert multi-line text to single line
   * Preserves semantic spacing while removing line breaks
   * @param {string} text - Text to convert
   * @returns {string} Single-line text
   */
  convertToSingleLine(text) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Enforce token limit by truncating if necessary
   * @param {string} text - Text to check
   * @param {RenderOptions} opts - Rendering options
   * @returns {string} Text within token limit
   */
  enforceTokenLimit(text, opts) {
    const tokenCount = estimateTokenCount(text);
    const maxTokens = this.template.maxTokens;

    if (tokenCount <= maxTokens) {
      return text;
    }

    if (!opts.truncateIfExceeds) {
      throw new Error(
        `Rendered prompt exceeds token limit: ${tokenCount} > ${maxTokens}. ` +
        `Enable truncation or reduce variable content.`
      );
    }

    // Truncate by character count, preserving token estimate
    const targetChars = Math.floor((maxTokens / tokenCount) * text.length * 0.95);
    const truncated = text.substring(0, targetChars);
    
    opts.onWarning(
      `Prompt truncated from ${tokenCount} to ~${maxTokens} tokens ` +
      `(${text.length} to ${targetChars} chars)`
    );

    return `${truncated}...`;
  }

  /**
   * Render and validate in one step
   * @param {object} variables - Variables to inject
   * @param {object} options - Rendering options
   * @returns {object} Result with { prompt: string, tokenCount: number, warnings: string[] }
   */
  renderWithValidation(variables = {}, options = {}) {
    const warnings = [];
    const opts = new RenderOptions({
      ...options,
      onWarning: (msg) => warnings.push(msg),
    });

    const prompt = this.render(variables, opts);
    const tokenCount = estimateTokenCount(prompt);

    return {
      prompt,
      tokenCount,
      warnings,
      withinLimit: tokenCount <= this.template.maxTokens,
    };
  }

  /**
   * Batch render multiple variable sets
   * Useful for generating multiple prompts from same template
   * @param {object[]} variableSets - Array of variable objects
   * @param {object} options - Rendering options
   * @returns {string[]} Array of rendered prompts
   */
  renderBatch(variableSets, options = {}) {
    return variableSets.map((variables) => this.render(variables, options));
  }

  /**
   * Static helper: Quick render without creating renderer instance
   * @param {PromptTemplate} template - Template to render
   * @param {object} variables - Variables to inject
   * @param {object} options - Rendering options
   * @returns {string} Rendered prompt
   */
  static render(template, variables, options) {
    const renderer = new PromptRenderer(template);
    return renderer.render(variables, options);
  }

  /**
   * Static helper: Render from template string directly
   * @param {string} templateString - Template string
   * @param {object} variables - Variables to inject
   * @param {object} options - Combined template and render options
   * @returns {string} Rendered prompt
   */
  static renderFromString(templateString, variables, options = {}) {
    const template = new PromptTemplate(templateString, {
      locale: options.locale,
      maxTokens: options.maxTokens,
      metadata: options.metadata,
    });
    return PromptRenderer.render(template, variables, options);
  }
}

module.exports = {
  PromptRenderer,
  RenderOptions,
  FallbackStrategy,
};
