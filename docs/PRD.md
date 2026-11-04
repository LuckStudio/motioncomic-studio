# MotionComic Studio — PRD ampliado

Nov 4, 2026 · @Lucks

## 1. Resumen ejecutivo

MotionComic Studio es un estudio de edición donde un dibujante convierte sus páginas o ilustraciones en un vídeo-cómic animado sin pasar por After Effects ni Premiere. Sube su arte (con capas o sin ellas), aplica presets de cámara, parallax, transiciones y texto, lo sincroniza con la voz y exporta el vídeo listo para cada red social.

**Propuesta de valor:** pasar de una página de cómic a un vídeo publicable en menos de una hora, con un acabado que parezca hecho por un motion grapher.

**Origen y usuario inicial:** la herramienta nace como apoyo a Goti, amigo del autor del proyecto. Hoy Goti pierde mucho tiempo en edición de vídeo sin dedicarse a ello; el objetivo es que invierta ese tiempo en lo que le gusta, la ilustración y el dibujo, y que aun así consiga vídeos muy llamativos que encajen con la dirección de su propio contenido.

**Qué lo diferencia de un editor de vídeo generalista:**

- Entiende el lenguaje del cómic: páginas, viñetas, orden de lectura, bocadillos y onomatopeyas.
- Los presets están pensados para narrativa secuencial, no para vídeo genérico.
- Ofrece una interfaz de estudio real (línea de tiempo + capas + inspector) con un modo simple para empezar y uno avanzado para controlar cada detalle.
- Está pensado para publicar: exportación directa por plataforma y formato.

| Ficha | Valor |
| --- | --- |
| Nombre provisional | MotionComic Studio |
| Tipo | Software de edición gráfica y animación 2.5D |
| Plataforma inicial | Web (HTML) instalable como PWA, alojada en un espacio propio y accesible desde cualquier dispositivo |
| Usuario principal | Dibujantes y autores de cómic independientes |

## 2. Problema y oportunidad

Hacer un vídeo-cómic hoy exige varias herramientas y muchas horas de trabajo técnico que el dibujante no quiere hacer: prefiere dibujar.

**Dolores principales**

- Separar y recortar elementos a mano para conseguir profundidad.
- Animar cada viñeta con keyframes, sin presets pensados para cómic.
- Sincronizar el ritmo visual con la locución a ojo.
- Aprender software complejo y, a menudo, de suscripción.
- Reexportar y reencuadrar el mismo proyecto para 9:16, 16:9 y 4:5.

**Alternativas actuales (hipótesis a validar con entrevistas)**

| Tipo de herramienta | Fortaleza | Carencia para un dibujante |
| --- | --- | --- |
| Editores profesionales (Premiere, After Effects, DaVinci) | Control total | Curva de aprendizaje alta, no entienden viñetas |
| Editores rápidos de móvil o web | Facilidad y plantillas | Parallax y cámara limitados, nada específico de cómic |
| Plantillas y scripts sueltos | Atajos puntuales | Flujo roto en varias herramientas |

**Oportunidad:** el vídeo corto (TikTok, Reels, Shorts) es un canal clave para que autores independientes descubran lectores, y hoy producirlo les cuesta más tiempo que dibujar la propia página.

## 3. Público objetivo y casos de uso

El usuario central es el dibujante que quiere promocionar su obra en vídeo sin convertirse en editor audiovisual.

| Persona | Qué necesita | Qué valora más | Prioridad |
| --- | --- | --- | --- |
| Autor o dibujante indie | Vídeos para redes que atraigan lectores | Rapidez y resultado vistoso con poco esfuerzo | Principal |
| Creador de webtoon o manga | Convertir tiras verticales largas en vídeo | Modo scroll vertical, orden de lectura derecha-izquierda | Alta |
| Canal de narración de cómics | Leer cómics en voz alta con imagen animada | Sincronización con la voz y subtítulos | Alta |
| Editorial pequeña o mediana | Adaptar un catálogo entero | Plantillas repetibles, trabajo en equipo, exportación por lotes | Media |
| Motion grapher o editor junior | Entregas rápidas de cómic animado | Atajos, keyframes, control fino | Media |

**Casos de uso concretos**

- Tráiler animado de un cómic o novela gráfica nueva (30-60 s, formato vertical).
- Adelanto de las primeras páginas de un capítulo para redes.
- Motion comic completo de un capítulo para YouTube.
- Narración de un cómic con voz y música, con subtítulos.
- Versión animada de una viñeta o ilustración suelta como pieza de promoción.

## 4. Principios de producto

Cinco reglas para decidir qué entra y cómo se diseña cada función:

1. **Resultado bonito en pocos clics.** Cada preset debe dar un buen resultado sin tocar ningún ajuste.
2. **Presets con control.** Todo preset se puede abrir y ajustar (duración, curva, intensidad) para quien quiera más.
3. **Respeta el arte.** Edición no destructiva: las ilustraciones originales nunca se modifican ni se recomprimen.
4. **Previsualización inmediata.** Lo que se ve en el visor es lo que se exporta, y se mueve fluido mientras se edita.
5. **El dibujante manda.** Los automatismos (como el borrador en un clic) proponen, nunca deciden: todo es opcional, revisable y editable.

## 5. Modos de trabajo

El proyecto arranca eligiendo uno de tres modos. Se puede combinar más tarde: por ejemplo, empezar en Modo Página y convertir una viñeta en un plano libre.

### 5.1 Modo Página Completa (navegación por retícula)

- **Importación:** página terminada en PNG, JPEG, PSD o PDF.
- **Definición de viñetas:** rectángulo, polígono libre o detección automática de viñetas por análisis de la imagen, sin IA. El usuario puede corregir cualquier recuadro.
- **Orden de lectura:** editable, con opción izquierda-derecha (occidental) o derecha-izquierda (manga).
- **Trayectoria de cámara automática:** la cámara salta o hace paneo suave de una viñeta a otra, con tiempo de permanencia por defecto según el tamaño de la viñeta.
- **Efecto de enfoque:** zoom al interior de la viñeta con el resto de la página atenuada o desenfocada. Nivel de atenuación ajustable.
- **Recorrido de viñeta panorámica:** paneo automático a lo largo de viñetas anchas o altas.

### 5.2 Modo Libre (secuencia cinematográfica)

- Construcción plano a plano con imágenes independientes, sin maqueta de página.
- Proporción de aspecto elegible desde el inicio y cambiable después: 16:9, 9:16, 4:5, 1:1.
- Cada plano admite capas, cámara propia y transición de entrada y salida.

### 5.3 Modo Webtoon (scroll vertical)

- Importación de una tira vertical larga (o varias imágenes apiladas).
- Scroll automático con velocidad ajustable, pausas en puntos clave y zooms sobre detalles.
- Muy relevante para autores de webtoon, un público que hoy no tiene herramienta específica.

### 5.4 Borrador en un clic

El usuario sube la página o las imágenes y la herramienta monta un primer borrador completo: viñetas detectadas, orden de lectura, cámara, duración de cada plano y transiciones básicas. Es un punto de partida para retocar, no un resultado cerrado.

Todo se calcula en el propio navegador, sin IA ni servidor, y el borrador aplica «Mi estilo» (sección 13) si el usuario lo tiene guardado.

### 5.5 Formato y calculadora de resolución

Al crear el proyecto se elige la proporción y la resolución, y una calculadora ayuda a acertar con el tamaño de las ilustraciones.

- **Proporciones:** 16:9, 9:16, 3:4, 1:1, 2:1 y personalizada, con la posibilidad de añadir más.
- **Resolución de salida:** 1080p, 2K y 4K; los píxeles exactos se calculan según la proporción elegida.
- **Calculadora:** muestra el tamaño en píxeles del vídeo para cada combinación y el mínimo de píxeles que debe tener la ilustración para no pixelarse con el zoom previsto.
- La proporción se puede cambiar después sin perder el trabajo: la cámara se reajusta y el usuario corrige el encuadre a mano.

## 6. Importación y gestión de archivos

Importar bien es la mitad de la experiencia: si el PSD del autor entra con sus capas ordenadas, el resto del flujo es rápido.

| Formato | Qué se importa | Fase propuesta |
| --- | --- | --- |
| PSD | Capas, grupos, nombres, visibilidad, modos de fusión básicos, capas de texto como imagen | MVP |
| PNG, JPEG, WebP | Imágenes sueltas, PNG con transparencia como capa | MVP |
| PDF | Cada página rasterizada a la resolución elegida | MVP |
| ZIP o carpeta de PNG | Capas ordenadas por nombre de archivo | Fase 2 |
| SVG | Elementos vectoriales como capa | Fase 2 |
| Krita (.kra), Clip Studio (.clip), Procreate | Capas directas (o vía exportación a PSD mientras tanto) | Fase 3, a validar |
| Audio (WAV, MP3, M4A, OGG) | Locución, SFX y música | MVP |
| Fuentes (TTF, OTF) | Tipografías propias del autor para texto | Fase 2 |

**Detección inteligente de capas**

- Reconoce nombres habituales (fondo, bg, personaje, texto, bocadillo, sfx) y las asigna a una profundidad inicial.
- Agrupa por carpetas del PSD y respeta el orden original de capas.
- Avisa de capas vacías, ocultas o con nombres duplicados.

**Biblioteca de assets**

- Carpetas, etiquetas y buscador; vista de miniaturas.
- Reconexión de archivos movidos o renombrados.
- Uso del mismo asset en varios proyectos sin duplicarlo.

**Avisos de calidad (importante para cómic)**

- Alerta cuando una imagen no tiene resolución suficiente para el zoom previsto, porque se pixelaría en el vídeo. La calculadora de resolución (sección 5.5) indica qué tamaño necesita cada imagen.
- Aviso de perfil de color (CMYK a sRGB) con conversión automática y vista previa del cambio.
- Límite de tamaño y memoria con PSD muy pesados, con proxies de edición ligeros.

## 7. Capas y profundidad (parallax 2.5D)

El parallax es el efecto estrella: capas cercanas se mueven más que las lejanas cuando la cámara se desplaza, y el vídeo gana volumen.

**Control de profundidad**

- Deslizador Z-depth por capa, con valores rápidos: primer plano, personaje, plano medio, fondo, cielo.
- Intensidad global de parallax (sutil, normal, exagerado) y límite máximo de desplazamiento.
- Punto de anclaje (pivote) ajustable por capa para que los giros y zooms salgan donde toca.

**El problema de los huecos (importante)**

Al mover una capa aparece un hueco en el fondo, donde estaba el personaje. Tres soluciones, de más simple a más avanzada:

1. **Margen seguro:** el visor muestra hasta dónde se puede mover la cámara sin enseñar huecos.
2. **Sobreescalado automático** del fondo para cubrir el movimiento.
3. **Huecos en rojo:** si aun así aparece alguno, el visor lo marca en rojo y un botón lo tapa estirando el fondo.

**Efectos por capa**

- Desenfoque de profundidad (el fondo desenfocado, el personaje nítido) y cambio de enfoque entre capas (rack focus).
- Sombra, brillo, contorno y ajuste de color por capa.
- Capas de ajuste globales: color, viñeteado, grano de película, tramado de cómic (halftone).
- Partículas ligeras: lluvia, polvo, chispas, nieve, humo.

**Animación de personaje por capas**

- Intercambio de capas para parpadeo, bocas y expresiones (ojos abiertos y cerrados, varias bocas).
- Movimiento sutil en bucle: respiración, balanceo de pelo o ropa.
- Los intercambios de capa se colocan a mano en la línea de tiempo, siguiendo la voz.

## 8. Cámara, animación y presets

La cámara virtual es un marco visible sobre la ilustración. Un preset la mueve; el usuario puede aceptarlo o abrirlo y ajustarlo.

**Encuadre manual:** además de los presets, se pueden mover, escalar y girar fondos, personajes y cualquier capa directamente en el visor para encuadrar cada viñeta a gusto, también al cambiar de formato (por ejemplo, de 16:9 a 9:16).

**Catálogo de movimientos de cámara**

- **Zoom in / zoom out** con curvas: suave, acelerada, frenada, constante.
- **Paneo y rastreo** horizontal, vertical y diagonal sobre viñetas panorámicas.
- **Ken Burns:** zoom lento y deriva para narración tranquila.
- **Shake (temblor)** con intensidad y duración, para golpes y explosiones.
- **Dolly zoom (efecto vértigo)** y **rotación (ángulo holandés)** para tensión.
- **Whip pan:** barrido rápido entre dos puntos, con motion blur.
- **Rack focus:** el enfoque pasa de una capa a otra.

**Animación de elementos**

- Entradas y salidas: aparecer, deslizar, pop, rebote, temblor.
- Bucles sutiles: flotar, pulsar, balancear.
- Duración por defecto según el tipo de plano; el usuario la reajusta arrastrando en la línea de tiempo.

**Estilos de animación dentro de la viñeta:** presets que se aplican a una viñeta o a una capa concreta, como temblor, golpe de impacto (con destello y sonido opcional), pulso o vibración. Cada uno tiene intensidad y duración propias, para elegir según lo que se quiera animar en esa viñeta.

**Capa de control avanzado (oculta por defecto)**

- Keyframes visibles y editables en la línea de tiempo.
- Editor de curvas de velocidad (estilo Bézier).
- Guardar un movimiento propio como preset reutilizable.

**Ritmo**

- Marcadores de pulso musical para cortar y mover cámara al compás de la música.
- Trayectoria de cámara dibujada como línea sobre la página, con puntos que se pueden arrastrar para editar el recorrido (opción avanzada: por defecto el movimiento es automático).

## 9. Transiciones y efectos visuales

Cada transición tiene duración, intensidad y dirección ajustables, y una vista previa al pasar el cursor.

| Transición | Uso narrativo |
| --- | --- |
| Corte directo | Cambio seco de plano, ritmo rápido |
| Fundido a negro / a blanco | Paso del tiempo, final de escena |
| Motion blur direccional | Mirada rápida, acción, giro |
| Barrido de página | Pasar de una página a otra |
| Destello de impacto | Golpes, explosiones, sustos |
| Zoom a través (zoom-through) | Entrar dentro de una viñeta o ojo |
| Revelado de tinta o pincel | Estilo dibujado, momentos dramáticos |
| Apertura de viñetas (split panel) | Mostrar dos acciones a la vez |
| Glitch | Escenas de ciencia ficción o digitales |

**Efectos de acción y ambiente**

- Líneas de velocidad (speed lines) y líneas de concentración.
- Vibración, aberración cromática y destellos de color.
- Tramado (halftone), grano de película y viñeteado.
- Superposiciones de lluvia, polvo, luz y niebla.

**Reglas de uso:** los efectos se aplican por plano o por capa, nunca destruyen el original, y el proyecto avisa si se abusa (por ejemplo, demasiados efectos simultáneos que bajen el rendimiento).

## 10. Texto, bocadillos y onomatopeyas

En un cómic, el texto es parte del arte y del ritmo. Esta sección no estaba en el brief original y es clave para que el vídeo se lea bien.

- **Capas de texto detectadas:** bocadillos y cajas de texto del PSD se tratan como elementos animables.
- **Revelado del texto:** aparece de golpe, por palabras o letra a letra, con velocidad ajustable.
- **Sincronización con la voz:** cada bocadillo aparece cuando suena su línea de diálogo y se va cuando termina.
- **Onomatopeyas animadas:** entrada con golpe, escala, temblor o rebote; vinculables a un efecto de sonido.
- **Subtítulos:** generados desde la locución, editables, con estilo propio y exportables como archivo SRT.
- **Multiidioma:** un mismo proyecto con varias versiones de texto (por ejemplo español e inglés) y exportación de cada una.
- **Zonas seguras:** guías que muestran qué área tapan los botones y textos de TikTok, Reels o Shorts, para no colocar texto importante ahí.
- **Tipografías:** uso de las fuentes del autor, con aviso si falta alguna al abrir el proyecto en otro equipo.

## 11. Línea de tiempo y audio

**Pistas base (ampliables sin límite)**

| Pista | Contenido |
| --- | --- |
| 1. Planos | Ilustraciones, viñetas y planos, cada uno como clip con su duración |
| 2. Texto y efectos | Bocadillos, onomatopeyas, superposiciones y efectos |
| 3. Locución | Voz y diálogos |
| 4. SFX | Efectos de sonido |
| 5. Música | Música de fondo |

**Edición de línea de tiempo**

- Arrastrar, recortar, dividir, duplicar y agrupar clips; edición con desplazamiento automático (ripple) y magnetismo (snap).
- Deshacer y rehacer ilimitados; selección múltiple; marcadores con notas.
- Zoom de línea de tiempo y atajos de teclado estilo editor profesional (J, K, L para reproducir, cortar con una tecla).
- Cada viñeta o plano es un clip: su duración se estira o acorta arrastrando.

**Sincronización con la voz**

- Onda de audio visible para ajustar cada plano a su frase.
- Marcadores automáticos en las pausas de la voz; opción de «ajustar planos a la voz» con un clic.
- Grabación de voz dentro de la propia herramienta (micrófono), con cuenta atrás y repetición de tomas.

**Mezcla y audio**

- Volumen por clip y por pista, fundidos de entrada y salida.
- **Ducking automático:** la música baja sola cuando habla la voz.
- Normalización de volumen para que el vídeo suene a nivel adecuado en cada plataforma (valor objetivo a validar por plataforma).
- Pequeña biblioteca integrada de efectos de sonido (SFX) y algo de música ambiente. Cada efecto se arrastra a la línea de tiempo y se coloca en el punto exacto donde debe sonar; el usuario también puede subir los suyos. Licencias por decidir.
- Voz sintética (TTS) opcional para borradores o guías de tiempo, claramente marcada como tal.

## 12. Interfaz tipo estudio (Premiere + Photoshop)

La interfaz une la línea de tiempo de un editor de vídeo con el panel de capas de un editor gráfico, en un único espacio de trabajo.

&#91;embedded content: disposición de la interfaz · 6 zonas\]

Respecto al brief original se añaden la barra superior y un panel de capas propio; el visor, la biblioteca, el inspector y la línea de tiempo se mantienen donde estaban.

**Dos niveles de uso**

- **Modo Simple:** asistente paso a paso, presets grandes y pocos paneles. Pensado para el dibujante que no quiere ver keyframes.
- **Modo Avanzado:** keyframes, editor de curvas, paneles acoplables y todos los ajustes finos. Pensado para editores y motion graphers.

**Espacios de trabajo**

- Preconfigurados: Montaje, Capas y profundidad, Audio y Exportación.
- Paneles acoplables y flotantes; el usuario guarda su propia disposición.

**Detalles de estudio**

- Barra de herramientas fina: selección, mano, zoom, recorte de viñeta y texto.
- Atajos de teclado configurables, con los habituales de Premiere y Photoshop como opción.
- Calidad de previsualización ajustable (media o completa) y visor a pantalla completa para revisar.
- Reglas y guías, tema oscuro por defecto y claro opcional.

**Pantalla de inicio**

- Proyectos guardados con miniatura, nombre y fecha de última edición, y un botón de proyecto nuevo con selector de formato (secciones 5.5 y 13).

**Primera vez**

- Proyecto de ejemplo ya cargado para explorar la herramienta sin empezar de cero.
- Tutoriales cortos paso a paso (importar, parallax, voz, exportar), disponibles después desde un menú de ayuda.

## 13. Proyectos, guardado y presets (todo en local)

Todo se guarda en el propio dispositivo del usuario: no hay cuentas ni servidor, y la herramienta funciona sin conexión.

**Pantalla de inicio**

- Lista de proyectos guardados con miniatura, nombre y fecha de última edición, para retomarlos cuando se quiera.
- Acciones sobre cada proyecto: abrir, duplicar, renombrar, eliminar, exportar e importar.
- Duplicar un proyecto sirve para probar cambios o para arrancar el siguiente capítulo con la misma base.

**Guardado local**

- Proyectos e imágenes en IndexedDB y ajustes ligeros en localStorage, con autoguardado continuo y recuperación tras un cierre inesperado.
- La herramienta pide al navegador almacenamiento persistente para que no borre los datos por falta de espacio.
- Historial de versiones: volver a un punto anterior o duplicar una versión para probar cambios.
- Exportar un proyecto como un único archivo (proyecto y archivos) sirve de copia de seguridad o para pasarlo a otro equipo; importarlo lo recupera.
- Indicador de espacio usado y aviso de que borrar los datos del sitio en el navegador elimina proyectos y presets.

**Instalable (PWA)**

- Se puede instalar como una aplicación desde el navegador y abrir sin conexión.
- Proyectos y presets quedan guardados en ese equipo; para cambiar de dispositivo se exportan e importan.

**Presets y «Mi estilo»**

- Se guardan con nombre los ajustes de tipografía, velocidad, transiciones, efectos y cámara.
- «Mi estilo» es un conjunto de presets que se aplica a los proyectos nuevos y al borrador en un clic, para que todos los vídeos mantengan la misma dirección visual.
- Los presets se guardan en local y se exportan a un archivo del ordenador; si se pierde la sesión o se entra desde otro navegador, se importan de nuevo.
- Un preset exportado también sirve para pasárselo a otra persona.

## 14. Exportación y publicación

Exportar es el final del flujo y el momento donde el usuario comprueba si la herramienta le ha ahorrado tiempo.

**Formatos de salida**

| Formato | Para qué sirve | Fase |
| --- | --- | --- |
| MP4 (H.264) | Compatibilidad máxima con redes y YouTube | MVP |
| MP4 (H.265) | Archivos más ligeros a igual calidad | Fase 2 |
| MOV (ProRes) | Entrega profesional y postproducción | A valorar (limitado en web) |
| WebM | Web y alfa de transparencia | Fase 2 |
| GIF / APNG | Clips cortos de promoción | Fase 2 |
| Secuencia de PNG | Trabajar el vídeo en otro programa | Fase 2 |
| Audio solo (WAV, MP3) | Reutilizar la mezcla | Fase 2 |
| Subtítulos (SRT) | Subida a YouTube y otras plataformas | Fase 2 |

**Presets por plataforma**

- TikTok, Reels y Shorts: 9:16, 1080×1920, 30 fps.
- YouTube: 16:9, 1080p o 4K, 24 o 30 fps.
- Instagram feed: 4:5 (1080×1350) y cuadrado 1:1.
- Valores de bitrate recomendados por plataforma, ajustables.

**Opciones**

- Resolución, fps y calidad editables; rango de exportación (de un punto a otro) y exportación de una sola escena.
- **Cola de render en segundo plano**: se sigue editando mientras exporta; estimación de tiempo y tamaño antes de empezar.
- **Reencuadre automático (reframe)**: del mismo proyecto 16:9 genera una versión 9:16 adaptando la cámara a cada viñeta, sin rehacer el montaje, y cada encuadre se puede corregir a mano.
- **Exportación por lotes:** varios formatos a la vez.
- Imagen de portada (miniatura) exportada desde cualquier fotograma.
- Sin marca de agua ni límites de uso: la herramienta es totalmente gratuita.

**Simulador de plataformas:** vista previa del vídeo con la interfaz de TikTok e Instagram encima (botones, textos y zonas tapadas) para comprobar cómo se verá antes de subirlo.

## 15. Flujo del creador (user journey)

Objetivo: un usuario nuevo exporta su primer vídeo en menos de 30 minutos.

1. **Crear proyecto:** desde la pantalla de inicio, elegir formato (16:9, 9:16, 3:4, 1:1, 2:1…), resolución con la calculadora y modo de trabajo. La primera vez, abrir el proyecto de ejemplo y los tutoriales cortos.
2. **Importar:** subir el PSD multicapa, las páginas o las imágenes, y los audios. La herramienta detecta capas y viñetas y avisa de problemas de calidad. Con «Borrador en un clic» genera un primer montaje para retocar.
3. **Revisar la estructura:** corregir el orden de lectura, los recuadros de viñetas y la profundidad de cada capa con una vista previa del parallax.
4. **Aplicar movimiento:** elegir presets de cámara por plano (zoom, paneo, shake) y ajustar duraciones.
5. **Sincronizar con la voz:** colocar la locución, usar los marcadores automáticos y ajustar los planos a cada frase.
6. **Añadir texto y efectos:** revelado de bocadillos, onomatopeyas, subtítulos y efectos de ambiente.
7. **Transiciones:** insertar cortes, desenfoques o barridos entre planos.
8. **Mezclar el audio:** música, SFX, ducking y volumen final.
9. **Revisar:** reproducir de principio a fin, comprobar zonas seguras y calidad de las imágenes ampliadas.
10. **Exportar y publicar:** elegir preset de plataforma, previsualizar en el simulador de TikTok o Instagram, renderizar en segundo plano y descargar. Duplicar el proyecto para empezar el siguiente capítulo con el mismo estilo.

## 16. Requisitos técnicos y rendimiento

La herramienta es web (HTML), alojada en un espacio propio, para que el usuario trabaje desde cualquier dispositivo y lugar. La tabla recoge lo que eso implica frente a una versión de escritorio.

|  | Web | Escritorio |
| --- | --- | --- |
| Acceso | Sin instalar, desde cualquier equipo | Instalación por sistema operativo |
| Rendimiento | Bueno con aceleración gráfica del navegador, limitado con archivos muy grandes | Mejor acceso a GPU y memoria |
| Exportación | Se renderiza en el navegador del usuario | Render local, ProRes y 4K más sencillos |
| Colaboración | Natural | Requiere sincronización |
| Riesgo principal | Límites de memoria con PSD pesados | Mantener varias versiones |

**Decisión:** el producto es web; una versión de escritorio no se contempla de momento. Queda por definir qué dispositivos hay que soportar de verdad (ordenador, tableta, móvil).

**Rendimiento objetivo (a validar con pruebas)**

- Previsualización fluida a 30 fps en 1080p con varias capas y efectos activos.
- Proxies automáticos de baja resolución para editar con PSD pesados.
- Render final igual al visor, sin sorpresas de diferencia visual.
- Render en el propio navegador, con tiempo estimado y aviso de límites de memoria en 4K.

**Calidad y robustez**

- Compatibilidad con los navegadores y sistemas más usados; comprobar requisitos mínimos de equipo al abrir.
- Interfaz en español e inglés desde el inicio, preparada para más idiomas.
- Accesibilidad: atajos de teclado completos, buen contraste, texto escalable.

**Privacidad y derechos del autor**

- Las obras del usuario nunca salen de su dispositivo: no hay cuentas, servidor ni IA que las procese.
- Los datos viven en el navegador: se avisa de que borrar los datos del sitio elimina proyectos y presets, y se recomienda exportar copias.

## 17. Roadmap revisado

El MVP prioriza el flujo completo de principio a fin con pocas funciones muy pulidas; cada fase termina en una puerta con un criterio medible antes de pasar a la siguiente.

&#91;embedded content: roadmap · 3 fases, 3 puertas\]

**Cambios respecto al roadmap original**

- Se elimina del brief original la fase de IA: no habrá IA ni servidor.
- Guardado local, proyectos en la pantalla de inicio y PWA entran en el MVP: sin ellos no se pueden retomar los trabajos.
- El parallax sigue en Fase 2, con margen seguro y huecos marcados en rojo desde el primer día.
- Texto y bocadillos animados pasan a Fase 2, porque son parte básica del lenguaje del cómic.
- La Fase 3 pasa a ser de comodidad: «Mi estilo», borrador en un clic, simulador de plataformas y tutoriales.
- Descartado por ahora: vista storyboard, pegar guion, cortar en partes, revelado de trazo, vídeo de proceso, pantalla final, looks por género, publicación directa, colaboración y enlaces de revisión, mercado de presets e IA en servidor.

## 18. Métricas de éxito, riesgos y preguntas abiertas

**Métricas propuestas (objetivos a calibrar con las primeras pruebas)**

- Tiempo desde crear el proyecto hasta el primer vídeo exportado: menos de 30 minutos para un usuario nuevo.
- Porcentaje de usuarios nuevos que exportan un vídeo en su primera sesión.
- Vídeos exportados por usuario activo al mes.
- Uso de presets frente a ajustes manuales (indica si los presets resuelven el trabajo).
- Retención a 30 días y número de proyectos reabiertos.

**Riesgos principales**

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Rendimiento flojo con PSD y capas pesadas | Alto: frustración inmediata | Proxies, límites claros y pruebas con archivos reales desde el inicio |
| Pérdida de datos si el usuario borra los datos del navegador | Alto: horas de trabajo perdidas | Almacenamiento persistente, avisos claros y copia de seguridad exportable con un clic |
| Huecos y artefactos visibles en el parallax | Medio: resultado poco profesional | Margen seguro, sobreescalado y relleno asistido |
| Alcance excesivo en el MVP | Alto: retraso | Empezar con Modo Libre y un set pequeño de presets muy pulidos |
| Licencias de música, fuentes y SFX | Medio: riesgo legal | Catálogo con licencia clara y avisos de uso |
| Competencia de editores generalistas con funciones de cómic | Medio | Profundizar en lenguaje de cómic y flujo de publicación |

**Preguntas abiertas**

- [x] ¿Qué dispositivos debe soportar de verdad: ordenador, tableta y móvil?

Si o si deberia soportar Tablet y PC que es donde más se va a trabajar

- [x] ¿El modo Webtoon entra en la primera versión o en la segunda?

El modo Webtoon es mejor incluirso en la segunda version

- [x] ¿Qué formatos de otros programas (Clip Studio, Procreate, Krita) son imprescindibles?

Procreate, Capcut, Photoshop y Premiere de referencia

- [x] ¿De dónde saldrán los SFX y la música ambiente (licencia libre) y cuántos entran en la primera versión?

SFX y musica ambiente generada por código para empezar, y mas adelante veremos si añadimos más

- [ ] ¿Qué límite de memoria y de tamaño de proyecto es razonable en el navegador (PSD pesados, 4K)?

\-

- [x] ¿Se abrirá a más usuarios además de Goti o será solo para él al principio?

Esta preparado solo para Goti pero claramente es muy probable que lo vea mas gente, entonces necesito que este hecho como herramienta para cualquier persona

- [x] ¿Cuál es el nombre definitivo del producto?

MotionComic Studio
