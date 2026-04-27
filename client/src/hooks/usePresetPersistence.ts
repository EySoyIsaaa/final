import { useEffect, useState } from 'react';
import { StreamingParams } from './useIntegratedAudioProcessor';

export interface EQPreset {
  id: string;
  name: string;
  bands: number[];
  timestamp: number;
}

export interface DSPPreset {
  id: string;
  name: string;
  params: StreamingParams;
  timestamp: number;
}

export interface Preset {
  id: string;
  name: string;
  eqPreset: EQPreset;
  dspPreset: DSPPreset;
  timestamp: number;
}

const STORAGE_KEY_EQ = 'epicenter_eq_presets';
const STORAGE_KEY_DSP = 'epicenter_dsp_presets';
const STORAGE_KEY_COMBINED = 'epicenter_presets';
const STORAGE_KEY_LAST_CONFIG = 'epicenter_last_config';

export function usePresetPersistence() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar presets al iniciar
  useEffect(() => {
    const loadPresets = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_COMBINED);
        if (stored) {
          setPresets(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Error loading presets:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPresets();
  }, []);

  const savePreset = (preset: Preset) => {
    try {
      const updated = [...presets, { ...preset, timestamp: Date.now() }];
      setPresets(updated);
      localStorage.setItem(STORAGE_KEY_COMBINED, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving preset:', error);
      throw error;
    }
  };

  const deletePreset = (id: string) => {
    try {
      const updated = presets.filter(p => p.id !== id);
      setPresets(updated);
      localStorage.setItem(STORAGE_KEY_COMBINED, JSON.stringify(updated));
    } catch (error) {
      console.error('Error deleting preset:', error);
      throw error;
    }
  };

  const updatePreset = (id: string, preset: Partial<Preset>) => {
    try {
      const updated = presets.map(p => 
        p.id === id ? { ...p, ...preset, timestamp: Date.now() } : p
      );
      setPresets(updated);
      localStorage.setItem(STORAGE_KEY_COMBINED, JSON.stringify(updated));
    } catch (error) {
      console.error('Error updating preset:', error);
      throw error;
    }
  };

  const saveLastConfig = (eqBands: number[], dspParams: StreamingParams) => {
    try {
      const config = {
        eqBands,
        dspParams,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY_LAST_CONFIG, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving last config:', error);
    }
  };

  const getLastConfig = (): { eqBands: number[]; dspParams: StreamingParams } | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LAST_CONFIG);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading last config:', error);
    }
    return null;
  };

  return {
    presets,
    isLoading,
    savePreset,
    deletePreset,
    updatePreset,
    saveLastConfig,
    getLastConfig,
  };
}
