/**
 * Hook para controles de reproducción en notificaciones y pantalla bloqueada.
 */

import { useEffect, useCallback, useRef } from 'react';

export interface MediaMetadata {
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
}

export interface MediaSessionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onNextTrack?: () => void;
  onPreviousTrack?: () => void;
  onSeekTo?: (time: number) => void;
  onSeekBackward?: (offset: number) => void;
  onSeekForward?: (offset: number) => void;
}

export interface MediaSessionController {
  updateMetadata: (metadata: MediaMetadata) => void;
  updatePlaybackState: (state: 'playing' | 'paused' | 'none') => void;
  updatePosition: (position: number, duration: number, playbackRate?: number) => void;
  setHandlers: (handlers: MediaSessionHandlers) => void;
}

const FALLBACK_ARTWORK = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%2306b6d4'/><stop offset='100%' stop-color='%238b5cf6'/></linearGradient></defs><rect width='512' height='512' rx='120' fill='%2309090b'/><circle cx='256' cy='256' r='164' fill='none' stroke='url(%23g)' stroke-width='28'/><path d='M184 308h24l18-96 30 140 28-116 16 72h28' fill='none' stroke='url(%23g)' stroke-linecap='round' stroke-linejoin='round' stroke-width='26'/></svg>";

const toAbsoluteUrl = (src?: string) => {
  if (!src) return FALLBACK_ARTWORK;
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:')) {
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

export function useMediaSession(): MediaSessionController {
  const handlersRef = useRef<MediaSessionHandlers>({});
  const isSupported = 'mediaSession' in navigator;

  useEffect(() => {
    if (!isSupported) return;

    const session = navigator.mediaSession;
    session.setActionHandler('play', () => handlersRef.current.onPlay?.());
    session.setActionHandler('pause', () => handlersRef.current.onPause?.());
    session.setActionHandler('previoustrack', () => handlersRef.current.onPreviousTrack?.());
    session.setActionHandler('nexttrack', () => handlersRef.current.onNextTrack?.());
    session.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) handlersRef.current.onSeekTo?.(details.seekTime);
    });
    session.setActionHandler('seekbackward', (details) => {
      handlersRef.current.onSeekBackward?.(details.seekOffset || 10);
    });
    session.setActionHandler('seekforward', (details) => {
      handlersRef.current.onSeekForward?.(details.seekOffset || 10);
    });

    return () => {
      session.setActionHandler('play', null);
      session.setActionHandler('pause', null);
      session.setActionHandler('previoustrack', null);
      session.setActionHandler('nexttrack', null);
      session.setActionHandler('seekto', null);
      session.setActionHandler('seekbackward', null);
      session.setActionHandler('seekforward', null);
    };
  }, [isSupported]);

  const updateMetadata = useCallback((metadata: MediaMetadata) => {
    if (!isSupported) return;

    const artworkSrc = toAbsoluteUrl(metadata.artwork);
    const artworkType = inferArtworkType(artworkSrc);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: metadata.title || 'Sin título',
      artist: metadata.artist || 'Artista desconocido',
      album: metadata.album || 'Epicenter Hi-Fi',
      artwork: [96, 128, 192, 256, 384, 512].map((size) => ({
        src: artworkSrc,
        sizes: `${size}x${size}`,
        type: artworkType,
      })),
    });
  }, [isSupported]);

  const updatePlaybackState = useCallback((state: 'playing' | 'paused' | 'none') => {
    if (!isSupported) return;
    navigator.mediaSession.playbackState = state;
  }, [isSupported]);

  const updatePosition = useCallback((position: number, duration: number, playbackRate: number = 1) => {
    if (!isSupported) return;

    try {
      navigator.mediaSession.setPositionState({
        duration: duration || 0,
        playbackRate,
        position: Math.min(position, duration || 0),
      });
    } catch {
      // Not supported in all browsers.
    }
  }, [isSupported]);

  const setHandlers = useCallback((handlers: MediaSessionHandlers) => {
    handlersRef.current = handlers;
  }, []);

  return {
    updateMetadata,
    updatePlaybackState,
    updatePosition,
    setHandlers,
  };
}

export default useMediaSession;
