/* 20 efectos de sonido más, generados por código como los demás (sin archivos ni licencias): objetos y vida cotidiana, acción y transiciones. */
(function () {
  'use strict';
  const MC = window.MC, A = MC.audio;
  if (!A || !A.kit) return;
  const { rnd, gainEnv, osc, flt, nz, hit, tone } = A.kit;
  const S = (id, cat, es, en, dur, gen) => ({ id, kind: 'sfx', cat, es, en, dur, gen });
  /* ruido con su propia envolvente de volumen (ataque, bajada) a partir de un instante */
  const puff = (ac, t0, a, peak, dec, type, f, q, f1) => nz(ac, t0, a + dec, gainEnv(ac, t0, a, peak, dec), type, f, q, f1);
  const ramp = (ac, pts) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, 0); pts.forEach((p) => g.gain.linearRampToValueAtTime(p[1], p[0])); g.connect(ac.destination); return g; };

  const SFX = [
    /* objetos y vida cotidiana */
    S('pagina', 'objetos', 'Pasar página', 'Page turn', 0.9, (ac) => { puff(ac, 0, 0.09, 0.45, 0.32, 'bandpass', 3200, 0.9, 2500); puff(ac, 0.34, 0.03, 0.25, 0.14, 'lowpass', 1500); }),
    S('papel', 'objetos', 'Roce de papel', 'Paper rustle', 0.8, (ac) => { for (let i = 0; i < 9; i++) puff(ac, 0.04 + i * 0.075 + rnd() * 0.03, 0.01, 0.2 + rnd() * 0.25, 0.05 + rnd() * 0.05, 'bandpass', 3500 + rnd() * 2500, 1.2); }),
    S('pasos-nieve', 'objetos', 'Pasos en la nieve', 'Footsteps in snow', 1.8, (ac) => { [0, 0.5, 1, 1.5].forEach((t0, i) => { puff(ac, t0, 0.02, 0.5, 0.2, 'bandpass', 1800 + i * 150, 0.8, 600); puff(ac, t0 + 0.05, 0.005, 0.3, 0.12, 'highpass', 3500); }); }),
    S('maquina', 'objetos', 'Máquina de escribir', 'Typewriter', 2, (ac) => { let t0 = 0.05; for (let i = 0; i < 12; i++) { puff(ac, t0, 0.002, 0.45, 0.04, 'bandpass', 2200, 1.5); hit(ac, t0, 260, 0.25, 0.05, ac.destination); t0 += 0.09 + rnd() * 0.06; } tone(ac, 'sine', 96, t0 + 0.1, 0.9, 0.35); puff(ac, t0 + 0.55, 0.01, 0.4, 0.2, 'bandpass', 1500, 1); }),
    S('obturador', 'objetos', 'Obturador de cámara', 'Camera shutter', 0.5, (ac) => { puff(ac, 0, 0.002, 0.6, 0.04, 'bandpass', 2600, 1.4); puff(ac, 0.11, 0.002, 0.45, 0.06, 'bandpass', 1800, 1.4); osc(ac, 'square', 420, 0, 0.05, gainEnv(ac, 0, 0.001, 0.12, 0.04), 180); }),
    S('scratch', 'objetos', 'Rasgueo de disco', 'Record scratch', 0.8, (ac) => { osc(ac, 'sawtooth', 250, 0, 0.2, gainEnv(ac, 0, 0.01, 0.35, 0.2), 1500); osc(ac, 'sawtooth', 1300, 0.2, 0.45, gainEnv(ac, 0.2, 0.01, 0.35, 0.25), 160); puff(ac, 0, 0.01, 0.2, 0.5, 'highpass', 4500); }),
    S('tictac', 'objetos', 'Tictac de reloj', 'Clock ticking', 2, (ac) => { for (let i = 0; i < 6; i++) { const t0 = i * 0.33, hi = i % 2; puff(ac, t0, 0.001, 0.6, 0.03, 'bandpass', hi ? 3200 : 2400, 3); osc(ac, 'sine', hi ? 1500 : 1100, t0, t0 + 0.04, gainEnv(ac, t0, 0.001, 0.2, 0.035)); } }),
    S('timbre', 'objetos', 'Timbre de puerta', 'Doorbell', 1.6, (ac) => { tone(ac, 'sine', 84, 0, 1, 0.4); tone(ac, 'triangle', 96, 0, 0.5, 0.12); tone(ac, 'sine', 79, 0.5, 1.1, 0.4); tone(ac, 'triangle', 91, 0.5, 0.5, 0.12); }),
    S('gota', 'objetos', 'Gota de agua', 'Water drop', 0.6, (ac) => { osc(ac, 'sine', 1300, 0, 0.14, gainEnv(ac, 0, 0.002, 0.6, 0.12), 320); osc(ac, 'sine', 700, 0.26, 0.38, gainEnv(ac, 0.26, 0.002, 0.25, 0.1), 260); }),
    /* acción */
    S('espadazo', 'accion', 'Espadazo', 'Sword slash', 0.9, (ac) => { puff(ac, 0, 0.01, 0.7, 0.32, 'highpass', 2500, 0.6, 9000); osc(ac, 'sine', 2400, 0.02, 0.7, gainEnv(ac, 0.02, 0.002, 0.18, 0.6)); osc(ac, 'sine', 3150, 0.02, 0.6, gainEnv(ac, 0.02, 0.002, 0.1, 0.5)); }),
    S('rafaga', 'accion', 'Ráfaga láser', 'Laser burst', 0.8, (ac) => { [0, 0.16, 0.32].forEach((t0, i) => { osc(ac, 'sawtooth', 1900 - i * 100, t0, t0 + 0.12, gainEnv(ac, t0, 0.003, 0.4, 0.11), 260); osc(ac, 'square', 1890 - i * 100, t0, t0 + 0.12, gainEnv(ac, t0, 0.003, 0.15, 0.11), 255, 10); }); }),
    S('pew', 'accion', 'Disparo de cómic', 'Comic shot', 0.5, (ac) => { osc(ac, 'sine', 950, 0, 0.16, gainEnv(ac, 0, 0.002, 0.7, 0.15), 110); puff(ac, 0, 0.002, 0.4, 0.05, 'highpass', 2500); }),
    S('resorte', 'accion', 'Resorte', 'Spring twang', 1.1, (ac) => { const o = osc(ac, 'triangle', 420, 0, 0.9, gainEnv(ac, 0, 0.003, 0.6, 1), 150), l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 26; lg.gain.setValueAtTime(110, 0); lg.gain.exponentialRampToValueAtTime(4, 1); l.connect(lg); lg.connect(o.frequency); l.start(0); l.stop(1.1); }),
    S('glitch-hit', 'accion', 'Golpe de glitch', 'Glitch hit', 0.6, (ac) => { let t0 = 0; for (let i = 0; i < 11; i++) { const d = 0.03 + rnd() * 0.05; osc(ac, rnd() > 0.5 ? 'square' : 'sawtooth', 180 + rnd() * 2800, t0, t0 + d, gainEnv(ac, t0, 0.002, 0.3, d)); if (rnd() > 0.55) puff(ac, t0, 0.001, 0.25, d, 'highpass', 4000); t0 += d * (0.6 + rnd() * 0.8); } }),
    S('bassdrop', 'accion', 'Caída de graves', 'Bass drop', 2, (ac) => { osc(ac, 'sine', 190, 0, 1.3, gainEnv(ac, 0, 0.01, 0.9, 1.8), 34); osc(ac, 'triangle', 380, 0, 1, gainEnv(ac, 0, 0.01, 0.25, 0.7), 60); puff(ac, 0, 0.02, 0.3, 1.2, 'lowpass', 1400, 0.7, 80); }),
    S('riser', 'accion', 'Subida de tensión', 'Tension riser', 3, (ac) => { osc(ac, 'sawtooth', 110, 0, 2.8, ramp(ac, [[2.8, 0.45], [2.85, 0.0001]]), 1250); const g = ramp(ac, [[2.8, 0.5], [2.85, 0.0001]]); nz(ac, 0, 2.85, g, 'bandpass', 300, 1.5, 6000); }),
    /* transiciones */
    S('barrido', 'transicion', 'Barrido de transición', 'Transition sweep', 1.2, (ac) => { const g = ramp(ac, [[0.55, 0.6], [1.15, 0.0001]]); nz(ac, 0, 1.2, g, 'bandpass', 300, 1.6, 5000); }),
    S('rev-platillo', 'transicion', 'Platillo invertido', 'Reverse cymbal', 2.5, (ac) => { const g = ramp(ac, [[2.2, 0.75], [2.25, 0.0001]]); nz(ac, 0, 2.4, g, 'highpass', 4000, 0.5); }),
    S('campanita', 'transicion', 'Campanita mágica', 'Magic chime', 1.8, (ac) => { [84, 88, 91, 96].forEach((m, i) => { tone(ac, 'sine', m, i * 0.09, 1.2, 0.26); tone(ac, 'triangle', m + 12, i * 0.09, 0.8, 0.08); }); }),
    S('zoom-rapido', 'transicion', 'Zoom rápido', 'Quick zoom', 0.6, (ac) => { const g = ramp(ac, [[0.3, 0.55], [0.58, 0.0001]]); nz(ac, 0, 0.6, g, 'bandpass', 500, 1.8, 6500); osc(ac, 'sine', 200, 0, 0.5, gainEnv(ac, 0, 0.02, 0.22, 0.4), 950); }),
  ];
  /* nuevas categorías antes de «Músicas» */
  const mus = A.CATS.findIndex((c) => c[0] === 'musica');
  A.CATS.splice(mus < 0 ? A.CATS.length : mus, 0, ['objetos', 'Objetos y cotidiano', 'Objects and everyday'], ['accion', 'Acción', 'Action'], ['transicion', 'Transiciones', 'Transitions']);
  SFX.forEach((it) => { if (!A.LIBRARY.some((x) => x.id === it.id)) A.LIBRARY.push(it); });
  A.SFX2 = SFX;
})();
