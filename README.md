# MotionComic Studio

Dedicado para mi gran amigo y artista GotiDraw: una herramienta para convertir tus ilustraciones de cómic en vídeo-cómic animado, sin salir del navegador. Todo se guarda en el propio equipo, sin cuentas ni servidor.

- Brief del producto: [`docs/PRD.md`](docs/PRD.md)
- Manual de marca: [`docs/brandbook.html`](docs/brandbook.html)

## Estado: paso 2 · exportar, PSD y audio

Paso 1 (hecho): inicio con proyectos locales, estudio en Modo Libre con parallax 2.5D, cámara con presets y encuadre manual, transiciones, calculadora de resolución, PWA, ES/EN, tema oscuro/claro.

Paso 2 (hecho):
- **Exportar MP4** en el navegador (WebCodecs): H.264 con audio AAC u Opus, presets por plataforma (TikTok/Reels/Shorts, YouTube 1080p y 4K, Instagram 4:5, cuadrado), fps, bitrate, rango (todo o plano actual), normalización de volumen, portada PNG y cancelar. Usa el mismo motor que el visor.
- **Importar PSD** con capas, nombres, grupos, visibilidad, opacidad y modos de fusión básicos; reconoce nombres (fondo, cielo, personaje, texto…) y avisa de capas vacías, ocultas o con nombre repetido.
- **Audio**: pistas de locución, SFX y música; importar WAV/MP3/M4A/OGG, onda visible, mover, recortar, dividir, volumen y fundidos por clip, mezcla por pista, ducking automático, grabación con micrófono y cuenta atrás, marcadores en las pausas de la voz y «ajustar planos a la voz».
- **Sonidos generados por código** (6 efectos y 3 músicas), sin licencias.

Siguiente (paso 3): texto, bocadillos y onomatopeyas animadas, subtítulos, importar PDF, modo Página completa y borrador en un clic.

Pendiente conocido: la exportación bloquea la ventana mientras dura (la cola en segundo plano llega después) y el PDF no se importa todavía.

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
