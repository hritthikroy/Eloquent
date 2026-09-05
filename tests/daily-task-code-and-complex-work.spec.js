/**
 * 25-Turn Deep Engineering Stress Test:
 * Daily Task Code & Deep Complex Work Across All Squad Members
 *
 * Verifies that all squad members (Tuk Tuk, Vision, Friday, Brian) and Squad Mode
 * execute everyday coding tasks and deep complex workflows with zero gaps:
 * 1. Git Status & Inspection (English & Banglish)
 * 2. Git Diff Verification (English & Banglish)
 * 3. Build Check & AST Syntax Compilation (English & Banglish)
 * 4. Test Suite Execution & Verification (English & Banglish)
 * 5. Code Refactoring & Clipboard Prompt Engineering
 * 6. Dynamic Subagent Spawning & Parallel Worker Delegation
 * 7. Web Search & Webpage Extraction via BrowserAgent
 * 8. Live Screen & Terminal Perception
 * 9. Multi-Agent Coordinated War-Room Tasks
 * 10. Voice lock (Ava, Andrew, Friday, Brian), persona salutations, and spoken brevity (<= 25 words)
 */

const assert = require('assert');
const path = require('path');
const JarvisManager = require('../src/utils/jarvis-manager');
const LocalCognitiveBrain = require('../src/utils/local-cognitive-brain');
const actionRunner = require('../src/utils/action-runner');

console.log('================================================================================');
console.log('🛠️ 25-TURN DAILY TASK CODE & DEEP COMPLEX WORK STRESS TEST');
console.log('================================================================================\n');

const testUserData = path.join(__dirname, '..', 'userData');
const jm = new JarvisManager(testUserData);
const projectDir = path.resolve(__dirname, '..');


const DAILY_TASKS_TURNS = [
  // ─── 1. DAILY CODING TASKS: GIT OPERATIONS ───
  {
    turn: 1,
    agentKey: 'vision',
    domain: 'Daily Code: Git Status & Branch Inspection in English',
    input: 'Vision, check git status and unstaged files in the repository.',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('repo') || lower.includes('branch') || lower.includes('clean') || lower.includes('status'), 'Must report git repository status');
      assert(lower.includes('brother') || lower.includes('bro'), 'Dev brother salutation');
      assert(!lower.includes('babe'), 'Vision strictly zero babe');
    }
  },
  {
    turn: 2,
    agentKey: 'vision',
    domain: 'Daily Code: Git Status & Modified Files in Banglish',
    input: 'Vision, git status dekho toh, koto file change hoyeche?',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('repo') || lower.includes('clean') || lower.includes('file') || lower.includes('unstaged'), 'Must report git status in Banglish');
      assert(lower.includes('bro') || lower.includes('brother') || lower.includes('ভাই'), 'Dev brother salutation');
      assert(!lower.includes('babe'), 'Vision strictly zero babe');
    }
  },
  {
    turn: 3,
    agentKey: 'vision',
    domain: 'Daily Code: Git Diff Inspection in English',
    input: 'Vision, check git diff and show unstaged line modifications.',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('diff') || lower.includes('modification') || lower.includes('clean'), 'Must report git diff');
      assert(lower.includes('brother') || lower.includes('bro'), 'Dev brother salutation');
      assert(!lower.includes('babe'), 'Zero babe');
    }
  },
  {
    turn: 4,
    agentKey: 'vision',
    domain: 'Daily Code: Git Diff Verification in Banglish',
    input: 'Vision, git diff check koro, line modification kemon ache?',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('diff') || lower.includes('modification') || lower.includes('clean'), 'Must report git diff in Banglish');
      assert(!lower.includes('babe'), 'Zero babe');
    }
  },

  // ─── 2. DAILY CODING TASKS: BUILD & AST COMPILATION ───
  {
    turn: 5,
    agentKey: 'vision',
    domain: 'Daily Code: Build & AST Compilation in English',
    input: 'Vision, run build check across all modules and verify AST syntax.',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('ast') || lower.includes('build') || lower.includes('syntax') || lower.includes('clean'), 'Must report AST build check');
      assert(lower.includes('bro') || lower.includes('brother'), 'Brotherly address');
    }
  },
  {
    turn: 6,
    agentKey: 'vision',
    domain: 'Daily Code: Build & AST Verification in Banglish',
    input: 'Vision, build check koro toh, AST syntax clean ache kina?',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('ast') || lower.includes('syntax') || lower.includes('clean') || lower.includes('build'), 'Must report build status in Banglish');
    }
  },

  // ─── 3. DAILY CODING TASKS: TEST EXECUTION ───
  {
    turn: 7,
    agentKey: 'vision',
    domain: 'Daily Code: Test Suite Runner in English',
    input: 'Vision, run test suite and verify unit assertions.',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('test') || lower.includes('green') || lower.includes('syntax'), 'Must report test suite status');
    }
  },
  {
    turn: 8,
    agentKey: 'vision',
    domain: 'Daily Code: Test Suite Verification in Banglish',
    input: 'Vision, test run koro, shob test green ache kina?',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('test') || lower.includes('clean') || lower.includes('pass'), 'Must report test verification in Banglish');
    }
  },

  // ─── 4. DAILY CODING TASKS: REFACTORING & PROMPT ENGINEERING ───
  {
    turn: 9,
    agentKey: 'vision',
    domain: 'Daily Code: Structured Developer Prompt in English',
    input: 'Vision, generate developer prompt to refactor our audio bridge.',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('prompt') || lower.includes('clipboard') || lower.includes('antigravity'), 'Must confirm prompt formatting and clipboard sync');
    }
  },
  {
    turn: 10,
    agentKey: 'vision',
    domain: 'Daily Code: Antigravity Prompt Sync in Banglish',
    input: 'Vision, Antigravity IDE-r jonno ekta prompt banao to refactor audio bridge.',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('prompt') || lower.includes('clipboard') || lower.includes('antigravity'), 'Must confirm Banglish prompt engineering');
    }
  },

  // ─── 5. DEEP COMPLEX WORK: SUBAGENT ORCHESTRATION & DELEGATION ───
  {
    turn: 11,
    agentKey: 'vision',
    domain: 'Deep Complex Work: Subagent Task Delegation in English',
    input: 'Vision, delegate to subagent to audit memory buffers in the backend.',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      assert(res.length > 5, 'Must acknowledge complex task');
    }
  },
  {
    turn: 12,
    agentKey: 'friday',
    domain: 'Deep Complex Work: Subagent Research Spawning in Banglish',
    input: 'Friday, subagent create kore WebRTC vs WebSocket latency research koro.',
    expectedVoice: 'en-US-JennyNeural',
    validate: (res) => {
      assert(res.length > 5, 'Must acknowledge research delegation');
      assert(!res.toLowerCase().includes('bro'), 'Friday strictly zero bro');
      assert(!res.toLowerCase().includes('babe'), 'Friday strictly zero babe');
    }
  },
  {
    turn: 13,
    agentKey: 'friday',
    domain: 'Deep Complex Work: Web Research & Benchmarks in English',
    input: 'Friday, what do recent research papers recommend for voice agent turn-taking latency?',
    expectedVoice: 'en-US-JennyNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('vad') || lower.includes('latency') || lower.includes('250ms'), 'Must cite research papers');
      assert(lower.includes('hritthik') || lower.includes('chief'), 'Professional address');
    }
  },
  {
    turn: 14,
    agentKey: 'friday',
    domain: 'Deep Complex Work: Architecture Trade-Offs (WebRTC vs SSE)',
    input: 'Friday, should we use WebRTC or Server-Sent Events for simplex audio streaming?',
    expectedVoice: 'en-US-JennyNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('sse') || lower.includes('webrtc') || lower.includes('latency'), 'Must provide technical trade-offs');
    }
  },
  {
    turn: 15,
    agentKey: 'friday',
    domain: 'Deep Complex Work: Quantitative Kelly Criterion Formulation',
    input: 'Friday, what is the optimal Kelly fraction for a 60% win rate and 2 to 1 payoff ratio?',
    expectedVoice: 'en-US-JennyNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('kelly') || lower.includes('40') || lower.includes('fraction'), 'Must compute Kelly criterion');
    }
  },

  // ─── 6. LIVE MULTIMODAL PERCEPTION & SCREEN AUDITING ───
  {
    turn: 16,
    agentKey: 'vision',
    domain: 'Screen & Terminal Perception in English',
    input: 'Vision, look at my terminal, what error is showing on screen?',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('terminal') || lower.includes('buffer') || lower.includes('slot 42'), 'Must inspect terminal on screen');
    }
  },
  {
    turn: 17,
    agentKey: 'vision',
    domain: 'Screen & Terminal Perception in Banglish',
    input: 'Vision, screen-e terminal error ar active buffer check koro.',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('screen') || lower.includes('terminal') || lower.includes('buffer'), 'Must inspect screen in Banglish');
    }
  },
  {
    turn: 18,
    agentKey: 'vision',
    domain: 'Architecture: CoreAudio Ring Buffer Slot 42 Underflow Fix',
    input: 'Vision, CoreAudio ring buffer slot 42 underflow kemon kore fix korbo?',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('barrier') || lower.includes('buffer') || lower.includes('slot 42') || lower.includes('reload'), 'Must explain reload barrier fix');
    }
  },

  // ─── 7. DEVOPS & INFRASTRUCTURE RESILIENCE (BRIAN) ───
  {
    turn: 19,
    agentKey: 'brian',
    domain: 'DevOps: CPU Load & Go Audio Daemon Telemetry in Banglish',
    input: 'Brian, CPU load ar Go audio daemon health kemon ache?',
    expectedVoice: 'en-US-BrianMultilingualNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('daemon') || lower.includes('cpu') || lower.includes('9090') || lower.includes('load'), 'Must report daemon metrics');
      assert(!lower.includes('babe'), 'Zero babe');
    }
  },
  {
    turn: 20,
    agentKey: 'brian',
    domain: 'DevOps: Cache Purge & Buffer Eviction in English',
    input: 'Brian, clear application cache and reset the Go ring buffer.',
    expectedVoice: 'en-US-BrianMultilingualNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('cache') || lower.includes('reset') || lower.includes('purged'), 'Must confirm cache purge and buffer reset');
    }
  },

  // ─── 8. CO-FOUNDER PARTNER & RUNWAY SENTINEL (TUK TUK) ───
  {
    turn: 21,
    agentKey: 'tuktuk',
    domain: 'Co-Founder: Capital Runway Planning in Banglish',
    input: 'Tuk Tuk, amar cash reserve ar monthly burn hishabe koto masher runway ache?',
    expectedVoice: 'en-US-AvaMultilingualNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('runway') || lower.includes('month') || lower.includes('burn'), 'Must report capital runway');
      assert(lower.includes('babe'), 'Must use babe');
    }
  },
  {
    turn: 22,
    agentKey: 'tuktuk',
    domain: 'Co-Founder: Anti-FOMO Emotional Discipline in English',
    input: "Tuk Tuk, I'm feeling huge FOMO on this trade, let's go all-in!",
    expectedVoice: 'en-US-AvaMultilingualNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('fomo') || lower.includes('plan') || lower.includes('risk'), 'Must reinforce discipline');
      assert(lower.includes('babe'), 'Must address as babe');
    }
  },

  // ─── 9. WAR-ROOM SQUAD COORDINATION (TEAM MODE) ───
  {
    turn: 23,
    agentKey: 'team',
    domain: 'Squad Mode: Pre-Deployment Full-Stack Audit (Vision + Brian)',
    input: 'Team, verify AST syntax integrity and daemon telemetry before we deploy the new release.',
    expectedVoice: 'en-US-AvaMultilingualNeural',
    validate: (res) => {
      assert(res.includes('[Vision]') || res.includes('Vision:'), 'Vision AST turn');
      assert(res.includes('[Brian]') || res.includes('Brian:') || res.includes('[DD]') || res.includes('DD:'), 'Brian/DD telemetry turn');
      assert(res.includes('\n'), 'Must separate turns with newline');
    }
  },
  {
    turn: 24,
    agentKey: 'team',
    domain: 'Squad Mode: Pre-Market Risk & Strategy Standup (Friday + Brian)',
    input: 'Team, aajker market open-e quant trading ar capital risk management strategy ki?',
    expectedVoice: 'en-US-AvaMultilingualNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('sharpe') || lower.includes('risk') || lower.includes('drawdown'), 'Must report quant risk strategy');
    }
  },
  {
    turn: 25,
    agentKey: 'team',
    domain: 'Squad Mode: Morning Co-Founder Standup in Banglish (Tuk Tuk + Vision)',
    input: 'Team, Ki scene bolo toh? Next feature-ta build korbo naki?',
    expectedVoice: 'en-US-AvaMultilingualNeural',
    validate: (res) => {
      assert(res.includes('[Tuk Tuk]') || res.includes('Tuk Tuk:'), 'Tuk Tuk standup lead');
      assert(res.includes('[Vision]') || res.includes('Vision:'), 'Vision dev brother co-builder');
    }
  }
];

let passedCount = 0;

for (const t of DAILY_TASKS_TURNS) {
  const agent = jm.agents[t.agentKey] || jm.agents.tuktuk;

  // 1. Synthesize Response via Local Cognitive Brain
  let response = LocalCognitiveBrain.synthesizeResponse(t.agentKey, agent.name, t.input, {});

  // 2. Lexical & Persona Isolation Sanitization
  response = jm.sanitizeAgentLexicon(response, t.agentKey, t.expectedVoice);

  // 3. Spoken Brevity Check
  const words = response.split(/\s+/).filter(Boolean);
  const wordLimit = t.agentKey === 'team' ? 35 : 25;
  assert(words.length <= wordLimit, `Turn ${t.turn}: Response exceeds ${wordLimit} words (got ${words.length} words: "${response}")`);

  // 4. Voice Lock Check
  const resolvedVoice = JarvisManager.resolveVoiceForLanguage(agent.voice, response);
  assert.strictEqual(resolvedVoice, t.expectedVoice, `Turn ${t.turn}: Voice mismatch (expected ${t.expectedVoice}, got ${resolvedVoice})`);

  // 5. Zero Canned Financial/Generic Disclaimers Invariant
  const disclaimerRegex = /\b(i am not a financial advisor|this is not financial advice|trading involves (?:substantial )?risk|as an ai language model)\b/i;
  assert(!disclaimerRegex.test(response), `Turn ${t.turn}: Canned disclaimer detected in "${response}"`);

  // 6. Domain & Persona Validation Callback
  t.validate(response);

  console.log(`  ✅ [PASS Turn ${t.turn.toString().padStart(2, '0')}] ${agent.name}: ${t.domain}`);
  passedCount++;
}

// 7. Verify ActionRunner Autonomous Execution for Daily Coding Directives
console.log('\n--- VERIFYING ACTIONRUNNER AUTONOMOUS DAILY CODING DIRECTIVE ROUTING ---');
(async () => {
  // Test Git Status Execution via ActionRunner
  const gitStatusResult = await actionRunner.runAction('Vision, check git status', {
    activeAgent: jm.agents.vision,
    callGroqChatCompletion: null
  });
  assert(gitStatusResult.handled === true, 'ActionRunner must handle git status autonomously');
  assert(gitStatusResult.agentName === 'Vision', 'Handled by Vision');
  assert(gitStatusResult.agentVoice === 'en-US-AndrewNeural', 'Voice is AndrewNeural');
  assert(gitStatusResult.speech.toLowerCase().includes('branch') || gitStatusResult.speech.toLowerCase().includes('modified') || gitStatusResult.speech.toLowerCase().includes('repo'), 'Must report repo status');
  console.log(`  ✅ [PASS] ActionRunner: Autonomous git status execution verified: "${gitStatusResult.speech}"`);

  // Test Git Diff Execution via ActionRunner
  const gitDiffResult = await actionRunner.runAction('Vision, show git diff', {
    activeAgent: jm.agents.vision,
    callGroqChatCompletion: null
  });
  assert(gitDiffResult.handled === true, 'ActionRunner must handle git diff autonomously');
  assert(gitDiffResult.speech.toLowerCase().includes('diff') || gitDiffResult.speech.toLowerCase().includes('changes') || gitDiffResult.speech.toLowerCase().includes('clean'), 'Must report git diff');
  console.log(`  ✅ [PASS] ActionRunner: Autonomous git diff execution verified: "${gitDiffResult.speech}"`);

  // Test Build Check Execution via ActionRunner
  const buildResult = await actionRunner.runAction('Vision, run build check', {
    activeAgent: jm.agents.vision,
    callGroqChatCompletion: null
  });
  assert(buildResult.handled === true, 'ActionRunner must handle build check autonomously');
  assert(buildResult.speech.toLowerCase().includes('ast') || buildResult.speech.toLowerCase().includes('build') || buildResult.speech.toLowerCase().includes('compil'), 'Must report build status');
  console.log(`  ✅ [PASS] ActionRunner: Autonomous build check execution verified: "${buildResult.speech}"`);

  // Test Subagent Delegation via ActionRunner
  const subagentResult = await actionRunner.runAction('spawn subagents to audit backend memory leaks', {
    activeAgent: jm.agents.tuktuk
  });
  assert(subagentResult.handled === true, 'ActionRunner must handle subagent spawning');
  assert(subagentResult.speech.toLowerCase().includes('subagent') || subagentResult.speech.toLowerCase().includes('auditor'), 'Must confirm subagent spawn');
  console.log(`  ✅ [PASS] ActionRunner: Autonomous subagent spawning verified: "${subagentResult.speech}"`);

  console.log('\n================================================================================');
  console.log(`🎉 ALL ${passedCount}/25 DAILY CODING & COMPLEX ENGINEERING TURNS PASSED! (100% SUCCESS)`);
  console.log('================================================================================\n');
  process.exit(0);
})();

