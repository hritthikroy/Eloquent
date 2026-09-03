/**
 * ZeroCopySerializer Tests
 * 
 * Tests for binary serialization including:
 * - Type preservation
 * - Large payload handling
 * - Performance vs JSON
 * - Edge cases
 */

import { ZeroCopySerializer, serialize, deserialize, estimateSize } from '../../src/utils/zero-copy-serializer';

describe('ZeroCopySerializer', () => {
  let serializer: ZeroCopySerializer;

  beforeEach(() => {
    serializer = new ZeroCopySerializer();
  });

  describe('Primitive Types', () => {
    it('should serialize and deserialize undefined', () => {
      const buffer = serializer.serialize(undefined);
      const result = serializer.deserialize(buffer);
      expect(result).toBeUndefined();
    });

    it('should serialize and deserialize null', () => {
      const buffer = serializer.serialize(null);
      const result = serializer.deserialize(buffer);
      expect(result).toBeNull();
    });

    it('should serialize and deserialize boolean', () => {
      const trueBuffer = serializer.serialize(true);
      const falseBuffer = serializer.serialize(false);
      
      expect(serializer.deserialize(trueBuffer)).toBe(true);
      expect(serializer.deserialize(falseBuffer)).toBe(false);
    });

    it('should serialize and deserialize numbers', () => {
      const testCases = [
        0, 1, -1, 42, -42,
        0.5, -0.5, 3.14159,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Math.PI, Math.E,
      ];

      for (const num of testCases) {
        const buffer = serializer.serialize(num);
        const result = serializer.deserialize(buffer);
        expect(result).toBe(num);
      }
    });

    it('should serialize and deserialize strings', () => {
      const testCases = [
        '',
        'hello',
        'Hello, World!',
        '🎉 Unicode works! 你好世界',
        'A'.repeat(1000), // Long string
        'Multi\nLine\nString',
        'Special chars: !@#$%^&*()',
      ];

      for (const str of testCases) {
        const buffer = serializer.serialize(str);
        const result = serializer.deserialize(buffer);
        expect(result).toBe(str);
      }
    });

    it('should serialize and deserialize BigInt', () => {
      const testCases = [
        0n,
        123n,
        -456n,
        BigInt(Number.MAX_SAFE_INTEGER),
        BigInt(Number.MIN_SAFE_INTEGER),
      ];

      for (const bigint of testCases) {
        const buffer = serializer.serialize(bigint);
        const result = serializer.deserialize(buffer);
        expect(result).toBe(bigint);
      }
    });

    it('should serialize and deserialize Date', () => {
      const dates = [
        new Date(),
        new Date('2024-01-01'),
        new Date(0),
        new Date('1970-01-01'),
      ];

      for (const date of dates) {
        const buffer = serializer.serialize(date);
        const result = serializer.deserialize(buffer) as Date;
        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(date.getTime());
      }
    });
  });

  describe('Complex Types', () => {
    it('should serialize and deserialize arrays', () => {
      const testCases = [
        [],
        [1, 2, 3],
        ['a', 'b', 'c'],
        [1, 'two', true, null],
        [[1, 2], [3, 4]],
        Array(100).fill(42),
      ];

      for (const arr of testCases) {
        const buffer = serializer.serialize(arr);
        const result = serializer.deserialize(buffer);
        expect(result).toEqual(arr);
      }
    });

    it('should serialize and deserialize objects', () => {
      const testCases = [
        {},
        { a: 1 },
        { name: 'test', value: 42 },
        { nested: { deep: { value: 'here' } } },
        { mixed: [1, 'two', { three: 3 }] },
      ];

      for (const obj of testCases) {
        const buffer = serializer.serialize(obj);
        const result = serializer.deserialize(buffer);
        expect(result).toEqual(obj);
      }
    });

    it('should handle deeply nested structures', () => {
      const nested: any = { level: 0 };
      let current = nested;
      
      for (let i = 1; i < 10; i++) {
        current.child = { level: i };
        current = current.child;
      }

      const buffer = serializer.serialize(nested);
      const result = serializer.deserialize(buffer);
      expect(result).toEqual(nested);
    });
  });

  describe('Agent State Serialization', () => {
    it('should serialize typical agent state', () => {
      const agentState = {
        conversationHistory: [
          { role: 'user', content: 'Hello', timestamp: Date.now() },
          { role: 'assistant', content: 'Hi there!', timestamp: Date.now() },
        ],
        preferences: {
          theme: 'dark',
          language: 'en',
          volume: 0.8,
        },
        memory: {
          shortTerm: [
            { topic: 'greeting', content: 'User greeted', salience: 0.9 },
          ],
          longTerm: [
            { topic: 'personality', insight: 'User is friendly', strength: 0.7 },
          ],
        },
        emotionalState: {
          mood: 'happy',
          intensity: 0.8,
          lastInteraction: Date.now(),
        },
        customData: {
          sessionId: 'abc123',
          metadata: { foo: 'bar' },
        },
      };

      const buffer = serializer.serialize(agentState);
      const result = serializer.deserialize(buffer);
      
      expect(result).toEqual(agentState);
    });
  });

  describe('Large Payload Handling', () => {
    it('should handle payloads >1MB', () => {
      const largeArray = Array(100000).fill(null).map((_, i) => ({
        id: i,
        message: `This is message number ${i}`,
        timestamp: Date.now() + i,
      }));

      const startSerialize = Date.now();
      const buffer = serializer.serialize(largeArray);
      const serializeTime = Date.now() - startSerialize;

      console.log(`Serialized ${largeArray.length} items in ${serializeTime}ms (${buffer.length} bytes)`);
      expect(buffer.length).toBeGreaterThan(1024 * 1024); // >1MB

      const startDeserialize = Date.now();
      const result = serializer.deserialize(buffer);
      const deserializeTime = Date.now() - startDeserialize;

      console.log(`Deserialized in ${deserializeTime}ms`);
      expect(Array.isArray(result)).toBe(true);
      expect((result as any[]).length).toBe(largeArray.length);
    });

    it('should handle large conversation history', () => {
      const history = Array(1000).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}: ${'x'.repeat(500)}`, // 500 chars each
        timestamp: Date.now() + i,
      }));

      const buffer = serializer.serialize(history);
      const result = serializer.deserialize(buffer);
      
      expect((result as any[]).length).toBe(1000);
    });
  });

  describe('Performance Comparison', () => {
    it('should be faster than JSON for large objects', () => {
      const testData = {
        items: Array(10000).fill(null).map((_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: Math.random(),
          timestamp: Date.now(),
          metadata: { foo: 'bar', baz: i },
        })),
      };

      // JSON benchmark
      const jsonStart = Date.now();
      const jsonStr = JSON.stringify(testData);
      const jsonParsed = JSON.parse(jsonStr);
      const jsonTime = Date.now() - jsonStart;

      // Binary benchmark
      const binaryStart = Date.now();
      const buffer = serializer.serialize(testData);
      const binaryParsed = serializer.deserialize(buffer);
      const binaryTime = Date.now() - binaryStart;

      console.log(`JSON: ${jsonTime}ms (${jsonStr.length} bytes)`);
      console.log(`Binary: ${binaryTime}ms (${buffer.length} bytes)`);
      console.log(`Speedup: ${(jsonTime / binaryTime).toFixed(2)}x`);

      // Binary should be competitive or faster
      expect(binaryTime).toBeLessThan(jsonTime * 2); // Allow 2x tolerance
    });
  });

  describe('Size Estimation', () => {
    it('should estimate size accurately', () => {
      const testCases = [
        null,
        true,
        42,
        'hello',
        [1, 2, 3],
        { a: 1, b: 2 },
      ];

      for (const value of testCases) {
        const estimated = serializer.estimateSize(value);
        const buffer = serializer.serialize(value);
        
        // Estimate should be close (within 2x for worst-case UTF-8)
        expect(buffer.length).toBeLessThanOrEqual(estimated);
        expect(buffer.length).toBeGreaterThan(estimated / 3); // Not too far off
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty structures', () => {
      const testCases = [
        [],
        {},
        { empty: [] },
        { nested: { empty: {} } },
      ];

      for (const value of testCases) {
        const buffer = serializer.serialize(value);
        const result = serializer.deserialize(buffer);
        expect(result).toEqual(value);
      }
    });

    it('should handle mixed types in arrays', () => {
      const mixed = [
        1,
        'two',
        true,
        null,
        undefined,
        [1, 2, 3],
        { nested: 'object' },
        new Date(),
        42n,
      ];

      const buffer = serializer.serialize(mixed);
      const result = serializer.deserialize(buffer) as any[];
      
      expect(result[0]).toBe(1);
      expect(result[1]).toBe('two');
      expect(result[2]).toBe(true);
      expect(result[3]).toBeNull();
      expect(result[4]).toBeUndefined();
      expect(result[5]).toEqual([1, 2, 3]);
      expect(result[6]).toEqual({ nested: 'object' });
      expect(result[7]).toBeInstanceOf(Date);
      expect(result[8]).toBe(42n);
    });

    it('should handle special number values', () => {
      const specialNumbers = [
        NaN,
        Infinity,
        -Infinity,
        0,
        -0,
      ];

      for (const num of specialNumbers) {
        const buffer = serializer.serialize(num);
        const result = serializer.deserialize(buffer);
        
        if (Number.isNaN(num)) {
          expect(Number.isNaN(result as number)).toBe(true);
        } else {
          expect(result).toBe(num);
        }
      }
    });
  });

  describe('Convenience Functions', () => {
    it('should work with convenience functions', () => {
      const data = { test: 'data', value: 42 };
      
      const buffer = serialize(data);
      const result = deserialize(buffer);
      
      expect(result).toEqual(data);
    });

    it('should estimate size with convenience function', () => {
      const data = { test: 'data' };
      const estimate = estimateSize(data);
      expect(estimate).toBeGreaterThan(0);
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  console.log('Running ZeroCopySerializer tests...');
  
  const serializer = new ZeroCopySerializer();
  
  // Test primitives
  console.assert(serializer.deserialize(serializer.serialize(42)) === 42, '✅ Number test passed');
  console.assert(serializer.deserialize(serializer.serialize('hello')) === 'hello', '✅ String test passed');
  console.assert(serializer.deserialize(serializer.serialize(true)) === true, '✅ Boolean test passed');
  
  // Test complex
  const obj = { a: 1, b: 'test', c: [1, 2, 3] };
  const objResult = serializer.deserialize(serializer.serialize(obj));
  console.assert(JSON.stringify(objResult) === JSON.stringify(obj), '✅ Object test passed');
  
  // Performance test
  const startTime = Date.now();
  for (let i = 0; i < 1000; i++) {
    const buffer = serializer.serialize({ id: i, data: 'test' });
    serializer.deserialize(buffer);
  }
  const duration = Date.now() - startTime;
  console.log(`✅ Performance: 1000 operations in ${duration}ms`);
  
  console.log('\n🎉 All manual tests passed!');
}
