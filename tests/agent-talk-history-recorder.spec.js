/**
 * Agent Talk Recorder & Conversation History Hub Test Suite
 * Tests multi-agent conversation recording, Turn ID generation, issue detection,
 * self-healing, search, filtering, and export capabilities.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { AgentTalkRecorder } = require('../src/utils/agent-talk-recorder');

describe('Agent Talk Recorder & Multi-Agent Conversation History Hub', function () {
  let tempDir;
  let recorder;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eloquent-history-test-'));
    recorder = new AgentTalkRecorder(tempDir);
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {}
  });

  it('1. Generates unique, structured Turn IDs for each agent', () => {
    const tuktukId = recorder.generateTurnId('tuktuk');
    const visionId = recorder.generateTurnId('vision');
    const fridayId = recorder.generateTurnId('friday');
    const brianId = recorder.generateTurnId('brian');

    assert.ok(tuktukId.startsWith('turn_') && tuktukId.includes('_tuktuk_'), `Expected tuktuk Turn ID format, got ${tuktukId}`);
    assert.ok(visionId.startsWith('turn_') && visionId.includes('_vision_'), `Expected vision Turn ID format, got ${visionId}`);
    assert.ok(fridayId.startsWith('turn_') && fridayId.includes('_friday_'), `Expected friday Turn ID format, got ${fridayId}`);
    assert.ok(brianId.startsWith('turn_') && brianId.includes('_brian_'), `Expected brian Turn ID format, got ${brianId}`);
    assert.notStrictEqual(tuktukId, visionId);
  });

  it('2. Records conversation turns for all squad agents with our prompt and agent reply', () => {
    // Tuk Tuk
    const turn1 = recorder.recordTurn({
      userPrompt: 'দাদা কেমন আছো?',
      text: 'আমি একদম ভালো আছি জান, তুমি বলো কি কাজ করবে?',
      agent: 'Tuk Tuk',
      agentKey: 'tuktuk',
      voice: 'en-US-AvaMultilingualNeural',
      latencyMs: 850
    });

    // Vision
    const turn2 = recorder.recordTurn({
      userPrompt: 'Vision, analyze system load and memory architecture',
      text: 'Core architecture analyzed, brother. All microservices are humming at nominal load.',
      agent: 'Vision',
      agentKey: 'vision',
      voice: 'en-US-AndrewNeural',
      latencyMs: 1100
    });

    // Friday
    const turn3 = recorder.recordTurn({
      userPrompt: 'Friday, summarize our sprint roadmap',
      text: 'Chief, our sprint roadmap has 3 deliverables scheduled for completion by Friday.',
      agent: 'Friday',
      agentKey: 'friday',
      voice: 'en-US-EmmaNeural',
      latencyMs: 950
    });

    // Brian
    const turn4 = recorder.recordTurn({
      userPrompt: 'Brian, run production health check',
      text: 'On it, boss. SSL certificates, API sockets, and disk thresholds are 100% green.',
      agent: 'Brian',
      agentKey: 'brian',
      voice: 'en-US-BrianNeural',
      latencyMs: 1200
    });

    assert.ok(turn1 && turn1.id, 'Turn 1 should have Turn ID');
    assert.strictEqual(turn1.userPrompt, 'দাদা কেমন আছো?');
    assert.strictEqual(turn1.agentKey, 'tuktuk');
    assert.strictEqual(turn1.avatar, '🌸');

    assert.ok(turn2 && turn2.id, 'Turn 2 should have Turn ID');
    assert.strictEqual(turn2.agentKey, 'vision');
    assert.strictEqual(turn2.avatar, '⚡');

    assert.ok(turn3 && turn3.id, 'Turn 3 should have Turn ID');
    assert.strictEqual(turn3.agentKey, 'friday');
    assert.strictEqual(turn3.avatar, '🧠');

    assert.ok(turn4 && turn4.id, 'Turn 4 should have Turn ID');
    assert.strictEqual(turn4.agentKey, 'brian');
    assert.strictEqual(turn4.avatar, '🛡️');

    const history = recorder.loadHistory();
    assert.strictEqual(history.length, 4, 'Should store 4 turns');
  });

  it('3. Accurately detects issues (lexical contamination, canned slogans, code leaks, latency)', () => {
    // Vision contaminated with intimate token
    const contaminatedTurn = recorder.recordTurn({
      userPrompt: 'Vision, status report',
      text: 'Everything is running smoothly, sweetheart babe.',
      agent: 'Vision',
      agentKey: 'vision'
    });

    assert.ok(contaminatedTurn.hasIssue, 'Should flag issue for non-Tuk Tuk intimate token');
    assert.ok(contaminatedTurn.issues.some(i => i.type === 'TOKEN_CONTAMINATION'));

    // Canned slogan turn
    const cannedTurn = recorder.recordTurn({
      userPrompt: 'Tell me something',
      text: 'লুপটা ফুল ব্রেক করলাম babe, all systems good.',
      agent: 'Tuk Tuk',
      agentKey: 'tuktuk'
    });

    assert.ok(cannedTurn.hasIssue, 'Should flag canned slogan loop');
    assert.ok(cannedTurn.issues.some(i => i.type === 'REPETITIVE_LOOP_DETECTED'));

    // Code fence leak turn
    const codeLeakTurn = recorder.recordTurn({
      userPrompt: 'Show code',
      text: 'Here is your function ```javascript console.log(1); ``` ready.',
      agent: 'Vision',
      agentKey: 'vision'
    });

    assert.ok(codeLeakTurn.hasIssue, 'Should flag code fence leak in speech');
    assert.ok(codeLeakTurn.issues.some(i => i.type === 'CODE_FENCE_LEAK'));
  });

  it('4. Autonomous Self-Healing Engine fixes all detected issues across history turns', async () => {
    // Record contaminated turns
    recorder.recordTurn({
      userPrompt: 'Vision, check status',
      text: 'All servers are green, sweetheart.',
      agent: 'Vision',
      agentKey: 'vision'
    });

    recorder.recordTurn({
      userPrompt: 'Friday, report',
      text: 'Chief, লুপটা ফুল ব্রেক করলাম, ready to execute.',
      agent: 'Friday',
      agentKey: 'friday'
    });

    const statsBefore = recorder.getStats();
    assert.ok(statsBefore.issuesDetected >= 2, 'Should have at least 2 issues detected');

    // Run self-healing engine
    const report = await recorder.selfHealHistory();
    assert.ok(report.issuesFixedCount >= 2, 'Should fix issues in report');
    assert.ok(report.turnsHealedCount >= 2, 'Should heal affected turns');

    const historyAfter = recorder.loadHistory();
    historyAfter.forEach(turn => {
      assert.strictEqual(turn.hasIssue, false, `Turn ${turn.id} should have no open issues`);
      if (turn.agentKey === 'vision') {
        assert.ok(!turn.text.includes('sweetheart'), 'Vision speech should not contain intimate token');
      }
      if (turn.agentKey === 'friday') {
        assert.ok(!turn.text.includes('লুপটা ফুল ব্রেক করলাম'), 'Friday speech should not contain canned slogan');
      }
    });

    const statsAfter = recorder.getStats();
    assert.strictEqual(statsAfter.healthScore, 100, 'Health score should be 100% after healing');
  });

  it('5. Fixes single turn issue via fixSingleTurnIssue', () => {
    const turn = recorder.recordTurn({
      userPrompt: 'Vision test',
      text: 'System nominal, meri jaan.',
      agent: 'Vision',
      agentKey: 'vision'
    });

    assert.ok(turn.hasIssue);
    const result = recorder.fixSingleTurnIssue(turn.id);
    assert.strictEqual(result.success, true);

    const history = recorder.loadHistory();
    const updated = history.find(t => t.id === turn.id);
    assert.strictEqual(updated.hasIssue, false);
    assert.ok(!updated.text.includes('meri jaan'));
  });

  it('6. Filters conversation history by agent and issue status', () => {
    recorder.recordTurn({ userPrompt: 'Q1', text: 'R1', agent: 'Tuk Tuk', agentKey: 'tuktuk' });
    recorder.recordTurn({ userPrompt: 'Q2', text: 'R2', agent: 'Vision', agentKey: 'vision' });
    recorder.recordTurn({ userPrompt: 'Q3', text: 'R3 sweetheart', agent: 'Friday', agentKey: 'friday' }); // has issue

    const tuktukTurns = recorder.getHistory({ agent: 'tuktuk' });
    assert.strictEqual(tuktukTurns.items.length, 1);
    assert.strictEqual(tuktukTurns.items[0].agentKey, 'tuktuk');

    const visionTurns = recorder.getHistory({ agent: 'vision' });
    assert.strictEqual(visionTurns.items.length, 1);
    assert.strictEqual(visionTurns.items[0].agentKey, 'vision');

    const issueTurns = recorder.getHistory({ status: 'issues' });
    assert.strictEqual(issueTurns.items.length, 1);
    assert.strictEqual(issueTurns.items[0].agentKey, 'friday');
  });

  it('7. Searches history by Turn ID, prompt, reply, or issue message', () => {
    const turnA = recorder.recordTurn({ userPrompt: 'Quantum backtesting portfolio', text: 'Backtest returned 42% Sharpe 2.4', agent: 'Friday', agentKey: 'friday' });
    const turnB = recorder.recordTurn({ userPrompt: 'Kubernetes cluster check', text: 'All pods healthy in us-east-1', agent: 'Brian', agentKey: 'brian' });

    // Search by Turn ID
    const searchById = recorder.getHistory({ search: turnA.id });
    assert.strictEqual(searchById.items.length, 1);
    assert.strictEqual(searchById.items[0].id, turnA.id);

    // Search by user prompt keyword
    const searchByPrompt = recorder.getHistory({ search: 'Quantum backtesting' });
    assert.strictEqual(searchByPrompt.items.length, 1);
    assert.strictEqual(searchByPrompt.items[0].id, turnA.id);

    // Search by agent reply keyword
    const searchByReply = recorder.getHistory({ search: 'Kubernetes' });
    assert.strictEqual(searchByReply.items.length, 1);
    assert.strictEqual(searchByReply.items[0].id, turnB.id);
  });

  it('8. Exports history correctly to JSON and Markdown', () => {
    recorder.recordTurn({
      userPrompt: 'What is our strategy?',
      text: 'Dominate multi-agent voice execution with zero latency.',
      agent: 'Tuk Tuk',
      agentKey: 'tuktuk',
      voice: 'en-US-AvaMultilingualNeural'
    });

    const jsonExport = recorder.exportHistory('json');
    assert.ok(typeof jsonExport === 'string');
    const parsed = JSON.parse(jsonExport);
    assert.strictEqual(parsed.length, 1);

    const mdExport = recorder.exportHistory('markdown');
    assert.ok(mdExport.includes('# Eloquent Multi-Agent Working Conversation History'));
    assert.ok(mdExport.includes('Tuk Tuk'));
    assert.ok(mdExport.includes('Dominate multi-agent voice execution'));
  });
});
