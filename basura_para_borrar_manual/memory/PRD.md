# Epicenter Hi-Fi - PRD (Product Requirements Document)

## Información General
- **Nombre**: EpicenterDSP PLAYER
- **Versión**: 1.1.3 (versionCode 6)
- **Fecha**: Julio 2025
- **Stack**: React + TypeScript + Tailwind CSS + Web Audio API + IndexedDB + Capacitor

## Descripción
Reproductor de música para Android con procesador DSP Epicenter que reconstruye frecuencias bajas perdidas en la compresión de audio, similar al hardware AudioControl Epicenter.

## User Persona
- **Audiófilos y entusiastas de Car Audio**
- Usuarios que quieren bajos potentes con calidad premium
- Buscan una experiencia de audio profesional en dispositivo móvil

## Requisitos Core (Implementados ✅)

### Reproductor de Música
- ✅ Carátula de álbum con sombra premium
- ✅ Información de canción (título, artista)
- ✅ Controles de reproducción (prev, play/pause, next)
- ✅ Barra de progreso con tiempo restante
- ✅ Control de volumen en tiempo real
- ✅ Cola de reproducción inline con drag & drop
- ✅ Importación de archivos de audio

### Persistencia (v3.0 - CRÍTICO)
- ✅ **Biblioteca guardada en IndexedDB** - Las canciones NO se pierden entre sesiones
- ✅ Archivos de audio guardados como Blobs
- ✅ Metadatos y carátulas persistentes
- ✅ Estado de carga visual mientras se recupera la biblioteca

### Reproducción en Background (v3.0)
- ✅ Media Session API configurado
- ✅ Plugin `@capgo/capacitor-media-session` para controles nativos Android
- ✅ Controles en centro de notificaciones (pendiente prueba)
- ✅ Carátula y metadatos en pantalla bloqueada
- ✅ Audio element configurado para background playback

### Mi Música (Biblioteca) - v3.1
- ✅ Vista principal con 3 carpetas
- ✅ Carpeta Canciones - Lista todas las canciones
- ✅ Carpeta Artistas - Agrupa por artista
- ✅ Carpeta Álbumes - Grid de álbumes
- ✅ **NUEVO** Botón "Reproducción Aleatoria" en vista principal
- ✅ **NUEVO** Botón aleatorio por sección (artista/álbum)
- ✅ **NUEVO** Gestos de deslizamiento:
  - Deslizar ← izquierda: Agregar a cola
  - Deslizar → derecha: Reproducir siguiente
  - Long press: Menú de opciones
- ✅ Navegación automática a "Ahora Suena" al reproducir

### Cola de Reproducción (Separada de Biblioteca)
- ✅ Integrada en "Ahora Suena" (toggle button)
- ✅ Drag & drop para reordenar
- ✅ Eliminar de cola NO afecta biblioteca
- ✅ Cola comienza vacía (usuario agrega manualmente)
- ✅ **NUEVO** Función `shuffleAll()` - limpia cola y crea nueva aleatoria

### Ecualizador 12 Bandas
- ✅ Frecuencias: 32Hz-16kHz
- ✅ Rango: -12dB a +12dB
- ✅ Switch ON/OFF
- ✅ Botón restablecer

### Epicenter DSP
- ✅ SWEEP (27-63 Hz) - Frecuencia central
- ✅ WIDTH (0-100%) - Ancho de banda
- ✅ INTENSITY (0-100%) - Intensidad de bajos
- ✅ BALANCE (0-100%) - Balance voz/bajos
- ✅ VOLUME (0-150%) - Volumen de salida
- ✅ Cambios en tiempo real

### UI/UX
- ✅ Barra de navegación FIJA en la parte inferior
- ✅ Diseño monocromático estilo Apple Music
- ✅ Badge Hi-Res con logo dorado para audio ≥16-bit/44.1kHz
- ✅ Safe area para dispositivos con notch
- ✅ **NUEVO** Componente SwipeableTrackItem con gestos touch
- ✅ **v1.1.2** Sistema de internacionalización completo (ES/EN)
- ✅ **v1.1.2** Crossfade configurable entre canciones (3/5/7/10 seg)
- ✅ **v1.1.2** Reproducción continua automática (auto-next)
- ✅ **v1.1.3** Splash screen con animación de inicio
- ✅ **v1.1.3** Recordar última canción reproducida

### Splash Screen (v1.1.3)
- `/client/src/components/SplashScreen.tsx` - Componente de splash
- Ícono Epicenter con efecto glow
- Texto "EpicenterDSP Player"
- Animación fade-in / fade-out (2.2 segundos)
- Badge de versión

### Last Track Memory (v1.1.3)
- `/client/src/hooks/useLastTrack.ts` - Hook para última canción
- Guarda solo `lastTrackId` en localStorage
- Al abrir: carga canción sin autoplay
- No guarda: posición, cola, DSP/EQ (ya persistentes)

## Arquitectura Técnica

### Frontend
- `/client/src/pages/Home.tsx` - Vista principal con tabs
- `/client/src/lib/musicLibraryDB.ts` - Persistencia en IndexedDB
- `/client/src/hooks/useAudioQueue.ts` - Gestión de biblioteca y cola
- `/client/src/hooks/useMediaSession.ts` - Controles en notificaciones (Web)
- `/client/src/hooks/useMediaNotification.ts` - Controles nativos Android
- `/client/src/hooks/useIntegratedAudioProcessor.ts` - DSP y EQ
- `/client/src/components/SwipeableTrackItem.tsx` - Item con gestos de swipe

### Persistencia
- IndexedDB con tres stores (v1.1.2):
  - `tracks`: Metadatos de canciones + fingerprint para detección de duplicados
  - `audio-files`: Archivos de audio (Blobs)
  - `playlists`: Playlists con referencias a IDs de canciones

### Playlists (v1.1.2)
- `/client/src/hooks/usePlaylists.ts` - Hook para gestión de playlists
- Crear, renombrar y eliminar playlists
- Agregar/quitar canciones (solo guardan IDs, no duplican archivos)
- Reproducción completa de playlist (orden o aleatorio)
- Detección de canciones duplicadas al importar:
  - Fingerprint: fileName + fileSize
  - Modal de aviso cuando se detectan duplicados
  - Zero duplicación de archivos en la base de datos

### Plugins Capacitor
- `@capgo/capacitor-media-session` - Controles multimedia nativos

### Internacionalización (v1.1.2)
- `/client/src/hooks/useLanguage.tsx` - Context y hook de idioma
- `/client/src/i18n/es.json` - Traducciones en español
- `/client/src/i18n/en.json` - Traducciones en inglés
- Detección automática del idioma del sistema
- Cambio manual persistente en localStorage

### Crossfade (v1.1.2)
- `/client/src/hooks/useCrossfade.ts` - Hook para configuración de crossfade
- Fade out gradual al final de cada canción
- Fade in gradual al inicio de la siguiente
- Duraciones configurables: 3, 5, 7, 10 segundos
- Persistencia en localStorage

## Para Generar APK

Ver `/app/CAPACITOR_SETUP.md` para instrucciones completas de:
- Instalación de Capacitor
- Configuración de permisos Android
- Build y sync

## Backlog

### P0 - Crítico (En progreso)
- [ ] Probar controles de notificación en dispositivo real
- [ ] Verificar que el audio no se detenga en background

### P1 - Alta Prioridad
- [ ] Bug del menú de 3 puntos (reportado por usuario)
- [ ] Port a iOS

### P2 - Media Prioridad
- [ ] Visualizador de espectro FFT
- [ ] Presets de EQ predefinidos
- [ ] Gapless playback
