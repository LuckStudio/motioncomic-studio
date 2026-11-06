/* Animación de capas y superposiciones: entradas, salidas, bucles, fotogramas clave con curvas y personaje por capas (parpadeo y boca con la voz).
   Lo usan por igual las capas de un plano (tiempo del plano) y las superposiciones (tiempo de su clip). Visor y exportación comparten este código. */
(function () {
  const MC = window.MC;
  const { clamp, lerp } = MC;
  const noise = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  /* ---------- curvas ---------- */
  const bez = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t, dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) { const e = sx(t) - x; if (Math.abs(e) < 1e-5) break; const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
      let lo = 0, hi = 1; t = clamp(t, 0, 1);
      for (let i = 0; i < 12 && Math.abs(sx(t) - x) > 1e-5; i++) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      return sy(t);
    };
  };
  MC.bezier = bez;
  MC.CURVES = [
    { v: 'linear', es: 'Lineal', en: 'Linear', b: [0, 0, 1, 1] }, { v: 'smooth', es: 'Suave', en: 'Smooth', b: [0.42, 0, 0.58, 1] },
    { v: 'in', es: 'Acelera', en: 'Ease in', b: [0.42, 0, 1, 1] }, { v: 'out', es: 'Frena', en: 'Ease out', b: [0, 0, 0.58, 1] },
    { v: 'back', es: 'Rebote', en: 'Overshoot', b: [0.34, 1.56, 0.64, 1] }, { v: 'snap', es: 'Seco', en: 'Snap', b: [0.9, 0, 1, 0.4] },
    { v: 'elastic', es: 'Elástico', en: 'Elastic', b: [0.3, 1.5, 0.5, 1], fn: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin(((x * 10 - 0.75) * 2 * Math.PI) / 3) + 1) },
    { v: 'bounce', es: 'Bote', en: 'Bounce', b: [0.2, 1.25, 0.4, 1], fn: (x) => { const n1 = 7.5625, d1 = 2.75; if (x < 1 / d1) return n1 * x * x; if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75; if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375; return n1 * (x -= 2.625 / d1) * x + 0.984375; } },
    { v: 'hold', es: 'Mantener', en: 'Hold', b: [1, 0, 1, 0], fn: (x) => (x >= 1 ? 1 : 0) },
  ];
  /* Devuelve la función de una curva con nombre o personalizada ({ b: [x1,y1,x2,y2] }). */
  MC.curveFn = (c) => {
    if (c && typeof c === 'object' && c.b) return bez(c.b[0], c.b[1], c.b[2], c.b[3]);
    const p = MC.CURVES.find((q) => q.v === c);
    if (!p) return (x) => MC.ease('smooth', x);
    if (p.fn) return p.fn;
    return bez(p.b[0], p.b[1], p.b[2], p.b[3]);
  };
  MC.curveBez = (c) => (c && typeof c === 'object' && c.b ? c.b : (MC.CURVES.find((q) => q.v === c) || MC.CURVES[1]).b);

  /* ---------- entradas, salidas y bucles ---------- */
  MC.ANIM_IN = [
    { v: '', es: 'Sin entrada', en: 'None' }, { v: 'fade', es: 'Aparecer', en: 'Fade in' }, { v: 'left', es: 'Desde la izquierda', en: 'From left' }, { v: 'right', es: 'Desde la derecha', en: 'From right' },
    { v: 'up', es: 'Desde arriba', en: 'From top' }, { v: 'down', es: 'Desde abajo', en: 'From bottom' }, { v: 'pop', es: 'Pop', en: 'Pop' }, { v: 'zoom', es: 'Zoom', en: 'Zoom' },
    { v: 'drop', es: 'Caída con rebote', en: 'Bouncy drop' }, { v: 'spin', es: 'Giro', en: 'Spin' }, { v: 'wipe', es: 'Cortina', en: 'Reveal' },
    { v: 'flipx', es: '3D · Volteo vertical', en: '3D · Flip up' }, { v: 'flipy', es: '3D · Volteo horizontal', en: '3D · Flip sideways' }, { v: 'swingl', es: '3D · Giro desde la izquierda', en: '3D · Swing from left' }, { v: 'swingr', es: '3D · Giro desde la derecha', en: '3D · Swing from right' },
    { v: 'door', es: '3D · Puerta', en: '3D · Door' }, { v: 'tumble', es: '3D · Voltereta', en: '3D · Tumble' }, { v: 'fly3d', es: '3D · Vuelo', en: '3D · Fly in' },
  ];
  MC.ANIM_OUT = MC.ANIM_IN.map((q) => Object.assign({}, q, q.v === '' ? { es: 'Sin salida', en: 'None' } : q.v === 'fade' ? { es: 'Desaparecer', en: 'Fade out' } : q.v === 'left' ? { es: 'Hacia la izquierda', en: 'To left' } : q.v === 'right' ? { es: 'Hacia la derecha', en: 'To right' } : q.v === 'up' ? { es: 'Hacia arriba', en: 'To top' } : q.v === 'down' ? { es: 'Hacia abajo', en: 'To bottom' } : {}));
  MC.ANIM_LOOP = [
    { v: '', es: 'Sin bucle', en: 'None' }, { v: 'float', es: 'Flotar', en: 'Float' }, { v: 'sway', es: 'Balanceo', en: 'Sway' }, { v: 'breathe', es: 'Respirar', en: 'Breathe' },
    { v: 'pulse', es: 'Latido', en: 'Pulse' }, { v: 'bob', es: 'Saltito', en: 'Bob' }, { v: 'shake', es: 'Temblor', en: 'Shake' }, { v: 'spin', es: 'Girar sin parar', en: 'Spin' }, { v: 'flicker', es: 'Parpadeo de luz', en: 'Flicker' },
    { v: 'card', es: '3D · Tarjeta que se mece', en: '3D · Swaying card' }, { v: 'tilt3d', es: '3D · Cabeceo', en: '3D · Nodding' }, { v: 'orbit3d', es: '3D · Giro completo', en: '3D · Full turn' }, { v: 'wobble3d', es: '3D · Bamboleo', en: '3D · Wobble' },
  ];
  const rise = (kind, e, st, dist) => { // e: 0 (fuera) → 1 (en su sitio)
    const k = 1 - e;
    switch (kind) {
      case 'fade': st.op *= e; break;
      case 'left': st.dx -= 0.6 * dist * k; st.op *= clamp(e * 3, 0, 1); break;
      case 'right': st.dx += 0.6 * dist * k; st.op *= clamp(e * 3, 0, 1); break;
      case 'up': st.dy -= 0.6 * dist * k; st.op *= clamp(e * 3, 0, 1); break;
      case 'down': st.dy += 0.6 * dist * k; st.op *= clamp(e * 3, 0, 1); break;
      case 'pop': st.sc *= lerp(0.2, 1, e); st.op *= clamp(e * 4, 0, 1); break;
      case 'zoom': st.sc *= lerp(1 + 0.8 * dist, 1, e); st.op *= clamp(e * 2.5, 0, 1); break;
      case 'drop': st.dy -= 0.7 * dist * k; st.op *= clamp(e * 6, 0, 1); break;
      case 'spin': st.rot += -270 * k; st.sc *= lerp(0.3, 1, e); st.op *= clamp(e * 3, 0, 1); break;
      case 'wipe': st.op *= e; st.sc *= lerp(0.92, 1, e); break;
      case 'flipx': st.rx += 90 * k; st.op *= clamp(e * 4, 0, 1); break;
      case 'flipy': st.ry += 90 * k; st.op *= clamp(e * 4, 0, 1); break;
      case 'swingl': st.ry += -78 * k; st.dx -= 0.12 * dist * k; st.op *= clamp(e * 3, 0, 1); break;
      case 'swingr': st.ry += 78 * k; st.dx += 0.12 * dist * k; st.op *= clamp(e * 3, 0, 1); break;
      case 'door': st.ry += -100 * k; st.pv = { x: 0, y: 0.5 }; st.op *= clamp(e * 4, 0, 1); break;
      case 'tumble': st.rx += 120 * k; st.ry += 40 * k; st.sc *= lerp(0.55, 1, e); st.op *= clamp(e * 3, 0, 1); break;
      case 'fly3d': st.ry += 55 * k; st.rx += -20 * k; st.sc *= lerp(0.25, 1, e); st.dy -= 0.18 * dist * k; st.op *= clamp(e * 3, 0, 1); break;
      default: break;
    }
  };
  const easeFor = (kind) => (kind === 'pop' || kind === 'drop' ? 'back' : 'out');
  const bounce = (x) => { const n1 = 7.5625, d1 = 2.75; if (x < 1 / d1) return n1 * x * x; if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75; if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375; return n1 * (x -= 2.625 / d1) * x + 0.984375; };

  /* Interpolación de los fotogramas clave de un elemento: ángulos y desplazamientos relativos a su posición base. */
  MC.KF_CORE = ['x', 'y', 'sc', 'rot', 'op', 'rx', 'ry', 'sx', 'sy'];
  MC.KF_CROP = ['cl', 'ct', 'cr', 'cb']; // recorte izquierda, arriba, derecha y abajo, como cambio sobre el recorte base
  MC.KF_PROPS = MC.KF_CORE.concat(MC.KF_CROP);
  const kfDefault = { x: 0, y: 0, sc: 1, rot: 0, op: 1, rx: 0, ry: 0, sx: 1, sy: 1, cl: 0, ct: 0, cr: 0, cb: 0 };
  /* recorte efectivo de un elemento: el base más lo animado, siempre dejando algo visible; null si no recorta */
  MC.effCrop = (it, an) => {
    const c = it.crop || {}, q = { l: (c.l || 0) + (an ? an.cl || 0 : 0), t: (c.t || 0) + (an ? an.ct || 0 : 0), r: (c.r || 0) + (an ? an.cr || 0 : 0), b: (c.b || 0) + (an ? an.cb || 0 : 0) };
    Object.keys(q).forEach((k) => { q[k] = Math.max(0, Math.min(0.95, q[k])); });
    if (q.l + q.r > 0.98) { const f = 0.98 / (q.l + q.r); q.l *= f; q.r *= f; } if (q.t + q.b > 0.98) { const f = 0.98 / (q.t + q.b); q.t *= f; q.b *= f; }
    return q.l || q.t || q.r || q.b ? q : null;
  };
  /* Cada fotograma clave puede llevar solo las propiedades que anima (una pista por propiedad); los antiguos las llevan todas. */
  MC.kfValues = (kfs, local) => {
    if (!kfs || !kfs.length) return null;
    const out = {};
    MC.KF_PROPS.forEach((pr) => {
      const a = kfs.filter((q) => q[pr] != null).sort((p1, p2) => p1.t - p2.t);
      if (!a.length) { out[pr] = kfDefault[pr]; return; }
      if (local <= a[0].t) { out[pr] = a[0][pr]; return; }
      const last = a[a.length - 1]; if (local >= last.t) { out[pr] = last[pr]; return; }
      let i = 0; while (i < a.length - 2 && local >= a[i + 1].t) i++;
      const k0 = a[i], k1 = a[i + 1], u = (local - k0.t) / Math.max(1e-6, k1.t - k0.t);
      out[pr] = lerp(k0[pr], k1[pr], MC.curveFn(k0.ease || 'smooth')(u));
    });
    return out;
  };

  /* Estado de movimiento de un elemento en el instante local (0 = inicio). Devuelve { dx, dy, sc, rot, op } o null si no se mueve. */
  MC.itemAnim = (item, local, dur) => {
    const A = item.anim, kf = item.kf; if (!A && !(kf && kf.length)) return null;
    const st = { dx: 0, dy: 0, sc: 1, rot: 0, op: 1, rx: 0, ry: 0, sx: 1, sy: 1, cl: 0, ct: 0, cr: 0, cb: 0 };
    if (kf && kf.length) { const v = MC.kfValues(kf, local); st.dx += v.x; st.dy += v.y; st.sc *= v.sc; st.rot += v.rot; st.op *= v.op; st.rx += v.rx; st.ry += v.ry; st.sx *= v.sx; st.sy *= v.sy; st.cl += v.cl; st.ct += v.ct; st.cr += v.cr; st.cb += v.cb; }
    if (A) {
      const din = A.in && A.in.type ? clamp(A.in.dur || 0.5, 0.05, dur) : 0, dout = A.out && A.out.type ? clamp(A.out.dur || 0.5, 0.05, dur) : 0;
      if (din && local < din) { const u = clamp(local / din, 0, 1); let e = MC.ease(easeFor(A.in.type), u); if (A.in.type === 'drop') e = bounce(u); rise(A.in.type, e, st, A.in.dist == null ? 1 : A.in.dist); }
      if (dout && local > dur - dout) { const u = clamp((dur - local) / dout, 0, 1); rise(A.out.type, MC.ease('smooth', u), st, A.out.dist == null ? 1 : A.out.dist); }
      const L = A.loop;
      if (L && L.type) {
        const amp = L.amp == null ? 1 : L.amp, sp = L.speed == null ? 1 : L.speed, w = local * sp * Math.PI * 2;
        switch (L.type) {
          case 'float': st.dy += Math.sin(w * 0.5) * 0.012 * amp; st.dx += Math.sin(w * 0.25) * 0.004 * amp; break;
          case 'sway': st.rot += Math.sin(w * 0.5) * 3 * amp; break;
          case 'breathe': st.sc *= 1 + Math.sin(w * 0.4) * 0.018 * amp; st.dy -= Math.sin(w * 0.4) * 0.002 * amp; break;
          case 'pulse': st.sc *= 1 + Math.max(0, Math.sin(w)) ** 6 * 0.06 * amp; break;
          case 'bob': st.dy -= Math.abs(Math.sin(w * 0.7)) * 0.025 * amp; break;
          case 'shake': { const k = Math.floor(local * sp * 40); st.dx += (noise(k) - 0.5) * 0.008 * amp; st.dy += (noise(k + 50) - 0.5) * 0.008 * amp; st.rot += (noise(k + 9) - 0.5) * 1.2 * amp; break; }
          case 'spin': st.rot += local * sp * 90 * amp; break;
          case 'flicker': st.op *= 1 - 0.35 * amp * (noise(Math.floor(local * sp * 18)) > 0.55 ? 1 : 0); break;
          case 'card': st.ry += Math.sin(w * 0.4) * 24 * amp; st.rx += Math.sin(w * 0.27 + 1) * 6 * amp; break;
          case 'tilt3d': st.rx += Math.sin(w * 0.5) * 22 * amp; break;
          case 'orbit3d': st.ry += (local * sp * 60 * amp) % 360; break;
          case 'wobble3d': st.rx += Math.sin(w * 0.6) * 12 * amp; st.ry += Math.cos(w * 0.5) * 16 * amp; st.rot += Math.sin(w * 0.35) * 3 * amp; break;
          default: break;
        }
      }
    }
    return st;
  };
  /* Combina el movimiento de un elemento con otro ya calculado (por ejemplo, los efectos de impacto de la viñeta). */
  MC.mergeAnim = (a, b) => (!a ? b : !b ? a : { dx: a.dx + b.dx, dy: a.dy + b.dy, sc: a.sc * b.sc, rot: a.rot + b.rot, op: a.op * b.op, rx: (a.rx || 0) + (b.rx || 0), ry: (a.ry || 0) + (b.ry || 0), sx: (a.sx || 1) * (b.sx || 1), sy: (a.sy || 1) * (b.sy || 1) });

  /* ---------- personaje por capas: parpadeo y boca con la voz ---------- */
  /* Amplitud (0 a 1) de la locución en un instante de la línea de tiempo, a partir de las ondas ya calculadas. */
  MC.voiceLevel = (p, time) => {
    let m = 0;
    (p.clips || []).forEach((c) => {
      if (c.track !== 'voz' || time < c.start || time >= c.start + c.dur) return;
      const a = MC.audio.get(c.assetId); if (!a || !a.peaks) return;
      const i = Math.floor((c.offset + (time - c.start)) * 50);
      for (let j = i - 1; j <= i + 1; j++) m = Math.max(m, (a.peaks[j] || 0) / 255 * (c.vol == null ? 1 : c.vol));
    });
    return m;
  };
  /* ¿Se dibuja esta capa en este instante? Gestiona los pares «ojos abiertos / cerrados» y las bocas por nivel de voz. */
  MC.rigShow = (shot, layer, tl, shotStart, project) => {
    const hidden = shot.layers.some((q) => q.rig && q.rig.hides === layer.id && q.visible !== false && rigOn(shot, q, tl, shotStart, project));
    if (hidden) return false;
    if (layer.rig && layer.rig.type) return rigOn(shot, layer, tl, shotStart, project);
    return true;
  };
  const voiceCache = { key: '', v: 0 };
  const level = (project, time) => { const key = project.id + ':' + Math.round(time * 60); if (voiceCache.key !== key) { voiceCache.key = key; voiceCache.v = MC.voiceLevel(project, time); } return voiceCache.v; };
  function rigOn(shot, layer, tl, shotStart, project) {
    const r = layer.rig;
    if (r.type === 'blink') {
      const every = Math.max(0.8, r.every || 3.6), dur = clamp(r.dur || 0.14, 0.05, 0.6), t0 = (r.phase || 0.9) + noise(Math.floor((tl + 0.0001) / every) * 3 + 1) * every * 0.45;
      const cyc = tl % every; return cyc >= t0 % every && cyc < (t0 % every) + dur;
    }
    if (r.type === 'mouth') {
      const amp = project ? level(project, shotStart + tl) : 0, mine = r.open || 0;
      if (amp < mine) return false;
      const grp = r.group || 'boca';
      return !shot.layers.some((q) => q !== layer && q.visible !== false && q.rig && q.rig.type === 'mouth' && (q.rig.group || 'boca') === grp && (q.rig.open || 0) > mine && amp >= (q.rig.open || 0));
    }
    return true;
  }

  /* ---------- editor de curvas ---------- */
  /* Editor de una curva de velocidad: presets y una curva Bézier que se arrastra. value: nombre o { b:[x1,y1,x2,y2] }. */
  MC.ui.curveEditor = (value, onInput, onCommit) => {
    const { h, t } = MC;
    let cur = value || 'smooth';
    const W = 220, H = 200, pad = 22, YMIN = -0.5, YMAX = 1.5;
    const X = (v) => pad + v * (W - 2 * pad), Y = (v) => H - pad - ((v - YMIN) / (YMAX - YMIN)) * (H - 2 * pad);
    const cv = h('canvas', { width: W, height: H, class: 'cvcanvas', role: 'img', 'aria-label': t('Curva de velocidad: arrastra los dos puntos', 'Speed curve: drag the two points') });
    const wrap = h('div', { class: 'cved' });
    const chipsBox = h('div');
    const style = () => getComputedStyle(document.documentElement);
    const draw = () => {
      const g = cv.getContext('2d'), st = style(), acc = st.getPropertyValue('--accent').trim() || '#8C7CFF', fg = st.getPropertyValue('--fg').trim() || '#ECEEF0', ln = st.getPropertyValue('--line').trim() || '#2A2E33', mu = st.getPropertyValue('--muted').trim() || '#9AA0A8';
      g.clearRect(0, 0, W, H);
      g.strokeStyle = ln; g.lineWidth = 1; g.strokeRect(X(0), Y(1), X(1) - X(0), Y(0) - Y(1));
      g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(1), Y(1)); g.setLineDash([3, 4]); g.stroke(); g.setLineDash([]);
      const b = MC.curveBez(cur), f = bez(b[0], b[1], b[2], b[3]);
      g.strokeStyle = acc; g.lineWidth = 2.5; g.beginPath();
      for (let i = 0; i <= 60; i++) { const u = i / 60, v = f(u); i ? g.lineTo(X(u), Y(v)) : g.moveTo(X(u), Y(v)); }
      g.stroke();
      g.strokeStyle = mu; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(b[0]), Y(b[1])); g.moveTo(X(1), Y(1)); g.lineTo(X(b[2]), Y(b[3])); g.stroke();
      g.fillStyle = fg; [[b[0], b[1]], [b[2], b[3]]].forEach((q) => { g.beginPath(); g.arc(X(q[0]), Y(q[1]), 6, 0, 6.283); g.fill(); });
    };
    const isCustom = () => typeof cur === 'object' && cur && cur.b;
    const buildChips = () => {
      const opts = MC.CURVES.map((q) => ({ v: q.v, l: t(q.es, q.en) })).concat([{ v: '__c', l: t('Personalizada', 'Custom') }]);
      const nb = MC.ui.chips(opts, isCustom() ? '__c' : cur, (v) => { cur = v === '__c' ? { b: MC.curveBez(cur).slice() } : v; buildChips(); draw(); onInput(cur); if (onCommit) onCommit(); });
      chipsBox.replaceChildren(nb);
    };
    let drag = -1;
    const pt = (e) => { const r = cv.getBoundingClientRect(), k = W / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; };
    cv.addEventListener('pointerdown', (e) => {
      const [px, py] = pt(e), b = MC.curveBez(cur);
      const d1 = Math.hypot(px - X(b[0]), py - Y(b[1])), d2 = Math.hypot(px - X(b[2]), py - Y(b[3]));
      if (Math.min(d1, d2) > 18) return;
      drag = d1 <= d2 ? 0 : 1; if (!isCustom()) { cur = { b: b.slice() }; buildChips(); }
      cv.setPointerCapture(e.pointerId); e.preventDefault();
    });
    cv.addEventListener('pointermove', (e) => {
      if (drag < 0) return; const [px, py] = pt(e);
      const vx = clamp((px - pad) / (W - 2 * pad), 0, 1), vy = clamp(YMIN + ((H - pad - py) / (H - 2 * pad)) * (YMAX - YMIN), YMIN, YMAX);
      cur.b[drag * 2] = Math.round(vx * 100) / 100; cur.b[drag * 2 + 1] = Math.round(vy * 100) / 100; draw(); onInput(cur);
    });
    const up = () => { if (drag >= 0) { drag = -1; if (onCommit) onCommit(); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    wrap.append(chipsBox, cv); buildChips(); draw();
    return wrap;
  };

  /* ---------- aspecto por elemento: sombra, resplandor, contorno y color ---------- */
  MC.ITEM_LOOK = { shadow: { on: true, color: '#000000', a: 0.55, blur: 18, x: 8, y: 10 }, glow: { on: true, color: '#8C7CFF', a: 0.9, blur: 26 }, outline: { on: true, color: '#ffffff', w: 5 }, adj: { bright: 1, contrast: 1, sat: 1, hue: 0 } };
  const adjOn = (a) => a && (Math.abs((a.bright == null ? 1 : a.bright) - 1) > 0.01 || Math.abs((a.contrast == null ? 1 : a.contrast) - 1) > 0.01 || Math.abs((a.sat == null ? 1 : a.sat) - 1) > 0.01 || Math.abs(a.hue || 0) > 0.5);
  MC.hasItemLook = (it) => { const L = it.look; return !!(L && ((L.shadow && L.shadow.on) || (L.glow && L.glow.on) || (L.outline && L.outline.on) || adjOn(L.adj))); };
  /* Cadena de filtros de lienzo: desenfoque + ajustes de color. */
  MC.itemFilter = (it, blurPx) => {
    const a = it.look && it.look.adj, f = [];
    if (blurPx > 0) f.push('blur(' + blurPx.toFixed(2) + 'px)');
    if (adjOn(a)) f.push('brightness(' + (a.bright == null ? 1 : a.bright) + ')', 'contrast(' + (a.contrast == null ? 1 : a.contrast) + ')', 'saturate(' + (a.sat == null ? 1 : a.sat) + ')', 'hue-rotate(' + (a.hue || 0) + 'deg)');
    return f.join(' ');
  };
  const silCache = new WeakMap();
  const silhouette = (src, color) => {
    const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height; if (!sw || !sh) return null;
    const live = !!src.videoWidth || src instanceof HTMLCanvasElement;
    let cache = silCache.get(src); if (!live) { if (!cache) { cache = new Map(); silCache.set(src, cache); } const hit = cache.get(color); if (hit) return hit; }
    const k = Math.min(1, 1024 / Math.max(sw, sh)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
    const g = c.getContext('2d'); g.drawImage(src, 0, 0, c.width, c.height); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    if (!live) cache.set(color, c);
    return c;
  };
  /* Dibuja la imagen con su sombra, resplandor y contorno. k0 = escala del lienzo (el visor dibuja a menor tamaño). */
  MC.drawItem = (ctx, src, it, x, y, w, h, o, k0) => {
    const L = it.look; if (!L) { ctx.drawImage(src, x, y, w, h); return; }
    const u = (o.W / 1920) * (k0 || 1);
    if (L.outline && L.outline.on) {
      const m = ctx.getTransform(), sc = Math.max(0.0001, Math.hypot(m.a, m.b)), r = (Math.max(0.5, L.outline.w) * (o.W / 1920) * (k0 || 1)) / sc, sil = silhouette(src, L.outline.color || '#fff');
      if (sil) for (let i = 0; i < 16; i++) { const an = (i / 16) * Math.PI * 2; ctx.drawImage(sil, x + Math.cos(an) * r, y + Math.sin(an) * r, w, h); }
    }
    if (L.glow && L.glow.on) { ctx.save(); ctx.shadowColor = L.glow.color || '#fff'; ctx.shadowBlur = Math.max(1, L.glow.blur) * u; ctx.globalAlpha *= clamp(L.glow.a == null ? 0.9 : L.glow.a, 0, 1); ctx.drawImage(src, x, y, w, h); ctx.drawImage(src, x, y, w, h); ctx.restore(); }
    if (L.shadow && L.shadow.on) {
      ctx.save(); const a = clamp(L.shadow.a == null ? 0.55 : L.shadow.a, 0, 1), c = /^#?([0-9a-f]{6})$/i.exec(L.shadow.color || '#000000'), n = c ? parseInt(c[1], 16) : 0;
      ctx.shadowColor = 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; ctx.shadowBlur = Math.max(0, L.shadow.blur) * u; ctx.shadowOffsetX = (L.shadow.x || 0) * u; ctx.shadowOffsetY = (L.shadow.y || 0) * u;
      ctx.drawImage(src, x, y, w, h); ctx.restore();
    } else ctx.drawImage(src, x, y, w, h);
  };
})();
