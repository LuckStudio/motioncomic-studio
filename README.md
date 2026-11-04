# MotionComic Studio

Dedicado para mi gran amigo y artista GotiDraw: una herramienta para convertir tus ilustraciones de cómic en vídeo-cómic animado, sin salir del navegador. Todo se guarda en el propio equipo, sin cuentas ni servidor.

- Brief del producto: [`docs/PRD.md`](docs/PRD.md)
- Manual de marca: [`docs/brandbook.html`](docs/brandbook.html)

## Estado: paso 4 · modo Página y borrador en un clic

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

Siguiente (paso 5): modo Webtoon (scroll vertical), PDF, polígonos libres para viñetas, trayectoria de cámara dibujada, exportación por lotes y revisión de rendimiento con archivos pesados.

Pendiente conocido: el PDF no se importa todavía y las viñetas son solo rectángulos.

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
