/**
 * Unit tests for PromptTemplate
 * Covers edge cases: missing vars, excess length, Unicode handling, token counting
 */

const { PromptTemplate, estimateTokenCount, extractPlaceholders, validatePlaceholderName } = require('../../src/prompt/template');
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
// Token Counting Tests
// ============================================================================

runTest('estimateTokenCount: counts empty string as 0 tokens', () => {
  assert.strictEqual(estimateTokenCount(''), 0);
});

runTest('estimateTokenCount: estimates basic text correctly', () => {
  const text = 'Hello world';
  const tokens = estimateTokenCount(text);
  assert.strictEqual(tokens, 3); // 11 chars / 4 = 2.75 -> 3
});

runTest('estimateTokenCount: handles Unicode characters', () => {
  const text = '你好世界'; // 4 Chinese characters
  const tokens = estimateTokenCount(text);
  assert.strictEqual(tokens, 1); // 4 chars / 4 = 1
});

runTest('estimateTokenCount: handles emoji', () => {
  const text = '🚀🎉✨';
  const tokens = estimateTokenCount(text);
  assert.strictEqual(tokens, 1); // 3 emoji / 4 = 0.75 -> 1
});

runTest('estimateTokenCount: returns 0 for null', () => {
  assert.strictEqual(estimateTokenCount(null), 0);
});

// ============================================================================
// Placeholder Extraction Tests
// ============================================================================

runTest('extractPlaceholders: finds single placeholder', () => {
  const placeholders = extractPlaceholders('Hello {{name}}');
  assert.deepStrictEqual(placeholders, ['name']);
});

runTest('extractPlaceholders: finds multiple placeholders', () => {
  const placeholders = extractPlaceholders('{{greeting}} {{name}}, welcome to {{place}}');
  assert.deepStrictEqual(placeholders, ['greeting', 'name', 'place']);
});

runTest('extractPlaceholders: handles nested property access', () => {
  const placeholders = extractPlaceholders('{{user.name}} from {{user.location.city}}');
  assert.deepStrictEqual(placeholders, ['user.name', 'user.location.city']);
});

runTest('extractPlaceholders: returns empty array for no placeholders', () => {
  const placeholders = extractPlaceholders('No placeholders here');
  assert.deepStrictEqual(placeholders, []);
});

runTest('extractPlaceholders: handles duplicate placeholders', () => {
  const placeholders = extractPlaceholders('{{name}} and {{name}} again');
  assert.deepStrictEqual(placeholders, ['name']); // Deduplicated
});

// ============================================================================
// Placeholder Validation Tests
// ============================================================================

runTest('validatePlaceholderName: accepts valid simple name', () => {
  assert.strictEqual(validatePlaceholderName('username'), true);
});

runTest('validatePlaceholderName: accepts valid nested name', () => {
  assert.strictEqual(validatePlaceholderName('user.name'), true);
});

runTest('validatePlaceholderName: accepts numbers in name', () => {
  assert.strictEqual(validatePlaceholderName('item123'), true);
});

runTest('validatePlaceholderName: rejects invalid characters', () => {
  assert.strictEqual(validatePlaceholderName('user-name'), false);
  assert.strictEqual(validatePlaceholderName('user@domain'), false);
  assert.strictEqual(validatePlaceholderName('user name'), false);
});

runTest('validatePlaceholderName: rejects empty string', () => {
  assert.strictEqual(validatePlaceholderName(''), false);
});

// ============================================================================
// PromptTemplate Constructor Tests
// ============================================================================

runTest('PromptTemplate: creates instance with valid template', () => {
  const template = new PromptTemplate('Hello {{name}}');
  assert.strictEqual(template.template, 'Hello {{name}}');
  assert.strictEqual(template.locale, 'en-US');
  assert.strictEqual(template.maxTokens, 256);
});

runTest('PromptTemplate: throws on empty template', () => {
  assert.throws(() => {
    new PromptTemplate('');
  }, /Template must be a non-empty string/);
});

runTest('PromptTemplate: throws on null template', () => {
  assert.throws(() => {
    new PromptTemplate(null);
  }, /Template must be a non-empty string/);
});

runTest('PromptTemplate: accepts custom locale', () => {
  const template = new PromptTemplate('Hola {{nombre}}', { locale: 'es-ES' });
  assert.strictEqual(template.locale, 'es-ES');
});

runTest('PromptTemplate: accepts custom maxTokens', () => {
  const template = new PromptTemplate('Test', { maxTokens: 100 });
  assert.strictEqual(template.maxTokens, 100);
});

runTest('PromptTemplate: throws on invalid placeholder names', () => {
  assert.throws(() => {
    new PromptTemplate('Hello {{user-name}}');
  }, /Invalid placeholder name: user-name/);
});

runTest('PromptTemplate: throws when template exceeds token limit', () => {
  const longTemplate = 'a'.repeat(1100); // ~275 tokens
  assert.throws(() => {
    new PromptTemplate(longTemplate, { maxTokens: 256 });
  }, /Template exceeds token limit/);
});

runTest('PromptTemplate: extracts placeholders correctly', () => {
  const template = new PromptTemplate('{{greeting}} {{name}}!');
  const placeholders = template.getPlaceholders();
  assert.deepStrictEqual(placeholders, ['greeting', 'name']);
});

// ============================================================================
// Token Count Tests
// ============================================================================

runTest('PromptTemplate.getTokenCount: returns correct estimate', () => {
  const template = new PromptTemplate('Hello world, this is a test.');
  const tokens = template.getTokenCount();
  assert.strictEqual(tokens, 7); // 28 chars / 4 = 7
});

// ============================================================================
// Variable Validation Tests
// ============================================================================

runTest('PromptTemplate.validateVariables: passes with all variables', () => {
  const template = new PromptTemplate('{{greeting}} {{name}}');
  const result = template.validateVariables({ greeting: 'Hello', name: 'World' });
  assert.strictEqual(result.valid, true);
  assert.deepStrictEqual(result.missing, []);
});

runTest('PromptTemplate.validateVariables: detects missing variable', () => {
  const template = new PromptTemplate('{{greeting}} {{name}}');
  const result = template.validateVariables({ greeting: 'Hello' });
  assert.strictEqual(result.valid, false);
  assert.deepStrictEqual(result.missing, ['name']);
});

runTest('PromptTemplate.validateVariables: handles nested variables', () => {
  const template = new PromptTemplate('{{user.name}} from {{user.city}}');
  const result = template.validateVariables({
    user: { name: 'Alice', city: 'NYC' }
  });
  assert.strictEqual(result.valid, true);
});

runTest('PromptTemplate.validateVariables: detects missing nested variable', () => {
  const template = new PromptTemplate('{{user.name}} from {{user.city}}');
  const result = template.validateVariables({ user: { name: 'Alice' } });
  assert.strictEqual(result.valid, false);
  assert.deepStrictEqual(result.missing, ['user.city']);
});

// ============================================================================
// Nested Property Resolution Tests
// ============================================================================

runTest('resolveNestedProperty: resolves simple property', () => {
  const template = new PromptTemplate('{{name}}');
  const value = template.resolveNestedProperty({ name: 'Test' }, 'name');
  assert.strictEqual(value, 'Test');
});

runTest('resolveNestedProperty: resolves nested property', () => {
  const template = new PromptTemplate('{{user.name}}');
  const value = template.resolveNestedProperty({ user: { name: 'Alice' } }, 'user.name');
  assert.strictEqual(value, 'Alice');
});

runTest('resolveNestedProperty: returns undefined for missing path', () => {
  const template = new PromptTemplate('{{user.name}}');
  const value = template.resolveNestedProperty({ user: {} }, 'user.name');
  assert.strictEqual(value, undefined);
});

runTest('resolveNestedProperty: handles deep nesting', () => {
  const template = new PromptTemplate('{{a.b.c.d}}');
  const obj = { a: { b: { c: { d: 'deep' } } } };
  const value = template.resolveNestedProperty(obj, 'a.b.c.d');
  assert.strictEqual(value, 'deep');
});

// ============================================================================
// Locale Tests
// ============================================================================

runTest('withLocale: creates new template with different locale', () => {
  const template = new PromptTemplate('Hello {{name}}', { locale: 'en-US' });
  const spanish = template.withLocale('es-ES');
  assert.strictEqual(spanish.locale, 'es-ES');
  assert.strictEqual(spanish.template, template.template);
  assert.notStrictEqual(spanish.id, template.id); // Different instance
});

// ============================================================================
// Serialization Tests
// ============================================================================

runTest('toJSON: serializes template correctly', () => {
  const template = new PromptTemplate('Hello {{name}}', { 
    locale: 'en-US',
    metadata: { author: 'test' }
  });
  const json = template.toJSON();
  
  assert.strictEqual(json.template, 'Hello {{name}}');
  assert.strictEqual(json.locale, 'en-US');
  assert.strictEqual(json.maxTokens, 256);
  assert.deepStrictEqual(json.placeholders, ['name']);
  assert.strictEqual(json.metadata.author, 'test');
  assert.ok(json.id);
  assert.ok(json.createdAt);
  assert.strictEqual(json.tokenCount, 4); // "Hello {{name}}" = 14 chars / 4 = 3.5 -> 4
});

runTest('fromJSON: deserializes template correctly', () => {
  const original = new PromptTemplate('Test {{var}}', { locale: 'fr-FR' });
  const json = original.toJSON();
  const restored = PromptTemplate.fromJSON(json);
  
  assert.strictEqual(restored.template, original.template);
  assert.strictEqual(restored.locale, original.locale);
  assert.strictEqual(restored.maxTokens, original.maxTokens);
  assert.strictEqual(restored.id, original.id);
});

runTest('fromJSON: throws on invalid JSON', () => {
  assert.throws(() => {
    PromptTemplate.fromJSON({});
  }, /Invalid JSON: missing template field/);
});

// ============================================================================
// Utility Method Tests
// ============================================================================

runTest('hasPlaceholders: detects placeholders', () => {
  assert.strictEqual(PromptTemplate.hasPlaceholders('Hello {{name}}'), true);
  assert.strictEqual(PromptTemplate.hasPlaceholders('No placeholders'), false);
});

runTest('sanitizeValue: escapes placeholder delimiters', () => {
  const result = PromptTemplate.sanitizeValue('{{injection}}');
  assert.strictEqual(result, '{ {injection} }');
});

runTest('sanitizeValue: removes newlines', () => {
  const result = PromptTemplate.sanitizeValue('Line 1\nLine 2\rLine 3');
  assert.strictEqual(result, 'Line 1 Line 2 Line 3');
});

runTest('sanitizeValue: handles null/undefined', () => {
  assert.strictEqual(PromptTemplate.sanitizeValue(null), '');
  assert.strictEqual(PromptTemplate.sanitizeValue(undefined), '');
});

runTest('sanitizeValue: converts numbers to strings', () => {
  assert.strictEqual(PromptTemplate.sanitizeValue(123), '123');
});

runTest('sanitizeValue: handles Unicode correctly', () => {
  const result = PromptTemplate.sanitizeValue('你好 🚀');
  assert.strictEqual(result, '你好 🚀');
});

// ============================================================================
// Edge Cases
// ============================================================================

runTest('Edge case: template with only placeholders', () => {
  const template = new PromptTemplate('{{a}}{{b}}{{c}}');
  assert.deepStrictEqual(template.getPlaceholders(), ['a', 'b', 'c']);
});

runTest('Edge case: template with escaped braces in text', () => {
  const template = new PromptTemplate('Use { { } } for literal braces, {{var}} for variables');
  assert.deepStrictEqual(template.getPlaceholders(), ['var']);
});

runTest('Edge case: very long placeholder name', () => {
  const longName = 'a'.repeat(100);
  const template = new PromptTemplate(`{{${longName}}}`);
  assert.deepStrictEqual(template.getPlaceholders(), [longName]);
});

runTest('Edge case: template at exact token limit', () => {
  const text = 'a'.repeat(1024); // Exactly 256 tokens
  const template = new PromptTemplate(text, { maxTokens: 256 });
  assert.strictEqual(template.getTokenCount(), 256);
});

console.log('\n✅ All PromptTemplate tests passed!');
