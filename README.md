# Epicenter Hi-Fi

**Versión:** 5.0.0  
**Última actualización:** 27 de marzo de 2026

Epicenter Hi-Fi es un **reproductor local de música** para Android/Web con un enfoque diferencial: el núcleo de la experiencia está en el **procesador Epicenter DSP** y en la **implementación de IA aplicada al audio y a la experiencia de uso**.

## Enfoque para Inovatec (factor diferencial)

Aunque es un reproductor completo (biblioteca, cola, playlists, alta resolución), el proyecto se posiciona como una plataforma de audio inteligente centrada en:

- **Epicenter DSP en tiempo real** para reconstrucción de graves y control fino del perfil sonoro.
- **IA aplicada** para asistencia contextual, automatización de decisiones de sonido y experiencias de ayuda dentro de la app.
- **Integración híbrida Web + Android nativo** para mantener portabilidad sin perder capacidades del dispositivo.

Este enfoque (Epicenter + IA) es el factor que diferencia la app frente a reproductores tradicionales basados sólo en reproducción y ecualización estática.

## Qué hace hoy la app

- Reproducción local de archivos de audio.
- Biblioteca persistente con importación manual y escaneo en Android.
- Cola editable y playlists locales.
- Ecualizador gráfico de 31 bandas.
- Procesador Epicenter con controles: Sweep, Width, Intensity, Balance y Volume.
- Detección de pistas High Resolution.
- Crossfade configurable.
- Controles de reproducción en background.
- Interfaz bilingüe (ES/EN).
- Soporte de navegación Android con botón físico de regresar (back) para volver entre vistas antes de cerrar la app.

## Formatos soportados

- MP3
- WAV
- FLAC
- M4A / AAC
- OGG (según disponibilidad del origen)

## Stack tecnológico

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Web Audio API + AudioWorklet
- Capacitor Android
- IndexedDB

## Flujo de audio

`Audio source -> Epicenter processor -> 31-band equalizer -> output`

## Estructura del proyecto

- `client/`: interfaz, audio, hooks y componentes.
- `server/`: servidor Express/tRPC para servir la aplicación.
- `shared/`: utilidades y tipos compartidos.
- `android/`: contenedor Android con Capacitor y plugin nativo para MediaStore.

## Scripts principales

- `pnpm dev`: entorno de desarrollo.
- `pnpm build`: compilación de frontend y servidor.
- `pnpm test`: pruebas con Vitest.
- `pnpm check`: validación TypeScript.
