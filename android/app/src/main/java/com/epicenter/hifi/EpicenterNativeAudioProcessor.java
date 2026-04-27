package com.epicenter.hifi;

import android.util.Log;

import androidx.annotation.NonNull;
import androidx.media3.common.C;
import androidx.media3.common.audio.BaseAudioProcessor;
import androidx.media3.common.util.UnstableApi;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

@UnstableApi
final class EpicenterNativeAudioProcessor extends BaseAudioProcessor {
  private static final String TAG = "EpicenterProcessor";
  private static final int BYTES_PER_SAMPLE_PCM16 = 2;
  private static final int BYTES_PER_SAMPLE_FLOAT = 4;

  private long nativeHandle = 0L;
  private int configuredSampleRate = -1;
  private int configuredChannels = -1;
  private int configuredEncoding = C.ENCODING_INVALID;
  private long processedFrames = 0L;
  private long nextDebugFrameMark = 0L;

  private ByteBuffer tempInPcm16 = EMPTY_BUFFER;
  private ByteBuffer tempOutPcm16 = EMPTY_BUFFER;

  @Override
  public @NonNull AudioFormat onConfigure(@NonNull AudioFormat inputAudioFormat) throws UnhandledAudioFormatException {
    if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT && inputAudioFormat.encoding != C.ENCODING_PCM_FLOAT) {
      throw new UnhandledAudioFormatException(inputAudioFormat);
    }

    configuredSampleRate = inputAudioFormat.sampleRate;
    configuredChannels = inputAudioFormat.channelCount;
    configuredEncoding = inputAudioFormat.encoding;
    processedFrames = 0L;
    nextDebugFrameMark = Math.max(1, configuredSampleRate * 3L);

    Log.d(TAG, "Configured sampleRate=" + configuredSampleRate
      + " channels=" + configuredChannels
      + " encoding=" + configuredEncoding);

    ensureNative();
    applyCurrentSettings();
    return inputAudioFormat;
  }

  @Override
  public void queueInput(ByteBuffer inputBuffer) {
    if (!inputBuffer.hasRemaining()) {
      return;
    }

    ensureNative();
    applyCurrentSettings();

    int inputBytes = inputBuffer.remaining();
    ByteBuffer outputBuffer = replaceOutputBuffer(inputBytes).order(ByteOrder.nativeOrder());

    if (nativeHandle == 0L) {
      outputBuffer.put(inputBuffer);
      outputBuffer.flip();
      return;
    }

    final int channelCount = Math.max(1, configuredChannels);

    if (configuredEncoding == C.ENCODING_PCM_16BIT) {
      int frameCount = inputBytes / (BYTES_PER_SAMPLE_PCM16 * channelCount);
      NativeEpicenterJni.nativeProcessPcm16(
        nativeHandle,
        inputBuffer,
        outputBuffer,
        frameCount,
        channelCount
      );

      processedFrames += frameCount;
      maybeLogProcessing();

      inputBuffer.position(inputBuffer.limit());
      outputBuffer.position(inputBytes);
      outputBuffer.flip();
      return;
    }

    if (configuredEncoding == C.ENCODING_PCM_FLOAT) {
      int frameCount = inputBytes / (BYTES_PER_SAMPLE_FLOAT * channelCount);
      int sampleCount = frameCount * channelCount;
      int pcm16Bytes = sampleCount * BYTES_PER_SAMPLE_PCM16;

      ensureTempPcm16Capacity(pcm16Bytes);
      tempInPcm16.clear();
      tempOutPcm16.clear();
      tempInPcm16.limit(pcm16Bytes);
      tempOutPcm16.limit(pcm16Bytes);

      ByteBuffer inputView = inputBuffer.duplicate().order(ByteOrder.nativeOrder());
      for (int i = 0; i < sampleCount; i++) {
        float sample = inputView.getFloat();
        short s = floatToPcm16(sample);
        tempInPcm16.putShort(s);
      }

      tempInPcm16.position(0);
      tempOutPcm16.position(0);

      NativeEpicenterJni.nativeProcessPcm16(
        nativeHandle,
        tempInPcm16,
        tempOutPcm16,
        frameCount,
        channelCount
      );

      tempOutPcm16.position(0);
      for (int i = 0; i < sampleCount; i++) {
        short s = tempOutPcm16.getShort();
        outputBuffer.putFloat(pcm16ToFloat(s));
      }

      processedFrames += frameCount;
      maybeLogProcessing();

      inputBuffer.position(inputBuffer.limit());
      outputBuffer.flip();
      return;
    }

    outputBuffer.put(inputBuffer);
    outputBuffer.flip();
  }

  @Override
  protected void onFlush() {
    applyCurrentSettings();
  }

  @Override
  protected void onReset() {
    releaseNative();
    configuredSampleRate = -1;
    configuredChannels = -1;
    configuredEncoding = C.ENCODING_INVALID;
    tempInPcm16 = EMPTY_BUFFER;
    tempOutPcm16 = EMPTY_BUFFER;
  }

  void refreshSettings() {
    applyCurrentSettings();
  }

  private void ensureNative() {
    if (nativeHandle != 0L || configuredSampleRate <= 0 || configuredChannels <= 0) {
      return;
    }
    nativeHandle = NativeEpicenterJni.nativeCreate(configuredSampleRate, configuredChannels);
  }

  private void releaseNative() {
    if (nativeHandle != 0L) {
      NativeEpicenterJni.nativeRelease(nativeHandle);
      nativeHandle = 0L;
    }
  }

  private void applyCurrentSettings() {
    if (nativeHandle == 0L) {
      return;
    }

    EpicenterSettingsStore.Snapshot s = EpicenterSettingsStore.snapshot();
    NativeEpicenterJni.nativeSetParams(
      nativeHandle,
      s.enabled,
      s.sweepFreq,
      s.width,
      s.intensity,
      s.balance,
      s.volume
    );
  }

  private void maybeLogProcessing() {
    if (processedFrames >= nextDebugFrameMark) {
      EpicenterSettingsStore.Snapshot s = EpicenterSettingsStore.snapshot();
      Log.d(TAG, "processing ok frames=" + processedFrames
        + " enabled=" + s.enabled
        + " intensity=" + s.intensity
        + " sweep=" + s.sweepFreq
        + " width=" + s.width);
      nextDebugFrameMark += Math.max(1, configuredSampleRate * 3L);
    }
  }

  private void ensureTempPcm16Capacity(int requiredBytes) {
    if (tempInPcm16.capacity() >= requiredBytes && tempOutPcm16.capacity() >= requiredBytes) {
      return;
    }
    tempInPcm16 = ByteBuffer.allocateDirect(requiredBytes).order(ByteOrder.nativeOrder());
    tempOutPcm16 = ByteBuffer.allocateDirect(requiredBytes).order(ByteOrder.nativeOrder());
  }

  private static short floatToPcm16(float sample) {
    float clamped = Math.max(-1f, Math.min(1f, sample));
    int value = Math.round(clamped * 32767f);
    value = Math.max(-32768, Math.min(32767, value));
    return (short) value;
  }

  private static float pcm16ToFloat(short sample) {
    return sample / 32768f;
  }
}
