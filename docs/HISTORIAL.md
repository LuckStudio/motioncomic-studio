# Historial de desarrollo

Registro paso a paso de lo que se fue construyendo. Para la descripción pública de la herramienta, mira el [README](../README.md).

## Pasos 11 a 17 · estudio ampliado

- **Paso 11 · interfaz ajustable**: paneles redimensionables y ocultables, tamaño de interfaz del 70 al 150 %.
- **Paso 12 · superposiciones y vídeo**: pistas de superposición, importación de vídeo, croma, audio del vídeo, filas extra para clips solapados.
- **Paso 13 · animar capas**: entradas, salidas y bucles; fotogramas clave con curvas Bézier; pivote; personaje por capas (parpadeo y boca con la voz).
- **Paso 14 · aspecto**: sombra, resplandor, contorno y color por elemento; color global; niebla, haces de luz y dolly zoom.
- **Paso 15 · línea de tiempo avanzada**: selección múltiple, grupos, ripple, marcadores y pulso, pista de efectos, miniaturas, mezclador con medidores.
- **Paso 16 · tus proyectos**: archivo `.motioncomic`, versiones persistentes, biblioteca y consejo de instalación.
- **Paso 17 · salida y entrada**: WebM, GIF, PNG y audio; SVG, ZIP, carpetas, CMYK y texto del PSD; zoom del visor, reglas, vista de profundidad, tabla de traducción y vista previa al pasar el cursor.

## Paso 19 · capas, arrastrar y soltar, 3D, sonidos y planos superpuestos

Panel de capas estilo Photoshop (orden = profundidad), arrastrar recursos a capas y línea de tiempo, planos desplegables, selector del proyecto, giro 3D con perspectiva, entradas y transiciones 3D, vista de profundidad en 3D, 66 sonidos, 16 tipografías, 31 estilos de subtítulos y planos superpuestos.

## Paso 18 · subtítulos

Capas de subtítulo con el momento de cada palabra y de los silencios, marcado con el cursor, importación de tiempos (JSON, SRT, VTT, CSV), seguimiento de palabra, 13 estilos y pestaña propia. Arreglo del simulador de redes, que se descuadraba con el tamaño de la interfaz.

## Paso 10 · viñetas y transiciones

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
- **Listo para publicar**: iconos PNG (normal, maskable y Apple), manifiesto completo con acceso directo a «Proyecto nuevo», modo sin conexión versionado con aviso de «Hay una versión nueva» e instalación desde la pantalla de inicio. Guía en [`docs/DEPLOY.md`](DEPLOY.md).
- **Sin terceros**: las tipografías van incluidas (OFL) y la política de seguridad del `.htaccess` solo permite cargar del propio dominio. Verificado sin violaciones de política con importación de PDF y exportación.
- **Preparar la carpeta**: `node tools/pack.js` crea `public/` y `public.zip`; `node tools/serve.js public` la sirve con las mismas cabeceras para probarla.
- **Rendimiento en móvil y equipos modestos**: calidad de previsualización media o completa (media por defecto en móviles y equipos con poca memoria), con bajada automática si la reproducción va lenta; pantalla completa del visor (F); guías de tercios y margen de título; barra del visor en una sola fila en pantallas pequeñas.
- **Textos**: revisión completa en español e inglés (sin mezclas) y proyecto de ejemplo traducido.
- **Cobertura del PRD**: qué está hecho y qué falta, sección por sección, en [`docs/COBERTURA_PRD.md`](COBERTURA_PRD.md).

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
- Plan completo en [`docs/REDISENO_UI.md`](REDISENO_UI.md).

Quedan para una vuelta posterior: zoom del visor con mano, vista lateral de profundidad, medidores del mezclador y silenciar/solo por pista, miniaturas dentro de los clips, tablas de traducción y una pista propia de efectos.

Pendiente conocido: las capas de un PSD en modo Página entran aplanadas, el efecto de enfoque de un polígono salta de la caja a la forma al llegar a la viñeta, y los PDF con tipografías CJK no embebidas pueden verse con fuentes de reserva.


## Paneles acoplables y ventanas separadas

- Cada panel (visor, línea de tiempo, herramientas, capas, propiedades) se puede mover de lado, ocultar o **sacar a otra ventana** (varias pantallas), con menú ⋮, asa ⠿ de arrastre (a un lado o fuera de la ventana) y disposiciones predefinidas en el menú de Vista.
- La ventana separada recibe el propio panel (mismos controles, atajos y reproducción), copia los estilos y las fuentes, y devuelve el panel al cerrarse. Con la API de gestión de ventanas se elige el monitor y se recuerda la posición.

## Espacios simplificados, barra de edición y curvas

- Montaje reúne cámara y capas y profundidad; Efectos y audio incluye las transiciones y separa efectos de sonido y música.
- Barra de iconos de la línea de tiempo (cuchilla, recortar principio y final, reflejar, recorte, imán, zoom, fotogramas clave), eliminación de planos arreglada, fotogramas clave en textos y con ancho y alto, editor de curvas con tiradores Bézier y favoritos.

## Imán por bordes y capas con tiempo propio

- Imán con línea guía: inicio y final de lo que mueves o estiras se pegan a bordes de otros clips, cortes, marcadores y cabezal; Alt lo desactiva al arrastrar.
- Cada capa tiene aparición y desaparición propias dentro del plano (filas movibles al desplegar el plano), y se puede dividir en tramos que muestran otra ilustración, con fundido opcional y reemplazo por botón o arrastrando.

## Modo táctil

- Modo táctil automático (o forzado en Preferencias): objetivos de 44 px y zonas de toque ampliadas en tiradores, clips, rombos, deslizadores y menús; sin controles que dependan del hover.
- Pulsación larga para ver el nombre de los iconos y vistas previas al mantener pulsado; iconos de Curvas y Proyecto distintos.

## Gestos, menú contextual y precisión

- Menú contextual con clic derecho o pulsación larga en planos, capas, clips, textos, superposiciones, fotogramas clave y pistas.
- Pellizco y arrastre con dos dedos en la línea de tiempo y el visor; desplazamiento con un dedo en el fondo.
- Modo de precisión para arrastres finos y aviso con botón Deshacer al eliminar.

## Teclado y lectores de pantalla

- Visor enfocable con Tab, flechas y +/-; navegación por la línea de tiempo con flechas; recorte de bordes con Alt+Mayús+flechas.
- Regiones con nombre, h1, enlaces para saltar, F6 y Alt+1…5 entre paneles; hoja de atajos con ? según el espacio de trabajo.

## Temas, alto contraste y escala automática

- Temas gris medio, azul noche, sepia y personalizado (acento y fondo propios con aviso de contraste); alto contraste para base clara u oscura; selección con borde y ✓; escala automática en la primera apertura en una tablet.

## Personalizar la interfaz y vistas guardadas

- Preferencias › Interfaz: ocultar herramientas de la línea de tiempo, pestañas y espacios de trabajo; vistas guardadas con nombre (disposición, ocultos, tema, tamaño), exportables e importables como .mcview.

## Aviso de versión nueva

- Tarjeta de actualización (versión nueva lista o copia vieja en caché) con Actualizar ahora, Más tarde y Forzar actualización; comprobación al abrir, al volver a la pestaña y cada 20 minutos; la publicación escribe version.json y la versión dentro de index.html para detectar copias antiguas.

## Tablet en vertical

- Disposición para pantallas estrechas: visor arriba, línea de tiempo siempre visible, hoja inferior con Panel, Capas y Propiedades, barra de herramientas compacta con menú de más herramientas, y cabecera y barra del visor en una sola fila.

## Escala de la interfaz sin descuadres

- Con la interfaz al 70–150 % el navegador entrega las posiciones del ratón y del dedo ya multiplicadas por la escala, mientras que la línea de tiempo, los menús y los tutoriales calculaban sin ella. Ahora hay un único factor medido (`MC.uz()`) que se aplica en la regla y el cabezal, los arrastres y recortes, la cuchilla, el soltar, el imán, el recuadro de selección, el pellizco y el desplazamiento táctil, el zoom y desplazamiento del visor y los tutoriales; el lienzo del visor también ajusta su resolución a la escala.
- Pruebas automáticas a 70, 80, 90, 100, 115, 130 y 150 %: el cabezal cae donde haces clic, los clips se mueven y se estiran exactamente lo arrastrado y el foco del tutorial rodea el elemento.

## Propiedades con pestañas

- Barra de pestañas en Propiedades (plano, capa, texto, audio y superposición) con flechas anterior y siguiente, teclado y deslizamiento táctil; recuerda la última pestaña por tipo. El clip de audio separa el volumen y los fundidos.

## Fotogramas clave por propiedad, curvas y movimientos

- Los fotogramas clave pueden llevar solo las propiedades que animan (una pista por propiedad); los antiguos, que llevan todas, siguen funcionando igual. Rombo con tres estados, flechas para saltar entre fotogramas y creación automática al cambiar el valor, en Escala, Posición, Opacidad, Giro y Tamaño de capas y superposiciones, y filas para todas las propiedades en la pestaña Animación.
- Nuevas curvas Elástico, Bote y Mantener; 15 movimientos listos; el editor de curvas muestra solo los fotogramas de la propiedad elegida.

## Visibilidad de las pistas

- Ojo por pista (quita texto, subtítulos o efectos del vídeo y la exportación; en audio silencia) y plegado de filas de la línea de tiempo, con menú Pistas, aviso con Mostrar y guardado en el proyecto.

## Paneles junto a la línea de tiempo

- Dos zonas nuevas, abajo a la izquierda y abajo a la derecha de la línea de tiempo, para acoplar Capas y Propiedades (menú ⋮, arrastre del asa y tres disposiciones nuevas); ancho ajustable por zona y guardado en las vistas.

## Animaciones de entrada y salida del estudio

- Transición en dos tiempos al abrir un proyecto (el inicio se deshace y el estudio se construye por piezas, unos 2,3 s en total) y al revés al volver al inicio; más lentas y suaves que antes, saltables con un toque o una tecla y desactivadas con animaciones reducidas.

## Conexión con IA (MCP)

- Conector local `tools/mcp/server.js` (MCP por stdio + puente en 127.0.0.1 con código de emparejamiento, límite de intentos y solo orígenes permitidos) y `src/js/mcp.js` en el estudio: permiso al conectar, confirmación en cada acción que cambia algo, desconexión en un clic y panel en Preferencias. Probado de punta a punta con un cliente MCP simulado.
- Pendiente: WebMCP (herramientas expuestas por la propia página) y más herramientas (texto, exportar).

## Versión IA (MCP)

- Los cambios de la IA se guardan en una copia de trabajo (registro `ia-<id>` en el almacén de versiones) y el proyecto guardado queda intacto hasta pulsar Aceptar. Barra con Ver la mía / Cambios / Aceptar / Descartar; se guarda «Antes de la IA» en el historial; sigue pendiente al reabrir.
- Pendiente: aceptar plano a plano.

## Animaciones de entrada y salida: pulido

- Al salir, el marco del estudio (borde, fondo y líneas sueltas) se apaga con el resto y no queda ninguna caja vacía; al entrar, el marco y el área central aparecen con las piezas.
- El texto «Abriendo el proyecto…» solo aparece si la carga tarda más de 0,9 s; los recursos se cargan mientras el inicio se deshace, así que casi no hay hueco en blanco.
- El inicio aparece entero (bordes incluidos) y por orden, sin cajas vacías antes del contenido.

## Pantalla de carga

- Tarjeta al abrir la aplicación con la imagen lateral editable (se guarda reducida en este equipo), crédito opcional, opción de ocultarla, vista previa y salto con toque o tecla. Imagen provisional: patrón de viñetas dibujado en un lienzo.

## Bloque 1 del plan: bugs rápidos, enlace a GitHub y README

- Selector de opciones (`ui.seg`): ahora recuerda la opción actual, así que se puede volver a la anterior sin cambiar de pestaña.
- Doble clic: al escribir en un campo y pulsar otro control, el campo confirmaba al perder el foco, el panel se redibujaba y el clic se perdía. Ahora el redibujado se aplaza hasta soltar el botón (y se libera enseguida si se arrastra).
- Enlace al repositorio de GitHub en el inicio (barra superior y pie) y en Preferencias → Acerca de.
- README actualizado: tres espacios de trabajo, sección de conexión con IA, tabla de archivos al día y enlace al repositorio; README propio del conector MCP.

## Bloque 2 del plan: clic derecho en toda la interfaz

- Menú contextual general: herramientas de la barra, pestañas laterales y espacio «Efectos y audio» se pueden ocultar con clic derecho (con confirmación y «Deshacer») y recuperar desde el mismo menú; cabecera de panel, visor y cabecera de pista tienen su menú; cualquier hueco ofrece personalizar y ayuda. Los menús de la línea de tiempo (plano, capa, clip, etc.) no cambian.

## Bloque 3 del plan: ayuda integrada

- Icono «?» en el título de cada pestaña lateral, en las propiedades y en cada sección con cabecera (y en las pestañas de una sola sección): ventanita con para qué sirve y cómo se usa, y botón para ver el tutorial. 40 temas en español e inglés (`src/js/helptopics.js`).
- Siete tutoriales nuevos (Rack focus, Curvas, Fotogramas clave, Viñetas, Mi estilo, Superposiciones, Texto); los pasos pueden cambiar de espacio y pestaña solos. Probado que todos los pasos encuentran su elemento.

## Bloque 4 del plan: formatos y resolución

- Un único selector de formato (`MC.formatPicker`) para el menú de la barra, la pestaña Proyecto y Proyecto nuevo: proporciones 16:9, 9:16, 4:5, 3:4, 1:1 y 2:1, botón de girar a vertical u horizontal, proporciones propias guardadas, resolución 720p/1080p/2K/4K, lado corto personalizado y píxeles exactos. Las medidas a medida viajan en el propio campo de resolución del proyecto (`@1200`, `=1000x777`), así que el visor, los exportadores y los formatos por plataforma las usan sin cambios.

## Bloque 5 del plan: vistas previas por plataforma

- Nueva ventana «Vista previa en plataforma» (`src/js/platforms.js`) con el vídeo copiado en directo dentro de TikTok, Reels, YouTube Shorts (9:16), YouTube, Twitch y Vimeo (16:9), YouTube y Twitch (2:1) y LinkedIn, Instagram y TikTok (4:5, 3:4, 1:1). La proporción decide qué plataformas se ofrecen. El simulador sobre el visor reutiliza las pantallas verticales rehechas (columna lateral, avatar, barra inferior, progreso), con Shorts ya diferenciado de Reels.

## Bloque 6 del plan: previsualizar antes de aplicar

- Las vistas previas al pasar el cursor (que ya existían para cámara y efectos) se generalizan: entradas, salidas y bucles de capas, superposiciones y textos, y transiciones entre planos. Se reproducen en el visor con los planos reales, mueven solo el cabezal (sin cambiar de plano ni de selección), restauran el proyecto al salir sin tocar el historial y se cierran solas si el botón desaparece. Funcionan con ratón, con Tab y con pulsación larga. Etiqueta «Vista previa» sobre el visor.
- `MC.studioApi.project()` y `time()` para pruebas y para la conexión con IA.

## Pantalla de carga: dedicatoria y «Acerca de»

- Se quita el texto de derechos reservados y de «herramienta gratuita»; se sustituye por la dedicatoria a GotiDraw (la imagen definitiva de su arte sustituirá al patrón provisional cuando esté lista).
- La tarjeta (`MC.splash.card()`) se reutiliza en Preferencias → Acerca de y Ayuda → Acerca de, con versión, «desarrollado por LuckStudio, en desarrollo continuo», enlace a GitHub y botón «Ver la pantalla de carga».

## Bloque 7 del plan: recorte

- El recorte (izquierda, arriba, derecha, abajo) ya existía con deslizadores; ahora tiene tiradores en el visor sobre el recuadro real de la capa o superposición (se calcula con la matriz con la que se dibuja, así respeta cámara, parallax, giro y reflejo), valores exactos en %, y cuatro propiedades nuevas de fotogramas clave (`cl`, `ct`, `cr`, `cb`, como cambio sobre el recorte base) para animarlo. `MC.effCrop` calcula el recorte efectivo sin dejar nunca la imagen vacía. Los fotogramas clave nuevos por la barra siguen llevando solo las propiedades de movimiento.

## Bloque 8 del plan: edición de capas y superposiciones

- Forma (rectángulo, esquinas redondeadas, elipse) y marco de color con grosor propio, dibujados por el motor compartido (visor y exportación) sobre el rectángulo ya recortado; la forma se aplica como recorte y el marco por dentro.
- Ajustes de color nuevos por elemento: blanco y negro, sepia, invertir y desenfoque (en unidades del vídeo, no del píxel de pantalla). Copiar y pegar ajustes entre capas y superposiciones (aspecto, forma, recorte, mezcla, opacidad, reflejos, 3D, animaciones y pivote). Giro base de la capa alrededor de su pivote.
- Inicio: aviso que recomienda el ordenador para editar vídeo, visible en tablets, móviles y pantallas estrechas (`?pcnote=1` lo fuerza), con botón «Entendido» que lo oculta para siempre.

## Bloque 9 del plan: parallax avanzado

- `MC.layerGeom` calcula el desplazamiento por eje (`fx`, `fy`), la respuesta al zoom y al giro a partir de `layer.px` ({x, y, zoom, rot, off}) y de la curva del proyecto (`pxGamma`); las capas fijas, al revés o solo en un eje salen igual en el visor y en la exportación, y el cubrimiento automático de huecos usa los mismos valores.
- Pestaña Parallax en las propiedades de la capa (el límite de desplazamiento se muda aquí desde Pivote), curva de profundidad en Proyecto y profundidad de campo por plano (`shot.dof`, `MC.dofBlur`) junto al rack focus.

## Bloque 10 del plan: viñetas personalizables

- El marco de viñeta gana `radius` (esquinas redondeadas con curvas dentro de `panelGeom`, así clip, trazo y sombra coinciden), `bgGrad`/`bg2`/`bgAngle` (calle con degradado vía `MC.gradFill`, incluido en la clave de caché del fondo), `strokeGrad`/`color2`/`strokeAngle` y `shadowAngle`/`shadowBlur`. «Mis estilos de viñeta» se guarda en el almacenamiento local (`framestyles`).

## Bloque 11 del plan: efectos de estilo

- Siete efectos de post-proceso en `fx.js` (`pixelate`, `posterize`, `duotone`, `glitch`, `vhs`, `edges`, `htone`) que retocan la zona dibujada del plano con lienzos intermedios, con parámetros propios por efecto. Ajustes comunes a todos los efectos (`speed`, `opacity`, `fadeIn`, `fadeOut`, `seed`, `scale`, `blend`).
- Corregido: la entrada y salida (y ahora la opacidad) no afectaban a las partículas, que fijaban su propia opacidad; ahora todas respetan `FXA`.

## Bloque 12 del plan: estilos explicados y exportables

- `MC.styleLines` / `MC.styleDiff` describen en palabras «Mi estilo» y su diferencia con el proyecto abierto; la pestaña Estilo enseña la fecha de guardado (`mystyleAt`), el contenido y las diferencias.
- «Mi guía de estilo» (`src/js/styleguide.js`, `MC.styleGuide`): notas en Markdown con plantilla editable, tarjeta en el inicio, editor con autoguardado, importar/exportar `.md` y «Copiar para una IA» (notas + ajustes). Idea abierta: valorar más adelante si conviene otro formato o campos guiados por transición.
- MCP: herramienta `leer_estilo` (solo lectura) y los proyectos nuevos informan de si aplicaron «Mi estilo».

## Fase A del plan nuevo: correcciones y detalles (versión 0.14)

- Fotogramas clave desde el visor: `dragXY`/`kfPut` escriben un fotograma por instante con X e Y a la vez si el elemento ya tiene fotogramas de esa propiedad o si está activado `S.autoKf` («Grabar fotogramas»); al empezar a grabar se añade un fotograma de origen en 0. Aplica a mover (capa, superposición, texto), escalar y girar (superposición), rueda y deslizadores.
- Línea de tiempo: altura de filas (`S.rowK`, 0,6–2,6) con botones y Alt + rueda, guardada en `tlrow`; el panel puede crecer hasta el 82 %.
- Versión: `MC.VERSION = '0.14'`; se decide mantener 0.x hasta que la persona decida que es la 1.0.
- Decisiones tomadas con la persona: no se hará nada de 3D (formas ni modelos); el curso «Aprender» será solo en español (inglés: «próximamente»).

## Fase B del plan nuevo: bases de atajos (versión 0.15)

- Cinco bases nuevas en `keys.js` (After Effects, Affinity, CapCut, DaVinci Resolve, Blender), sin teclas repetidas dentro de cada base (comprobado por programa). Seis acciones nuevas configurables: selección, cuchilla, recortar principio y final, imán y fotograma clave; se quitan los atajos fijos V X Q W N. La hoja de atajos del estudio usa las teclas de la base elegida. Tabla comparativa en Ayuda → Atajos y aviso «escrito de memoria, a revisar» en las bases ajenas.

## Fase C del plan nuevo: alineación automática (versión 0.16)

- Imán en el visor al arrastrar capas, superposiciones y textos (centro, bordes, tercios, márgenes, zonas seguras y otros elementos) con línea guía; Alt lo desactiva; interruptor en el menú Superposiciones.
- Botones de alinear (6 bordes/centros) y repartir (H/V) en capa, superposición, texto y selección múltiple, con fotogramas clave si el elemento está animado.
- Comprobado con arrastres reales: un arrastre pequeño cerca del centro queda en x=0, con Alt no se pega, «Centro» y «Medio» alinean sin tocar el otro eje. Corregido durante la prueba: los fondos con sobreescaneo se pegaban a los bordes del encuadre en vez de al centro.

## Fase D del plan nuevo: zonas seguras de subtítulos (versión 0.17)

- `safeRects`, `subPresets`, `safeCheck` y `safeNote` en studio.js; `renderSubs` entrega los límites de cada subtítulo al visor para poder medirlos.
- Posición rápida según formato (antes valores fijos, uno fuera del rango del control) y mismo selector para el valor por defecto del proyecto; rango de altura ampliado a −0,40.
- Aviso con botón de corrección, recalculado tras cada dibujo del visor para que no vaya con retraso. Probado con Playwright en 9:16 (aviso, corrección, estrechar, «Dentro de la zona segura») y en 16:9 (presets distintos). Corregido en la prueba: el preset «Arriba» caía sobre la barra superior con tres líneas y se dejó más hueco.

## Fase E del plan nuevo: fotogramas clave avanzados (versión 0.18)

- Vista avanzada de la fila de fotogramas clave con una fila por propiedad (`kfAdvProps`, `kfMoveProp`, `kfDelProp` en studio.js); etiquetas y pista con la misma altura; `layoutLanes` ya no pisa la altura de esta fila.
- Mover un rombo de una propiedad la separa o la une a otro fotograma según el caso; doble pulsación (detectada con dos pulsaciones seguidas porque la primera redibujaba la línea de tiempo) crea un fotograma de una sola propiedad; menú con «Eliminar solo …».
- Probado con ratón real: fila 26 → 136 px, 5 filas, mover solo Y separa un tercer fotograma y X se queda, crear y borrar un fotograma solo de escala, volver a la vista simple.
- Límites conocidos: aún no hay selección de varios rombos, copiar/pegar fotogramas ni curva por rombo desde la fila (la curva se edita en el editor de curvas, eligiendo la propiedad); el movimiento suave o lineal se aplica al fotograma entero.

## Fase G añadida al final del plan: cursores personalizados (pendiente)

- Pedido de la persona: poder tener el cursor de siempre pero personalizarlo con una ilustración propia o elegir cursores ya preparados de otros estilos (retro, futurista, pixelado…).
- Propuesta: Preferencias → Cursor con cursor del sistema por defecto, una colección de cursores incluidos dibujados por nosotros (retro, futurista, pixelado, de cómic, minimalista…), importar una imagen propia (PNG/SVG, con punto activo ajustable y límite de tamaño), vista previa y restablecer. Se aplica con la propiedad CSS `cursor` (con el del sistema como alternativa) y se guarda en este equipo. Va como fase G, después de F (Aprender).

## Fase F del plan nuevo: Aprender (versión 0.19, primera entrega)

- `src/js/learn.js`: curso como datos (módulos → lecciones → pasos con texto y comprobación sobre el proyecto), panel flotante con comprobación automática, progreso en el equipo, glosario, retos, tarjeta de inicio y pestaña en Ayuda. `studioApi.learn()` expone la selección y el espacio de trabajo; studio.js avisa de alinear e imán (`MC.learnEvent`).
- Probado con Playwright (flujo real de la lección 1 con el proyecto de ejemplo: auto-hecho, seleccionar capa, arrastrar en el visor, cerrar/continuar, saltar, progreso, reto, glosario, inglés «Coming soon»).
- Por hacer en siguientes entregas: más módulos y lecciones (transiciones, audio y voz, efectos, estilo, IA/MCP, exportación avanzada), capturas guiadas, y comprobar uno a uno los pasos de la lección 2 y del módulo 2 con ratón real (en esta entrega se probó a fondo la lección 1).
