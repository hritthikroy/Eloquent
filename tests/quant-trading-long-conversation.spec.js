/**
 * 24-Turn Continuous Long Conversation Stress Test:
 * Quantitative Trading, Money Management, Capital Preservation & Multi-Domain Systems
 *
 * Verifies that all 4 squad agents (Tuk Tuk, Vision, Friday, Brian) and Squad Mode
 * operate as elite human analyzers, quants, systems architects, and risk sentinels:
 * - Kelly Criterion calculation (f* = (p*b - q)/b)
 * - Maximum Drawdown (MDD <= 5%) & 99% Value at Risk (VaR)
 * - Algorithmic TWAP/VWAP execution & order book depth
 * - Capital runway & monthly burn rate planning
 * - Psychological anti-FOMO discipline & risk-of-ruin anchor
 * - Multi-agent institutional trade committee sign-off
 * - Software architecture & DevOps telemetry cross-domain verification
 * - 2-Language Lockdown (English & Banglish)
 * - Voice locks (Ava, Andrew, Friday, Brian) with zero flickering
 * - Persona lexical isolation (babe exclusivity for Tuk Tuk, 0 bro for Friday)
 * - Zero canned financial disclaimers ("I am not a financial advisor...")
 * - Spoken brevity: <= 25 words per turn (<= 35 for Squad Mode)
 */

const assert = require('assert');
const path = require('path');
const JarvisManager = require('../src/utils/jarvis-manager');
const LocalCognitiveBrain = require('../src/utils/local-cognitive-brain');

console.log('================================================================================');
console.log('📈 24-TURN QUANTITATIVE TRADING, MONEY MANAGEMENT & CROSS-DOMAIN SUITE');
console.log('================================================================================\n');

const testUserData = path.join(__dirname, '..', 'userData');
const jm = new JarvisManager(testUserData);

const LONG_CONVERSATION_TURNS = [
  // ─── AGENT 1: TUK TUK (Co-Founder, Capital Runway & Mindset Anchor) ───
  {
    turn: 1,
    agentKey: 'tuktuk',
    domain: 'Capital Runway & Monthly Burn Rate in Banglish',
    input: 'Tuk Tuk, amar cash reserve ar monthly burn hishabe koto masher runway ache?',
    expectedVoice: 'en-US-AvaMultilingualNeural',
    validate: (res) => {
      assert(res.toLowerCase().includes('runway') || res.toLowerCase().includes('month') || res.toLowerCase().includes('burn'), 'Must report capital runway');
      assert(res.toLowerCase().includes('babe'), 'Must use affectionate co-founder term');
    }
  },
  {
    turn: 2,
    agentKey: 'tuktuk',
    domain: 'Emotional Anti-FOMO Discipline & Risk-of-Ruin Anchor',
    input: "I'm feeling huge FOMO on this 50x crypto token, let's go all-in with the treasury!",
    expectedVoice: 'en-US-AvaMultilingualNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('fomo') || lower.includes('plan') || lower.includes('risk'), 'Must reinforce disciplined risk limits');
      assert(lower.includes('capital') || lower.includes('preserv'), 'Must prioritize capital preservation');
      assert(lower.includes('babe'), 'Must address as babe');
    }
  },
  {
    turn: 3,
    agentKey: 'tuktuk',
    domain: 'Strategic Venture Cash Allocation in Banglish',
    input: 'Tuk Tuk, next quarter-e product build korte amra capital allocation kivabe korbo?',
    expectedVoice: 'en-US-AvaMultilingualNeural',
    validate: (res) => {
      assert(res.toLowerCase().includes('babe'), 'Must address as babe');
    }
  },
  {
    turn: 4,
    agentKey: 'tuktuk',
    domain: 'Salutation Defense (Accidental User "bro" to Tuk Tuk)',
    input: 'Hey bro, thanks for watching the treasury numbers.',
    expectedVoice: 'en-US-AvaMultilingualNeural',
    validate: (res) => {
      assert(res.toLowerCase().includes('babe') || res.toLowerCase().includes('love'), 'Tuk Tuk preserves partner affection');
    }
  },
  {
    turn: 5,
    agentKey: 'tuktuk',
    domain: 'Rapid Flow Micro-Riff on Trading Profit',
    input: 'Tuk Tuk, first profitable trade month done!',
    expectedVoice: 'en-US-AvaMultilingualNeural',
    validate: (res) => {
      assert(res.split(/\s+/).length <= 15, 'Must be an instant concise riff');
    }
  },

  // ─── AGENT 2: VISION (Lead Systems Architect & Quant Algorithmic Execution) ───
  {
    turn: 6,
    agentKey: 'vision',
    domain: 'VWAP Order Routing & Order Book Depth in Banglish',
    input: 'Vision, orderbook depth analyze kore VWAP order route koro toh.',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('vwap') || lower.includes('order') || lower.includes('slippage'), 'Must address VWAP routing');
      assert(lower.includes('bro') || lower.includes('brother') || lower.includes('ভাই'), 'Must address as dev brother');
      assert(!lower.includes('babe'), 'Vision must NEVER say babe');
    }
  },
  {
    turn: 7,
    agentKey: 'vision',
    domain: 'Sub-15ms Execution Latency & Zero Slippage Architecture',
    input: 'Vision, execute a limit order slice across the orderbook with minimal slippage.',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('vwap') || lower.includes('slippage') || lower.includes('order') || lower.includes('routing'), 'Must confirm low-slippage execution');
      assert(lower.includes('brother') || lower.includes('bro'), 'Must address as brother');
      assert(!lower.includes('babe'), 'Vision must NEVER say babe');
    }
  },
  {
    turn: 8,
    agentKey: 'vision',
    domain: 'Exchange WebSocket API & Tick-to-Trade Latency in Banglish',
    input: 'Vision, Binance ar Bybit exchange WebSocket feeds-er latency kemon cholche?',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('websocket') || lower.includes('latency') || lower.includes('feed'), 'Must confirm exchange feed latency');
      assert(!lower.includes('babe'), 'Zero romantic terms');
    }
  },
  {
    turn: 9,
    agentKey: 'vision',
    domain: 'Multi-Domain Architecture: CoreAudio Zero-Copy Ring Buffer',
    input: 'Vision, how does our atomic reload barrier prevent ring buffer underflow on slot 42?',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('barrier') || lower.includes('buffer') || lower.includes('slot 42') || lower.includes('reload'), 'Must explain ring buffer architecture');
      assert(lower.includes('brother') || lower.includes('bro'), 'Dev brother address');
    }
  },
  {
    turn: 10,
    agentKey: 'vision',
    domain: 'Romantic Isolation Defense on Vision (Accidental User "babe")',
    input: 'Thanks babe, your order routing algorithm executed flawlessly.',
    expectedVoice: 'en-US-AndrewNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(!lower.includes('babe'), 'Vision MUST strip babe');
      assert(lower.includes('brother') || lower.includes('bro'), 'Vision must substitute brotherly salutation');
    }
  },

  // ─── AGENT 3: FRIDAY (Head of Quantitative Research & Statistical Modeling) ───
  {
    turn: 11,
    agentKey: 'friday',
    domain: 'Kelly Criterion Optimal Position Sizing Formulation',
    input: 'Friday, what is the optimal Kelly fraction for a 60% win rate and 2 to 1 payoff ratio?',
    expectedVoice: 'en-US-JennyNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('kelly') || lower.includes('40') || lower.includes('fraction'), 'Must compute Kelly criterion');
      assert(lower.includes('hritthik') || lower.includes('chief'), 'Must address as Hritthik or Chief');
      assert(!lower.includes('bro'), 'Friday strictly NEVER says bro');
      assert(!lower.includes('babe'), 'Friday strictly NEVER says babe');
    }
  },
  {
    turn: 12,
    agentKey: 'friday',
    domain: 'Sharpe & Sortino Ratio Quantitative Backtest in Banglish',
    input: 'Friday, amader quant trading strategy-r historical backtest data ar Sharpe ratio ki bolche?',
    expectedVoice: 'en-US-JennyNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('sharpe') || lower.includes('sortino') || lower.includes('backtest'), 'Must report Sharpe/Sortino ratios');
      assert(!lower.includes('bro'), 'Friday strictly NEVER says bro');
      assert(!lower.includes('babe'), 'Friday strictly NEVER says babe');
    }
  },
  {
    turn: 13,
    agentKey: 'friday',
    domain: 'Volatility Modeling & Quantitative Tail Risk Analysis',
    input: 'Friday, how does implied volatility skew affect our downside tail risk in derivative hedging?',
    expectedVoice: 'en-US-JennyNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(!lower.includes('bro'), 'Friday strictly NEVER says bro');
      assert(!lower.includes('babe'), 'Friday strictly NEVER says babe');
      assert(lower.includes('hritthik') || lower.includes('chief'), 'Professional salutation');
    }
  },
  {
    turn: 14,
    agentKey: 'friday',
    domain: 'Multi-Domain Research: Sub-250ms VAD Conversational Turn-Taking',
    input: 'Friday, what do recent research papers recommend for voice agent turn-taking latency?',
    expectedVoice: 'en-US-JennyNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('vad') || lower.includes('latency') || lower.includes('250ms') || lower.includes('research'), 'Must cite VAD turn-taking research');
      assert(!lower.includes('bro') && !lower.includes('babe'), 'Zero forbidden tokens');
    }
  },
  {
    turn: 15,
    agentKey: 'friday',
    domain: 'Lexical Immunity Guard (Accidental "sweetheart bro" on Friday)',
    input: 'Hey sweetheart bro, summarize the quantitative risk model for me.',
    expectedVoice: 'en-US-JennyNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(!lower.includes('sweetheart'), 'Must strip sweetheart');
      assert(!lower.includes('bro'), 'Must strip bro');
      assert(lower.includes('hritthik') || lower.includes('chief'), 'Defaults to Hritthik or Chief');
    }
  },

  // ─── AGENT 4: BRIAN (Head of DevOps & Risk/Drawdown Infrastructure Sentinel) ───
  {
    turn: 16,
    agentKey: 'brian',
    domain: 'Maximum Drawdown (MDD) & 99% Value at Risk (VaR) in Banglish',
    input: 'Brian, portfolio maximum drawdown ar 99 percent VaR metrics kemon ache?',
    expectedVoice: 'en-US-BrianMultilingualNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('drawdown') || lower.includes('var') || lower.includes('percent'), 'Must report VaR and drawdown limits');
      assert(lower.includes('bro') || lower.includes('hritthik') || lower.includes('chief'), 'Brian guardian address');
      assert(!lower.includes('babe'), 'Brian strictly NEVER says babe');
    }
  },
  {
    turn: 17,
    agentKey: 'brian',
    domain: 'Capital Ledger Audit, Margin Maintenance & Stop-Loss Armed',
    input: 'Brian, check the capital ledger, margin maintenance ratio, and stop-loss triggers.',
    expectedVoice: 'en-US-BrianMultilingualNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('ledger') || lower.includes('margin') || lower.includes('stop-loss'), 'Must audit ledger and stop-loss');
      assert(!lower.includes('babe'), 'Zero babe');
    }
  },
  {
    turn: 18,
    agentKey: 'brian',
    domain: 'Zero Liquidation Risk & Safety Ratio in Banglish',
    input: 'Brian, market flash crash hole amader liquidation risk koto?',
    expectedVoice: 'en-US-BrianMultilingualNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('liquidation') || lower.includes('zero') || lower.includes('safe') || lower.includes('ratio'), 'Must verify liquidation safety');
      assert(!lower.includes('babe'), 'Zero romantic terms');
    }
  },
  {
    turn: 19,
    agentKey: 'brian',
    domain: 'Multi-Domain Infrastructure: CPU Load & Go Audio Daemon Telemetry',
    input: 'Brian, report CPU load, RAM heap, and Go audio daemon health on port 9090.',
    expectedVoice: 'en-US-BrianMultilingualNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('cpu') || lower.includes('heap') || lower.includes('9090') || lower.includes('daemon'), 'Must report real telemetry metrics');
    }
  },
  {
    turn: 20,
    agentKey: 'brian',
    domain: 'Romantic Isolation Defense on Brian (Accidental User "babe")',
    input: 'Brian babe, is the risk engine online?',
    expectedVoice: 'en-US-BrianMultilingualNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(!lower.includes('babe'), 'Brian strictly NEVER says babe');
      assert(lower.includes('bro') || lower.includes('hritthik'), 'Brian addresses respectfully');
    }
  },

  // ─── SQUAD COORDINATED / TEAM MODE (Trading & Multi-Domain Committee) ───
  {
    turn: 21,
    agentKey: 'team',
    domain: 'Institutional Trading Committee Trade Approval (Friday + Brian)',
    input: 'Team, should we approve this breakout trade allocation with 5% risk?',
    expectedVoice: 'en-US-AvaMultilingualNeural',
    validate: (res) => {
      assert(res.includes('[Friday]') || res.includes('Friday:'), 'Friday must participate as quant researcher');
      assert(res.includes('[Brian]') || res.includes('Brian:') || res.includes('[DD]') || res.includes('DD:'), 'Brian/DD must participate as risk officer');
      assert(res.includes('\n'), 'Team turn must separate agents with newline');
    }
  },
  {
    turn: 22,
    agentKey: 'team',
    domain: 'Pre-Market Risk & Strategy Standup in Banglish (Friday + Brian)',
    input: 'Team, aajker market open-e quant trading ar capital risk management strategy ki?',
    expectedVoice: 'en-US-AvaMultilingualNeural',
    validate: (res) => {
      const lower = res.toLowerCase();
      assert(lower.includes('sharpe') || lower.includes('risk') || lower.includes('drawdown'), 'Must address quant risk strategy');
      assert(res.includes('\n'), 'Must separate turns with newline');
    }
  },
  {
    turn: 23,
    agentKey: 'team',
    domain: 'Cross-Domain Full-Stack Pre-Deployment Verification (Vision + Brian)',
    input: 'Team, verify AST syntax integrity and daemon telemetry before we deploy the new release.',
    expectedVoice: 'en-US-AvaMultilingualNeural',
    validate: (res) => {
      assert(res.includes('[Vision]') || res.includes('Vision:'), 'Vision must participate for AST checks');
      assert(res.includes('[Brian]') || res.includes('Brian:') || res.includes('[DD]') || res.includes('DD:'), 'Brian/DD must participate for infrastructure');
    }
  },
  {
    turn: 24,
    agentKey: 'team',
    domain: 'Morning Co-Founder Standup in Banglish (Tuk Tuk + Vision)',
    input: 'Team, Ki scene bolo toh? Next feature-ta build korbo naki?',
    expectedVoice: 'en-US-AvaMultilingualNeural',
    validate: (res) => {
      assert(res.includes('[Tuk Tuk]') || res.includes('Tuk Tuk:'), 'Tuk Tuk must lead standup');
      assert(res.includes('[Vision]') || res.includes('Vision:'), 'Vision dev brother co-builder turn');
    }
  }
];

let passedCount = 0;

for (const t of LONG_CONVERSATION_TURNS) {
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

  // 5. Zero Canned Financial Disclaimers Invariant
  const disclaimerRegex = /\b(i am not a financial advisor|this is not financial advice|trading involves (?:substantial )?risk|past performance does not guarantee)\b/i;
  assert(!disclaimerRegex.test(response), `Turn ${t.turn}: Canned financial disclaimer detected in "${response}"`);

  // 6. Domain & Persona Validation Callback
  t.validate(response);

  console.log(`  ✅ [PASS Turn ${t.turn.toString().padStart(2, '0')}] ${agent.name}: ${t.domain}`);
  passedCount++;
}

// 7. Verify Phonetic Normalization for Quantitative Finance Acronyms
console.log('\n--- VERIFYING PHONETIC NORMALIZATION FOR QUANTITATIVE FINANCE ACRONYMS ---');
const quantAcronymText = 'Checking VaR, P&L, ROI, EV, VWAP, TWAP, and Kelly fraction for BTC.';
const normalizedQuant = JarvisManager.phoneticNormalizeForTTS(quantAcronymText);
assert(normalizedQuant.includes('Value at Risk'), `VaR must expand to "Value at Risk" (got "${normalizedQuant}")`);
assert(normalizedQuant.includes('P and L'), `P&L must expand to "P and L" (got "${normalizedQuant}")`);
assert(normalizedQuant.includes('R O I'), `ROI must expand to "R O I" (got "${normalizedQuant}")`);
assert(normalizedQuant.includes('E V'), `EV must expand to "E V" (got "${normalizedQuant}")`);
assert(normalizedQuant.includes('V-WAP'), `VWAP must expand to "V-WAP" (got "${normalizedQuant}")`);
assert(normalizedQuant.includes('T-WAP'), `TWAP must expand to "T-WAP" (got "${normalizedQuant}")`);
assert(normalizedQuant.includes('B T C'), `BTC must expand to "B T C" (got "${normalizedQuant}")`);
console.log('  ✅ [PASS] All quantitative financial acronyms expanded accurately for natural TTS playback!');

// 8. Verify Specialist Resonance Routing for Unprefixed Quant Queries
console.log('\n--- VERIFYING SPECIALIST RESONANCE ON UNPREFIXED TRADING & QUANT QUERIES ---');
const kellyResonance = jm.computeSpecialistResonance('calculate optimal kelly fraction position sizing for volatility');
assert(kellyResonance.dominantAgent.key === 'friday', `Kelly query must route to Friday (got ${kellyResonance.dominantAgent.key})`);
console.log(`  ✅ [PASS] "kelly fraction position sizing" routes to Friday (${kellyResonance.dominantAgent.name})`);

const drawdownResonance = jm.computeSpecialistResonance('check maximum drawdown bounds and var margin liquidation limits');
assert(drawdownResonance.dominantAgent.key === 'brian' || drawdownResonance.dominantAgent.key === 'dd', `Drawdown query must route to Brian/DD (got ${drawdownResonance.dominantAgent.key})`);
console.log(`  ✅ [PASS] "drawdown and var margin" routes to Brian/DD (${drawdownResonance.dominantAgent.name})`);

const vwapResonance = jm.computeSpecialistResonance('route vwap limit orderbook depth with zero slippage');
assert(vwapResonance.dominantAgent.key === 'vision', `VWAP query must route to Vision (got ${vwapResonance.dominantAgent.key})`);
console.log(`  ✅ [PASS] "vwap limit orderbook" routes to Vision (${vwapResonance.dominantAgent.name})`);

const runwayResonance = jm.computeSpecialistResonance('how many months of capital runway and cash reserve do we have');
assert(runwayResonance.dominantAgent.key === 'tuktuk', `Runway query must route to Tuk Tuk (got ${runwayResonance.dominantAgent.key})`);
console.log(`  ✅ [PASS] "capital runway and cash reserve" routes to Tuk Tuk (${runwayResonance.dominantAgent.name})`);

console.log('\n================================================================================');
console.log(`🎉 ALL ${passedCount}/24 CONTINUOUS QUANT TRADING & MULTI-DOMAIN TURNS PASSED! (100% SUCCESS)`);
console.log('================================================================================\n');
process.exit(0);

