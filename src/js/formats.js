/* Formatos, resolución y calculadora (PRD 5.5). */
(function () {
  const MC = window.MC;
  const { h, t } = MC;

  MC.RATIOS = ['16:9', '9:16', '3:4', '1:1', '2:1'];
  MC.RES = { '1080p': 1080, '2K': 1440, '4K': 2160 }; // lado corto en px
  MC.RATIO_HINT = {
    '9:16': ['TikTok, Reels y Shorts', 'TikTok, Reels and Shorts'],
    '16:9': ['YouTube y pantallas', 'YouTube and screens'],
    '3:4': ['Instagram feed vertical', 'Vertical Instagram feed'],
    '1:1': ['Instagram feed cuadrado', 'Square Instagram feed'],
    '2:1': ['Panorámico', 'Panoramic'],
  };

  MC.parseRatio = (r) => {
    const p = String(r).split(':').map(Number);
    return p.length === 2 && p[0] > 0 && p[1] > 0 ? p : [16, 9];
  };
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  MC.frameSize = (ratio, res) => {
    const [rw, rh] = MC.parseRatio(ratio);
    const short = MC.RES[res] || 1080;
    return rw >= rh ? { w: even((short * rw) / rh), h: short } : { w: short, h: even((short * rh) / rw) };
  };

  /* Selector de formato con calculadora. state = {ratio,res,zoom}; onChange se llama con cada cambio. */
  MC.formatPicker = (state, onChange) => {
    const root = h('div', { style: { display: 'grid', gap: '14px' } });
    const isPreset = () => MC.RATIOS.includes(state.ratio);
    const draw = () => {
      MC.clear(root);
      const size = MC.frameSize(state.ratio, state.res);
      const set = (k, v) => { state[k] = v; draw(); onChange && onChange(state); };
      const [cw, ch] = MC.parseRatio(state.ratio);
      const idW = 'cw-' + MC.uid(), idH = 'ch-' + MC.uid();
      MC.put(root,
        h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Proporción', 'Aspect ratio')),
          MC.ui.chips(MC.RATIOS.map((r) => ({ v: r, l: r })).concat([{ v: 'custom', l: t('Personalizada', 'Custom') }]), isPreset() ? state.ratio : 'custom', (v) => set('ratio', v === 'custom' ? '5:4' : v))),
        !isPreset() ? h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          h('input', { class: 'input', id: idW, type: 'number', min: 1, max: 40, value: cw, 'aria-label': t('Ancho', 'Width'), style: { width: '80px' }, onChange: (e) => set('ratio', Math.max(1, Math.round(+e.target.value || 1)) + ':' + ch) }),
          h('span', null, ':'),
          h('input', { class: 'input', id: idH, type: 'number', min: 1, max: 40, value: ch, 'aria-label': t('Alto', 'Height'), style: { width: '80px' }, onChange: (e) => set('ratio', cw + ':' + Math.max(1, Math.round(+e.target.value || 1))) })) : null,
        h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Resolución de salida', 'Output resolution')),
          MC.ui.seg(Object.keys(MC.RES).map((r) => ({ v: r, l: r })), state.res, (v) => set('res', v), t('Resolución', 'Resolution'))),
        MC.ui.slider({ label: t('Zoom previsto', 'Planned zoom'), min: 1, max: 3, step: 0.1, value: state.zoom, fmt: (v) => '×' + v.toFixed(1), onInput: (v) => { state.zoom = v; refreshCalc(); }, onChange: () => onChange && onChange(state) }),
        calcBox(),
      );
    };
    let calc;
    const calcBox = () => { calc = h('div', { class: 'calc', 'aria-live': 'polite' }); refreshCalc(); return calc; };
    const refreshCalc = () => {
      if (!calc) return;
      const s = MC.frameSize(state.ratio, state.res);
      const need = (z) => Math.ceil(s.w * z) + ' × ' + Math.ceil(s.h * z);
      MC.clear(calc);
      MC.put(calc,
        h('span', { class: 'cap' }, t('Tamaño del vídeo', 'Video size')),
        h('span', { class: 'big' }, s.w + ' × ' + s.h + ' px'),
        h('span', { class: 'cap', style: { marginTop: '6px' } }, t('Ilustración mínima para no pixelarse con el zoom previsto', 'Minimum artwork size to avoid pixelation at the planned zoom')),
        h('div', { class: 'calc-grid' },
          h('div', null, h('div', { class: 'cap' }, 'zoom ×1.0'), h('b', null, need(1))),
          h('div', null, h('div', { class: 'cap' }, 'zoom ×' + state.zoom.toFixed(1)), h('b', { class: 'good' }, need(state.zoom)))),
        MC.RATIO_HINT[state.ratio] ? h('span', { class: 'cap', style: { marginTop: '6px' } }, t(MC.RATIO_HINT[state.ratio][0], MC.RATIO_HINT[state.ratio][1])) : null,
      );
    };
    draw();
    return root;
  };
})();
