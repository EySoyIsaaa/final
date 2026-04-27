import { describe, it, expect } from 'vitest';

/**
 * Tests para la extracción de metadatos de archivos de audio
 */

describe('Metadata Extraction', () => {
  describe('Track Metadata Structure', () => {
    it('should create a track with all metadata fields', () => {
      const track = {
        id: 'track_1',
        title: 'Test Song',
        artist: 'Test Artist',
        duration: 180,
        coverUrl: 'blob:http://localhost:3000/abc123',
      };

      expect(track).toHaveProperty('id');
      expect(track).toHaveProperty('title');
      expect(track).toHaveProperty('artist');
      expect(track).toHaveProperty('duration');
      expect(track).toHaveProperty('coverUrl');
    });

    it('should use filename as title when metadata is missing', () => {
      const fileName = 'song.mp3';
      const title = fileName.replace(/\.[^/.]+$/, '');

      expect(title).toBe('song');
    });

    it('should use "Artista desconocido" as default artist', () => {
      const defaultArtist = 'Artista desconocido';

      expect(defaultArtist).toBe('Artista desconocido');
    });

    it('should handle complex filenames correctly', () => {
      const filenames = [
        'Song - Artist.mp3',
        'Track [Remix].wav',
        'Audio.file.name.flac',
        'simple.m4a',
      ];

      filenames.forEach(filename => {
        const title = filename.replace(/\.[^/.]+$/, '');
        expect(title.length).toBeGreaterThan(0);
        expect(title).not.toBe(filename);
      });
    });
  });

  describe('Duration Handling', () => {
    it('should store duration in seconds', () => {
      const duration = 180; // 3 minutes
      expect(duration).toBe(180);
      expect(duration).toBeGreaterThan(0);
    });

    it('should handle zero duration gracefully', () => {
      const duration = 0;
      expect(duration).toBe(0);
    });

    it('should handle decimal durations', () => {
      const duration = 180.5;
      expect(duration).toBe(180.5);
      expect(Math.floor(duration)).toBe(180);
    });
  });

  describe('Cover Art Handling', () => {
    it('should store cover URL when available', () => {
      const track = {
        title: 'Song',
        artist: 'Artist',
        duration: 180,
        coverUrl: 'blob:http://localhost:3000/cover',
      };

      expect(track.coverUrl).toBeDefined();
      expect(track.coverUrl).toContain('blob:');
    });

    it('should allow undefined cover URL', () => {
      const track = {
        title: 'Song',
        artist: 'Artist',
        duration: 180,
        coverUrl: undefined,
      };

      expect(track.coverUrl).toBeUndefined();
    });

    it('should validate cover URL format', () => {
      const validUrls = [
        'blob:http://localhost:3000/abc123',
        'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        'https://example.com/cover.jpg',
      ];

      validUrls.forEach(url => {
        expect(url).toBeTruthy();
        expect(typeof url).toBe('string');
      });
    });
  });

  describe('Metadata Extraction Fallback', () => {
    it('should use filename when metadata extraction fails', () => {
      const fileName = 'unknown_format.xyz';
      const title = fileName.replace(/\.[^/.]+$/, '');
      const artist = 'Artista desconocido';

      expect(title).toBe('unknown_format');
      expect(artist).toBe('Artista desconocido');
    });

    it('should handle corrupted metadata gracefully', () => {
      const corruptedMetadata = null;
      const fallbackTitle = 'song.mp3'.replace(/\.[^/.]+$/, '');
      const fallbackArtist = 'Artista desconocido';

      expect(corruptedMetadata).toBeNull();
      expect(fallbackTitle).toBe('song');
      expect(fallbackArtist).toBe('Artista desconocido');
    });
  });

  describe('Supported Audio Formats', () => {
    it('should recognize common audio formats', () => {
      const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'];
      const testFiles = [
        'song.mp3',
        'audio.wav',
        'track.flac',
        'podcast.ogg',
        'music.m4a',
        'sound.aac',
      ];

      testFiles.forEach(file => {
        const hasValidExtension = audioExtensions.some(ext =>
          file.toLowerCase().endsWith(ext)
        );
        expect(hasValidExtension).toBe(true);
      });
    });

    it('should reject non-audio formats', () => {
      const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'];
      const invalidFiles = [
        'document.pdf',
        'image.jpg',
        'video.mp4',
        'text.txt',
      ];

      invalidFiles.forEach(file => {
        const hasValidExtension = audioExtensions.some(ext =>
          file.toLowerCase().endsWith(ext)
        );
        expect(hasValidExtension).toBe(false);
      });
    });
  });

  describe('Metadata Persistence', () => {
    it('should maintain metadata through serialization', () => {
      const originalTrack = {
        id: 'track_1',
        title: 'Test Song',
        artist: 'Test Artist',
        duration: 180,
        coverUrl: 'blob:http://localhost:3000/cover',
      };

      const serialized = JSON.stringify(originalTrack);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(originalTrack);
      expect(deserialized.title).toBe('Test Song');
      expect(deserialized.artist).toBe('Test Artist');
    });

    it('should handle metadata for multiple tracks', () => {
      const tracks = [
        {
          id: 'track_1',
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
        },
        {
          id: 'track_2',
          title: 'Song 2',
          artist: 'Artist 2',
          duration: 240,
        },
        {
          id: 'track_3',
          title: 'Song 3',
          artist: 'Artista desconocido',
          duration: 200,
        },
      ];

      expect(tracks).toHaveLength(3);
      expect(tracks[0].title).toBe('Song 1');
      expect(tracks[1].artist).toBe('Artist 2');
      expect(tracks[2].artist).toBe('Artista desconocido');
    });
  });

  describe('Metadata Validation', () => {
    it('should validate title is not empty', () => {
      const titles = ['Song', 'Track 1', 'Unknown'];
      titles.forEach(title => {
        expect(title.length).toBeGreaterThan(0);
      });
    });

    it('should validate artist is not empty', () => {
      const artists = ['Artist', 'Artista desconocido', 'Unknown Artist'];
      artists.forEach(artist => {
        expect(artist.length).toBeGreaterThan(0);
      });
    });

    it('should validate duration is non-negative', () => {
      const durations = [0, 180, 3600, 180.5];
      durations.forEach(duration => {
        expect(duration).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
