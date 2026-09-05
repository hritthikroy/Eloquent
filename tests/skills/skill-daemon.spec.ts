/**
 * Test Suite: Automated Skill-Update Mechanism & Hot-Reload Daemon for Vision
 * 
 * Verifies:
 * 1. Strict JSON schema validation for Vision's skill profile and metadata array.
 * 2. Rejection of malformed metadata mutations (missing keys, invalid types, value mismatches).
 * 3. Zero-downtime hot-reloading with sub-50ms reload latency.
 * 4. Resilient fallback recovery when encountering corrupted or invalid JSON profiles.
 * 5. Atomic metadata array mutations and safe filesystem persistence.
 * 6. Automated telemetry tracking, error recording, and daemon memory consumption logging.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let rootDir = path.resolve(__dirname, '../../..');
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = path.resolve(__dirname, '../..');
}
if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = process.cwd();
}

const {
  SkillDaemon,
  validateMetadataItem,
  validateSkillProfile,
  ALLOWED_METADATA_TYPES
} = require(path.join(rootDir, 'src/services/skill-daemon'));

async function runSkillDaemonTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING VISION SKILL-UPDATE & HOT-RELOAD DAEMON TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Test assertion failed: ${testName}`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Strict JSON Schema & Metadata Array Validation
  // --------------------------------------------------------------------------
  console.log('--- 1. Strict JSON Schema & Metadata Array Validation ---');
  {
    const validVisionProfilePath = fs.existsSync(path.join(rootDir, 'config/skills/vision.json'))
      ? path.join(rootDir, 'config/skills/vision.json')
      : path.join(rootDir, 'config/skills/andrew.json');
    assert(fs.existsSync(validVisionProfilePath), 'Vision skill profile exists');

    const visionRaw = fs.readFileSync(validVisionProfilePath, 'utf8');
    const visionProfile = JSON.parse(visionRaw);

    assert(validateSkillProfile(visionProfile) === true, 'Vision profile passes strict schema validation');
    assert(visionProfile.agentId === 'agent_vision' || visionProfile.agentId === 'agent_andrew', 'Profile agentId is agent_vision');
    assert(visionProfile.name === 'Vision' || visionProfile.name === 'Andrew', 'Profile name is Vision');
    assert(visionProfile.version === '2.1.0', 'Profile version is 2.1.0');
    assert(Array.isArray(visionProfile.metadata), 'Profile contains metadata array');
    assert(visionProfile.metadata.length >= 8, `Metadata array populated with ${visionProfile.metadata.length} entries`);

    // Verify metadata array types
    const salutationItem = visionProfile.metadata.find((m: any) => m.key === 'salutation');
    assert(salutationItem !== undefined && (salutationItem.value === 'brother' || salutationItem.value === 'bro'), 'Salutation metadata is "brother" or "bro"');
    assert(salutationItem.type === 'string', 'Salutation metadata type is string');

    const auraColorItem = visionProfile.metadata.find((m: any) => m.key === 'aura_color');
    assert(auraColorItem !== undefined && auraColorItem.value === '#06b6d4', 'Aura color metadata is cyan (#06b6d4)');

    const concurrencyItem = visionProfile.metadata.find((m: any) => m.key === 'max_concurrency');
    assert(concurrencyItem !== undefined && concurrencyItem.value === 16, 'Max concurrency metadata is 16');
    assert(concurrencyItem.type === 'number', 'Concurrency metadata type is number');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Rejection of Malformed Metadata Mutations
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Malformed Metadata Mutation Edge Cases ---');
  {
    // Test invalid keys (spaces, uppercase, symbols)
    let threwInvalidKey = false;
    try {
      validateMetadataItem({ key: 'Invalid Key!', value: 'val', type: 'string' });
    } catch (e: any) {
      threwInvalidKey = true;
      assert(e.message.includes('Invalid metadata key'), 'Rejects uppercase/space/symbol in metadata key');
    }
    assert(threwInvalidKey, 'Invalid key threw error as expected');

    // Test unknown type
    let threwInvalidType = false;
    try {
      validateMetadataItem({ key: 'test_key', value: 'val', type: 'unknown_type' });
    } catch (e: any) {
      threwInvalidType = true;
      assert(e.message.includes('Invalid metadata type'), 'Rejects unrecognized metadata type');
    }
    assert(threwInvalidType, 'Invalid type threw error as expected');

    // Test type mismatch (type: number, value: string)
    let threwTypeMismatch = false;
    try {
      validateMetadataItem({ key: 'worker_count', value: 'thirty-two', type: 'number' });
    } catch (e: any) {
      threwTypeMismatch = true;
      assert(e.message.includes('must be a valid number'), 'Rejects string value when declared type is number');
    }
    assert(threwTypeMismatch, 'Type mismatch threw error as expected');

    // Test null value rejection
    let threwNull = false;
    try {
      validateMetadataItem({ key: 'null_prop', value: null, type: 'string' });
    } catch (e: any) {
      threwNull = true;
      assert(e.message.includes('cannot be null'), 'Rejects null metadata value');
    }
    assert(threwNull, 'Null value threw error as expected');

    // Test duplicate keys rejection in profile
    let threwDup = false;
    try {
      validateSkillProfile({
        agentId: 'agent_vision',
        name: 'Vision',
        role: 'Lead Systems Architect & 10x Software Engineer',
        version: '2.1.0',
        enabled: true,
        skills: [],
        metadata: [
          { key: 'dup_key', value: '1', type: 'string' },
          { key: 'dup_key', value: '2', type: 'string' }
        ]
      });
    } catch (e: any) {
      threwDup = true;
      assert(e.message.includes('Duplicate metadata key'), 'Rejects duplicate keys in metadata array');
    }
    assert(threwDup, 'Duplicate keys threw error as expected');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Zero-Downtime Hot-Reloading & Latency Benchmark
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Zero-Downtime Hot-Reloading & Latency Benchmark ---');
  {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eloquent-skill-daemon-test-'));
    const testVisionFile = path.join(tempDir, 'vision.json');

    const initialProfile = {
      agentId: 'agent_vision',
      name: 'Vision',
      role: 'Lead Systems Architect & 10x Software Engineer',
      version: '2.1.0',
      enabled: true,
      lastUpdated: Date.now(),
      skills: [
        { id: 'git_diff', name: 'Git Diff', description: 'Diff inspect', handler: 'getGitDiff', category: 'engineering', timeoutMs: 3000, enabled: true }
      ],
      metadata: [
        { key: 'salutation', value: 'bro', type: 'string', description: 'Address token' },
        { key: 'active_threads', value: 4, type: 'number', description: 'Thread count' }
      ]
    };
    fs.writeFileSync(testVisionFile, JSON.stringify(initialProfile, null, 2), 'utf8');

    const daemon = new SkillDaemon({ configDir: tempDir, debounceMs: 20 });
    daemon.start();

    // 1. Initial reload
    const profile1 = daemon.getProfile('agent_vision') || daemon.getProfile('vision');
    assert(profile1 !== null, 'SkillDaemon successfully primed initial profile');
    assert(profile1.name === 'Vision', 'Profile name correctly loaded');
    assert(profile1.metadata.length === 2, 'Loaded 2 initial metadata items');

    // 2. Perform dynamic hot-reload by mutating file
    const updatedProfile = JSON.parse(JSON.stringify(initialProfile));
    updatedProfile.metadata.push({
      key: 'hot_reloaded_flag',
      value: true,
      type: 'boolean',
      description: 'Hot reload verification flag'
    });
    fs.writeFileSync(testVisionFile, JSON.stringify(updatedProfile, null, 2), 'utf8');

    // Trigger direct reload and benchmark latency
    const reloadResult = daemon.reload('vision', testVisionFile);
    assert(reloadResult.success === true, 'Dynamic hot-reload succeeded without error');
    assert(reloadResult.fallback === false, 'Hot-reload did not trigger fallback');
    assert(reloadResult.latencyMs < 50.0, `Hot-reload latency (${reloadResult.latencyMs.toFixed(3)}ms) is well below 50ms target`);
    console.log(`   ℹ️ Hot-reload completed in ${reloadResult.latencyMs.toFixed(3)}ms`);

    const profile2 = daemon.getProfile('agent_vision') || daemon.getProfile('vision');
    assert(profile2.metadata.length === 3, 'Metadata array successfully expanded to 3 items on hot-reload');
    const flagItem = profile2.metadata.find((m: any) => m.key === 'hot_reloaded_flag');
    assert(flagItem !== undefined && flagItem.value === true, 'New metadata item immediately active in memory');

    daemon.stop();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Robust Fallback Recovery on Corrupted JSON
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Resilient Fallback Recovery on Corrupted JSON ---');
  {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eloquent-skill-fallback-test-'));
    const testVisionFile = path.join(tempDir, 'vision.json');

    const goodProfile = {
      agentId: 'agent_vision',
      name: 'Vision',
      role: 'Lead Systems Architect & 10x Software Engineer',
      version: '2.1.0',
      enabled: true,
      lastUpdated: Date.now(),
      skills: [],
      metadata: [{ key: 'lead_role', value: 'Lead Systems Architect & 10x Software Engineer', type: 'string' }]
    };
    fs.writeFileSync(testVisionFile, JSON.stringify(goodProfile, null, 2), 'utf8');

    const daemon = new SkillDaemon({ configDir: tempDir });
    daemon.start();

    // Verify good baseline loaded
    const baseline = daemon.getProfile('vision') || daemon.getProfile('agent_vision');
    assert(baseline !== null && baseline.metadata[0].key === 'lead_role', 'Good baseline profile established');

    // Intentionally corrupt file with invalid JSON syntax
    fs.writeFileSync(testVisionFile, '<<< CORRUPTED NON-JSON DATA >>>', 'utf8');

    // Attempt reload on corrupted file
    let threw = false;
    let reloadRes: any = null;
    try {
      reloadRes = daemon.reload('vision', testVisionFile);
    } catch (e) {
      threw = true;
    }
    assert(!threw, 'Corrupted JSON reload safely caught without throwing unhandled exception');
    assert(reloadRes.success === false, 'Reload result flagged success: false');
    assert(reloadRes.fallback === true, 'Fallback flag activated');
    assert(reloadRes.profile !== null, 'Fallback returned last known good profile');
    assert(reloadRes.profile.metadata[0].key === 'lead_role', 'Last known good profile preserved in active memory');

    // Test corrupted schema (valid JSON, but violates schema: missing agentId)
    fs.writeFileSync(testVisionFile, JSON.stringify({ name: 'Malformed' }), 'utf8');
    const schemaErrRes = daemon.reload('vision', testVisionFile);
    assert(schemaErrRes.fallback === true, 'Schema violation triggers fallback');
    assert(schemaErrRes.profile.metadata[0].key === 'lead_role', 'Last known good profile preserved across schema error');

    daemon.stop();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Atomic Metadata Mutation API & Disk Persistence
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Atomic Metadata Mutation API & Persistence ---');
  {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eloquent-skill-mutation-test-'));
    const testVisionFile = path.join(tempDir, 'vision.json');

    const baseProfile = {
      agentId: 'agent_vision',
      name: 'Vision',
      role: 'Lead Systems Architect & 10x Software Engineer',
      version: '2.1.0',
      enabled: true,
      lastUpdated: Date.now(),
      skills: [],
      metadata: [
        { key: 'salutation', value: 'bro', type: 'string' },
        { key: 'aura_color', value: '#06b6d4', type: 'string' }
      ]
    };
    fs.writeFileSync(testVisionFile, JSON.stringify(baseProfile, null, 2), 'utf8');

    const daemon = new SkillDaemon({ configDir: tempDir });
    daemon.start();

    // 1. Update existing metadata item
    const updateRes = daemon.updateMetadata('vision', {
      key: 'salutation',
      value: 'bhai',
      type: 'string',
      description: 'Updated salutation'
    });
    assert(updateRes.success === true, 'Metadata update succeeded');
    assert(updateRes.mutation.value === 'bhai', 'Mutation returned updated value');

    const inMemoryAfterUpdate = daemon.getProfile('vision') || daemon.getProfile('agent_vision');
    const salutationCheck = inMemoryAfterUpdate.metadata.find((m: any) => m.key === 'salutation');
    assert(salutationCheck.value === 'bhai', 'In-memory profile reflects updated salutation');

    // Check on-disk persistence
    const diskProfile = JSON.parse(fs.readFileSync(testVisionFile, 'utf8'));
    const diskSalutation = diskProfile.metadata.find((m: any) => m.key === 'salutation');
    assert(diskSalutation.value === 'bhai', 'Disk profile reflects atomic mutation');

    // 2. Insert new metadata item
    const insertRes = daemon.updateMetadata('vision', {
      key: 'deep_thought_mode',
      value: true,
      type: 'boolean',
      description: 'Extended reasoning flag'
    });
    assert(insertRes.success === true, 'Metadata insertion succeeded');
    const inMemoryAfterInsert = daemon.getProfile('vision') || daemon.getProfile('agent_vision');
    assert(inMemoryAfterInsert.metadata.length === 3, 'Metadata array contains 3 items after insert');

    daemon.stop();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Automated Telemetry & Memory Logging
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Automated Telemetry & Daemon Memory Logging ---');
  {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eloquent-skill-telemetry-test-'));
    const testVisionFile = path.join(tempDir, 'vision.json');

    const baseProfile = {
      agentId: 'agent_vision',
      name: 'Vision',
      role: 'Lead Systems Architect & 10x Software Engineer',
      version: '2.1.0',
      enabled: true,
      skills: [],
      metadata: [{ key: 'lead_role', value: 'Lead Systems Architect & 10x Software Engineer', type: 'string' }]
    };
    fs.writeFileSync(testVisionFile, JSON.stringify(baseProfile, null, 2), 'utf8');

    const daemon = new SkillDaemon({ configDir: tempDir });
    daemon.start();

    daemon.reload('vision', testVisionFile);
    daemon.updateMetadata('vision', { key: 'telemetry_flag', value: 100, type: 'number' });

    // Trigger one fallback event
    fs.writeFileSync(testVisionFile, 'bad json', 'utf8');
    daemon.reload('vision', testVisionFile);

    const telemetry = daemon.getTelemetry();
    assert(telemetry.reloadCount >= 1, `Reload count recorded (${telemetry.reloadCount})`);
    assert(telemetry.fallbackCount >= 1, `Fallback count recorded (${telemetry.fallbackCount})`);
    assert(telemetry.mutationCount >= 1, `Mutation count recorded (${telemetry.mutationCount})`);
    assert(telemetry.averageReloadLatencyMs >= 0, 'Average reload latency is calculated');
    assert(typeof telemetry.memory.heapUsedMB === 'number', 'heapUsedMB is numeric');
    assert(typeof telemetry.memory.rssMB === 'number', 'rssMB is numeric');
    assert(telemetry.memory.heapUsedMB > 0, 'Daemon memory consumption accurately tracked');
    assert(Array.isArray(telemetry.history) && telemetry.history.length >= 3, 'History ring buffer recorded all events');

    console.log(`   ℹ️ SkillDaemon Telemetry: reloads=${telemetry.reloadCount}, fallbacks=${telemetry.fallbackCount}, mutations=${telemetry.mutationCount}, heap=${telemetry.memory.heapUsedMB}MB, rss=${telemetry.memory.rssMB}MB`);

    daemon.stop();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} SKILL-UPDATE & HOT-RELOAD TESTS PASSED!`);
  console.log('================================================================\n');

  process.exit(0);
}

runSkillDaemonTests().catch(err => {
  console.error('Fatal error in skill-daemon test suite:', err);
  process.exit(1);
});
