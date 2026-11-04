/* Texto del cómic: bocadillos, cajas, onomatopeyas y subtítulos, con revelado y entrada animada (PRD 10).
   Se dibuja encima del plano dentro de renderFrame, así que el visor y la exportación ven lo mismo. */
(function () {
  const MC = window.MC;
  const { clamp } = MC;

  MC.FONTS = [
    { id: 'bric', css: '"Bricolage Grotesque", "Segoe UI", sans-serif', w: 700, es: 'Bricolage (marca)', en: 'Bricolage (brand)' },
    { id: 'comic', css: '"Comic Neue", "Comic Sans MS", sans-serif', w: 700, es: 'Cómic', en: 'Comic' },
    { id: 'bangers', css: 'Bangers, Impact, sans-serif', w: 400, es: 'Onomatopeya (Bangers)', en: 'Sound effect (Bangers)' },
    { id: 'marker', css: '"Permanent Marker", cursive', w: 400, es: 'Rotulador', en: 'Marker' },
  ];
  MC.fontSpec = (p, id) => {
    const b = MC.FONTS.find((f) => f.id === id);
    if (b) return b;
    const f = (p.fonts || []).find((x) => x.id === id);
    return f ? { id, css: '"' + f.family + '", sans-serif', w: 400 } : MC.FONTS[0];
  };
  MC.ensureFonts = () => Promise.all(MC.FONTS.map((f) => document.fonts.load(f.w + ' 40px ' + f.css.split(',')[0]).catch(() => 0)));

  /* Tipografías propias del autor: se guardan con el proyecto y avisa si falta alguna al abrirlo en otro equipo. */
  MC.fonts = {
    async add(file, id) {
      const ab = await file.arrayBuffer(), aid = id || MC.uid(), family = 'MCF' + aid;
      const ff = new FontFace(family, ab.slice(0));
      await ff.load(); document.fonts.add(ff);
      await MC.db.put('assets', { id: aid, name: file.name, blob: new Blob([ab], { type: file.type || 'font/ttf' }), kind: 'font', type: file.type || 'font/ttf' });
      return { id: aid, family, name: file.name.replace(/\.[a-z0-9]+$/i, '') };
    },
    async loadFor(p) {
      const missing = [];
      for (const f of p.fonts || []) {
        if ([...document.fonts].some((x) => x.family.replace(/"/g, '') === f.family)) continue;
        const rec = await MC.db.get('assets', f.id);
        if (!rec) { missing.push(f.name); continue; }
        try { const ff = new FontFace(f.family, await rec.blob.arrayBuffer()); await ff.load(); document.fonts.add(ff); } catch (e) { missing.push(f.name); }
      }
      return missing;
    },
  };

  MC.LANGS = [['es', 'Español'], ['en', 'English'], ['fr', 'Français'], ['pt', 'Português'], ['it', 'Italiano'], ['de', 'Deutsch'], ['ca', 'Català']];

  MC.newText = (kind, start, p) => {
    const lang = p.lang || 'es';
    const it = { id: MC.uid(), kind, t: {}, start, dur: 2.5, x: 0, y: -0.28, w: 0.4, size: 0.05, font: 'comic', color: '#14141c', fill: '#ffffff', stroke: '#14141c',
      align: 'center', shape: 'speech', tail: { x: -0.06, y: 0.17 }, rot: 0, reveal: 'all', speed: 30, fit: false, anim: 'pop', loop: 'none', link: null };
    if (kind === 'box') Object.assign(it, { x: -0.18, y: -0.4, w: 0.5, size: 0.04, fill: '#FFE08A', align: 'left', anim: 'slide', shape: 'box' });
    if (kind === 'sfx') Object.assign(it, { y: 0.08, w: 0.8, size: 0.17, font: 'bangers', color: '#E5333D', rot: -8, anim: 'shake', shape: 'sfx' });
    if (kind === 'sub') Object.assign(it, { anim: 'none', shape: 'sub' });
    it.t[lang] = kind === 'sfx' ? MC.t('¡BOOM!', 'BOOM!') : kind === 'sub' ? '' : kind === 'box' ? MC.t('Esa misma noche…', 'That same night…') : MC.t('Escribe aquí', 'Type here');
    return it;
  };
  MC.textOf = (it, p, lang) => {
    const l = lang || p.lang || 'es';
    if (it.t[l] != null && it.t[l] !== '') return it.t[l];
    const first = (p.langs || ['es']).find((x) => it.t[x]);
    return it.t[l] === '' ? '' : first ? it.t[first] : '';
  };
  MC.textSpan = (it, p) => {
    if (it.link) { const c = (p.clips || []).find((x) => x.id === it.link); if (c) return { start: c.start, dur: c.dur }; }
    return { start: it.start, dur: it.dur };
  };
  MC.subY = (p, W, H) => (p.sub && p.sub.y != null ? p.sub.y : W / H < 0.8 ? 0.2 : 0.4); // desplazamiento desde el centro, fuera de las zonas de la interfaz

  const wrap = (ctx, str, maxW) => {
    const out = [];
    String(str).split('\n').forEach((par) => {
      let line = '';
      par.split(/\s+/).filter(Boolean).forEach((w) => {
        const test = line ? line + ' ' + w : w;
        if (line && ctx.measureText(test).width > maxW) { out.push(line); line = w; } else line = test;
      });
      out.push(line);
    });
    return out;
  };
  const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const easeOut = (x) => 1 - (1 - x) * (1 - x);

  MC.renderTexts = (ctx, p, time, o) => {
    const items = p.texts || [];
    if (!items.length) return;
    const { W, H } = o, lang = o.lang || p.lang || 'es';
    for (const it of items) {
      if (it.kind === 'sub' && o.subs === false) continue;
      const sp = MC.textSpan(it, p), a = time - sp.start;
      if (a < 0 || a >= sp.dur) continue;
      const str = MC.textOf(it, p, lang);
      if (!str) { if (o.collect) { /* sin texto: no se puede seleccionar en el visor */ } continue; }
      drawText(ctx, p, it, str, a, sp, o, W, H);
    }
  };

  function drawText(ctx, p, it, str, a, sp, o, W, H) {
    const isSub = it.kind === 'sub', st = p.sub || {};
    const font = MC.fontSpec(p, isSub ? st.font || 'bric' : it.font);
    const sizePx = (isSub ? st.size || 0.045 : it.size) * H, lineH = sizePx * 1.14;
    ctx.save();
    ctx.font = font.w + ' ' + sizePx + 'px ' + font.css;
    const maxW = (isSub ? 0.82 : it.w) * W, lines = wrap(ctx, str, maxW);
    let blockW = 0; lines.forEach((l) => { blockW = Math.max(blockW, ctx.measureText(l).width); });
    const blockH = lines.length * lineH;
    const cx = W / 2 + (isSub ? 0 : it.x) * W, cy = H / 2 + (isSub ? MC.subY(p, W, H) * H : it.y * H);

    /* revelado */
    const flat = lines.join(' ');
    let shown = flat.length;
    if (it.reveal && it.reveal !== 'all') {
      const speed = it.fit && it.link ? flat.length / Math.max(0.3, sp.dur * 0.85) : it.speed || 30;
      let n = Math.floor(a * speed);
      if (it.reveal === 'words') { const e = flat.indexOf(' ', Math.max(0, n)); n = e < 0 ? flat.length : e; }
      shown = clamp(n, 0, flat.length);
    }

    /* entrada y bucle */
    let dx = 0, dy = 0, sc = 1, alpha = 1, rock = 0;
    if (it.anim === 'pop') { const k = clamp(a / 0.3, 0, 1); sc = 0.3 + 0.7 * easeOutBack(k); alpha = clamp(a / 0.08, 0, 1); }
    else if (it.anim === 'bounce') { dy = -H * 0.14 * Math.exp(-a * 6) * Math.cos(a * 16); alpha = clamp(a / 0.08, 0, 1); }
    else if (it.anim === 'shake') { dx = Math.sin(a * 95) * W * 0.014 * Math.exp(-a * 5); rock = Math.sin(a * 70) * 2.2 * Math.exp(-a * 5); sc = 1 + 0.22 * Math.exp(-a * 9); }
    else if (it.anim === 'slide') { dy = (1 - easeOut(clamp(a / 0.3, 0, 1))) * H * 0.08; alpha = clamp(a / 0.2, 0, 1); }
    if (it.loop === 'float') dy += Math.sin(a * 2.4) * H * 0.006;
    if (it.loop === 'pulse') sc *= 1 + 0.03 * Math.sin(a * 6);
    const left = sp.dur - a; if (left < 0.15) alpha *= Math.max(0, left / 0.15);
    ctx.globalAlpha = alpha;
    ctx.translate(cx + dx, cy + dy); ctx.rotate(((it.rot || 0) + rock) * Math.PI / 180); ctx.scale(sc, sc); ctx.translate(-cx, -cy);

    const ink = it.stroke || '#14141c', ow = Math.max(2, H * 0.0042);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    let bounds = { x0: cx - blockW / 2, y0: cy - blockH / 2, x1: cx + blockW / 2, y1: cy + blockH / 2 }, tip = null;

    if (isSub) {
      if (st.bg !== false) {
        const pad = sizePx * 0.4; ctx.fillStyle = 'rgba(0,0,0,0.62)'; rr(ctx, cx - blockW / 2 - pad, cy - blockH / 2 - pad * 0.5, blockW + pad * 2, blockH + pad, sizePx * 0.28); ctx.fill();
      }
    } else if (it.kind === 'box') {
      const pad = sizePx * 0.7; bounds = { x0: cx - blockW / 2 - pad, y0: cy - blockH / 2 - pad * 0.7, x1: cx + blockW / 2 + pad, y1: cy + blockH / 2 + pad * 0.7 };
      ctx.fillStyle = it.fill || '#FFE08A'; ctx.strokeStyle = ink; ctx.lineWidth = ow;
      rr(ctx, bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0, sizePx * 0.25); ctx.fill(); ctx.stroke();
    } else if (it.kind === 'bubble') {
      const rx = (blockW / 2) * 1.32 + sizePx * 0.7, ry = (blockH / 2) * 1.32 + sizePx * 0.55;
      bounds = { x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry };
      const path = new Path2D(), tx = cx + it.tail.x * W, ty = cy + it.tail.y * H;
      if (it.shape === 'shout') {
        const n = 20;
        for (let i = 0; i < n * 2; i++) { const ang = (i / (n * 2)) * 6.2832, k = i % 2 ? 0.82 : 1.12, j = 1 + 0.06 * Math.sin(i * 12.9); const x = cx + Math.cos(ang) * rx * k * j, y = cy + Math.sin(ang) * ry * k * j; i ? path.lineTo(x, y) : path.moveTo(x, y); }
        path.closePath(); tip = null;
      } else if (it.shape === 'thought') {
        const n = 11, r = Math.min(rx, ry) * 0.5;
        for (let i = 0; i < n; i++) { const ang = (i / n) * 6.2832; path.moveTo(cx + Math.cos(ang) * (rx - r * 0.55) + r, cy + Math.sin(ang) * (ry - r * 0.55)); path.arc(cx + Math.cos(ang) * (rx - r * 0.55), cy + Math.sin(ang) * (ry - r * 0.55), r, 0, 6.2832); }
        path.moveTo(cx + rx * 0.8, cy); path.ellipse(cx, cy, rx * 0.8, ry * 0.8, 0, 0, 6.2832);
        for (let i = 1; i <= 3; i++) { const f = 0.55 + i * 0.14, px = cx + (tx - cx) * f, py = cy + (ty - cy) * f, rr2 = sizePx * (0.5 - i * 0.1); path.moveTo(px + rr2, py); path.arc(px, py, rr2, 0, 6.2832); }
        tip = { x: tx, y: ty };
      } else {
        path.ellipse(cx, cy, rx, ry, 0, 0, 6.2832);
        const inside = ((tx - cx) / rx) ** 2 + ((ty - cy) / ry) ** 2 < 1.05;
        if (!inside) {
          const th = Math.atan2((ty - cy) / ry, (tx - cx) / rx), P = (q) => [cx + rx * Math.cos(q), cy + ry * Math.sin(q)];
          const A = P(th - 0.32), B = P(th + 0.32);
          path.moveTo(A[0], A[1]); path.lineTo(tx, ty); path.lineTo(B[0], B[1]); path.closePath();
        }
        tip = { x: tx, y: ty };
      }
      ctx.strokeStyle = ink; ctx.lineWidth = ow * 2; ctx.stroke(path);
      ctx.fillStyle = it.fill || '#fff'; ctx.fill(path, 'nonzero');
    }

    /* texto, línea a línea, con revelado */
    ctx.font = font.w + ' ' + sizePx + 'px ' + font.css; ctx.textBaseline = 'middle';
    const al = isSub ? 'center' : it.align || 'center';
    ctx.textAlign = al;
    let left2 = shown;
    const y0 = cy - blockH / 2 + lineH / 2;
    lines.forEach((l, i) => {
      if (left2 <= 0) return;
      const part = l.slice(0, Math.min(l.length, left2)); left2 -= l.length + 1;
      const x = al === 'left' ? cx - blockW / 2 : al === 'right' ? cx + blockW / 2 : cx, y = y0 + i * lineH;
      if (it.kind === 'sfx') {
        ctx.strokeStyle = ink; ctx.lineWidth = sizePx * 0.2; ctx.strokeText(part, x + sizePx * 0.05, y + sizePx * 0.06);
        ctx.strokeStyle = it.fill && it.fill !== '#ffffff' ? it.fill : '#ECEEF0'; ctx.lineWidth = sizePx * 0.12; ctx.strokeText(part, x, y);
        ctx.fillStyle = it.color; ctx.fillText(part, x, y);
      } else {
        if (isSub && st.bg === false) { ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = sizePx * 0.16; ctx.strokeText(part, x, y); }
        ctx.fillStyle = isSub ? st.color || '#ffffff' : it.color; ctx.fillText(part, x, y);
      }
    });
    if (it.kind === 'sfx') bounds = { x0: cx - blockW / 2 - sizePx * 0.2, y0: cy - blockH / 2 - sizePx * 0.1, x1: cx + blockW / 2 + sizePx * 0.2, y1: cy + blockH / 2 + sizePx * 0.1 };
    ctx.restore();
    if (o.collect) o.collect.push({ id: it.id, cx, cy, bounds, tip, rot: it.rot || 0 });
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  /* Subtítulos SRT */
  const ts = (s) => { const ms = Math.round(s * 1000), pad = (n, l) => String(n).padStart(l || 2, '0'); return pad(Math.floor(ms / 3600000)) + ':' + pad(Math.floor(ms / 60000) % 60) + ':' + pad(Math.floor(ms / 1000) % 60) + ',' + pad(ms % 1000, 3); };
  MC.srt = (p, lang) => {
    const list = (p.texts || []).filter((x) => x.kind === 'sub').map((x) => ({ x, sp: MC.textSpan(x, p), s: MC.textOf(x, p, lang) })).filter((e) => e.s).sort((a, b) => a.sp.start - b.sp.start);
    return list.map((e, i) => (i + 1) + '\n' + ts(e.sp.start) + ' --> ' + ts(e.sp.start + e.sp.dur) + '\n' + e.s).join('\n\n') + (list.length ? '\n' : '');
  };

  /* Subtítulos desde la locución: un subtítulo por frase (entre pausas), sin texto para que lo escribas. No hay reconocimiento de voz. */
  MC.subsFromVoice = (p) => {
    const made = [], pauses = MC.audio.voicePauses(p);
    (p.clips || []).filter((c) => c.track === 'voz').forEach((c) => {
      const cuts = pauses.filter((x) => x.t > c.start + 0.2 && x.t < c.start + c.dur - 0.2).map((x) => x.t);
      const edges = [c.start].concat(cuts, [c.start + c.dur]);
      for (let i = 0; i < edges.length - 1; i++) {
        const it = MC.newText('sub', edges[i], p); it.t[p.lang || 'es'] = ''; it.start = Math.round(edges[i] * 100) / 100; it.dur = Math.max(0.3, Math.round((edges[i + 1] - edges[i]) * 100) / 100);
        made.push(it);
      }
    });
    return made;
  };
})();
