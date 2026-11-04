/* Subtítulos: una capa de subtítulo contiene todo el texto de una locución, con el momento exacto de cada palabra y de los silencios.
   Se dibuja por líneas (cues) que salen de agrupar las palabras; la palabra que suena se puede resaltar (karaoke).
   Visor y exportación usan este mismo código. */
(function () {
  const MC = window.MC;
  const { clamp } = MC;

  /* ---------- estilos y presets ---------- */
  MC.SUB_DEFAULT = { font: 'bric', size: 0.045, color: '#ffffff', hi: '#ffd84a', upAlpha: 1, doneColor: null, mode: 'line', upper: false, strokeW: 0, strokeColor: '#000000', shadow: 0, shadowColor: '#000000',
    bg: true, bgColor: '#000000', bgAlpha: 0.62, bgMode: 'block', pad: 0.35, radius: 0, y: null, maxW: 0.82, maxChars: 34, lines: 2, hiScale: 1, hiBg: null, anim: 'fade', gapBreak: 0.7 };
  MC.SUB_PRESETS = [
    { v: 'classic', es: 'Clásico', en: 'Classic', s: {} },
    { v: 'cine', es: 'Cine', en: 'Cinema', s: { bg: false, shadow: 0.5, size: 0.042, anim: 'fade' } },
    { v: 'tiktok', es: 'TikTok', en: 'TikTok', s: { bg: false, upper: true, strokeW: 0.16, mode: 'karaoke', hi: '#ffd84a', hiScale: 1.12, size: 0.058, maxChars: 22, anim: 'pop' } },
    { v: 'karaoke', es: 'Karaoke', en: 'Karaoke', s: { mode: 'karaoke', hi: '#ffd84a', upAlpha: 0.55, bgAlpha: 0.7, size: 0.05 } },
    { v: 'comic', es: 'Cómic', en: 'Comic', s: { font: 'bangers', bg: false, upper: true, strokeW: 0.2, strokeColor: '#14141c', mode: 'karaoke', hi: '#ffd84a', size: 0.062, shadow: 0.4, anim: 'pop', maxChars: 24 } },
    { v: 'neon', es: 'Neón', en: 'Neon', s: { font: 'marker', bg: false, color: '#f1e9ff', shadow: 1, shadowColor: '#8C7CFF', size: 0.05, anim: 'fade' } },
    { v: 'caja', es: 'Caja moderna', en: 'Modern box', s: { bgColor: '#8C7CFF', bgAlpha: 0.96, radius: 0.45, pad: 0.55, size: 0.046, bgMode: 'block', anim: 'slide' } },
    { v: 'minimo', es: 'Mínimo', en: 'Minimal', s: { bg: false, size: 0.034, color: '#ECEEF0', shadow: 0.3, anim: 'fade', maxChars: 44 } },
    { v: 'palabra', es: 'Una palabra', en: 'One word', s: { mode: 'word', bg: false, upper: true, strokeW: 0.18, size: 0.1, anim: 'pop', y: 0.12 } },
    { v: 'chip', es: 'Palabra resaltada', en: 'Highlighted word', s: { mode: 'karaoke', bg: false, color: '#ffffff', hi: '#14141c', hiBg: '#ffd84a', strokeW: 0.1, radius: 0.3, size: 0.052, upAlpha: 1, anim: 'fade' } },
    { v: 'papel', es: 'Papel', en: 'Paper', s: { font: 'comic', bgColor: '#fbf7ee', bgAlpha: 1, color: '#14141c', radius: 0.12, pad: 0.45, size: 0.046, strokeW: 0, anim: 'fade' } },
    { v: 'manga', es: 'Manga', en: 'Manga', s: { font: 'comic', bg: false, strokeW: 0.16, size: 0.052, maxChars: 26, anim: 'fade' } },
    { v: 'revelado', es: 'Revelado', en: 'Reveal', s: { mode: 'reveal', bgAlpha: 0.7, size: 0.048, anim: 'none' } },
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
    const font = MC.fontSpec(p, st.font), size = st.size * H, lineH = size * 1.18, upper = !!st.upper;
    ctx.save(); ctx.font = font.w + ' ' + size + 'px ' + font.css; ctx.textBaseline = 'alphabetic';
    const txt = (w) => (upper ? w.toUpperCase() : w), sp = ctx.measureText(' ').width * 1.15 + st.strokeW * size * 0.45, maxW = st.maxW * W;
    let words = cue.words, curIdx = -1;
    words.forEach((w, i) => { if (time >= w.s) curIdx = i; });
    if (st.mode === 'word') { words = [words[Math.max(0, curIdx)]]; }
    if (st.mode === 'reveal') { words = cue.words.slice(0, Math.max(1, curIdx + 1)); }
    /* reparto en líneas (se mide con todas las palabras para que el texto no «salte» al revelarse) */
    const layoutWords = st.mode === 'reveal' ? cue.words : words, lines = []; let line = [], lw = 0;
    layoutWords.forEach((w, i) => { const wd = ctx.measureText(txt(w.w)).width * (st.mode === 'word' ? 1 : 1); if (line.length && lw + sp + wd > maxW) { lines.push({ ws: line, w: lw }); line = []; lw = 0; } line.push({ w, wd, i }); lw += (line.length > 1 ? sp : 0) + wd; });
    if (line.length) lines.push({ ws: line, w: lw });
    let blockW = 0; lines.forEach((l) => { blockW = Math.max(blockW, l.w); });
    const blockH = lines.length * lineH, cx = W / 2, cy = H / 2 + (yOver != null ? yOver : MC.subY(p, W, H)) * H;
    /* animación de entrada y salida */
    const a = time - cue.s, left = cue.e - time; let alpha = 1, sc = 1, dy = 0;
    if (st.anim === 'fade') alpha = clamp(a / 0.15, 0, 1); else if (st.anim === 'pop') { const k = clamp(a / 0.25, 0, 1); sc = 0.4 + 0.6 * easeOutBack(k); alpha = clamp(a / 0.07, 0, 1); } else if (st.anim === 'slide') { dy = (1 - clamp(a / 0.25, 0, 1)) * H * 0.04; alpha = clamp(a / 0.18, 0, 1); } else if (st.anim === 'zoom') { sc = 1.35 - 0.35 * clamp(a / 0.25, 0, 1); alpha = clamp(a / 0.12, 0, 1); }
    if (left < 0.12) alpha *= Math.max(0, left / 0.12);
    ctx.globalAlpha = alpha; ctx.translate(cx, cy + dy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    const top = cy - blockH / 2, padPx = st.pad * size, rad = st.radius * size;
    const drawBg = (x, y, w, h, color, aa) => { ctx.save(); ctx.fillStyle = hexA(color, aa); rrect(ctx, x, y, w, h, rad); ctx.fill(); ctx.restore(); };
    if (st.bg && st.bgMode !== 'none') {
      if (st.bgMode === 'line') lines.forEach((l, li) => drawBg(cx - l.w / 2 - padPx, top + li * lineH - padPx * 0.1, l.w + padPx * 2, lineH + padPx * 0.2, st.bgColor, st.bgAlpha));
      else drawBg(cx - blockW / 2 - padPx, top - padPx * 0.55, blockW + padPx * 2, blockH + padPx * 1.1, st.bgColor, st.bgAlpha);
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    lines.forEach((l, li) => {
      let x = cx - l.w / 2; const y = top + li * lineH + size * 0.92;
      l.ws.forEach((q) => {
        const w = q.w, isCur = st.mode === 'karaoke' && w === cue.words[curIdx], spoken = st.mode === 'karaoke' && cue.words.indexOf(w) < curIdx, upcoming = st.mode === 'karaoke' && cue.words.indexOf(w) > curIdx;
        const s2 = isCur ? Math.max(1, st.hiScale) : 1;
        ctx.save(); ctx.translate(x + q.wd / 2, y); ctx.scale(s2, s2); ctx.translate(-(x + q.wd / 2), -y);
        if (isCur && st.hiBg) { ctx.save(); ctx.fillStyle = st.hiBg; rrect(ctx, x - size * 0.16, y - size * 0.86, q.wd + size * 0.32, size * 1.12, rad || size * 0.18); ctx.fill(); ctx.restore(); }
        if (st.shadow > 0) { ctx.shadowColor = hexA(st.shadowColor, 0.9); ctx.shadowBlur = st.shadow * size * 0.5; ctx.shadowOffsetY = st.shadow * size * 0.06; }
        if (st.strokeW > 0) { ctx.save(); ctx.strokeStyle = st.strokeColor; ctx.lineWidth = st.strokeW * size; ctx.strokeText(txt(w.w), x, y); ctx.restore(); ctx.shadowColor = 'transparent'; }
        ctx.globalAlpha = alpha * (upcoming ? st.upAlpha : 1);
        ctx.fillStyle = isCur ? st.hi : spoken && st.doneColor ? st.doneColor : st.color; ctx.fillText(txt(w.w), x, y);
        ctx.restore(); x += q.wd + sp;
      });
    });
    ctx.restore();
    return { x0: cx - blockW / 2, x1: cx + blockW / 2, y0: top, y1: top + blockH };
  };
  MC.renderSubs = (ctx, p, time, o) => {
    const list = p.subs || []; if (!list.length || o.subs === false) return;
    const { W, H } = o, lang = o.lang || p.lang || 'es';
    MC.subActive(p, time).forEach((it) => {
      const cues = MC.subCues(it, lang, it.style); if (!cues.length) return;
      const cue = cues.find((c) => time >= c.s && time < c.e); if (!cue) return;
      MC.drawSubCue(ctx, p, MC.subStyle(it.style), cue, time, W, H, it.style && it.style.y != null ? it.style.y : null);
    });
  };
  /* Miniatura de un estilo (para las tarjetas de presets). */
  MC.subPreview = (canvas, p, style, sample) => {
    const W = canvas.width, H = canvas.height, g = canvas.getContext('2d'), st = MC.subStyle(style);
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#2b2a45'); gr.addColorStop(1, '#6b4a5f'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const ws = (sample || MC.t('Así se verá tu texto', 'This is how your text looks')).split(' ').map((w, i) => ({ w, s: i * 0.4, e: i * 0.4 + 0.4 })), cue = { s: 0, e: 99, words: ws };
    const st2 = Object.assign({}, st, { size: Math.min(0.24, st.size * 3.3), maxW: 0.94, anim: 'none', y: 0 });
    MC.drawSubCue(g, p, st2, cue, 0.4 * Math.min(2, ws.length - 1) + 0.05, W, H, 0);
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
