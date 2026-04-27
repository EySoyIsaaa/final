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

  private static class AudioFormatInfo {
    Integer bitDepth;
    Integer sampleRate;
    Integer bitrate;
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
    File cacheDir = new File(getContext().getCacheDir(), "audio_cache");
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
        androidState = getContext().checkSelfPermission(Manifest.permission.READ_MEDIA_AUDIO);
    } else {
        androidState = getContext().checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE);
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
      JSArray musicFiles = scanMusicFromMediaStore();
      persistLibrary(musicFiles);
      JSObject result = new JSObject();
      result.put("count", musicFiles.length());
      result.put("success", true);
      call.resolve(result);
    } catch (Exception e) {
      call.reject("Error importing automatic library: " + e.getMessage(), e);
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
      JSArray existing = loadPersistedLibrary();
      for (int i = 0; i < items.length(); i++) {
        JSONObject obj = items.getJSONObject(i);
        String contentUri = obj.optString("contentUri", "");
        if (contentUri == null || contentUri.isEmpty()) {
          continue;
        }
        JSObject track = buildTrackFromUri(Uri.parse(contentUri));
        if (track != null) {
          upsertTrack(existing, track);
        }
      }
      persistLibrary(existing);
      JSObject result = new JSObject();
      result.put("count", existing.length());
      result.put("success", true);
      call.resolve(result);
    } catch (Exception e) {
      call.reject("Error importing manual tracks: " + e.getMessage(), e);
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
      JSArray persisted = loadPersistedLibrary();
      List<JSObject> filtered = new ArrayList<>();
      String normalizedSearch = search == null ? "" : search.trim().toLowerCase();

      for (int i = 0; i < persisted.length(); i++) {
        JSONObject trackJson = persisted.getJSONObject(i);
        JSObject track = new JSObject(trackJson.toString());
        if (normalizedSearch.isEmpty()) {
          filtered.add(track);
          continue;
        }
        String haystack = (
          track.optString("title", "") + " " +
          track.optString("artist", "") + " " +
          track.optString("album", "")
        ).toLowerCase();
        if (haystack.contains(normalizedSearch)) {
          filtered.add(track);
        }
      }

      Comparator<JSObject> comparator = (a, b) -> {
        String left;
        String right;
        if ("artist".equals(sortBy)) {
          left = a.optString("artist", "");
          right = b.optString("artist", "");
        } else if ("dateModified".equals(sortBy)) {
          long la = a.optLong("dateModified", 0L);
          long lb = b.optLong("dateModified", 0L);
          return Long.compare(la, lb);
        } else {
          left = a.optString("title", "");
          right = b.optString("title", "");
        }
        return left.compareToIgnoreCase(right);
      };
      Collections.sort(filtered, comparator);
      if ("desc".equalsIgnoreCase(sortDir)) {
        Collections.reverse(filtered);
      }

      int safePage = Math.max(1, page);
      int safePageSize = Math.max(1, Math.min(500, pageSize));
      int fromIndex = Math.min(filtered.size(), (safePage - 1) * safePageSize);
      int toIndex = Math.min(filtered.size(), fromIndex + safePageSize);

      JSArray records = new JSArray();
      for (int i = fromIndex; i < toIndex; i++) {
        records.put(filtered.get(i));
      }

      JSObject result = new JSObject();
      result.put("page", safePage);
      result.put("pageSize", safePageSize);
      result.put("total", filtered.size());
      result.put("records", records);
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
      JSObject result = getAudioFileUrlInternal(contentUri, trackId, sourceVersionKey, expectedSize);
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
      
      String cacheIdentity = contentUri + "|" + (sourceVersionKey != null ? sourceVersionKey : trackId);
      String cacheHash = sha1(cacheIdentity);

      // Crear archivo en caché
      File cacheDir = getAudioCacheDir();
      File outputFile = new File(cacheDir, "track_" + cacheHash + extension);
      File tempFile = new File(cacheDir, "track_" + cacheHash + extension + ".tmp");
      
      // Si el archivo ya existe en caché, devolverlo directamente
      if (outputFile.exists()) {
        if (outputFile.length() == 0 || (expectedSize != null && expectedSize > 0 && outputFile.length() != expectedSize)) {
          outputFile.delete();
        } else {
        android.util.Log.d("MusicScanner", "✅ Archivo ya en caché: " + outputFile.getAbsolutePath());
        JSObject result = new JSObject();
        result.put("filePath", outputFile.getAbsolutePath());
        result.put("mimeType", mimeType);
        result.put("cached", true);
        return result;
        }
      }
      
      // Copiar archivo desde content:// a caché
      InputStream inputStream = resolver.openInputStream(uri);
      if (inputStream == null) {
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
      result.put("mimeType", mimeType);
      result.put("size", totalBytes);
      result.put("cached", false);
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
      if (cacheDir.exists()) {
        File[] files = cacheDir.listFiles();
        if (files != null) {
          for (File file : files) {
            file.delete();
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
        fileObj.put("dateModified", dateModified);
        fileObj.put("sourceVersionKey", id + ":" + size + ":" + dateModified);
        if (formatInfo.bitDepth != null) fileObj.put("bitDepth", formatInfo.bitDepth);
        if (formatInfo.sampleRate != null) fileObj.put("sampleRate", formatInfo.sampleRate);
        if (formatInfo.bitrate != null) fileObj.put("bitrate", formatInfo.bitrate);
        fileObj.put("isHiRes", isHiRes);

        musicFiles.put(fileObj);
      }
    } finally {
      cursor.close();
    }

    return musicFiles;
  }

  private void persistLibrary(JSArray tracks) throws Exception {
    getContext()
      .getSharedPreferences(LIBRARY_PREFS, android.content.Context.MODE_PRIVATE)
      .edit()
      .putString(LIBRARY_KEY, tracks.toString())
      .apply();
  }

  private JSArray loadPersistedLibrary() throws Exception {
    String raw = getContext()
      .getSharedPreferences(LIBRARY_PREFS, android.content.Context.MODE_PRIVATE)
      .getString(LIBRARY_KEY, "[]");
    return new JSArray(raw != null ? raw : "[]");
  }

  private JSObject findPersistedTrackById(String id) throws Exception {
    JSArray tracks = loadPersistedLibrary();
    for (int i = 0; i < tracks.length(); i++) {
      JSONObject trackJson = tracks.getJSONObject(i);
      JSObject track = new JSObject(trackJson.toString());
      if (id.equals(track.optString("id"))) {
        return track;
      }
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
      fileObj.put("sourceVersionKey", id + ":" + size + ":" + (System.currentTimeMillis() / 1000L));
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
