/**
 * Glassmorphism Nocturno Design
 * Hook para procesamiento de audio en tiempo real con Epicenter DSP
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface StreamingParams {
  sweepFreq: number;
  width: number;
  intensity: number;
  balance: number;
  volume: number;
}

export interface StreamingController {
  isReady: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loadFile: (file: File, params: StreamingParams) => Promise<void>;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setParam: (name: keyof StreamingParams, value: number) => void;
}

export function useStreamingEpicenter(): StreamingController {
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const initWorklet = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    
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
            intensity: 50,
            balance: 50,
            volume: 100,
          },
        });
        
        workletNodeRef.current.connect(ctx.destination);
      } catch (error) {
        console.error('Error loading AudioWorklet:', error);
        throw error;
      }
    }
  }, []);

  const loadFile = useCallback(async (file: File, params: StreamingParams) => {
    await initWorklet();
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
    
    const objectUrl = URL.createObjectURL(file);
    audioElement.src = objectUrl;
    audioElement.crossOrigin = 'anonymous';
    
    try {
      const sourceNode = ctx.createMediaElementSource(audioElement);
      sourceNodeRef.current = sourceNode;
      sourceNode.connect(workletNodeRef.current!);
    } catch (error) {
      console.error('Error creating MediaElementAudioSourceNode:', error);
      throw error;
    }
    
    const paramEntries = Object.entries(params) as [keyof StreamingParams, number][];
    for (const [key, value] of paramEntries) {
      workletNodeRef.current!.parameters.get(key)!.setValueAtTime(value, ctx.currentTime);
    }
    
    setIsReady(false);
    setCurrentTime(0);
    setDuration(0);
    
    const onLoadedMetadata = () => {
      setDuration(audioElement.duration);
      setIsReady(true);
    };
    
    const onTimeUpdate = () => {
      setCurrentTime(audioElement.currentTime);
    };
    
    const onEnded = () => {
      setIsPlaying(false);
    };
    
    audioElement.addEventListener('loadedmetadata', onLoadedMetadata);
    audioElement.addEventListener('timeupdate', onTimeUpdate);
    audioElement.addEventListener('ended', onEnded);
  }, [initWorklet]);

  const play = useCallback(() => {
    if (!audioElementRef.current || !audioContextRef.current) return;
    const element = audioElementRef.current;
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    element.play();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    if (!audioElementRef.current) return;
    audioElementRef.current.pause();
    setIsPlaying(false);
  }, []);

  const seek = useCallback((time: number) => {
    if (!audioElementRef.current) return;
    audioElementRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setParam = useCallback((name: keyof StreamingParams, value: number) => {
    const node = workletNodeRef.current;
    const ctx = audioContextRef.current;
    if (!node || !ctx) return;
    const param = node.parameters.get(name);
    if (!param) return;
    param.setValueAtTime(value, ctx.currentTime);
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
    setParam,
  };
}

export default useStreamingEpicenter;
