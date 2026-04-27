/**
 * Epicenter Hi-Fi - Audio Queue & Library Hook
 * Con persistencia en IndexedDB para que la música no se pierda
 * 
 * v1.1.2 - Added duplicate detection
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import * as mm from 'music-metadata';
import { 
  musicLibraryDB, 
  fileToBlob, 
  blobToFile,
  type StoredTrackMetadata 
} from '@/lib/musicLibraryDB';
import type { AndroidMusicFile } from '@/hooks/useAndroidMusicLibrary';
import { isHiResQuality } from '@shared/audioQuality';
import { logger } from "@/lib/logger";

export interface Track {
  id: string;
  sourceTrackId?: string; // ID real en biblioteca cuando la cola usa IDs temporales
  file?: File;
  isEphemeral?: boolean; // Disponible solo en esta sesión (fallback si falla IndexedDB)
  fileName?: string;
  fileType?: string;
  title: string;
  artist: string;
  duration: number;
  coverUrl?: string;
  bitDepth?: number;
  sampleRate?: number;
  bitrate?: number;
  isHiRes?: boolean;
  sourceUri?: string;
  sourceType?: 'file' | 'media-store';
  albumArtUri?: string;
  mediaStoreId?: string;
  dateModified?: number;
  sourceVersionKey?: string;
  unavailable?: boolean;
  lastValidatedAt?: number;
}

export interface ImportResult {
  added: number;
  duplicates: string[]; // Names of duplicate files
}

export interface QueueController {
  // Biblioteca (todas las canciones importadas - persistente)
  library: Track[];
  isLoading: boolean;
  // Progreso de importación
  importProgress: ImportProgress;
  getTrackFile: (track: Track) => Promise<File | undefined>;
  // Cola de reproducción (solo lo que el usuario quiere reproducir)
  queue: Track[];
  currentTrackIndex: number;
  currentTrack: Track | null;
  // Funciones de biblioteca
  addToLibrary: (files: File[]) => Promise<ImportResult>;
  addMediaStoreTracks: (tracks: AndroidMusicFile[], getAlbumArtFn?: (albumArtUri: string) => Promise<string | null>) => Promise<ImportResult>;
  reconcileMediaStoreTracks: (tracks: AndroidMusicFile[]) => Promise<{ updated: number; missing: number }>;
  removeFromLibrary: (id: string) => Promise<void>;
  clearLibrary: () => Promise<void>;
  // Funciones de cola
  addToQueue: (track: Track) => void;
  addToQueueNext: (track: Track) => void;
  addMultipleToQueue: (tracks: Track[]) => void;
  playAllInOrder: (tracks: Track[]) => void;
  playNow: (track: Track) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  shuffleAll: (tracks: Track[]) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  // Controles de reproducción
  playTrack: (index: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  persistEphemeralTrack: (trackId: string) => Promise<boolean>;
  // Legacy compatibility
  addTrack: (file: File) => Promise<void>;
  addTracks: (files: File[]) => Promise<void>;
  addTrackToEnd: (track: Track) => void;
  addTrackNext: (track: Track) => void;
  removeTrack: (id: string) => void;
}

export interface ImportProgress {
  isImporting: boolean;
  current: number;
  total: number;
  currentFileName: string;
}

export function useAudioQueue(): QueueController {
  const [library, setLibrary] = useState<Track[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    isImporting: false,
    current: 0,
    total: 0,
    currentFileName: '',
  });
  const coverUrlsRef = useRef<Map<string, string>>(new Map());
  const fileCacheRef = useRef<Map<string, File>>(new Map());
  const lastShuffleSignatureRef = useRef<string | null>(null);

  // Cargar biblioteca desde IndexedDB al iniciar
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        setIsLoading(true);
        logger.debug('[Library] Loading from IndexedDB...');
        
        const storedTracks = await musicLibraryDB.getAllTrackMetadata();
        logger.debug(`[Library] Found ${storedTracks.length} tracks`);
        
        const tracks: Track[] = [];
        
        for (const metadata of storedTracks) {
          try {
            const file = undefined;

            // Reconstruir URL de carátula si existe
            let coverUrl: string | undefined;
            if (metadata.coverBase64) {
              coverUrl = metadata.coverBase64;
              coverUrlsRef.current.set(metadata.id, coverUrl);
            }

            tracks.push({
              id: metadata.id,
              file,
              fileName: metadata.fileName,
              fileType: metadata.fileType,
              title: metadata.title,
              artist: metadata.artist,
              duration: metadata.duration,
              coverUrl,
              bitDepth: metadata.bitDepth,
              sampleRate: metadata.sampleRate,
              bitrate: metadata.bitrate,
              isHiRes: metadata.isHiRes,
              sourceUri: metadata.sourceUri,
              sourceType: metadata.sourceType,
              albumArtUri: metadata.albumArtUri,
              mediaStoreId: metadata.mediaStoreId,
              dateModified: metadata.dateModified,
              sourceVersionKey: metadata.sourceVersionKey,
              unavailable: metadata.unavailable,
              lastValidatedAt: metadata.lastValidatedAt,
            });
          } catch (error) {
            logger.error(`[Library] Error loading track ${metadata.id}:`, error);
          }
        }

        setLibrary(tracks);
        logger.info(`[Library] Loaded ${tracks.length} tracks successfully`);
      } catch (error) {
        logger.error('[Library] Error loading library:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLibrary();

    // Cleanup cover URLs on unmount
    return () => {
      coverUrlsRef.current.forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      fileCacheRef.current.clear();
    };
  }, []);

  const getTrackFile = useCallback(async (track: Track): Promise<File | undefined> => {
    if (track.sourceUri || track.sourceType === 'media-store') {
      return undefined;
    }

    const lookupId = track.sourceTrackId || track.id;

    if (track.file) {
      return track.file;
    }

    const cached = fileCacheRef.current.get(lookupId);
    if (cached) {
      return cached;
    }

    const audioBlob = await musicLibraryDB.getAudioBlob(lookupId);
    if (!audioBlob) {
      logger.warn(`[Library] Audio blob not found for ${lookupId}`);
      return undefined;
    }

    const fileName = track.fileName || track.title;
    const fileType = track.fileType || 'audio/mpeg';
    const file = blobToFile(audioBlob, fileName, fileType);
    fileCacheRef.current.set(lookupId, file);
    setLibrary((prev) => prev.map((item) => (item.id === lookupId ? { ...item, file } : item)));
    return file;
  }, []);

  // Extraer metadatos de un archivo
  const extractMetadata = useCallback(async (file: File): Promise<{
    title: string;
    artist: string;
    duration: number;
    coverUrl?: string;
    coverBase64?: string;
    bitDepth?: number;
    sampleRate?: number;
    bitrate?: number;
    isHiRes?: boolean;
  }> => {
    try {
      const metadata = await mm.parseBlob(file);

      const title = metadata.common?.title || file.name.replace(/\.[^/.]+$/, '');
      const artist = metadata.common?.artist || 'Unknown Artist';
      const duration = metadata.format?.duration || 0;

      // Extraer carátula
      let coverUrl: string | undefined;
      let coverBase64: string | undefined;
      
      if (metadata.common?.picture && metadata.common.picture.length > 0) {
        const picture = metadata.common.picture[0];
        const blob = new Blob([new Uint8Array(picture.data)], { type: picture.format });
        coverUrl = URL.createObjectURL(blob);
        
        // También guardar como base64 para persistencia
        coverBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      const bitDepth = metadata.format?.bitsPerSample;
      const sampleRate = metadata.format?.sampleRate;
      const bitrate = metadata.format?.bitrate;
      const isHiRes = isHiResQuality(bitDepth, sampleRate);

      return {
        title,
        artist,
        duration,
        coverUrl,
        coverBase64,
        bitDepth,
        sampleRate,
        bitrate,
        isHiRes,
      };
    } catch (error) {
      logger.error('Error extracting metadata:', error);
      return {
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Unknown Artist',
        duration: 0,
      };
    }
  }, []);

  // === FUNCIONES DE BIBLIOTECA (PERSISTENTES) ===

  const addToLibrary = useCallback(async (files: File[]): Promise<ImportResult> => {
    const newTracks: Track[] = [];
    const duplicates: string[] = [];
    const total = files.length;
    
    // Iniciar progreso
    setImportProgress({
      isImporting: true,
      current: 0,
      total,
      currentFileName: files[0]?.name || '',
    });
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Actualizar progreso
      setImportProgress({
        isImporting: true,
        current: i,
        total,
        currentFileName: file.name,
      });
      
      // Check for duplicates using fingerprint
      const fingerprint = musicLibraryDB.generateFingerprint(file.name, file.size);
      
      try {
        const existingTrack = await musicLibraryDB.findTrackByFingerprint(fingerprint);
        
        if (existingTrack) {
          // Track already exists - skip but record duplicate
          logger.debug(`[Library] Duplicate found: ${file.name}`);
          duplicates.push(file.name);
          continue;
        }
      } catch (error) {
        logger.warn('[Library] Could not check for duplicates:', error);
      }
      
      const id = `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const metadata = await extractMetadata(file);
      
      const track: Track = {
        id,
        file,
        fileName: file.name,
        fileType: file.type || 'audio/mpeg',
        title: metadata.title,
        artist: metadata.artist,
        duration: metadata.duration,
        coverUrl: metadata.coverBase64 || metadata.coverUrl,
        bitDepth: metadata.bitDepth,
        sampleRate: metadata.sampleRate,
        bitrate: metadata.bitrate,
        isHiRes: metadata.isHiRes,
        sourceType: 'file',
      };

      // Guardar en IndexedDB (si falla, usar fallback en memoria para no romper reproducción)
      try {
        const audioBlob = await fileToBlob(file);
        await musicLibraryDB.saveTrack(id, {
          title: metadata.title,
          artist: metadata.artist,
          duration: metadata.duration,
          bitDepth: metadata.bitDepth,
          sampleRate: metadata.sampleRate,
          bitrate: metadata.bitrate,
          isHiRes: metadata.isHiRes,
          coverBase64: metadata.coverBase64,
          fileName: file.name,
          fileType: file.type || 'audio/mpeg',
          fileSize: file.size,
          addedAt: Date.now(),
          sourceType: 'file',
          fingerprint, // Save fingerprint for future duplicate detection
        }, audioBlob);
        
        logger.debug(`[Library] Saved track: ${metadata.title}`);
      } catch (error) {
        logger.error(`[Library] Error saving track ${metadata.title}:`, error);
        track.isEphemeral = true;
        fileCacheRef.current.set(id, file);
        newTracks.push(track);
        setLibrary((prev) => [...prev, track]);
        continue;
      }
      
      if (metadata.coverBase64 || metadata.coverUrl) {
        coverUrlsRef.current.set(id, metadata.coverBase64 || metadata.coverUrl!);
      }
      
      newTracks.push(track);
      
      // Agregar a la biblioteca inmediatamente para feedback visual
      setLibrary((prev) => [...prev, track]);
    }
    
    // Finalizar progreso
    setImportProgress({
      isImporting: false,
      current: total,
      total,
      currentFileName: '',
    });

    return {
      added: newTracks.length,
      duplicates,
    };
  }, [extractMetadata]);

  const addMediaStoreTracks = useCallback(async (
    tracks: AndroidMusicFile[],
    getAlbumArtFn?: (albumArtUri: string) => Promise<string | null>
  ): Promise<ImportResult> => {
    const newTracks: Track[] = [];
    const duplicates: string[] = [];
    const total = tracks.length;
    const albumArtCache = new Map<string, string | null>();
    const shouldFetchAlbumArt = !!getAlbumArtFn && total <= 500;

    setImportProgress({
      isImporting: true,
      current: 0,
      total,
      currentFileName: tracks[0]?.name || '',
    });

    // Carga única para deduplicación (evita una consulta IndexedDB por track)
    const existingFingerprints = new Set<string>();
    try {
      const existingTracks = await musicLibraryDB.getAllTrackMetadata();
      for (const track of existingTracks) {
        if (track.fingerprint) {
          existingFingerprints.add(track.fingerprint);
        }
      }
    } catch (error) {
      logger.warn('[Library] Could not preload fingerprints for bulk import:', error);
    }

    for (let i = 0; i < tracks.length; i++) {
      const trackInfo = tracks[i];

      if (i === 0 || i === tracks.length - 1 || i % 25 === 0) {
        setImportProgress({
          isImporting: true,
          current: i + 1,
          total,
          currentFileName: trackInfo.name,
        });
      }

      const fingerprint = musicLibraryDB.generateFingerprint(trackInfo.name, trackInfo.size || 0, {
        duration: trackInfo.duration || 0,
        artist: trackInfo.artist,
        title: trackInfo.title,
        sourceType: 'media-store',
        mediaStoreId: trackInfo.id,
      });

      if (existingFingerprints.has(fingerprint)) {
        duplicates.push(trackInfo.name);
        continue;
      }

      const id = `media-${trackInfo.id}`;
      
      const bitDepth = trackInfo.bitDepth;
      const sampleRate = trackInfo.sampleRate;
      const bitrate = trackInfo.bitrate;
      const isHiRes = typeof trackInfo.isHiRes === 'boolean' ? trackInfo.isHiRes : isHiResQuality(bitDepth, sampleRate);

      // Obtener carátula del álbum si está disponible
      let coverBase64: string | undefined;
      if (shouldFetchAlbumArt && trackInfo.albumArtUri && getAlbumArtFn) {
        try {
          let artDataUrl: string | null;
          if (albumArtCache.has(trackInfo.albumArtUri)) {
            artDataUrl = albumArtCache.get(trackInfo.albumArtUri) ?? null;
          } else {
            artDataUrl = await getAlbumArtFn(trackInfo.albumArtUri);
            albumArtCache.set(trackInfo.albumArtUri, artDataUrl);
          }
          if (artDataUrl) {
            coverBase64 = artDataUrl;
          }
        } catch (err) {
          logger.warn('[Library] Could not get album art:', err);
        }
      }

      const metadata: Omit<StoredTrackMetadata, 'id'> = {
        title: trackInfo.title || trackInfo.name.replace(/\.[^/.]+$/, ''),
        artist: trackInfo.artist || 'Unknown Artist',
        duration: trackInfo.duration || 0,
        fileName: trackInfo.name,
        fileType: trackInfo.mimeType || 'audio/mpeg',
        fileSize: trackInfo.size || 0,
        addedAt: Date.now(),
        sourceUri: trackInfo.contentUri,
        sourceType: 'media-store',
        mediaStoreId: trackInfo.id,
        dateModified: trackInfo.dateModified,
        sourceVersionKey: trackInfo.sourceVersionKey,
        unavailable: false,
        lastValidatedAt: Date.now(),
        fingerprint,
        bitDepth,
        sampleRate,
        bitrate,
        isHiRes,
        albumArtUri: trackInfo.albumArtUri,
        coverBase64,
      };

      try {
        await musicLibraryDB.saveTrackReference(id, metadata);
        existingFingerprints.add(fingerprint);
        logger.info(`[Library] Saved MediaStore track: ${metadata.title} (Hi-Res: ${isHiRes})`);
      } catch (error) {
        logger.error(`[Library] Error saving MediaStore track ${metadata.title}:`, error);
        continue;
      }

      const newTrack: Track = {
        id,
        title: metadata.title,
        artist: metadata.artist,
        duration: metadata.duration,
        fileName: metadata.fileName,
        fileType: metadata.fileType,
        sourceUri: metadata.sourceUri,
        sourceType: metadata.sourceType,
        mediaStoreId: metadata.mediaStoreId,
        dateModified: metadata.dateModified,
        sourceVersionKey: metadata.sourceVersionKey,
        unavailable: metadata.unavailable,
        lastValidatedAt: metadata.lastValidatedAt,
        bitDepth,
        sampleRate,
        bitrate,
        isHiRes,
        albumArtUri: trackInfo.albumArtUri,
        coverUrl: coverBase64,
      };

      newTracks.push(newTrack);
    }

    if (newTracks.length > 0) {
      setLibrary((prev) => [...prev, ...newTracks]);
    }

    setImportProgress({
      isImporting: false,
      current: total,
      total,
      currentFileName: '',
    });

    return {
      added: newTracks.length,
      duplicates,
    };
  }, []);

  const reconcileMediaStoreTracks = useCallback(async (
    scannedTracks: AndroidMusicFile[],
  ): Promise<{ updated: number; missing: number }> => {
    if (scannedTracks.length === 0) {
      return { updated: 0, missing: 0 };
    }

    const byMediaStoreId = new Map(scannedTracks.map((track) => [track.id, track]));
    const bySourceUri = new Map(scannedTracks.map((track) => [track.contentUri, track]));

    let updated = 0;
    let missing = 0;

    const updates = await Promise.all(
      library
        .filter((track) => track.sourceType === 'media-store')
        .map(async (track) => {
          const mediaStoreIdFromTrack = track.mediaStoreId || track.id.replace(/^media-/, '');
          const match =
            bySourceUri.get(track.sourceUri || '') ||
            byMediaStoreId.get(mediaStoreIdFromTrack);

          if (!match) {
            missing += 1;
            if (track.unavailable) {
              return track;
            }
            const unavailableTrack = {
              ...track,
              unavailable: true,
              lastValidatedAt: Date.now(),
            };

            await musicLibraryDB.saveTrackReference(track.id, {
              title: unavailableTrack.title,
              artist: unavailableTrack.artist,
              duration: unavailableTrack.duration,
              bitDepth: unavailableTrack.bitDepth,
              sampleRate: unavailableTrack.sampleRate,
              bitrate: unavailableTrack.bitrate,
              isHiRes: unavailableTrack.isHiRes,
              coverBase64: unavailableTrack.coverUrl,
              fileName: unavailableTrack.fileName || unavailableTrack.title,
              fileType: unavailableTrack.fileType || 'audio/mpeg',
              fileSize: 0,
              addedAt: Date.now(),
              sourceUri: unavailableTrack.sourceUri,
              sourceType: 'media-store',
              albumArtUri: unavailableTrack.albumArtUri,
              mediaStoreId: unavailableTrack.mediaStoreId,
              dateModified: unavailableTrack.dateModified,
              sourceVersionKey: unavailableTrack.sourceVersionKey,
              unavailable: true,
              lastValidatedAt: unavailableTrack.lastValidatedAt,
              fingerprint: musicLibraryDB.generateFingerprint(
                unavailableTrack.fileName || unavailableTrack.title,
                0,
                {
                  duration: unavailableTrack.duration,
                  artist: unavailableTrack.artist,
                  title: unavailableTrack.title,
                  sourceType: 'media-store',
                  mediaStoreId: unavailableTrack.mediaStoreId,
                },
              ),
            });

            return unavailableTrack;
          }

          const sourceVersionKey = match.sourceVersionKey || `${match.id}:${match.size}:${match.dateModified || 0}`;
          const fingerprint = musicLibraryDB.generateFingerprint(match.name, match.size || 0, {
            duration: match.duration || 0,
            artist: match.artist,
            title: match.title,
            sourceType: 'media-store',
            mediaStoreId: match.id,
          });

          const nextTrack: Track = {
            ...track,
            title: match.title || track.title,
            artist: match.artist || track.artist,
            duration: match.duration || track.duration,
            fileName: match.name || track.fileName,
            fileType: match.mimeType || track.fileType,
            sourceUri: match.contentUri || track.sourceUri,
            mediaStoreId: match.id,
            dateModified: match.dateModified,
            sourceVersionKey,
            unavailable: false,
            lastValidatedAt: Date.now(),
            bitDepth: typeof match.bitDepth === 'number' ? match.bitDepth : track.bitDepth,
            sampleRate: typeof match.sampleRate === 'number' ? match.sampleRate : track.sampleRate,
            bitrate: typeof match.bitrate === 'number' ? match.bitrate : track.bitrate,
            isHiRes: typeof match.isHiRes === 'boolean' ? match.isHiRes : track.isHiRes,
          };

          const changed =
            track.sourceUri !== nextTrack.sourceUri ||
            track.sourceVersionKey !== nextTrack.sourceVersionKey ||
            track.unavailable !== nextTrack.unavailable ||
            track.fileName !== nextTrack.fileName;

          if (changed) {
            updated += 1;
            await musicLibraryDB.saveTrackReference(track.id, {
              title: nextTrack.title,
              artist: nextTrack.artist,
              duration: nextTrack.duration,
              fileName: nextTrack.fileName || nextTrack.title,
              fileType: nextTrack.fileType || 'audio/mpeg',
              fileSize: match.size || 0,
              addedAt: Date.now(),
              sourceUri: nextTrack.sourceUri,
              sourceType: 'media-store',
              albumArtUri: nextTrack.albumArtUri,
              mediaStoreId: nextTrack.mediaStoreId,
              dateModified: nextTrack.dateModified,
              sourceVersionKey: nextTrack.sourceVersionKey,
              unavailable: false,
              lastValidatedAt: nextTrack.lastValidatedAt,
              fingerprint,
              bitDepth: nextTrack.bitDepth,
              sampleRate: nextTrack.sampleRate,
              bitrate: nextTrack.bitrate,
              isHiRes: nextTrack.isHiRes,
              coverBase64: nextTrack.coverUrl,
            });
          }

          return changed ? nextTrack : track;
        }),
    );

    setLibrary((prev) =>
      prev.map((track) => {
        if (track.sourceType !== 'media-store') return track;
        const reconciled = updates.find((candidate) => candidate.id === track.id);
        return reconciled || track;
      }),
    );

    return { updated, missing };
  }, [library]);

  const removeFromLibrary = useCallback(async (id: string) => {
    // Eliminar de IndexedDB
    try {
      await musicLibraryDB.deleteTrack(id);
      // Also clean up playlist references
      await musicLibraryDB.cleanupPlaylistReferences(id);
      logger.info(`[Library] Deleted track: ${id}`);
    } catch (error) {
      logger.error(`[Library] Error deleting track ${id}:`, error);
    }

    // Revocar URL de carátula
    const coverUrl = coverUrlsRef.current.get(id);
    if (coverUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(coverUrl);
    }
    coverUrlsRef.current.delete(id);

    setLibrary((prev) => prev.filter(t => t.id !== id));
    
    // También remover de la cola si está ahí
    setQueue((prev) =>
      prev.filter((t) => (t.sourceTrackId || t.id) !== id),
    );
  }, []);

  const clearLibrary = useCallback(async () => {
    try {
      await musicLibraryDB.clearAll();
      logger.info('[Library] Cleared all tracks');
    } catch (error) {
      logger.error('[Library] Error clearing library:', error);
    }

    // Revocar todas las URLs de carátulas
    coverUrlsRef.current.forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    coverUrlsRef.current.clear();

    setLibrary([]);
    setQueue([]);
    setCurrentTrackIndex(-1);
  }, []);

  // === FUNCIONES DE COLA (EN MEMORIA) ===

  const createQueueTrack = useCallback((track: Track, preserveId: boolean = false): Track => {
    const sourceTrackId = track.sourceTrackId || track.id;
    return {
      ...track,
      id: preserveId ? sourceTrackId : `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceTrackId,
    };
  }, []);

  const addToQueue = useCallback((track: Track) => {
    const queueTrack = createQueueTrack(track);
    setQueue((prev) => [...prev, queueTrack]);
  }, [createQueueTrack]);

  const addToQueueNext = useCallback((track: Track) => {
    const queueTrack = createQueueTrack(track);
    setQueue((prev) => {
      const newQueue = [...prev];
      const insertIndex = currentTrackIndex >= 0 ? currentTrackIndex + 1 : 0;
      newQueue.splice(insertIndex, 0, queueTrack);
      return newQueue;
    });
  }, [createQueueTrack, currentTrackIndex]);

  // Add multiple tracks to queue at once
  const addMultipleToQueue = useCallback((tracks: Track[]) => {
    const queueTracks = tracks.map((track) => createQueueTrack(track));
    setQueue((prev) => [...prev, ...queueTracks]);
  }, [createQueueTrack]);

  const playNow = useCallback((track: Track) => {
    const queueTrack = createQueueTrack(track);
    setQueue((prev) => {
      const newQueue = [...prev];
      const insertIndex = currentTrackIndex >= 0 ? currentTrackIndex + 1 : 0;
      newQueue.splice(insertIndex, 0, queueTrack);
      return newQueue;
    });
    setCurrentTrackIndex((prev) => prev >= 0 ? prev + 1 : 0);
  }, [createQueueTrack, currentTrackIndex]);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => {
      const index = prev.findIndex(t => t.id === id);
      if (index === -1) return prev;
      
      const newQueue = prev.filter(t => t.id !== id);
      
      if (index < currentTrackIndex) {
        setCurrentTrackIndex((i) => i - 1);
      } else if (index === currentTrackIndex) {
        if (newQueue.length === 0) {
          setCurrentTrackIndex(-1);
        } else if (currentTrackIndex >= newQueue.length) {
          setCurrentTrackIndex(newQueue.length - 1);
        }
      }
      
      return newQueue;
    });
  }, [currentTrackIndex]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentTrackIndex(-1);
  }, []);

  const playAllInOrder = useCallback((tracks: Track[]) => {
    if (tracks.length === 0) return;

    // Para bibliotecas grandes mantenemos IDs estables y evitamos desincronización
    // entre cola y resolución de origen al cambiar rápido de pista.
    const queueTracks = tracks.map((track) => createQueueTrack(track, true));

    setQueue(queueTracks);
    setCurrentTrackIndex(0);
  }, [createQueueTrack]);

  // Reproducir toda la biblioteca en orden aleatorio (limpia cola actual)
  const shuffleAll = useCallback((tracks: Track[]) => {
    if (tracks.length === 0) return;
    
    const shuffleOnce = (source: Track[]) => {
      const shuffled = [...source];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    let shuffled = shuffleOnce(tracks);
    let signature = shuffled.map((track) => track.id).join('|');
    let attempts = 0;

    while (signature === lastShuffleSignatureRef.current && attempts < 5 && tracks.length > 1) {
      shuffled = shuffleOnce(tracks);
      signature = shuffled.map((track) => track.id).join('|');
      attempts += 1;
    }

    lastShuffleSignatureRef.current = signature;
    
    // Crear nuevos IDs para la cola
    const queueTracks = shuffled.map((track) => createQueueTrack(track, true));
    
    // Reemplazar cola completamente y empezar desde el principio
    setQueue(queueTracks);
    setCurrentTrackIndex(0);
  }, [createQueueTrack]);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      const newQueue = [...prev];
      const [movedItem] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, movedItem);
      
      if (currentTrackIndex === fromIndex) {
        setCurrentTrackIndex(toIndex);
      } else if (fromIndex < currentTrackIndex && toIndex >= currentTrackIndex) {
        setCurrentTrackIndex((prev) => prev - 1);
      } else if (fromIndex > currentTrackIndex && toIndex <= currentTrackIndex) {
        setCurrentTrackIndex((prev) => prev + 1);
      }
      
      return newQueue;
    });
  }, [currentTrackIndex]);

  // === CONTROLES DE REPRODUCCIÓN ===

  const playTrack = useCallback((index: number) => {
    if (index < 0 || index >= queue.length) {
      return;
    }

    setCurrentTrackIndex((prev) => {
      if (prev !== index) {
        return index;
      }

      // Forzar re-carga cuando el usuario intenta reproducir la misma pista
      // (útil tras errores de reproducción donde el índice no cambia).
      setTimeout(() => {
        setCurrentTrackIndex(index);
      }, 0);
      return -1;
    });
  }, [queue.length]);

  const nextTrack = useCallback(() => {
    if (queue.length === 0) return;
    setCurrentTrackIndex((prev) => {
      if (prev < queue.length - 1) return prev + 1;
      return 0;
    });
  }, [queue.length]);

  const previousTrack = useCallback(() => {
    if (queue.length === 0) return;
    setCurrentTrackIndex((prev) => {
      if (prev > 0) return prev - 1;
      return queue.length - 1;
    });
  }, [queue.length]);

  const persistEphemeralTrack = useCallback(async (trackId: string): Promise<boolean> => {
    const targetTrack = library.find((track) => track.id === trackId);
    if (!targetTrack || !targetTrack.isEphemeral) {
      return false;
    }

    const file = targetTrack.file ?? fileCacheRef.current.get(trackId);
    if (!file) {
      logger.warn(`[Library] Cannot persist ephemeral track ${trackId}: file not available`);
      return false;
    }

    const fingerprint = musicLibraryDB.generateFingerprint(file.name, file.size);
    const audioBlob = await fileToBlob(file);

    await musicLibraryDB.saveTrack(trackId, {
      title: targetTrack.title,
      artist: targetTrack.artist,
      duration: targetTrack.duration,
      bitDepth: targetTrack.bitDepth,
      sampleRate: targetTrack.sampleRate,
      bitrate: targetTrack.bitrate,
      isHiRes: targetTrack.isHiRes,
      coverBase64: targetTrack.coverUrl,
      fileName: targetTrack.fileName || file.name,
      fileType: targetTrack.fileType || file.type || 'audio/mpeg',
      fileSize: file.size,
      addedAt: Date.now(),
      sourceType: 'file',
      fingerprint,
    }, audioBlob);

    setLibrary((prev) =>
      prev.map((track) =>
        track.id === trackId ? { ...track, isEphemeral: false, file } : track,
      ),
    );
    fileCacheRef.current.set(trackId, file);
    logger.info(`[Library] Persisted ephemeral track ${trackId}`);
    return true;
  }, [library]);

  // === LEGACY COMPATIBILITY ===
  
  const addTrack = useCallback(async (file: File) => {
    await addToLibrary([file]);
  }, [addToLibrary]);

  const addTracks = useCallback(async (files: File[]) => {
    await addToLibrary(files);
  }, [addToLibrary]);

  const addTrackToEnd = useCallback((track: Track) => {
    addToQueue(track);
  }, [addToQueue]);

  const addTrackNext = useCallback((track: Track) => {
    addToQueueNext(track);
  }, [addToQueueNext]);

  const removeTrack = useCallback((id: string) => {
    removeFromQueue(id);
  }, [removeFromQueue]);

  const currentTrack = currentTrackIndex >= 0 && currentTrackIndex < queue.length 
    ? queue[currentTrackIndex] 
    : null;

  return {
    library,
    isLoading,
    importProgress,
    getTrackFile,
    queue,
    currentTrackIndex,
    currentTrack,
    addToLibrary,
    addMediaStoreTracks,
    reconcileMediaStoreTracks,
    removeFromLibrary,
    clearLibrary,
    addToQueue,
    addToQueueNext,
    addMultipleToQueue,
    playAllInOrder,
    playNow,
    removeFromQueue,
    clearQueue,
    shuffleAll,
    reorderQueue,
    playTrack,
    nextTrack,
    previousTrack,
    persistEphemeralTrack,
    addTrack,
    addTracks,
    addTrackToEnd,
    addTrackNext,
    removeTrack,
  };
}

export default useAudioQueue;
