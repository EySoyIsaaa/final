/**
 * Hook para controles en notificaciones Android.
 */

import { useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { MediaSession } from '@capgo/capacitor-media-session';

export interface NotificationMetadata {
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
}

export interface NotificationHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onSeek?: (time: number) => void;
}

export interface MediaNotificationController {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  updateMetadata: (metadata: NotificationMetadata) => Promise<void>;
  updatePlaybackState: (isPlaying: boolean) => Promise<void>;
  updatePosition: (currentTime: number, duration: number) => Promise<void>;
  setHandlers: (handlers: NotificationHandlers) => void;
}

const FALLBACK_ARTWORK = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%2306b6d4'/><stop offset='100%' stop-color='%238b5cf6'/></linearGradient></defs><rect width='512' height='512' rx='120' fill='%2309090b'/><circle cx='256' cy='256' r='164' fill='none' stroke='url(%23g)' stroke-width='28'/><path d='M184 308h24l18-96 30 140 28-116 16 72h28' fill='none' stroke='url(%23g)' stroke-linecap='round' stroke-linejoin='round' stroke-width='26'/></svg>";

const toAbsoluteUrl = (src?: string) => {
  if (!src) return FALLBACK_ARTWORK;
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('content://') || src.startsWith('file://')) {
    return src;
  }
  if (src.startsWith('blob:')) {
    return src;
  }
  return new URL(src, window.location.origin).href;
};

const inferArtworkType = (src: string) => {
  if (src.startsWith('data:image/png')) return 'image/png';
  if (src.startsWith('data:image/webp')) return 'image/webp';
  if (src.startsWith('data:image/svg+xml')) return 'image/svg+xml';
  if (src.startsWith('data:image/jpeg') || src.startsWith('data:image/jpg')) return 'image/jpeg';
  if (src.endsWith('.png')) return 'image/png';
  if (src.endsWith('.webp')) return 'image/webp';
  if (src.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
};

export function useMediaNotification(): MediaNotificationController {
  const handlersRef = useRef<NotificationHandlers>({});
  const isStartedRef = useRef(false);
  const isNative = Capacitor.isNativePlatform();

  if (!isNative) {
    return {
      start: async () => {},
      stop: async () => {},
      updateMetadata: async () => {},
      updatePlaybackState: async () => {},
      updatePosition: async () => {},
      setHandlers: () => {},
    };
  }

  const start = useCallback(async () => {
    if (isStartedRef.current) return;

    try {
      await MediaSession.setActionHandler({ action: 'play' }, () => handlersRef.current.onPlay?.());
      await MediaSession.setActionHandler({ action: 'pause' }, () => handlersRef.current.onPause?.());
      await MediaSession.setActionHandler({ action: 'previoustrack' }, () => handlersRef.current.onPrevious?.());
      await MediaSession.setActionHandler({ action: 'nexttrack' }, () => handlersRef.current.onNext?.());
      await MediaSession.setActionHandler({ action: 'seekto' }, (details: any) => {
        if (details?.seekTime != null) {
          handlersRef.current.onSeek?.(details.seekTime);
        }
      });
      isStartedRef.current = true;
    } catch (error) {
      console.error('[MediaNotification] Error starting:', error);
    }
  }, []);

  const stop = useCallback(async () => {
    if (!isStartedRef.current) return;

    try {
      await MediaSession.setActionHandler({ action: 'play' }, null);
      await MediaSession.setActionHandler({ action: 'pause' }, null);
      await MediaSession.setActionHandler({ action: 'previoustrack' }, null);
      await MediaSession.setActionHandler({ action: 'nexttrack' }, null);
      await MediaSession.setActionHandler({ action: 'seekto' }, null);
      isStartedRef.current = false;
    } catch (error) {
      console.error('[MediaNotification] Error stopping:', error);
    }
  }, []);

  const updateMetadata = useCallback(async (metadata: NotificationMetadata) => {
    try {
      if (!isStartedRef.current) {
        await start();
      }

      const artworkSrc = toAbsoluteUrl(metadata.artwork);
      await MediaSession.setMetadata({
        title: metadata.title || 'Sin título',
        artist: metadata.artist || 'Artista desconocido',
        album: metadata.album || 'Epicenter Hi-Fi',
        artwork: [{ src: artworkSrc, sizes: '512x512', type: inferArtworkType(artworkSrc) }],
      });
    } catch (error) {
      console.error('[MediaNotification] Error updating metadata:', error);
    }
  }, [start]);

  const updatePlaybackState = useCallback(async (isPlaying: boolean) => {
    try {
      await MediaSession.setPlaybackState({
        playbackState: isPlaying ? 'playing' : 'paused',
      });
    } catch (error) {
      console.error('[MediaNotification] Error updating playback state:', error);
    }
  }, []);

  const updatePosition = useCallback(async (currentTime: number, duration: number) => {
    try {
      await MediaSession.setPositionState({
        duration,
        position: currentTime,
        playbackRate: 1.0,
      });
    } catch {
      // Some platforms ignore position state updates.
    }
  }, []);

  const setHandlers = useCallback((handlers: NotificationHandlers) => {
    handlersRef.current = handlers;
  }, []);

  useEffect(() => {
    return () => {
      if (isStartedRef.current) {
        void stop();
      }
    };
  }, [stop]);

  return {
    start,
    stop,
    updateMetadata,
    updatePlaybackState,
    updatePosition,
    setHandlers,
  };
}

export default useMediaNotification;
