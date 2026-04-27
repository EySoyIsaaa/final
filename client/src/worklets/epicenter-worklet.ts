/*
 * Epicenter DSP AudioWorkletProcessor
 *
 * Rediseño orientado a:
 * - ruta mono de análisis, inspirada en la patente US 4,698,842
 * - separación conceptual voz / bajo para no ensuciar la voz
 * - reconstrucción principal a f/2 del contenido dominante del detector
 * - reinyección mono del subgrave sobre una ruta de bajo independiente
 *
 * Cadena conceptual:
 * stereo input
 *   -> voice path (HPF limpio, preserva voz y medios)
 *   -> bass program path (LPF + body shaping)
 *   -> mono detector path (L+R, banda ponderada 60/80/110 Hz)
 *   -> demod / half-frequency generator
 *   -> remix gate por contenido musical vs voz
 *   -> recombinación final
 */

declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: any);
}
declare var registerProcessor: (name: string, processorCtor: any) => void;

const DENORMAL_FLOOR = 1e-24;
const TWO_PI = Math.PI * 2;
const EPICENTER_INTENSITY_HEADROOM = 0.75;

type FilterType = 'lowpass' | 'highpass' | 'bandpass';

class BiquadFilter {
  private b0 = 0;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(
    private type: FilterType,
    private freq: number,
    private sr: number,
    private Q = 0.707,
  ) {
    this.updateCoeffs(type, freq, Q);
  }

  private denormalFloor(value: number): number {
    return Math.abs(value) < DENORMAL_FLOOR ? 0 : value;
  }

  updateCoeffs(type: FilterType, freq: number, Q = 0.707) {
    this.type = type;
    this.freq = freq;
    this.Q = Q;

    const clampedFreq = Math.max(10, Math.min(freq, this.sr * 0.45));
    const clampedQ = Math.max(0.2, Math.min(Q, 12));
    const omega = TWO_PI * clampedFreq / this.sr;
    const sinOmega = Math.sin(omega);
    const cosOmega = Math.cos(omega);
    const alpha = sinOmega / (2 * clampedQ);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let a0 = 1;
    let a1 = 0;
    let a2 = 0;

    switch (type) {
      case 'lowpass':
        b0 = (1 - cosOmega) * 0.5;
        b1 = 1 - cosOmega;
        b2 = (1 - cosOmega) * 0.5;
        a0 = 1 + alpha;
        a1 = -2 * cosOmega;
        a2 = 1 - alpha;
        break;
      case 'highpass':
        b0 = (1 + cosOmega) * 0.5;
        b1 = -(1 + cosOmega);
        b2 = (1 + cosOmega) * 0.5;
        a0 = 1 + alpha;
        a1 = -2 * cosOmega;
        a2 = 1 - alpha;
        break;
      case 'bandpass':
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
        a0 = 1 + alpha;
        a1 = -2 * cosOmega;
        a2 = 1 - alpha;
        break;
    }

    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }

  process(sample: number): number {
    const clean = this.denormalFloor(sample);
    const y0 = this.b0 * clean + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;

    this.x2 = this.denormalFloor(this.x1);
    this.x1 = clean;
    this.y2 = this.denormalFloor(this.y1);
    this.y1 = this.denormalFloor(y0);

    return this.denormalFloor(y0);
  }

  reset() {
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }
}

class EnvelopeFollower {
  private value = 0;

  constructor(
    private attackCoeff: number,
    private releaseCoeff: number,
  ) {}

  process(input: number): number {
    const x = Math.abs(input);
    const coeff = x > this.value ? this.attackCoeff : this.releaseCoeff;
    this.value = x + coeff * (this.value - x);
    return this.value;
  }

  reset() {
    this.value = 0;
  }
}

interface StereoChannelState {
  voiceHighpass: BiquadFilter;
  bassLowpass: BiquadFilter;
  lowMidBody: BiquadFilter;
  lowMidDip: BiquadFilter;
  subLowpass: BiquadFilter;
  outputDcHighpass: BiquadFilter;
  voiceEnv: EnvelopeFollower;
}

interface MonoDetectorState {
  band60: BiquadFilter;
  band80: BiquadFilter;
  band110: BiquadFilter;
  monoLowpass: BiquadFilter;
  diffHighpass: BiquadFilter;
  synthHighpass: BiquadFilter;
  synthLowpass: BiquadFilter;
  detectorEnv: EnvelopeFollower;
  monoEnv: EnvelopeFollower;
  diffEnv: EnvelopeFollower;
  gateEnv: EnvelopeFollower;
  synthLevelEnv: EnvelopeFollower;
  lastDetector: number;
  flipState: number;
  holdSamples: number;
}

class EpicenterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'sweepFreq', defaultValue: 45, minValue: 27, maxValue: 63, automationRate: 'k-rate' },
      { name: 'width', defaultValue: 50, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
      { name: 'intensity', defaultValue: 50, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
      { name: 'balance', defaultValue: 50, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
      { name: 'volume', defaultValue: 100, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
    ];
  }

  private channels: StereoChannelState[] = [];
  private monoState: MonoDetectorState | null = null;
  private lastSweepFreq = -1;
  private lastWidth = -1;

  constructor(options: any) {
    super();
  }

  private denormalFloor(value: number): number {
    return Math.abs(value) < DENORMAL_FLOOR ? 0 : value;
  }

  private coeffFromMs(ms: number): number {
    const samples = Math.max(1, ms * sampleRate / 1000);
    return Math.exp(-1 / samples);
  }

  private createChannelState(params: { sweepFreq: number; width: number }): StereoChannelState {
    const { crossoverHz, bodyHz, subTopHz } = this.getDerivedFrequencies(params.sweepFreq, params.width);

    return {
      voiceHighpass: new BiquadFilter('highpass', crossoverHz, sampleRate, 0.707),
      bassLowpass: new BiquadFilter('lowpass', crossoverHz * 1.15, sampleRate, 0.707),
      lowMidBody: new BiquadFilter('bandpass', bodyHz, sampleRate, 0.85),
      lowMidDip: new BiquadFilter('bandpass', bodyHz * 1.18, sampleRate, 1.1),
      subLowpass: new BiquadFilter('lowpass', subTopHz, sampleRate, 0.707),
      outputDcHighpass: new BiquadFilter('highpass', 18, sampleRate, 0.707),
      voiceEnv: new EnvelopeFollower(this.coeffFromMs(6), this.coeffFromMs(110)),
    };
  }

  private createMonoState(params: { sweepFreq: number; width: number }): MonoDetectorState {
    const { detector60, detector80, detector110, synthLowHz, synthHighHz } = this.getDerivedFrequencies(params.sweepFreq, params.width);

    return {
      band60: new BiquadFilter('bandpass', detector60, sampleRate, 1.35),
      band80: new BiquadFilter('bandpass', detector80, sampleRate, 1.55),
      band110: new BiquadFilter('bandpass', detector110, sampleRate, 1.8),
      monoLowpass: new BiquadFilter('lowpass', 120, sampleRate, 0.707),
      diffHighpass: new BiquadFilter('highpass', 140, sampleRate, 0.707),
      synthHighpass: new BiquadFilter('highpass', synthHighHz, sampleRate, 0.707),
      synthLowpass: new BiquadFilter('lowpass', synthLowHz, sampleRate, 0.707),
      detectorEnv: new EnvelopeFollower(this.coeffFromMs(7), this.coeffFromMs(95)),
      monoEnv: new EnvelopeFollower(this.coeffFromMs(12), this.coeffFromMs(160)),
      diffEnv: new EnvelopeFollower(this.coeffFromMs(12), this.coeffFromMs(160)),
      gateEnv: new EnvelopeFollower(this.coeffFromMs(25), this.coeffFromMs(240)),
      synthLevelEnv: new EnvelopeFollower(this.coeffFromMs(18), this.coeffFromMs(180)),
      lastDetector: 0,
      flipState: 1,
      holdSamples: 0,
    };
  }

  private getDerivedFrequencies(sweepFreq: number, width: number) {
    const sweepNorm = (Math.max(27, Math.min(63, sweepFreq)) - 27) / 36;
    const widthNorm = Math.max(0, Math.min(100, width)) / 100;

    const detector60 = 55 + sweepNorm * 10;
    const detector80 = 75 + sweepNorm * 10;
    const detector110 = 100 + sweepNorm * 15;
    const crossoverHz = 105 + widthNorm * 30;
    const bodyHz = 95 + sweepNorm * 20;
    const subTopHz = 58 + widthNorm * 10;
    const synthLowHz = 55 + widthNorm * 10;
    const synthHighHz = 22 + sweepNorm * 6;

    return {
      detector60,
      detector80,
      detector110,
      crossoverHz,
      bodyHz,
      subTopHz,
      synthLowHz,
      synthHighHz,
    };
  }

  private ensureState(numChannels: number, params: { sweepFreq: number; width: number }) {
    while (this.channels.length < numChannels) {
      this.channels.push(this.createChannelState(params));
    }

    if (!this.monoState) {
      this.monoState = this.createMonoState(params);
      this.lastSweepFreq = params.sweepFreq;
      this.lastWidth = params.width;
      return;
    }

    if (params.sweepFreq === this.lastSweepFreq && params.width === this.lastWidth) {
      return;
    }

    const derived = this.getDerivedFrequencies(params.sweepFreq, params.width);

    for (const state of this.channels) {
      state.voiceHighpass.updateCoeffs('highpass', derived.crossoverHz, 0.707);
      state.bassLowpass.updateCoeffs('lowpass', derived.crossoverHz * 1.15, 0.707);
      state.lowMidBody.updateCoeffs('bandpass', derived.bodyHz, 0.85);
      state.lowMidDip.updateCoeffs('bandpass', derived.bodyHz * 1.18, 1.1);
      state.subLowpass.updateCoeffs('lowpass', derived.subTopHz, 0.707);
    }

    this.monoState.band60.updateCoeffs('bandpass', derived.detector60, 1.35);
    this.monoState.band80.updateCoeffs('bandpass', derived.detector80, 1.55);
    this.monoState.band110.updateCoeffs('bandpass', derived.detector110, 1.8);
    this.monoState.synthHighpass.updateCoeffs('highpass', derived.synthHighHz, 0.707);
    this.monoState.synthLowpass.updateCoeffs('lowpass', derived.synthLowHz, 0.707);

    this.lastSweepFreq = params.sweepFreq;
    this.lastWidth = params.width;
  }

  private computeGate(monoEnv: number, diffEnv: number, weightedDetectorEnv: number): number {
    const musicRatio = diffEnv / (monoEnv + 1e-6);
    const detectorActivity = Math.min(1, weightedDetectorEnv * 9.5);
    const musicScore = Math.max(0, Math.min(1, musicRatio * 3.2));
    const gateTarget = detectorActivity * (0.25 + musicScore * 0.75);
    return gateTarget;
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0 || !output || output.length === 0) {
      return true;
    }

    const numChannels = Math.min(input.length, output.length);
    const sweepFreq = parameters.sweepFreq[0];
    const width = parameters.width[0];
    const intensity = parameters.intensity[0];
    const balance = parameters.balance[0];
    const volume = parameters.volume[0];

    if (intensity <= 0.01) {
      for (let ch = 0; ch < numChannels; ch++) {
        const inChan = input[ch];
        const outChan = output[ch];
        for (let i = 0; i < inChan.length; i++) {
          outChan[i] = inChan[i];
        }
      }
      return true;
    }

    this.ensureState(numChannels, { sweepFreq, width });
    const monoState = this.monoState!;

    const blockSize = input[0].length;
    const subBuffer = new Float32Array(blockSize);

    // 100% visible en la perilla equivale al antiguo 75% efectivo para evitar distorsión de voz.
    const intensityNorm = (Math.max(0, Math.min(100, intensity)) / 100) * EPICENTER_INTENSITY_HEADROOM;
    const balanceNorm = Math.max(0, Math.min(100, balance)) / 100;
    const widthNorm = Math.max(0, Math.min(100, width)) / 100;
    const volumeGain = Math.max(0, Math.min(1.0, volume / 100));

    const synthAmount = 0.42 + intensityNorm * 1.28;
    const bassProgramAmount = 0.68 + balanceNorm * 0.38;
    const lowMidBodyAmount = 0.12 + balanceNorm * 0.08;
    const lowMidDipAmount = (0.08 + intensityNorm * 0.16) * (0.45 + widthNorm * 0.3);
    const gateHoldSamples = Math.floor(sampleRate * (0.025 + intensityNorm * 0.06));

    for (let i = 0; i < blockSize; i++) {
      const left = input[0][i] ?? 0;
      const right = (numChannels > 1 ? input[1][i] : left) ?? left;

      const mono = this.denormalFloor((left + right) * 0.5);
      const diff = this.denormalFloor((left - right) * 0.5);

      const monoBand =
        monoState.band60.process(mono) * 1.0 +
        monoState.band80.process(mono) * 0.68 +
        monoState.band110.process(mono) * 0.42;

      const weightedDetector = this.denormalFloor(monoBand * 0.6 + monoState.monoLowpass.process(mono) * 0.12);
      const detectorEnv = monoState.detectorEnv.process(weightedDetector);
      const monoEnv = monoState.monoEnv.process(mono);
      const diffEnv = monoState.diffEnv.process(monoState.diffHighpass.process(diff));

      if (monoState.lastDetector <= 0 && weightedDetector > 0) {
        monoState.flipState *= -1;
      }
      monoState.lastDetector = weightedDetector;

      const rawHalf = monoState.flipState * detectorEnv;

      let synth = monoState.synthHighpass.process(rawHalf);
      synth = monoState.synthLowpass.process(synth);

      const gateTarget = this.computeGate(monoEnv, diffEnv, detectorEnv);
      const gateValue = monoState.gateEnv.process(gateTarget);

      if (gateTarget > 0.3) {
        monoState.holdSamples = gateHoldSamples;
      } else if (monoState.holdSamples > 0) {
        monoState.holdSamples--;
      }

      const holdFactor = monoState.holdSamples > 0 ? 1 : 0;
      const remixGate = Math.max(gateValue, holdFactor * 0.45);
      const leveledSynth = monoState.synthLevelEnv.process(synth) * Math.sign(synth);
      const protectedSynth = Math.tanh((synth * 0.65 + leveledSynth * 0.35) * 2.1) * 0.72;

      subBuffer[i] = this.denormalFloor(protectedSynth * synthAmount * remixGate);
    }

    for (let ch = 0; ch < numChannels; ch++) {
      const inChan = input[ch];
      const outChan = output[ch];
      const state = this.channels[ch];

      for (let i = 0; i < blockSize; i++) {
        const sample = this.denormalFloor(inChan[i]);

        // Ruta limpia de voz / medios / agudos.
        const voicePath = state.voiceHighpass.process(sample);
        const voicePresence = state.voiceEnv.process(voicePath);
        const voiceProtection = Math.max(0.5, 1 - voicePresence * (0.85 + intensityNorm * 0.3));

        // Ruta de bajo independiente, como la salida dedicada que iría al amp de bajos.
        const bassProgram = state.bassLowpass.process(sample);
        const body = state.lowMidBody.process(sample);
        const dip = state.lowMidDip.process(sample);
        const shapedBassProgram =
          bassProgram * bassProgramAmount +
          body * lowMidBodyAmount * (0.45 + voiceProtection * 0.55) -
          dip * lowMidDipAmount;

        // El sub generado se inyecta mono a ambos canales, pero se atenúa cuando la voz domina.
        const generatedSub = state.subLowpass.process(subBuffer[i]) * (0.4 + voiceProtection * 0.6);

        let mixed =
          voicePath +
          shapedBassProgram +
          generatedSub;

        const protectionGain = 0.94 + voiceProtection * 0.06;
        mixed *= volumeGain * protectionGain;

        // Soft clip final más relajado para no raspar la voz.
        mixed = Math.tanh(mixed * 0.94) / Math.tanh(0.94);
        mixed = state.outputDcHighpass.process(mixed);

        outChan[i] = this.denormalFloor(mixed);
      }
    }

    return true;
  }
}

registerProcessor('epicenter-processor', EpicenterProcessor);
