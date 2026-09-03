/**
 * AST Verifier Utility
 * Wraps node -c AST checks for code snippets and JavaScript files.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class AstVerifier {
  /**
   * Validates a code snippet or file using node -c.
   * @param {string} codeOrFilePath - Either JS code content or an absolute/relative file path.
   * @returns {boolean} True if syntax is valid.
   * @throws {Error} If AST syntax validation fails.
   */
  static verify(codeOrFilePath) {
    if (!codeOrFilePath || typeof codeOrFilePath !== 'string') {
      throw new Error('AST verification failed: input must be a non-empty string');
    }

    // Check if input is an existing file
    if (fs.existsSync(codeOrFilePath) && fs.statSync(codeOrFilePath).isFile()) {
      try {
        execSync(`node -c "${codeOrFilePath}"`, { stdio: 'pipe' });
        return true;
      } catch (err) {
        throw new Error(`AST verification failed for file ${codeOrFilePath}: ${err.stderr ? err.stderr.toString() : err.message}`);
      }
    }

    // Input is raw code snippet -> write to temporary file to run node -c
    const tmpFile = path.join(os.tmpdir(), `ast_verify_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.js`);
    try {
      fs.writeFileSync(tmpFile, codeOrFilePath, 'utf8');
      execSync(`node -c "${tmpFile}"`, { stdio: 'pipe' });
      return true;
    } catch (err) {
      const msg = err.stderr ? err.stderr.toString() : err.message;
      throw new Error(`Embedded code snippet failed AST verification via node -c: ${msg.trim()}`);
    } finally {
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch (e) {}
    }
  }

  /**
   * Safely checks validity without throwing.
   */
  static isValid(codeOrFilePath) {
    try {
      return this.verify(codeOrFilePath);
    } catch (e) {
      return false;
    }
  }
}

module.exports = {
  AstVerifier,
  verifyAst: AstVerifier.verify.bind(AstVerifier)
};
