/**
 * Context Injector
 * Modifies system prompt context by injecting mandatory Conversation Integrity & Gap Analysis reports.
 * Guarantees that the AI agent is explicitly aware of conversational discontinuities and inferred intents
 * before executing new technical tasks.
 */

import { IntegrityAuditor, ConversationTurn, IntegrityAuditResult } from '../analysis/integrity-auditor';
import { GapResolver, WorkspaceContext, ResolvedGapPrompt } from '../prompts/gap-resolver';

export interface InjectedContextResult {
  enrichedPrompt: string;
  auditResult: IntegrityAuditResult;
  resolution: ResolvedGapPrompt;
  integrityReport: string;
}

export class ContextInjector {
  public static readonly NOMINAL_INTEGRITY_REPORT =
    `[CONVERSATION INTEGRITY & GAP REPORT: NOMINAL]:\n• Status: 100% Dialogue Coherence (Zero semantic discontinuities or truncated commands detected).`;

  /**
   * Injects the mandatory Integrity Report into an existing system prompt
   */
  public static inject(
    basePrompt: string,
    conversationHistory: ConversationTurn[] | null | undefined,
    workspaceContext?: WorkspaceContext
  ): InjectedContextResult {
    const safeBasePrompt = (basePrompt || '').trim();

    // 1. Audit conversation turns for gaps
    const auditResult = IntegrityAuditor.audit(conversationHistory);

    // 2. Resolve identified gaps against the workspace context
    const resolution = GapResolver.resolve(auditResult, workspaceContext);

    // 3. Format the mandatory Integrity Report
    const integrityReport = auditResult.hasGaps
      ? resolution.integrityReport
      : this.NOMINAL_INTEGRITY_REPORT;

    // 4. Assemble the enriched system prompt with mandatory Integrity block
    const separator = '\n\n================================================================================\n';
    const enrichedPrompt = `${safeBasePrompt}${separator}${integrityReport}${separator}`.trim();

    return {
      enrichedPrompt,
      auditResult,
      resolution,
      integrityReport
    };
  }

  /**
   * Helper method for JavaScript / CommonJS runtime integration
   */
  public static formatIntegrityBlock(
    history: ConversationTurn[] | null | undefined,
    context?: WorkspaceContext
  ): string {
    const auditResult = IntegrityAuditor.audit(history);
    const resolution = GapResolver.resolve(auditResult, context);
    return auditResult.hasGaps ? resolution.integrityReport : this.NOMINAL_INTEGRITY_REPORT;
  }
}
