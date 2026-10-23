// Frontend client for AI providers.
// - 'server' mode (recommended): calls your AI gateway (server/aiHandlers.ts); provider
//   API keys stay on that server, the browser only knows its URL and an optional passcode.
// - 'direct' mode: for a frontend-only deployment (GitHub Pages) the same gateway code runs
//   inside the browser with the user's own Gemini key, kept in this browser's storage only.
//   Replicate does not allow browser (CORS) calls, so it is server-mode only.

import { loadImageFile } from './imageIO.ts';
import type { LoadedImage } from './imageIO.ts';
import { handleRequest } from '../../../server/aiHandlers.ts';

export interface AiSettings {
  mode: 'server' | 'direct';
  /** Base URL of the AI gateway, e.g. https://my-gateway.onrender.com. Empty = same origin. */
  backendUrl: string;
  accessToken: string;
  /** Direct mode only: the user's own Gemini API key (never part of the app's source). */
  geminiKey: string;
  geminiModel: string;
}

const KEY = 'eyewear-studio.ai-settings';
const isStaticHost = () => typeof location !== 'undefined' && location.hostname.endsWith('github.io');

export function loadAiSettings(): AiSettings {
  const defaults: AiSettings = {
    mode: isStaticHost() ? 'direct' : 'server',
    backendUrl: (import.meta as any).env?.VITE_AI_BACKEND_URL || '',
    accessToken: '',
    geminiKey: '',
    geminiModel: 'gemini-2.5-flash-image'
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    // storage unavailable
  }
  return defaults;
}

export function saveAiSettings(s: AiSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable
  }
}

export interface ProviderInfo {
  id: 'gemini' | 'replicate';
  name: string;
  configured: boolean;
  tasks: string[];
  models: Record<string, string>;
  watermark: { visible: boolean; invisible: boolean; requiresConsent: boolean; details: string };
  cost: string;
  terms: string;
  maxOutput: string;
}

export interface GenerationResult {
  status: 'succeeded' | 'processing' | 'failed';
  provider: string;
  model: string;
  task: string;
  images: { src: string; mime?: string }[];
  id?: string;
  text?: string;
  error?: string;
  watermark: ProviderInfo['watermark'];
}

function base(s: AiSettings): string {
  return (s.backendUrl || '').replace(/\/+$/, '');
}

async function call<T>(s: AiSettings, path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  if (s.mode === 'direct') {
    if (!s.geminiKey && path !== '/api/providers') {
      throw new Error('Add your Gemini API key in the AI Backend tab (direct mode), or connect an AI gateway server.');
    }
    // Same gateway logic, executed in the browser; requests go straight to Google.
    res = await handleRequest(
      new Request(`https://direct.local${path}`, { ...init, headers: { 'content-type': 'application/json' } }),
      { GEMINI_API_KEY: s.geminiKey || undefined, GEMINI_IMAGE_MODEL: s.geminiModel || undefined },
      (input, i) => fetch(input, i),
      'browser'
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !(data && (data as any).status === 'failed')) throw new Error((data as any).error || `AI error ${res.status}`);
    if (path === '/api/providers') (data as any).providers = (data as any).providers.filter((p: ProviderInfo) => p.id === 'gemini');
    return data as T;
  }
  if (!s.backendUrl && isStaticHost()) {
    throw new Error('No AI gateway URL set. GitHub Pages only hosts the frontend — set a gateway URL, or switch to direct mode with your Gemini key, in the AI Backend tab.');
  }
  try {
    res = await fetch(base(s) + path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(s.accessToken ? { 'x-app-token': s.accessToken } : {}), ...(init?.headers || {}) }
    });
  } catch {
    throw new Error(`Cannot reach the AI backend at ${base(s) || location.origin}. Check the URL in Settings and that the server is running.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !(data && (data as any).status === 'failed')) {
    throw new Error((data as any).error || `AI backend error ${res.status}`);
  }
  return data as T;
}

export function fetchProviders(s: AiSettings): Promise<{ providers: ProviderInfo[] }> {
  return call(s, '/api/providers');
}

async function pollUntilDone(s: AiSettings, first: GenerationResult, onStatus?: (msg: string) => void): Promise<GenerationResult> {
  let r = first;
  const started = Date.now();
  while (r.status === 'processing' && r.id) {
    if (Date.now() - started > 6 * 60 * 1000) throw new Error('Timed out waiting for the provider.');
    onStatus?.(`Provider is still working… ${Math.round((Date.now() - started) / 1000)}s`);
    await new Promise((res) => setTimeout(res, 2500));
    r = await call<GenerationResult>(s, `/api/predictions/${r.id}?task=${encodeURIComponent(r.task)}`);
  }
  if (r.status === 'failed') throw new Error(r.error || 'Generation failed');
  return r;
}

export interface GenerateRequest {
  provider: 'gemini' | 'replicate';
  task: 'photoshoot' | 'product-view' | 'relight';
  prompt: string;
  image: string;
  aspectRatio?: string;
  imageSize?: '1K' | '2K' | '4K';
  outputFormat?: 'png' | 'jpg';
  consent?: { invisibleWatermark: boolean };
}

export async function generate(s: AiSettings, req: GenerateRequest, onStatus?: (m: string) => void): Promise<GenerationResult> {
  const r = await call<GenerationResult>(s, '/api/generate', { method: 'POST', body: JSON.stringify(req) });
  return pollUntilDone(s, r, onStatus);
}

export async function upscale(s: AiSettings, image: string, scale: 2 | 4, onStatus?: (m: string) => void): Promise<GenerationResult> {
  const r = await call<GenerationResult>(s, '/api/upscale', { method: 'POST', body: JSON.stringify({ provider: 'replicate', image, scale }) });
  return pollUntilDone(s, r, onStatus);
}

export async function removeBackground(s: AiSettings, image: string, onStatus?: (m: string) => void): Promise<GenerationResult> {
  const r = await call<GenerationResult>(s, '/api/remove-background', { method: 'POST', body: JSON.stringify({ provider: 'replicate', image }) });
  return pollUntilDone(s, r, onStatus);
}

/** Download a provider output (data URL or provider-hosted URL via the gateway proxy) as an untouched Blob. */
export async function fetchOutputBlob(s: AiSettings, src: string): Promise<Blob> {
  if (src.startsWith('data:')) return (await fetch(src)).blob();
  const res = await fetch(`${base(s)}/api/output?url=${encodeURIComponent(src)}`, {
    headers: s.accessToken ? { 'x-app-token': s.accessToken } : {}
  });
  if (!res.ok) throw new Error(`Could not download provider output (${res.status})`);
  return res.blob();
}

export async function loadOutput(s: AiSettings, src: string, name: string): Promise<{ blob: Blob; loaded: LoadedImage }> {
  const blob = await fetchOutputBlob(s, src);
  return { blob, loaded: await loadImageFile(blob, name) };
}
