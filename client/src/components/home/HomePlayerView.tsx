import {
  ChevronDown,
  Disc3,
  GripVertical,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AudioQualityBadge } from "@/components/AudioQualityBadge";
import { TrackArtwork } from "@/components/TrackArtwork";
import type { Track } from "@/hooks/useAudioQueue";
import type { TranslateFn } from "@/components/home/types";

type TouchStartState = { index: number; y: number } | null;

interface PlayerQueueState {
  queue: Track[];
  currentTrack: Track | null;
  currentTrackIndex: number;
  playTrack: (index: number) => void;
  removeFromQueue: (trackId: string) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  previousTrack: () => void;
  nextTrack: () => void;
}

interface AudioProcessorState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  seek: (time: number) => void;
  pause: () => void;
  play: () => void;
}

interface HomePlayerViewProps {
  isVisible: boolean;
  t: TranslateFn;
  showQueue: boolean;
  onToggleQueue: () => void;
  onCloseQueue: () => void;
  onOpenFilePicker: () => void;
  queue: PlayerQueueState;
  audioProcessor: AudioProcessorState;
  draggedIndex: number | null;
  onDraggedIndexChange: (index: number | null) => void;
  touchStart: TouchStartState;
  onTouchStartChange: (value: TouchStartState) => void;
  formatTime: (seconds: number) => string;
  hiresAudioBadgeUrl: string;
}

export function HomePlayerView({
  isVisible,
  t,
  showQueue,
  onToggleQueue,
  onCloseQueue,
  onOpenFilePicker,
  queue,
  audioProcessor,
  draggedIndex,
  onDraggedIndexChange,
  touchStart,
  onTouchStartChange,
  formatTime,
  hiresAudioBadgeUrl,
}: HomePlayerViewProps) {
  if (!isVisible) return null;

  return (
    <div className="flex-1 flex flex-col" data-testid="player-view">
      <header className="flex items-center justify-between px-6 pt-12 pb-4">
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500">
          {t("player.nowPlaying")}
        </span>
        <button
          onClick={onToggleQueue}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            showQueue ? "bg-white text-black" : "bg-zinc-900 text-zinc-400"
          }`}
        >
          {t("player.queue")} ({queue.queue.length})
        </button>
      </header>

      {showQueue ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <h3 className="font-semibold text-lg">
              {t("player.playbackQueue")}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenFilePicker}
                className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={onCloseQueue}
                className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full px-4 py-2">
              {queue.queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Disc3
                    className="w-12 h-12 text-zinc-800 mb-3"
                    strokeWidth={1}
                  />
                  <p className="text-zinc-600 text-sm">
                    {t("player.queueEmpty")}
                  </p>
                </div>
              ) : (
                <div className="space-y-1 pb-4">
                  {queue.currentTrack && queue.currentTrackIndex >= 0 && (
                    <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-amber-500/70 rounded-xl">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/80">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                          <TrackArtwork
                            src={queue.currentTrack.coverUrl}
                            alt={queue.currentTrack.title}
                            iconClassName="w-5 h-5 text-zinc-500"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-white underline decoration-amber-400/80 underline-offset-4">
                            {queue.currentTrack.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-zinc-400 truncate">
                              {queue.currentTrack.artist}
                            </p>
                            <AudioQualityBadge
                              bitDepth={queue.currentTrack.bitDepth}
                              sampleRate={queue.currentTrack.sampleRate}
                              bitrate={queue.currentTrack.bitrate}
                              isHiRes={queue.currentTrack.isHiRes}
                              compact
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {queue.queue
                    .slice(queue.currentTrackIndex + 1)
                    .map((track, index) => {
                      const actualIndex = queue.currentTrackIndex + 1 + index;

                      return (
                        <div
                          key={track.id}
                          className={`flex items-center gap-3 p-3 rounded-xl transition-all select-none ${
                            draggedIndex === actualIndex
                              ? "bg-zinc-700 scale-[1.02] shadow-lg"
                              : "hover:bg-zinc-900/50"
                          }`}
                        >
                          <div
                            className="flex items-center justify-center w-8 h-12 -ml-1 cursor-grab active:cursor-grabbing touch-none"
                            draggable
                            onDragStart={() =>
                              onDraggedIndexChange(actualIndex)
                            }
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (
                                draggedIndex !== null &&
                                draggedIndex !== actualIndex
                              ) {
                                queue.reorderQueue(draggedIndex, actualIndex);
                                onDraggedIndexChange(actualIndex);
                              }
                            }}
                            onDragEnd={() => onDraggedIndexChange(null)}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              onDraggedIndexChange(actualIndex);
                              onTouchStartChange({
                                index: actualIndex,
                                y: e.touches[0].clientY,
                              });
                            }}
                            onTouchMove={(e) => {
                              e.stopPropagation();
                              if (!touchStart || draggedIndex === null) return;

                              const currentY = e.touches[0].clientY;
                              const diff = currentY - touchStart.y;
                              const newIndex = Math.max(
                                0,
                                Math.min(
                                  queue.queue.length - 1,
                                  touchStart.index + Math.round(diff / 72),
                                ),
                              );

                              if (newIndex !== draggedIndex) {
                                queue.reorderQueue(draggedIndex, newIndex);
                                onDraggedIndexChange(newIndex);
                              }
                            }}
                            onTouchEnd={() => {
                              onDraggedIndexChange(null);
                              onTouchStartChange(null);
                            }}
                          >
                            <GripVertical className="w-5 h-5 text-zinc-500" />
                          </div>

                          <div
                            className="flex-1 flex items-center gap-3 min-w-0"
                            onClick={() => queue.playTrack(actualIndex)}
                          >
                            <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                              <TrackArtwork
                                src={track.coverUrl}
                                alt={track.title}
                                iconClassName="w-5 h-5 text-zinc-500"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate text-zinc-300">
                                {track.title}
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-zinc-500 truncate">
                                  {track.artist}
                                </p>
                                <AudioQualityBadge
                                  bitDepth={track.bitDepth}
                                  sampleRate={track.sampleRate}
                                  bitrate={track.bitrate}
                                  isHiRes={track.isHiRes}
                                  compact
                                />
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => queue.removeFromQueue(track.id)}
                            className="p-2 text-zinc-600 hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 transition-all duration-700">
            {queue.currentTrack?.coverUrl ? (
              <div
                key={queue.currentTrack.id}
                className="absolute inset-0 bg-center bg-cover scale-110 blur-3xl opacity-45 transition-all duration-700"
                style={{
                  backgroundImage: `url(${queue.currentTrack.coverUrl})`,
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
          </div>

          <div className="relative z-10 h-full min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 flex items-start justify-center px-5 sm:px-8 pt-16 pb-4 sm:pt-16 sm:pb-5">
              <div className="relative w-full max-w-[78vw] sm:max-w-[320px] aspect-square">
                <div className="w-full h-full rounded-[28px] bg-zinc-900/70 backdrop-blur-md border border-white/10 album-shadow overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
                  <TrackArtwork
                    src={queue.currentTrack?.coverUrl}
                    alt={queue.currentTrack?.title}
                    className="w-full h-full object-cover transition-all duration-700"
                    iconClassName="w-20 h-20 text-zinc-500"
                  />
                </div>
                {queue.currentTrack && (
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                    <AudioQualityBadge
                      bitDepth={queue.currentTrack.bitDepth}
                      sampleRate={queue.currentTrack.sampleRate}
                      bitrate={queue.currentTrack.bitrate}
                      isHiRes={queue.currentTrack.isHiRes}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.25rem)] z-20">
              <div className="px-5 sm:px-8 mb-2 text-center">
                <h1 className="text-[1.4rem] sm:text-2xl font-bold tracking-tight text-white truncate drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
                  {queue.currentTrack?.title || t("player.noPlayback")}
                </h1>
                <p className="text-sm text-zinc-300/90 truncate mt-1">
                  {queue.currentTrack?.artist || t("player.addMusicToStart")}
                </p>
              </div>

              <div className="px-5 sm:px-8 mb-2">
                {queue.currentTrack?.isHiRes && (
                  <div className="mb-2 flex justify-center">
                    <div className="inline-flex items-center rounded-md border border-white/70 bg-black/35 px-2 py-1">
                      <img
                        src={hiresAudioBadgeUrl}
                        alt="Hi-Res Audio"
                        className="h-7 w-auto object-contain"
                      />
                    </div>
                  </div>
                )}
                <input
                  type="range"
                  value={audioProcessor.currentTime}
                  max={audioProcessor.duration || 100}
                  step={0.1}
                  onChange={(e) =>
                    audioProcessor.seek(parseFloat(e.target.value))
                  }
                  className="w-full h-1.5 bg-zinc-800/80 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  style={{
                    background: `linear-gradient(to right, white ${(audioProcessor.currentTime / (audioProcessor.duration || 1)) * 100}%, rgba(39,39,42,0.85) ${(audioProcessor.currentTime / (audioProcessor.duration || 1)) * 100}%)`,
                  }}
                />
                <div className="flex justify-between mt-1.5 text-[11px] text-zinc-300/80 font-medium tabular-nums">
                  <span>{formatTime(audioProcessor.currentTime)}</span>
                  <span>
                    -
                    {formatTime(
                      (audioProcessor.duration || 0) -
                        audioProcessor.currentTime,
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-5 sm:gap-7 px-5 sm:px-8">
                <button
                  onClick={() => queue.previousTrack()}
                  disabled={queue.queue.length === 0}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 border border-white/10 text-zinc-100 hover:bg-white/20 disabled:opacity-30 transition-all btn-press flex items-center justify-center backdrop-blur-sm"
                >
                  <SkipBack
                    className="w-5 h-5 sm:w-6 sm:h-6"
                    fill="currentColor"
                    strokeWidth={0}
                  />
                </button>
                <button
                  onClick={
                    audioProcessor.isPlaying
                      ? audioProcessor.pause
                      : audioProcessor.play
                  }
                  disabled={!queue.currentTrack}
                  className="w-[66px] h-[66px] sm:w-[72px] sm:h-[72px] rounded-full bg-white text-black flex items-center justify-center hover:scale-105 disabled:opacity-30 transition-all btn-press shadow-[0_14px_40px_rgba(255,255,255,0.35)]"
                >
                  {audioProcessor.isPlaying ? (
                    <Pause
                      className="w-7 h-7 sm:w-8 sm:h-8"
                      fill="currentColor"
                      strokeWidth={0}
                    />
                  ) : (
                    <Play
                      className="w-7 h-7 sm:w-8 sm:h-8 ml-1"
                      fill="currentColor"
                      strokeWidth={0}
                    />
                  )}
                </button>
                <button
                  onClick={() => queue.nextTrack()}
                  disabled={queue.queue.length === 0}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 border border-white/10 text-zinc-100 hover:bg-white/20 disabled:opacity-30 transition-all btn-press flex items-center justify-center backdrop-blur-sm"
                >
                  <SkipForward
                    className="w-5 h-5 sm:w-6 sm:h-6"
                    fill="currentColor"
                    strokeWidth={0}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
