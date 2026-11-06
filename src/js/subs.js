/* Subtítulos: una capa de subtítulo contiene todo el texto de una locución, con el momento exacto de cada palabra y de los silencios.
   Se dibuja por líneas (cues) que salen de agrupar las palabras; la palabra que suena se puede resaltar (karaoke).
   Visor y exportación usan este mismo código. */
(function () {
  const MC = window.MC;
  const { clamp } = MC;

  /* ---------- estilos y presets ---------- */
  MC.SUB_DEFAULT = { font: 'bric', size: 0.045, color: '#ffffff', hi: '#ffd84a', upAlpha: 1, doneColor: null, mode: 'line', upper: false, strokeW: 0, strokeColor: '#000000', shadow: 0, shadowColor: '#000000',
    bg: true, bgColor: '#000000', bgAlpha: 0.62, bgMode: 'block', pad: 0.35, radius: 0, y: null, maxW: 0.82, maxChars: 34, lines: 2, hiScale: 1, hiBg: null, anim: 'fade', gapBreak: 0.7,
    align: 'center', ls: 0, lineH: 1.18, hs: 0, hsColor: '#000000', rot: 0, hiPop: false, hiUnder: false, hiBounce: false, hiGlow: false, grad: null, bgStroke: 0, bgStrokeColor: '#ffffff' };
  MC.SUB_CATS = [['todos', 'Todos', 'All'], ['redes', 'Redes', 'Social'], ['cine', 'Cine y serie', 'Film and TV'], ['comic', 'Cómic', 'Comic'], ['creativo', 'Creativos', 'Creative']];
  MC.SUB_PRESETS = [
    /* redes */
    { v: 'tiktok', c: 'redes', es: 'TikTok', en: 'TikTok', s: { font: 'montserrat', bg: false, upper: true, strokeW: 0.2, mode: 'karaoke', hi: '#ffd84a', hiScale: 1.1, hiPop: true, size: 0.058, maxChars: 20, lines: 2, anim: 'pop' } },
    { v: 'reels', c: 'redes', es: 'Reels', en: 'Reels', s: { font: 'poppins', bg: false, strokeW: 0.14, shadow: 0.35, mode: 'karaoke', hi: '#ff5d9e', hiPop: true, size: 0.054, maxChars: 22, anim: 'pop' } },
    { v: 'shorts', c: 'redes', es: 'Shorts', en: 'Shorts', s: { font: 'archivo', bg: false, upper: true, strokeW: 0.16, mode: 'karaoke', hi: '#ff3b3b', hiScale: 1.12, size: 0.056, maxChars: 18, anim: 'zoom' } },
    { v: 'palabra', c: 'redes', es: 'Una palabra', en: 'One word', s: { font: 'anton', mode: 'word', bg: false, upper: true, strokeW: 0.18, size: 0.11, anim: 'pop', y: 0.1, color: '#ffffff' } },
    { v: 'chip', c: 'redes', es: 'Palabra con fondo', en: 'Word on a chip', s: { font: 'poppins', mode: 'karaoke', bg: false, color: '#ffffff', hi: '#14141c', hiBg: '#ffd84a', strokeW: 0.12, radius: 0.3, size: 0.052, anim: 'fade', hiPop: true } },
    { v: 'subrayado', c: 'redes', es: 'Subrayado que sigue', en: 'Following underline', s: { font: 'montserrat', mode: 'karaoke', bg: false, strokeW: 0.1, hi: '#ffffff', hiUnder: true, upAlpha: 0.65, size: 0.052, shadow: 0.3 } },
    { v: 'caja', c: 'redes', es: 'Caja moderna', en: 'Modern box', s: { font: 'poppins', bgColor: '#8C7CFF', bgAlpha: 0.97, radius: 0.5, pad: 0.55, size: 0.046, bgMode: 'block', anim: 'slide' } },
    { v: 'pildora', c: 'redes', es: 'Píldora por línea', en: 'Pill per line', s: { font: 'rubik', bgColor: '#ffffff', bgAlpha: 1, color: '#14141c', bgMode: 'line', radius: 0.9, pad: 0.4, size: 0.05, anim: 'pop', strokeW: 0 } },
    /* cine y serie */
    { v: 'classic', c: 'cine', es: 'Clásico', en: 'Classic', s: {} },
    { v: 'cine', c: 'cine', es: 'Cine', en: 'Cinema', s: { bg: false, shadow: 0.55, size: 0.042, anim: 'fade', font: 'bric' } },
    { v: 'pelicula', c: 'cine', es: 'Película (serif)', en: 'Film (serif)', s: { font: 'playfair', bg: false, color: '#fff7e0', shadow: 0.5, size: 0.046, anim: 'fade', ls: 1 } },
    { v: 'netflix', c: 'cine', es: 'Serie', en: 'Series', s: { font: 'oswald', bg: false, color: '#ffffff', strokeW: 0.1, shadow: 0.4, size: 0.05, anim: 'fade' } },
    { v: 'minimo', c: 'cine', es: 'Mínimo', en: 'Minimal', s: { bg: false, size: 0.034, color: '#ECEEF0', shadow: 0.3, anim: 'fade', maxChars: 44 } },
    { v: 'documental', c: 'cine', es: 'Documental', en: 'Documentary', s: { font: 'bric', bgColor: '#000000', bgAlpha: 0.78, radius: 0, pad: 0.5, size: 0.04, align: 'left', anim: 'slide' } },
    { v: 'tercio', c: 'cine', es: 'Tercio inferior', en: 'Lower third', s: { font: 'montserrat', bgColor: '#e5333d', bgAlpha: 1, color: '#ffffff', align: 'left', radius: 0, pad: 0.5, size: 0.044, bgMode: 'line', anim: 'slide', y: 0.3 } },
    { v: 'papel', c: 'cine', es: 'Papel', en: 'Paper', s: { font: 'courier', bgColor: '#fbf7ee', bgAlpha: 1, color: '#14141c', radius: 0.1, pad: 0.45, size: 0.044, strokeW: 0, anim: 'fade' } },
    /* cómic */
    { v: 'comic', c: 'comic', es: 'Cómic', en: 'Comic', s: { font: 'bangers', bg: false, upper: true, strokeW: 0.22, strokeColor: '#14141c', mode: 'karaoke', hi: '#ffd84a', size: 0.062, hs: 0.1, hsColor: '#14141c', anim: 'pop', maxChars: 24, hiPop: true, hiScale: 1.08 } },
    { v: 'luckiest', c: 'comic', es: 'Cómic gordo', en: 'Bold comic', s: { font: 'luckiest', bg: false, color: '#ffffff', strokeW: 0.24, strokeColor: '#14141c', hs: 0.12, hsColor: '#e5333d', size: 0.06, upper: false, anim: 'pop', mode: 'karaoke', hi: '#ffd84a', maxChars: 22 } },
    { v: 'manga', c: 'comic', es: 'Manga', en: 'Manga', s: { font: 'comic', bg: false, strokeW: 0.18, size: 0.052, maxChars: 26, anim: 'fade' } },
    { v: 'rotulador', c: 'comic', es: 'Rotulador', en: 'Marker', s: { font: 'marker', bg: false, color: '#fff7a8', strokeW: 0.12, strokeColor: '#14141c', size: 0.05, rot: -2, anim: 'pop' } },
    { v: 'globo', c: 'comic', es: 'Globo de texto', en: 'Speech bubble', s: { font: 'comic', bgColor: '#ffffff', bgAlpha: 1, color: '#14141c', radius: 0.8, pad: 0.7, size: 0.046, bgStroke: 0.08, bgStrokeColor: '#14141c', anim: 'pop' } },
    { v: 'cartela', c: 'comic', es: 'Cartela', en: 'Caption box', s: { font: 'comic', bgColor: '#FFE08A', bgAlpha: 1, color: '#14141c', radius: 0, pad: 0.5, size: 0.042, bgStroke: 0.08, bgStrokeColor: '#14141c', align: 'left', anim: 'slide' } },
    /* creativos */
    { v: 'karaoke', c: 'creativo', es: 'Karaoke', en: 'Karaoke', s: { font: 'fredoka', mode: 'karaoke', hi: '#ffd84a', upAlpha: 0.5, bgAlpha: 0.7, size: 0.052, hiPop: true } },
    { v: 'neon', c: 'creativo', es: 'Neón', en: 'Neon', s: { font: 'marker', bg: false, color: '#f1e9ff', shadow: 1, shadowColor: '#8C7CFF', hiGlow: true, mode: 'karaoke', hi: '#ffffff', size: 0.05, anim: 'fade' } },
    { v: 'retro', c: 'creativo', es: 'Retro 8 bits', en: 'Retro 8-bit', s: { font: 'pixel', bg: true, bgColor: '#101030', bgAlpha: 0.9, color: '#7cff9a', size: 0.032, maxChars: 28, radius: 0, anim: 'none', upper: true, lineH: 1.5 } },
    { v: 'maquina', c: 'creativo', es: 'Máquina de escribir', en: 'Typewriter', s: { font: 'courier', mode: 'reveal', bg: true, bgAlpha: 0.7, size: 0.044, anim: 'none' } },
    { v: 'revelado', c: 'creativo', es: 'Va apareciendo', en: 'Builds up', s: { font: 'bric', mode: 'reveal', bgAlpha: 0.7, size: 0.048, anim: 'none' } },
    { v: 'bungee', c: 'creativo', es: 'Rótulo urbano', en: 'Urban sign', s: { font: 'bungee', bg: false, color: '#ffffff', strokeW: 0.14, hs: 0.1, hsColor: '#8C7CFF', size: 0.05, upper: true, anim: 'slide' } },
    { v: 'manuscrito', c: 'creativo', es: 'Manuscrito', en: 'Handwritten', s: { font: 'caveat', bg: false, color: '#fff', size: 0.07, shadow: 0.45, rot: -1.5, anim: 'fade', maxChars: 28 } },
    { v: 'dorado', c: 'creativo', es: 'Dorado', en: 'Golden', s: { font: 'playfair', bg: false, grad: ['#fff2a8', '#c98a1a'], strokeW: 0.08, strokeColor: '#4a2e00', shadow: 0.4, size: 0.056, upper: true, ls: 2, anim: 'fade' } },
    { v: 'tecno', c: 'creativo', es: 'Futurista', en: 'Futuristic', s: { font: 'righteous', bg: false, color: '#7de3ff', shadow: 0.9, shadowColor: '#2a8cff', size: 0.05, upper: true, ls: 3, anim: 'zoom', hiBounce: false } },
  ];
  MC.subStyle = (st) => Object.assign({}, MC.SUB_DEFAULT, st || {});
  MC.applySubPreset = (it, id) => { const p = MC.SUB_PRESETS.find((x) => x.v === id); if (p) { const keepY = it.style && it.style.y; it.style = MC.subStyle(p.s); it.style.preset = id; if (keepY != null && p.s.y == null) it.style.y = keepY; } return it.style; };

  /* ---------- modelo ---------- */
  MC.newSub = (p, start, dur, link) => ({ id: MC.uid(), name: MC.t('Subtítulos', 'Subtitles'), start: Math.round(start * 100) / 100, dur: Math.max(0.5, Math.round(dur * 100) / 100), link: link || null, style: Object.assign(MC.subStyle(p.subDefault || null), { preset: (p.subDefault && p.subDefault.preset) || 'classic' }), text: {}, words: {} });
  const tokens = (str) => String(str || '').split(/\s+/).filter(Boolean);
  MC.subWordsOf = (it, lang) => (it.words && it.words[lang]) || [];
  /* Vuelve a trocear el texto en palabras conservando los tiempos de las que coinciden por posición. */
  MC.subSetText = (it, lang, str) => {
    it.text = it.text || {}; it.words = it.words || {}; it.text[lang] = str;
    const old = (it.words[lang] || []), oldW = old.filter((e) => !e.sil), toks = tokens(str), out = []; let wi = 0;
    /* se conservan los silencios en su sitio relativo (después de la palabra número k) */
    const silAfter = {}; let k = -1; old.forEach((e) => { if (e.sil) { (silAfter[k] = silAfter[k] || []).push(e); } else k++; });
    toks.forEach((w, i) => { const o = oldW[i]; out.push({ w, s: o && o.w === w ? o.s : o && i < oldW.length ? o.s : null, br: o && o.br ? true : undefined }); if (silAfter[i]) silAfter[i].forEach((sx) => out.push(sx)); wi++; });
    it.words[lang] = out; return out;
  };
  /* Tiempos completos: las palabras sin marcar se reparten entre las marcadas vecinas (o entre el principio y el final de la capa). */
  MC.subTimed = (it, lang) => {
    const list = MC.subWordsOf(it, lang), A = it.start, B = it.start + it.dur, out = list.map((e, i) => Object.assign({ i }, e));
    const known = []; out.forEach((e, i) => { if (e.s != null) known.push(i); });
    const fill = (i0, i1, t0, t1) => { const idx = []; for (let i = i0; i < i1; i++) if (!out[i].sil) idx.push(i); const n = idx.length; if (!n) return; const wts = idx.map((i) => Math.max(1, out[i].w.length)), tot = wts.reduce((a, b) => a + b, 0); let acc = 0; idx.forEach((i, j) => { out[i].s = t0 + ((t1 - t0) * acc) / tot; out[i].est = true; acc += wts[j]; }); };
    if (!known.length) fill(0, out.length, A, B);
    else {
      fill(0, known[0], A, Math.max(A, out[known[0]].s));
      for (let q = 0; q < known.length - 1; q++) fill(known[q] + 1, known[q + 1], out[known[q]].s, out[known[q + 1]].s);
      const last = known[known.length - 1]; if (last < out.length - 1) { const t0 = out[last].s + Math.min(0.5, (B - out[last].s) / 2); fill(last + 1, out.length, Math.min(t0, B), B); }
    }
    return out;
  };
  /* Líneas de subtítulo a partir de las palabras: [{ s, e, words:[{ w, s, e }] }] */
  MC.subCues = (it, lang, style) => {
    const st = MC.subStyle(style || it.style), list = MC.subTimed(it, lang), B = it.start + it.dur, cues = []; let cur = null, lastE = -1, chars = 0;
    const maxC = Math.max(8, st.maxChars) * Math.max(1, st.lines);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.sil) { if (cur) { cur.e = Math.min(cur.e, e.s); cues.push(cur); cur = null; } continue; }
      const next = list.slice(i + 1).find((x) => x.s != null || x.sil), endT = next ? next.s : B, we = Math.min(endT, e.s + 1.6);
      if (cur && (e.br || chars + e.w.length + 1 > maxC || e.s - cur.words[cur.words.length - 1].e > st.gapBreak)) { cues.push(cur); cur = null; }
      if (!cur) { cur = { s: e.s, e: we, words: [] }; chars = 0; }
      cur.words.push({ w: e.w, s: e.s, e: Math.max(we, e.s + 0.05), est: e.est, i: e.i }); cur.e = Math.max(cur.e, we); chars += e.w.length + 1;
    }
    if (cur) cues.push(cur);
    cues.forEach((c, i) => { const n = cues[i + 1]; c.e = n ? Math.min(c.e + 0.12, n.s) : Math.min(c.e + 0.2, B + 0.2); });
    return cues;
  };
  MC.subActive = (p, time) => (p.subs || []).filter((it) => time >= it.start - 0.001 && time < it.start + it.dur + 0.3);

  /* ---------- dibujo ---------- */
  const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const hexA = (hex, a) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); const n = m ? parseInt(m[1], 16) : 0; return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + clamp(a, 0, 1) + ')'; };
  const rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); if (r > 0.5 && ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2)); else ctx.rect(x, y, w, h); };

  /* Pinta una línea concreta. cue: { s, e, words }, time: instante. Devuelve los límites. */
  MC.drawSubCue = (ctx, p, st, cue, time, W, H, yOver) => {
    const font = MC.fontSpec(p, st.font), size = st.size * H, lineH = size * (st.lineH || 1.18), upper = !!st.upper;
    ctx.save(); ctx.font = font.w + ' ' + size + 'px ' + font.css; ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (st.ls || 0) * size * 0.03 + 'px';
    const txt = (w) => (upper ? w.toUpperCase() : w), sp = ctx.measureText(' ').width * 1.15 + st.strokeW * size * 0.45, maxW = st.maxW * W;
    let words = cue.words, curIdx = -1;
    words.forEach((w, i) => { if (time >= w.s) curIdx = i; });
    if (st.mode === 'word') { words = [words[Math.max(0, curIdx)]]; }
    if (st.mode === 'reveal') { words = cue.words.slice(0, Math.max(1, curIdx + 1)); }
    /* reparto en líneas (se mide con todas las palabras para que el texto no «salte» al revelarse) */
    const layoutWords = st.mode === 'reveal' ? cue.words : words, lines = []; let line = [], lw = 0;
    layoutWords.forEach((w, i) => { const wd = ctx.measureText(txt(w.w)).width; if (line.length && lw + sp + wd > maxW) { lines.push({ ws: line, w: lw }); line = []; lw = 0; } line.push({ w, wd, i }); lw += (line.length > 1 ? sp : 0) + wd; });
    if (line.length) lines.push({ ws: line, w: lw });
    let blockW = 0; lines.forEach((l) => { blockW = Math.max(blockW, l.w); });
    const blockH = lines.length * lineH, cx = W / 2, cy = H / 2 + (yOver != null ? yOver : MC.subY(p, W, H)) * H;
    /* animación de entrada y salida */
    const a = time - cue.s, left = cue.e - time; let alpha = 1, sc = 1, dy = 0;
    if (st.anim === 'fade') alpha = clamp(a / 0.15, 0, 1); else if (st.anim === 'pop') { const k = clamp(a / 0.25, 0, 1); sc = 0.4 + 0.6 * easeOutBack(k); alpha = clamp(a / 0.07, 0, 1); } else if (st.anim === 'slide') { dy = (1 - clamp(a / 0.25, 0, 1)) * H * 0.04; alpha = clamp(a / 0.18, 0, 1); } else if (st.anim === 'zoom') { sc = 1.35 - 0.35 * clamp(a / 0.25, 0, 1); alpha = clamp(a / 0.12, 0, 1); }
    if (left < 0.12) alpha *= Math.max(0, left / 0.12);
    ctx.globalAlpha = alpha; ctx.translate(cx, cy + dy); if (st.rot) ctx.rotate((st.rot * Math.PI) / 180); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    const top = cy - blockH / 2, padPx = st.pad * size, rad = st.radius * size;
    const drawBg = (x, y, w, h, color, aa) => { ctx.save(); ctx.fillStyle = hexA(color, aa); rrect(ctx, x, y, w, h, rad); ctx.fill(); if (st.bgStroke > 0) { ctx.strokeStyle = st.bgStrokeColor || '#fff'; ctx.lineWidth = st.bgStroke * size; ctx.stroke(); } ctx.restore(); };
    const lx = (l) => (st.align === 'left' ? cx - blockW / 2 : st.align === 'right' ? cx + blockW / 2 - l.w : cx - l.w / 2);
    if (st.bg && st.bgMode !== 'none') {
      if (st.bgMode === 'line') lines.forEach((l, li) => drawBg(lx(l) - padPx, top + li * lineH - padPx * 0.1, l.w + padPx * 2, lineH + padPx * 0.2, st.bgColor, st.bgAlpha));
      else drawBg(cx - blockW / 2 - padPx, top - padPx * 0.55, blockW + padPx * 2, blockH + padPx * 1.1, st.bgColor, st.bgAlpha);
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    lines.forEach((l, li) => {
      let x = lx(l); const y = top + li * lineH + size * 0.92;
      l.ws.forEach((q) => {
        const w = q.w, ci = cue.words.indexOf(w), isCur = st.mode === 'karaoke' && ci === curIdx, spoken = st.mode === 'karaoke' && ci < curIdx, upcoming = st.mode === 'karaoke' && ci > curIdx;
        const pw = isCur ? clamp((time - w.s) / 0.16, 0, 1) : 1, pop = isCur && st.hiPop ? 1 + 0.25 * (1 - pw) : 1, s2 = (isCur ? Math.max(1, st.hiScale) : 1) * pop, by = isCur && st.hiBounce ? -size * 0.14 * Math.sin(Math.PI * pw) : 0;
        ctx.save(); ctx.translate(x + q.wd / 2, y + by); ctx.scale(s2, s2); ctx.translate(-(x + q.wd / 2), -y);
        if (isCur && st.hiBg) { ctx.save(); ctx.fillStyle = st.hiBg; rrect(ctx, x - size * 0.16, y - size * 0.86, q.wd + size * 0.32, size * 1.12, rad || size * 0.18); ctx.fill(); ctx.restore(); }
        const col = isCur ? st.hi : spoken && st.doneColor ? st.doneColor : st.color;
        if (st.hs > 0) { ctx.save(); ctx.fillStyle = st.hsColor; ctx.strokeStyle = st.hsColor; if (st.strokeW > 0) { ctx.lineWidth = st.strokeW * size; ctx.strokeText(txt(w.w), x + st.hs * size, y + st.hs * size); } ctx.fillText(txt(w.w), x + st.hs * size, y + st.hs * size); ctx.restore(); }
        if (st.shadow > 0 || (isCur && st.hiGlow)) { const gl = isCur && st.hiGlow; ctx.shadowColor = hexA(gl ? st.hi : st.shadowColor, 0.95); ctx.shadowBlur = (gl ? 0.7 : st.shadow * 0.5) * size; ctx.shadowOffsetY = gl ? 0 : st.shadow * size * 0.06; }
        if (st.strokeW > 0) { ctx.save(); ctx.strokeStyle = st.strokeColor; ctx.lineWidth = st.strokeW * size; ctx.strokeText(txt(w.w), x, y); ctx.restore(); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
        ctx.globalAlpha = alpha * (upcoming ? st.upAlpha : 1);
        if (st.grad && !isCur) { const gg = ctx.createLinearGradient(0, y - size * 0.85, 0, y + size * 0.1); gg.addColorStop(0, st.grad[0]); gg.addColorStop(1, st.grad[1]); ctx.fillStyle = gg; } else ctx.fillStyle = col;
        ctx.fillText(txt(w.w), x, y);
        if (isCur && st.hiUnder) { ctx.shadowColor = 'transparent'; ctx.fillStyle = st.hi; ctx.fillRect(x, y + size * 0.12, q.wd * (0.35 + 0.65 * pw), Math.max(2, size * 0.09)); }
        ctx.restore(); x += q.wd + sp;
      });
    });
    ctx.restore();
    return { x0: cx - blockW / 2, x1: cx + blockW / 2, y0: top, y1: top + blockH };
  };
  MC.renderSubs = (ctx, p, time, o) => {
    const list = p.subs || []; if (!list.length || o.subs === false || (p.tv && p.tv.subs && p.tv.subs.off)) return;
    const { W, H } = o, lang = o.lang || p.lang || 'es';
    MC.subActive(p, time).forEach((it) => {
      const cues = MC.subCues(it, lang, it.style); if (!cues.length) return;
      const cue = cues.find((c) => time >= c.s && time < c.e); if (!cue) return;
      MC.drawSubCue(ctx, p, MC.subStyle(it.style), cue, time, W, H, it.style && it.style.y != null ? it.style.y : null);
    });
  };
  /* Miniatura de un estilo (para las tarjetas de presets). */
  MC.subPreview = (canvas, p, style, sample, at) => {
    const W = canvas.width, H = canvas.height, g = canvas.getContext('2d'), st = MC.subStyle(style);
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#2b2a45'); gr.addColorStop(1, '#6b4a5f'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const ws = (sample || MC.t('Así se verá tu texto', 'This is how your text looks')).split(' ').map((w, i) => ({ w, s: i * 0.4, e: i * 0.4 + 0.4 })), cue = { s: 0, e: 99, words: ws };
    const st2 = Object.assign({}, st, { size: Math.min(0.24, st.size * 3.3), maxW: 0.94, anim: 'none', y: 0 });
    MC.drawSubCue(g, p, st2, cue, at != null ? at : 0.4 * Math.min(2, ws.length - 1) + 0.05, W, H, 0);
  };

  /* ---------- importar tiempos de palabras ---------- */
  const num = (v) => (v == null || v === '' ? null : Number(String(v).replace(',', '.')));
  const clock = (s) => { const m = /^(?:(\d+):)?(\d+):(\d+)(?:[.,](\d+))?$/.exec(String(s).trim()); if (!m) return null; return (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3] + (m[4] ? +('0.' + m[4]) : 0); };
  const spread = (text, s, e) => { const tk = tokens(text), tot = tk.reduce((a, b) => a + Math.max(1, b.length), 0); let acc = 0; return tk.map((w) => { const a = s + ((e - s) * acc) / tot; acc += Math.max(1, w.length); return { w, s: a, e: s + ((e - s) * acc) / tot }; }); };
  /* Devuelve [{ w, s, e }] en segundos (e puede faltar). Admite JSON (Whisper, Deepgram, ElevenLabs, listas simples), SRT, VTT y CSV/TSV/TXT. */
  MC.parseTimings = (raw, name) => {
    const txt = String(raw).replace(/^﻿/, '').trim(); let out = [];
    if (/^[\[{]/.test(txt)) {
      const j = JSON.parse(txt), pick = (o, ks) => { for (const k of ks) if (o[k] != null) return o[k]; return null; };
      const words = [];
      const fromList = (arr) => arr.forEach((o) => { if (!o) return; if (o.words && Array.isArray(o.words)) { fromList(o.words); return; } const w = pick(o, ['word', 'w', 'text', 'token', 'punctuated_word']), s = num(pick(o, ['start', 's', 'from', 'begin', 'start_time', 'startTime', 't'])), e = num(pick(o, ['end', 'e', 'to', 'end_time', 'endTime'])); if (w != null && s != null) words.push({ w: String(w).trim(), s, e }); });
      if (Array.isArray(j)) fromList(j);
      else if (j.alignment || j.character_start_times_seconds || j.characters) {
        const al = j.alignment || j, ch = al.characters || al.chars, st = al.character_start_times_seconds || al.char_start_times, en = al.character_end_times_seconds || al.char_end_times; let cur = '', cs = null, ce = null;
        (ch || []).forEach((c, i) => { if (/\s/.test(c)) { if (cur) words.push({ w: cur, s: cs, e: ce }); cur = ''; cs = null; } else { if (cs == null) cs = st[i]; ce = en ? en[i] : st[i]; cur += c; } }); if (cur) words.push({ w: cur, s: cs, e: ce });
      } else if (j.segments) fromList(j.segments); else if (j.words) fromList(j.words); else if (j.results) { const alt = (((j.results.channels || [])[0] || {}).alternatives || [])[0]; if (alt && alt.words) fromList(alt.words); } else if (j.transcription) fromList(j.transcription);
      out = words.map((x) => ({ w: x.w, s: x.s, e: x.e }));
      const mx = Math.max(0, ...out.map((x) => x.s || 0)); if (mx > 3000 && out.every((x) => Number.isInteger(x.s))) out.forEach((x) => { x.s /= 1000; if (x.e != null) x.e /= 1000; });
    } else if (/-->/.test(txt)) {
      txt.split(/\r?\n\r?\n+/).forEach((blk) => { const lines = blk.split(/\r?\n/).filter((l) => l.trim() && !/^(WEBVTT|NOTE|\d+$)/.test(l.trim())); const ti = lines.findIndex((l) => /-->/.test(l)); if (ti < 0) return; const m = lines[ti].split('-->'), a = clock(m[0].trim().split(' ')[0]), b = clock(m[1].trim().split(' ')[0]); if (a == null || b == null) return; out.push(...spread(lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, ''), a, b)); });
    } else {
      txt.split(/\r?\n/).forEach((ln) => { const l = ln.trim(); if (!l || /^(#|\/\/)/.test(l)) return; const parts = l.split(/[\t;,]|\s{2,}/).map((x) => x.trim()).filter((x) => x !== '');
        let w = null, s = null, e = null; const nums = []; parts.forEach((x) => { const c = clock(x), n = /^-?\d+([.,]\d+)?$/.test(x) ? num(x) : null; if (c != null) nums.push(c); else if (n != null) nums.push(n); else if (w == null) w = x; });
        if (w == null) { const m = /^(\d+(?:[.,]\d+)?)\s+(?:(\d+(?:[.,]\d+)?)\s+)?(.+)$/.exec(l); if (m) { s = num(m[1]); e = m[2] ? num(m[2]) : null; w = m[3]; } } else { s = nums[0]; e = nums[1] != null ? nums[1] : null; }
        if (w != null && s != null) out.push({ w, s, e }); });
    }
    out = out.filter((x) => x.w && x.s != null && isFinite(x.s)).sort((a, b) => a.s - b.s);
    return out;
  };
  /* Convierte esas palabras en la lista de la capa. Los huecos mayores de minSil segundos entre palabras pasan a ser silencios. */
  MC.subApplyTimings = (it, lang, ws, offset, minSil) => {
    const ms = minSil == null ? 0.35 : minSil, list = []; let text = [];
    ws.forEach((x, i) => { list.push({ w: x.w, s: Math.round((x.s + offset) * 1000) / 1000 }); text.push(x.w); const nx = ws[i + 1], end = x.e != null ? x.e : null; if (end != null && (nx ? nx.s - end > ms : false)) list.push({ sil: true, s: Math.round((end + offset) * 1000) / 1000 }); });
    it.text = it.text || {}; it.words = it.words || {}; it.text[lang] = text.join(' '); it.words[lang] = list;
    const last = ws[ws.length - 1]; if (last) { const endT = (last.e != null ? last.e : last.s + 0.6) + offset + 0.3; it.dur = Math.max(it.dur, Math.round((endT - it.start) * 100) / 100); }
    return list.length;
  };
  /* Reparte las palabras por igual dentro de [a, b] (o según los tramos con voz si hay una locución). */
  MC.subDistribute = (it, lang, a, b, useVoice, p) => {
    const list = MC.subWordsOf(it, lang), ws = list.filter((e) => !e.sil); if (!ws.length) return;
    let spans = [[a, b]];
    if (useVoice && p) { const ps = MC.audio.voicePauses(p).filter((x) => x.t > a + 0.2 && x.t < b - 0.2).map((x) => x.t); if (ps.length) { const edges = [a].concat(ps, [b]); spans = []; for (let i = 0; i < edges.length - 1; i++) spans.push([edges[i], edges[i + 1]]); } }
    const tot = ws.reduce((x, y) => x + Math.max(1, y.w.length), 0), totT = spans.reduce((x, y) => x + (y[1] - y[0]), 0); let acc = 0;
    ws.forEach((e) => { let pos = (acc / tot) * totT, si = 0; while (si < spans.length - 1 && pos > spans[si][1] - spans[si][0]) { pos -= spans[si][1] - spans[si][0]; si++; } e.s = Math.round((spans[si][0] + pos) * 1000) / 1000; acc += Math.max(1, e.w.length); });
    it.words[lang] = list.filter((e) => !e.sil);
  };

  /* SRT con las capas de subtítulo (una entrada por línea). */
  const ts = (s) => { const ms = Math.round(s * 1000), pad = (n, l) => String(n).padStart(l || 2, '0'); return pad(Math.floor(ms / 3600000)) + ':' + pad(Math.floor(ms / 60000) % 60) + ':' + pad(Math.floor(ms / 1000) % 60) + ',' + pad(ms % 1000, 3); };
  MC.subsSrt = (p, lang, startIndex) => {
    const rows = []; (p.subs || []).forEach((it) => MC.subCues(it, lang, it.style).forEach((c) => rows.push({ s: c.s, e: c.e, text: c.words.map((w) => w.w).join(' ') })));
    rows.sort((a, b) => a.s - b.s); return rows.map((r, i) => (i + (startIndex || 0) + 1) + '\n' + ts(r.s) + ' --> ' + ts(r.e) + '\n' + r.text).join('\n\n');
  };
})();
