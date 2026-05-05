package com.epicenter.hifi;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;

import java.util.List;

@Dao
public interface TrackDao {
  @Insert(onConflict = OnConflictStrategy.REPLACE)
  long upsert(TrackEntity track);

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  List<Long> upsertAll(List<TrackEntity> tracks);

  @Query("SELECT * FROM tracks WHERE stableId = :stableId LIMIT 1")
  TrackEntity getByStableId(String stableId);

  @Query("SELECT * FROM tracks WHERE mediaStoreId = :mediaStoreId LIMIT 1")
  TrackEntity getByMediaStoreId(String mediaStoreId);

  @Query("SELECT * FROM tracks WHERE sourceUri = :sourceUri LIMIT 1")
  TrackEntity getBySourceUri(String sourceUri);

  @Query("SELECT COUNT(*) FROM tracks")
  int countAll();

  @Query("SELECT COUNT(*) FROM tracks WHERE (:query = '' OR title LIKE '%' || :query || '%' OR artist LIKE '%' || :query || '%' OR album LIKE '%' || :query || '%')")
  int countFiltered(String query);

  @Query("SELECT * FROM tracks WHERE (:query = '' OR title LIKE '%' || :query || '%' OR artist LIKE '%' || :query || '%' OR album LIKE '%' || :query || '%') ORDER BY CASE WHEN :sortBy='artist' THEN artist WHEN :sortBy='dateModified' THEN dateModified ELSE title END COLLATE NOCASE ASC LIMIT :limit OFFSET :offset")
  List<TrackEntity> getPageAsc(String query, String sortBy, int limit, int offset);

  @Query("SELECT * FROM tracks WHERE (:query = '' OR title LIKE '%' || :query || '%' OR artist LIKE '%' || :query || '%' OR album LIKE '%' || :query || '%') ORDER BY CASE WHEN :sortBy='artist' THEN artist WHEN :sortBy='dateModified' THEN dateModified ELSE title END COLLATE NOCASE DESC LIMIT :limit OFFSET :offset")
  List<TrackEntity> getPageDesc(String query, String sortBy, int limit, int offset);

  @Query("SELECT * FROM tracks WHERE stableId = :id OR mediaStoreId = :id OR sourceUri = :id LIMIT 1")
  TrackEntity findByAnyId(String id);

  @Query("SELECT * FROM tracks WHERE sourceUri = :sourceUri LIMIT 1")
  TrackEntity findBySourceUri(String sourceUri);

  @Query("UPDATE tracks SET cachedFilePath = :cachedFilePath, localUri = :localUri, updatedAt = :now WHERE stableId = :stableId")
  void updateCachePaths(String stableId, String cachedFilePath, String localUri, long now);

  @Query("UPDATE tracks SET playbackError = :playbackError, requiresResync = :requiresResync, playbackErrorReason = :reason, updatedAt = :now WHERE stableId = :stableId")
  void markPlaybackError(String stableId, boolean playbackError, boolean requiresResync, String reason, long now);

  @Query("UPDATE tracks SET missingCount = missingCount + 1, missingSince = CASE WHEN missingSince IS NULL OR missingSince=0 THEN :now ELSE missingSince END, scanCompleteness=:scanCompleteness, updatedAt=:now WHERE stableId = :stableId")
  void markMissing(String stableId, long now, String scanCompleteness);

  @Query("UPDATE tracks SET unavailable = :unavailable, unavailableReason = :reason, updatedAt=:now WHERE stableId = :stableId")
  void markUnavailable(String stableId, boolean unavailable, String reason, long now);

  @Query("UPDATE tracks SET missingCount = 0, missingSince = NULL, unavailable = 0, unavailableReason = NULL, lastSeenAt = :now, scanCompleteness = :scanCompleteness, updatedAt=:now WHERE stableId = :stableId")
  void resetMissingState(String stableId, long now, String scanCompleteness);

  @Query("SELECT * FROM tracks")
  List<TrackEntity> getAll();

  @Query("DELETE FROM tracks WHERE stableId = :stableId")
  void deleteByStableId(String stableId);

  @Query("DELETE FROM tracks")
  void clearAll();
}
