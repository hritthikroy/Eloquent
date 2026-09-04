/**
 * Integration tests for the complete prompt system
 * Tests end-to-end flow from template creation to rendering to optimization
 */

const { PromptTemplate } = require('../../src/prompt/template');
const { PromptRenderer, FallbackStrategy } = require('../../src/prompt/renderer');
const { PromptOptimizer, OptimizerPresets } = require('../../src/core/prompt-optimizer');
const assert = require('assert');

// Test suite utilities
function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    process.exit(1);
  }
}

// ============================================================================
// End-to-End Flow Tests
// ============================================================================

runTest('Integration: Full template → render → optimize flow', () => {
  // Create template
  const template = new PromptTemplate(
    'Clear Technical Objective\n{{objective}}\n\nKey Files / Architecture\n{{files}}',
    { maxTokens: 256 }
  );

  // Render with variables
  const renderer = new PromptRenderer(template);
  const rendered = renderer.render({
    objective: 'Implement audio processing pipeline',
    files: '- src/audio.js: Core audio handler'
  });

  // Optimize result
  const optimizer = new PromptOptimizer({ maxTokens: 256 });
  const result = optimizer.optimizeMetaPrompt(rendered);

  assert.ok(result.prompt.length > 0);
  assert.ok(result.tokenCount > 0);
  assert.ok(result.withinLimit);
});

runTest('Integration: Meta-prompt optimization with token limit', () => {
  const metaPrompt = `Clear Technical Objective
Refactor the audio backend for high throughput processing.

Key Files / Architecture
- backend-go/main.go: Primary audio server
- src/audio-recorder.js: Node.js recording manager

Quality Requirements & AST Verification
- Verify zero audio clipping during high load
- Ensure Go memory heap stays under 50MB`;

  const optimizer = new PromptOptimizer({ maxTokens: 256 });
  const result = optimizer.optimizeMetaPrompt(metaPrompt);

  assert.ok(result.prompt.length > 0);
  assert.strictEqual(typeof result.tokenCount, 'number');
  assert.ok(Array.isArray(result.warnings));
});

runTest('Integration: Template with missing variables and optimization', () => {
  const template = new PromptTemplate('Task: {{task}}, Owner: {{owner}}');
  const renderer = new PromptRenderer(template);
  
  // Render with missing variable
  const rendered = renderer.render(
    { task: 'Build feature' },
    { fallbackStrategy: FallbackStrategy.EMPTY }
  );

  const optimizer = OptimizerPresets.lenient();
  const result = optimizer.optimizeMetaPrompt(rendered);

  assert.strictEqual(result.prompt, 'Task: Build feature, Owner:');
});

runTest('Integration: Section extraction from meta-prompt', () => {
  const metaPrompt = `Clear Technical Objective
Build a new feature for audio processing

Key Files / Architecture
- src/main.js: Entry point

Quality Requirements & AST Verification
- Run all tests
- Verify syntax`;

  const optimizer = new PromptOptimizer();
  const sections = optimizer.extractSections(metaPrompt);

  assert.ok(sections.objective.includes('audio processing'));
  assert.ok(sections.architecture.includes('src/main.js'));
  assert.ok(sections.quality.includes('Run all tests'));
});

runTest('Integration: Token budget management', () => {
  const optimizer = new PromptOptimizer({ maxTokens: 100 });
  const prompt = 'This is a test prompt';
  
  const remaining = optimizer.getRemainingTokenBudget(prompt);
  assert.ok(remaining > 0);
  assert.ok(remaining < 100);

  const canAdd = optimizer.canAddContent(prompt, 'Additional content');
  assert.strictEqual(typeof canAdd, 'boolean');
});

runTest('Integration: Strict mode enforcement', () => {
  const longPrompt = 'a'.repeat(2000); // Way over 256 token limit
  const strictOptimizer = OptimizerPresets.strict();

  assert.throws(() => {
    strictOptimizer.optimizeMetaPrompt(longPrompt);
  }, /exceeds token limit/);
});

runTest('Integration: Lenient mode truncation', () => {
  const longPrompt = 'a'.repeat(2000);
  const lenientOptimizer = OptimizerPresets.lenient();

  const result = lenientOptimizer.optimizeMetaPrompt(longPrompt);
  
  assert.ok(result.tokenCount <= 256 || result.prompt.endsWith('...'));
  assert.ok(result.warnings.length > 0);
});

runTest('Integration: Template creation with static method', () => {
  const prompt = PromptOptimizer.createFromTemplate(
    'Hello {{name}}, your task is {{task}}',
    { name: 'Developer', task: 'optimize code' },
    { maxTokens: 256, singleLine: true }
  );

  assert.ok(prompt.includes('Developer'));
  assert.ok(prompt.includes('optimize code'));
});

runTest('Integration: Batch optimization', () => {
  const prompts = [
    'First prompt to optimize',
    'Second prompt to optimize',
    'Third prompt to optimize'
  ];

  const optimizer = new PromptOptimizer();
  const results = optimizer.batchOptimize(prompts);

  assert.strictEqual(results.length, 3);
  results.forEach((result) => {
    assert.ok(result.prompt);
    assert.ok(typeof result.tokenCount === 'number');
  });
});

runTest('Integration: Validation with errors and warnings', () => {
  const optimizer = new PromptOptimizer({ maxTokens: 10 });
  
  // Empty prompt
  const emptyValidation = optimizer.validatePrompt('');
  assert.strictEqual(emptyValidation.valid, false);
  assert.ok(emptyValidation.errors.length > 0);

  // Prompt with suspicious content
  const suspiciousValidation = optimizer.validatePrompt('Value is undefined here');
  assert.ok(suspiciousValidation.warnings.length > 0);
});

runTest('Integration: Unicode and emoji handling', () => {
  const template = new PromptTemplate('Status: {{status}} {{emoji}}');
  const renderer = new PromptRenderer(template);
  const rendered = renderer.render({
    status: '完成',
    emoji: '🎉'
  });

  const optimizer = new PromptOptimizer();
  const result = optimizer.optimizeMetaPrompt(rendered);

  assert.ok(result.prompt.includes('完成'));
  assert.ok(result.prompt.includes('🎉'));
});

runTest('Integration: Multi-line to single-line conversion', () => {
  const multilinePrompt = `Line 1
Line 2
Line 3`;

  const optimizer = new PromptOptimizer({ singleLine: true });
  const result = optimizer.optimizeMetaPrompt(multilinePrompt);

  assert.ok(!result.prompt.includes('\n'));
  assert.ok(result.prompt.includes('Line 1'));
  assert.ok(result.prompt.includes('Line 3'));
});

runTest('Integration: Preset configurations', () => {
  const strictOpt = OptimizerPresets.strict();
  const lenientOpt = OptimizerPresets.lenient();
  const multilineOpt = OptimizerPresets.multiline();
  const extendedOpt = OptimizerPresets.extended();

  assert.strictEqual(strictOpt.enforceLimit, true);
  assert.strictEqual(lenientOpt.enforceLimit, false);
  assert.strictEqual(multilineOpt.singleLine, false);
  assert.strictEqual(extendedOpt.maxTokens, 512);
});

runTest('Integration: Complex nested variable rendering', () => {
  const template = new PromptTemplate('User: {{user.name}}, Role: {{user.role}}, Project: {{project.name}}');
  const renderer = new PromptRenderer(template);
  
  const rendered = renderer.render({
    user: { name: 'Alice', role: 'Developer' },
    project: { name: 'AudioEngine' }
  });

  const optimizer = new PromptOptimizer();
  const result = optimizer.optimizeMetaPrompt(rendered);

  assert.ok(result.prompt.includes('Alice'));
  assert.ok(result.prompt.includes('Developer'));
  assert.ok(result.prompt.includes('AudioEngine'));
});

runTest('Integration: Token count accuracy', () => {
  const texts = [
    'Hello',           // 5 chars = 2 tokens
    'Hello world',     // 11 chars = 3 tokens
    'a'.repeat(100),   // 100 chars = 25 tokens
  ];

  const optimizer = new PromptOptimizer();
  
  texts.forEach((text) => {
    const count = optimizer.estimateTokenCount(text);
    const expected = Math.ceil(text.length / 4);
    assert.strictEqual(count, expected);
  });
});

console.log('\n✅ All integration tests passed!');
