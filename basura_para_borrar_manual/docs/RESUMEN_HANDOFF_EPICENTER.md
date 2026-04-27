# Resumen handoff - Epicenter / Bass restoration

## Contexto general

El objetivo del proyecto es acercar el DSP de Epicenter a la sensación del **AudioControl Epicenter real**: un bajo más **profundo**, **suave**, **natural** y menos **seco**.

Durante esta conversación se revisó:

- la arquitectura general del proyecto Epicenter;
- la patente **US 4,698,842** que el usuario adjuntó;
- el worklet actual `client/src/worklets/epicenter-worklet.ts` (inspeccionado desde el ZIP del proyecto);
- y se intentó preparar una comparación con audios de referencia, pero los archivos de audio nunca aparecieron visibles dentro del contenedor.

## Lo que el usuario quiere lograr

El usuario explicó que el DSP actual ya va avanzado, pero todavía no suena como el Epicenter real.

La diferencia subjetiva reportada por el usuario es:

- el bajo actual suena **algo seco**;
- no se siente tan **profundo**;
- la reconstrucción no tiene la misma suavidad o naturalidad del aparato original;
- el ideal sería comparar una canción original contra la misma canción procesada por un Epicenter real para entender qué está faltando.

## Qué se entendió de la patente

A partir de la patente adjuntada se extrajeron estas ideas clave:

1. El sistema no es solo un generador genérico de subarmónicos.
2. Combina L+R a una ruta **mono** para análisis.
3. Usa un **filtro de banda** orientado a los segundos armónicos relevantes del fundamental perdido.
4. La banda está ponderada para dar prioridad al componente de menor frecuencia.
5. Se genera una señal a **la mitad de la frecuencia dominante** detectada (`f/2`).
6. Esa señal se **reinyecta** en ambos canales de salida.
7. Hay una lógica de **detección voz/música** basada en mono vs diferencial para evitar artefactos en material vocal.
8. También hay una lógica de compuerta/remix para que el efecto no entre y salga de forma brusca.

## Qué se encontró en el algoritmo actual

Tras inspeccionar el worklet actual, se detectaron varios puntos importantes:

### 1. Procesamiento por canal

El DSP actual mantiene estado por canal y no construye una ruta mono principal de análisis equivalente a la patente.

### 2. Mezcla final que probablemente retira demasiado del grave original

La salida actual parece aproximarse más a:

- contenido high-passed / “voz”
- más bajo sintetizado

Eso puede explicar parte de la sensación de bajo separado o seco.

### 3. Banda de detección no alineada con la patente

El detector actual usa una combinación más genérica de `lowpass` y `highpass` escalados por `sweepFreq`, en lugar de una banda ponderada tipo patente que favorezca aproximadamente la región **55–120 Hz** y el contenido más bajo dentro de esa banda.

### 4. Falta de bloque claro equivalente al discriminador voz/música

La patente dedica bastante arquitectura a evitar coloración en voz. El algoritmo actual no replica de forma clara esa misma lógica.

### 5. `width` no está teniendo un rol decisivo

En el worklet actual se calcula `widthFactor`, pero no está gobernando de manera decisiva el carácter real del detector o del ancho efectivo del efecto.

### 6. Ruta `half + quarter frequency`

El algoritmo actual mezcla una componente a media frecuencia y otra a cuarta frecuencia. Eso puede servir como efecto creativo, pero no necesariamente como aproximación fiel al Epicenter original, cuyo corazón parece ser la reconstrucción selectiva del **fundamental dominante**.

## Hipótesis principal de por qué suena seco

La hipótesis principal acordada fue esta:

1. el DSP actual probablemente **retira demasiado grave original** del programa;
2. el detector no está reconstruyendo el fundamental desde una lógica suficientemente parecida a la patente;
3. la reinyección no está ocurriendo como una suma natural sobre el programa full-range original;
4. falta una lógica musical de activación/desactivación para material vocal o mono.

En resumen: el algoritmo actual parece estar más cerca de un **subharmonic synthesizer genérico** que de un **restaurador selectivo de fundamental al estilo Epicenter**.

## Plan técnico que ya quedó documentado

Se dejó documentado un plan de mejora específico en `PLAN_MEJORA_EPICENTER_BAJO.md`. Los puntos principales son:

### Fase 1 - Alinear arquitectura con la patente
- crear ruta **mono** de análisis;
- usar `mono = 0.5 * (L + R)` y `diff = 0.5 * (L - R)`;
- reemplazar el detector actual por un filtro de banda ponderado tipo patente;
- detectar frecuencia dominante en esa banda;
- generar principalmente `f/2` del componente dominante;
- reinyectar el fundamental sobre la señal original completa.

### Fase 2 - Hacer el bajo más profundo y suave
- separar cantidad, profundidad, ancho y blend;
- usar envolvente más estable para la amplitud del fundamental;
- poner saturación/limitación suave solo en la ruta sintetizada;
- conservar más del low-end original.

### Fase 3 - Añadir la lógica “musical”
- implementar detector simple de voz/música inspirado en la patente;
- añadir compuerta con histéresis, ataque, release y hold.

### Fase 4 - Afinación por referencia
- crear modos como `OEM/Tight`, `Classic Epicenter` y `Extreme Demo`;
- medir energía 25–40 Hz, 40–63 Hz, relación armónica, crest factor y estabilidad estéreo;
- ajustar usando referencias reales de audio.

## Intento de análisis con audios reales

Se intentó varias veces localizar en el contenedor estos archivos que el usuario mencionó:

- `Carin León & Grupo Frontera - Que Vuelvas EPICENTER.mp3`
- `Carin León, Grupo Frontera - Que Vuelvas Audio.mp3`
- `audios.zip`

Sin embargo, en todos los escaneos del repo y de rutas comunes del entorno, **los archivos nunca aparecieron visibles en el filesystem del contenedor**.

Esto significa que no se pudo ejecutar todavía un análisis espectral/comparativo real del audio del usuario.

## Qué análisis estaba previsto hacer cuando aparezcan los audios

En cuanto los audios estén visibles en el contenedor, el plan es:

1. identificar sample rate, duración y niveles;
2. comparar original vs Epicenter real;
3. si existe, comparar también contra el DSP actual;
4. medir:
   - energía por bandas de grave;
   - contenido 25–40 / 40–63 / 63–120 Hz;
   - relación entre segundo armónico y fundamental reconstruido;
   - componente mono vs diferencial;
   - estabilidad del grave;
   - evidencia de reemplazo de grave original vs suma natural;
5. usar eso para decidir cambios concretos al worklet.

## Qué habría que hacer en el siguiente contenedor

1. Confirmar si los audios realmente están visibles en `/workspace/EPI` o en otra ruta.
2. Si están en ZIP, extraerlos.
3. Hacer el análisis comparativo técnico de audio.
4. Documentar hallazgos objetivos.
5. Después de eso, ya sí pasar a rediseñar o modificar `epicenter-worklet.ts`.

## Archivos de contexto que quedaron en el repo

- `ANALISIS_EPICENTER.md`
- `PLAN_MEJORA_EPICENTER_BAJO.md`
- `RESUMEN_HANDOFF_EPICENTER.md`

## Resumen corto final

Lo más importante que no se debe perder del contexto es esto:

- el usuario no quiere “más subgrave” sin control;
- quiere un bajo más parecido al **Epicenter real**;
- el problema parece más de **arquitectura del detector/remix** que solo de ganancia;
- la referencia principal es la patente + comparación con audio real;
- la siguiente gran tarea depende de que los audios de referencia sí sean visibles dentro del contenedor.
