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
          { text: 'Escribe el texto en el panel de propiedades y arrástralo en el visor hasta su sitio.', where: '.stage', check: (c) => c.p.texts.some((q) => Object.values(q.t || {}).some((v) => String(v || '').trim().length > 1)) },
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
          { text: 'Arrastra una capa o texto por el visor cerca del centro: se pega solo y aparece una línea guía rosa. (Alt desactiva el imán.)', where: '.stage', check: (c) => c.ev.align > 0 || c.ev.snap > 0 },
          { text: 'En el panel de propiedades de una capa, pulsa uno de los botones de «Alinear» (por ejemplo, «Centro»).', where: '.alignrow', check: (c) => c.ev.align > 0 },
        ], skipHint: 'El imán se comprueba al soltar el ratón sobre una guía.' },
        { id: 'm2l3', title: 'Subtítulos y zonas seguras', why: 'En TikTok, Reels y Shorts la interfaz tapa parte de la imagen. Los subtítulos deben quedar fuera.', steps: [
          { text: 'Activa «Zonas seguras» en el menú Superposiciones del visor para ver qué tapa la interfaz.', where: '.vbar', check: (c) => c.st.safe },
          { text: 'Crea una capa de subtítulos con el «+» de su fila en la línea de tiempo y escribe su texto.', where: '.tl-labels', init: (c) => { c.mem.n = (c.p.subs || []).length; }, check: (c) => (c.p.subs || []).length > c.mem.n },
          { text: 'En «Efectos y audio» → Subtítulos elige una «Posición rápida» y comprueba que el aviso dice «Dentro de la zona segura».', where: '.leftpanel', init: (c) => { c.mem.y = subY(c.p); }, check: (c) => (c.p.subs || []).length > 0 && subY(c.p) !== c.mem.y },
        ] },
      ], challenge: { title: 'Reto: movimiento con intención', text: 'Anima una capa con al menos 3 fotogramas clave y añade subtítulos.', check: (c) => sumKf(c.p) >= 3 && (c.p.subs || []).length >= 1 } },
  ];

  const GLOSSARY = [
    ['Capa', 'Una imagen del proyecto. Varias capas forman un plano.'], ['Plano', 'Un tramo del vídeo con su propia cámara. Los planos se suceden en la línea de tiempo.'],
    ['Parallax', 'Efecto de profundidad: lo cercano se mueve más que lo lejano cuando se mueve la cámara.'], ['Profundidad (z)', 'Qué tan cerca o lejos está una capa. Define cuánto se mueve en el parallax.'],
    ['Cámara', 'Encuadre y movimiento del plano: acercar, alejar, desplazar.'], ['Cabezal', 'La barra vertical de la línea de tiempo que marca el instante que ves.'],
    ['Línea de tiempo', 'Dónde se colocan en el tiempo los planos, textos, subtítulos, efectos y sonidos.'], ['Fotograma clave', 'Un valor guardado en un instante. Entre dos fotogramas, la propiedad cambia sola.'],
    ['Interpolación', 'Cómo se pasa de un fotograma clave al siguiente: suave, lineal, con rebote…'], ['Easing', 'La curva de aceleración de un movimiento (empieza lento, termina rápido…).'],
    ['Zona segura', 'La parte de la imagen que la interfaz de la red social no tapa.'], ['Bocadillo', 'Texto con globo de cómic que puede tener cola.'],
    ['Subtítulo', 'Texto sincronizado con las palabras de la voz.'], ['Locución', 'La voz en off del vídeo.'], ['Imán', 'Ajuste automático que pega lo que arrastras a bordes, centros y guías.'],
    ['Proporción', 'La relación ancho:alto del vídeo (9:16 vertical, 16:9 horizontal, 1:1 cuadrado).'], ['Resolución', 'El tamaño en píxeles del vídeo exportado.'], ['FPS', 'Fotogramas por segundo: 24 es cine, 30 y 60 son fluidos.'],
    ['Exportar', 'Convertir el proyecto en un archivo de vídeo, imagen o audio.'], ['Transición', 'El paso de un plano a otro: corte, fundido, deslizamiento…'], ['Rack focus', 'Cambio de enfoque entre capas para dirigir la mirada.'],
  ];

  /* ---------- progreso (en este equipo) ---------- */
  const load = () => { try { return JSON.parse(MC.store.get('learn', '{}')) || {}; } catch (e) { return {}; } };
  const save = (st) => MC.store.set('learn', JSON.stringify(st));
  const lessons = COURSE.flatMap((m) => m.lessons.map((l) => Object.assign({ m }, l)));
  const find = (id) => lessons.find((l) => l.id === id);
  const pct = () => { const d = load().done || {}; return Math.round((lessons.filter((l) => d[l.id]).length / lessons.length) * 100); };

  /* contadores de acciones del estudio (los avisa studio.js) */
  const ev = { align: 0, snap: 0, played: 0 };
  MC.learnEvent = (n) => { if (n in ev) ev[n]++; };

  let cur = null; const closeCur = () => { try { if (cur && cur.close) cur.close(); } catch (e) { /* ya cerrado */ } cur = null; };

  /* ---------- panel del curso dentro del estudio ---------- */
  let coach = null, timer = 0, run = null; // run: { lesson, i, ok, mem }
  const ctx = () => ({ p: MC.studioApi.project(), st: MC.studioApi.learn(), ev, mem: run.mem });
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
      h('div', { class: 'lc-head' }, h('b', null, L.m.title + ' · ' + L.title), h('span', { class: 'cap' }, 'Paso ' + (run.i + 1) + ' de ' + L.steps.length),
        h('button', { class: 'btn btn-g btn-sm', type: 'button', 'aria-label': 'Cerrar el curso (se guarda por dónde vas)', title: 'Cerrar el curso (se guarda por dónde vas)', onClick: () => { persistPos(); stopCoach(); } }, '✕')),
      run.i === 0 ? h('p', { class: 'cap lc-why' }, L.why) : null,
      h('p', { class: 'lc-text' }, s.text),
      h('div', { class: 'lc-status', role: 'status', 'aria-live': 'polite', 'data-ok': String(run.ok) }, run.ok ? '✔ ¡Hecho! Ya puedes pasar al siguiente paso.' : 'Esperando a que lo hagas… (se comprueba solo)'),
      h('div', { class: 'lc-acts' },
        h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: run.i === 0, onClick: () => { run.i--; enterStep(); persistPos(); draw(); } }, 'Atrás'),
        s.where ? h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => pulse(s.where) }, 'Mostrar dónde') : null,
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
  function tick() { if (!run || !MC.studioApi) return; try { if (MC.studioApi.learn().playing) ev.played++; const ok = !!run.lesson.steps[run.i].check(ctx()); if (ok !== run.ok) { run.ok = ok; if (ok) MC.announce('Paso completado'); draw(); } } catch (e) { /* aún no hay datos */ } }
  function openLesson(id, i) {
    const L = find(id); if (!L) return;
    const go = () => {
      stopCoach(); run = { lesson: L, i: Math.min(i || 0, L.steps.length - 1), ok: false, mem: {} };
      coach = h('aside', { class: 'learn-coach', 'aria-label': 'Curso: Edita tu propio vídeo' }); document.body.append(coach);
      enterStep(); persistPos(); draw(); timer = setInterval(tick, 500);
    };
    if (MC.studioApi) go(); else { MC.pendingLearn = { id, i: i || 0 }; MC.toast('Primero hace falta un proyecto: abre el tuyo o el de ejemplo.'); closeCur(); MC.app.openSample(); }
  }
  MC.learn = { active: () => !!load().pos, resume: () => { const q = MC.pendingLearn || (load().pos && { id: load().pos.l, i: load().pos.i }); MC.pendingLearn = null; if (q && MC.lang === 'es') openLesson(q.id, q.i); }, stop: stopCoach, pct };

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
