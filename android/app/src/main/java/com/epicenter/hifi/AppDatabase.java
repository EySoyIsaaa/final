package com.epicenter.hifi;

import android.content.Context;

import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;

@Database(entities = {TrackEntity.class}, version = 1, exportSchema = false)
public abstract class AppDatabase extends RoomDatabase {
  public abstract TrackDao trackDao();

  private static volatile AppDatabase INSTANCE;

  public static AppDatabase get(Context context) {
    if (INSTANCE == null) {
      synchronized (AppDatabase.class) {
        if (INSTANCE == null) {
          INSTANCE = Room.databaseBuilder(context.getApplicationContext(), AppDatabase.class, "epicenter_native_library.db")
            .fallbackToDestructiveMigration()
            .build();
        }
      }
    }
    return INSTANCE;
  }
}
