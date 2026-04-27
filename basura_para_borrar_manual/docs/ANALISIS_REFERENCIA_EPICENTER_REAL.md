# Análisis de referencia: Epicenter real vs worklet actual

## Contexto

Se compararon dos archivos FLAC de la misma canción:

- `Carin Leon - Que Vuelvas.flac` — versión sin Epicenter.
- `Carin Leon - Que Vuelvas epicenter.flac` — versión extraída del procesamiento del **Epicenter real**.

La finalidad de este documento es usar esa referencia real para entender **cómo sí suena el hardware** y contrastarlo con la topología del DSP actual dentro de `Epicenter-Player-main (1).zip`.

## Verificación de comparabilidad

Ambos archivos son directamente comparables:

- 44.1 kHz
- 24-bit
- estéreo
- misma duración exacta: `169.4230839 s`

Esto permite tratar las diferencias como una consecuencia real del procesamiento y no como un problema de formato o duración.

## Comportamiento medido del Epicenter real

Comparando el FLAC procesado contra el FLAC seco, el Epicenter real hace esto:

### Cambios por bandas

- **20–40 Hz:** `+20.49 dB`
- **40–63 Hz:** `+3.08 dB`
- **63–120 Hz:** `-5.35 dB`
- **120–250 Hz:** `-6.04 dB`

### Niveles generales

- RMS seco: `-12.17 dBFS`
- RMS Epicenter real: `-9.45 dBFS`

### Loudness perceptual

Medido con `ebur128`:

- seco: `-9.3 LUFS`
- Epicenter real: `-10.8 LUFS`

Interpretación: el hardware real mete **más energía eléctrica total**, pero no necesariamente más “volumen percibido”, porque gran parte del incremento está cargado hacia el subgrave.

### Dinámica del low-end

Crest factor 20–120 Hz:

- seco: `19.51 dB`
- Epicenter real: `12.71 dB`

Interpretación: el low-end del Epicenter real es mucho más **denso, sostenido y comprimido**.

### Imagen estéreo

Correlación L/R:

- seco: `0.9388`
- Epicenter real: `0.9822`

Interpretación: el procesamiento vuelve el bajo bastante más **mono/centrado**.

### Cercanía al techo digital

Muestras con `|sample| >= 0.9999`:

- seco: `0`
- Epicenter real: `409,567` (`2.74%` de las muestras)

Además, `ffmpeg` reportó true peak aproximado de:

- seco: `0.2 dBFS`
- Epicenter real: `0.8 dBFS`

Interpretación: el resultado deseado está claramente **muy caliente**, con baja reserva de headroom.

## Qué implica esto sobre la firma tonal real

La referencia del Epicenter real **no** es simplemente “sumar un subgrave debajo y dejar todo lo demás intacto”.

Su firma medida parece ser esta:

1. suma una cantidad muy fuerte de subgrave profundo;
2. refuerza algo la zona 40–63 Hz;
3. **reduce parte del cuerpo 63–250 Hz** del programa original;
4. centra más el grave en mono;
5. densifica el low-end y lo acerca al techo digital.

En otras palabras: la referencia real sí tiene un componente de **remix/re-balance** del low-end, no solo de adición pura.

## Auditoría del worklet actual dentro del ZIP

Se inspeccionó `client/src/worklets/epicenter-worklet.ts` del ZIP y el algoritmo actual hace, a grandes rasgos, lo siguiente:

1. procesa **por canal**, no desde una ruta mono compartida;
2. usa una extracción armónica con:
   - lowpass en `sweepFreq * 4`
   - highpass en `sweepFreq * 1.5`
3. detecta envolvente y luego genera:
   - una ruta a **half frequency**
   - otra a **quarter frequency**
4. mezcla ambas con proporción aproximada `0.6 / 0.4`;
5. toma la señal “dry” desde un **high-pass a 150 Hz** (`voiceHighpass`);
6. mezcla como algo cercano a:
   - `voiceHighpass + restoredBass`
7. aplica soft clipping al final;
8. calcula `widthFactor`, pero ese valor no gobierna realmente la topología;
9. el parámetro `volume` se limita internamente a `1.0`, así que por encima de 100 pierde efecto real.

## Mismatch entre la referencia real y el worklet actual

### 1. El hardware real sí parece hacer remix del low-end, pero no como el worklet actual

El análisis de audio real mostró caída en `63–250 Hz`, así que la referencia deseada sí altera el balance del grave original.

Pero el worklet actual lo hace de forma demasiado extrema y poco musical porque empuja el programa “dry” a una ruta `high-pass` de **150 Hz** y luego reemplaza lo demás con bajo sintetizado. Eso probablemente elimina demasiada información útil del bajo y del kick.

### 2. La ruta `half + quarter frequency` no coincide bien con la referencia

El resultado deseado del Epicenter real tiene muchísimo 20–40 Hz, pero el camino actual mezcla media y cuarta frecuencia de forma fija. Eso se parece más a un sintetizador de subarmónicos genérico que a una reconstrucción selectiva del fundamental dominante.

### 3. Falta una ruta mono principal de análisis

La referencia real vuelve el grave más mono y más central. El worklet actual no construye una ruta compartida `L+R` para la detección principal.

### 4. `width` hoy casi no modela el carácter real

El análisis del código indica que `widthFactor` se calcula, pero no participa de forma decisiva en la banda detectora, en la selección tonal ni en el remix.

### 5. La salida final del worklet probablemente no replica la curva observada

La referencia real muestra esta firma:

- subgrave muy arriba;
- 40–63 algo arriba;
- 63–250 algo abajo;
- low-end más denso;
- más mono.

El worklet actual intenta algo parecido, pero lo hace con una topología demasiado brusca:

- detector por canal;
- reemplazo agresivo del low-end original;
- mezcla fija de half/quarter;
- high-pass demasiado alto para la ruta “dry”.

## Conclusión corregida respecto al diagnóstico anterior

El análisis previo sugería conservar casi todo el low-end original. A la luz de la nueva referencia, esa conclusión debe refinarse:

- el Epicenter real **sí** parece re-balancear y vaciar algo de la zona `63–250 Hz`;
- pero **no** conviene hacerlo con una sustitución tan brusca como `voiceHighpass(150 Hz) + bass`.

La dirección correcta para la app no es “preservar todo el low-end” ni “reemplazarlo casi completo”, sino algo intermedio:

- preservar el programa full-range;
- añadir fundamental sintetizado muy centrado;
- aplicar una **atenuación controlada y más musical** en la zona `~70–180 Hz` o `~80–200 Hz` del low-end original;
- densificar la ruta sintetizada sin destruir el cuerpo del programa.

## Arquitectura recomendada para acercarse al Epicenter real

### 1. Ruta mono de análisis

Usar:

- `mono = 0.5 * (L + R)`
- `diff = 0.5 * (L - R)`

La detección principal debe salir de `mono`.

### 2. Banda detectora más parecida a la referencia

Detector principal aproximado en:

- `55–110 Hz` o `58–118 Hz`

con prioridad a la componente más baja si hay ambigüedad.

### 3. Generar principalmente el fundamental dominante

Base del algoritmo:

- detectar el armónico dominante en esa banda;
- sintetizar principalmente `f/2`.

`f/4` debería quedar como modo experimental, no como mezcla base fija.

### 4. Reinyección + remix controlado

La mezcla recomendada debe parecerse más a esto:

- `output = dry_fullrange + mono_generated_sub - controlled_lowmid_dip`

Donde `controlled_lowmid_dip` no sea un high-pass duro a 150 Hz, sino una atenuación más limitada en una banda como:

- `70–180 Hz`
- o `80–200 Hz`

### 5. Afinación tonal objetivo

Tomando la referencia real como target inicial:

- **20–40 Hz:** gran incremento
- **40–63 Hz:** incremento moderado
- **63–120 Hz:** ligera a moderada caída
- **120–250 Hz:** ligera a moderada caída

### 6. Imagen estéreo

- la ruta sintetizada debe ser principalmente **mono**;
- la ruta dry original no debe colapsarse completa a mono.

### 7. Dinámica

- comprimir / saturar suavemente solo la ruta sintetizada;
- dejar margen interno de headroom;
- usar limitador final suave para evitar picos excesivos.

## Parámetros iniciales sugeridos para una nueva versión del worklet

- detector mono: sí
- banda detectora: `58–118 Hz`
- síntesis principal: `f/2`
- LPF de la ruta sintetizada: `55–65 Hz`
- HPF de la ruta sintetizada: `22–25 Hz`
- atenuación controlada del low-mid original: centrada aproximadamente en `90–160 Hz`
- synth mono sumado igual a L/R
- saturación suave solo en synth path
- ceiling final conservador, por ejemplo `-1 dBTP`

## Resumen ejecutivo final

La referencia del **Epicenter real** sí muestra una firma específica y replicable:

- subgrave enorme y centrado;
- algo más de 40–63 Hz;
- menos 63–250 Hz;
- low-end más denso;
- salida mucho más caliente.

El worklet actual apunta a esa idea, pero la implementa con una topología demasiado rudimentaria:

- por canal;
- con `half + quarter frequency` fijo;
- con `voiceHighpass` a 150 Hz;
- y sin un remix fino del low-end original.

Si la app quiere acercarse de verdad al hardware real, el siguiente paso correcto es rediseñar el DSP alrededor de:

- detección mono,
- generación dominante a `f/2`,
- sub synth mono,
- dip controlado de low-mid,
- y mezcla más parecida a la curva tonal observada en la referencia real.
