package com.epicenter.hifi;

import android.content.ComponentName;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@CapacitorPlugin(name = "NativeAudioPlayer")
@androidx.media3.common.util.UnstableApi
public class NativeAudioPlayerPlugin extends Plugin {
  private static final String TAG = "NativeAudioPlayer";

  private MediaController controller;
  private ListenableFuture<MediaController> controllerFuture;
  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private volatile JSObject lastKnownState = buildIdleState();

  private final Runnable positionEmitter = new Runnable() {
    @Override
    public void run() {
      emitPlaybackState();
      if (controller != null && controller.isPlaying()) {
        mainHandler.postDelayed(this, 1000);
      }
    }
  };

  private final Player.Listener playerListener = new Player.Listener() {
    @Override
    public void onPlaybackStateChanged(int playbackState) {
      emitPlaybackState();
      if (controller != null && controller.isPlaying()) {
        mainHandler.removeCallbacks(positionEmitter);
        mainHandler.post(positionEmitter);
      } else {
        mainHandler.removeCallbacks(positionEmitter);
      }
    }

    @Override
    public void onIsPlayingChanged(boolean isPlaying) {
      emitPlaybackState();
      if (isPlaying) {
        mainHandler.removeCallbacks(positionEmitter);
        mainHandler.post(positionEmitter);
      } else {
        mainHandler.removeCallbacks(positionEmitter);
      }
    }

    @Override
    public void onPlayerError(@NonNull PlaybackException error) {
      JSObject payload = new JSObject();
      payload.put("message", error.getMessage());
      payload.put("code", error.errorCode);
      payload.put("codeName", PlaybackException.getErrorCodeName(error.errorCode));
      notifyListeners("playbackError", payload);
      emitPlaybackState();
    }

    @Override
    public void onMediaItemTransition(MediaItem mediaItem, int reason) {
      emitPlaybackState();
    }
  };

  @Override
  public void load() {
    super.load();
    ensureController();
  }

  @Override
  protected void handleOnDestroy() {
    cleanupController();
    super.handleOnDestroy();
  }

  @PluginMethod
  public void initialize(PluginCall call) {
    mainHandler.post(() -> {
      ensureController();
      call.resolve(createStatePayload());
    });
  }

  @PluginMethod
  public void loadTrack(PluginCall call) {
    mainHandler.post(() -> {
      String source = call.getString("source");
      if (source == null || source.isEmpty()) {
        call.reject("source is required");
        return;
      }

      String trackId = call.getString("trackId");
      if (trackId == null || trackId.isEmpty()) {
        trackId = source;
      }
      String title = call.getString("title", "Unknown");
      String artist = call.getString("artist", "Unknown Artist");
      String album = call.getString("album", "Unknown Album");

      final String finalTrackId = trackId;
      runWhenControllerReady(call, () -> {
        try {
          Uri sourceUri = normalizeUri(source);

          MediaMetadata metadata = new MediaMetadata.Builder()
            .setTitle(title)
            .setArtist(artist)
            .setAlbumTitle(album)
            .build();

          MediaItem item = new MediaItem.Builder()
            .setMediaId(finalTrackId)
            .setUri(sourceUri)
            .setMediaMetadata(metadata)
            .build();

          controller.setMediaItem(item);
          controller.prepare();
          emitPlaybackState();
          call.resolve(createStatePayload());
        } catch (Exception error) {
          call.reject("Failed to load track: " + error.getMessage(), error);
        }
      });
    });
  }

  @PluginMethod
  public void play(PluginCall call) {
    mainHandler.post(() -> runWhenControllerReady(call, () -> {
      controller.play();
      emitPlaybackState();
      call.resolve(createStatePayload());
    }));
  }

  @PluginMethod
  public void pause(PluginCall call) {
    mainHandler.post(() -> {
      if (controller == null) {
        call.resolve(createStatePayload());
        return;
      }
      controller.pause();
      emitPlaybackState();
      call.resolve(createStatePayload());
    });
  }

  @PluginMethod
  public void seekTo(PluginCall call) {
    mainHandler.post(() -> {
      Double positionSeconds = call.getDouble("positionSeconds");
      if (positionSeconds == null) {
        call.reject("positionSeconds is required");
        return;
      }

      long target = Math.max(0, (long) (positionSeconds * 1000L));
      runWhenControllerReady(call, () -> {
        controller.seekTo(target);
        emitPlaybackState();
        call.resolve(createStatePayload());
      });
    });
  }

  @PluginMethod
  public void reset(PluginCall call) {
    mainHandler.post(() -> {
      if (controller != null) {
        controller.stop();
        controller.clearMediaItems();
      }
      emitPlaybackState();
      call.resolve(createStatePayload());
    });
  }

  @PluginMethod
  public void setEpicenterParams(PluginCall call) {
    mainHandler.post(() -> {
      boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
      Double sweepFreqValue = call.getDouble("sweepFreq");
      Double widthValue = call.getDouble("width");
      Double intensityValue = call.getDouble("intensity");
      Double balanceValue = call.getDouble("balance");
      Double volumeValue = call.getDouble("volume");

      float sweepFreq = (float) (sweepFreqValue != null ? sweepFreqValue : 45.0);
      float width = (float) (widthValue != null ? widthValue : 50.0);
      float intensity = (float) (intensityValue != null ? intensityValue : 50.0);
      float balance = (float) (balanceValue != null ? balanceValue : 50.0);
      float volume = (float) (volumeValue != null ? volumeValue : 100.0);

      EpicenterSettingsStore.update(enabled, sweepFreq, width, intensity, balance, volume);
      NativeAudioPlaybackService.onDspSettingsUpdated();

      Log.d(TAG, "setEpicenterParams enabled=" + enabled
        + " sweep=" + sweepFreq
        + " width=" + width
        + " intensity=" + intensity
        + " balance=" + balance
        + " volume=" + volume);

      JSObject result = new JSObject();
      result.put("success", true);
      call.resolve(result);
    });
  }

  @PluginMethod
  public void getState(PluginCall call) {
    mainHandler.post(() -> call.resolve(createStatePayload()));
  }

  private void ensureController() {
    if (controller != null) {
      return;
    }

    android.content.Context appContext = getContext().getApplicationContext();

    if (controllerFuture == null) {
      SessionToken sessionToken = new SessionToken(appContext, new ComponentName(appContext, NativeAudioPlaybackService.class));
      controllerFuture = new MediaController.Builder(appContext, sessionToken).buildAsync();
      controllerFuture.addListener(() -> {
        try {
          controller = controllerFuture.get();
          controller.addListener(playerListener);
          emitPlaybackState();
        } catch (InterruptedException interrupted) {
          Thread.currentThread().interrupt();
        } catch (ExecutionException ignored) {
          // Se reportará vía getState/playbackError en JS
        }
      }, ContextCompat.getMainExecutor(appContext));
    }
  }

  private void runWhenControllerReady(PluginCall call, Runnable action) {
    ensureController();

    if (controller != null) {
      action.run();
      return;
    }

    if (controllerFuture == null) {
      call.reject("Native player is not ready");
      return;
    }

    controllerFuture.addListener(() -> mainHandler.post(() -> {
      try {
        if (controller == null) {
          controller = controllerFuture.get(2, TimeUnit.SECONDS);
          if (controller != null) {
            controller.removeListener(playerListener);
            controller.addListener(playerListener);
            emitPlaybackState();
          }
        }

        if (controller == null) {
          call.reject("Native player is not ready");
          return;
        }

        action.run();
      } catch (TimeoutException timeout) {
        call.reject("Native player initialization timeout", timeout);
      } catch (ExecutionException | InterruptedException error) {
        if (error instanceof InterruptedException) {
          Thread.currentThread().interrupt();
        }
        call.reject("Native player is not ready", error);
      }
    }), ContextCompat.getMainExecutor(getContext()));
  }

  private void cleanupController() {
    mainHandler.removeCallbacks(positionEmitter);
    if (controller != null) {
      controller.removeListener(playerListener);
      controller.release();
      controller = null;
    }

    if (controllerFuture != null) {
      MediaController.releaseFuture(controllerFuture);
      controllerFuture = null;
    }
  }

  private Uri normalizeUri(String source) {
    if (source.startsWith("https://localhost/_capacitor_file_/") || source.startsWith("http://localhost/_capacitor_file_/")) {
      String filePath = source
        .replaceFirst("^https?://localhost/_capacitor_file_", "");
      return Uri.fromFile(new java.io.File(Uri.decode(filePath)));
    }

    if (source.startsWith("content://") || source.startsWith("file://") || source.startsWith("http://") || source.startsWith("https://")) {
      return Uri.parse(source);
    }
    return Uri.fromFile(new java.io.File(source));
  }

  private JSObject createStatePayload() {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      return lastKnownState;
    }

    JSObject payload = new JSObject();
    if (controller == null) {
      payload = buildIdleState();
      lastKnownState = payload;
      return payload;
    }

    payload.put("isReady", true);
    payload.put("isPlaying", controller.isPlaying());
    payload.put("currentTime", controller.getCurrentPosition() / 1000.0);

    long duration = controller.getDuration();
    payload.put("duration", duration > 0 ? duration / 1000.0 : 0);
    payload.put("playbackState", mapPlaybackState(controller.getPlaybackState()));

    MediaItem current = controller.getCurrentMediaItem();
    if (current != null) {
      payload.put("trackId", current.mediaId);
    }

    lastKnownState = payload;
    return payload;
  }

  private JSObject buildIdleState() {
    JSObject payload = new JSObject();
    payload.put("isReady", false);
    payload.put("isPlaying", false);
    payload.put("currentTime", 0);
    payload.put("duration", 0);
    payload.put("playbackState", "idle");
    return payload;
  }

  private void emitPlaybackState() {
    notifyListeners("playbackStateChanged", createStatePayload());
  }

  private String mapPlaybackState(int state) {
    if (state == Player.STATE_BUFFERING) return "buffering";
    if (state == Player.STATE_READY) return "ready";
    if (state == Player.STATE_ENDED) return "ended";
    return "idle";
  }
}
