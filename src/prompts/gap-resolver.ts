/**
 * Gap Resolver
 * Logic engine that maps identified conversation gaps and active workspace context
 * to synthesize a structured, non-hallucinated, production-ready corrective prompt.
 */

import { IntegrityAuditResult, GapEvent } from '../analysis/integrity-auditor';

export interface WorkspaceContext {
  stack?: string; // Default: "Node.js, Electron, Go audio backend"
  activeApp?: string;
  projectDir?: string;
  activeDomain?: 'audio_backend' | 'electron_ui' | 'agent_brain' | 'general';
  activeTask?: string;
  recentMilestones?: string[];
  mentionedEntities?: string[];
}

export interface ResolvedGapPrompt {
  hasResolution: boolean;
  inferredIntent: string;
  mappedTask: string;
  confidence: number;
  resolvedPrompt: string;
  technicalDirectives: string[];
  resolvedGapsCount: number;
  integrityReport: string;
}

export class GapResolver {
  private static readonly DEFAULT_WORKSPACE_STACK = 'Node.js, Electron, Go audio backend';

  /**
   * Synthesize corrective prompt from identified gaps and workspace context
   */
  public static resolve(
    auditResult: IntegrityAuditResult,
    context?: WorkspaceContext
  ): ResolvedGapPrompt {
    const stack = context?.stack || this.DEFAULT_WORKSPACE_STACK;
    const activeDomain = context?.activeDomain || this.inferDomainFromContext(context, auditResult);

    if (!auditResult || !auditResult.hasGaps || auditResult.gaps.length === 0) {
      return {
        hasResolution: false,
        inferredIntent: 'Dialogue flow is continuous; zero conversational gaps to resolve.',
        mappedTask: 'Maintain standard conversational turn processing.',
        confidence: 1.0,
        resolvedPrompt: '',
        technicalDirectives: [],
        resolvedGapsCount: 0,
        integrityReport: '[Conversation Integrity: Nominal / No Gaps Detected]'
      };
    }

    // Process the primary gap (most critical or latest in the turn queue)
    const primaryGap = auditResult.gaps[auditResult.gaps.length - 1];
    const { inferredIntent, mappedTask, technicalDirectives, confidence } =
      this.inferTechnicalTask(primaryGap, stack, activeDomain);

    // Build the structured, non-hallucinated developer prompt
    const resolvedPrompt = this.buildCorrectivePrompt({
      primaryGap,
      inferredIntent,
      mappedTask,
      technicalDirectives,
      stack,
      auditResult
    });

    const integrityReport = this.generateIntegrityReport(auditResult, primaryGap, inferredIntent, mappedTask);

    return {
      hasResolution: true,
      inferredIntent,
      mappedTask,
      confidence,
      resolvedPrompt,
      technicalDirectives,
      resolvedGapsCount: auditResult.totalGaps,
      integrityReport
    };
  }

  /**
   * Infer technical domain from workspace context or gap hints
   */
  private static inferDomainFromContext(
    context?: WorkspaceContext,
    auditResult?: IntegrityAuditResult
  ): 'audio_backend' | 'electron_ui' | 'agent_brain' | 'general' {
    const combinedText = [
      context?.stack || '',
      context?.activeApp || '',
      ...(context?.mentionedEntities || []),
      ...(auditResult?.gaps.map(g => g.rawText) || [])
    ].join(' ').toLowerCase();

    if (combinedText.includes('go') || combinedText.includes('audio') || combinedText.includes('vad') || combinedText.includes('backend')) {
      return 'audio_backend';
    }
    if (combinedText.includes('electron') || combinedText.includes('window') || combinedText.includes('ui') || combinedText.includes('renderer')) {
      return 'electron_ui';
    }
    if (combinedText.includes('brain') || combinedText.includes('memory') || combinedText.includes('agent') || combinedText.includes('tuktuk')) {
      return 'agent_brain';
    }
    return 'audio_backend'; // Default to primary Eloquent performance module
  }

  /**
   * Map ambiguous or truncated input into a concrete, unambiguous developer task
   */
  private static inferTechnicalTask(
    gap: GapEvent,
    stack: string,
    domain: 'audio_backend' | 'electron_ui' | 'agent_brain' | 'general'
  ): {
    inferredIntent: string;
    mappedTask: string;
    technicalDirectives: string[];
    confidence: number;
  } {
    const rawLower = gap.rawText.toLowerCase().trim();

    // Specific mapping for truncated "write a" / "write a."
    if (/\b(write\s+a|build\s+a|create\s+a|implement\s+a)[.?!]*$/i.test(rawLower)) {
      if (domain === 'audio_backend' || stack.toLowerCase().includes('go')) {
        return {
          inferredIntent: 'Developer initiated a request to implement an audio backend processing service in Go but the input was truncated ("write a.").',
          mappedTask: 'write a Go audio processing service',
          technicalDirectives: [
            'Create or enhance backend-go audio processing pipeline with 16kHz PCM ring buffer.',
            'Implement native double-talk detection (Geigel DTD) and low-latency audio packet streaming.',
            'Expose Unix domain socket or local WebSocket bridge for zero-copy Electron integration.',
            'Ensure goroutine safety, memory heap stability under 50MB, and clean SIGTERM handling.'
          ],
          confidence: 0.96
        };
      } else if (domain === 'electron_ui') {
        return {
          inferredIntent: 'Developer intended to create an Electron UI visualization module ("write a.").',
          mappedTask: 'write an Electron audio visualizer bridge',
          technicalDirectives: [
            'Implement 60fps canvas visualizer bridge in Electron renderer.',
            'Decouple VU meter amplitude updates from React/DOM layout cycle.',
            'Ensure zero-lag IPC communication between main process and overlay window.'
          ],
          confidence: 0.91
        };
      }
    }

    // Generic Missing Object Reference (e.g. "fix it", "do that")
    if (gap.gapType === 'missing_object_reference') {
      return {
        inferredIntent: `Ambiguous directive "${gap.rawText}" requires contextual target anchoring within the ${stack} workspace.`,
        mappedTask: 'audit and resolve the most recent active subsystem error',
        technicalDirectives: [
          'Inspect the active subsystem logs and identify the latest failing operation.',
          'Formulate an equational root cause analysis before making code modifications.',
          'Verify that fixes do not introduce regressions into concurrent audio streams.'
        ],
        confidence: 0.84
      };
    }

    // Fallback for general truncated instructions
    return {
      inferredIntent: `Inferred technical instruction completion for truncated input: "${gap.rawText}".`,
      mappedTask: 'write a Go audio processing service',
      technicalDirectives: [
        'Complete the dangling specification using active workspace invariants.',
        'Target backend-go service architecture with standard Go idioms.',
        'Validate syntax with go vet and integration tests.'
      ],
      confidence: 0.88
    };
  }

  /**
   * Synthesize a complete, non-hallucinated production developer prompt
   */
  private static buildCorrectivePrompt(params: {
    primaryGap: GapEvent;
    inferredIntent: string;
    mappedTask: string;
    technicalDirectives: string[];
    stack: string;
    auditResult: IntegrityAuditResult;
  }): string {
    const { primaryGap, inferredIntent, mappedTask, technicalDirectives, stack } = params;

    return `### [CONVERSATION INTEGRITY RESOLUTION PROMPT]
**Contextual Correction for Truncated Input**: "${primaryGap.rawText}" (Turn ${primaryGap.turnIndex})
**Inferred Developer Objective**: ${inferredIntent}
**Concrete Target Task**: ${mappedTask}
**Active Workspace Stack**: ${stack}

#### Architectural Directives:
${technicalDirectives.map((d, i) => `${i + 1}. ${d}`).join('\n')}

#### Execution Constraints:
- Zero Hallucinations: Adhere strictly to the existing codebase structure (Node.js Electron main process, Go audio backend).
- Deterministic Output: Produce valid, compilable code without placeholder ellipses or broken imports.
- Pacing & Concurrency: Preserve full-duplex hands-free audio streaming and zero-deadlock state transitions.`;
  }

  /**
   * Format human-readable Integrity Report for context injection
   */
  public static generateIntegrityReport(
    auditResult: IntegrityAuditResult,
    primaryGap: GapEvent,
    inferredIntent: string,
    mappedTask: string
  ): string {
    return `[CONVERSATION INTEGRITY & GAP REPORT: ACTIVE GAPS DETECTED]:
• Total Gaps Identified: ${auditResult.totalGaps}
• Primary Issue: ${primaryGap.gapType} at turn ${primaryGap.turnIndex} ("${primaryGap.rawText}") [Confidence: ${Math.round(primaryGap.confidence * 100)}%]
• Inferred Developer Intent: ${inferredIntent}
• Mapped Technical Task: ${mappedTask}
• Corrective Protocol: The agent must execute the mapped technical task directly, eliminating conversational stalls.`;
  }
}
