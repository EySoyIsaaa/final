/**
 * Epicenter Hi-Fi - Persistent Music Library
 * Guarda los archivos de audio, metadatos y playlists en IndexedDB
 * 
 * v1.1.2 - Added playlists support with track ID references
 */

const DB_NAME = 'epicenter-music-db';
const DB_VERSION = 4; // v4 adds robust source identity metadata
const TRACKS_STORE = 'tracks';
const AUDIO_STORE = 'audio-files';
const PLAYLISTS_STORE = 'playlists';

export interface StoredTrackMetadata {
  id: string;
  title: string;
  artist: string;
  duration: number;
  bitDepth?: number;
  sampleRate?: number;
  bitrate?: number;
  isHiRes?: boolean;
  coverBase64?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  addedAt: number;
  sourceUri?: string;
  sourceType?: 'file' | 'media-store';
  albumArtUri?: string;
  mediaStoreId?: string;
  dateModified?: number;
  sourceVersionKey?: string;
  unavailable?: boolean;
  lastValidatedAt?: number;
  // For duplicate detection
  fingerprint?: string; // fileName + fileSize combination
}

export interface StoredPlaylist {
  id: string;
  name: string;
  trackIds: string[]; // Only references to track IDs
  createdAt: number;
  updatedAt: number;
  coverUrl?: string; // First track's cover or custom
}

class MusicLibraryDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Error opening IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[MusicLibraryDB] Database initialized v4');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Store para metadatos de tracks
        if (!db.objectStoreNames.contains(TRACKS_STORE)) {
          const tracksStore = db.createObjectStore(TRACKS_STORE, { keyPath: 'id' });
          tracksStore.createIndex('title', 'title', { unique: false });
          tracksStore.createIndex('artist', 'artist', { unique: false });
          tracksStore.createIndex('addedAt', 'addedAt', { unique: false });
          tracksStore.createIndex('fingerprint', 'fingerprint', { unique: false });
          tracksStore.createIndex('sourceUri', 'sourceUri', { unique: false });
          tracksStore.createIndex('mediaStoreId', 'mediaStoreId', { unique: false });
        } else {
          // Add missing indexes on upgrade
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const tracksStore = transaction.objectStore(TRACKS_STORE);
            if (!tracksStore.indexNames.contains('fingerprint')) {
              tracksStore.createIndex('fingerprint', 'fingerprint', { unique: false });
            }
            if (!tracksStore.indexNames.contains('sourceUri')) {
              tracksStore.createIndex('sourceUri', 'sourceUri', { unique: false });
            }
            if (!tracksStore.indexNames.contains('mediaStoreId')) {
              tracksStore.createIndex('mediaStoreId', 'mediaStoreId', { unique: false });
            }
          }
        }

        // Store para archivos de audio (Blobs)
        if (!db.objectStoreNames.contains(AUDIO_STORE)) {
          db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
        }

        // Store para playlists (NEW in v3)
        if (!db.objectStoreNames.contains(PLAYLISTS_STORE)) {
          const playlistsStore = db.createObjectStore(PLAYLISTS_STORE, { keyPath: 'id' });
          playlistsStore.createIndex('name', 'name', { unique: false });
          playlistsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private async getDB(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  // Generate fingerprint for duplicate detection
  generateFingerprint(
    fileName: string,
    fileSize: number,
    options?: {
      duration?: number;
      artist?: string;
      title?: string;
      sourceType?: 'file' | 'media-store';
      mediaStoreId?: string;
    }
  ): string {
    const normalizedName = fileName.toLowerCase().trim();
    const normalizedArtist = (options?.artist || '').toLowerCase().trim();
    const normalizedTitle = (options?.title || '').toLowerCase().trim();
    const normalizedDuration = Math.round((options?.duration || 0) * 10) / 10;
    const sourceType = options?.sourceType || 'file';
    const mediaStorePart = options?.mediaStoreId ? `_${options.mediaStoreId}` : '';
    return `${sourceType}${mediaStorePart}_${normalizedName}_${fileSize}_${normalizedDuration}_${normalizedArtist}_${normalizedTitle}`;
  }

  // Check if track already exists by fingerprint
  async findTrackByFingerprint(fingerprint: string): Promise<StoredTrackMetadata | null> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(TRACKS_STORE, 'readonly');
        const store = transaction.objectStore(TRACKS_STORE);
        
        // Check if fingerprint index exists
        if (!store.indexNames.contains('fingerprint')) {
          console.warn('[MusicLibraryDB] fingerprint index not found, searching all tracks');
          // Fallback: search all tracks manually
          const request = store.getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const tracks = request.result as StoredTrackMetadata[];
            const found = tracks.find(t => t.fingerprint === fingerprint);
            resolve(found || null);
          };
          return;
        }
        
        const index = store.index('fingerprint');
        const request = index.get(fingerprint);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          resolve(request.result || null);
        };
      } catch (error) {
        console.error('[MusicLibraryDB] Error in findTrackByFingerprint:', error);
        resolve(null);
      }
    });
  }

  // Guardar un track completo (metadatos + archivo de audio)
  async saveTrack(
    id: string,
    metadata: Omit<StoredTrackMetadata, 'id'>,
    audioBlob: Blob
  ): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACKS_STORE, AUDIO_STORE], 'readwrite');
      
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      // Guardar metadatos
      const tracksStore = transaction.objectStore(TRACKS_STORE);
      tracksStore.put({ id, ...metadata });

      // Guardar archivo de audio
      const audioStore = transaction.objectStore(AUDIO_STORE);
      audioStore.put({ id, blob: audioBlob });
    });
  }

  // Guardar un track solo con metadatos (sin duplicar el audio)
  async saveTrackReference(
    id: string,
    metadata: Omit<StoredTrackMetadata, 'id'>
  ): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TRACKS_STORE, 'readwrite');

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      const tracksStore = transaction.objectStore(TRACKS_STORE);
      tracksStore.put({ id, ...metadata });
    });
  }

  // Obtener todos los metadatos de tracks
  async getAllTrackMetadata(): Promise<StoredTrackMetadata[]> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TRACKS_STORE, 'readonly');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tracks = request.result.sort((a, b) => b.addedAt - a.addedAt);
        resolve(tracks);
      };
    });
  }

  // Obtener el archivo de audio de un track
  async getAudioBlob(id: string): Promise<Blob | null> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(AUDIO_STORE, 'readonly');
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result?.blob || null);
      };
    });
  }

  // Eliminar un track
  async deleteTrack(id: string): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACKS_STORE, AUDIO_STORE], 'readwrite');
      
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      transaction.objectStore(TRACKS_STORE).delete(id);
      transaction.objectStore(AUDIO_STORE).delete(id);
    });
  }

  // Limpiar toda la biblioteca
  async clearAll(): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACKS_STORE, AUDIO_STORE, PLAYLISTS_STORE], 'readwrite');
      
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      transaction.objectStore(TRACKS_STORE).clear();
      transaction.objectStore(AUDIO_STORE).clear();
      transaction.objectStore(PLAYLISTS_STORE).clear();
    });
  }

  // ==================== PLAYLIST METHODS ====================

  // Create a new playlist
  async createPlaylist(name: string): Promise<StoredPlaylist> {
    const db = await this.getDB();
    const playlist: StoredPlaylist = {
      id: `playlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PLAYLISTS_STORE, 'readwrite');
      const store = transaction.objectStore(PLAYLISTS_STORE);
      const request = store.add(playlist);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(playlist);
    });
  }

  // Get all playlists
  async getAllPlaylists(): Promise<StoredPlaylist[]> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PLAYLISTS_STORE, 'readonly');
      const store = transaction.objectStore(PLAYLISTS_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const playlists = request.result.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(playlists);
      };
    });
  }

  // Get a single playlist by ID
  async getPlaylist(id: string): Promise<StoredPlaylist | null> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PLAYLISTS_STORE, 'readonly');
      const store = transaction.objectStore(PLAYLISTS_STORE);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  // Update playlist
  async updatePlaylist(playlist: StoredPlaylist): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PLAYLISTS_STORE, 'readwrite');
      const store = transaction.objectStore(PLAYLISTS_STORE);
      const request = store.put({ ...playlist, updatedAt: Date.now() });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Delete playlist
  async deletePlaylist(id: string): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PLAYLISTS_STORE, 'readwrite');
      const store = transaction.objectStore(PLAYLISTS_STORE);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Add track to playlist
  async addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) throw new Error('Playlist not found');

    if (!playlist.trackIds.includes(trackId)) {
      playlist.trackIds.push(trackId);
      await this.updatePlaylist(playlist);
    }
  }

  // Remove track from playlist
  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) throw new Error('Playlist not found');

    playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
    await this.updatePlaylist(playlist);
  }

  // Rename playlist
  async renamePlaylist(id: string, newName: string): Promise<void> {
    const playlist = await this.getPlaylist(id);
    if (!playlist) throw new Error('Playlist not found');

    playlist.name = newName;
    await this.updatePlaylist(playlist);
  }

  // Remove deleted tracks from all playlists
  async cleanupPlaylistReferences(deletedTrackId: string): Promise<void> {
    const playlists = await this.getAllPlaylists();
    
    for (const playlist of playlists) {
      if (playlist.trackIds.includes(deletedTrackId)) {
        playlist.trackIds = playlist.trackIds.filter(id => id !== deletedTrackId);
        await this.updatePlaylist(playlist);
      }
    }
  }
}

// Singleton instance
export const musicLibraryDB = new MusicLibraryDB();

// Helper para convertir imagen a base64
export async function imageToBase64(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

// Helper para convertir File a Blob (para guardar en IndexedDB)
export function fileToBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const blob = new Blob([reader.result as ArrayBuffer], { type: file.type });
      resolve(blob);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// Helper para crear File desde Blob
export function blobToFile(blob: Blob, fileName: string, fileType: string): File {
  return new File([blob], fileName, { type: fileType });
}

export default musicLibraryDB;
