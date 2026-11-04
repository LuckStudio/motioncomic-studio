# MotionComic Studio

Dedicado para mi gran amigo y artista GotiDraw: una herramienta para convertir tus ilustraciones de cómic en vídeo-cómic animado, sin salir del navegador. Todo se guarda en el propio equipo, sin cuentas ni servidor.

- Brief del producto: [`docs/PRD.md`](docs/PRD.md)
- Manual de marca: [`docs/brandbook.html`](docs/brandbook.html)

## Estado: paso 10 · viñetas y transiciones

Paso 10 (hecho):
- **Contenedor de viñeta** en cada plano del Modo Libre (siempre presente): calle entre viñetas con color (blanco, negro, papel…) y textura (trama, papel, rayado, líneas de acción), forma (recta, inclinada, romboide, trapecio, girada, estallido, recuerdo, óvalo), trazo editable (línea, tinta, boceto, doble, discontinua, sin trazo; grosor y color) y sombra. Estilos listos: cómic clásico, manga, noir, tinta a mano, pop, acción, recuerdo, boceto y sin viñeta. Estilo para todo el proyecto (pestaña **Viñetas**) y personalizable por plano.
- **Ilustraciones por encima del borde**: cualquier capa puede romper la viñeta y dibujarse sobre el trazo y la calle; botón «Añadir ilustración por encima».
- **28 transiciones** en 4 familias (básicas, movimiento, formas, cómic) con dirección, curva, duración, color y distancia: fundidos a negro/blanco, encadenado, destello, barrido, empujar, cubrir, descubrir, latigazo, zoom a través, giro, círculo, iris de dibujos, rombo, reloj, persianas, puertas, trama, **por la calle** y **vista de página** (las dos viñetas separadas por la calle, como en el papel), pasar página, mancha de tinta, estallido, mosaico de viñetas, pop, impacto e interferencia. Catálogo con miniaturas animadas (pestaña **Transiciones**), «Ver la transición» y «Aplicar a todos».
- Modo página: contorno opcional de la viñeta activa. «Mi estilo» guarda también la viñeta y la transición completa.


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

Paso 7 (hecho):
- **Atajos configurables** con tres bases (MotionComic Studio, Premiere y Photoshop): cada acción se puede cambiar o quitar, con aviso de conflictos. Menú de ayuda con «?» (o Mayús+?).
- **Tutoriales cortos** paso a paso sobre el propio estudio (importar, parallax, voz y exportar), desde el inicio o desde la ayuda.
- **Accesibilidad**: foco atrapado y devuelto en las ventanas, avisos para lectores de pantalla, etiquetas en los clips de la línea de tiempo, mover y estirar clips con Alt+flechas, menús con teclado, tamaño de interfaz (100 a 150 %) y animaciones reducidas.
- **Presets con nombre** de movimientos de cámara y de pilas de efectos, que se exportan e importan como archivo.
- **Tableta**: revisado a 1180×820 y 820×1180; menú «Texto» compacto, barra superior que se reparte en dos filas y objetivos táctiles más grandes.
- **Tu equipo**: «Medir mi equipo» calcula los fotogramas por segundo en 1080p y el coste de 4K, y los límites de memoria avisan según la memoria que informa el navegador.

Paso 8 (hecho, sin archivos reales):
- **Listo para publicar**: iconos PNG (normal, maskable y Apple), manifiesto completo con acceso directo a «Proyecto nuevo», modo sin conexión versionado con aviso de «Hay una versión nueva» e instalación desde la pantalla de inicio. Guía en [`docs/DEPLOY.md`](docs/DEPLOY.md).
- **Sin terceros**: las tipografías van incluidas (OFL) y la política de seguridad del `.htaccess` solo permite cargar del propio dominio. Verificado sin violaciones de política con importación de PDF y exportación.
- **Preparar la carpeta**: `node tools/pack.js` crea `public/` y `public.zip`; `node tools/serve.js public` la sirve con las mismas cabeceras para probarla.
- **Rendimiento en móvil y equipos modestos**: calidad de previsualización media o completa (media por defecto en móviles y equipos con poca memoria), con bajada automática si la reproducción va lenta; pantalla completa del visor (F); guías de tercios y margen de título; barra del visor en una sola fila en pantallas pequeñas.
- **Textos**: revisión completa en español e inglés (sin mezclas) y proyecto de ejemplo traducido.
- **Cobertura del PRD**: qué está hecho y qué falta, sección por sección, en [`docs/COBERTURA_PRD.md`](docs/COBERTURA_PRD.md).

Paso 9 · rediseño de la interfaz (hecho):
- **Esquinas rectas** en toda la interfaz (el logo conserva las suyas); los bocadillos siguen siendo óvalos y las cajas de texto y el fondo de los subtítulos son rectos.
- **Cinco espacios de trabajo**, cada uno con su disposición: Montaje, Cámara, Capas y profundidad, Texto-FX-audio y Exportar (ya no hay botón Exportar ni modo Simple/Avanzado).
- **Carril de pestañas grandes** a la izquierda con paneles separados: Planos o Páginas, Recursos, Proyecto, Aspecto, Mi estilo, Cámara, Rack focus, Texto, Efectos, Sonidos, Mezclador e Idiomas.
- **Columna derecha** con Capas y Propiedades contextuales: solo se ve lo que corresponde a la selección (nada, plano, capa, texto, clip de audio, efecto, viñeta o pausa), con ruta Proyecto › Plano › Capa y resumen si no hay selección. Esc deselecciona.
- **Selector de formato** en la barra superior, con las proporciones dibujadas a escala, resolución y tamaño en píxeles.
- **Superposiciones** del visor en un menú (guías, zonas seguras, huecos, simulador) con chips de las activas.
- **Inicio nuevo**: escena en vivo con parallax que sigue al ratón, «Continúa donde lo dejaste», tarjetas de proyecto con menú, buscador y orden, y tarjetas para crear.
- **Animaciones**: entrada al inicio, la miniatura se expande al abrir un proyecto, la interfaz entra por sus lados y los clips se dibujan; cambio de espacio con un fundido corto. Respetan «animaciones reducidas».
- **Preferencias de MotionComic Studio** (engranaje): apariencia (tema, tamaño, animaciones, idioma), datos guardados en este equipo (tamaños, almacenamiento persistente, borrar todo), instalación según dispositivo, rendimiento, atajos y ayuda.
- Plan completo en [`docs/REDISENO_UI.md`](docs/REDISENO_UI.md).

Quedan para una vuelta posterior: zoom del visor con mano, vista lateral de profundidad, medidores del mezclador y silenciar/solo por pista, miniaturas dentro de los clips, tablas de traducción y una pista propia de efectos.

Pendiente conocido: las capas de un PSD en modo Página entran aplanadas, el efecto de enfoque de un polígono salta de la caja a la forma al llegar a la viñeta, y los PDF con tipografías CJK no embebidas pueden verse con fuentes de reserva.

## Ejecutar

No necesita compilar. Sirve la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`. Para generar el archivo único de previsualización: `node tools/build.js` (crea `dist/artifact.html`). Para publicar: `node tools/pack.js` y la guía de [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Estructura

- `src/js/render.js`: motor de cámara y parallax. El visor y la exportación usan este mismo código.
- `src/js/panel.js`: contenedor de viñeta (calle, forma, trazo, sombra) y catálogo de transiciones.
- `src/js/studio.js`: interfaz del estudio. `src/js/home.js`: pantalla de inicio.
- `src/js/db.js`: guardado local y modelo de proyecto. `src/js/sample.js`: proyecto de ejemplo dibujado por código.

## Librerías incluidas (`src/vendor`)

- [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) (MIT): empaqueta el vídeo y el audio codificados en MP4.
- [ag-psd](https://github.com/Agamnentzar/ag-psd) (MIT): lee los archivos PSD.
- [pdf.js](https://github.com/mozilla/pdf.js) 3.11.174 (Apache-2.0): rasteriza las páginas de un PDF.
