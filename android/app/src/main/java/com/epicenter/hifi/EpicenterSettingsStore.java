package com.epicenter.hifi;

final class EpicenterSettingsStore {
  private static volatile boolean enabled = false;
  private static volatile float sweepFreq = 45f;
  private static volatile float width = 50f;
  private static volatile float intensity = 50f;
  private static volatile float balance = 50f;
  private static volatile float volume = 100f;

  private EpicenterSettingsStore() {}

  static synchronized void update(
    boolean newEnabled,
    float newSweepFreq,
    float newWidth,
    float newIntensity,
    float newBalance,
    float newVolume
  ) {
    enabled = newEnabled;
    sweepFreq = clamp(newSweepFreq, 27f, 63f);
    width = clamp(newWidth, 0f, 100f);
    intensity = clamp(newIntensity, 0f, 100f);
    balance = clamp(newBalance, 0f, 100f);
    volume = clamp(newVolume, 0f, 100f);
  }

  static synchronized Snapshot snapshot() {
    return new Snapshot(enabled, sweepFreq, width, intensity, balance, volume);
  }

  private static float clamp(float value, float min, float max) {
    return Math.max(min, Math.min(max, value));
  }

  static final class Snapshot {
    final boolean enabled;
    final float sweepFreq;
    final float width;
    final float intensity;
    final float balance;
    final float volume;

    Snapshot(
      boolean enabled,
      float sweepFreq,
      float width,
      float intensity,
      float balance,
      float volume
    ) {
      this.enabled = enabled;
      this.sweepFreq = sweepFreq;
      this.width = width;
      this.intensity = intensity;
      this.balance = balance;
      this.volume = volume;
    }
  }
}
