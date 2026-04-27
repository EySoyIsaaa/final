/**
 * useLastTrack - Hook para recordar la última canción reproducida
 * Guarda solo el ID del track, no la posición ni la cola
 * 
 * v1.1.3
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'epicenter-last-track';

export interface LastTrackData {
  trackId: string;
  savedAt: number;
}

export function useLastTrack() {
  const [lastTrackId, setLastTrackId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cargar el último track al iniciar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data: LastTrackData = JSON.parse(saved);
        setLastTrackId(data.trackId);
        console.log('[LastTrack] Loaded last track:', data.trackId);
      }
    } catch (error) {
      console.error('[LastTrack] Error loading last track:', error);
    }
    setIsLoaded(true);
  }, []);

  // Guardar el último track reproducido
  const saveLastTrack = useCallback((trackId: string) => {
    try {
      const data: LastTrackData = {
        trackId,
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setLastTrackId(trackId);
      console.log('[LastTrack] Saved last track:', trackId);
    } catch (error) {
      console.error('[LastTrack] Error saving last track:', error);
    }
  }, []);

  // Limpiar el último track
  const clearLastTrack = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setLastTrackId(null);
    } catch (error) {
      console.error('[LastTrack] Error clearing last track:', error);
    }
  }, []);

  return {
    lastTrackId,
    isLoaded,
    saveLastTrack,
    clearLastTrack,
  };
}

export default useLastTrack;
