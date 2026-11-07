/* Efectos del plano: animación dentro de la viñeta (temblor, golpe, pulso, vibración), efectos de acción y ambiente,
   rack focus y aspecto global (viñeteado, grano, tramado, tinte). Se dibuja dentro de renderShot / renderFrame (PRD 7, 8, 9). */
(function () {
  const MC = window.MC;
  const { clamp } = MC;
  let FXA = 1; // opacidad del efecto en curso (entrada, salida y opacidad propia), que respetan también las partículas
  let SEED = 0; // variación del efecto en curso (f.seed): cambia el azar sin cambiar el aspecto
  const nz = (i) => { const s = Math.sin((i + SEED * 977) * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const wrap1 = (v) => ((v % 1) + 1) % 1;

  MC.FX = [
    { v: 'shake', g: 'anim', dur: 0.7, es: 'Temblor', en: 'Shake' }, { v: 'impact', g: 'anim', dur: 0.6, es: 'Golpe de impacto', en: 'Impact hit' },
    { v: 'pulse', g: 'anim', dur: 1.6, es: 'Pulso', en: 'Pulse' }, { v: 'vibrate', g: 'anim', dur: 1.2, es: 'Vibración', en: 'Vibration' },
    { v: 'speed', g: 'fx', dur: 1.5, es: 'Líneas de velocidad', en: 'Speed lines' }, { v: 'focus', g: 'fx', dur: 1.2, es: 'Líneas de concentración', en: 'Focus lines' },
    { v: 'aberration', g: 'fx', dur: 0.8, es: 'Aberración cromática', en: 'Chromatic aberration' }, { v: 'flash', g: 'fx', dur: 0.4, es: 'Destello de color', en: 'Colour flash' },
    { v: 'rain', g: 'fx', dur: 3, es: 'Lluvia', en: 'Rain' }, { v: 'dust', g: 'fx', dur: 3, es: 'Polvo', en: 'Dust' }, { v: 'sparks', g: 'fx', dur: 2.5, es: 'Chispas', en: 'Sparks' },
    { v: 'snow', g: 'fx', dur: 3, es: 'Nieve', en: 'Snow' }, { v: 'smoke', g: 'fx', dur: 3, es: 'Humo', en: 'Smoke' },
    { v: 'fog', g: 'fx', dur: 4, es: 'Niebla', en: 'Fog' }, { v: 'beam', g: 'fx', dur: 4, es: 'Haces de luz', en: 'Light beams' },
    { v: 'pixelate', g: 'style', dur: 2, es: 'Pixelado', en: 'Pixelate' }, { v: 'posterize', g: 'style', dur: 3, es: 'Posterizado', en: 'Posterize' }, { v: 'duotone', g: 'style', dur: 3, es: 'Duotono', en: 'Duotone' },
    { v: 'glitch', g: 'style', dur: 1.2, es: 'Glitch', en: 'Glitch' }, { v: 'vhs', g: 'style', dur: 3, es: 'Cinta VHS', en: 'VHS tape' }, { v: 'edges', g: 'style', dur: 3, es: 'Contorno de tinta', en: 'Ink outline' }, { v: 'htone', g: 'style', dur: 3, es: 'Trama de puntos', en: 'Halftone dots' },
  ];
  /* efectos de estilo: retocan la imagen ya dibujada del plano */
  const STYLE = new Set(['pixelate', 'posterize', 'duotone', 'glitch', 'vhs', 'edges', 'htone']);
  MC.isStyleFx = (v) => STYLE.has(v) || !!(MC.FX2 && MC.FX2.styleSet.has(v));
  const DEF_PARAMS = { pixelate: { size: 16 }, posterize: { lv: 4 }, duotone: { color2: '#ffd36e', mix: 1 }, glitch: { shift: 0.06, split: 0.012, rate: 14 }, vhs: { lines: 3, noise: 0.5, wobble: 0.5, bleed: 0.5 }, edges: { thresh: 0.25, thick: 1.5, mix: 1, only: false }, htone: { size: 10, mix: 1 } };
  MC.FX_PARAMS = DEF_PARAMS;
  const ANIM = new Set(['shake', 'impact', 'pulse', 'vibrate']);
  const DEF_COLOR = { duotone: '#1b1464', edges: '#0b0b10', htone: '#111111', speed: '#ffffff', focus: '#14141c', flash: '#ffffff', rain: '#bcd4ff', dust: '#ffe9b0', sparks: '#ffb040', snow: '#ffffff', smoke: '#9aa0a8', impact: '#ffffff', fog: '#cfd6e6', beam: '#fff1bf' };
  MC.fxName = (v) => { const f = MC.FX.find((x) => x.v === v); return f ? MC.t(f.es, f.en) : v; };
  MC.isAnimFx = (v) => ANIM.has(v) || !!(MC.FX2 && MC.FX2.anim[v]);
  MC.newFx = (type, start) => {
    const d = MC.FX.find((x) => x.v === type);
    return Object.assign({ id: MC.uid(), type, start: Math.max(0, Math.round(start * 100) / 100), dur: d.dur, intensity: 1, layer: null, panel: null, color: DEF_COLOR[type] || '#ffffff', angle: 0 }, DEF_PARAMS[type] || {}, (MC.FX2 && MC.FX2.defaults[type]) || {});
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
      if (!ANIM.has(f.type) && !(MC.FX2 && MC.FX2.anim[f.type])) return;
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
      else if (MC.FX2 && MC.FX2.anim[f.type]) { SEED = f.seed || 0; Object.assign(st, MC.FX2.anim[f.type](f, a * (f.speed == null ? 1 : f.speed), I, env)); }
      else if (f.type === 'vibrate') { const k = Math.floor(a * 45), amp = 0.004 * I; st.dx = (nz(k) - 0.5) * 2 * amp; st.dy = (nz(k + 50) - 0.5) * 2 * amp; }
      if (f.layer) out.layers[f.layer] = add(out.layers[f.layer], st); else out.cam = add(out.cam, st);
    });
    return any ? out : null;
  };

  /* Rack focus: el enfoque pasa de una capa a otra. */
  /* Profundidad de campo: las capas se desenfocan según lo lejos que estén de la profundidad enfocada (shot.dof = { on, focus, range, amount }) */
  MC.dofBlur = (shot, layer) => {
    const d = shot.dof; if (!d || !d.on) return 0;
    return (d.amount == null ? 14 : d.amount) * clamp((Math.abs(layer.z - (d.focus == null ? 0.5 : d.focus)) - (d.range == null ? 0.08 : d.range)) / 0.5, 0, 1);
  };
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
    ctx.fillStyle = f.color || '#fff'; ctx.globalAlpha = FXA * 0.6;
    for (let i = 0; i < n; i++) {
      const y = nz(seed + i * 7) * H * 1.3 - H * 0.15, len = (0.2 + nz(seed + i * 13) * 0.55) * W, x = nz(seed + i * 3) * W * 1.2 - W * 0.1, th = (1.2 + nz(seed + i * 5) * 5) * u;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y - th / 2); ctx.lineTo(x + len, y + th / 2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function focusLines(ctx, f, a, W, H) {
    const seed = Math.floor(a * 12) * 17, n = Math.round(80 * f.intensity), R = Math.hypot(W, H) / 2, r0 = Math.min(W, H) * 0.3;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.fillStyle = f.color || '#14141c'; ctx.globalAlpha = FXA * 0.75;
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
      const n = Math.round(130 * I); ctx.lineWidth = 1.6 * u; ctx.globalAlpha = FXA * 0.55;
      for (let i = 0; i < n; i++) { const sp = 1.3 + nz(i) * 0.7, y = wrap1(nz(i * 5) + a * sp), x = nz(i * 3) * 1.25 - 0.1 - y * 0.12; ctx.beginPath(); ctx.moveTo(x * W, y * H); ctx.lineTo((x - 0.012) * W, (y - 0.06) * H); ctx.stroke(); }
    } else if (f.type === 'dust') {
      const n = Math.round(70 * I);
      for (let i = 0; i < n; i++) { const x = wrap1(nz(i) + a * 0.03 * (nz(i + 1) - 0.5) * 2), y = wrap1(nz(i * 7) - a * 0.02 * (0.3 + nz(i + 2))); ctx.globalAlpha = FXA * 0.25 + 0.4 * Math.abs(Math.sin(a * 1.3 + i)); ctx.beginPath(); ctx.arc(x * W, y * H, (1 + nz(i * 11) * 3) * u, 0, 6.2832); ctx.fill(); }
    } else if (f.type === 'sparks') {
      const n = Math.round(45 * I);
      for (let i = 0; i < n; i++) { const life = wrap1(a * 1.1 + nz(i)), x = 0.5 + (nz(i * 3) - 0.5) * 0.6 + (nz(i + 9) - 0.5) * life * 0.25, y = 1 - life * (0.3 + nz(i) * 0.6); ctx.globalAlpha = FXA * 1 - life; ctx.beginPath(); ctx.arc(x * W, y * H, (2 + nz(i * 5) * 3) * u * (1 - life * 0.5), 0, 6.2832); ctx.fill(); }
    } else if (f.type === 'snow') {
      const n = Math.round(100 * I); ctx.globalAlpha = FXA * 0.85;
      for (let i = 0; i < n; i++) { const y = wrap1(nz(i * 5) + a * 0.12 * (0.6 + nz(i))), x = nz(i) + Math.sin(a * 1.5 + i) * 0.02; ctx.beginPath(); ctx.arc(x * W, y * H, (1.5 + nz(i * 9) * 3.5) * u, 0, 6.2832); ctx.fill(); }
    } else if (f.type === 'smoke') {
      const n = Math.round(14 * I);
      for (let i = 0; i < n; i++) { const life = wrap1(a * 0.15 + nz(i)), x = 0.15 + nz(i * 3) * 0.7 + Math.sin(life * 4 + i) * 0.05, y = 1.05 - life * 1.2, r = (0.08 + nz(i * 7) * 0.12 + life * 0.08) * H; ctx.globalAlpha = FXA * 0.33 * Math.sin(Math.PI * life); ctx.beginPath(); ctx.arc(x * W, y * H, r, 0, 6.2832); ctx.fill(); }
    }
    ctx.restore();
  }

  /* Niebla: manchas grandes y suaves que se desplazan. Haces de luz: franjas inclinadas que se mecen. */
  function ambient(ctx, f, a, W, H) {
    const I = clamp(f.intensity, 0, 3), col = f.color || '#fff';
    const rgb = (() => { const m = /^#?([0-9a-f]{6})$/i.exec(col); const n = m ? parseInt(m[1], 16) : 0xffffff; return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(','); })();
    if (f.type === 'fog') {
      const n = 9;
      for (let i = 0; i < n; i++) {
        const dir = i % 2 ? 1 : -1, x = (wrap1(nz(i * 3) + a * 0.035 * dir * (0.6 + nz(i))) * 1.5 - 0.25) * W, y = (0.45 + nz(i * 7) * 0.55) * H, r = (0.28 + nz(i * 11) * 0.3) * Math.max(W, H);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + rgb + ',' + 0.2 * Math.min(1.5, I) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    } else {
      const n = 5; ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < n; i++) {
        const sway = Math.sin(a * 0.6 + i * 1.7) * 0.03, top = (0.05 + i * 0.2 + sway) * W, wid = (0.05 + nz(i * 5) * 0.06) * W, lean = 0.35 * H, op = (0.55 + 0.45 * Math.sin(a * 0.9 + i * 2.3)) * 0.3 * Math.min(1.5, I);
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(' + rgb + ',' + op + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(top, -2); ctx.lineTo(top + wid, -2); ctx.lineTo(top + wid + lean + wid * 0.8, H); ctx.lineTo(top + lean, H); ctx.closePath(); ctx.fill();
      }
    }
  }

  /* ---- efectos de estilo (post-proceso de la zona del plano) ---- */
  const regionOf = (ctx, o) => { const m = ctx.getTransform(), x0 = Math.round(m.e), y0 = Math.round(m.f), w = Math.round(o.W * m.a), h = Math.round(o.H * m.d); return w < 4 || h < 4 ? null : { x0, y0, w, h, u: (o.W / 1920) * m.a }; };
  const hexN = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); const n = m ? parseInt(m[1], 16) : 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lumAt = (d, i) => (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
  function styleFx(ctx, o, f, a, k) {
    const R = regionOf(ctx, o); if (!R) return;
    const { x0, y0, w, h, u } = R, I = clamp(f.intensity == null ? 1 : f.intensity, 0.1, 3), mixv = f.mix == null ? 1 : f.mix;
    if (f.type === 'glitch') { const ts = Math.floor(a * (f.rate || 14)); if (nz(ts * 7 + 3) < 0.45 / Math.max(0.5, I)) return; aberration(ctx, o, (f.split == null ? 0.012 : f.split) * I * o.W * (0.4 + nz(ts * 5))); }
    const src = mk(0, w, h), sg = src.getContext('2d'); sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1; sg.clearRect(0, 0, w, h); sg.drawImage(ctx.canvas, x0, y0, w, h, 0, 0, w, h);
    const res = mk(3, w, h), rg = res.getContext('2d'); rg.setTransform(1, 0, 0, 1, 0, 0); rg.globalCompositeOperation = 'source-over'; rg.globalAlpha = 1; rg.imageSmoothingEnabled = true; rg.clearRect(0, 0, w, h);
    let alpha = k;
    if (f.type === 'pixelate') {
      const s2 = Math.max(1, Math.round((f.size || 16) * u * I)), sw = Math.max(1, Math.ceil(w / s2)), sh2 = Math.max(1, Math.ceil(h / s2)), sm = mk(4, sw, sh2), mg = sm.getContext('2d');
      mg.setTransform(1, 0, 0, 1, 0, 0); mg.imageSmoothingEnabled = true; mg.clearRect(0, 0, sw, sh2); mg.drawImage(src, 0, 0, sw, sh2); rg.imageSmoothingEnabled = false; rg.drawImage(sm, 0, 0, sw, sh2, 0, 0, sw * s2, sh2 * s2);
    } else if (f.type === 'posterize' || f.type === 'duotone') {
      const im = sg.getImageData(0, 0, w, h), d = im.data;
      if (f.type === 'posterize') { const lv = clamp(Math.round(f.lv || 4), 2, 16) - 1; for (let i = 0; i < d.length; i += 4) { d[i] = Math.round((d[i] / 255) * lv) / lv * 255; d[i + 1] = Math.round((d[i + 1] / 255) * lv) / lv * 255; d[i + 2] = Math.round((d[i + 2] / 255) * lv) / lv * 255; } }
      else { const c1 = hexN(f.color), c2 = hexN(f.color2); for (let i = 0; i < d.length; i += 4) { const l = lumAt(d, i); d[i] = c1[0] + (c2[0] - c1[0]) * l; d[i + 1] = c1[1] + (c2[1] - c1[1]) * l; d[i + 2] = c1[2] + (c2[2] - c1[2]) * l; } }
      rg.putImageData(im, 0, 0); if (f.type === 'duotone') alpha *= mixv;
    } else if (f.type === 'glitch') {
      const ts = Math.floor(a * (f.rate || 14)), n = Math.round(5 + 12 * I); rg.drawImage(src, 0, 0);
      for (let i = 0; i < n; i++) { const yy = nz(ts * 13 + i) * h, hh = (0.01 + nz(ts * 17 + i * 3) * 0.07) * h, dx = (nz(ts * 19 + i * 5) - 0.5) * 2 * (f.shift == null ? 0.06 : f.shift) * w * Math.min(1.5, I); rg.drawImage(src, 0, yy, w, hh, dx, yy, w, hh); }
    } else if (f.type === 'vhs') {
      const band = Math.max(1, Math.round(2 * u)), wob = (f.wobble == null ? 0.5 : f.wobble) * 4 * u * I, trk = ((a * 0.25) % 1) * h, bl = (f.bleed == null ? 0.5 : f.bleed) * 3 * u;
      for (let y = 0; y < h; y += band) { const near = Math.max(0, 1 - Math.abs(y - trk) / (h * 0.06)), dx = Math.sin(y * 0.045 + a * 9) * wob + near * (nz(Math.floor(a * 24) + y) - 0.3) * 26 * u * I; rg.drawImage(src, 0, y, w, band, dx + bl, y, w, band); }
      rg.globalCompositeOperation = 'lighter'; rg.globalAlpha = 0.35; rg.drawImage(src, -bl * 1.6, 0); rg.globalCompositeOperation = 'source-over'; rg.globalAlpha = 1;
      const ls = Math.max(2, Math.round((f.lines || 3) * u)); rg.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < h; y += ls * 2) rg.fillRect(0, y, w, ls);
      const nn = Math.round(((f.noise == null ? 0.5 : f.noise) * w * h) / 2600 * I), fr = Math.floor(a * 24); rg.fillStyle = '#fff'; for (let i = 0; i < nn; i++) { rg.globalAlpha = 0.15 + nz(fr * 31 + i * 7) * 0.5; rg.fillRect(nz(fr * 11 + i) * w, nz(fr * 13 + i * 3) * h, 1 + nz(i) * 12 * u, Math.max(1, u)); } rg.globalAlpha = 1;
    } else if (f.type === 'edges') {
      const sw = clamp(Math.round(w / Math.max(1, f.thick || 1.5)), 160, 1100), sh2 = Math.max(2, Math.round((sw * h) / w)), sm = mk(4, sw, sh2), mg = sm.getContext('2d');
      mg.setTransform(1, 0, 0, 1, 0, 0); mg.imageSmoothingEnabled = true; mg.clearRect(0, 0, sw, sh2); mg.drawImage(src, 0, 0, sw, sh2);
      const im = mg.getImageData(0, 0, sw, sh2), d = im.data, L = new Float32Array(sw * sh2); for (let i = 0, j = 0; i < d.length; i += 4, j++) L[j] = lumAt(d, i);
      const col = hexN(f.color), th = f.thresh == null ? 0.25 : f.thresh, ed = mg.createImageData(sw, sh2), e = ed.data;
      for (let y = 1; y < sh2 - 1; y++) for (let x = 1; x < sw - 1; x++) { const j = y * sw + x, gx = -L[j - sw - 1] - 2 * L[j - 1] - L[j + sw - 1] + L[j - sw + 1] + 2 * L[j + 1] + L[j + sw + 1], gy = -L[j - sw - 1] - 2 * L[j - sw] - L[j - sw + 1] + L[j + sw - 1] + 2 * L[j + sw] + L[j + sw + 1], g = Math.sqrt(gx * gx + gy * gy), al = clamp((g - th) / Math.max(0.02, th * 0.6), 0, 1), q = j * 4; e[q] = col[0]; e[q + 1] = col[1]; e[q + 2] = col[2]; e[q + 3] = al * 255; }
      mg.putImageData(ed, 0, 0);
      if (f.only) { rg.fillStyle = '#ffffff'; rg.fillRect(0, 0, w, h); } else rg.drawImage(src, 0, 0);
      rg.imageSmoothingEnabled = true; rg.drawImage(sm, 0, 0, sw, sh2, 0, 0, w, h); alpha *= mixv;
    } else if (f.type === 'htone') {
      const cell = Math.max(3, Math.round((f.size || 10) * u * I)), cols = Math.ceil(w / cell), rows = Math.ceil(h / cell), sm = mk(4, cols, rows), mg = sm.getContext('2d');
      mg.setTransform(1, 0, 0, 1, 0, 0); mg.imageSmoothingEnabled = true; mg.clearRect(0, 0, cols, rows); mg.drawImage(src, 0, 0, cols, rows);
      const d = mg.getImageData(0, 0, cols, rows).data; rg.fillStyle = '#ffffff'; rg.fillRect(0, 0, w, h); rg.fillStyle = f.color || '#111111';
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const l = lumAt(d, (y * cols + x) * 4), r = cell * 0.72 * Math.sqrt(1 - l); if (r > 0.4) { rg.beginPath(); rg.arc((x + 0.5) * cell, (y + 0.5) * cell, r, 0, 6.2832); rg.fill(); } }
      alpha *= mixv;
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip(); ctx.globalAlpha = clamp(alpha, 0, 1); ctx.drawImage(res, x0, y0); ctx.restore();
  }
  MC.fxKit = { mk, regionOf, hexN, lumAt, nz };
  /* ajustes comunes a todos los efectos: velocidad, tamaño, opacidad, entrada y salida, mezcla y variación */
  const fxTime = (f, a) => a * (f.speed == null ? 1 : f.speed);
  MC.fxOverlays = (ctx, shot, tl, o, anim) => {
    const { W, H } = o, list = shot.fx || [];
    list.forEach((f) => {
      if (f.type !== 'aberration') return;
      const a = tl - MC.fxStart(shot, f);
      if (a >= 0 && a < f.dur) aberration(ctx, o, 0.008 * f.intensity * W * (1 - 0.5 * (a / f.dur)) * (f.opacity == null ? 1 : f.opacity));
    });
    list.forEach((f) => {
      if (ANIM.has(f.type) || f.type === 'aberration') return;
      if (MC.FX2 && MC.FX2.anim[f.type] && !MC.FX2.has(f.type)) return;
      const a0 = tl - MC.fxStart(shot, f);
      if (a0 < 0 || a0 >= f.dur) return;
      SEED = f.seed || 0;
      const a = fxTime(f, a0), fadeIn = clamp(a0 / Math.max(0.01, f.fadeIn == null ? 0.12 : f.fadeIn), 0, 1), fadeOut = clamp((f.dur - a0) / Math.max(0.01, f.fadeOut == null ? 0.2 : f.fadeOut), 0, 1);
      if (STYLE.has(f.type)) { styleFx(ctx, o, f, a, fadeIn * fadeOut * (f.opacity == null ? 1 : f.opacity)); return; }
      if (MC.FX2 && MC.FX2.has(f.type)) { const kk = fadeIn * fadeOut * (f.opacity == null ? 1 : f.opacity); ctx.save(); if (f.blend && !MC.FX2.post[f.type]) ctx.globalCompositeOperation = f.blend; (MC.FX2.post[f.type] || MC.FX2.draw[f.type])(ctx, o, f, a, kk); ctx.restore(); return; }
      FXA = fadeIn * fadeOut * (f.opacity == null ? 1 : f.opacity);
      ctx.save(); ctx.globalAlpha = FXA; if (f.blend) ctx.globalCompositeOperation = f.blend;
      if (f.scale && f.scale !== 1) { ctx.translate(W / 2, H / 2); ctx.scale(f.scale, f.scale); ctx.translate(-W / 2, -H / 2); }
      if (f.type === 'speed') speedLines(ctx, f, a, W, H);
      else if (f.type === 'focus') focusLines(ctx, f, a, W, H);
      else if (f.type === 'flash') { ctx.globalAlpha = FXA * Math.pow(1 - a / f.dur, 2) * clamp(f.intensity, 0, 1); ctx.fillStyle = f.color || '#fff'; ctx.fillRect(0, 0, W, H); }
      else if (f.type === 'fog' || f.type === 'beam') ambient(ctx, f, a, W, H);
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
    /* corrección de color de todo el fotograma: saturación, contraste, brillo y temperatura */
    const sat = L.sat == null ? 1 : L.sat, con = L.contrast == null ? 1 : L.contrast, bri = L.bright == null ? 1 : L.bright;
    if (Math.abs(sat - 1) > 0.005 || Math.abs(con - 1) > 0.005 || Math.abs(bri - 1) > 0.005) {
      const m = ctx.getTransform(), x0 = Math.round(m.e), y0 = Math.round(m.f), w = Math.round(W * m.a), h = Math.round(H * m.d);
      if (w > 1 && h > 1) {
        const tmp = mk(2, w, h), tg = tmp.getContext('2d'); tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, w, h); tg.drawImage(ctx.canvas, x0, y0, w, h, 0, 0, w, h);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
        ctx.filter = 'saturate(' + sat + ') contrast(' + con + ') brightness(' + bri + ')'; ctx.drawImage(tmp, x0, y0); ctx.filter = 'none'; ctx.restore();
      }
    }
    if (L.warm) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = clamp(Math.abs(L.warm), 0, 1) * 0.7; ctx.fillStyle = L.warm > 0 ? '#ff9a3c' : '#3c8cff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
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
