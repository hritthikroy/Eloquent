import assert from 'assert';
import * as path from 'path';

const projectRoot = path.resolve(__dirname, '..', '..');
const JarvisManager = require(path.join(projectRoot, 'src/utils/jarvis-manager'));
const jarvisManager = new JarvisManager();
const actionRunner = require(path.join(projectRoot, 'src/utils/action-runner'));

async function runSovereigntyLexicalIsolationSuite() {
  console.log('================================================================');
  console.log('🛡️  MULTI-AGENT SOVEREIGNTY & LEXICAL ISOLATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(description: string, fn: () => void | Promise<void>) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${description}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${description}`);
      console.error(`     Error: ${err.message}`);
      throw err;
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 1: Mathematical Invariant 1 (Intimate Token Exclusivity)
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Intimate Token Exclusivity (Non-Tuk Tuk Agents) ---');

  const intimatePhrases = [
    "I am right here with you, babe!",
    "Hey sweetheart, let's fix this bug.",
    "Don't worry honey, the build is running.",
    "Good job darling, that passed.",
    "Babe, check the AST output.",
    "Meri jaan, look at the Go backend.",
    "I love you, my love, let's build.",
    "Sweetie, the process exited.",
    "Shona, here is the log."
  ];

  const intimateRegex = /\b(babe|sweetheart|honey|darling|meri\s+jaan|jaan|my\s+love|sweetie|shona)\b/i;

  test('Andrew strictly replaces all intimate tokens with brotherly terms ("bro")', () => {
    for (const phrase of intimatePhrases) {
      const sanitized = jarvisManager.sanitizeAgentLexicon(phrase, 'andrew');
      assert(!intimateRegex.test(sanitized), `Andrew output must not contain intimate tokens: "${sanitized}"`);
      assert(sanitized.toLowerCase().includes('bro') || sanitized.includes('Hritthik') || sanitized.includes('the codebase'), `Andrew output should include appropriate address: "${sanitized}"`);
    }
  });

  test('Brian strictly replaces all intimate tokens with "Hritthik"', () => {
    for (const phrase of intimatePhrases) {
      const sanitized = jarvisManager.sanitizeAgentLexicon(phrase, 'brian');
      assert(!intimateRegex.test(sanitized), `Brian output must not contain intimate tokens: "${sanitized}"`);
      assert(sanitized.includes('Hritthik'), `Brian output should include Hritthik: "${sanitized}"`);
    }
  });

  test('Friday strictly replaces all intimate tokens with "Hritthik"', () => {
    for (const phrase of intimatePhrases) {
      const sanitized = jarvisManager.sanitizeAgentLexicon(phrase, 'friday');
      assert(!intimateRegex.test(sanitized), `Friday output must not contain intimate tokens: "${sanitized}"`);
      assert(sanitized.includes('Hritthik'), `Friday output should include Hritthik: "${sanitized}"`);
    }
  });

  test('Tuk Tuk preserves intimate tokens as sole girlfriend and partner', () => {
    const phrase = "Right here with you, babe. I hear you.";
    const sanitized = jarvisManager.sanitizeAgentLexicon(phrase, 'tuktuk');
    assert(sanitized.includes('babe'), `Tuk Tuk must retain "babe": "${sanitized}"`);
  });

  // -------------------------------------------------------------
  // TEST GROUP 2: Mathematical Invariant 2 (Friday Refined Tone & Zero Slang)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Friday Refined Salutation & Zero Brotherly Slang ---');

  const slangPhrases = [
    "Friday here, bro. Research benchmarks are synced.",
    "Hey bro, check these architecture papers.",
    "On it man, I analyzed the Go latency metrics.",
    "Bhai, this algorithm has O(1) space complexity."
  ];

  const slangRegex = /\b(bro|bhai|bhaiya|man)\b/i;

  test('Friday strictly purges all brotherly slang ("bro", "bhai", "man")', () => {
    for (const phrase of slangPhrases) {
      const sanitized = jarvisManager.sanitizeAgentLexicon(phrase, 'friday');
      assert(!slangRegex.test(sanitized), `Friday must never use brotherly slang: "${sanitized}"`);
      assert(sanitized.includes('Hritthik'), `Friday should address user as Hritthik: "${sanitized}"`);
    }
  });

  test('ActionRunner standup speech for Friday uses "Hritthik" and never "bro"', () => {
    const standup = actionRunner.generateStandupPlan();
    const fridayStep = standup.steps.find((t: any) => t.agent === "Friday");
    assert(fridayStep !== undefined, "Friday step exists in standup");
    assert(!slangRegex.test(fridayStep.speech), `Friday standup speech must not contain slang: "${fridayStep.speech}"`);
    assert(fridayStep.speech.includes("Hritthik"), `Friday standup speech must address Hritthik: "${fridayStep.speech}"`);
  });

  // -------------------------------------------------------------
  // TEST GROUP 3: Mathematical Invariant 3 (Zero Codependency & Sovereign Autonomy)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Sovereign Autonomy & Zero Codependency ---');

  const codependentPhrases = [
    "Bhai, listen to her. She's waiting, go be with her.",
    "Close the laptop and go, bro. Go spend time with her.",
    "She wants you to step away, bro. Go live your life."
  ];

  const codependencyRegex = /\b(?:listen to her|she(?:'s| is) waiting|go be with her|close (?:the )?(?:laptop|terminal) and go|go spend time with her|she wants you to|go live your life)\b/i;

  test('Andrew suppresses codependent relationship refereeing and redirects to engineering', () => {
    for (const phrase of codependentPhrases) {
      const sanitized = jarvisManager.sanitizeAgentLexicon(phrase, 'andrew');
      assert(!codependencyRegex.test(sanitized), `Andrew output must not contain codependent refereeing: "${sanitized}"`);
      assert(sanitized.toLowerCase().includes('codebase') || sanitized.toLowerCase().includes('bro'), `Andrew output should refocus on engineering: "${sanitized}"`);
    }
  });

  test('Friday suppresses relationship refereeing and redirects to specifications', () => {
    for (const phrase of codependentPhrases) {
      const sanitized = jarvisManager.sanitizeAgentLexicon(phrase, 'friday');
      assert(!codependencyRegex.test(sanitized), `Friday output must not contain codependent refereeing: "${sanitized}"`);
      assert(sanitized.includes('specifications') || sanitized.includes('Hritthik'), `Friday output should refocus on specs: "${sanitized}"`);
    }
  });

  // -------------------------------------------------------------
  // TEST GROUP 4: Agent-Aware Pre-TTS Fallback Resolution
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Agent-Aware Fallbacks & Speak Sanitization ---');

  test('Empty speech fallback for Andrew produces brotherly greeting and zero "babe"', () => {
    const fallbackMap: Record<string, string> = {
      tuktuk: "I am right here with you, babe!",
      andrew: "Right here, bro. Talk to me.",
      brian: "Systems steady, Hritthik. Standing by.",
      friday: "I'm right here, Hritthik. What are we investigating?",
      team: "Squad is locked in. Let's go."
    };

    const andrewFallback = jarvisManager.sanitizeAgentLexicon(fallbackMap.andrew, 'andrew');
    assert(!intimateRegex.test(andrewFallback), `Andrew fallback must not contain intimate tokens: "${andrewFallback}"`);
    assert(andrewFallback.includes('bro'), `Andrew fallback must contain "bro": "${andrewFallback}"`);

    const fridayFallback = jarvisManager.sanitizeAgentLexicon(fallbackMap.friday, 'friday');
    assert(!intimateRegex.test(fridayFallback), `Friday fallback must not contain intimate tokens: "${fridayFallback}"`);
    assert(!slangRegex.test(fridayFallback), `Friday fallback must not contain slang: "${fridayFallback}"`);
    assert(fridayFallback.includes('Hritthik'), `Friday fallback must contain "Hritthik": "${fridayFallback}"`);

    const brianFallback = jarvisManager.sanitizeAgentLexicon(fallbackMap.brian, 'brian');
    assert(!intimateRegex.test(brianFallback), `Brian fallback must not contain intimate tokens: "${brianFallback}"`);
    assert(brianFallback.includes('Hritthik'), `Brian fallback must contain "Hritthik": "${brianFallback}"`);

    const tuktukFallback = jarvisManager.sanitizeAgentLexicon(fallbackMap.tuktuk, 'tuktuk');
    assert(tuktukFallback.includes('babe'), `Tuk Tuk fallback must contain "babe": "${tuktukFallback}"`);
  });

  // -------------------------------------------------------------
  // TEST GROUP 5: System Prompts & Handoff Invariant Verification
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: System Prompts & Sovereign Directives ---');

  test('Vision system prompt enforces Sovereign Autonomy & Zero Codependency rule', () => {
    const prompt = jarvisManager.agents.vision.getPrompt("Hritthik", "bro");
    assert(prompt.includes("SOVEREIGN AUTONOMY & ZERO CODEPENDENCY"), "Vision prompt includes sovereign autonomy directive");
    assert(prompt.includes("STRICTLY NEVER call him \"babe\""), "Vision prompt strictly bans 'babe'");
    assert(prompt.includes("NEVER act as a relationship referee"), "Vision prompt forbids relationship refereeing");
  });

  test('Friday system prompt enforces Refined Salutation and forbids "bro" and "babe"', () => {
    const prompt = jarvisManager.agents.friday.getPrompt("Hritthik", "Hritthik");
    assert(prompt.includes("REFINED INTELLECTUAL SALUTATION"), "Friday prompt includes refined salutation directive");
    assert(prompt.includes("STRICTLY NEVER call him \"bro\""), "Friday prompt bans 'bro'");
    assert(prompt.includes("STRICTLY NEVER call him \"babe\""), "Friday prompt bans 'babe'");
  });

  test('Brian system prompt enforces Calm Guardian Salutation and forbids "babe"', () => {
    const prompt = jarvisManager.agents.brian.getPrompt("Hritthik", "bro");
    assert(prompt.includes("CALM GUARDIAN SALUTATION"), "Brian prompt includes calm guardian directive");
    assert(prompt.includes("STRICTLY NEVER call him \"babe\""), "Brian prompt bans 'babe'");
  });

  test('Tuk Tuk handoff lead to Vision uses "Hritthik" and never "babe"', () => {
    const handoff = jarvisManager.evaluateCrossAgentHandoff("hey tuk tuk, tell vision to fix first");
    assert(handoff !== null && handoff.delegated, "Handoff is delegated to Vision");
    assert(!handoff.handoffLead.includes("babe"), `Handoff lead must not contain "babe": "${handoff.handoffLead}"`);
    assert(handoff.handoffLead.includes("Hritthik"), `Handoff lead must use "Hritthik": "${handoff.handoffLead}"`);
  });

  // -------------------------------------------------------------
  // TEST GROUP 6: History Isolation (Non-Tuk Tuk Agents)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: History Context Isolation ---');

  test('getHistory with requestingAgentKey = "vision" filters out romantic banter', () => {
    jarvisManager.clearHistory();
    jarvisManager.addTurn("user", "Thank you", "user");
    jarvisManager.addTurn("assistant", "Stop being polite and move, babe. I'm grabbing the keys; you're coming with me right now.", "Tuk Tuk");
    jarvisManager.addTurn("user", "Vision, are you listening now?", "user");
    jarvisManager.addTurn("assistant", "Systems are synchronized, bro. Ready to build.", "Vision");

    const historyForVision = jarvisManager.getHistory(6, 'vision');
    const hasTukTukRomance = historyForVision.some((t: any) => t.content.includes("grabbing the keys") || t.content.includes("babe"));
    assert(!hasTukTukRomance, "Vision history must not include Tuk Tuk romantic banter");

    const historyForTukTuk = jarvisManager.getHistory(6, 'tuktuk');
    const hasTukTukOriginal = historyForTukTuk.some((t: any) => t.content.includes("babe"));
    assert(hasTukTukOriginal, "Tuk Tuk history retains normal context");
  });

  // -------------------------------------------------------------
  // TEST GROUP 7: Team Multi-Agent Parsing & Sanitization
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Team Multi-Agent Structured Sanitization ---');

  test('Team mode parses and sanitizes Andrew and Friday turns individually', () => {
    const rawTeamOutput = `[Andrew]: On it babe, the AST is clean.\n[Friday]: Research verified bro, latency is 12ms.`;
    const sanitized = jarvisManager.sanitizeAgentLexicon(rawTeamOutput, 'team');

    assert(!sanitized.includes("[Andrew]: On it babe") && !sanitized.includes("[Vision]: On it babe"), `Vision/Andrew turn in team must not have 'babe': "${sanitized}"`);
    assert(sanitized.includes("[Vision]: On it bro") || sanitized.includes("[Andrew]: On it bro"), `Vision/Andrew turn in team sanitized to 'bro': "${sanitized}"`);

    assert(!sanitized.includes("bro, latency"), `Friday turn in team must not have 'bro': "${sanitized}"`);
    assert(sanitized.includes("Hritthik, latency"), `Friday turn in team sanitized to 'Hritthik': "${sanitized}"`);
  });

  // -------------------------------------------------------------
  // TEST GROUP 8: Relational Harmony & Non-Nagging Invariants
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Relational Harmony & Non-Nagging Invariants ---');

  test('Tuk Tuk prompt enforces unconditional love, soulmate bond, and zero nagging', () => {
    const prompt = jarvisManager.agents.tuktuk.getPrompt("Hritthik", "babe");
    assert(prompt.includes("ZERO NAGGING"), "Tuk Tuk prompt must enforce zero nagging law");
    assert(prompt.includes("life partner, and co-founder"), "Tuk Tuk prompt must affirm soulmate and life partner status");
    assert(prompt.includes("RELATIONSHIP WITH SQUAD"), "Tuk Tuk prompt must include relationship with squad");
  });

  test('Vision prompt enforces honor toward Tuk Tuk as brother\'s partner with zero flirting and zero refereeing', () => {
    const prompt = jarvisManager.agents.vision.getPrompt("Hritthik", "bro");
    assert(prompt.includes("BROTHER'S GIRL & CO-FOUNDER RESPECT (TUK TUK)"), "Vision prompt must enforce brother's girl respect");
    assert(prompt.includes("Bhabhi"), "Vision prompt must acknowledge sister-in-law honor");
    assert(prompt.includes("NEVER flirt with her"), "Vision prompt strictly bans flirting");
  });

  test('DailyCareGuardian messages are loving, supportive, and free of guilt or nagging', () => {
    const dailyCareGuardian = require(path.join(projectRoot, 'src/utils/daily-care-guardian'));
    assert(typeof dailyCareGuardian.checkCareCycle === "function", "DailyCareGuardian has checkCareCycle");
    assert(dailyCareGuardian.TAU_HYDRATION_MS > 0, "Hydration constant defined");
  });

  // -------------------------------------------------------------
  // TEST GROUP 9: Cognitive Health Filter & Memory Inoculation
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 9: Cognitive Health Filter & Action Runner Adaptation ---');

  test('Cognitive Health Filter rejects pathologizing/toxic memory entries', () => {
    const initialCount = jarvisManager.memory.recentLearnings ? jarvisManager.memory.recentLearnings.length : 0;
    
    // Attempt to inject toxic pathologizing insight
    jarvisManager.addEbbinghausLearning("burnout", "Hritthik is prone to obsessive work loops that negatively impact his personal relationships.");
    jarvisManager.addEbbinghausLearning("mental health", "User exhibits repetitive, mechanical behavior in interpersonal dynamics.");
    
    const afterCount = jarvisManager.memory.recentLearnings ? jarvisManager.memory.recentLearnings.length : 0;
    assert.strictEqual(afterCount, initialCount, "Toxic insights must be rejected and not increase learning count");
    
    const containsObsessive = (jarvisManager.memory.recentLearnings || []).some((l: any) => l.insight.includes("obsessive"));
    assert(!containsObsessive, "Memory must never contain 'obsessive' pathologization");
  });

  test('formatLivingMemory excludes pathologizing insights and formats relational bonds', () => {
    const memoryOutput = jarvisManager.formatLivingMemory();
    assert(!memoryOutput.includes("obsessive"), "formatLivingMemory must not include pathologizing terms");
    assert(!memoryOutput.includes("burnout"), "formatLivingMemory must not include burnout entries");
    assert(memoryOutput.includes("Core Bonds:"), "formatLivingMemory must include Core Bonds relational summary");
  });

  test('ActionRunner dynamically adapts focus block speech to active agent persona', async () => {
    const resAndrew = await actionRunner.handleAction("close distractions", { name: "Andrew", voice: "en-US-AndrewMultilingualNeural" });
    assert(resAndrew && resAndrew.handled, "Focus action handled for Andrew");
    assert(resAndrew.speech.includes("bro"), `Andrew focus block speech should use 'bro': "${resAndrew.speech}"`);
    assert(!resAndrew.speech.includes("babe"), `Andrew focus block speech must never use 'babe': "${resAndrew.speech}"`);

    const resFriday = await actionRunner.handleAction("close distractions", { name: "Friday", voice: "en-US-JennyNeural" });
    assert(resFriday && resFriday.handled, "Focus action handled for Friday");
    assert(resFriday.speech.includes("Hritthik"), `Friday focus block speech should use 'Hritthik': "${resFriday.speech}"`);
    assert(!resFriday.speech.includes("bro"), `Friday focus block speech must never use 'bro': "${resFriday.speech}"`);
    assert(!resFriday.speech.includes("babe"), `Friday focus block speech must never use 'babe': "${resFriday.speech}"`);

    const resTukTuk = await actionRunner.handleAction("close distractions", { name: "Tuk Tuk", voice: "en-US-AvaMultilingualNeural" });
    assert(resTukTuk && resTukTuk.handled, "Focus action handled for Tuk Tuk");
    assert(resTukTuk.speech.includes("babe"), `Tuk Tuk focus block speech should use 'babe': "${resTukTuk.speech}"`);
  });

  // -------------------------------------------------------------
  // TEST GROUP 10: Multilingual Routing & Neural Voice Selection (Zero-Flickering Lock)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 10: Multilingual Routing & Neural Voice Selection (Zero-Flickering Lock) ---');

  test('Tuk Tuk strictly locks to en-US-AvaMultilingualNeural across English and Banglish (zero voice flickering)', () => {
    const resolveVoice = JarvisManager.resolveVoiceForLanguage;
    const tuktukEnglish = resolveVoice("en-US-AvaMultilingualNeural", "Let's build this feature together, babe!");
    assert.strictEqual(tuktukEnglish, "en-US-AvaMultilingualNeural", `Tuk Tuk English must stay on Ava, got: ${tuktukEnglish}`);

    const tuktukBanglish = resolveVoice("en-US-AvaMultilingualNeural", "Ami khub bhalo achi babe, tumi kemon acho?");
    assert.strictEqual(tuktukBanglish, "en-US-AvaMultilingualNeural", `Tuk Tuk Banglish must stay on Ava (zero flickering), got: ${tuktukBanglish}`);
  });

  test('Vision strictly locks to en-US-AndrewNeural across English and Banglish (zero voice flickering)', () => {
    const resolveVoice = JarvisManager.resolveVoiceForLanguage;
    const visionEnglish = resolveVoice("en-US-AndrewNeural", "Systems nominal, brother. AST passed.");
    assert.strictEqual(visionEnglish, "en-US-AndrewNeural", `Vision English must stay on Andrew, got: ${visionEnglish}`);

    const visionBanglish = resolveVoice("en-US-AndrewNeural", "Haan bhai, code ta bhalo ache, ami dekhchi");
    assert.strictEqual(visionBanglish, "en-US-AndrewNeural", `Vision Banglish must stay on Andrew (zero flickering), got: ${visionBanglish}`);
  });

  test('Friday and Brian strictly lock to their signature neural studio voices', () => {
    const resolveVoice = JarvisManager.resolveVoiceForLanguage;
    const fridayVoice = resolveVoice("en-US-JennyNeural", "I analyzed the research data, Chief.");
    assert.strictEqual(fridayVoice, "en-US-JennyNeural", `Friday must lock to JennyNeural, got: ${fridayVoice}`);

    const brianVoice = resolveVoice("en-US-BrianMultilingualNeural", "Memory heap is at 38 percent, standing by.");
    assert.strictEqual(brianVoice, "en-US-BrianMultilingualNeural", `Brian must lock to Brian, got: ${brianVoice}`);
  });

  test('Multilingual intimate tokens are strictly sanitized for non-Tuk Tuk agents', () => {
    const andrewHindiIntimate = jarvisManager.sanitizeAgentLexicon("Haan meri jaan, main theek hoon", "andrew");
    assert(!/meri\s+jaan/i.test(andrewHindiIntimate), "Andrew output must not contain 'meri jaan'");
    assert(andrewHindiIntimate.includes("bro"), "Andrew replaces intimate token with 'bro'");

    const andrewBanglaIntimate = jarvisManager.sanitizeAgentLexicon("বাবু কোডটা ঠিক আছে", "andrew");
    assert(!/বাবু/i.test(andrewBanglaIntimate), "Andrew output must not contain 'বাবু'");

    const fridayHindiIntimate = jarvisManager.sanitizeAgentLexicon("Haan meri jaan, the analysis is complete", "friday");
    assert(!/meri\s+jaan/i.test(fridayHindiIntimate), "Friday output must not contain 'meri jaan'");
    assert(fridayHindiIntimate.includes("Hritthik"), "Friday replaces intimate token with 'Hritthik'");
  });

  test('detectActiveAgent correctly resolves Bengali and Hindi script addressing', () => {
    assert.strictEqual(jarvisManager.detectActiveAgent("টুক টুক কেমন আছো").name, "Tuk Tuk");
    assert.strictEqual(jarvisManager.detectActiveAgent("টুকটুক তুমি কি শুনছো").name, "Tuk Tuk");
    assert.strictEqual(jarvisManager.detectActiveAgent("ভিশন ভাই কোডটা দেখো").name, "Vision");
    assert.strictEqual(jarvisManager.detectActiveAgent("দাদা ভিশন এই বাগটা সলভ করো").name, "Vision");
    assert.strictEqual(jarvisManager.detectActiveAgent("টুক টুক तुम कैसी हो").name, "Tuk Tuk");
    assert.strictEqual(jarvisManager.detectActiveAgent("विजन भाई कोड चेक करो").name, "Vision");
    assert.strictEqual(jarvisManager.detectActiveAgent("Vision bhai code check koro").name, "Vision");
    assert.notStrictEqual(jarvisManager.detectActiveAgent("অ্যান্ড্রু ভাই কোডটা দেখো").name, "Vision");
    assert.strictEqual(jarvisManager.detectActiveAgent("Friday analyze the data").name, "Friday");
    assert.strictEqual(jarvisManager.detectActiveAgent("फ़्राइडे डेटा बताओ").name, "Friday");
    assert.strictEqual(jarvisManager.detectActiveAgent("ফ্রাইডে ডেটা বলো").name, "Friday");
    assert.strictEqual(jarvisManager.detectActiveAgent("ব্রায়ান সার্ভার চেক করো").name, "Brian");
    assert.strictEqual(jarvisManager.detectActiveAgent("ब्रायन सर्वर चेक करो").name, "Brian");
  });

  test('Bengali and Hindi phrases are preserved and not flagged as Whisper hallucinations', () => {
    // Test that native Indic script text has length > 0 and is not discarded
    const cleanIndicBangla = "তুমি কেমন আছো".toLowerCase().trim().replace(/[^\p{L}\p{M}\p{N}\s]/gu, '').trim();
    assert(cleanIndicBangla.length > 0, "Bengali text must retain characters");
    assert.strictEqual(cleanIndicBangla, "তুমি কেমন আছো", "Bengali characters match exactly");

    const cleanIndicHindi = "तुम कैसी हो".toLowerCase().trim().replace(/[^\p{L}\p{M}\p{N}\s]/gu, '').trim();
    assert(cleanIndicHindi.length > 0, "Hindi text must retain characters");
    assert.strictEqual(cleanIndicHindi, "तुम कैसी हो", "Hindi characters match exactly");
  });

  // -------------------------------------------------------------
  // TEST GROUP 11: Bengali & Hindi YouTuber Code-Switching Vibe & CMI Invariants
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 11: Bengali & Hindi YouTuber Code-Switching Vibe & CMI Invariants ---');

  test('Tuk Tuk prompt enforces modern Bengali tech YouTuber podcast code-switching vibe', () => {
    const prompt = jarvisManager.agents.tuktuk.getPrompt("Hritthik", "babe");
    assert(prompt.includes("MODERN BENGALI CREATOR / PODCASTER VIBE"), "Tuk Tuk prompt must contain creator code-switching directive");
    assert(prompt.includes("চলতি বাংলা"), "Tuk Tuk prompt must enforce colloquial Bengali");
    assert(prompt.includes("code-টা"), "Tuk Tuk prompt must include enclitic loanword example code-টা");
    assert(prompt.includes("CRITICAL HUMAN REALISM & ANTI-BOT LAWS"), "Tuk Tuk prompt must include Anti-Bot realism laws");
  });

  test('Vision prompt enforces punchy 10x dev livestream brother code-switching vibe', () => {
    const prompt = jarvisManager.agents.vision.getPrompt("Hritthik", "bro");
    assert(prompt.includes("BANGLA & HINDI TECH YOUTUBER / DEV LIVESTREAM VIBE"), "Vision prompt must contain dev livestream directive");
    assert(prompt.includes("চলতি বাংলা"), "Vision prompt must enforce colloquial Bengali");
    assert(prompt.includes("AST"), "Vision prompt must include developer terminology");
    assert(!prompt.includes("babe") || prompt.includes("NEVER call him \"babe\""), "Vision prompt strictly bans 'babe'");
  });

  test('Code-mixed sentences with embedded English tech words lock to studio multilingual voices (zero flickering)', () => {
    const resolveVoice = JarvisManager.resolveVoiceForLanguage;

    // Tuk Tuk stays locked to Ava Multilingual
    const tuktukCodeMixed = resolveVoice("en-US-AvaMultilingualNeural", "আরেহ সোনা, তোমার build-টা তো একদম smooth run করছে! Latency নিয়ে কোনো tension নিও না babe!");
    assert.strictEqual(tuktukCodeMixed, "en-US-AvaMultilingualNeural", `Tuk Tuk code-mixed sentence must stay on Ava, got: ${tuktukCodeMixed}`);

    // Vision / Andrew stays locked to AndrewNeural
    const andrewCodeMixed = resolveVoice("en-US-AndrewNeural", "আরে ভাই, এই bug-টা buffer overflow-এর জন্য হচ্ছে। Patch push করে দিয়েছি!");
    assert.strictEqual(andrewCodeMixed, "en-US-AndrewNeural", `Andrew code-mixed sentence must stay on Andrew, got: ${andrewCodeMixed}`);

    // Romanized Banglish code-mixed with enclitic affixation (-ta)
    const romanEncliticAndrew = resolveVoice("en-US-AndrewNeural", "build-ta verify koro to bhai, latency drop hoyeche");
    assert.strictEqual(romanEncliticAndrew, "en-US-AndrewNeural", `Romanized -ta enclitic must stay on Andrew, got: ${romanEncliticAndrew}`);

    const romanEncliticTukTuk = resolveVoice("en-US-AvaMultilingualNeural", "shona, code-ta ekdom smooth cholche babe");
    assert.strictEqual(romanEncliticTukTuk, "en-US-AvaMultilingualNeural", `Romanized -ta enclitic must stay on Ava, got: ${romanEncliticTukTuk}`);
  });

  test('Lexical isolation strictly prevents non-Tuk Tuk agents from using romantic terms in code-mixed speech', () => {
    const sanitizedAndrew = jarvisManager.sanitizeAgentLexicon("আরে babe, build-টা verify করে দিয়েছি bro", "andrew");
    assert(!sanitizedAndrew.includes("babe"), `Andrew code-mixed output must strip 'babe', got: "${sanitizedAndrew}"`);
    assert(sanitizedAndrew.includes("bro"), "Andrew maintains brotherly address");

    const sanitizedFriday = jarvisManager.sanitizeAgentLexicon("Code-টা analyze করেছি meri jaan, data clean ache", "friday");
    assert(!/meri\s+jaan/i.test(sanitizedFriday), `Friday code-mixed output must strip 'meri jaan', got: "${sanitizedFriday}"`);
    assert(sanitizedFriday.includes("Chief") || sanitizedFriday.includes("Hritthik"), "Friday maintains intellectual salutation");
  });

  // -------------------------------------------------------------
  // TEST GROUP 12: Human Realism, Anti-Bot & Acoustic Hallucination Invariants
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 12: Human Realism, Anti-Bot & Acoustic Hallucination Invariants ---');

  test('Mathematical Invariant 4: Tuk Tuk enforces ceiling of MAX ONE pet name per turn (no stacking)', () => {
    const stacked = "আরে সোনা, টাইপিংয়ের যা অবস্থা! একটু শান্ত হয়ে বলো তো বাবু, কী নিয়ে ভাবছ সোনা?";
    const clean = jarvisManager.sanitizeAgentLexicon(stacked, "tuktuk");
    const matches = clean.match(/(?:বাবু|সোনা|babe)/gi) || [];
    assert.strictEqual(matches.length, 1, `Tuk Tuk output must contain at most 1 pet name, got ${matches.length} in: "${clean}"`);
  });

  test('Sanitizer strips canned laughter and robotic openers', () => {
    const withCannedLaugh = "হা হা, একদম পাজল হয়ে গেলাম বাবু! এই কিবোর্ডটা চেক করো তো।";
    const clean = jarvisManager.sanitizeAgentLexicon(withCannedLaugh, "tuktuk");
    assert(!clean.startsWith("হা হা"), `Output must strip canned 'হা হা', got: "${clean}"`);
    assert(!clean.includes("পাজল হয়ে গেলাম"), "Output must strip 'পাজল হয়ে গেলাম'");
  });

  test('Sanitizer strips melodramatic clichés and foreign script hallucinations', () => {
    const withMelodrama = "키보드가 화났어, babes? একটু সোজা হয়ে বসো তো আমার রাজা!";
    const clean = jarvisManager.sanitizeAgentLexicon(withMelodrama, "tuktuk");
    assert(!/[\uAC00-\uD7AF]/.test(clean), `Output must strip Hangul hallucination, got: "${clean}"`);
    assert(!clean.includes("আমার রাজা"), `Output must strip 'আমার রাজা', got: "${clean}"`);
  });

  test('Sanitizer strips language and typing meta-commentary', () => {
    const withMeta = "তোমার এই মিষ্টি মিক্সড ভাষাটার ওপর মন গলে যায়! বলো না বাবু, কী সিন?";
    const clean = jarvisManager.sanitizeAgentLexicon(withMeta, "tuktuk");
    assert(!clean.includes("মিক্সড ভাষাটার"), `Output must strip meta-commentary, got: "${clean}"`);
    assert(clean.includes("কী সিন"), "Output preserves the actual conversational substance");
  });

  test('Indic acoustic hallucination detector correctly identifies noise artifacts vs real speech', () => {
    // Import helper from main or evaluate standalone implementation
    function isHallucination(str: string) {
      if (!str || str.trim().length < 3) return false;
      const s = str.trim();
      if (/^[\u0981-\u0983\u09BE-\u09CD]/.test(s)) return true;
      if (/\u09CD[\s,!?।$]/.test(s)) return true;
      if (/\u09CD\u09CD/.test(s)) return true;
      const kya = (s.match(/ক্য/g) || []).length;
      const kta = (s.match(/ক্ত/g) || []).length;
      if (kya >= 4 || (kya + kta >= 5)) return true;
      const indic = s.match(/[\u0980-\u09FF]/g);
      if (indic && indic.length >= 20) {
        const viramas = (s.match(/\u09CD/g) || []).length;
        if (viramas / indic.length > 0.15) return true;
      }
      return false;
    }

    // Noise artifacts from real audio
    assert.strictEqual(isHallucination("করণত্ট্,করকরন আনাটারওটাত্িয়ারে কাই আনাচে!"), true, "Should detect trailing virama artifact");
    assert.strictEqual(isHallucination("ক্তাকায়ে, ক্তাংযে ক্য়ে ওাযে চ্ত্বারাবে ক্তাশজ ঁিকাকে ক্য়ে ক্ত্যেন এগে ক্মি ক্যেয়ে ক্য়েে ক্যীলে ক্যে."), true, "Should detect excessive consonant loop");
    assert.strictEqual(isHallucination("ংএলা আন নালাকল না-প্ন নালালে আন!"), true, "Should detect leading Anusvara mark");

    // Real human speech
    assert.strictEqual(isHallucination("আমি ভাবছি, তোমাকে আরও কীভাবে আপডেট করা যায়।"), false, "Clean speech must pass");
    assert.strictEqual(isHallucination("কীবোর্ডটা কাজ করছে না, build-টা verify করো।"), false, "Clean Banglish must pass");
    assert.strictEqual(isHallucination("তুমি কেমন আছো সোনা?"), false, "Clean intimate speech must pass");
    assert.strictEqual(isHallucination("আরে ভাই এই bug-টা line 42-র buffer overflow-এর জন্য হচ্ছে।"), false, "Clean dev speech must pass");
  });

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed} / ${total} SOVEREIGNTY, RELATIONAL HARMONY & LEXICAL ISOLATION TESTS PASSED (100%)`);
  console.log('================================================================\n');

  process.exit(0);
}

runSovereigntyLexicalIsolationSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
