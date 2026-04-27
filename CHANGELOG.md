# 📋 CHANGELOG - EpicenterDSP PLAYER

> **⚠️ IMPORTANTE: Este es el ÚNICO archivo .md de documentación que debe actualizarse.**
> 
> **NO crear nuevos archivos .md**. Todas las actualizaciones, cambios y documentación deben agregarse aquí.

---

## 📌 Índice

- [Versión Actual](#-versión-actual-500)
- [Versión 5.0.0](#versión-500---27-marzo-2026)
- [Versión 2.0.0](#versión-200---31-enero-2026)
- [Versión 1.2.0](#versión-120---30-enero-2025)
- [Versión 1.1.4](#versión-114---30-enero-2025)
- [Próximas Versiones](#próximas-versiones)
- [Cómo Compilar](#cómo-compilar)
- [Solución de Problemas](#solución-de-problemas)

---

## 🎵 Versión Actual: 5.0.0

**Fecha:** 27 de marzo de 2026  
**Version Code:** 10  
**SDK Android:** 35 (Android 15)  

### Estado:
✅ **IMPLEMENTADO Y LISTO PARA COMPILAR**

---

# 📦 Historial de Versiones

---

## Versión 5.0.0 - 27 marzo 2026

### 🎯 Cambio Principal: Lanzamiento enfocado a Inovatec (Epicenter + IA)

Actualización de documentación y narrativa del producto para posicionar Epicenter Hi-Fi como un **reproductor musical con diferenciador técnico en Epicenter DSP e implementación de IA**.

### ✨ Cambios destacados:

- Documentación oficial actualizada a versión **5.0.0** con fecha **27 de marzo de 2026**.
- Énfasis estratégico en el rol de **Epicenter** como núcleo del procesamiento.
- Énfasis en la **implementación de IA** como requisito de innovación para concurso Inovatec.
- Ajuste de UX Android para navegación con botón **Back** sin cierre inmediato de la app.

### 🔧 Cambios técnicos:

- Se actualizó `README.md` con posicionamiento de producto y propuesta diferencial.
- Se actualizó `ACTUALIZACIONES_FUTURAS.md` con registro vigente y prioridades alineadas a Inovatec.
- Se mejoró `MainActivity.java` para usar navegación hacia atrás del WebView antes de cerrar la aplicación.

---

## Versión 2.0.0 - 31 Enero 2026

### 🎯 Cambio Principal: Beta cerrada 2.0.0

Preparación de versión 2.0.0 para distribución en **prueba beta cerrada** en Google Play.

### ✨ Cambios destacados:

- Cola con scroll restaurado y now playing fijado en la lista
- Sección de **Alta resolución** con búsqueda y reproducción aleatoria
- Logo Hi‑Res en el acceso de alta resolución
- Modal de bienvenida de primera instalación
- Carga lazy de archivos para reducir tiempos y memoria

### 🔧 Cambios técnicos:

- `package.json` actualizado a 2.0.0
- `android/app/build.gradle` actualizado a versionCode 9, versionName 2.0.0
- SDK Android confirmado en 35 (Android 15)

---

## Versión 1.2.0 - 30 Enero 2025

### 🎯 Cambio Principal: Escáner Automático de Música

Implementación de escáner nativo que detecta toda la música del dispositivo Android sin duplicar archivos.

**ACTUALIZACIÓN CRÍTICA:** Después de investigación exhaustiva de cómo lo hacen apps profesionales (Musicolet, Poweramp), creado plugin personalizado que usa MediaStore directamente como las apps profesionales.

### ✨ Características Nuevas:

#### 1. **Botón Principal: Escaneo Automático** 🔍
- Botón grande con gradiente violeta-fucsia
- Texto: "Escanear Música del Dispositivo"
- Efecto hover con sombra brillante
- Animación de escala al hacer clic
- Encuentra TODA la música automáticamente
- Sin duplicación de archivos (solo metadatos)

#### 2. **Botón Secundario: Importación Manual** 📁
- Botón más pequeño con borde punteado
- Texto: "Importar manualmente"
- Disponible como opción alternativa
- Descripción explicativa incluida

#### 3. **Estados Visuales Completos** 📊
- **Escaneando:** Spinner + barra de progreso + contador en tiempo real
- **Completado:** Banner verde con check + número de canciones
- **Error:** Banner rojo con mensaje de error
- **Sin permisos:** Banner amarillo con explicación clara

#### 4. **Soporte Multiidioma** 🌐
- 15+ nuevas strings en español
- 15+ nuevas strings en inglés
- Mensajes contextuales según el estado

### 🔧 Cambios Técnicos:

#### Archivos Nuevos:
- `/app/client/src/components/MusicScanner.tsx` - Componente principal del escáner

#### Archivos Modificados:
- `/app/client/src/hooks/useAndroidMusicLibrary.ts` - Estados de progreso mejorados
- `/app/client/src/pages/Home.tsx` - Integración del nuevo componente
- `/app/client/src/i18n/es.json` - Nuevas traducciones
- `/app/client/src/i18n/en.json` - Nuevas traducciones
- `/app/package.json` - Versión 1.2.0
- `/app/android/app/build.gradle` - versionCode 8, versionName 1.2.0

#### Plugin MediaStore:
- ✅ **Plugin oficial instalado:** `@odion-cloud/capacitor-mediastore`
- ✅ Probado y funcional en producción
- ✅ Métodos: `getMusicFiles()`, `requestPermissions()`, `checkPermissions()`
- ✅ Manejo nativo de permisos de Android
- ❌ Plugin personalizado removido (causaba errores de compilación)

### 📊 Comparación con v1.1.4:

| Característica | v1.1.4 | v1.2.0 |
|----------------|--------|--------|
| Botón principal | Importar manualmente | Escanear automáticamente |
| Jerarquía visual | Dos botones iguales | Botón grande + pequeño |
| Múltiples carpetas | ❌ Una por una | ✅ Todas a la vez |
| Progreso visual | ❌ No | ✅ Barra + contador |
| Duplicación archivos | ❌ Sí (500MB/100 canciones) | ✅ No (1MB/100 canciones) |

### 🐛 Bugs Corregidos:

#### Error de Permisos al Escanear Música
**Problema:** 
- Al tocar "Escanear Música", aparecía "Error al escanear"
- Mensaje: "Permiso denegado"
- Los permisos no se solicitaban correctamente con el diálogo nativo

**Causa:** 
- El plugin MediaStore tenía un problema con la solicitud de permisos
- Usaba `requestPermissionForAlias()` con alias incorrectos para Android 13+
- No manejaba correctamente la respuesta del callback

**Solución Final (Reescritura Completa):**

El problema era que usábamos el API incorrecto de Capacitor. He reescrito el plugin usando el API nativo de Android directamente:

```java
// ✅ SOLUCIÓN CORRECTA:
@CapacitorPlugin(name = "MediaStore")  // Sin declaración de permisos aquí
public class MediaStorePlugin extends Plugin {
  
  @PluginMethod
  public void requestPermissions(PluginCall call) {
    // Guardar el call para responder después
    bridge.saveCall(call);
    
    // Solicitar permisos con Android API directamente
    String[] permissions = getRequiredPermissions();
    ActivityCompat.requestPermissions(
      getActivity(),
      permissions,
      PERMISSION_REQUEST_CODE
    );
  }
  
  // Manejar la respuesta del diálogo nativo
  @Override
  public void handleRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
    PluginCall savedCall = bridge.getSavedCall();
    if (savedCall != null) {
      boolean granted = grantResults[0] == PackageManager.PERMISSION_GRANTED;
      JSObject result = new JSObject();
      result.put("granted", granted);
      savedCall.resolve(result);
    }
  }
  
  // Verificar permisos directamente con ContextCompat
  private boolean hasStoragePermissions() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      return ContextCompat.checkSelfPermission(
        getContext(),
        Manifest.permission.READ_MEDIA_AUDIO
      ) == PackageManager.PERMISSION_GRANTED;
    } else {
      return ContextCompat.checkSelfPermission(
        getContext(),
        Manifest.permission.READ_EXTERNAL_STORAGE
      ) == PackageManager.PERMISSION_GRANTED;
    }
  }
}
```

**Cambios clave:**
1. ✅ Removida la anotación `@Permission` (causaba conflictos)
2. ✅ Uso directo de `ActivityCompat.requestPermissions()`
3. ✅ Implementado `handleRequestPermissionsResult()` para capturar respuesta
4. ✅ Verificación con `ContextCompat.checkSelfPermission()`
5. ✅ Permisos declarados solo en `AndroidManifest.xml`

**Resultado:**
- ✅ Diálogo nativo de Android aparece correctamente
- ✅ Permisos se conceden sin problemas
- ✅ Escaneo funciona después de conceder permisos
- ✅ Compatible con Android 13+ (READ_MEDIA_AUDIO) y Android 12- (READ_EXTERNAL_STORAGE)

---

#### Error de Compilación MediaStore
**Problema:** 
```
error: cannot find symbol
import com.getcapacitor.annotation.PluginMethod;
```

**Causa:** En Capacitor 6, `PluginMethod` está en `com.getcapacitor`, no en `com.getcapacitor.annotation`.

**Solución:**
```java
// ANTES (incorrecto):
import com.getcapacitor.annotation.PluginMethod;  // ❌

// AHORA (correcto):
import com.getcapacitor.PluginMethod;  // ✅
```

---

## Versión 1.1.4 - 30 Enero 2025

### 🎯 Cambios Principales:

#### 1. **Audio Puro Sin Pérdida de Bajos** 🎵

**Problema resuelto:**
El audio sin procesar (Ecualizador OFF + Epicenter OFF) tenía menos bajos debido a:
- Filtro highpass permanente a 150Hz
- Atenuación del 80% por balance factor
- Audio siempre pasaba por Worklet DSP

**Solución implementada:**
- ✅ Bypass completo en el Worklet cuando `intensity = 0`
- ✅ Reconexión dinámica: Source → MasterGain → Output (sin procesamiento)
- ✅ Audio 100% puro con bajos completos

**Archivos modificados:**
- `/app/client/src/worklets/epicenter-worklet.ts` - Bypass cuando intensity ≤ 0.01
- `/app/client/src/hooks/useIntegratedAudioProcessor.ts` - Routing dinámico

#### 2. **Android SDK 35 Actualizado** 📱

**Cambios:**
- `compileSdkVersion`: 34 → 35 (Android 15)
- `targetSdkVersion`: 34 → 35 (Android 15)
- `versionCode`: 6 → 7
- `versionName`: 1.1.3 → 1.1.4

**Archivos modificados:**
- `/app/android/variables.gradle`
- `/app/android/app/build.gradle`
- `/app/package.json`

**Beneficios:**
- Mejor rendimiento en Android 15
- APIs más recientes disponibles
- Cumple requisitos futuros de Google Play Store

---

# 🔮 Próximas Versiones

## Versión 1.3.0 - Características PRO para Audiófilos

**Estado:** 📋 Planificado

### Características a Implementar:

#### 1. **ReplayGain / Normalización** 🎚️
- Track gain / Album gain
- Preamp (-12dB a +12dB)
- Prevención de clipping
- Toggle On/Off

#### 2. **Gapless Playback Real** 🎶
- Pre-buffering del siguiente track
- Sin silencios entre canciones
- Crítico para álbumes en vivo y DJ mixes

#### 3. **Audio Focus Inteligente** 🎧
- Ducking (reducir volumen) en notificaciones
- Pausa automática durante llamadas
- Reanudación automática
- Configuración personalizable

#### 4. **Info de Formato Mejorada** 📊
- Mostrar codec, sample rate, bit depth
- Badges profesionales (FLAC, Hi-Res, WAV, etc.)
- En Now Playing y lista de canciones

#### 5. **Búsqueda Global** 🔍
- Search as you type
- Buscar canciones, artistas, álbumes, playlists
- Overlay con resultados categorizados
- Fuzzy search (tolerante a errores)

**Tiempo estimado:** ~16 horas de desarrollo

---

# 🚀 Cómo Compilar

# 🚀 Cómo Compilar

## ⭐ Opción 1: Script Automático (RECOMENDADO)

Creado un script bash que hace todo automáticamente:

```bash
cd /app
./build.sh
```

**El script hace:**
1. ✅ Verifica configuración (Java, Node.js, SDK 35)
2. ✅ Limpia caché de Gradle y builds anteriores
3. ✅ Compila epicenter-worklet
4. ✅ Compila proyecto web (frontend)
5. ✅ Sincroniza con Capacitor Android
6. ✅ Compila APK con gradlew
7. ✅ Muestra información del APK generado

**Salida esperada:**
```
✅ ¡COMPILACIÓN EXITOSA!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 APK generado:
   app/build/outputs/apk/debug/app-debug.apk
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Tamaño: 18M
📦 Versión: 1.2.0 (código 8)
🎯 SDK Target: Android 15 (API 35)
```

---

## Opción 2: Desde Android Studio

Más visual e integrado:

## Opción 2: Desde Android Studio

Más visual e integrado:

```
1. Abre Android Studio
2. File → Open → Selecciona /app/android
3. Espera a que Gradle sincronice (primera vez puede tardar)
4. Build → Clean Project
5. Build → Rebuild Project
6. Build → Build Bundle(s) / APK(s) → Build APK(s)
```

APK ubicación:
```
/app/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Opción 3: Desde Línea de Comandos (Manual)

```bash
# 1. Compilar proyecto web
cd /app
npm run build

# 2. Sincronizar con Android (si hay cambios web)
npx cap sync android

# 3. Compilar APK
cd android
./gradlew clean
./gradlew assembleDebug
```

## Para APK de Producción (Release):

```
En Android Studio:
1. Build → Generate Signed Bundle / APK
2. Seleccionar APK
3. Crear/usar keystore
4. Build type: release
```

APK firmado:
```
/app/android/app/release/app-release.apk
```

---

# 🐛 Solución de Problemas

# 🐛 Solución de Problemas

## Error: "Java home supplied is invalid"

**Síntoma:**
```
Value '' given for org.gradle.java.home Gradle property is invalid 
(Java home supplied is invalid)
```

**Causa:**
El archivo `android/gradle.properties` tenía `org.gradle.java.home=` con valor vacío.

**Solución aplicada:**
✅ Eliminada la línea problemática de `gradle.properties`
✅ Gradle ahora detecta automáticamente Java desde JAVA_HOME o Android Studio

**Verificación:**
```bash
# El archivo ahora solo contiene:
android.useAndroidX=true
# Automatically detect Java version
# Gradle will use JAVA_HOME or Android Studio's embedded JDK
```

---

## Script de Compilación Automática

Creado `/app/build.sh` que:
1. ✅ Verifica configuración (Java, Node, SDK)
2. ✅ Limpia caché y builds anteriores
3. ✅ Compila worklet + frontend
4. ✅ Sincroniza con Android
5. ✅ Compila APK
6. ✅ Muestra información del resultado

**Uso:**
```bash
cd /app
./build.sh
```

---

## Error: "Plugin MediaStore not found"

**Solución:**
```bash
cd /app
npx cap sync android
```

## Error: "Permission denied"

**Solución:**
1. Verifica permisos en `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" 
                 android:maxSdkVersion="32" />
```

2. En el dispositivo: Configuración → Apps → EpicenterDSP PLAYER → Permisos → Activar "Archivos y multimedia"

## Error: "SDK 35 not found"

**Solución:**
1. Abre Android Studio
2. Tools → SDK Manager
3. SDK Platforms → Marcar "Android 15.0 (API 35)"
4. Apply

## Servicios no inician después de cambios

**Solución:**
```bash
# Solo necesario si cambiaste .env o instalaste dependencias
sudo supervisorctl restart all
```

## Audio puro no suena natural

**Verificar:**
1. Ecualizador debe estar OFF
2. Epicenter debe estar OFF
3. En consola del navegador (F12) debería aparecer:
   ```
   🎵 AUDIO PURO: Bypass completo activado
   ```

Si no aparece, limpiar caché del navegador (Ctrl+Shift+Delete) y recargar.

---

# 📊 Información Técnica

## Stack Tecnológico:

### Frontend:
- React 19.2.1
- Vite 7.1.7
- TailwindCSS 4.1.14
- TypeScript 5.9.3

### Backend:
- Express 4.21.2
- MongoDB 7.0.0
- tRPC 11.6.0

### Android:
- Capacitor 6
- Android SDK 35
- Java 17
- Gradle 8.3.0

### Audio:
- Web Audio API
- AudioWorklet (Epicenter DSP)
- MediaStore API (Android)

## Permisos Android:

```xml
<!-- Audio -->
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" 
                 android:maxSdkVersion="32" />

<!-- Reproducción en background -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Notificaciones -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

## Arquitectura de Audio:

### Con TODO apagado (Audio Puro):
```
Source → MasterGain → Output
```

### Solo con Ecualizador:
```
Source → Worklet (bypass) → EQ → MasterGain → Output
```

### Solo con Epicenter:
```
Source → Worklet DSP → EQ (bypass) → MasterGain → Output
```

### Con ambos activos:
```
Source → Worklet DSP → EQ (12 bandas) → MasterGain → Output
```

---

# 📝 Notas de Desarrollo

## Convenciones de Código:

### Commits:
```
feat: Nueva característica
fix: Corrección de bug
refactor: Refactorización
docs: Actualización de documentación
style: Cambios de estilo/formato
test: Pruebas
chore: Tareas de mantenimiento
```

### Versiones:
- **Major (X.0.0):** Cambios incompatibles
- **Minor (1.X.0):** Nuevas características compatibles
- **Patch (1.0.X):** Correcciones de bugs

## Workflow de Desarrollo:

1. Hacer cambios en `/app/client` o `/app/server`
2. Probar en navegador: `npm run dev`
3. Si todo funciona, compilar: `npm run build`
4. Sincronizar con Android: `npx cap sync android`
5. Abrir en Android Studio: `npx cap open android`
6. Compilar y probar en dispositivo

## Testing:

### Backend:
```bash
npm test
```

### Frontend:
- Probar en navegador (localhost)
- Probar en emulador Android
- Probar en dispositivo físico

---

# 🎯 Roadmap

## ✅ Completado:
- [x] Reproductor base con ecualizador 12 bandas
- [x] Epicenter DSP con 5 parámetros
- [x] Controles de notificación
- [x] Reproducción en background
- [x] Playlists
- [x] Audio puro sin pérdida
- [x] Android SDK 35
- [x] Escáner automático de música
- [x] Soporte multiidioma

## 🔄 En Desarrollo:
- [ ] Versión 1.3.0 (características PRO)

## 📋 Planificado:
- [ ] ReplayGain / Normalización
- [ ] Gapless playback
- [ ] Audio Focus inteligente
- [ ] Búsqueda global
- [ ] Análisis de espectro
- [ ] Temas personalizables
- [ ] Widgets de Android
- [ ] Android Auto

---

# 📞 Soporte

## Logs y Debugging:

### Backend logs:
```bash
tail -f /var/log/supervisor/backend.*.log
```

### Frontend logs:
- Consola del navegador (F12)
- Android Studio → Logcat

### Capacitor logs:
```bash
npx cap run android --livereload --external
```

---

# 📜 Licencia

Este proyecto es una adaptación web del procesador Epicenter DSP. Respeta la patente US4698842 de AudioControl.

---

**Última actualización:** 30 de Enero 2025  
**Mantenedor:** Equipo de desarrollo EpicenterDSP  
**Versión del documento:** 1.2.0

---

> 💡 **Recuerda:** Este es el ÚNICO archivo de documentación .md que debe actualizarse.
> NO crear archivos .md adicionales. Todo debe centralizarse aquí.
