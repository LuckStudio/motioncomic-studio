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

  /* Trayectoria con varios puntos (modo Página): mantiene cada viñeta y viaja a la siguiente. */
  MC.pathDuration = (path) => path.pts.reduce((a, q, i) => a + q.hold + (i < path.pts.length - 1 ? q.travel || 0 : 0), 0);
  function pathCam(path, tl) {
    const pts = path.pts;
    let t = tl;
    const from = (q, drift) => ({ x: q.x, y: q.y, zoom: q.zoom * (1 + (path.drift || 0) * drift), rot: 0, sx: 0, sy: 0, rect: q.rect });
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i];
      if (t < q.hold) return from(q, t / Math.max(0.01, q.hold));
      t -= q.hold;
      if (i < pts.length - 1) {
        const tr = q.travel || 0;
        if (t < tr) {
          const e = MC.ease(path.curve || 'smooth', t / tr), n = pts[i + 1], a = from(q, 1), b = from(n, 0), r = a.rect && b.rect ? { x0: lerp(a.rect.x0, b.rect.x0, e), y0: lerp(a.rect.y0, b.rect.y0, e), x1: lerp(a.rect.x1, b.rect.x1, e), y1: lerp(a.rect.y1, b.rect.y1, e) } : b.rect;
          return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), zoom: a.zoom * Math.pow(b.zoom / a.zoom, e), rot: 0, sx: 0, sy: 0, rect: r };
        }
        t -= tr;
      }
    }
    return from(pts[pts.length - 1], 1);
  }
  MC.camAt = (shot, tl, withShake) => {
    if (shot.camera.path && shot.camera.path.pts.length) return pathCam(shot.camera.path, tl);
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

  /* Caja de la capa: escala base y centro. Una capa de PSD recortada (layer.doc) conserva su sitio dentro del documento. */
  MC.layerBox = (layer, img, o, s) => {
    const doc = layer.doc;
    const s0 = doc ? Math.max(o.W / doc.w, o.H / doc.h) : Math.max(o.W / img.w, o.H / img.h);
    const base = s0 * (layer.scale || 1), sc = s == null ? base : s;
    const dx = doc ? doc.left + img.w / 2 - doc.w / 2 : 0, dy = doc ? doc.top + img.h / 2 - doc.h / 2 : 0;
    return { base, s: sc, dx, dy, cx: o.W / 2 + dx * sc + (layer.x || 0) * o.W, cy: o.H / 2 + dy * sc + (layer.y || 0) * o.H };
  };
  MC.layerGeom = (layer, img, cam, o) => {
    const I = o.parallaxI;
    return {
      f: 1 + (layer.z - 0.5) * I * 0.8, // cuánto se desplaza con la cámara
      zl: 1 + (cam.zoom - 1) * (1 + (layer.z - 0.5) * I * 0.6), // cuánto se acerca con el zoom
      base: MC.layerBox(layer, img, o).base,
    };
  };

  /* Muestras de cámara a lo largo del plano para saber qué debe cubrir una capa de fondo. */
  MC.coverNeeds = (layer, img, shot, o) => {
    const { W, H } = o, out = [];
    const shake = shot.camera.shake || 0;
    const N = shot.camera.path ? 24 : 4;
    for (let k = 0; k <= N; k++) {
      const cam = MC.camAt(shot, (shot.duration * k) / N, false);
      const g = MC.layerGeom(layer, img, cam, o);
      const r = Math.abs(cam.rot) * Math.PI / 180 + shake * 0.8 * Math.PI / 180;
      const rk = Math.abs(Math.cos(r)) + Math.abs(Math.sin(r)) * Math.max(W / H, H / W);
      out.push({
        Ax: W / 2 + (layer.x || 0) * W - (W / 2 + cam.x * W * g.f), Bx: (W / (2 * g.zl)) * rk + shake * 0.014 * W,
        Ay: H / 2 + (layer.y || 0) * H - (H / 2 + cam.y * H * g.f), By: (H / (2 * g.zl)) * rk + shake * 0.014 * H, zl: g.zl,
      });
    }
    return out;
  };
  MC.coverScale = (layer, img, shot, o) => {
    const box = MC.layerBox(layer, img, o), hw = img.w / 2, hh = img.h / 2;
    let s = 0;
    const need = (v, c) => { if (c > 1e-6) s = Math.max(s, v / c); };
    MC.coverNeeds(layer, img, shot, o).forEach((n) => {
      need(n.Ax + n.Bx, hw - box.dx); need(-n.Ax + n.Bx, hw + box.dx);
      need(n.Ay + n.By, hh - box.dy); need(-n.Ay + n.By, hh + box.dy);
    });
    return s * 1.003;
  };
  /* Escala con la que se dibuja la capa de verdad (incluye sobreescalado automático). */
  MC.effScale = (layer, img, shot, o) => {
    const base = MC.layerBox(layer, img, o).base;
    return o.overscan && layer.role === 'fondo' ? Math.max(base, MC.coverScale(layer, img, shot, o)) : base;
  };
  /* Margen seguro del plano: cuánto se puede mover la cámara sin enseñar huecos (fracción del encuadre). Negativo = hay huecos. */
  MC.safeMargin = (shot, o) => {
    let mx = Infinity, my = Infinity, any = false;
    shot.layers.forEach((l) => {
      const img = o.getImg(l.assetId);
      if (!img || l.role !== 'fondo' || l.visible === false) return;
      any = true;
      const s = MC.effScale(l, img, shot, o), box = MC.layerBox(l, img, o, s), hw = img.w / 2, hh = img.h / 2;
      MC.coverNeeds(l, img, shot, o).forEach((n) => {
        mx = Math.min(mx, (s * (hw - box.dx) - (n.Ax + n.Bx)) / o.W, (s * (hw + box.dx) - (-n.Ax + n.Bx)) / o.W);
        my = Math.min(my, (s * (hh - box.dy) - (n.Ay + n.By)) / o.H, (s * (hh + box.dy) - (-n.Ay + n.By)) / o.H);
      });
    });
    return any ? { x: mx, y: my } : null;
  };

  const BLEND = { multiply: 1, screen: 1, overlay: 1, darken: 1, lighten: 1, 'color-dodge': 1, 'color-burn': 1, 'hard-light': 1, 'soft-light': 1, difference: 1, exclusion: 1 };
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
      const box = MC.layerBox(layer, img, o, MC.effScale(layer, img, shot, o));
      const camx = W / 2 + (cam.x + cam.sx) * W * g.f, camy = H / 2 + (cam.y + cam.sy) * H * g.f;
      ctx.save();
      ctx.globalAlpha = layer.opacity == null ? 1 : layer.opacity;
      if (layer.blend && BLEND[layer.blend]) ctx.globalCompositeOperation = layer.blend;
      if (layer.blur > 0 && o.fx !== false) ctx.filter = 'blur(' + (layer.blur * W / 1920).toFixed(2) + 'px)';
      ctx.translate(W / 2, H / 2);
      if (cam.rot) ctx.rotate((cam.rot * Math.PI) / 180);
      ctx.scale(g.zl, g.zl);
      ctx.translate(-camx, -camy);
      const ix = box.cx - (img.w * box.s) / 2, iy = box.cy - (img.h * box.s) / 2, iw = img.w * box.s, ih = img.h * box.s;
      ctx.drawImage(img.bitmap, ix, iy, iw, ih);
      /* efecto de enfoque: el resto de la página se atenúa y la viñeta queda a la vista */
      const pg = shot.page;
      if (layer.page && pg && cam.rect && o.focus !== false && pg.dim > 0) {
        const r = cam.rect, big = 1e5;
        ctx.fillStyle = 'rgba(0,0,0,' + pg.dim + ')';
        ctx.beginPath(); ctx.rect(-big, -big, big * 2, big * 2); ctx.rect(ix + r.x0 * iw, iy + r.y0 * ih, (r.x1 - r.x0) * iw, (r.y1 - r.y0) * ih);
        ctx.fill('evenodd');
      }
      ctx.restore();
    }
    ctx.restore();
  };

  MC.TRANSITIONS = [
    { v: 'cut', es: 'Corte', en: 'Cut' }, { v: 'fade', es: 'Fundido', en: 'Fade' },
    { v: 'flash', es: 'Destello', en: 'Flash' }, { v: 'wipe', es: 'Barrido', en: 'Wipe' },
  ];

  const renderBase = (ctx, project, time, o) => {
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

  MC.renderFrame = (ctx, project, time, o) => { renderBase(ctx, project, time, o); if (MC.renderTexts) MC.renderTexts(ctx, project, time, o); };

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
