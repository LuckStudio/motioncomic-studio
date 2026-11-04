/* Motor de dibujo 2.5D: cámara, parallax, sobreescalado, huecos y transiciones.
   El visor y la exportación usan este mismo código (principio 4: lo que se ve es lo que se exporta). */
(function () {
  const MC = window.MC;
  const { clamp, lerp } = MC;

  const EASE = { linear: (t) => t, smooth: (t) => t * t * (3 - 2 * t), in: (t) => t * t, out: (t) => 1 - (1 - t) * (1 - t) };
  MC.ease = (k, t) => (EASE[k] || EASE.smooth)(clamp(t, 0, 1));
  const noise = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  MC.PARALLAX = { subtle: 0.5, normal: 1, wild: 1.6 };

  MC.shotStarts = (p) => { let t = 0; return p.shots.map((s) => { const a = t; t += s.duration; return a; }); };
  MC.totalTime = (p) => p.shots.reduce((a, s) => a + s.duration, 0);
  MC.locate = (p, time) => {
    let t = 0;
    for (let i = 0; i < p.shots.length; i++) {
      const d = p.shots[i].duration;
      if (time < t + d || i === p.shots.length - 1) return { i, tl: clamp(time - t, 0, d) };
      t += d;
    }
    return { i: 0, tl: 0 };
  };

  MC.camAt = (shot, tl, withShake) => {
    const c = shot.camera, d = Math.max(0.01, shot.duration), p = MC.ease(c.curve, tl / d);
    const z0 = c.from.zoom, z1 = c.to.zoom;
    const cam = { x: lerp(c.from.x, c.to.x, p), y: lerp(c.from.y, c.to.y, p), zoom: z0 * Math.pow(z1 / z0, p), rot: lerp(c.from.rot || 0, c.to.rot || 0, p), sx: 0, sy: 0 };
    if (withShake !== false && c.shake > 0) {
      const k = Math.floor(tl * 30), a = 0.012 * c.shake;
      cam.sx = (noise(k) - 0.5) * 2 * a;
      cam.sy = (noise(k + 99) - 0.5) * 2 * a;
      cam.rot += (noise(k + 7) - 0.5) * 2 * c.shake * 0.8;
    }
    return cam;
  };

  MC.layerGeom = (layer, img, cam, o) => {
    const I = o.parallaxI;
    return {
      f: 1 + (layer.z - 0.5) * I * 0.8, // cuánto se desplaza con la cámara
      zl: 1 + (cam.zoom - 1) * (1 + (layer.z - 0.5) * I * 0.6), // cuánto se acerca con el zoom
      base: Math.max(o.W / img.w, o.H / img.h) * (layer.scale || 1),
    };
  };

  /* Escala que necesita una capa de fondo para no dejar huecos durante todo el plano. */
  MC.coverNeeds = (layer, img, shot, o) => {
    const { W, H } = o, out = [];
    const shake = shot.camera.shake || 0;
    for (let k = 0; k <= 4; k++) {
      const cam = MC.camAt(shot, (shot.duration * k) / 4, false);
      const g = MC.layerGeom(layer, img, cam, o);
      const r = Math.abs(cam.rot) * Math.PI / 180 + shake * 0.8 * Math.PI / 180;
      const rk = Math.abs(Math.cos(r)) + Math.abs(Math.sin(r)) * Math.max(W / H, H / W);
      const camx = W / 2 + cam.x * W * g.f, camy = H / 2 + cam.y * H * g.f;
      const nx = Math.abs(W / 2 + (layer.x || 0) * W - camx) + (W / (2 * g.zl)) * rk + shake * 0.014 * W;
      const ny = Math.abs(H / 2 + (layer.y || 0) * H - camy) + (H / (2 * g.zl)) * rk + shake * 0.014 * H;
      out.push({ nx, ny, zl: g.zl });
    }
    return out;
  };
  MC.coverScale = (layer, img, shot, o) => {
    let s = 0;
    MC.coverNeeds(layer, img, shot, o).forEach((n) => { s = Math.max(s, n.nx / (img.w / 2), n.ny / (img.h / 2)); });
    return s * 1.003;
  };
  /* Escala con la que se dibuja la capa de verdad (incluye sobreescalado automático). */
  MC.effScale = (layer, img, shot, o) => {
    const base = Math.max(o.W / img.w, o.H / img.h) * (layer.scale || 1);
    return o.overscan && layer.role === 'fondo' ? Math.max(base, MC.coverScale(layer, img, shot, o)) : base;
  };
  /* Margen seguro del plano: cuánto se puede mover la cámara sin enseñar huecos (fracción del encuadre). Negativo = hay huecos. */
  MC.safeMargin = (shot, o) => {
    let mx = Infinity, my = Infinity, any = false;
    shot.layers.forEach((l) => {
      const img = o.getImg(l.assetId);
      if (!img || l.role !== 'fondo' || l.visible === false) return;
      any = true;
      const s = MC.effScale(l, img, shot, o);
      MC.coverNeeds(l, img, shot, o).forEach((n) => {
        mx = Math.min(mx, (img.w * s / 2 - n.nx) / o.W);
        my = Math.min(my, (img.h * s / 2 - n.ny) / o.H);
      });
    });
    return any ? { x: mx, y: my } : null;
  };

  MC.renderShot = (ctx, shot, tl, o) => {
    const { W, H } = o;
    const cam = o.cam || MC.camAt(shot, tl);
    ctx.save();
    if (!o.noClip) {
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      const hasBg = shot.layers.some((l) => l.role === 'fondo' && l.visible !== false);
      ctx.fillStyle = o.holes && hasBg ? '#E5333D' : '#000';
      ctx.fillRect(0, 0, W, H);
    }
    for (const layer of shot.layers) {
      if (layer.visible === false) continue;
      const img = o.getImg(layer.assetId);
      if (!img) continue;
      const g = MC.layerGeom(layer, img, cam, o);
      const s = MC.effScale(layer, img, shot, o);
      const camx = W / 2 + (cam.x + cam.sx) * W * g.f, camy = H / 2 + (cam.y + cam.sy) * H * g.f;
      const lx = W / 2 + (layer.x || 0) * W, ly = H / 2 + (layer.y || 0) * H;
      ctx.save();
      ctx.globalAlpha = layer.opacity == null ? 1 : layer.opacity;
      if (layer.blur > 0 && o.fx !== false) ctx.filter = 'blur(' + (layer.blur * W / 1920).toFixed(2) + 'px)';
      ctx.translate(W / 2, H / 2);
      if (cam.rot) ctx.rotate((cam.rot * Math.PI) / 180);
      ctx.scale(g.zl, g.zl);
      ctx.translate(-camx, -camy);
      ctx.drawImage(img.bitmap, lx - (img.w * s) / 2, ly - (img.h * s) / 2, img.w * s, img.h * s);
      ctx.restore();
    }
    ctx.restore();
  };

  MC.TRANSITIONS = [
    { v: 'cut', es: 'Corte', en: 'Cut' }, { v: 'fade', es: 'Fundido', en: 'Fade' },
    { v: 'flash', es: 'Destello', en: 'Flash' }, { v: 'wipe', es: 'Barrido', en: 'Wipe' },
  ];

  MC.renderFrame = (ctx, project, time, o) => {
    const { W, H } = o;
    const { i, tl } = MC.locate(project, time);
    const cur = project.shots[i];
    if (!cur) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
    const tr = cur.transition || { type: 'cut' };
    const dur = Math.min(tr.dur || 0.6, cur.duration * 0.9);
    if (i > 0 && tr.type !== 'cut' && tl < dur) {
      const prev = project.shots[i - 1], p = tl / dur;
      const drawPrev = () => MC.renderShot(ctx, prev, prev.duration, o);
      const drawCur = () => MC.renderShot(ctx, cur, tl, o);
      const veil = (rgb, a) => { ctx.fillStyle = 'rgba(' + rgb + ',' + clamp(a, 0, 1) + ')'; ctx.fillRect(0, 0, W, H); };
      if (tr.type === 'fade') { if (p < 0.5) { drawPrev(); veil('0,0,0', p * 2); } else { drawCur(); veil('0,0,0', (1 - p) * 2); } return; }
      if (tr.type === 'flash') { const a = p < 0.3 ? p / 0.3 : (1 - p) / 0.7; if (p < 0.3) drawPrev(); else drawCur(); veil('255,255,255', a); return; }
      if (tr.type === 'wipe') {
        const e = MC.ease('smooth', p);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(-W * e * 0.3, 0); drawPrev(); ctx.restore();
        ctx.save(); ctx.translate(W * (1 - e), 0); drawCur(); ctx.restore();
        return;
      }
    }
    MC.renderShot(ctx, cur, tl, o);
  };

  MC.renderOpts = (project, extra) => {
    const s = MC.frameSize(project.ratio, project.res);
    return Object.assign({ W: s.w, H: s.h, getImg: (id) => MC.assets.get(id), parallaxI: MC.PARALLAX[project.parallax] || 1, overscan: project.overscan !== false }, extra || {});
  };

  MC.makeThumb = (project) => {
    try {
      const o = MC.renderOpts(project);
      const c = document.createElement('canvas');
      const k = 360 / Math.max(o.W, o.H);
      c.width = Math.round(o.W * k); c.height = Math.round(o.H * k);
      const ctx = c.getContext('2d');
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const sh = project.shots[0];
      MC.renderFrame(ctx, project, sh ? Math.min(0.4, sh.duration * 0.1) : 0, o);
      return c.toDataURL('image/jpeg', 0.7);
    } catch (e) { return ''; }
  };
})();
