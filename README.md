# MotionComic Studio

Dedicado para mi gran amigo y artista GotiDraw: una herramienta para convertir tus ilustraciones de cómic en vídeo-cómic animado, sin salir del navegador. Todo se guarda en el propio equipo, sin cuentas ni servidor.

- Brief del producto: [`docs/PRD.md`](docs/PRD.md)
- Manual de marca: [`docs/brandbook.html`](docs/brandbook.html)

## Estado: paso 1 · cimientos y Modo Libre

Hecho:
- Pantalla de inicio con proyectos guardados (IndexedDB), proyecto de ejemplo, duplicar, renombrar, eliminar, exportar e importar copia.
- Proyecto nuevo con proporciones (16:9, 9:16, 3:4, 1:1, 2:1, personalizada), resolución 1080p/2K/4K y calculadora de tamaño mínimo de ilustración.
- Estudio: visor, capas, inspector y línea de tiempo (planos como clips, estirar duración, cabezal, zoom).
- Parallax 2.5D por profundidad (z) con sobreescalado automático del fondo, huecos en rojo y margen seguro.
- Cámara: zoom, paneos, Ken Burns, temblor y ángulo holandés; curvas; encuadre a mano arrastrando el marco en la vista «Cámara».
- Transiciones: corte, fundido, destello y barrido.
- Aviso de calidad cuando una imagen se pixelaría con el zoom previsto.
- Deshacer/rehacer, autoguardado, atajos (Espacio, J/K/L, flechas, C, Ctrl+Z), modo Simple/Avanzado, tema oscuro/claro, ES/EN, instalable (PWA).

Siguiente (paso 2): exportación MP4, importar PSD/PDF, audio y locución, texto y bocadillos.

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
