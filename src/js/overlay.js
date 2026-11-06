/* Vídeo importado y pistas de superposición.
   - Un vídeo es un recurso más: puede ir como capa dentro de un plano (con parallax) o como superposición fija encima de todo.
   - Las superposiciones viven en pistas propias de la línea de tiempo, independientes de los planos (personaje animado, marcos, logotipos…).
   - Para dibujar con exactitud (exportación y vista parada) se coloca cada vídeo en su instante y se espera al fotograma: MC.video.prepare.
   Todo se dibuja con el mismo código en el visor y en la exportación. */
(function () {
  const MC = window.MC;
  const { clamp } = MC;
  const V = (MC.video = { pool: new Map(), busy: false });

  V.isFile = (f) => /^video\//.test(f.type || '') || /\.(mp4|m4v|mov|webm|ogv)$/i.test(f.name || '');

  const mkEl = (url) => {
    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto'; v.loop = false; v.src = url;
    return v;
  };
  const whenReady = (v, ms) => new Promise((res, rej) => {
    if (v.readyState >= 2) return res();
    const done = (ok) => { clearTimeout(tm); v.removeEventListener('loadeddata', onOk); v.removeEventListener('error', onErr); ok ? res() : rej(new Error('video')); };
    const onOk = () => done(true), onErr = () => done(false), tm = setTimeout(() => done(false), ms || 15000);
    v.addEventListener('loadeddata', onOk); v.addEventListener('error', onErr);
  });
  const seekTo = (v, tm) => new Promise((res) => {
    if (Math.abs(v.currentTime - tm) < 0.004 && !v.seeking && v.readyState >= 2) return res();
    let fin = false; const done = () => { if (fin) return; fin = true; clearTimeout(to); v.removeEventListener('seeked', done); res(); };
    const to = setTimeout(done, 1800);
    v.addEventListener('seeked', done); v.currentTime = tm;
  });

  /* Un recurso de vídeo con lo necesario para la interfaz. */
  V.fromRec = (rec) => {
    const url = URL.createObjectURL(rec.blob), master = mkEl(url);
    return { id: rec.id, name: rec.name, w: rec.w, h: rec.h, dur: rec.dur, video: true, url, bitmap: master, proxy: false, thumb: rec.thumb, hasAudio: !!rec.audioId, audioId: rec.audioId || null };
  };
  /* Lee el vídeo (medidas, duración, miniatura) y lo guarda. Intenta sacar el audio y guardarlo aparte, sin duplicar el archivo. */
  V.add = async (file, name, existingId) => {
    const url = URL.createObjectURL(file), v = mkEl(url);
    try { await whenReady(v, 20000); } catch (e) { URL.revokeObjectURL(url); throw new Error('No se pudo leer el vídeo'); }
    const w = v.videoWidth, h = v.videoHeight, dur = isFinite(v.duration) ? v.duration : 0;
    await seekTo(v, Math.min(0.1, dur / 2));
    const c = document.createElement('canvas'), k = 72 / Math.max(w, h); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    const thumb = c.toDataURL('image/png'), id = existingId || MC.uid();
    let audioId = null;
    try {
      const a = await MC.audio.addFrom(file, name.replace(/\.[a-z0-9]+$/i, '') + ' · audio', id + ':a', id);
      if (a && a.dur > 0.05) audioId = a.id;
    } catch (e) { /* sin pista de audio o formato que el navegador no sabe separar */ }
    await MC.db.put('assets', { id, name, blob: file, type: file.type || 'video/mp4', kind: 'video', w, h, dur, thumb, audioId });
    URL.revokeObjectURL(url);
    const a = V.fromRec({ id, name, blob: file, w, h, dur, thumb, audioId });
    MC.assets.cache.set(id, a);
    return a;
  };

  /* Un elemento de vídeo propio por cada uso (capa u superposición): así dos usos del mismo archivo pueden estar en instantes distintos. */
  V.el = (key, asset) => {
    let e = V.pool.get(key);
    if (!e || e._asset !== asset.id) { if (e) { try { e.pause(); } catch (x) { /* nada */ } } e = mkEl(asset.url); e._asset = asset.id; e._key = key; V.pool.set(key, e); }
    return e;
  };

  /* Instante del vídeo que corresponde a un instante de la línea de tiempo. u = { start, offset, speed, loop }, asset.dur = duración del archivo. */
  V.localTime = (u, asset, time) => {
    const sp = u.speed || 1, d = asset.dur || 0;
    let vt = (u.offset || 0) + Math.max(0, time - u.start) * sp;
    if (d > 0) vt = u.loop === false ? Math.min(vt, d - 0.04) : (vt % d);
    return Math.max(0, vt);
  };

  /* Usos de vídeo activos en un instante: superposiciones y capas de vídeo del plano visible (y del anterior si hay transición). */
  V.uses = (p, time) => {
    const out = [], getA = (id) => MC.assets.get(id);
    (p.overlays || []).forEach((it) => {
      if (it.kind !== 'video' || it.visible === false) return;
      const tr = (p.otracks || [])[it.track]; if (tr && tr.visible === false) return;
      if (time < it.start || time >= it.start + it.dur) return;
      const a = getA(it.assetId); if (!a || !a.video) return;
      out.push({ key: it.id, asset: a, vt: V.localTime(it, a, time), speed: it.speed || 1, play: true });
    });
    const loc = MC.locate(p, time), cur = p.shots[loc.i];
    const pushShot = (sh, tl) => sh && sh.layers.forEach((l) => {
      if (l.visible === false) return;
      const a = getA(l.assetId); if (!a || !a.video) return;
      out.push({ key: l.id, asset: a, vt: V.localTime({ start: 0, offset: l.voffset || 0, speed: l.vspeed || 1, loop: l.vloop }, a, tl), speed: l.vspeed || 1, play: true });
    });
    pushShot(cur, loc.tl);
    (p.xshots || []).forEach((x) => { if (time >= x.start && time < x.start + x.duration) pushShot(x, time - x.start); });
    if (loc.i > 0 && cur && cur.transition && cur.transition.type !== 'cut' && loc.tl < Math.min(cur.transition.dur || 0.6, cur.duration * 0.9)) pushShot(p.shots[loc.i - 1], p.shots[loc.i - 1].duration);
    return out;
  };
  /* mientras se exporta, el visor no toca los vídeos (se vence solo si la exportación se corta) */
  V.isExporting = () => !!V.exporting && Date.now() - (V.expAt || 0) < 4000;
  V.hasVideo = (p) => (p.overlays || []).some((o) => o.kind === 'video') || p.shots.concat(p.xshots || []).some((s) => s.layers.some((l) => { const a = MC.assets.get(l.assetId); return a && a.video; }));

  /* Reproducción: los vídeos corren solos y se corrigen si se desvían. Parado: se pausan. */
  V.sync = (p, time, playing) => {
    const live = new Set();
    V.uses(p, time).forEach((u) => {
      const e = V.el(u.key, u.asset); live.add(u.key);
      if (!playing) { if (!e.paused) e.pause(); return; }
      if (e.readyState < 2) return;
      if (e.paused) { e.playbackRate = clamp(u.speed, 0.25, 4); e.currentTime = u.vt; e.play().catch(() => { /* sin permiso: se verá el último fotograma */ }); }
      else if (Math.abs(e.currentTime - u.vt) > 0.35) e.currentTime = u.vt;
    });
    V.pool.forEach((e, k) => { if (!live.has(k) && !e.paused) e.pause(); });
  };
  /* ¿Hay que colocar algún vídeo? (parado) */
  V.needsSeek = (p, time) => V.uses(p, time).some((u) => { const e = V.el(u.key, u.asset); return e.readyState < 2 || Math.abs(e.currentTime - u.vt) > 0.012; });
  /* Coloca todos los vídeos en su instante y espera al fotograma. Se usa al exportar y al mover el cabezal. */
  V.prepare = async (p, time) => {
    V.expAt = Date.now();
    const list = V.uses(p, time);
    await Promise.all(list.map(async (u) => { const e = V.el(u.key, u.asset); if (!e.paused) e.pause(); try { await whenReady(e, 8000); } catch (x) { return; } await seekTo(e, u.vt); }));
  };
  V.ensure = (p, time, then) => {
    if (V.busy || !V.needsSeek(p, time)) return;
    V.busy = true; V.prepare(p, time).finally(() => { V.busy = false; if (then) then(); });
  };

  /* Tira de fotogramas de un vídeo (para el fondo de su clip en la línea de tiempo). */
  V.strip = async (asset, n) => {
    n = n || 10; const v = mkEl(asset.url); await whenReady(v, 12000);
    const fh = 40, fw = Math.max(20, Math.round(fh * (asset.w / asset.h))), c = document.createElement('canvas'); c.width = fw * n; c.height = fh; const g = c.getContext('2d');
    for (let i = 0; i < n; i++) { await seekTo(v, Math.min(asset.dur - 0.05, (i + 0.5) * asset.dur / n)); g.drawImage(v, i * fw, 0, fw, fh); }
    v.removeAttribute('src'); v.load();
    return c.toDataURL('image/jpeg', 0.6);
  };

  /* Croma: quita un color de fondo. Devuelve un lienzo con el fotograma ya recortado. */
  const keyPool = new Map();
  V.keyed = (src, key, id, maxW) => {
    const sw = src.videoWidth || src.width, sh = src.videoHeight || src.height; if (!sw || !sh) return null;
    const k = Math.min(1, (maxW || 960) / sw), w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
    let c = keyPool.get(id);
    if (!c) { c = document.createElement('canvas'); keyPool.set(id, c); if (keyPool.size > 8) keyPool.delete(keyPool.keys().next().value); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, w, h); g.drawImage(src, 0, 0, w, h);
    const img = g.getImageData(0, 0, w, h), d = img.data;
    const m = /^#?([0-9a-f]{6})$/i.exec(key.color || '#00ff00'), n = m ? parseInt(m[1], 16) : 0x00ff00, kr = (n >> 16) & 255, kg = (n >> 8) & 255, kb = n & 255;
    const tol = clamp(key.tol == null ? 0.28 : key.tol, 0, 1) * 441, soft = Math.max(1, clamp(key.soft == null ? 0.12 : key.soft, 0, 1) * 441), spill = key.spill !== false;
    const greenish = kg > kr && kg > kb, blueish = kb > kr && kb > kg;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const dist = Math.sqrt((r - kr) * (r - kr) + (gg - kg) * (gg - kg) + (b - kb) * (b - kb));
      let a = (dist - tol) / soft; a = a < 0 ? 0 : a > 1 ? 1 : a;
      d[i + 3] = d[i + 3] * a;
      if (spill && a > 0) { if (greenish) { const lim = (r + b) / 2; if (gg > lim) d[i + 1] = lim + (gg - lim) * 0.35; } else if (blueish) { const lim = (r + gg) / 2; if (b > lim) d[i + 2] = lim + (b - lim) * 0.35; } }
    }
    g.putImageData(img, 0, 0);
    return c;
  };

  /* ---------- superposiciones ---------- */
  MC.newOverlay = (asset, o) => ({
    id: MC.uid(), kind: asset.video ? 'video' : 'image', name: asset.name.replace(/\.[a-z0-9]+$/i, ''), assetId: asset.id, track: (o && o.track) || 0,
    start: (o && o.start) || 0, dur: asset.video ? Math.max(0.2, Math.round(asset.dur * 100) / 100) : (o && o.dur) || 4, offset: 0, speed: 1, loop: false,
    x: 0, y: 0, scale: 1, rot: 0, opacity: 1, blend: '', flip: false, visible: true, vol: 1, key: null, audioClip: null,
  });
  MC.newOtrack = (n) => ({ id: MC.uid(), name: MC.t('Superposición ', 'Overlay ') + n, visible: true });

  /* Tamaño y posición de una superposición en el lienzo (ajustada al encuadre y multiplicada por «escala»). */
  MC.overlayBox = (it, asset, o, time) => {
    const an = MC.itemAnim && time != null ? MC.itemAnim(it, time - it.start, it.dur) : null;
    const base = Math.min(o.W / asset.w, o.H / asset.h) * (it.scale == null ? 1 : it.scale) * (an ? an.sc : 1);
    return { cx: o.W / 2 + ((it.x || 0) + (an ? an.dx : 0)) * o.W, cy: o.H / 2 + ((it.y || 0) + (an ? an.dy : 0)) * o.H, w: asset.w * base * (an ? an.sx || 1 : 1), h: asset.h * base * (an ? an.sy || 1 : 1), rot: (it.rot || 0) + (an ? an.rot : 0), op: (it.opacity == null ? 1 : it.opacity) * (an ? an.op : 1), an };
  };
  MC.overlaysAt = (p, time) => {
    const tr = p.otracks || [];
    return (p.overlays || []).filter((it) => it.visible !== false && (tr[it.track] || {}).visible !== false && time >= it.start && time < it.start + it.dur)
      .sort((a, b) => a.track - b.track || p.overlays.indexOf(a) - p.overlays.indexOf(b));
  };
  const BLEND = { multiply: 1, screen: 1, overlay: 1, darken: 1, lighten: 1, 'color-dodge': 1, 'color-burn': 1, 'hard-light': 1, 'soft-light': 1, difference: 1, exclusion: 1 };
  MC.renderOverlays = (ctx, p, time, o) => {
    if (o.overlays === false || !(p.overlays && p.overlays.length)) return;
    const k0 = ctx.getTransform().a;
    MC.overlaysAt(p, time).forEach((it) => {
      const a = o.getImg(it.assetId); if (!a) return;
      let src = a.bitmap;
      if (a.video) { src = V.el(it.id, a); if (src.readyState < 2) return; }
      if (it.key && it.key.on !== false) { const kc = V.keyed(src, it.key, it.id, o.W > 1500 ? 1280 : 960); if (kc) src = kc; }
      const b = MC.overlayBox(it, a, o, time);
      ctx.save();
      ctx.globalAlpha = clamp(b.op, 0, 1);
      if (it.blend && BLEND[it.blend]) ctx.globalCompositeOperation = it.blend;
      const flt = MC.itemFilter ? MC.itemFilter(it, 0, (o.W / 1920) * k0) : ''; if (flt) ctx.filter = flt;
      ctx.translate(b.cx, b.cy); if (b.rot) ctx.rotate((b.rot * Math.PI) / 180); if (it.flip || it.flipY) ctx.scale(it.flip ? -1 : 1, it.flipY ? -1 : 1);
      { const cr = MC.effCrop(it, b.an); if (o.cropBoxes) o.cropBoxes['O' + it.id] = { m: ctx.getTransform(), x: -b.w / 2, y: -b.h / 2, w: b.w, h: b.h, crop: cr }; if (cr) { ctx.beginPath(); ctx.rect(-b.w / 2 + b.w * cr.l, -b.h / 2 + b.h * cr.t, b.w * (1 - cr.l - cr.r), b.h * (1 - cr.t - cr.b)); ctx.clip(); } }
      const crO = MC.effCrop(it, b.an), shR = crO ? { x: -b.w / 2 + b.w * crO.l, y: -b.h / 2 + b.h * crO.t, w: b.w * (1 - crO.l - crO.r), h: b.h * (1 - crO.t - crO.b) } : { x: -b.w / 2, y: -b.h / 2, w: b.w, h: b.h };
      if (MC.clipShape) MC.clipShape(ctx, it, shR);
      const rx3 = ((it.r3 && it.r3.x) || 0) + (b.an ? b.an.rx : 0), ry3 = ((it.r3 && it.r3.y) || 0) + (b.an ? b.an.ry : 0), pv = (b.an && b.an.pv) || { x: 0.5, y: 0.5 };
      if (MC.draw3D && MC.has3D(rx3, ry3)) MC.draw3D(ctx, src, src.videoWidth || src.width, src.videoHeight || src.height, { x: -b.w / 2, y: -b.h / 2, w: b.w, h: b.h }, { rx: rx3, ry: ry3, D: MC.camDist(ctx, o, k0, it.persp), pvx: pv.x, pvy: pv.y });
      else if (MC.drawItem && it.look) MC.drawItem(ctx, src, it, -b.w / 2, -b.h / 2, b.w, b.h, o, k0); else ctx.drawImage(src, -b.w / 2, -b.h / 2, b.w, b.h);
      if (MC.drawFrame) MC.drawFrame(ctx, it, shR, o.W / 1920);
      ctx.restore();
    });
  };
})();
