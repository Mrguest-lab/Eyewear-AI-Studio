// Main-thread client for the free on-device AI worker (localAiWorker.ts).

import type { RGBAImage } from '../resample.ts';
import type { LocalAiRequest } from './localAiWorker.ts';

export interface LocalAiProgress {
  stage: string;
  loaded?: number;
  total?: number;
  device?: string;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; onProgress?: (p: LocalAiProgress) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./localAiWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, progress, result, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      if (progress) return p.onProgress?.(progress);
      pending.delete(id);
      if (error) p.reject(new Error(error));
      else p.resolve(result);
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(`On-device AI failed: ${e.message || 'worker crashed (possibly out of memory)'}`));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

function run(req: LocalAiRequest, onProgress?: (p: LocalAiProgress) => void): Promise<{ image: RGBAImage; device: string }> {
  const w = getWorker();
  const id = ++seq;
  const image = { ...req.image, data: new Uint8ClampedArray(req.image.data) };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    w.postMessage({ id, req: { ...req, image } }, [image.data.buffer]);
  });
}

export function localRemoveBackground(image: RGBAImage, onProgress?: (p: LocalAiProgress) => void) {
  return run({ task: 'removeBackground', image }, onProgress);
}

export function localUpscale(image: RGBAImage, scale: 2 | 4, onProgress?: (p: LocalAiProgress) => void) {
  return run({ task: 'upscale', image, scale }, onProgress);
}

export function describeProgress(p: LocalAiProgress): string {
  const pct = p.total ? ` ${Math.round(((p.loaded ?? 0) / p.total) * 100)}%` : '';
  const mb = p.total && p.total > 1e6 ? ` of ${(p.total / 1e6).toFixed(0)} MB` : '';
  return `${p.stage}${pct}${mb}`;
}
