/**
 * PromptTemplate
 * Token-efficient template management with placeholder validation and locale support.
 * Enforces 256 token hard limit and provides serialization for cross-process communication.
 */

const crypto = require('crypto');

/**
 * Simple token estimation: ~4 characters per token (GPT heuristic)
 * For production, integrate tiktoken or gpt-tokenizer npm package
 */
function estimateTokenCount(text) {
  if (!text || typeof text !== 'string') return 0;
  // Account for Unicode properly
  const charCount = [...text].length;
  return Math.ceil(charCount / 4);
}

/**
 * Extract all placeholder variables from template string
 * Supports {{variable}} and {{variable.nested}} formats
 */
function extractPlaceholders(template) {
  const regex = /\{\{([^}]+)\}\}/g;
  const placeholders = new Set();
  let match;
  
  // eslint-disable-next-line no-cond-assign
  while ((match = regex.exec(template)) !== null) {
    const placeholder = match[1].trim();
    if (placeholder) {
      placeholders.add(placeholder);
    }
  }
  
  return Array.from(placeholders);
}

/**
 * Validate placeholder variable names
 * Must be alphanumeric with optional dots for nesting
 */
function validatePlaceholderName(name) {
  if (!name || typeof name !== 'string') return false;
  return /^[a-zA-Z0-9_.]+$/.test(name);
}

/**
 * Main PromptTemplate class
 */
class PromptTemplate {
  /**
   * @param {string} template - Template string with {{placeholders}}
   * @param {object} options - Configuration options
   * @param {string} options.locale - Locale identifier (e.g., 'en-US', 'es-ES')
   * @param {number} options.maxTokens - Token limit (default: 256)
   * @param {object} options.metadata - Additional metadata for serialization
   */
  constructor(template, options = {}) {
    if (!template || typeof template !== 'string') {
      throw new Error('Template must be a non-empty string');
    }

    this.template = template;
    this.locale = options.locale || 'en-US';
    this.maxTokens = options.maxTokens || 256;
    this.metadata = options.metadata || {};
    this.id = crypto.randomBytes(8).toString('hex');
    this.createdAt = new Date().toISOString();

    // Extract and validate placeholders
    this.placeholders = extractPlaceholders(this.template);
    this.placeholders.forEach((placeholder) => {
      if (!validatePlaceholderName(placeholder)) {
        throw new Error(`Invalid placeholder name: ${placeholder}`);
      }
    });

    // Validate token count
    const tokenCount = this.getTokenCount();
    if (tokenCount > this.maxTokens) {
      throw new Error(
        `Template exceeds token limit: ${tokenCount} > ${this.maxTokens}. ` +
        `Reduce template length by ${tokenCount - this.maxTokens} tokens.`
      );
    }
  }

  /**
   * Get estimated token count for the template
   * @returns {number} Estimated token count
   */
  getTokenCount() {
    return estimateTokenCount(this.template);
  }

  /**
   * Get all placeholder variable names
   * @returns {string[]} Array of placeholder names
   */
  getPlaceholders() {
    return [...this.placeholders];
  }

  /**
   * Validate that all required placeholders are present in provided variables
   * @param {object} variables - Variables object to validate
   * @returns {object} Validation result with { valid: boolean, missing: string[] }
   */
  validateVariables(variables) {
    const missing = [];
    
    this.placeholders.forEach((placeholder) => {
      // Support nested access like 'user.name'
      const value = this.resolveNestedProperty(variables, placeholder);
      if (value === undefined || value === null) {
        missing.push(placeholder);
      }
    });

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Resolve nested property access (e.g., 'user.name' from {user: {name: 'John'}})
   * @param {object} obj - Source object
   * @param {string} path - Dot-separated path
   * @returns {any} Resolved value or undefined
   */
  resolveNestedProperty(obj, path) {
    if (!obj || typeof obj !== 'object') return undefined;
    
    const parts = path.split('.');
    let current = obj;
    
    // eslint-disable-next-line no-restricted-syntax
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    
    return current;
  }

  /**
   * Clone template with new locale
   * @param {string} newLocale - New locale identifier
   * @returns {PromptTemplate} New template instance
   */
  withLocale(newLocale) {
    return new PromptTemplate(this.template, {
      locale: newLocale,
      maxTokens: this.maxTokens,
      metadata: { ...this.metadata },
    });
  }

  /**
   * Serialize template for cross-process communication or storage
   * @returns {object} Serialized template object
   */
  toJSON() {
    return {
      id: this.id,
      template: this.template,
      locale: this.locale,
      maxTokens: this.maxTokens,
      placeholders: this.placeholders,
      metadata: this.metadata,
      createdAt: this.createdAt,
      tokenCount: this.getTokenCount(),
    };
  }

  /**
   * Deserialize template from JSON
   * @param {object} json - Serialized template object
   * @returns {PromptTemplate} Reconstructed template instance
   */
  static fromJSON(json) {
    if (!json || !json.template) {
      throw new Error('Invalid JSON: missing template field');
    }

    const template = new PromptTemplate(json.template, {
      locale: json.locale,
      maxTokens: json.maxTokens,
      metadata: json.metadata,
    });

    // Restore ID and timestamp if present
    if (json.id) template.id = json.id;
    if (json.createdAt) template.createdAt = json.createdAt;

    return template;
  }

  /**
   * Create template from file (for locale management)
   * @param {string} filePath - Path to template file
   * @returns {Promise<PromptTemplate>} Template instance
   */
  static async fromFile(filePath) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const content = await fs.readFile(filePath, 'utf-8');
    const locale = path.basename(filePath, path.extname(filePath));
    
    return new PromptTemplate(content, { locale });
  }

  /**
   * Utility: Check if text contains valid placeholders
   * @param {string} text - Text to check
   * @returns {boolean} True if text contains valid placeholders
   */
  static hasPlaceholders(text) {
    return /\{\{[a-zA-Z0-9_.]+\}\}/.test(text);
  }

  /**
   * Utility: Sanitize user input for safe placeholder injection
   * Prevents injection attacks by escaping special characters
   * @param {string} value - Value to sanitize
   * @returns {string} Sanitized value
   */
  static sanitizeValue(value) {
    if (value === null || value === undefined) return '';
    
    const str = String(value);
    // Escape characters that could break prompt structure
    return str
      .replace(/\{\{/g, '{ {')
      .replace(/\}\}/g, '} }')
      .replace(/[\r\n]+/g, ' ')
      .trim();
  }
}

module.exports = {
  PromptTemplate,
  estimateTokenCount,
  extractPlaceholders,
  validatePlaceholderName,
};
