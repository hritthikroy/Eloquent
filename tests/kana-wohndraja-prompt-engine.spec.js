/**
 * Comprehensive Test Suite for Kana Wohndraja Reading Comprehension,
 * Intent Detection, Multi-Agent Prompt Directives, and AST Compliance.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const TextSanitizer = require('../src/utils/prompt-engine/text-sanitizer');
const { IntentParser, INTENTS } = require('../src/utils/prompt-engine/intent-parser');
const PromptAssembler = require('../src/utils/prompt-engine/prompt-assembler');
const { PromptEngine } = require('../src/utils/prompt-engine');
const { PromptEngineer } = require('../dist-ts/src/core/prompt-engineer');
const { PromptAstValidator } = require('../dist-ts/src/utils/ast-validator');

describe('Kana Wohndraja & Advanced Prompt Engine Suite', () => {

  test('1. TextSanitizer normalizes Kana Wohndraja and compound reading phrases', () => {
    const raw1 = 'kana wohndraja, keep reading and fix every issues';
    const sanitized1 = TextSanitizer.sanitize(raw1);
    assert.ok(sanitized1.includes('Kana Wohndraja (কানা ও অন্ধ রাজা)'));
    assert.ok(sanitized1.includes('fix every issue'));

    const raw2 = 'ondher deshe kana raja prompt banao';
    const sanitized2 = TextSanitizer.sanitize(raw2);
    assert.ok(sanitized2.includes('অন্ধের দেশে কানা রাজা'));
  });

  test('2. IntentParser detects exact user prompt with trailing directive', () => {
    const rawPrompt = 'Kana Wohndraja, keep reading and fix every issues and write up the prompt for';
    const parsed = IntentParser.parse(rawPrompt);

    assert.strictEqual(parsed.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(parsed.isCompound, true);
    // Verify trailing directive and preposition stripped cleanly
    assert.ok(!parsed.target.includes('write up the prompt'));
    assert.ok(!parsed.target.endsWith('for'));
    assert.ok(parsed.target.includes('Kana Wohndraja'));
  });

  test('3. IntentParser routes multi-agent directives across the 4-agent squad', () => {
    const visionTurn = IntentParser.parse('Tell Vision to craft a developer prompt for zero latency');
    assert.strictEqual(visionTurn.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(visionTurn.agentDirective, 'vision');
    assert.ok(visionTurn.target.includes('zero latency'));

    const tuktukTurn = IntentParser.parse('Tuk Tuk prompt this in Antigravity');
    assert.strictEqual(tuktukTurn.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(tuktukTurn.agentDirective, 'tuktuk');

    const fridayTurn = IntentParser.parse('Friday, write a prompt on benchmark arena');
    assert.strictEqual(fridayTurn.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(fridayTurn.agentDirective, 'friday');

    const ddTurn = IntentParser.parse('Tell DD to write up the prompt for server health');
    assert.strictEqual(ddTurn.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(ddTurn.agentDirective, 'dd');
  });

  test('4. IntentParser handles Bengali prompt intent expressions', () => {
    const bn1 = IntentParser.parse('কানা ও অন্ধ রাজা নিয়ে প্রম্পট বানাও');
    assert.strictEqual(bn1.intent, INTENTS.GENERATE_PROMPT);
    assert.ok(bn1.target.includes('কানা ও অন্ধ রাজা'));

    const bn2 = IntentParser.parse('ডিডি, সার্ভার মেমোরি প্রম্পট রেডি করো');
    assert.strictEqual(bn2.intent, INTENTS.GENERATE_PROMPT);
    assert.strictEqual(bn2.agentDirective, 'dd');

    const bn3 = IntentParser.parse('shob issue fix korar prompt dao');
    assert.strictEqual(bn3.intent, INTENTS.GENERATE_PROMPT);
  });

  test('5. PromptAssembler formats clean, senior-developer objectives without awkward phrasing', async () => {
    const assembled = await PromptAssembler.assemble({
      sanitizedText: 'Kana Wohndraja, keep reading and fix every issues and write up the prompt for'
    });

    // Check strict 4 sections
    assert.ok(assembled.includes('Clear Technical Objective'));
    assert.ok(assembled.includes('Key Files / Architecture'));
    assert.ok(assembled.includes('Quality Requirements & AST Verification'));
    assert.ok(assembled.includes('Next Steps & Continuation Roadmap'));

    // Check no awkward trailing prepositions in objective
    assert.ok(!assembled.includes('write up the prompt for, ensuring'));
    assert.ok(assembled.includes('Implement Kana Wohndraja, keep reading and fix every issue'));

    // Check relevant files included
    assert.ok(assembled.includes('intent-parser.js'));
    assert.ok(assembled.includes('prompt-assembler.js'));
    assert.ok(assembled.includes('prompt-engineer.ts'));
  });

  test('6. Full PromptEngine pipeline processes compound user instruction seamlessly', async () => {
    const res = await PromptEngine.process('Kana Wohndraja, keep reading and fix every issues and write up the prompt for');
    assert.strictEqual(res.handled, true);
    assert.strictEqual(res.intent, INTENTS.GENERATE_PROMPT);
    assert.ok(typeof res.prompt === 'string');
    assert.ok(res.prompt.includes('Clear Technical Objective'));
    assert.ok(res.speech.includes('prompt'));
  });

  test('7. PromptEngineer synthesizes 100% AST compliant prompt for prompt_engine domain', async () => {
    const rawIntent = 'Kana Wohndraja reading comprehension and issue resolution';
    const metaPrompt = await PromptEngineer.generateMetaPrompt(rawIntent);

    assert.ok(metaPrompt.clearTechnicalObjective.length > 0);
    assert.ok(metaPrompt.keyFilesArchitecture.length >= 2);
    assert.ok(metaPrompt.qualityRequirementsAndAstVerification.length >= 2);

    // Verify AST validation passes cleanly with 0 errors
    const validation = PromptAstValidator.validate(metaPrompt.rawText);
    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.errors.length, 0);

    // Verify prompt references prompt-engine files
    const hasIntentParser = metaPrompt.keyFilesArchitecture.some(f => f.path.includes('intent-parser.js'));
    assert.ok(hasIntentParser);
  });
});
