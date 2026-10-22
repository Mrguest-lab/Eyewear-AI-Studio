// Web Worker that runs the CPU-heavy pixel operations off the main thread.

import { resample } from '../resample.ts';
import type { RGBAImage } from '../resample.ts';
import { enhance, whiteBackground } from '../enhance.ts';
import { analyzeImage } from '../analysis.ts';
import { renderToSize } from '../compose.ts';

export type WorkerOp =
  | { op: 'resample'; image: RGBAImage; width: number; height: number }
  | { op: 'enhance'; image: RGBAImage; options: Parameters<typeof enhance>[1] }
  | { op: 'whiteBackground'; image: RGBAImage; options: Parameters<typeof whiteBackground>[1] }
  | { op: 'analyze'; image: RGBAImage }
  | { op: 'render'; image: RGBAImage; options: Parameters<typeof renderToSize>[1] };

export function runOp(msg: WorkerOp): unknown {
  switch (msg.op) {
    case 'resample':
      return { image: resample(msg.image, msg.width, msg.height) };
    case 'enhance':
      return { image: enhance(msg.image, msg.options) };
    case 'whiteBackground':
      return whiteBackground(msg.image, msg.options);
    case 'analyze':
      return { report: analyzeImage(msg.image) };
    case 'render':
      return renderToSize(msg.image, msg.options);
  }
}

const scope = globalThis as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
  document?: unknown;
};

if (typeof scope.document === 'undefined' && typeof self !== 'undefined') {
  scope.onmessage = (e: MessageEvent) => {
    const { id, payload } = e.data as { id: number; payload: WorkerOp };
    try {
      const result = runOp(payload) as { image?: RGBAImage };
      const transfer = result?.image ? [result.image.data.buffer as ArrayBuffer] : [];
      scope.postMessage({ id, result }, transfer);
    } catch (err) {
      scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
    }
  };
}
