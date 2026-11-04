/* Efectos del plano: animación dentro de la viñeta (temblor, golpe, pulso, vibración), efectos de acción y ambiente,
   rack focus y aspecto global (viñeteado, grano, tramado, tinte). Se dibuja dentro de renderShot / renderFrame (PRD 7, 8, 9). */
(function () {
  const MC = window.MC;
  const { clamp } = MC;
  const nz = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const wrap1 = (v) => ((v % 1) + 1) % 1;

  MC.FX = [
    { v: 'shake', g: 'anim', dur: 0.7, es: 'Temblor', en: 'Shake' }, { v: 'impact', g: 'anim', dur: 0.6, es: 'Golpe de impacto', en: 'Impact hit' },
    { v: 'pulse', g: 'anim', dur: 1.6, es: 'Pulso', en: 'Pulse' }, { v: 'vibrate', g: 'anim', dur: 1.2, es: 'Vibración', en: 'Vibration' },
    { v: 'speed', g: 'fx', dur: 1.5, es: 'Líneas de velocidad', en: 'Speed lines' }, { v: 'focus', g: 'fx', dur: 1.2, es: 'Líneas de concentración', en: 'Focus lines' },
    { v: 'aberration', g: 'fx', dur: 0.8, es: 'Aberración cromática', en: 'Chromatic aberration' }, { v: 'flash', g: 'fx', dur: 0.4, es: 'Destello de color', en: 'Colour flash' },
    { v: 'rain', g: 'fx', dur: 3, es: 'Lluvia', en: 'Rain' }, { v: 'dust', g: 'fx', dur: 3, es: 'Polvo', en: 'Dust' }, { v: 'sparks', g: 'fx', dur: 2.5, es: 'Chispas', en: 'Sparks' },
    { v: 'snow', g: 'fx', dur: 3, es: 'Nieve', en: 'Snow' }, { v: 'smoke', g: 'fx', dur: 3, es: 'Humo', en: 'Smoke' },
  ];
  const ANIM = new Set(['shake', 'impact', 'pulse', 'vibrate']);
  const DEF_COLOR = { speed: '#ffffff', focus: '#14141c', flash: '#ffffff', rain: '#bcd4ff', dust: '#ffe9b0', sparks: '#ffb040', snow: '#ffffff', smoke: '#9aa0a8', impact: '#ffffff' };
  MC.fxName = (v) => { const f = MC.FX.find((x) => x.v === v); return f ? MC.t(f.es, f.en) : v; };
  MC.isAnimFx = (v) => ANIM.has(v);
  MC.newFx = (type, start) => {
    const d = MC.FX.find((x) => x.v === type);
    return { id: MC.uid(), type, start: Math.max(0, Math.round(start * 100) / 100), dur: d.dur, intensity: 1, layer: null, panel: null, color: DEF_COLOR[type] || '#ffffff', angle: 0 };
  };

  /* Momento del plano en que empieza un efecto. Si apunta a una viñeta, cuenta desde que la cámara llega a ella. */
  MC.pathPointTime = (path, idx) => { let t = 0; for (let i = 0; i < idx && i < path.pts.length; i++) t += path.pts[i].hold + (path.pts[i].travel || 0); return t; };
  MC.fxStart = (shot, f) => {
    if (f.panel != null && shot.camera.path) { const i = shot.camera.path.pts.findIndex((q) => q.panel === f.panel); if (i >= 0) return MC.pathPointTime(shot.camera.path, i) + f.start; }
    return f.start;
  };

  /* Animación: devuelve lo que hay que sumar a la cámara (todo el plano) o a cada capa. */
  MC.fxAnim = (shot, tl) => {
    const list = shot.fx;
    if (!list || !list.length) return null;
    const out = { cam: null, layers: {}, flash: [] };
    const add = (o, st) => { if (!o) return Object.assign({}, st); o.dx += st.dx; o.dy += st.dy; o.rot += st.rot; o.sc *= st.sc; return o; };
    let any = false;
    list.forEach((f) => {
      if (!ANIM.has(f.type)) return;
      const a = tl - MC.fxStart(shot, f);
      if (a < 0 || a >= f.dur) return;
      any = true;
      const I = f.intensity, env = 1 - a / f.dur, st = { dx: 0, dy: 0, rot: 0, sc: 1 };
      if (f.type === 'shake') { const k = Math.floor(a * 60), amp = 0.02 * I * env; st.dx = (nz(k) - 0.5) * 2 * amp; st.dy = (nz(k + 50) - 0.5) * 2 * amp; st.rot = (nz(k + 9) - 0.5) * 3 * I * env; }
      else if (f.type === 'impact') {
        const e = Math.exp((-a * 9) / (f.dur / 0.5)), k = Math.floor(a * 60), amp = 0.035 * I * e;
        st.dx = (nz(k) - 0.5) * 2 * amp; st.dy = (nz(k + 50) - 0.5) * 2 * amp; st.sc = 1 + 0.07 * I * e;
        out.flash.push({ color: f.color || '#ffffff', alpha: Math.exp(-a * 16) * clamp(I, 0, 1) * 0.9 });
      } else if (f.type === 'pulse') { st.sc = 1 + 0.05 * I * Math.sin(a * 6.2832 * 2.5) * Math.sin((Math.PI * a) / f.dur); }
      else if (f.type === 'vibrate') { const k = Math.floor(a * 45), amp = 0.004 * I; st.dx = (nz(k) - 0.5) * 2 * amp; st.dy = (nz(k + 50) - 0.5) * 2 * amp; }
      if (f.layer) out.layers[f.layer] = add(out.layers[f.layer], st); else out.cam = add(out.cam, st);
    });
    return any ? out : null;
  };

  /* Rack focus: el enfoque pasa de una capa a otra. */
  MC.rackBlur = (shot, layer, tl) => {
    const r = shot.rack;
    if (!r || !r.on || (layer.id !== r.a && layer.id !== r.b)) return 0;
    const e = MC.ease('smooth', clamp((tl - r.start) / Math.max(0.05, r.dur), 0, 1));
    return layer.id === r.a ? r.amount * e : r.amount * (1 - e);
  };

  /* ---------- efectos de acción y ambiente ---------- */
  const scratch = [];
  const mk = (i, w, h) => {
    let c = scratch[i];
    if (!c) { c = scratch[i] = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas'); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  };
  function aberration(ctx, o, off) {
    const m = ctx.getTransform(), x0 = Math.round(m.e), y0 = Math.round(m.f), w = Math.round(o.W * m.a), h = Math.round(o.H * m.d);
    if (w < 2 || h < 2) return;
    const src = mk(0, w, h), sg = src.getContext('2d');
    sg.clearRect(0, 0, w, h); sg.drawImage(ctx.canvas, x0, y0, w, h, 0, 0, w, h);
    const ch = mk(1, w, h), cg = ch.getContext('2d');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, w, h); ctx.globalCompositeOperation = 'lighter';
    [['#ff0000', off], ['#00ff00', 0], ['#0000ff', -off]].forEach((q) => {
      cg.globalCompositeOperation = 'source-over'; cg.clearRect(0, 0, w, h); cg.drawImage(src, 0, 0);
      cg.globalCompositeOperation = 'multiply'; cg.fillStyle = q[0]; cg.fillRect(0, 0, w, h);
      ctx.drawImage(ch, x0 + q[1] * m.a, y0);
    });
    ctx.restore();
  }

  function speedLines(ctx, f, a, W, H) {
    const seed = Math.floor(a * 12) * 31, n = Math.round(28 * f.intensity), u = W / 1920;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(((f.angle || 0) * Math.PI) / 180); ctx.translate(-W / 2, -H / 2);
    ctx.fillStyle = f.color || '#fff'; ctx.globalAlpha = 0.6;
    for (let i = 0; i < n; i++) {
      const y = nz(seed + i * 7) * H * 1.3 - H * 0.15, len = (0.2 + nz(seed + i * 13) * 0.55) * W, x = nz(seed + i * 3) * W * 1.2 - W * 0.1, th = (1.2 + nz(seed + i * 5) * 5) * u;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y - th / 2); ctx.lineTo(x + len, y + th / 2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function focusLines(ctx, f, a, W, H) {
    const seed = Math.floor(a * 12) * 17, n = Math.round(80 * f.intensity), R = Math.hypot(W, H) / 2, r0 = Math.min(W, H) * 0.3;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.fillStyle = f.color || '#14141c'; ctx.globalAlpha = 0.75;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * 6.2832 + (nz(seed + i) - 0.5) * 0.06, w = 0.012 + nz(seed + i * 5) * 0.03, rin = r0 * (0.85 + nz(seed + i * 9) * 0.5);
      ctx.beginPath(); ctx.moveTo(Math.cos(ang - w) * R, Math.sin(ang - w) * R); ctx.lineTo(Math.cos(ang + w) * R, Math.sin(ang + w) * R); ctx.lineTo(Math.cos(ang) * rin, Math.sin(ang) * rin); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function particles(ctx, f, a, W, H) {
    const I = f.intensity, u = W / 1920, col = f.color || '#fff';
    ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col;
    if (f.type === 'rain') {
      const n = Math.round(130 * I); ctx.lineWidth = 1.6 * u; ctx.globalAlpha = 0.55;
      for (let i = 0; i < n; i++) { const sp = 1.3 + nz(i) * 0.7, y = wrap1(nz(i * 5) + a * sp), x = nz(i * 3) * 1.25 - 0.1 - y * 0.12; ctx.beginPath(); ctx.moveTo(x * W, y * H); ctx.lineTo((x - 0.012) * W, (y - 0.06) * H); ctx.stroke(); }
    } else if (f.type === 'dust') {
      const n = Math.round(70 * I);
      for (let i = 0; i < n; i++) { const x = wrap1(nz(i) + a * 0.03 * (nz(i + 1) - 0.5) * 2), y = wrap1(nz(i * 7) - a * 0.02 * (0.3 + nz(i + 2))); ctx.globalAlpha = 0.25 + 0.4 * Math.abs(Math.sin(a * 1.3 + i)); ctx.beginPath(); ctx.arc(x * W, y * H, (1 + nz(i * 11) * 3) * u, 0, 6.2832); ctx.fill(); }
    } else if (f.type === 'sparks') {
      const n = Math.round(45 * I);
      for (let i = 0; i < n; i++) { const life = wrap1(a * 1.1 + nz(i)), x = 0.5 + (nz(i * 3) - 0.5) * 0.6 + (nz(i + 9) - 0.5) * life * 0.25, y = 1 - life * (0.3 + nz(i) * 0.6); ctx.globalAlpha = 1 - life; ctx.beginPath(); ctx.arc(x * W, y * H, (2 + nz(i * 5) * 3) * u * (1 - life * 0.5), 0, 6.2832); ctx.fill(); }
    } else if (f.type === 'snow') {
      const n = Math.round(100 * I); ctx.globalAlpha = 0.85;
      for (let i = 0; i < n; i++) { const y = wrap1(nz(i * 5) + a * 0.12 * (0.6 + nz(i))), x = nz(i) + Math.sin(a * 1.5 + i) * 0.02; ctx.beginPath(); ctx.arc(x * W, y * H, (1.5 + nz(i * 9) * 3.5) * u, 0, 6.2832); ctx.fill(); }
    } else if (f.type === 'smoke') {
      const n = Math.round(14 * I);
      for (let i = 0; i < n; i++) { const life = wrap1(a * 0.15 + nz(i)), x = 0.15 + nz(i * 3) * 0.7 + Math.sin(life * 4 + i) * 0.05, y = 1.05 - life * 1.2, r = (0.08 + nz(i * 7) * 0.12 + life * 0.08) * H; ctx.globalAlpha = 0.33 * Math.sin(Math.PI * life); ctx.beginPath(); ctx.arc(x * W, y * H, r, 0, 6.2832); ctx.fill(); }
    }
    ctx.restore();
  }

  MC.fxOverlays = (ctx, shot, tl, o, anim) => {
    const { W, H } = o, list = shot.fx || [];
    list.forEach((f) => {
      if (f.type !== 'aberration') return;
      const a = tl - MC.fxStart(shot, f);
      if (a >= 0 && a < f.dur) aberration(ctx, o, 0.008 * f.intensity * W * (1 - 0.5 * (a / f.dur)));
    });
    list.forEach((f) => {
      if (ANIM.has(f.type) || f.type === 'aberration') return;
      const a = tl - MC.fxStart(shot, f);
      if (a < 0 || a >= f.dur) return;
      const fadeIn = clamp(a / 0.12, 0, 1), fadeOut = clamp((f.dur - a) / 0.2, 0, 1);
      ctx.save(); ctx.globalAlpha = fadeIn * fadeOut;
      if (f.type === 'speed') speedLines(ctx, f, a, W, H);
      else if (f.type === 'focus') focusLines(ctx, f, a, W, H);
      else if (f.type === 'flash') { ctx.globalAlpha = Math.pow(1 - a / f.dur, 2) * clamp(f.intensity, 0, 1); ctx.fillStyle = f.color || '#fff'; ctx.fillRect(0, 0, W, H); }
      else particles(ctx, f, a, W, H);
      ctx.restore();
    });
    if (anim) anim.flash.forEach((q) => { ctx.save(); ctx.globalAlpha = q.alpha; ctx.fillStyle = q.color; ctx.fillRect(0, 0, W, H); ctx.restore(); });
  };

  /* ---------- aspecto global ---------- */
  let grainTile = null, dotTile = null;
  const tile = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
  MC.renderLook = (ctx, p, time, o) => {
    const L = p.look;
    if (!L) return;
    const { W, H } = o, u = W / 1920;
    if (L.tint && L.tint.amount > 0) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = clamp(L.tint.amount, 0, 1); ctx.fillStyle = L.tint.color; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (L.halftone > 0) {
      if (!dotTile) { dotTile = tile(16, 16); const g = dotTile.getContext('2d'); g.fillStyle = '#000'; g.beginPath(); g.arc(8, 8, 4.2, 0, 6.2832); g.fill(); }
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = clamp(L.halftone, 0, 1) * 0.4;
      ctx.translate(W / 2, H / 2); ctx.rotate(Math.PI / 4); ctx.scale(Math.max(0.6, u * 1.2), Math.max(0.6, u * 1.2));
      ctx.fillStyle = ctx.createPattern(dotTile, 'repeat'); const R = Math.hypot(W, H) / Math.max(0.6, u * 1.2); ctx.fillRect(-R, -R, R * 2, R * 2); ctx.restore();
    }
    if (L.vignette > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.55);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + clamp(L.vignette, 0, 1) * 0.85 + ')');
      ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    if (L.grain > 0) {
      if (!grainTile) { grainTile = tile(256, 256); const g = grainTile.getContext('2d'), d = g.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = (Math.random() * 255) | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }
      const k = Math.floor(time * 24);
      ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = clamp(L.grain, 0, 1) * 0.5;
      ctx.translate(-nz(k) * 256, -nz(k + 3) * 256); ctx.scale(Math.max(1, u * 1.2), Math.max(1, u * 1.2));
      ctx.fillStyle = ctx.createPattern(grainTile, 'repeat'); ctx.fillRect(0, 0, W * 2, H * 2); ctx.restore();
    }
  };
})();
