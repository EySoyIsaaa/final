# Plan técnico para acercar el DSP al bajo del AudioControl Epicenter

## Objetivo

Lograr un bajo más **profundo, suave y natural**, más cercano al comportamiento del Epicenter original, evitando que el resultado suene **seco**, **hueco** o demasiado **sintético**.

## Diagnóstico rápido del problema actual

El worklet actual sí intenta reconstruir subarmónicos, pero su topología no está alineada del todo con la patente original. El resultado probable es:

- bajo reconstruido, pero con menos “peso orgánico”;
- mezcla con menos cuerpo en la zona 70–140 Hz;
- exceso de sensación de subgrave aislado en vez de grave integrado;
- mayor riesgo de artefactos en voz o material mono.

## Qué hace conceptualmente la patente

A partir de la patente que adjuntaste, el comportamiento clave del sistema original es este:

1. **Suma L+R a mono** para el detector principal.
2. **Filtra una banda concreta de graves/segundos armónicos**, no todo el low-end indiscriminadamente.
3. **Da prioridad al componente de menor frecuencia** dentro de esa banda por la forma del filtro.
4. **Demodula a la mitad de frecuencia** del componente dominante para reconstruir el fundamental faltante.
5. **Reinyecta ese fundamental en ambos canales**, en vez de reemplazar agresivamente el contenido original.
6. **Desactiva o atenúa la reconstrucción cuando detecta voz** mediante comparación mono vs diferencial (L-R).

En otras palabras: no es simplemente “generar subarmónicos”, sino **detectar el segundo armónico correcto, extraer el fundamental faltante y sumarlo de manera controlada al programa original**.

## Qué está fallando en el algoritmo actual

## 1. Está procesando por canal, no desde una ruta mono compartida

El worklet actual mantiene estado por canal y extrae armónicos por separado. Eso se aparta del esquema de la patente, donde el camino de detección es principalmente **monaural**.

**Consecuencia sonora:**
- menor coherencia del grave reconstruido entre L y R;
- menos “centro” en el bajo;
- sensación más artificial o menos sólida.

## 2. Está reemplazando demasiado el contenido original de graves

La mezcla final actual usa un canal de “voz” derivado con high-pass y luego suma el bajo restaurado. Eso sugiere que parte importante del low-end original está siendo desplazada por el sintetizado.

**Consecuencia sonora:**
- el bajo pierde naturalidad;
- puede sentirse “seco” porque desaparece parte del cuerpo original del programa;
- el subgrave queda separado del resto del contenido.

## 3. La banda de detección no coincide bien con la lógica del Epicenter

El original usa una banda ponderada aproximadamente en la región donde viven los **segundos armónicos del fundamental perdido**, con prioridad hacia el extremo bajo de esa banda. El worklet actual usa una combinación más genérica de lowpass/highpass escalados por `sweepFreq`, pero no replica la respuesta característica de la patente.

**Consecuencia sonora:**
- el detector puede estar respondiendo a contenido demasiado amplio;
- se pierde selección del armónico correcto;
- la reconstrucción no “cae” donde el oído espera el grave profundo real.

## 4. No hay un bloque equivalente claro al discriminador voz/música + compuerta de remix

La patente dedica bastante arquitectura a evitar que las voces activen el efecto. El algoritmo actual no tiene una aproximación equivalente suficientemente explícita.

**Consecuencia sonora:**
- la reconstrucción puede entrar cuando no debe;
- aparecen coloraciones o una sensación rara en contenido vocal/mono;
- el bajo puede sentirse menos suave y más invasivo.

## 5. El control `width` hoy no está definiendo realmente el carácter del efecto

En el worklet actual se calcula `widthFactor`, pero no está gobernando de forma decisiva la estructura del detector ni el ancho efectivo de la banda reconstruida.

**Consecuencia sonora:**
- uno de los controles importantes no está modelando el comportamiento que el usuario esperaría;
- cuesta afinar el punto exacto entre grave profundo y grave duro/seco.

## 6. La combinación `half + quarter frequency` no es la esencia del circuito original

La patente está enfocada en reconstruir el **fundamental** a partir del segundo armónico dominante. El camino actual añade una combinación de media y cuarta frecuencia, lo cual puede servir como efecto creativo, pero no necesariamente como clon tímbrico del Epicenter.

**Consecuencia sonora:**
- posibilidad de subgrave demasiado “sintético” o desacoplado;
- menor precisión tonal;
- menos sensación de bajo profundo pero controlado.

## Hipótesis principal de por qué hoy suena “seco”

Mi hipótesis principal es una combinación de tres cosas:

1. **se está retirando demasiado grave original** del programa;
2. **el fundamental generado no está siendo detectado desde una banda ni una lógica suficientemente parecidas a la patente**;
3. **falta un remix más suave y más dependiente del contenido musical real**.

En pocas palabras: hoy el DSP parece más un **subharmonic synthesizer genérico** que un **restaurador de fundamental al estilo Epicenter**.

## Plan de mejora propuesto

## Fase 1 — Alinear la arquitectura con la patente

### 1. Crear una ruta mono de análisis

En vez de analizar por canal de forma aislada:

- calcular `mono = 0.5 * (L + R)`;
- calcular `diff = 0.5 * (L - R)`;
- usar `mono` como señal principal para detección de armónico/fundamental;
- reinyectar el resultado en ambos canales al final.

**Objetivo:** que el grave reconstruido tenga anclaje central y más solidez.

### 2. Sustituir el detector actual por un filtro de banda ponderado tipo patente

Implementar una respuesta más parecida a la descrita:

- banda aproximada de trabajo: **55–120 Hz**;
- priorización del extremo bajo;
- variante “music mode” con cola alta hasta ~110 Hz;
- variante más cerrada con techo cercano a ~90 Hz para reducir activación por diálogo.

### 3. Detectar la frecuencia dominante dentro de esa banda

En vez de depender solo del cruce por cero/envelope simple:

- medir energía por ventanas cortas;
- estimar componente dominante en la banda objetivo;
- si hay dos componentes comparables, favorecer la más baja, como sugiere la patente.

Esto puede hacerse de dos formas:

- **rápida:** banco de filtros ponderados (60/80/110 Hz aprox.) y selección por energía;
- **mejor:** autocorrelación o detector de periodo solo en la banda filtrada.

### 4. Generar solamente el fundamental dominante

La señal sintetizada debe ser principalmente:

- una onda a **f/2** del componente dominante detectado;
- con control de fase/amplitud estable;
- sin mezclar por defecto una ruta a `f/4`.

**Recomendación:** dejar `quarter frequency` solo como modo experimental oculto, no como parte del algoritmo base.

### 5. Reinyectar sobre el programa original completo

El mix final debería parecerse más a:

`output = dry_fullrange + generated_fundamental * amount`

no a:

`output = highpassed_program + synthetic_bass`

**Este punto es probablemente el más importante para quitar la sensación seca.**

## Fase 2 — Hacer que el bajo sea profundo pero suave

### 6. Separar el control de “cantidad” del control de “profundidad”

Ahora mismo `intensity` acaba empujando mucho la síntesis, pero no necesariamente con el carácter correcto. Conviene separar:

- **Amount:** cuánto fundamental agregado se inyecta;
- **Depth / Sweep:** desde qué zona de armónicos se reconstruye;
- **Tightness / Width:** cuán ancha es la banda de detección;
- **Blend:** cuánto del bajo generado se suma al low-end original.

### 7. Añadir una envolvente lenta para amplitud, pero fase limpia para la portadora

Para que el bajo se sienta suave y no quebrado:

- usar envolvente RMS o peak suavizada para la amplitud del fundamental;
- mantener la oscilación base estable;
- evitar que cada microvariación del armónico de entrada module bruscamente la forma final.

### 8. Poner saturación suave solo en la ruta sintetizada, no en toda la mezcla

Si saturas el total, endureces el sonido. Mejor:

- limitar o saturar suavemente solo la ruta del fundamental generado;
- dejar el programa original lo más intacto posible;
- aplicar protección DC y control de headroom al final.

### 9. Mantener parte del low-end original

No eliminar agresivamente 60–120 Hz del programa original. Mejor:

- conservar el grave real existente;
- sumar el fundamental restaurado debajo o alrededor;
- usar un dry/wet inteligente, no sustitución brusca.

## Fase 3 — Añadir la lógica “musical” del Epicenter

### 10. Implementar un detector simple de voz/música inspirado en la patente

No hace falta clonar el circuito analógico exactamente, pero sí el comportamiento:

- si `mono` domina claramente y `diff` es bajo durante un tiempo sostenido, probablemente hay voz/centro mono;
- reducir o congelar la inyección del fundamental;
- usar ataque/release lentos para evitar bombeo.

### 11. Añadir compuerta de remix con histéresis

El sistema no debe prender/apagar duro muestra a muestra.

Necesitas:
- umbral de activación;
- umbral de desactivación menor;
- hold time;
- release suave.

Esto hará que el bajo reconstruido entre con más naturalidad.

## Fase 4 — Afinación auditiva y medición

### 12. Crear 3 modos de referencia

Te recomiendo trabajar con tres perfiles de prueba:

- **OEM / Tight:** más controlado, menos cola, menos riesgo en voz;
- **Classic Epicenter:** el objetivo principal;
- **Extreme Demo:** más exhibición de subgrave, pero no para usar como referencia tonal.

### 13. Medir en vez de solo escuchar

Para cada versión del DSP, comparar:

- energía en 25–40 Hz;
- energía en 40–63 Hz;
- relación entre grave reconstruido y 2º armónico original;
- crest factor del low-end;
- estabilidad estéreo del grave reconstruido.

## Orden exacto en que yo lo haría

### Sprint 1
- rehacer el detector a una ruta **mono**;
- quitar la sustitución por `voiceHighpass + bass`;
- mezclar sobre señal full-range original;
- desactivar temporalmente la ruta `quarter frequency`.

### Sprint 2
- implementar banco ponderado de banda tipo **60 / 80 / 110 Hz**;
- seleccionar componente dominante con prioridad a la frecuencia más baja;
- sintetizar solo `f/2`.

### Sprint 3
- agregar detector de voz/música basado en `mono` vs `diff`;
- agregar remix gate con ataque/release/hold;
- ajustar control real de `width`.

### Sprint 4
- calibrar oído + medición con material de prueba;
- perfilar presets;
- documentar comportamiento por género musical.

## Qué puedes enviarme para afinarlo mejor

Sí, **sería muy útil** que me pases audio. Idealmente:

1. una canción o fragmento **sin procesar**;
2. el mismo fragmento **procesado por el Epicenter real** o por el ajuste que más te guste;
3. si puedes, un fragmento con:
   - kick sostenido,
   - bajo eléctrico o synth bass,
   - voz masculina,
   - voz femenina.

## Formato ideal de referencia

Lo mejor sería:

- WAV o FLAC;
- 10 a 30 segundos;
- mismo volumen de entrada si es posible;
- archivos nombrados como:
  - `dry.wav`
  - `epicenter_real.wav`
  - `epicenter_actual.wav` (opcional)

Con eso sí puedo ayudarte a hacer una comparación mucho más precisa en términos de:

- espectro;
- envolvente;
- profundidad percibida;
- exceso o falta de 30–50 Hz;
- cuánto del carácter viene de la reconstrucción y cuánto del remix.

## Veredicto técnico

Si quieres sonar más cerca del Epicenter real, **no empezaría subiendo ganancia ni reforzando más el cuarto subarmónico**. Empezaría por esto:

1. **ruta mono de detección**;
2. **reinyección sobre la señal original completa**;
3. **filtro de banda ponderado tipo patente**;
4. **solo reconstrucción del fundamental dominante**;
5. **compuerta musical/voz para evitar artefactos**.

## Resumen en una frase

El problema no parece ser solo “falta de intensidad”; parece que al DSP actual le falta parecerse más a un **restaurador selectivo de fundamental** y menos a un **sintetizador genérico de subarmónicos**.
