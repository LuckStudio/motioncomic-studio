/* Audio: importar, ondas, mezcla con ducking, reproducción, micrófono y biblioteca de sonidos generada por código (PRD 11). */
(function () {
  const MC = window.MC;
  const PEAK_RATE = 50; // barras de onda por segundo
  const buffers = new Map(); // assetId -> { buffer, peaks, dur, name }
  let actx = null;
  const A = (MC.audio = { buffers, TRACKS: ['voz', 'sfx', 'musica'] });

  const live = () => actx || (actx = new (window.AudioContext || window.webkitAudioContext)());
  const decode = (ab) => new OfflineAudioContext(1, 1, 44100).decodeAudioData(ab);

  function peaksOf(buf) {
    const n = Math.max(1, Math.ceil(buf.duration * PEAK_RATE)), step = Math.max(1, Math.floor(buf.length / n)), out = new Uint8Array(n);
    const ch = [];
    for (let c = 0; c < buf.numberOfChannels; c++) ch.push(buf.getChannelData(c));
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let j = i * step; j < Math.min(buf.length, (i + 1) * step); j += 8) for (let c = 0; c < ch.length; c++) m = Math.max(m, Math.abs(ch[c][j]));
      out[i] = Math.min(255, Math.round(m * 255));
    }
    return out;
  }
  A.get = (id) => buffers.get(id) || null;
  A.add = async (blob, name, existingId) => {
    const buffer = await decode(await blob.arrayBuffer());
    const id = existingId || MC.uid(), peaks = peaksOf(buffer);
    await MC.db.put('assets', { id, name, blob, type: blob.type || 'audio/wav', kind: 'audio', dur: buffer.duration, peaks });
    const a = { id, name, buffer, peaks, dur: buffer.duration };
    buffers.set(id, a);
    return a;
  };
  A.load = async (id) => {
    if (buffers.has(id)) return buffers.get(id);
    const rec = await MC.db.get('assets', id);
    if (!rec) return null;
    const buffer = await decode(await rec.blob.arrayBuffer());
    const a = { id, name: rec.name, buffer, peaks: rec.peaks || peaksOf(buffer), dur: buffer.duration };
    buffers.set(id, a);
    return a;
  };
  A.newClip = (track, asset, start) => ({ id: MC.uid(), track, assetId: asset.id, name: asset.name.replace(/\.[a-z0-9]+$/i, ''), start: Math.max(0, start), offset: 0, dur: asset.dur, vol: 1, fadeIn: 0, fadeOut: 0 });

  /* Voz habla -> la música baja sola. */
  const voiceSpans = (p) => {
    const spans = (p.clips || []).filter((c) => c.track === 'voz').map((c) => [c.start, c.start + c.dur]).sort((a, b) => a[0] - b[0]);
    const m = [];
    spans.forEach((s) => { if (m.length && s[0] <= m[m.length - 1][1] + 0.3) m[m.length - 1][1] = Math.max(m[m.length - 1][1], s[1]); else m.push(s.slice()); });
    return m;
  };

  /* Programa todos los clips en un contexto (en vivo o fuera de línea). from = punto de la línea de tiempo que corresponde a base. */
  A.schedule = (ac, dest, p, from, base, to) => {
    const mix = Object.assign({ voz: 1, sfx: 1, musica: 0.6, duck: true }, p.mix || {}), tg = {}, sources = [];
    A.TRACKS.forEach((tr) => { const g = ac.createGain(); g.gain.value = mix[tr]; g.connect(dest); tg[tr] = g; });
    if (mix.duck !== false) {
      const tt = (t) => base + Math.max(0, t - from), duck = mix.musica * 0.28, g = tg.musica.gain;
      const pts = [];
      let inside = false;
      voiceSpans(p).forEach((s) => { if (s[0] <= from && s[1] > from) inside = true; });
      pts.push([base, inside ? duck : mix.musica]);
      voiceSpans(p).forEach((s) => {
        if (s[1] <= from) return;
        if (s[0] > from) { pts.push([tt(s[0]) - 0.18, mix.musica]); pts.push([tt(s[0]), duck]); }
        pts.push([tt(s[1]), duck]); pts.push([tt(s[1]) + 0.5, mix.musica]);
      });
      let last = -1;
      pts.forEach((pt, i) => { const t = Math.max(pt[0], last); last = t; if (i === 0) g.setValueAtTime(pt[1], t); else g.linearRampToValueAtTime(pt[1], t); });
    }
    (p.clips || []).forEach((c) => {
      const a = buffers.get(c.assetId);
      if (!a || c.start + c.dur <= from || (to != null && c.start >= to)) return;
      const skip = Math.max(0, from - c.start), len = Math.min(c.dur - skip, a.buffer.duration - c.offset - skip);
      if (len <= 0) return;
      const src = ac.createBufferSource(), cg = ac.createGain(), when = base + Math.max(0, c.start - from);
      src.buffer = a.buffer;
      src.connect(cg); cg.connect(tg[c.track] || dest);
      const fi = c.fadeIn || 0, fo = c.fadeOut || 0, v = c.vol == null ? 1 : c.vol;
      cg.gain.setValueAtTime(fi > 0 && skip < fi ? (v * skip) / fi : v, when);
      if (fi > 0 && skip < fi) cg.gain.linearRampToValueAtTime(v, when + (fi - skip));
      if (fo > 0) { const t0 = Math.max(when + (fi > skip ? fi - skip : 0), when + len - fo); cg.gain.setValueAtTime(v, t0); cg.gain.linearRampToValueAtTime(0, when + len); }
      src.start(when, c.offset + skip, len);
      sources.push(src);
    });
    return { stop() { sources.forEach((s) => { try { s.stop(); } catch (e) { /* ya parado */ } }); } };
  };

  let playing = null;
  A.play = (p, from) => {
    A.stop();
    if (!(p.clips || []).length) return;
    try {
      const ac = live();
      if (ac.state === 'suspended') ac.resume();
      playing = A.schedule(ac, ac.destination, p, from, ac.currentTime + 0.06);
    } catch (e) { console.warn('audio', e); }
  };
  A.stop = () => { if (playing) { playing.stop(); playing = null; } };
  A.preview = async (buffer) => {
    const ac = live(); if (ac.state === 'suspended') await ac.resume();
    const s = ac.createBufferSource(); s.buffer = buffer; s.connect(ac.destination); s.start(); return s;
  };

  /* Mezcla final para exportar: estéreo a 48 kHz, con normalización opcional. */
  A.mixdown = async (p, from, to, normalize) => {
    if (!(p.clips || []).some((c) => buffers.has(c.assetId) && c.start < to && c.start + c.dur > from)) return null;
    const sr = 48000, ac = new OfflineAudioContext(2, Math.ceil((to - from) * sr), sr);
    A.schedule(ac, ac.destination, p, from, 0, to);
    const out = await ac.startRendering();
    if (normalize) {
      let peak = 0, sum = 0, n = 0;
      for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; n++; } }
      const rms = Math.sqrt(sum / Math.max(1, n));
      if (rms > 1e-4) {
        const gain = Math.min(0.158 / rms, 0.89 / peak, 4); // objetivo ≈ -16 dBFS RMS, sin pasar de -1 dBFS de pico
        for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= gain; }
      }
    }
    return out;
  };

  /* Pausas de la voz: marcadores automáticos y «ajustar planos a la voz». */
  A.voicePauses = (p) => {
    const out = [];
    (p.clips || []).filter((c) => c.track === 'voz').forEach((c) => {
      const a = buffers.get(c.assetId); if (!a) return;
      const d = a.buffer.getChannelData(0), sr = a.buffer.sampleRate, w = Math.round(sr * 0.02), rms = [];
      for (let i = Math.floor(c.offset * sr); i + w < Math.min(d.length, (c.offset + c.dur) * sr); i += w) { let s = 0; for (let j = 0; j < w; j += 2) s += d[i + j] * d[i + j]; rms.push(Math.sqrt(s / (w / 2))); }
      const thr = Math.max(0.008, Math.max.apply(null, rms) * 0.06);
      let run = 0;
      rms.forEach((v, i) => {
        if (v < thr) run++;
        else { if (run * 0.02 >= 0.35) out.push({ t: c.start + (i - run / 2) * 0.02, len: run * 0.02 }); run = 0; }
      });
    });
    return out.sort((x, y) => x.t - y.t);
  };
  A.fitShotsToVoice = (p) => {
    const cuts = A.voicePauses(p).map((x) => x.t), n = p.shots.length;
    const end = Math.max.apply(null, (p.clips || []).filter((c) => c.track === 'voz').map((c) => c.start + c.dur).concat([0]));
    if (n < 2 || cuts.length < n - 1) return false;
    let prev = 0;
    for (let i = 0; i < n - 1; i++) { p.shots[i].duration = Math.max(0.5, Math.round((cuts[i] - prev) * 10) / 10); prev += p.shots[i].duration; }
    p.shots[n - 1].duration = Math.max(0.5, Math.round((end - prev) * 10) / 10);
    return true;
  };

  /* Micrófono */
  A.record = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('sin micrófono');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream), chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    return { start: () => rec.start(), cancel: () => { try { rec.stop(); } catch (e) { /* parado */ } stream.getTracks().forEach((t) => t.stop()); }, stop: () => new Promise((res) => { rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); res(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); }; rec.stop(); }) };
  };

  /* WAV de 16 bits para guardar los sonidos generados como archivos normales. */
  A.wav = (buf) => {
    const ch = buf.numberOfChannels, n = buf.length, ab = new ArrayBuffer(44 + n * ch * 2), v = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * ch * 2, true);
    const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { v.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 32767, true); o += 2; }
    return new Blob([ab], { type: 'audio/wav' });
  };

  /* Biblioteca generada por código (sin archivos ni licencias). */
  const SR = 44100;
  const noise = (ac, dur) => { const b = ac.createBuffer(1, Math.ceil(dur * SR), SR), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ac.createBufferSource(); s.buffer = b; return s; };
  const env = (ac, t0, a, peak, d) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); return g; };
  const osc = (ac, type, f, t0, t1, out, f2) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t1); o.connect(out); o.start(t0); o.stop(t1); return o; };
  const filt = (ac, type, f, out, f2, t1) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.setValueAtTime(f, 0); if (f2) b.frequency.exponentialRampToValueAtTime(f2, t1); b.connect(out); return b; };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // La menor, Fa, Do, Sol

  A.LIBRARY = [
    { id: 'golpe', kind: 'sfx', es: 'Golpe', en: 'Impact', dur: 1, gen(ac) { const g = env(ac, 0, 0.005, 0.9, 0.45); g.connect(ac.destination); osc(ac, 'sine', 150, 0, 0.6, g, 38); const n = noise(ac, 0.4), e = env(ac, 0, 0.002, 0.6, 0.22); e.connect(ac.destination); n.connect(filt(ac, 'lowpass', 2200, e, 200, 0.3)); n.start(0); } },
    { id: 'whoosh', kind: 'sfx', es: 'Barrido (whoosh)', en: 'Whoosh', dur: 1, gen(ac) { const n = noise(ac, 1), g = ac.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.linearRampToValueAtTime(0.7, 0.4); g.gain.linearRampToValueAtTime(0.0001, 0.95); g.connect(ac.destination); const b = filt(ac, 'bandpass', 300, g, 3200, 0.5); b.Q.value = 2; b.frequency.exponentialRampToValueAtTime(500, 0.95); n.connect(b); n.start(0); } },
    { id: 'explosion', kind: 'sfx', es: 'Explosión', en: 'Explosion', dur: 2.4, gen(ac) { const n = noise(ac, 2.4), e = env(ac, 0, 0.01, 0.95, 2); e.connect(ac.destination); n.connect(filt(ac, 'lowpass', 1400, e, 70, 1.8)); n.start(0); const g = env(ac, 0, 0.01, 0.9, 1.4); g.connect(ac.destination); osc(ac, 'sine', 90, 0, 1.6, g, 24); } },
    { id: 'clic', kind: 'sfx', es: 'Clic', en: 'Click', dur: 0.2, gen(ac) { const g = env(ac, 0, 0.001, 0.6, 0.06); g.connect(ac.destination); osc(ac, 'square', 1500, 0, 0.1, g, 700); } },
    { id: 'chispas', kind: 'sfx', es: 'Chispas', en: 'Sparkles', dur: 1.4, gen(ac) { for (let i = 0; i < 14; i++) { const t = Math.random() * 1; const g = env(ac, t, 0.002, 0.25, 0.14); g.connect(ac.destination); osc(ac, 'sine', 1800 + Math.random() * 2600, t, t + 0.2, g); } } },
    { id: 'campana', kind: 'sfx', es: 'Campana', en: 'Bell', dur: 2.6, gen(ac) { [1, 2.76, 5.4].forEach((m, i) => { const g = env(ac, 0, 0.003, 0.5 / (i + 1), 2.2 / (i + 1)); g.connect(ac.destination); osc(ac, 'sine', 660 * m, 0, 2.6, g); }); } },
    { id: 'noche', kind: 'music', es: 'Música · Noche tranquila', en: 'Music · Quiet night', dur: 16, gen(ac) {
      CH.forEach((ch, i) => {
        const t0 = i * 4;
        ch.forEach((m) => [-6, 6].forEach((det) => {
          const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.07, t0 + 1.4); g.gain.linearRampToValueAtTime(0.0001, t0 + 4.2);
          g.connect(ac.destination);
          const f = filt(ac, 'lowpass', 900, g), o = osc(ac, 'sawtooth', hz(m), t0, t0 + 4.3, f); o.detune.value = det;
        }));
        const g2 = env(ac, t0, 0.6, 0.18, 3.4); g2.connect(ac.destination); osc(ac, 'sine', hz(ch[0] - 24), t0, t0 + 4.2, g2);
      });
    } },
    { id: 'tension', kind: 'music', es: 'Música · Tensión', en: 'Music · Tension', dur: 16, gen(ac) { const g = ac.createGain(); g.gain.value = 0.16; g.connect(ac.destination); const f = filt(ac, 'lowpass', 420, g); osc(ac, 'sawtooth', 55, 0, 16, f); osc(ac, 'sawtooth', 55.6, 0, 16, f); const lf = ac.createOscillator(), lg = ac.createGain(); lf.frequency.value = 2; lg.gain.value = 0.07; lf.connect(lg); lg.connect(g.gain); lf.start(0); lf.stop(16); for (let i = 0; i < 4; i++) { const t = 2 + i * 4, e = env(ac, t, 0.02, 0.12, 1.6); e.connect(ac.destination); osc(ac, 'triangle', hz(81 + (i % 2) * 1), t, t + 2, e, hz(79)); } } },
    { id: 'aventura', kind: 'music', es: 'Música · Aventura', en: 'Music · Adventure', dur: 17.5, gen(ac) { const beat = 60 / 110; for (let bar = 0; bar < 8; bar++) { const ch = CH[bar % 4]; for (let s = 0; s < 8; s++) { const t = bar * 4 * beat + s * beat / 2, m = ch[s % 3] + (s > 4 ? 12 : 0) + 12, g = env(ac, t, 0.004, 0.16, 0.22); g.connect(ac.destination); osc(ac, 'triangle', hz(m), t, t + 0.3, g); } for (let b = 0; b < 4; b++) { const t = bar * 4 * beat + b * beat, k = env(ac, t, 0.003, b % 2 ? 0.35 : 0.55, 0.22); k.connect(ac.destination); osc(ac, 'sine', 120, t, t + 0.3, k, 42); } const bs = env(ac, bar * 4 * beat, 0.01, 0.2, 1.8); bs.connect(ac.destination); osc(ac, 'sine', hz(ch[0] - 12), bar * 4 * beat, bar * 4 * beat + 2, bs); } } },
  ];
  const rendered = new Map();
  A.renderLibrary = async (item) => {
    if (rendered.has(item.id)) return rendered.get(item.id);
    const ac = new OfflineAudioContext(1, Math.ceil(item.dur * SR), SR);
    item.gen(ac);
    const buf = await ac.startRendering();
    rendered.set(item.id, buf);
    return buf;
  };
})();
