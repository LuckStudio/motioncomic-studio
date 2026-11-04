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
  ];
  /* Devuelve la función de una curva con nombre o personalizada ({ b: [x1,y1,x2,y2] }). */
  MC.curveFn = (c) => {
    if (c && typeof c === 'object' && c.b) return bez(c.b[0], c.b[1], c.b[2], c.b[3]);
    const p = MC.CURVES.find((q) => q.v === c);
    if (!p) return (x) => MC.ease('smooth', x);
    return bez(p.b[0], p.b[1], p.b[2], p.b[3]);
  };
  MC.curveBez = (c) => (c && typeof c === 'object' && c.b ? c.b : (MC.CURVES.find((q) => q.v === c) || MC.CURVES[1]).b);

  /* ---------- entradas, salidas y bucles ---------- */
  MC.ANIM_IN = [
    { v: '', es: 'Sin entrada', en: 'None' }, { v: 'fade', es: 'Aparecer', en: 'Fade in' }, { v: 'left', es: 'Desde la izquierda', en: 'From left' }, { v: 'right', es: 'Desde la derecha', en: 'From right' },
    { v: 'up', es: 'Desde arriba', en: 'From top' }, { v: 'down', es: 'Desde abajo', en: 'From bottom' }, { v: 'pop', es: 'Pop', en: 'Pop' }, { v: 'zoom', es: 'Zoom', en: 'Zoom' },
    { v: 'drop', es: 'Caída con rebote', en: 'Bouncy drop' }, { v: 'spin', es: 'Giro', en: 'Spin' }, { v: 'wipe', es: 'Cortina', en: 'Reveal' },
  ];
  MC.ANIM_OUT = MC.ANIM_IN.map((q) => Object.assign({}, q, q.v === '' ? { es: 'Sin salida', en: 'None' } : q.v === 'fade' ? { es: 'Desaparecer', en: 'Fade out' } : q.v === 'left' ? { es: 'Hacia la izquierda', en: 'To left' } : q.v === 'right' ? { es: 'Hacia la derecha', en: 'To right' } : q.v === 'up' ? { es: 'Hacia arriba', en: 'To top' } : q.v === 'down' ? { es: 'Hacia abajo', en: 'To bottom' } : {}));
  MC.ANIM_LOOP = [
    { v: '', es: 'Sin bucle', en: 'None' }, { v: 'float', es: 'Flotar', en: 'Float' }, { v: 'sway', es: 'Balanceo', en: 'Sway' }, { v: 'breathe', es: 'Respirar', en: 'Breathe' },
    { v: 'pulse', es: 'Latido', en: 'Pulse' }, { v: 'bob', es: 'Saltito', en: 'Bob' }, { v: 'shake', es: 'Temblor', en: 'Shake' }, { v: 'spin', es: 'Girar sin parar', en: 'Spin' }, { v: 'flicker', es: 'Parpadeo de luz', en: 'Flicker' },
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
      default: break;
    }
  };
  const easeFor = (kind) => (kind === 'pop' || kind === 'drop' ? 'back' : 'out');
  const bounce = (x) => { const n1 = 7.5625, d1 = 2.75; if (x < 1 / d1) return n1 * x * x; if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75; if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375; return n1 * (x -= 2.625 / d1) * x + 0.984375; };

  /* Interpolación de los fotogramas clave de un elemento: ángulos y desplazamientos relativos a su posición base. */
  MC.KF_PROPS = ['x', 'y', 'sc', 'rot', 'op'];
  const kfDefault = { x: 0, y: 0, sc: 1, rot: 0, op: 1 };
  MC.kfValues = (kfs, local) => {
    if (!kfs || !kfs.length) return null;
    const a = kfs.slice().sort((p, q) => p.t - q.t);
    if (local <= a[0].t) return Object.assign({}, kfDefault, a[0]);
    const last = a[a.length - 1]; if (local >= last.t) return Object.assign({}, kfDefault, last);
    let i = 0; while (i < a.length - 2 && local >= a[i + 1].t) i++;
    const k0 = Object.assign({}, kfDefault, a[i]), k1 = Object.assign({}, kfDefault, a[i + 1]), u = (local - k0.t) / Math.max(1e-6, k1.t - k0.t), e = MC.curveFn(a[i].ease || 'smooth')(u);
    const out = {}; MC.KF_PROPS.forEach((p) => { out[p] = lerp(k0[p], k1[p], e); });
    return out;
  };

  /* Estado de movimiento de un elemento en el instante local (0 = inicio). Devuelve { dx, dy, sc, rot, op } o null si no se mueve. */
  MC.itemAnim = (item, local, dur) => {
    const A = item.anim, kf = item.kf; if (!A && !(kf && kf.length)) return null;
    const st = { dx: 0, dy: 0, sc: 1, rot: 0, op: 1 };
    if (kf && kf.length) { const v = MC.kfValues(kf, local); st.dx += v.x; st.dy += v.y; st.sc *= v.sc; st.rot += v.rot; st.op *= v.op; }
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
          default: break;
        }
      }
    }
    return st;
  };
  /* Combina el movimiento de un elemento con otro ya calculado (por ejemplo, los efectos de impacto de la viñeta). */
  MC.mergeAnim = (a, b) => (!a ? b : !b ? a : { dx: a.dx + b.dx, dy: a.dy + b.dy, sc: a.sc * b.sc, rot: a.rot + b.rot, op: a.op * b.op });

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
})();
