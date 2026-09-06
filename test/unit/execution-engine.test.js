/**
 * test/unit/execution-engine.test.js
 *
 * Unit Test Suite for Antigravity Execution Engine
 * Validates intent parsing, step validation, whitelist security checks,
 * sequential step execution, abort signal handling, and persona logging.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ExecutionEngine } = require('../../dist-ts/src/main/execution-engine');

async function runTests() {
  console.log('🧪 Running Antigravity ExecutionEngine Unit Test Suite...\n');

  const engine = ExecutionEngine.getInstance();

  // Test 1: Intent Parsing & Plan Initialization
  {
    console.log('▶ Test 1: Intent parsing & plan initialization');
    const plan = engine.parseIntent('Get system info');
    assert.strictEqual(typeof plan.id, 'string');
    assert.strictEqual(plan.steps.length, 1);
    assert.strictEqual(plan.steps[0].operation, 'system_info');
    assert.strictEqual(plan.status, 'PENDING');
    console.log('  ✅ Test 1 Passed: Intent parsed into valid ExecutionPlan');
  }

  // Test 2: Whitelist Security Rejection (Prohibited Operation/Command)
  {
    console.log('▶ Test 2: Whitelist security rejection of dangerous operation');
    assert.throws(() => {
      engine.parseIntent({
        steps: [
          {
            operation: 'dangerous_eval',
            description: 'Unauthorized execution'
          }
        ]
      });
    }, /not in the security whitelist/);

    assert.throws(() => {
      engine.parseIntent({
        steps: [
          {
            operation: 'process_run',
            command: 'rm -rf /',
            description: 'Destructive command'
          }
        ]
      });
    }, /not permitted for execution/);

    console.log('  ✅ Test 2 Passed: Unauthorized operations and prohibited commands rejected');
  }

  // Test 3: Plan Execution (system_info & file_write & file_read)
  {
    console.log('▶ Test 3: Sequential step execution (system_info, file_write, file_read)');
    const testFile = 'temp_test_execution_file.txt';
    const testContent = 'Hello Antigravity Execution Engine';

    const plan = engine.parseIntent({
      steps: [
        {
          operation: 'system_info',
          description: 'Fetch system metrics'
        },
        {
          operation: 'file_write',
          description: 'Write test file',
          targetPath: testFile,
          content: testContent
        },
        {
          operation: 'file_read',
          description: 'Read test file back',
          targetPath: testFile
        }
      ]
    });

    let progressEventsCount = 0;
    const result = await engine.executePlan(plan.id, (statusPayload) => {
      progressEventsCount++;
      assert.strictEqual(statusPayload.planId, plan.id);
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.completedSteps, 3);
    assert.strictEqual(result.totalSteps, 3);
    assert.ok(progressEventsCount > 0);

    // Verify written file exists and clean up
    const resolvedPath = path.resolve(process.cwd(), testFile);
    assert.ok(fs.existsSync(resolvedPath));
    const content = fs.readFileSync(resolvedPath, 'utf8');
    assert.strictEqual(content, testContent);
    fs.unlinkSync(resolvedPath);

    console.log('  ✅ Test 3 Passed: Steps executed sequentially, file written and verified');
  }

  // Test 4: Plan Abort Functionality
  {
    console.log('▶ Test 4: Abort plan execution');
    const plan = engine.parseIntent({
      steps: [
        {
          operation: 'process_run',
          command: 'node',
          args: ['-e', 'setTimeout(() => {}, 5000)']
        }
      ]
    });

    const execPromise = engine.executePlan(plan.id);
    setTimeout(() => {
      const aborted = engine.abortPlan(plan.id);
      assert.strictEqual(aborted, true);
    }, 50);

    const result = await execPromise;
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Execution aborted by user');

    const statusPayload = engine.getPlanStatus(plan.id);
    assert.strictEqual(statusPayload.status, 'ABORTED');
    console.log('  ✅ Test 4 Passed: Plan execution aborted upon user signal');
  }

  // Test 5: Persona Sovereignty & Telemetry Log Formatting
  {
    console.log('▶ Test 5: Persona sovereignty telemetry logs');
    const plan = engine.parseIntent('Trigger audio cue');
    const result = await engine.executePlan(plan.id);

    assert.strictEqual(result.success, true);
    const hasPersonaLogs = result.logs.some(l => l.includes('Tuk Tuk') || l.includes('DD') || l.includes('Vision') || l.includes('Friday'));
    assert.strictEqual(hasPersonaLogs, true);
    console.log('  ✅ Test 5 Passed: Persona telemetry logs included in execution telemetry');
  }

  console.log('\n🌟 All Antigravity ExecutionEngine Unit Tests Passed Successfully! 🚀');
}

runTests().catch(err => {
  console.error('❌ ExecutionEngine unit tests failed:', err);
  process.exit(1);
});
