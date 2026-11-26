import assert from 'node:assert/strict';
import test from 'node:test';
import { apiRequest } from './api';

test('apiRequest rejects non-JSON 200 responses instead of returning malformed objects', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response('<!doctype html><html><body>SPA fallback</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });

  try {
    await assert.rejects(
      () => apiRequest<{ events: unknown[] }>('/api/events'),
      /Unexpected server response/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiRequest propagates JSON error message for 503 responses', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: 'Database service is temporarily unavailable.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });

  try {
    await assert.rejects(
      () => apiRequest('/api/events'),
      /Database service is temporarily unavailable\./
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiRequest parses valid JSON object responses cleanly', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ events: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  try {
    const result = await apiRequest<{ events: unknown[] }>('/api/events');
    assert.deepEqual(result, { events: [] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
