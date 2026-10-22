// Persist user-edited marketplace presets in localStorage.

import { useCallback, useEffect, useState } from 'react';
import type { MarketplacePreset } from '../marketplacePresets.ts';
import { DEFAULT_PRESETS } from '../marketplacePresets.ts';

const KEY = 'eyewear-studio.presets.v1';

export function loadPresets(): MarketplacePreset[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length) return list;
    }
  } catch {
    // ignore corrupt storage
  }
  return DEFAULT_PRESETS.map((p) => ({ ...p }));
}

export function savePresets(list: MarketplacePreset[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage unavailable (private mode)
  }
}

const listeners = new Set<(p: MarketplacePreset[]) => void>();
let current: MarketplacePreset[] | null = null;

export function usePresets(): [MarketplacePreset[], (next: MarketplacePreset[]) => void, () => void] {
  const [presets, setLocal] = useState<MarketplacePreset[]>(() => (current ??= loadPresets()));
  useEffect(() => {
    listeners.add(setLocal);
    return () => {
      listeners.delete(setLocal);
    };
  }, []);
  const set = useCallback((next: MarketplacePreset[]) => {
    current = next;
    savePresets(next);
    listeners.forEach((l) => l(next));
  }, []);
  const reset = useCallback(() => set(DEFAULT_PRESETS.map((p) => ({ ...p }))), [set]);
  return [presets, set, reset];
}
