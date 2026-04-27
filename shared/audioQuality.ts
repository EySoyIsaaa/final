export const HI_RES_MIN_BIT_DEPTH = 16;
export const HI_RES_MIN_SAMPLE_RATE = 44100;

export function isHiResQuality(bitDepth?: number, sampleRate?: number): boolean {
  if (typeof bitDepth !== "number" || typeof sampleRate !== "number") {
    return false;
  }

  return bitDepth >= HI_RES_MIN_BIT_DEPTH && sampleRate >= HI_RES_MIN_SAMPLE_RATE;
}

export function formatQualityLabel(bitDepth?: number, sampleRate?: number): string {
  const parts: string[] = [];

  if (typeof bitDepth === "number") {
    parts.push(`${bitDepth}-bit`);
  }

  if (typeof sampleRate === "number") {
    const sampleRateKHz = (sampleRate / 1000).toFixed(sampleRate % 1000 === 0 ? 0 : 1);
    parts.push(`${sampleRateKHz}kHz`);
  }

  return parts.join(" ");
}
