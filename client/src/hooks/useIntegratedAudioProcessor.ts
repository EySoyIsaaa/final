/**
 * Glassmorphism Nocturno Design
 * Hook integrado que combina Epicenter DSP + Ecualizador de 31 bandas
 * Arquitectura: AudioElement → Epicenter Worklet → Equalizer Filters → Destination
 * 
 * v1.1.1 - Agregado soporte para:
 * - Callback onTrackEnded para continuar reproducción automática
 * - Crossfade entre canciones
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface StreamingParams {
  sweepFreq: number;
  width: number;
  intensity: number;
  balance: number;
  volume: number;
}

const clampStreamingParam = (name: keyof StreamingParams, value: number): number => {
  switch (name) {
    case 'sweepFreq':
      return Math.max(27, Math.min(63, value));
    case 'width':
    case 'intensity':
    case 'balance':
    case 'volume':
      return Math.max(0, Math.min(100, value));
    default:
      return value;
  }
};

const clampStreamingParams = (params: StreamingParams): StreamingParams => ({
  sweepFreq: clampStreamingParam('sweepFreq', params.sweepFreq),
  width: clampStreamingParam('width', params.width),
  intensity: clampStreamingParam('intensity', params.intensity),
  balance: clampStreamingParam('balance', params.balance),
  volume: clampStreamingParam('volume', params.volume),
});

export interface EqualizerBand {
  frequency: number;
  gain: number;
  label: string;
}

export interface AudioAnalysisResult {
  bandGains: number[];
  suggestedDsp: Partial<StreamingParams>;
}

export interface CrossfadeConfig {
  enabled: boolean;
  duration: number; // segundos
}

export const EQ_GAIN_MIN = -8;
export const EQ_GAIN_MAX = 8;

const EQ_31_FREQUENCIES = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160,
  200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
  2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000,
];

const formatEqLabel = (frequency: number) => {
  if (frequency >= 1000) {
    const khz = frequency / 1000;
    return Number.isInteger(khz) ? `${khz} kHz` : `${khz.toFixed(1)} kHz`;
  }
  return `${frequency} Hz`;
};

export const DEFAULT_EQ_BANDS: EqualizerBand[] = EQ_31_FREQUENCIES.map((frequency) => ({
  frequency,
  gain: 0,
  label: formatEqLabel(frequency),
}));

export interface IntegratedAudioController {
  isReady: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loadFile: (file: File | string, dspParams: StreamingParams) => Promise<void>;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setDspParam: (name: keyof StreamingParams, value: number) => void;
  setEqBandGain: (index: number, gain: number) => void;
  setEqEnabled: (enabled: boolean) => void;
  setEpicenterEnabled: (enabled: boolean) => void;
  setEqPreampDb: (preampDb: number) => void;
  getAnalyserNode: () => AnalyserNode | null;
  getCurrentDspParams: () => StreamingParams;
  setOnTrackEnded: (callback: (() => void) | null) => void;
  setOnTrackError: (callback: ((error: Error) => void) | null) => void;
  setCrossfadeConfig: (config: CrossfadeConfig) => void;
  resetAfterError: () => void;
  eqBands: EqualizerBand[];
  eqEnabled: boolean;
  epicenterEnabled: boolean;
}

export function useIntegratedAudioProcessor(): IntegratedAudioController {
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const eqInputGainRef = useRef<GainNode | null>(null);
  const eqOutputGainRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const bypassConnectionRef = useRef<boolean>(false);
  const objectUrlRef = useRef<string | null>(null);
  const dspParamsRef = useRef<StreamingParams>({
    sweepFreq: 45,
    width: 50,
    intensity: 50,
    balance: 50,
    volume: 100,
  });
  
  // Callback para cuando termina una canción
  const onTrackEndedRef = useRef<(() => void) | null>(null);
  const onTrackErrorRef = useRef<((error: Error) => void) | null>(null);
  
  // Configuración de crossfade
  const crossfadeConfigRef = useRef<CrossfadeConfig>({
    enabled: false,
    duration: 5,
  });
  const crossfadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCrossfadingRef = useRef(false);
  const pendingCrossfadeInRef = useRef(false);
  
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [eqBands, setEqBands] = useState<EqualizerBand[]>(DEFAULT_EQ_BANDS);
  const [eqEnabled, setEqEnabledState] = useState(true);
  const [epicenterEnabled, setEpicenterEnabledState] = useState(false);
  const eqBandsRef = useRef<EqualizerBand[]>(DEFAULT_EQ_BANDS);
  const eqUserPreampDbRef = useRef(0);

  useEffect(() => {
    eqBandsRef.current = eqBands;
  }, [eqBands]);

  useEffect(() => {
    return () => {
      if (crossfadeTimeoutRef.current) {
        clearTimeout(crossfadeTimeoutRef.current);
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const initAudioChain = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    
    // Crear master gain para crossfade
    if (!masterGainRef.current) {
      masterGainRef.current = ctx.createGain();
      masterGainRef.current.gain.value = 1.0;
    }
    
    if (!analyserNodeRef.current) {
      analyserNodeRef.current = ctx.createAnalyser();
      analyserNodeRef.current.fftSize = 4096;
      analyserNodeRef.current.smoothingTimeConstant = 0.65;
    }

    // Inicializar Epicenter Worklet
    if (!workletNodeRef.current) {
      try {
        const workletPath = new URL('/epicenter-worklet.js', window.location.origin).href;
        await ctx.audioWorklet.addModule(workletPath);
        
        workletNodeRef.current = new AudioWorkletNode(ctx, 'epicenter-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2],
          parameterData: {
            sweepFreq: 45,
            width: 50,
            intensity: 0, // Comenzar con 0 (desactivado)
            balance: 50,
            volume: 100,
          },
        });
      } catch (error) {
        console.error('Error loading AudioWorklet:', error);
        throw error;
      }
    }

    // Inicializar Ecualizador
    if (eqFiltersRef.current.length === 0) {
      eqInputGainRef.current = ctx.createGain();
      eqOutputGainRef.current = ctx.createGain();

      eqFiltersRef.current = eqBandsRef.current.map((band, index) => {
        const filter = ctx.createBiquadFilter();
        filter.type = index === 0 ? 'lowshelf' : index === DEFAULT_EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = band.frequency;
        filter.Q.value = 1.0;
        filter.gain.value = band.gain;
        return filter;
      });

      // Conectar cadena de ecualizador
      let currentNode: AudioNode = eqInputGainRef.current;
      for (const filter of eqFiltersRef.current) {
        currentNode.connect(filter);
        currentNode = filter;
      }
      currentNode.connect(eqOutputGainRef.current);
    }

    // Conectar la parte fija de la cadena (ya no conectamos el source aquí)
    // Cadena base: Worklet → Equalizer → MasterGain → Destination
    if (workletNodeRef.current && eqInputGainRef.current && eqOutputGainRef.current && masterGainRef.current) {
      workletNodeRef.current.connect(eqInputGainRef.current);
      eqOutputGainRef.current.connect(masterGainRef.current);
      masterGainRef.current.connect(ctx.destination);
    }
  }, []);

  // Función para reconectar la cadena según el estado de los efectos
  const updateAudioRouting = useCallback(() => {
    if (!sourceNodeRef.current || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const source = sourceNodeRef.current;
    
    // Desconectar todo primero
    try {
      source.disconnect();
    } catch (e) {
      // Ya estaba desconectado
    }
    
    // Determinar si necesitamos bypass completo
    const needsBypass = !epicenterEnabled && !eqEnabled;
    
    if (needsBypass && masterGainRef.current) {
      // BYPASS COMPLETO: Source → MasterGain → Destination
      // Audio 100% puro sin procesamiento
      source.connect(masterGainRef.current);
      if (analyserNodeRef.current) source.connect(analyserNodeRef.current);
      bypassConnectionRef.current = true;
      console.log('🎵 AUDIO PURO: Bypass completo activado (sin procesamiento)');
    } else if (workletNodeRef.current) {
      // Usar cadena de procesamiento normal
      // Source → Worklet → Equalizer → MasterGain → Destination
      source.connect(workletNodeRef.current);
      if (analyserNodeRef.current) source.connect(analyserNodeRef.current);
      bypassConnectionRef.current = false;
      console.log('🎛️ AUDIO CON EFECTOS: Cadena de procesamiento activada');
    }
  }, [epicenterEnabled, eqEnabled]);

  // Función para iniciar crossfade (fade out)
  const startCrossfadeOut = useCallback(() => {
    if (!masterGainRef.current || !audioContextRef.current || isCrossfadingRef.current) return;
    
    const ctx = audioContextRef.current;
    const duration = crossfadeConfigRef.current.duration;
    
    isCrossfadingRef.current = true;

    masterGainRef.current.gain.cancelScheduledValues(ctx.currentTime);
    masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, ctx.currentTime);
    masterGainRef.current.gain.linearRampToValueAtTime(0.0, ctx.currentTime + duration);

    crossfadeTimeoutRef.current = setTimeout(() => {
      crossfadeTimeoutRef.current = null;
      if (onTrackEndedRef.current) {
        onTrackEndedRef.current();
      }
      isCrossfadingRef.current = false;
    }, duration * 1000);
  }, []);

  // Función para fade in al cargar nueva canción
  const startCrossfadeIn = useCallback(() => {
    if (!masterGainRef.current || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const duration = crossfadeConfigRef.current.duration;
    
    masterGainRef.current.gain.cancelScheduledValues(ctx.currentTime);

    if (crossfadeConfigRef.current.enabled) {
      masterGainRef.current.gain.setValueAtTime(0.0, ctx.currentTime);
      masterGainRef.current.gain.linearRampToValueAtTime(1.0, ctx.currentTime + duration);
    } else {
      masterGainRef.current.gain.setValueAtTime(1.0, ctx.currentTime);
    }
  }, []);

  const loadFile = useCallback(async (file: File | string, params: StreamingParams) => {
    // Limpiar cualquier crossfade pendiente
    if (crossfadeTimeoutRef.current) {
      clearTimeout(crossfadeTimeoutRef.current);
      crossfadeTimeoutRef.current = null;
    }
    isCrossfadingRef.current = false;
    
    await initAudioChain();
    const ctx = audioContextRef.current!;
    
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    
    const audioElement = new Audio();
    audioElementRef.current = audioElement;
    
    // Configuración para reproducción en background
    audioElement.preload = 'auto';
    audioElement.crossOrigin = 'anonymous';
    
    // Importante para que siga reproduciendo en background en móviles
    (audioElement as any).mozAudioChannelType = 'content';
    
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (typeof file === 'string') {
      audioElement.src = file;
    } else {
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      audioElement.src = objectUrl;
    }
    audioElement.load();
    
    try {
      const sourceNode = ctx.createMediaElementSource(audioElement);
      sourceNodeRef.current = sourceNode;
      // La conexión se hará dinámicamente según el estado de los efectos
      updateAudioRouting();
    } catch (error) {
      console.error('Error creating MediaElementAudioSourceNode:', error);
      throw error;
    }
    
    // Guardar parámetros iniciales ya normalizados a los topes reales de UI.
    const clampedParams = clampStreamingParams(params);
    dspParamsRef.current = { ...clampedParams };
    
    // Establecer intensity a 0 si Epicenter está desactivado.
    const finalParams = { ...clampedParams, intensity: epicenterEnabled ? clampedParams.intensity : 0 };
    
    const paramEntries = Object.entries(finalParams) as [keyof StreamingParams, number][];
    for (const [key, value] of paramEntries) {
      const param = workletNodeRef.current!.parameters.get(key);
      if (param) {
        param.setValueAtTime(value, ctx.currentTime);
      }
    }
    
    setIsReady(false);
    setCurrentTime(0);
    setDuration(0);
    
    const onLoadedMetadata = () => {
      setDuration(audioElement.duration);
      setIsReady(true);
      pendingCrossfadeInRef.current = crossfadeConfigRef.current.enabled;
      if (!crossfadeConfigRef.current.enabled && masterGainRef.current && audioContextRef.current) {
        masterGainRef.current.gain.setValueAtTime(1.0, audioContextRef.current.currentTime);
      }
    };
    
    const onTimeUpdate = () => {
      setCurrentTime(audioElement.currentTime);
      
      // Verificar si debemos iniciar crossfade
      if (crossfadeConfigRef.current.enabled && !isCrossfadingRef.current) {
        const timeRemaining = audioElement.duration - audioElement.currentTime;
        const crossfadeDuration = crossfadeConfigRef.current.duration;
        
        if (timeRemaining <= crossfadeDuration && timeRemaining > 0) {
          startCrossfadeOut();
        }
      }
    };
    
    const onEnded = () => {
      setIsPlaying(false);
      
      // Si NO estamos en crossfade, llamar al callback para siguiente canción
      if (!isCrossfadingRef.current && onTrackEndedRef.current) {
        // Reset del gain para la siguiente canción
        if (masterGainRef.current && audioContextRef.current) {
          masterGainRef.current.gain.setValueAtTime(1.0, audioContextRef.current.currentTime);
        }
        onTrackEndedRef.current();
      }
    };

    const onError = () => {
      const mediaError = audioElement.error;
      const message = mediaError
        ? `Audio playback error (code ${mediaError.code})`
        : 'Audio playback error';
      setIsPlaying(false);
      setIsReady(false);
      if (onTrackErrorRef.current) {
        onTrackErrorRef.current(new Error(message));
      }
    };
    
    audioElement.addEventListener('loadedmetadata', onLoadedMetadata);
    audioElement.addEventListener('timeupdate', onTimeUpdate);
    audioElement.addEventListener('ended', onEnded);
    audioElement.addEventListener('error', onError);
  }, [initAudioChain, epicenterEnabled, startCrossfadeIn, startCrossfadeOut, updateAudioRouting]);

  const play = useCallback(() => {
    if (!audioElementRef.current || !audioContextRef.current) return;
    const element = audioElementRef.current;
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    void element.play().catch((error) => {
      setIsPlaying(false);
      if (onTrackErrorRef.current) {
        onTrackErrorRef.current(error instanceof Error ? error : new Error('Audio playback failed'));
      }
    });
    if (pendingCrossfadeInRef.current) {
      startCrossfadeIn();
      pendingCrossfadeInRef.current = false;
    }
    setIsPlaying(true);
  }, [startCrossfadeIn]);

  const pause = useCallback(() => {
    if (!audioElementRef.current) return;
    audioElementRef.current.pause();
    setIsPlaying(false);
  }, []);

  const seek = useCallback((time: number) => {
    if (!audioElementRef.current) return;
    
    // Si estamos en crossfade y el usuario hace seek, cancelar el crossfade
    if (isCrossfadingRef.current) {
      if (crossfadeTimeoutRef.current) {
        clearTimeout(crossfadeTimeoutRef.current);
        crossfadeTimeoutRef.current = null;
      }
      isCrossfadingRef.current = false;
      
      // Restaurar volumen
      if (masterGainRef.current && audioContextRef.current) {
        masterGainRef.current.gain.cancelScheduledValues(audioContextRef.current.currentTime);
        masterGainRef.current.gain.setValueAtTime(1.0, audioContextRef.current.currentTime);
      }
    }
    
    audioElementRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setDspParam = useCallback((name: keyof StreamingParams, value: number) => {
    const node = workletNodeRef.current;
    const ctx = audioContextRef.current;
    if (!node || !ctx) return;
    
    const clampedValue = clampStreamingParam(name, value);

    // Guardar el parámetro
    dspParamsRef.current = { ...dspParamsRef.current, [name]: clampedValue };
    
    const param = node.parameters.get(name);
    if (!param) return;
    
    // Usar linearRampToValueAtTime para cambios suaves sin reinicio
    param.linearRampToValueAtTime(clampedValue, ctx.currentTime + 0.05);
  }, []);


  const applyEqOutputGain = useCallback((bandsSnapshot: EqualizerBand[]) => {
    if (!eqOutputGainRef.current || !audioContextRef.current) return;

    const maxPositiveGain = bandsSnapshot.reduce((max, band) => Math.max(max, band.gain), 0);
    const clippingCompensationDb = -Math.max(0, maxPositiveGain - 3);
    const effectivePreampDb = eqUserPreampDbRef.current + clippingCompensationDb;
    const linear = Math.pow(10, effectivePreampDb / 20);
    eqOutputGainRef.current.gain.setValueAtTime(linear, audioContextRef.current.currentTime);
  }, []);

  const setEqPreampDb = useCallback((preampDb: number) => {
    eqUserPreampDbRef.current = preampDb;
    applyEqOutputGain(eqBandsRef.current);
  }, [applyEqOutputGain]);

  const getAnalyserNode = useCallback(() => analyserNodeRef.current, []);

  const getCurrentDspParams = useCallback(() => ({ ...dspParamsRef.current }), []);

  const setEqBandGain = useCallback((index: number, gain: number) => {
    const clampedGain = Math.max(EQ_GAIN_MIN, Math.min(EQ_GAIN_MAX, gain));

    setEqBands((prev) => {
      const newBands = [...prev];
      newBands[index] = { ...newBands[index], gain: clampedGain };
      eqBandsRef.current = newBands;
      applyEqOutputGain(newBands);
      return newBands;
    });

    if (eqFiltersRef.current[index]) {
      eqFiltersRef.current[index].gain.value = eqEnabled ? clampedGain : 0;
    }
  }, [applyEqOutputGain, eqEnabled]);

  const setEqEnabled = useCallback((enabled: boolean) => {
    setEqEnabledState(enabled);

    const snapshot = eqBandsRef.current;
    eqFiltersRef.current.forEach((filter, index) => {
      filter.gain.value = enabled ? snapshot[index].gain : 0;
    });

    if (enabled) {
      applyEqOutputGain(snapshot);
    } else if (eqOutputGainRef.current && audioContextRef.current) {
      eqOutputGainRef.current.gain.setValueAtTime(1, audioContextRef.current.currentTime);
    }

    // Actualizar el enrutamiento de audio
    setTimeout(() => {
      updateAudioRouting();
      if (enabled) {
        const latest = eqBandsRef.current;
        eqFiltersRef.current.forEach((filter, index) => {
          filter.gain.value = latest[index].gain;
        });
      }
    }, 0);
  }, [applyEqOutputGain, updateAudioRouting]);

  const setEpicenterEnabled = useCallback((enabled: boolean) => {
    setEpicenterEnabledState(enabled);
    
    const ctx = audioContextRef.current;
    const node = workletNodeRef.current;
    
    if (!ctx || !node) return;
    
    // Cambiar la intensidad del Epicenter
    const intensityParam = node.parameters.get('intensity');
    if (intensityParam) {
      const targetIntensity = enabled ? dspParamsRef.current.intensity : 0;
      intensityParam.linearRampToValueAtTime(targetIntensity, ctx.currentTime + 0.05);
    }
    
    // Actualizar el enrutamiento de audio
    setTimeout(() => updateAudioRouting(), 0);
  }, [updateAudioRouting]);

  const setOnTrackEnded = useCallback((callback: (() => void) | null) => {
    onTrackEndedRef.current = callback;
  }, []);

  const setOnTrackError = useCallback((callback: ((error: Error) => void) | null) => {
    onTrackErrorRef.current = callback;
  }, []);

  const setCrossfadeConfig = useCallback((config: CrossfadeConfig) => {
    crossfadeConfigRef.current = config;
  }, []);

  const resetAfterError = useCallback(() => {
    if (crossfadeTimeoutRef.current) {
      clearTimeout(crossfadeTimeoutRef.current);
      crossfadeTimeoutRef.current = null;
    }

    isCrossfadingRef.current = false;
    pendingCrossfadeInRef.current = false;

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.removeAttribute('src');
      audioElementRef.current.load();
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (_error) {
        // no-op
      }
      sourceNodeRef.current = null;
    }

    if (masterGainRef.current && audioContextRef.current) {
      masterGainRef.current.gain.setValueAtTime(1.0, audioContextRef.current.currentTime);
    }

    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  return {
    isReady,
    isPlaying,
    currentTime,
    duration,
    loadFile,
    play,
    pause,
    seek,
    setDspParam,
    setEqBandGain,
    setEqEnabled,
    setEpicenterEnabled,
    setEqPreampDb,
    getAnalyserNode,
    getCurrentDspParams,
    setOnTrackEnded,
    setOnTrackError,
    setCrossfadeConfig,
    resetAfterError,
    eqBands,
    eqEnabled,
    epicenterEnabled,
  };
}

export default useIntegratedAudioProcessor;
