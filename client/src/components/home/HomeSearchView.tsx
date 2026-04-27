import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SwipeableTrackItem } from "@/components/SwipeableTrackItem";
import type { Track } from "@/hooks/useAudioQueue";
import type { HomeTrackActions, TranslateFn } from "@/components/home/types";

interface HomeSearchViewProps extends HomeTrackActions {
  t: TranslateFn;
  globalSearchQuery: string;
  setGlobalSearchQuery: (value: string) => void;
  normalizedGlobalQuery: string;
  globalResults: Track[];
}

export function HomeSearchView({
  t,
  globalSearchQuery,
  setGlobalSearchQuery,
  normalizedGlobalQuery,
  globalResults,
  onPlayNow,
  onAddToQueue,
  onPlayNext,
  onAddToPlaylist,
}: HomeSearchViewProps) {
  return (
    <div className="flex-1 flex flex-col" data-testid="search-view">
      <header className="px-6 pt-12 pb-4 border-b border-zinc-900">
        <h2 className="text-xl font-bold">{t("search.globalTitle")}</h2>
        <p className="text-xs text-zinc-500 mt-1">
          {t("search.globalSubtitle")}
        </p>
      </header>
      <div className="px-6 pt-3">
        <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
          <Search className="w-4 h-4 text-zinc-500" />
          <input
            value={globalSearchQuery}
            onChange={(event) => setGlobalSearchQuery(event.target.value)}
            placeholder={t("search.globalPlaceholder")}
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
          />
        </label>
      </div>
      <ScrollArea className="flex-1 px-4 py-3">
        {!normalizedGlobalQuery ? (
          <p className="text-center text-zinc-500 py-10 text-sm">
            {t("search.startTyping")}
          </p>
        ) : globalResults.length === 0 ? (
          <p className="text-center text-zinc-500 py-10 text-sm">
            {t("search.noResults")}
          </p>
        ) : (
          <div className="space-y-1">
            {globalResults.map((track) => (
              <SwipeableTrackItem
                key={track.id}
                track={track}
                onPlayNow={onPlayNow}
                onAddToQueue={onAddToQueue}
                onPlayNext={onPlayNext}
                onAddToPlaylist={onAddToPlaylist}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default HomeSearchView;
