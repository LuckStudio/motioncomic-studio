/* Motor de dibujo 2.5D: cámara, parallax, sobreescalado, huecos y transiciones.
   El visor y la exportación usan este mismo código (principio 4: lo que se ve es lo que se exporta). */
(function () {
  const MC = window.MC;
  const { clamp, lerp } = MC;

  const EASE = { linear: (t) => t, smooth: (t) => t * t * (3 - 2 * t), in: (t) => t * t, out: (t) => 1 - (1 - t) * (1 - t),
    back: (t) => { const c = 1.70158, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; }, snap: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)) };
  MC.ease = (k, t) => (k && k.b && MC.curveFn ? MC.curveFn(k)(clamp(t, 0, 1)) : (EASE[k] || EASE.smooth)(clamp(t, 0, 1)));
  const noise = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  MC.PARALLAX = { subtle: 0.5, normal: 1, wild: 1.6 };

  MC.shotStarts = (p) => { let t = 0; return p.shots.map((s) => { const a = t; t += s.duration; return a; }); };
  MC.totalTime = (p) => Math.max(p.shots.reduce((a, s) => a + s.duration, 0), ...(p.xshots || []).map((x) => x.start + x.duration));
  MC.baseTime = (p) => p.shots.reduce((a, s) => a + s.duration, 0);
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
    const from = (q, drift) => ({ x: q.x, y: q.y, zoom: q.zoom * (1 + (path.drift || 0) * drift), rot: 0, sx: 0, sy: 0, rect: q.rect, poly: q.poly });
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
    const cam = { x: lerp(c.from.x, c.to.x, p), y: lerp(c.from.y, c.to.y, p), zoom: z0 * Math.pow(z1 / z0, p), rot: lerp(c.from.rot || 0, c.to.rot || 0, p), sx: 0, sy: 0, dolly: (c.dolly || 0) * p };
    if (withShake !== false && c.shake > 0) {
      const k = Math.floor(tl * 30), a = 0.012 * c.shake;
      cam.sx = (noise(k) - 0.5) * 2 * a;
      cam.sy = (noise(k + 99) - 0.5) * 2 * a;
      cam.rot += (noise(k + 7) - 0.5) * 2 * c.shake * 0.8;
    }
    return cam;
  };

  /* tiempo propio de una capa dentro del plano: aparece en «ts» y desaparece en «te»; y sus «cortes» cambian la ilustración (gestos) */
  MC.layerOn = (l, tl) => tl >= (l.ts || 0) - 1e-6 && (l.te == null || tl < l.te);
  MC.layerSegs = (l) => (l.segs || []).slice().sort((a, b) => a.t - b.t);
  MC.layerAsset = (l, tl) => { let id = l.assetId; MC.layerSegs(l).forEach((q) => { if (tl >= q.t) id = q.assetId; }); return id; };
  MC.layerAssetIds = (l) => [l.assetId].concat((l.segs || []).map((q) => q.assetId));
  /* ilustración que toca en un instante; con fundido («xf»), la anterior queda debajo mientras entra la nueva */
  MC.layerAssetAt = (l, tl) => {
    const sg = MC.layerSegs(l); let id = l.assetId, prev = null, k = 1, last = null;
    sg.forEach((q) => { if (tl >= q.t) { prev = id; id = q.assetId; last = q; } });
    if (last && l.xf > 0 && tl - last.t < l.xf && prev !== id) k = Math.max(0.001, (tl - last.t) / l.xf); else prev = null;
    return { id, prev, k };
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
      zl: (1 + (cam.zoom - 1) * (1 + (layer.z - 0.5) * I * 0.6)) * (cam.dolly ? (cam.dolly > 0 ? 1 + cam.dolly * Math.max(0, 0.5 - layer.z) * 1.1 : 1 - cam.dolly * Math.max(0, layer.z - 0.5) * 1.1) : 1), // cuánto se acerca con el zoom (y el efecto vértigo)
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
    let cam = o.cam || MC.camAt(shot, tl);
    const fxOff = !!(o.project && o.project.tv && o.project.tv.fxr && o.project.tv.fxr.off);
    const anim = !o.noClip && !fxOff && MC.fxAnim ? MC.fxAnim(shot, tl) : null;
    if (anim && anim.cam) { const a = anim.cam; cam = Object.assign({}, cam, { sx: cam.sx + a.dx, sy: cam.sy + a.dy, rot: cam.rot + a.rot, zoom: cam.zoom * a.sc }); }
    /* contenedor de viñeta: calle, sombra, recorte a la forma y trazo */
    const fr = !o.noClip && !o.transparent && o.frames !== false && MC.frameOf ? MC.frameOf(o.project, shot) : null;
    const pan = fr ? MC.panelGeom(fr, W, H) : null;
    const k0 = ctx.getTransform().a;
    const shotStart = shot.xtrack != null && shot.start != null ? shot.start : (o.project && MC.shotStarts ? (MC.shotStarts(o.project)[o.project.shots.indexOf(shot)] || 0) : 0);
    const drawLayer = (layer) => {
      if (!MC.layerOn(layer, tl)) return;
      const A = MC.layerAssetAt(layer, tl);
      if (A.prev) drawLayer1(layer, A.prev, 1);
      drawLayer1(layer, A.id, A.k);
    };
    const drawLayer1 = (layer, aid, amul) => {
      const img = o.getImg(aid);
      if (!img) return;
      if (MC.rigShow && !MC.rigShow(shot, layer, tl, shotStart, o.project)) return;
      const g = MC.layerGeom(layer, img, cam, o);
      const box = MC.layerBox(layer, img, o, MC.effScale(layer, img, shot, o));
      const lim = layer.maxShift ? layer.maxShift : 0, cxs = lim ? clamp((cam.x + cam.sx) * g.f, -lim, lim) : (cam.x + cam.sx) * g.f, cys = lim ? clamp((cam.y + cam.sy) * g.f, -lim, lim) : (cam.y + cam.sy) * g.f;
      const camx = W / 2 + cxs * W, camy = H / 2 + cys * H;
      const ia = !o.noClip && MC.itemAnim ? MC.itemAnim(layer, tl - (layer.ts || 0), (layer.te == null ? shot.duration : layer.te) - (layer.ts || 0)) : null;
      ctx.save();
      ctx.globalAlpha = (layer.opacity == null ? 1 : layer.opacity) * (ia ? clamp(ia.op, 0, 1) : 1) * amul;
      if (layer.blend && BLEND[layer.blend]) ctx.globalCompositeOperation = layer.blend;
      const blur = Math.max(layer.blur || 0, !o.noClip && MC.rackBlur ? MC.rackBlur(shot, layer, tl) : 0), lf = anim && anim.layers[layer.id];
      if (o.fx !== false) { const flt = MC.itemFilter ? MC.itemFilter(layer, blur > 0 ? blur * W / 1920 : 0) : (blur > 0 ? 'blur(' + (blur * W / 1920).toFixed(2) + 'px)' : ''); if (flt) ctx.filter = flt; }
      ctx.translate(W / 2 + (lf ? lf.dx * W : 0), H / 2 + (lf ? lf.dy * H : 0));
      if (cam.rot || lf) ctx.rotate(((cam.rot + (lf ? lf.rot : 0)) * Math.PI) / 180);
      ctx.scale(g.zl * (lf ? lf.sc : 1), g.zl * (lf ? lf.sc : 1));
      ctx.translate(-camx, -camy);
      const ix = box.cx - (img.w * box.s) / 2, iy = box.cy - (img.h * box.s) / 2, iw = img.w * box.s, ih = img.h * box.s;
      const pv = (ia && ia.pv) || layer.pivot || { x: 0.5, y: 0.5 };
      if (ia) {
        /* movimiento propio de la capa, alrededor de su pivote (por defecto el centro) */
        const pxx = ix + iw * pv.x, pyy = iy + ih * pv.y, kz = 1 / (g.zl * (lf ? lf.sc : 1));
        ctx.translate(pxx + ia.dx * W * kz, pyy + ia.dy * H * kz); if (ia.rot) ctx.rotate((ia.rot * Math.PI) / 180); if (ia.sc !== 1 || ia.sx !== 1 || ia.sy !== 1) ctx.scale(ia.sc * (ia.sx || 1), ia.sc * (ia.sy || 1)); ctx.translate(-pxx, -pyy);
      }
      if (layer.flipX || layer.flipY) { const fcx = ix + iw / 2, fcy = iy + ih / 2; ctx.translate(fcx, fcy); ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1); ctx.translate(-fcx, -fcy); }
      if (layer.crop) { const cr = layer.crop; ctx.beginPath(); ctx.rect(ix + iw * (cr.l || 0), iy + ih * (cr.t || 0), iw * (1 - (cr.l || 0) - (cr.r || 0)), ih * (1 - (cr.t || 0) - (cr.b || 0))); ctx.clip(); }
      let src = img.bitmap;
      if (img.video) { src = MC.video.el(layer.id + (aid !== layer.assetId ? ':' + aid : ''), img); if (src.readyState < 2) { ctx.restore(); return; } }
      const rx3 = ((layer.r3 && layer.r3.x) || 0) + (ia ? ia.rx : 0), ry3 = ((layer.r3 && layer.r3.y) || 0) + (ia ? ia.ry : 0);
      if (MC.draw3D && MC.has3D(rx3, ry3) && o.fx !== false) MC.draw3D(ctx, src, src.videoWidth || src.width, src.videoHeight || src.height, { x: ix, y: iy, w: iw, h: ih }, { rx: rx3, ry: ry3, D: MC.camDist(ctx, o, k0, layer.persp), pvx: pv.x, pvy: pv.y });
      else if (MC.drawItem && layer.look && o.fx !== false) MC.drawItem(ctx, src, layer, ix, iy, iw, ih, o, k0); else ctx.drawImage(src, ix, iy, iw, ih);
      /* efecto de enfoque: el resto de la página se atenúa y la viñeta queda a la vista */
      const pg = shot.page;
      if (layer.page && pg && cam.rect && o.focus !== false && pg.dim > 0) {
        const r = cam.rect, big = 1e5;
        ctx.fillStyle = 'rgba(0,0,0,' + pg.dim + ')';
        ctx.beginPath(); ctx.rect(-big, -big, big * 2, big * 2);
        if (cam.poly) { cam.poly.forEach((q, i) => { const X = ix + q[0] * iw, Y = iy + q[1] * ih; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.closePath(); }
        else ctx.rect(ix + r.x0 * iw, iy + r.y0 * ih, (r.x1 - r.x0) * iw, (r.y1 - r.y0) * ih);
        ctx.fill('evenodd');
        /* contorno de la viñeta activa (modo página) */
        if (pg.outline > 0) {
          ctx.strokeStyle = pg.outlineColor || '#ffffff'; ctx.lineWidth = (pg.outline * Math.min(W, H)) / g.zl; ctx.lineJoin = 'miter';
          ctx.beginPath();
          if (cam.poly) { cam.poly.forEach((q, i) => { const X = ix + q[0] * iw, Y = iy + q[1] * ih; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.closePath(); }
          else ctx.rect(ix + r.x0 * iw, iy + r.y0 * ih, (r.x1 - r.x0) * iw, (r.y1 - r.y0) * ih);
          ctx.stroke();
        }
      }
      ctx.restore();
    };
    const content = () => { if (pan) { ctx.translate(pan.ox, pan.oy); ctx.scale(pan.s, pan.s); } };
    ctx.save();
    if (!o.noClip) {
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      const hasBg = shot.layers.some((l) => l.role === 'fondo' && l.visible !== false);
      if (pan) { MC.drawPanelBg(ctx, fr, W, H); MC.drawPanelShadow(ctx, fr, pan, W, H); ctx.save(); MC.pathPoly(ctx, pan.poly); ctx.clip(); }
      if (!o.transparent) { ctx.fillStyle = o.holes && hasBg ? '#E5333D' : '#000'; ctx.fillRect(0, 0, W, H); }
    }
    ctx.save(); content();
    for (const layer of shot.layers) { if (layer.visible === false || (pan && layer.over)) continue; drawLayer(layer); }
    if (!o.noClip && !fxOff && MC.fxOverlays && ((shot.fx && shot.fx.length) || anim)) MC.fxOverlays(ctx, shot, tl, o, anim);
    ctx.restore();
    if (pan) {
      ctx.restore();
      MC.drawPanelStroke(ctx, fr, pan, W, H);
      /* ilustraciones que rompen la viñeta: encima del trazo y de la calle */
      ctx.save(); content();
      for (const layer of shot.layers) if (layer.over && layer.visible !== false) drawLayer(layer);
      ctx.restore();
    }
    ctx.restore();
  };

  const renderBase = (ctx, project, time, o) => {
    const { W, H } = o;
    const { i, tl } = MC.locate(project, time);
    const cur = project.shots[i];
    if (!cur) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
    const tr = cur.transition || { type: 'cut' };
    const dur = Math.min(tr.dur || 0.6, cur.duration * 0.9);
    if (i > 0 && tr.type !== 'cut' && tl < dur && MC.drawTransition) {
      const prev = project.shots[i - 1], p = tl / dur;
      const fr = MC.frameOf ? MC.frameOf(project, cur) : null;
      const to = Object.assign({}, o, { frameBg: fr ? fr.bg : '#000000', frameGutter: fr ? clamp(fr.gutter || 0, 0, 0.3) * Math.min(W, H) : 0 });
      /* el plano entrante arranca su movimiento al empezar la transición */
      MC.drawTransition(ctx, tr, p, (g) => MC.renderShot(g, prev, prev.duration, o), (g) => MC.renderShot(g, cur, tl, o), to);
      return;
    }
    MC.renderShot(ctx, cur, tl, o);
  };

  /* planos superpuestos: varios planos a la vez, cada uno con su cámara y sus capas, sobre el plano principal */
  MC.renderXShots = (ctx, project, time, o) => {
    const list = project.xshots || []; if (!list.length || o.xshots === false) return;
    const tr = project.xtracks || [];
    list.filter((x) => time >= x.start && time < x.start + x.duration && (tr[x.xtrack || 0] || {}).visible !== false).sort((a, b) => (a.xtrack || 0) - (b.xtrack || 0)).forEach((x) => MC.renderShot(ctx, x, time - x.start, Object.assign({}, o, { transparent: true, project })));
  };
  MC.renderFrame = (ctx, project, time, o) => { renderBase(ctx, project, time, o); MC.renderXShots(ctx, project, time, o); if (MC.renderOverlays) MC.renderOverlays(ctx, project, time, o); if (MC.renderLook && !o.noLook) MC.renderLook(ctx, project, time, o); if (MC.renderTexts) MC.renderTexts(ctx, project, time, o); if (MC.renderSubs) MC.renderSubs(ctx, project, time, o); };

  MC.renderOpts = (project, extra) => {
    const s = MC.frameSize(project.ratio, project.res);
    return Object.assign({ W: s.w, H: s.h, getImg: (id) => MC.assets.get(id), parallaxI: MC.PARALLAX[project.parallax] || 1, overscan: project.overscan !== false, project }, extra || {});
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
