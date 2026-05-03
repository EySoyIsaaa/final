import { useEffect, useState } from 'react';
import { logger } from "@/lib/logger";

export interface AndroidMusicFile {
  id: string;
  name: string;
  title?: string;
  artist?: string;
  album?: string;
  contentUri: string;
  path?: string;
  size: number;
  mimeType: string;
  duration?: number;
  albumArtUri?: string;
  bitDepth?: number;
  sampleRate?: number;
  bitrate?: number;
  isHiRes?: boolean;
  dateModified?: number;
  sourceVersionKey?: string;
}

export interface ScanProgress {
  isScanning: boolean;
  current: number;
  total: number;
  status: 'idle' | 'requesting-permission' | 'scanning' | 'complete' | 'error';
}

export interface NativeLibraryPage {
  page: number;
  pageSize: number;
  total: number;
  records: AndroidMusicFile[];
}

/**
 * Hook para acceder a la biblioteca de música del sistema Android usando MediaStore
 * Usa un plugin nativo personalizado MusicScanner
 */
export function useAndroidMusicLibrary() {
  const [musicFiles, setMusicFiles] = useState<AndroidMusicFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAndroid, setIsAndroid] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    isScanning: false,
    current: 0,
    total: 0,
    status: 'idle',
  });

  useEffect(() => {
    // Detectar si es Android
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroidDevice = /android/.test(userAgent);
    logger.debug('🔍 [MusicLibrary] UserAgent:', userAgent);
    logger.debug('🔍 [MusicLibrary] isAndroid:', isAndroidDevice);
    setIsAndroid(isAndroidDevice);
  }, []);

  const getPlugin = () => {
    if (typeof (window as any).Capacitor === 'undefined') {
      return null;
    }
    return (window as any).Capacitor.Plugins.MusicScanner || null;
  };

  const scanMusicLibrary = async (): Promise<AndroidMusicFile[]> => {
    if (!isAndroid) {
      const errorMsg = 'Esta funcionalidad solo está disponible en Android';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    setIsLoading(true);
    setError(null);
    setScanProgress({
      isScanning: true,
      current: 0,
      total: 0,
      status: 'scanning',
    });

    try {
      const MusicScanner = getPlugin();
      
      if (!MusicScanner) {
        throw new Error('Plugin MusicScanner no encontrado');
      }

      logger.info('🎵 Escaneando música con MusicScanner...');
      
      // Asegurar que tiene permisos ANTES de escanear
      const permResult = await MusicScanner.requestAudioPermissions();
      logger.debug('🔐 Resultado de permisos:', permResult);
      
      if (!permResult.granted) {
        throw new Error('Permisos no concedidos');
      }
      
      // Escaneo + persistencia nativa (la biblioteca queda fuera del WebView)
      await MusicScanner.importAutomaticLibrary();
      const first = await MusicScanner.getLibraryPage({
        page: 1,
        pageSize: 100,
        search: '',
        sortBy: 'title',
        sortDir: 'asc',
      });
      const total = Number(first?.total || 0);
      const pages = Math.max(1, Math.ceil(total / 100));
      const records: any[] = [...(first?.records || [])];
      for (let page = 2; page <= pages; page++) {
        const next = await MusicScanner.getLibraryPage({ page, pageSize: 100, search: '', sortBy: 'title', sortDir: 'asc' });
        records.push(...(next?.records || []));
      }
      
      logger.debug('🎵 Resultado del escaneo total:', { total, records: records.length });
      
      const files: AndroidMusicFile[] = records
        .map((file: any) => ({
          id: file.id || String(Date.now() + Math.random()),
          name: file.name || 'Unknown',
          title: file.title || file.name || 'Unknown',
          artist: file.artist || 'Unknown Artist',
          album: file.album || 'Unknown Album',
          contentUri: file.contentUri || '',
          path: file.contentUri || '',
          size: file.size || 0,
          mimeType: file.mimeType || 'audio/mpeg',
          duration: file.duration || 0,
          albumArtUri: file.albumArtUri || '',
          bitDepth: typeof file.bitDepth === 'number' ? file.bitDepth : undefined,
          sampleRate: typeof file.sampleRate === 'number' ? file.sampleRate : undefined,
          bitrate: typeof file.bitrate === 'number' ? file.bitrate : undefined,
          isHiRes: typeof file.isHiRes === 'boolean' ? file.isHiRes : undefined,
          dateModified: typeof file.dateModified === 'number' ? file.dateModified : undefined,
          sourceVersionKey: typeof file.sourceVersionKey === 'string' ? file.sourceVersionKey : undefined,
        }));
      
      logger.info('🎵 Archivos procesados:', files.length);
      
      setMusicFiles(files);
      setScanProgress({
        isScanning: false,
        current: files.length,
        total: files.length,
        status: 'complete',
      });

      return files;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      logger.error('❌ Error scanning music library:', err);
      setError(errorMessage);
      setScanProgress({
        isScanning: false,
        current: 0,
        total: 0,
        status: 'error',
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getLibraryPage = async (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: 'title' | 'artist' | 'dateModified';
    sortDir?: 'asc' | 'desc';
  }): Promise<NativeLibraryPage> => {
    const MusicScanner = getPlugin();
    if (!MusicScanner) {
      return { page: 1, pageSize: 0, total: 0, records: [] };
    }

    const result = await MusicScanner.getLibraryPage({
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 100,
      search: params?.search ?? '',
      sortBy: params?.sortBy ?? 'title',
      sortDir: params?.sortDir ?? 'asc',
    });

    return {
      page: result?.page ?? 1,
      pageSize: result?.pageSize ?? 0,
      total: result?.total ?? 0,
      records: (result?.records ?? []) as AndroidMusicFile[],
    };
  };

  const requestPermissions = async (): Promise<boolean> => {
    setScanProgress({
      isScanning: false,
      current: 0,
      total: 0,
      status: 'requesting-permission',
    });

    try {
      const MusicScanner = getPlugin();
      
      if (!MusicScanner) {
        setScanProgress({ isScanning: false, current: 0, total: 0, status: 'error' });
        return false;
      }

      logger.debug('🔐 Solicitando permisos...');
      const result = await MusicScanner.requestAudioPermissions();
      logger.debug('🔐 Resultado de permisos:', result);
      
      const granted = !!result?.granted;
      
      if (!granted) {
        setScanProgress({ isScanning: false, current: 0, total: 0, status: 'error' });
      } else {
        setScanProgress({ isScanning: false, current: 0, total: 0, status: 'idle' });
      }
      
      return granted;
    } catch (err) {
      logger.error('Error requesting permissions:', err);
      setScanProgress({ isScanning: false, current: 0, total: 0, status: 'error' });
      return false;
    }
  };

  const checkPermissions = async (): Promise<boolean> => {
    try {
      const MusicScanner = getPlugin();
      
      if (!MusicScanner) {
        return false;
      }

      const result = await MusicScanner.checkPermissions();
      return !!result?.granted;
    } catch (err) {
      logger.error('Error checking permissions:', err);
      return false;
    }
  };

  /**
   * Obtiene una URL de archivo accesible desde un content:// URI
   * Copia el archivo a caché para reproducción eficiente (especialmente para FLAC/WAV)
   */
  const getAudioFileUrl = async (
    contentUri: string,
    trackId: string,
    options?: { expectedSize?: number; sourceVersionKey?: string },
  ): Promise<string | null> => {
    try {
      const MusicScanner = getPlugin();
      
      if (!MusicScanner) {
        logger.error('Plugin MusicScanner no disponible');
        return null;
      }

      logger.debug('🎵 Obteniendo URL de archivo para:', contentUri);
      const result = await MusicScanner.getAudioFileUrl({
        contentUri,
        trackId,
        expectedSize: options?.expectedSize,
        sourceVersionKey: options?.sourceVersionKey,
      });
      
      if (result?.filePath) {
        // Convertir la ruta del archivo a una URL que Capacitor puede servir
        const baseUrl = (window as any).Capacitor.convertFileSrc(result.filePath);
        const cacheBuster = typeof result?.resolvedUrl === 'string' && result.resolvedUrl.includes('?')
          ? result.resolvedUrl.substring(result.resolvedUrl.indexOf('?'))
          : '';
        const fileUrl = `${baseUrl}${cacheBuster}`;
        logger.debug('✅ URL de archivo obtenida', { fileUrl, cached: result.cached });
        return fileUrl;
      }
      
      return null;
    } catch (err) {
      logger.error('Error obteniendo URL de archivo:', err);
      return null;
    }
  };

  /**
   * Limpia la caché de archivos de audio
   */
  const clearAudioCache = async (): Promise<boolean> => {
    try {
      const MusicScanner = getPlugin();
      if (!MusicScanner) return false;
      
      const result = await MusicScanner.clearAudioCache();
      return result?.success || false;
    } catch (err) {
      logger.error('Error limpiando caché:', err);
      return false;
    }
  };

  /**
   * Obtiene la carátula del álbum como Data URL
   */
  const getAlbumArt = async (albumArtUri: string): Promise<string | null> => {
    try {
      const MusicScanner = getPlugin();
      
      if (!MusicScanner || !albumArtUri) {
        return null;
      }

      const result = await MusicScanner.getAlbumArt({ albumArtUri });
      return result?.dataUrl || null;
    } catch (err) {
      logger.warn('No se pudo obtener carátula:', err);
      return null;
    }
  };

  return {
    musicFiles,
    isLoading,
    error,
    isAndroid,
    scanProgress,
    scanMusicLibrary,
    requestPermissions,
    checkPermissions,
    getAudioFileUrl,
    getLibraryPage,
    getAlbumArt,
    clearAudioCache,
  };
}
