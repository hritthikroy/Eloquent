/**
 * @file promptBuilder.ts
 * @description Vision service PromptBuilder class that programmatically composes
 * structured, production-grade Antigravity developer prompts from raw user intent.
 * 
 * Enforces the strict 4-section Antigravity Developer Prompt AST schema:
 * 1. Clear Technical Objective
 * 2. Key Files / Architecture
 * 3. Quality Requirements & AST Verification
 * 4. Next Steps & Continuation Roadmap
 */

export interface PromptBuilderOptions {
  domain?: string;
  maxIntentLength?: number;
  strictValidation?: boolean;
  targetStack?: 'eloquent-core' | 'electron-ui' | 'go-backend' | 'full-stack';
  customFiles?: Array<{ path: string; description: string }>;
  customQualityRequirements?: string[];
  customNextSteps?: string[];
}

export interface ParsedIntent {
  rawIntent: string;
  sanitizedIntent: string;
  detectedDomain: string;
  targetStack: string;
  inferredObjective: string;
  suggestedFiles: Array<{ path: string; description: string }>;
  qualityDirectives: string[];
  nextSteps: string[];
  isTruncated: boolean;
}

export interface PromptValidationResult {
  isValid: boolean;
  errors: string[];
  headersFound: string[];
}

export const ANTIGRAVITY_PROMPT_REGEX = /^Clear Technical Objective\n[\s\S]*?\n\nKey Files \/ Architecture\n[\s\S]*?\n\nQuality Requirements & AST Verification\n[\s\S]*?\n\nNext Steps & Continuation Roadmap\n[\s\S]*?$/;

export class PromptBuilder {
  private static readonly MAX_INTENT_DEFAULT = 32768; // 32KB max intent boundary

  private static readonly REQUIRED_HEADERS = [
    'Clear Technical Objective',
    'Key Files / Architecture',
    'Quality Requirements & AST Verification',
    'Next Steps & Continuation Roadmap',
  ];

  /**
   * Sanitizes raw user intent against malicious characters, control codes, and script injections.
   * @param raw - Raw string input.
   * @param maxLength - Maximum permitted length before safe truncation.
   * @returns {{ sanitized: string, isTruncated: boolean }}
   */
  public static sanitizeInput(raw: any, maxLength = PromptBuilder.MAX_INTENT_DEFAULT): { sanitized: string; isTruncated: boolean } {
    if (raw === null || raw === undefined) {
      return { sanitized: 'General system maintenance and performance optimization.', isTruncated: false };
    }

    let text = typeof raw === 'string' ? raw : String(raw);

    // Filter control characters except standard whitespace/newlines
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Strip out HTML tags / script injection vectors
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, '');

    // Strip out conversational preamble filler if present
    text = text.replace(/^(?:sure(?: thing)?|here is|here's|please|as an ai|i will|let me)\b[:,]?\s*/i, '');
    text = text.replace(/\s*(?:let me know if you need|hope this helps|feel free to ask).*$/i, '');

    text = text.trim();

    if (!text) {
      return { sanitized: 'General system maintenance and performance optimization.', isTruncated: false };
    }

    let isTruncated = false;
    if (text.length > maxLength) {
      text = `${text.substring(0, maxLength).trim()}... [truncated]`;
      isTruncated = true;
    }

    return { sanitized: text, isTruncated };
  }

  /**
   * Parses raw intent into domain components, suggested architectural files, and verification rules.
   * @param rawIntent - Raw intent string.
   * @param options - Builder configuration options.
   * @returns {ParsedIntent}
   */
  public static parseIntent(rawIntent: string, options: PromptBuilderOptions = {}): ParsedIntent {
    const { sanitized, isTruncated } = this.sanitizeInput(rawIntent, options.maxIntentLength);
    const lower = sanitized.toLowerCase();

    // Detect technical domain & target stack
    let detectedDomain = options.domain || 'Core Architecture';
    let targetStack = options.targetStack || 'full-stack';

    const suggestedFiles: Array<{ path: string; description: string }> = [];
    const qualityDirectives: string[] = [];
    const nextSteps: string[] = [];

    // Domain inference based on semantic tokens
    if (lower.includes('settings') || lower.includes('cache') || lower.includes('purge') || lower.includes('clean')) {
      detectedDomain = 'Cache & State Optimization';
      targetStack = 'full-stack';
      suggestedFiles.push(
        { path: 'src/main/electronMain.js', description: 'IPC bridge orchestrating Chromium cache and Go backend reset' },
        { path: 'src/renderer/components/Settings.tsx', description: 'Settings component with cache clearing controls' },
        { path: 'src/preload/cachePreload.js', description: 'Safe preload contextBridge API exposing window.api.clearCache' },
        { path: 'go/backend/cache_manager.go', description: 'Go audio backend cache manager and buffer reinitialization' },
      );
      qualityDirectives.push(
        'Verify all 3 layers (Chromium session, Node memory, Go buffers) report purged status upon execution.',
        'Ensure graceful error logging to `logs/error.log` upon any simulated permission or filesystem failure.',
      );
      nextSteps.push(
        'Add configurable TTL auto-clear daemon for scheduled cache sweeps.',
        'Measure startup and reload latency deltas before and after cache purge.',
      );
    } else if (lower.includes('vision') || lower.includes('eye') || lower.includes('pose') || lower.includes('camera')) {
      detectedDomain = 'Vision & Visual Tracking';
      targetStack = 'full-stack';
      suggestedFiles.push(
        { path: 'src/vision/promptBuilder.ts', description: 'Vision service structured prompt generation module' },
        { path: 'src/vision/index.ts', description: 'Public entry point for vision service and prompt builder' },
        { path: 'src/main/electron/ipcHandlers.ts', description: 'Main process IPC handlers for vision prompt building' },
        { path: 'src/main/electronMain.js', description: 'Electron eye bridge forwarding visual kinematic events' },
      );
      qualityDirectives.push(
        'All TypeScript code must compile without errors via `tsc --noEmit` and conform to strict ESLint rules.',
        'Verify AST integrity on all modified and new JavaScript/TypeScript files using `node -c`.',
      );
      nextSteps.push(
        'Implement real-time visual tracking feedback loop in renderer overlay.',
        'Add multi-model vision inference for pose estimation and kinematic state detection.',
      );
    } else if (lower.includes('audio') || lower.includes('stream') || lower.includes('dsp') || lower.includes('pcm') || lower.includes('ring')) {
      detectedDomain = 'Audio Engine & DSP Pipeline';
      targetStack = 'go-backend';
      suggestedFiles.push(
        { path: 'go/audio/prompt_service.go', description: 'Audio stream synthesis and frame packet delivery' },
        { path: 'backend/audio/engine.go', description: 'High-throughput audio DSP engine and ring buffer pipeline' },
        { path: 'src/main/ipc/audioBridge.js', description: 'Low-latency fast-path audio IPC bridge for Electron' },
      );
      qualityDirectives.push(
        'Verify zero audio buffer underruns, packet drop rate under 0.01%, and sub-20ms audio handoff latency.',
        'Run `go test -v -cover ./...` and `go vet ./...` ensuring all audio routines pass with 100% thread safety.',
      );
      nextSteps.push(
        'Integrate WebRTC real-time audio synchronization for multi-party conversational streaming.',
        'Benchmark audio DSP throughput under sustained high-frequency frame ingestion bursts.',
      );
    } else if (lower.includes('ui') || lower.includes('renderer') || lower.includes('react') || lower.includes('component')) {
      detectedDomain = 'Renderer & UI Layer';
      targetStack = 'electron-ui';
      suggestedFiles.push(
        { path: 'src/renderer/components/Settings.tsx', description: 'Primary settings and configuration dashboard' },
        { path: 'src/renderer/components/UILayer.jsx', description: 'Reactive multi-lingual UI overlay component' },
        { path: 'src/preload/index.js', description: 'ContextBridge IPC boundary script for renderer windows' },
      );
      qualityDirectives.push(
        'Ensure 60 FPS UI rendering without main-thread blocking or visual layout tearing.',
        'All React components must pass ESLint and maintain strict props interface typing.',
      );
      nextSteps.push(
        'Add user preference persistence in local storage with smooth UI toast feedback.',
        'Implement dark-mode theme customization and responsive layout scaling.',
      );
    } else {
      // Default domain fallback
      suggestedFiles.push(
        { path: 'src/main/electronMain.js', description: 'Electron main process application lifecycle coordinator' },
        { path: 'src/vision/promptBuilder.ts', description: 'Structured prompt builder and intent parser' },
        { path: 'go/backend/movement_handler.go', description: 'Go backend state and kinematic handler' },
      );
      qualityDirectives.push(
        'All new TypeScript/JavaScript files must pass `tsc --noEmit` and `node -c` syntax verification.',
        'Zero regressions: existing IPC channels and audio playback must retain full functional parity.',
      );
      nextSteps.push(
        'Extend test coverage with end-to-end integration assertions.',
        'Deploy performance diagnostics across multi-process IPC channels.',
      );
    }

    // Append custom files if provided
    if (options.customFiles && options.customFiles.length > 0) {
      suggestedFiles.push(...options.customFiles);
    }

    // Append custom quality requirements if provided
    if (options.customQualityRequirements && options.customQualityRequirements.length > 0) {
      qualityDirectives.push(...options.customQualityRequirements);
    }

    // Append custom next steps if provided
    if (options.customNextSteps && options.customNextSteps.length > 0) {
      nextSteps.push(...options.customNextSteps);
    }

    // Capitalize objective properly
    const inferredObjective = sanitized.charAt(0).toUpperCase() + sanitized.slice(1);

    return {
      rawIntent,
      sanitizedIntent: sanitized,
      detectedDomain,
      targetStack,
      inferredObjective,
      suggestedFiles,
      qualityDirectives,
      nextSteps,
      isTruncated,
    };
  }

  /**
   * Assembles the four required sections into an authoritative Antigravity developer prompt.
   * @param parsed - Parsed intent object.
   * @returns {string} Fully structured 4-section prompt string.
   */
  public static assemblePrompt(parsed: ParsedIntent): string {
    const section1Header = 'Clear Technical Objective';
    const section1Body = `${parsed.inferredObjective}${parsed.inferredObjective.endsWith('.') ? '' : '.'}`;

    const section2Header = 'Key Files / Architecture';
    const section2Body = parsed.suggestedFiles
      .map((f) => `- ${f.path}: ${f.description}`)
      .join('\n');

    const section3Header = 'Quality Requirements & AST Verification';
    const section3Body = parsed.qualityDirectives
      .map((q) => `- ${q}`)
      .join('\n');

    const section4Header = 'Next Steps & Continuation Roadmap';
    const section4Body = parsed.nextSteps
      .map((step, idx) => `${idx + 1}. ${step}`)
      .join('\n');

    return [
      `${section1Header}\n${section1Body}`,
      `${section2Header}\n${section2Body}`,
      `${section3Header}\n${section3Body}`,
      `${section4Header}\n${section4Body}`,
    ].join('\n\n');
  }

  /**
   * Validates that the generated prompt matches the strict 4-section schema exactly once and in correct order.
   * @param prompt - Generated prompt string.
   * @returns {PromptValidationResult}
   */
  public static validatePrompt(prompt: string): PromptValidationResult {
    const errors: string[] = [];
    const headersFound: string[] = [];

    if (!prompt || typeof prompt !== 'string') {
      return { isValid: false, errors: ['Prompt is empty or not a string'], headersFound: [] };
    }

    let lastIndex = -1;
    for (const header of this.REQUIRED_HEADERS) {
      const idx = prompt.indexOf(header);
      if (idx === -1) {
        errors.push(`Missing required header: "${header}"`);
      } else {
        headersFound.push(header);
        if (idx < lastIndex) {
          errors.push(`Header "${header}" appeared out of order`);
        }
        // Verify header occurs exactly once
        const occurrences = (prompt.match(new RegExp(header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        if (occurrences > 1) {
          errors.push(`Header "${header}" occurs ${occurrences} times (must occur exactly once)`);
        }
        lastIndex = idx;
      }
    }

    const matchesRegex = ANTIGRAVITY_PROMPT_REGEX.test(prompt);
    if (!matchesRegex && errors.length === 0) {
      errors.push('Prompt fails strict Antigravity regex format validation');
    }

    return {
      isValid: errors.length === 0,
      errors,
      headersFound,
    };
  }

  /**
   * High-level entry point: builds, assembles, and validates an Antigravity prompt from user intent.
   * @param intent - Raw user intent.
   * @param options - Builder configuration options.
   * @returns {string} Validated Antigravity prompt.
   */
  public static build(intent: string, options: PromptBuilderOptions = {}): string {
    const parsed = this.parseIntent(intent, options);
    const assembled = this.assemblePrompt(parsed);

    if (options.strictValidation !== false) {
      const validation = this.validatePrompt(assembled);
      if (!validation.isValid) {
        throw new Error(`PromptBuilder validation failed: ${validation.errors.join(', ')}`);
      }
    }

    return assembled;
  }

  /**
   * Instance method wrapper for build.
   */
  public build(intent: string, options?: PromptBuilderOptions): string {
    return PromptBuilder.build(intent, options);
  }
}

export const buildPrompt = (intent: string, options?: PromptBuilderOptions): string => {
  return PromptBuilder.build(intent, options);
};

export default PromptBuilder;
