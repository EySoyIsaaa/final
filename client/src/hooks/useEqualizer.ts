/**
 * Glassmorphism Nocturno Design
 * Hook para ecualizador de 12 bandas con Web Audio API
 */

import { useRef, useState, useCallback, useEffect } from 'react';

export interface EqualizerBand {
  frequency: number;
  gain: number;
  label: string;
}

export const DEFAULT_BANDS: EqualizerBand[] = [
  { frequency: 32, gain: 0, label: '32 Hz' },
  { frequency: 64, gain: 0, label: '64 Hz' },
  { frequency: 125, gain: 0, label: '125 Hz' },
  { frequency: 250, gain: 0, label: '250 Hz' },
  { frequency: 500, gain: 0, label: '500 Hz' },
  { frequency: 1000, gain: 0, label: '1 kHz' },
  { frequency: 2000, gain: 0, label: '2 kHz' },
  { frequency: 4000, gain: 0, label: '4 kHz' },
  { frequency: 8000, gain: 0, label: '8 kHz' },
  { frequency: 12000, gain: 0, label: '12 kHz' },
  { frequency: 14000, gain: 0, label: '14 kHz' },
  { frequency: 16000, gain: 0, label: '16 kHz' },
];

export interface EqualizerController {
  bands: EqualizerBand[];
  enabled: boolean;
  setBandGain: (index: number, gain: number) => void;
  setEnabled: (enabled: boolean) => void;
  resetBands: () => void;
  connectToSource: (sourceNode: AudioNode) => AudioNode;
}

export function useEqualizer(audioContext: AudioContext | null): EqualizerController {
  const [bands, setBands] = useState<EqualizerBand[]>(DEFAULT_BANDS);
  const [enabled, setEnabled] = useState(true);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const inputGainRef = useRef<GainNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!audioContext) return;

    inputGainRef.current = audioContext.createGain();
    outputGainRef.current = audioContext.createGain();

    filtersRef.current = DEFAULT_BANDS.map((band, index) => {
      const filter = audioContext.createBiquadFilter();
      filter.type = index === 0 ? 'lowshelf' : index === DEFAULT_BANDS.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = band.frequency;
      filter.Q.value = 1.0;
      filter.gain.value = band.gain;
      return filter;
    });

    let currentNode: AudioNode = inputGainRef.current;
    for (const filter of filtersRef.current) {
      currentNode.connect(filter);
      currentNode = filter;
    }
    currentNode.connect(outputGainRef.current);

    return () => {
      filtersRef.current.forEach((filter) => filter.disconnect());
      inputGainRef.current?.disconnect();
      outputGainRef.current?.disconnect();
    };
  }, [audioContext]);

  const setBandGain = useCallback((index: number, gain: number) => {
    const clampedGain = Math.max(-12, Math.min(12, gain));
    
    setBands((prev) => {
      const newBands = [...prev];
      newBands[index] = { ...newBands[index], gain: clampedGain };
      return newBands;
    });

    if (filtersRef.current[index]) {
      filtersRef.current[index].gain.value = enabled ? clampedGain : 0;
    }
  }, [enabled]);

  const setEnabledCallback = useCallback((newEnabled: boolean) => {
    setEnabled(newEnabled);
    
    filtersRef.current.forEach((filter, index) => {
      filter.gain.value = newEnabled ? bands[index].gain : 0;
    });
  }, [bands]);

  const resetBands = useCallback(() => {
    setBands(DEFAULT_BANDS);
    filtersRef.current.forEach((filter) => {
      filter.gain.value = 0;
    });
  }, []);

  const connectToSource = useCallback((sourceNode: AudioNode): AudioNode => {
    if (inputGainRef.current && outputGainRef.current) {
      sourceNode.connect(inputGainRef.current);
      return outputGainRef.current;
    }
    return sourceNode;
  }, []);

  return {
    bands,
    enabled,
    setBandGain,
    setEnabled: setEnabledCallback,
    resetBands,
    connectToSource,
  };
}

export default useEqualizer;
