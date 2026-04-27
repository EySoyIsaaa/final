import { useEffect, useState } from 'react';

export interface StoredTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  file: Blob;
  coverUrl?: string;
  timestamp: number;
}

const DB_NAME = 'EpicenterPlayerDB';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

let db: IDBDatabase | null = null;

async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveTrackToLibrary(track: StoredTrack): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(track);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getAllTracksFromLibrary(): Promise<StoredTrack[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function deleteTrackFromLibrary(id: string): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export function useLibraryPersistence() {
  const [library, setLibrary] = useState<StoredTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar biblioteca al iniciar
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const tracks = await getAllTracksFromLibrary();
        setLibrary(tracks);
      } catch (error) {
        console.error('Error loading library:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLibrary();
  }, []);

  const addTrack = async (track: StoredTrack) => {
    try {
      await saveTrackToLibrary(track);
      setLibrary(prev => [...prev, track]);
    } catch (error) {
      console.error('Error adding track:', error);
      throw error;
    }
  };

  const removeTrack = async (id: string) => {
    try {
      await deleteTrackFromLibrary(id);
      setLibrary(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error removing track:', error);
      throw error;
    }
  };

  return {
    library,
    isLoading,
    addTrack,
    removeTrack,
  };
}
