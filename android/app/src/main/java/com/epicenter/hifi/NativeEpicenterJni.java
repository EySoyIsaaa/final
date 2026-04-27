package com.epicenter.hifi;

import java.nio.ByteBuffer;

final class NativeEpicenterJni {
  static {
    System.loadLibrary("epicenter_native");
  }

  private NativeEpicenterJni() {}

  static native long nativeCreate(int sampleRate, int channelCount);

  static native void nativeRelease(long handle);

  static native void nativeSetParams(
    long handle,
    boolean enabled,
    float sweepFreq,
    float width,
    float intensity,
    float balance,
    float volume
  );

  static native void nativeProcessPcm16(
    long handle,
    ByteBuffer input,
    ByteBuffer output,
    int frameCount,
    int channelCount
  );
}
