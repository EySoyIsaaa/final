package com.epicenter.hifi;

import android.content.Context;

import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.audio.AudioSink;
import androidx.media3.exoplayer.audio.DefaultAudioSink;

@UnstableApi
final class EpicenterRenderersFactory extends DefaultRenderersFactory {
  private final EpicenterNativeAudioProcessor epicenterProcessor;

  EpicenterRenderersFactory(Context context, EpicenterNativeAudioProcessor epicenterProcessor) {
    super(context);
    this.epicenterProcessor = epicenterProcessor;
  }

  @Override
  protected AudioSink buildAudioSink(
    @androidx.annotation.NonNull Context context,
    boolean enableFloatOutput,
    boolean enableAudioTrackPlaybackParams
  ) {
    return new DefaultAudioSink.Builder(context)
      // El procesamiento Epicenter requiere cadena PCM fija, desactivar float output evita bypass interno.
      .setEnableFloatOutput(false)
      .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams)
      .setAudioProcessors(new AudioProcessor[] { epicenterProcessor })
      .build();
  }
}
