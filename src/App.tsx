import React, { useEffect, useState } from 'react';
import { Header, TABS } from './components/Header';
import { QuickResizeTab } from './components/QuickResizeTab';
import { StudioTab } from './components/studio/StudioTab';
import { PhotoshootTab } from './components/studio/PhotoshootTab';
import { ConverterTab } from './components/studio/ConverterTab';
import { BatchTab } from './components/studio/BatchTab';
import { ValidateTab } from './components/studio/ValidateTab';
import { PresetsTab } from './components/studio/PresetsTab';
import { SettingsTab } from './components/studio/SettingsTab';
import type { TabId, WorkImage } from './components/studio/types';

function tabFromHash(): TabId {
  const h = location.hash.replace('#', '') as TabId;
  return TABS.some((t) => t.id === h) ? h : 'studio';
}

export default function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash);
  const [work, setWork] = useState<WorkImage | null>(null);
  // Tabs are mounted on first visit and then kept alive so work isn't lost when switching.
  const [visited, setVisited] = useState<Set<TabId>>(() => new Set([tabFromHash()]));

  useEffect(() => {
    const onHash = () => goTo(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goTo = (t: TabId) => {
    setTab(t);
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)));
    if (location.hash !== `#${t}`) history.replaceState(null, '', `#${t}`);
    window.scrollTo({ top: 0 });
  };

  const props = { work, setWork, goTo };
  const panes: Record<TabId, React.ReactNode> = {
    studio: <StudioTab {...props} />,
    photoshoot: <PhotoshootTab {...props} />,
    convert: <ConverterTab {...props} />,
    batch: <BatchTab {...props} />,
    validate: <ValidateTab {...props} />,
    presets: <PresetsTab {...props} />,
    resize: <QuickResizeTab />,
    settings: <SettingsTab {...props} />
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-100 flex flex-col font-sans antialiased">
      <Header tab={tab} onTab={goTo} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {TABS.map((t) =>
          visited.has(t.id) ? (
            <div key={t.id} hidden={tab !== t.id}>
              {panes[t.id]}
            </div>
          ) : null
        )}
      </main>
      <footer className="border-t border-[#ececec]/10 bg-[#0c0c0e] text-[#ececec]/45 py-5 font-mono text-[11px]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between gap-2">
          <span>Local tools run in your browser — images are not uploaded unless you use an AI provider.</span>
          <span>No app watermarks on any export.</span>
        </div>
      </footer>
    </div>
  );
}
