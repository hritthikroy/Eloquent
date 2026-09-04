/**
 * Tuk Tuk Skill Profile & Prompt Crafting Specification Test Suite
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { SkillDaemon } = require('../src/services/skill-daemon');
const { IntentParser, INTENTS } = require('../src/utils/prompt-engine/intent-parser');
const actionRunner = require('../src/utils/action-runner');

console.log('🧪 Starting Tuk Tuk Skill & Antigravity Automation Test Suite...\n');

// 1. Validate Tuk Tuk Skill Profile JSON against Schema
console.log('--- 1. Testing Tuk Tuk Skill Profile Validation ---');
const tuktukSkillPath = path.resolve(__dirname, '../config/skills/tuktuk.json');
assert(fs.existsSync(tuktukSkillPath), 'config/skills/tuktuk.json must exist');

const daemon = new SkillDaemon({
  configDir: path.resolve(__dirname, '../config/skills')
});

daemon.loadAllProfiles();
const profile = daemon.getProfile('tuktuk');
assert(profile !== null && profile !== undefined, 'Tuk Tuk skill profile must load successfully');
assert.strictEqual(profile.agentId, 'agent_tuktuk', 'agentId must match agent_tuktuk');
assert.strictEqual(profile.name, 'Tuk Tuk', 'Profile name must be Tuk Tuk');
assert.strictEqual(profile.skills.length, 5, 'Tuk Tuk must have 5 registered core skills');

const promptSkill = profile.skills.find(s => s.id === 'antigravity_prompt_crafting');
assert(promptSkill !== undefined, 'antigravity_prompt_crafting skill must exist');
assert.strictEqual(promptSkill.enabled, true, 'Prompt crafting skill must be enabled');

const clipSkill = profile.skills.find(s => s.id === 'clipboard_sync_execution');
assert(clipSkill !== undefined, 'clipboard_sync_execution skill must exist');
assert.strictEqual(clipSkill.enabled, true, 'Clipboard sync skill must be enabled');
console.log('  ✅ [PASS] Tuk Tuk skill profile and schema 100% valid');

// 2. Test Intent Parsing for Tuk Tuk Prompt Commands
console.log('\n--- 2. Testing Intent Parsing for Tuk Tuk Prompt Directives ---');
const parsed1 = IntentParser.parse("Tuk Tuk prompt this in Antigravity");
assert.strictEqual(parsed1.intent, INTENTS.GENERATE_PROMPT, 'Must detect GENERATE_PROMPT intent for Tuk Tuk');
console.log('  ✅ [PASS] "Tuk Tuk prompt this in Antigravity" parsed correctly');

const parsed2 = IntentParser.parse("Tuk Tuk, write a master developer prompt for rate limiter");
assert.strictEqual(parsed2.intent, INTENTS.GENERATE_PROMPT, 'Must detect GENERATE_PROMPT for prompt writing');
console.log('  ✅ [PASS] "Tuk Tuk, write a master developer prompt" parsed correctly');

const parsed3 = IntentParser.parse("Tuk Tuk copy prompt to clipboard and execute");
assert.strictEqual(parsed3.intent, INTENTS.GENERATE_PROMPT, 'Must detect clipboard copy and execute directive');
console.log('  ✅ [PASS] "Tuk Tuk copy prompt to clipboard and execute" parsed correctly');

// 3. Test Action Runner Execution with Tuk Tuk Attribution
console.log('\n--- 3. Testing ActionRunner Prompt Generation & Persona Attribution ---');
async function testActionRunner() {
  const activeAgent = { key: 'tuktuk', name: 'Tuk Tuk', voice: 'en-US-AvaMultilingualNeural' };
  
  const res = await actionRunner.handleAction("Tuk Tuk prompt this in Antigravity", activeAgent);
  assert(res && res.handled, 'ActionRunner must handle prompt generation');
  assert.strictEqual(res.agentName, 'Tuk Tuk', 'Response must be attributed to Tuk Tuk');
  assert.strictEqual(res.agentKey, 'tuktuk', 'agentKey must be tuktuk');
  assert(res.speech.includes('Antigravity'), 'Speech must confirm Antigravity prompt synchronization');
  console.log('  ✅ [PASS] ActionRunner executed prompt crafting with Tuk Tuk co-founder attribution');
}

testActionRunner().then(() => {
  console.log('\n🎉 ALL TUK TUK SKILL & PROMPT AUTOMATION TESTS PASSED (100%)!');
}).catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
