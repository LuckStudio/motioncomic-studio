/* «Mi estilo»: ajustes que se reutilizan en proyectos nuevos y en el borrador en un clic (PRD 13). Todo en este equipo. */
(function () {
  const MC = window.MC;

  const DEFAULT = { parallax: 'normal', curve: 'smooth', intensity: 1, transition: { type: 'wipe', dur: 0.7 }, mode: 'pan', travel: 0.8, dim: 0.55, textFont: 'comic',
    sub: { font: 'bric', size: 0.045, color: '#ffffff', bg: true, y: null } };

  MC.myStyle = {
    DEFAULT,
    saved() { try { return JSON.parse(MC.store.get('mystyle', '')) || null; } catch (e) { return null; } },
    get() { return this.saved(); },
    set(st) { MC.store.set('mystyle', JSON.stringify(st)); },
    clear() { MC.store.set('mystyle', ''); },
  };

  /* Lee los ajustes que definen la dirección visual del proyecto. */
  MC.styleFromProject = (p) => {
    const sh1 = p.shots.find((s) => s.page), second = p.shots[1] || p.shots[0], cam = p.shots[0].camera;
    const bubble = p.texts.slice().reverse().find((x) => x.kind === 'bubble' || x.kind === 'box');
    return {
      parallax: p.parallax, curve: cam.curve, intensity: cam.intensity || 1, transition: { type: second.transition.type, dur: second.transition.dur },
      mode: sh1 ? sh1.page.mode : DEFAULT.mode, travel: sh1 ? sh1.page.travel : DEFAULT.travel, dim: sh1 ? sh1.page.dim : DEFAULT.dim,
      textFont: bubble ? bubble.font : p.textFont || DEFAULT.textFont, sub: Object.assign({}, p.sub),
    };
  };

  /* Aplica el estilo a un proyecto. El llamador debe reconstruir las trayectorias de página si cambia el ritmo. */
  MC.applyStyle = (p, st, isDraft) => {
    p.parallax = st.parallax; p.sub = Object.assign({}, p.sub, st.sub); p.textFont = st.textFont;
    p.shots.forEach((sh, i) => {
      if (!sh.page) sh.camera.curve = st.curve;
      if (i > 0) sh.transition = { type: st.transition.type, dur: st.transition.dur };
      else if (isDraft) sh.transition = { type: 'cut', dur: 0.6 };
      if (sh.page) Object.assign(sh.page, { mode: st.mode, travel: st.travel, dim: st.dim });
    });
  };
})();
