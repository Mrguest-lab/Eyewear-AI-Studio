// AI provider gateway. Runs on the server so API keys never reach the browser.
// Written against the standard Fetch API (Request/Response) so the same code runs
// under Node 22 (server/index.ts) or any fetch-based host.
//
// Providers:
//  - gemini    : Google Gemini image model (reference-image editing / model photoshoots).
//                Google embeds an invisible SynthID watermark in every generated image;
//                the client must send explicit consent before we call it.
//  - replicate : FLUX Kontext (image editing), Real-ESRGAN (super-resolution),
//                background remover. No visible watermark is added by these models.

export interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_IMAGE_MODEL?: string;
  REPLICATE_API_TOKEN?: string;
  REPLICATE_EDIT_MODEL?: string;
  REPLICATE_UPSCALE_MODEL?: string;
  REPLICATE_BG_MODEL?: string;
  /** Optional shared passcode the frontend must send as x-app-token. */
  ACCESS_TOKEN?: string;
  /** Comma-separated list of allowed browser origins, or "*" (default). */
  ALLOWED_ORIGINS?: string;
}

export type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const DEFAULTS = {
  geminiModel: 'gemini-2.5-flash-image',
  replicateEdit: 'black-forest-labs/flux-kontext-pro',
  replicateUpscale: 'nightmareai/real-esrgan',
  replicateBg: '851-labs/background-remover'
};

const GEMINI_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
const KONTEXT_RATIOS = ['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9', '9:21', '2:1', '1:2'];
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const OUTPUT_HOSTS = ['replicate.delivery', 'pbxt.replicate.delivery'];

export type Task = 'photoshoot' | 'product-view' | 'relight' | 'upscale' | 'remove-background';

export interface ProviderInfo {
  id: 'gemini' | 'replicate';
  name: string;
  configured: boolean;
  tasks: Task[];
  models: Record<string, string>;
  watermark: {
    visible: boolean;
    invisible: boolean;
    requiresConsent: boolean;
    details: string;
  };
  cost: string;
  terms: string;
  maxOutput: string;
}

export function providerInfo(env: Env): ProviderInfo[] {
  const geminiModel = env.GEMINI_IMAGE_MODEL || DEFAULTS.geminiModel;
  return [
    {
      id: 'gemini',
      name: 'Google Gemini image model',
      configured: !!env.GEMINI_API_KEY,
      tasks: ['photoshoot', 'product-view', 'relight'],
      models: { edit: geminiModel },
      watermark: {
        visible: false,
        invisible: true,
        requiresConsent: true,
        details:
          'Google embeds an invisible SynthID digital watermark in all images generated or edited by Gemini image models. It is not visible and does not affect normal use, and this app does not attempt to remove it.'
      },
      cost:
        'Billed per generated image on the Gemini API. Free-tier availability for image models changes — check https://ai.google.dev/pricing before bulk use.',
      terms: 'https://ai.google.dev/gemini-api/terms',
      maxOutput: supportsImageSize(geminiModel)
        ? 'Native 1K / 2K / 4K output (imageSize).'
        : 'About 1 megapixel (e.g. 1024×1024, 896×1152 for 4:5). Use upscaling for 2K/4K.'
    },
    {
      id: 'replicate',
      name: 'Replicate (FLUX Kontext, Real-ESRGAN, background remover)',
      configured: !!env.REPLICATE_API_TOKEN,
      tasks: ['photoshoot', 'product-view', 'relight', 'upscale', 'remove-background'],
      models: {
        edit: env.REPLICATE_EDIT_MODEL || DEFAULTS.replicateEdit,
        upscale: env.REPLICATE_UPSCALE_MODEL || DEFAULTS.replicateUpscale,
        removeBackground: env.REPLICATE_BG_MODEL || DEFAULTS.replicateBg
      },
      watermark: {
        visible: false,
        invisible: false,
        requiresConsent: false,
        details:
          'These models do not add a visible watermark. Some providers may attach provenance metadata (e.g. C2PA content credentials); the app offers the provider original download unmodified.'
      },
      cost:
        'Pay-per-run GPU billing on Replicate (no permanent free tier). Real-ESRGAN costs a fraction of a cent to a few cents per image; FLUX Kontext Pro is billed per output image. See https://replicate.com/pricing.',
      terms: 'https://replicate.com/terms',
      maxOutput: 'FLUX Kontext outputs about 1 megapixel; Real-ESRGAN upscales ×2 or ×4 (large inputs may exceed GPU memory).'
    }
  ];
}

function supportsImageSize(model: string): boolean {
  return /gemini-3.*image/.test(model);
}

// ---------- HTTP helpers ----------

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);
  const allowOrigin = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : '';
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,x-app-token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
  if (allowOrigin) h['Access-Control-Allow-Origin'] = allowOrigin;
  return h;
}

function json(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors }
  });
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface DataUrl {
  mime: string;
  base64: string;
  bytes: number;
}

export function parseDataUrl(value: unknown): DataUrl {
  if (typeof value !== 'string') throw new HttpError(400, 'image must be a data URL string');
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!m) throw new HttpError(400, 'image must be a base64 PNG, JPEG or WebP data URL');
  const bytes = Math.floor((m[2].length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) throw new HttpError(413, `image is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB`);
  return { mime: m[1], base64: m[2], bytes };
}

// ---------- rate limiting (per instance, best effort) ----------

const hits = new Map<string, number[]>();
function rateLimited(key: string, limit = 40, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > limit;
}

// ---------- Gemini ----------

export interface GeneratedImage {
  /** data: URL (inline) or https URL hosted by the provider */
  src: string;
  mime?: string;
}

export interface GenerationResult {
  status: 'succeeded' | 'processing' | 'failed';
  provider: string;
  model: string;
  task: Task;
  images: GeneratedImage[];
  /** Replicate prediction id when still processing */
  id?: string;
  text?: string;
  error?: string;
  watermark: ProviderInfo['watermark'];
}

async function geminiGenerate(
  env: Env,
  fetcher: Fetcher,
  task: Task,
  prompt: string,
  images: DataUrl[],
  aspectRatio: string | undefined,
  imageSize: string | undefined
): Promise<GenerationResult> {
  const model = env.GEMINI_IMAGE_MODEL || DEFAULTS.geminiModel;
  const info = providerInfo(env)[0];
  const imageConfig: Record<string, string> = {};
  if (aspectRatio && GEMINI_RATIOS.includes(aspectRatio)) imageConfig.aspectRatio = aspectRatio;
  if (imageSize && supportsImageSize(model) && ['1K', '2K', '4K'].includes(imageSize)) imageConfig.imageSize = imageSize;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [...images.map((i) => ({ inlineData: { mimeType: i.mime, data: i.base64 } })), { text: prompt }]
      }
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      ...(Object.keys(imageConfig).length ? { imageConfig } : {})
    }
  };
  const res = await fetcher(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
      body: JSON.stringify(body)
    }
  );
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpError(res.status === 429 ? 429 : 502, `Gemini error ${res.status}: ${data?.error?.message || 'request failed'}`);
  }
  const parts: any[] = data?.candidates?.[0]?.content?.parts || [];
  const out: GeneratedImage[] = [];
  let text = '';
  for (const p of parts) {
    const inline = p.inlineData || p.inline_data;
    if (inline?.data) out.push({ src: `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`, mime: inline.mimeType });
    else if (p.text) text += p.text;
  }
  if (!out.length) {
    const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || 'no image returned';
    return { status: 'failed', provider: 'gemini', model, task, images: [], text, error: `Gemini returned no image (${reason}).`, watermark: info.watermark };
  }
  return { status: 'succeeded', provider: 'gemini', model, task, images: out, text, watermark: info.watermark };
}

// ---------- Replicate ----------

const versionCache = new Map<string, string>();

async function replicateLatestVersion(env: Env, fetcher: Fetcher, model: string): Promise<string> {
  if (model.includes(':')) return model.split(':')[1];
  const cached = versionCache.get(model);
  if (cached) return cached;
  const res = await fetcher(`https://api.replicate.com/v1/models/${model}`, {
    headers: { authorization: `Bearer ${env.REPLICATE_API_TOKEN}` }
  });
  const data: any = await res.json().catch(() => ({}));
  const id = data?.latest_version?.id;
  if (!res.ok || !id) throw new HttpError(502, `Replicate: could not resolve a version for ${model} (${res.status}).`);
  versionCache.set(model, id);
  return id;
}

/** Upload large inputs with the Files API; small ones go inline as data URLs. */
async function replicateFileInput(env: Env, fetcher: Fetcher, img: DataUrl): Promise<string> {
  const dataUrl = `data:${img.mime};base64,${img.base64}`;
  if (img.bytes <= 1024 * 1024) return dataUrl;
  try {
    const bin = Uint8Array.from(atob(img.base64), (c) => c.charCodeAt(0));
    const form = new FormData();
    const ext = img.mime.split('/')[1];
    form.append('content', new Blob([bin], { type: img.mime }), `input.${ext}`);
    const res = await fetcher('https://api.replicate.com/v1/files', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.REPLICATE_API_TOKEN}` },
      body: form
    });
    const data: any = await res.json().catch(() => ({}));
    if (res.ok && data?.urls?.get) return data.urls.get;
  } catch {
    // fall back to inline data URL
  }
  return dataUrl;
}

function normalizeReplicateOutput(output: unknown): GeneratedImage[] {
  const list = Array.isArray(output) ? output : output ? [output] : [];
  return list.filter((o): o is string => typeof o === 'string').map((src) => ({ src }));
}

function replicateResult(env: Env, task: Task, model: string, data: any): GenerationResult {
  const info = providerInfo(env)[1];
  const status = data?.status;
  if (status === 'succeeded') {
    return { status: 'succeeded', provider: 'replicate', model, task, images: normalizeReplicateOutput(data.output), id: data.id, watermark: info.watermark };
  }
  if (status === 'failed' || status === 'canceled') {
    return { status: 'failed', provider: 'replicate', model, task, images: [], id: data.id, error: String(data.error || status), watermark: info.watermark };
  }
  return { status: 'processing', provider: 'replicate', model, task, images: [], id: data?.id, watermark: info.watermark };
}

async function replicateRun(
  env: Env,
  fetcher: Fetcher,
  task: Task,
  model: string,
  input: Record<string, unknown>,
  official: boolean
): Promise<GenerationResult> {
  const headers = {
    authorization: `Bearer ${env.REPLICATE_API_TOKEN}`,
    'content-type': 'application/json',
    prefer: 'wait=55'
  };
  let res: Response;
  if (official && !model.includes(':')) {
    res = await fetcher(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ input })
    });
  } else {
    const version = await replicateLatestVersion(env, fetcher, model);
    res = await fetcher('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ version, input })
    });
  }
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpError(res.status === 429 ? 429 : 502, `Replicate error ${res.status}: ${data?.detail || data?.error || 'request failed'}`);
  }
  return replicateResult(env, task, model, data);
}

// ---------- Router ----------

export async function handleRequest(req: Request, env: Env, fetcher: Fetcher = fetch, clientKey = 'anon'): Promise<Response> {
  const cors = corsHeaders(req, env);
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  try {
    if (url.pathname === '/api/health') {
      return json({ ok: true, providers: providerInfo(env).map((p) => ({ id: p.id, configured: p.configured })) }, 200, cors);
    }
    if (!url.pathname.startsWith('/api/')) throw new HttpError(404, 'Not found');

    if (env.ACCESS_TOKEN && req.headers.get('x-app-token') !== env.ACCESS_TOKEN) {
      throw new HttpError(401, 'Missing or wrong access token (set it in Settings → AI backend).');
    }

    if (url.pathname === '/api/providers' && req.method === 'GET') {
      return json({ providers: providerInfo(env) }, 200, cors);
    }

    if (url.pathname.startsWith('/api/predictions/') && req.method === 'GET') {
      if (!env.REPLICATE_API_TOKEN) throw new HttpError(400, 'Replicate is not configured');
      const id = url.pathname.split('/').pop() || '';
      if (!/^[a-z0-9]+$/i.test(id)) throw new HttpError(400, 'bad prediction id');
      const task = (url.searchParams.get('task') || 'photoshoot') as Task;
      const res = await fetcher(`https://api.replicate.com/v1/predictions/${id}`, {
        headers: { authorization: `Bearer ${env.REPLICATE_API_TOKEN}` }
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new HttpError(502, `Replicate error ${res.status}`);
      return json(replicateResult(env, task, data?.model || '', data), 200, cors);
    }

    if (url.pathname === '/api/output' && req.method === 'GET') {
      // Stream a provider-hosted output back with CORS so the browser can process it.
      const target = new URL(url.searchParams.get('url') || '');
      if (target.protocol !== 'https:' || !OUTPUT_HOSTS.some((h) => target.hostname === h || target.hostname.endsWith('.' + h))) {
        throw new HttpError(400, 'Only provider output URLs can be fetched');
      }
      const res = await fetcher(target.toString(), {
        headers: env.REPLICATE_API_TOKEN ? { authorization: `Bearer ${env.REPLICATE_API_TOKEN}` } : {}
      });
      if (!res.ok || !res.body) throw new HttpError(502, `Could not fetch output (${res.status})`);
      return new Response(res.body, {
        status: 200,
        headers: { 'content-type': res.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'no-store', ...cors }
      });
    }

    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    if (rateLimited(clientKey)) throw new HttpError(429, 'Too many AI requests from this client. Wait a few minutes.');

    const body: any = await req.json().catch(() => {
      throw new HttpError(400, 'Body must be JSON');
    });
    const provider = String(body.provider || '');

    if (url.pathname === '/api/generate') {
      const task = String(body.task || 'photoshoot') as Task;
      if (!['photoshoot', 'product-view', 'relight'].includes(task)) throw new HttpError(400, 'Unknown task');
      const prompt = String(body.prompt || '').slice(0, 6000);
      if (prompt.length < 10) throw new HttpError(400, 'prompt is required');
      const refs = (Array.isArray(body.images) ? body.images : [body.image]).slice(0, 3).map(parseDataUrl);
      if (!refs.length) throw new HttpError(400, 'a reference image is required');

      if (provider === 'gemini') {
        if (!env.GEMINI_API_KEY) throw new HttpError(400, 'Gemini is not configured on the server (GEMINI_API_KEY).');
        if (body.consent?.invisibleWatermark !== true) {
          throw new HttpError(
            412,
            'Gemini adds an invisible SynthID watermark to generated images. Confirm the disclosure in the app to continue.'
          );
        }
        const result = await geminiGenerate(env, fetcher, task, prompt, refs, body.aspectRatio, body.imageSize);
        return json(result, result.status === 'failed' ? 422 : 200, cors);
      }
      if (provider === 'replicate') {
        if (!env.REPLICATE_API_TOKEN) throw new HttpError(400, 'Replicate is not configured on the server (REPLICATE_API_TOKEN).');
        const model = env.REPLICATE_EDIT_MODEL || DEFAULTS.replicateEdit;
        const ratio = KONTEXT_RATIOS.includes(body.aspectRatio) ? body.aspectRatio : 'match_input_image';
        const input = {
          prompt,
          input_image: await replicateFileInput(env, fetcher, refs[0]),
          aspect_ratio: ratio,
          output_format: body.outputFormat === 'jpg' ? 'jpg' : 'png',
          safety_tolerance: 2
        };
        const result = await replicateRun(env, fetcher, task, model, input, !env.REPLICATE_EDIT_MODEL || model === DEFAULTS.replicateEdit);
        return json(result, result.status === 'failed' ? 422 : 200, cors);
      }
      throw new HttpError(400, 'Unknown provider');
    }

    if (url.pathname === '/api/upscale') {
      if (provider !== 'replicate') throw new HttpError(400, 'Upscaling is available through the replicate provider');
      if (!env.REPLICATE_API_TOKEN) throw new HttpError(400, 'Replicate is not configured on the server (REPLICATE_API_TOKEN).');
      const img = parseDataUrl(body.image);
      const scale = body.scale === 2 ? 2 : 4;
      const model = env.REPLICATE_UPSCALE_MODEL || DEFAULTS.replicateUpscale;
      const input = { image: await replicateFileInput(env, fetcher, img), scale, face_enhance: !!body.faceEnhance };
      const result = await replicateRun(env, fetcher, 'upscale', model, input, false);
      return json(result, result.status === 'failed' ? 422 : 200, cors);
    }

    if (url.pathname === '/api/remove-background') {
      if (provider !== 'replicate') throw new HttpError(400, 'Background removal is available through the replicate provider');
      if (!env.REPLICATE_API_TOKEN) throw new HttpError(400, 'Replicate is not configured on the server (REPLICATE_API_TOKEN).');
      const img = parseDataUrl(body.image);
      const model = env.REPLICATE_BG_MODEL || DEFAULTS.replicateBg;
      const result = await replicateRun(env, fetcher, 'remove-background', model, { image: await replicateFileInput(env, fetcher, img) }, false);
      return json(result, result.status === 'failed' ? 422 : 200, cors);
    }

    throw new HttpError(404, 'Not found');
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'Server error';
    if (status === 500) console.error(err);
    return json({ error: message }, status, cors);
  }
}
