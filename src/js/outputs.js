/* Otros formatos de salida: WebM (VP9 + Opus), GIF animado, secuencia de PNG y solo audio. Sin librerías externas. */
(function () {
  const MC = window.MC;
  const { t, clamp } = MC;

  /* ---------- WebM mínimo (Matroska) ---------- */
  const idBytes = (id) => { const a = []; let v = id; while (v > 0) { a.unshift(v & 255); v = Math.floor(v / 256); } return a; };
  const sizeBytes = (n) => { let len = 1; while (len < 8 && n >= Math.pow(2, 7 * len) - 1) len++; const out = new Uint8Array(len); let v = n; for (let i = len - 1; i >= 0; i--) { out[i] = v % 256; v = Math.floor(v / 256); } out[0] |= 1 << (8 - len); return out; };
  const cat = (arrs) => { let n = 0; arrs.forEach((a) => { n += a.length; }); const o = new Uint8Array(n); let p = 0; arrs.forEach((a) => { o.set(a, p); p += a.length; }); return o; };
  const el = (id, payload) => { const pl = payload instanceof Uint8Array ? payload : cat(payload); return cat([new Uint8Array(idBytes(id)), sizeBytes(pl.length), pl]); };
  const uint = (id, v) => { const a = []; let x = v; do { a.unshift(x % 256); x = Math.floor(x / 256); } while (x > 0); return el(id, new Uint8Array(a)); };
  const flt = (id, v, d64) => { const b = new DataView(new ArrayBuffer(d64 ? 8 : 4)); if (d64) b.setFloat64(0, v); else b.setFloat32(0, v); return el(id, new Uint8Array(b.buffer)); };
  const str = (id, s) => el(id, new TextEncoder().encode(s));

  MC.WebmMuxer = class {
    constructor(o) { this.o = o; this.v = []; this.a = []; this.dur = 0; }
    addVideoChunk(chunk) { const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); this.v.push({ ms: Math.round(chunk.timestamp / 1000), d, key: chunk.type === 'key', tr: 1 }); this.dur = Math.max(this.dur, (chunk.timestamp + (chunk.duration || 0)) / 1000); }
    addAudioChunk(chunk) { const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); this.a.push({ ms: Math.round(chunk.timestamp / 1000), d, key: true, tr: 2 }); this.dur = Math.max(this.dur, (chunk.timestamp + (chunk.duration || 0)) / 1000); }
    finalize() {
      const o = this.o, hasA = !!o.audio;
      const ebml = el(0x1a45dfa3, [uint(0x4286, 1), uint(0x42f7, 1), uint(0x42f2, 4), uint(0x42f3, 8), str(0x4282, 'webm'), uint(0x4287, 4), uint(0x4285, 2)]);
      const info = el(0x1549a966, [uint(0x2ad7b1, 1000000), flt(0x4489, this.dur, true), str(0x4d80, 'MotionComic Studio'), str(0x5741, 'MotionComic Studio')]);
      const vTrack = el(0xae, [uint(0xd7, 1), uint(0x73c5, 1), uint(0x83, 1), str(0x86, 'V_VP9'), el(0xe0, [uint(0xb0, o.width), uint(0xba, o.height)])]);
      const head = new Uint8Array(19); head.set(new TextEncoder().encode('OpusHead')); head[8] = 1; head[9] = 2; head[10] = 312 & 255; head[11] = 312 >> 8; head[12] = 48000 & 255; head[13] = (48000 >> 8) & 255; head[14] = (48000 >> 16) & 255; head[15] = 0; head[16] = 0; head[17] = 0; head[18] = 0;
      const aTrack = hasA ? el(0xae, [uint(0xd7, 2), uint(0x73c5, 2), uint(0x83, 2), str(0x86, 'A_OPUS'), el(0x63a2, head), el(0xe1, [flt(0xb5, 48000, false), uint(0x9f, 2)])]) : null;
      const tracks = el(0x1654ae6b, aTrack ? [vTrack, aTrack] : [vTrack]);
      const all = this.v.concat(this.a).sort((x, y) => x.ms - y.ms || x.tr - y.tr), clusters = []; let cur = null;
      all.forEach((b) => {
        if (!cur || b.ms - cur.t0 >= 2000) { cur = { t0: b.ms, blocks: [] }; clusters.push(cur); }
        const rel = b.ms - cur.t0, hdr = new Uint8Array([0x80 | b.tr, (rel >> 8) & 255, rel & 255, b.key ? 0x80 : 0]);
        cur.blocks.push(el(0xa3, [hdr, b.d]));
      });
      const cl = clusters.map((c) => el(0x1f43b675, [uint(0xe7, c.t0)].concat(c.blocks)));
      const segPayload = cat([info, tracks].concat(cl)), seg = cat([new Uint8Array(idBytes(0x18538067)), (() => { const s = new Uint8Array(8); let v = segPayload.length; for (let i = 7; i >= 1; i--) { s[i] = v % 256; v = Math.floor(v / 256); } s[0] = 0x01; return s; })(), segPayload]);
      return new Blob([ebml, seg], { type: 'video/webm' });
    }
  };

  /* ---------- GIF ---------- */
  /* Paleta de 256 colores por corte mediano sobre un histograma de 15 bits. */
  const buildPalette = (frames) => {
    const hist = new Uint32Array(32768);
    frames.forEach((f) => { for (let i = 0; i < f.length; i += 16) hist[((f[i] >> 3) << 10) | ((f[i + 1] >> 3) << 5) | (f[i + 2] >> 3)]++; });
    const cols = []; for (let k = 0; k < 32768; k++) if (hist[k]) cols.push(k);
    const comp = (k, c) => (c === 0 ? (k >> 10) & 31 : c === 1 ? (k >> 5) & 31 : k & 31);
    let boxes = [cols];
    while (boxes.length < 256) {
      let bi = -1, best = -1; boxes.forEach((b, i) => { if (b.length > 1 && b.length > best) { best = b.length; bi = i; } });
      if (bi < 0) break;
      const b = boxes[bi]; let mm = [31, 31, 31, 0, 0, 0]; b.forEach((k) => { for (let c = 0; c < 3; c++) { const v = comp(k, c); if (v < mm[c]) mm[c] = v; if (v > mm[c + 3]) mm[c + 3] = v; } });
      const ch = [mm[3] - mm[0], mm[4] - mm[1], mm[5] - mm[2]], c = ch[0] >= ch[1] && ch[0] >= ch[2] ? 0 : ch[1] >= ch[2] ? 1 : 2;
      b.sort((x, y) => comp(x, c) - comp(y, c));
      let tot = 0; b.forEach((k) => { tot += hist[k]; }); let acc = 0, cut = 1; for (let i = 0; i < b.length; i++) { acc += hist[b[i]]; if (acc >= tot / 2) { cut = clamp(i + 1, 1, b.length - 1); break; } }
      boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
    }
    const pal = new Uint8Array(768);
    boxes.forEach((b, i) => { let r = 0, g = 0, bl = 0, n = 0; b.forEach((k) => { const w = hist[k]; r += ((k >> 10) & 31) * w; g += ((k >> 5) & 31) * w; bl += (k & 31) * w; n += w; }); n = n || 1; pal[i * 3] = Math.min(255, Math.round((r / n) * 8 + 4)); pal[i * 3 + 1] = Math.min(255, Math.round((g / n) * 8 + 4)); pal[i * 3 + 2] = Math.min(255, Math.round((bl / n) * 8 + 4)); });
    return { pal, n: boxes.length };
  };
  const lzw = (idx, minCode) => {
    const clear = 1 << minCode, eoi = clear + 1, out = []; let bits = 0, nb = 0, size = minCode + 1, next = eoi + 1, dict = new Map();
    const emit = (code) => { bits |= code << nb; nb += size; while (nb >= 8) { out.push(bits & 255); bits >>>= 8; nb -= 8; } };
    emit(clear); let pre = idx[0];
    for (let i = 1; i < idx.length; i++) {
      const c = idx[i], key = (pre << 8) | c, hit = dict.get(key);
      if (hit !== undefined) { pre = hit; continue; }
      emit(pre);
      if (next < 4096) { dict.set(key, next++); if (next - 1 === (1 << size) && size < 12) size++; }
      else { emit(clear); dict = new Map(); size = minCode + 1; next = eoi + 1; }
      pre = c;
    }
    emit(pre); emit(eoi); if (nb > 0) out.push(bits & 255);
    return out;
  };
  MC.encodeGif = (frames, w, h, fps) => {
    const { pal } = buildPalette(frames), cache = new Int16Array(32768).fill(-1), out = [];
    const near = (k) => { const r = ((k >> 10) & 31) * 8 + 4, g = ((k >> 5) & 31) * 8 + 4, b = (k & 31) * 8 + 4; let best = 0, bd = 1e9; for (let i = 0; i < 256; i++) { const dr = pal[i * 3] - r, dg = pal[i * 3 + 1] - g, db = pal[i * 3 + 2] - b, d = dr * dr * 2 + dg * dg * 4 + db * db * 3; if (d < bd) { bd = d; best = i; if (!d) break; } } return best; };
    const push = (...a) => a.forEach((x) => out.push(x)), w16 = (v) => push(v & 255, (v >> 8) & 255);
    'GIF89a'.split('').forEach((c) => push(c.charCodeAt(0))); w16(w); w16(h); push(0xf7, 0, 0); for (let i = 0; i < 768; i++) push(pal[i]);
    push(0x21, 0xff, 11); 'NETSCAPE2.0'.split('').forEach((c) => push(c.charCodeAt(0))); push(3, 1, 0, 0, 0);
    const delay = Math.max(2, Math.round(100 / fps));
    frames.forEach((f) => {
      const idx = new Uint8Array(w * h);
      for (let i = 0, p = 0; p < idx.length; p++, i += 4) { const k = ((f[i] >> 3) << 10) | ((f[i + 1] >> 3) << 5) | (f[i + 2] >> 3); let c = cache[k]; if (c < 0) { c = near(k); cache[k] = c; } idx[p] = c; }
      push(0x21, 0xf9, 4, 0x04, delay & 255, (delay >> 8) & 255, 0, 0); push(0x2c); w16(0); w16(0); w16(w); w16(h); push(0);
      push(8); const data = lzw(idx, 8); for (let i = 0; i < data.length; i += 255) { const n = Math.min(255, data.length - i); push(n); for (let j = 0; j < n; j++) push(data[i + j]); } push(0);
    });
    push(0x3b);
    return new Blob([new Uint8Array(out)], { type: 'image/gif' });
  };

  /* ---------- GIF y secuencia de PNG: se dibujan los fotogramas uno a uno ---------- */
  MC.exportFrames = async (p, opt, kind, onProgress, signal) => {
    const full = MC.frameSize(p.ratio, p.res), cap = kind === 'gif' ? 480 : full.w, k = Math.min(1, cap / full.w), W = Math.max(2, Math.round(full.w * k)), H = Math.max(2, Math.round(full.h * k));
    const total = MC.totalTime(p), from = opt.from || 0, to = Math.min(opt.to == null ? total : opt.to, total), dur = Math.max(0.1, to - from), fps = opt.fps, frames = Math.max(1, Math.round(dur * fps));
    if (kind === 'gif' && frames > 450) throw new Error(t('Un GIF de más de 30 segundos pesa demasiado. Exporta un tramo más corto o usa MP4 o WebM.', 'A GIF longer than 30 seconds gets too heavy. Export a shorter range or use MP4 or WebM.'));
    await MC.ensureFonts();
    const canvas = new OffscreenCanvas(W, H), ctx = canvas.getContext('2d', { willReadFrequently: kind === 'gif' }), o = MC.renderOpts(p, { W, H, lang: opt.lang, subs: opt.subs });
    const hasVid = MC.video.hasVideo(p); MC.video.exporting = hasVid;
    const raw = [], entries = [];
    try {
      for (let i = 0; i < frames; i++) {
        if (signal.aborted) throw new Error('cancelado');
        const tt = Math.min(total - 0.0001, from + i / fps);
        if (hasVid) await MC.video.prepare(p, tt);
        MC.renderFrame(ctx, p, tt, o);
        if (kind === 'gif') raw.push(new Uint8ClampedArray(ctx.getImageData(0, 0, W, H).data));
        else entries.push({ name: 'frame-' + String(i + 1).padStart(4, '0') + '.png', blob: await canvas.convertToBlob({ type: 'image/png' }) });
        if (i % 2 === 0) { onProgress((i / frames) * 0.9, t('Fotograma ', 'Frame ') + (i + 1) + ' / ' + frames); await new Promise((r) => setTimeout(r, 0)); }
      }
    } finally { MC.video.exporting = false; }
    onProgress(0.93, kind === 'gif' ? t('Creando el GIF…', 'Building the GIF…') : t('Empaquetando los PNG…', 'Packing the PNGs…'));
    await new Promise((r) => setTimeout(r, 20));
    const blob = kind === 'gif' ? MC.encodeGif(raw, W, H, fps) : await MC.zip.write(entries);
    onProgress(1, '');
    return { blob, codec: kind === 'gif' ? 'GIF' : 'PNG', audio: '', W, H, fps, dur, ext: kind === 'gif' ? 'gif' : 'zip', kind };
  };
  MC.exportAudioOnly = async (p, opt, onProgress) => {
    onProgress(0.1, t('Mezclando el audio…', 'Mixing audio…'));
    const total = MC.totalTime(p), from = opt.from || 0, to = Math.min(opt.to == null ? total : opt.to, total), buf = await MC.audio.mixdown(p, from, to, opt.normalize);
    if (!buf) throw new Error(t('No hay audio en la línea de tiempo.', 'There is no audio on the timeline.'));
    onProgress(1, ''); const sz = MC.frameSize(p.ratio, p.res);
    return { blob: MC.audio.wav(buf), codec: 'WAV', audio: 'WAV', W: sz.w, H: sz.h, fps: 0, dur: to - from, ext: 'wav', kind: 'audio' };
  };
})();
