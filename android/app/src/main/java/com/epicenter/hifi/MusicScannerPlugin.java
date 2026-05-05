package com.epicenter.hifi;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.database.Cursor;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(
  name = "MusicScanner",
  permissions = {
    @Permission(alias = "audio33", strings = { Manifest.permission.READ_MEDIA_AUDIO }),
    @Permission(alias = "audioLegacy", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
  }
)
public class MusicScannerPlugin extends Plugin {
  private static final String LIBRARY_PREFS = "epicenter_library";
  private static final String LIBRARY_KEY = "tracks_v1";

  private volatile String cachedLibraryRaw = null;
  private volatile JSArray cachedLibrary = null;
  private static final String ROOM_MIGRATED_KEY = "room_migrated_v1";
  private static final String LAST_FULL_SCAN_COUNT_KEY = "last_full_scan_count_v1";

  private static class AudioFormatInfo {
    Integer bitDepth;
    Integer sampleRate;
    Integer bitrate;
    Integer channels;
  }

  private AudioFormatInfo getAudioFormatInfo(Uri contentUri) {
    AudioFormatInfo info = new AudioFormatInfo();
    MediaMetadataRetriever retriever = new MediaMetadataRetriever();
    MediaExtractor extractor = new MediaExtractor();

    try {
      retriever.setDataSource(getContext(), contentUri);
      String bitrateValue = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE);
      if (bitrateValue != null && !bitrateValue.isEmpty()) {
        info.bitrate = Integer.parseInt(bitrateValue);
      }
    } catch (Exception ignored) {
    }

    try {
      extractor.setDataSource(getContext(), contentUri, null);
      for (int i = 0; i < extractor.getTrackCount(); i++) {
        MediaFormat format = extractor.getTrackFormat(i);
        String mime = format.getString(MediaFormat.KEY_MIME);
        if (mime == null || !mime.startsWith("audio/")) {
          continue;
        }

        if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
          info.sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE);
        }

        if (info.bitrate == null && format.containsKey(MediaFormat.KEY_BIT_RATE)) {
          info.bitrate = format.getInteger(MediaFormat.KEY_BIT_RATE);
        }
        if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
          info.channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
        }

        if (format.containsKey("bits-per-sample")) {
          info.bitDepth = format.getInteger("bits-per-sample");
        }
        break;
      }
    } catch (Exception ignored) {
    } finally {
      try {
        retriever.release();
      } catch (Exception ignored) {
      }
      try {
        extractor.release();
      } catch (Exception ignored) {
      }
    }

    return info;
  }

  // Directorio de caché para archivos de audio temporales
  private File getAudioCacheDir() {
    File cacheDir = new File(getContext().getFilesDir(), "audio_cache");
    if (!cacheDir.exists()) {
      cacheDir.mkdirs();
    }
    return cacheDir;
  }

  private String getAudioAlias() {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "audio33" : "audioLegacy";
  }

  private boolean hasAudioPermission() {
    String alias = getAudioAlias();
    PermissionState capacitorState = getPermissionState(alias);
    
    int androidState;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        androidState = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_MEDIA_AUDIO);
    } else {
        androidState = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE);
    }
    boolean androidGranted = androidState == android.content.pm.PackageManager.PERMISSION_GRANTED;
    
    return androidGranted || capacitorState == PermissionState.GRANTED;
  }

  @PluginMethod
  public void requestAudioPermissions(PluginCall call) {
    String alias = getAudioAlias();
    android.util.Log.d("MusicScanner", "Solicitando permisos para alias: " + alias);
    
    if (hasAudioPermission()) {
      android.util.Log.d("MusicScanner", "✅ Permiso ya concedido");
      JSObject result = new JSObject();
      result.put("granted", true);
      call.resolve(result);
    } else {
      android.util.Log.d("MusicScanner", "Solicitando permiso al usuario...");
      requestPermissionForAlias(alias, call, "permissionsCallback");
    }
  }

  @PermissionCallback
  public void permissionsCallback(PluginCall call) {
    boolean granted = hasAudioPermission();
    android.util.Log.d("MusicScanner", "Callback de permisos. Granted: " + granted);
    JSObject result = new JSObject();
    result.put("granted", granted);
    call.resolve(result);
  }

  @PluginMethod
  public void checkPermissions(PluginCall call) {
    boolean granted = hasAudioPermission();
    JSObject result = new JSObject();
    result.put("granted", granted);
    call.resolve(result);
  }

  @PluginMethod
  public void scanMusic(PluginCall call) {
    android.util.Log.d("MusicScanner", "==========================================");
    android.util.Log.d("MusicScanner", "scanMusic() llamado!");
    android.util.Log.d("MusicScanner", "==========================================");
    
    if (!hasAudioPermission()) {
      android.util.Log.e("MusicScanner", "❌ Permiso NO concedido");
      call.reject("Permission not granted");
      return;
    }

    android.util.Log.d("MusicScanner", "✅ Permiso concedido, iniciando escaneo...");

    try {
      JSArray musicFiles = scanMusicFromMediaStore();
      android.util.Log.d("MusicScanner", "✅ Escaneo completado. Archivos encontrados: " + musicFiles.length());
      
      JSObject result = new JSObject();
      result.put("files", musicFiles);
      result.put("count", musicFiles.length());
      call.resolve(result);
    } catch (Exception e) {
      android.util.Log.e("MusicScanner", "❌ Error en escaneo: " + e.getMessage());
      e.printStackTrace();
      call.reject("Error scanning music: " + e.getMessage(), e);
    }
  }

  @PluginMethod
  public void importAutomaticLibrary(PluginCall call) {
    if (!hasAudioPermission()) {
      call.reject("Permission not granted");
      return;
    }

    try {
      migrateSharedPrefsToRoomIfNeeded();
      long now = System.currentTimeMillis() / 1000L;
      android.util.Log.i("MusicScanner", "scanStarted");
      JSArray scanned = scanMusicFromMediaStore();
      int scannedCount = scanned.length();
      android.util.Log.i("MusicScanner", "scanFinished scannedCount=" + scannedCount);

      List<TrackEntity> existing = dao().getAll();
      int existingCount = existing.size();
      android.content.SharedPreferences prefs = getContext().getSharedPreferences(LIBRARY_PREFS, android.content.Context.MODE_PRIVATE);
      int lastFullScanCount = prefs.getInt(LAST_FULL_SCAN_COUNT_KEY, -1);
      String scanCompleteness = "complete";
      String completenessReason = "ok";
      if (existingCount > 0) {
        if (scannedCount == 0) {
          scanCompleteness = "partial";
          completenessReason = "empty_scan";
        } else if (scannedCount < Math.ceil(existingCount * 0.5d)) {
          scanCompleteness = "partial";
          completenessReason = "low_vs_existing";
        }
      } else {
        scanCompleteness = "complete";
        completenessReason = "first_scan";
      }
      if ("complete".equals(scanCompleteness) && lastFullScanCount > 0 && scannedCount < Math.ceil(lastFullScanCount * 0.5d)) {
        scanCompleteness = "partial";
        completenessReason = "low_vs_baseline";
      }
      if (scannedCount < 0) {
        scanCompleteness = "partial";
        completenessReason = "inconsistent_scan";
      }
      final String finalScanCompleteness = scanCompleteness;
      Map<String, TrackEntity> byStable = new HashMap<>();
      for (TrackEntity e : existing) byStable.put(e.stableId, e);

      Set<String> seen = new HashSet<>();
      Set<Long> consumedExistingIds = new HashSet<>();
      AtomicInteger added = new AtomicInteger(0), updated = new AtomicInteger(0), preserved = new AtomicInteger(0), missingCandidates = new AtomicInteger(0), unavailableMarked = new AtomicInteger(0);

      AppDatabase.get(getContext()).runInTransaction(() -> {
        for (int i = 0; i < scanned.length(); i++) {
          JSObject scannedObj;
          try {
            scannedObj = new JSObject(scanned.getJSONObject(i).toString());
          } catch (Exception parseErr) {
            continue;
          }
          TrackEntity incoming = toEntity(scannedObj, now);
          TrackEntity old = byStable.get(incoming.stableId);
          if (old == null) {
            for (TrackEntity candidate : existing) {
              if (consumedExistingIds.contains(candidate.id)) continue;
              if (candidate.duration == incoming.duration &&
                candidate.size == incoming.size &&
                incoming.dateModified > 0 &&
                candidate.dateModified == incoming.dateModified &&
                safeEq(candidate.title, incoming.title) &&
                safeEq(candidate.album, incoming.album) &&
                safeEq(candidate.artist, incoming.artist)) {
                old = candidate;
                break;
              }
            }
          }
          if (old != null) {
            incoming.id = old.id;
            incoming.createdAt = old.createdAt;
            consumedExistingIds.add(old.id);
            updated.incrementAndGet();
          } else {
            incoming.createdAt = now;
            added.incrementAndGet();
          }
          incoming.updatedAt = now;
          incoming.lastSeenAt = now;
          incoming.missingCount = 0;
          incoming.missingSince = null;
          incoming.unavailable = false;
          incoming.unavailableReason = null;
          incoming.scanCompleteness = finalScanCompleteness;
          dao().upsert(incoming);
          seen.add(incoming.stableId);
        }

        for (TrackEntity e : existing) {
          if (!seen.contains(e.stableId)) preserved.incrementAndGet();
        }
      });
      if ("complete".equals(scanCompleteness)) {
        prefs.edit().putInt(LAST_FULL_SCAN_COUNT_KEY, scannedCount).apply();
      }

      int count = dao().countAll();
      android.util.Log.i("MusicScanner", "scanStats scannedCount=" + scannedCount + " existingCount=" + existingCount + " lastFullScanCount=" + lastFullScanCount + " syncAdded=" + added.get() + " syncUpdated=" + updated.get() + " syncPreserved=" + preserved.get() + " scanCompleteness=" + scanCompleteness + " reason=" + completenessReason);
      JSObject result = new JSObject();
      result.put("count", count);
      result.put("added", added.get());
      result.put("updated", updated.get());
      result.put("preserved", preserved.get());
      result.put("missingCandidates", missingCandidates.get());
      result.put("unavailableMarked", unavailableMarked.get());
      result.put("scanCompleteness", scanCompleteness);
      result.put("scanCompletenessReason", completenessReason);
      result.put("success", true);
      call.resolve(result);
    } catch (Exception e) {
      android.util.Log.e("MusicScanner", "scanFailed reason=exception, forcing partial", e);
      JSObject result = new JSObject();
      result.put("count", dao().countAll());
      result.put("added", 0);
      result.put("updated", 0);
      result.put("preserved", 0);
      result.put("missingCandidates", 0);
      result.put("unavailableMarked", 0);
      result.put("scanCompleteness", "partial");
      result.put("scanCompletenessReason", "exception");
      result.put("success", false);
      result.put("error", e.getMessage());
      call.resolve(result);
    }
  }

  @PluginMethod
  public void importManualTracks(PluginCall call) {
    JSArray items = call.getArray("items");
    if (items == null || items.length() == 0) {
      call.reject("items is required");
      return;
    }

    try {
      migrateSharedPrefsToRoomIfNeeded();
      long now = System.currentTimeMillis() / 1000L;
      AtomicInteger changed = new AtomicInteger(0);
      AppDatabase.get(getContext()).runInTransaction(() -> {
        for (int i = 0; i < items.length(); i++) {
          JSONObject obj;
          try {
            obj = items.getJSONObject(i);
          } catch (Exception parseErr) {
            continue;
          }
          String contentUri = obj.optString("contentUri", "");
          if (contentUri == null || contentUri.isEmpty()) continue;
          JSObject track = buildTrackFromUri(Uri.parse(contentUri));
          if (track != null) {
            TrackEntity e = toEntity(track, now);
            e.sourceType = "manual-uri";
            e.scanCompleteness = "complete";
            dao().upsert(e);
            changed.incrementAndGet();
          }
        }
      });
      JSObject result = new JSObject();
      result.put("count", dao().countAll());
      result.put("changed", changed.get());
      result.put("success", true);
      call.resolve(result);
    } catch (Exception e) {
      call.reject("Error importing manual tracks: " + e.getMessage(), e);
    }
  }



  @PluginMethod
  public void deleteTrackById(PluginCall call) {
    String id = call.getString("id");
    if (id == null || id.isEmpty()) {
      call.reject("id is required");
      return;
    }

    try {
      migrateSharedPrefsToRoomIfNeeded();
      TrackEntity found = dao().findByAnyId(id);
      if (found != null) dao().deleteByStableId(found.stableId);
      JSObject result = new JSObject();
      result.put("success", true);
      result.put("count", dao().countAll());
      call.resolve(result);
    } catch (Exception e) {
      call.reject("Error deleting track: " + e.getMessage(), e);
    }
  }

  @PluginMethod
  public void clearNativeLibrary(PluginCall call) {
    try {
      migrateSharedPrefsToRoomIfNeeded();
      dao().clearAll();
      JSObject result = new JSObject();
      result.put("success", true);
      result.put("count", 0);
      call.resolve(result);
    } catch (Exception e) {
      call.reject("Error clearing native library: " + e.getMessage(), e);
    }
  }

  @PluginMethod
  public void getLibraryPage(PluginCall call) {
    int page = call.getInt("page", 1);
    int pageSize = call.getInt("pageSize", 100);
    String search = call.getString("search", "");
    String sortBy = call.getString("sortBy", "title");
    String sortDir = call.getString("sortDir", "asc");

    try {
      migrateSharedPrefsToRoomIfNeeded();
      long queryStart = System.currentTimeMillis();
      int safePage = Math.max(1, page);
      int safePageSize = Math.max(1, Math.min(100, pageSize));
      int offset = (safePage - 1) * safePageSize;
      String normalizedSearch = search == null ? "" : search.trim().toLowerCase();
      boolean desc = "desc".equalsIgnoreCase(sortDir);
      List<TrackEntity> pageRecords = desc
        ? dao().getPageDesc(normalizedSearch, sortBy, safePageSize, offset)
        : dao().getPageAsc(normalizedSearch, sortBy, safePageSize, offset);

      JSArray records = new JSArray();
      for (TrackEntity e : pageRecords) records.put(toJs(e));

      JSObject result = new JSObject();
      result.put("page", safePage);
      result.put("pageSize", safePageSize);
      result.put("total", dao().countFiltered(normalizedSearch));
      result.put("records", records);
      result.put("queryTimeMs", System.currentTimeMillis() - queryStart);
      call.resolve(result);
    } catch (Exception e) {
      call.reject("Error querying native library: " + e.getMessage(), e);
    }
  }

  @PluginMethod
  public void getTrackById(PluginCall call) {
    String id = call.getString("id");
    if (id == null || id.isEmpty()) {
      call.reject("id is required");
      return;
    }
    try {
      JSObject track = findPersistedTrackById(id);
      if (track == null) {
        call.reject("Track not found");
        return;
      }
      JSObject result = new JSObject();
      result.put("track", track);
      call.resolve(result);
    } catch (Exception e) {
      call.reject("Error getting track: " + e.getMessage(), e);
    }
  }

  @PluginMethod
  public void getAudioFileUrlById(PluginCall call) {
    String id = call.getString("id");
    if (id == null || id.isEmpty()) {
      call.reject("id is required");
      return;
    }
    try {
      JSObject track = findPersistedTrackById(id);
      if (track == null) {
        call.reject("Track not found");
        return;
      }
      String contentUri = track.optString("contentUri", null);
      if (contentUri == null || contentUri.isEmpty()) {
        call.reject("Track has no contentUri");
        return;
      }

      JSObject result = getAudioFileUrlInternal(
        contentUri,
        id,
        track.optString("sourceVersionKey", id),
        track.has("size") ? track.optLong("size") : null
      );
      call.resolve(result);
    } catch (Exception e) {
      call.reject("Error getting audio by id: " + e.getMessage(), e);
    }
  }

  /**
   * Copia el archivo de audio a la caché y devuelve una URL accesible
   * Este método es más eficiente para archivos grandes (FLAC, WAV, etc.)
   */
  @PluginMethod
  public void getAudioFileUrl(PluginCall call) {
    String contentUri = call.getString("contentUri");
    String trackId = call.getString("trackId");
    String sourceVersionKey = call.getString("sourceVersionKey");
    Long expectedSize = call.getLong("expectedSize");
    
    if (contentUri == null || contentUri.isEmpty()) {
      call.reject("contentUri is required");
      return;
    }
    
    if (trackId == null || trackId.isEmpty()) {
      trackId = String.valueOf(System.currentTimeMillis());
    }

    android.util.Log.d("MusicScanner", "getAudioFileUrl para: " + contentUri);

    try {
      long t0 = System.currentTimeMillis();
      JSObject result = getAudioFileUrlInternal(contentUri, trackId, sourceVersionKey, expectedSize);
      result.put("audioResolveTimeMs", System.currentTimeMillis() - t0);
      call.resolve(result);
    } catch (Exception e) {
      android.util.Log.e("MusicScanner", "❌ Error obteniendo audio: " + e.getMessage());
      e.printStackTrace();
      call.reject("Error getting audio: " + e.getMessage(), e);
    }
  }

  private JSObject getAudioFileUrlInternal(
    String contentUri,
    String trackId,
    String sourceVersionKey,
    Long expectedSize
  ) throws Exception {
      Uri uri = Uri.parse(contentUri);
      ContentResolver resolver = getContext().getContentResolver();
      
      // Obtener el tipo MIME
      String mimeType = resolver.getType(uri);
      if (mimeType == null) {
        mimeType = "audio/mpeg";
      }
      
      // Determinar la extensión del archivo
      String extension = ".mp3";
      if (mimeType.contains("flac")) {
        extension = ".flac";
      } else if (mimeType.contains("wav")) {
        extension = ".wav";
      } else if (mimeType.contains("aiff")) {
        extension = ".aiff";
      } else if (mimeType.contains("m4a") || mimeType.contains("mp4")) {
        extension = ".m4a";
      } else if (mimeType.contains("ogg")) {
        extension = ".ogg";
      }
      
      long resolveStart = System.currentTimeMillis();
      TrackEntity linked = dao().getByStableId(trackId);
      if (linked == null) linked = dao().getByMediaStoreId(trackId);
      if (linked == null) linked = dao().findBySourceUri(contentUri);
      if (linked != null && linked.cachedFilePath != null && !linked.cachedFilePath.isEmpty()) {
        File linkedCache = new File(linked.cachedFilePath);
        if (linkedCache.exists() && linkedCache.length() > 0 && (expectedSize == null || expectedSize <= 0 || linkedCache.length() == expectedSize)) {
          JSObject fast = new JSObject();
          fast.put("filePath", linkedCache.getAbsolutePath());
          fast.put("resolvedUrl", linkedCache.getAbsolutePath() + "?cb=" + System.currentTimeMillis());
          fast.put("mimeType", mimeType);
          fast.put("cached", true);
          fast.put("cacheKey", "linked-fast-path");
          fast.put("resolvedStableId", linked.stableId);
          android.util.Log.i("MusicScanner", "playbackResolvedUrl=" + linkedCache.getAbsolutePath() + " playbackResolveTimeMs=" + (System.currentTimeMillis() - resolveStart));
          return fast;
        }
      }
      if (linked != null && (sourceVersionKey == null || sourceVersionKey.isEmpty())) {
        sourceVersionKey = linked.sourceVersionKey;
      }
      String stableForCache = linked != null ? linked.stableId : sha1(trackId + "|" + contentUri);
      String cacheIdentity = stableForCache + "|" + contentUri + "|" + (sourceVersionKey != null ? sourceVersionKey : trackId);
      String cacheHash = sha1(cacheIdentity);
      android.util.Log.i("MusicScanner", "playbackTrackId=" + trackId + " stableId=" + stableForCache + " sourceUri=" + contentUri + " sourceVersionKey=" + sourceVersionKey + " cacheKey=" + cacheHash + " linkedCachedFilePath=" + (linked != null ? linked.cachedFilePath : ""));

      // Crear archivo en caché
      File cacheDir = getAudioCacheDir();
      File outputFile = new File(cacheDir, "track_" + cacheHash + extension);
      File tempFile = new File(cacheDir, "track_" + cacheHash + extension + ".tmp");
      
      // Si el archivo ya existe en caché, devolverlo directamente
      if (outputFile.exists()) {
        if (linked != null && linked.cachedFilePath != null && !linked.cachedFilePath.isEmpty() && !outputFile.getAbsolutePath().equals(linked.cachedFilePath)) {
          android.util.Log.w("MusicScanner", "audioCacheMismatch stableId=" + linked.stableId + " expected=" + outputFile.getAbsolutePath() + " linked=" + linked.cachedFilePath);
          outputFile.delete();
        }
        if (outputFile.length() == 0 || (expectedSize != null && expectedSize > 0 && outputFile.length() != expectedSize)) {
          outputFile.delete();
        } else {
        android.util.Log.d("MusicScanner", "✅ Archivo ya en caché: " + outputFile.getAbsolutePath());
        JSObject result = new JSObject();
        result.put("filePath", outputFile.getAbsolutePath());
        result.put("resolvedUrl", outputFile.getAbsolutePath() + "?cb=" + System.currentTimeMillis());
        result.put("mimeType", mimeType);
        result.put("cached", true);
        result.put("cacheKey", cacheHash);
        result.put("resolvedStableId", stableForCache);
        if (linked != null) {
          dao().updateCachePaths(linked.stableId, outputFile.getAbsolutePath(), contentUri, System.currentTimeMillis() / 1000L);
        }
        android.util.Log.i("MusicScanner", "playbackResolvedUrl=" + outputFile.getAbsolutePath() + " playbackResolveTimeMs=" + (System.currentTimeMillis() - resolveStart));
        return result;
        }
      }
      
      // Copiar archivo desde content:// a caché (1 retry simple)
      InputStream inputStream = resolver.openInputStream(uri);
      if (inputStream == null) {
        outputFile.delete();
        tempFile.delete();
        inputStream = resolver.openInputStream(uri);
      }
      if (inputStream == null) {
        if (linked != null) dao().markPlaybackError(linked.stableId, true, true, "open_input_stream_failed", System.currentTimeMillis() / 1000L);
        android.util.Log.e("MusicScanner", "playbackErrorReason=open_input_stream_failed stableId=" + stableForCache);
        throw new Exception("Could not open audio file");
      }

      if (tempFile.exists()) {
        tempFile.delete();
      }

      OutputStream outputStream = new FileOutputStream(tempFile);
      byte[] buffer = new byte[8192];
      int bytesRead;
      long totalBytes = 0;
      
      while ((bytesRead = inputStream.read(buffer)) != -1) {
        outputStream.write(buffer, 0, bytesRead);
        totalBytes += bytesRead;
      }
      
      inputStream.close();
      outputStream.close();

      if (totalBytes <= 0) {
        tempFile.delete();
        throw new Exception("Copied file is empty");
      }

      if (expectedSize != null && expectedSize > 0 && totalBytes != expectedSize) {
        tempFile.delete();
        throw new Exception("Copied file size mismatch");
      }

      if (outputFile.exists()) {
        outputFile.delete();
      }

      if (!tempFile.renameTo(outputFile)) {
        tempFile.delete();
        throw new Exception("Could not finalize cached file");
      }

      android.util.Log.d("MusicScanner", "✅ Archivo copiado a caché: " + outputFile.getAbsolutePath() + " (" + totalBytes + " bytes)");

      JSObject result = new JSObject();
      result.put("filePath", outputFile.getAbsolutePath());
      result.put("resolvedUrl", outputFile.getAbsolutePath() + "?cb=" + System.currentTimeMillis());
      result.put("mimeType", mimeType);
      result.put("size", totalBytes);
      result.put("cached", false);
      result.put("cacheKey", cacheHash);
      result.put("resolvedStableId", stableForCache);
      if (linked != null) {
        dao().updateCachePaths(linked.stableId, outputFile.getAbsolutePath(), contentUri, System.currentTimeMillis() / 1000L);
      }
      if (linked != null) dao().markPlaybackError(linked.stableId, false, false, null, System.currentTimeMillis() / 1000L);
      android.util.Log.i("MusicScanner", "playbackResolvedUrl=" + outputFile.getAbsolutePath() + " playbackResolveTimeMs=" + (System.currentTimeMillis() - resolveStart));
      return result;
  }

  private String sha1(String value) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-1");
      byte[] digest = md.digest(value.getBytes());
      StringBuilder sb = new StringBuilder();
      for (byte b : digest) {
        sb.append(String.format("%02x", b));
      }
      return sb.toString();
    } catch (Exception e) {
      return String.valueOf(value.hashCode());
    }
  }

  /**
   * Limpia la caché de archivos de audio
   */
  @PluginMethod
  public void clearAudioCache(PluginCall call) {
    try {
      File cacheDir = getAudioCacheDir();
      android.content.SharedPreferences prefs = getContext().getSharedPreferences(LIBRARY_PREFS, android.content.Context.MODE_PRIVATE);
      String activeProtectedPath = prefs.getString("active_cached_file_path", "");
      String queuedProtectedPath = prefs.getString("next_cached_file_path", "");
      Set<String> protectedCachePaths = new HashSet<>();
      if (activeProtectedPath != null && !activeProtectedPath.isEmpty()) protectedCachePaths.add(activeProtectedPath);
      if (queuedProtectedPath != null && !queuedProtectedPath.isEmpty()) protectedCachePaths.add(queuedProtectedPath);
      for (TrackEntity e : dao().getAll()) {
        if (e.cachedFilePath != null && !e.cachedFilePath.isEmpty()) protectedCachePaths.add(e.cachedFilePath);
        if (e.localUri != null && e.localUri.startsWith("/")) protectedCachePaths.add(e.localUri);
      }
      if (cacheDir.exists()) {
        Set<String> protectedPaths = new HashSet<>();
        String currentPath = call.getString("currentFilePath");
        String nextPath = call.getString("nextFilePath");
        if (currentPath != null && !currentPath.isEmpty()) protectedPaths.add(currentPath);
        if (nextPath != null && !nextPath.isEmpty()) protectedPaths.add(nextPath);
        for (TrackEntity e : dao().getAll()) {
          if (e.cachedFilePath != null && !e.cachedFilePath.isEmpty()) protectedPaths.add(e.cachedFilePath);
          if (e.localUri != null && e.localUri.startsWith("/")) protectedPaths.add(e.localUri);
        }
        File[] files = cacheDir.listFiles();
        if (files != null) {
          for (File file : files) {
            if (!protectedCachePaths.contains(file.getAbsolutePath())) file.delete();
          }
        }
      }
      android.util.Log.d("MusicScanner", "✅ Caché de audio limpiada");
      JSObject result = new JSObject();
      result.put("success", true);
      call.resolve(result);
    } catch (Exception e) {
      call.reject("Error clearing cache: " + e.getMessage(), e);
    }
  }

  /**
   * Obtiene la carátula del álbum como data URL (las imágenes son pequeñas, está bien usar base64)
   */
  @PluginMethod
  public void getAlbumArt(PluginCall call) {
    String albumArtUri = call.getString("albumArtUri");
    if (albumArtUri == null || albumArtUri.isEmpty()) {
      JSObject result = new JSObject();
      result.put("dataUrl", (String) null);
      call.resolve(result);
      return;
    }

    try {
      Uri uri = Uri.parse(albumArtUri);
      ContentResolver resolver = getContext().getContentResolver();
      
      InputStream inputStream = resolver.openInputStream(uri);
      if (inputStream == null) {
        JSObject result = new JSObject();
        result.put("dataUrl", (String) null);
        call.resolve(result);
        return;
      }

      ByteArrayOutputStream byteBuffer = new ByteArrayOutputStream();
      byte[] buffer = new byte[4096];
      int len;
      while ((len = inputStream.read(buffer)) != -1) {
        byteBuffer.write(buffer, 0, len);
      }
      inputStream.close();

      byte[] imageBytes = byteBuffer.toByteArray();
      String base64Image = Base64.encodeToString(imageBytes, Base64.NO_WRAP);
      String dataUrl = "data:image/jpeg;base64," + base64Image;

      JSObject result = new JSObject();
      result.put("dataUrl", dataUrl);
      call.resolve(result);
    } catch (Exception e) {
      android.util.Log.w("MusicScanner", "No se pudo obtener carátula: " + e.getMessage());
      JSObject result = new JSObject();
      result.put("dataUrl", (String) null);
      call.resolve(result);
    }
  }


  private TrackDao dao() {
    return AppDatabase.get(getContext()).trackDao();
  }

  private String stableIdFrom(JSObject track) {
    String mediaStoreId = track.optString("mediaStoreId", track.optString("id", ""));
    String sourceUri = track.optString("contentUri", track.optString("sourceUri", ""));
    return sha1(mediaStoreId + "|" + sourceUri);
  }

  private boolean safeEq(String a, String b) {
    String la = a == null ? "" : a.trim().toLowerCase();
    String lb = b == null ? "" : b.trim().toLowerCase();
    return la.equals(lb);
  }

  private TrackEntity toEntity(JSObject track, long now) {
    TrackEntity e = new TrackEntity();
    e.stableId = stableIdFrom(track);
    e.mediaStoreId = track.optString("mediaStoreId", track.optString("id", null));
    e.sourceUri = track.optString("contentUri", track.optString("sourceUri", null));
    e.localUri = null;
    e.cachedFilePath = null;
    e.title = track.optString("title", track.optString("name", "Unknown"));
    e.artist = track.optString("artist", "Unknown Artist");
    e.album = track.optString("album", "Unknown Album");
    e.duration = track.optLong("duration", 0L);
    e.size = track.optLong("size", 0L);
    e.dateModified = track.optLong("dateModified", 0L);
    e.mimeType = track.optString("mimeType", "audio/mpeg");
    String name = track.optString("name", "");
    int dot = name.lastIndexOf('.');
    e.extension = dot > 0 ? name.substring(dot + 1).toLowerCase() : "";
    e.sourceType = "media-store";
    e.sourceVersionKey = track.optString("sourceVersionKey", (e.mediaStoreId != null ? e.mediaStoreId : "") + ":" + e.size + ":" + e.dateModified);
    if (track.has("albumId")) e.albumId = track.optLong("albumId");
    e.albumArtUri = track.optString("albumArtUri", null);
    if (track.has("bitDepth")) e.bitDepth = track.optInt("bitDepth");
    if (track.has("sampleRate")) e.sampleRate = track.optInt("sampleRate");
    if (track.has("bitrate")) e.bitrate = track.optInt("bitrate");
    if (track.has("channels")) e.channels = track.optInt("channels");
    if (track.has("isHiRes")) e.isHiRes = track.optBoolean("isHiRes");
    e.unavailable = track.optBoolean("unavailable", false);
    e.unavailableReason = track.optString("unavailableReason", null);
    e.lastSeenAt = track.optLong("lastSeenAt", now);
    long ms = track.optLong("missingSince", 0L);
    e.missingSince = ms > 0 ? ms : null;
    e.missingCount = track.optInt("missingCount", 0);
    e.scanCompleteness = track.optString("scanCompleteness", "complete");
    e.createdAt = track.optLong("createdAt", now);
    e.updatedAt = now;
    return e;
  }

  private JSObject toJs(TrackEntity e) {
    JSObject o = new JSObject();
    o.put("id", e.mediaStoreId != null ? e.mediaStoreId : e.stableId);
    o.put("stableId", e.stableId);
    o.put("mediaStoreId", e.mediaStoreId);
    o.put("contentUri", e.sourceUri);
    o.put("sourceUri", e.sourceUri);
    o.put("name", e.title);
    o.put("title", e.title);
    o.put("artist", e.artist);
    o.put("album", e.album);
    o.put("duration", e.duration);
    o.put("size", e.size);
    o.put("mimeType", e.mimeType);
    o.put("dateModified", e.dateModified);
    o.put("sourceVersionKey", e.sourceVersionKey);
    o.put("albumId", e.albumId);
    if (e.albumArtUri != null && !e.albumArtUri.isEmpty()) {
      o.put("albumArtUri", e.albumArtUri);
    } else if (e.albumId != null && e.albumId > 0) {
      o.put("albumArtUri", "content://media/external/audio/albumart/" + e.albumId);
    } else {
      o.put("albumArtUri", (String) null);
    }
    if (e.bitDepth != null) o.put("bitDepth", e.bitDepth);
    if (e.sampleRate != null) o.put("sampleRate", e.sampleRate);
    if (e.bitrate != null) o.put("bitrate", e.bitrate);
    if (e.channels != null) o.put("channels", e.channels);
    if (e.isHiRes != null) o.put("isHiRes", e.isHiRes);
    o.put("unavailable", e.unavailable);
    o.put("unavailableReason", e.unavailableReason);
    o.put("lastSeenAt", e.lastSeenAt);
    o.put("missingSince", e.missingSince != null ? e.missingSince : 0);
    o.put("missingCount", e.missingCount);
    o.put("scanCompleteness", e.scanCompleteness);
    return o;
  }

  private synchronized void migrateSharedPrefsToRoomIfNeeded() {
    android.content.SharedPreferences prefs = getContext().getSharedPreferences(LIBRARY_PREFS, android.content.Context.MODE_PRIVATE);
    if (prefs.getBoolean(ROOM_MIGRATED_KEY, false)) return;
    try {
      android.util.Log.i("MusicScanner", "migrationStarted");
      JSArray old = loadLegacySharedPrefsLibrary();
      int oldCount = old.length();
      android.util.Log.i("MusicScanner", "oldTracksCount=" + oldCount);
      long now = System.currentTimeMillis() / 1000L;
      List<TrackEntity> entities = new java.util.ArrayList<>();
      for (int i = 0; i < old.length(); i++) entities.add(toEntity(new JSObject(old.getJSONObject(i).toString()), now));
      AppDatabase db = AppDatabase.get(getContext());
      db.runInTransaction(() -> {
        if (!entities.isEmpty()) dao().upsertAll(entities);
      });
      int migrated = dao().countAll();
      android.util.Log.i("MusicScanner", "migratedCount=" + migrated);
      if (oldCount > 0 && migrated < oldCount) {
        android.util.Log.e("MusicScanner", "migrationFailed: migratedCount < oldTracksCount");
        return;
      }
      prefs.edit().putBoolean(ROOM_MIGRATED_KEY, true).apply();
      android.util.Log.i("MusicScanner", "migrationCompleted");
    } catch (Exception e) {
      android.util.Log.e("MusicScanner", "migrationFailed", e);
    }
  }

  private JSArray scanMusicFromMediaStore() {
    JSArray musicFiles = new JSArray();
    ContentResolver resolver = getContext().getContentResolver();

    Uri collection;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
    } else {
      collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
    }

    String[] projection = {
      MediaStore.Audio.Media._ID,
      MediaStore.Audio.Media.DISPLAY_NAME,
      MediaStore.Audio.Media.TITLE,
      MediaStore.Audio.Media.ARTIST,
      MediaStore.Audio.Media.ALBUM,
      MediaStore.Audio.Media.DURATION,
      MediaStore.Audio.Media.SIZE,
      MediaStore.Audio.Media.MIME_TYPE,
      MediaStore.Audio.Media.ALBUM_ID,
      MediaStore.Audio.Media.DATE_MODIFIED
    };

    // NO filtrar por IS_MUSIC para incluir archivos Hi-Res
    String selection = null;
    String sortOrder = MediaStore.Audio.Media.TITLE + " ASC";

    Cursor cursor = resolver.query(collection, projection, selection, null, sortOrder);

    if (cursor == null) {
      return musicFiles;
    }

    if (cursor.getCount() == 0) {
      cursor.close();
      return musicFiles;
    }

    try {
      int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
      int nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
      int titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
      int artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
      int albumColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
      int durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
      int sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE);
      int mimeColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE);
      int albumIdColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID);
      int dateModifiedColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_MODIFIED);

      while (cursor.moveToNext()) {
        long id = cursor.getLong(idColumn);
        String name = cursor.getString(nameColumn);
        String title = cursor.getString(titleColumn);
        String artist = cursor.getString(artistColumn);
        String album = cursor.getString(albumColumn);
        long duration = cursor.getLong(durationColumn);
        long size = cursor.getLong(sizeColumn);
        String mimeType = cursor.getString(mimeColumn);
        long albumId = cursor.getLong(albumIdColumn);
        long dateModified = cursor.getLong(dateModifiedColumn);

        // Filtrar solo archivos de audio válidos
        if (mimeType == null || !mimeType.startsWith("audio/")) {
          continue;
        }

        Uri contentUri = ContentUris.withAppendedId(collection, id);
        Uri albumArtUri = ContentUris.withAppendedId(
          Uri.parse("content://media/external/audio/albumart"),
          albumId
        );
        AudioFormatInfo formatInfo = getAudioFormatInfo(contentUri);

        // Detectar si es Hi-Res basado en el formato
        boolean isHiRes = false;
        if (formatInfo.bitDepth != null && formatInfo.sampleRate != null) {
          isHiRes = formatInfo.bitDepth >= 16 && formatInfo.sampleRate >= 44100;
        } else if (mimeType != null) {
          isHiRes = mimeType.contains("flac") || 
                    mimeType.contains("wav") || 
                    mimeType.contains("aiff") ||
                    mimeType.contains("alac") ||
                    mimeType.contains("dsd");
        }

        JSObject fileObj = new JSObject();
        fileObj.put("id", String.valueOf(id));
        fileObj.put("name", name != null ? name : "Unknown");
        fileObj.put("title", title != null && !title.isEmpty() ? title : (name != null ? name : "Unknown"));
        fileObj.put("artist", artist != null && !artist.isEmpty() ? artist : "Unknown Artist");
        fileObj.put("album", album != null && !album.isEmpty() ? album : "Unknown Album");
        fileObj.put("duration", duration / 1000);
        fileObj.put("size", size);
        fileObj.put("mimeType", mimeType != null ? mimeType : "audio/mpeg");
        fileObj.put("contentUri", contentUri.toString());
        fileObj.put("albumArtUri", albumArtUri.toString());
        fileObj.put("albumId", albumId);
        fileObj.put("dateModified", dateModified);
        fileObj.put("sourceVersionKey", id + ":" + size + ":" + dateModified);
        if (formatInfo.bitDepth != null) fileObj.put("bitDepth", formatInfo.bitDepth);
        if (formatInfo.sampleRate != null) fileObj.put("sampleRate", formatInfo.sampleRate);
        if (formatInfo.bitrate != null) fileObj.put("bitrate", formatInfo.bitrate);
        if (formatInfo.channels != null) fileObj.put("channels", formatInfo.channels);
        fileObj.put("isHiRes", isHiRes);

        musicFiles.put(fileObj);
      }
    } finally {
      cursor.close();
    }

    return musicFiles;
  }

  private void persistLibrary(JSArray tracks) throws Exception {
    migrateSharedPrefsToRoomIfNeeded();
    long now = System.currentTimeMillis() / 1000L;
    List<TrackEntity> entities = new ArrayList<>();
    for (int i = 0; i < tracks.length(); i++) {
      entities.add(toEntity(new JSObject(tracks.getJSONObject(i).toString()), now));
    }
    if (!entities.isEmpty()) dao().upsertAll(entities);
  }

  private JSArray loadPersistedLibrary() throws Exception {
    migrateSharedPrefsToRoomIfNeeded();
    List<TrackEntity> entities = dao().getAll();
    if (!entities.isEmpty()) {
      JSArray out = new JSArray();
      for (TrackEntity e : entities) out.put(toJs(e));
      return out;
    }
    return loadLegacySharedPrefsLibrary();
  }

  private JSArray loadLegacySharedPrefsLibrary() throws Exception {
    String raw = getContext()
      .getSharedPreferences(LIBRARY_PREFS, android.content.Context.MODE_PRIVATE)
      .getString(LIBRARY_KEY, "[]");
    String safeRaw = raw != null ? raw : "[]";
    return new JSArray(safeRaw);
  }

  private JSObject findPersistedTrackById(String id) throws Exception {
    migrateSharedPrefsToRoomIfNeeded();
    TrackEntity entity = dao().findByAnyId(id);
    if (entity != null) return toJs(entity);
    JSArray tracks = loadLegacySharedPrefsLibrary();
    for (int i = 0; i < tracks.length(); i++) {
      JSONObject trackJson = tracks.getJSONObject(i);
      JSObject track = new JSObject(trackJson.toString());
      if (id.equals(track.optString("id"))) return track;
    }
    return null;
  }

  private void upsertTrack(JSArray list, JSObject track) throws Exception {
    String id = track.optString("id", "");
    if (id.isEmpty()) {
      return;
    }
    for (int i = 0; i < list.length(); i++) {
      JSONObject existingJson = list.getJSONObject(i);
      JSObject existing = new JSObject(existingJson.toString());
      if (id.equals(existing.optString("id"))) {
        list.put(i, track);
        return;
      }
    }
    list.put(track);
  }

  private JSObject buildTrackFromUri(Uri uri) {
    try {
      ContentResolver resolver = getContext().getContentResolver();
      String mimeType = resolver.getType(uri);
      if (mimeType == null) mimeType = "audio/mpeg";

      String displayName = "Unknown";
      long size = 0L;
      Cursor cursor = resolver.query(uri, new String[]{
        MediaStore.MediaColumns.DISPLAY_NAME,
        MediaStore.MediaColumns.SIZE
      }, null, null, null);
      if (cursor != null) {
        try {
          if (cursor.moveToFirst()) {
            int nameIdx = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME);
            int sizeIdx = cursor.getColumnIndex(MediaStore.MediaColumns.SIZE);
            if (nameIdx >= 0) displayName = cursor.getString(nameIdx);
            if (sizeIdx >= 0) size = cursor.getLong(sizeIdx);
          }
        } finally {
          cursor.close();
        }
      }

      AudioFormatInfo formatInfo = getAudioFormatInfo(uri);
      JSObject fileObj = new JSObject();
      String id = sha1(uri.toString());
      fileObj.put("id", id);
      fileObj.put("name", displayName);
      fileObj.put("title", displayName);
      fileObj.put("artist", "Unknown Artist");
      fileObj.put("album", "Unknown Album");
      fileObj.put("duration", 0);
      fileObj.put("size", size);
      fileObj.put("mimeType", mimeType);
      fileObj.put("contentUri", uri.toString());
      fileObj.put("dateModified", System.currentTimeMillis() / 1000L);
      fileObj.put("sourceVersionKey", id + ":" + size + ":" + fileObj.optLong("dateModified", 0L));
      if (formatInfo.bitDepth != null) fileObj.put("bitDepth", formatInfo.bitDepth);
      if (formatInfo.sampleRate != null) fileObj.put("sampleRate", formatInfo.sampleRate);
      if (formatInfo.bitrate != null) fileObj.put("bitrate", formatInfo.bitrate);
      fileObj.put("isHiRes", isHiResByMetadata(formatInfo, mimeType));
      return fileObj;
    } catch (Exception e) {
      return null;
    }
  }

  private boolean isHiResByMetadata(AudioFormatInfo formatInfo, String mimeType) {
    if (formatInfo != null && formatInfo.bitDepth != null && formatInfo.sampleRate != null) {
      return formatInfo.bitDepth >= 16 && formatInfo.sampleRate >= 44100;
    }
    if (mimeType == null) return false;
    return mimeType.contains("flac") ||
      mimeType.contains("wav") ||
      mimeType.contains("aiff") ||
      mimeType.contains("alac") ||
      mimeType.contains("dsd");
  }
}
