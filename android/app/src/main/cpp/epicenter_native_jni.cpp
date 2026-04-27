#include <jni.h>
#include <cmath>
#include <cstdint>
#include <algorithm>
#include <vector>
#include <android/log.h>

namespace {

constexpr float DENORMAL_FLOOR = 1e-24f;
constexpr float TWO_PI = 6.28318530717958647692f;
constexpr float EPICENTER_INTENSITY_HEADROOM = 0.75f;
constexpr const char* LOG_TAG = "EpicenterNative";

inline float denormalFloor(float v) {
  return std::fabs(v) < DENORMAL_FLOOR ? 0.0f : v;
}

inline float clampf(float v, float lo, float hi) {
  return std::max(lo, std::min(hi, v));
}

inline float coeffFromMs(float ms, float sampleRate) {
  const float samples = std::max(1.0f, ms * sampleRate / 1000.0f);
  return std::exp(-1.0f / samples);
}

struct Biquad {
  enum class Type { Lowpass, Highpass, Bandpass };

  Type type = Type::Lowpass;
  float freq = 100.0f;
  float sr = 48000.0f;
  float q = 0.707f;

  float b0 = 0.0f;
  float b1 = 0.0f;
  float b2 = 0.0f;
  float a1 = 0.0f;
  float a2 = 0.0f;

  float x1 = 0.0f;
  float x2 = 0.0f;
  float y1 = 0.0f;
  float y2 = 0.0f;

  void update(Type newType, float newFreq, float newQ) {
    type = newType;
    freq = newFreq;
    q = newQ;

    const float clampedFreq = clampf(freq, 10.0f, sr * 0.45f);
    const float clampedQ = clampf(q, 0.2f, 12.0f);
    const float omega = TWO_PI * clampedFreq / sr;
    const float sinOmega = std::sin(omega);
    const float cosOmega = std::cos(omega);
    const float alpha = sinOmega / (2.0f * clampedQ);

    float lb0 = 0.0f;
    float lb1 = 0.0f;
    float lb2 = 0.0f;
    float la0 = 1.0f;
    float la1 = 0.0f;
    float la2 = 0.0f;

    switch (type) {
      case Type::Lowpass:
        lb0 = (1.0f - cosOmega) * 0.5f;
        lb1 = 1.0f - cosOmega;
        lb2 = (1.0f - cosOmega) * 0.5f;
        la0 = 1.0f + alpha;
        la1 = -2.0f * cosOmega;
        la2 = 1.0f - alpha;
        break;
      case Type::Highpass:
        lb0 = (1.0f + cosOmega) * 0.5f;
        lb1 = -(1.0f + cosOmega);
        lb2 = (1.0f + cosOmega) * 0.5f;
        la0 = 1.0f + alpha;
        la1 = -2.0f * cosOmega;
        la2 = 1.0f - alpha;
        break;
      case Type::Bandpass:
        lb0 = alpha;
        lb1 = 0.0f;
        lb2 = -alpha;
        la0 = 1.0f + alpha;
        la1 = -2.0f * cosOmega;
        la2 = 1.0f - alpha;
        break;
    }

    b0 = lb0 / la0;
    b1 = lb1 / la0;
    b2 = lb2 / la0;
    a1 = la1 / la0;
    a2 = la2 / la0;
  }

  float process(float sample) {
    const float clean = denormalFloor(sample);
    const float y0 = b0 * clean + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = denormalFloor(x1);
    x1 = clean;
    y2 = denormalFloor(y1);
    y1 = denormalFloor(y0);
    return denormalFloor(y0);
  }
};

struct EnvelopeFollower {
  float attackCoeff = 0.0f;
  float releaseCoeff = 0.0f;
  float value = 0.0f;

  float process(float input) {
    const float x = std::fabs(input);
    const float coeff = x > value ? attackCoeff : releaseCoeff;
    value = x + coeff * (value - x);
    return value;
  }
};

struct ChannelState {
  Biquad voiceHighpass;
  Biquad bassLowpass;
  Biquad lowMidBody;
  Biquad lowMidDip;
  Biquad subLowpass;
  Biquad outputDcHighpass;
  EnvelopeFollower voiceEnv;
};

struct MonoState {
  Biquad band60;
  Biquad band80;
  Biquad band110;
  Biquad monoLowpass;
  Biquad diffHighpass;
  Biquad synthHighpass;
  Biquad synthLowpass;
  EnvelopeFollower detectorEnv;
  EnvelopeFollower monoEnv;
  EnvelopeFollower diffEnv;
  EnvelopeFollower gateEnv;
  EnvelopeFollower synthLevelEnv;
  float lastDetector = 0.0f;
  int flipState = 1;
  int holdSamples = 0;
};

struct DerivedFreq {
  float detector60;
  float detector80;
  float detector110;
  float crossoverHz;
  float bodyHz;
  float subTopHz;
  float synthLowHz;
  float synthHighHz;
};

static DerivedFreq getDerivedFrequencies(float sweepFreq, float width) {
  const float sweepNorm = (clampf(sweepFreq, 27.0f, 63.0f) - 27.0f) / 36.0f;
  const float widthNorm = clampf(width, 0.0f, 100.0f) / 100.0f;

  DerivedFreq d{};
  d.detector60 = 55.0f + sweepNorm * 10.0f;
  d.detector80 = 75.0f + sweepNorm * 10.0f;
  d.detector110 = 100.0f + sweepNorm * 15.0f;
  d.crossoverHz = 105.0f + widthNorm * 30.0f;
  d.bodyHz = 95.0f + sweepNorm * 20.0f;
  d.subTopHz = 58.0f + widthNorm * 10.0f;
  d.synthLowHz = 55.0f + widthNorm * 10.0f;
  d.synthHighHz = 22.0f + sweepNorm * 6.0f;
  return d;
}

class EpicenterEngine {
 public:
  EpicenterEngine(int sampleRate, int channelCount)
    : sampleRate_(static_cast<float>(sampleRate)),
      channelCount_(std::max(1, channelCount)) {
    for (auto& c : channels_) {
      initChannel(c);
    }
    initMono();
  }

  void setParams(bool enabled, float sweepFreq, float width, float intensity, float balance, float volume) {
    enabled_ = enabled;
    sweepFreq_ = clampf(sweepFreq, 27.0f, 63.0f);
    width_ = clampf(width, 0.0f, 100.0f);
    intensity_ = clampf(intensity, 0.0f, 100.0f);
    balance_ = clampf(balance, 0.0f, 100.0f);
    volume_ = clampf(volume, 0.0f, 100.0f);

    if (enabled_ != lastLoggedEnabled_) {
      __android_log_print(ANDROID_LOG_DEBUG, LOG_TAG,
        "enabled=%d sweep=%.2f width=%.2f intensity=%.2f balance=%.2f volume=%.2f",
        enabled_ ? 1 : 0, sweepFreq_, width_, intensity_, balance_, volume_);
      lastLoggedEnabled_ = enabled_;
    }

    if (sweepFreq_ != lastSweepFreq_ || width_ != lastWidth_) {
      updateDerivedFilters();
      lastSweepFreq_ = sweepFreq_;
      lastWidth_ = width_;
    }
  }

  void processPcm16(const int16_t* in, int16_t* out, int frameCount, int channelCount) {
    if (!in || !out || frameCount <= 0) return;

    const int usedChannels = std::max(1, std::min(channelCount, channelCount_));

    if (!enabled_ || intensity_ <= 0.01f) {
      const int samples = frameCount * usedChannels;
      for (int i = 0; i < samples; ++i) out[i] = in[i];
      return;
    }

    const float intensityNorm = (intensity_ / 100.0f) * EPICENTER_INTENSITY_HEADROOM;
    const float balanceNorm = balance_ / 100.0f;
    const float widthNorm = width_ / 100.0f;
    const float volumeGain = clampf(volume_ / 100.0f, 0.0f, 1.0f);

    const float synthAmount = 0.42f + intensityNorm * 1.28f;
    const float bassProgramAmount = 0.68f + balanceNorm * 0.38f;
    const float lowMidBodyAmount = 0.12f + balanceNorm * 0.08f;
    const float lowMidDipAmount = (0.08f + intensityNorm * 0.16f) * (0.45f + widthNorm * 0.3f);
    const int gateHoldSamples = static_cast<int>(sampleRate_ * (0.025f + intensityNorm * 0.06f));

    subBuffer_.resize(static_cast<size_t>(frameCount));

    for (int i = 0; i < frameCount; ++i) {
      const float left = pcmToFloat(in[i * usedChannels]);
      const float right = usedChannels > 1 ? pcmToFloat(in[i * usedChannels + 1]) : left;

      const float mono = denormalFloor((left + right) * 0.5f);
      const float diff = denormalFloor((left - right) * 0.5f);

      const float monoBand =
        monoState_.band60.process(mono) * 1.0f +
        monoState_.band80.process(mono) * 0.68f +
        monoState_.band110.process(mono) * 0.42f;

      const float weightedDetector = denormalFloor(monoBand * 0.6f + monoState_.monoLowpass.process(mono) * 0.12f);
      const float detectorEnv = monoState_.detectorEnv.process(weightedDetector);
      const float monoEnv = monoState_.monoEnv.process(mono);
      const float diffEnv = monoState_.diffEnv.process(monoState_.diffHighpass.process(diff));

      if (monoState_.lastDetector <= 0.0f && weightedDetector > 0.0f) {
        monoState_.flipState *= -1;
      }
      monoState_.lastDetector = weightedDetector;

      const float rawHalf = static_cast<float>(monoState_.flipState) * detectorEnv;
      float synth = monoState_.synthHighpass.process(rawHalf);
      synth = monoState_.synthLowpass.process(synth);

      const float gateTarget = computeGate(monoEnv, diffEnv, detectorEnv);
      const float gateValue = monoState_.gateEnv.process(gateTarget);

      if (gateTarget > 0.3f) {
        monoState_.holdSamples = gateHoldSamples;
      } else if (monoState_.holdSamples > 0) {
        monoState_.holdSamples--;
      }

      const float holdFactor = monoState_.holdSamples > 0 ? 1.0f : 0.0f;
      const float remixGate = std::max(gateValue, holdFactor * 0.45f);

      const float leveledSynth = monoState_.synthLevelEnv.process(synth) * (synth >= 0.0f ? 1.0f : -1.0f);
      const float protectedSynth = std::tanh((synth * 0.65f + leveledSynth * 0.35f) * 2.1f) * 0.72f;

      subBuffer_[static_cast<size_t>(i)] = denormalFloor(protectedSynth * synthAmount * remixGate);
    }

    for (int i = 0; i < frameCount; ++i) {
      for (int ch = 0; ch < usedChannels; ++ch) {
        ChannelState& state = channels_[std::min(ch, channelCount_ - 1)];
        const float sample = pcmToFloat(in[i * usedChannels + ch]);

        const float voicePath = state.voiceHighpass.process(sample);
        const float voicePresence = state.voiceEnv.process(voicePath);
        const float voiceProtection = std::max(0.5f, 1.0f - voicePresence * (0.85f + intensityNorm * 0.3f));

        const float bassProgram = state.bassLowpass.process(sample);
        const float body = state.lowMidBody.process(sample);
        const float dip = state.lowMidDip.process(sample);

        const float shapedBassProgram =
          bassProgram * bassProgramAmount +
          body * lowMidBodyAmount * (0.45f + voiceProtection * 0.55f) -
          dip * lowMidDipAmount;

        const float generatedSub = state.subLowpass.process(subBuffer_[static_cast<size_t>(i)]) * (0.4f + voiceProtection * 0.6f);

        float mixed = voicePath + shapedBassProgram + generatedSub;
        const float protectionGain = 0.94f + voiceProtection * 0.06f;

        mixed *= volumeGain * protectionGain;
        mixed = std::tanh(mixed * 0.94f) / std::tanh(0.94f);
        mixed = state.outputDcHighpass.process(mixed);

        out[i * usedChannels + ch] = floatToPcm(denormalFloor(mixed));
      }
    }
  }

 private:
  float sampleRate_;
  int channelCount_;
  bool enabled_ = false;
  bool lastLoggedEnabled_ = false;

  float sweepFreq_ = 45.0f;
  float width_ = 50.0f;
  float intensity_ = 50.0f;
  float balance_ = 50.0f;
  float volume_ = 100.0f;

  float lastSweepFreq_ = -1.0f;
  float lastWidth_ = -1.0f;

  ChannelState channels_[2];
  MonoState monoState_;
  std::vector<float> subBuffer_;

  void initChannel(ChannelState& c) {
    DerivedFreq d = getDerivedFrequencies(sweepFreq_, width_);
    c.voiceHighpass.sr = sampleRate_;
    c.bassLowpass.sr = sampleRate_;
    c.lowMidBody.sr = sampleRate_;
    c.lowMidDip.sr = sampleRate_;
    c.subLowpass.sr = sampleRate_;
    c.outputDcHighpass.sr = sampleRate_;

    c.voiceHighpass.update(Biquad::Type::Highpass, d.crossoverHz, 0.707f);
    c.bassLowpass.update(Biquad::Type::Lowpass, d.crossoverHz * 1.15f, 0.707f);
    c.lowMidBody.update(Biquad::Type::Bandpass, d.bodyHz, 0.85f);
    c.lowMidDip.update(Biquad::Type::Bandpass, d.bodyHz * 1.18f, 1.1f);
    c.subLowpass.update(Biquad::Type::Lowpass, d.subTopHz, 0.707f);
    c.outputDcHighpass.update(Biquad::Type::Highpass, 18.0f, 0.707f);

    c.voiceEnv.attackCoeff = coeffFromMs(6.0f, sampleRate_);
    c.voiceEnv.releaseCoeff = coeffFromMs(110.0f, sampleRate_);
  }

  void initMono() {
    DerivedFreq d = getDerivedFrequencies(sweepFreq_, width_);

    monoState_.band60.sr = sampleRate_;
    monoState_.band80.sr = sampleRate_;
    monoState_.band110.sr = sampleRate_;
    monoState_.monoLowpass.sr = sampleRate_;
    monoState_.diffHighpass.sr = sampleRate_;
    monoState_.synthHighpass.sr = sampleRate_;
    monoState_.synthLowpass.sr = sampleRate_;

    monoState_.band60.update(Biquad::Type::Bandpass, d.detector60, 1.35f);
    monoState_.band80.update(Biquad::Type::Bandpass, d.detector80, 1.55f);
    monoState_.band110.update(Biquad::Type::Bandpass, d.detector110, 1.8f);
    monoState_.monoLowpass.update(Biquad::Type::Lowpass, 120.0f, 0.707f);
    monoState_.diffHighpass.update(Biquad::Type::Highpass, 140.0f, 0.707f);
    monoState_.synthHighpass.update(Biquad::Type::Highpass, d.synthHighHz, 0.707f);
    monoState_.synthLowpass.update(Biquad::Type::Lowpass, d.synthLowHz, 0.707f);

    monoState_.detectorEnv.attackCoeff = coeffFromMs(7.0f, sampleRate_);
    monoState_.detectorEnv.releaseCoeff = coeffFromMs(95.0f, sampleRate_);

    monoState_.monoEnv.attackCoeff = coeffFromMs(12.0f, sampleRate_);
    monoState_.monoEnv.releaseCoeff = coeffFromMs(160.0f, sampleRate_);

    monoState_.diffEnv.attackCoeff = coeffFromMs(12.0f, sampleRate_);
    monoState_.diffEnv.releaseCoeff = coeffFromMs(160.0f, sampleRate_);

    monoState_.gateEnv.attackCoeff = coeffFromMs(25.0f, sampleRate_);
    monoState_.gateEnv.releaseCoeff = coeffFromMs(240.0f, sampleRate_);

    monoState_.synthLevelEnv.attackCoeff = coeffFromMs(18.0f, sampleRate_);
    monoState_.synthLevelEnv.releaseCoeff = coeffFromMs(180.0f, sampleRate_);
  }

  void updateDerivedFilters() {
    DerivedFreq d = getDerivedFrequencies(sweepFreq_, width_);
    for (auto& c : channels_) {
      c.voiceHighpass.update(Biquad::Type::Highpass, d.crossoverHz, 0.707f);
      c.bassLowpass.update(Biquad::Type::Lowpass, d.crossoverHz * 1.15f, 0.707f);
      c.lowMidBody.update(Biquad::Type::Bandpass, d.bodyHz, 0.85f);
      c.lowMidDip.update(Biquad::Type::Bandpass, d.bodyHz * 1.18f, 1.1f);
      c.subLowpass.update(Biquad::Type::Lowpass, d.subTopHz, 0.707f);
    }

    monoState_.band60.update(Biquad::Type::Bandpass, d.detector60, 1.35f);
    monoState_.band80.update(Biquad::Type::Bandpass, d.detector80, 1.55f);
    monoState_.band110.update(Biquad::Type::Bandpass, d.detector110, 1.8f);
    monoState_.synthHighpass.update(Biquad::Type::Highpass, d.synthHighHz, 0.707f);
    monoState_.synthLowpass.update(Biquad::Type::Lowpass, d.synthLowHz, 0.707f);
  }

  static float computeGate(float monoEnv, float diffEnv, float weightedDetectorEnv) {
    const float musicRatio = diffEnv / (monoEnv + 1e-6f);
    const float detectorActivity = std::min(1.0f, weightedDetectorEnv * 9.5f);
    const float musicScore = clampf(musicRatio * 3.2f, 0.0f, 1.0f);
    return detectorActivity * (0.25f + musicScore * 0.75f);
  }

  static float pcmToFloat(int16_t v) {
    return static_cast<float>(v) / 32768.0f;
  }

  static int16_t floatToPcm(float v) {
    float c = clampf(v, -1.0f, 1.0f);
    int32_t sample = static_cast<int32_t>(std::lrint(c * 32767.0f));
    sample = std::max(-32768, std::min(32767, sample));
    return static_cast<int16_t>(sample);
  }
};

inline EpicenterEngine* fromHandle(jlong handle) {
  return reinterpret_cast<EpicenterEngine*>(handle);
}

} // namespace

extern "C" JNIEXPORT jlong JNICALL
Java_com_epicenter_hifi_NativeEpicenterJni_nativeCreate(JNIEnv*, jclass, jint sampleRate, jint channelCount) {
  auto* engine = new EpicenterEngine(sampleRate, channelCount);
  return reinterpret_cast<jlong>(engine);
}

extern "C" JNIEXPORT void JNICALL
Java_com_epicenter_hifi_NativeEpicenterJni_nativeRelease(JNIEnv*, jclass, jlong handle) {
  delete fromHandle(handle);
}

extern "C" JNIEXPORT void JNICALL
Java_com_epicenter_hifi_NativeEpicenterJni_nativeSetParams(
  JNIEnv*,
  jclass,
  jlong handle,
  jboolean enabled,
  jfloat sweepFreq,
  jfloat width,
  jfloat intensity,
  jfloat balance,
  jfloat volume
) {
  EpicenterEngine* engine = fromHandle(handle);
  if (!engine) return;
  engine->setParams(enabled == JNI_TRUE, sweepFreq, width, intensity, balance, volume);
}

extern "C" JNIEXPORT void JNICALL
Java_com_epicenter_hifi_NativeEpicenterJni_nativeProcessPcm16(
  JNIEnv* env,
  jclass,
  jlong handle,
  jobject input,
  jobject output,
  jint frameCount,
  jint channelCount
) {
  EpicenterEngine* engine = fromHandle(handle);
  if (!engine || !input || !output) return;

  auto* in = static_cast<int16_t*>(env->GetDirectBufferAddress(input));
  auto* out = static_cast<int16_t*>(env->GetDirectBufferAddress(output));
  if (!in || !out) return;

  engine->processPcm16(in, out, frameCount, channelCount);
}
