/**
 * useCrossfade - Hook para gestión de crossfade entre canciones
 * Persiste la configuración en localStorage
 */

import { useState, useEffect, useCallback } from 'react';

export interface CrossfadeSettings {
  enabled: boolean;
  duration: number; // segundos (3, 5, 7, 10)
}

const STORAGE_KEY = 'epicenter-crossfade';

const DEFAULT_SETTINGS: CrossfadeSettings = {
  enabled: false,
  duration: 5,
};

const getInitialSettings = (): CrossfadeSettings => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    // localStorage no disponible
  }
  return DEFAULT_SETTINGS;
};

export function useCrossfade() {
  const [settings, setSettingsState] = useState<CrossfadeSettings>(getInitialSettings);

  // Guardar en localStorage cuando cambie
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      // localStorage no disponible
    }
  }, [settings]);

  const setEnabled = useCallback((enabled: boolean) => {
    setSettingsState(prev => ({ ...prev, enabled }));
  }, []);

  const setDuration = useCallback((duration: number) => {
    setSettingsState(prev => ({ ...prev, duration }));
  }, []);

  return {
    ...settings,
    setEnabled,
    setDuration,
    setSettings: setSettingsState,
  };
}

export default useCrossfade;
