/* 30 efectos más: movimiento, cómic y manga, luz y atmósfera, imagen y estilo. Todos se dibujan con código (sin archivos ni licencias) y usan los mismos
   ajustes comunes que los demás (cuándo empieza, cuánto dura, intensidad, velocidad, opacidad, entrada y salida, variación). Se enganchan a fx.js. */
(function () {
  'use strict';
  const MC = window.MC, K = MC.fxKit, { clamp } = MC;
  if (!K) return;
  const { mk, regionOf, hexN, lumAt, nz } = K;
  const TAU = Math.PI * 2, wrap1 = (v) => ((v % 1) + 1) % 1, sm01 = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const backOut = (x) => { const c1 = 1.70158, c3 = c1 + 1, u = clamp(x, 0, 1) - 1; return 1 + c3 * u * u * u + c1 * u * u; };
  const rgba = (hex, a) => { const c = hexN(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + clamp(a, 0, 1) + ')'; };

  /* ---------- catálogo ---------- */
  const GROUPS = [['mov', 'Movimiento', 'Motion'], ['comic', 'Cómic y manga', 'Comic and manga'], ['luz', 'Luz y atmósfera', 'Light and atmosphere'], ['img', 'Imagen y estilo', 'Image and style']];
  const LIST = [
    ['zoompunch', 'mov', 0.7, 'Zoom de golpe', 'Punch zoom'], ['beatzoom', 'mov', 3, 'Zoom al ritmo', 'Beat zoom'], ['handheld', 'mov', 4, 'Cámara en mano', 'Handheld camera'],
    ['whip', 'mov', 0.7, 'Latigazo de cámara', 'Whip pan'], ['quickspin', 'mov', 0.8, 'Giro rápido', 'Quick spin'], ['freezehit', 'mov', 0.9, 'Pausa de impacto', 'Impact pause'],
    ['onomato', 'comic', 1.4, 'Onomatopeya', 'Sound word'], ['burst', 'comic', 0.9, 'Estallido de color', 'Colour burst'], ['emote', 'comic', 1.6, 'Símbolo de emoción', 'Emotion symbol'],
    ['silhouette', 'comic', 1.4, 'Silueta de impacto', 'Impact silhouette'], ['slash', 'comic', 1.1, 'Corte diagonal', 'Diagonal slash'], ['ink', 'comic', 2, 'Tinta que se extiende', 'Spreading ink'], ['tension', 'comic', 3, 'Trama de tensión', 'Tension screen'],
    ['lensflare', 'luz', 2.5, 'Destello de lente', 'Lens flare'], ['bloom', 'luz', 3, 'Resplandor', 'Bloom'], ['flicker', 'luz', 4, 'Parpadeo de vela', 'Candle flicker'], ['lightning', 'luz', 1.2, 'Relámpago', 'Lightning'],
    ['embers', 'luz', 4, 'Ascuas', 'Embers'], ['petals', 'luz', 5, 'Pétalos u hojas', 'Petals or leaves'], ['magic', 'luz', 3.5, 'Destellos mágicos', 'Magic sparkles'], ['heat', 'luz', 3, 'Ondas de calor', 'Heat haze'], ['underwater', 'luz', 4, 'Bajo el agua', 'Underwater'],
    ['selective', 'img', 3, 'Color selectivo', 'Selective colour'], ['oldfilm', 'img', 4, 'Película antigua', 'Old film'], ['spotlight', 'img', 4, 'Foco de luz', 'Spotlight'], ['motionblur', 'img', 2, 'Desenfoque de movimiento', 'Motion blur'],
    ['radialblur', 'img', 1.5, 'Desenfoque radial', 'Radial blur'], ['kaleido', 'img', 3, 'Caleidoscopio', 'Kaleidoscope'], ['neon', 'img', 3, 'Contornos de neón', 'Neon outlines'], ['sketch', 'img', 3, 'Boceto a lápiz', 'Pencil sketch'],
  ].map((q) => ({ v: q[0], g: q[1], dur: q[2], es: q[3], en: q[4] }));
  /* los que deforman o recorren cada píxel son más pesados en equipos modestos */
  const HEAVY = new Set(['heat', 'underwater', 'radialblur', 'kaleido', 'selective', 'neon', 'silhouette']);
  /* ajustes propios: [clave, es, en, mínimo, máximo, paso, valor] · ['text', clave, es, en, valor] · ['select', clave, es, en, [[v,es,en]…], valor] */
  const PARAMS = {
    beatzoom: [['bpm', 'Tempo (pulsos por minuto)', 'Tempo (beats per minute)', 60, 200, 1, 120]],
    whip: [['dir', 'Dirección', 'Direction', 'sel'], ],
    quickspin: [['turns', 'Vueltas', 'Turns', 0.5, 3, 0.5, 1]],
    onomato: [['text', 'Texto', 'Text', '¡BOOM!'], ['x', 'Posición horizontal', 'Horizontal position', -0.45, 0.45, 0.01, 0], ['y', 'Posición vertical', 'Vertical position', -0.45, 0.45, 0.01, -0.12]],
    burst: [['rays', 'Rayos', 'Rays', 8, 48, 1, 24]],
    emote: [['symbol', 'Símbolo', 'Symbol', [['exclaim', '¡Exclamación!', 'Exclamation'], ['question', '¿Duda?', 'Question'], ['sweat', 'Gota de sudor', 'Sweat drop'], ['anger', 'Vena de enfado', 'Anger vein'], ['heart', 'Corazón', 'Heart'], ['star', 'Estrella', 'Star'], ['dots', 'Puntos suspensivos', 'Ellipsis']], 'exclaim'], ['x', 'Posición horizontal', 'Horizontal position', -0.45, 0.45, 0.01, 0.22], ['y', 'Posición vertical', 'Vertical position', -0.45, 0.45, 0.01, -0.3]],
    silhouette: [['thresh', 'Umbral (qué es negro)', 'Threshold (what is black)', 0.1, 0.9, 0.01, 0.45]],
    slash: [['gap', 'Separación', 'Gap', 0.02, 0.3, 0.005, 0.12]],
    ink: [['blobs', 'Manchas', 'Blobs', 3, 14, 1, 7]],
    tension: [['cell', 'Tamaño de los puntos', 'Dot size', 20, 90, 1, 46]],
    lensflare: [['x', 'Posición de la luz', 'Light position', 0.05, 0.95, 0.01, 0.2]],
    bloom: [['radius', 'Radio del brillo', 'Glow radius', 4, 40, 1, 14]],
    petals: [['kind', 'Tipo', 'Kind', [['petal', 'Pétalos rosas', 'Pink petals'], ['leaf', 'Hojas verdes', 'Green leaves'], ['autumn', 'Hojas de otoño', 'Autumn leaves']], 'petal']],
    heat: [['wave', 'Fuerza de la onda', 'Wave strength', 0.2, 3, 0.05, 1]],
    underwater: [['wave', 'Fuerza de la onda', 'Wave strength', 0.2, 3, 0.05, 1]],
    selective: [['tol', 'Margen de color', 'Colour margin', 0.03, 0.4, 0.01, 0.12]],
    motionblur: [['amount', 'Longitud', 'Length', 0.01, 0.15, 0.005, 0.05]],
    radialblur: [['amount', 'Fuerza', 'Strength', 0.01, 0.25, 0.005, 0.07]],
    kaleido: [['seg', 'Segmentos', 'Segments', 3, 12, 1, 6]],
    neon: [['glow', 'Brillo', 'Glow', 0, 1, 0.01, 0.7]],
    sketch: [['line', 'Fuerza del trazo', 'Line strength', 1, 12, 0.5, 4]],
  };
  PARAMS.whip = [['dir', 'Dirección', 'Direction', [['l', 'Hacia la izquierda', 'To the left'], ['r', 'Hacia la derecha', 'To the right']], 'l']];
  const COLOR = { onomato: '#ffd400', burst: '#ff3d6e', emote: '#ff3d6e', silhouette: '#0b0b10', slash: '#ffffff', ink: '#0b0b10', tension: '#111111', lensflare: '#ffd9a0', flicker: '#ffa040', lightning: '#cfe4ff', embers: '#ff8a2a', magic: '#fff3a0', underwater: '#2aa6c8', selective: '#e5333d', spotlight: '#000000', neon: '#00e5ff', sketch: '#f4efe2', oldfilm: '#c9a46a' };
  const defaults = {};
  const kindOf = (q) => (q.length === 4 && typeof q[3] === 'string' ? 'text' : q.length === 5 && Array.isArray(q[3]) ? 'select' : 'slider');
  LIST.forEach((d) => { const o = {}; (PARAMS[d.v] || []).forEach((q) => { const kd = kindOf(q); o[q[0]] = kd === 'text' ? q[3] : kd === 'select' ? q[4] : q[6]; }); if (COLOR[d.v]) o.color = COLOR[d.v]; defaults[d.v] = o; });
  defaults.slash.angle = -25; defaults.motionblur.angle = 0;
  /* los que tienen opción de color propia */
  const COLORED = new Set(Object.keys(COLOR));

  /* ---------- movimiento: suman al movimiento de cámara (dx, dy en fracción del ancho; rot en grados; sc multiplica el zoom) ---------- */
  const ANIM = {
    zoompunch: (f, a, I) => ({ dx: 0, dy: 0, rot: 0, sc: 1 + 0.2 * I * Math.exp((-a * 9) / (f.dur / 0.5)) }),
    beatzoom: (f, a, I) => ({ dx: 0, dy: 0, rot: 0, sc: 1 + 0.07 * I * Math.pow(1 - wrap1((a * (f.bpm || 120)) / 60), 3) }),
    handheld: (f, a, I) => ({ dx: (Math.sin(a * 1.7) * 0.6 + Math.sin(a * 3.9 + 1.3) * 0.4) * 0.006 * I, dy: (Math.sin(a * 1.3 + 0.6) * 0.6 + Math.sin(a * 4.4) * 0.4) * 0.006 * I, rot: Math.sin(a * 1.1 + 2) * 0.5 * I, sc: 1.03 }),
    whip: (f, a, I) => { const e = sm01(a / f.dur); return { dx: (f.dir === 'r' ? -1 : 1) * 0.2 * Math.min(I, 1.6) * Math.pow(1 - e, 2), dy: 0, rot: 0, sc: 1 }; },
    quickspin: (f, a, I) => { const p = clamp(a / f.dur, 0, 1), e = sm01(p); return { dx: 0, dy: 0, rot: 360 * e * (f.turns || 1), sc: 1 - 0.2 * Math.sin(Math.PI * p) * Math.min(I, 1.5) }; },
    freezehit: (f, a, I) => ({ dx: 0, dy: 0, rot: 0, sc: 1 + 0.05 * I * Math.min(1, a * 14) }),
  };

  /* ---------- retoque de la imagen ya dibujada (la zona del plano) ---------- */
  function POST(fn, mode) {
    return (ctx, o, f, a, k) => {
      const R = regionOf(ctx, o); if (!R) return;
      const { x0, y0, w, h } = R, u = w / 1920, I = clamp(f.intensity == null ? 1 : f.intensity, 0.1, 3);
      const src = mk(10, w, h), sg = src.getContext('2d'); sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1; sg.filter = 'none'; sg.clearRect(0, 0, w, h); sg.drawImage(ctx.canvas, x0, y0, w, h, 0, 0, w, h);
      const res = mk(11, w, h), rg = res.getContext('2d'); rg.setTransform(1, 0, 0, 1, 0, 0); rg.globalCompositeOperation = 'source-over'; rg.globalAlpha = 1; rg.filter = 'none'; rg.imageSmoothingEnabled = true; rg.clearRect(0, 0, w, h);
      const al = fn({ src, sg, res, rg, w, h, u, I, f, a, k });
      rg.filter = 'none'; rg.globalCompositeOperation = 'source-over'; rg.globalAlpha = 1;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip(); ctx.globalAlpha = clamp(al == null ? k : al, 0, 1); if (mode) ctx.globalCompositeOperation = mode; ctx.drawImage(res, x0, y0); ctx.restore();
    };
  }
  /* promedio de copias desplazadas: desenfoque en una dirección */
  function dirBlur(rg, src, w, h, dx, dy, n) { for (let i = 0; i < n; i++) { const t = n > 1 ? i / (n - 1) - 0.5 : 0; rg.globalAlpha = 1 / (i + 1); rg.drawImage(src, dx * t, dy * t); } rg.globalAlpha = 1; }
  const rows = (rg, src, w, h, band, dxAt) => { for (let y = 0; y < h; y += band) rg.drawImage(src, 0, y, w, band, dxAt(y), y, w, band); };

  const POSTS = {
    whip: POST(({ src, rg, w, h, a, f, I }) => { const e = sm01(a / f.dur); dirBlur(rg, src, w, h, w * 0.12 * I * Math.pow(1 - e, 1.5) * (f.dir === 'r' ? -1 : 1), 0, 12); }),
    freezehit: POST(({ src, rg, w, h, a, k }) => { rg.filter = 'grayscale(1) contrast(1.9)'; rg.drawImage(src, 0, 0); rg.filter = 'none'; rg.fillStyle = '#fff'; rg.globalAlpha = Math.exp(-a * 12) * 0.85; rg.fillRect(0, 0, w, h); rg.globalAlpha = 1; return k * (0.35 + 0.65 * Math.min(1, a * 8)); }),
    silhouette: POST(({ src, sg, rg, w, h, f }) => { const im = sg.getImageData(0, 0, w, h), d = im.data, th = f.thresh == null ? 0.45 : f.thresh, c = hexN(f.color || '#0b0b10'); for (let i = 0; i < d.length; i += 4) { const l = lumAt(d, i) > th; d[i] = l ? 255 : c[0]; d[i + 1] = l ? 255 : c[1]; d[i + 2] = l ? 255 : c[2]; d[i + 3] = 255; } rg.putImageData(im, 0, 0); }),
    slash: POST(({ src, rg, w, h, a, f, I }) => {
      const p = clamp(a / f.dur, 0, 1), th = (((f.angle == null ? -25 : f.angle) * Math.PI) / 180), dx = Math.cos(th), dy = Math.sin(th), nx = -dy, ny = dx, L = Math.hypot(w, h), gap = (f.gap == null ? 0.12 : f.gap) * w * Math.sin(Math.PI * p) * Math.min(I, 1.6), cx = w / 2, cy = h / 2;
      rg.fillStyle = f.color || '#ffffff'; rg.fillRect(0, 0, w, h);
      [1, -1].forEach((s) => { rg.save(); rg.beginPath(); rg.moveTo(cx - dx * L, cy - dy * L); rg.lineTo(cx + dx * L, cy + dy * L); rg.lineTo(cx + dx * L + nx * L * s, cy + dy * L + ny * L * s); rg.lineTo(cx - dx * L + nx * L * s, cy - dy * L + ny * L * s); rg.closePath(); rg.clip(); rg.drawImage(src, nx * s * gap / 2, ny * s * gap / 2); rg.restore(); });
      rg.save(); rg.translate(cx, cy); rg.rotate(th); rg.fillStyle = 'rgba(255,255,255,' + Math.sin(Math.PI * p) * 0.9 + ')'; rg.fillRect(-L, -Math.max(1, gap * 0.04), L * 2, Math.max(2, gap * 0.08)); rg.restore();
    }),
    bloom: POST(({ src, rg, u, I, f }) => { rg.filter = 'blur(' + ((f.radius || 14) * u * Math.min(I, 2) * 1.2).toFixed(1) + 'px) brightness(1.25) contrast(1.2)'; rg.drawImage(src, 0, 0); }, 'screen'),
    heat: POST(({ src, rg, w, h, a, u, I, f }) => { const amp = 4 * u * I * (f.wave == null ? 1 : f.wave) * (w / 1000); rows(rg, src, w, h, Math.max(2, Math.round(2 * u)), (y) => Math.sin(y * 0.05 / Math.max(u, 0.3) + a * 5) * amp + Math.sin(y * 0.013 / Math.max(u, 0.3) + a * 2) * amp * 0.5); }),
    underwater: POST(({ src, rg, w, h, a, u, I, f }) => {
      const amp = 5 * u * I * (f.wave == null ? 1 : f.wave) * (w / 1000); rows(rg, src, w, h, Math.max(2, Math.round(2 * u)), (y) => Math.sin(y * 0.03 / Math.max(u, 0.3) + a * 1.6) * amp);
      rg.globalCompositeOperation = 'multiply'; rg.fillStyle = rgba(f.color || '#2aa6c8', 0.55); rg.fillRect(0, 0, w, h);
      rg.globalCompositeOperation = 'screen'; rg.strokeStyle = 'rgba(190,240,255,0.22)'; rg.lineWidth = 2 * u;
      for (let j = 0; j < 9; j++) { rg.beginPath(); for (let x = 0; x <= w; x += 12) { const y = ((j + 0.5) / 9) * h + Math.sin(x * 0.012 / Math.max(u, 0.3) + a * 1.4 + j * 2) * h * 0.03 + Math.sin(x * 0.03 / Math.max(u, 0.3) - a * 2 + j) * h * 0.012; x ? rg.lineTo(x, y) : rg.moveTo(x, y); } rg.stroke(); }
      rg.globalCompositeOperation = 'source-over'; rg.strokeStyle = 'rgba(255,255,255,0.45)'; rg.lineWidth = 1.5 * u;
      for (let i = 0; i < 16; i++) { const life = wrap1(a * 0.1 * (0.6 + nz(i)) + nz(i * 3)), x = (nz(i * 7) + Math.sin(a + i) * 0.015) * w, y = h * (1.05 - life * 1.15), r = (3 + nz(i * 5) * 9) * u; rg.beginPath(); rg.arc(x, y, r, 0, TAU); rg.stroke(); }
    }),
    selective: POST(({ sg, rg, w, h, f }) => {
      const im = sg.getImageData(0, 0, w, h), d = im.data, c = hexN(f.color || '#e5333d'), th = hueOf(c[0], c[1], c[2]), tol = f.tol == null ? 0.12 : f.tol;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0, hu = hueOf(r, g, b), dh = Math.min(Math.abs(hu - th), 1 - Math.abs(hu - th)), keep = s < 0.12 ? 0 : clamp(1 - (dh - tol * 0.6) / (tol * 0.5), 0, 1), gr = 0.299 * r + 0.587 * g + 0.114 * b;
        d[i] = gr + (r - gr) * keep; d[i + 1] = gr + (g - gr) * keep; d[i + 2] = gr + (b - gr) * keep;
      }
      rg.putImageData(im, 0, 0);
    }),
    oldfilm: POST(({ src, rg, w, h, a, u, I, f }) => {
      const fr = Math.floor(a * 12), fl = 0.92 + nz(fr * 7) * 0.16;
      rg.filter = 'sepia(0.85) contrast(1.15) brightness(' + fl.toFixed(2) + ')'; rg.drawImage(src, 0, 0); rg.filter = 'none';
      rg.fillStyle = rgba(f.color || '#c9a46a', 0.14); rg.fillRect(0, 0, w, h);
      const g = rg.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + 0.5 * Math.min(I, 1.5) + ')'); rg.fillStyle = g; rg.fillRect(0, 0, w, h);
      rg.strokeStyle = 'rgba(255,255,240,0.45)'; rg.lineWidth = Math.max(1, u * 1.2);
      for (let i = 0; i < 3 + Math.round(3 * I); i++) { if (nz(fr * 17 + i) < 0.4) continue; const x = nz(fr * 13 + i * 5) * w, y0 = nz(fr * 3 + i) * h * 0.4, len = (0.25 + nz(fr + i * 9) * 0.6) * h; rg.beginPath(); rg.moveTo(x, y0); rg.lineTo(x + (nz(i + fr) - 0.5) * 6 * u, y0 + len); rg.stroke(); }
      for (let i = 0; i < 18 * I; i++) { rg.fillStyle = nz(fr * 31 + i) > 0.5 ? 'rgba(20,10,0,0.5)' : 'rgba(255,255,240,0.5)'; rg.beginPath(); rg.arc(nz(fr * 11 + i * 3) * w, nz(fr * 19 + i * 7) * h, (0.8 + nz(i + fr) * 2.4) * u, 0, TAU); rg.fill(); }
    }),
    motionblur: POST(({ src, rg, w, h, f, I }) => { const ang = (((f.angle || 0) * Math.PI) / 180), L = (f.amount == null ? 0.05 : f.amount) * w * I; dirBlur(rg, src, w, h, Math.cos(ang) * L, Math.sin(ang) * L, 14); }),
    radialblur: POST(({ src, rg, w, h, f, I }) => { const n = 14, am = (f.amount == null ? 0.07 : f.amount) * I; for (let i = 0; i < n; i++) { const s = 1 + (i / (n - 1) - 0.4) * am; rg.globalAlpha = 1 / (i + 1); rg.save(); rg.translate(w / 2, h / 2); rg.scale(s, s); rg.drawImage(src, -w / 2, -h / 2); rg.restore(); } rg.globalAlpha = 1; }),
    kaleido: POST(({ src, rg, w, h, a, f }) => {
      const n = clamp(Math.round(f.seg || 6), 3, 12), R = Math.hypot(w, h) / 2 + 4, zs = Math.max(1, R / (Math.min(w, h) / 2)) + 0.05;
      for (let i = 0; i < n; i++) { rg.save(); rg.translate(w / 2, h / 2); rg.rotate((i * TAU) / n + a * 0.15); rg.beginPath(); rg.moveTo(0, 0); rg.lineTo(R * Math.cos(-Math.PI / n), R * Math.sin(-Math.PI / n)); rg.arc(0, 0, R, -Math.PI / n, Math.PI / n); rg.closePath(); rg.clip(); if (i % 2) rg.scale(1, -1); rg.scale(zs, zs); rg.drawImage(src, -w / 2, -h / 2); rg.restore(); }
    }),
    neon: POST(({ src, rg, w, h, u, I, f }) => {
      const sw = clamp(Math.round(w / 1.6), 160, 900), sh = Math.max(2, Math.round((sw * h) / w)), sm = mk(12, sw, sh), mg = sm.getContext('2d'); mg.setTransform(1, 0, 0, 1, 0, 0); mg.filter = 'none'; mg.imageSmoothingEnabled = true; mg.clearRect(0, 0, sw, sh); mg.drawImage(src, 0, 0, sw, sh);
      const im = mg.getImageData(0, 0, sw, sh), d = im.data, L = new Float32Array(sw * sh); for (let i = 0, j = 0; i < d.length; i += 4, j++) L[j] = lumAt(d, i);
      const col = hexN(f.color || '#00e5ff'), ed = mg.createImageData(sw, sh), e = ed.data;
      for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) { const j = y * sw + x, gx = -L[j - sw - 1] - 2 * L[j - 1] - L[j + sw - 1] + L[j - sw + 1] + 2 * L[j + 1] + L[j + sw + 1], gy = -L[j - sw - 1] - 2 * L[j - sw] - L[j - sw + 1] + L[j + sw - 1] + 2 * L[j + sw] + L[j + sw + 1], g = clamp((Math.sqrt(gx * gx + gy * gy) - 0.18) * 3.2 * I, 0, 1), q = j * 4; e[q] = col[0]; e[q + 1] = col[1]; e[q + 2] = col[2]; e[q + 3] = g * 255; }
      mg.putImageData(ed, 0, 0);
      rg.fillStyle = '#05060c'; rg.fillRect(0, 0, w, h); rg.globalAlpha = 0.22; rg.drawImage(src, 0, 0); rg.globalAlpha = 1;
      rg.globalCompositeOperation = 'lighter'; const gl = f.glow == null ? 0.7 : f.glow;
      if (gl > 0) { rg.filter = 'blur(' + (8 * u + 2).toFixed(1) + 'px)'; rg.globalAlpha = gl; rg.drawImage(sm, 0, 0, sw, sh, 0, 0, w, h); rg.globalAlpha = 1; rg.filter = 'none'; }
      rg.drawImage(sm, 0, 0, sw, sh, 0, 0, w, h);
    }),
    sketch: POST(({ src, rg, w, h, u, f }) => {
      const t2 = mk(12, w, h), tg = t2.getContext('2d'); tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalAlpha = 1; tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, w, h);
      tg.filter = 'grayscale(1) invert(1) blur(' + (((f.line == null ? 4 : f.line) * u * 1.4) + 0.5).toFixed(1) + 'px)'; tg.drawImage(src, 0, 0); tg.filter = 'none';
      rg.filter = 'grayscale(1)'; rg.drawImage(src, 0, 0); rg.filter = 'none'; rg.globalCompositeOperation = 'color-dodge'; rg.drawImage(t2, 0, 0);
      rg.globalCompositeOperation = 'multiply'; rg.fillStyle = f.color || '#f4efe2'; rg.fillRect(0, 0, w, h);
    }),
  };
  function hueOf(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; let hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh /= 6; return hh < 0 ? hh + 1 : hh; }

  /* ---------- dibujados encima (en unidades del proyecto) ---------- */
  const star4 = (ctx, x, y, r, rot) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.beginPath(); for (let i = 0; i < 4; i++) { const an = (i * Math.PI) / 2; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); ctx.lineTo(Math.cos(an + Math.PI / 4) * r * 0.22, Math.sin(an + Math.PI / 4) * r * 0.22); } ctx.closePath(); ctx.fill(); ctx.restore(); };
  const DRAWS = {
    onomato(ctx, o, f, a, k) {
      const { W, H } = o, p = clamp(a / 0.28, 0, 1), sz = Math.min(H * 0.17, W * 0.28) * (f.scale || 1) * Math.min(1.5, f.intensity || 1), sc = 0.3 + 0.7 * backOut(p), fr = Math.floor(a * 18), rot = ((nz(fr) - 0.5) * 6 + (nz(7) - 0.5) * 8) * (Math.PI / 180);
      ctx.save(); ctx.globalAlpha = k; ctx.translate(W / 2 + (f.x || 0) * W + (nz(fr + 3) - 0.5) * W * 0.004, H / 2 + (f.y == null ? -0.12 : f.y) * H); ctx.rotate(rot); ctx.scale(sc, sc); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.font = '900 ' + sz + 'px "Bangers","Impact","Arial Black",sans-serif'; const txt = String(f.text == null ? '¡BOOM!' : f.text) || ' ';
      ctx.fillStyle = '#14141c'; ctx.fillText(txt, sz * 0.06, sz * 0.07); ctx.lineWidth = sz * 0.16; ctx.strokeStyle = '#14141c'; ctx.strokeText(txt, 0, 0);
      ctx.lineWidth = sz * 0.07; ctx.strokeStyle = '#ffffff'; ctx.strokeText(txt, 0, 0); ctx.fillStyle = f.color || '#ffd400'; ctx.fillText(txt, 0, 0); ctx.restore();
    },
    burst(ctx, o, f, a, k) {
      const { W, H } = o, p = clamp(a / f.dur, 0, 1), R = Math.hypot(W, H) / 2, n = clamp(Math.round(f.rays || 24), 6, 60), r1 = R * (0.12 + 0.95 * (1 - Math.pow(1 - p, 3))), r0 = Math.min(W, H) * 0.06 * (1 - p * 0.5);
      ctx.save(); ctx.globalAlpha = k * Math.pow(1 - p, 0.7); ctx.translate(W / 2, H / 2); ctx.fillStyle = f.color || '#ff3d6e';
      for (let i = 0; i < n; i++) { const an = (i / n) * TAU + (nz(i) - 0.5) * 0.12 + a * 0.2, w = (Math.PI / n) * (0.35 + nz(i + 7) * 0.5), rr = r1 * (0.65 + nz(i + 13) * 0.5); ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an - w) * rr, Math.sin(an - w) * rr); ctx.lineTo(Math.cos(an + w) * rr, Math.sin(an + w) * rr); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    },
    emote(ctx, o, f, a, k) {
      const { W, H } = o, s = H * 0.1 * (f.scale || 1) * Math.min(1.6, f.intensity || 1), p = clamp(a / 0.22, 0, 1), sc = 0.2 + 0.8 * backOut(p), bob = Math.sin(a * 6) * s * 0.06, sym = f.symbol || 'exclaim', col = f.color || '#ff3d6e';
      ctx.save(); ctx.globalAlpha = k; ctx.translate(W / 2 + (f.x == null ? 0.22 : f.x) * W, H / 2 + (f.y == null ? -0.3 : f.y) * H + bob); ctx.scale(sc, sc); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const outline = () => { ctx.lineWidth = s * 0.16; ctx.strokeStyle = '#14141c'; };
      if (sym === 'exclaim' || sym === 'question') { const t2 = sym === 'exclaim' ? '!' : '?'; ctx.font = '900 ' + s * 1.9 + 'px "Bangers","Impact","Arial Black",sans-serif'; outline(); ctx.strokeText(t2, 0, 0); ctx.lineWidth = s * 0.05; ctx.strokeStyle = '#fff'; ctx.strokeText(t2, 0, 0); ctx.fillStyle = col; ctx.fillText(t2, 0, 0); }
      else if (sym === 'sweat') { ctx.beginPath(); ctx.moveTo(0, -s); ctx.bezierCurveTo(s * 0.9, -s * 0.1, s * 0.7, s * 0.9, 0, s * 0.9); ctx.bezierCurveTo(-s * 0.7, s * 0.9, -s * 0.9, -s * 0.1, 0, -s); ctx.closePath(); outline(); ctx.stroke(); ctx.fillStyle = '#8fd3ff'; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-s * 0.22, s * 0.15, s * 0.09, s * 0.22, 0.3, 0, TAU); ctx.fill(); }
      else if (sym === 'anger') { ctx.strokeStyle = '#14141c'; ctx.lineWidth = s * 0.34; for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate((i * Math.PI) / 2 + Math.PI / 4); ctx.beginPath(); ctx.arc(s * 0.62, 0, s * 0.42, Math.PI * 0.55, Math.PI * 1.45); ctx.stroke(); ctx.restore(); } ctx.strokeStyle = '#e5333d'; ctx.lineWidth = s * 0.2; for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate((i * Math.PI) / 2 + Math.PI / 4); ctx.beginPath(); ctx.arc(s * 0.62, 0, s * 0.42, Math.PI * 0.55, Math.PI * 1.45); ctx.stroke(); ctx.restore(); } }
      else if (sym === 'heart') { ctx.beginPath(); ctx.moveTo(0, s * 0.8); ctx.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.5, -s * 1.1, 0, -s * 0.35); ctx.bezierCurveTo(s * 0.5, -s * 1.1, s * 1.4, -s * 0.1, 0, s * 0.8); ctx.closePath(); outline(); ctx.stroke(); ctx.fillStyle = col; ctx.fill(); }
      else if (sym === 'star') { ctx.beginPath(); for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? s * 0.42 : s * 1.05; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); outline(); ctx.stroke(); ctx.fillStyle = '#ffd400'; ctx.fill(); }
      else { for (let i = 0; i < 3; i++) { const on = Math.floor(a * 3) % 4 > i; ctx.globalAlpha = k * (on ? 1 : 0.25); ctx.beginPath(); ctx.arc((i - 1) * s * 0.7, 0, s * 0.2, 0, TAU); ctx.fillStyle = '#14141c'; ctx.fill(); } }
      ctx.restore();
    },
    ink(ctx, o, f, a, k) {
      const { W, H } = o, p = clamp(a / f.dur, 0, 1), e = 1 - Math.pow(1 - Math.min(1, p * 1.6), 3), n = clamp(Math.round(f.blobs || 7), 2, 16), R = Math.max(W, H) * 0.42;
      ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = f.color || '#0b0b10';
      for (let i = 0; i < n; i++) {
        const edge = Math.floor(nz(i * 5) * 4), t2 = nz(i * 3), cx = edge === 0 ? t2 * W : edge === 1 ? W * 1.02 : edge === 2 ? t2 * W : -W * 0.02, cy = edge === 0 ? -H * 0.02 : edge === 1 ? t2 * H : edge === 2 ? H * 1.02 : t2 * H, r = R * e * (0.45 + nz(i * 9) * 0.7);
        ctx.beginPath(); for (let j = 0; j <= 28; j++) { const an = (j / 28) * TAU, rr = r * (1 + 0.16 * Math.sin(an * 3 + i) + 0.1 * Math.sin(an * 7 + i * 2 + a * 1.5)); j ? ctx.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr) : ctx.moveTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); } ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    },
    tension(ctx, o, f, a, k) {
      const { W, H } = o, cell = (f.cell || 46) * (W / 1920) * (f.scale || 1), I = Math.min(2, f.intensity || 1), cx = W / 2, cy = H / 2;
      ctx.save(); ctx.fillStyle = f.color || '#111111'; ctx.globalAlpha = k;
      for (let y = cell / 2; y < H; y += cell) for (let x = cell / 2 + (Math.floor(y / cell) % 2) * (cell / 2); x < W; x += cell) { const d = Math.hypot((x - cx) / W, (y - cy) / H) * 1.5, r = cell * 0.62 * sm01((d - 0.42) / 0.5) * I * (1 + 0.08 * Math.sin(a * 9 + x * 0.01)); if (r > 0.5) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } }
      ctx.restore();
    },
    lensflare(ctx, o, f, a, k) {
      const { W, H } = o, p = clamp(a / f.dur, 0, 1), I = Math.min(2, f.intensity || 1), lx = ((f.x == null ? 0.2 : f.x) + 0.18 * p) * W, ly = H * (0.22 + 0.06 * Math.sin(p * 3)), cx = W / 2, cy = H / 2, col = f.color || '#ffd9a0', R = Math.min(W, H);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = k * Math.sin(Math.PI * Math.min(1, p * 1.05));
      let g = ctx.createRadialGradient(lx, ly, 0, lx, ly, R * 0.33 * I); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.18, rgba(col, 0.55)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(lx, ly); ctx.scale(1, 0.05); g = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.6); g.addColorStop(0, rgba(col, 0.8)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, W * 0.6, 0, TAU); ctx.fill(); ctx.restore();
      [[-0.35, 0.05, '#a0d0ff'], [0.35, 0.09, '#ffd0a0'], [0.8, 0.045, '#c0ffc0'], [1.25, 0.12, '#ffa0d0'], [1.6, 0.06, '#a0c0ff']].forEach((q) => { const gx = lx + (cx - lx) * (q[0] + 1) * 0.55, gy = ly + (cy - ly) * (q[0] + 1) * 0.55, r = R * q[1] * I; const gg = ctx.createRadialGradient(gx, gy, r * 0.3, gx, gy, r); gg.addColorStop(0, rgba(q[2], 0)); gg.addColorStop(0.8, rgba(q[2], 0.28)); gg.addColorStop(1, rgba(q[2], 0)); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, gy, r, 0, TAU); ctx.fill(); });
      ctx.restore();
    },
    flicker(ctx, o, f, a, k) {
      const { W, H } = o, I = Math.min(2, f.intensity || 1), fr = a * 14, n1 = nz(Math.floor(fr)), n2 = nz(Math.floor(fr) + 1), n = n1 + (n2 - n1) * (fr - Math.floor(fr)), warm = f.color || '#ffa040';
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = k * (0.08 + 0.16 * n) * I; ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over'; const g = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * (0.22 + 0.06 * n), W / 2, H * 0.55, Math.hypot(W, H) * 0.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,4,0,' + (0.55 + 0.2 * (1 - n)) * Math.min(1, I) + ')'); ctx.globalAlpha = k; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    },
    lightning(ctx, o, f, a, k) {
      const { W, H } = o, T = f.dur, hits = [0.1, 0.3, 0.55].map((x) => (x * T) / 0.8 * 0.8), I = Math.min(2, f.intensity || 1); let fl = 0, hi = -1;
      hits.forEach((h0, i) => { if (a >= h0) { const v = Math.exp(-(a - h0) * 13); if (v > fl) { fl = v; hi = i; } } });
      if (fl < 0.02) return;
      ctx.save(); ctx.globalAlpha = k * clamp(fl * 0.8 * I, 0, 1); ctx.fillStyle = '#f2f6ff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = k * clamp(fl * 1.6, 0, 1);
      const x0 = (0.25 + 0.5 * nz(hi * 31 + 5)) * W, bolt = (x, y, ang, len, w, d) => { ctx.beginPath(); ctx.moveTo(x, y); let cx = x, cy = y; const segs = 12; for (let i = 0; i < segs; i++) { cx += Math.sin(ang) * (len / segs) + (nz(hi * 97 + d * 13 + i) - 0.5) * W * 0.05; cy += Math.cos(ang) * (len / segs); ctx.lineTo(cx, cy); if (d < 2 && i > 3 && nz(hi * 53 + i + d * 5) > 0.82) bolt(cx, cy, ang + (nz(i + hi) - 0.5) * 1.4, len * 0.45, w * 0.6, d + 1); } ctx.lineWidth = w; ctx.stroke(); };
      ctx.strokeStyle = f.color || '#cfe4ff'; ctx.shadowColor = f.color || '#9cc4ff'; ctx.shadowBlur = W * 0.02; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.save(); ctx.lineWidth = W * 0.004; bolt(x0, -H * 0.02, (nz(hi * 7) - 0.5) * 0.3, H * 0.85, W * 0.004 * I, 0); ctx.restore(); ctx.restore();
    },
    embers(ctx, o, f, a, k) {
      const { W, H } = o, n = Math.round(60 * Math.min(2.5, f.intensity || 1)), u = W / 1920, sc = f.scale || 1, col = f.color || '#ff8a2a';
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) { const life = wrap1(a * 0.22 * (0.5 + nz(i)) + nz(i * 3)), x = (nz(i * 7) + Math.sin(a * 1.4 + i) * 0.03 + life * 0.05) * W, y = H * (1.05 - life * 1.2), r = (5 + nz(i * 5) * 10) * u * sc * (1 - life * 0.6), fl = 0.55 + 0.45 * Math.sin(a * 9 + i * 3); const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, rgba('#fff0c0', 0.9 * fl * k)); g.addColorStop(0.3, rgba(col, 0.6 * fl * k * (1 - life * 0.5))); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill(); }
      ctx.restore();
    },
    petals(ctx, o, f, a, k) {
      const { W, H } = o, n = Math.round(26 * Math.min(2.5, f.intensity || 1)), u = W / 1920, sc = f.scale || 1, kind = f.kind || 'petal', cols = kind === 'petal' ? ['#ffb7d0', '#ff9ec0', '#ffd0e0'] : kind === 'leaf' ? ['#7fb04a', '#5f9a3a', '#a0c860'] : ['#e07b2a', '#c4511f', '#e8a63a'];
      ctx.save(); ctx.globalAlpha = k;
      for (let i = 0; i < n; i++) {
        const y = wrap1(nz(i * 5) + a * 0.09 * (0.6 + nz(i))), x = nz(i) + Math.sin(a * 1.2 + i) * 0.06 + y * 0.12, r = (14 + nz(i * 3) * 14) * u * sc, rot = a * (1 + nz(i + 4)) * 1.6 + i, flip = Math.cos(a * 2 + i * 1.7);
        ctx.save(); ctx.translate(wrap1(x) * W, y * H * 1.1 - H * 0.05); ctx.rotate(rot); ctx.scale(Math.abs(flip) * 0.8 + 0.2, 1); ctx.fillStyle = cols[i % 3];
        if (kind === 'petal') { ctx.beginPath(); ctx.moveTo(0, -r); ctx.bezierCurveTo(r * 0.9, -r * 0.5, r * 0.7, r * 0.7, 0, r); ctx.bezierCurveTo(-r * 0.7, r * 0.7, -r * 0.9, -r * 0.5, 0, -r); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.8, 0, 0, r); ctx.quadraticCurveTo(-r * 0.8, 0, 0, -r); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = Math.max(1, u * 1.2); ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke(); }
        ctx.restore();
      }
      ctx.restore();
    },
    magic(ctx, o, f, a, k) {
      const { W, H } = o, n = Math.round(30 * Math.min(2.5, f.intensity || 1)), u = W / 1920, sc = f.scale || 1, col = f.color || '#fff3a0';
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = col; ctx.shadowBlur = 14 * u;
      for (let i = 0; i < n; i++) { const p = wrap1(a * 0.9 * (0.6 + nz(i + 2)) + nz(i)), tw = Math.pow(Math.sin(Math.PI * p), 2), r = (10 + nz(i * 5) * 26) * u * sc * tw; if (r < 0.8) continue; ctx.globalAlpha = k * tw; ctx.fillStyle = i % 4 === 0 ? '#ffffff' : col; star4(ctx, (nz(i * 3) + Math.sin(a * 0.6 + i) * 0.01) * W, (nz(i * 7) + Math.cos(a * 0.5 + i) * 0.01) * H, r, a * 0.6 + i); }
      ctx.restore();
    },
    spotlight(ctx, o, f, a, k) {
      const { W, H } = o, cx = (0.5 + 0.28 * Math.sin(a * 0.9 + (f.seed || 0))) * W, cy = (0.5 + 0.18 * Math.sin(a * 1.3 + 1)) * H, r = Math.min(W, H) * 0.3 * (f.scale || 1) / Math.max(0.6, Math.sqrt(f.intensity || 1)), c = f.color || '#000000';
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.5); g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.55, rgba(c, 0.04)); g.addColorStop(1, rgba(c, 0.9));
      ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    },
  };

  /* ---------- registro ---------- */
  /* retoques de imagen (menos «Latigazo» y «Pausa de impacto», que mueven la cámara y se tratan como animación) */
  const STYLE_SET = new Set(Object.keys(POSTS).filter((v) => v !== 'whip' && v !== 'freezehit'));
  MC.FX2 = { list: LIST, groups: GROUPS, params: PARAMS, kindOf, defaults, colored: COLORED, heavy: HEAVY, anim: ANIM, post: POSTS, draw: DRAWS, styleSet: STYLE_SET, has: (v) => !!(POSTS[v] || DRAWS[v]) };
  LIST.forEach((d) => { if (!MC.FX.find((x) => x.v === d.v)) MC.FX.push(d); });
})();
