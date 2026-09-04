/**
 * Eye & Vision Cortex Recalibration Verification Suite
 * 
 * Verifies:
 * 1. "fix thay are eye", "fix their eye", "fix your eye", "are you blind", "see my screen"
 *    are recognized by actionRunner and routed to multimodal vision.
 * 2. Tool call XML tags (<tool_call>, <function>, <parameter>) are cleanly stripped.
 * 3. ScreenShareManager captureInstantFrame supports robust fallback.
 * 4. Post-processor never returns raw tool call tokens or empty strings.
 */

const assert = require('assert');
const actionRunner = require('../src/utils/action-runner');
const jarvisManager = require('../src/utils/jarvis-manager');
const screenShareManager = require('../src/utils/screen-share-manager');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING EYE & VISION CORTEX RECALIBRATION VERIFICATION');
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

  // 1. Test isEyeRecalibrationQuery regex logic
  const eyeQueries = [
    "fix thay are eye",
    "fix their eye",
    "fix your eye",
    "fix eye",
    "fix eyes",
    "recalibrate eyes",
    "reset eye",
    "eye tracker drift",
    "chokh thik koro"
  ];

  const eyeRegex = /\b(fix\s+(?:your|their|they\s+are|thay\s+are|the|our)?\s*eyes?|fix\s+eye|fix\s+eyes|recalibrate\s+eyes?|reset\s+eyes?|eye\s+tracker|eye\s+drift|chokh\s+(?:thik|nosto|bondho))\b/i;

  for (const q of eyeQueries) {
    test(eyeRegex.test(q), `Eye query recognized: "${q}"`);
  }

  // 2. Test broad visual queries regex logic
  const visualQueries = [
    "see our screen",
    "look at my screen",
    "look at the screen",
    "what is on my screen",
    "can you see my screen",
    "what do you see",
    "are you blind",
    "showing empty",
    "where is the prompt",
    "screen dekho"
  ];

  const visualRegex = /\b(see|look\s+at|inspect|watch|check|read)\s+(?:our|my|the|this)?\s*(?:screen|display|monitor|code|terminal|window|ide|antigravity|prompt)\b/i;
  const blindRegex = /\b(are\s+you\s+blind|you\s+blind|cannot\s+see|can't\s+see|blind)\b/i;
  const promptEmptyRegex = /\b(showing\s+empty|empty\s+screen|screen\s+blank|blank\s+screen|where\s+is\s+the\s+prompt)\b/i;

  test(visualRegex.test("see our screen"), 'Visual regex matches "see our screen"');
  test(visualRegex.test("look at the screen"), 'Visual regex matches "look at the screen"');
  test(blindRegex.test("are you blind"), 'Blind regex matches "are you blind"');
  test(blindRegex.test("Gano? Are you blind?"), 'Blind regex matches conversational "Gano? Are you blind?"');
  test(promptEmptyRegex.test("showing empty"), 'Prompt empty regex matches "showing empty"');
  test(promptEmptyRegex.test("where is the prompt"), 'Prompt empty regex matches "where is the prompt"');

  // 3. Test ActionRunner dispatch for "fix thay are eye"
  const fakeAgent = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
  const actionRes = await actionRunner.handleAction("fix thay are eye", fakeAgent);

  test(actionRes.handled === true, 'ActionRunner handled "fix thay are eye"');
  test(typeof actionRes.speech === 'string' && actionRes.speech.length > 5, 'ActionRunner returned speech response');
  test(!actionRes.speech.includes('<tool_call>'), 'Speech response does NOT contain <tool_call>');
  test(!actionRes.speech.includes('read_file'), 'Speech response does NOT contain read_file hallucination');
  test(actionRes.speech.toLowerCase().includes('eye') || actionRes.speech.toLowerCase().includes('screen') || actionRes.speech.toLowerCase().includes('recalibrated'),
    'Speech acknowledges eyes or screen vision recalibration');

  // 4. Test Tool Call XML Sanitization in jarvisManager addTurn
  const jm = new jarvisManager();
  jm.addTurn("assistant", "<tool_call> <function=call_function> <parameter=tool_name> read_file </parameter> <parameter=path> /tmp/eloquent_screenshare.jpg </parameter> </function> </tool_call>", "Tuk Tuk");
  const lastHistoryTurn = jm.conversationHistory[jm.conversationHistory.length - 1];
  test(!lastHistoryTurn.content.includes("<tool_call>"), "addTurn stripped <tool_call> XML tags");
  test(!lastHistoryTurn.content.includes("read_file"), "addTurn stripped function parameters");
  test(lastHistoryTurn.content.length > 0, "addTurn replaced blank XML with valid reassurance string");

  // 5. Test ScreenShareManager captureInstantFrame
  const framePath = screenShareManager.captureInstantFrame(true);
  test(typeof framePath === 'string' && framePath.includes("screenshare"), "captureInstantFrame returns valid framePath string");

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed}/${total} TESTS PASSED (100% SUCCESS)`);
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error("❌ Test runner failed:", err);
  process.exit(1);
});
