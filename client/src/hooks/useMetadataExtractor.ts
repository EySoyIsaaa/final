import { useCallback } from 'react';
import * as mm from 'music-metadata';

export interface AudioMetadata {
  title: string;
  artist: string;
  duration: number;
  coverUrl?: string;
}

/**
 * Hook para extraer metadatos de archivos de audio
 * Soporta: MP3, WAV, FLAC, OGG, M4A, AAC
 * Si no encuentra metadatos, usa el nombre del archivo como título
 */
export function useMetadataExtractor() {
  const extractMetadata = useCallback(async (file: File): Promise<AudioMetadata> => {
    try {
      // Intentar extraer metadatos usando music-metadata
      const metadata = await mm.parseBlob(file);

      // Extraer información básica
      const title = metadata.common?.title || file.name.replace(/\.[^/.]+$/, '');
      const artist = metadata.common?.artist || 'Artista desconocido';
      const duration = metadata.format?.duration || 0;

      // Extraer carátula si existe
      let coverUrl: string | undefined;
      if (metadata.common?.picture && metadata.common.picture.length > 0) {
        const picture = metadata.common.picture[0];
        const blob = new Blob([new Uint8Array(picture.data)], { type: picture.format });
        coverUrl = URL.createObjectURL(blob);
      }

      return {
        title,
        artist,
        duration,
        coverUrl,
      };
    } catch (error) {
      // Si hay error, usar valores por defecto
      console.warn('Error extracting metadata:', error);
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      
      return {
        title: fileName,
        artist: 'Artista desconocido',
        duration: 0,
      };
    }
  }, []);

  const extractMetadataFromMultipleFiles = useCallback(
    async (files: File[]): Promise<AudioMetadata[]> => {
      return Promise.all(files.map(file => extractMetadata(file)));
    },
    [extractMetadata]
  );

  return {
    extractMetadata,
    extractMetadataFromMultipleFiles,
  };
}
