/**
 * Test Suite: Full-Day Workflow & Comprehensive Voice Command Execution
 * 
 * Verifies that:
 * 1. OfficeActionRunner understands all of Hritthik's natural Banglish, Hinglish, and English commands.
 * 2. Multi-agent equational handoffs trigger accurately for Banglish delegation ("vision ke bol ...").
 * 3. Direct CLI/terminal commands execute smoothly.
 * 4. LocalCognitiveBrain delivers instant full-day pairing and soulmate context.
 */

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const actionRunner = require("../src/utils/action-runner");
const JarvisManager = require("../src/utils/jarvis-manager");
const LocalCognitiveBrain = require("../src/utils/local-cognitive-brain");

test("Full-Day Workflow & Spoken Command Execution Matrix", async (t) => {
  const jarvis = new JarvisManager(path.resolve(__dirname, "../userData"));
  const activeTukTuk = { name: "Tuk Tuk", key: "tuktuk", voice: "en-US-AvaMultilingualNeural" };
  const activeVision = { name: "Vision", key: "vision", voice: "en-US-AndrewNeural" };
  const activeBrian = { name: "Brian", key: "brian", voice: "en-US-BrianNeural" };

  await t.test("1. Hardware & System Telemetry in Banglish / Hinglish", async () => {
    const battRes = await actionRunner.handleAction("battery koto percent ache", activeBrian);
    assert.strictEqual(battRes.handled, true, "Battery query in Banglish must be handled");
    assert.match(battRes.speech, /Battery is currently at \d+ percent/i);

    const ramRes = await actionRunner.handleAction("ram dekh koto ache", activeBrian);
    assert.strictEqual(ramRes.handled, true, "RAM check in Banglish must be handled");
    assert.match(ramRes.speech, /RAM usage|Memory/i);

    const uptimeRes = await actionRunner.handleAction("uptime dekh", activeBrian);
    assert.strictEqual(uptimeRes.handled, true, "Uptime query in Banglish must be handled");
    assert.match(uptimeRes.speech, /System uptime/i);

    const storageRes = await actionRunner.handleAction("disk dekh", activeBrian);
    assert.strictEqual(storageRes.handled, true, "Storage query in Banglish must be handled");
    assert.match(storageRes.speech, /Storage status/i);

    const portRes = await actionRunner.handleAction("port 4000 check kor", activeBrian);
    assert.strictEqual(portRes.handled, true, "Port check in Banglish must be handled");
    assert.match(portRes.speech, /Port 4000/i);
  });

  await t.test("2. Git, Code & Terminal Operations in Banglish", async () => {
    const gitStatusRes = await actionRunner.handleAction("git status dekh", activeVision);
    assert.strictEqual(gitStatusRes.handled, true, "Git status in Banglish must be handled");
    assert.match(gitStatusRes.speech, /branch|clean|modified/i);

    const gitDiffRes = await actionRunner.handleAction("git diff dekh", activeVision);
    assert.strictEqual(gitDiffRes.handled, true, "Git diff in Banglish must be handled");
    assert.match(gitDiffRes.speech, /Git diff|No unstaged changes/i);

    const commitsRes = await actionRunner.handleAction("recent commits dekh", activeVision);
    assert.strictEqual(commitsRes.handled, true, "Recent commits in Banglish must be handled");
    assert.match(commitsRes.speech, /Recent commits|commit history/i);

    const syntaxRes = await actionRunner.handleAction("code ta check kor", activeVision);
    assert.strictEqual(syntaxRes.handled, true, "Syntax check in Banglish must be handled");
    assert.match(syntaxRes.speech, /Code integrity|Syntax check/i);

    const filesRes = await actionRunner.handleAction("file gulo dekh", activeVision);
    assert.strictEqual(filesRes.handled, true, "List files in Banglish must be handled");
    assert.match(filesRes.speech, /Project root contains/i);
  });

  await t.test("3. Direct CLI Execution via Voice", async () => {
    const cliRes = await actionRunner.handleAction("run node -v", activeVision);
    assert.strictEqual(cliRes.handled, true, "CLI execution must be handled");
    assert.match(cliRes.speech, /Command executed with status zero|v\d+/i);
  });

  await t.test("4. Desk Comfort, Audio & App Controls in Banglish", async () => {
    const musicRes = await actionRunner.handleAction("gan chala", activeTukTuk);
    assert.strictEqual(musicRes.handled, true, "Play music in Banglish must be handled");
    assert.match(musicRes.speech, /Starting music/i);

    const pauseRes = await actionRunner.handleAction("gan bondho kor", activeTukTuk);
    assert.strictEqual(pauseRes.handled, true, "Pause music in Banglish must be handled");
    assert.match(pauseRes.speech, /Music paused/i);

    const timeRes = await actionRunner.handleAction("koyta baje", activeTukTuk);
    assert.strictEqual(timeRes.handled, true, "Time in Banglish must be handled");
    assert.match(timeRes.speech, /It is \d+:\d+/i);

    const noteRes = await actionRunner.handleAction("note ne finish sprint backlog", activeTukTuk);
    assert.strictEqual(noteRes.handled, true, "Take note in Banglish must be handled");
    assert.match(noteRes.speech, /Note/i);

    const reminderRes = await actionRunner.handleAction("reminder set kor deploy release", activeTukTuk);
    assert.strictEqual(reminderRes.handled, true, "Set reminder in Banglish must be handled");
    assert.match(reminderRes.speech, /reminder/i);

    const darkRes = await actionRunner.handleAction("dark mode kor", activeTukTuk);
    assert.strictEqual(darkRes.handled, true, "Dark mode in Banglish must be handled");
    assert.match(darkRes.speech, /Toggled system appearance mode/i);
  });

  await t.test("5. Banglish Equational Cross-Agent Handoffs", async () => {
    const handoffVision = jarvis.evaluateCrossAgentHandoff("vision ke bol build check korte");
    assert.notStrictEqual(handoffVision, null, "Handoff to Vision in Banglish must succeed");
    assert.strictEqual(handoffVision.delegated, true);
    assert.strictEqual(handoffVision.targetAgent.key, "vision");
    assert.strictEqual(handoffVision.sourceAgent.key, "tuktuk");
    assert.ok(handoffVision.utility >= 0.60, "Utility must satisfy threshold");

    const handoffBrian = jarvis.evaluateCrossAgentHandoff("brian ke bol ram check korte");
    assert.notStrictEqual(handoffBrian, null, "Handoff to Brian in Banglish must succeed");
    assert.strictEqual(handoffBrian.delegated, true);
    assert.strictEqual(handoffBrian.targetAgent.key, "brian");

    const handoffFriday = jarvis.evaluateCrossAgentHandoff("friday ke bol research dekhte");
    assert.notStrictEqual(handoffFriday, null, "Handoff to Friday in Banglish must succeed");
    assert.strictEqual(handoffFriday.delegated, true);
    assert.strictEqual(handoffFriday.targetAgent.key, "friday");
  });

  await t.test("6. LocalCognitiveBrain Full-Day Workflow Resilience", async () => {
    const tuktukReply = LocalCognitiveBrain.synthesizeResponse("tuktuk", "Tuk Tuk", "full day workflow ready?");
    assert.match(tuktukReply, /workflow locked in|babe/i);

    const visionReply = LocalCognitiveBrain.synthesizeResponse("vision", "Vision", "workflow velocity status");
    assert.match(visionReply, /workflow optimized|brother/i);

    const brianReply = LocalCognitiveBrain.synthesizeResponse("brian", "Brian", "full day uptime and memory leaks");
    assert.match(brianReply, /Zero memory leaks|efficiency/i);
  });
});
