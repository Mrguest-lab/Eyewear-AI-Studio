import { useCallback, useEffect, useState } from 'react';
import type { AiSettings, ProviderInfo } from '../../lib/browser/aiClient';
import { fetchProviders, loadAiSettings, saveAiSettings } from '../../lib/browser/aiClient';

let cache: { key: string; providers: ProviderInfo[]; error: string | null } | null = null;
const subscribers = new Set<() => void>();
let settings: AiSettings = loadAiSettings();

/** Shared AI backend settings + provider list (fetched from the gateway, never containing keys). */
export function useAi() {
  const [, force] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const key = JSON.stringify(settings);
    try {
      const { providers } = await fetchProviders(settings);
      cache = { key, providers, error: null };
    } catch (err) {
      cache = { key, providers: [], error: err instanceof Error ? err.message : String(err) };
    } finally {
      setLoading(false);
      subscribers.forEach((s) => s());
    }
  }, []);

  useEffect(() => {
    const key = JSON.stringify(settings);
    if (!cache || cache.key !== key) void refresh();
  }, [refresh]);

  const update = useCallback(
    (next: AiSettings) => {
      settings = next;
      saveAiSettings(next);
      cache = null;
      void refresh();
    },
    [refresh]
  );

  return {
    settings,
    setSettings: update,
    providers: cache?.providers ?? [],
    error: cache?.error ?? null,
    loading,
    refresh
  };
}
