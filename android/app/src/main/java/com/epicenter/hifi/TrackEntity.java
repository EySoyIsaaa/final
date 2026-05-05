package com.epicenter.hifi;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.Index;
import androidx.room.PrimaryKey;

@Entity(
  tableName = "tracks",
  indices = {
    @Index(value = {"stableId"}, unique = true),
    @Index(value = {"mediaStoreId"}),
    @Index(value = {"sourceUri"}),
    @Index(value = {"title"}),
    @Index(value = {"artist"}),
    @Index(value = {"album"}),
    @Index(value = {"dateModified"}),
    @Index(value = {"unavailable"}),
    @Index(value = {"lastSeenAt"})
  }
)
public class TrackEntity {
  @PrimaryKey(autoGenerate = true)
  public long id;
  @NonNull public String stableId = "";
  public String mediaStoreId;
  public String sourceUri;
  public String localUri;
  public String cachedFilePath;
  public String title;
  public String artist;
  public String album;
  public long duration;
  public long size;
  public long dateModified;
  public String mimeType;
  public String extension;
  public String sourceType;
  public String sourceVersionKey;
  public Long albumId;
  public String albumArtUri;
  public Integer bitDepth;
  public Integer sampleRate;
  public Integer bitrate;
  public Integer channels;
  public Boolean isHiRes;
  public boolean unavailable;
  public String unavailableReason;
  public boolean playbackError;
  public boolean requiresResync;
  public String playbackErrorReason;
  public long lastSeenAt;
  public Long missingSince;
  public int missingCount;
  public String scanCompleteness;
  public long createdAt;
  public long updatedAt;
}
