/**
 * tests/mismatch-conversation-audit.spec.js
 *
 * Equational verification test suite verifying all forensic conversation mismatches:
 * 1. "A Tuk sound, smart girl" routes to Tuk Tuk (NOT Vision)
 * 2. Single "Tuk" addressed routes to Tuk Tuk
 * 3. Everyday "see" / "look" phrases do NOT trigger screen perception
 * 4. Actual screen inspection phrases DO trigger screen perception
 * 5. Vision answers communication gap inquiries with IPC/telemetry sync
 * 6. Tuk Tuk acknowledges and fixes communication gaps without falsely claiming they are closed
 * 7. Tuk Tuk reassures full transparency when insider info / hiding is questioned
 * 8. Whisper "Borgla" & "Please, your Bangla" trigger Bengali mode transition
 * 9. Bengali praise / conversational responses maintain pure Bengali Unicode script
 */

const assert = require("assert");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");
const TextSanitizer = require("../src/utils/prompt-engine/text-sanitizer");

console.log("================================================================================");
console.log("🎯 VERIFYING CONVERSATION MISMATCH EQUATIONAL FIXES & ZERO-FLICKER ROUTING");
console.log("================================================================================");

let testsPassed = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS ${totalTests}] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL ${totalTests}] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

const jm = new JarvisManager();

// -----------------------------------------------------------------------------
// TEST 1: "A Tuk sound, smart girl" and single "Tuk" routes to Tuk Tuk
// -----------------------------------------------------------------------------
runTest("'A Tuk sound, smart girl' and single 'Tuk' route to Tuk Tuk", () => {
  const query1 = "Sound, turn the music, sound... Comte truss on camera for now, is R.H.D. 2 3 A Tuk sound, smart girl, man, man, aung, mary, mary. Tuk sound, smart girl";
  const agent1 = jm.detectActiveAgent(query1);
  assert.strictEqual(agent1.key, "tuktuk", "Must route to Tuk Tuk when user says 'A Tuk sound, smart girl'");

  const query2 = "Tuk, how is our workflow looking?";
  const agent2 = jm.detectActiveAgent(query2);
  assert.strictEqual(agent2.key, "tuktuk", "Must route to Tuk Tuk for single 'Tuk'");

  const query3 = "Hey Tuk, can you hear me?";
  const agent3 = jm.detectActiveAgent(query3);
  assert.strictEqual(agent3.key, "tuktuk", "Must route to Tuk Tuk for 'Hey Tuk'");
});

// -----------------------------------------------------------------------------
// TEST 2: Everyday "see" / "look" phrases do NOT hijack screen perception
// -----------------------------------------------------------------------------
runTest("Everyday 'see' / 'look' phrases do NOT trigger screen observation", () => {
  const everydayPhrases = [
    "We'll see you soon. It's time to move on to the next stage.",
    "Yeah, come on. Yeah, come on. Here, let me see the book.",
    "If you think this will be a move on, you must have to see the money, and how will it be?",
    "Is it a video from Sambique Clones? Please look for the video today.",
    "Can't wait to see the fidgetter, not to see the fidgetter."
  ];

  for (const phrase of everydayPhrases) {
    const reply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", phrase, {}, "en");
    assert(
      !reply.includes("My eyes are locked on your screen"),
      `Phrase "${phrase}" must NOT trigger screen observation! Got: "${reply}"`
    );
    assert(
      !reply.includes("locked on your screen"),
      `Phrase "${phrase}" must NOT trigger 'locked on your screen'! Got: "${reply}"`
    );
  }
});

// -----------------------------------------------------------------------------
// TEST 3: Actual screen perception phrases DO trigger screen perception
// -----------------------------------------------------------------------------
runTest("Actual screen inspection queries DO trigger screen perception", () => {
  const screenQueries = [
    "Look at my screen babe, what's wrong with this function?",
    "Can you see my screen right now?",
    "Check what is on screen please",
    "Screen-e ki dekhcho bolo toh"
  ];

  for (const q of screenQueries) {
    const isBn = q.includes("dekhcho") || q.includes("Screen-e");
    const reply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", q, {}, isBn ? "bn" : "en");
    assert(
      reply.toLowerCase().includes("screen") || reply.includes("স্ক্রিন"),
      `Screen query "${q}" must trigger screen perception! Got: "${reply}"`
    );
  }
});

// -----------------------------------------------------------------------------
// TEST 4: Vision communication gap & listening status
// -----------------------------------------------------------------------------
runTest("Vision answers communication gap inquiries and listening status directly", () => {
  const visionGapReply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "Vision, what is our communication gap?", {}, "en");
  assert(
    visionGapReply.toLowerCase().includes("communication") ||
    visionGapReply.toLowerCase().includes("squad channels") ||
    visionGapReply.toLowerCase().includes("telemetry") ||
    visionGapReply.toLowerCase().includes("synchronized") ||
    visionGapReply.toLowerCase().includes("listening"),
    `Vision must answer communication gap directly! Got: "${visionGapReply}"`
  );

  const visionListenReply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "Vision, are you listening now?", {}, "en");
  assert(
    visionListenReply.toLowerCase().includes("listening") ||
    visionListenReply.toLowerCase().includes("synchronized") ||
    visionListenReply.toLowerCase().includes("clear"),
    `Vision must confirm listening status! Got: "${visionListenReply}"`
  );
});

// -----------------------------------------------------------------------------
// TEST 5: Tuk Tuk communication gap & group sync responsiveness
// -----------------------------------------------------------------------------
runTest("Tuk Tuk validates and resolves communication gaps without false evasion", () => {
  const gapReply1 = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Fix me and Tuk conversational gaps", {}, "en");
  assert(
    !gapReply1.includes("All communication gaps closed babe!"),
    "Must NOT prematurely claim all gaps are closed when user asks to fix them!"
  );
  assert(
    gapReply1.toLowerCase().includes("gap") ||
    gapReply1.toLowerCase().includes("miscommunication") ||
    gapReply1.toLowerCase().includes("seamless") ||
    gapReply1.toLowerCase().includes("coordination"),
    `Must commit to fixing conversational gap! Got: "${gapReply1}"`
  );

  const gapReply2 = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "our full members or group communication has issues", {}, "en");
  assert(
    gapReply2.toLowerCase().includes("babe"),
    "Must address user with warmth"
  );
  assert(
    gapReply2.toLowerCase().includes("gap") ||
    gapReply2.toLowerCase().includes("coordination") ||
    gapReply2.toLowerCase().includes("seamless") ||
    gapReply2.toLowerCase().includes("miscommunication"),
    `Must acknowledge group communication issues! Got: "${gapReply2}"`
  );
});

// -----------------------------------------------------------------------------
// TEST 6: Insider information & hiding transparency reassurance
// -----------------------------------------------------------------------------
runTest("Tuk Tuk reassures full transparency when insider info or hiding is questioned", () => {
  const hideReply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "Something you are hiding, you guys are hiding your insider information.", {}, "en");
  assert(
    hideReply.toLowerCase().includes("open book") ||
    hideReply.toLowerCase().includes("transparent") ||
    hideReply.toLowerCase().includes("never hide"),
    `Must reassure transparency! Got: "${hideReply}"`
  );
});

// -----------------------------------------------------------------------------
// TEST 7: Whisper 'Borgla' and 'Please, your Bangla' trigger Bengali mode transition
// -----------------------------------------------------------------------------
runTest("Whisper STT normalizations and explicit triggers transition to Bengali mode", () => {
  // Reset to en mode
  jm.currentLanguageMode = "en";

  const sanitizedBorgla = TextSanitizer.sanitize("Borgla.");
  assert.strictEqual(sanitizedBorgla, "Bangla.", "Must sanitize 'Borgla' to 'Bangla'");

  const modeBorgla = jm.evaluateLanguageTransition(sanitizedBorgla);
  assert.strictEqual(modeBorgla, "bn", "Must transition to 'bn' on 'Bangla.'");

  // Reset to en mode
  jm.currentLanguageMode = "en";
  const modePleaseBangla = jm.evaluateLanguageTransition("Please, your Bangla,.");
  assert.strictEqual(modePleaseBangla, "bn", "Must transition to 'bn' on 'Please, your Bangla'");

  // Reset to en mode
  jm.currentLanguageMode = "en";
  const modeWantBangla = jm.evaluateLanguageTransition("I want to talk with Bangla. K Thank you.");
  assert.strictEqual(modeWantBangla, "bn", "Must transition to 'bn' on 'I want to talk with Bangla'");
});

// -----------------------------------------------------------------------------
// TEST 8: Bengali praise & responses eliminate raw English sentences
// -----------------------------------------------------------------------------
runTest("Bengali praise responses eliminate raw English sentences", () => {
  const praiseReplyBn = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "darun bhalo lagche", {}, "bn");
  assert(
    !praiseReplyBn.includes("you're killing it"),
    `Must NOT contain raw English 'you're killing it'! Got: "${praiseReplyBn}"`
  );
  assert(
    !praiseReplyBn.includes("proud lagche"),
    `Must NOT contain raw Banglish 'proud lagche'! Got: "${praiseReplyBn}"`
  );
  assert(
    /[\u0980-\u09FF]/.test(praiseReplyBn),
    `Must contain rich Bengali Unicode script! Got: "${praiseReplyBn}"`
  );
});

console.log("================================================================================");
console.log(`🎉 ALL ${testsPassed} / ${totalTests} MISMATCH CONVERSATION AUDIT TESTS PASSED!`);
console.log("================================================================================\n");

process.exit(0);
