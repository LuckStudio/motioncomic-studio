/* Cursores personalizados: el de siempre (el del sistema), una colección dibujada para la app (retro, futurista, pixelado, de cómic, minimalista,
   de precisión) o una imagen propia. Se aplica con la propiedad CSS `cursor` y se guarda en este equipo. Solo cambia el cursor dentro de la página
   (no fuera del navegador). Los cursores especiales de cada herramienta (redimensionar, texto, arrastrar…) se respetan. */
(function () {
  'use strict';
  const MC = window.MC, h = MC.h, t = MC.t;

  const uri = (svg) => 'data:image/svg+xml,' + encodeURIComponent(svg.replace(/\s+/g, ' ').trim());
  const svg = (w, hh, body) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + hh + '" viewBox="0 0 ' + w + ' ' + hh + '">' + body + '</svg>';
  /* flecha clásica: la punta está en (2,2) */
  const ARROW = 'M2 2 L2 25 L8 19.5 L12 28.5 L16 26.8 L12 18 L20.5 18 Z';
  /* dibujo en píxeles a partir de un mapa de letras: B negro, W blanco, O naranja */
  const pix = (map, k, fills) => { let o = ''; map.forEach((row, y) => [...row].forEach((c, x) => { if (fills[c]) o += '<rect x="' + x * k + '" y="' + y * k + '" width="' + k + '" height="' + k + '" fill="' + fills[c] + '"/>'; })); return o; };
  const PIX = ['B..........', 'BB.........', 'BWB........', 'BWWB.......', 'BWWWB......', 'BWWWWB.....', 'BWWWWWB....', 'BWWWWWWB...', 'BWWWWWWWB..', 'BWWWWWBBBB.', 'BWWBWWB....', 'BWB.BWWB...', 'BB..BWWB...', 'B....BWWB..', '.....BBBB..'];

  /* cada estilo: { arrow, pointer } con { url, x, y } (x, y: punto activo) */
  const mk = (s, x, y) => ({ url: uri(s), x, y });
  const PRESETS = [
    { id: 'retro', es: 'Retro', en: 'Retro', desc: ['Flecha de los 90: borde negro duro y sombra.', '90s arrow: hard black outline and shadow.'],
      arrow: mk(svg(32, 32, '<path d="' + ARROW + '" transform="translate(2 2)" fill="#000" opacity=".35"/><path d="' + ARROW + '" fill="#fff" stroke="#000" stroke-width="2" stroke-linejoin="miter"/>'), 2, 2),
      pointer: mk(svg(32, 32, '<path d="' + ARROW + '" transform="translate(2 2)" fill="#000" opacity=".35"/><path d="' + ARROW + '" fill="#ffd400" stroke="#000" stroke-width="2" stroke-linejoin="miter"/>'), 2, 2) },
    { id: 'futurista', es: 'Futurista', en: 'Futuristic', desc: ['Punta de neón cian con brillo; mira circular al pulsar.', 'Cyan neon tip with glow; circular reticle on buttons.'],
      arrow: mk(svg(32, 32, '<defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M4 3 L4 24 L10 19 L14 28 L18 26 L14 17.500 L22 17.500 Z" fill="rgba(0,229,255,.18)" stroke="#00e5ff" stroke-width="1.800" stroke-linejoin="round" filter="url(#g)"/>'), 4, 3),
      pointer: mk(svg(32, 32, '<defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g fill="none" stroke="#00e5ff" stroke-width="1.800" filter="url(#g)"><circle cx="16" cy="16" r="9"/><path d="M16 2v6M16 24v6M2 16h6M24 16h6"/></g><circle cx="16" cy="16" r="2" fill="#00e5ff"/>'), 16, 16) },
    { id: 'pixelado', es: 'Pixelado', en: 'Pixel art', desc: ['Flecha de píxeles gordos, como un juego de 8 bits.', 'Chunky pixel arrow, like an 8-bit game.'],
      arrow: mk(svg(22, 30, pix(PIX, 2, { B: '#000', W: '#fff' })), 0, 0), pointer: mk(svg(22, 30, pix(PIX, 2, { B: '#000', W: '#ff8a00' })), 0, 0) },
    { id: 'comic', es: 'De cómic', en: 'Comic', desc: ['Flecha amarilla de trazo grueso y una explosión al pulsar.', 'Thick-stroke yellow arrow and a burst on buttons.'],
      arrow: mk(svg(32, 32, '<path d="M3 3 L3 25 L9 20 L13 29 L17 27 L13 18.500 L21 18.500 Z" fill="#ffe14d" stroke="#111" stroke-width="3" stroke-linejoin="round"/>'), 3, 3),
      pointer: mk(svg(34, 34, '<path d="M17 2 L21 11 L31 9 L24 17 L32 24 L22 24 L19 33 L15 24 L5 28 L10 18 L2 12 L12 11 Z" fill="#ff3d6e" stroke="#111" stroke-width="2.500" stroke-linejoin="round"/>'), 17, 17) },
    { id: 'minimal', es: 'Minimalista', en: 'Minimal', desc: ['Un anillo pequeño; se rellena al pulsar.', 'A small ring; it fills on buttons.'],
      arrow: mk(svg(24, 24, '<circle cx="12" cy="12" r="6" fill="none" stroke="#fff" stroke-width="3"/><circle cx="12" cy="12" r="6" fill="none" stroke="#111" stroke-width="1.200"/>'), 12, 12),
      pointer: mk(svg(24, 24, '<circle cx="12" cy="12" r="7" fill="#fff" stroke="#111" stroke-width="1.500"/>'), 12, 12) },
    { id: 'precision', es: 'De precisión', en: 'Precision', desc: ['Cruz fina para colocar cosas al píxel.', 'A thin cross for pixel-accurate placing.'],
      arrow: mk(svg(32, 32, '<g stroke="#fff" stroke-width="3" fill="none"><path d="M16 3v10M16 19v10M3 16h10M19 16h10"/></g><g stroke="#111" stroke-width="1.200" fill="none"><path d="M16 3v10M16 19v10M3 16h10M19 16h10"/></g>'), 16, 16),
      pointer: mk(svg(32, 32, '<g stroke="#fff" stroke-width="3" fill="none"><circle cx="16" cy="16" r="8"/><path d="M16 3v6M16 23v6M3 16h6M23 16h6"/></g><g stroke="#111" stroke-width="1.200" fill="none"><circle cx="16" cy="16" r="8"/><path d="M16 3v6M16 23v6M3 16h6M23 16h6"/></g>'), 16, 16) },
  ];
  const INTERACTIVE = 'a[href], button, summary, label, select, [role=button], [role=tab], [role=option], [role=menuitem], .btn, .chip-b, .card, .tile, .mode, .layer, .clip, .lyrbar, .tl-ruler';

  const getCustom = () => { try { return JSON.parse(MC.store.get('cursorcustom', 'null')); } catch (e) { return null; } };
  const entry = () => {
    const id = MC.store.get('cursor', 'system');
    if (id === 'custom') { const c = getCustom(); if (c && c.url) { const q = { url: c.url, x: c.hx, y: c.hy }; return { arrow: q, pointer: q }; } return null; }
    return PRESETS.find((p) => p.id === id) || null;
  };
  const css = (q, fallback) => 'url("' + q.url + '") ' + Math.round(q.x) + ' ' + Math.round(q.y) + ', ' + fallback;

  /* aplica el cursor elegido a toda la app (un <style> propio y un atributo en <html>) */
  MC.cursors = {
    PRESETS,
    current: () => MC.store.get('cursor', 'system'),
    apply() {
      let st = document.getElementById('mc-cursor'); const e = entry(), root = document.documentElement;
      if (!e) { if (st) st.remove(); root.removeAttribute('data-cur'); return; }
      if (!st) { st = document.createElement('style'); st.id = 'mc-cursor'; document.head.append(st); }
      st.textContent = 'html[data-cur], html[data-cur] body { cursor: ' + css(e.arrow, 'auto') + '; }\n' +
        'html[data-cur] :is(' + INTERACTIVE + '):not([disabled]):not([aria-disabled="true"]) { cursor: ' + css(e.pointer, 'pointer') + '; }';
      root.setAttribute('data-cur', MC.store.get('cursor', 'system'));
    },
    set(id) { MC.store.set('cursor', id); MC.cursors.apply(); },
    /* vista previa de un cursor sobre un elemento concreto (sin aplicarlo a toda la app) */
    previewStyle: (q) => 'cursor: ' + css(q, 'auto'),
    /* convierte una imagen propia en un cursor: se reduce a un tamaño máximo y se guarda como PNG */
    async fromFile(file, size) {
      const bmp = await (async () => {
        if (/svg/.test(file.type) || /\.svg$/i.test(file.name)) { const u = URL.createObjectURL(file); try { const im = new Image(); im.src = u; await im.decode(); return im; } finally { setTimeout(() => URL.revokeObjectURL(u), 3000); } }
        return createImageBitmap(file);
      })();
      const w0 = bmp.naturalWidth || bmp.width, h0 = bmp.naturalHeight || bmp.height, k = Math.min(1, size / Math.max(w0, h0)) || 1, w = Math.max(1, Math.round(w0 * k)), hh = Math.max(1, Math.round(h0 * k));
      const c = document.createElement('canvas'); c.width = w; c.height = hh; c.getContext('2d').drawImage(bmp, 0, 0, w, hh);
      return { url: c.toDataURL('image/png'), w, h: hh };
    },
    setCustom(c) { try { MC.store.set('cursorcustom', JSON.stringify(c)); MC.store.set('cursor', 'custom'); MC.cursors.apply(); return true; } catch (e) { MC.toast(t('No se pudo guardar el cursor (imagen demasiado grande).', 'The cursor could not be saved (image too large).')); return false; } },
    custom: getCustom,
  };

  /* panel de Preferencias → Cursor */
  MC.cursorPane = (el) => {
    const again = () => { MC.clear(el); MC.cursorPane(el); };
    const cur = MC.cursors.current(), cust = getCustom();
    const card = (id, name, desc, q) => h('div', { class: 'cur-card' + (cur === id ? ' on' : ''), role: 'group', 'aria-label': name },
      h('div', { class: 'cur-pad', style: q ? MC.cursors.previewStyle(q.arrow) : '', 'aria-hidden': 'true' }, q ? h('img', { src: q.arrow.url, alt: '', width: 32 }) : h('span', null, '↖'), q ? h('img', { src: q.pointer.url, alt: '', width: 32 }) : h('span', null, '☝')),
      h('b', null, name), h('span', { class: 'cap' }, desc),
      h('button', { class: 'btn ' + (cur === id ? 'btn-s' : 'btn-p') + ' btn-sm', type: 'button', 'aria-pressed': String(cur === id), onClick: () => { MC.cursors.set(id); again(); } }, cur === id ? t('En uso', 'In use') : t('Usar', 'Use')));
    const fileIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml,.svg', hidden: true });
    const state = { size: +MC.store.get('cursorsize', '32'), hx: cust ? cust.hx : 0, hy: cust ? cust.hy : 0, img: cust };
    const prev = h('div', { class: 'cur-pad cur-big', 'aria-label': t('Prueba tu cursor aquí', 'Try your cursor here') }, h('span', { class: 'cap' }, t('Mueve el ratón aquí para probarlo', 'Move the mouse here to try it')));
    const note = h('p', { class: 'cap', role: 'status', 'aria-live': 'polite' }, '');
    const refresh = () => { if (state.img) prev.style.cssText = MC.cursors.previewStyle({ url: state.img.url, x: state.hx, y: state.hy }); };
    const hot = (label, fx, fy) => h('button', { class: 'chip-b', type: 'button', onClick: () => { if (!state.img) return; state.hx = Math.round(state.img.w * fx); state.hy = Math.round(state.img.h * fy); refresh(); } }, label);
    fileIn.addEventListener('change', async (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try { const q = await MC.cursors.fromFile(f, state.size); state.img = q; state.hx = 0; state.hy = 0; refresh(); note.textContent = t('Imagen lista (', 'Image ready (') + q.w + '×' + q.h + t(' px). Elige el punto activo —el píxel que «clica»— y pulsa «Usar mi cursor».', ' px). Choose the hotspot —the pixel that clicks— and press “Use my cursor”.'); }
      catch (err) { note.textContent = t('No se pudo leer esa imagen.', 'That image could not be read.'); }
    });
    MC.put(el, h('h3', null, t('Cursor', 'Cursor')),
      h('p', { class: 'cap' }, t('Elige cómo se ve el ratón en la aplicación: el de siempre, uno de los estilos incluidos o tu propia ilustración. Solo cambia dentro de la página; las herramientas que necesitan su propio cursor (redimensionar, escribir, arrastrar) lo conservan.', 'Choose how the mouse looks in the app: the usual one, one of the included styles or your own illustration. It only changes inside the page; tools that need their own cursor (resize, type, drag) keep it.')),
      h('div', { class: 'cur-grid' }, card('system', t('Cursor del sistema', 'System cursor'), t('El de siempre, el de tu sistema.', 'The usual one, from your system.'), null),
        PRESETS.map((p) => card(p.id, t(p.es, p.en), t(p.desc[0], p.desc[1]), p))),
      h('div', { class: 'eyebrow', style: { marginTop: '10px' } }, t('Tu propio cursor', 'Your own cursor')),
      h('p', { class: 'cap' }, t('Sube un PNG, JPG, WebP o SVG (mejor con fondo transparente). Se reduce al tamaño que elijas; los navegadores aceptan cursores de hasta 128 px y los muy grandes tapan lo que hay debajo.', 'Upload a PNG, JPG, WebP or SVG (best with a transparent background). It is scaled to the size you choose; browsers accept cursors up to 128 px and very large ones cover what is underneath.')),
      h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Tamaño máximo', 'Maximum size')), MC.ui.seg([['24', '24 px'], ['32', '32 px'], ['48', '48 px'], ['64', '64 px']].map((q) => ({ v: q[0], l: q[1] })), String(state.size), (v) => { state.size = +v; MC.store.set('cursorsize', v); })),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => fileIn.click() }, MC.icon('upload', 14), t('Elegir imagen', 'Choose image')), fileIn),
      h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Punto activo (donde «clica»)', 'Hotspot (where it clicks)')), h('div', { class: 'chips' }, hot(t('Esquina superior izquierda', 'Top left'), 0, 0), hot(t('Centro', 'Centre'), 0.5, 0.5), hot(t('Punta abajo', 'Bottom tip'), 0.5, 1))),
      prev, note,
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: () => { if (!state.img) { note.textContent = t('Primero elige una imagen.', 'Choose an image first.'); return; } if (MC.cursors.setCustom({ url: state.img.url, w: state.img.w, h: state.img.h, hx: state.hx, hy: state.hy })) again(); } }, t('Usar mi cursor', 'Use my cursor')),
        h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => { MC.store.set('cursorcustom', 'null'); if (MC.cursors.current() === 'custom') MC.cursors.set('system'); again(); } }, t('Quitar el mío', 'Remove mine'))));
    refresh();
  };
  if (MC.store) MC.cursors.apply();
})();
