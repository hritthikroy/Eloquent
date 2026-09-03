/**
 * Clibb Prompt Command Module
 * Orchestrates intent parsing, AST verification, and prompt assembly
 * for downstream AI agents on the Clibb platform.
 */

const { IntentParser } = require('../utils/intentParser');
const { formatClibbPrompt } = require('../templates/clibbPromptTemplate');
const { AstVerifier } = require('../validation/astVerifier');

class ClibbPromptCommand {
  /**
   * Orchestrates prompt generation from raw intent string.
   * @param {string} rawIntent - Raw intent string.
   * @param {Object} [options] - Optional options (e.g. codeSnippet).
   * @returns {string} Fully structured, production-ready developer prompt.
   */
  static run(rawIntent, options = {}) {
    // 1. Validate and parse raw intent
    const parsed = IntentParser.parse(rawIntent);

    // 2. If an embedded code snippet is provided, verify AST syntax with node -c
    if (options.codeSnippet) {
      AstVerifier.verify(options.codeSnippet);
    }

    // 3. Assemble prompt via template (deterministic and idempotent)
    const prompt = formatClibbPrompt({
      objective: parsed.normalized,
      affectedFiles: parsed.affectedFiles,
      qualityDirectives: parsed.qualityDirectives,
      codeSnippet: options.codeSnippet || null
    });

    // 4. Static analysis check: ensure no trailing whitespace on any line
    const hasTrailingWhitespace = prompt.split('\n').some(line => /\s+$/.test(line));
    if (hasTrailingWhitespace) {
      throw new Error('Generated prompt failed static analysis: trailing whitespace detected');
    }

    // 5. Ensure exactly 3 required section headers in exact order
    const hasObjective = prompt.includes('Clear Technical Objective');
    const hasFiles = prompt.includes('Key Files / Architecture');
    const hasQuality = prompt.includes('Quality Requirements & AST Verification');

    if (!hasObjective || !hasFiles || !hasQuality) {
      throw new Error('Generated prompt failed static analysis: missing required sections');
    }

    const objIndex = prompt.indexOf('Clear Technical Objective');
    const filesIndex = prompt.indexOf('Key Files / Architecture');
    const qualIndex = prompt.indexOf('Quality Requirements & AST Verification');

    if (!(objIndex < filesIndex && filesIndex < qualIndex)) {
      throw new Error('Generated prompt failed static analysis: incorrect section order');
    }

    return prompt;
  }
}

module.exports = {
  ClibbPromptCommand,
  run: ClibbPromptCommand.run.bind(ClibbPromptCommand)
};
