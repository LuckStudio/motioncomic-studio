/* Utilidades base: idioma, DOM, iconos, avisos y ventanas. Sin dependencias. */
(function () {
  const MC = (window.MC = window.MC || {});

  MC.lang = 'es';
  MC.t = (es, en) => (MC.lang === 'en' ? (en == null ? es : en) : es);
  MC.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
  MC.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  MC.lerp = (a, b, t) => a + (b - a) * t;
  MC.store = {
    get(k, d) { try { const v = localStorage.getItem('mc.' + k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('mc.' + k, v); } catch (e) { /* sin almacenamiento */ } },
  };

  const pad = (n) => String(n).padStart(2, '0');
  MC.fmtTime = (s, fps) => {
    fps = fps || 30;
    s = Math.max(0, s);
    return pad(Math.floor(s / 60)) + ':' + pad(Math.floor(s % 60)) + ':' + pad(Math.floor((s % 1) * fps));
  };
  MC.fmtClock = (ts) => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  MC.fmtDate = (ts) => new Date(ts).toLocaleDateString(MC.lang === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  MC.fmtBytes = (b) => (b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(0) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');

  /* h('div', {class:'x', onClick: fn}, hijos...) */
  const LAST = { value: 1, checked: 1 };
  MC.h = function h(tag, props) {
    const el = document.createElement(tag);
    if (props) {
      const keys = Object.keys(props).sort((a, b) => (LAST[a] ? 1 : 0) - (LAST[b] ? 1 : 0));
      for (const k of keys) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (let i = 2; i < arguments.length; i++) {
      const stack = [arguments[i]];
      while (stack.length) {
        const c = stack.shift();
        if (c == null || c === false) continue;
        if (Array.isArray(c)) stack.unshift(...c);
        else el.append(c.nodeType ? c : document.createTextNode(String(c)));
      }
    }
    return el;
  };
  const h = MC.h;
  /* Añade hijos ignorando null/false y aplanando listas (append nativo escribiría «null»). */
  MC.put = (el, ...kids) => { kids.flat(Infinity).forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); }); return el; };
  MC.download = (blob, name) => {
    const a = MC.h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
  };
  MC.clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  const ICONS = {
    curve: '<path d="M3 20C10 20 8 4 21 4"/><circle cx="3" cy="20" r="1.600" fill="currentColor"/><circle cx="21" cy="4" r="1.600" fill="currentColor"/>',
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M9 12h6M9 16h4"/>',
    magnet: '<path d="M5 3h4v9a3 3 0 006 0V3h4v9a7 7 0 01-14 0z"/><path d="M5 7h4M15 7h4"/>',
    flipH: '<path d="M12 3v18" stroke-dasharray="2.5 2.5"/><path d="M9 7L3 18h6z"/><path d="M15 7l6 11h-6z"/>',
    flipV: '<path d="M3 12h18" stroke-dasharray="2.5 2.5"/><path d="M7 9V3l11 6z"/><path d="M7 15v6l11-6z"/>',
    crop: '<path d="M6 2v14a2 2 0 002 2h14"/><path d="M2 6h14a2 2 0 012 2v14"/>',
    trimL: '<path d="M4 4v16"/><rect x="9" y="7" width="11" height="10" rx="1"/>',
    trimR: '<path d="M20 4v16"/><rect x="4" y="7" width="11" height="10" rx="1"/>',
    diamond: '<path d="M12 3l8 9-8 9-8-9z"/>',
    select: '<path d="M5 3l14 7-6 2-2 6z"/>',
    blade: '<path d="M5 19l14-14"/><path d="M13 5h6v6"/><path d="M5 19h4"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    ripple: '<path d="M4 8h10M4 16h10"/><path d="M17 5l4 3-4 3M17 13l4 3-4 3"/>',
    play: '<path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    edit: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
    frame: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    loop: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 014-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 01-4 4H4"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
    tofront: '<path d="M12 20V7M6 13l6-6 6 6M5 4h14"/>',
    toback: '<path d="M12 4v13M6 11l6 6 6-6M5 20h14"/>',
    first: '<path d="M6 5v14"/><path d="M19 5L9 12l10 7z" fill="currentColor"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
    note: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/>',
    heart: '<path d="M12 20s-7-4.4-9-9.2C1.8 7 4.2 4 7.3 4c1.9 0 3.4 1 4.7 2.8C13.3 5 14.800 4 16.700 4 19.800 4 22.200 7 21 10.800 19 15.600 12 20 12 20z"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    send: '<path d="M21 3L3 10.500l7 2.500 2.500 7z"/><path d="M10 13l11-10"/>',
    bookmark: '<path d="M6 3h12v18l-6-4.500L6 21z"/>',
    dots: '<circle cx="5" cy="12" r="1.600" fill="currentColor"/><circle cx="12" cy="12" r="1.600" fill="currentColor"/><circle cx="19" cy="12" r="1.600" fill="currentColor"/>',
    page: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 10h16M11 3v7M11 10v11"/>',
    film: '<rect x="3" y="4" width="18" height="16"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    sparkle: '<path d="M12 3l2.200 6.300L21 12l-6.800 2.700L12 21l-2.200-6.300L3 12l6.800-2.700z"/>',
    speaker: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 010 6M18.500 6.500a8 8 0 010 11"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4"/>',
    star: '<path d="M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z"/>',
    folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
    layersx: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    gear: '<circle cx="12" cy="12" r="3.500"/><path d="M10 3h4l.5 2.500 2 1 2.300-1.300 2.800 2.800-1.300 2.300 1 2 2.500.5v4l-2.500.5-1 2 1.300 2.300-2.800 2.800-2.300-1.300-2 1-.5 2.500h-4l-.5-2.500-2-1-2.300 1.300-2.800-2.800 1.300-2.300-1-2L2 14v-4l2.500-.5 1-2L4.200 5.200 7 2.400l2.300 1.300 2-1z"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l5 5"/>',
    mixer: '<path d="M5 4v16M12 4v16M19 4v16M3 9h4M10 15h4M17 8h4"/>',
    export: '<path d="M12 3v12M7 8l5-5 5 5M4 17v4h16v-4"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
  };
  MC.icon = (name, size) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size || 16);
    s.setAttribute('height', size || 16);
    s.setAttribute('class', 'i');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || ''; // solo cadenas fijas de este archivo
    return s;
  };
  MC.mark = (size) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 64 64');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<rect class="mark-a" x="24" y="6" width="34" height="34" rx="8" stroke-width="5"/><rect class="mark-b" x="6" y="24" width="34" height="34" rx="8"/>';
    return s;
  };

  /* Controles reutilizables */
  const ui = (MC.ui = {});
  ui.seg = (opts, val, onChange, label) =>
    h('div', { class: 'seg', role: 'group', 'aria-label': label || '' },
      opts.map((o) => h('button', { type: 'button', 'aria-pressed': String(o.v === val), disabled: !!o.off, title: o.title || '', onClick: (e) => {
        if (o.v === val) return;
        e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
        onChange(o.v);
      } }, o.l)));
  ui.chips = (opts, val, onChange) =>
    h('div', { class: 'chips' }, opts.map((o) => h('button', { type: 'button', class: 'chip-b', 'aria-pressed': String(o.v === val), disabled: !!o.off, title: o.title || '', onClick: () => onChange(o.v) }, o.l)));
  ui.slider = (o) => {
    const id = 'sl-' + MC.uid();
    const val = h('span', null, (o.fmt || ((v) => v.toFixed(2)))(o.value));
    const inp = h('input', { type: 'range', id, min: o.min, max: o.max, step: o.step == null ? 0.01 : o.step, value: o.value,
      onInput: (e) => { const v = +e.target.value; val.textContent = (o.fmt || ((x) => x.toFixed(2)))(v); if (o.onInput) o.onInput(v); },
      onChange: (e) => { if (o.onChange) o.onChange(+e.target.value); } });
    return h('div', { class: 'slider' }, h('label', { for: id }, o.label, val), inp);
  };
  ui.field = (label, input, id) => h('div', { class: 'field' }, h('label', { for: id }, label), input);

  /* favoritos: marca con una estrella lo que más usas (sonidos, transiciones, estilos, efectos…) y fíltralo después */
  MC.fav = {
    all() { try { return JSON.parse(MC.store.get('favs', '{}')) || {}; } catch (e) { return {}; } },
    has(kind, id) { return (this.all()[kind] || []).includes(id); },
    list(kind) { return this.all()[kind] || []; },
    toggle(kind, id) { const a = this.all(), l = a[kind] || []; a[kind] = l.includes(id) ? l.filter((x) => x !== id) : l.concat(id); MC.store.set('favs', JSON.stringify(a)); return a[kind].includes(id); },
    btn(kind, id, onChange) {
      const b = h('button', { class: 'btn btn-g btn-ic fav', type: 'button', 'aria-pressed': String(this.has(kind, id)), title: MC.t('Favorito', 'Favourite'), 'aria-label': MC.t('Marcar como favorito', 'Mark as favourite'),
        onClick: (e) => { e.stopPropagation(); const on = MC.fav.toggle(kind, id); b.setAttribute('aria-pressed', String(on)); if (onChange) onChange(on); } }, MC.icon('star', 14));
      return b;
    },
  };

  let toastT = 0;
  /* documento que tiene el foco: la ventana principal o una ventana separada del estudio */
  MC.hostDoc = document;
  MC.toast = (msg) => {
    const D = MC.hostDoc || document;
    D.querySelectorAll('.toast').forEach((n) => n.remove());
    const n = h('div', { class: 'toast', role: 'status' }, msg);
    D.body.append(n);
    clearTimeout(toastT);
    toastT = setTimeout(() => n.remove(), 2800);
  };
  /* Aviso para lectores de pantalla (región «polite»). */
  let live = null;
  MC.announce = (msg) => {
    if (!live) { live = h('div', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' }); document.body.append(live); }
    live.textContent = '';
    setTimeout(() => { live.textContent = msg; }, 40);
  };
  /* Ventana: lleva el foco dentro, lo recorre con Tab sin salirse, se cierra con Esc y devuelve el foco a quien la abrió. */
  MC.modal = (title, body, actions, o) => {
    const D = MC.hostDoc || document, prev = D.activeElement, tid = 'mt-' + MC.uid();
    const close = () => { scrim.remove(); D.removeEventListener('keydown', onKey); if (prev && prev.focus && D.contains(prev)) prev.focus(); };
    const focusables = () => [...dlg.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null);
    const onKey = (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (D.activeElement === first || !dlg.contains(D.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (D.activeElement === last || !dlg.contains(D.activeElement))) { e.preventDefault(); first.focus(); }
    };
    const dlg = h('div', { class: 'modal' + (o && o.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': tid }, h('h2', { id: tid }, title), body, actions ? h('div', { class: 'row-end' }, actions(close)) : null);
    const scrim = h('div', { class: 'scrim', onMousedown: (e) => { if (e.target === scrim) close(); } }, dlg);
    D.addEventListener('keydown', onKey);
    D.body.append(scrim);
    setTimeout(() => { const f = focusables(); (f.find((n) => n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') || f[0] || dlg).focus(); }, 30);
    return { close };
  };
})();
