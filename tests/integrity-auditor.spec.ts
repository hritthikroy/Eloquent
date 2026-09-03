/**
 * Conversation Integrity Auditor & Gap Resolver Unit Tests
 * Verifies token-level and semantic analysis, gap detection,
 * contextual prompt synthesis, edge cases, and context injection.
 */

import assert from 'assert';
import { IntegrityAuditor, ConversationTurn, IntegrityAuditResult } from '../src/analysis/integrity-auditor';
import { GapResolver, WorkspaceContext } from '../src/prompts/gap-resolver';
import { ContextInjector } from '../src/utils/context-injector';

console.log('================================================================================');
console.log('🧪 RUNNING CONVERSATION INTEGRITY & GAP ANALYSIS TEST SUITE');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// TEST SUITE 1: Target Truncated Instruction Detection ("write a.")
// -----------------------------------------------------------------------------
console.log('▶ [TEST 1] Truncated Instruction Detection ("write a.")');
const conversationWithTruncatedInstruction: ConversationTurn[] = [
  { role: 'user', content: 'Hey team, how is our audio backend running?' },
  { role: 'assistant', content: 'The audio pipeline is running with zero-copy buffers, bro!' },
  { role: 'user', content: 'write a.' }
];

const auditResult1 = IntegrityAuditor.audit(conversationWithTruncatedInstruction);
assert.strictEqual(auditResult1.hasGaps, true, 'Auditor must detect gaps in truncated conversation');
assert.strictEqual(auditResult1.totalGaps, 1, 'Auditor must detect exactly 1 gap');
assert.strictEqual(auditResult1.gaps[0].gapType, 'truncated_instruction', 'Gap type must be truncated_instruction');
assert.strictEqual(auditResult1.gaps[0].turnIndex, 2, 'Gap must be at turn index 2');
assert.ok(auditResult1.gaps[0].confidence >= 0.95, 'Confidence must be >= 0.95');
console.log(`   Detected gap at turn ${auditResult1.gaps[0].turnIndex}: "${auditResult1.gaps[0].rawText}"`);
console.log(`   Reason: ${auditResult1.gaps[0].reason}`);
console.log('   ✅ Test 1 Passed: Correctly identified truncated instruction "write a."\n');

// -----------------------------------------------------------------------------
// TEST SUITE 2: Workspace Mapping ("write a" + audio backend -> Go audio service)
// -----------------------------------------------------------------------------
console.log('▶ [TEST 2] Gap Resolution & Task Inference (Eloquent Workspace Stack)');
const workspaceContext: WorkspaceContext = {
  stack: 'Node.js, Electron, Go audio backend',
  activeDomain: 'audio_backend',
  mentionedEntities: ['audio', 'backend', 'stream']
};

const resolved = GapResolver.resolve(auditResult1, workspaceContext);
assert.strictEqual(resolved.hasResolution, true, 'Resolver must provide a resolution');
assert.strictEqual(resolved.mappedTask, 'write a Go audio processing service', 'Must map to "write a Go audio processing service"');
assert.ok(resolved.confidence >= 0.90, 'Resolution confidence must be >= 0.90');
assert.ok(resolved.resolvedPrompt.includes('CONVERSATION INTEGRITY RESOLUTION PROMPT'), 'Prompt must contain structured header');
assert.ok(resolved.resolvedPrompt.includes('backend-go'), 'Prompt must map to concrete workspace files');
assert.ok(resolved.technicalDirectives.length >= 3, 'Must provide concrete technical directives');
console.log(`   Mapped Task: "${resolved.mappedTask}" (Confidence: ${resolved.confidence * 100}%)`);
console.log(`   Inferred Intent: "${resolved.inferredIntent}"`);
console.log('   Directives:\n' + resolved.technicalDirectives.map(d => `     • ${d}`).join('\n'));
console.log('   ✅ Test 2 Passed: Mapped "write a." + audio backend to "write a Go audio processing service"\n');

// -----------------------------------------------------------------------------
// TEST SUITE 3: Missing Object Reference Detection ("fix it" without antecedent)
// -----------------------------------------------------------------------------
console.log('▶ [TEST 3] Missing Object Reference Detection (Ambiguous Antecedent)');
const conversationWithVagueDirective: ConversationTurn[] = [
  { role: 'user', content: 'fix it.' }
];

const auditResult3 = IntegrityAuditor.audit(conversationWithVagueDirective);
assert.strictEqual(auditResult3.hasGaps, true, 'Auditor must detect missing object reference');
assert.strictEqual(auditResult3.gaps[0].gapType, 'missing_object_reference');
console.log(`   Detected ambiguous reference: "${auditResult3.gaps[0].rawText}" (turn ${auditResult3.gaps[0].turnIndex})`);
console.log('   ✅ Test 3 Passed: Successfully flagged missing object reference\n');

// -----------------------------------------------------------------------------
// TEST SUITE 4: Unaddressed Assistant Follow-Up
// -----------------------------------------------------------------------------
console.log('▶ [TEST 4] Unaddressed Assistant Follow-Up Detection');
const conversationWithIgnoredQuestion: ConversationTurn[] = [
  { role: 'user', content: 'Can we release the beta?' },
  { role: 'assistant', content: 'Are we cutting features or shipping the full stack?' },
  { role: 'user', content: 'um' }
];

const auditResult4 = IntegrityAuditor.audit(conversationWithIgnoredQuestion);
assert.strictEqual(auditResult4.hasGaps, true, 'Must detect unaddressed follow-up');
assert.ok(auditResult4.gaps.some(g => g.gapType === 'unaddressed_followup'), 'Must flag unaddressed_followup');
console.log('   ✅ Test 4 Passed: Detected unaddressed follow-up\n');

// -----------------------------------------------------------------------------
// TEST SUITE 5: Edge Cases (Empty History, Non-English, Malformed Objects)
// -----------------------------------------------------------------------------
console.log('▶ [TEST 5] Edge Cases: Empty History, Non-English & Malformed Inputs');
// 5a. Empty array
const emptyResult = IntegrityAuditor.audit([]);
assert.strictEqual(emptyResult.hasGaps, false);
assert.strictEqual(emptyResult.overallIntegrityScore, 1.0);

// 5b. Null / Undefined
const nullResult = IntegrityAuditor.audit(null as any);
assert.strictEqual(nullResult.hasGaps, false);

// 5c. Non-English input (e.g. Bengali / Hindi / Spanish)
const nonEnglishTurn: ConversationTurn[] = [
  { role: 'user', content: 'সবকিছু কি ঠিকঠাক চলছে?' }
];
const nonEngResult = IntegrityAuditor.audit(nonEnglishTurn);
assert.strictEqual(nonEngResult.hasGaps, false, 'Non-English input must not trigger false positive truncation');

// 5d. Malformed objects with missing content
const malformedTurns: ConversationTurn[] = [
  { role: 'user' } as any,
  null as any,
  { role: 'assistant', content: '' }
];
const malformedResult = IntegrityAuditor.audit(malformedTurns);
assert.strictEqual(malformedResult.hasGaps, false);
console.log('   ✅ Test 5 Passed: Handled all edge cases gracefully with zero exceptions\n');

// -----------------------------------------------------------------------------
// TEST SUITE 6: Context Injector & Mandatory Integrity Report
// -----------------------------------------------------------------------------
console.log('▶ [TEST 6] Mandatory Integrity Report Injection into System Prompt');
const baseSystemPrompt = 'You are the founding squad of 4 specialists for Eloquent.';

// 6a. Injection when gaps exist
const injectedGaps = ContextInjector.inject(baseSystemPrompt, conversationWithTruncatedInstruction, workspaceContext);
assert.ok(injectedGaps.enrichedPrompt.includes('[CONVERSATION INTEGRITY & GAP REPORT: ACTIVE GAPS DETECTED]'));
assert.ok(injectedGaps.enrichedPrompt.includes('write a Go audio processing service'));
assert.strictEqual(injectedGaps.auditResult.totalGaps, 1);

// 6b. Injection when dialogue is nominal (zero regressions)
const cleanDialogue: ConversationTurn[] = [
  { role: 'user', content: 'How is the Go audio backend performing today?' },
  { role: 'assistant', content: 'It is streaming 16kHz PCM audio with under 28ms latency, brother.' }
];
const injectedNominal = ContextInjector.inject(baseSystemPrompt, cleanDialogue, workspaceContext);
assert.ok(injectedNominal.enrichedPrompt.includes('[CONVERSATION INTEGRITY & GAP REPORT: NOMINAL]'));
assert.strictEqual(injectedNominal.auditResult.hasGaps, false);
assert.strictEqual(injectedNominal.auditResult.totalGaps, 0);
assert.strictEqual(injectedNominal.auditResult.overallIntegrityScore, 1.0);
console.log('   ✅ Test 6 Passed: ContextInjector correctly injects mandatory reports for both gap and nominal flows\n');

// -----------------------------------------------------------------------------
// TEST SUITE 7: Non-Hallucination Invariants
// -----------------------------------------------------------------------------
console.log('▶ [TEST 7] Non-Hallucination & Architecture Alignment Audit');
assert.ok(resolved.resolvedPrompt.includes('Node.js Electron main process, Go audio backend'));
assert.ok(!resolved.resolvedPrompt.includes('Python Django') && !resolved.resolvedPrompt.includes('Ruby on Rails'));
console.log('   ✅ Test 7 Passed: Generated prompt is 100% architecturally aligned with Eloquent stack\n');

console.log('================================================================================');
console.log('🎉 ALL INTEGRITY AUDITOR & GAP RESOLVER TESTS PASSED WITH 100% SUCCESS!');
console.log('================================================================================\n');
