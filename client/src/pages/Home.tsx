/**
 * Epicenter Hi-Fi - Apple Music Style Player
 * Diseño minimalista, monocromático y premium
 * Con biblioteca de música organizada, playlists y cola interactiva
 *
 * v1.1.3 - Splash screen + Last track memory
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useIntegratedAudioProcessor,
  type StreamingParams,
} from "@/hooks/useIntegratedAudioProcessor";
import {
  analyzeSpectrumAndSelectPreset,
  applyPresetSmooth,
  suggestDspFromScores,
} from "@/audio/autoPresetSelector";
import { useAudioQueue, type Track } from "@/hooks/useAudioQueue";
import { usePlaylists, type Playlist } from "@/hooks/usePlaylists";
import { usePresetPersistence } from "@/hooks/usePresetPersistence";
import { useMediaSession } from "@/hooks/useMediaSession";
import { useMediaNotification } from "@/hooks/useMediaNotification";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useCrossfade } from "@/hooks/useCrossfade";
import { useLastTrack } from "@/hooks/useLastTrack";
import { useTheme } from "@/contexts/ThemeContext";
import { BottomNavigation } from "@/components/BottomNavigation";
import {
  AddSongsToPlaylistModal,
  AddToPlaylistModal,
  DeletePlaylistModal,
  DuplicatesModal,
  OnboardingModal,
  PlaylistContextMenu,
  PlaylistNameModal,
  TrackContextMenu,
} from "@/components/home/HomeOverlays";
import { HomeDspView } from "@/components/home/HomeDspView";
import { HomeEqView } from "@/components/home/HomeEqView";
import { HomeImportProgressOverlay } from "@/components/home/HomeImportProgressOverlay";
import { HomeLibraryView } from "@/components/home/HomeLibraryView";
import { HomePlayerView } from "@/components/home/HomePlayerView";
import { HomeSearchView } from "@/components/home/HomeSearchView";
import { HomeSettingsView } from "@/components/home/HomeSettingsView";
import {
  type DspParamConfig,
  type HomeLibraryView as LibraryView,
  type HomeTabType as TabType,
} from "@/components/home/types";
import { useLanguage } from "@/hooks/useLanguage";
import {
  useAndroidMusicLibrary,
  type AndroidMusicFile,
} from "@/hooks/useAndroidMusicLibrary";
import { hiresAudioBadgeUrl, hiresLogoUrl } from "@/lib/assetUrls";
import { toast } from "sonner";

type HomeNavigationSnapshot = {
  activeTab: TabType;
  libraryView: LibraryView;
  showQueue: boolean;
  showEqAutoModal: boolean;
  showDspAutoModal: boolean;
  showCreatePlaylist: boolean;
  showRenamePlaylist: boolean;
  showDeletePlaylist: boolean;
  showAddToPlaylist: boolean;
  showAddSongsToPlaylist: boolean;
  showOnboarding: boolean;
  onboardingStep: number;
  selectedPlaylistId: string | null;
  contextMenuOpen: boolean;
  playlistMenuOpen: boolean;
  duplicatesModalOpen: boolean;
};

const HOME_NAVIGATION_STATE_KEY = "__epicenterHomeNav";

const clampDspParam = (key: keyof StreamingParams, value: number): number => {
  switch (key) {
    case "sweepFreq":
      return Math.max(27, Math.min(63, value));
    case "width":
    case "intensity":
    case "balance":
    case "volume":
      return Math.max(0, Math.min(100, value));
    default:
      return value;
  }
};

const clampDspParams = (params: StreamingParams): StreamingParams => ({
  sweepFreq: clampDspParam("sweepFreq", params.sweepFreq),
  width: clampDspParam("width", params.width),
  intensity: clampDspParam("intensity", params.intensity),
  balance: clampDspParam("balance", params.balance),
  volume: clampDspParam("volume", params.volume),
});

export default function Home() {
  const audioProcessor = useIntegratedAudioProcessor();
  const queue = useAudioQueue();
  const presetManager = usePresetPersistence();
  const mediaSession = useMediaSession();
  const mediaNotification = useMediaNotification();
  const crossfade = useCrossfade();
  const lastTrack = useLastTrack();
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme, switchable } = useTheme();
  const playlistManager = usePlaylists(queue.library);
  const androidMusicLibrary = useAndroidMusicLibrary();

  // Solicitar permiso de notificaciones en Android 13+
  useNotificationPermission();

  const [activeTab, setActiveTab] = useState<TabType>("player");
  const [libraryView, setLibraryView] = useState<LibraryView>("main");
  const [songSort, setSongSort] = useState<"default" | "name" | "artist">(
    "default",
  );
  const [visibleSongsCount, setVisibleSongsCount] = useState(250);
  const [showQueue, setShowQueue] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [dspParams, setDspParams] = useState<StreamingParams>({
    sweepFreq: 45,
    width: 50,
    intensity: 50,
    balance: 50,
    volume: 100,
  });
  const epicenterEnabled = audioProcessor.epicenterEnabled;
  const [eqAutoEnabled, setEqAutoEnabled] = useState(false);
  const [dspAutoEnabled, setDspAutoEnabled] = useState(false);
  const [showEqAutoModal, setShowEqAutoModal] = useState(false);
  const [showDspAutoModal, setShowDspAutoModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    track: Track;
    x: number;
    y: number;
  } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Playlist states
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    null,
  );
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [showRenamePlaylist, setShowRenamePlaylist] = useState(false);
  const [showDeletePlaylist, setShowDeletePlaylist] = useState(false);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState<Track | null>(
    null,
  );
  const [showAddSongsToPlaylist, setShowAddSongsToPlaylist] = useState(false); // New: modal to add songs from library
  const [showDuplicatesModal, setShowDuplicatesModal] = useState<string[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [playlistMenu, setPlaylistMenu] = useState<{
    playlist: Playlist;
    x: number;
    y: number;
  } | null>(null);

  // Ref para evitar recargar el archivo cuando cambian los params
  const currentTrackRef = useRef<string | null>(null);
  const initialLoadRef = useRef(true);
  const lastAutoPresetTrackRef = useRef<string | null>(null);
  const lastAutoPresetTimeRef = useRef(0);
  const trackLoadRequestRef = useRef(0);
  const playTimeoutRef = useRef<number | null>(null);
  const autoOptimizationTimeoutRef = useRef<number | null>(null);
  const failedQueueTrackIdsRef = useRef<Set<string>>(new Set());
  const mediaStoreReconciledRef = useRef(false);

  const hiResTracks = useMemo(
    () => queue.library.filter((track) => track.isHiRes),
    [queue.library],
  );

  const sortedSongs = useMemo(() => {
    if (songSort === "default") return queue.library;
    const copy = [...queue.library];
    if (songSort === "name") {
      copy.sort((a, b) =>
        a.title.localeCompare(b.title, language === "es" ? "es" : "en", {
          sensitivity: "base",
        }),
      );
      return copy;
    }
    copy.sort((a, b) =>
      a.artist.localeCompare(b.artist, language === "es" ? "es" : "en", {
        sensitivity: "base",
      }),
    );
    return copy;
  }, [queue.library, songSort, language]);

  useEffect(() => {
    setVisibleSongsCount(250);
  }, [songSort, queue.library.length]);
  const normalizedGlobalQuery = globalSearchQuery.trim().toLowerCase();

  const globalResults = useMemo(() => {
    if (!normalizedGlobalQuery) return [];
    return queue.library.filter((track) =>
      `${track.title} ${track.artist}`
        .toLowerCase()
        .includes(normalizedGlobalQuery),
    );
  }, [queue.library, normalizedGlobalQuery]);

  useEffect(() => {
    const dismissed = localStorage.getItem("epicenter-onboarding-dismissed");
    const legacyDismissed = localStorage.getItem("epicenter-welcome-dismissed");
    if (!dismissed && !legacyDismissed) {
      setShowOnboarding(true);
    } else if (!dismissed && legacyDismissed) {
      localStorage.setItem("epicenter-onboarding-dismissed", "true");
    }
  }, []);

  const onboardingSteps = useMemo(
    () => [
      {
        title: t("onboarding.step1Title"),
        description: t("onboarding.step1Description"),
      },
      {
        title: t("onboarding.step2Title"),
        description: t("onboarding.step2Description"),
      },
      {
        title: t("onboarding.step3Title"),
        description: t("onboarding.step3Description"),
      },
    ],
    [t],
  );

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem("epicenter-onboarding-dismissed", "true");
    setShowOnboarding(false);
    setOnboardingStep(0);
  }, []);

  // Actualizar selectedPlaylist cuando cambien los playlists
  useEffect(() => {
    if (selectedPlaylist) {
      const updated = playlistManager.playlists.find(
        (p) => p.id === selectedPlaylist.id,
      );
      if (
        updated &&
        updated.trackIds.length !== selectedPlaylist.trackIds.length
      ) {
        setSelectedPlaylist(updated);
      }
    }
  }, [playlistManager.playlists, selectedPlaylist]);

  // Cargar última configuración
  useEffect(() => {
    const lastConfig = presetManager.getLastConfig();
    if (lastConfig) {
      setDspParams(clampDspParams(lastConfig.dspParams));
      audioProcessor.eqBands.forEach((_, index) => {
        audioProcessor.setEqBandGain(index, lastConfig.eqBands[index] || 0);
      });
    }
    initialLoadRef.current = false;
  }, []);

  // Configurar crossfade en el procesador de audio
  useEffect(() => {
    audioProcessor.setCrossfadeConfig({
      enabled: crossfade.enabled,
      duration: crossfade.duration,
    });
  }, [crossfade.enabled, crossfade.duration, audioProcessor]);

  // Configurar handlers de Media Session y Notificaciones Nativas
  useEffect(() => {
    mediaSession.setHandlers({
      onPlay: () => audioProcessor.play(),
      onPause: () => audioProcessor.pause(),
      onNextTrack: () => queue.nextTrack(),
      onPreviousTrack: () => queue.previousTrack(),
      onSeekTo: (time) => audioProcessor.seek(time),
      onSeekBackward: (offset) => {
        audioProcessor.seek(Math.max(0, audioProcessor.currentTime - offset));
      },
      onSeekForward: (offset) => {
        audioProcessor.seek(
          Math.min(
            audioProcessor.duration,
            audioProcessor.currentTime + offset,
          ),
        );
      },
    });

    mediaNotification.setHandlers({
      onPlay: () => audioProcessor.play(),
      onPause: () => audioProcessor.pause(),
      onNext: () => queue.nextTrack(),
      onPrevious: () => queue.previousTrack(),
      onSeek: (time) => audioProcessor.seek(time),
    });
  }, [audioProcessor, queue, mediaSession, mediaNotification]);

  // Actualizar metadatos en Media Session cuando cambia el track
  useEffect(() => {
    if (queue.currentTrack) {
      mediaSession.updateMetadata({
        title: queue.currentTrack.title,
        artist: queue.currentTrack.artist,
        artwork: queue.currentTrack.coverUrl,
      });

      mediaNotification.updateMetadata({
        title: queue.currentTrack.title,
        artist: queue.currentTrack.artist,
        album: "Epicenter Hi-Fi",
        artwork: queue.currentTrack.coverUrl,
      });
    }
  }, [queue.currentTrack, mediaSession, mediaNotification]);

  // Actualizar estado de reproducción
  useEffect(() => {
    mediaSession.updatePlaybackState(
      audioProcessor.isPlaying ? "playing" : "paused",
    );
    mediaNotification.updatePlaybackState(audioProcessor.isPlaying);

    if (audioProcessor.isPlaying && queue.currentTrack) {
      mediaNotification.start();
    }
  }, [
    audioProcessor.isPlaying,
    mediaSession,
    mediaNotification,
    queue.currentTrack,
  ]);

  // Actualizar posición
  useEffect(() => {
    if (audioProcessor.duration > 0) {
      mediaSession.updatePosition(
        audioProcessor.currentTime,
        audioProcessor.duration,
      );
      mediaNotification.updatePosition(
        audioProcessor.currentTime,
        audioProcessor.duration,
      );
    }
  }, [
    audioProcessor.currentTime,
    audioProcessor.duration,
    mediaSession,
    mediaNotification,
  ]);

  // Guardar configuración (debounced)
  useEffect(() => {
    if (initialLoadRef.current) return;
    const timer = setTimeout(() => {
      presetManager.saveLastConfig(
        audioProcessor.eqBands.map((b) => b.gain),
        dspParams,
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [dspParams, audioProcessor.eqBands]);

  const clearPendingPlaybackTimers = useCallback(() => {
    if (playTimeoutRef.current !== null) {
      window.clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }
    if (autoOptimizationTimeoutRef.current !== null) {
      window.clearTimeout(autoOptimizationTimeoutRef.current);
      autoOptimizationTimeoutRef.current = null;
    }
  }, []);

  const resolveTrackSource = useCallback(
    async (track: Track): Promise<File | string> => {
      if (track.sourceType === "media-store" && track.sourceUri) {
        if (track.unavailable) {
          throw new Error("Track source not available");
        }

        const stableLibraryTrack =
          (track.sourceTrackId
            ? queue.library.find((libraryTrack) => libraryTrack.id === track.sourceTrackId)
            : null) ??
          queue.library.find(
            (libraryTrack) =>
              libraryTrack.sourceType === "media-store" &&
              libraryTrack.sourceUri === track.sourceUri,
          );

        const fileUrl = await androidMusicLibrary.getAudioFileUrl(
          track.sourceUri,
          stableLibraryTrack?.id ?? track.sourceTrackId ?? track.id,
          {
            expectedSize: stableLibraryTrack?.file?.size,
            sourceVersionKey: stableLibraryTrack?.sourceVersionKey,
          },
        );

        if (!fileUrl) {
          throw new Error("No se pudo obtener el audio del dispositivo");
        }

        return fileUrl;
      }

      const trackFile = track.file ?? (await queue.getTrackFile(track));
      if (!trackFile) {
        throw new Error("Track source not available");
      }

      return trackFile;
    },
    [androidMusicLibrary, queue.getTrackFile, queue.library],
  );

  const playNextAvailableTrackAfterFailure = useCallback(
    (failedQueueTrackId: string) => {
      if (queue.queue.length <= 1) {
        return false;
      }

      const startIndex = queue.currentTrackIndex;
      for (let offset = 1; offset < queue.queue.length; offset += 1) {
        const candidateIndex = (startIndex + offset) % queue.queue.length;
        const candidateTrack = queue.queue[candidateIndex];

        if (!candidateTrack || candidateTrack.id === failedQueueTrackId) {
          continue;
        }

        if (failedQueueTrackIdsRef.current.has(candidateTrack.id)) {
          continue;
        }

        queue.playTrack(candidateIndex);
        return true;
      }

      return false;
    },
    [queue.currentTrackIndex, queue.playTrack, queue.queue],
  );

  // Configurar callbacks cuando termina o falla una canción.
  useEffect(() => {
    audioProcessor.setOnTrackEnded(() => {
      if (
        queue.queue.length > 0 &&
        queue.currentTrackIndex < queue.queue.length - 1
      ) {
        queue.nextTrack();
      }
    });

    audioProcessor.setOnTrackError((error) => {
      const failedTrackId = queue.currentTrack?.id;
      if (!failedTrackId) {
        return;
      }

      failedQueueTrackIdsRef.current.add(failedTrackId);
      clearPendingPlaybackTimers();
      audioProcessor.resetAfterError();
      currentTrackRef.current = null;
      console.error("Playback runtime error:", error);

      const movedToNextTrack = playNextAvailableTrackAfterFailure(failedTrackId);
      if (movedToNextTrack) {
        toast.error(t("actions.errorLoadingTrackSkipped"));
      } else {
        // Evitar "bloqueo" permanente por lista de fallos acumulada.
        failedQueueTrackIdsRef.current.clear();
        toast.error(t("actions.errorLoadingTrackNoFallback"));
      }
    });

    return () => {
      audioProcessor.setOnTrackEnded(null);
      audioProcessor.setOnTrackError(null);
    };
  }, [
    audioProcessor,
    clearPendingPlaybackTimers,
    playNextAvailableTrackAfterFailure,
    queue,
    t,
  ]);

  useEffect(() => {
    if (audioProcessor.isPlaying && queue.currentTrack?.id) {
      failedQueueTrackIdsRef.current.delete(queue.currentTrack.id);
    }
  }, [audioProcessor.isPlaying, queue.currentTrack?.id]);

  useEffect(() => {
    return () => {
      trackLoadRequestRef.current += 1;
      clearPendingPlaybackTimers();
    };
  }, [clearPendingPlaybackTimers]);

  useEffect(() => {
    const reconcileMediaStore = async () => {
      if (queue.isLoading || !androidMusicLibrary.isAndroid) return;

      const hasMediaStoreTracks = queue.library.some(
        (track) => track.sourceType === "media-store",
      );

      if (!hasMediaStoreTracks) return;
      if (mediaStoreReconciledRef.current) return;

      const hasPermission = await androidMusicLibrary.checkPermissions();
      if (!hasPermission) return;

      try {
        const scannedTracks = await androidMusicLibrary.scanMusicLibrary();
        const result = await queue.reconcileMediaStoreTracks(scannedTracks);
        mediaStoreReconciledRef.current = true;
        if (result.updated > 0 || result.missing > 0) {
          console.info("[Library] MediaStore reconciled", result);
        }
      } catch (error) {
        console.warn("[Library] MediaStore reconciliation failed", error);
      }
    };

    void reconcileMediaStore();
  }, [
    androidMusicLibrary,
    queue.isLoading,
    queue.library,
    queue.reconcileMediaStoreTracks,
  ]);

  // Cargar última canción al iniciar (sin autoplay)
  const lastTrackLoadedRef = useRef(false);
  useEffect(() => {
    const loadLastTrack = async () => {
      if (
        !queue.isLoading &&
        lastTrack.isLoaded &&
        lastTrack.lastTrackId &&
        !queue.currentTrack &&
        !lastTrackLoadedRef.current
      ) {
        lastTrackLoadedRef.current = true;

        const track = queue.library.find((t) => t.id === lastTrack.lastTrackId);
        if (!track) return;

        const requestId = ++trackLoadRequestRef.current;
        clearPendingPlaybackTimers();
        currentTrackRef.current = track.id;

        console.log("[LastTrack] Loading last track:", track.title);
        queue.addToQueue(track);
        queue.playTrack(0);

        try {
          const source = await resolveTrackSource(track);

          if (trackLoadRequestRef.current !== requestId) {
            return;
          }

          await audioProcessor.loadFile(source, dspParams);

          if (trackLoadRequestRef.current !== requestId) {
            return;
          }
        } catch (error) {
          if (trackLoadRequestRef.current === requestId) {
            currentTrackRef.current = null;
            console.error("[LastTrack] Error loading last track:", error);
          }
        }
      }
    };

    void loadLastTrack();
  }, [
    audioProcessor,
    clearPendingPlaybackTimers,
    dspParams,
    lastTrack.isLoaded,
    lastTrack.lastTrackId,
    queue.addToQueue,
    queue.isLoading,
    queue.library,
    queue.playTrack,
    resolveTrackSource,
  ]);

  // Cargar track cuando cambia (y guardar como último track)
  useEffect(() => {
    const requestedTrack = queue.currentTrack;

    if (!requestedTrack || requestedTrack.id === currentTrackRef.current) {
      return;
    }

    const requestId = ++trackLoadRequestRef.current;
    clearPendingPlaybackTimers();
    currentTrackRef.current = requestedTrack.id;

    const loadTrack = async () => {
      const libraryTrack = queue.library.find(
        (track) =>
          track.sourceUri === requestedTrack.sourceUri ||
          (track.title === requestedTrack.title &&
            track.artist === requestedTrack.artist),
      );

      if (libraryTrack) {
        lastTrack.saveLastTrack(libraryTrack.id);
      }

      try {
        const source = await resolveTrackSource(requestedTrack);

        if (
          trackLoadRequestRef.current !== requestId ||
          queue.currentTrack?.id !== requestedTrack.id
        ) {
          return;
        }

        await audioProcessor.loadFile(source, dspParams);

        if (
          trackLoadRequestRef.current !== requestId ||
          queue.currentTrack?.id !== requestedTrack.id
        ) {
          return;
        }

        playTimeoutRef.current = window.setTimeout(() => {
          if (
            trackLoadRequestRef.current !== requestId ||
            queue.currentTrack?.id !== requestedTrack.id
          ) {
            return;
          }

          audioProcessor.play();

          autoOptimizationTimeoutRef.current = window.setTimeout(() => {
            if (
              trackLoadRequestRef.current !== requestId ||
              queue.currentTrack?.id !== requestedTrack.id
            ) {
              return;
            }

            void runAutoOptimization();
          }, 1400);
        }, 100);
      } catch (error) {
        if (
          trackLoadRequestRef.current === requestId &&
          queue.currentTrack?.id === requestedTrack.id
        ) {
          failedQueueTrackIdsRef.current.add(requestedTrack.id);
          audioProcessor.resetAfterError();
          currentTrackRef.current = null;
          console.error("Error loading track:", error);
          const movedToNextTrack = playNextAvailableTrackAfterFailure(
            requestedTrack.id,
          );

          if (movedToNextTrack) {
            toast.error(t("actions.errorLoadingTrackSkipped"));
          } else {
            failedQueueTrackIdsRef.current.clear();
            toast.error(t("actions.errorLoadingTrackNoFallback"));
          }
        }
      }
    };

    void loadTrack();
  }, [
    audioProcessor,
    clearPendingPlaybackTimers,
    dspParams,
    lastTrack.saveLastTrack,
    queue.currentTrack,
    queue.library,
    queue.playTrack,
    queue.queue,
    resolveTrackSource,
    playNextAvailableTrackAfterFailure,
    t,
  ]);

  const handleFileSelect = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        try {
          const result = await queue.addToLibrary(files);

          // Show success message for added songs
          if (result.added > 0) {
            const msg =
              result.added > 1
                ? t("actions.songsAddedPlural", { count: result.added })
                : t("actions.songsAdded", { count: result.added });
            toast.success(msg);
          }

          // Show duplicates modal if any
          if (result.duplicates.length > 0) {
            setShowDuplicatesModal(result.duplicates);
          }
        } catch (error) {
          toast.error(t("actions.errorAddingSongs"));
        }
      }
    };
    input.click();
  }, [queue, t]);

  const handleMediaStoreImport = useCallback(
    async (tracks: AndroidMusicFile[]) => {
      const result = await queue.addMediaStoreTracks(
        tracks,
        androidMusicLibrary.getAlbumArt,
      );

      if (result.added > 0) {
        const msg =
          result.added > 1
            ? t("actions.songsAddedPlural", { count: result.added })
            : t("actions.songsAdded", { count: result.added });
        toast.success(msg);
      }

      if (result.duplicates.length > 0) {
        setShowDuplicatesModal(result.duplicates);
      }

      return result;
    },
    [queue, t],
  );

  const updateDspParam = useCallback(
    (key: keyof StreamingParams, value: number) => {
      const clampedValue = clampDspParam(key, value);
      setDspParams((prev) => ({ ...prev, [key]: clampedValue }));
      if (key === "volume" || epicenterEnabled) {
        audioProcessor.setDspParam(key, clampedValue);
      }
    },
    [audioProcessor, epicenterEnabled],
  );

  const toggleEq = useCallback(
    (enabled: boolean) => {
      audioProcessor.setEqEnabled(enabled);

      // Epicenter debe poder seguir activo de forma independiente aunque el EQ se apague.
    },
    [audioProcessor, epicenterEnabled],
  );

  const toggleEpicenter = useCallback(() => {
    const newEnabled = !epicenterEnabled;
    audioProcessor.setEpicenterEnabled(newEnabled);
    if (newEnabled) {
      Object.entries(dspParams).forEach(([key, value]) => {
        audioProcessor.setDspParam(key as keyof StreamingParams, value);
      });
    }
  }, [epicenterEnabled, audioProcessor, dspParams]);

  async function runAutoOptimization(force = false) {
    if (!eqAutoEnabled && !dspAutoEnabled) return;
    if (!queue.currentTrack) return;

    const now = Date.now();
    if (
      !force &&
      lastAutoPresetTrackRef.current === queue.currentTrack.id &&
      now - lastAutoPresetTimeRef.current < 30000
    ) {
      return;
    }

    const analyserNode = audioProcessor.getAnalyserNode();
    const selection = await analyzeSpectrumAndSelectPreset({
      analyserNode,
      sampleCount: 80,
      intervalMs: 125,
    });

    if (eqAutoEnabled) {
      const currentGains = audioProcessor.eqBands.map((band) => band.gain);
      await applyPresetSmooth({
        currentGains,
        targetGains: selection.preset.gainsDb,
        setEqBandGain: audioProcessor.setEqBandGain,
        durationMs: 800,
        stepMs: 100,
        maxDeltaPerStep: 0.5,
      });
      audioProcessor.setEqPreampDb(selection.preset.preampDb);
      audioProcessor.setEqEnabled(true);
    }

    if (dspAutoEnabled) {
      if (!epicenterEnabled) {
        audioProcessor.setEpicenterEnabled(true);
      }
      const dspSuggestion = suggestDspFromScores(selection.debug);
      const clampedSuggestion = clampDspParams({
        ...dspParams,
        ...dspSuggestion,
      });
      setDspParams(clampedSuggestion);
      Object.entries(clampedSuggestion).forEach(([key, value]) => {
        if (typeof value === "number") {
          audioProcessor.setDspParam(key as keyof StreamingParams, value);
        }
      });
    }

    lastAutoPresetTrackRef.current = queue.currentTrack.id;
    lastAutoPresetTimeRef.current = now;

    console.log("[AutoAdjustment]", {
      presetId: selection.presetId,
      presetName: selection.preset.name,
      debug: selection.debug,
    });

    toast.success(t("actions.autoOptimizedPreset"));
  }

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Agrupar canciones
  const songsByArtist = useMemo(
    () =>
      queue.library.reduce(
        (acc, track) => {
          const artist = track.artist || t("common.unknownArtist");
          if (!acc[artist]) acc[artist] = [];
          acc[artist].push(track);
          return acc;
        },
        {} as Record<string, Track[]>,
      ),
    [queue.library, t],
  );

  const albums = useMemo(
    () =>
      queue.library.reduce(
        (acc, track) => {
          const album = track.title.split(" - ")[0] || track.title;
          if (!acc[album]) acc[album] = [];
          acc[album].push(track);
          return acc;
        },
        {} as Record<string, Track[]>,
      ),
    [queue.library],
  );

  // Handlers
  const handleAddToQueue = (track: Track) => {
    queue.addToQueue(track);
    toast.success(t("actions.addedToQueue"));
    setContextMenu(null);
  };

  const handlePlayNext = (track: Track) => {
    queue.addToQueueNext(track);
    toast.success(t("actions.willPlayNext"));
    setContextMenu(null);
  };

  const handlePlayNow = (track: Track) => {
    queue.playNow(track);
    setContextMenu(null);
    setActiveTab("player");
    setShowQueue(false);
  };

  const handlePersistEphemeralTrack = useCallback(
    async (track: Track) => {
      try {
        const persisted = await queue.persistEphemeralTrack(track.id);
        if (persisted) {
          toast.success(t("actions.persistTrackSuccess"));
        } else {
          toast.error(t("actions.persistTrackFailed"));
        }
      } catch (error) {
        console.error("Error persisting track:", error);
        toast.error(t("actions.persistTrackFailed"));
      }
    },
    [queue, t],
  );

  const handleShufflePlay = (tracks: Track[]) => {
    if (tracks.length === 0) {
      toast.error(t("actions.noSongsToPlay"));
      return;
    }
    queue.shuffleAll(tracks);
    toast.success(t("actions.playingShuffled", { count: tracks.length }));
    setActiveTab("player");
    setShowQueue(false);
  };

  const handlePlayInOrder = (tracks: Track[]) => {
    if (tracks.length === 0) {
      toast.error(t("actions.noSongsToPlay"));
      return;
    }
    queue.playAllInOrder(tracks);
    toast.success(t("actions.playingAll", { count: tracks.length }));
    setActiveTab("player");
    setShowQueue(false);
  };

  // Playlist handlers
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    await playlistManager.createPlaylist(newPlaylistName.trim());
    toast.success(t("playlists.created"));
    setNewPlaylistName("");
    setShowCreatePlaylist(false);
  };

  const handleRenamePlaylist = async () => {
    if (!selectedPlaylist || !newPlaylistName.trim()) return;
    await playlistManager.renamePlaylist(
      selectedPlaylist.id,
      newPlaylistName.trim(),
    );
    setSelectedPlaylist({ ...selectedPlaylist, name: newPlaylistName.trim() });
    toast.success(t("playlists.renamed"));
    setNewPlaylistName("");
    setShowRenamePlaylist(false);
    setPlaylistMenu(null);
  };

  const handleDeletePlaylist = async () => {
    if (!selectedPlaylist) return;
    await playlistManager.deletePlaylist(selectedPlaylist.id);
    toast.success(t("playlists.deleted"));
    setSelectedPlaylist(null);
    setShowDeletePlaylist(false);
    setPlaylistMenu(null);
    setLibraryView("playlists");
  };

  const handleAddToPlaylist = async (playlistId: string, track: Track) => {
    await playlistManager.addTrackToPlaylist(playlistId, track.id);
    toast.success(t("playlists.songAdded"));
    setShowAddToPlaylist(null);
  };

  const handleRemoveFromPlaylist = async (track: Track) => {
    if (!selectedPlaylist) return;
    await playlistManager.removeTrackFromPlaylist(
      selectedPlaylist.id,
      track.id,
    );
    // Update local state
    const updatedPlaylist = playlistManager.playlists.find(
      (p) => p.id === selectedPlaylist.id,
    );
    if (updatedPlaylist) {
      setSelectedPlaylist(updatedPlaylist);
    }
    toast.success(t("playlists.songRemoved"));
  };

  // Handler para abrir modal de selección de playlist desde cualquier canción
  const handleOpenAddToPlaylist = (track: Track) => {
    setShowAddToPlaylist(track);
  };

  // Handler para agregar canción a la playlist seleccionada (desde el modal dentro de playlist-detail)
  const handleAddSongToSelectedPlaylist = async (track: Track) => {
    if (!selectedPlaylist) return;

    // Check if already in playlist
    if (selectedPlaylist.trackIds.includes(track.id)) {
      toast.error(t("duplicates.alreadyInPlaylist"));
      return;
    }

    await playlistManager.addTrackToPlaylist(selectedPlaylist.id, track.id);
    toast.success(t("playlists.songAdded"));
  };

  // Touch reorder state
  const [touchStart, setTouchStart] = useState<{
    index: number;
    y: number;
  } | null>(null);
  const isRestoringNavigationRef = useRef(false);
  const lastNavigationSnapshotRef = useRef<HomeNavigationSnapshot | null>(null);

  const buildNavigationSnapshot = useCallback(
    (): HomeNavigationSnapshot => ({
      activeTab,
      libraryView,
      showQueue,
      showEqAutoModal,
      showDspAutoModal,
      showCreatePlaylist,
      showRenamePlaylist,
      showDeletePlaylist,
      showAddToPlaylist: !!showAddToPlaylist,
      showAddSongsToPlaylist,
      showOnboarding,
      onboardingStep,
      selectedPlaylistId: selectedPlaylist?.id ?? null,
      contextMenuOpen: !!contextMenu,
      playlistMenuOpen: !!playlistMenu,
      duplicatesModalOpen: showDuplicatesModal.length > 0,
    }),
    [
      activeTab,
      libraryView,
      showQueue,
      showEqAutoModal,
      showDspAutoModal,
      showCreatePlaylist,
      showRenamePlaylist,
      showDeletePlaylist,
      showAddToPlaylist,
      showAddSongsToPlaylist,
      showOnboarding,
      onboardingStep,
      selectedPlaylist,
      contextMenu,
      playlistMenu,
      showDuplicatesModal,
    ],
  );

  const applyNavigationSnapshot = useCallback(
    (snapshot: HomeNavigationSnapshot) => {
      isRestoringNavigationRef.current = true;

      setActiveTab(snapshot.activeTab);
      setLibraryView(snapshot.libraryView);
      setShowQueue(snapshot.showQueue);
      setShowEqAutoModal(snapshot.showEqAutoModal);
      setShowDspAutoModal(snapshot.showDspAutoModal);
      setShowCreatePlaylist(snapshot.showCreatePlaylist);
      setShowRenamePlaylist(snapshot.showRenamePlaylist);
      setShowDeletePlaylist(snapshot.showDeletePlaylist);
      setShowAddSongsToPlaylist(snapshot.showAddSongsToPlaylist);
      setShowOnboarding(snapshot.showOnboarding);
      setOnboardingStep(snapshot.onboardingStep);

      if (!snapshot.showAddToPlaylist) {
        setShowAddToPlaylist(null);
      }
      if (!snapshot.contextMenuOpen) {
        setContextMenu(null);
      }
      if (!snapshot.playlistMenuOpen) {
        setPlaylistMenu(null);
      }
      if (!snapshot.duplicatesModalOpen) {
        setShowDuplicatesModal([]);
      }

      const snapshotPlaylist =
        snapshot.selectedPlaylistId
          ? playlistManager.playlists.find(
              (playlist) => playlist.id === snapshot.selectedPlaylistId,
            ) ?? null
          : null;

      if (snapshot.libraryView === "playlist-detail" && !snapshotPlaylist) {
        setLibraryView("playlists");
      }

      setSelectedPlaylist(snapshotPlaylist);

      window.setTimeout(() => {
        isRestoringNavigationRef.current = false;
      }, 0);
    },
    [playlistManager.playlists],
  );

  useEffect(() => {
    const initialSnapshot = buildNavigationSnapshot();
    lastNavigationSnapshotRef.current = initialSnapshot;

    window.history.replaceState(
      {
        ...(window.history.state ?? {}),
        [HOME_NAVIGATION_STATE_KEY]: initialSnapshot,
      },
      "",
    );
  }, []);

  useEffect(() => {
    if (isRestoringNavigationRef.current) return;

    const nextSnapshot = buildNavigationSnapshot();
    const previousSnapshot = lastNavigationSnapshotRef.current;

    if (
      previousSnapshot &&
      JSON.stringify(previousSnapshot) === JSON.stringify(nextSnapshot)
    ) {
      return;
    }

    lastNavigationSnapshotRef.current = nextSnapshot;
    window.history.pushState(
      {
        ...(window.history.state ?? {}),
        [HOME_NAVIGATION_STATE_KEY]: nextSnapshot,
      },
      "",
    );
  }, [buildNavigationSnapshot]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const navigationSnapshot = event.state?.[
        HOME_NAVIGATION_STATE_KEY
      ] as HomeNavigationSnapshot | undefined;

      if (!navigationSnapshot) {
        return;
      }

      lastNavigationSnapshotRef.current = navigationSnapshot;
      applyNavigationSnapshot(navigationSnapshot);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyNavigationSnapshot]);

  const dspControls = useMemo<DspParamConfig[]>(
    () => [
      {
        key: "sweepFreq",
        label: t("dsp.sweep"),
        value: dspParams.sweepFreq,
        min: 27,
        max: 63,
        step: 1,
        unit: " Hz",
        onChange: (value) => updateDspParam("sweepFreq", value),
        disabled: !epicenterEnabled,
      },
      {
        key: "width",
        label: t("dsp.width"),
        value: dspParams.width,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        onChange: (value) => updateDspParam("width", value),
        disabled: !epicenterEnabled,
      },
      {
        key: "intensity",
        label: t("dsp.intensity"),
        value: dspParams.intensity,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        onChange: (value) => updateDspParam("intensity", value),
        disabled: !epicenterEnabled,
      },
      {
        key: "balance",
        label: t("dsp.balance"),
        value: dspParams.balance,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        onChange: (value) => updateDspParam("balance", value),
        disabled: !epicenterEnabled,
      },
      {
        key: "volume",
        label: t("dsp.volume"),
        value: dspParams.volume,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        onChange: (value) => updateDspParam("volume", value),
      },
    ],
    [dspParams, epicenterEnabled, t, updateDspParam],
  );

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <TrackContextMenu
        contextMenu={contextMenu}
        t={t}
        onClose={() => setContextMenu(null)}
        onPlayNow={handlePlayNow}
        onPlayNext={handlePlayNext}
        onAddToQueue={handleAddToQueue}
        onAddToPlaylist={(track) => {
          setShowAddToPlaylist(track);
          setContextMenu(null);
        }}
      />

      <PlaylistContextMenu
        playlistMenu={playlistMenu}
        t={t}
        onClose={() => setPlaylistMenu(null)}
        onRename={(playlist) => {
          setSelectedPlaylist(playlist);
          setNewPlaylistName(playlist.name);
          setShowRenamePlaylist(true);
        }}
        onDelete={(playlist) => {
          setSelectedPlaylist(playlist);
          setShowDeletePlaylist(true);
        }}
      />

      <PlaylistNameModal
        isOpen={showCreatePlaylist}
        title={t("playlists.createNew")}
        confirmLabel={t("playlists.create")}
        cancelLabel={t("common.cancel")}
        playlistName={newPlaylistName}
        placeholder={t("playlists.enterName")}
        onPlaylistNameChange={setNewPlaylistName}
        onClose={() => {
          setShowCreatePlaylist(false);
          setNewPlaylistName("");
        }}
        onConfirm={handleCreatePlaylist}
      />

      <PlaylistNameModal
        isOpen={showRenamePlaylist && !!selectedPlaylist}
        title={t("playlists.rename")}
        confirmLabel={t("common.save")}
        cancelLabel={t("common.cancel")}
        playlistName={newPlaylistName}
        placeholder={t("playlists.enterName")}
        onPlaylistNameChange={setNewPlaylistName}
        onClose={() => {
          setShowRenamePlaylist(false);
          setNewPlaylistName("");
          setPlaylistMenu(null);
        }}
        onConfirm={handleRenamePlaylist}
      />

      <DeletePlaylistModal
        isOpen={showDeletePlaylist && !!selectedPlaylist}
        t={t}
        onClose={() => {
          setShowDeletePlaylist(false);
          setPlaylistMenu(null);
        }}
        onConfirm={handleDeletePlaylist}
      />

      <AddToPlaylistModal
        track={showAddToPlaylist}
        playlists={playlistManager.playlists}
        t={t}
        onClose={() => setShowAddToPlaylist(null)}
        onSelect={handleAddToPlaylist}
      />

      <DuplicatesModal
        duplicateFileNames={showDuplicatesModal}
        t={t}
        onClose={() => setShowDuplicatesModal([])}
      />

      <OnboardingModal
        isOpen={showOnboarding}
        t={t}
        steps={onboardingSteps}
        currentStep={onboardingStep}
        onClose={dismissOnboarding}
        onPrevious={() => setOnboardingStep((prev) => Math.max(prev - 1, 0))}
        onNext={() =>
          setOnboardingStep((prev) =>
            Math.min(prev + 1, onboardingSteps.length - 1),
          )
        }
      />

      <AddSongsToPlaylistModal
        isOpen={showAddSongsToPlaylist}
        selectedPlaylist={selectedPlaylist}
        library={queue.library}
        t={t}
        onClose={() => setShowAddSongsToPlaylist(false)}
        onAddTrack={handleAddSongToSelectedPlaylist}
      />

      <HomePlayerView
        isVisible={activeTab === "player"}
        t={t}
        showQueue={showQueue}
        onToggleQueue={() => setShowQueue(!showQueue)}
        onCloseQueue={() => setShowQueue(false)}
        onOpenFilePicker={handleFileSelect}
        queue={{
          queue: queue.queue,
          currentTrack: queue.currentTrack,
          currentTrackIndex: queue.currentTrackIndex,
          playTrack: queue.playTrack,
          removeFromQueue: queue.removeFromQueue,
          reorderQueue: queue.reorderQueue,
          previousTrack: queue.previousTrack,
          nextTrack: queue.nextTrack,
        }}
        audioProcessor={{
          currentTime: audioProcessor.currentTime,
          duration: audioProcessor.duration,
          isPlaying: audioProcessor.isPlaying,
          seek: audioProcessor.seek,
          pause: audioProcessor.pause,
          play: audioProcessor.play,
        }}
        draggedIndex={draggedIndex}
        onDraggedIndexChange={setDraggedIndex}
        touchStart={touchStart}
        onTouchStartChange={setTouchStart}
        formatTime={formatTime}
        hiresAudioBadgeUrl={hiresAudioBadgeUrl}
      />

      {activeTab === "library" && (
        <HomeLibraryView
          t={t}
          libraryView={libraryView}
          setLibraryView={setLibraryView}
          queueLibrary={queue.library}
          queueIsLoading={queue.isLoading}
          importIsImporting={queue.importProgress.isImporting}
          playlists={playlistManager.playlists}
          selectedPlaylist={selectedPlaylist}
          setSelectedPlaylist={setSelectedPlaylist}
          hiResTracks={hiResTracks}
          songsByArtist={songsByArtist}
          albums={albums}
          sortedSongs={sortedSongs}
          songSort={songSort}
          setSongSort={setSongSort}
          visibleSongsCount={visibleSongsCount}
          setVisibleSongsCount={setVisibleSongsCount}
          playlistMenu={playlistMenu}
          setPlaylistMenu={setPlaylistMenu}
          onCreatePlaylist={() => setShowCreatePlaylist(true)}
          onOpenFilePicker={handleFileSelect}
          onImportMediaStoreTracks={handleMediaStoreImport}
          onPlayNow={handlePlayNow}
          onAddToQueue={handleAddToQueue}
          onPlayNext={handlePlayNext}
          onAddToPlaylist={handleOpenAddToPlaylist}
          onPlayInOrder={handlePlayInOrder}
          onShufflePlay={handleShufflePlay}
          onOpenAddToPlaylist={handleOpenAddToPlaylist}
          onPersistEphemeralTrack={handlePersistEphemeralTrack}
          onOpenAddSongsToPlaylist={() => setShowAddSongsToPlaylist(true)}
          onOpenDeletePlaylist={(playlist) => {
            setSelectedPlaylist(playlist);
            setShowDeletePlaylist(true);
          }}
          onOpenRenamePlaylist={(playlist) => {
            setSelectedPlaylist(playlist);
            setNewPlaylistName(playlist.name);
            setShowRenamePlaylist(true);
          }}
          onRemoveFromPlaylist={handleRemoveFromPlaylist}
          hiresLogoUrl={hiresLogoUrl}
        />
      )}

      {activeTab === "search" && (
        <HomeSearchView
          t={t}
          globalSearchQuery={globalSearchQuery}
          setGlobalSearchQuery={setGlobalSearchQuery}
          normalizedGlobalQuery={normalizedGlobalQuery}
          globalResults={globalResults}
          onPlayNow={handlePlayNow}
          onAddToQueue={handleAddToQueue}
          onPlayNext={handlePlayNext}
          onAddToPlaylist={handleOpenAddToPlaylist}
        />
      )}

      {activeTab === "eq" && (
        <HomeEqView
          t={t}
          eqEnabled={audioProcessor.eqEnabled}
          eqBands={audioProcessor.eqBands}
          onToggleEq={toggleEq}
          onOpenAutoModal={() => setShowEqAutoModal(true)}
          onSetEqBandGain={audioProcessor.setEqBandGain}
          onResetEq={() =>
            audioProcessor.eqBands.forEach((_, index) =>
              audioProcessor.setEqBandGain(index, 0),
            )
          }
        />
      )}

      {activeTab === "dsp" && (
        <HomeDspView
          t={t}
          epicenterEnabled={epicenterEnabled}
          params={dspControls}
          onOpenAutoModal={() => setShowDspAutoModal(true)}
          onToggleEpicenter={toggleEpicenter}
        />
      )}

      {showEqAutoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md border border-zinc-800 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{t("eq.autoTitle")}</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  {t("eq.autoDescription")}
                </p>
              </div>
              <button
                onClick={() => setShowEqAutoModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
              <p className="text-sm text-zinc-300">{t("eq.autoEnable")}</p>
              <Switch
                checked={eqAutoEnabled}
                onCheckedChange={setEqAutoEnabled}
              />
            </div>
            <Button
              onClick={() => {
                runAutoOptimization(true);
                setShowEqAutoModal(false);
              }}
              className="w-full bg-white text-black hover:bg-zinc-200"
            >
              {t("eq.autoApplyNow")}
            </Button>
          </div>
        </div>
      )}

      {showDspAutoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md border border-zinc-800 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{t("dsp.autoTitle")}</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  {t("dsp.autoDescription")}
                </p>
              </div>
              <button
                onClick={() => setShowDspAutoModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
              <p className="text-sm text-zinc-300">{t("dsp.autoEnable")}</p>
              <Switch
                checked={dspAutoEnabled}
                onCheckedChange={setDspAutoEnabled}
              />
            </div>
            <Button
              onClick={() => {
                runAutoOptimization(true);
                setShowDspAutoModal(false);
              }}
              className="w-full bg-white text-black hover:bg-zinc-200"
            >
              {t("dsp.autoApplyNow")}
            </Button>
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <HomeSettingsView
          t={t}
          switchable={switchable}
          theme={theme}
          toggleTheme={toggleTheme}
          language={language}
          setLanguage={setLanguage}
          crossfadeEnabled={crossfade.enabled}
          crossfadeDuration={crossfade.duration}
          onCrossfadeEnabledChange={crossfade.setEnabled}
          onCrossfadeDurationChange={crossfade.setDuration}
        />
      )}

      <HomeImportProgressOverlay t={t} importProgress={queue.importProgress} />

      {/* Bottom Navigation */}
      <BottomNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLibraryTab={() => {
          setActiveTab("library");
          setLibraryView("main");
        }}
        eqEnabled={audioProcessor.eqEnabled}
        epicenterEnabled={epicenterEnabled}
        t={t}
      />
      <div className={activeTab === "player" ? "h-0" : "h-20"} />
    </div>
  );
}
