import React from 'react';
import { hiresAudioBadgeUrl } from '@/lib/assetUrls';

interface AudioQualityIndicatorProps {
  bitDepth?: number;
  sampleRate?: number;
  isHiRes?: boolean;
  position?: 'cover' | 'hires';
}

/**
 * Componente para mostrar la calidad de audio
 * - En la carátula: muestra bits y kHz
 * - En el círculo Hi-Res: muestra el logo si es Hi-Res
 */
export function AudioQualityIndicator({
  bitDepth,
  sampleRate,
  isHiRes,
  position = 'cover',
}: AudioQualityIndicatorProps) {
  if (position === 'cover') {
    // Mostrar calidad de audio en la carátula
    if (!bitDepth || !sampleRate) {
      return null;
    }

    const sampleRateKHz = (sampleRate / 1000).toFixed(1);
    const qualityText = `${bitDepth}-bit ${sampleRateKHz}kHz`;
    const textColor = isHiRes ? 'text-yellow-400' : 'text-white';
    const opacity = isHiRes ? 'opacity-100' : 'opacity-60';

    return (
      <div className={`text-xs font-semibold ${textColor} ${opacity} text-center`}>
        {qualityText}
      </div>
    );
  }

  if (position === 'hires') {
    // Mostrar logo Hi-Res si aplica
    if (!isHiRes) {
      return null;
    }

    return (
      <img
        src={hiresAudioBadgeUrl}
        alt="Hi-Res Audio"
        className="w-12 h-12 object-contain rounded-md"
      />
    );
  }

  return null;
}

export default AudioQualityIndicator;
