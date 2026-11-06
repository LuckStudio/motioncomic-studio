/* «Mi estilo»: ajustes que se reutilizan en proyectos nuevos y en el borrador en un clic (PRD 13). Todo en este equipo. */
(function () {
  const MC = window.MC;

  const DEFAULT = { parallax: 'normal', curve: 'smooth', intensity: 1, transition: { type: 'wipe', dur: 0.7 }, mode: 'pan', travel: 0.8, dim: 0.55, textFont: 'comic',
    sub: { font: 'bric', size: 0.045, color: '#ffffff', bg: true, y: null } };

  MC.myStyle = {
    DEFAULT,
    saved() { try { return JSON.parse(MC.store.get('mystyle', '')) || null; } catch (e) { return null; } },
    get() { return this.saved(); },
    set(st) { MC.store.set('mystyle', JSON.stringify(st)); MC.store.set('mystyleAt', String(Date.now())); },
    savedAt() { return +MC.store.get('mystyleAt', '0') || 0; },
    clear() { MC.store.set('mystyle', ''); MC.store.set('mystyleAt', ''); },
  };

  /* Lee los ajustes que definen la dirección visual del proyecto. */
  MC.styleFromProject = (p) => {
    const sh1 = p.shots.find((s) => s.page), second = p.shots[1] || p.shots[0], cam = p.shots[0].camera;
    const bubble = p.texts.slice().reverse().find((x) => x.kind === 'bubble' || x.kind === 'box');
    return {
      parallax: p.parallax, curve: cam.curve, intensity: cam.intensity || 1, transition: Object.assign({}, second.transition), frame: p.frame ? Object.assign({}, p.frame) : null,
      mode: sh1 ? sh1.page.mode : DEFAULT.mode, travel: sh1 ? sh1.page.travel : DEFAULT.travel, dim: sh1 ? sh1.page.dim : DEFAULT.dim,
      textFont: bubble ? bubble.font : p.textFont || DEFAULT.textFont, sub: Object.assign({}, p.sub),
    };
  };

  /* Aplica el estilo a un proyecto. El llamador debe reconstruir las trayectorias de página si cambia el ritmo. */
  MC.applyStyle = (p, st, isDraft) => {
    if (st.frame && (p.mode || 'free') === 'free') p.frame = Object.assign({}, MC.FRAME_DEF, st.frame, { on: true });
    p.parallax = st.parallax; p.sub = Object.assign({}, p.sub, st.sub); p.textFont = st.textFont;
    p.shots.forEach((sh, i) => {
      if (!sh.page) sh.camera.curve = st.curve;
      if (i > 0) sh.transition = Object.assign({ type: 'cut', dur: 0.6 }, st.transition);
      else if (isDraft) sh.transition = { type: 'cut', dur: 0.6 };
      if (sh.page) Object.assign(sh.page, { mode: st.mode, travel: st.travel, dim: st.dim });
    });
  };

  /* Descripción en palabras de un estilo: lista de [concepto, valor] que se enseña en pantalla y se da a la IA. */
  MC.styleLines = (st) => {
    if (!st) return [];
    const t = MC.t, L = [], tr = st.transition || {}, info = MC.trInfo ? MC.trInfo(tr.type) : null, cv = (MC.CURVES || []).find((x) => x.v === st.curve), fo = (id) => { const f = (MC.FONTS || []).find((x) => x.id === id); return f ? t(f.es, f.en) : id; };
    const PX = { subtle: t('sutil', 'subtle'), normal: t('normal', 'normal'), wild: t('exagerado', 'exaggerated') };
    L.push([t('Transición entre planos', 'Transition between shots'), (info ? t(info.es, info.en) : tr.type) + (tr.dur ? ' · ' + tr.dur + ' s' : '') + (tr.dir ? ' · ' + tr.dir : '')]);
    L.push([t('Curva de la cámara', 'Camera curve'), cv ? t(cv.es, cv.en) : st.curve]);
    L.push([t('Intensidad de la cámara', 'Camera intensity'), '×' + (+st.intensity || 1).toFixed(2)]);
    L.push([t('Parallax', 'Parallax'), PX[st.parallax] || st.parallax]);
    if (st.frame) { const sh = (MC.FRAME_SHAPES || []).find((x) => x.v === st.frame.shape), stk = (MC.FRAME_STROKES || []).find((x) => x.v === st.frame.style); L.push([t('Viñeta', 'Panel'), (sh ? t(sh.es, sh.en) : st.frame.shape) + ' · ' + t('trazo ', 'stroke ') + (stk ? t(stk.es, stk.en) : st.frame.style) + ' ' + (st.frame.color || '') + ' · ' + t('calle ', 'gutter ') + (st.frame.bg || '') + ' ' + Math.round((st.frame.gutter || 0) * 1000) / 10 + ' %' + (st.frame.bgGrad && st.frame.bgGrad !== 'none' ? ' (' + t('degradado', 'gradient') + ')' : '')]); }
    L.push([t('Páginas', 'Pages'), (st.mode === 'pan' ? t('paneo suave', 'smooth pan') : st.mode === 'cut' ? t('salto', 'jump') : st.mode) + ' · ' + t('recorrido ', 'travel ') + st.travel + ' · ' + t('resto atenuado ', 'rest dimmed ') + Math.round((st.dim || 0) * 100) + ' %']);
    L.push([t('Tipografía de los textos', 'Text font'), fo(st.textFont)]);
    if (st.sub) L.push([t('Subtítulos', 'Subtitles'), fo(st.sub.font) + ' · ' + Math.round((st.sub.size || 0) * 1000) / 10 + ' % · ' + (st.sub.color || '') + (st.sub.bg ? ' · ' + t('con fondo', 'with background') : '')]);
    return L;
  };
  /* En qué se diferencia el proyecto actual de Mi estilo (lista de textos; vacía si coinciden) */
  MC.styleDiff = (saved, cur) => {
    const a = MC.styleLines(saved), b = MC.styleLines(cur), out = [];
    a.forEach((q, i) => { if (b[i] && b[i][1] !== q[1]) out.push(q[0] + ': ' + q[1] + ' → ' + b[i][1]); });
    return out;
  };

  /* Guía de estilo: notas en Markdown que escribe la persona (cuándo usa cada transición, el ritmo, lo que nunca hace…). Plantilla editable. */
  const TPL = () => MC.lang === 'en' ? `# My style guide

Write here how you work, so you (and any AI helping you) always follow the same criteria. Replace the dots with your own rules.

## When I use each transition
- Cut: …
- Fade to black: …
- Dissolve: …
- Wipe or push: …
- Comic transitions (ink, burst, panel mosaic): …

## Pace and camera
- How long a shot lasts: …
- Camera moves I like (and the ones I avoid): …

## Parallax and depth
- How strong, and in which scenes: …

## Panels and layout
- Panel style, gutter colour, shapes: …

## Text and subtitles
- Fonts, sizes, where bubbles go: …

## Effects and sound
- Effects I use (and when): …
- Music and sound effects: …

## What I never do
- …
` : `# Mi guía de estilo

Escribe aquí cómo trabajas, para que tú (y cualquier IA que te ayude) sigáis siempre el mismo criterio. Sustituye los puntos suspensivos por tus propias reglas.

## Cuándo uso cada transición
- Corte: …
- Fundido a negro: …
- Encadenado: …
- Barrido o empuje: …
- Transiciones de cómic (tinta, estallido, mosaico de viñetas): …

## Ritmo y cámara
- Cuánto dura un plano: …
- Movimientos de cámara que me gustan (y los que evito): …

## Parallax y profundidad
- Cuánta intensidad y en qué escenas: …

## Viñetas y maquetación
- Estilo de viñeta, color de la calle, formas: …

## Texto y subtítulos
- Tipografías, tamaños, dónde van los bocadillos: …

## Efectos y sonido
- Efectos que uso (y cuándo): …
- Música y efectos de sonido: …

## Lo que nunca hago
- …
`;
  MC.styleGuide = {
    template: TPL,
    raw() { return MC.store.get('styleguide', ''); },
    has() { return !!MC.store.get('styleguide', ''); },
    get() { return MC.store.get('styleguide', '') || TPL(); },
    set(md) { MC.store.set('styleguide', String(md || '').slice(0, 60000)); MC.store.set('styleguideAt', String(Date.now())); },
    reset() { MC.store.set('styleguide', ''); MC.store.set('styleguideAt', ''); },
    savedAt() { return +MC.store.get('styleguideAt', '0') || 0; },
    /* texto completo para dárselo a una IA o exportarlo: las notas de la persona más los ajustes guardados en Mi estilo */
    full() {
      const t = MC.t, st = MC.myStyle.get(), lines = MC.styleLines(st), head = t('# Guía de estilo de MotionComic Studio\n\nUsa esto como referencia al crear o montar un proyecto: respeta estas decisiones y estas notas.\n\n', '# MotionComic Studio style guide\n\nUse this as a reference when creating or assembling a project: respect these decisions and notes.\n\n');
      const notes = MC.store.get('styleguide', '') ? this.get() : t('(La persona aún no ha escrito notas en su guía de estilo.)\n', '(The person has not written notes in their style guide yet.)\n');
      const set = lines.length ? lines.map((q) => '- **' + q[0] + ':** ' + q[1]).join('\n') : t('(Aún no hay un «Mi estilo» guardado.)', '(There is no saved “My style” yet.)');
      return head + notes.trim() + '\n\n---\n\n## ' + t('Ajustes guardados en «Mi estilo»', 'Settings saved in “My style”') + '\n\n' + set + '\n';
    },
  };
})();
