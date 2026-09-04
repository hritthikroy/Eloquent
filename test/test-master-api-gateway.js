const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(projectRoot, ".env") });

const MasterApiGateway = require("../src/utils/master-api-gateway");

async function runGatewayTests() {
  console.log("=================================================");
  console.log("🧪 MASTER API GATEWAY VERIFICATION SUITE");
  console.log("=================================================\n");

  const testUserData = path.join(__dirname, "temp_gateway_userdata");
  if (!fs.existsSync(testUserData)) {
    fs.mkdirSync(testUserData, { recursive: true });
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Key Initialization & Multi-Key Detection
    // -------------------------------------------------------------
    console.log("1️⃣ Testing Multi-Key Initialization...");
    // Mock environment keys
    process.env.GROQ_API_KEY = "gsk_test_master_key_1234567890abcdef";
    process.env.GROQ_API_KEY_1 = "gsk_test_sub_key_1_1234567890abcdef";
    process.env.GROQ_API_KEY_2 = "gsk_test_sub_key_2_1234567890abcdef";
    process.env.GEMINI_API_KEY = "AIzaSyTestGeminiKey_1234567890abcdef";

    const gateway = new MasterApiGateway({ userDataPath: testUserData });
    assert(gateway.groqKeys.length >= 3, "Expected at least 3 Groq keys, got " + gateway.groqKeys.length);
    console.log("   ✅ Groq keys initialized: " + gateway.groqKeys.length + " keys detected");
    assert(gateway.geminiKeys.length >= 1, "Expected at least 1 Gemini key, got " + gateway.geminiKeys.length);
    console.log("   ✅ Gemini keys initialized: " + gateway.geminiKeys.length + " keys detected");

    // -------------------------------------------------------------
    // Test 2: Token-Bucket & Telemetry Ranking
    // -------------------------------------------------------------
    console.log("\n2️⃣ Testing Predictive Token-Bucket Quota Ranking...");
    const k1 = gateway.groqKeys[0].key;
    const k2 = gateway.groqKeys[1].key;
    const k3 = gateway.groqKeys[2].key;

    // Simulate key 1 with low tokens, key 2 with high tokens, key 3 in cooldown
    gateway.recordResponseHeaders(k1, { "x-ratelimit-remaining-tokens": "1200" }, 300);
    gateway.recordResponseHeaders(k2, { "x-ratelimit-remaining-tokens": "8500" }, 250);
    gateway.setKeyCooldown(k3, 60000, "simulated cooldown");

    const ranked = gateway.getRankedGroqKeys();
    const idx1 = ranked.findIndex(r => r.key === k1);
    const idx2 = ranked.findIndex(r => r.key === k2);
    const idx3 = ranked.findIndex(r => r.key === k3);
    assert(idx2 < idx1, "Expected key 2 (8500 tokens) to be ranked before key 1 (1200 tokens)");
    assert(idx1 < idx3, "Expected key 1 (1200 tokens) to be ranked before key 3 (in cooldown)");
    console.log("   ✅ Predictive quota sorting verified: [Rank " + idx2 + " -> Rank " + idx1 + " -> Rank " + idx3 + "]");

    // -------------------------------------------------------------
    // Test 3: Proactive Rate Limit Shifting on Header Warning
    // -------------------------------------------------------------
    console.log("\n3️⃣ Testing Proactive Header-Based Cooldown Shifting...");
    // When tokens drop below 500, gateway should proactively trigger soft cooldown
    gateway.recordResponseHeaders(k2, {
      "x-ratelimit-remaining-tokens": "350",
      "x-ratelimit-reset-tokens": "10s"
    }, 280);

    const isCooling = gateway.isKeyCoolingDown(k2);
    assert.strictEqual(isCooling, true, "Expected key 2 with 350 tokens to enter proactive cooldown");
    console.log("   ✅ Proactive soft-cooldown successfully engaged before 429 HTTP hit");

    // -------------------------------------------------------------
    // Test 4: Dual-Lane Traffic Priority & Background Queue
    // -------------------------------------------------------------
    console.log("\n4️⃣ Testing Dual-Lane Traffic Prioritization...");
    let backgroundJobExecuted = false;
    let executionOrder = [];

    // Simulate active voice call
    gateway.activeInteractiveRequests = 1;

    // Enqueue background task
    gateway.enqueueBackgroundTask(async () => {
      executionOrder.push("background");
      backgroundJobExecuted = true;
      return "done";
    });

    // Check that background task does NOT run immediately while voice lane is busy
    await new Promise(r => setTimeout(r, 100));
    assert.strictEqual(backgroundJobExecuted, false, "Background task should yield while interactive lane is active");
    console.log("   ✅ Background lane properly paused while voice lane active");

    // Release interactive voice lane
    gateway.activeInteractiveRequests = 0;
    await new Promise(r => setTimeout(r, 800)); // drain interval
    assert.strictEqual(backgroundJobExecuted, true, "Background task should execute once interactive lane clears");
    console.log("   ✅ Background lane drained cleanly once voice lane idle");

    // -------------------------------------------------------------
    // Test 5: Fallback to Gemini on 100% Groq Exhaustion
    // -------------------------------------------------------------
    console.log("\n5️⃣ Testing Multi-Tier Gemini Failover...");
    let geminiInvoked = false;
    const mockGeminiClient = {
      isConfigured: () => true,
      callChatCompletion: async (msgs, opts) => {
        geminiInvoked = true;
        return {
          content: "Gemini fallback response",
          model: "gemini-3-flash-preview",
          usage: { prompt_tokens: 10, completion_tokens: 5 }
        };
      }
    };

    const failoverGateway = new MasterApiGateway({
      userDataPath: testUserData,
      geminiClient: mockGeminiClient
    });

    // Mark all Groq keys as cooling down
    for (const gk of failoverGateway.groqKeys) {
      failoverGateway.setKeyCooldown(gk.key, 60000, "all keys cooling");
    }

    const res = await failoverGateway.chatCompletion([{ role: "user", content: "Test query" }]);
    assert.strictEqual(geminiInvoked, true, "Expected Gemini to be invoked when Groq keys are exhausted");
    assert.strictEqual(res.provider, "gemini", "Expected provider to be gemini");
    assert.strictEqual(res.content, "Gemini fallback response", "Expected Gemini content");
    console.log("   ✅ Seamless Gemini failover successfully verified");

    // -------------------------------------------------------------
    // Test 6: Telemetry Snapshot
    // -------------------------------------------------------------
    console.log("\n6️⃣ Testing Telemetry Snapshot...");
    const telemetry = gateway.getTelemetry();
    assert(telemetry.groqKeysTotal >= 3, "Expected groqKeysTotal >= 3");
    assert(Array.isArray(telemetry.groqPool), "Expected groqPool array");
    console.log("   ✅ Telemetry snapshot generated: " + telemetry.groqKeysTotal + " Groq keys, " + telemetry.geminiKeysTotal + " Gemini keys");

    console.log("\n🎉 ALL MASTER API GATEWAY TESTS PASSED (100%)!\n");
  } finally {
    // Cleanup temporary test directory
    try {
      fs.rmSync(testUserData, { recursive: true, force: true });
    } catch (e) {}
  }
}

runGatewayTests().catch(err => {
  console.error("❌ Gateway Test Suite Failed:", err);
  process.exit(1);
});
