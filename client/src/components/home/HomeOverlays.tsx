import {
  AlertCircle,
  Check,
  ListMusic,
  ListPlus,
  Music2,
  Play,
  PlayCircle,
  Plus,
  Trash2,
  X,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrackArtwork } from "@/components/TrackArtwork";
import type { Playlist } from "@/hooks/usePlaylists";
import type { Track } from "@/hooks/useAudioQueue";

type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;

type ContextMenuState = { track: Track; x: number; y: number };
type PlaylistMenuState = { playlist: Playlist; x: number; y: number };
type OnboardingStep = { title: string; description: string };

interface TrackContextMenuProps {
  contextMenu: ContextMenuState | null;
  t: TranslateFn;
  onClose: () => void;
  onPlayNow: (track: Track) => void;
  onPlayNext: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (track: Track) => void;
}

export function TrackContextMenu({
  contextMenu,
  t,
  onClose,
  onPlayNow,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
}: TrackContextMenuProps) {
  if (!contextMenu) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 min-w-[200px] rounded-xl border border-zinc-800 bg-zinc-900 py-2 shadow-2xl"
        style={{
          left: Math.min(contextMenu.x, window.innerWidth - 220),
          top: contextMenu.y,
        }}
      >
        <button
          onClick={() => onPlayNow(contextMenu.track)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
        >
          <Play className="w-5 h-5 text-zinc-400" />
          <span>{t("actions.playNow")}</span>
        </button>
        <button
          onClick={() => onPlayNext(contextMenu.track)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
        >
          <PlayCircle className="w-5 h-5 text-zinc-400" />
          <span>{t("actions.playNext")}</span>
        </button>
        <button
          onClick={() => onAddToQueue(contextMenu.track)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
        >
          <ListPlus className="w-5 h-5 text-zinc-400" />
          <span>{t("actions.addToQueue")}</span>
        </button>
        <div className="h-px bg-zinc-800 my-1" />
        <button
          onClick={() => onAddToPlaylist(contextMenu.track)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
        >
          <ListMusic className="w-5 h-5 text-zinc-400" />
          <span>{t("playlists.addToPlaylist")}</span>
        </button>
      </div>
    </>
  );
}

interface PlaylistContextMenuProps {
  playlistMenu: PlaylistMenuState | null;
  t: TranslateFn;
  onClose: () => void;
  onRename: (playlist: Playlist) => void;
  onDelete: (playlist: Playlist) => void;
}

export function PlaylistContextMenu({
  playlistMenu,
  t,
  onClose,
  onRename,
  onDelete,
}: PlaylistContextMenuProps) {
  if (!playlistMenu) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 min-w-[160px] rounded-xl border border-zinc-800 bg-zinc-900 py-2 shadow-2xl"
        style={{
          left: Math.min(playlistMenu.x, window.innerWidth - 180),
          top: playlistMenu.y,
        }}
      >
        <button
          onClick={() => onRename(playlistMenu.playlist)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
        >
          <Edit3 className="w-4 h-4 text-zinc-400" />
          <span>{t("playlists.rename")}</span>
        </button>
        <button
          onClick={() => onDelete(playlistMenu.playlist)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left text-red-400"
        >
          <Trash2 className="w-4 h-4" />
          <span>{t("playlists.delete")}</span>
        </button>
      </div>
    </>
  );
}

interface PlaylistNameModalProps {
  isOpen: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  playlistName: string;
  placeholder: string;
  onPlaylistNameChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function PlaylistNameModal({
  isOpen,
  title,
  confirmLabel,
  cancelLabel,
  playlistName,
  placeholder,
  onPlaylistNameChange,
  onClose,
  onConfirm,
}: PlaylistNameModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border border-zinc-800">
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        <input
          type="text"
          value={playlistName}
          onChange={(e) => onPlaylistNameChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-white/50"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && onConfirm()}
        />
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-zinc-700"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-white text-black hover:bg-zinc-200"
            disabled={!playlistName.trim()}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface DeletePlaylistModalProps {
  isOpen: boolean;
  t: TranslateFn;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeletePlaylistModal({
  isOpen,
  t,
  onClose,
  onConfirm,
}: DeletePlaylistModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border border-zinc-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <h3 className="text-lg font-bold">{t("playlists.deleteConfirm")}</h3>
        </div>
        <p className="text-zinc-400 text-sm mb-4">
          {t("playlists.deleteDescription")}
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-zinc-700"
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-red-500 text-white hover:bg-red-600"
          >
            {t("common.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AddToPlaylistModalProps {
  track: Track | null;
  playlists: Playlist[];
  t: TranslateFn;
  onClose: () => void;
  onSelect: (playlistId: string, track: Track) => void;
}

export function AddToPlaylistModal({
  track,
  playlists,
  t,
  onClose,
  onSelect,
}: AddToPlaylistModalProps) {
  if (!track) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border border-zinc-800 max-h-[80vh] flex flex-col">
        <h3 className="text-lg font-bold mb-4">
          {t("playlists.selectPlaylist")}
        </h3>
        <ScrollArea className="flex-1 -mx-2">
          <div className="px-2 space-y-2">
            {playlists.length === 0 ? (
              <p className="text-zinc-500 text-center py-4">
                {t("playlists.noPlaylists")}
              </p>
            ) : (
              playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => onSelect(playlist.id, track)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <ListMusic className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{playlist.name}</p>
                    <p className="text-xs text-zinc-500">
                      {t("library.songsCount", {
                        count: playlist.trackIds.length,
                      })}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
        <Button
          variant="outline"
          onClick={onClose}
          className="mt-4 border-zinc-700"
        >
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

interface DuplicatesModalProps {
  duplicateFileNames: string[];
  t: TranslateFn;
  onClose: () => void;
}

export function DuplicatesModal({
  duplicateFileNames,
  t,
  onClose,
}: DuplicatesModalProps) {
  if (duplicateFileNames.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border border-zinc-800 max-h-[80vh] min-h-0 flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold">{t("duplicates.title")}</h3>
            <p className="text-xs text-zinc-500">
              {duplicateFileNames.length > 1
                ? t("duplicates.skippedPlural", {
                    count: duplicateFileNames.length,
                  })
                : t("duplicates.skipped", { count: duplicateFileNames.length })}
            </p>
          </div>
        </div>
        <p className="text-zinc-400 text-sm mb-3">{t("duplicates.message")}</p>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full -mx-2 max-h-[40vh]">
            <div className="px-2 space-y-1">
              {duplicateFileNames.map((fileName, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded-lg"
                >
                  <Music2 className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <p className="text-sm text-zinc-300 truncate">{fileName}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
        <div className="pt-4">
          <Button
            onClick={onClose}
            className="w-full bg-white text-black hover:bg-zinc-200"
          >
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface OnboardingModalProps {
  isOpen: boolean;
  t: TranslateFn;
  steps: OnboardingStep[];
  currentStep: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function OnboardingModal({
  isOpen,
  t,
  steps,
  currentStep,
  onClose,
  onPrevious,
  onNext,
}: OnboardingModalProps) {
  if (!isOpen) return null;

  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-lg border border-zinc-800 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t("onboarding.title")}
          </p>
          <button
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            {t("onboarding.skip")}
          </button>
        </div>
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-white">
            {steps[currentStep].title}
          </h3>
          <p className="text-sm text-zinc-300">
            {steps[currentStep].description}
          </p>
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            {steps.map((_, index) => (
              <span
                key={index}
                className={`h-2 w-2 rounded-full transition-colors ${index === currentStep ? "bg-white" : "bg-zinc-700"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={onPrevious}
              disabled={currentStep === 0}
              className="text-zinc-300 hover:text-white"
            >
              {t("onboarding.back")}
            </Button>
            <Button
              onClick={isLastStep ? onClose : onNext}
              className="bg-white text-black hover:bg-zinc-200"
            >
              {isLastStep ? t("onboarding.done") : t("onboarding.next")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AddSongsToPlaylistModalProps {
  isOpen: boolean;
  selectedPlaylist: Playlist | null;
  library: Track[];
  t: TranslateFn;
  onClose: () => void;
  onAddTrack: (track: Track) => void;
}

export function AddSongsToPlaylistModal({
  isOpen,
  selectedPlaylist,
  library,
  t,
  onClose,
  onAddTrack,
}: AddSongsToPlaylistModalProps) {
  if (!isOpen || !selectedPlaylist) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md border border-zinc-800 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">{t("playlists.addSongs")}</h3>
            <p className="text-xs text-zinc-500">{selectedPlaylist.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <ScrollArea className="flex-1 -mx-2">
          <div className="px-2 space-y-1">
            {library.length === 0 ? (
              <div className="text-center py-8">
                <Music2 className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500">{t("library.noMusic")}</p>
              </div>
            ) : (
              library.map((track) => {
                const isInPlaylist = selectedPlaylist.trackIds.includes(
                  track.id,
                );

                return (
                  <button
                    key={track.id}
                    onClick={() => !isInPlaylist && onAddTrack(track)}
                    disabled={isInPlaylist}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                      isInPlaylist
                        ? "bg-zinc-800/30 opacity-50 cursor-not-allowed"
                        : "bg-zinc-800/50 hover:bg-zinc-800"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-zinc-700 overflow-hidden flex-shrink-0">
                      <TrackArtwork
                        src={track.coverUrl}
                        alt={track.title}
                        iconClassName="w-5 h-5 text-zinc-500"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {track.title}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {track.artist}
                      </p>
                    </div>
                    {isInPlaylist ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Plus className="w-5 h-5 text-zinc-400" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
        <Button
          variant="outline"
          onClick={onClose}
          className="mt-4 border-zinc-700"
        >
          {t("common.close")}
        </Button>
      </div>
    </div>
  );
}
