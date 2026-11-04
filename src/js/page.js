/* Modo Página completa: detección de viñetas sin IA, orden de lectura, trayectoria de cámara y borrador en un clic (PRD 5.1, 5.4). */
(function () {
  const MC = window.MC;
  const { clamp } = MC;

  /* ---------- detección de viñetas ---------- */
  function luminance(src, maxW) {
    const k = Math.min(1, maxW / src.width), w = Math.max(8, Math.round(src.width * k)), h = Math.max(8, Math.round(src.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(src, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, lum = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) lum[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
    return { lum, w, h };
  }

  /* Divide la página por los canales entre viñetas (corte XY recursivo). El orden sale de la propia división. */
  MC.detectPanels = (src, dir) => {
    const { lum, w, h } = luminance(src, 640);
    const edge = [];
    const bw = Math.max(2, Math.round(Math.min(w, h) * 0.012));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < bw || y < bw || x >= w - bw || y >= h - bw) edge.push(lum[y * w + x]);
    edge.sort((a, b) => a - b);
    const gl = edge[edge.length >> 1];
    const content = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) content[i] = Math.abs(lum[i] - gl) > 38 ? 1 : 0;
    const rtl = dir === 'rtl', out = [];

    const segs = (prof, eps, minGap) => {
      const res = []; let start = -1, gap = 0;
      for (let i = 0; i < prof.length; i++) {
        if (prof[i] > eps) { if (start < 0) start = i; gap = 0; }
        else if (start >= 0) { gap++; if (gap >= minGap) { res.push([start, i - gap + 1]); start = -1; gap = 0; } }
      }
      if (start >= 0) res.push([start, prof.length - gap]);
      return res;
    };
    const cut = (x0, y0, x1, y1, depth) => {
      const rw = x1 - x0, rh = y1 - y0;
      if (rw < 8 || rh < 8 || depth > 8) return;
      const rows = new Array(rh).fill(0), cols = new Array(rw).fill(0);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (content[y * w + x]) { rows[y - y0]++; cols[x - x0]++; }
      const sy = segs(rows, Math.max(1, rw * 0.004), Math.max(3, Math.round(h * 0.007)));
      if (sy.length > 1) { sy.forEach((s) => cut(x0, y0 + s[0], x1, y0 + s[1], depth + 1)); return; }
      const sx = segs(cols, Math.max(1, rh * 0.004), Math.max(3, Math.round(w * 0.007)));
      if (sx.length > 1) { (rtl ? sx.slice().reverse() : sx).forEach((s) => cut(x0 + s[0], y0, x0 + s[1], y1, depth + 1)); return; }
      const ty = sy[0] || [0, rh], tx = sx[0] || [0, rw];
      if (!sy.length || !sx.length) return;
      out.push({ x0: (x0 + tx[0]) / w, y0: (y0 + ty[0]) / h, x1: (x0 + tx[1]) / w, y1: (y0 + ty[1]) / h });
    };
    cut(0, 0, w, h, 0);
    let panels = out.filter((q) => (q.x1 - q.x0) * (q.y1 - q.y0) > 0.02 && q.x1 - q.x0 > 0.08 && q.y1 - q.y0 > 0.05);

    if (panels.length <= 1) panels = componentPanels(content, w, h, dir) || panels;
    if (!panels.length) panels = [{ x0: 0, y0: 0, x1: 1, y1: 1 }];
    return panels.map((q) => ({ id: MC.uid(), x0: round3(q.x0), y0: round3(q.y0), x1: round3(q.x1), y1: round3(q.y1), hold: null }));
  };
  const round3 = (v) => Math.round(v * 1000) / 1000;

  /* Plan B para páginas con viñetas que no se separan por canales rectos: manchas conectadas. */
  function componentPanels(content, w, h, dir) {
    const k = 3, sw = Math.ceil(w / k), sh = Math.ceil(h / k), m = new Uint8Array(sw * sh);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (content[y * w + x]) m[((y / k) | 0) * sw + ((x / k) | 0)] = 1;
    const dil = new Uint8Array(sw * sh), r = 2;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (m[y * sw + x]) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < sh && xx >= 0 && xx < sw) dil[yy * sw + xx] = 1; }
    const seen = new Uint8Array(sw * sh), res = [];
    for (let i = 0; i < sw * sh; i++) {
      if (!dil[i] || seen[i]) continue;
      const stack = [i]; seen[i] = 1; let x0 = sw, y0 = sh, x1 = 0, y1 = 0;
      while (stack.length) {
        const q = stack.pop(), qx = q % sw, qy = (q / sw) | 0;
        x0 = Math.min(x0, qx); x1 = Math.max(x1, qx); y0 = Math.min(y0, qy); y1 = Math.max(y1, qy);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach((d) => { const nx = qx + d[0], ny = qy + d[1]; if (nx >= 0 && nx < sw && ny >= 0 && ny < sh && dil[ny * sw + nx] && !seen[ny * sw + nx]) { seen[ny * sw + nx] = 1; stack.push(ny * sw + nx); } });
      }
      const b = { x0: x0 / sw, y0: y0 / sh, x1: (x1 + 1) / sw, y1: (y1 + 1) / sh };
      if ((b.x1 - b.x0) * (b.y1 - b.y0) > 0.03) res.push(b);
    }
    return res.length > 1 ? MC.sortPanels(res, dir) : null;
  }

  /* Orden de lectura por filas: occidental (izquierda a derecha) o manga (derecha a izquierda). */
  MC.sortPanels = (panels, dir) => {
    const ps = panels.slice().sort((a, b) => a.y0 - b.y0), rows = [];
    ps.forEach((q) => {
      const row = rows.find((r) => { const ov = Math.min(r.y1, q.y1) - Math.max(r.y0, q.y0); return ov > 0.5 * Math.min(r.y1 - r.y0, q.y1 - q.y0); });
      if (row) { row.items.push(q); row.y0 = Math.min(row.y0, q.y0); row.y1 = Math.max(row.y1, q.y1); } else rows.push({ y0: q.y0, y1: q.y1, items: [q] });
    });
    rows.sort((a, b) => a.y0 - b.y0);
    return rows.flatMap((r) => r.items.sort((a, b) => (dir === 'rtl' ? b.x1 - a.x1 : a.x0 - b.x0)));
  };

  /* ---------- trayectoria de cámara ---------- */
  const holdOf = (pn) => (pn.hold != null ? pn.hold : clamp(1.3 + 4.2 * Math.sqrt((pn.x1 - pn.x0) * (pn.y1 - pn.y0)), 1.2, 5));
  MC.panelHold = holdOf;

  MC.rebuildPagePath = (shot, o) => {
    const pg = shot.page, L = shot.layers.find((l) => l.page);
    if (!pg || !L) return;
    const img = o.getImg(L.assetId);
    if (!img) return;
    const { W, H } = o, s0 = Math.max(W / img.w, H / img.h) * (L.scale || 1), PW = img.w * s0, PH = img.h * s0;
    const panels = pg.panels.length ? pg.panels : [{ x0: 0, y0: 0, x1: 1, y1: 1, hold: null }];
    const pts = [];
    panels.forEach((pn, idx) => {
      const rw = (pn.x1 - pn.x0) * PW, rh = (pn.y1 - pn.y0) * PH;
      const cx = W / 2 + ((pn.x0 + pn.x1) / 2 - 0.5) * PW, cy = H / 2 + ((pn.y0 + pn.y1) / 2 - 0.5) * PH;
      const zW = W / rw, zH = H / rh, zf = Math.min(zW, zH), margin = 0.94;
      let z = 1, pan = null;
      if (zf >= 1) z = zf * margin;
      else if (zW < zH) { z = Math.max(1, zH * margin); pan = 'x'; }
      else { z = Math.max(1, zW * margin); pan = 'y'; }
      const ww = W / z, wh = H / z;
      const clampX = (v) => (PW <= ww ? W / 2 : clamp(v, W / 2 - PW / 2 + ww / 2, W / 2 + PW / 2 - ww / 2));
      const clampY = (v) => (PH <= wh ? H / 2 : clamp(v, H / 2 - PH / 2 + wh / 2, H / 2 + PH / 2 - wh / 2));
      const rect = { x0: pn.x0, y0: pn.y0, x1: pn.x1, y1: pn.y1 };
      const mk = (px, py, hold) => ({ x: (clampX(px) - W / 2) / W, y: (clampY(py) - H / 2) / H, zoom: z, hold, travel: 0, rect, panel: idx });
      const hold = holdOf(pn);
      if (pan === 'x') {
        const a = pn.x0 * PW - PW / 2 + W / 2 + ww / 2, b = pn.x1 * PW - PW / 2 + W / 2 - ww / 2;
        pts.push(mk(a, cy, 0.6), mk(b, cy, Math.max(0.6, hold - 0.6)));
        pts[pts.length - 2].travel = clamp(Math.abs(b - a) / (0.3 * Math.max(W, H)), 1.2, 6);
      } else if (pan === 'y') {
        const a = pn.y0 * PH - PH / 2 + H / 2 + wh / 2, b = pn.y1 * PH - PH / 2 + H / 2 - wh / 2;
        pts.push(mk(cx, a, 0.6), mk(cx, b, Math.max(0.6, hold - 0.6)));
        pts[pts.length - 2].travel = clamp(Math.abs(b - a) / (0.3 * Math.max(W, H)), 1.2, 6);
      } else pts.push(mk(cx, cy, hold));
    });
    for (let i = 0; i < pts.length - 1; i++) {
      if (pts[i].panel === pts[i + 1].panel) continue; // ya tiene su recorrido
      const a = pts[i], b = pts[i + 1], dist = Math.hypot((b.x - a.x) * W, (b.y - a.y) * H);
      pts[i].travel = pg.mode === 'cut' ? 0 : clamp((0.5 + Math.min(0.9, (dist / Math.max(PW, PH)) * 1.4)) * ((pg.travel || 0.8) / 0.8), 0.25, 3);
    }
    shot.camera.path = { pts, drift: 0.03, curve: 'smooth' };
    shot.camera.preset = 'path'; shot.camera.shake = 0;
    shot.duration = Math.round((MC.pathDuration(shot.camera.path) + 0.3) * 10) / 10;
  };
  MC.finalizePages = (p) => { const o = MC.renderOpts(p); p.shots.forEach((sh) => { if (sh.page) MC.rebuildPagePath(sh, o); }); };

  /* ---------- páginas ---------- */
  MC.pageShot = (p, asset, dir, name) => {
    const sh = MC.newShot(name || asset.name.replace(/\.[a-z0-9]+$/i, ''));
    const l = MC.newLayer(asset, { z: 0.5, role: '' });
    l.page = true; l.z = 0.5; l.role = ''; l.name = MC.t('Página', 'Page');
    sh.layers.push(l);
    sh.page = { dir: dir || 'ltr', panels: MC.detectPanels(asset.bitmap, dir || 'ltr'), dim: 0.55, mode: 'pan', travel: 0.8, manual: false };
    return sh;
  };
  MC.cropPanel = async (shot, pn) => {
    const L = shot.layers.find((l) => l.page), img = MC.assets.get(L.assetId);
    const x = Math.round(pn.x0 * img.w), y = Math.round(pn.y0 * img.h), w = Math.max(2, Math.round((pn.x1 - pn.x0) * img.w)), hh = Math.max(2, Math.round((pn.y1 - pn.y0) * img.h));
    const c = document.createElement('canvas'); c.width = w; c.height = hh;
    c.getContext('2d').drawImage(img.bitmap, x, y, w, hh, 0, 0, w, hh);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    return MC.assets.add(blob, shot.name + ' · ' + MC.t('viñeta', 'panel') + '.png');
  };

  /* ---------- borrador en un clic ---------- */
  MC.buildDraft = async (o) => {
    const p = MC.newProject({ name: o.name, ratio: o.ratio, res: o.res, zoom: o.zoom });
    p.mode = o.mode; p.dir = o.dir || 'ltr'; p.shots = [];
    const st = MC.myStyle.get() || MC.myStyle.DEFAULT;
    const files = [...o.files].filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!files.length) throw new Error('sin imágenes');
    let panels = 0;
    for (let i = 0; i < files.length; i++) {
      const asset = await MC.assets.add(files[i], files[i].name);
      let sh;
      if (o.mode === 'page') { sh = MC.pageShot(p, asset, p.dir, MC.t('Página ', 'Page ') + (i + 1)); panels += sh.page.panels.length; }
      else {
        sh = MC.newShot(files[i].name.replace(/\.[a-z0-9]+$/i, ''));
        sh.layers.push(MC.newLayer(asset, { z: 0.1, role: 'fondo' }));
        MC.applyPreset(sh.camera, 'zoomin', 0.7 * (st.intensity || 1)); sh.duration = 3.5;
      }
      p.shots.push(sh);
    }
    MC.applyStyle(p, st, true);
    MC.finalizePages(p);
    p.thumb = MC.makeThumb(p);
    await MC.db.put('projects', p);
    return { project: p, pages: files.length, panels };
  };
})();
