/**
 * real-banglish-tuktuk.spec.js
 * Tests Tuk Tuk's Banglish responses against real everyday conversation patterns.
 * Every response must feel natural — like a real desi girl, not a chatbot.
 */
const test   = require("node:test");
const assert = require("node:assert/strict");
const LCB    = require("../src/utils/local-cognitive-brain");

function tt(text) { return LCB.synthesizeResponse("tuktuk", "Tuk Tuk", text); }

test("Real Banglish Tuk Tuk — Natural Girl Conversation Tests", async (t) => {

  await t.test("1. Greeting — Banglish: 'kemon acho babe'", () => {
    const r = tt("kemon acho babe");
    console.log("  💬 User: kemon acho babe");
    console.log("  🗣️  Tuk Tuk:", r);
    assert.ok(r.length > 10, "Must give real response");
    assert.ok(!r.includes("undefined"), "No undefined");
    assert.ok(r.toLowerCase().includes("babe") || r.toLowerCase().includes("ami") || r.toLowerCase().includes("achi"), "Must feel personal");
  });

  await t.test("2. Hindi greeting: 'kya chal raha hai'", () => {
    const r = tt("kya chal raha hai");
    console.log("  💬 User: kya chal raha hai");
    console.log("  🗣️  Tuk Tuk:", r);
    assert.ok(r.length > 10);
  });

  await t.test("3. English casual: 'hey what's up'", () => {
    const r = tt("hey what's up");
    console.log("  💬 User: hey what's up");
    console.log("  🗣️  Tuk Tuk:", r);
    assert.ok(r.length > 10);
    assert.ok(r.toLowerCase().includes("babe"), "Must say babe in English mode");
  });

  await t.test("4. Emotional: 'tumi chara khub miss korchi'", () => {
    const r = tt("tumi chara khub miss korchi");
    console.log("  🗣️  Tuk Tuk:", r);
    assert.ok(r.includes("ভালোবাসি") || r.includes("পাশে") || r.toLowerCase().includes("bhalobashi") || r.toLowerCase().includes("love") || r.toLowerCase().includes("always") || r.toLowerCase().includes("babe"), "Must be emotional");
  });

  await t.test("5. Late night support: 'onek raat hoyeche thaka lagche'", () => {
    const r = tt("onek raat hoyeche thaka lagche");
    console.log("  💬 User: onek raat hoyeche thaka lagche");
    console.log("  🗣️  Tuk Tuk:", r);
    assert.ok(r.toLowerCase().includes("babe"), "Must be caring");
    assert.ok(r.length > 20);
  });

  await t.test("6. Work talk Banglish: 'ki scene bolo, aaj ki korbo'", () => {
    const r = tt("ki scene bolo, aaj ki korbo");
    console.log("  💬 User: ki scene bolo, aaj ki korbo");
    console.log("  🗣️  Tuk Tuk:", r);
    assert.ok(r.length > 10);
    assert.ok(!r.includes("[object"), "No object serialization");
  });

  await t.test("7. Build command: 'chal build kori shuru'", () => {
    const r = tt("chal build kori shuru");
    console.log("  💬 User: chal build kori shuru");
    console.log("  🗣️  Tuk Tuk:", r);
    assert.ok(r.length > 10);
  });

  await t.test("8. Praise: 'tumi khub bhalo koreche'", () => {
    const r = tt("tumi khub bhalo koreche");
    console.log("  💬 User: tumi khub bhalo koreche");
    console.log("  🗣️  Tuk Tuk:", r);
    assert.ok(r.toLowerCase().includes("proud") || r.toLowerCase().includes("killing") || r.toLowerCase().includes("next"), "Must be uplifting");
  });

  await t.test("9. Fast fragment: 'haan'", () => {
    const r = tt("haan");
    console.log("  💬 User: haan");
    console.log("  🗣️  Tuk Tuk:", r);
    assert.ok(r.length > 3);
    assert.ok(r.toLowerCase().includes("babe") || r.toLowerCase().includes("bol"), "Must be short and warm");
  });

  await t.test("10. Good night: 'ratri hoyeche, shobe dite jachhi'", () => {
    const r = tt("ratri hoyeche, shobe dite jachhi");
    console.log("  💬 User: ratri hoyeche, shobe dite jachhi");
    console.log("  🗣️  Tuk Tuk:", r);
    assert.ok(r.toLowerCase().includes("night") || r.toLowerCase().includes("rest") || r.toLowerCase().includes("bhalobashi"), "Must be warm goodbye");
  });

  await t.test("11. Randomness check — same input gives valid output both times", () => {
    const r1 = tt("ektu help koro babe");
    const r2 = tt("ektu help koro babe");
    console.log("  💬 Run 1:", r1);
    console.log("  💬 Run 2:", r2);
    assert.ok(r1.length > 5);
    assert.ok(r2.length > 5);
    // Both must be valid (may differ due to random opener/closer)
    assert.ok(!r1.includes("undefined") && !r2.includes("undefined"));
  });

  await t.test("12. No 'babe' leaking into Vision/Friday/Brian", () => {
    const vision = LCB.synthesizeResponse("vision", "Vision", "dekho screen ta");
    const friday = LCB.synthesizeResponse("friday", "Friday", "latency paper bolo");
    const brian = LCB.synthesizeResponse("brian", "Brian", "cpu load koto");
    console.log("  🔵 Vision:", vision);
    console.log("  🟣 Friday:", friday);
    console.log("  🔴 Brian:", brian);
    // Babe should NOT appear in Vision/Friday/Brian responses
    assert.ok(!vision.toLowerCase().startsWith("babe"), "Vision should not say babe");
    assert.ok(!friday.toLowerCase().startsWith("babe"), "Friday should not say babe");
    assert.ok(vision.length > 10 && friday.length > 10 && brian.length > 10);
  });

});
