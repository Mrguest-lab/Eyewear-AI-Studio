import React, { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { ProviderInfo } from '../../lib/browser/aiClient';
import { Notice, Select } from './ui';
import type { TabId } from './types';

export interface ProviderChoice {
  provider: ProviderInfo['id'] | '';
  consent: boolean;
}

/**
 * Lists configured providers for a task and shows their watermark / cost disclosure
 * before anything is generated. Providers that add any watermark need explicit consent.
 */
export const AiProviderPicker: React.FC<{
  task: string;
  providers: ProviderInfo[];
  error: string | null;
  value: ProviderChoice;
  onChange: (v: ProviderChoice) => void;
  goTo: (t: TabId) => void;
}> = ({ task, providers, error, value, onChange, goTo }) => {
  const usable = providers.filter((p) => p.configured && p.tasks.includes(task));
  const selected = usable.find((p) => p.id === value.provider) || null;

  useEffect(() => {
    if (!selected && usable.length) onChange({ provider: usable[0].id, consent: false });
  }, [usable.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error || !usable.length) {
    return (
      <Notice tone="warn">
        {error ? `${error} ` : 'No AI provider on the backend supports this action yet. '}
        <button className="underline text-[#00ff7f]" onClick={() => goTo('settings')}>
          Open AI backend settings
        </button>
      </Notice>
    );
  }

  return (
    <div className="space-y-2">
      <Select
        label="AI provider"
        value={value.provider || usable[0].id}
        onChange={(v) => onChange({ provider: v, consent: false })}
        options={usable.map((p) => ({ value: p.id, label: p.name }))}
      />
      {selected && (
        <div className="text-[11px] text-[#ececec]/60 space-y-1 font-mono">
          <p>Model: {selected.models.edit || Object.values(selected.models).join(', ')}</p>
          <p>Output: {selected.maxOutput}</p>
          <p>Cost: {selected.cost}</p>
        </div>
      )}
      {selected && (selected.watermark.visible || selected.watermark.invisible) ? (
        <label className="flex gap-2 items-start border border-amber-400/40 bg-amber-400/5 p-2 text-xs text-amber-100/90">
          <input
            type="checkbox"
            className="mt-0.5 accent-[#00ff7f]"
            checked={value.consent}
            onChange={(e) => onChange({ ...value, consent: e.target.checked })}
          />
          <span>
            <ShieldAlert className="inline w-3.5 h-3.5 mr-1 text-amber-400" />
            {selected.watermark.details} I understand and want to use this provider.
          </span>
        </label>
      ) : (
        selected && <Notice tone="info">{selected.watermark.details}</Notice>
      )}
    </div>
  );
};

export function providerReady(choice: ProviderChoice, providers: ProviderInfo[]): boolean {
  const p = providers.find((x) => x.id === choice.provider && x.configured);
  if (!p) return false;
  return !(p.watermark.visible || p.watermark.invisible) || choice.consent;
}
