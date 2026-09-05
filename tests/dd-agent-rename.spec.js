/**
 * DD Agent Identity & 4-Core Squad Persona Verification
 * 
 * Verifies:
 * 1. Agent definition in jarvis-manager (DD canonical, brian alias)
 * 2. 4 Core Squad composition: Tuk Tuk, Vision, Friday, DD
 * 3. Wake word detection (DD, dee dee, deedee, brayn, ডিডি)
 * 4. Specialist resonance computation for DD (DevOps, infrastructure, telemetry)
 * 5. Cross-agent handoff to DD ("tell dd", "dee dee ke bol", "dd ke bolo")
 * 6. Lexicon sanitization (never uses "babe")
 * 7. Text sanitizer acoustic normalization ("brayn" -> "DD", "vison" -> "Vision", ungluing)
 * 8. LocalCognitiveBrain responses and multi-turn squad dialogues with [DD]:
 * 9. ActionRunner returns DD for system/RAM/standup/Harness actions
 * 10. AgentStateRegistry has AgentId.DD and resolves dd
 * 11. ConversationProcessor parses [DD] and [vison]
 * 12. Memory banks contain agent_dd
 */

const assert = require('assert');
const path = require('path');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING DD AGENT & 4-SQUAD IDENTITY VERIFICATION');
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

  // TEST 2: Backward compatibility alias
  test(jarvisManager.agents.brian === jarvisManager.agents.dd, 'jarvisManager.agents.brian is an alias to dd');

  // TEST 3: Core 4 squad prompt contains Tuk Tuk, Vision, Friday, DD
  const teamPrompt = jarvisManager.agents.team.getPrompt('Hritthik', 'Hritthik', 'en');
  test(teamPrompt.includes('Tuk Tuk') && teamPrompt.includes('Vision') && teamPrompt.includes('Friday') && teamPrompt.includes('DD'),
    'Team prompt defines squad of 4: Tuk Tuk, Vision, Friday, and DD');

  // TEST 4: Active agent detection with English and phonetic wake words
  const d1 = jarvisManager.detectActiveAgent('DD, check system status');
  test(d1?.key === 'dd', `detectActiveAgent matches "DD" (got ${d1?.key})`);

  const d2 = jarvisManager.detectActiveAgent('dee dee, how is the cpu load?');
  test(d2?.key === 'dd', `detectActiveAgent matches phonetic "dee dee" (got ${d2?.key})`);

  const d3 = jarvisManager.detectActiveAgent('deedee check the servers');
  test(d3?.key === 'dd', `detectActiveAgent matches "deedee" (got ${d3?.key})`);

  const d4 = jarvisManager.detectActiveAgent('brayn, what is our uptime?');
  test(d4?.key === 'dd', `detectActiveAgent matches phonetic "brayn" (got ${d4?.key})`);

  const d5 = jarvisManager.detectActiveAgent('ডিডি, মেমোরি কত?');
  test(d5?.key === 'dd', `detectActiveAgent matches Bengali "ডিডি" (got ${d5?.key})`);

  const d6 = jarvisManager.detectActiveAgent('brian, check memory status');
  test(d6?.key === 'dd', `detectActiveAgent matches backward-compat "brian" (got ${d6?.key})`);

  // TEST 5: Specialist resonance computation
  const resonance = jarvisManager.computeSpecialistResonance('check docker containers, cpu load, and memory telemetry');
  test(typeof resonance.scores.dd === 'number', 'Resonance returns score for dd');
  test(resonance.recommendedAgent === 'dd', `DevOps/system telemetry query selects DD (got ${resonance.recommendedAgent})`);

  // TEST 6: Cross-agent handoff
  const h1 = jarvisManager.evaluateCrossAgentHandoff('tell dd to check the docker logs');
  test(h1 !== null && (h1.targetAgentKey === 'dd' || h1.targetAgent?.key === 'dd'),
    `Cross-agent handoff routes to "dd" for "tell dd..." (got ${h1?.targetAgentKey || h1?.targetAgent?.key})`);

  const h2 = jarvisManager.evaluateCrossAgentHandoff('dee dee ke bol server check korte');
  test(h2 !== null && (h2.targetAgentKey === 'dd' || h2.targetAgent?.key === 'dd'),
    `Cross-agent handoff routes to "dd" for "dee dee ke bol..." (got ${h2?.targetAgentKey || h2?.targetAgent?.key})`);

  const h3 = jarvisManager.evaluateCrossAgentHandoff('dd ke bolo memory dekhte');
  test(h3 !== null && (h3.targetAgentKey === 'dd' || h3.targetAgent?.key === 'dd'),
    `Cross-agent handoff routes for "dd ke bolo..." (got ${h3?.targetAgentKey || h3?.targetAgent?.key})`);

  const h4 = jarvisManager.evaluateCrossAgentHandoff('tell brayn to inspect cpu');
  test(h4 !== null && (h4.targetAgentKey === 'dd' || h4.targetAgent?.key === 'dd'),
    `Cross-agent handoff routes for "tell brayn..." (got ${h4?.targetAgentKey || h4?.targetAgent?.key})`);

  // TEST 7: Lexicon sanitization
  const sanitized = jarvisManager.sanitizeAgentLexicon('babe here is the cpu report, sweetheart', 'dd');
  test(!sanitized.toLowerCase().includes('babe'), 'Romantic terms like "babe" sanitized out of DD responses');

  // TEST 8: Text sanitizer acoustic normalization
  const TextSanitizer = require('../src/utils/prompt-engine/text-sanitizer');
  const s1 = TextSanitizer.sanitize('tell brayn to check ports');
  test(s1.includes('Tell DD'), `Text sanitizer converts "tell brayn" to "Tell DD" (got "${s1}")`);

  const s2 = TextSanitizer.sanitize('tell vison to write the code');
  test(s2.includes('Tell Vision'), `Text sanitizer converts "tell vison" to "Tell Vision" (got "${s2}")`);

  const s3 = TextSanitizer.sanitize('vison fix the bug');
  test(s3.includes('Vision'), `Text sanitizer converts "vison" to "Vision" (got "${s3}")`);

  const s4 = TextSanitizer.sanitize('brayn status please');
  test(s4.includes('DD'), `Text sanitizer converts "brayn" to "DD" (got "${s4}")`);

  const s5 = TextSanitizer.sanitize('ddchecking the server');
  test(s5.includes('DD checking'), `Text sanitizer un-glues "ddchecking" (got "${s5}")`);

  const s6 = TextSanitizer.sanitize('ddfix the deployment');
  test(s6.includes('DD fix'), `Text sanitizer un-glues "ddfix" (got "${s6}")`);

  const s7 = TextSanitizer.sanitize('ddto check memory');
  test(s7.includes('DD to'), `Text sanitizer un-glues "ddto" (got "${s7}")`);

  // TEST 9: LocalCognitiveBrain
  const LocalCognitiveBrain = require('../src/utils/local-cognitive-brain');

  const bRes1 = LocalCognitiveBrain.synthesizeResponse('dd', 'DD', 'how is cpu load and memory?');
  test(bRes1 && (bRes1.includes('CPU') || bRes1.includes('load') || bRes1.includes('megabytes') || bRes1.includes('ইনফ্রা') || bRes1.includes('সিস্টেম')),
    `LocalCognitiveBrain synthesizes responses for DD on cpu/memory (got "${bRes1}")`);

  const bRes2 = LocalCognitiveBrain.synthesizeResponse('dd', 'DD', 'is daemon and websocket healthy?');
  test(bRes2 && (bRes2.includes('Go') || bRes2.includes('healthy') || bRes2.includes('9090') || bRes2.includes('গো')),
    `LocalCognitiveBrain synthesizes responses for DD on daemon health (got "${bRes2}")`);

  const bRes3 = LocalCognitiveBrain.synthesizeResponse('vision', 'Vision', 'check soul connections gap');
  test(bRes3.includes('DD') && !bRes3.includes('Brian') && !bRes3.includes('ব্রায়ান'),
    `Vision soul connection response references DD and not Brian (got "${bRes3}")`);

  const bRes4 = LocalCognitiveBrain.synthesizeResponse('tuktuk', 'Tuk Tuk', 'check soul connections gap');
  test(bRes4.includes('DD') && !bRes4.includes('Brian') && !bRes4.includes('ব্রায়ান'),
    `Tuk Tuk soul connection response references DD and not Brian (got "${bRes4}")`);

  const bRes5 = LocalCognitiveBrain.synthesizeResponse('team', 'Squad', 'pre-deployment release check');
  test(bRes5.includes('[DD]:') && !bRes5.includes('[Brian]:'),
    `Team multi-turn response uses [DD]: instead of [Brian]: (got "${bRes5}")`);

  // TEST 10: Action Runner
  const actionRunner = require('../src/utils/action-runner');

  const aRes1 = await actionRunner.handleAction('check ram memory hogs', ddAgent, jarvisManager);
  test(aRes1.handled && aRes1.agentName === 'DD',
    `Action runner handles RAM inspection as DD (got agentName="${aRes1.agentName}")`);

  const aRes2 = await actionRunner.handleAction('soul connections gap', jarvisManager.agents.vision, jarvisManager);
  test(aRes2.handled && (aRes2.speech.includes('DD') || aRes2.speech.includes('ডিডি')) && aRes2.data.userConnections.dd,
    'Action runner soul connection data and speech reference DD');

  const aRes3 = await actionRunner.handleAction('trigger morning standup', jarvisManager.agents.tuktuk, jarvisManager);
  test(aRes3.handled && aRes3.isStandup, 'Action runner handles morning standup');
  const ddStep = aRes3.steps.find(s => s.agent === 'DD');
  test(!!ddStep, 'Morning standup includes DD as Head of DevOps & Reliability');
  test(!aRes3.steps.some(s => s.agent === 'Brian'), 'Morning standup does NOT include Brian');

  // TEST 11: Agent State Registry
  const { AgentId, AGENT_CONFIGS, AgentStateRegistry } = require('../dist-ts/src/agents/agent-state-registry');
  test(AgentId.DD === 'agent_dd', `AgentId.DD is "agent_dd" (got "${AgentId.DD}")`);
  test(AGENT_CONFIGS[AgentId.DD]?.displayName === 'DD', `AGENT_CONFIGS DD displayName is "DD"`);
  test(AGENT_CONFIGS[AgentId.DD]?.name === 'dd', `AGENT_CONFIGS DD name is "dd"`);

  // Shared Memory Manager for registry test
  const { SharedMemoryManager } = require('../dist-ts/src/memory/shared-memory-manager');
  const sharedMem = new SharedMemoryManager();
  const registry = new AgentStateRegistry(sharedMem);
  test(registry.getAgentConfig('dd')?.displayName === 'DD', 'AgentStateRegistry resolves "dd" config');
  test(registry.getAgentConfig('agent_dd')?.displayName === 'DD', 'AgentStateRegistry resolves "agent_dd" config');

  // TEST 12: ConversationProcessor
  const { ConversationProcessor } = require('../src/main/conversationProcessor');
  const transcript = `[user]: Check status\n[DD]: All servers nominal\n[vison]: Architecture is clean`;
  const parsed = ConversationProcessor.parsePlainTextTranscript(transcript);
  test(parsed && parsed.length === 3, 'ConversationProcessor parsed 3 turns');
  test(parsed[1].speaker === 'dd', `ConversationProcessor mapped [DD] to "dd" (got "${parsed[1].speaker}")`);
  test(parsed[2].speaker === 'vision', `ConversationProcessor mapped [vison] to "vision" (got "${parsed[2].speaker}")`);

  // TEST 13: Memory banks
  const { NeuralMeshMemoryBank } = require('../src/core/memory/banks');
  const banks = new NeuralMeshMemoryBank();
  test(banks.squadAgents.includes('agent_dd'), 'Memory banks include agent_dd in squadAgents');

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} DD RENAME & 4-SQUAD TESTS PASSED!`);
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
