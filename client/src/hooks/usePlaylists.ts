/**
 * usePlaylists - Hook para gestión de playlists
 * Persiste en IndexedDB, solo guarda referencias a IDs de canciones
 * 
 * v1.1.2
 */

import { useState, useEffect, useCallback } from 'react';
import { musicLibraryDB, type StoredPlaylist } from '@/lib/musicLibraryDB';
import type { Track } from './useAudioQueue';

export interface Playlist extends StoredPlaylist {
  tracks: Track[]; // Resolved tracks from IDs
}

export interface PlaylistController {
  playlists: Playlist[];
  isLoading: boolean;
  createPlaylist: (name: string) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  renamePlaylist: (id: string, newName: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  getPlaylistTracks: (playlistId: string) => Track[];
  refreshPlaylists: () => Promise<void>;
}

export function usePlaylists(library: Track[]): PlaylistController {
  const [storedPlaylists, setStoredPlaylists] = useState<StoredPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load playlists from IndexedDB
  const loadPlaylists = useCallback(async () => {
    try {
      setIsLoading(true);
      const loaded = await musicLibraryDB.getAllPlaylists();
      setStoredPlaylists(loaded);
      console.log(`[Playlists] Loaded ${loaded.length} playlists`);
    } catch (error) {
      console.error('[Playlists] Error loading playlists:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  // Resolve track IDs to actual Track objects
  const resolveTracks = useCallback((trackIds: string[]): Track[] => {
    const libraryMap = new Map(library.map(t => [t.id, t]));
    return trackIds
      .map(id => libraryMap.get(id))
      .filter((t): t is Track => t !== undefined);
  }, [library]);

  // Get playlists with resolved tracks
  const playlists: Playlist[] = storedPlaylists.map(sp => ({
    ...sp,
    tracks: resolveTracks(sp.trackIds),
  }));

  const createPlaylist = useCallback(async (name: string): Promise<Playlist> => {
    const stored = await musicLibraryDB.createPlaylist(name);
    setStoredPlaylists(prev => [stored, ...prev]);
    return { ...stored, tracks: [] };
  }, []);

  const deletePlaylist = useCallback(async (id: string): Promise<void> => {
    await musicLibraryDB.deletePlaylist(id);
    setStoredPlaylists(prev => prev.filter(p => p.id !== id));
  }, []);

  const renamePlaylist = useCallback(async (id: string, newName: string): Promise<void> => {
    await musicLibraryDB.renamePlaylist(id, newName);
    setStoredPlaylists(prev => prev.map(p => 
      p.id === id ? { ...p, name: newName, updatedAt: Date.now() } : p
    ));
  }, []);

  const addTrackToPlaylist = useCallback(async (playlistId: string, trackId: string): Promise<void> => {
    await musicLibraryDB.addTrackToPlaylist(playlistId, trackId);
    setStoredPlaylists(prev => prev.map(p => {
      if (p.id === playlistId && !p.trackIds.includes(trackId)) {
        return { ...p, trackIds: [...p.trackIds, trackId], updatedAt: Date.now() };
      }
      return p;
    }));
  }, []);

  const removeTrackFromPlaylist = useCallback(async (playlistId: string, trackId: string): Promise<void> => {
    await musicLibraryDB.removeTrackFromPlaylist(playlistId, trackId);
    setStoredPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        return { ...p, trackIds: p.trackIds.filter(id => id !== trackId), updatedAt: Date.now() };
      }
      return p;
    }));
  }, []);

  const getPlaylistTracks = useCallback((playlistId: string): Track[] => {
    const playlist = playlists.find(p => p.id === playlistId);
    return playlist?.tracks || [];
  }, [playlists]);

  const refreshPlaylists = useCallback(async (): Promise<void> => {
    await loadPlaylists();
  }, [loadPlaylists]);

  return {
    playlists,
    isLoading,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    getPlaylistTracks,
    refreshPlaylists,
  };
}

export default usePlaylists;
