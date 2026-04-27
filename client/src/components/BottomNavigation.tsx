import { Disc3, Library, Search, Settings, SlidersHorizontal } from 'lucide-react';

type TabType = 'player' | 'library' | 'search' | 'eq' | 'dsp' | 'settings';

type BottomNavigationProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onLibraryTab: () => void;
  eqEnabled: boolean;
  epicenterEnabled: boolean;
  t: (key: string) => string;
};

export function BottomNavigation({
  activeTab,
  onTabChange,
  onLibraryTab,
  eqEnabled,
  epicenterEnabled,
  t,
}: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-4 py-3 border-t border-zinc-900 bg-black/95 backdrop-blur-xl z-50 safe-area-bottom">
      <button onClick={() => onTabChange('player')} className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors ${activeTab === 'player' ? 'text-white' : 'text-zinc-600'}`}>
        <Disc3 className="w-5 h-5" strokeWidth={1.5} />
        <span className="text-[10px] font-medium">{t('tabs.now')}</span>
      </button>
      <button onClick={onLibraryTab} className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors ${activeTab === 'library' ? 'text-white' : 'text-zinc-600'}`}>
        <Library className="w-5 h-5" strokeWidth={1.5} />
        <span className="text-[10px] font-medium">{t('tabs.library')}</span>
      </button>
      <button onClick={() => onTabChange('search')} className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors ${activeTab === 'search' ? 'text-white' : 'text-zinc-600'}`}>
        <Search className="w-5 h-5" strokeWidth={1.5} />
        <span className="text-[10px] font-medium">{t('tabs.search')}</span>
      </button>
      <button onClick={() => onTabChange('eq')} className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors relative ${activeTab === 'eq' ? 'text-white' : 'text-zinc-600'}`}>
        {eqEnabled && <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />}
        <SlidersHorizontal className="w-5 h-5" strokeWidth={1.5} />
        <span className="text-[10px] font-medium">{t('tabs.eq')}</span>
      </button>
      <button onClick={() => onTabChange('dsp')} className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors relative ${activeTab === 'dsp' ? 'text-white' : 'text-zinc-600'}`}>
        {epicenterEnabled && <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />}
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
          <path d="M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
        </svg>
        <span className="text-[10px] font-medium">{t('tabs.dsp')}</span>
      </button>
      <button onClick={() => onTabChange('settings')} className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${activeTab === 'settings' ? 'text-white' : 'text-zinc-600'}`}>
        <Settings className="w-5 h-5" strokeWidth={1.5} />
        <span className="text-[10px] font-medium">{t('tabs.settings')}</span>
      </button>
    </nav>
  );
}
