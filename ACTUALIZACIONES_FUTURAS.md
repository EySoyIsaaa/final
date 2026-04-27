# Actualizaciones futuras de Epicenter Player

**Registro vigente:** v5.0.0  
**Fecha de actualización:** 27 de marzo de 2026

## Contexto estratégico (Inovatec)

Epicenter Player sigue siendo un reproductor musical, pero la ruta de producto se centra en el núcleo **Epicenter DSP** y en la **implementación de IA** como principal factor de innovación frente a reproductores convencionales.

---

## Objetivo general

Llevar la app a un estado más sólido en cinco frentes:

1. **Arquitectura más mantenible**
2. **Mejor experiencia de usuario**
3. **Mayor confiabilidad y testing**
4. **Mejor rendimiento en bibliotecas grandes**
5. **Repositorio más limpio y fácil de operar**

---

## Prioridades recomendadas

### Prioridad alta

- Reducir la complejidad de `Home.tsx` y mover más lógica a controllers/hooks especializados.
- Agregar tests para cola, playlists, búsqueda, persistencia y DSP.
- Limpiar el repositorio de archivos temporales, basura manual y artefactos que no deberían versionarse.
- Unificar logging, manejo de errores y mensajes de usuario.
- Mejorar rendimiento para bibliotecas grandes.

### Prioridad media

- Mejorar la búsqueda global y navegación por biblioteca.
- Separar mejor la lógica web vs Android/Capacitor.
- Refinar DX: scripts, documentación técnica, convenciones y estructura de carpetas.
- Revisar dependencias y bundle size.

### Prioridad baja

- Mejoras visuales incrementales.
- Métricas internas y telemetría opcional.
- Funciones avanzadas de playlists inteligentes o perfiles de sonido.

---

## Hoja de ruta sugerida

## Fase 1 — Estabilidad y orden

### 1. Limpieza del repositorio

- Eliminar archivos temporales, pruebas manuales, basura de handoff y assets obsoletos.
- Revisar `.gitignore`.
- Definir reglas para:
  - assets originales
  - binarios exportados
  - reportes temporales
  - documentación interna

### 2. Estandarización de estructura

- Mantener `pages/`, `components/`, `hooks/`, `lib/`, `audio/` bien delimitados.
- Mover tipos de dominio compartidos a módulos dedicados.
- Evitar que tipos importantes vivan “pegados” a componentes visuales cuando representan dominio.

### 3. Logging y errores

- Reemplazar `console.log/error` dispersos por un logger único.
- Separar:
  - error técnico
  - error recuperable
  - feedback para usuario
- Normalizar uso de toasts y mensajes.

---

## Fase 2 — Arquitectura

### 4. Seguir desmontando el Home principal

Aunque ya hubo una separación visual, todavía conviene extraer lógica a hooks/controladores.

#### Posibles módulos

- `useHomePlaybackController`
- `useHomeLibraryController`
- `useHomePlaylistController`
- `useHomeSearchController`
- `useHomeAutoOptimizationController`

### 5. Separación UI / dominio / plataforma

Separar mejor:

- **UI**: componentes de presentación
- **Dominio**: cola, playlists, reglas de reproducción, DSP params
- **Plataforma**: Android MediaStore, Capacitor, permisos, archivos nativos

### 6. Reducir acoplamiento entre hooks grandes

Hooks como los de audio, cola y biblioteca tienen mucha responsabilidad.
La idea futura debería ser:

- lógica pura testable fuera de React
- hooks como adaptadores de estado y efectos

---

## Fase 3 — Testing

### 7. Cobertura mínima recomendada

#### Cola de reproducción

- `playNow`
- `playAllInOrder`
- `shuffleAll`
- `addToQueueNext`
- `reorderQueue`
- control de índices y casos vacíos

#### Playlists

- crear, renombrar, borrar
- resolver `trackIds -> tracks`
- evitar duplicados
- persistencia

#### Audio / DSP

- clamping de parámetros
- EQ default bands
- activación/desactivación de Epicenter y EQ
- recuperación de estado guardado

#### Biblioteca y búsqueda

- búsqueda por título/artista
- ordenamiento
- agrupación por artista/álbum
- paginación / carga incremental

### 8. Tipos de pruebas recomendadas

- **unit tests** para lógica pura
- **component tests** para vistas críticas
- **integration tests** para flows de importación, cola y playlists

---

## Fase 4 — Rendimiento

### 9. Optimización para bibliotecas grandes

- Virtualización de listas largas.
- Memoización más agresiva para agrupaciones y filtros.
- Índices derivados para búsqueda y navegación.
- Menos trabajo por render en `Home`.

### 10. Carga de metadata y artwork

- Cache más explícita.
- Estrategias para evitar trabajo repetido con carátulas.
- Medir costo real de reconstrucción de estado desde IndexedDB.

### 11. Bundle y dependencias

- Revisar dependencias pesadas.
- Evaluar lazy loading de vistas menos usadas.
- Revisar imports nativos vs web.

---

## Fase 5 — Producto / UX

### 12. Mejoras de búsqueda

- Buscar también por álbum.
- Mejor tolerancia a tildes y variantes.
- Ranking simple de resultados.
- Historial de búsquedas recientes.
- Filtros rápidos.

### 13. Biblioteca y playlists

- Mejor vista por álbum real.
- Portadas compuestas para playlists.
- Orden manual dentro de playlists.
- Selección múltiple y acciones masivas.
- Smart playlists a futuro.

### 14. Reproducción y continuidad

- Recuperación de cola completa, no sólo último track.
- Mejor feedback en errores de carga de audio.
- Estado de reproducción más resiliente al reinicio.
- Ajustes más finos de crossfade.

### 15. Accesibilidad y pulido

- Mejorar labels y navegación por teclado.
- Revisar contrastes y feedback visual.
- Validar UX móvil en pantallas pequeñas.

---

## Oportunidades técnicas concretas

### A. Crear una carpeta `domain/`

Ejemplo:

- `client/src/domain/audio/`
- `client/src/domain/library/`
- `client/src/domain/playlists/`

Ahí podrían vivir:

- tipos compartidos
- helpers puros
- reglas de negocio
- selectores

### B. Crear adapters de plataforma

Ejemplo:

- `client/src/platform/android/`
- `client/src/platform/web/`

Para encapsular:

- MediaStore
- Capacitor plugins
- permisos
- acceso a archivos

### C. Definir un estándar para estado derivado

Para evitar recalcular demasiado:

- selectores memoizados
- utilidades puras
- hooks específicos por preocupación

---

## Checklist sugerido para futuras PRs

Antes de mergear cambios importantes:

- [ ] ¿La lógica nueva quedó fuera de componentes grandes si era posible?
- [ ] ¿Se agregaron o ajustaron tests?
- [ ] ¿Se evitó meter archivos temporales o binarios al repo?
- [ ] ¿Se respetó la separación entre UI, dominio y plataforma?
- [ ] ¿El manejo de errores es consistente?
- [ ] ¿El cambio afecta rendimiento con bibliotecas grandes?
- [ ] ¿Hace falta actualizar documentación?

---

## Plan 30 / 60 / 90 días

### 30 días

- limpiar repo
- ordenar documentación base
- unificar logging
- agregar tests de cola y playlists
- reducir más responsabilidad de `Home.tsx`

### 60 días

- optimizar búsqueda y listas grandes
- extraer capa de dominio compartido
- mejorar integración Android/Capacitor
- reforzar persistencia y recuperación de sesión

### 90 días

- playlists avanzadas
- mejores vistas de biblioteca
- profiling de rendimiento real
- bundle audit
- accesibilidad y polish final

---

## Nota final

La app ya tiene una base potente. La mejor evolución futura no pasa por rehacer todo,
sino por **ordenar la arquitectura**, **blindar la lógica con tests** y **mejorar rendimiento + UX**
en los puntos donde más se nota el uso real.
