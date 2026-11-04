/* Viñetas y transiciones.
   - Contenedor de viñeta: cada plano vive dentro de un marco (calle, fondo, forma, trazo, sombra) como en una página de cómic.
   - Capas «por encima del borde»: ilustraciones que rompen la viñeta y se superponen al trazo y a la calle.
   - Transiciones: catálogo ampliado con dirección, color, curva y distancia. Las usa renderBase, así que visor y exportación coinciden. */
(function () {
  const MC = window.MC;
  const { clamp, lerp } = MC;
  const noise = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  /* ---------- contenedor de viñeta ---------- */
  MC.FRAME_SHAPES = [
    { v: 'rect', es: 'Recta', en: 'Square' }, { v: 'slant', es: 'Inclinada', en: 'Slanted' }, { v: 'slantr', es: 'Inclinada ↘', en: 'Slanted ↘' },
    { v: 'diag', es: 'Romboide', en: 'Parallelogram' }, { v: 'trap', es: 'Trapecio', en: 'Trapezoid' }, { v: 'tilt', es: 'Girada', en: 'Tilted' },
    { v: 'burst', es: 'Estallido', en: 'Burst' }, { v: 'wave', es: 'Recuerdo', en: 'Flashback' }, { v: 'circle', es: 'Óvalo', en: 'Oval' },
  ];
  MC.FRAME_STROKES = [
    { v: 'solid', es: 'Línea', en: 'Solid' }, { v: 'ink', es: 'Tinta', en: 'Ink' }, { v: 'sketch', es: 'Boceto', en: 'Sketch' },
    { v: 'double', es: 'Doble', en: 'Double' }, { v: 'dashed', es: 'Discontinua', en: 'Dashed' }, { v: 'none', es: 'Sin trazo', en: 'No stroke' },
  ];
  MC.FRAME_BGS = [
    { v: 'plain', es: 'Liso', en: 'Plain' }, { v: 'halftone', es: 'Trama', en: 'Halftone' }, { v: 'paper', es: 'Papel', en: 'Paper' },
    { v: 'hatch', es: 'Rayado', en: 'Hatching' }, { v: 'speed', es: 'Líneas de acción', en: 'Speed lines' },
  ];
  MC.FRAME_PRESETS = [
    { v: 'classic', es: 'Cómic clásico', en: 'Classic comic', f: { gutter: 0.035, bg: '#ffffff', pattern: 'plain', width: 0.006, color: '#111111', style: 'solid', shape: 'rect', shadow: 0 } },
    { v: 'manga', es: 'Manga', en: 'Manga', f: { gutter: 0.028, bg: '#ffffff', pattern: 'plain', width: 0.0035, color: '#000000', style: 'solid', shape: 'rect', shadow: 0 } },
    { v: 'noir', es: 'Noir', en: 'Noir', f: { gutter: 0.04, bg: '#0b0b0c', pattern: 'plain', width: 0.003, color: '#f2f2f2', style: 'solid', shape: 'rect', shadow: 0 } },
    { v: 'ink', es: 'Tinta a mano', en: 'Hand ink', f: { gutter: 0.04, bg: '#fbf7ee', pattern: 'paper', patColor: '#d9cfb8', width: 0.008, color: '#141210', style: 'ink', shape: 'rect', shadow: 0 } },
    { v: 'pop', es: 'Pop', en: 'Pop', f: { gutter: 0.05, bg: '#ffd84a', pattern: 'halftone', patColor: '#f0a400', width: 0.01, color: '#111111', style: 'solid', shape: 'rect', shadow: 0.6, shadowColor: '#111111' } },
    { v: 'action', es: 'Acción', en: 'Action', f: { gutter: 0.05, bg: '#ffffff', pattern: 'speed', patColor: '#1a1a1a', width: 0.009, color: '#111111', style: 'solid', shape: 'slant', amount: 0.6, shadow: 0 } },
    { v: 'flash', es: 'Recuerdo', en: 'Flashback', f: { gutter: 0.05, bg: '#e9e6df', pattern: 'paper', patColor: '#cbc5b8', width: 0.004, color: '#6b665c', style: 'dashed', shape: 'wave', amount: 0.6, shadow: 0 } },
    { v: 'sketch', es: 'Boceto', en: 'Sketch', f: { gutter: 0.04, bg: '#ffffff', pattern: 'hatch', patColor: '#e3e3e3', width: 0.004, color: '#2a2a2a', style: 'sketch', shape: 'rect', shadow: 0 } },
    { v: 'none', es: 'Sin viñeta', en: 'No panel', f: { gutter: 0, width: 0, style: 'none', shape: 'rect', shadow: 0, pattern: 'plain' } },
  ];

  /* Marco efectivo de un plano: el del plano si lo personaliza; si no, el del proyecto. */
  MC.frameOf = (project, shot) => {
    const base = Object.assign({}, MC.FRAME_DEF, project && (project.frame || { on: (project.mode || 'free') === 'free' }));
    const f = shot && shot.frame ? Object.assign(base, shot.frame) : base;
    return f.on === false ? null : f;
  };
  const mapPts = (pts, f) => pts.map((q) => f(q[0], q[1]));
  /* Geometría de la viñeta en el lienzo: polígono, caja y transformación del contenido para que el plano quepa sin deformarse. */
  MC.panelGeom = (f, W, H) => {
    const m = Math.min(W, H), g = clamp(f.gutter || 0, 0, 0.3) * m, a = clamp(f.amount == null ? 0.5 : f.amount, 0, 1);
    const x0 = g, y0 = g, x1 = W - g, y1 = H - g, bw = x1 - x0, bh = y1 - y0, cx = W / 2, cy = H / 2;
    let poly;
    switch (f.shape) {
      case 'slant': { const d = a * 0.16 * bh; poly = [[x0, y0 + d], [x1, y0], [x1, y1 - d], [x0, y1]]; break; }
      case 'slantr': { const d = a * 0.16 * bh; poly = [[x0, y0], [x1, y0 + d], [x1, y1], [x0, y1 - d]]; break; }
      case 'diag': { const d = a * 0.14 * bw; poly = [[x0 + d, y0], [x1, y0], [x1 - d, y1], [x0, y1]]; break; }
      case 'trap': { const d = a * 0.12 * bw; poly = [[x0 + d, y0], [x1 - d, y0], [x1, y1], [x0, y1]]; break; }
      case 'tilt': {
        const r = ((a - 0.5) * 2 * 5 * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
        const k = Math.min(bw / (Math.abs(bw * c) + Math.abs(bh * s)), bh / (Math.abs(bw * s) + Math.abs(bh * c)));
        poly = mapPts([[-bw / 2, -bh / 2], [bw / 2, -bh / 2], [bw / 2, bh / 2], [-bw / 2, bh / 2]], (x, y) => [cx + (x * c - y * s) * k, cy + (x * s + y * c) * k]);
        break;
      }
      case 'burst': {
        const n = 34, rx = bw / 2, ry = bh / 2, inner = 1 - 0.07 - 0.12 * a; poly = [];
        for (let i = 0; i < n * 2; i++) { const th = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? inner - 0.04 * noise(i) : 1 - 0.03 * noise(i + 9); poly.push([cx + Math.cos(th) * rx * rr, cy + Math.sin(th) * ry * rr]); }
        break;
      }
      case 'wave': {
        poly = []; const per = 2 * (bw + bh), bumps = Math.max(10, Math.round(per / (m * (0.09 - a * 0.04)))), N = bumps * 10, amp = m * (0.012 + 0.012 * a);
        for (let i = 0; i < N; i++) {
          let s = (i / N) * per, x, y, nx, ny;
          if (s < bw) { x = x0 + s; y = y0; nx = 0; ny = 1; } else if ((s -= bw) < bh) { x = x1; y = y0 + s; nx = -1; ny = 0; } else if ((s -= bh) < bw) { x = x1 - s; y = y1; nx = 0; ny = -1; } else { s -= bw; x = x0; y = y1 - s; nx = 1; ny = 0; }
          const k = Math.abs(Math.sin(((i / N) * bumps) * Math.PI)) * amp;
          poly.push([x + nx * (amp - k), y + ny * (amp - k)]);
        }
        break;
      }
      case 'circle': { poly = []; for (let i = 0; i < 96; i++) { const th = (i / 96) * Math.PI * 2; poly.push([cx + Math.cos(th) * bw / 2, cy + Math.sin(th) * bh / 2]); } break; }
      default: poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    }
    let px0 = Infinity, py0 = Infinity, px1 = -Infinity, py1 = -Infinity;
    poly.forEach((q) => { px0 = Math.min(px0, q[0]); py0 = Math.min(py0, q[1]); px1 = Math.max(px1, q[0]); py1 = Math.max(py1, q[1]); });
    const s = Math.max((px1 - px0) / W, (py1 - py0) / H) || 1;
    return { poly, x0: px0, y0: py0, x1: px1, y1: py1, s, ox: (px0 + px1) / 2 - (W * s) / 2, oy: (py0 + py1) / 2 - (H * s) / 2, g };
  };
  MC.panelXf = (project, shot, W, H) => { const f = MC.frameOf(project, shot); return f ? MC.panelGeom(f, W, H) : null; };
  const pathPoly = (ctx, poly) => { ctx.beginPath(); poly.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); };
  MC.pathPoly = pathPoly;

  /* Lienzos auxiliares reutilizables */
  const pool = {};
  const canvasOf = (key, W, H) => {
    key += W + 'x' + H;
    let c = pool[key];
    if (!c) { if (Object.keys(pool).length > 12) Object.keys(pool).forEach((k) => delete pool[k]); c = pool[key] = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : document.createElement('canvas'); }
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    return { c, g };
  };

  /* Fondo de la calle (color + textura), cacheado por tamaño y ajustes */
  const bgCache = new Map();
  MC.drawPanelBg = (ctx, f, W, H) => {
    const key = [W, H, f.bg, f.pattern, f.patColor].join('|');
    let c = bgCache.get(key);
    if (!c) {
      if (bgCache.size > 24) bgCache.clear();
      c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'), m = Math.min(W, H), pc = f.patColor || '#000000';
      g.fillStyle = f.bg || '#ffffff'; g.fillRect(0, 0, W, H);
      g.fillStyle = pc; g.strokeStyle = pc;
      if (f.pattern === 'halftone') {
        const st = m / 70, rot = Math.PI / 4, d = Math.hypot(W, H);
        g.save(); g.translate(W / 2, H / 2); g.rotate(rot);
        for (let y = -d / 2; y < d / 2; y += st) for (let x = -d / 2; x < d / 2; x += st) { g.beginPath(); g.arc(x, y, st * 0.28, 0, Math.PI * 2); g.fill(); }
        g.restore();
      } else if (f.pattern === 'paper') {
        const n = Math.round((W * H) / 900);
        for (let i = 0; i < n; i++) { g.globalAlpha = 0.15 + 0.35 * noise(i * 3 + 1); g.fillRect(noise(i * 7) * W, noise(i * 11 + 5) * H, 1 + noise(i) * m / 700, 1 + noise(i + 2) * m / 700); }
        g.globalAlpha = 1;
      } else if (f.pattern === 'hatch') {
        g.lineWidth = Math.max(1, m / 600); const st = m / 60;
        for (let x = -H; x < W; x += st) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); }
      } else if (f.pattern === 'speed') {
        const cx = W / 2, cy = H / 2, R = Math.hypot(W, H);
        for (let i = 0; i < 160; i++) {
          const a = (i / 160) * Math.PI * 2 + noise(i) * 0.03, w = (0.002 + noise(i + 40) * 0.006) * Math.PI;
          const r0 = R * (0.18 + noise(i + 80) * 0.18);
          g.beginPath(); g.moveTo(cx + Math.cos(a - w) * R, cy + Math.sin(a - w) * R); g.lineTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a + w) * R, cy + Math.sin(a + w) * R); g.closePath(); g.fill();
        }
      }
      bgCache.set(key, c);
    }
    ctx.drawImage(c, 0, 0, W, H);
  };

  /* Trazo del contenedor */
  const shrink = (poly, d) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    poly.forEach((q) => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, kx = Math.max(0, 1 - (2 * d) / (x1 - x0)), ky = Math.max(0, 1 - (2 * d) / (y1 - y0));
    return poly.map((q) => [cx + (q[0] - cx) * kx, cy + (q[1] - cy) * ky]);
  };
  const handLine = (ctx, poly, w, seed, jit, over, varW) => {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.5) continue;
      const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len, nx = -uy, ny = ux, ext = n <= 8 ? over : 0;
      const steps = Math.max(2, Math.round(len / (w * 6)));
      ctx.beginPath();
      for (let k = 0; k <= steps; k++) {
        const tt = k / steps, d = -ext + tt * (len + ext * 2), j = (noise(seed + i * 31 + k) - 0.5) * jit;
        const x = a[0] + ux * d + nx * j, y = a[1] + uy * d + ny * j;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.lineWidth = varW ? w * (0.7 + 0.6 * noise(seed + i * 7)) : w;
      ctx.stroke();
    }
  };
  MC.drawPanelStroke = (ctx, f, pan, W, H) => {
    const m = Math.min(W, H), w = clamp(f.width || 0, 0, 0.05) * m;
    if (!w || f.style === 'none') return;
    ctx.save(); ctx.strokeStyle = f.color || '#111'; ctx.lineJoin = 'miter'; ctx.miterLimit = 6; ctx.lineCap = 'butt';
    const poly = pan.poly;
    if (f.style === 'ink') { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; handLine(ctx, poly, w, 3, w * 0.35, w * 1.2, true); handLine(ctx, poly, w * 0.55, 17, w * 0.5, w * 0.6, true); }
    else if (f.style === 'sketch') { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; handLine(ctx, poly, w * 0.6, 5, w * 1.6, w * 3, false); handLine(ctx, poly, w * 0.45, 29, w * 1.8, w * 4, false); }
    else if (f.style === 'double') { ctx.lineWidth = w; pathPoly(ctx, poly); ctx.stroke(); ctx.lineWidth = Math.max(1, w * 0.4); pathPoly(ctx, shrink(poly, w * 2.2)); ctx.stroke(); }
    else { ctx.lineWidth = w; if (f.style === 'dashed') ctx.setLineDash([w * 3.2, w * 2.2]); pathPoly(ctx, poly); ctx.stroke(); }
    ctx.restore();
  };
  MC.drawPanelShadow = (ctx, f, pan, W, H) => {
    if (!(f.shadow > 0)) return;
    const d = f.shadow * 0.022 * Math.min(W, H);
    ctx.save(); ctx.translate(d, d); ctx.fillStyle = f.shadowColor || '#000'; pathPoly(ctx, pan.poly); ctx.fill(); ctx.restore();
  };

  /* ---------- transiciones ---------- */
  MC.TRANSITION_GROUPS = [
    { v: 'basic', es: 'Básicas', en: 'Basic' }, { v: 'move', es: 'Movimiento', en: 'Movement' },
    { v: 'shape', es: 'Formas', en: 'Shapes' }, { v: 'comic', es: 'Cómic', en: 'Comic' },
  ];
  /* dir: admite dirección · color: admite color · gap: admite distancia (calle) */
  MC.TRANSITIONS = [
    { v: 'cut', g: 'basic', es: 'Corte', en: 'Cut' },
    { v: 'fade', g: 'basic', es: 'Fundido a negro', en: 'Fade to black', color: '#000000' },
    { v: 'fadew', g: 'basic', es: 'Fundido a blanco', en: 'Fade to white', color: '#ffffff' },
    { v: 'dissolve', g: 'basic', es: 'Encadenado', en: 'Dissolve' },
    { v: 'flash', g: 'basic', es: 'Destello', en: 'Flash', color: '#ffffff' },
    { v: 'wipe', g: 'move', es: 'Barrido', en: 'Wipe', dir: true },
    { v: 'push', g: 'move', es: 'Empujar', en: 'Push', dir: true },
    { v: 'slide', g: 'move', es: 'Cubrir', en: 'Cover', dir: true },
    { v: 'reveal', g: 'move', es: 'Descubrir', en: 'Uncover', dir: true },
    { v: 'whip', g: 'move', es: 'Latigazo', en: 'Whip pan', dir: true },
    { v: 'zoom', g: 'move', es: 'Zoom a través', en: 'Zoom through' },
    { v: 'spin', g: 'move', es: 'Giro', en: 'Spin' },
    { v: 'iris', g: 'shape', es: 'Círculo', en: 'Circle' },
    { v: 'iriscart', g: 'shape', es: 'Iris de dibujos', en: 'Cartoon iris', color: '#000000' },
    { v: 'diamond', g: 'shape', es: 'Rombo', en: 'Diamond' },
    { v: 'clock', g: 'shape', es: 'Reloj', en: 'Clock' },
    { v: 'blinds', g: 'shape', es: 'Persianas', en: 'Blinds', dir: true },
    { v: 'split', g: 'shape', es: 'Puertas', en: 'Doors', dir: true },
    { v: 'halftone', g: 'shape', es: 'Trama', en: 'Halftone', dir: true, color: '#111111' },
    { v: 'gutter', g: 'comic', es: 'Por la calle', en: 'Along the gutter', dir: true, gap: true },
    { v: 'pageview', g: 'comic', es: 'Vista de página', en: 'Page view', dir: true, gap: true },
    { v: 'pageturn', g: 'comic', es: 'Pasar página', en: 'Page turn', dir: true },
    { v: 'ink', g: 'comic', es: 'Mancha de tinta', en: 'Ink splash', color: '#000000' },
    { v: 'burst', g: 'comic', es: 'Estallido', en: 'Burst', color: '#ffffff' },
    { v: 'grid', g: 'comic', es: 'Mosaico de viñetas', en: 'Panel mosaic', gap: true },
    { v: 'pop', g: 'comic', es: 'Pop', en: 'Pop', color: '#ffffff' },
    { v: 'impact', g: 'comic', es: 'Impacto', en: 'Impact', color: '#ffffff' },
    { v: 'glitch', g: 'comic', es: 'Interferencia', en: 'Glitch' },
  ];
  MC.TR_DIRS = [{ v: 'l', l: '←' }, { v: 'r', l: '→' }, { v: 'u', l: '↑' }, { v: 'd', l: '↓' }];
  MC.TR_EASES = [{ v: 'smooth', es: 'Suave', en: 'Smooth' }, { v: 'linear', es: 'Lineal', en: 'Linear' }, { v: 'out', es: 'Frena', en: 'Ease out' }, { v: 'in', es: 'Acelera', en: 'Ease in' }, { v: 'back', es: 'Rebote', en: 'Overshoot' }, { v: 'snap', es: 'Seco', en: 'Snap' }];
  MC.trInfo = (v) => MC.TRANSITIONS.find((x) => x.v === v) || MC.TRANSITIONS[0];

  const DV = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] };
  const hexRgb = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); if (!m) return '0,0,0'; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(','); };

  /* Dibuja la transición en curso. A y B dibujan el plano saliente y el entrante en un contexto dado. */
  MC.drawTransition = (ctx, tr, p, A, B, o) => {
    const { W, H } = o, info = MC.trInfo(tr.type), type = info.v;
    const e = MC.ease(tr.ease || 'smooth', p), dir = DV[tr.dir || 'l'] || DV.l, col = tr.color || info.color || '#000000', m = Math.min(W, H);
    const veil = (c, a) => { ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); ctx.restore(); };
    const at = (fn, dx, dy, k, rot) => { ctx.save(); if (k != null || rot) { ctx.translate(W / 2 + (dx || 0), H / 2 + (dy || 0)); if (rot) ctx.rotate(rot); if (k != null) ctx.scale(k, k); ctx.translate(-W / 2, -H / 2); } else ctx.translate(dx || 0, dy || 0); fn(ctx); ctx.restore(); };
    const off = (key, fn) => { const r = canvasOf(key, W, H); fn(r.g); return r.c; };
    const clipped = (pathFn, fn) => { ctx.save(); ctx.beginPath(); pathFn(ctx); ctx.clip(); fn(ctx); ctx.restore(); };
    const gutterCol = tr.color || (o.frameBg || '#ffffff');
    switch (type) {
      case 'fade': case 'fadew': { if (p < 0.5) { A(ctx); veil(col, MC.ease('smooth', p * 2)); } else { B(ctx); veil(col, MC.ease('smooth', (1 - p) * 2)); } return; }
      case 'dissolve': { B(ctx); const c = off('a', A); ctx.save(); ctx.globalAlpha = 1 - e; ctx.drawImage(c, 0, 0, W, H); ctx.restore(); return; }
      case 'flash': { const a = p < 0.3 ? p / 0.3 : (1 - p) / 0.7; if (p < 0.3) A(ctx); else B(ctx); veil(col, a); return; }
      case 'wipe': { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); at(A, dir[0] * W * e * 0.3, dir[1] * H * e * 0.3); clipped((g) => g.rect(dir[0] < 0 ? W * (1 - e) : 0, dir[1] < 0 ? H * (1 - e) : 0, dir[0] ? W * e : W, dir[1] ? H * e : H), (g) => at(B, -dir[0] * W * (1 - e), -dir[1] * H * (1 - e))); return; }
      case 'push': { at(A, dir[0] * W * e, dir[1] * H * e); at(B, -dir[0] * W * (1 - e), -dir[1] * H * (1 - e)); return; }
      case 'slide': { A(ctx); veil('#000', e * 0.45); ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = m * 0.04; ctx.fillStyle = '#000'; const dx = -dir[0] * W * (1 - e), dy = -dir[1] * H * (1 - e); ctx.fillRect(dx, dy, W, H); ctx.restore(); at(B, dx, dy); return; }
      case 'reveal': { B(ctx); const dx = dir[0] * W * e, dy = dir[1] * H * e; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = m * 0.04; ctx.fillStyle = '#000'; ctx.fillRect(dx, dy, W, H); ctx.restore(); at(A, dx, dy); return; }
      case 'whip': {
        const c = off('a', (g) => { g.save(); g.translate(dir[0] * W * e, dir[1] * H * e); A(g); g.restore(); g.save(); g.translate(-dir[0] * W * (1 - e), -dir[1] * H * (1 - e)); B(g); g.restore(); });
        const blur = Math.sin(Math.PI * p) * m * 0.06, n = 6;
        ctx.drawImage(c, 0, 0, W, H);
        for (let i = 1; i <= n; i++) { ctx.save(); ctx.globalAlpha = 0.5 / i; ctx.drawImage(c, -dir[0] * blur * (i / n), -dir[1] * blur * (i / n), W, H); ctx.drawImage(c, dir[0] * blur * (i / n), dir[1] * blur * (i / n), W, H); ctx.restore(); }
        return;
      }
      case 'zoom': { at(B, 0, 0, lerp(0.75, 1, e)); const c = off('a', A); ctx.save(); ctx.globalAlpha = 1 - e; ctx.translate(W / 2, H / 2); ctx.scale(1 + e * 1.4, 1 + e * 1.4); ctx.drawImage(c, -W / 2, -H / 2, W, H); ctx.restore(); return; }
      case 'spin': { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); if (p < 0.5) at(A, 0, 0, 1 - MC.ease('in', p * 2) * 0.9, MC.ease('in', p * 2) * Math.PI); else at(B, 0, 0, 0.1 + MC.ease('out', (p - 0.5) * 2) * 0.9, -(1 - MC.ease('out', (p - 0.5) * 2)) * Math.PI); return; }
      case 'iris': { A(ctx); const r = e * Math.hypot(W, H) / 2; clipped((g) => g.arc(W / 2, H / 2, Math.max(0.1, r), 0, Math.PI * 2), B); return; }
      case 'iriscart': {
        const R = Math.hypot(W, H) / 2, ph = p < 0.5 ? 1 - MC.ease('in', p * 2) : MC.ease('out', (p - 0.5) * 2), r = Math.max(0, ph * R);
        (p < 0.5 ? A : B)(ctx);
        ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2, true); ctx.fill('evenodd'); ctx.restore();
        return;
      }
      case 'diamond': { A(ctx); const r = e * (W + H) / 2; clipped((g) => { g.moveTo(W / 2, H / 2 - r); g.lineTo(W / 2 + r, H / 2); g.lineTo(W / 2, H / 2 + r); g.lineTo(W / 2 - r, H / 2); g.closePath(); }, B); return; }
      case 'clock': { A(ctx); if (e <= 0) return; const R = Math.hypot(W, H); clipped((g) => { g.moveTo(W / 2, H / 2); g.arc(W / 2, H / 2, R, -Math.PI / 2, -Math.PI / 2 + e * Math.PI * 2); g.closePath(); }, B); return; }
      case 'blinds': {
        A(ctx); const n = 9, vert = dir[0] !== 0, size = (vert ? W : H) / n;
        clipped((g) => { for (let i = 0; i < n; i++) { const k = clamp(e * 1.6 - (i / n) * 0.6, 0, 1), s = size * k, base = i * size, st = (vert ? dir[0] > 0 : dir[1] > 0) ? base : base + size - s; if (s > 0) vert ? g.rect(st, 0, s, H) : g.rect(0, st, W, s); } }, B);
        return;
      }
      case 'split': {
        B(ctx); const vert = dir[0] === 0;
        if (!vert) { clipped((g) => g.rect(0, 0, W / 2, H), (g) => at(A, -W / 2 * e, 0)); clipped((g) => g.rect(W / 2, 0, W / 2, H), (g) => at(A, W / 2 * e, 0)); }
        else { clipped((g) => g.rect(0, 0, W, H / 2), (g) => at(A, 0, -H / 2 * e)); clipped((g) => g.rect(0, H / 2, W, H / 2), (g) => at(A, 0, H / 2 * e)); }
        return;
      }
      case 'halftone': {
        A(ctx); const st = m / 18, cols = Math.ceil(W / st) + 1, rows = Math.ceil(H / st) + 1;
        const prog = (x, y) => { const u = dir[0] ? (dir[0] < 0 ? 1 - x / W : x / W) : (dir[1] < 0 ? 1 - y / H : y / H); return clamp(e * 1.7 - u * 0.7, 0, 1); };
        ctx.save(); ctx.fillStyle = col;
        ctx.beginPath(); for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const x = i * st, y = j * st, r = clamp(prog(x, y) * 1.4, 0, 1) * st * 0.8; if (r > 0.3 && prog(x, y) < 1) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); } } ctx.fill();
        ctx.restore();
        clipped((g) => { for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const x = i * st, y = j * st, k = prog(x, y), r = clamp(k * 1.25 - 0.25, 0, 1) * st * 0.75; if (r > 0.3) { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); } } }, B);
        return;
      }
      case 'gutter': case 'pageview': {
        /* las dos viñetas puestas como en una página, separadas por la calle; la cámara viaja de una a otra */
        const gap = (tr.gap == null ? (type === 'pageview' ? 0.08 : 0.05) : tr.gap) * m + (o.frameGutter || 0);
        const z = type === 'pageview' ? 0.42 : 0.12, k = 1 - z * Math.sin(Math.PI * clamp(p, 0, 1)) * (type === 'pageview' ? 1 : 1);
        const Dx = dir[0] * (W + gap), Dy = dir[1] * (H + gap);
        ctx.save(); ctx.fillStyle = gutterCol; ctx.fillRect(0, 0, W, H);
        ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2 + Dx * e, -H / 2 + Dy * e);
        A(ctx); ctx.translate(-Dx, -Dy); B(ctx);
        ctx.restore();
        return;
      }
      case 'pageturn': {
        B(ctx);
        const vx = -dir[0] || 0, vy = -dir[1] || 0;   /* lado hacia el que se pliega */
        const L = (vx ? W : H) * 1.15, pos = (1 - e) * L - (vx ? W : H) * 0.15, fold = vx ? (vx > 0 ? pos : W - pos) : (vy > 0 ? pos : H - pos);
        const keep = (g) => (vx > 0 ? g.rect(0, 0, Math.max(0, fold), H) : vx < 0 ? g.rect(fold, 0, W - fold, H) : vy > 0 ? g.rect(0, 0, W, Math.max(0, fold)) : g.rect(0, fold, W, H - fold));
        clipped(keep, A);
        /* reverso de la hoja doblada */
        const fw = Math.min((vx ? W : H) - (vx > 0 || vy > 0 ? fold : (vx ? W : H) - fold), (vx ? W : H) * 0.35) * Math.sin(Math.PI * e) + 1;
        ctx.save();
        const gx0 = vx > 0 ? fold : vx < 0 ? fold - fw : 0, gy0 = vy > 0 ? fold : vy < 0 ? fold - fw : 0;
        const gr = vx ? ctx.createLinearGradient(fold, 0, fold + (vx > 0 ? fw : -fw), 0) : ctx.createLinearGradient(0, fold, 0, fold + (vy > 0 ? fw : -fw));
        gr.addColorStop(0, '#d8d4cc'); gr.addColorStop(0.6, '#f7f5f0'); gr.addColorStop(1, '#bdb8ae');
        ctx.fillStyle = gr; ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = m * 0.03;
        if (e > 0.001 && e < 0.999) { vx ? ctx.fillRect(gx0, 0, fw, H) : ctx.fillRect(0, gy0, W, fw); }
        ctx.restore();
        return;
      }
      case 'ink': {
        A(ctx); const n = 7, R = Math.hypot(W, H) * 0.42;
        const blot = (i) => ({ cx: W * (0.12 + 0.76 * noise(i * 5 + 1)), cy: H * (0.12 + 0.76 * noise(i * 9 + 3)), r: clamp(e * 1.3 - noise(i + 21) * 0.3, 0, 1.2) * R * (0.7 + 0.5 * noise(i + 4)) });
        const blots = (g, grow) => { for (let i = 0; i < n; i++) { const b = blot(i), r = b.r * grow; if (r <= 0) continue; const segs = 26; g.moveTo(b.cx + r, b.cy); for (let s = 1; s <= segs; s++) { const th = (s / segs) * Math.PI * 2, rr = r * (0.82 + 0.3 * noise(i * 50 + s)); g.lineTo(b.cx + Math.cos(th) * rr, b.cy + Math.sin(th) * rr); } g.closePath(); } };
        ctx.save(); ctx.fillStyle = col; ctx.beginPath(); blots(ctx, 1.1);
        /* salpicaduras alrededor de cada mancha */
        if (e < 0.95) for (let i = 0; i < n; i++) { const b = blot(i); if (b.r <= 0) continue; for (let k = 0; k < 5; k++) { const th = noise(i * 17 + k) * Math.PI * 2, d = b.r * (1.2 + 0.35 * noise(i * 3 + k * 7)), rr = b.r * (0.04 + 0.06 * noise(i + k * 13)); ctx.moveTo(b.cx + Math.cos(th) * d + rr, b.cy + Math.sin(th) * d); ctx.arc(b.cx + Math.cos(th) * d, b.cy + Math.sin(th) * d, rr, 0, Math.PI * 2); } }
        ctx.fill(); ctx.restore();
        clipped((g) => blots(g, 1), B);
        return;
      }
      case 'burst': {
        A(ctx); const R = Math.hypot(W, H) * 0.75 * e, n = 18;
        const star = (g, r) => { for (let i = 0; i < n * 2; i++) { const th = (i / (n * 2)) * Math.PI * 2 + e, rr = i % 2 ? r * 0.55 : r * (0.9 + 0.2 * noise(i)); i ? g.lineTo(W / 2 + Math.cos(th) * rr, H / 2 + Math.sin(th) * rr) : g.moveTo(W / 2 + Math.cos(th) * rr, H / 2 + Math.sin(th) * rr); } g.closePath(); };
        ctx.save(); ctx.fillStyle = col; ctx.beginPath(); star(ctx, R * 1.12 + m * 0.02); ctx.fill(); ctx.restore();
        clipped((g) => star(g, R), B);
        return;
      }
      case 'grid': {
        /* la imagen nueva entra en viñetas que aparecen una a una, separadas por la calle */
        A(ctx); const cols = W >= H ? 4 : 3, rows = W >= H ? 3 : 4, gap = (tr.gap == null ? 0.02 : tr.gap) * m, cw = W / cols, ch = H / rows;
        const order = []; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) order.push([i, j, noise(i * 13 + j * 7)]);
        order.sort((a, b) => a[2] - b[2]);
        const full = clamp((e - 0.8) / 0.2, 0, 1);
        if (full >= 1) { B(ctx); return; }
        ctx.save(); ctx.fillStyle = gutterCol; ctx.globalAlpha = clamp(e * 4, 0, 1) * (1 - full); ctx.fillRect(0, 0, W, H); ctx.restore();
        clipped((g) => { order.forEach((q, idx) => { const k = clamp(e * 1.25 * order.length - idx, 0, 1); if (k <= 0) return; const gg = gap * (1 - full), x = q[0] * cw + gg / 2, y = q[1] * ch + gg / 2, w = (cw - gg) * k, hh = (ch - gg) * k; g.rect(x + ((cw - gg) - w) / 2, y + ((ch - gg) - hh) / 2, w, hh); }); }, B);
        return;
      }
      case 'pop': { if (p < 0.25) { A(ctx); veil(col, p / 0.25); return; } const q = (p - 0.25) / 0.75; at(B, 0, 0, lerp(1.35, 1, MC.ease('back', q))); veil(col, 1 - q * 1.6); return; }
      case 'impact': {
        const q = p;
        const amp = (1 - q) * m * 0.04, sx = (noise(Math.floor(q * 40)) - 0.5) * 2 * amp, sy = (noise(Math.floor(q * 40) + 7) - 0.5) * 2 * amp;
        const c = off('a', B); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.drawImage(c, sx, sy, W, H);
        if (q < 0.18) veil(col, 1 - q / 0.18 * 0.4); else if (q < 0.24) veil('#000', 0.6); else veil(col, Math.max(0, 0.3 - q));
        return;
      }
      case 'glitch': {
        const fa = off('a', A), fb = off('b', B), f = Math.floor(p * 24), base = p < 0.5 ? fa : fb, other = p < 0.5 ? fb : fa;
        ctx.drawImage(base, 0, 0, W, H);
        const intensity = Math.sin(Math.PI * p), n = 10;
        for (let i = 0; i < n; i++) {
          if (noise(f * 31 + i) > intensity) continue;
          const y = noise(f * 17 + i * 3) * H, hh = (0.01 + noise(f + i * 11) * 0.08) * H, dx = (noise(f * 7 + i) - 0.5) * W * 0.12 * intensity;
          ctx.drawImage(noise(f + i * 5) > 0.5 ? other : base, 0, y, W, hh, dx, y, W, hh);
        }
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.35 * intensity;
        ctx.drawImage(other, m * 0.012 * intensity, 0, W, H); ctx.restore();
        return;
      }
      default: B(ctx);
    }
  };
  MC.hexRgb = hexRgb;

  /* Miniatura animada para el catálogo: dos viñetas de muestra */
  MC.trPreview = (canvas, tr, p) => {
    const W = canvas.width, H = canvas.height, g = canvas.getContext('2d');
    const card = (fill, ink, label) => (c) => {
      c.fillStyle = fill; c.fillRect(0, 0, W, H);
      c.fillStyle = ink; c.globalAlpha = 0.9; c.beginPath(); c.arc(W * 0.3, H * 0.72, H * 0.42, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
      c.font = '700 ' + Math.round(H * 0.42) + 'px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(label, W * 0.7, H * 0.45);
    };
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    if (tr.type === 'cut') (p < 0.5 ? card('#3b3550', '#8C7CFF', 'A') : card('#4a3a1c', '#F2C14E', 'B'))(g);
    else MC.drawTransition(g, Object.assign({ dur: 1 }, tr), p, card('#3b3550', '#8C7CFF', 'A'), card('#4a3a1c', '#F2C14E', 'B'), { W, H, frameBg: '#ffffff', frameGutter: 0 });
    g.restore();
  };
})();
