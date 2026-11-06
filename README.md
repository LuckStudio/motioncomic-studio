<p align="center">
  <img src="icons/icon-192.png" width="96" height="96" alt="Logotipo de MotionComic Studio">
</p>

<h1 align="center">MotionComic Studio</h1>

<p align="center">
  <b>Un estudio instalable para convertir tus ilustraciones de cómic en vídeo animado.</b><br>
  Coloca tus dibujos, dales profundidad, mueve la cámara, añade bocadillos, sonido y transiciones, y exporta un MP4 listo para redes.<br>
  Todo funciona en tu navegador y se guarda en tu equipo: sin cuentas, sin servidores y sin subir tus dibujos a ningún sitio.
</p>

<p align="center">
  <img src="docs/img/inicio.png" alt="Pantalla de inicio de MotionComic Studio con una escena de cómic en parallax" width="900">
</p>

---

## Índice

- [Qué es](#qué-es)
- [Para quién es](#para-quién-es)
- [Instalación](#instalación)
- [Primeros pasos](#primeros-pasos)
- [Tres formas de trabajar](#tres-formas-de-trabajar)
- [El estudio por dentro](#el-estudio-por-dentro)
- [Funciones en detalle](#funciones-en-detalle)
- [Archivos que acepta y que genera](#archivos-que-acepta-y-que-genera)
- [Atajos de teclado](#atajos-de-teclado)
- [Privacidad y datos](#privacidad-y-datos)
- [Requisitos y límites](#requisitos-y-límites)
- [Publicarlo en tu propia web](#publicarlo-en-tu-propia-web)
- [Para desarrolladores](#para-desarrolladores)
- [Créditos](#créditos)

---

## Qué es

MotionComic Studio es una aplicación web **instalable** (PWA) para hacer **vídeo-cómic**: animaciones sencillas a partir de ilustraciones fijas. Está pensada para que un ilustrador llegue de sus páginas o capas a un vídeo con movimiento sin pasar por un programa de edición de vídeo profesional.

La idea es simple:

1. **Colocas tus ilustraciones**: capas sueltas, un PSD, páginas completas, un PDF o una tira vertical.
2. **Les das vida**: parallax 2.5D entre capas, movimientos de cámara, viñetas con borde de cómic, transiciones, bocadillos, efectos y sonido.
3. **Exportas un MP4** con el formato de la red donde lo vayas a publicar (TikTok, Reels, Shorts, YouTube, Instagram…).

Lo que ves en el visor es exactamente lo que se exporta: el visor y el exportador usan el mismo motor de dibujo.

## Para quién es

- **Ilustradores y dibujantes de cómic** que quieren mover sus páginas en redes sociales.
- **Autores de webtoon** que necesitan un tráiler o un avance en vídeo vertical.
- **Narradores y creadores de contenido** que quieren poner voz a una historia ilustrada.
- Cualquiera que quiera hacer **animaciones sencillas** con imágenes fijas sin aprender software de animación.

No hace falta saber de vídeo: hay presets para casi todo, un borrador automático en un clic y tutoriales dentro del propio estudio.

---

## Instalación

MotionComic Studio se abre como una página web y se puede **instalar como una app**. Una vez instalada, abre en su propia ventana, aparece junto a tus otras aplicaciones y **funciona sin conexión**.

| Dispositivo | Cómo instalarla |
|---|---|
| **Ordenador con Chrome o Edge** | Pulsa el icono de instalar en la barra de direcciones, o el botón **Instalar** de la pantalla de inicio. |
| **Android (Chrome)** | Menú ⋮ → **Instalar aplicación** o **Añadir a pantalla de inicio**. |
| **iPhone y iPad (Safari)** | Botón **Compartir** → **Añadir a pantalla de inicio**. |
| **Mac (Safari 17 o posterior)** | Menú **Archivo** → **Añadir al Dock**. |

Dentro de la app, **Preferencias → Instalación** detecta tu dispositivo y te explica los pasos exactos.

Cuando hay una versión nueva, la app la descarga sola y te avisa en la pantalla de inicio para que actualices cuando quieras.

---

## Primeros pasos

1. **Abre el ejemplo.** La primera vez ya hay dos proyectos de ejemplo cargados (uno libre y uno de página completa) para que veas cómo está montado todo.
2. **Crea un proyecto.** En el inicio, pulsa **Proyecto nuevo**, elige el modo (Libre, Página completa o Webtoon), el formato (9:16, 16:9, 4:5, 1:1…) y la resolución.
3. **O pide un borrador.** **Borrador en un clic** te deja subir páginas o imágenes y monta solo un primer vídeo: detecta viñetas, fija el orden de lectura y coloca cámara, duraciones y transiciones. Luego lo retocas todo.
4. **Arrastra tus archivos** al visor o usa **Importar**.
5. **Dale al play**, ajusta, y cuando te guste ve a **Exportar**.

Tienes tutoriales guiados sobre el propio estudio en el botón **?** (importar, parallax, voz y exportar).

<p align="center">
  <img src="docs/img/estudio.png" alt="Estudio en el espacio Montaje, con planos a la izquierda, visor en el centro, capas y propiedades a la derecha y la línea de tiempo abajo" width="900">
</p>

---

## Tres formas de trabajar

### Modo Libre: plano a plano, con capas

Cada **plano** es una escena hecha de capas (fondo, edificios, personaje, primer plano…). Las capas se colocan a distintas **profundidades** y, al mover la cámara, las cercanas se mueven más que las lejanas: es el efecto **parallax 2.5D**. Cada plano vive dentro de una **viñeta** con su borde y su calle, como en una página de cómic.

Ideal cuando tienes tus ilustraciones separadas por capas o un PSD.

### Modo Página completa: la cámara recorre tus viñetas

Subes páginas de cómic terminadas y la herramienta **detecta las viñetas sola** (sin IA, analizando los espacios blancos entre ellas). La cámara pasa de viñeta en viñeta en orden de lectura occidental o manga, con paneo suave o salto, y atenúa el resto de la página para centrar la atención.

Las viñetas detectadas se pueden corregir: moverlas, cambiar sus esquinas, dibujar viñetas nuevas (también con forma de polígono libre), reordenarlas o quitarlas. Una viñeta puede convertirse en un plano libre para animarla por capas.

### Modo Webtoon: scroll vertical

Subes una tira vertical larga (o varias imágenes, que se apilan en una) y la cámara baja por ella con la velocidad que elijas, **se para** en los momentos clave y hace **zoom** sobre los detalles. «Sugerir pausas» propone una por cada bloque de la tira.

---

## El estudio por dentro

El estudio se organiza en **cinco espacios de trabajo**, cada uno con lo que necesitas para una tarea:

| Espacio | Para qué sirve |
|---|---|
| **Montaje** | Ordenar planos o páginas, elegir el estilo de las viñetas y las transiciones, gestionar recursos, formato, aspecto general y «Mi estilo». |
| **Cámara** | Encuadrar el inicio y el final de cada plano, dibujar trayectorias de cámara o corregir las viñetas de una página. |
| **Capas y profundidad** | Colocar las capas en profundidad, ajustar el desenfoque y hacer cambios de foco entre capas (*rack focus*). |
| **Texto, FX y audio** | Bocadillos, subtítulos, efectos de acción y ambiente, sonidos, mezclador e idiomas. |
| **Exportar** | Elegir plataforma, calidad e idioma y sacar el MP4, la portada o los subtítulos. |

En la columna derecha, **Capas** y **Propiedades** muestran solo lo que corresponde a lo que tengas seleccionado (proyecto, plano, capa, texto, clip de audio, efecto, viñeta o pausa). Esc quita la selección.

---

## Funciones en detalle

### Parallax y cámara

- **Profundidad por capa** con valores rápidos (cielo, fondo, lejos, medio, personaje, primer plano) o ajuste fino. El nombre de la capa ya da una pista: «cielo», «fondo», «personaje», «primer plano»…
- **Tres intensidades de parallax** (sutil, normal, intensa).
- **Movimientos de cámara listos**: quieta, zoom in, zoom out, paneos en las cuatro direcciones, Ken Burns, temblor y ángulo holandés, con intensidad y curva de suavizado.
- **Encuadre manual** del fotograma inicial y final, y **trayectorias dibujadas** con varios puntos, cada uno con su zoom, su pausa y su tiempo de viaje.
- **Sin huecos**: el fondo se agranda solo para que la cámara nunca enseñe los bordes de la imagen, y una superposición marca en rojo los huecos si los hubiera.
- **Calculadora de resolución**: te dice qué tamaño de imagen necesitas para el formato y el zoom que quieres.

<p align="center">
  <img src="docs/img/camara.png" alt="Espacio Cámara con el marco de inicio y de fin del plano sobre la ilustración" width="900">
</p>

### Viñetas con borde de cómic

Cada plano del modo libre tiene su **contenedor de viñeta**, que se configura para todo el proyecto o plano a plano:

- **Calle**: el espacio entre viñetas, con su ancho y su color (blanco, negro, papel, cualquier color) y una textura opcional: trama de puntos, papel, rayado o líneas de acción.
- **Forma**: recta, inclinada, romboide, trapecio, girada, estallido, recuerdo (borde ondulado) u óvalo.
- **Trazo que la bordea**: línea, tinta a mano, boceto, doble, discontinua o sin trazo, con grosor y color.
- **Sombra** con su color.
- **Estilos listos**: cómic clásico, manga, noir, tinta a mano, pop, acción, recuerdo, boceto y sin viñeta.
- **Ilustraciones que rompen la viñeta**: cualquier capa puede ir **por encima del borde** y dibujarse sobre el trazo y la calle, como un personaje que se sale del recuadro.

En el modo Página, tus páginas ya traen sus viñetas; se puede añadir un marco alrededor del encuadre y un contorno a la viñeta activa.

<p align="center">
  <img src="docs/img/vinetas.png" alt="Pestaña Viñetas con el estilo Pop: calle amarilla con trama, borde negro y sombra" width="900">
</p>

### Transiciones

**28 transiciones** en cuatro familias, cada una con duración, curva (suave, lineal, frena, acelera, rebote, seco) y, según el tipo, dirección, color y distancia:

| Familia | Transiciones |
|---|---|
| **Básicas** | Corte, fundido a negro, fundido a blanco, encadenado, destello |
| **Movimiento** | Barrido, empujar, cubrir, descubrir, latigazo, zoom a través, giro |
| **Formas** | Círculo, iris de dibujos, rombo, reloj, persianas, puertas, trama |
| **Cómic** | Por la calle, vista de página, pasar página, mancha de tinta, estallido, mosaico de viñetas, pop, impacto, interferencia |

**Por la calle** y **Vista de página** ponen las dos viñetas una al lado de la otra, separadas por la calle blanca o negra, y la cámara viaja de una a otra como si leyeras el papel. El catálogo muestra miniaturas animadas de cada transición, y tienes «Ver la transición» y «Aplicar a todos».

<p align="center">
  <img src="docs/img/transiciones.png" alt="Catálogo de transiciones con miniaturas y la transición Vista de página en el visor" width="900">
</p>

### Superposiciones y vídeo

Además de las capas de cada plano, puedes poner elementos **fijos por encima de toda la ilustración**, en sus propias pistas de la línea de tiempo (hasta 6) y fuera del movimiento de la cámara:

- **Imágenes y vídeos** (MP4, WebM, MOV): un personaje ya animado con la boca en movimiento, un marco, un logotipo, un overlay de partículas…
- **Croma**: si el vídeo está grabado sobre verde o azul, se quita el fondo (con tolerancia, suavizado y limpieza del reflejo). Si ya tiene transparencia (WebM con alfa), se respeta.
- Colocar y escalar arrastrando en el visor (esquina para el tamaño, círculo para girar), rejilla de posiciones, voltear, opacidad, modos de mezcla, bloquear.
- El **audio del vídeo** pasa a la pista de locución y sigue al clip cuando lo mueves o lo recortas.
- Los vídeos también pueden ser **capas dentro de un plano**, con parallax y profundidad.
- Si varios clips de una misma pista se **solapan**, pasan a una segunda fila dentro de esa pista para verlos bien.

> Para trabajar con vídeo y archivos pesados, MotionComic Studio funciona mejor **instalado en tu ordenador o tableta**.

### Capas como en Photoshop y Procreate

- **Arriba = más cerca**: la capa de arriba tapa a las de abajo, y el orden coincide con la profundidad (z). Arrastra una capa para reordenarla y su profundidad se ajusta sola; si cambias la profundidad, la capa sube o baja en la lista.
- Por capa: **ojo, candado, renombrar** (doble clic), **duplicar** (Ctrl+J), **eliminar**, **modo de mezcla** (12 modos) y **opacidad**, además de llevar adelante o atrás, al frente o al fondo.
- **Importar**: desde el equipo, **de las imágenes del proyecto o de la biblioteca** (selector con miniaturas), una capa de color liso, o carpetas y ZIP.
- **Arrastrar y soltar** imágenes o vídeos —desde Recursos, la biblioteca, el selector o el explorador de archivos— al panel de capas, en el punto exacto de la pila.

### Línea de tiempo con arrastrar y soltar

- Suelta un recurso en el **hueco de la pista de planos** y crea un plano nuevo; suéltalo **sobre un plano** y se añade como capa. En una pista de superposición o de audio, lo coloca ahí.
- **Planos desplegables**: la flecha de cada plano muestra su pila de capas, reordenables arrastrando; suelta un recurso en una altura concreta para colocarlo arriba o como fondo.
- **Planos superpuestos**: pistas de planos que se ven **a la vez** que el principal, con su propia cámara, capas y efectos (las zonas vacías son transparentes). Se pueden pasar de la pista principal a la superpuesta y al revés.

### 3D

- **Giro en X e Y con perspectiva** en cada capa y superposición (además del giro en Z), con poses rápidas y perspectiva ajustable. Se anima con fotogramas clave.
- **Entradas y salidas 3D** (volteos, giros desde un lado, puerta, voltereta, vuelo) y bucles 3D (tarjeta que se mece, cabeceo, giro completo, bamboleo).
- **Transiciones 3D** entre planos: cubo, volteo de carta, puerta, voltereta y carrusel, con dirección.
- **Vista de profundidad en 3D**: las capas como planos en el espacio, con la cámara y su pirámide de visión; gira la escena con el ratón (frontal, 45°, lado, arriba) y arrastra una capa para moverla en profundidad.

### Animación de capas

- **Entradas, salidas y bucles** por capa y por superposición: aparecer, deslizarse, pop, zoom, caída con rebote, giro, flotar, balanceo, respirar, latido…
- **Fotogramas clave** visibles como rombos en la línea de tiempo (mover, escalar, girar y desvanecer), con **editor de curvas Bézier**. La curva de la cámara también es editable.
- **Pivote** por capa (por ejemplo, el hombro de un brazo) y **límite de desplazamiento** del parallax.
- **Personaje por capas**: capas de «ojos cerrados» que parpadean solas y capas de **boca que se abren según el volumen de la locución**.
- **Aspecto por elemento**: sombra, resplandor, contorno de pegatina y ajuste de color (brillo, contraste, saturación, tono).

### Texto del cómic

- **Bocadillos** de habla, grito y pensamiento con cola arrastrable, **cajas de texto**, **onomatopeyas** y **subtítulos**.
- **Revelado** de golpe, por palabras o por letras, y **entradas animadas** (pop, rebote, golpe, deslizar).
- **Sincronía con la voz**: un texto vinculado a un clip de locución aparece cuando suena su frase.
- **Subtítulos desde la locución**: uno por frase con su tiempo (el texto lo escribes tú; no hay reconocimiento de voz). Se queman en el vídeo o se exportan como SRT.
- **Varios idiomas** en el mismo proyecto, y exportación de cada versión por separado.
- **Tipografías**: cuatro incluidas y la posibilidad de subir las tuyas (TTF/OTF).

<p align="center">
  <img src="docs/img/creativo.png" alt="Espacio Texto, FX y audio con las herramientas para añadir bocadillos, cajas, onomatopeyas y subtítulos" width="900">
</p>

### Subtítulos palabra a palabra

Un espacio propio, la pestaña **Subtítulos** de «Texto, FX y audio»:

- **Una capa por locución**: guarda todo el texto y el momento exacto de cada palabra. En la línea de tiempo es una sola capa que se subdivide en **líneas** que ves dentro de ella (y tantas capas como quieras).
- **Marcar palabra a palabra**: reproduce la voz o mueve el cursor y, cuando se dice la palabra marcada, pulsa **Fijar** (Intro). Pasa sola a la siguiente. Si hay un silencio, pulsa **Silencio** (o el punto) en ese momento. Retroceso deshace. También puedes fijar cada tiempo a mano, ajustarlo con ± y forzar una línea nueva desde una palabra.
- **Repartir por igual** o **ajustar a las pausas de la voz** para tener un punto de partida.
- **Importar un archivo de tiempos**: JSON de Whisper, Deepgram o ElevenLabs, listas de `{palabra, inicio, fin}`, SRT, VTT o CSV. Los huecos entre palabras se convierten en silencios.
- **Seguimiento de palabra**: la palabra que suena se resalta (color, tamaño, fondo), con otros modos: una palabra cada vez o que el texto vaya apareciendo.
- **31 estilos listos** en cuatro familias (Redes, Cine y serie, Cómic, Creativos), con vista previa animada al pasar el cursor, y **16 tipografías nuevas** incluidas. Controles de tipografía, tamaño, colores, trazo, sombra suave y dura, degradado, fondo (color, opacidad, margen, borde y **radio**), alineación, espaciado, inclinación, animación, posición rápida, ancho y letras por línea, y efectos de la palabra que suena (salto, rebote, subrayado, brillo).
- Exportación a **SRT** y subtítulos quemados en el vídeo.

### Efectos y aspecto

- **Animación dentro de la viñeta**: temblor, golpe de impacto con destello (y sonido si quieres), pulso y vibración. Se aplican al plano entero, a una capa o a una viñeta concreta.
- **Efectos de acción y ambiente**: líneas de velocidad y de concentración, aberración cromática, destello de color, lluvia, polvo, chispas, nieve y humo.
- **Rack focus**: el enfoque pasa de una capa a otra.
- **Niebla** y **haces de luz** como efectos de ambiente, y **dolly zoom** (efecto vértigo) como movimiento de cámara.
- **Aspecto general**: saturación, contraste, brillo, temperatura, viñeteado, grano de película, tramado de cómic (halftone) y tinte de color.
- **Vista previa al pasar el cursor** sobre los movimientos de cámara y los efectos.

### Audio

- Tres pistas: **locución**, **efectos (SFX)** y **música**.
- Importa WAV, MP3, M4A u OGG, o **graba con el micrófono** con cuenta atrás.
- Mover, recortar y dividir clips, volumen y fundidos por clip, mezcla por pista y **ducking automático** (la música baja sola cuando habla la voz).
- **Marcadores en las pausas de la voz** y «ajustar planos a la voz» para que cada plano dure lo que su frase.
- **Mezclador** con silenciar, solo y medidores de nivel por pista.
- **Marcadores con notas** (M) y **marcadores de pulso musical** (B); detección automática del pulso de la música y «cortes al pulso».
- **Biblioteca de 66 sonidos generados por código**, por categorías (impactos, movimiento, cómic, ambiente, tecnología y magia, terror) y 12 músicas, con búsqueda, vista previa y arrastre a la línea de tiempo. Sin archivos ni licencias.

### Exportación

- **MP4** codificado en el propio navegador: H.264 (o VP9 si no hay H.264) con audio AAC u Opus.
- **WebM** (VP9 + Opus), **GIF animado** (hasta 480 px y 30 s), **secuencia de PNG** en un ZIP y **solo audio** (WAV).
- **Presets por plataforma**: TikTok, Reels y Shorts (9:16), YouTube 1080p y 4K, Instagram 4:5 y cuadrado.
- Fotogramas por segundo, calidad, rango (todo o solo el plano actual), idioma del texto y normalización del volumen.
- **Varios formatos a la vez**: por ejemplo 16:9 y 9:16 en una pasada; en páginas y tiras la cámara se recalcula para cada formato.
- **Portada en PNG** y **subtítulos SRT**.
- **En segundo plano**: puedes seguir editando mientras exporta; la barra superior te avisa al terminar.
- **Simulador de plataformas**: una interfaz genérica de app de vídeo vertical sobre el visor para ver qué tapan los botones, y **zonas seguras**.

<p align="center">
  <img src="docs/img/exportar.png" alt="Espacio Exportar con los presets de plataforma, fotogramas por segundo, idioma, calidad y resumen del archivo" width="900">
</p>

### Línea de tiempo avanzada

- **Selección múltiple** (Mayús o Ctrl + clic, o recuadro con Mayús + arrastrar), mover varios clips a la vez, **duplicar** (Ctrl+D), **agrupar** y desagrupar.
- **Ripple**: al cambiar la duración de un plano, todo lo que va detrás lo acompaña.
- **Pista de efectos** con los efectos de todos los planos, **miniaturas** dentro de los clips de plano y **tira de fotogramas** en los de vídeo.
- Pista de **fotogramas clave** del elemento seleccionado.

### Tus proyectos: archivo, versiones y biblioteca

- **Guardar una copia en un archivo** `.motioncomic` (un ZIP con el proyecto y todos sus medios) y abrirla en otro equipo.
- **Historial de versiones**: se guarda solo cada pocos minutos y al cerrar; también versiones con nombre y «Restaurar».
- **Biblioteca** compartida entre proyectos, con carpetas y etiquetas: personajes, fondos, efectos de sonido… para usar como capa, superposición o audio.
- Avisa si queda poco espacio en el navegador.

### Espacios de trabajo y línea de tiempo al estilo CapCut

- **Tres espacios**: **Montaje** (planos, viñetas, cámara, curvas, capas y profundidad, recursos, biblioteca, proyecto, aspecto y estilo), **Efectos y audio** (texto, subtítulos, efectos, **transiciones**, **efectos de sonido**, **música**, mezclador e idiomas) y **Exportar**.
- **Barra de iconos de la línea de tiempo**: deshacer y rehacer, selección (V) y **cuchilla** (X, corta donde pulsas), dividir (S), **recortar principio (Q) y final (W)** hasta el cabezal, eliminar, **reflejar** en horizontal y vertical, **recortar** la imagen o el vídeo, **fotograma clave**, editor de curvas, marcador, duplicar, **imán** (N, se pega a cortes, marcadores y cabezal), ripple, añadir planos o superposiciones, y **zoom** con deslizador, botones, Ctrl + rueda y «ajustar todo». Muchas actúan sobre lo seleccionado (audio, texto, superposición, capa o plano).
- **Imán de verdad**: al arrastrar o estirar cualquier clip (audio, texto, superposición, plano superpuesto, duración del plano), tanto su **inicio como su final** se pegan a los bordes de los demás clips, a los cortes de plano, a los marcadores y al cabezal cuando están cerca, y aparece una **línea guía amarilla** donde va a encajar. Mantén **Alt** mientras arrastras para soltar sin imán, o apágalo con el icono del imán (N).
- **Capas con tiempo propio**: despliega un plano con la flechita y cada capa es una fila que puedes **mover**, y estirar por la izquierda o la derecha para decidir **cuándo aparece y cuándo desaparece**, con imán. El inspector de la capa tiene la sección **Tiempo y gestos**.
- **Gestos con varias ilustraciones en la misma capa**: con la capa seleccionada, **Dividir** (S) la parte en tramos en el cabezal; a cada tramo le pones **otra ilustración** (botón Reemplazar, o arrastrando una imagen sobre el tramo) y la capa conserva su posición, escala, animación y fotogramas clave. Hay **fundido opcional** entre gestos y se pueden quitar los cortes cuando quieras. Q y W recortan dónde aparece y desaparece la capa.
- **Eliminar planos** con la tecla Supr o el botón del plano, con Ctrl+Z para recuperarlo.
- **Fotogramas clave en todo**: posición X e Y, escala, **ancho y alto** por separado, giro, opacidad y giro 3D, en capas, superposiciones y **textos**. Salen como rombos sobre el elemento en la línea de tiempo y se arrastran.
- **Editor de curvas** (pestaña «Curvas», que además puedes sacar a otra pantalla): gráfica por propiedad, rombos que se arrastran en tiempo y valor, y **tiradores Bézier** para suavizar o endurecer cada tramo, como en After Effects.
- **Favoritos** ★ en sonidos, transiciones y estilos de subtítulos, con filtro propio y una pestaña «Favoritos».

### Interfaz ajustable

- **Arrastra los bordes** del panel izquierdo, de la columna derecha y de la línea de tiempo para cambiar su tamaño; **doble clic** en un borde para ocultarlo.
- **Paneles acoplables, como en Premiere o Photoshop**: cada panel (Visor, Línea de tiempo, Herramientas, Capas y Propiedades) tiene un menú ⋮ para **moverlo a la izquierda o a la derecha** (la línea de tiempo, arriba o abajo) u ocultarlo, y un asa ⠿ para **arrastrarlo** a un lado. Hay disposiciones listas (Estándar, Todo a la izquierda, Todo a la derecha, Línea de tiempo arriba, Solo visor y línea) en el menú de Vista; se recuerdan en tu equipo.
- **Varias ventanas y varias pantallas**: «Sacar a otra ventana» (o arrastrar el asa ⠿ fuera de la ventana) abre el panel en una ventana propia, por ejemplo el **visor en un segundo monitor** y el resto del estudio en el primero. Funciona con los mismos atajos, edición y reproducción; si cierras la ventana el panel vuelve solo. Con «Sacar a otra pantalla…» eliges el monitor (Chrome y Edge piden permiso de gestión de ventanas) y «Reabrir las ventanas de la última vez» las recupera. Requiere permitir las ventanas emergentes.
- **Modo táctil** (automático en tablets y pantallas táctiles; se puede forzar o quitar en Preferencias › Apariencia): botones de 44 px como mínimo, tiradores de los paneles con zona de toque de 30 px, bordes de los clips más anchos, flecha de capas, rombos de fotograma clave y deslizadores más fáciles de agarrar, y todo lo que antes solo aparecía al pasar el ratón (estrellas de favoritos, controles ⋮ y ⠿) siempre visible.
- **Pulsación larga**: sobre cualquier icono muestra su **nombre y su atajo**; sobre las vistas previas de cámara, efectos y estilos de subtítulos, las reproduce mientras mantienes el dedo. El Apple Pencil usa el hover igual que el ratón.
- **Tamaño de la interfaz** del 70 % al 150 % para adaptarla a cada pantalla (menú de la barra superior).
- **Zoom y desplazamiento del visor** (Ctrl + rueda; rueda pulsada o Alt + arrastrar), **reglas** en píxeles y **vista lateral de profundidad** para colocar las capas en el eje Z arrastrándolas.
- **Tabla de traducción** con todos los textos y una columna por idioma.

### Ayudas para trabajar más rápido

- **Borrador en un clic** a partir de páginas o imágenes.
- **Mi estilo**: guarda tus transiciones, viñeta, curva de cámara, ritmo, parallax y tipografías y aplícalos a proyectos nuevos y al borrador. Se exporta e importa como archivo.
- **Presets con nombre** para movimientos de cámara y pilas de efectos, también exportables.
- **Deshacer y rehacer** (hasta 300 pasos por sesión) y **guardado automático**.
- **Guías** de tercios y de margen de título.

### Preferencias y accesibilidad

- Tema **oscuro o claro**, tamaño de la interfaz (100 a 150 %), **animaciones reducidas** e idioma (**español e inglés**).
- **Atajos configurables** con tres bases: MotionComic Studio, Premiere y Photoshop.
- Uso completo con teclado, avisos para lectores de pantalla y objetivos táctiles grandes en tableta.
- **Datos guardados**: cuánto ocupa cada cosa, almacenamiento persistente y borrar todo.
- **Medir mi equipo**: calcula el rendimiento en 1080p y 4K y ajusta los avisos de memoria.

---

## Archivos que acepta y que genera

| Entrada | Detalles |
|---|---|
| **PNG, JPEG, WebP, SVG** | Capas, planos, páginas o partes de una tira. El SVG se convierte a imagen de alta resolución. Avisa si una imagen está en CMYK. |
| **MP4, WebM, MOV** | Vídeo como capa o como superposición, con su audio. Depende de los códecs de tu navegador: MP4 (H.264) y WebM funcionan en Chrome y Edge. |
| **ZIP o carpeta** | Todas las imágenes de una carpeta o un ZIP de golpe (también arrastrando carpetas al visor). |
| **PSD** | En modo libre conserva capas, nombres, grupos, visibilidad, opacidad y modos de fusión básicos, y avisa de capas vacías, ocultas o con nombre repetido. Las **capas de texto** pasan a textos editables. En página y webtoon entra aplanado. |
| **PDF** | Cada página se convierte en imagen a la resolución elegida (hasta 80 páginas). |
| **WAV, MP3, M4A, OGG** | Locución, efectos o música. |
| **TTF, OTF** | Tipografías propias para los textos. |

| Salida | Detalles |
|---|---|
| **MP4 / WebM** | Vídeo H.264 o VP9 con audio AAC u Opus (WebM: VP9 + Opus). |
| **GIF** | Animación corta, hasta 480 px de ancho. |
| **ZIP de PNG** | Un PNG por fotograma. |
| **WAV** | Solo la mezcla de audio. |
| **.motioncomic** | Copia completa del proyecto con sus medios. |
| **PNG** | Portada del vídeo. |
| **SRT** | Subtítulos. |
| **JSON** | «Mi estilo» y presets, para llevarlos a otro equipo. |

---

## Atajos de teclado

Base «MotionComic Studio» (se pueden cambiar todos en **Preferencias → Atajos** o con **Ctrl + /**):

| Acción | Atajo |
|---|---|
| Reproducir o pausar | Espacio |
| Retroceder, pausar, reproducir | J · K · L |
| Un fotograma atrás / adelante | ← / → |
| Un segundo atrás / adelante | Mayús + ← / → |
| Ir al inicio / al final | Inicio / Fin |
| Plano anterior / siguiente | [ / ] |
| Dividir el clip de audio | S |
| Añadir un bocadillo | T |
| Cambiar de vista (cámara, página o tira) | C |
| Pantalla completa del visor | F |
| Acercar / alejar la línea de tiempo | + / − |
| Deshacer / rehacer | Ctrl + Z / Ctrl + Mayús + Z |
| Guardar ahora | Ctrl + S |
| Duplicar lo seleccionado (o la capa) | Ctrl + D (o Ctrl + J) |
| Seleccionar todos los clips | Ctrl + A |
| Marcador con nota / marcar un pulso | M / B |
| Subtítulos: fijar palabra / silencio / atrás | Intro / . / Retroceso |
| Exportar | Ctrl + E |
| Ayuda | ? |

En Mac, Ctrl es ⌘.

---

## Privacidad y datos

- **Tus dibujos no salen de tu equipo.** No hay servidor, cuentas ni analíticas: la importación, la detección de viñetas, el audio y la exportación se hacen en tu navegador.
- Los proyectos y las imágenes se guardan en el **almacenamiento local del navegador** (IndexedDB). En **Preferencias → Datos** ves cuánto ocupa todo y puedes pedir almacenamiento persistente para que el navegador no lo borre.
- Borrar los datos del sitio o desinstalar la app borra también los proyectos. **Exporta tus vídeos** y guarda tus archivos originales.
- Las tipografías van incluidas y la política de seguridad solo permite cargar recursos del propio dominio.

---

## Requisitos y límites

- **Navegador recomendado**: Chrome o Edge de escritorio actualizados, que son los más completos.
- **Para exportar** hace falta un navegador con **WebCodecs** (Chrome, Edge y otros basados en Chromium; Safari reciente). Si el tuyo no lo admite, la app te avisa.
- Funciona en **tableta** y **móvil**, con una previsualización de calidad media para ir fluida.
- **Vídeo**: el visor reproduce los vídeos del navegador; para exportar se coloca cada fotograma con exactitud, así que los proyectos con mucho vídeo tardan más. Los códecs que se pueden leer dependen del navegador (MP4/H.264 y WebM en Chrome y Edge).
- **Instalado va mejor**: instalada en el ordenador o la tableta, la aplicación tiene más memoria disponible y el navegador no borra tus proyectos.
- **Memoria**: como referencia, hasta unos 100 megapíxeles de imágenes por proyecto en edición. Las imágenes de más de 4096 px se editan con una copia ligera y se exportan con la original. En 4K con muchos PSD pesados, conviene exportar en 1080p. La app avisa si te acercas al límite de tu equipo.
- **Limitaciones conocidas**: las capas de un PSD entran aplanadas en los modos Página y Webtoon, y los PDF con tipografías asiáticas no incrustadas pueden verse con fuentes de reserva.

---

## Publicarlo en tu propia web

MotionComic Studio es una web estática: basta con subir una carpeta a cualquier hosting con HTTPS.

1. Genera la carpeta de publicación:

   ```bash
   node tools/pack.js
   ```

   Crea `public/` (y `public.zip`) con todos los archivos, el modo sin conexión versionado y las cabeceras de seguridad en `.htaccess`.

   La tarjeta que sale al **compartir el enlace** (WhatsApp, Telegram, X…) apunta a GitHub Pages; si usas tu propio dominio: `SITE_URL=https://tudominio.com node tools/pack.js`.

2. Pruébala en local con las mismas cabeceras:

   ```bash
   node tools/serve.js public
   ```

3. Sube el contenido de `public/` a tu hosting.

La guía completa (HTTPS, cabeceras, caché y actualizaciones) está en [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Para desarrolladores

No hay paso de compilación ni dependencias que instalar: es JavaScript, HTML y CSS sin frameworks.

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`.

| Ruta | Contenido |
|---|---|
| `index.html` | Punto de entrada. |
| `src/js/render.js` | Motor de dibujo: cámara, parallax, sobreescalado y huecos. El visor y la exportación usan el mismo código. |
| `src/js/panel.js` | Contenedor de viñeta (calle, forma, trazo, sombra) y catálogo de transiciones. |
| `src/js/studio.js` | Interfaz del estudio. |
| `src/js/home.js` | Pantalla de inicio y creación de proyectos. |
| `src/js/overlay.js` | Vídeo importado, croma y pistas de superposición. |
| `src/js/anim.js` | Entradas, salidas, bucles, fotogramas clave, curvas, personaje (parpadeo y boca) y aspecto por elemento. |
| `src/js/outputs.js` | WebM, GIF, secuencia de PNG y solo audio. |
| `src/js/zip.js`, `src/js/file.js` | ZIP, archivo `.motioncomic`, versiones, biblioteca y importación de SVG, ZIP y carpetas. |
| `src/js/page.js` | Detección de viñetas, modo Página y modo Webtoon. |
| `src/js/text.js` | Bocadillos, cajas, onomatopeyas y subtítulos. |
| `src/js/subs.js` | Subtítulos: capas con palabras y silencios, estilos, seguimiento de palabra, importación de tiempos y SRT. |
| `src/js/three.js` | 3D sobre el lienzo: giros con perspectiva mediante mallas de triángulos. |
| `src/js/sounds.js` | Los 66 sonidos y músicas generados por código. |
| `src/js/fx.js` | Efectos, rack focus y aspecto general. |
| `src/js/audio.js` | Pistas, mezcla, grabación y sonidos generados. |
| `src/js/export.js` | Exportación MP4 con WebCodecs, lotes y cola en segundo plano. |
| `src/js/psd.js`, `src/js/pdf.js` | Importación de PSD y PDF. |
| `src/js/db.js` | Guardado local (IndexedDB) y modelo de proyecto. |
| `src/js/sample.js` | Proyectos de ejemplo dibujados por código. |
| `src/js/keys.js`, `help.js`, `prefs.js` | Atajos, ayuda y tutoriales, preferencias. |
| `sw.js`, `manifest.webmanifest` | Modo sin conexión e instalación. |
| `tools/` | `pack.js` (publicación), `serve.js` (servidor de prueba), `build.js` (archivo único de previsualización en `dist/`), `share.js` (imagen para compartir el enlace), `icons.js` (iconos PNG). |

Documentación interna:

- [`docs/PRD.md`](docs/PRD.md): brief del producto.
- [`docs/brandbook.html`](docs/brandbook.html): manual de marca.
- [`docs/COBERTURA_PRD.md`](docs/COBERTURA_PRD.md): qué está hecho del brief, sección por sección.
- [`docs/REDISENO_UI.md`](docs/REDISENO_UI.md): plan del rediseño de la interfaz.
- [`docs/HISTORIAL.md`](docs/HISTORIAL.md): historial de desarrollo paso a paso.

### Librerías incluidas (`src/vendor`)

- [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) (MIT): empaqueta el vídeo y el audio en MP4.
- [ag-psd](https://github.com/Agamnentzar/ag-psd) (MIT): lee archivos PSD.
- [pdf.js](https://github.com/mozilla/pdf.js) 3.11.174 (Apache-2.0): convierte páginas de PDF en imágenes.

Las tipografías incluidas tienen licencia SIL Open Font License (OFL).

---

## Créditos

Hecho con cariño para mi gran amigo y artista **GotiDraw**.
