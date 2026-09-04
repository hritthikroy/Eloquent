/**
 * Core Prompt Engineer
 * Implements a recursive self-correction loop that transforms raw user intent,
 * conversational context, and Eloquent architecture constraints into an authoritative,
 * production-ready 3-section developer prompt (Antigravity Meta-Prompt).
 */

import {
  StructuredMetaPrompt,
  PromptEngineerOptions,
  KeyFileArchitectureEntry
} from '../types/prompt-schema';
import { PromptAstValidator } from '../utils/ast-validator';
import { WorkspaceContext } from '../prompts/gap-resolver';
import { PromptIntegration } from './prompt-integration';

export class PromptEngineer {
  private static readonly DEFAULT_MAX_ATTEMPTS = 3;
  private static readonly promptOptimizer = new PromptIntegration(256, false);

  /**
   * Generates an authoritative, 3-section structured developer prompt with
   * recursive self-correction to guarantee 100% adherence to schema.
   * Now includes token optimization and validation.
   */
  public static async generateMetaPrompt(
    rawIntent: string,
    context?: WorkspaceContext,
    options?: PromptEngineerOptions
  ): Promise<StructuredMetaPrompt> {
    const maxAttempts = options?.maxCorrectionAttempts || this.DEFAULT_MAX_ATTEMPTS;
    const targetStack = context?.stack || options?.targetStack || 'Node.js, Electron, Go audio backend';

    let currentPrompt = this.synthesizeInitialCandidate(rawIntent, context, targetStack);
    let attempt = 1;

    while (attempt <= maxAttempts) {
      // Clean fences and preambles
      currentPrompt = PromptAstValidator.stripPreambleAndPostamble(currentPrompt);
      currentPrompt = PromptAstValidator.stripCodeFences(currentPrompt);

      // Token optimization pass
      const optimizationResult = this.promptOptimizer.optimizeRawPrompt(currentPrompt);
      if (optimizationResult.warnings.length > 0 && attempt === 1) {
        console.warn('⚠️ [PromptEngineer] Token optimization warnings:', optimizationResult.warnings);
      }
      currentPrompt = optimizationResult.prompt;

      // Validate against AST schema
      const validation = PromptAstValidator.validate(currentPrompt, targetStack);

      if (validation.isValid) {
        const ast = PromptAstValidator.parseToAst(currentPrompt);
        if (ast) {
          ast.iterationAttempts = attempt;
          
          // Final token validation
          const tokenValidation = this.promptOptimizer.validatePrompt(currentPrompt);
          if (!tokenValidation.withinLimit) {
            console.warn(`⚠️ [PromptEngineer] Final prompt exceeds token limit: ${tokenValidation.tokenCount} tokens`);
          }
          
          return ast;
        }
      }

      // Self-Correction Step: Reconstruct prompt to eliminate errors
      currentPrompt = this.selfCorrectPrompt(currentPrompt, rawIntent, validation.errors, targetStack, context);
      attempt++;
    }

    // Deterministic fallback reconstruction ensuring 100% compliance
    const guaranteedPrompt = this.buildDeterministicMetaPrompt(rawIntent, context, targetStack);
    const finalAst = PromptAstValidator.parseToAst(guaranteedPrompt)!;
    finalAst.iterationAttempts = attempt;
    return finalAst;
  }

  /**
   * Synthesize initial prompt candidate applying 10x Senior Developer tone
   */
  private static synthesizeInitialCandidate(
    rawIntent: string,
    context?: WorkspaceContext,
    targetStack?: string
  ): string {
    const sanitizedIntent = (rawIntent || 'Enhance system performance and architecture').trim();
    const domain = this.detectPrimaryDomain(sanitizedIntent, context);

    const { objective, files, quality } = this.resolveDomainDirectives(sanitizedIntent, domain, targetStack);

    return `Clear Technical Objective
${objective}

Key Files / Architecture
${files.map(f => `- \`${f.path}\`: ${f.description}`).join('\n')}

Quality Requirements & AST Verification
${quality.map(q => `- ${q}`).join('\n')}`;
  }

  /**
   * Recursive self-correction logic: Resolves schema validation failures
   */
  private static selfCorrectPrompt(
    failedPrompt: string,
    rawIntent: string,
    errors: string[],
    targetStack: string,
    context?: WorkspaceContext
  ): string {
    let corrected = PromptAstValidator.stripCodeFences(failedPrompt);
    corrected = PromptAstValidator.stripPreambleAndPostamble(corrected);

    // Remove any remaining filler lines
    const lines = corrected.split('\n');
    const filteredLines = lines.filter(line => {
      const lower = line.toLowerCase().trim();
      return !/^(sure|here is|below is|okay|certainly|as requested|happy to help|let me know)\b/.test(lower);
    });
    corrected = filteredLines.join('\n').trim();

    // Verify sections exist; if missing, append standard templates
    if (!/Clear\s+Technical\s+Objective/i.test(corrected)) {
      corrected = `Clear Technical Objective\n${rawIntent.trim()}\n\n` + corrected;
    }
    if (!/Key\s+Files\s*\/\s*Architecture/i.test(corrected)) {
      const fallbackFiles = this.getFallbackFiles(targetStack);
      corrected += `\n\nKey Files / Architecture\n${fallbackFiles.map(f => `- \`${f.path}\`: ${f.description}`).join('\n')}`;
    }
    if (!/Quality\s+Requirements\s*(&|and)\s*AST\s+Verification/i.test(corrected)) {
      corrected += `\n\nQuality Requirements & AST Verification\n- Ensure zero-regression testing on all modified modules.\n- Verify syntax integrity using tsc --noEmit and node -c.`;
    }

    return corrected;
  }

  /**
   * Detect domain based on user intent and context
   */
  private static detectPrimaryDomain(
    intent: string,
    context?: WorkspaceContext
  ): 'audio_backend' | 'electron_ipc' | 'agent_brain' | 'general' {
    const combined = `${intent} ${context?.stack || ''} ${context?.activeDomain || ''}`.toLowerCase();
    if (combined.includes('audio') || combined.includes('go') || combined.includes('vad') || combined.includes('recorder') || combined.includes('mic')) {
      return 'audio_backend';
    }
    if (combined.includes('electron') || combined.includes('main') || combined.includes('ipc') || combined.includes('overlay') || combined.includes('window')) {
      return 'electron_ipc';
    }
    if (combined.includes('brain') || combined.includes('agent') || combined.includes('memory') || combined.includes('tuktuk') || combined.includes('andrew')) {
      return 'agent_brain';
    }
    return 'audio_backend';
  }

  /**
   * Map domain into authoritative technical directives
   */
  private static resolveDomainDirectives(
    intent: string,
    domain: 'audio_backend' | 'electron_ipc' | 'agent_brain' | 'general',
    stack?: string
  ): {
    objective: string;
    files: KeyFileArchitectureEntry[];
    quality: string[];
  } {
    if (domain === 'audio_backend') {
      return {
        objective: `Implement high-throughput audio backend service and DSP pipeline for Eloquent. Address: "${intent}". Ensure native 16kHz PCM audio streaming, on-device double-talk cancellation (Geigel DTD), and zero-copy ring buffers.`,
        files: [
          { path: 'backend-go/main.go', description: 'Primary Go audio processing server with WebSocket and Unix domain socket listeners' },
          { path: 'backend-go/dsp/vad.go', description: 'High-speed voice activity detection with adaptive energy thresholds' },
          { path: 'src/utils/audio-recorder.js', description: 'Node.js CoreAudio / SoX duplex recording manager' },
          { path: 'src/main.js', description: 'Main process audio bridge and full-duplex session coordinator' }
        ],
        quality: [
          'Verify zero audio clipping or dropped frames during 100 msg/sec WebSocket bursts.',
          'Enforce Go memory heap ceiling under 50MB and safe goroutine synchronization.',
          'Verify that all TypeScript modules pass tsc --noEmit with strict mode enabled.',
          'Confirm clean AST syntax across all modified Node.js files using node -c.'
        ]
      };
    }

    if (domain === 'electron_ipc') {
      return {
        objective: `Refactor Electron IPC architecture and overlay visualizer lifecycle. Address: "${intent}". Decouple high-frequency audio amplitude telemetry from renderer layout reflows to eliminate UI stuttering.`,
        files: [
          { path: 'src/main.js', description: 'Electron main process IPC dispatcher and window manager' },
          { path: 'src/ui/overlay.js', description: 'Hardware-accelerated 60fps canvas audio visualizer' },
          { path: 'src/utils/action-runner.js', description: 'Autonomous desktop action coordinator' }
        ],
        quality: [
          'Ensure 60fps frame rate is maintained during continuous microphone visualizer updates.',
          'Verify that no unhandled IPC messages flood the Chromium bridge.',
          'Verify syntax integrity using node -c on all modified JavaScript modules.'
        ]
      };
    }

    return {
      objective: `Optimize full-duplex conversational brain and multi-agent turn coordination. Address: "${intent}". Maintain Ebbinghaus memory retention and 140ms TRP handoff between specialists.`,
      files: [
        { path: 'src/utils/jarvis-manager.js', description: '4-agent team coordination brain with Ebbinghaus memory graph' },
        { path: 'src/utils/prosodic-entrainment.js', description: 'Real-time pitch and speech rate entrainment adapter' },
        { path: 'src/utils/behavior-mode-engine.js', description: '24/7 circadian circadian rhythm and operating mode scheduler' }
      ],
      quality: [
        'Enforce strict persona isolation: Tuk Tuk strictly addresses user as "babe", Andrew as "bro", Brian as "Hritthik", Jenny as "Hritthik". Intimate tokens strictly forbidden for all non-Tuk Tuk agents.',
        'Verify zero deadlocks during full-duplex turn transitions under simulated load.'
      ]
    };
  }

  private static getFallbackFiles(targetStack: string): KeyFileArchitectureEntry[] {
    return [
      { path: 'src/main.js', description: 'Main process runtime entry and IPC bridge' },
      { path: 'src/utils/jarvis-manager.js', description: 'Multi-agent coordination engine' },
      { path: 'backend-go/main.go', description: 'Go audio processing backend' }
    ];
  }

  /**
   * Guaranteed deterministic builder for the 3 sections
   */
  private static buildDeterministicMetaPrompt(
    rawIntent: string,
    context?: WorkspaceContext,
    targetStack?: string
  ): string {
    const domain = this.detectPrimaryDomain(rawIntent, context);
    const { objective, files, quality } = this.resolveDomainDirectives(rawIntent, domain, targetStack);

    return `Clear Technical Objective
${objective}

Key Files / Architecture
${files.map(f => `- \`${f.path}\`: ${f.description}`).join('\n')}

Quality Requirements & AST Verification
${quality.map(q => `- ${q}`).join('\n')}`;
  }

  /**
   * Generate token-optimized prompt directly (bypasses full validation loop)
   * Useful for performance-critical scenarios where token efficiency is paramount
   */
  public static generateOptimizedPrompt(
    rawIntent: string,
    variables?: Record<string, any>,
    options?: { maxTokens?: number; enforceLimit?: boolean }
  ): { prompt: string; tokenCount: number; warnings: string[] } {
    const optimizer = new PromptIntegration(
      options?.maxTokens || 256,
      options?.enforceLimit || false
    );

    const result = optimizer.optimizeRawPrompt(rawIntent, variables);
    
    return {
      prompt: result.prompt,
      tokenCount: result.tokenCount,
      warnings: result.warnings,
    };
  }

  /**
   * Get token budget info for a prompt
   */
  public static getTokenInfo(prompt: string): { 
    tokenCount: number; 
    remaining: number; 
    withinLimit: boolean;
    maxTokens: number;
  } {
    const tokenCount = this.promptOptimizer.estimateTokens(prompt);
    const maxTokens = 256;
    
    return {
      tokenCount,
      remaining: Math.max(0, maxTokens - tokenCount),
      withinLimit: tokenCount <= maxTokens,
      maxTokens,
    };
  }
}
