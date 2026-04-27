/**
 * Epicenter Hi-Fi - Audio Quality Badge
 * Indicador de calidad de audio con formato numérico consistente
 */

import React from 'react';
import { formatQualityLabel, isHiResQuality } from '@shared/audioQuality';

interface AudioQualityBadgeProps {
  bitDepth?: number;
  sampleRate?: number;
  bitrate?: number;
  isHiRes?: boolean;
  compact?: boolean; // Para mostrar en listas
}

export function AudioQualityBadge({
  bitDepth,
  sampleRate,
  bitrate,
  isHiRes,
  compact = false,
}: AudioQualityBadgeProps) {
  const detectedHiRes = isHiResQuality(bitDepth, sampleRate);
  const isHighRes = typeof isHiRes === 'boolean' ? isHiRes : detectedHiRes;
  const qualityParts = [formatQualityLabel(bitDepth, sampleRate)].filter(Boolean);

  if (typeof bitrate === 'number' && bitrate > 0) {
    qualityParts.push(`${Math.round(bitrate / 1000)}kbps`);
  }

  const qualityLabel = qualityParts.join(' • ');

  // Si no hay datos de calidad, no mostrar nada
  if (!qualityLabel) {
    return null;
  }

  // Versión compacta para listas
  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1 text-[9px] font-medium tracking-wide
          ${isHighRes ? 'text-amber-500' : 'text-zinc-600'}`}
        data-testid="quality-badge-compact"
      >
        <span>{qualityLabel.replace('-bit ', 'b/').replace('kHz', 'k')}</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider
        ${isHighRes
          ? 'bg-gradient-to-r from-amber-950/60 to-yellow-950/60 border border-amber-500/40'
          : 'bg-zinc-900/80 border border-zinc-800'
        }`}
      data-testid="quality-badge"
    >
      <div className={`flex items-center gap-1.5 uppercase ${isHighRes ? 'text-amber-400' : 'text-zinc-500'}`}>
        <span>{qualityLabel}</span>
      </div>
    </div>
  );
}

export default AudioQualityBadge;
