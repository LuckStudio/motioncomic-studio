/* Más sonidos, todos generados por código (sin archivos ni licencias): impactos, movimiento, cómic, ambiente, tecnología, terror y más músicas. */
(function () {
  const MC = window.MC;
  const A = MC.audio, SR = 44100;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (() => { let s = 12345; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  const noiseBuf = (ac, dur) => { const b = ac.createBuffer(1, Math.ceil(dur * SR), SR), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; const s = ac.createBufferSource(); s.buffer = b; s.start(0); return s; };
  const gainEnv = (ac, t0, a, peak, dec, out) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + Math.max(0.001, a)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec); g.connect(out || ac.destination); return g; };
  const osc = (ac, type, f0, t0, t1, out, f1, det) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t1); if (det) o.detune.value = det; o.connect(out); o.start(t0); o.stop(t1 + 0.05); return o; };
  const flt = (ac, type, f, out, q, f1, t1) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.setValueAtTime(f, 0); if (f1) b.frequency.exponentialRampToValueAtTime(f1, t1); if (q) b.Q.value = q; b.connect(out); return b; };
  const nz = (ac, t0, dur, out, type, f, q, f1) => { const n = noiseBuf(ac, dur + 0.1); const fl = flt(ac, type || 'lowpass', f || 2000, out, q, f1, t0 + dur); n.connect(fl); return n; };
  const hit = (ac, t0, f, peak, dec, out) => { const g = gainEnv(ac, t0, 0.003, peak, dec, out); osc(ac, 'sine', f, t0, t0 + dec + 0.05, g, f * 0.3); const g2 = gainEnv(ac, t0, 0.001, peak * 0.6, dec * 0.4, out); nz(ac, t0, dec * 0.4, g2, 'lowpass', 1800); };
  const tone = (ac, type, m, t0, len, vol, out) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len); g.connect(out || ac.destination); osc(ac, type, hz(m), t0, t0 + len, g); };

  A.kit = { rnd, noiseBuf, gainEnv, osc, flt, nz, hit, tone, hz };
  const S = (id, cat, es, en, dur, gen) => ({ id, kind: 'sfx', cat, es, en, dur, gen });
  const M = (id, es, en, dur, gen) => ({ id, kind: 'music', cat: 'musica', es, en, dur, gen });

  const SFX = [
    /* impactos */
    S('punetazo', 'impactos', 'Puñetazo', 'Punch', 0.6, (ac) => { hit(ac, 0, 130, 0.95, 0.28, ac.destination); }),
    S('golpe-seco', 'impactos', 'Golpe seco grave', 'Deep thud', 1, (ac) => { hit(ac, 0, 70, 1, 0.6, ac.destination); }),
    S('metal', 'impactos', 'Golpe metálico', 'Metal clang', 2, (ac) => { [1, 2.3, 3.7, 5.1].forEach((m, i) => { const g = gainEnv(ac, 0, 0.002, 0.4 / (i + 1), 1.6 / (i + 1)); osc(ac, 'square', 310 * m, 0, 1.7, g); }); nz(ac, 0, 0.1, gainEnv(ac, 0, 0.001, 0.5, 0.08), 'highpass', 3000); }),
    S('portazo', 'impactos', 'Portazo', 'Door slam', 1.2, (ac) => { hit(ac, 0, 90, 0.9, 0.5, ac.destination); nz(ac, 0.01, 0.35, gainEnv(ac, 0.01, 0.002, 0.5, 0.3), 'bandpass', 700, 1); }),
    S('cristal', 'impactos', 'Cristal roto', 'Breaking glass', 1.6, (ac) => { for (let i = 0; i < 22; i++) { const t0 = rnd() * 0.5; const g = gainEnv(ac, t0, 0.001, 0.18, 0.12 + rnd() * 0.2); osc(ac, 'triangle', 2500 + rnd() * 4500, t0, t0 + 0.3, g); } nz(ac, 0, 0.25, gainEnv(ac, 0, 0.001, 0.45, 0.2), 'highpass', 4000); }),
    S('trueno', 'impactos', 'Trueno', 'Thunder', 4, (ac) => { const g = gainEnv(ac, 0, 0.15, 0.9, 3.4); nz(ac, 0, 3.6, g, 'lowpass', 500, 0.7, 60); }),
    S('platillo', 'impactos', 'Platillo', 'Cymbal crash', 3, (ac) => { nz(ac, 0, 2.8, gainEnv(ac, 0, 0.002, 0.5, 2.6), 'highpass', 5500, 0.5); }),
    S('timbal', 'impactos', 'Timbal', 'Timpani hit', 1.8, (ac) => { const g = gainEnv(ac, 0, 0.004, 0.9, 1.5); osc(ac, 'sine', 120, 0, 1.6, g, 80); osc(ac, 'sine', 240, 0, 0.5, gainEnv(ac, 0, 0.002, 0.3, 0.4)); }),
    /* movimiento */
    S('swish', 'movimiento', 'Swish corto', 'Short swish', 0.5, (ac) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.linearRampToValueAtTime(0.5, 0.15); g.gain.linearRampToValueAtTime(0.0001, 0.45); g.connect(ac.destination); nz(ac, 0, 0.45, g, 'bandpass', 1200, 2, 5000); }),
    S('swoosh', 'movimiento', 'Swoosh largo', 'Long swoosh', 1.6, (ac) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.linearRampToValueAtTime(0.65, 0.7); g.gain.linearRampToValueAtTime(0.0001, 1.5); g.connect(ac.destination); nz(ac, 0, 1.5, g, 'bandpass', 400, 1.5, 4500); }),
    S('pasos', 'movimiento', 'Pasos', 'Footsteps', 3, (ac) => { for (let i = 0; i < 6; i++) { const t0 = 0.1 + i * 0.5; hit(ac, t0, 85 + (i % 2) * 15, 0.5, 0.12, ac.destination); } }),
    S('carrera', 'movimiento', 'Carrera', 'Running', 3, (ac) => { for (let i = 0; i < 12; i++) hit(ac, 0.05 + i * 0.24, 95 + (i % 2) * 20, 0.38, 0.08, ac.destination); }),
    S('salto', 'movimiento', 'Salto (boing)', 'Jump (boing)', 0.8, (ac) => { const g = gainEnv(ac, 0, 0.01, 0.5, 0.6); osc(ac, 'sine', 220, 0, 0.7, g, 880); }),
    S('caida', 'movimiento', 'Caída (silbido)', 'Falling whistle', 1.6, (ac) => { const g = gainEnv(ac, 0, 0.05, 0.4, 1.3); osc(ac, 'sine', 1600, 0, 1.4, g, 200); }),
    S('derrape', 'movimiento', 'Derrape', 'Skid', 1.5, (ac) => { const g = gainEnv(ac, 0, 0.1, 0.5, 1.2); nz(ac, 0, 1.3, g, 'bandpass', 2400, 6, 1200); }),
    S('latigo', 'movimiento', 'Latigazo', 'Whip crack', 0.5, (ac) => { nz(ac, 0, 0.12, gainEnv(ac, 0, 0.001, 0.8, 0.1), 'highpass', 2500); osc(ac, 'sawtooth', 3000, 0, 0.1, gainEnv(ac, 0, 0.001, 0.2, 0.1), 300); }),
    /* cómic */
    S('pop', 'comic', 'Pop', 'Pop', 0.3, (ac) => { const g = gainEnv(ac, 0, 0.002, 0.7, 0.08); osc(ac, 'sine', 900, 0, 0.1, g, 220); }),
    S('boing', 'comic', 'Boing', 'Boing', 1, (ac) => { const g = gainEnv(ac, 0, 0.01, 0.55, 0.9); const o = osc(ac, 'sine', 300, 0, 0.9, g); const l = ac.createOscillator(); l.frequency.value = 14; const lg = ac.createGain(); lg.gain.value = 90; l.connect(lg); lg.connect(o.frequency); l.start(0); l.stop(1); }),
    S('plop', 'comic', 'Burbuja (plop)', 'Bubble (plop)', 0.4, (ac) => { const g = gainEnv(ac, 0, 0.005, 0.6, 0.12); osc(ac, 'sine', 300, 0, 0.14, g, 900); }),
    S('ding', 'comic', 'Ding de acierto', 'Success ding', 1.4, (ac) => { tone(ac, 'sine', 88, 0, 1.2, 0.5); tone(ac, 'sine', 95, 0.12, 1.1, 0.4); }),
    S('error', 'comic', 'Error (buzz)', 'Error buzz', 0.7, (ac) => { const g = gainEnv(ac, 0, 0.01, 0.45, 0.5); osc(ac, 'sawtooth', 110, 0, 0.55, g); osc(ac, 'sawtooth', 116, 0, 0.55, g); }),
    S('tadan', 'comic', 'Ta-dan', 'Ta-da', 2.2, (ac) => { tone(ac, 'square', 72, 0, 0.18, 0.18); tone(ac, 'square', 79, 0.18, 1.6, 0.22); tone(ac, 'square', 84, 0.18, 1.6, 0.18); }),
    S('redoble', 'comic', 'Redoble de tambor', 'Drum roll', 2.6, (ac) => { for (let i = 0; i < 44; i++) hit(ac, i * 0.055, 190, 0.1 + (i / 44) * 0.35, 0.05, ac.destination); hit(ac, 2.4, 100, 0.9, 0.3, ac.destination); }),
    S('sorpresa', 'comic', 'Sorpresa (sting)', 'Surprise sting', 1.2, (ac) => { [76, 80, 83].forEach((m) => tone(ac, 'sawtooth', m, 0, 0.9, 0.12)); hit(ac, 0, 100, 0.5, 0.2, ac.destination); }),
    S('dramatico', 'comic', 'Chan chan dramático', 'Dramatic sting', 2.4, (ac) => { [45, 52, 57].forEach((m) => { tone(ac, 'sawtooth', m, 0, 0.5, 0.2); tone(ac, 'sawtooth', m - 1, 0.7, 1.5, 0.2); }); hit(ac, 0, 60, 0.7, 0.3, ac.destination); hit(ac, 0.7, 55, 0.85, 0.6, ac.destination); }),
    S('sad-trombone', 'comic', 'Trombón triste', 'Sad trombone', 2.4, (ac) => { [[58, 0], [57, 0.5], [56, 1], [54, 1.5]].forEach((q, i) => tone(ac, 'sawtooth', q[0], q[1], i === 3 ? 0.9 : 0.45, 0.16)); }),
    /* ambiente */
    S('lluvia', 'ambiente', 'Lluvia', 'Rain', 8, (ac) => { nz(ac, 0, 8, gainEnv(ac, 0, 0.5, 0.35, 7.4), 'highpass', 1800, 0.4); nz(ac, 0, 8, gainEnv(ac, 0, 0.5, 0.18, 7.4), 'bandpass', 600, 0.5); }),
    S('viento', 'ambiente', 'Viento', 'Wind', 8, (ac) => { const g = ac.createGain(); g.gain.value = 0.3; g.connect(ac.destination); const f = flt(ac, 'bandpass', 500, g, 2); const l = ac.createOscillator(); l.frequency.value = 0.25; const lg = ac.createGain(); lg.gain.value = 300; l.connect(lg); lg.connect(f.frequency); l.start(0); l.stop(8.1); const n = noiseBuf(ac, 8.1); n.connect(f); }),
    S('fuego', 'ambiente', 'Fuego que crepita', 'Crackling fire', 6, (ac) => { nz(ac, 0, 6, gainEnv(ac, 0, 0.3, 0.12, 5.5), 'lowpass', 350); for (let i = 0; i < 70; i++) { const t0 = rnd() * 5.8; nz(ac, t0, 0.03, gainEnv(ac, t0, 0.001, 0.2 + rnd() * 0.3, 0.03), 'highpass', 2500 + rnd() * 3000); } }),
    S('olas', 'ambiente', 'Olas del mar', 'Sea waves', 10, (ac) => { for (let i = 0; i < 3; i++) { const t0 = i * 3.2; const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.5, t0 + 1.6); g.gain.linearRampToValueAtTime(0.0001, t0 + 3.1); g.connect(ac.destination); nz(ac, t0, 3.1, g, 'lowpass', 900, 0.5, 400); } }),
    S('grillos', 'ambiente', 'Grillos de noche', 'Night crickets', 8, (ac) => { for (let k = 0; k < 3; k++) { const base = 4200 + k * 300; for (let i = 0; i < 30; i++) { const t0 = i * 0.26 + k * 0.07; const g = gainEnv(ac, t0, 0.005, 0.05, 0.03); osc(ac, 'sine', base, t0, t0 + 0.05, g); osc(ac, 'sine', base, t0 + 0.05, t0 + 0.09, g); } } }),
    S('multitud', 'ambiente', 'Murmullo de gente', 'Crowd murmur', 8, (ac) => { for (let k = 0; k < 4; k++) nz(ac, 0, 8, gainEnv(ac, 0, 1, 0.1, 6.8), 'bandpass', 380 + k * 160, 3); }),
    S('ciudad', 'ambiente', 'Ciudad lejana', 'Distant city', 10, (ac) => { nz(ac, 0, 10, gainEnv(ac, 0, 1, 0.2, 8.8), 'lowpass', 280, 0.6); [0.9, 4.1, 7].forEach((t0) => { const g = gainEnv(ac, t0, 0.15, 0.06, 1.2); osc(ac, 'sawtooth', 310, t0, t0 + 1.4, g, 280); }); }),
    S('motor', 'ambiente', 'Motor', 'Engine', 6, (ac) => { const g = ac.createGain(); g.gain.value = 0.22; g.connect(ac.destination); const o = osc(ac, 'sawtooth', 55, 0, 6, flt(ac, 'lowpass', 400, g)); const l = ac.createOscillator(); l.frequency.value = 24; const lg = ac.createGain(); lg.gain.value = 9; l.connect(lg); lg.connect(o.frequency); l.start(0); l.stop(6); }),
    /* tecnología y magia */
    S('laser', 'tecnologia', 'Láser', 'Laser', 0.6, (ac) => { const g = gainEnv(ac, 0, 0.002, 0.45, 0.4); osc(ac, 'sawtooth', 2400, 0, 0.45, g, 180); }),
    S('powerup', 'tecnologia', 'Power-up', 'Power-up', 1, (ac) => { [60, 64, 67, 72, 76].forEach((m, i) => tone(ac, 'square', m + 12, i * 0.1, 0.25, 0.1)); }),
    S('powerdown', 'tecnologia', 'Power-down', 'Power-down', 1.2, (ac) => { const g = gainEnv(ac, 0, 0.02, 0.35, 1); osc(ac, 'square', 880, 0, 1.1, g, 70); }),
    S('notificacion', 'tecnologia', 'Notificación', 'Notification', 0.9, (ac) => { tone(ac, 'sine', 84, 0, 0.35, 0.4); tone(ac, 'sine', 91, 0.15, 0.6, 0.4); }),
    S('teclado', 'tecnologia', 'Teclado', 'Typing', 3, (ac) => { for (let i = 0; i < 26; i++) { const t0 = i * 0.11 + rnd() * 0.04; nz(ac, t0, 0.02, gainEnv(ac, t0, 0.001, 0.3, 0.025), 'bandpass', 3500 + rnd() * 1500, 2); } }),
    S('alarma', 'tecnologia', 'Alarma', 'Alarm', 3, (ac) => { for (let i = 0; i < 6; i++) tone(ac, 'square', i % 2 ? 79 : 86, i * 0.5, 0.45, 0.18); }),
    S('estatica', 'tecnologia', 'Estática de radio', 'Radio static', 3, (ac) => { nz(ac, 0, 3, gainEnv(ac, 0, 0.1, 0.25, 2.8), 'bandpass', 3000, 0.4); }),
    S('hechizo', 'tecnologia', 'Hechizo mágico', 'Magic spell', 2.4, (ac) => { for (let i = 0; i < 26; i++) { const t0 = i * 0.06; tone(ac, 'sine', 84 + (i % 5) * 3 + Math.floor(i / 5) * 2, t0, 0.5, 0.1); } }),
    S('teletransporte', 'tecnologia', 'Teletransporte', 'Teleport', 1.6, (ac) => { const g = gainEnv(ac, 0, 0.2, 0.4, 1.2); osc(ac, 'sine', 200, 0, 1.4, g, 3000); osc(ac, 'sine', 3000, 0.1, 1.5, gainEnv(ac, 0.1, 0.2, 0.2, 1.2), 300); }),
    /* terror */
    S('latido', 'terror', 'Latido del corazón', 'Heartbeat', 4, (ac) => { for (let i = 0; i < 5; i++) { hit(ac, i * 0.8, 60, 0.9, 0.18, ac.destination); hit(ac, i * 0.8 + 0.22, 55, 0.6, 0.18, ac.destination); } }),
    S('crujido', 'terror', 'Puerta que cruje', 'Creaking door', 2.4, (ac) => { const g = gainEnv(ac, 0, 0.4, 0.3, 1.8); const o = osc(ac, 'sawtooth', 160, 0, 2.2, flt(ac, 'bandpass', 900, g, 8), 360); const l = ac.createOscillator(); l.frequency.value = 18; const lg = ac.createGain(); lg.gain.value = 40; l.connect(lg); lg.connect(o.frequency); l.start(0); l.stop(2.3); }),
    S('susurro', 'terror', 'Susurro', 'Whisper', 2.4, (ac) => { for (let i = 0; i < 5; i++) { const t0 = i * 0.42; nz(ac, t0, 0.3, gainEnv(ac, t0, 0.08, 0.25, 0.25), 'bandpass', 3500, 1.5); } }),
    S('terror-sting', 'terror', 'Acorde de terror', 'Horror sting', 3, (ac) => { [49, 50, 56, 61].forEach((m) => tone(ac, 'sawtooth', m, 0, 2.6, 0.12)); osc(ac, 'sine', 2400, 0, 2.6, gainEnv(ac, 0, 0.3, 0.05, 2.2), 2100); }),
  ];

  /* músicas */
  const pat = (ac, chords, bpm, bars, o) => {
    const beat = 60 / bpm; const gm = ac.createGain(); gm.gain.value = o.gain || 0.2; gm.connect(ac.destination);
    for (let bar = 0; bar < bars; bar++) {
      const ch = chords[bar % chords.length], t0 = bar * beat * 4;
      if (o.pad) ch.forEach((m) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(o.pad, t0 + beat); g.gain.linearRampToValueAtTime(0.0001, t0 + beat * 4); g.connect(gm); osc(ac, o.padType || 'triangle', hz(m), t0, t0 + beat * 4.1, flt(ac, 'lowpass', o.padCut || 1600, g)); });
      if (o.bass) { for (let s = 0; s < (o.bassSteps || 4); s++) { const tt = t0 + s * beat * (4 / (o.bassSteps || 4)), g = gainEnv(ac, tt, 0.01, o.bass, beat * 0.8, gm); osc(ac, o.bassType || 'sine', hz(ch[0] - 24), tt, tt + beat, g); } }
      if (o.arp) for (let s = 0; s < 8; s++) { const tt = t0 + s * beat * 0.5; tone(ac, o.arpType || 'triangle', ch[s % ch.length] + (s > 3 ? 12 : 0), tt, beat * 0.55, o.arp, gm); }
      if (o.kick) for (let s = 0; s < 4; s++) { const tt = t0 + s * beat; hit(ac, tt, 62, o.kick, 0.16, gm); }
      if (o.hat) for (let s = 0; s < 8; s++) { const tt = t0 + s * beat * 0.5; nz(ac, tt, 0.04, gainEnv(ac, tt, 0.001, o.hat, 0.04, gm), 'highpass', 7000); }
      if (o.snare) for (let s = 1; s < 4; s += 2) { const tt = t0 + s * beat; nz(ac, tt, 0.15, gainEnv(ac, tt, 0.002, o.snare, 0.14, gm), 'bandpass', 1900, 0.8); }
    }
  };
  const C_EPIC = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], C_HAPPY = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], C_LOFI = [[62, 65, 69, 72], [58, 62, 65, 69], [55, 58, 62, 65], [57, 61, 64, 67]], C_MYST = [[57, 60, 63], [56, 59, 63], [54, 57, 60], [55, 58, 62]];
  const MUSIC = [
    M('epica', 'Música · Épica', 'Music · Epic', 18, (ac) => pat(ac, C_EPIC, 100, 8, { pad: 0.09, padType: 'sawtooth', padCut: 1300, bass: 0.35, bassSteps: 2, kick: 0.55, snare: 0.18, hat: 0.05, gain: 0.7 })),
    M('alegre', 'Música · Alegre', 'Music · Upbeat', 16, (ac) => pat(ac, C_HAPPY, 120, 8, { arp: 0.18, arpType: 'triangle', bass: 0.28, bassSteps: 4, kick: 0.35, hat: 0.04, gain: 0.7 })),
    M('lofi', 'Música · Lo-fi', 'Music · Lo-fi', 20, (ac) => pat(ac, C_LOFI, 76, 8, { pad: 0.09, padType: 'sine', padCut: 1800, bass: 0.22, bassSteps: 2, kick: 0.35, snare: 0.1, hat: 0.03, gain: 0.8 })),
    M('misterio', 'Música · Misterio', 'Music · Mystery', 18, (ac) => pat(ac, C_MYST, 70, 8, { pad: 0.08, padType: 'triangle', padCut: 900, bass: 0.18, bassSteps: 1, arp: 0.07, gain: 0.8 })),
    M('suspense', 'Música · Suspense', 'Music · Suspense', 16, (ac) => { pat(ac, C_MYST, 90, 7, { pad: 0.06, padType: 'sawtooth', padCut: 700, bass: 0.3, bassSteps: 8, bassType: 'triangle', gain: 0.7 }); }),
    M('accion', 'Música · Acción', 'Music · Action', 16, (ac) => pat(ac, C_EPIC, 150, 10, { arp: 0.12, arpType: 'sawtooth', bass: 0.34, bassSteps: 8, bassType: 'sawtooth', kick: 0.6, snare: 0.24, hat: 0.07, gain: 0.55 })),
    M('emotiva', 'Música · Emotiva', 'Music · Emotional', 20, (ac) => pat(ac, C_EPIC, 66, 8, { pad: 0.1, padType: 'sine', arp: 0.14, arpType: 'sine', bass: 0.2, bassSteps: 1, gain: 0.8 })),
    M('retro', 'Música · Retro (chiptune)', 'Music · Retro (chiptune)', 14, (ac) => pat(ac, C_HAPPY, 140, 8, { arp: 0.12, arpType: 'square', bass: 0.2, bassSteps: 4, bassType: 'square', kick: 0.3, hat: 0.03, gain: 0.55 })),
    M('terror-amb', 'Música · Terror ambiente', 'Music · Horror ambience', 18, (ac) => { pat(ac, C_MYST, 50, 5, { pad: 0.09, padType: 'sawtooth', padCut: 500, bass: 0.35, bassSteps: 1, gain: 0.8 }); [3, 9, 13].forEach((t0) => tone(ac, 'sine', 100 + (t0 % 3), t0, 2.2, 0.07)); }),
    M('romantica', 'Música · Romántica', 'Music · Romantic', 18, (ac) => pat(ac, C_HAPPY, 72, 8, { pad: 0.09, padType: 'triangle', arp: 0.12, arpType: 'sine', bass: 0.18, bassSteps: 2, gain: 0.8 })),
  ];

  A.CATS = [['todos', 'Todos', 'All'], ['impactos', 'Impactos', 'Impacts'], ['movimiento', 'Movimiento', 'Movement'], ['comic', 'Cómic', 'Comic'], ['ambiente', 'Ambiente', 'Ambience'], ['tecnologia', 'Tecnología y magia', 'Tech and magic'], ['terror', 'Terror', 'Horror'], ['musica', 'Músicas', 'Music']];
  const old = A.LIBRARY;
  old.forEach((it) => { it.cat = it.kind === 'music' ? 'musica' : ({ golpe: 'impactos', whoosh: 'movimiento', explosion: 'impactos', clic: 'tecnologia', chispas: 'tecnologia', campana: 'comic' })[it.id] || 'comic'; });
  A.LIBRARY = old.concat(SFX, MUSIC);
  /* Todos los sonidos salen con un volumen parecido: se lleva el pico a un nivel cómodo (los ambientes algo más bajos). */
  const orig = A.renderLibrary, done = new Map();
  A.renderLibrary = async (item) => {
    if (done.has(item.id)) return done.get(item.id);
    const buf = await orig(item), d = buf.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; }
    const target = item.cat === 'ambiente' ? 0.5 : item.kind === 'music' ? 0.8 : 0.9, k = pk > 0.0001 ? target / pk : 1;
    for (let c = 0; c < buf.numberOfChannels; c++) { const ch = buf.getChannelData(c); for (let i = 0; i < ch.length; i++) ch[i] *= k; }
    done.set(item.id, buf); return buf;
  };
})();
