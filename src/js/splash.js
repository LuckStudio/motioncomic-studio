/* Pantalla de carga al abrir la aplicación (antes del inicio, no al abrir proyectos). Se puede ocultar y cambiar su imagen. */
(function () {
  'use strict';
  const MC = window.MC, h = MC.h, t = MC.t;
  const K = { on: 'splash', img: 'splashImg', credit: 'splashCredit' };
  const enabled = () => MC.store.get(K.on, 'on') !== 'off';
  const BUILD = (document.querySelector('meta[name="mc-build"]') || {}).content || 'dev';
  let defaultUrl = null;

  /* Imagen por defecto: un patrón de viñetas de cómic con puntos de trama, líneas de velocidad y rayos. Se dibuja al vuelo. */
  function pattern(W, H) {
    let seed = 20240611; const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const PAL = [['#2a1b6e', '#8c7cff'], ['#ff5e8a', '#ffb199'], ['#12123a', '#3d5afe'], ['#ffcf5c', '#ff8a3d'], ['#0b6e6e', '#5ee6c9'], ['#3a0f4f', '#c04bff'], ['#1a1a2e', '#6a59e8']];
    g.fillStyle = '#0d0b24'; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W * 0.06, 0); g.transform(1, 0, -0.12, 1, 0, 0); /* viñetas inclinadas */
    const panels = [];
    const split = (x, y, w, hh, d) => {
      if (d === 0 || (w < 150 && hh < 150)) { panels.push([x, y, w, hh]); return; }
      const vert = w > hh ? true : hh > w ? false : rnd() > 0.5, k = 0.34 + rnd() * 0.32;
      if (vert) { split(x, y, w * k, hh, d - 1); split(x + w * k, y, w * (1 - k), hh, d - 1); } else { split(x, y, w, hh * k, d - 1); split(x, y + hh * k, w, hh * (1 - k), d - 1); }
    };
    split(-W * 0.2, -20, W * 1.4, H + 40, 4);
    panels.forEach((p, i) => {
      const [x, y, w, hh] = p, pal = PAL[Math.floor(rnd() * PAL.length)], kind = i % 6, cx = x + w * (0.25 + rnd() * 0.5), cy = y + hh * (0.25 + rnd() * 0.5);
      g.save(); g.beginPath(); g.rect(x, y, w, hh); g.clip();
      const gr = g.createLinearGradient(x, y, x + w, y + hh); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); g.fillStyle = gr; g.fillRect(x, y, w, hh);
      if (kind === 0 || kind === 3) { /* trama de puntos que crece en diagonal */
        g.fillStyle = 'rgba(255,255,255,.22)'; const s = 16; for (let yy = y; yy < y + hh; yy += s) for (let xx = x + ((yy / s) % 2 ? s / 2 : 0); xx < x + w; xx += s) { const r = Math.max(0.5, s * 0.42 * ((xx - x) / w * 0.6 + (yy - y) / hh * 0.4)); g.beginPath(); g.arc(xx, yy, r, 0, 7); g.fill(); }
      }
      if (kind === 1 || kind === 4) { /* líneas de velocidad */
        g.strokeStyle = 'rgba(255,255,255,.55)'; for (let a = 0; a < 90; a++) { const ang = rnd() * Math.PI * 2, r0 = 40 + rnd() * 90, r1 = 400; g.lineWidth = 0.6 + rnd() * 2.4; g.beginPath(); g.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); g.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1); g.stroke(); }
      }
      if (kind === 2) { /* rayos de sol */
        g.fillStyle = 'rgba(255,255,255,.2)'; for (let a = 0; a < 18; a++) { const a0 = a / 18 * Math.PI * 2, a1 = a0 + Math.PI / 36; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 700, a0, a1); g.closePath(); g.fill(); }
      }
      if (kind === 5) { /* franjas y estrellas */
        g.fillStyle = 'rgba(255,255,255,.14)'; for (let s = -hh; s < w + hh; s += 26) { g.beginPath(); g.moveTo(x + s, y); g.lineTo(x + s + 12, y); g.lineTo(x + s + 12 - hh, y + hh); g.lineTo(x + s - hh, y + hh); g.fill(); }
        g.fillStyle = '#fff'; for (let s = 0; s < 18; s++) { g.globalAlpha = 0.4 + rnd() * 0.6; g.beginPath(); g.arc(x + rnd() * w, y + rnd() * hh, 0.8 + rnd() * 2.2, 0, 7); g.fill(); } g.globalAlpha = 1;
      }
      /* luna o botón de reproducir en algunas viñetas */
      if (i % 4 === 1 && w > 130 && hh > 130) { g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.arc(cx, cy, Math.min(w, hh) * 0.18, 0, 7); g.fill(); g.fillStyle = pal[0]; g.beginPath(); const rr = Math.min(w, hh) * 0.09; g.moveTo(cx - rr * 0.5, cy - rr); g.lineTo(cx + rr, cy); g.lineTo(cx - rr * 0.5, cy + rr); g.fill(); }
      g.restore();
      g.lineWidth = 9; g.strokeStyle = '#fff'; g.strokeRect(x, y, w, hh); g.lineWidth = 2; g.strokeStyle = '#0d0b24'; g.strokeRect(x + 4.5, y + 4.5, w - 9, hh - 9);
    });
    g.restore();
    const v = g.createLinearGradient(0, H * 0.55, 0, H); v.addColorStop(0, 'rgba(13,11,36,0)'); v.addColorStop(1, 'rgba(13,11,36,.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    return c.toDataURL('image/jpeg', 0.9);
  }
  const art = () => { const own = MC.store.get(K.img, ''); if (own) return own; if (!defaultUrl) defaultUrl = pattern(760, 920); return defaultUrl; };

  /* la tarjeta (texto a la izquierda, imagen a la derecha) se usa en la pantalla de carga y en «Acerca de» */
  function cardParts(o) {
    const credit = MC.store.get(K.credit, '').trim();
    const status = h('p', { class: 'sp-status', role: 'status', 'aria-live': 'polite' }, t('Preparando el espacio de trabajo…', 'Preparing the workspace…'));
    const bar = h('i');
    const ded = h('div', { class: 'sp-ded' }, h('b', null, t('Dedicado a GotiDraw', 'Dedicated to GotiDraw')),
      h('span', null, t('mi gran amigo y artista. Esta herramienta existe para dar movimiento a su arte.', 'my dear friend and artist. This tool exists to bring his art to life.')));
    const foot = o.static
      ? h('div', { class: 'sp-foot' }, h('p', { class: 'sp-small' }, t('Versión ', 'Version ') + (MC.VERSION || '') + (BUILD && BUILD !== 'dev' ? ' · ' + BUILD : ''), h('br'), t('Desarrollado por LuckStudio, en desarrollo continuo.', 'Developed by LuckStudio, in continuous development.')), MC.repoLink ? MC.repoLink(t('Código y novedades en GitHub', 'Source code and news on GitHub')) : null)
      : h('div', { class: 'sp-foot' }, status, h('div', { class: 'sp-bar', 'aria-hidden': 'true' }, bar), h('p', { class: 'sp-small' }, t('Versión ', 'Version '), BUILD, ' · ', t('toca o pulsa una tecla para saltar', 'tap or press a key to skip')));
    const card = h('div', { class: 'sp-card' + (o.static ? ' static' : '') },
      h('div', { class: 'sp-copy' },
        h('div', { class: 'sp-brand' }, MC.mark(40), h('b', null, 'MotionComic'), h('span', null, 'Studio')),
        h('p', { class: 'sp-tag' }, t('Del papel al vídeo, sin salir de tu equipo.', 'From paper to video, without leaving your device.')),
        ded,
        h('p', { class: 'sp-art' }, t('Imagen: ', 'Artwork: '), credit || t('patrón provisional de MotionComic Studio', 'provisional MotionComic Studio pattern')),
        h('p', { class: 'sp-small' }, t('Todo ocurre en este dispositivo: tu arte no sale de aquí.', 'Everything happens on this device: your art never leaves it.')),
        foot),
      h('div', { class: 'sp-img', role: o.static ? 'img' : null, 'aria-hidden': o.static ? null : 'true', 'aria-label': o.static ? t('Imagen de portada', 'Cover image') : null, style: { backgroundImage: 'url("' + art() + '")' } }));
    return { card, status, bar };
  }
  function build() {
    const { card, status, bar } = cardParts({});
    const node = h('div', { class: 'splash', role: 'dialog', 'aria-label': t('MotionComic Studio se está cargando', 'MotionComic Studio is loading'), 'aria-busy': 'true' }, card);
    return { node, status, bar };
  }

  function start(force) {
    const skipAuto = navigator.webdriver && !/[?&]splash=1/.test(location.search);
    if (!force && (!enabled() || skipAuto)) return { ready: Promise.resolve(), hide() {} };
    const reduced = MC.motion && MC.motion.reduced(), MIN = reduced ? 1200 : 2600, { node, status, bar } = build();
    document.body.append(node);
    if (!reduced) requestAnimationFrame(() => { bar.style.transitionDuration = MIN + 'ms'; bar.style.width = '100%'; });
    else bar.style.width = '100%';
    const msgs = [[0.38, t('Cargando tus proyectos…', 'Loading your projects…')], [0.74, t('Casi listo…', 'Almost ready…')]];
    const timers = msgs.map((m) => setTimeout(() => { status.textContent = m[1]; }, MIN * m[0]));
    let skip; const ready = new Promise((res) => { const tm = setTimeout(res, MIN); skip = () => { clearTimeout(tm); res(); }; timers.push(tm); });
    const onSkip = () => skip(); addEventListener('pointerdown', onSkip, true); addEventListener('keydown', onSkip, true);
    let gone = false;
    const hide = () => { if (gone) return; gone = true; timers.forEach(clearTimeout); removeEventListener('pointerdown', onSkip, true); removeEventListener('keydown', onSkip, true); node.setAttribute('aria-busy', 'false'); node.classList.add('out'); setTimeout(() => node.remove(), reduced ? 0 : 700); };
    return { ready, hide };
  }

  /* ajustes (Preferencias → Apariencia) */
  async function resize(file) {
    const url = URL.createObjectURL(file), img = new Image();
    try { img.src = url; await img.decode(); const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85); } finally { URL.revokeObjectURL(url); }
  }
  function fields(el) {
    const fid = 'sp-f-' + MC.uid(), cid = 'sp-c-' + MC.uid(), own = !!MC.store.get(K.img, '');
    const thumb = h('div', { class: 'sp-thumb', style: { backgroundImage: 'url("' + art() + '")' }, role: 'img', 'aria-label': t('Imagen actual de la pantalla de carga', 'Current loading screen image') });
    const file = h('input', { id: fid, type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true, onChange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const url = await resize(f); MC.store.set(K.img, url); if (MC.store.get(K.img, '') !== url) throw new Error('cuota'); thumb.style.backgroundImage = 'url("' + url + '")'; MC.toast(t('Imagen cambiada', 'Image changed')); }
      catch (err) { MC.store.set(K.img, ''); MC.toast(t('No se pudo guardar la imagen (¿es muy grande?).', 'Could not save the image (is it too large?).')); }
    } });
    return h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Pantalla de carga al abrir la aplicación', 'Loading screen when the app opens')),
      MC.ui.seg([{ v: 'on', l: t('Mostrar', 'Show') }, { v: 'off', l: t('Ocultar', 'Hide') }], MC.store.get(K.on, 'on'), (v) => MC.store.set(K.on, v), t('Pantalla de carga', 'Loading screen')),
      h('div', { class: 'sp-set' }, thumb, h('div', { style: { display: 'grid', gap: '8px' } },
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { class: 'btn btn-sm', type: 'button', onClick: () => file.click() }, t('Cambiar imagen', 'Change image')),
          h('button', { class: 'btn btn-g btn-sm', type: 'button', disabled: !own, onClick: () => { MC.store.set(K.img, ''); thumb.style.backgroundImage = 'url("' + art() + '")'; MC.toast(t('Imagen original restaurada', 'Original image restored')); } }, t('Restaurar', 'Restore')),
          h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => { const s = start(true); s.ready.then(s.hide); } }, t('Ver ahora', 'Preview'))),
        h('label', { class: 'cap', for: cid }, t('Crédito de la imagen (opcional)', 'Image credit (optional)')),
        h('input', { id: cid, class: 'input', value: MC.store.get(K.credit, ''), placeholder: t('Nombre del artista', 'Artist name'), onInput: (e) => MC.store.set(K.credit, e.target.value) }),
        file)));
  }
  MC.splash = { start, fields, enabled, card: () => cardParts({ static: true }).card };
})();
