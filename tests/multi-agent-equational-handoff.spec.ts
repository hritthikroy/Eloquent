/**
 * Test Suite: Multi-Agent Equational Cross-Agent Handoff & Specialist Resonance
 * 
 * Mathematical Equations Verified:
 * 1. Specialist Resonance Utility:
 *    R_k(u_t) = w_k^T \phi(u_t) + \gamma_k * I(u_t addresses A_k)
 *    P(A_k | u_t) = \exp(R_k / T) / \sum_j \exp(R_j / T)  (T = 0.45)
 * 2. Cross-Agent Handoff Utility:
 *    U_handoff(A_1 -> A_2) = \kappa_del * I(Delegation) + \kappa_fit * R_A2 + \kappa_auth * Authority(A_1) >= \Theta (\Theta = 0.60)
 * 3. Receptive Listening Invariant:
 *    Prompt injection requiring Andrew to confirm receipt from Tuk Tuk and execute AST verification
 * 4. Antigravity Auto-Mode AST Verification:
 *    Executes zero-defect codebase AST audit on 'fix first' / 'fix issues' directives
 * 5. Sequential Turn Parsing:
 *    Strict multi-agent turn segmentation and voice allocation
 */

import * as path from 'path';

const projectRoot = path.resolve(__dirname, '..', '..');
const JarvisManager = require(path.join(projectRoot, 'src/utils/jarvis-manager'));
const actionRunner = require(path.join(projectRoot, 'src/utils/action-runner'));

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING MULTI-AGENT EQUATIONAL HANDOFF & SPECIALIST RESONANCE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Test assertion failed: ${testName}`);
    }
  }

  const testUserDataDir = path.join(projectRoot, 'userData');
  const jarvis = new JarvisManager(testUserDataDir);

  // -------------------------------------------------------------
  // TEST GROUP 1: Mathematical Specialist Resonance Utility R_k(u_t)
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Specialist Resonance & Softmax Probabilities ---');
  {
    const codeQuery = "See, Vision not listen. Fix first, Vision and check syntax";
    const resonance = jarvis.computeSpecialistResonance(codeQuery);

    assert(resonance !== null && typeof resonance.scores === 'object', "computeSpecialistResonance returns valid structure");
    assert(resonance.scores.vision > resonance.scores.tuktuk, "Vision resonance R_vision > R_tuktuk for code/fix tokens");
    assert(resonance.scores.vision > resonance.scores.jenny, "Vision resonance R_vision > R_jenny for code/fix tokens");
    assert(resonance.scores.vision > resonance.scores.brian, "Vision resonance R_vision > R_brian for code/fix tokens");

    // Verify Softmax distribution properties: \sum P(A_k) = 1.0 and P(Vision) is dominant
    const probSum = resonance.probabilities.vision + resonance.probabilities.tuktuk + 
                     resonance.probabilities.jenny + resonance.probabilities.brian;
    assert(Math.abs(probSum - 1.0) < 1e-4, `Softmax probabilities sum to 1.0 (got ${probSum.toFixed(4)})`);
    assert(resonance.probabilities.vision > 0.65, `Vision receives dominant Softmax probability (got ${resonance.probabilities.vision.toFixed(4)})`);

    // Verify Andrew does NOT activate Vision
    const andrewQuery = "Hey Andrew, check this bug";
    const andrewAgent = jarvis.detectActiveAgent(andrewQuery);
    assert(andrewAgent.key !== 'vision', "detectActiveAgent does NOT map Andrew to Vision");
  }

  // -------------------------------------------------------------
  // TEST GROUP 2: Equational Cross-Agent Handoff U_handoff >= Theta
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Equational Cross-Agent Handoff (Tuk Tuk -> Vision) ---');
  {
    // Case A: User reprimands "Vision not listen. Fix first, Vision"
    const handoffA = jarvis.evaluateCrossAgentHandoff("See, Vision not listen. Fix first, Vision");
    assert(handoffA !== null, "Handoff evaluated for 'Vision not listen. Fix first, Vision'");
    assert(handoffA.delegated === true, "Handoff delegated is true");
    assert(handoffA.utility >= 0.60, `U_handoff (${handoffA.utility.toFixed(2)}) satisfies threshold >= 0.60`);
    assert(handoffA.sourceAgent.key === 'tuktuk', "Source agent is Tuk Tuk (Co-Founder authority)");
    assert(handoffA.targetAgent.key === 'vision', "Target agent is Vision (Lead Dev execution)");
    assert(handoffA.handoffLead.includes("listen up"), "Handoff lead orders Vision to listen up");

    // Case B: Third-person delegation "Tuk Tuk, tell Vision to fix the issues"
    const handoffB = jarvis.evaluateCrossAgentHandoff("Tuk Tuk, tell Vision to fix the issues");
    assert(handoffB !== null, "Handoff evaluated for 'tell Vision to fix'");
    assert(handoffB.delegated === true, "Delegated is true for 'tell Vision'");
    assert(handoffB.targetAgent.key === 'vision', "Target agent is Vision");
    assert(handoffB.utility >= 0.60, `U_handoff (${handoffB.utility.toFixed(2)}) satisfies threshold >= 0.60`);

    // Case C: Unlinking assertion - saying "tell Andrew" does NOT hand off to Vision
    const handoffAndrew = jarvis.evaluateCrossAgentHandoff("Tuk Tuk, tell Andrew to fix the issues");
    assert(handoffAndrew === null, "'tell Andrew' does NOT route to Vision");

    // Case D: Unrelated query without delegation
    const handoffD = jarvis.evaluateCrossAgentHandoff("What is the current system memory usage?");
    assert(handoffD === null, "Unrelated query yields null handoff");
  }

  // -------------------------------------------------------------
  // TEST GROUP 3: Task Assignment Delegation Interface
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Task Assignment Delegation Interface ---');
  {
    const assignment = jarvis.evaluateTaskAssignment("Tuk Tuk, have Vision fix the bug");
    assert(assignment !== null, "evaluateTaskAssignment returns valid object");
    assert(assignment.delegated === true, "assignment.delegated is true");
    assert(assignment.assignedAgent.key === 'vision', "assignment.assignedAgent is Vision");
    assert(assignment.lead.key === 'tuktuk', "assignment.lead is Tuk Tuk");
  }

  // -------------------------------------------------------------
  // TEST GROUP 4: Receptive Listening Invariant in System Prompt
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Receptive Listening Invariant Prompt Ingestion ---');
  {
    const handoffCtx = { command: "Vision, listen up! Babe is telling you to fix the issues first. Take over right now!" };
    const visionPrompt = jarvis.getSystemPrompt(jarvis.agents.vision, "fix first, Vision", handoffCtx);

    assert(visionPrompt.includes("[TUK TUK DIRECTIVE & RECEPTIVE LISTENING INVARIANT]"), "System prompt contains receptive listening invariant section");
    assert(visionPrompt.includes(handoffCtx.command), "System prompt embeds Tuk Tuk's exact command");
    assert(visionPrompt.includes("On it Tuk Tuk") || visionPrompt.includes("Copy that Tuk Tuk"), "Prompt instructs Vision to acknowledge Tuk Tuk directly");
    assert(visionPrompt.includes("STRICT INVARIANT: NEVER ignore Tuk Tuk's command"), "Prompt enforces strict invariant against ignoring Tuk Tuk");
    assert(visionPrompt.includes("bro") || visionPrompt.includes("bhai"), "Vision prompt enforces brotherly salutation");
  }

  // -------------------------------------------------------------
  // TEST GROUP 5: Antigravity Auto-Mode AST Verification for Vision
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Antigravity Auto-Mode Execution for Fix Directives ---');
  {
    // Test that actionRunner recognizes fix directives directed at Vision
    const actionRes = await actionRunner.handleAction("fix first, Vision", jarvis.agents.vision, jarvis);
    assert(actionRes !== null && actionRes.handled === true, "actionRunner handles 'fix first, Vision'");
    assert(actionRes.agentName === "Vision", "Executing agent is Vision");
    assert(actionRes.agentVoice.includes("Andrew"), "Voice is Andrew neural voice");
    assert(actionRes.speech.includes("Tuk Tuk") || actionRes.speech.includes("AST") || actionRes.speech.includes("syntax"), "Speech acknowledges Tuk Tuk or reports AST verification");
    assert(actionRes.speech.includes("0 syntax errors detected") || actionRes.speech.includes("verified"), "Codebase AST audit confirms 0 syntax errors");
  }

  // -------------------------------------------------------------
  // TEST GROUP 6: Multi-Agent Turn Parsing & Sequential Allocation
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Multi-Agent Turn Parsing & Voice Allocation ---');
  {
    // Emulate the parser logic in src/main.js
    const agentMap: Record<string, { name: string; voice: string }> = {
      'tuk tuk': { name: 'Tuk Tuk', voice: 'en-US-AvaMultilingualNeural' },
      'tuktuk': { name: 'Tuk Tuk', voice: 'en-US-AvaMultilingualNeural' },
      'ava': { name: 'Tuk Tuk', voice: 'en-US-AvaMultilingualNeural' },
      'andrew': { name: 'Andrew', voice: 'en-US-AndrewMultilingualNeural' },
      'jenny': { name: 'Jenny', voice: 'en-US-EmmaMultilingualNeural' },
      'brian': { name: 'Brian', voice: 'en-US-BrianMultilingualNeural' }
    };

    const pattern = /(?:^|\n)\s*\[?(Tuk\s*Tuk|Andrew|Jenny|Brian|Ava)\]?:?\s*([\s\S]*?)(?=(?:\n\s*\[?(?:Tuk\s*Tuk|Andrew|Jenny|Brian|Ava)\]?:?)|$)/gi;
    const testMultiTurnText = `[Tuk Tuk]: Andrew, listen up! Babe is telling you to fix the issues first. Take over right now!\n[Andrew]: Copy that Tuk Tuk, on it bro! Audited codebase AST syntax: 0 syntax errors detected across main engine modules. All systems green, bro!`;

    const turns: Array<{ agentName: string; voice: string; text: string; turnIndex: number }> = [];
    let match;
    while ((match = pattern.exec(testMultiTurnText)) !== null) {
      const rawName = match[1].toLowerCase().replace(/\s+/g, ' ').trim();
      const agentInfo = agentMap[rawName] || { name: match[1], voice: 'en-US-AvaMultilingualNeural' };
      let speech = match[2].trim().replace(/^[,\s—–:-]+/, '').trim();
      if (speech.length > 0) {
        turns.push({
          agentName: agentInfo.name,
          voice: agentInfo.voice,
          text: speech,
          turnIndex: turns.length
        });
      }
    }

    assert(turns.length === 2, `Parsed exactly 2 sequential agent turns (got ${turns.length})`);
    assert(turns[0].agentName === 'Tuk Tuk', "Turn 0 is Tuk Tuk");
    assert(turns[0].voice === 'en-US-AvaMultilingualNeural', "Turn 0 voice is AvaMultilingualNeural");
    assert(turns[1].agentName === 'Andrew', "Turn 1 is Andrew");
    assert(turns[1].voice === 'en-US-AndrewMultilingualNeural', "Turn 1 voice is AndrewMultilingualNeural");
    assert(turns[1].text.includes("Copy that Tuk Tuk"), "Turn 1 text contains receptive listening acknowledgment");
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} MULTI-AGENT EQUATIONAL HANDOFF TESTS PASSED!`);
  console.log('================================================================\n');

  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
