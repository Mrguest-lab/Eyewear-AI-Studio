// Tests for the AI gateway with a mocked provider fetch (no real API calls or keys).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, parseDataUrl, providerInfo } from '../server/aiHandlers.ts';
import type { Env, Fetcher } from '../server/aiHandlers.ts';

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

interface Call {
  url: string;
  init?: RequestInit;
  body?: any;
}

function mockFetch(responder: (url: string, body: any) => { status?: number; json: unknown }): { fetcher: Fetcher; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher: Fetcher = async (input, init) => {
    const url = String(input);
    let body: any;
    if (typeof init?.body === 'string') body = JSON.parse(init.body);
    calls.push({ url, init, body });
    const r = responder(url, body);
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetcher, calls };
}

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://example.github.io', ...headers },
    body: JSON.stringify(body)
  });
}

const env: Env = { GEMINI_API_KEY: 'test-gemini', REPLICATE_API_TOKEN: 'test-replicate' };

test('health and providers never expose keys', async () => {
  const res = await handleRequest(new Request('http://localhost/api/providers'), env);
  const text = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!text.includes('test-gemini') && !text.includes('test-replicate'));
  const data = JSON.parse(text);
  assert.equal(data.providers.length, 2);
  assert.equal(data.providers[0].watermark.requiresConsent, true);
  assert.equal(data.providers[1].watermark.visible, false);
  const health = await (await handleRequest(new Request('http://localhost/api/health'), {})).json();
  assert.deepEqual(health.providers.map((p: any) => p.configured), [false, false]);
});

test('access token and CORS allow-list are enforced', async () => {
  const locked = { ...env, ACCESS_TOKEN: 'secret', ALLOWED_ORIGINS: 'https://mrguest-lab.github.io' };
  const denied = await handleRequest(new Request('http://localhost/api/providers', { headers: { origin: 'https://evil.example' } }), locked);
  assert.equal(denied.status, 401);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  const ok = await handleRequest(
    new Request('http://localhost/api/providers', { headers: { origin: 'https://mrguest-lab.github.io', 'x-app-token': 'secret' } }),
    locked
  );
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://mrguest-lab.github.io');
});

test('gemini generation requires watermark consent, then returns inline images', async () => {
  const { fetcher, calls } = mockFetch(() => ({
    json: { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }] } }] }
  }));
  const base = { provider: 'gemini', task: 'photoshoot', prompt: 'adult woman wearing the sunglasses', image: PNG_1PX, aspectRatio: '4:5' };
  const noConsent = await handleRequest(post('/api/generate', base), env, fetcher);
  assert.equal(noConsent.status, 412);
  assert.equal(calls.length, 0, 'provider not called without consent');

  const res = await handleRequest(post('/api/generate', { ...base, consent: { invisibleWatermark: true } }), env, fetcher, 'k1');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'succeeded');
  assert.equal(data.images[0].src, 'data:image/png;base64,AAAA');
  assert.match(calls[0].url, /gemini-2\.5-flash-image:generateContent$/);
  assert.equal((calls[0].init!.headers as any)['x-goog-api-key'], 'test-gemini');
  assert.equal(calls[0].body.generationConfig.imageConfig.aspectRatio, '4:5');
  assert.equal(calls[0].body.generationConfig.imageConfig.imageSize, undefined, '2.5 flash has no imageSize');
  assert.equal(calls[0].body.contents[0].parts[0].inlineData.mimeType, 'image/png');
});

test('gemini 3 image models get native imageSize', async () => {
  const { fetcher, calls } = mockFetch(() => ({
    json: { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'BBBB' } }] } }] }
  }));
  const e3 = { ...env, GEMINI_IMAGE_MODEL: 'gemini-3-pro-image-preview' };
  await handleRequest(
    post('/api/generate', { provider: 'gemini', task: 'relight', prompt: 'relight this product photo', image: PNG_1PX, imageSize: '4K', consent: { invisibleWatermark: true } }),
    e3, fetcher, 'k2'
  );
  assert.equal(calls[0].body.generationConfig.imageConfig.imageSize, '4K');
});

test('replicate edit uses the official model endpoint with the reference image', async () => {
  const { fetcher, calls } = mockFetch(() => ({ status: 201, json: { id: 'abc123', status: 'succeeded', output: 'https://replicate.delivery/x/out.png' } }));
  const res = await handleRequest(
    post('/api/generate', { provider: 'replicate', task: 'photoshoot', prompt: 'adult man wearing the sunglasses', image: PNG_1PX, aspectRatio: '3:4' }),
    env, fetcher, 'k3'
  );
  const data = await res.json();
  assert.equal(data.status, 'succeeded');
  assert.deepEqual(data.images, [{ src: 'https://replicate.delivery/x/out.png' }]);
  assert.equal(calls[0].url, 'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions');
  assert.equal(calls[0].body.input.aspect_ratio, '3:4');
  assert.equal(calls[0].body.input.input_image, PNG_1PX);
  assert.equal((calls[0].init!.headers as any).authorization, 'Bearer test-replicate');
});

test('replicate upscale resolves the latest model version and supports polling', async () => {
  const { fetcher, calls } = mockFetch((url) => {
    if (url.endsWith('/v1/models/nightmareai/real-esrgan')) return { json: { latest_version: { id: 'ver42' } } };
    if (url.endsWith('/v1/predictions')) return { status: 201, json: { id: 'p1', status: 'processing' } };
    return { json: { id: 'p1', status: 'succeeded', output: 'https://replicate.delivery/p1/up.png' } };
  });
  const res = await handleRequest(post('/api/upscale', { provider: 'replicate', image: PNG_1PX, scale: 4 }), env, fetcher, 'k4');
  const first = await res.json();
  assert.equal(first.status, 'processing');
  assert.equal(first.id, 'p1');
  assert.equal(calls[1].body.version, 'ver42');
  assert.equal(calls[1].body.input.scale, 4);
  const poll = await handleRequest(new Request('http://localhost/api/predictions/p1?task=upscale'), env, fetcher);
  const done = await poll.json();
  assert.equal(done.status, 'succeeded');
  assert.equal(done.images[0].src, 'https://replicate.delivery/p1/up.png');
});

test('output proxy only fetches provider hosts', async () => {
  const { fetcher } = mockFetch(() => ({ json: {} }));
  const bad = await handleRequest(new Request('http://localhost/api/output?url=' + encodeURIComponent('http://169.254.169.254/latest')), env, fetcher);
  assert.equal(bad.status, 400);
  const bad2 = await handleRequest(new Request('http://localhost/api/output?url=' + encodeURIComponent('https://replicate.delivery.evil.com/x')), env, fetcher);
  assert.equal(bad2.status, 400);
});

test('input validation rejects non-image payloads and unconfigured providers', async () => {
  assert.throws(() => parseDataUrl('data:text/html;base64,AAAA'));
  assert.throws(() => parseDataUrl(42));
  const res = await handleRequest(post('/api/upscale', { provider: 'replicate', image: PNG_1PX }), {}, fetch, 'k5');
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /not configured/);
  assert.equal(providerInfo({}).every((p) => !p.configured), true);
});
