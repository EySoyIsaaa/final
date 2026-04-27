import React, { useMemo, useRef, useState } from 'react';
import type { EqualizerBand } from '@/hooks/useIntegratedAudioProcessor';

interface EQVisualizerProps {
  bands: EqualizerBand[];
  enabled: boolean;
  onBandChange: (index: number, gain: number) => void;
  minGain?: number;
  maxGain?: number;
  horizontalControlLabel?: string;
}

export function EQVisualizer({
  bands,
  enabled,
  onBandChange,
  minGain = -8,
  maxGain = 8,
  horizontalControlLabel,
}: EQVisualizerProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [scrollPercent, setScrollPercent] = useState(0);

  const labels = useMemo(
    () => bands.map((band) => band.label.replace(' Hz', '').replace(' kHz', 'k')),
    [bands],
  );

  const syncPercent = () => {
    const el = railRef.current;
    if (!el) return;
    const max = Math.max(1, el.scrollWidth - el.clientWidth);
    setScrollPercent((el.scrollLeft / max) * 100);
  };

  const handleHorizontalSlider = (value: number) => {
    const el = railRef.current;
    if (!el) return;
    const max = Math.max(1, el.scrollWidth - el.clientWidth);
    el.scrollLeft = (value / 100) * max;
    setScrollPercent(value);
  };

  const range = Math.max(1, maxGain - minGain);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 px-2">
        <span className="text-[10px] text-zinc-500 font-mono">+{maxGain} dB</span>
        <span className="text-[10px] text-zinc-600 font-mono">0</span>
        <span className="text-[10px] text-zinc-500 font-mono">{minGain} dB</span>
      </div>

      <div
        ref={railRef}
        onScroll={syncPercent}
        className="flex-1 overflow-x-auto overflow-y-hidden rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2"
        style={{ touchAction: 'pan-x' }}
      >
        <div className="flex items-end gap-3 min-h-[430px] min-w-max pb-2">
          {bands.map((band, index) => {
            const normalized = ((band.gain - minGain) / range) * 100;
            return (
              <div key={index} className="w-12 flex-none flex flex-col items-center">
                <div className="relative h-[340px] w-9 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                  <div className="absolute inset-x-0 bottom-1/2 h-px bg-zinc-700" />
                  <div
                    className={`absolute inset-x-0 bottom-0 transition-all duration-150 ${enabled ? 'bg-gradient-to-t from-cyan-400 to-violet-400' : 'bg-zinc-700'}`}
                    style={{ height: `${normalized}%` }}
                  />
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 w-7 h-2.5 rounded-full transition-all duration-150 ${enabled ? 'bg-white shadow-[0_2px_8px_rgba(255,255,255,0.35)]' : 'bg-zinc-500'}`}
                    style={{ bottom: `calc(${normalized}% - 5px)` }}
                  />
                  <input
                    type="range"
                    min={minGain}
                    max={maxGain}
                    step={0.5}
                    value={band.gain}
                    onChange={(e) => onBandChange(index, parseFloat(e.target.value))}
                    disabled={!enabled}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize disabled:cursor-not-allowed z-10"
                    style={{ writingMode: 'vertical-lr', direction: 'rtl', touchAction: 'none' }}
                    data-testid={`eq-slider-${index}`}
                  />
                </div>
                <span className={`text-[10px] font-semibold mt-2 ${enabled ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {labels[index]}
                </span>
                <span className={`text-[10px] font-mono tabular-nums ${enabled ? 'text-zinc-400' : 'text-zinc-700'}`}>
                  {band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 px-1">
        {horizontalControlLabel && (
          <p className="text-[11px] text-zinc-500 mb-1">{horizontalControlLabel}</p>
        )}
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={scrollPercent}
          onChange={(e) => handleHorizontalSlider(parseFloat(e.target.value))}
          className="w-full h-2 rounded-full bg-zinc-800 appearance-none cursor-ew-resize"
          aria-label={horizontalControlLabel || 'Horizontal EQ navigation'}
        />
      </div>
    </div>
  );
}

export default EQVisualizer;
