import {
  ChevronRight,
  Disc3,
  Folder,
  ListMusic,
  MoreVertical,
  Music2,
  Play,
  Plus,
  Shuffle,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SwipeableTrackItem } from "@/components/SwipeableTrackItem";
import { AndroidMusicImporter } from "@/components/AndroidMusicImporter";
import { MusicScanner } from "@/components/MusicScanner";
import { TrackArtwork } from "@/components/TrackArtwork";
import type { ImportResult, Track } from "@/hooks/useAudioQueue";
import type { Playlist } from "@/hooks/usePlaylists";
import type {
  HomeLibraryView as HomeLibraryViewType,
  HomePlaybackCollectionActions,
  HomePlaylistSelection,
  HomeSongSort,
  HomeTrackActions,
  TranslateFn,
} from "@/components/home/types";
import type { AndroidMusicFile } from "@/hooks/useAndroidMusicLibrary";

interface HomeLibraryViewProps
  extends HomeTrackActions,
    HomePlaybackCollectionActions,
    HomePlaylistSelection {
  t: TranslateFn;
  libraryView: HomeLibraryViewType;
  setLibraryView: (view: HomeLibraryViewType) => void;
  queueLibrary: Track[];
  queueIsLoading: boolean;
  importIsImporting: boolean;
  playlists: Playlist[];
  hiResTracks: Track[];
  songsByArtist: Record<string, Track[]>;
  albums: Record<string, Track[]>;
  sortedSongs: Track[];
  songSort: HomeSongSort;
  setSongSort: (sort: HomeSongSort) => void;
  visibleSongsCount: number;
  setVisibleSongsCount: (value: number | ((prev: number) => number)) => void;
  playlistMenu: { playlist: Playlist; x: number; y: number } | null;
  setPlaylistMenu: (
    menu: { playlist: Playlist; x: number; y: number } | null,
  ) => void;
  onCreatePlaylist: () => void;
  onOpenFilePicker: () => void;
  onImportMediaStoreTracks: (
    tracks: AndroidMusicFile[],
  ) => Promise<ImportResult>;
  onOpenAddToPlaylist: (track: Track) => void;
  onPersistEphemeralTrack: (track: Track) => void;
  onOpenAddSongsToPlaylist: () => void;
  onOpenDeletePlaylist: (playlist: Playlist) => void;
  onOpenRenamePlaylist: (playlist: Playlist) => void;
  onRemoveFromPlaylist: (track: Track) => void;
  hiresLogoUrl: string;
}

export function HomeLibraryView({
  t,
  libraryView,
  setLibraryView,
  queueLibrary,
  queueIsLoading,
  importIsImporting,
  playlists,
  selectedPlaylist,
  setSelectedPlaylist,
  hiResTracks,
  songsByArtist,
  albums,
  sortedSongs,
  songSort,
  setSongSort,
  visibleSongsCount,
  setVisibleSongsCount,
  setPlaylistMenu,
  onCreatePlaylist,
  onOpenFilePicker,
  onImportMediaStoreTracks,
  onPlayNow,
  onAddToQueue,
  onPlayNext,
  onAddToPlaylist,
  onPlayInOrder,
  onShufflePlay,
  onOpenAddToPlaylist,
  onPersistEphemeralTrack,
  onOpenAddSongsToPlaylist,
  onOpenDeletePlaylist,
  onOpenRenamePlaylist,
  onRemoveFromPlaylist,
  hiresLogoUrl,
}: HomeLibraryViewProps) {
  return (
    <div className="flex-1 flex flex-col" data-testid="library-view">
      <header className="flex items-center justify-between px-6 pt-12 pb-4 border-b border-zinc-900">
        {libraryView === "main" ? (
          <h2 className="text-xl font-bold">{t("library.title")}</h2>
        ) : libraryView === "playlist-detail" && selectedPlaylist ? (
          <button
            onClick={() => {
              setLibraryView("playlists");
              setSelectedPlaylist(null);
            }}
            className="flex items-center gap-2 text-zinc-400 hover:text-white"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
            <span className="text-xl font-bold text-white">
              {selectedPlaylist.name}
            </span>
          </button>
        ) : (
          <button
            onClick={() => setLibraryView("main")}
            className="flex items-center gap-2 text-zinc-400 hover:text-white"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
            <span className="text-xl font-bold text-white">
              {libraryView === "songs"
                ? t("library.songs")
                : libraryView === "artists"
                  ? t("library.artists")
                  : libraryView === "albums"
                    ? t("library.albums")
                    : libraryView === "hires"
                      ? t("library.highResolution")
                      : t("library.playlists")}
            </span>
          </button>
        )}
        <div className="flex items-center gap-2">
          {libraryView === "playlists" && (
            <button
              onClick={onCreatePlaylist}
              className="p-2 text-zinc-400 hover:text-white"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
          {libraryView === "main" && (
            <>
              <AndroidMusicImporter onImportTracks={onImportMediaStoreTracks} />
              <button
                onClick={onOpenFilePicker}
                className="p-2 text-zinc-400 hover:text-white"
              >
                <Plus className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </header>
      <ScrollArea className="flex-1">
        {libraryView === "main" && (
          <div className="p-4 space-y-2">
            {queueLibrary.length > 0 && (
              <button
                onClick={() => onShufflePlay(queueLibrary)}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all mb-4"
              >
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Shuffle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-white">
                    {t("library.shufflePlay")}
                  </p>
                  <p className="text-sm text-white/70">
                    {t("library.songsCount", { count: queueLibrary.length })}
                  </p>
                </div>
                <Play className="w-6 h-6 text-white" fill="currentColor" />
              </button>
            )}

            <button
              onClick={() => setLibraryView("playlists")}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <ListMusic className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold">{t("library.playlists")}</p>
                <p className="text-sm text-zinc-500">
                  {t("library.playlistsCount", { count: playlists.length })}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </button>

            <button
              onClick={() => setLibraryView("songs")}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center">
                <Music2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold">{t("library.songs")}</p>
                <p className="text-sm text-zinc-500">
                  {t("library.songsCount", { count: queueLibrary.length })}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </button>

            <button
              onClick={() => setLibraryView("artists")}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold">{t("library.artists")}</p>
                <p className="text-sm text-zinc-500">
                  {t("library.artistsCount", {
                    count: Object.keys(songsByArtist).length,
                  })}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </button>

            <button
              onClick={() => setLibraryView("albums")}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
                <Folder className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold">{t("library.albums")}</p>
                <p className="text-sm text-zinc-500">
                  {t("library.albumsCount", {
                    count: Object.keys(albums).length,
                  })}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </button>

            <button
              onClick={() => setLibraryView("hires")}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center">
                <img
                  src={hiresLogoUrl}
                  alt="Hi-Res Audio"
                  className="w-7 h-7 object-contain"
                />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold">{t("library.highResolution")}</p>
                <p className="text-sm text-zinc-500">
                  {t("library.songsCount", { count: hiResTracks.length })}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </button>

            {queueIsLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin mx-auto mb-4" />
                <p className="text-zinc-500">{t("library.loadingLibrary")}</p>
              </div>
            ) : queueLibrary.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Disc3
                  className="w-16 h-16 text-zinc-800 mx-auto mb-4"
                  strokeWidth={1}
                />
                <p className="text-zinc-500 mb-6">{t("library.noMusic")}</p>
                <div className="max-w-md mx-auto">
                  <MusicScanner
                    onScanComplete={onImportMediaStoreTracks}
                    onManualImport={onOpenFilePicker}
                    isScanning={importIsImporting}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}

        {libraryView === "playlists" && (
          <div className="p-4 space-y-2">
            {playlists.length === 0 ? (
              <div className="text-center py-12">
                <ListMusic
                  className="w-16 h-16 text-zinc-800 mx-auto mb-4"
                  strokeWidth={1}
                />
                <p className="text-zinc-500 mb-4">
                  {t("playlists.noPlaylists")}
                </p>
                <Button
                  onClick={onCreatePlaylist}
                  variant="outline"
                  className="border-zinc-800"
                >
                  {t("playlists.createFirst")}
                </Button>
              </div>
            ) : (
              playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
                >
                  <div
                    className="flex-1 flex items-center gap-4 cursor-pointer"
                    onClick={() => {
                      setSelectedPlaylist(playlist);
                      setLibraryView("playlist-detail");
                    }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center overflow-hidden">
                      <TrackArtwork
                        src={playlist.tracks[0]?.coverUrl}
                        alt={playlist.name}
                        iconClassName="w-6 h-6 text-zinc-300"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{playlist.name}</p>
                      <p className="text-sm text-zinc-500">
                        {t("library.songsCount", {
                          count: playlist.trackIds.length,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onPlayInOrder(playlist.tracks);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white text-black text-xs font-semibold"
                    >
                      <Play className="w-3.5 h-3.5" fill="currentColor" />
                      {t("actions.play")}
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onShufflePlay(playlist.tracks);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-700 text-xs text-white"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      {t("library.shuffle")}
                    </button>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      const rect = (
                        event.target as HTMLElement
                      ).getBoundingClientRect();
                      setPlaylistMenu({
                        playlist,
                        x: rect.left - 100,
                        y: rect.bottom + 8,
                      });
                    }}
                    className="p-2 text-zinc-500 hover:text-white"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {libraryView === "playlist-detail" && selectedPlaylist && (
          <div className="p-4 space-y-1">
            <button
              onClick={onOpenAddSongsToPlaylist}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border-2 border-dashed border-zinc-700 transition-all mb-4"
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-700 flex items-center justify-center">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-white">
                  {t("playlists.addSongs")}
                </p>
                <p className="text-sm text-zinc-500">
                  {t("playlists.emptyDescription")}
                </p>
              </div>
            </button>

            {selectedPlaylist.tracks.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <button
                  onClick={() => onPlayInOrder(selectedPlaylist.tracks)}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-white text-black font-semibold shadow-sm"
                >
                  <Play className="w-4 h-4" fill="currentColor" />
                  {t("actions.play")}
                </button>
                <button
                  onClick={() => onShufflePlay(selectedPlaylist.tracks)}
                  className="flex items-center gap-2 px-5 py-2 rounded-full border border-zinc-700 text-white"
                >
                  <Shuffle className="w-4 h-4" />
                  {t("library.shuffle")}
                </button>
              </div>
            )}

            {selectedPlaylist.tracks.length === 0 ? (
              <div className="text-center py-8">
                <ListMusic
                  className="w-16 h-16 text-zinc-800 mx-auto mb-4"
                  strokeWidth={1}
                />
                <p className="text-zinc-500 mb-2">{t("playlists.empty")}</p>
              </div>
            ) : (
              selectedPlaylist.tracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-900/50 transition-colors"
                >
                  <div
                    className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer"
                    onClick={() => onPlayNow(track)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                      <TrackArtwork
                        src={track.coverUrl}
                        alt={track.title}
                        iconClassName="w-5 h-5 text-zinc-500"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {track.title}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {track.artist}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveFromPlaylist(track)}
                    className="p-2 text-zinc-600 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {libraryView === "songs" && (
          <div className="p-4 space-y-1">
            {sortedSongs.length > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <button
                    onClick={() => onPlayInOrder(sortedSongs)}
                    className="flex items-center gap-2 px-5 py-2 rounded-full bg-white text-black font-semibold shadow-sm"
                  >
                    <Play className="w-4 h-4" fill="currentColor" />
                    {t("actions.play")}
                  </button>
                  <button
                    onClick={() => onShufflePlay(sortedSongs)}
                    className="flex items-center gap-2 px-5 py-2 rounded-full border border-zinc-700 text-white"
                  >
                    <Shuffle className="w-4 h-4" />
                    {t("library.shuffle")}
                  </button>
                </div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {t("library.sortBy")}
                  </span>
                  {(["default", "name", "artist"] as const).map((sortKey) => (
                    <button
                      key={sortKey}
                      onClick={() => setSongSort(sortKey)}
                      className={`px-3 py-1 rounded-full text-xs ${
                        songSort === sortKey
                          ? "bg-white text-black"
                          : "bg-zinc-900 text-zinc-400"
                      }`}
                    >
                      {sortKey === "default"
                        ? t("library.sortDefault")
                        : sortKey === "name"
                          ? t("library.sortName")
                          : t("library.sortArtist")}
                    </button>
                  ))}
                </div>
              </>
            )}
            {sortedSongs.length > 0 && (
              <p className="text-xs text-zinc-600 text-center mb-3 px-4">
                {t("library.swipeHint")}
              </p>
            )}
            {sortedSongs.slice(0, visibleSongsCount).map((track) => (
              <SwipeableTrackItem
                key={track.id}
                track={track}
                onPlayNow={onPlayNow}
                onAddToQueue={onAddToQueue}
                onPlayNext={onPlayNext}
                onAddToPlaylist={onOpenAddToPlaylist}
                onPersistTrack={onPersistEphemeralTrack}
              />
            ))}
            {visibleSongsCount < sortedSongs.length && (
              <div className="py-4 text-center">
                <button
                  onClick={() => setVisibleSongsCount((prev) => prev + 250)}
                  className="px-4 py-2 rounded-full bg-zinc-900 text-zinc-200 text-sm"
                >
                  {t("library.loadMoreSongs", {
                    count: Math.min(
                      250,
                      sortedSongs.length - visibleSongsCount,
                    ),
                  })}
                </button>
              </div>
            )}
          </div>
        )}

        {libraryView === "hires" && (
          <div className="p-4 space-y-1">
            {hiResTracks.length > 0 && (
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => onPlayInOrder(hiResTracks)}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-white text-black font-semibold shadow-sm"
                >
                  <Play className="w-4 h-4" fill="currentColor" />
                  {t("actions.play")}
                </button>
                <button
                  onClick={() => onShufflePlay(hiResTracks)}
                  className="flex items-center gap-2 px-5 py-2 rounded-full border border-zinc-700 text-white"
                >
                  <Shuffle className="w-4 h-4" />
                  {t("library.shuffle")}
                </button>
              </div>
            )}
            {hiResTracks.length > 0 && (
              <p className="text-xs text-zinc-600 text-center mb-3 px-4">
                {t("library.swipeHint")}
              </p>
            )}
            {hiResTracks.length === 0 && (
              <p className="text-center text-zinc-500 py-8">
                {t("library.noMusic", { defaultValue: "No tienes música aún" })}
              </p>
            )}
            {hiResTracks.map((track) => (
              <SwipeableTrackItem
                key={track.id}
                track={track}
                onPlayNow={onPlayNow}
                onAddToQueue={onAddToQueue}
                onPlayNext={onPlayNext}
                onAddToPlaylist={onOpenAddToPlaylist}
                onPersistTrack={onPersistEphemeralTrack}
              />
            ))}
          </div>
        )}

        {libraryView === "artists" && (
          <div className="p-4 space-y-1">
            {Object.entries(songsByArtist).map(([artist, tracks]) => (
              <div key={artist} className="mb-4">
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                      <User className="w-6 h-6 text-zinc-500" />
                    </div>
                    <div>
                      <p className="font-semibold">{artist}</p>
                      <p className="text-sm text-zinc-500">
                        {t("library.songsCount", { count: tracks.length })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onPlayInOrder(tracks)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white text-black text-xs font-semibold"
                    >
                      <Play className="w-3.5 h-3.5" fill="currentColor" />
                      {t("actions.play")}
                    </button>
                    <button
                      onClick={() => onShufflePlay(tracks)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-700 text-xs text-white"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      {t("library.shuffle")}
                    </button>
                  </div>
                </div>
                <div className="ml-4 border-l border-zinc-800 pl-2">
                  {tracks.map((track) => (
                    <SwipeableTrackItem
                      key={track.id}
                      track={track}
                      onPlayNow={onPlayNow}
                      onAddToQueue={onAddToQueue}
                      onPlayNext={onPlayNext}
                      onAddToPlaylist={onOpenAddToPlaylist}
                      onPersistTrack={onPersistEphemeralTrack}
                      showArtist={false}
                      compact
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {libraryView === "albums" && (
          <div className="p-4 grid grid-cols-2 gap-3">
            {Object.entries(albums).map(([album, tracks]) => (
              <div
                key={album}
                className="bg-zinc-900/50 rounded-xl p-3 hover:bg-zinc-900 transition-colors"
              >
                <div
                  className="aspect-square rounded-lg bg-zinc-800 mb-2 overflow-hidden cursor-pointer"
                  onClick={() => onPlayNow(tracks[0])}
                >
                  <TrackArtwork
                    src={tracks[0].coverUrl}
                    alt={album}
                    iconClassName="w-8 h-8 text-zinc-500"
                  />
                </div>
                <p className="font-medium text-sm truncate">{album}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-zinc-500">
                    {t("library.songsCount", { count: tracks.length })}
                  </p>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onShufflePlay(tracks);
                    }}
                    className="p-1 text-zinc-500 hover:text-white"
                    title={t("library.shuffle")}
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default HomeLibraryView;
