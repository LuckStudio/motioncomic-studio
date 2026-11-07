/* Aprender: «Edita tu propio vídeo». Un curso práctico dentro del estudio: cada paso te pide hacer algo en TU proyecto y el programa comprueba
   solo que lo has hecho. Solo en español por ahora (en inglés se muestra «próximamente»). El progreso se guarda en este equipo. */
(function () {
  'use strict';
  const MC = window.MC, h = MC.h;

  /* ---------- contenido del curso ---------- */
  const sumLayers = (p) => p.shots.reduce((n, s) => n + s.layers.length, 0);
  const sumKf = (p) => p.shots.reduce((n, s) => n + s.layers.reduce((m, l) => m + (l.kf || []).length, 0), 0) + (p.overlays || []).reduce((n, o) => n + (o.kf || []).length, 0) + (p.texts || []).reduce((n, o) => n + (o.kf || []).length, 0);
  const total = (p) => p.shots.reduce((n, s) => n + (s.duration || 0), 0);
  const zs = (p) => p.shots.flatMap((s) => s.layers.map((l) => l.z)).join(',');
  const cams = (p) => p.shots.map((s) => (s.camera && s.camera.preset) || 'none').join(',');
  const subY = (p) => (p.subs || []).map((q) => (q.style && q.style.y != null ? q.style.y : 'x')).join(',');

  const fxN = (p) => p.shots.reduce((n, s2) => n + (s2.fx || []).length, 0);
  const trs = (p) => p.shots.map((s2) => (s2.transition && s2.transition.type) || 'cut').join(',');
  const clipsOf = (p, tr) => (p.clips || []).filter((c) => tr.includes(c.track)).length;
  const lookKey = (p) => JSON.stringify(p.look || {});

  const COURSE = [
    { id: 'm1', title: 'Tu primer vídeo', intro: 'De tus ilustraciones a un vídeo que se mueve: importar, dar profundidad, mover la cámara, montar planos, poner texto y exportar.',
      lessons: [
        { id: 'm1l1', title: 'Importa tu arte', why: 'Todo empieza con tus imágenes. Cada archivo es una capa; un plano agrupa las capas que se ven a la vez.', steps: [
          { text: 'Importa al menos una imagen tuya con el botón «Importar» del panel de capas, o arrastrándola al visor.', where: '.p-layers .ph .btn', check: (c) => sumLayers(c.p) >= 1 },
          { text: 'Haz clic en una capa de la lista para seleccionarla. Verás sus propiedades a la derecha.', where: '.p-layers .pbody', check: (c) => c.st.li >= 0 },
          { text: 'Arrastra la capa dentro del visor para moverla. Con la rueda del ratón se escala.', where: '.stage', init: (c) => { c.mem.pos = c.p.shots.flatMap((s) => s.layers.map((l) => (l.x || 0) + ',' + (l.y || 0) + ',' + (l.scale || 1))).join(';'); }, check: (c) => c.p.shots.flatMap((s) => s.layers.map((l) => (l.x || 0) + ',' + (l.y || 0) + ',' + (l.scale || 1))).join(';') !== c.mem.pos },
        ] },
        { id: 'm1l2', title: 'Profundidad y cámara', why: 'El parallax nace de dos ideas: cada capa está a una profundidad y la cámara se mueve. Las capas cercanas se desplazan más que las lejanas.', steps: [
          { text: 'Con una capa seleccionada, cambia su profundidad (z) en el panel de propiedades de la capa.', where: '.sec[data-id="capa"]', init: (c) => { c.mem.z = zs(c.p); }, check: (c) => zs(c.p) !== c.mem.z },
          { text: 'Abre la pestaña «Cámara» del panel izquierdo y elige un movimiento (por ejemplo, un acercamiento lento).', where: '.leftpanel', init: (c) => { c.mem.cam = cams(c.p); }, check: (c) => cams(c.p) !== c.mem.cam },
          { text: 'Pulsa reproducir (o la barra espaciadora) y mira cómo se mueve. Si ves huecos, activa «Huecos» en el visor.', where: '.play', check: (c) => c.ev.played > 0 },
        ] },
        { id: 'm1l3', title: 'Monta varios planos', why: 'Un vídeo son varios planos seguidos. La duración de cada uno marca el ritmo.', steps: [
          { text: 'Añade un segundo plano (botón «Planos desde imágenes» o importando otra imagen como plano nuevo).', where: '.p-timeline .tl-head', check: (c) => c.p.shots.length >= 2 },
          { text: 'Estira el final de un plano en la línea de tiempo (o cambia su duración en sus propiedades) para cambiar el ritmo.', where: '.p-timeline', init: (c) => { c.mem.d = c.p.shots.map((s) => s.duration).join(','); }, check: (c) => c.p.shots.map((s) => s.duration).join(',') !== c.mem.d },
        ] },
        { id: 'm1l4', title: 'Texto y bocadillos', why: 'El texto cuenta lo que la imagen no dice. Cada texto aparece en un momento y dura lo que tú decidas.', steps: [
          { text: 'Coloca el cabezal donde quieras que entre el texto y añade un texto o un bocadillo desde el panel «Efectos y audio» → Texto.', where: '.leftpanel', init: (c) => { c.mem.n = c.p.texts.length; }, check: (c) => c.p.texts.length > c.mem.n },
          { text: 'Escribe el texto en el panel de propiedades y arrástralo en el visor hasta su sitio.', where: '.stage', init: (c) => { c.mem.t = JSON.stringify(c.p.texts.map((q) => q.t)); }, check: (c) => JSON.stringify(c.p.texts.map((q) => q.t)) !== c.mem.t && c.p.texts.some((q) => Object.values(q.t || {}).some((v) => String(v || '').trim().length > 1)) },
        ] },
        { id: 'm1l5', title: 'Exporta tu vídeo', why: 'Exportar convierte tu proyecto en un archivo que puedes subir. Elige la plataforma y el programa ajusta formato y calidad.', steps: [
          { text: 'Abre la pestaña «Exportar» (arriba). Es un espacio propio: puedes seguir editando mientras exporta.', where: '.s-tabs button:last-child', check: (c) => c.st.ws === 'exportar' },
        ] },
      ], challenge: { title: 'Reto: tu primer minuto', text: 'Consigue un vídeo de al menos 8 segundos con 3 planos y algún texto.', check: (c) => c.p.shots.length >= 3 && total(c.p) >= 8 && c.p.texts.length >= 1 } },
    { id: 'm2', title: 'Dar vida y pulir', intro: 'Animación con fotogramas clave, alineación precisa y subtítulos que no tapa la interfaz de la red social.',
      lessons: [
        { id: 'm2l1', title: 'Fotogramas clave', why: 'Un fotograma clave guarda un valor en un instante; entre dos fotogramas el programa mueve la propiedad solo.', steps: [
          { text: 'Selecciona una capa y mueve el cabezal a un instante distinto del inicio.', where: '.tl-ruler', check: (c) => c.st.li >= 0 && c.st.time > 0.2 },
          { text: 'Pulsa «Grabar fotogramas» en el visor y arrastra la capa a otro sitio: se crean fotogramas solos. (También sirve el rombo de la barra de la línea de tiempo.)', where: '.recbtn', init: (c) => { c.mem.k = sumKf(c.p); }, check: (c) => sumKf(c.p) > c.mem.k },
          { text: 'En la fila «Fotogramas clave» de la línea de tiempo pulsa «Avanzada» para ver una fila por propiedad.', where: '.kfadv', check: (c) => c.st.kfAdv },
        ] },
        { id: 'm2l2', title: 'Alinear con precisión', why: 'Lo bien alineado se ve profesional. El imán del visor y los botones de alinear te ahorran ojear.', steps: [
          { text: 'Arrastra una capa o texto por el visor cerca del centro: se pega solo y aparece una línea guía rosa. (Alt desactiva el imán.)', where: '.stage', check: (c) => c.ev.snap > 0 },
          { text: 'En el panel de propiedades de una capa, pulsa uno de los botones de «Alinear» (por ejemplo, «Centro»).', where: '.alignrow', check: (c) => c.ev.align > 0 },
        ], skipHint: 'El imán se comprueba al soltar el ratón sobre una guía.' },
        { id: 'm2l3', title: 'Subtítulos y zonas seguras', why: 'En TikTok, Reels y Shorts la interfaz tapa parte de la imagen. Los subtítulos deben quedar fuera.', steps: [
          { text: 'Activa «Zonas seguras» en el menú Superposiciones del visor para ver qué tapa la interfaz. Solo está disponible en proyectos verticales (9:16): si el tuyo es horizontal, cambia la proporción en Proyecto o pulsa «Saltar».', where: '.vbar', check: (c) => c.st.safe },
          { text: 'Crea una capa de subtítulos con el «+» de su fila en la línea de tiempo y escribe su texto.', where: '.tl-labels', init: (c) => { c.mem.n = (c.p.subs || []).length; }, check: (c) => (c.p.subs || []).length > c.mem.n },
          { text: 'En «Efectos y audio» → Subtítulos elige una «Posición rápida» y comprueba que el aviso dice «Dentro de la zona segura».', where: '.leftpanel', init: (c) => { c.mem.y = subY(c.p); }, check: (c) => (c.p.subs || []).length > 0 && subY(c.p) !== c.mem.y },
        ] },
      ], challenge: { title: 'Reto: movimiento con intención', text: 'Anima una capa con al menos 3 fotogramas clave y añade subtítulos.', check: (c) => sumKf(c.p) >= 3 && (c.p.subs || []).length >= 1 } },
    { id: 'm3', title: 'Sonido y voz', intro: 'Un vídeo suena tanto como se ve: música, efectos de sonido y la voz que cuenta la historia.',
      lessons: [
        { id: 'm3l1', title: 'Música y efectos de sonido', why: 'La música marca el ánimo y los efectos subrayan los golpes. Cada sonido es un clip en su pista de la línea de tiempo.', steps: [
          { text: 'Abre la pestaña «Música» (Efectos y audio) y añade una pista a tu vídeo, o importa tu propio audio con el «+» de la pista de música.', open: ['creativo', 'musica'], where: '.leftpanel', init: (c) => { c.mem.n = clipsOf(c.p, ['musica']); }, check: (c) => clipsOf(c.p, ['musica']) > c.mem.n },
          { text: 'Ahora añade un efecto de sonido desde la pestaña «SFX» (un golpe, un viento…) en el momento que quieras.', open: ['creativo', 'sfx'], where: '.leftpanel', init: (c) => { c.mem.n = clipsOf(c.p, ['sfx']); }, check: (c) => clipsOf(c.p, ['sfx']) > c.mem.n },
          { text: 'Abre el «Mezclador» y mira los volúmenes de cada pista: la música suele ir bastante más baja que la voz.', open: ['creativo', 'mezclador'], where: '.leftpanel', check: (c) => c.st.tab === 'mezclador' },
        ] },
        { id: 'm3l2', title: 'La voz en off', why: 'La locución da el ritmo: los planos y los textos se ajustan a ella, no al revés.', steps: [
          { text: 'Importa un audio de voz con el «+» de la pista «Locución» de la línea de tiempo (o grábalo con el micrófono: tu voz no sale del equipo).', where: '.tl-labels', init: (c) => { c.mem.n = clipsOf(c.p, ['voz']); }, check: (c) => clipsOf(c.p, ['voz']) > c.mem.n },
          { text: 'En el «Mezclador» usa «Marcar pausas de la voz» y luego «Ajustar planos a la voz» para repartir la duración de los planos.', open: ['creativo', 'mezclador'], where: '.leftpanel', init: (c) => { c.mem.d = c.p.shots.map((q) => q.duration).join(','); }, check: (c) => c.p.shots.map((q) => q.duration).join(',') !== c.mem.d },
        ] },
      ], challenge: { title: 'Reto: que suene', text: 'Pon música, un efecto de sonido y una voz en tu proyecto.', check: (c) => clipsOf(c.p, ['musica']) >= 1 && clipsOf(c.p, ['sfx']) >= 1 && clipsOf(c.p, ['voz']) >= 1 } },
    { id: 'm4', title: 'Transiciones, efectos y estilo', intro: 'El paso de un plano a otro, los golpes visuales y el aspecto general de tu cómic en movimiento.',
      lessons: [
        { id: 'm4l1', title: 'Transiciones entre planos', why: 'Un corte seco es una decisión; un fundido o un deslizamiento cuentan otra cosa. Cada transición entra en el plano al que se aplica.', steps: [
          { text: 'Selecciona el segundo plano (necesitas al menos dos) en la línea de tiempo o en el panel de planos.', where: '.p-timeline', check: (c) => c.p.shots.length >= 2 && c.st.shot >= 1 },
          { text: 'Abre la pestaña «Transiciones» (Efectos y audio) y elige una distinta del corte. Pasa el ratón por encima para verla en el visor.', open: ['creativo', 'transiciones'], where: '.leftpanel', init: (c) => { c.mem.t = trs(c.p); }, check: (c) => trs(c.p) !== c.mem.t },
        ] },
        { id: 'm4l2', title: 'Efectos visuales', why: 'Temblor, impacto, lluvia, velocidad… Los efectos duran un tramo del plano y se colocan donde los necesites.', steps: [
          { text: 'Abre la pestaña «Efectos» (Efectos y audio) y añade un efecto al plano seleccionado.', open: ['creativo', 'efectos'], where: '.leftpanel', init: (c) => { c.mem.n = fxN(c.p); }, check: (c) => fxN(c.p) > c.mem.n },
          { text: 'Mueve el cabezal por el plano y comprueba en el visor cómo actúa el efecto en su tramo.', where: '.tl-ruler', init: (c) => { c.mem.tm = c.st.time; }, check: (c) => Math.abs(c.st.time - c.mem.tm) > 0.3 },
        ] },
        { id: 'm4l3', title: 'El aspecto de todo el vídeo', why: 'Viñeta, grano, trama de puntos o un tinte unifican las capas y le dan carácter al conjunto.', steps: [
          { text: 'Abre la pestaña «Aspecto» (Montaje) y cambia algo: viñeta, grano, trama de puntos o tinte.', open: ['montaje', 'aspecto'], where: '.leftpanel', init: (c) => { c.mem.k = lookKey(c.p); }, check: (c) => lookKey(c.p) !== c.mem.k },
          { text: 'Abre «Estilo» (Montaje) para ver el estilo del proyecto: ahí puedes guardarlo como «Mi estilo» y reutilizarlo.', open: ['montaje', 'estilo'], where: '.leftpanel', check: (c) => c.st.tab === 'estilo' },
        ] },
      ], challenge: { title: 'Reto: un montaje con carácter', text: 'Que tu proyecto tenga al menos una transición distinta del corte y un efecto visual.', check: (c) => trs(c.p).split(',').some((x) => x !== 'cut') && fxN(c.p) >= 1 } },
    { id: 'm5', title: 'Publicar donde quieras', intro: 'Elegir el formato correcto, comprobar cómo se verá dentro de cada red social y exportar con idiomas.',
      lessons: [
        { id: 'm5l1', title: 'Formato y plataforma', why: 'Cada plataforma pide su proporción: 9:16 vertical para TikTok, Reels y Shorts; 16:9 para YouTube. Decidirlo al principio ahorra rehacer.', steps: [
          { text: 'Abre el panel «Proyecto» (Montaje) y mira la proporción y la resolución. Cámbialas si tu plataforma pide otra.', open: ['montaje', 'proyecto'], where: '.leftpanel', init: (c) => { c.mem.r = c.p.ratio + c.p.res; }, check: (c) => c.p.ratio + c.p.res !== c.mem.r || c.st.tab === 'proyecto' },
          { text: 'En un proyecto vertical activa «Simulador» en el menú Superposiciones del visor para ver el vídeo con la interfaz de la red encima.', where: '.vbar', check: (c) => c.st.sim },
          { text: 'Abre la pestaña «Exportar»: elige una plataforma y el programa ajusta formato, resolución y calidad.', open: ['exportar'], where: '.s-tabs button:last-child', check: (c) => c.st.ws === 'exportar' },
        ] },
        { id: 'm5l2', title: 'Varios idiomas', why: 'Cada idioma tiene su propio texto y se exporta por separado, sin duplicar el proyecto.', steps: [
          { text: 'En el panel «Proyecto» → «Idiomas y subtítulos» activa un idioma más (por ejemplo, inglés).', open: ['montaje', 'proyecto'], where: '.leftpanel', init: (c) => { c.mem.n = c.p.langs.length; }, check: (c) => c.p.langs.length > c.mem.n },
          { text: 'Pulsa «Tabla de traducción» y escribe la traducción de un texto.', where: '.leftpanel', init: (c) => { c.mem.t = JSON.stringify(c.p.texts.map((q) => q.t)); }, check: (c) => JSON.stringify(c.p.texts.map((q) => q.t)) !== c.mem.t },
        ] },
      ], challenge: { title: 'Reto: listo para publicar', text: 'Proyecto con al menos 2 idiomas y un texto traducido.', check: (c) => c.p.langs.length >= 2 && c.p.texts.some((q) => Object.values(q.t || {}).filter((v) => String(v || '').trim()).length >= 2) } },
    { id: 'm6', title: 'Tu estilo, atajos e IA', intro: 'Trabajar más rápido con atajos, guardar tu forma de montar como «Mi estilo» y dejar que una IA te ayude con las mismas reglas que tú.',
      lessons: [
        { id: 'm6l1', title: 'Atajos de teclado', why: 'Los atajos te ahorran miles de clics. Puedes usar los de MotionComic o los de programas que ya conoces, como Premiere, After Effects, CapCut, DaVinci Resolve o Blender.', steps: [
          { text: 'Abre Ayuda (el «?» de la barra superior) → Atajos y mira la lista. Elige otra base de atajos (por ejemplo, la de un programa que ya uses).', where: '.s-top', init: (c) => { c.mem.b = MC.keys.base(); }, check: (c) => MC.keys.base() !== c.mem.b },
          { text: 'Selecciona una capa, mueve el cabezal y añade un fotograma clave con su atajo (en la base MotionComic es la tecla I; en otras bases mira la lista).', where: '.tl-ruler', init: (c) => { c.mem.k = sumKf(c.p); }, check: (c) => sumKf(c.p) > c.mem.k },
          { text: 'Vuelve a la base MotionComic en Ayuda → Atajos si prefieres mantener los de siempre. Cuando lo hayas hecho, este paso se marca solo.', where: '.s-top', check: (c) => MC.keys.base() === 'motioncomic' },
        ] },
        { id: 'm6l2', title: 'Mi estilo y mi guía', why: '«Mi estilo» guarda cómo montas (transiciones, cámara, ritmo, aspecto) y se aplica a los proyectos nuevos. La guía de estilo son tus notas escritas.', steps: [
          { text: 'Abre la pestaña «Estilo» (Montaje), ajusta lo que quieras y pulsa «Guardar como Mi estilo».', open: ['montaje', 'estilo'], where: '.leftpanel', init: (c) => { c.mem.a = MC.myStyle.savedAt(); }, check: (c) => MC.myStyle.savedAt() > c.mem.a },
          { text: 'En la pantalla de inicio, tarjeta «Mi guía de estilo», escribe unas líneas sobre cómo trabajas (ritmo, transiciones, lo que nunca haces). Se guarda sola.', where: '.s-top', init: (c) => { c.mem.g = MC.styleGuide.savedAt(); }, check: (c) => MC.styleGuide.savedAt() > c.mem.g },
        ] },
        { id: 'm6l3', title: 'Trabajar con una IA', why: 'Tu IA de confianza puede ayudarte sin salir del equipo: lee tu guía y tu estilo y monta como tú lo harías. Tú decides qué se comparte.', steps: [
          { text: 'Abre Preferencias → «IA» y mira cómo se conecta una IA por MCP: tus proyectos y tu voz no salen del equipo salvo lo que tú elijas.', where: '.s-top', check: (c) => c.ev.mcp > 0 },
          { text: 'En la tarjeta «Mi guía de estilo» de la pantalla de inicio (o en su editor) pulsa «Copiar para una IA»: así cualquier chat sabe cómo trabajas.', where: '.s-top', check: (c) => c.ev.copyai > 0 },
        ] },
      ], challenge: { title: 'Reto: tu sello personal', text: 'Guarda tu estilo y escribe tu guía de estilo.', check: () => MC.myStyle.savedAt() > 0 && MC.styleGuide.savedAt() > 0 } },
  ];

  const GLOSSARY = [
    ['Capa', 'Una imagen del proyecto. Varias capas forman un plano.'], ['Capa agrupada', 'En la línea de tiempo por pistas, un clip que reúne varias capas con profundidad (parallax).'], ['Plano', 'Un tramo del vídeo con su propia cámara. Los planos se suceden en la línea de tiempo.'],
    ['Parallax', 'Efecto de profundidad: lo cercano se mueve más que lo lejano cuando se mueve la cámara.'], ['Profundidad (z)', 'Qué tan cerca o lejos está una capa. Define cuánto se mueve en el parallax.'],
    ['Cámara', 'Encuadre y movimiento del plano: acercar, alejar, desplazar.'], ['Cabezal', 'La barra vertical de la línea de tiempo que marca el instante que ves.'],
    ['Línea de tiempo', 'Dónde se colocan en el tiempo los planos, textos, subtítulos, efectos y sonidos.'], ['Fotograma clave', 'Un valor guardado en un instante. Entre dos fotogramas, la propiedad cambia sola.'],
    ['Interpolación', 'Cómo se pasa de un fotograma clave al siguiente: suave, lineal, con rebote…'], ['Easing', 'La curva de aceleración de un movimiento (empieza lento, termina rápido…).'],
    ['Zona segura', 'La parte de la imagen que la interfaz de la red social no tapa.'], ['Bocadillo', 'Texto con globo de cómic que puede tener cola.'],
    ['Subtítulo', 'Texto sincronizado con las palabras de la voz.'], ['Locución', 'La voz en off del vídeo.'], ['Imán', 'Ajuste automático que pega lo que arrastras a bordes, centros y guías.'],
    ['Proporción', 'La relación ancho:alto del vídeo (9:16 vertical, 16:9 horizontal, 1:1 cuadrado).'], ['Resolución', 'El tamaño en píxeles del vídeo exportado.'], ['FPS', 'Fotogramas por segundo: 24 es cine, 30 y 60 son fluidos.'],
    ['Mezclador', 'Donde se ajusta el volumen de cada pista de sonido.'], ['SFX', 'Efectos de sonido: golpes, viento, pasos…'], ['Pista', 'Una fila de la línea de tiempo con su tipo de contenido: planos, texto, voz, música…'],
    ['Viñeta (aspecto)', 'Oscurecimiento de los bordes de la imagen para dirigir la mirada al centro.'], ['Grano', 'Ruido fino que da textura de película.'], ['Trama de puntos', 'Efecto de cómic impreso: la imagen se ve hecha de puntos.'], ['Simulador', 'Vista del vídeo con la interfaz de una red social encima para ver qué tapa.'], ['Idioma del proyecto', 'Cada idioma tiene su propio texto y se exporta por separado.'],
    ['Base de atajos', 'Conjunto de atajos inspirado en un programa conocido (Premiere, After Effects, CapCut, DaVinci Resolve, Blender…).'], ['Mi estilo', 'Tus ajustes de montaje guardados para aplicarlos a proyectos nuevos.'], ['Guía de estilo', 'Tus notas en Markdown sobre cómo trabajas; sirve de referencia para ti y para una IA.'], ['MCP', 'Forma estándar de conectar una IA con una herramienta. Aquí la conexión es local, en tu equipo.'],
    ['Exportar', 'Convertir el proyecto en un archivo de vídeo, imagen o audio.'], ['Transición', 'El paso de un plano a otro: corte, fundido, deslizamiento…'], ['Rack focus', 'Cambio de enfoque entre capas para dirigir la mirada.'],
  ];

  /* ---------- progreso (en este equipo) ---------- */
  const load = () => { try { return JSON.parse(MC.store.get('learn', '{}')) || {}; } catch (e) { return {}; } };
  const save = (st) => MC.store.set('learn', JSON.stringify(st));
  const lessons = COURSE.flatMap((m) => m.lessons.map((l) => Object.assign({ m }, l)));
  const find = (id) => lessons.find((l) => l.id === id);
  const pct = () => { const d = load().done || {}; return Math.round((lessons.filter((l) => d[l.id]).length / lessons.length) * 100); };

  /* contadores de acciones del estudio (los avisa studio.js) */
  const ev = { align: 0, snap: 0, played: 0, mcp: 0, copyai: 0 };
  MC.learnEvent = (n) => { if (n in ev) ev[n]++; };

  let cur = null; const closeCur = () => { try { if (cur && cur.close) cur.close(); } catch (e) { /* ya cerrado */ } cur = null; };

  /* ---------- panel del curso dentro del estudio ---------- */
  let coach = null, timer = 0, run = null; // run: { lesson, i, ok, mem }
  const ctx = () => ({ p: MC.studioApi ? MC.studioApi.project() : null, st: MC.studioApi ? MC.studioApi.learn() : {}, ev, mem: run.mem }); /* sin estudio abierto (pantalla de inicio) solo valen los pasos que no usan el proyecto */
  function place(x, y) { if (!coach) return; const w = coach.offsetWidth || 360, hh = coach.offsetHeight || 120; coach.style.right = 'auto'; coach.style.bottom = 'auto'; coach.style.left = Math.max(4, Math.min(innerWidth - w - 4, x)) + 'px'; coach.style.top = Math.max(4, Math.min(innerHeight - 40, y)) + 'px'; }
  function stopCoach() { clearInterval(timer); timer = 0; if (coach) { coach.remove(); coach = null; } run = null; }
  function pulse(sel) {
    const e = sel && document.querySelector(sel); if (!e) { MC.toast('Esta parte no está a la vista ahora; cambia de panel o abre la pestaña que indica el paso.'); return; }
    try { e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (x) { /* sin desplazamiento */ }
    e.classList.add('learn-pulse'); setTimeout(() => e.classList.remove('learn-pulse'), 3200);
  }
  function enterStep() { const L = run.lesson, s = L.steps[run.i]; run.mem = {}; run.ok = false; Object.keys(ev).forEach((k) => { ev[k] = 0; }); try { if (s.init) s.init(ctx()); } catch (e) { /* sin base */ } }
  function persistPos() { const st = load(); st.pos = run ? { l: run.lesson.id, i: run.i } : null; save(st); }
  function draw() {
    if (!run) return; const L = run.lesson, s = L.steps[run.i], last = run.i === L.steps.length - 1;
    MC.clear(coach);
    coach.append(
      h('div', { class: 'lc-head', title: 'Arrastra para mover este panel' }, h('b', null, L.m.title + ' · ' + L.title), h('span', { class: 'cap' }, 'Paso ' + (run.i + 1) + ' de ' + L.steps.length),
        h('button', { class: 'btn btn-g btn-sm lc-min', type: 'button', 'aria-label': coach.classList.contains('min') ? 'Desplegar el curso' : 'Plegar el curso', title: coach.classList.contains('min') ? 'Desplegar' : 'Plegar (se queda solo la cabecera)', onClick: () => { coach.classList.toggle('min'); draw(); } }, coach.classList.contains('min') ? '▢' : '–'),
        h('button', { class: 'btn btn-g btn-sm', type: 'button', 'aria-label': 'Cerrar el curso (se guarda por dónde vas)', title: 'Cerrar el curso (se guarda por dónde vas)', onClick: () => { persistPos(); stopCoach(); } }, '✕')),
      run.i === 0 ? h('p', { class: 'cap lc-why' }, L.why) : null,
      h('p', { class: 'lc-text' }, s.text),
      h('div', { class: 'lc-status', role: 'status', 'aria-live': 'polite', 'data-ok': String(run.ok) }, run.ok ? '✔ ¡Hecho! Ya puedes pasar al siguiente paso.' : 'Esperando a que lo hagas… (se comprueba solo)'),
      h('div', { class: 'lc-acts' },
        h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: run.i === 0, onClick: () => { run.i--; enterStep(); persistPos(); draw(); } }, 'Atrás'),
        s.where || s.open ? h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { if (s.open && MC.studioApi) { MC.studioApi.openWs(s.open[0], s.open[1]); setTimeout(() => pulse(s.where), 350); } else pulse(s.where); } }, s.open ? 'Llevarme allí' : 'Mostrar dónde') : null,
        h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => next(true) }, 'Saltar'),
        h('button', { class: 'btn btn-p btn-sm', type: 'button', disabled: !run.ok, onClick: () => next(false) }, last ? 'Terminar la lección' : 'Siguiente')));
  }
  function next(skipped) {
    const L = run.lesson;
    if (run.i < L.steps.length - 1) { run.i++; enterStep(); persistPos(); draw(); return; }
    const st = load(); st.done = st.done || {}; st.done[L.id] = skipped ? st.done[L.id] || 'skip' : true; st.pos = null; save(st);
    const idx = lessons.indexOf(find(L.id)), nxt = lessons[idx + 1]; stopCoach();
    MC.toast(skipped ? 'Lección saltada.' : '¡Lección completada! ' + (nxt ? 'Siguiente: ' + nxt.title : 'Has terminado el curso.'));
    MC.openLearn();
  }
  function tick() { if (!run) return; try { if (MC.studioApi && MC.studioApi.learn().playing) ev.played++; const ok = !!run.lesson.steps[run.i].check(ctx()); if (ok !== run.ok) { run.ok = ok; if (ok) MC.announce('Paso completado'); draw(); } } catch (e) { /* aún no hay datos */ } }
  function openLesson(id, i) {
    const L = find(id); if (!L) return;
    const go = () => {
      stopCoach(); run = { lesson: L, i: Math.min(i || 0, L.steps.length - 1), ok: false, mem: {} };
      coach = h('aside', { class: 'learn-coach', 'aria-label': 'Curso: Edita tu propio vídeo' }); document.body.append(coach);
      try { const q = JSON.parse(MC.store.get('learnpos', 'null')); if (q) place(q.x, q.y); } catch (e) { /* posición por defecto */ }
      /* se puede arrastrar por la cabecera para que no tape lo que estás haciendo; se recuerda la posición */
      coach.addEventListener('pointerdown', (e) => {
        if (!e.target.closest('.lc-head') || e.target.closest('button')) return; const r = coach.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
        coach.setPointerCapture(e.pointerId);
        const mv = (ev) => place(ev.clientX - dx, ev.clientY - dy), up = () => { coach.removeEventListener('pointermove', mv); coach.removeEventListener('pointerup', up); const b = coach.getBoundingClientRect(); MC.store.set('learnpos', JSON.stringify({ x: b.left, y: b.top })); };
        coach.addEventListener('pointermove', mv); coach.addEventListener('pointerup', up);
      });
      enterStep(); persistPos(); draw(); timer = setInterval(tick, 500);
    };
    if (MC.studioApi) go(); else { MC.pendingLearn = { id, i: i || 0 }; MC.toast('Primero hace falta un proyecto: abre el tuyo o el de ejemplo.'); closeCur(); MC.app.openSample(); }
  }
  MC.learn = { course: COURSE, open: openLesson, active: () => !!load().pos, resume: () => { const q = MC.pendingLearn || (load().pos && { id: load().pos.l, i: load().pos.i }); MC.pendingLearn = null; if (q && MC.lang === 'es') openLesson(q.id, q.i); }, stop: stopCoach, pct };

  /* ---------- glosario ---------- */
  function openGlossary() {
    const q = h('input', { class: 'input', type: 'search', placeholder: 'Buscar un término', 'aria-label': 'Buscar en el glosario' }), list = h('dl', { class: 'gloss' });
    const fill = () => { MC.clear(list); const v = q.value.trim().toLowerCase(); GLOSSARY.filter((g) => !v || (g[0] + ' ' + g[1]).toLowerCase().includes(v)).forEach((g) => list.append(h('dt', null, g[0]), h('dd', null, g[1]))); if (!list.children.length) list.append(h('p', { class: 'cap' }, 'No hay ningún término con eso.')); };
    q.addEventListener('input', fill); fill();
    cur = MC.modal('Glosario', h('div', { style: { display: 'grid', gap: '10px' } }, q, list), (close) => [h('button', { class: 'btn btn-p', type: 'button', onClick: close }, 'Cerrar')], {});
  }

  /* ---------- pantalla del curso ---------- */
  MC.openLearn = () => {
    if (MC.lang !== 'es') {
      cur = MC.modal('Learn', h('div', { style: { display: 'grid', gap: '10px' } }, h('p', null, 'Learn: edit your own video'), h('p', { class: 'cap' }, 'Coming soon. For now the course is only available in Spanish — switch the interface language to Spanish in Settings to try it.')), (close) => [h('button', { class: 'btn btn-p', type: 'button', onClick: close }, 'OK')], {});
      return;
    }
    const st = load(), done = st.done || {}, body = h('div', { style: { display: 'grid', gap: '14px' } });
    body.append(h('p', { class: 'cap' }, 'Un curso práctico para editar TU propio vídeo, paso a paso, dentro del estudio. Cada paso te pide hacer algo en tu proyecto y el programa comprueba solo que lo has hecho. Tu progreso se guarda en este equipo. El curso crecerá con nuevas lecciones.'),
      h('div', { class: 'lc-bar', role: 'img', 'aria-label': 'Progreso: ' + pct() + ' %' }, h('i', { style: { width: pct() + '%' } })), h('p', { class: 'cap' }, 'Progreso: ' + pct() + ' %'));
    COURSE.forEach((m) => {
      body.append(h('div', { class: 'eyebrow' }, m.title), h('p', { class: 'cap' }, m.intro));
      m.lessons.forEach((l) => body.append(h('div', { class: 'layer', style: { cursor: 'default' } }, h('span', { class: 'ln' }, h('b', null, (done[l.id] === true ? '✔ ' : done[l.id] ? '↷ ' : '') + l.title), h('span', { class: 'cap', style: { display: 'block', whiteSpace: 'normal' } }, l.why)),
        h('button', { class: 'btn ' + (done[l.id] ? 'btn-s' : 'btn-p') + ' btn-sm', type: 'button', onClick: () => { closeCur(); openLesson(l.id, st.pos && st.pos.l === l.id ? st.pos.i : 0); } }, st.pos && st.pos.l === l.id ? 'Continuar' : done[l.id] ? 'Repetir' : 'Empezar'))));
      body.append(h('div', { class: 'layer', style: { cursor: 'default' } }, h('span', { class: 'ln' }, h('b', null, '★ ' + m.challenge.title), h('span', { class: 'cap', style: { display: 'block', whiteSpace: 'normal' } }, m.challenge.text)),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => challenge(m) }, 'Comprobar mi reto')));
    });
    body.append(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: openGlossary }, 'Glosario'),
      h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => { if (confirm('¿Borrar tu progreso del curso?')) { save({}); stopCoach(); closeCur(); MC.openLearn(); } } }, 'Borrar mi progreso')));
    cur = MC.modal('Aprender: edita tu propio vídeo', body, (close) => [h('button', { class: 'btn btn-p', type: 'button', onClick: close }, 'Cerrar')], { wide: true });
  };
  /* tarjeta de la pantalla de inicio */
  MC.learnCard = () => {
    const es = MC.lang === 'es', p = pct(), cont = es && load().pos;
    return h('section', { class: 'sg-card', 'aria-label': es ? 'Aprender' : 'Learn' },
      h('div', null, h('h2', null, es ? 'Aprender: edita tu propio vídeo' : 'Learn: edit your own video'),
        h('p', { class: 'cap' }, es ? 'Un curso práctico dentro del estudio: cada paso te pide hacer algo en tu proyecto y el programa comprueba solo que lo has hecho. Con glosario y retos.' : 'A hands-on course inside the studio. Coming soon in English; for now it is only available in Spanish.'),
        es ? h('p', { class: 'cap' }, h('b', null, 'Progreso: '), p + ' %') : null),
      h('div', { class: 'sg-acts' }, h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: () => MC.openLearn() }, MC.icon('sparkle', 14), es ? (cont ? 'Continuar el curso' : p ? 'Abrir el curso' : 'Empezar el curso') : 'Coming soon')));
  };
  function challenge(m) {
    if (!MC.studioApi) { MC.toast('Abre un proyecto para comprobar el reto.'); return; }
    const tmp = { p: MC.studioApi.project(), st: MC.studioApi.learn(), ev, mem: {} }; let ok = false; try { ok = !!m.challenge.check(tmp); } catch (e) { /* sin datos */ }
    MC.toast(ok ? '★ ¡Reto superado!' : 'Todavía no: ' + m.challenge.text);
    if (ok) { const st = load(); st.done = st.done || {}; st.done['reto-' + m.id] = true; save(st); }
  }
})();
