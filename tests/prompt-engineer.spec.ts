/**
 * Prompt Engineer & AST Validator Test Suite
 * Verifies recursive self-correction, 3-section format enforcement,
 * conversational filler rejection, and stack alignment.
 */

import assert from 'assert';
import { PromptEngineer } from '../src/core/prompt-engineer';
import { PromptAstValidator } from '../src/utils/ast-validator';
import { MainProcessPromptBridge } from '../src/electron/main-process';

async function runPromptEngineerTests() {
  console.log('================================================================================');
  console.log('🧪 RUNNING PROMPT ENGINEER & RECURSIVE SELF-CORRECTION TEST SUITE');
  console.log('================================================================================\n');

  // -----------------------------------------------------------------------------
  // TEST SUITE 1: 3-Section Format Enforcement & Stack File Mappings
  // -----------------------------------------------------------------------------
  console.log('▶ [TEST 1] Generating Meta-Prompt with 3-Section Format');
  const rawIntent = 'Build an ultra-low latency audio processing service in Go';
  const metaPrompt = await PromptEngineer.generateMetaPrompt(rawIntent, {
    stack: 'Node.js, Electron, Go audio backend'
  });

  console.log('Generated Plain-Text Prompt Preview:\n----------------------------------------\n' + metaPrompt.rawText + '\n----------------------------------------');

  assert.ok(metaPrompt.clearTechnicalObjective.length > 0, 'Objective must not be empty');
  assert.ok(metaPrompt.keyFilesArchitecture.length >= 2, 'Must list key architecture files');
  assert.ok(metaPrompt.qualityRequirementsAndAstVerification.length >= 2, 'Must list quality requirements');

  // Verify headers exist in rawText
  assert.ok(metaPrompt.rawText.includes('Clear Technical Objective'), 'Must contain Objective header');
  assert.ok(metaPrompt.rawText.includes('Key Files / Architecture'), 'Must contain Architecture header');
  assert.ok(metaPrompt.rawText.includes('Quality Requirements & AST Verification'), 'Must contain Quality header');

  // Verify stack file references
  const hasGoFile = metaPrompt.keyFilesArchitecture.some(f => f.path.includes('backend-go'));
  assert.ok(hasGoFile, 'Must reference backend-go files for Go audio backend intent');

  console.log('   ✅ Test 1 Passed: Generated compliant 3-section meta-prompt with Eloquent stack mappings\n');

  // -----------------------------------------------------------------------------
  // TEST SUITE 2: Conversational Filler & Preamble Rejection
  // -----------------------------------------------------------------------------
  console.log('▶ [TEST 2] Conversational Filler & Preamble Detection via PromptAstValidator');
  const contaminatedPrompt = `Sure, here is the prompt you asked for!

Clear Technical Objective
Implement DSP filtering for audio streams.

Key Files / Architecture
- \`backend-go/main.go\`: Go audio server

Quality Requirements & AST Verification
- Pass unit tests.

Hope this helps! Let me know if you need anything else!`;

  const validation = PromptAstValidator.validate(contaminatedPrompt);
  assert.strictEqual(validation.isValid, false, 'Contaminated prompt must be flagged as invalid');
  assert.ok(validation.detectedFiller.length > 0, 'Must detect filler phrases');
  assert.ok(validation.errors.some(e => e.includes('filler') || e.includes('preamble')), 'Must report filler/preamble error');
  console.log(`   Detected ${validation.detectedFiller.length} filler phrase(s): ${validation.detectedFiller.join(', ')}`);
  console.log('   ✅ Test 2 Passed: Filler and conversational preambles properly rejected\n');

  // -----------------------------------------------------------------------------
  // TEST SUITE 3: Code Fence Stripping & Recursive Self-Correction
  // -----------------------------------------------------------------------------
  console.log('▶ [TEST 3] Code Fence (```) Rejection & Automatic Self-Correction Loop');
  const markdownWrappedPrompt = `\`\`\`markdown
Clear Technical Objective
Implement DSP filtering for audio streams.

Key Files / Architecture
- \`backend-go/main.go\`: Go audio server

Quality Requirements & AST Verification
- Pass unit tests.
\`\`\``;

  const fenceValidation = PromptAstValidator.validate(markdownWrappedPrompt);
  assert.strictEqual(fenceValidation.hasCodeBlockWrapper, true, 'Must detect code block fence wrapper');

  // Feed to PromptAstValidator clean methods
  const cleanedFences = PromptAstValidator.stripCodeFences(markdownWrappedPrompt);
  assert.ok(!cleanedFences.startsWith('```') && !cleanedFences.endsWith('```'), 'Code fences must be stripped');

  // Now test PromptEngineer handling raw input that an LLM might wrap in fences
  const correctedPrompt = await PromptEngineer.generateMetaPrompt('optimize IPC communication between main and overlay');
  assert.ok(!correctedPrompt.rawText.startsWith('```'), 'PromptEngineer must never return markdown fences');
  assert.ok(!correctedPrompt.rawText.endsWith('```'), 'PromptEngineer must never end with markdown fences');
  console.log('   ✅ Test 3 Passed: Markdown wrappers eliminated and pure plain text produced\n');

  // -----------------------------------------------------------------------------
  // TEST SUITE 4: Electron Main Process Bridge
  // -----------------------------------------------------------------------------
  console.log('▶ [TEST 4] MainProcessPromptBridge Input Routing');
  const routedPrompt = await MainProcessPromptBridge.routeUserInput('write a Go audio processing service');
  assert.ok(routedPrompt.clearTechnicalObjective.includes('audio backend'), 'Must infer audio backend objective');
  assert.ok(routedPrompt.rawText.includes('backend-go/main.go'), 'Must reference backend-go/main.go');
  console.log('   ✅ Test 4 Passed: Main process bridge routes input and synthesizes authoritative prompt\n');

  // -----------------------------------------------------------------------------
  // TEST SUITE 5: Custom AST Parser Structure Verification
  // -----------------------------------------------------------------------------
  console.log('▶ [TEST 5] Custom AST Parser Node Verification');
  const parsedAst = PromptAstValidator.parseToAst(routedPrompt.rawText);
  assert.ok(parsedAst !== null, 'AST parser must return structured object');
  assert.strictEqual(typeof parsedAst?.clearTechnicalObjective, 'string');
  assert.ok(Array.isArray(parsedAst?.keyFilesArchitecture));
  assert.ok(Array.isArray(parsedAst?.qualityRequirementsAndAstVerification));
  console.log(`   AST Node Counts: ${parsedAst?.keyFilesArchitecture.length} file entries, ${parsedAst?.qualityRequirementsAndAstVerification.length} quality directives`);
  console.log('   ✅ Test 5 Passed: AST parser accurately generates structured representation\n');

  console.log('================================================================================');
  console.log('🎉 ALL PROMPT ENGINEER & SELF-CORRECTION TESTS PASSED (100% SUCCESS)!');
  console.log('================================================================================\n');
}

runPromptEngineerTests().catch(err => {
  console.error('❌ Prompt engineer test failed:', err);
  process.exit(1);
});
