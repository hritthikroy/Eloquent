/**
 * src/core/intentRouter.ts
 *
 * Stateless Intent Resolution Engine & High-Confidence Technical Task Interceptor.
 *
 * Enforces deterministic task routing to eliminate the "memory loop" and conversational
 * hallucinations by intercepting technical directives and truncated audio transcripts,
 * bypassing the LLM chat pipeline with sub-millisecond execution latency.
 *
 * Strict TypeScript Typing: ZERO `any` types.
 */

export type TaskAction =
  | 'write_go_audio_service'
  | 'init_go_audio_service'
  | 'fix_memory_loop'
  | 'write_prompt'
  | 'general_technical_task';

export type IntentType =
  | 'technical_task'
  | 'direct_execution'
  | 'system_command';

export interface ExecutionPayload {
  readonly [key: string]: string | number | boolean;
}

export interface IntentResolutionResult {
  readonly matched: boolean;
  readonly intentId: string;
  readonly type: IntentType;
  readonly action: TaskAction;
  readonly confidence: number;
  readonly rawInput: string;
  readonly normalizedInput: string;
  readonly isTruncated: boolean;
  readonly bypassLLM: boolean;
  readonly targetService: string;
  readonly executionPayload: Readonly<ExecutionPayload>;
  readonly resolutionLatencyMs: number;
  readonly timestamp: number;
}

export interface IntentRouteConfig {
  readonly minConfidenceThreshold?: number;
  readonly enableTruncatedRecovery?: boolean;
  readonly strictTechnicalBypass?: boolean;
}

// Microsecond-level pre-compiled matchers
const RE_TRUNCATED_CHATTER = /\bchatter\b(?:\.?\s*chatter\s*(?:for)?)?\.?$/i;
const RE_FIX_MEMORY_LOOP = /\bfix\s+memory\s+loop\b/i;
const RE_WRITE_PROMPT = /\bwrite\s+prompt\b/i;
const RE_GO_SERVICE = /\bgo\s+(?:audio\s+)?service\b/i;
const RE_LISTEN_COMMAND = /^\s*listen[\s.!?]*$/i;

/**
 * Generates an immutable, collision-resistant identifier for intent dispatching.
 */
function createIntentId(): string {
  const hrTime = process.hrtime.bigint();
  const randSuffix = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  return `intent-${hrTime.toString(36)}-${randSuffix}`;
}

/**
 * Normalizes input text by trimming, collapsing spaces, and stripping leading/trailing control chars.
 */
export function normalizeTranscript(text: string): string {
  if (!text) {
    return '';
  }
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Resolves developer speech or transcription text into a deterministic technical task.
 * Directly routes high-confidence keywords and truncated commands to execution,
 * completely bypassing LLM conversational chatter.
 *
 * @param transcript - Raw incoming transcript from STT or audio processor
 * @param config - Optional configuration overrides
 * @returns Strictly typed IntentResolutionResult
 */
export function resolveIntent(
  transcript: string,
  config: IntentRouteConfig = {}
): IntentResolutionResult {
  const startTime = process.hrtime.bigint();
  const rawInput = transcript ?? '';
  const normalized = normalizeTranscript(rawInput);
  const minConfidence = config.minConfidenceThreshold ?? 0.85;
  const allowTruncated = config.enableTruncatedRecovery ?? true;

  const defaultUnmatched: IntentResolutionResult = {
    matched: false,
    intentId: '',
    type: 'technical_task',
    action: 'general_technical_task',
    confidence: 0,
    rawInput,
    normalizedInput: normalized,
    isTruncated: false,
    bypassLLM: false,
    targetService: '',
    executionPayload: Object.freeze({}),
    resolutionLatencyMs: 0,
    timestamp: Date.now(),
  };

  if (!normalized) {
    const elapsedNs = Number(process.hrtime.bigint() - startTime);
    return {
      ...defaultUnmatched,
      resolutionLatencyMs: elapsedNs / 1_000_000,
    };
  }

  // 1. Detect truncated instruction gap ("Chatter. Chatter for.", "Chatter for.", "Chatter.")
  if (allowTruncated && (RE_TRUNCATED_CHATTER.test(normalized) || normalized.startsWith('chatter'))) {
    const elapsedNs = Number(process.hrtime.bigint() - startTime);
    const confidence = 0.99;

    if (confidence >= minConfidence) {
      return {
        matched: true,
        intentId: createIntentId(),
        type: 'technical_task',
        action: 'write_go_audio_service',
        confidence,
        rawInput,
        normalizedInput: normalized,
        isTruncated: true,
        bypassLLM: true,
        targetService: 'services/audio',
        executionPayload: Object.freeze({
          detected_gap: 'truncated_instruction',
          target_task: 'write_go_audio_service',
          service_module: 'services/audio/processor.go',
        }),
        resolutionLatencyMs: elapsedNs / 1_000_000,
        timestamp: Date.now(),
      };
    }
  }

  // 2. High-confidence command: "Listen" -> Triggers immediate Go audio service initialization
  if (RE_LISTEN_COMMAND.test(rawInput)) {
    const elapsedNs = Number(process.hrtime.bigint() - startTime);
    const confidence = 0.99;

    if (confidence >= minConfidence) {
      return {
        matched: true,
        intentId: createIntentId(),
        type: 'technical_task',
        action: 'init_go_audio_service',
        confidence,
        rawInput,
        normalizedInput: normalized,
        isTruncated: false,
        bypassLLM: true,
        targetService: 'services/audio',
        executionPayload: Object.freeze({
          command: 'listen',
          target_task: 'init_go_audio_service',
          auto_capture: true,
        }),
        resolutionLatencyMs: elapsedNs / 1_000_000,
        timestamp: Date.now(),
      };
    }
  }

  // 3. Technical task: "fix memory loop"
  if (RE_FIX_MEMORY_LOOP.test(normalized)) {
    const elapsedNs = Number(process.hrtime.bigint() - startTime);
    const confidence = 0.99;

    if (confidence >= minConfidence) {
      return {
        matched: true,
        intentId: createIntentId(),
        type: 'technical_task',
        action: 'fix_memory_loop',
        confidence,
        rawInput,
        normalizedInput: normalized,
        isTruncated: false,
        bypassLLM: true,
        targetService: 'src/state',
        executionPayload: Object.freeze({
          target_task: 'fix_memory_loop',
          target_module: 'src/state/sessionMemory.ts',
        }),
        resolutionLatencyMs: elapsedNs / 1_000_000,
        timestamp: Date.now(),
      };
    }
  }

  // 4. Technical task: "write prompt"
  if (RE_WRITE_PROMPT.test(normalized)) {
    const elapsedNs = Number(process.hrtime.bigint() - startTime);
    const confidence = 0.99;

    if (confidence >= minConfidence) {
      return {
        matched: true,
        intentId: createIntentId(),
        type: 'technical_task',
        action: 'write_prompt',
        confidence,
        rawInput,
        normalizedInput: normalized,
        isTruncated: false,
        bypassLLM: true,
        targetService: 'src/core',
        executionPayload: Object.freeze({
          target_task: 'write_prompt',
          target_module: 'src/core/prompt-engineer.ts',
        }),
        resolutionLatencyMs: elapsedNs / 1_000_000,
        timestamp: Date.now(),
      };
    }
  }

  // 5. Technical task: "Go service" / "go audio service"
  if (RE_GO_SERVICE.test(normalized)) {
    const elapsedNs = Number(process.hrtime.bigint() - startTime);
    const confidence = 0.99;

    if (confidence >= minConfidence) {
      return {
        matched: true,
        intentId: createIntentId(),
        type: 'technical_task',
        action: 'write_go_audio_service',
        confidence,
        rawInput,
        normalizedInput: normalized,
        isTruncated: false,
        bypassLLM: true,
        targetService: 'services/audio',
        executionPayload: Object.freeze({
          target_task: 'write_go_audio_service',
          service_module: 'services/audio/processor.go',
        }),
        resolutionLatencyMs: elapsedNs / 1_000_000,
        timestamp: Date.now(),
      };
    }
  }

  // Unmatched conversational filler: returns false match, allows downstream handling if appropriate
  const elapsedNs = Number(process.hrtime.bigint() - startTime);
  return {
    ...defaultUnmatched,
    resolutionLatencyMs: elapsedNs / 1_000_000,
  };
}

/**
 * Stateful wrapper for applications requiring persistent config or router instantiation.
 */
export class IntentRouter {
  private readonly config: IntentRouteConfig;

  constructor(config: IntentRouteConfig = {}) {
    this.config = Object.freeze({ ...config });
  }

  public resolve(transcript: string): IntentResolutionResult {
    return resolveIntent(transcript, this.config);
  }

  public isDirectBypass(transcript: string): boolean {
    const result = this.resolve(transcript);
    return result.matched && result.bypassLLM;
  }
}
