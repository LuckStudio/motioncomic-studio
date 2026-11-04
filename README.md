# MotionComic Studio

Dedicado para mi gran amigo y artista GotiDraw: una herramienta para convertir tus ilustraciones de cómic en vídeo-cómic animado, sin salir del navegador. Todo se guarda en el propio equipo, sin cuentas ni servidor.

- Brief del producto: [`docs/PRD.md`](docs/PRD.md)
- Manual de marca: [`docs/brandbook.html`](docs/brandbook.html)

## Estado: paso 6 · trayectorias, efectos y rack focus

Paso 1 (hecho): inicio con proyectos locales, estudio en Modo Libre con parallax 2.5D, cámara con presets y encuadre manual, transiciones, calculadora de resolución, PWA, ES/EN, tema oscuro/claro.

Paso 2 (hecho):
- **Exportar MP4** en el navegador (WebCodecs): H.264 con audio AAC u Opus, presets por plataforma (TikTok/Reels/Shorts, YouTube 1080p y 4K, Instagram 4:5, cuadrado), fps, bitrate, rango (todo o plano actual), normalización de volumen, portada PNG y cancelar. Usa el mismo motor que el visor.
- **Importar PSD** con capas, nombres, grupos, visibilidad, opacidad y modos de fusión básicos; reconoce nombres (fondo, cielo, personaje, texto…) y avisa de capas vacías, ocultas o con nombre repetido.
- **Audio**: pistas de locución, SFX y música; importar WAV/MP3/M4A/OGG, onda visible, mover, recortar, dividir, volumen y fundidos por clip, mezcla por pista, ducking automático, grabación con micrófono y cuenta atrás, marcadores en las pausas de la voz y «ajustar planos a la voz».
- **Sonidos generados por código** (6 efectos y 3 músicas), sin licencias.

Paso 3 (hecho):
- **Texto del cómic**: bocadillos (habla, grito, pensamiento) con cola arrastrable, cajas de texto, onomatopeyas y subtítulos. Se editan en el visor (mover, cola) y en la línea de tiempo (mover, recortar).
- **Revelado** de golpe, por palabras o por letras, y **entrada animada** (pop, rebote, golpe, deslizar) con movimiento continuo opcional.
- **Sincronía con la voz**: un texto vinculado a un clip de locución aparece cuando suena su línea y se va cuando termina; la velocidad de revelado se puede ajustar a la locución.
- **Subtítulos**: se crean desde la locución (un subtítulo por frase, con su tiempo; el texto lo escribes tú, sin reconocimiento de voz), con estilo propio, y se exportan como SRT o se queman en el vídeo.
- **Multiidioma**: varias versiones del texto en el mismo proyecto y exportación de cada una.
- **Tipografías**: cuatro incluidas y subida de TTF/OTF propios, con aviso si falta alguna al abrir el proyecto en otro equipo.
- Onomatopeyas con sonido: añade un efecto de la biblioteca en el momento en que aparecen.

Paso 4 (hecho):
- **Modo Página completa**: importa páginas (PNG, JPEG, WebP; el PSD entra aplanado) y la cámara recorre las viñetas con paneo suave o salto, con permanencia según el tamaño de cada viñeta.
- **Detección de viñetas sin IA**: corte por los canales entre viñetas, con plan B por manchas conectadas. Orden de lectura occidental o manga. Se corrige en la vista «Página»: mover, cambiar esquinas, dibujar una viñeta nueva, reordenar y quitar.
- **Efecto de enfoque** (atenuación del resto de la página) y **recorrido de viñetas panorámicas** (paneo automático a lo largo de viñetas anchas o altas).
- **Convertir una viñeta en plano libre**, para combinar modos.
- **Borrador en un clic**: sube las páginas o imágenes y sale un primer montaje (viñetas, orden, cámara, duraciones y transiciones). Todo en el navegador.
- **Mi estilo**: guarda transiciones, curva de cámara, ritmo de las viñetas, parallax y tipografías; se aplica a proyectos nuevos y al borrador; se exporta e importa como archivo.
- **Simulador de plataformas** (interfaz genérica estilo TikTok, Reels y Shorts, sin marcas) para ver qué tapa la interfaz.
- **Exportación en segundo plano**: se puede cerrar la ventana y seguir editando; avisa en la barra superior cuando termina.

Paso 5 (hecho):
- **Modo Webtoon**: importa una tira vertical larga (o varias imágenes, que se apilan en una) y la cámara hace scroll con velocidad ajustable, pausas en puntos clave y zooms sobre detalles. «Sugerir pausas» propone una por bloque; en la vista «Tira» se añaden con un clic y se mueven arrastrando.
- **Importar PDF**: cada página se rasteriza a la resolución elegida (hasta 80 páginas) y entra como página, plano o parte de la tira según el modo.
- **Viñetas con polígonos libres**: dibujar con vértices, convertir un rectángulo, mover vértices y quitarlos; la cámara y el efecto de enfoque siguen la forma.
- **Exportación por lotes** con reencuadre automático: varios formatos a la vez (por ejemplo 16:9 y 9:16); en páginas y tiras la cámara se recalcula para cada formato.
- **Rendimiento y memoria**: las imágenes de más de 4096 px se editan con una copia ligera de 2048 px y la exportación usa la original; el modal de exportar estima la memoria y avisa si es mucha.

Límites recomendados (a calibrar con pruebas reales): hasta unos 100 megapíxeles de imágenes en total por proyecto en edición, y avisar a partir de ~1,8 GB estimados al exportar. Las imágenes de más de 4096 px entran con proxy, pero la exportación carga las originales: en 4K con muchos PSD pesados conviene exportar en 1080p.

Paso 6 (hecho):
- **Trayectoria de cámara dibujada** (planos libres): «Dibujar trayectoria» en el inspector convierte el movimiento en varios puntos; en la vista «Cámara» se arrastran los marcos, se cambia su zoom, se añaden y se quitan, con permanencia en cada punto y tiempo de viaje al siguiente. La duración del plano es la suma.
- **Animación dentro de la viñeta**: temblor, golpe de impacto (con destello y, si quieres, sonido), pulso y vibración. Se aplican a todo el plano, a una capa o a una viñeta (empiezan cuando la cámara llega a ella), con intensidad y duración propias.
- **Efectos de acción y ambiente**: líneas de velocidad y de concentración, aberración cromática, destello de color, lluvia, polvo, chispas, nieve y humo.
- **Rack focus**: el enfoque pasa de una capa a otra con su momento, duración y desenfoque.
- **Aspecto global**: viñeteado, grano de película, tramado de cómic (halftone) y tinte de color.
- Todo se dibuja con el mismo motor que el visor, así que sale igual en la exportación.

Medidas con un PSD sintético de 3000×4500 y 15 capas (Chromium sin GPU): importación 2,6 s, ≈ 9 ms por fotograma a 1080p, ≈ 205 MB de imágenes en edición. Faltan pruebas con los archivos reales de Goti.

Siguiente (paso 7): pruebas con archivos reales y ajuste de límites, accesibilidad y teclado completo, tutoriales cortos desde el menú de ayuda, atajos configurables y presets nombrados de cámara y efectos.

Pendiente conocido: las capas de un PSD en modo Página entran aplanadas, el efecto de enfoque de un polígono salta de la caja a la forma al llegar a la viñeta, y los PDF con tipografías CJK no embebidas pueden verse con fuentes de reserva.

## Ejecutar

No necesita compilar. Sirve la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`. Para generar el archivo único de previsualización: `node tools/build.js` (crea `dist/artifact.html`).

## Estructura

- `src/js/render.js`: motor de cámara y parallax. El visor y la futura exportación usarán este mismo código.
- `src/js/studio.js`: interfaz del estudio. `src/js/home.js`: pantalla de inicio.
- `src/js/db.js`: guardado local y modelo de proyecto. `src/js/sample.js`: proyecto de ejemplo dibujado por código.

## Librerías incluidas (`src/vendor`)

- [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) (MIT): empaqueta el vídeo y el audio codificados en MP4.
- [ag-psd](https://github.com/Agamnentzar/ag-psd) (MIT): lee los archivos PSD.
- [pdf.js](https://github.com/mozilla/pdf.js) 3.11.174 (Apache-2.0): rasteriza las páginas de un PDF.
