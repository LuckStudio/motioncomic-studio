/* Ayuda: tutoriales cortos paso a paso, atajos, ajustes de accesibilidad y medición del equipo (PRD 12 y 16). */
(function () {
  const MC = window.MC;
  const { h, t, clamp } = MC;
  MC.VERSION = '0.7';

  /* ---------- temas: del sistema, oscuros, claros, de alto contraste y uno personalizado ---------- */
  MC.THEMES = [
    ['system', 'Según el sistema', 'System', null], ['dark', 'Oscuro', 'Dark', 'dark'], ['light', 'Claro', 'Light', 'light'], ['gray', 'Gris medio', 'Mid grey', 'dark'],
    ['midnight', 'Azul noche', 'Midnight blue', 'dark'], ['sepia', 'Sepia', 'Sepia', 'light'], ['custom', 'Personalizado', 'Custom', null],
  ];
  const hex2 = (h0) => { const m = /^#?([0-9a-f]{6})$/i.exec(h0 || ''); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hex6 = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mixC = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  MC.contrastRatio = (a, b) => { const A = typeof a === 'string' ? hex2(a) : a, B = typeof b === 'string' ? hex2(b) : b; if (!A || !B) return 21; const l1 = lum(A), l2 = lum(B); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  /* colores de un tema personalizado a partir de la base, el acento y (opcional) el fondo */
  MC.customTheme = () => {
    const light = MC.store.get('cbase', 'dark') === 'light', acc = hex2(MC.store.get('caccent', '#8C7CFF')) || [140, 124, 255];
    const bgc = hex2(MC.store.get('cbg', '')), W = [255, 255, 255], K = [0, 0, 0];
    const bg = bgc || (light ? [243, 244, 246] : [15, 16, 18]), isLight = bgc ? lum(bg) > 0.4 : light;
    const panel = bgc ? (isLight ? mixC(bg, W, 0.6) : mixC(bg, W, 0.05)) : (light ? [255, 255, 255] : [23, 25, 28]);
    const raised = isLight ? mixC(bg, K, 0.04) : mixC(bg, W, 0.1), line = isLight ? mixC(bg, K, 0.16) : mixC(bg, W, 0.18), fg = isLight ? [21, 23, 26] : [236, 238, 240], muted = isLight ? mixC(fg, W, 0.4) : mixC(fg, K, 0.38);
    const onAcc = MC.contrastRatio(acc, K) >= MC.contrastRatio(acc, W) ? [15, 16, 18] : [255, 255, 255];
    return { scheme: isLight ? 'light' : 'dark', accent: acc, v: { '--bg': hex6(bg), '--panel': hex6(panel), '--raised': hex6(raised), '--line': hex6(line), '--fg': hex6(fg), '--muted': hex6(muted), '--stage': hex6(mixC(bg, K, isLight ? 0.08 : 0.4)),
      '--accent': hex6(acc), '--accent-hover': hex6(mixC(acc, isLight ? K : W, 0.18)), '--on-accent': hex6(onAcc), '--accent-tint': 'rgba(' + acc.map(Math.round).join(',') + ',0.16)', '--clip': hex6(fg), '--clip-ink': hex6(bg) } };
  };
  const CUSTOM_VARS = ['--bg', '--panel', '--raised', '--line', '--fg', '--muted', '--stage', '--accent', '--accent-hover', '--on-accent', '--accent-tint', '--clip', '--clip-ink'];
  MC.applyTheme = () => {
    const r = document.documentElement, th = MC.store.get('theme', '') || 'system', def = MC.THEMES.find((q) => q[0] === th) || MC.THEMES[0];
    if (th === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', th);
    CUSTOM_VARS.forEach((k) => r.style.removeProperty(k));
    let scheme = def[3];
    if (th === 'custom') { const c = MC.customTheme(); scheme = c.scheme; Object.keys(c.v).forEach((k) => r.style.setProperty(k, c.v[k])); r.style.colorScheme = c.scheme; } else r.style.removeProperty('color-scheme');
    if (!scheme) scheme = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    r.dataset.scheme = scheme;
    r.dataset.contrast = MC.store.get('contrast', '0') === '1' ? '1' : '0';
    r.dataset.marks = MC.store.get('marks', '1') === '0' ? '0' : '1';
  };
  if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { MC.applyTheme(); if (MC.studioApi && MC.studioApi.redraw) MC.studioApi.redraw(); }); } catch (e) { /* navegador antiguo */ } }

  /* ---------- ajustes de la interfaz ---------- */
  MC.applyPrefs = () => {
    const z = parseFloat(MC.store.get('uizoom', '1')) || 1;
    document.documentElement.style.setProperty('--ui-zoom', String(z)); MC.measureZoom();
    document.documentElement.dataset.motion = MC.store.get('motion', 'auto');
    MC.applyTheme();
    /* modo táctil: automático (pantalla táctil), siempre o nunca */
    const tm = MC.store.get('touch', 'auto'), coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    document.documentElement.dataset.touch = tm === 'on' || (tm === 'auto' && coarse) ? '1' : '0';
  };
  if (window.matchMedia) { try { matchMedia('(pointer: coarse)').addEventListener('change', () => MC.applyPrefs()); } catch (e) { /* navegador antiguo */ } }

  /* ---------- límites según el equipo ---------- */
  MC.limits = () => {
    const dm = navigator.deviceMemory || 4; // GB; Safari y Firefox no lo informan
    return { editMB: Math.min(2000, dm * 300), exportMB: Math.min(3500, dm * 500 + 300), known: !!navigator.deviceMemory };
  };
  MC.benchmark = async () => {
    const run = (w, hh, n) => {
      const c = document.createElement('canvas'); c.width = w; c.height = hh;
      const g = c.getContext('2d'), src = [];
      for (let i = 0; i < 8; i++) { const s = document.createElement('canvas'); s.width = 2048; s.height = 1152; const x = s.getContext('2d'); x.fillStyle = 'hsl(' + i * 40 + ',50%,50%)'; x.fillRect(0, 0, 2048, 1152); x.fillStyle = '#fff'; for (let k = 0; k < 40; k++) x.fillRect(Math.random() * 2000, Math.random() * 1100, 40, 40); src.push(s); }
      const t0 = performance.now();
      for (let f = 0; f < n; f++) {
        g.clearRect(0, 0, w, hh);
        src.forEach((s, i) => { g.save(); g.translate(w / 2 + Math.sin(f / 9 + i) * 20, hh / 2); g.scale(1.1 + i * 0.02, 1.1 + i * 0.02); g.drawImage(s, -w / 2, -hh / 2, w, hh); g.restore(); });
      }
      g.getImageData(0, 0, 1, 1);
      return (performance.now() - t0) / n;
    };
    await new Promise((r) => setTimeout(r, 30));
    const res = { ms1080: run(1920, 1080, 20), ms4k: run(3840, 2160, 6), cores: navigator.hardwareConcurrency || 0, dm: navigator.deviceMemory || 0, at: Date.now() };
    MC.store.set('bench', JSON.stringify(res));
    return res;
  };

  /* ---------- tutoriales ---------- */
  const TOURS = [
    { id: 'importar', es: ['Importar', 'Sube tu arte y mira cómo entra'], en: ['Import', 'Bring in your art and see how it lands'], steps: [
      { sel: '.p-layers .ph .btn', es: ['Importa tu arte', 'Pulsa «Importar» o arrastra tus archivos al visor: PNG, JPEG, WebP, PSD o PDF. Cada archivo es una capa y un PSD conserva sus capas ordenadas.'], en: ['Import your art', 'Press “Import” or drag your files onto the viewer: PNG, JPEG, WebP, PSD or PDF. Each file is a layer and a PSD keeps its layers in order.'] },
      { sel: '.stage', es: ['El visor', 'Lo que ves aquí es lo que se exporta. Con una capa seleccionada, arrástrala para moverla y usa la rueda para escalarla.'], en: ['The viewer', 'What you see here is what gets exported. With a layer selected, drag it to move it and use the wheel to scale it.'] },
      { sel: '.p-timeline .tl-head', es: ['Planos desde imágenes', 'Con «Planos desde imágenes» cada archivo se convierte en un plano nuevo de la línea de tiempo. Estira su final para cambiar la duración.'], en: ['Shots from images', 'With “Shots from images” each file becomes a new shot on the timeline. Stretch its end to change the length.'] },
    ] },
    { id: 'parallax', es: ['Parallax', 'Dale profundidad a tus capas'], en: ['Parallax', 'Give your layers depth'], steps: [
      { sel: '.p-layers .pbody', act: 'selectLayer', es: ['Elige una capa', 'Haz clic en una capa de la lista. Arriba está lo que queda delante.'], en: ['Pick a layer', 'Click a layer in the list. The top is what sits in front.'] },
      { sel: '.sec[data-id="capa"]', es: ['Profundidad', 'Ajusta la profundidad (z) con los botones o el deslizador. Las capas cercanas se mueven más que las lejanas cuando la cámara se desplaza.'], en: ['Depth', 'Set the depth (z) with the chips or the slider. Near layers move more than far ones when the camera moves.'] },
      { sel: '.play', es: ['Míralo en movimiento', 'Reproduce el plano. Si ves huecos en el fondo, activa «Huecos» en el visor o deja el sobreescalado automático.'], en: ['See it move', 'Play the shot. If you see gaps in the background, turn on “Gaps” in the viewer or keep automatic overscale.'] },
      { sel: '[data-id="proyecto"]', act: 'proyectoTab', es: ['Intensidad', 'En el panel «Proyecto» eliges si el efecto es sutil, normal o exagerado para todo el proyecto.'], en: ['Intensity', 'In the Project panel you choose whether the effect is subtle, normal or exaggerated for the whole project.'] },
    ] },
    { id: 'voz', es: ['Voz', 'Sincroniza los planos con la locución'], en: ['Voice', 'Sync the shots with the voice-over'], steps: [
      { sel: '.tl-labels .trl:nth-child(4)', es: ['Pista de locución', 'Con «+» importas un audio y con el micrófono grabas, con cuenta atrás, mientras se reproduce la imagen.'], en: ['Voice track', 'Use “+” to import audio and the microphone to record, with a countdown, while the picture plays.'] },
      { sel: '[data-id="mezcla"]', act: 'openMix', es: ['Marcar pausas', '«Marcar pausas de la voz» pone marcas en la regla donde la voz se detiene. No hay reconocimiento de voz: tu audio no sale del equipo.'], en: ['Mark pauses', '“Mark voice pauses” puts marks on the ruler where the voice stops. There is no speech recognition: your audio never leaves the device.'] },
      { sel: '[data-id="mezcla"]', es: ['Ajustar planos a la voz', '«Ajustar planos a la voz» reparte la duración de cada plano según las pausas. Después puedes retocar a mano.'], en: ['Fit shots to voice', '“Fit shots to voice” splits each shot’s length using the pauses. You can fine-tune by hand afterwards.'] },
      { sel: '.vbar', es: ['Texto con la voz', 'Coloca el cabezal sobre la locución y añade un bocadillo: queda vinculado, aparece cuando suena su línea y se va cuando termina.'], en: ['Text with the voice', 'Place the playhead over the voice-over and add a bubble: it stays linked, appears when its line plays and leaves when it ends.'] },
    ] },
    { id: 'exportar', es: ['Exportar', 'Del montaje al vídeo listo para subir'], en: ['Export', 'From the edit to a ready-to-post video'], steps: [
      { sel: '.vbar', es: ['Simulador', 'Con «Simulador» ves el vídeo con una interfaz de red social encima para comprobar qué tapa. Las zonas seguras también ayudan.'], en: ['Simulator', 'With “Simulator” you see the video under a social app interface to check what it covers. Safe zones help too.'] },
      { sel: '.s-tabs button:last-child', act: 'openExportWs', es: ['Exportar', 'La pestaña Exportar es un espacio propio. Elige plataforma o varios formatos a la vez, calidad e idioma. También saca la portada y los subtítulos en SRT. Puedes seguir editando mientras exporta.'], en: ['Export', 'The Export tab is its own workspace. Pick a platform or several formats at once, quality and language. It also gives you the cover and SRT subtitles. You can keep editing while it exports.'] },
      { sel: '.s-top .status', es: ['Guardado en este equipo', 'Tu proyecto vive en este navegador. Desde el inicio, «Exportar copia» guarda un archivo con todo para otro equipo.'], en: ['Saved on this device', 'Your project lives in this browser. From the home screen, “Export backup” saves a file with everything for another device.'] },
    ] },
  ];
  MC.TOURS = TOURS;

  let tourEl = null;
  MC.endTour = () => { if (tourEl) { tourEl.cleanup(); tourEl = null; } };
  MC.startTour = (id) => {
    const tour = TOURS.find((x) => x.id === id);
    if (!tour) return;
    if (!MC.studioApi) { MC.pendingTour = id; MC.app.openSample(); return; }
    MC.endTour();
    let i = 0;
    const spot = h('div', { class: 'tour-spot' }), card = h('div', { class: 'tour-card', role: 'dialog', 'aria-label': t(tour.es[0], tour.en[0]) });
    const root = h('div', { class: 'tour' }, spot, card);
    document.body.append(root);
    const place = () => {
      const st = tour.steps[i], el = document.querySelector(st.sel);
      if (el && st.scrolled !== i) { st.scrolled = i; try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* sin desplazamiento */ } }
      const z = MC.uz(), R = el && el.getBoundingClientRect(), IW = innerWidth / z, IH = innerHeight / z;
      const r = R && { left: R.left / z, top: R.top / z, width: R.width / z, height: R.height / z, bottom: R.bottom / z }, ok = r && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < IH;
      if (ok) {
        Object.assign(spot.style, { display: 'block', left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
        const cw = Math.min(340, IW - 24), below = r.bottom + 14 + 190 < IH;
        card.style.width = cw + 'px';
        card.style.left = clamp(r.left, 12, IW - cw - 12) + 'px';
        const above = r.top - 14 - 190 > 0;
        card.style.top = below ? r.bottom + 14 + 'px' : above ? 'auto' : clamp(r.top + 12, 12, IH - 220) + 'px';
        card.style.bottom = below ? 'auto' : above ? IH - r.top + 14 + 'px' : 'auto';
        const ch = card.offsetHeight, tp = parseFloat(card.style.top);
        if (card.style.top !== 'auto' && tp + ch > IH - 12) card.style.top = Math.max(12, IH - ch - 12) + 'px';
      } else { spot.style.display = 'none'; card.style.width = Math.min(340, IW - 24) + 'px'; card.style.left = Math.max(12, IW / 2 - 170) + 'px'; card.style.top = IH / 3 + 'px'; card.style.bottom = 'auto'; }
    };
    const draw = () => {
      const st = tour.steps[i];
      if (st.act && MC.studioApi && MC.studioApi[st.act]) MC.studioApi[st.act]();
      MC.clear(card);
      const next = h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: () => { if (i < tour.steps.length - 1) { i++; draw(); } else MC.endTour(); } }, i < tour.steps.length - 1 ? t('Siguiente', 'Next') : t('Terminar', 'Finish'));
      MC.put(card, h('div', { class: 'eyebrow' }, t(tour.es[0], tour.en[0]) + ' · ' + (i + 1) + '/' + tour.steps.length), h('h3', null, t(st.es[0], st.en[0])), h('p', null, t(st.es[1], st.en[1])),
        h('div', { class: 'row-end' }, h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: MC.endTour }, t('Cerrar', 'Close')), i ? h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { i--; draw(); } }, t('Atrás', 'Back')) : null, next));
      setTimeout(place, 60); setTimeout(() => next.focus(), 80);
      MC.announce(t(st.es[0], st.en[0]) + '. ' + t(st.es[1], st.en[1]));
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); MC.endTour(); }
      else if (e.key === 'ArrowRight' && i < tour.steps.length - 1) { e.stopPropagation(); i++; draw(); }
      else if (e.key === 'ArrowLeft' && i > 0) { e.stopPropagation(); i--; draw(); }
    };
    document.addEventListener('keydown', onKey, true);
    const tick = setInterval(place, 400);
    window.addEventListener('resize', place);
    tourEl = { cleanup() { clearInterval(tick); document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', place); root.remove(); } };
    draw();
  };

  /* ---------- ventana de ayuda ---------- */
  MC.openHelp = (tab) => {
    const st = { tab: tab || 'tutorials' }, body = h('div', { style: { display: 'grid', gap: '16px' } });
    let modal = null, capturing = null;
    const draw = () => { MC.clear(body); MC.put(body, MC.ui.seg([{ v: 'tutorials', l: t('Tutoriales', 'Tutorials') }, { v: 'keys', l: t('Atajos', 'Shortcuts') }, { v: 'settings', l: t('Ajustes', 'Settings') }, { v: 'about', l: t('Acerca de', 'About') }], st.tab, (v) => { st.tab = v; draw(); }, t('Secciones de la ayuda', 'Help sections')), tabs[st.tab]()); };

    const tabs = {
      tutorials: () => h('div', { style: { display: 'grid', gap: '8px' } },
        h('p', { class: 'cap' }, t('Recorridos cortos sobre el propio estudio. Se abren con el proyecto de ejemplo si aún no tienes uno abierto.', 'Short walk-throughs on the studio itself. They open with the example project if none is open yet.')),
        TOURS.map((x) => h('div', { class: 'layer', style: { cursor: 'default' } }, h('span', { class: 'ln' }, h('b', null, t(x.es[0], x.en[0])), h('span', { class: 'cap', style: { display: 'block', whiteSpace: 'normal' } }, t(x.es[1], x.en[1]))),
          h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: () => { modal.close(); MC.startTour(x.id); } }, t('Empezar', 'Start'))))),
      keys: () => {
        const K = MC.keys, wrap = h('div', { style: { display: 'grid', gap: '12px' } });
        wrap.append(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Base de atajos', 'Shortcut set')),
          MC.ui.seg(Object.keys(K.PRESET_NAMES).map((k) => ({ v: k, l: K.PRESET_NAMES[k] })), K.base(), (v) => { K.setBase(v); draw(); MC.toast(t('Atajos de ' + K.PRESET_NAMES[v], K.PRESET_NAMES[v] + ' shortcuts')); }, t('Base de atajos', 'Shortcut set')),
          h('span', { class: 'cap' }, t('Cambiar de base descarta tus cambios. Puedes cambiar cada atajo con «Cambiar».', 'Switching the set discards your changes. You can change each shortcut with “Change”.'))));
        Object.keys(K.GROUPS).forEach((g) => {
          wrap.append(h('div', { class: 'eyebrow' }, t(K.GROUPS[g][0], K.GROUPS[g][1])), h('div', { style: { display: 'grid', gap: '2px' } }, K.ACTIONS.filter((a) => a.g === g).map((a) => {
            const b = K.bindings(a.id), listening = capturing === a.id;
            return h('div', { class: 'keyrow' }, h('span', null, t(a.es, a.en)),
              h('span', { class: 'keys' }, listening ? h('kbd', { class: 'on' }, t('Pulsa la combinación… (Esc cancela)', 'Press the combination… (Esc cancels)')) : b.length ? b.map((c) => h('kbd', null, K.pretty(c))) : h('span', { class: 'cap' }, t('sin atajo', 'none'))),
              h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => capture(a.id) }, t('Cambiar', 'Change')));
          })));
        });
        wrap.append(h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { K.reset(); draw(); } }, t('Restablecer los atajos de esta base', 'Reset this set’s shortcuts')),
          h('p', { class: 'cap' }, t('Fijos: Esc cierra o cancela, Intro cierra un polígono, Tab y Mayús+Tab recorren los controles.', 'Fixed: Esc closes or cancels, Enter closes a polygon, Tab and Shift+Tab move through controls.')));
        return wrap;
      },
      settings: () => h('div', { style: { display: 'grid', gap: '12px' } },
        h('p', { class: 'cap' }, t('Tema, tamaño de la interfaz, animaciones, idioma, datos guardados en este equipo, instalación y rendimiento están en las preferencias.', 'Theme, interface size, animations, language, data stored on this device, installation and performance are in the preferences.')),
        h('button', { class: 'btn btn-p', type: 'button', style: { justifySelf: 'start' }, onClick: () => { modal.close(); MC.openPrefs(); } }, MC.icon('gear', 15), t('Abrir las preferencias', 'Open preferences'))),
      about: () => h('div', { style: { display: 'grid', gap: '10px' } },
        h('div', { class: 'brand' }, MC.mark(28), h('div', null, 'MotionComic ', h('span', null, 'Studio'))),
        h('p', { class: 'cap' }, t('Versión ', 'Version ') + MC.VERSION + t(' · herramienta gratuita.', ' · free tool.')),
        h('p', null, t('Tus dibujos no salen de tu equipo: no hay cuentas, servidor ni IA que los procese. Los proyectos viven en este navegador; exporta copias de vez en cuando.', 'Your artwork never leaves your device: there are no accounts, servers or AI processing it. Projects live in this browser; export backups from time to time.')),
        h('p', { class: 'cap' }, t('Hecha con cariño para Goti y para cualquier dibujante. Incluye mp4-muxer (MIT), ag-psd (MIT) y pdf.js (Apache-2.0).', 'Made with care for Goti and for any artist. Includes mp4-muxer (MIT), ag-psd (MIT) and pdf.js (Apache-2.0).'))),
    };

    function capture(id) {
      capturing = id; draw();
      const onKey = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (e.key === 'Escape') { done(); return; }
        const c = MC.keys.combo(e); if (!c) return;
        const clash = MC.keys.conflict(id, c);
        MC.keys.set(id, c); done();
        MC.toast(clash ? t('«' + MC.keys.pretty(c) + '» pasa a esta acción y se quita de «' + clash + '».', '“' + MC.keys.pretty(c) + '” now belongs to this action and was removed from “' + clash + '”.') : t('Atajo cambiado: ', 'Shortcut changed: ') + MC.keys.pretty(c));
      };
      const done = () => { document.removeEventListener('keydown', onKey, true); capturing = null; draw(); };
      document.addEventListener('keydown', onKey, true);
    }

    draw();
    modal = MC.modal(t('Ayuda', 'Help'), body, (close) => [h('button', { class: 'btn btn-s', type: 'button', onClick: close }, t('Cerrar', 'Close'))]);
    return modal;
  };
})();
