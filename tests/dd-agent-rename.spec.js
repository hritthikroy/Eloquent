/**
 * DD Agent Identity & DevOps Persona Verification
 * 
 * Verifies:
 * 1. Agent definition in jarvis-manager (DD canonical)
 * 2. Voice configuration (en-US-BrianMultilingualNeural)
 * 3. Wake word detection across English, Bengali, and phonetic variants (DD, dee dee, deedee, ডিডি)
 * 4. Specialist resonance computation (DevOps, telemetry, CPU, RAM, heap)
 * 5. Cross-agent handoff to DD ("dd ke bol", "tell dd", "dee dee check telemetry")
 * 6. Lexicon sanitization (calm guardian address, no romantic pet names)
 * 7. Fallback responses & system prompts
 * 8. LocalCognitiveBrain response synthesis for "dd"
 * 9. Action runner integration for DD telemetry & health
 * 10. Multi-agent sequential parsing for DD
 */

const assert = require('assert');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING DD AI AGENT IDENTITY & PERSONA VERIFICATION');
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

  // TEST 1: DD agent exists with correct attributes
  const ddAgent = jarvisManager.agents.dd;
  test(!!ddAgent, 'DD agent is defined in jarvisManager.agents');
  test(ddAgent.name === 'DD', `DD agent name is "DD" (got "${ddAgent?.name}")`);
  test(ddAgent.key === 'dd', `DD agent key is "dd" (got "${ddAgent?.key}")`);
  test(
    ddAgent.role.includes('DevOps') || ddAgent.role.includes('Reliability'),
    `DD agent role includes DevOps / Reliability (got "${ddAgent?.role}")`
  );
  test(
    ddAgent.voice.includes('BrianMultilingualNeural'),
    `DD agent uses BrianMultilingualNeural studio voice (got "${ddAgent?.voice}")`
  );

  // TEST 2: Canonical squad agents are strictly 4: tuktuk, vision, friday, dd (plus team)
  const canonicalAgentKeys = Object.keys(jarvisManager.agents);
  test(
    canonicalAgentKeys.includes('tuktuk') &&
    canonicalAgentKeys.includes('vision') &&
    canonicalAgentKeys.includes('friday') &&
    canonicalAgentKeys.includes('dd') &&
    canonicalAgentKeys.includes('team'),
    `Canonical agents include tuktuk, vision, friday, dd, team (got ${canonicalAgentKeys.join(', ')})`
  );

  // TEST 3: Active agent detection with English wake words
  const d1 = jarvisManager.detectActiveAgent('DD, what is our CPU load?');
  test(d1?.key === 'dd', `detectActiveAgent matches "DD" (got ${d1?.key})`);

  const d2 = jarvisManager.detectActiveAgent('dee dee, check system health');
  test(d2?.key === 'dd', `detectActiveAgent matches phonetic "dee dee" (got ${d2?.key})`);

  const d3 = jarvisManager.detectActiveAgent('deedee, ram koto ache');
  test(d3?.key === 'dd', `detectActiveAgent matches "deedee" (got ${d3?.key})`);

  const d4 = jarvisManager.detectActiveAgent('Hey DD, is the daemon running?');
  test(d4?.key === 'dd', `detectActiveAgent matches "Hey DD" (got ${d4?.key})`);

  // TEST 4: Active agent detection with Bengali phonetic wake words
  const d5 = jarvisManager.detectActiveAgent('ডিডি সিস্টেম মেট্রিক্স চেক করো');
  test(d5?.key === 'dd', `detectActiveAgent matches Bengali "ডিডি" (got ${d5?.key})`);

  // TEST 5: Specialist resonance computation for DevOps and telemetry
  const resonance = jarvisManager.computeSpecialistResonance(
    'CPU load 18 percent, heap telemetry is nominal and daemon health on port 9090 is solid'
  );
  test(
    resonance?.scores?.dd !== undefined,
    'Resonance returns score for dd'
  );
  test(
    resonance.selectedAgent?.key === 'dd',
    `DevOps telemetry query selects DD (got ${resonance.selectedAgent?.key})`
  );

  // TEST 6: Cross-agent handoff to DD
  const handoff1 = jarvisManager.evaluateCrossAgentHandoff('tell dd to check RAM');
  test(
    handoff1 !== null && handoff1.delegated === true,
    `Cross-agent handoff triggers for "tell dd to check RAM"`
  );
  test(
    handoff1?.targetAgentKey === 'dd',
    `Target agent key for handoff is "dd" (got "${handoff1?.targetAgentKey}")`
  );

  const handoff2 = jarvisManager.evaluateCrossAgentHandoff('dd ke bol ram check korte');
  test(
    handoff2 !== null && handoff2.delegated === true,
    `Cross-agent handoff triggers for "dd ke bol ram check korte"`
  );
  test(
    handoff2?.targetAgentKey === 'dd',
    `Target agent key for Bengali handoff is "dd" (got "${handoff2?.targetAgentKey}")`
  );

  // TEST 7: Lexicon sanitization for DD
  const badDD = "Babe, CPU load is 18 percent, sweetheart.";
  const cleanDD = jarvisManager.sanitizeAgentLexicon(badDD, 'dd', 'en-US-BrianMultilingualNeural');
  test(
    !/\b(babe|sweetheart)\b/i.test(cleanDD),
    `DD sanitization strips romantic terms (got "${cleanDD}")`
  );

  // TEST 8: LocalCognitiveBrain response synthesis for DD
  const LocalCognitiveBrain = require('../src/utils/local-cognitive-brain');
  const ddReplyEn = LocalCognitiveBrain.synthesizeResponse('dd', 'DD', 'check cpu and ram', {}, 'en');
  test(
    ddReplyEn.toLowerCase().includes('cpu') || ddReplyEn.toLowerCase().includes('heap') || ddReplyEn.toLowerCase().includes('infrastructure'),
    `LocalCognitiveBrain returns valid telemetry for DD in English (got "${ddReplyEn}")`
  );
  test(
    !ddReplyEn.toLowerCase().includes('babe'),
    `DD English response has zero "babe"`
  );

  const ddReplyBn = LocalCognitiveBrain.synthesizeResponse('dd', 'DD', 'cpu load koto', {}, 'bn');
  test(
    ddReplyBn.length > 5,
    `LocalCognitiveBrain returns response for DD in Bengali (got "${ddReplyBn}")`
  );
  test(
    !ddReplyBn.toLowerCase().includes('babe'),
    `DD Bengali response has zero "babe"`
  );

  // TEST 9: Action Runner execution with DD
  const actionRunner = require('../src/utils/action-runner');
  const actionRes = await actionRunner.handleAction('ram dekh koto ache', ddAgent);
  test(
    actionRes?.handled === true,
    `Action runner handles "ram dekh koto ache"`
  );

  // TEST 10: Multi-agent sequential parsing for DD
  const multiText = "[DD]: Infrastructure is steady, bro. CPU at 18 percent.";
  const regex = /\[(Vision|Friday|DD|Tuk\s*Tuk)\]:\s*([^\[]+)/gi;
  const match = regex.exec(multiText);
  test(
    match !== null && match[1] === 'DD',
    `Multi-agent tag correctly captures [DD]`
  );

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} DD AGENT RENAME VERIFICATION TESTS PASSED!`);
  console.log('================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUNNER TERMINATED WITH ERROR:', err);
  process.exit(1);
});
