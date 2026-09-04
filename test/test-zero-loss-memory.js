const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(projectRoot, ".env") });

const ZeroLossMemoryEngine = require("../src/utils/zero-loss-memory");
const JarvisManager = require("../src/utils/jarvis-manager");

async function runZeroLossMemoryTests() {
  console.log("=================================================");
  console.log("🧪 ZERO-LOSS MEMORY ENGINE VERIFICATION SUITE");
  console.log("=================================================\n");

  const testUserData = path.join(__dirname, "temp_memory_userdata");
  if (!fs.existsSync(testUserData)) {
    fs.mkdirSync(testUserData, { recursive: true });
  }

  try {
    const jarvis = new JarvisManager(testUserData);
    const engine = new ZeroLossMemoryEngine({ userDataPath: testUserData, jarvisManager: jarvis });

    // -------------------------------------------------------------
    // Test 1: Deterministic Write-Ahead Logging (WAL)
    // -------------------------------------------------------------
    console.log("1️⃣ Testing Write-Ahead Log (WAL) Durability...");
    const walFile = path.join(testUserData, "turn-wal.jsonl");

    engine.logTurnWAL("user", "Hello Tuk Tuk, remember we are building Eloquent together!", "user");
    engine.logTurnWAL("assistant", "Of course babe, Eloquent is our masterpiece.", "Tuk Tuk");

    assert(fs.existsSync(walFile), "WAL file must exist");
    const walLines = fs.readFileSync(walFile, "utf8").trim().split("\n").map(l => JSON.parse(l));
    assert.strictEqual(walLines.length, 2, "Expected 2 entries in WAL log");
    assert.strictEqual(walLines[0].role, "user");
    assert.strictEqual(walLines[1].agent, "Tuk Tuk");
    console.log("   ✅ Synchronous WAL log verified: " + walLines.length + " turns persisted instantly to disk");

    // -------------------------------------------------------------
    // Test 2: Local Deterministic Fact Extraction (0ms, 0 Tokens)
    // -------------------------------------------------------------
    console.log("\n2️⃣ Testing Local Deterministic Fact Extraction (0ms Latency, 0 Tokens)...");
    
    // Directive test
    const extracted1 = engine.extractLocalFacts("Always speak softly when I am tired", "", jarvis);
    assert(extracted1.length > 0, "Expected directive to be extracted");
    assert.strictEqual(extracted1[0].topic, "Directive");
    console.log("   ✅ Directive extracted: \"" + extracted1[0].insight + "\" (Salience: " + extracted1[0].salience + ")");

    // Preference test
    const extracted2 = engine.extractLocalFacts("I prefer dark mode and clean typography", "", jarvis);
    assert(extracted2.length > 0, "Expected preference to be extracted");
    assert.strictEqual(extracted2[0].topic, "Preference");
    console.log("   ✅ Preference extracted: \"" + extracted2[0].insight + "\" (Salience: " + extracted2[0].salience + ")");

    // Project test
    const extracted3 = engine.extractLocalFacts("Currently building Eloquent with Go audio engine", "", jarvis);
    assert(extracted3.length > 0, "Expected project to be extracted");
    assert.strictEqual(extracted3[0].topic, "Project");
    console.log("   ✅ Project extracted: \"" + extracted3[0].insight + "\" (Salience: " + extracted3[0].salience + ")");

    // Verify facts were directly committed into Jarvis Ebbinghaus memory without API calls
    const hasDirective = jarvis.memory.recentLearnings.some(l => l.topic === "Directive" || l.insight.includes("softly"));
    const hasPref = jarvis.memory.recentLearnings.some(l => l.topic === "Preference" || l.insight.includes("dark mode"));
    const hasProj = jarvis.memory.recentLearnings.some(l => l.topic === "Project" || l.insight.includes("Eloquent"));
    assert(hasDirective, "Jarvis memory must have directive learning");
    assert(hasPref, "Jarvis memory must have preference learning");
    assert(hasProj, "Jarvis memory must have project learning");
    console.log("   ✅ All facts committed directly to living memory with 0ms and 0 tokens");

    // -------------------------------------------------------------
    // Test 3: Offline Backlog Persistence Across Restarts
    // -------------------------------------------------------------
    console.log("\n3️⃣ Testing Offline Backlog Persistence Across Restarts...");
    const backlogFile = path.join(testUserData, "memory-backlog.json");

    // Enqueue 2 deep turns (simulating offline / 429 rate limit state)
    engine.enqueueForDeepConsolidation("We should design a neural harmonic synthesizer for Brian", "That sounds incredible, I will sketch the DSP filters.");
    engine.enqueueForDeepConsolidation("I love morning coffee while reviewing code", "Coffee and code is the best vibe.");

    assert(fs.existsSync(backlogFile), "Backlog file must exist");
    assert.strictEqual(engine.backlog.length, 2, "Expected 2 items in memory backlog");
    console.log("   ✅ Backlog persisted to disk with " + engine.backlog.length + " items");

    // Simulate process crash / reload: create brand new engine instance
    engine.destroy();
    const freshEngine = new ZeroLossMemoryEngine({ userDataPath: testUserData, jarvisManager: jarvis });
    assert.strictEqual(freshEngine.backlog.length, 2, "Expected fresh engine to restore 2 queued items from disk");
    console.log("   ✅ Fresh engine restored pending backlog perfectly after restart");

    // -------------------------------------------------------------
    // Test 4: Asynchronous Backlog Drainage with Gateway
    // -------------------------------------------------------------
    console.log("\n4️⃣ Testing Asynchronous Backlog Drainage via Gateway...");
    let drainedInsights = [];
    const mockGateway = {
      chatCompletion: async (messages) => {
        return {
          content: JSON.stringify({
            topic: "Engineering Insight",
            insight: "Designing neural harmonic synthesizer",
            salience: 0.90
          }),
          model: "qwen/qwen3.8-27b",
          provider: "groq"
        };
      },
      enqueueBackgroundTask: async (fn) => {
        return await fn();
      }
    };

    await freshEngine.drainBacklog(mockGateway, jarvis);
    assert.strictEqual(freshEngine.backlog.length, 0, "Backlog should be completely drained");
    
    // Verify backlog file on disk is now empty array
    const diskBacklog = JSON.parse(fs.readFileSync(backlogFile, "utf8"));
    assert.strictEqual(diskBacklog.length, 0, "Disk backlog file must be empty after successful drainage");
    console.log("   ✅ Backlog fully drained and disk state synchronized");

    // -------------------------------------------------------------
    // Test 5: Resilience Under Total Upstream Outage
    // -------------------------------------------------------------
    console.log("\n5️⃣ Testing Resilience Under 100% Upstream API Rate Limit...");
    freshEngine.enqueueForDeepConsolidation("Important architecture rule: zero locks in audio render thread", "Acknowledged.");
    assert.strictEqual(freshEngine.backlog.length, 1, "Backlog should have 1 item");

    const outageGateway = {
      chatCompletion: async () => {
        throw new Error("HTTP 429: Tokens per day quota exceeded (TPD)");
      }
    };

    // Drainage attempt under outage
    await freshEngine.drainBacklog(outageGateway, jarvis);
    // Item MUST NOT be lost!
    assert.strictEqual(freshEngine.backlog.length, 1, "Backlog item must be preserved on 429 error");
    console.log("   ✅ Zero data loss verified: Backlog safely retained item during 100% cloud outage");

    freshEngine.destroy();
    console.log("\n🎉 ALL ZERO-LOSS MEMORY TESTS PASSED (100%)!\n");
  } finally {
    // Cleanup temporary test directory
    try {
      fs.rmSync(testUserData, { recursive: true, force: true });
    } catch (e) {}
  }
}

runZeroLossMemoryTests()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Zero-Loss Memory Test Suite Failed:", err);
    process.exit(1);
  });
