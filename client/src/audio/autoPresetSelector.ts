import type { StreamingParams } from '@/hooks/useIntegratedAudioProcessor';

export const FREQUENCY_BANDS_31 = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160,
  200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
  2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000,
] as const;

export interface Preset {
  id: string;
  name: string;
  preampDb: number;
  gainsDb: number[];
}

const validatePreset = (preset: Preset) => {
  if (preset.gainsDb.length !== FREQUENCY_BANDS_31.length) {
    throw new Error(`Preset ${preset.id} must have ${FREQUENCY_BANDS_31.length} bands.`);
  }
};

export const PRESETS_31BAND: Preset[] = [
  { id: 'HIFI_NEUTRAL', name: 'HiFi Neutral', preampDb: -3, gainsDb: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
  { id: 'WARM', name: 'Warm', preampDb: -4, gainsDb: [1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-2,-2,-2,-2,-2,-1,0] },
  { id: 'CLARITY_BRIGHT', name: 'Clarity Bright', preampDb: -4, gainsDb: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,2,1,0,0] },
  { id: 'VOCAL_FORWARD', name: 'Vocal Forward', preampDb: -4, gainsDb: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,1,0,0,0,-1,-1,-1,0,0,0] },
  { id: 'ROCK_PUNCH', name: 'Rock Punch', preampDb: -5, gainsDb: [0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0,0,0,0,1,2,2,2,1,0,0,0,0,0,0,0] },
  { id: 'BASS_PARTY', name: 'Bass Party', preampDb: -6, gainsDb: [2,2,2,3,4,5,5,4,3,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
  { id: 'BANDA_REGIONAL', name: 'Banda Regional', preampDb: -5, gainsDb: [1,1,1,2,3,3,2,1,1,0,0,0,0,0,0,0,1,1,1,1,1,0,-1,-2,-2,-2,-2,-1,0,0,0] },
  { id: 'ELECTRONICA', name: 'Electrónica', preampDb: -6, gainsDb: [2,2,3,4,5,5,4,3,2,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,2,2,2,2,1,0,0] },
  { id: 'LOUDNESS', name: 'Loudness', preampDb: -5, gainsDb: [2,2,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,1,1,1,0,0] },
];

PRESETS_31BAND.forEach(validatePreset);

const PRESET_BY_ID = new Map(PRESETS_31BAND.map((preset) => [preset.id, preset]));

export interface SpectrumDebug {
  bassScore: number;
  midScore: number;
  voiceScore: number;
  brightScore: number;
  averageEnergyDb: number;
  ruleMatched: string;
}

export interface AutoPresetSelectionResult {
  presetId: string;
  preset: Preset;
  debug: SpectrumDebug;
}

export interface AnalyzeSpectrumParams {
  analyserNode: AnalyserNode | null;
  sampleCount?: number;
  intervalMs?: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

// Normalización estable para heurística offline: mapea dB típicos [-110,-20] a 0..1 y clampa.
const dbToScore = (db: number) => clamp01((db + 110) / 90);

const findRangeAvg = (spectrumDb: number[], sampleRate: number, minHz: number, maxHz: number) => {
  const nyquist = sampleRate / 2;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < spectrumDb.length; i++) {
    const freq = (i * nyquist) / spectrumDb.length;
    if (freq >= minHz && freq <= maxHz) {
      sum += spectrumDb[i];
      count += 1;
    }
  }

  return count === 0 ? -120 : sum / count;
};

const getPresetById = (presetId: string) => PRESET_BY_ID.get(presetId) ?? PRESET_BY_ID.get('HIFI_NEUTRAL')!;

export async function analyzeSpectrumAndSelectPreset({
  analyserNode,
  sampleCount = 80,
  intervalMs = 125,
}: AnalyzeSpectrumParams): Promise<AutoPresetSelectionResult> {
  if (!analyserNode) {
    const preset = getPresetById('HIFI_NEUTRAL');
    return {
      presetId: preset.id,
      preset,
      debug: {
        bassScore: 0,
        midScore: 0,
        voiceScore: 0,
        brightScore: 0,
        averageEnergyDb: -120,
        ruleMatched: 'fallback-no-analyser',
      },
    };
  }

  try {
    const data = new Float32Array(analyserNode.frequencyBinCount);
    const avgBins = new Float32Array(analyserNode.frequencyBinCount);

    for (let s = 0; s < sampleCount; s++) {
      analyserNode.getFloatFrequencyData(data);
      for (let i = 0; i < data.length; i++) {
        avgBins[i] += Number.isFinite(data[i]) ? data[i] : -120;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    const spectrumDb = Array.from(avgBins, (value) => value / sampleCount);
    const sampleRate = analyserNode.context.sampleRate;

    const bassDb = findRangeAvg(spectrumDb, sampleRate, 20, 120);
    const midDb = findRangeAvg(spectrumDb, sampleRate, 250, 2000);
    const voiceDb = findRangeAvg(spectrumDb, sampleRate, 1000, 4000);
    const brightDb = findRangeAvg(spectrumDb, sampleRate, 4000, 12000);
    const averageEnergyDb = findRangeAvg(spectrumDb, sampleRate, 100, 8000);

    const bassScore = dbToScore(bassDb);
    const midScore = dbToScore(midDb);
    const voiceScore = dbToScore(voiceDb);
    const brightScore = dbToScore(brightDb);

    let presetId = 'HIFI_NEUTRAL';
    let ruleMatched = 'default-hifi-neutral';

    if (bassScore > 0.75 && brightScore < 0.55) {
      presetId = 'BASS_PARTY';
      ruleMatched = 'bass-heavy-dark';
    } else if (brightScore > 0.75 && bassScore < 0.60) {
      presetId = 'WARM';
      ruleMatched = 'bright-thin';
    } else if (voiceScore > 0.72 && bassScore < 0.65) {
      presetId = 'VOCAL_FORWARD';
      ruleMatched = 'voice-forward';
    } else if (midScore > 0.70 && brightScore > 0.62 && bassScore >= 0.45 && bassScore <= 0.75) {
      presetId = 'ROCK_PUNCH';
      ruleMatched = 'mid-bright-balanced-bass';
    } else if (bassScore >= 0.60 && bassScore <= 0.78 && brightScore < 0.55 && voiceScore >= 0.45 && voiceScore <= 0.75) {
      presetId = 'BANDA_REGIONAL';
      ruleMatched = 'regional-balance';
    } else if (bassScore > 0.70 && brightScore > 0.65) {
      presetId = 'ELECTRONICA';
      ruleMatched = 'bass-bright-energy';
    } else if (averageEnergyDb < -72) {
      presetId = 'LOUDNESS';
      ruleMatched = 'low-overall-energy';
    }

    const preset = getPresetById(presetId);

    return {
      presetId,
      preset,
      debug: { bassScore, midScore, voiceScore, brightScore, averageEnergyDb, ruleMatched },
    };
  } catch (error) {
    console.warn('[AutoPreset] Spectrum analysis failed, using neutral preset.', error);
    const preset = getPresetById('HIFI_NEUTRAL');
    return {
      presetId: preset.id,
      preset,
      debug: {
        bassScore: 0,
        midScore: 0,
        voiceScore: 0,
        brightScore: 0,
        averageEnergyDb: -120,
        ruleMatched: 'fallback-exception',
      },
    };
  }
}

interface ApplyPresetSmoothParams {
  currentGains: number[];
  targetGains: number[];
  setEqBandGain: (index: number, gain: number) => void;
  durationMs?: number;
  stepMs?: number;
  maxDeltaPerStep?: number;
}

export async function applyPresetSmooth({
  currentGains,
  targetGains,
  setEqBandGain,
  durationMs = 800,
  stepMs = 100,
  maxDeltaPerStep = 0.5,
}: ApplyPresetSmoothParams): Promise<void> {
  if (targetGains.length !== FREQUENCY_BANDS_31.length) {
    throw new Error('Target preset must contain 31 gains.');
  }

  const gains = [...currentGains];
  while (gains.length < targetGains.length) gains.push(0);

  const steps = Math.max(1, Math.ceil(durationMs / stepMs));

  for (let step = 0; step < steps; step++) {
    let pending = false;

    for (let i = 0; i < targetGains.length; i++) {
      const diff = targetGains[i] - gains[i];
      if (Math.abs(diff) < 0.001) continue;

      pending = true;
      const delta = Math.sign(diff) * Math.min(Math.abs(diff), maxDeltaPerStep);
      gains[i] += delta;
      setEqBandGain(i, gains[i]);
    }

    if (!pending) break;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }

  for (let i = 0; i < targetGains.length; i++) {
    setEqBandGain(i, targetGains[i]);
  }
}

export function suggestDspFromScores(debug: SpectrumDebug): Partial<StreamingParams> {
  const lowNeed = Math.max(0, debug.bassScore - debug.midScore * 0.8);
  return {
    sweepFreq: Math.max(30, Math.min(58, 42 + lowNeed * 20)),
    width: Math.max(35, Math.min(80, 45 + lowNeed * 40)),
    intensity: Math.max(30, Math.min(90, 40 + lowNeed * 55)),
    balance: Math.max(40, Math.min(65, 50 + lowNeed * 8)),
    volume: Math.max(110, Math.min(145, 115 + lowNeed * 30)),
  };
}
