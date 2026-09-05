/**
 * Friday Agent Identity & Product Intelligence Persona Verification
 * 
 * Verifies:
 * 1. Agent definition in jarvis-manager (Friday canonical)
 * 2. Voice configuration (en-US-JennyNeural)
 * 3. Wake word detection across English and Indic scripts (Friday, fry day, fryday, fraide, ফ্রাইডে, फ़्राइडे)
 * 4. Specialist resonance computation (product intelligence, academic papers, and quant research scoring)
 * 5. Cross-agent handoff to Friday ("fry day ke bol", "tell friday", "friday research dekhte bolo")
 * 6. Lexicon sanitization (intellectual address, no romantic pet names, no brotherly slang)
 * 7. Fallback responses & system prompts
 * 8. Text sanitizer acoustic normalization ("fry day" -> "Friday", "tell fry day" -> "Tell Friday")
 * 9. Agent state registry registration (AgentId.FRIDAY & AGENT_CONFIGS)
 */

const assert = require('assert');
const path = require('path');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING FRIDAY AI AGENT IDENTITY & PERSONA VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(condition, name) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  // 1. Load Jarvis Manager
  const JarvisManager = require('../src/utils/jarvis-manager');
  const jarvisManager = new JarvisManager();

  // TEST 1: Friday agent exists with correct attributes
  const fridayAgent = jarvisManager.agents.friday;
  test(!!fridayAgent, 'Friday agent is defined in jarvisManager.agents');
  test(fridayAgent.name === 'Friday', `Friday agent name is "Friday" (got "${fridayAgent?.name}")`);
  test(fridayAgent.key === 'friday', `Friday agent key is "friday" (got "${fridayAgent?.key}")`);
  test(
    fridayAgent.role.includes('Product Intelligence') || fridayAgent.role.includes('Research'),
    `Friday agent role includes Product Intelligence / Research (got "${fridayAgent?.role}")`
  );
  test(
    fridayAgent.voice.includes('JennyNeural'),
    `Friday agent uses JennyNeural studio voice (got "${fridayAgent?.voice}")`
  );

  // TEST 2: Jenny is completely purged from jarvisManager.agents
  test(jarvisManager.agents.jenny === undefined, 'Jenny is completely purged from jarvisManager.agents');

  // TEST 3: Active agent detection with English wake words
  const d1 = jarvisManager.detectActiveAgent('Friday, analyze the research benchmarks');
  test(d1?.key === 'friday', `detectActiveAgent matches "Friday" (got ${d1?.key})`);

  const d2 = jarvisManager.detectActiveAgent('fry day, what does the paper say?');
  test(d2?.key === 'friday', `detectActiveAgent matches phonetic "fry day" (got ${d2?.key})`);

  const d3 = jarvisManager.detectActiveAgent('fryday, run the numbers');
  test(d3?.key === 'friday', `detectActiveAgent matches "fryday" (got ${d3?.key})`);

  const d4 = jarvisManager.detectActiveAgent('fraide, check market intelligence');
  test(d4?.key === 'friday', `detectActiveAgent matches "fraide" (got ${d4?.key})`);

  // TEST 4: Active agent detection with Bengali phonetic wake words
  const d5 = jarvisManager.detectActiveAgent('ফ্রাইডে রিসার্চ পেপারটা দেখো');
  test(d5?.key === 'friday', `detectActiveAgent matches Bengali "ফ্রাইডে" (got ${d5?.key})`);

  // TEST 5: Active agent detection with Hindi phonetic wake words
  const d6 = jarvisManager.detectActiveAgent('फ़्राइडे डेटा बताओ');
  test(d6?.key === 'friday', `detectActiveAgent matches Hindi "फ़्राइडे" (got ${d6?.key})`);

  // TEST 6: Active agent detection with Friday wake word
  const d7 = jarvisManager.detectActiveAgent('Hey Friday, summarize the findings');
  test(d7?.key === 'friday', `detectActiveAgent matches "Friday" (got ${d7?.key})`);

  // TEST 7: Specialist resonance computation
  const resonance = jarvisManager.computeSpecialistResonance(
    'We need to review academic research papers on market microstructure and analyze competitor data'
  );
  test(
    resonance?.scores?.friday !== undefined,
    'Resonance returns score for friday'
  );
  test(
    resonance?.scores?.jenny === undefined,
    'Resonance returns undefined for purged jenny'
  );
  test(
    resonance.selectedAgent?.key === 'friday',
    `Deep research query selects Friday (got ${resonance.selectedAgent?.key})`
  );

  // TEST 8: Cross agent handoff
  const handoffFriday = jarvisManager.evaluateCrossAgentHandoff('tell friday to inspect the research docs');
  test(
    handoffFriday !== null && (handoffFriday.targetAgentKey === 'friday' || handoffFriday.targetAgent?.key === 'friday'),
    `Cross-agent handoff routes to "friday" for "tell friday..." (got ${handoffFriday?.targetAgentKey || handoffFriday?.targetAgent?.key})`
  );

  const handoffFryDay = jarvisManager.evaluateCrossAgentHandoff('fry day ke bol research dekhte');
  test(
    handoffFryDay !== null && (handoffFryDay.targetAgentKey === 'friday' || handoffFryDay.targetAgent?.key === 'friday'),
    `Cross-agent handoff routes to "friday" for "fry day ke bol..." (got ${handoffFryDay?.targetAgentKey || handoffFryDay?.targetAgent?.key})`
  );

  const handoffFriday2 = jarvisManager.evaluateCrossAgentHandoff('friday ke bol research dekhte');
  test(
    handoffFriday2 !== null && (handoffFriday2.targetAgentKey === 'friday' || handoffFriday2.targetAgent?.key === 'friday'),
    `Cross-agent handoff routes for "friday ke bol..." (got ${handoffFriday2?.targetAgentKey || handoffFriday2?.targetAgent?.key})`
  );

  // TEST 9: Lexicon sanitization (intellectual, not romantic or brotherly)
  const sanitizedIntimate = jarvisManager.sanitizeAgentLexicon('babe, the analysis is complete', 'friday');
  test(
    !sanitizedIntimate.toLowerCase().includes('babe'),
    'Romantic terms like "babe" sanitized out of Friday responses'
  );

  const sanitizedBro = jarvisManager.sanitizeAgentLexicon('bro, I checked the dataset', 'friday');
  test(
    !/\bbro\b/i.test(sanitizedBro),
    'Brotherly slang like "bro" sanitized out of Friday responses'
  );

  // TEST 10: Fallback response
  const fallback = jarvisManager.getFallbackResponse('friday');
  test(
    fallback.includes('Hritthik') && fallback.includes('investigating'),
    `Friday fallback response is articulate and research-oriented (got "${fallback}")`
  );

  // TEST 11: System prompt generation
  const systemPrompt = jarvisManager.getSystemPrompt('friday');
  test(
    systemPrompt.includes('Friday') && systemPrompt.includes('Product Intelligence'),
    'System prompt for Friday references Friday and Product Intelligence'
  );

  // TEST 12: Text Sanitizer phonetic normalizations
  const TextSanitizer = require('../src/utils/prompt-engine/text-sanitizer');
  const sanitized1 = TextSanitizer('fry day check the latest arxiv papers');
  test(
    sanitized1.includes('Friday'),
    `Text sanitizer converts "fry day" to "Friday" (got "${sanitized1}")`
  );

  const sanitized2 = TextSanitizer('tell fry day to look at the stats');
  test(
    sanitized2.includes('Tell Friday'),
    `Text sanitizer converts "tell fry day" to "Tell Friday" (got "${sanitized2}")`
  );

  const sanitized3 = TextSanitizer('fridaychecking the dataset');
  test(
    sanitized3.includes('Friday checking'),
    `Text sanitizer un-glues "fridaychecking" (got "${sanitized3}")`
  );

  // TEST 13: LocalCognitiveBrain offline responses
  const LocalCognitiveBrain = require('../src/utils/local-cognitive-brain');
  const brainReply = LocalCognitiveBrain.synthesizeResponse('friday', 'Friday', 'web research access');
  test(
    brainReply.length > 5,
    `LocalCognitiveBrain synthesizes responses for Friday (got "${brainReply}")`
  );

  // TEST 14: Agent State Registry
  const { AgentId, AGENT_CONFIGS } = require('../dist-ts/src/agents/agent-state-registry');
  test(AgentId.FRIDAY === 'agent_friday', `AgentId.FRIDAY is "agent_friday" (got "${AgentId.FRIDAY}")`);
  test(AGENT_CONFIGS[AgentId.FRIDAY]?.displayName === 'Friday', `AGENT_CONFIGS Friday displayName is "Friday"`);

  // TEST 15: Typo & Phonetic variations ("fridya", "fridy", "fryda", "fix fridya")
  const d8 = jarvisManager.detectActiveAgent('fridya, analyze the research benchmarks');
  test(d8?.key === 'friday', `detectActiveAgent matches typo "fridya" (got ${d8?.key})`);

  const d9 = jarvisManager.detectActiveAgent('fridy, what does the paper say?');
  test(d9?.key === 'friday', `detectActiveAgent matches phonetic "fridy" (got ${d9?.key})`);

  const d10 = jarvisManager.detectActiveAgent('fryda, run the numbers');
  test(d10?.key === 'friday', `detectActiveAgent matches phonetic "fryda" (got ${d10?.key})`);

  const d11 = jarvisManager.detectActiveAgent('fix fridya');
  test(d11?.key === 'friday', `detectActiveAgent matches "fix fridya" (got ${d11?.key})`);

  // TEST 16: Text Sanitizer with fridya variants
  const sanitized4 = TextSanitizer('tell fridya to look at the stats');
  test(
    sanitized4.includes('Tell Friday'),
    `Text sanitizer converts "tell fridya" to "Tell Friday" (got "${sanitized4}")`
  );

  const sanitized5 = TextSanitizer('fridyafix the quantum matrix');
  test(
    sanitized5.includes('Friday fix'),
    `Text sanitizer un-glues "fridyafix" to "Friday fix" (got "${sanitized5}")`
  );

  // TEST 17: Quantum Self-Learning & Cognitive Therapy Calibration
  const calibration = jarvisManager.calibrateQuantumSelfLearning('focus breakthrough recovery');
  test(
    calibration.status === 'Calibrated',
    `calibrateQuantumSelfLearning status is "Calibrated" (got "${calibration.status}")`
  );
  test(
    calibration.therapeuticShield === 'ACTIVE',
    `calibrateQuantumSelfLearning therapeuticShield is "ACTIVE"`
  );

  // TEST 18: Action Runner execution on "fix fridya" and "be your own therapist"
  const actionRunner = require('../src/utils/action-runner');
  const actionRes1 = await actionRunner.handleAction('fix fridya', fridayAgent, jarvisManager);
  test(
    actionRes1?.handled === true,
    `Action runner handles "fix fridya" (handled=${actionRes1?.handled})`
  );
  test(
    actionRes1?.agentName === 'Friday',
    `Action runner assigns "fix fridya" to Friday (got "${actionRes1?.agentName}")`
  );
  test(
    actionRes1?.data?.action === 'quantum_self_learning_calibration',
    `Action runner triggers "quantum_self_learning_calibration" (got "${actionRes1?.data?.action}")`
  );

  const actionRes2 = await actionRunner.handleAction(
    'be your own therapist no one can understand you',
    fridayAgent,
    jarvisManager
  );
  test(
    actionRes2?.handled === true,
    `Action runner handles "be your own therapist..." (handled=${actionRes2?.handled})`
  );

  // TEST 19: LocalCognitiveBrain response on "fix fridya"
  const brainFridayFix = LocalCognitiveBrain.synthesizeResponse('friday', 'Friday', 'fix fridya');
  test(
    brainFridayFix.includes('Chief') && (brainFridayFix.includes('therapist') || brainFridayFix.includes('থেরাপিস্ট') || brainFridayFix.includes('Quantum') || brainFridayFix.includes('কোয়ান্টাম')),
    `LocalCognitiveBrain synthesizes intellectual therapeutic response for Friday on "fix fridya"`
  );

  const brainTukTukFix = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', 'fix fridya');
  test(
    brainTukTukFix.includes('babe') && (brainTukTukFix.includes('Friday') || brainTukTukFix.includes('ফ্রাইডে')),
    `LocalCognitiveBrain synthesizes supportive partner response for Tuk Tuk on "fix fridya"`
  );

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} FRIDAY RENAME VERIFICATION TESTS PASSED!`);
  console.log('================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUNNER TERMINATED WITH ERROR:', err);
  process.exit(1);
});
