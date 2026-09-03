/**
 * Intent Parser Utility
 * Validates, normalizes, and categorizes raw developer intent strings.
 */

class IntentParser {
  /**
   * Parses and validates raw intent string.
   * @param {string} rawIntent - Raw intent string to process.
   * @returns {Object} Normalized intent metadata.
   */
  static parse(rawIntent) {
    if (rawIntent === null || rawIntent === undefined) {
      throw new Error('Invalid intent: input must be a non-empty string');
    }

    if (typeof rawIntent !== 'string') {
      throw new Error('Invalid intent: input must be a string');
    }

    const trimmed = rawIntent.trim();
    if (trimmed.length === 0) {
      throw new Error('Invalid intent: input cannot be empty');
    }

    // Normalize spacing and capitalization
    const normalized = trimmed.replace(/\s+/g, ' ');

    // Detect technical focus domain
    const lower = normalized.toLowerCase();
    const domain = this.detectDomain(lower);
    const affectedFiles = this.inferAffectedFiles(domain, lower);
    const qualityDirectives = this.generateQualityDirectives(domain, lower);

    return {
      raw: rawIntent,
      normalized,
      domain,
      affectedFiles,
      qualityDirectives
    };
  }

  static detectDomain(lower) {
    if (/\b(audio|dsp|sound|pcm|vad|mic|buffer|stream)\b/.test(lower)) {
      return 'Audio DSP & Backend Pipeline';
    }
    if (/\b(state|persist|storage|atomic|ratelimit|sync)\b/.test(lower)) {
      return 'Conversational State Management';
    }
    if (/\b(ui|overlay|renderer|component|react|canvas|visualizer)\b/.test(lower)) {
      return 'Electron UI & Renderer';
    }
    if (/\b(ipc|bridge|preload|electron|main)\b/.test(lower)) {
      return 'Electron Main & IPC Bridge';
    }
    return 'Full-Stack Antigravity Engineering';
  }

  static inferAffectedFiles(domain, lower) {
    const files = [];

    switch (domain) {
      case 'Audio DSP & Backend Pipeline':
        files.push('backend-go/main.go');
        files.push('backend-go/audio/state.go');
        files.push('src/utils/audio-recorder.js');
        break;
      case 'Conversational State Management':
        files.push('src/main/stateManager.js');
        files.push('src/renderer/conversation.ts');
        files.push('backend/audio/state.go');
        files.push('config/stateSchema.json');
        break;
      case 'Electron UI & Renderer':
        files.push('src/ui/overlay.js');
        files.push('src/renderer/components/LibboardPromptViewer.jsx');
        files.push('src/ui/overlay.html');
        break;
      case 'Electron Main & IPC Bridge':
        files.push('src/main.js');
        files.push('src/preload.js');
        files.push('src/main/ipcHandlers.js');
        break;
      default:
        files.push('src/main.js');
        files.push('src/core/prompt-engineer.ts');
        files.push('src/utils/jarvis-manager.js');
    }

    return files;
  }

  static generateQualityDirectives(domain, lower) {
    const directives = [
      'Execute node --check on all JavaScript files to verify zero AST syntax errors.',
      'Enforce idempotent execution and zero trailing whitespace across outputs.',
      'Verify 100% test passing without regressions using npm test.'
    ];

    if (domain.includes('Audio') || domain.includes('State')) {
      directives.push('Verify concurrency safety and run go test -race on Go backend packages.');
    }

    return directives;
  }
}

module.exports = {
  IntentParser,
  parseIntent: IntentParser.parse.bind(IntentParser)
};
