import { describe, expect, it } from 'vitest';
import {
  formatQualityLabel,
  HI_RES_MIN_BIT_DEPTH,
  HI_RES_MIN_SAMPLE_RATE,
  isHiResQuality,
} from '../shared/audioQuality';

/**
 * Tests para los indicadores de calidad de audio (bits/kHz y Hi-Res)
 * Regla única del proyecto: Hi-Res = >= 16-bit y >= 44.1kHz
 */

describe('Audio Quality Indicators', () => {
  describe('Unified Hi-Res rule thresholds', () => {
    it('uses 16-bit as minimum bit depth', () => {
      expect(HI_RES_MIN_BIT_DEPTH).toBe(16);
    });

    it('uses 44.1kHz as minimum sample rate', () => {
      expect(HI_RES_MIN_SAMPLE_RATE).toBe(44100);
    });
  });

  describe('Hi-Res Audio Detection', () => {
    it('identifies 16-bit 44.1kHz as Hi-Res', () => {
      expect(isHiResQuality(16, 44100)).toBe(true);
    });

    it('identifies 24-bit 48kHz as Hi-Res', () => {
      expect(isHiResQuality(24, 48000)).toBe(true);
    });

    it('identifies 32-bit 192kHz as Hi-Res', () => {
      expect(isHiResQuality(32, 192000)).toBe(true);
    });

    it('identifies 16-bit 32kHz as NOT Hi-Res (sample rate too low)', () => {
      expect(isHiResQuality(16, 32000)).toBe(false);
    });

    it('identifies 8-bit 44.1kHz as NOT Hi-Res (bit depth too low)', () => {
      expect(isHiResQuality(8, 44100)).toBe(false);
    });

    it('handles missing bit depth', () => {
      expect(isHiResQuality(undefined, 48000)).toBe(false);
    });

    it('handles missing sample rate', () => {
      expect(isHiResQuality(24, undefined)).toBe(false);
    });
  });

  describe('Quality Text Formatting', () => {
    it('formats 16-bit 44.1kHz correctly', () => {
      expect(formatQualityLabel(16, 44100)).toBe('16-bit 44.1kHz');
    });

    it('formats 24-bit 48kHz correctly', () => {
      expect(formatQualityLabel(24, 48000)).toBe('24-bit 48kHz');
    });

    it('formats 32-bit 192kHz correctly', () => {
      expect(formatQualityLabel(32, 192000)).toBe('32-bit 192kHz');
    });

    it('supports bit depth only', () => {
      expect(formatQualityLabel(24, undefined)).toBe('24-bit');
    });

    it('supports sample rate only', () => {
      expect(formatQualityLabel(undefined, 96000)).toBe('96kHz');
    });

    it('returns empty string when no data is available', () => {
      expect(formatQualityLabel(undefined, undefined)).toBe('');
    });
  });
});
