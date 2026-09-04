/**
 * Unit tests for PromptRenderer
 * Tests variable injection, token limit enforcement, error handling, single-line formatting
 */

const { PromptTemplate } = require('../../src/prompt/template');
const { PromptRenderer, RenderOptions, FallbackStrategy } = require('../../src/prompt/renderer');
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
// Basic Rendering Tests
// ============================================================================

runTest('PromptRenderer: requires PromptTemplate instance', () => {
  assert.throws(() => {
    new PromptRenderer('not a template');
  }, /PromptRenderer requires a PromptTemplate instance/);
});

runTest('PromptRenderer: renders simple template', () => {
  const template = new PromptTemplate('Hello {{name}}!');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({ name: 'World' });
  assert.strictEqual(result, 'Hello World!');
});

runTest('PromptRenderer: renders multiple variables', () => {
  const template = new PromptTemplate('{{greeting}} {{name}}, welcome to {{place}}!');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({
    greeting: 'Hello',
    name: 'Alice',
    place: 'Wonderland'
  });
  assert.strictEqual(result, 'Hello Alice, welcome to Wonderland!');
});

runTest('PromptRenderer: handles nested variables', () => {
  const template = new PromptTemplate('{{user.name}} from {{user.location.city}}');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({
    user: {
      name: 'Bob',
      location: { city: 'NYC' }
    }
  });
  assert.strictEqual(result, 'Bob from NYC');
});

// ============================================================================
// Fallback Strategy Tests
// ============================================================================

runTest('FallbackStrategy.EMPTY: replaces missing variable with empty string', () => {
  const template = new PromptTemplate('Hello {{name}}!');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({}, { fallbackStrategy: FallbackStrategy.EMPTY });
  assert.strictEqual(result, 'Hello !');
});

runTest('FallbackStrategy.PRESERVE: keeps placeholder for missing variable', () => {
  const template = new PromptTemplate('Hello {{name}}!');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({}, { fallbackStrategy: FallbackStrategy.PRESERVE });
  assert.strictEqual(result, 'Hello {{name}}!');
});

runTest('FallbackStrategy.ERROR: throws on missing variable', () => {
  const template = new PromptTemplate('Hello {{name}}!');
  const renderer = new PromptRenderer(template);
  assert.throws(() => {
    renderer.render({}, { fallbackStrategy: FallbackStrategy.ERROR });
  }, /Missing required variables: name/);
});

runTest('FallbackStrategy.DEFAULT: uses default values', () => {
  const template = new PromptTemplate('Hello {{name}}!');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({}, {
    fallbackStrategy: FallbackStrategy.DEFAULT,
    defaultValues: { name: 'Guest' }
  });
  assert.strictEqual(result, 'Hello Guest!');
});

// ============================================================================
// Single-Line Conversion Tests
// ============================================================================

runTest('Single-line: converts multi-line to single line', () => {
  const template = new PromptTemplate('Line 1\nLine 2\nLine 3');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({}, { singleLine: true });
  assert.strictEqual(result, 'Line 1 Line 2 Line 3');
});

runTest('Single-line: removes extra whitespace', () => {
  const template = new PromptTemplate('Too    many     spaces');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({}, { singleLine: true });
  assert.strictEqual(result, 'Too many spaces');
});

runTest('Single-line: can be disabled', () => {
  const template = new PromptTemplate('Line 1\nLine 2');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({}, { singleLine: false });
  assert.strictEqual(result, 'Line 1\nLine 2');
});

runTest('Single-line: preserves semantic spacing', () => {
  const template = new PromptTemplate('First sentence.\n\nSecond paragraph.');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({}, { singleLine: true });
  assert.strictEqual(result, 'First sentence. Second paragraph.');
});

// ============================================================================
// Token Limit Enforcement Tests
// ============================================================================

runTest('Token limit: allows prompts within limit', () => {
  const template = new PromptTemplate('Short prompt', { maxTokens: 256 });
  const renderer = new PromptRenderer(template);
  const result = renderer.render({});
  assert.ok(result.length > 0);
});

runTest('Token limit: throws when exceeding and truncation disabled', () => {
  const template = new PromptTemplate('Test {{content}}', { maxTokens: 10 });
  const renderer = new PromptRenderer(template);
  assert.throws(() => {
    renderer.render(
      { content: 'a'.repeat(200) },
      { enforceTokenLimit: true, truncateIfExceeds: false }
    );
  }, /Rendered prompt exceeds token limit/);
});

runTest('Token limit: truncates when exceeding and truncation enabled', () => {
  const template = new PromptTemplate('Test {{content}}', { maxTokens: 10 });
  const renderer = new PromptRenderer(template);
  const result = renderer.render(
    { content: 'a'.repeat(200) },
    { enforceTokenLimit: true, truncateIfExceeds: true }
  );
  assert.ok(result.length < 200); // Should be truncated
  assert.ok(result.endsWith('...')); // Truncation indicator
});

runTest('Token limit: can be bypassed', () => {
  const template = new PromptTemplate('Test {{content}}', { maxTokens: 10 });
  const renderer = new PromptRenderer(template);
  const result = renderer.render(
    { content: 'a'.repeat(200) },
    { enforceTokenLimit: false }
  );
  assert.ok(result.length > 100); // Not truncated
});

// ============================================================================
// Validation Tests
// ============================================================================

runTest('renderWithValidation: returns full result object', () => {
  const template = new PromptTemplate('Hello {{name}}!');
  const renderer = new PromptRenderer(template);
  const result = renderer.renderWithValidation({ name: 'World' });
  
  assert.strictEqual(result.prompt, 'Hello World!');
  assert.ok(result.tokenCount > 0);
  assert.ok(Array.isArray(result.warnings));
  assert.strictEqual(result.withinLimit, true);
});

runTest('renderWithValidation: collects warnings', () => {
  const template = new PromptTemplate('Hello {{name}}!');
  const renderer = new PromptRenderer(template);
  const result = renderer.renderWithValidation({}, {
    fallbackStrategy: FallbackStrategy.EMPTY
  });
  
  assert.ok(result.warnings.length > 0);
  assert.ok(result.warnings[0].includes('Missing variable'));
});

runTest('renderWithValidation: detects token limit violations', () => {
  const template = new PromptTemplate('Test {{content}}', { maxTokens: 5 });
  const renderer = new PromptRenderer(template);
  const result = renderer.renderWithValidation(
    { content: 'a'.repeat(100) },
    { truncateIfExceeds: true }
  );
  
  assert.strictEqual(result.withinLimit, false);
  assert.ok(result.warnings.some(w => w.includes('truncated')));
});

// ============================================================================
// Batch Rendering Tests
// ============================================================================

runTest('renderBatch: renders multiple variable sets', () => {
  const template = new PromptTemplate('Hello {{name}}!');
  const renderer = new PromptRenderer(template);
  const results = renderer.renderBatch([
    { name: 'Alice' },
    { name: 'Bob' },
    { name: 'Charlie' }
  ]);
  
  assert.strictEqual(results.length, 3);
  assert.strictEqual(results[0], 'Hello Alice!');
  assert.strictEqual(results[1], 'Hello Bob!');
  assert.strictEqual(results[2], 'Hello Charlie!');
});

runTest('renderBatch: applies same options to all', () => {
  const template = new PromptTemplate('Hello {{name}}!');
  const renderer = new PromptRenderer(template);
  const results = renderer.renderBatch(
    [{}, {}, {}],
    { fallbackStrategy: FallbackStrategy.PRESERVE }
  );
  
  results.forEach(result => {
    assert.strictEqual(result, 'Hello {{name}}!');
  });
});

// ============================================================================
// Static Helper Tests
// ============================================================================

runTest('Static render: works without creating instance', () => {
  const template = new PromptTemplate('Quick {{test}}');
  const result = PromptRenderer.render(template, { test: 'render' });
  assert.strictEqual(result, 'Quick render');
});

runTest('Static renderFromString: creates template and renders', () => {
  const result = PromptRenderer.renderFromString(
    'Hello {{name}}!',
    { name: 'World' }
  );
  assert.strictEqual(result, 'Hello World!');
});

runTest('Static renderFromString: accepts template options', () => {
  const result = PromptRenderer.renderFromString(
    'Test',
    {},
    { locale: 'es-ES', maxTokens: 100 }
  );
  assert.strictEqual(result, 'Test');
});

// ============================================================================
// Sanitization Tests
// ============================================================================

runTest('Sanitization: escapes placeholder injection attempts', () => {
  const template = new PromptTemplate('User said: {{message}}');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({ message: '{{injection}}' });
  assert.strictEqual(result, 'User said: { {injection} }');
});

runTest('Sanitization: removes newlines from variables', () => {
  const template = new PromptTemplate('Message: {{text}}');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({ text: 'Line 1\nLine 2' });
  assert.strictEqual(result, 'Message: Line 1 Line 2');
});

runTest('Sanitization: handles null values', () => {
  const template = new PromptTemplate('Value: {{val}}');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({ val: null });
  assert.strictEqual(result, 'Value:');
});

runTest('Sanitization: handles undefined values', () => {
  const template = new PromptTemplate('Value: {{val}}');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({ val: undefined });
  assert.strictEqual(result, 'Value:');
});

// ============================================================================
// RenderOptions Tests
// ============================================================================

runTest('RenderOptions: uses defaults correctly', () => {
  const opts = new RenderOptions();
  assert.strictEqual(opts.fallbackStrategy, FallbackStrategy.EMPTY);
  assert.strictEqual(opts.truncateIfExceeds, true);
  assert.strictEqual(opts.singleLine, true);
  assert.strictEqual(opts.enforceTokenLimit, true);
});

runTest('RenderOptions: accepts custom values', () => {
  const opts = new RenderOptions({
    fallbackStrategy: FallbackStrategy.PRESERVE,
    truncateIfExceeds: false,
    singleLine: false
  });
  assert.strictEqual(opts.fallbackStrategy, FallbackStrategy.PRESERVE);
  assert.strictEqual(opts.truncateIfExceeds, false);
  assert.strictEqual(opts.singleLine, false);
});

// ============================================================================
// Unicode Handling Tests
// ============================================================================

runTest('Unicode: handles Chinese characters', () => {
  const template = new PromptTemplate('{{greeting}} {{name}}');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({ greeting: '你好', name: '世界' });
  assert.strictEqual(result, '你好 世界');
});

runTest('Unicode: handles emoji', () => {
  const template = new PromptTemplate('Status: {{emoji}}');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({ emoji: '🚀✨' });
  assert.strictEqual(result, 'Status: 🚀✨');
});

runTest('Unicode: handles mixed scripts', () => {
  const template = new PromptTemplate('{{text}}');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({ text: 'Hello مرحبا 你好 🌍' });
  assert.strictEqual(result, 'Hello مرحبا 你好 🌍');
});

// ============================================================================
// Edge Cases
// ============================================================================

runTest('Edge case: template with no variables', () => {
  const template = new PromptTemplate('Static text');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({});
  assert.strictEqual(result, 'Static text');
});

runTest('Edge case: empty variables object', () => {
  const template = new PromptTemplate('Test {{var}}');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({}, { fallbackStrategy: FallbackStrategy.EMPTY });
  assert.strictEqual(result, 'Test');
});

runTest('Edge case: variable with special characters', () => {
  const template = new PromptTemplate('Code: {{code}}');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({ code: '<script>alert("xss")</script>' });
  assert.ok(result.includes('script')); // Not HTML-escaped, just placeholder-escaped
});

runTest('Edge case: same placeholder used multiple times', () => {
  const template = new PromptTemplate('{{x}} and {{x}} and {{x}}');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({ x: 'repeated' });
  assert.strictEqual(result, 'repeated and repeated and repeated');
});

runTest('Edge case: deeply nested variable', () => {
  const template = new PromptTemplate('{{a.b.c.d.e}}');
  const renderer = new PromptRenderer(template);
  const result = renderer.render({
    a: { b: { c: { d: { e: 'deep' } } } }
  });
  assert.strictEqual(result, 'deep');
});

console.log('\n✅ All PromptRenderer tests passed!');
