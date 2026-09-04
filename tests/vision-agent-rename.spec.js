/**
 * Vision Agent (formerly Andrew) Rename & Systems Architect Persona Verification
 * 
 * Verifies:
 * 1. Agent definition and aliases in jarvis-manager (Vision & backwards-compatible Andrew)
 * 2. Voice configuration (en-US-AndrewNeural preserved for Paul Bettany timbre)
 * 3. Wake word detection across English and Indic scripts (Vision, Andrew, ভিসন, ভিশন, विजन, विज़न)
 * 4. Specialist resonance computation (systems architecture & deep engineering scoring)
 * 5. Cross-agent handoff to Vision
 * 6. Lexicon sanitization (brotherly address, no romantic pet names)
 * 7. Fallback responses & system prompts
 * 8. Core orchestrator module bridges (src/core/agent/vision.js & andrew.js)
 */

const assert = require('assert');
const path = require('path');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING VISION AI AGENT RENAME & PERSONA VERIFICATION');
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

  // TEST 1: Vision agent exists with correct attributes
  const visionAgent = jarvisManager.agents.vision;
  test(!!visionAgent, 'Vision agent is defined in jarvisManager.agents');
  test(visionAgent.name === 'Vision', `Vision agent name is "Vision" (got "${visionAgent?.name}")`);
  test(visionAgent.key === 'vision', `Vision agent key is "vision" (got "${visionAgent?.key}")`);
  test(
    visionAgent.role.includes('Systems Architect') || visionAgent.role.includes('Vision AI'),
    `Vision agent role includes Systems Architect / Vision AI (got "${visionAgent?.role}")`
  );
  test(
    visionAgent.voice.includes('AndrewNeural'),
    `Vision agent preserves Paul Bettany timbre voice (got "${visionAgent?.voice}")`
  );

  // TEST 2: Andrew backwards compatibility alias
  test(
    jarvisManager.agents.andrew === jarvisManager.agents.vision,
    'AGENTS.andrew is an exact reference alias to AGENTS.vision'
  );

  // TEST 3: Active agent detection with English wake words
  const d1 = jarvisManager.detectActiveAgent('Vision, analyze the memory heap');
  test(d1?.key === 'vision', `detectActiveAgent matches "Vision" (got ${d1?.key})`);

  const d2 = jarvisManager.detectActiveAgent('Hey Andrew, check this bug');
  test(d2?.key === 'vision', `detectActiveAgent backwards-compatible matches "Andrew" as Vision (got ${d2?.key})`);

  // TEST 4: Active agent detection with Bengali phonetic wake words
  const d3 = jarvisManager.detectActiveAgent('ভিসন ভাই সিস্টেম দেখো');
  test(d3?.key === 'vision', `detectActiveAgent matches Bengali "ভিসন" (got ${d3?.key})`);

  const d4 = jarvisManager.detectActiveAgent('ভিশন কোডটা চেক করো');
  test(d4?.key === 'vision', `detectActiveAgent matches Bengali "ভিশন" (got ${d4?.key})`);

  // TEST 5: Active agent detection with Hindi phonetic wake words
  const d5 = jarvisManager.detectActiveAgent('विजन भाई कोड देखो');
  test(d5?.key === 'vision', `detectActiveAgent matches Hindi "विजन" (got ${d5?.key})`);

  const d6 = jarvisManager.detectActiveAgent('विज़न भाई सिस्टम आर्किटेक्चर कैसा है');
  test(d6?.key === 'vision', `detectActiveAgent matches Hindi "विज़न" (got ${d6?.key})`);

  // TEST 6: Specialist resonance computation
  const resonance = jarvisManager.computeSpecialistResonance(
    'We need to optimize the Go backend ring buffer memory allocation and benchmark the concurrency'
  );
  test(
    resonance?.scores?.vision !== undefined,
    'Resonance returns score for vision'
  );
  test(
    resonance?.scores?.andrew !== undefined,
    'Resonance returns backwards-compatible score for andrew'
  );
  test(
    resonance.selectedAgent?.key === 'vision',
    `Deep systems engineering query selects Vision (got ${resonance.selectedAgent?.key})`
  );

  // TEST 7: Cross agent handoff
  const handoffVision = jarvisManager.evaluateCrossAgentHandoff('tell vision to inspect the logs');
  test(
    handoffVision?.shouldHandoff && (handoffVision.targetAgentKey === 'vision' || handoffVision.targetAgent?.key === 'vision'),
    `Cross-agent handoff routes to "vision" for "tell vision..." (got ${handoffVision?.targetAgentKey || handoffVision?.targetAgent?.key})`
  );

  const handoffAndrew = jarvisManager.evaluateCrossAgentHandoff('tell andrew to run the benchmarks');
  test(
    handoffAndrew?.shouldHandoff && (handoffAndrew.targetAgentKey === 'vision' || handoffAndrew.targetAgent?.key === 'vision'),
    `Cross-agent handoff routes to "vision" for "tell andrew..." (got ${handoffAndrew?.targetAgentKey || handoffAndrew?.targetAgent?.key})`
  );

  // TEST 8: Lexicon sanitization (brotherly, not romantic)
  const sanitized = jarvisManager.sanitizeAgentLexicon('babe, check the servers', 'vision');
  test(
    !sanitized.toLowerCase().includes('babe'),
    'Romantic terms like "babe" sanitized out of Vision responses'
  );
  test(
    sanitized.toLowerCase().includes('bro') || sanitized.toLowerCase().includes('brother'),
    `Romantic terms replaced with brotherly address (got "${sanitized}")`
  );

  // TEST 9: Fallback response
  const fallback = jarvisManager.getFallbackResponse('vision');
  test(
    fallback.includes('Systems nominal, brother'),
    `Vision fallback response is brotherly and systems-oriented (got "${fallback}")`
  );

  // TEST 10: System prompt generation
  const systemPrompt = jarvisManager.getSystemPrompt('vision');
  test(
    systemPrompt.includes('Vision') && systemPrompt.includes('Lead Systems Architect'),
    'System prompt for Vision references Vision and Lead Systems Architect'
  );

  // TEST 11: Core Orchestrator modules
  const { VisionOrchestrator, AndrewOrchestrator } = require('../src/core/agent/andrew');
  test(typeof VisionOrchestrator === 'function', 'VisionOrchestrator is exported as a constructor');
  test(AndrewOrchestrator === VisionOrchestrator, 'AndrewOrchestrator is an alias for VisionOrchestrator');

  const visionModule = require('../src/core/agent/vision');
  test(
    visionModule.VisionOrchestrator === VisionOrchestrator,
    'src/core/agent/vision re-exports VisionOrchestrator'
  );

  const vo = new VisionOrchestrator();
  test(vo.agentId === 'agent_vision', `VisionOrchestrator agentId is "agent_vision" (got "${vo.agentId}")`);
  test(vo.name === 'Vision', `VisionOrchestrator name is "Vision" (got "${vo.name}")`);

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} VISION RENAME VERIFICATION TESTS PASSED!`);
  console.log('================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUNNER TERMINATED WITH ERROR:', err);
  process.exit(1);
});
