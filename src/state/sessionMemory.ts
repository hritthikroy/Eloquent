/**
 * src/state/sessionMemory.ts
 *
 * Lightweight Persistent Session State Manager & Anti-Loop Audit Engine.
 *
 * Provides an immutable audit trail of resolved intents, input hashes, and execution results.
 * Features a deterministic loop detector and self-healing quarantine to terminate canned loops
 * and conversational hallucinations.
 *
 * Strict TypeScript Typing: ZERO `any` types.
 */

import * as crypto from 'crypto';

export type ExecutionStatus = 'success' | 'failed' | 'quarantined' | 'pending';

export interface SessionIntentEntry {
  readonly id: string;
  readonly intentId: string;
  readonly action: string;
  readonly inputHash: string;
  readonly rawInput: string;
  readonly timestamp: number;
  readonly bypassLLM: boolean;
  readonly resultStatus: ExecutionStatus;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface IntentRecordInput {
  readonly intentId?: string;
  readonly action: string;
  readonly rawInput: string;
  readonly bypassLLM?: boolean;
  readonly resultStatus?: ExecutionStatus;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface LoopDetectionResult {
  readonly isLoop: boolean;
  readonly repeatCount: number;
  readonly action: string;
  readonly shouldQuarantine: boolean;
  readonly recommendedAction: 'proceed' | 'quarantine' | 'break_loop';
  readonly reason: string;
}

export interface QuarantineRecord {
  readonly action: string;
  readonly quarantinedAt: number;
  readonly expiresAt: number;
  readonly reason: string;
  readonly triggerCount: number;
}

export interface SessionMemoryOptions {
  readonly maxAuditSize?: number;
  readonly loopThreshold?: number;       // Consecutive repeats to quarantine (default: 3)
  readonly windowDurationMs?: number;   // Sliding time window in ms (default: 15000)
  readonly windowThreshold?: number;     // Occurrences in window to trigger loop (default: 5)
  readonly defaultQuarantineMs?: number; // Quarantine duration in ms (default: 30000)
}

/**
 * Generates a SHA-256 hash for normalized input strings.
 */
function computeInputHash(text: string): string {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

/**
 * Creates an immutable unique identifier for session records.
 */
function createRecordId(): string {
  const hrTime = process.hrtime.bigint();
  const rand = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  return `audit-${hrTime.toString(36)}-${rand}`;
}

export class SessionMemory {
  private readonly maxAuditSize: number;
  private readonly loopThreshold: number;
  private readonly windowDurationMs: number;
  private readonly windowThreshold: number;
  private readonly defaultQuarantineMs: number;

  private auditTrail: SessionIntentEntry[] = [];
  private readonly quarantineMap = new Map<string, QuarantineRecord>();

  constructor(options: SessionMemoryOptions = {}) {
    this.maxAuditSize = options.maxAuditSize ?? 50;
    this.loopThreshold = options.loopThreshold ?? 3;
    this.windowDurationMs = options.windowDurationMs ?? 15000;
    this.windowThreshold = options.windowThreshold ?? 5;
    this.defaultQuarantineMs = options.defaultQuarantineMs ?? 30000;
  }

  /**
   * Evaluates whether an incoming action/input constitutes a repeating loop.
   *
   * @param action - Intended action to execute
   * @param rawInput - Raw text input
   * @returns LoopDetectionResult detailing repeat counts and recommendation
   */
  public detectLoop(action: string, rawInput: string): LoopDetectionResult {
    const now = Date.now();
    this.purgeExpiredQuarantines(now);

    // 1. Check if action is actively quarantined
    const quarantine = this.quarantineMap.get(action);
    if (quarantine && now < quarantine.expiresAt) {
      return {
        isLoop: true,
        repeatCount: quarantine.triggerCount,
        action,
        shouldQuarantine: true,
        recommendedAction: 'quarantine',
        reason: `Action '${action}' is currently quarantined (${quarantine.reason}) until ${new Date(quarantine.expiresAt).toISOString()}`,
      };
    }

    // 2. Evaluate consecutive identical actions
    let consecutiveCount = 0;
    const inputHash = computeInputHash(rawInput);

    for (let i = this.auditTrail.length - 1; i >= 0; i--) {
      const entry = this.auditTrail[i];
      if (entry && (entry.action === action || entry.inputHash === inputHash)) {
        consecutiveCount++;
      } else {
        break;
      }
    }

    if (consecutiveCount >= this.loopThreshold) {
      return {
        isLoop: true,
        repeatCount: consecutiveCount,
        action,
        shouldQuarantine: true,
        recommendedAction: 'quarantine',
        reason: `Exceeded consecutive repetition threshold (${consecutiveCount} >= ${this.loopThreshold})`,
      };
    }

    // 3. Evaluate window frequency
    const windowStart = now - this.windowDurationMs;
    let windowCount = 0;

    for (let i = this.auditTrail.length - 1; i >= 0; i--) {
      const entry = this.auditTrail[i];
      if (!entry || entry.timestamp < windowStart) {
        break;
      }
      if (entry.action === action || entry.inputHash === inputHash) {
        windowCount++;
      }
    }

    if (windowCount >= this.windowThreshold) {
      return {
        isLoop: true,
        repeatCount: windowCount,
        action,
        shouldQuarantine: true,
        recommendedAction: 'break_loop',
        reason: `Exceeded sliding window threshold (${windowCount} occurrences in ${this.windowDurationMs}ms)`,
      };
    }

    return {
      isLoop: false,
      repeatCount: Math.max(consecutiveCount, windowCount),
      action,
      shouldQuarantine: false,
      recommendedAction: 'proceed',
      reason: 'Repetition within acceptable tolerance limits',
    };
  }

  /**
   * Records an intent into the persistent bounded audit trail.
   * Automatically isolates and quarantines if a loop is detected.
   *
   * @param input - Intent payload details
   * @returns The immutable recorded entry
   */
  public recordIntent(input: IntentRecordInput): SessionIntentEntry {
    const now = Date.now();
    const inputHash = computeInputHash(input.rawInput);
    const loopCheck = this.detectLoop(input.action, input.rawInput);

    let status: ExecutionStatus = input.resultStatus ?? 'pending';

    if (loopCheck.shouldQuarantine) {
      this.quarantineAction(input.action, loopCheck.reason);
      status = 'quarantined';
    }

    const entry: SessionIntentEntry = Object.freeze({
      id: createRecordId(),
      intentId: input.intentId ?? `intent-${now}`,
      action: input.action,
      inputHash,
      rawInput: input.rawInput,
      timestamp: now,
      bypassLLM: input.bypassLLM ?? true,
      resultStatus: status,
      metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
    });

    this.auditTrail.push(entry);

    // Maintain bounded size to prevent memory leaks
    if (this.auditTrail.length > this.maxAuditSize) {
      this.auditTrail = this.auditTrail.slice(this.auditTrail.length - this.maxAuditSize);
    }

    return entry;
  }

  /**
   * Quarantines an action, preventing runaway repetition.
   */
  public quarantineAction(action: string, reason: string, durationMs?: number): void {
    const now = Date.now();
    const duration = durationMs ?? this.defaultQuarantineMs;
    const existing = this.quarantineMap.get(action);
    const triggerCount = existing ? existing.triggerCount + 1 : 1;

    const record: QuarantineRecord = Object.freeze({
      action,
      quarantinedAt: now,
      expiresAt: now + duration,
      reason,
      triggerCount,
    });

    this.quarantineMap.set(action, record);
  }

  /**
   * Manually releases an action from quarantine.
   */
  public releaseQuarantine(action: string): void {
    this.quarantineMap.delete(action);
  }

  /**
   * Checks if an action is actively under quarantine.
   */
  public isQuarantined(action: string): boolean {
    this.purgeExpiredQuarantines(Date.now());
    return this.quarantineMap.has(action);
  }

  /**
   * Purges expired quarantine entries (self-healing).
   */
  private purgeExpiredQuarantines(now: number): void {
    for (const [action, record] of this.quarantineMap.entries()) {
      if (now >= record.expiresAt) {
        this.quarantineMap.delete(action);
      }
    }
  }

  /**
   * Returns a read-only view of the audit trail.
   */
  public getAuditTrail(limit?: number): ReadonlyArray<SessionIntentEntry> {
    if (limit && limit > 0 && limit < this.auditTrail.length) {
      return Object.freeze(this.auditTrail.slice(this.auditTrail.length - limit));
    }
    return Object.freeze([...this.auditTrail]);
  }

  /**
   * Clears the audit trail and quarantine records.
   */
  public clear(): void {
    this.auditTrail = [];
    this.quarantineMap.clear();
  }

  /**
   * Alias for clear() to reset state completely.
   */
  public resetState(): void {
    this.clear();
  }
}
