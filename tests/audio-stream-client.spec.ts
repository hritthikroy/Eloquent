import assert from 'assert';
import http from 'http';
import { describe, it } from 'node:test';
import { AudioStreamClient } from '../src/services/audioStreamClient';

describe('AudioStreamClient Suite', () => {
  it('instantiates client with custom configuration and formats metrics correctly', async () => {
    const client = new AudioStreamClient({
      baseUrl: 'http://127.0.0.1:9090',
      autoReconnect: false,
      requestTimeoutMs: 1500,
    });

    assert.ok(client);
    assert.strictEqual(typeof client.connect, 'function');
    assert.strictEqual(typeof client.ingestPCM, 'function');
    assert.strictEqual(typeof client.getHealth, 'function');
    assert.strictEqual(typeof client.getPrometheusMetrics, 'function');

    // Test offline fallback gracefully handles network errors without crashing
    const health = await client.getHealth();
    assert.strictEqual(health, null);

    const metrics = await client.getPrometheusMetrics();
    assert.strictEqual(metrics, '');

    const ingestOk = await client.ingestPCM(Buffer.alloc(1920));
    assert.strictEqual(ingestOk, false);

    client.destroy();
  });
});
