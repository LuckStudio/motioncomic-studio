/* Formatos, resolución y calculadora (PRD 5.5): proporciones, girar, proporciones propias y tamaño de salida en píxeles exactos. */
(function () {
  const MC = window.MC;
  const { h, t } = MC;

  MC.RATIOS = ['16:9', '9:16', '4:5', '3:4', '1:1', '2:1'];
  MC.RES = { '720p': 720, '1080p': 1080, '2K': 1440, '4K': 2160 }; // lado corto en px
  MC.RATIO_HINT = {
    '9:16': ['TikTok, Reels y Shorts', 'TikTok, Reels and Shorts'],
    '16:9': ['YouTube, Twitch, Vimeo y pantallas', 'YouTube, Twitch, Vimeo and screens'],
    '4:5': ['Instagram y LinkedIn (feed vertical)', 'Instagram and LinkedIn (vertical feed)'],
    '3:4': ['Instagram feed vertical', 'Vertical Instagram feed'],
    '1:1': ['Instagram, LinkedIn y TikTok cuadrado', 'Square Instagram, LinkedIn and TikTok'],
    '2:1': ['Panorámico (YouTube y Twitch)', 'Panoramic (YouTube and Twitch)'],
  };
  const MIN_PX = 16, MAX_PX = 8192;

  MC.parseRatio = (r) => {
    const p = String(r).split(':').map(Number);
    return p.length === 2 && p[0] > 0 && p[1] > 0 ? p : [16, 9];
  };
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  const clampPx = (n) => Math.max(MIN_PX, Math.min(MAX_PX, Math.round(+n || MIN_PX)));
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  /* Las medidas a medida se guardan en la propia resolución: «=1080x1350» son píxeles exactos y «@1200» es el lado corto en px. */
  MC.parseExact = (res) => { const m = /^=(\d+)x(\d+)$/.exec(String(res)); return m ? { w: clampPx(m[1]), h: clampPx(m[2]) } : null; };
  MC.parseShort = (res) => { const m = /^@(\d+)$/.exec(String(res)); return m ? Math.max(120, Math.min(MAX_PX, +m[1])) : null; };
  MC.exactRes = (w, hh) => '=' + clampPx(w) + 'x' + clampPx(hh);
  MC.reduceRatio = (w, hh) => { const g = gcd(clampPx(w), clampPx(hh)); return clampPx(w) / g + ':' + clampPx(hh) / g; };
  MC.flipRatio = (r) => { const q = MC.parseRatio(r); return q[1] + ':' + q[0]; };
  MC.frameSize = (ratio, res) => {
    const ex = MC.parseExact(res); if (ex) return { w: ex.w, h: ex.h };
    const [rw, rh] = MC.parseRatio(ratio);
    const short = MC.parseShort(res) || MC.RES[res] || 1080;
    return rw >= rh ? { w: even((short * rw) / rh), h: short } : { w: short, h: even((short * rh) / rw) };
  };
  MC.resLabel = (res) => { const ex = MC.parseExact(res); if (ex) return ex.w + '×' + ex.h + ' px'; const s = MC.parseShort(res); return s ? s + ' px' : res; };
  MC.fmtLabel = (ratio, res) => (MC.parseExact(res) ? MC.parseExact(res).w + '×' + MC.parseExact(res).h : ratio + ' · ' + MC.resLabel(res));
  /* proporciones propias guardadas en este equipo */
  MC.customRatios = () => { try { const l = JSON.parse(MC.store.get('ratios', '[]')); return Array.isArray(l) ? l.filter((r) => /^\d+(\.\d+)?:\d+(\.\d+)?$/.test(r)) : []; } catch (e) { return []; } };
  MC.saveRatio = (r) => { const l = MC.customRatios(); if (!MC.RATIOS.includes(r) && !l.includes(r)) { l.push(r); MC.store.set('ratios', JSON.stringify(l.slice(-24))); } };
  MC.removeRatio = (r) => MC.store.set('ratios', JSON.stringify(MC.customRatios().filter((x) => x !== r)));

  /* Selector de formato con calculadora. state = {ratio,res,zoom}; onChange se llama con cada cambio.
     opts.zoom = false oculta el zoom previsto (para el menú rápido de la barra superior). */
  MC.formatPicker = (state, onChange, opts) => {
    opts = opts || {};
    const root = h('div', { style: { display: 'grid', gap: '14px' } });
    let customOpen = false, otherOpen = false;
    const isExact = () => !!MC.parseExact(state.res);
    const isStd = () => !isExact() && !MC.parseShort(state.res) && MC.RES[state.res];
    const resKey = () => (isExact() ? 'exact' : MC.parseShort(state.res) || otherOpen ? 'other' : state.res);
    const draw = () => {
      MC.clear(root);
      const size = MC.frameSize(state.ratio, state.res);
      const set = (k, v) => { state[k] = v; draw(); onChange && onChange(state); };
      const setBoth = (r, res) => { state.ratio = r; state.res = res; draw(); onChange && onChange(state); };
      const [cw, ch] = MC.parseRatio(state.ratio), saved = MC.customRatios(), known = MC.RATIOS.includes(state.ratio) || saved.includes(state.ratio);
      const idW = 'cw-' + MC.uid(), idH = 'ch-' + MC.uid(), idS = 'cs-' + MC.uid(), idEW = 'ew-' + MC.uid(), idEH = 'eh-' + MC.uid();
      const flipLabel = cw === ch ? t('Girar (es cuadrado)', 'Rotate (it is square)') : cw > ch ? t('Pasar a vertical', 'Switch to vertical') : t('Pasar a horizontal', 'Switch to horizontal');
      const flip = h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: cw === ch, title: t('Intercambia ancho y alto: por ejemplo, 4:5 pasa a 5:4', 'Swaps width and height: for example, 4:5 becomes 5:4'),
        onClick: () => { const ex = MC.parseExact(state.res); if (ex) setBoth(MC.reduceRatio(ex.h, ex.w), MC.exactRes(ex.h, ex.w)); else set('ratio', MC.flipRatio(state.ratio)); } }, MC.icon('loop', 14), flipLabel);
      const ratioChips = MC.ui.chips(MC.RATIOS.map((r) => ({ v: r, l: r })).concat(saved.map((r) => ({ v: r, l: r, title: t('Proporción guardada', 'Saved ratio') })), [{ v: 'custom', l: t('Personalizada', 'Custom') }]), known && !customOpen ? state.ratio : 'custom', (v) => { if (v === 'custom') { customOpen = true; draw(); } else { customOpen = false; set('ratio', v); } });
      MC.put(root,
        h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Proporción', 'Aspect ratio')),
          isExact() ? h('p', { class: 'cap' }, t('Estás usando píxeles exactos: la proporción sale de las dimensiones. Cambia a una resolución normal para elegir una proporción.', 'You are using exact pixels: the ratio comes from the dimensions. Switch to a normal resolution to pick a ratio.')) : ratioChips),
        !isExact() && (!known || customOpen) ? h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
          h('input', { class: 'input', id: idW, type: 'number', min: 1, max: 10000, value: cw, 'aria-label': t('Ancho de la proporción', 'Ratio width'), style: { width: '80px' }, onChange: (e) => set('ratio', Math.max(1, Math.round(+e.target.value || 1)) + ':' + ch) }),
          h('span', null, ':'),
          h('input', { class: 'input', id: idH, type: 'number', min: 1, max: 10000, value: ch, 'aria-label': t('Alto de la proporción', 'Ratio height'), style: { width: '80px' }, onChange: (e) => set('ratio', cw + ':' + Math.max(1, Math.round(+e.target.value || 1))) }),
          known ? null : h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { MC.saveRatio(state.ratio); customOpen = false; MC.toast(t('Proporción guardada: ', 'Ratio saved: ') + state.ratio); draw(); } }, MC.icon('bookmark', 14), t('Guardar esta proporción', 'Save this ratio'))) : null,
        !isExact() && saved.includes(state.ratio) ? h('div', null, h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => { MC.removeRatio(state.ratio); MC.toast(t('Proporción borrada de tus guardadas', 'Ratio removed from your saved ones')); draw(); } }, MC.icon('trash', 14), t('Quitar de mis proporciones', 'Remove from my ratios'))) : null,
        h('div', null, flip),
        h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Resolución de salida', 'Output resolution')),
          MC.ui.chips(Object.keys(MC.RES).map((r) => ({ v: r, l: r })).concat([{ v: 'other', l: t('Otra', 'Other'), title: t('Lado corto en píxeles', 'Short side in pixels') }, { v: 'exact', l: t('Píxeles exactos', 'Exact pixels'), title: t('Ancho y alto exactos, sin proporción ni resolución', 'Exact width and height, ignoring ratio and resolution') }]), resKey(), (v) => {
            if (v === 'exact') { const s0 = MC.frameSize(state.ratio, state.res); setBoth(MC.reduceRatio(s0.w, s0.h), MC.exactRes(s0.w, s0.h)); }
            else if (v === 'other') { otherOpen = true; const s0 = MC.frameSize(state.ratio, state.res); setBoth(state.ratio, '@' + Math.min(s0.w, s0.h)); }
            else { otherOpen = false; set('res', v); } })),
        MC.parseShort(state.res) ? h('div', { class: 'field' }, h('label', { for: idS }, t('Lado corto del vídeo (px)', 'Short side of the video (px)')),
          h('input', { class: 'input', id: idS, type: 'number', min: 120, max: MAX_PX, value: MC.parseShort(state.res), style: { width: '120px' }, onChange: (e) => set('res', '@' + Math.max(120, Math.min(MAX_PX, Math.round(+e.target.value || 1080)))) })) : null,
        isExact() ? h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Dimensiones exactas del vídeo (' + MIN_PX + ' a ' + MAX_PX + ' px)', 'Exact video dimensions (' + MIN_PX + ' to ' + MAX_PX + ' px)')),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            h('input', { class: 'input', id: idEW, type: 'number', min: MIN_PX, max: MAX_PX, value: size.w, 'aria-label': t('Ancho en píxeles', 'Width in pixels'), style: { width: '110px' }, onChange: (e) => { const w = clampPx(e.target.value), ex = MC.parseExact(state.res); setBoth(MC.reduceRatio(w, ex.h), MC.exactRes(w, ex.h)); } }),
            h('span', null, '×'),
            h('input', { class: 'input', id: idEH, type: 'number', min: MIN_PX, max: MAX_PX, value: size.h, 'aria-label': t('Alto en píxeles', 'Height in pixels'), style: { width: '110px' }, onChange: (e) => { const hh = clampPx(e.target.value), ex = MC.parseExact(state.res); setBoth(MC.reduceRatio(ex.w, hh), MC.exactRes(ex.w, hh)); } }),
            h('span', { class: 'cap' }, 'px'))) : null,
        opts.zoom === false ? null : MC.ui.slider({ label: t('Zoom previsto', 'Planned zoom'), min: 1, max: 3, step: 0.1, value: state.zoom, fmt: (v) => '×' + v.toFixed(1), onInput: (v) => { state.zoom = v; refreshCalc(); }, onChange: () => onChange && onChange(state) }),
        calcBox(),
      );
    };
    let calc;
    const calcBox = () => { calc = h('div', { class: 'calc', 'aria-live': 'polite' }); refreshCalc(); return calc; };
    const refreshCalc = () => {
      if (!calc) return;
      const s = MC.frameSize(state.ratio, state.res), mp = s.w * s.h / 1e6;
      const need = (z) => Math.ceil(s.w * z) + ' × ' + Math.ceil(s.h * z);
      MC.clear(calc);
      MC.put(calc,
        h('span', { class: 'cap' }, t('Tamaño del vídeo', 'Video size')),
        h('span', { class: 'big' }, s.w + ' × ' + s.h + ' px'),
        h('span', { class: 'cap' }, mp.toFixed(1) + ' ' + t('megapíxeles', 'megapixels')),
        s.w > 4096 || s.h > 4096 || mp > 8.9 ? h('span', { class: 'warn', style: { marginTop: '4px' } }, t('Es más grande que un 4K: algunos navegadores no podrán exportarlo a MP4. Prueba con GIF o PNG, o baja el tamaño.', 'It is larger than 4K: some browsers will not be able to export it as MP4. Try GIF or PNG, or lower the size.')) : null,
        s.w % 2 || s.h % 2 ? h('span', { class: 'cap' }, t('MP4 necesita medidas pares: al exportar vídeo se añade 1 px si hace falta.', 'MP4 needs even sizes: when exporting video 1 px is added if needed.')) : null,
        opts.zoom === false ? null : [
          h('span', { class: 'cap', style: { marginTop: '6px' } }, t('Ilustración mínima para no pixelarse con el zoom previsto', 'Minimum artwork size to avoid pixelation at the planned zoom')),
          h('div', { class: 'calc-grid' },
            h('div', null, h('div', { class: 'cap' }, 'zoom ×1.0'), h('b', null, need(1))),
            h('div', null, h('div', { class: 'cap' }, 'zoom ×' + (state.zoom || 1.5).toFixed(1)), h('b', { class: 'good' }, need(state.zoom || 1.5))))],
        MC.RATIO_HINT[state.ratio] && !MC.parseExact(state.res) ? h('span', { class: 'cap', style: { marginTop: '6px' } }, t(MC.RATIO_HINT[state.ratio][0], MC.RATIO_HINT[state.ratio][1])) : null,
      );
    };
    draw();
    return root;
  };
})();
