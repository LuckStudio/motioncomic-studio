/* Proyecto de ejemplo: ilustraciones dibujadas por código, para explorar la herramienta sin subir nada (PRD 12, primera vez). */
(function () {
  const MC = window.MC;
  const SW = 2048, SH = 1152;
  const INK = '#0A0A14';

  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function mk() { const c = document.createElement('canvas'); c.width = SW; c.height = SH; return { c, g: c.getContext('2d') }; }
  function grad(g, stops, y0, y1) { const gr = g.createLinearGradient(0, y0 == null ? 0 : y0, 0, y1 == null ? SH : y1); stops.forEach((s) => gr.addColorStop(s[0], s[1])); return gr; }
  function halftone(g, x, y, w, h, step, color, fn) {
    g.fillStyle = color;
    for (let j = y; j < y + h; j += step) for (let i = x; i < x + w; i += step) {
      const k = fn(i, j); if (k <= 0.04) continue;
      g.beginPath(); g.arc(i + ((((j - y) / step) | 0) % 2) * step / 2, j, step * 0.5 * Math.min(1, k), 0, 6.283); g.fill();
    }
  }
  function city(g, r, o) {
    let x = -40;
    while (x < SW + 40) {
      const w = o.minW + r() * (o.maxW - o.minW), hh = o.minH + r() * (o.maxH - o.minH), top = o.base - hh;
      g.fillStyle = o.color; g.fillRect(x, top, w, hh + 4);
      if (o.ink) { g.strokeStyle = INK; g.lineWidth = o.ink; g.strokeRect(x, top, w, hh + 4); }
      if (r() > 0.6) { g.fillStyle = o.color; g.fillRect(x + w * 0.4, top - 40 - r() * 50, 6, 60); }
      for (let wy = top + 24; wy < o.base - 20; wy += o.win.gap) for (let wx = x + 14; wx < x + w - 20; wx += o.win.gap) {
        if (r() < o.win.p) { g.fillStyle = o.win.color; g.fillRect(wx, wy, o.win.s, o.win.s * 1.3); }
      }
      x += w + (o.gap || 0);
    }
  }
  function figure(g, x, y, sc, flip, scarf) {
    g.save(); g.translate(x, y); g.scale(flip * sc, sc); g.lineJoin = 'round'; g.lineCap = 'round';
    g.lineWidth = 9; g.strokeStyle = INK;
    // piernas
    g.fillStyle = '#1B1B38';
    g.beginPath(); g.moveTo(-34, -190); g.lineTo(-48, 0); g.lineTo(-6, 0); g.lineTo(0, -190); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(6, -190); g.lineTo(8, 0); g.lineTo(52, 0); g.lineTo(38, -190); g.closePath(); g.fill(); g.stroke();
    // abrigo
    g.fillStyle = '#2C2858';
    g.beginPath(); g.moveTo(-58, -340); g.quadraticCurveTo(-96, -230, -104, -120); g.lineTo(100, -120); g.quadraticCurveTo(84, -230, 58, -340); g.quadraticCurveTo(0, -362, -58, -340); g.fill(); g.stroke();
    g.strokeStyle = '#8C7CFF'; g.lineWidth = 6; g.beginPath(); g.moveTo(58, -336); g.quadraticCurveTo(86, -230, 98, -126); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 9;
    // brazo
    g.fillStyle = '#2C2858'; g.beginPath(); g.moveTo(-56, -330); g.quadraticCurveTo(-96, -250, -74, -170); g.lineTo(-42, -176); g.quadraticCurveTo(-60, -250, -34, -318); g.closePath(); g.fill(); g.stroke();
    // cabeza
    g.fillStyle = '#F0D2BC'; g.beginPath(); g.arc(0, -392, 44, 0, 6.283); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.moveTo(-48, -396); g.quadraticCurveTo(-40, -452, 6, -444); g.quadraticCurveTo(52, -446, 50, -392); g.quadraticCurveTo(24, -418, -8, -412); g.quadraticCurveTo(-30, -410, -48, -396); g.fill();
    g.beginPath(); g.arc(18, -386, 5, 0, 6.283); g.fill();
    // bufanda
    g.fillStyle = '#8C7CFF'; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.moveTo(-40, -352); g.quadraticCurveTo(0, -330, 42, -352); g.lineTo(46, -330); g.quadraticCurveTo(0, -306, -44, -330); g.closePath(); g.fill(); g.stroke();
    const sx = scarf * 190;
    g.beginPath(); g.moveTo(34, -342); g.quadraticCurveTo(34 + sx * 0.5, -360 + scarf * 12, 34 + sx, -330 + scarf * 30); g.lineTo(34 + sx - scarf * 8, -296 + scarf * 24); g.quadraticCurveTo(34 + sx * 0.5, -318, 38, -318); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  /* --- Plano 1: la azotea (noche) --- */
  function shot1() {
    const r = rng(11), L = [];
    let { c, g } = mk();
    g.fillStyle = grad(g, [[0, '#0B0B26'], [0.55, '#241F5E'], [1, '#5B3F92']]); g.fillRect(0, 0, SW, SH);
    halftone(g, 0, 560, SW, 600, 22, 'rgba(140,124,255,.28)', (x, y) => (y - 560) / 600);
    g.fillStyle = '#ECEEF0'; for (let i = 0; i < 160; i++) { g.globalAlpha = 0.3 + r() * 0.7; g.beginPath(); g.arc(r() * SW, r() * 620, 1 + r() * 2.2, 0, 6.283); g.fill(); }
    g.globalAlpha = 1;
    const mg = g.createRadialGradient(1500, 250, 20, 1500, 250, 320); mg.addColorStop(0, 'rgba(236,238,240,.5)'); mg.addColorStop(1, 'rgba(236,238,240,0)'); g.fillStyle = mg; g.fillRect(1100, 0, 800, 650);
    g.fillStyle = '#F2EFE6'; g.beginPath(); g.arc(1500, 250, 92, 0, 6.283); g.fill(); g.strokeStyle = INK; g.lineWidth = 7; g.stroke();
    g.fillStyle = 'rgba(160,150,190,.45)'; [[1470, 230, 22], [1530, 285, 14], [1520, 214, 9]].forEach((k) => { g.beginPath(); g.arc(k[0], k[1], k[2], 0, 6.283); g.fill(); });
    L.push({ name: 'Cielo', c, z: 0, role: 'fondo' });

    ({ c, g } = mk());
    city(g, r, { base: 820, minW: 90, maxW: 190, minH: 160, maxH: 380, color: '#2B2670', win: { color: 'rgba(255,214,120,.55)', p: 0.25, gap: 34, s: 9 } });
    L.push({ name: 'Ciudad lejana', c, z: 0.25, role: '' });

    ({ c, g } = mk());
    city(g, r, { base: 960, minW: 150, maxW: 280, minH: 260, maxH: 560, color: '#15143A', ink: 6, win: { color: '#FFD678', p: 0.32, gap: 46, s: 14 }, gap: 12 });
    L.push({ name: 'Ciudad cercana', c, z: 0.45, role: '' });

    ({ c, g } = mk());
    figure(g, 1130, 900, 1.5, 1, 1);
    L.push({ name: 'Personaje', c, z: 0.65, role: '' });

    ({ c, g } = mk());
    g.fillStyle = '#0A0A18'; g.fillRect(0, 900, SW, 260);
    g.fillStyle = '#12122A'; g.fillRect(0, 900, SW, 22);
    for (let x = 60; x < SW; x += 240) { g.fillStyle = '#0A0A18'; g.fillRect(x, 700, 14, 210); }
    g.fillRect(0, 760, SW, 10);
    g.fillRect(1720, 360, 12, 560); g.fillRect(1640, 430, 170, 8); g.fillRect(1660, 500, 130, 8);
    L.push({ name: 'Primer plano', c, z: 0.92, role: '' });
    return { name: 'La azotea', duration: 5, layers: L, preset: ['zoomin', 0.8], curve: 'smooth', transition: { type: 'cut', dur: 0.6 } };
  }

  /* --- Plano 2: amanecer --- */
  function shot2() {
    const r = rng(23), L = [];
    let { c, g } = mk();
    g.fillStyle = grad(g, [[0, '#5A3F92'], [0.45, '#E0708C'], [0.8, '#FFB070'], [1, '#FFE0A8']]); g.fillRect(0, 0, SW, SH);
    halftone(g, 0, 0, SW, 700, 24, 'rgba(255,255,255,.18)', (x, y) => 1 - y / 700);
    g.fillStyle = '#FFF3D0'; g.beginPath(); g.arc(1240, 700, 180, 0, 6.283); g.fill(); g.strokeStyle = INK; g.lineWidth = 8; g.stroke();
    L.push({ name: 'Cielo amanecer', c, z: 0, role: 'fondo' });

    ({ c, g } = mk());
    city(g, r, { base: 900, minW: 100, maxW: 220, minH: 180, maxH: 420, color: '#7D4A8A', win: { color: 'rgba(255,230,170,.5)', p: 0.2, gap: 36, s: 9 } });
    L.push({ name: 'Ciudad lejana', c, z: 0.2, role: '' });

    ({ c, g } = mk());
    city(g, r, { base: 1000, minW: 160, maxW: 300, minH: 300, maxH: 620, color: '#3A2468', ink: 6, win: { color: '#FFD678', p: 0.2, gap: 50, s: 14 }, gap: 10 });
    L.push({ name: 'Edificios', c, z: 0.4, role: '' });

    ({ c, g } = mk());
    figure(g, 1020, 1010, 1.75, -1, -1);
    L.push({ name: 'Personaje', c, z: 0.62, role: '' });

    ({ c, g } = mk());
    g.strokeStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 46; i++) { const y = r() * SH, x = r() * SW, l = 280 + r() * 700; g.lineWidth = 2 + r() * 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); }
    g.fillStyle = '#0A0A18'; g.beginPath(); g.moveTo(0, SH); g.lineTo(0, 1030); g.lineTo(SW, 1070); g.lineTo(SW, SH); g.fill();
    L.push({ name: 'Primer plano líneas', c, z: 0.95, role: '' });
    return { name: 'Amanecer', duration: 4, layers: L, preset: ['panl', 1], curve: 'smooth', transition: { type: 'wipe', dur: 0.8 } };
  }

  /* --- Plano 3: impacto --- */
  function shot3(font) {
    const r = rng(37), L = [];
    let { c, g } = mk();
    g.fillStyle = '#F7C948'; g.fillRect(0, 0, SW, SH);
    g.translate(SW / 2, SH / 2);
    for (let i = 0; i < 44; i++) { const a = (i / 44) * 6.283, a2 = a + 0.07; g.fillStyle = i % 2 ? '#F28A30' : '#F7C948'; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 2400, Math.sin(a) * 2400); g.lineTo(Math.cos(a2) * 2400, Math.sin(a2) * 2400); g.fill(); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    halftone(g, 0, 0, SW, SH, 26, 'rgba(200,40,50,.5)', (x, y) => { const d = Math.hypot(x - SW / 2, y - SH / 2) / 1150; return d > 0.35 ? (d - 0.35) * 1.4 : 0; });
    L.push({ name: 'Fondo explosión', c, z: 0.05, role: 'fondo' });

    ({ c, g } = mk());
    [[760, 760, 150], [920, 840, 190], [1100, 880, 220], [1290, 850, 200], [1440, 780, 160], [1000, 720, 150], [1220, 730, 170]].forEach((k) => {
      g.fillStyle = '#3A3550'; g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.arc(k[0], k[1], k[2], 0, 6.283); g.fill(); g.stroke();
    });
    [[1000, 800, 90], [1200, 800, 100]].forEach((k) => { g.fillStyle = '#5A5470'; g.beginPath(); g.arc(k[0], k[1], k[2], 0, 6.283); g.fill(); });
    L.push({ name: 'Humo', c, z: 0.5, role: '' });

    return { name: '¡Impacto!', duration: 2.5, layers: L, preset: ['shake', 1.2], curve: 'smooth', transition: { type: 'flash', dur: 0.5 } };
  }

  /* Página de cómic de ejemplo (1600×2300, cinco viñetas) para probar el modo Página. */
  MC.createPageSample = async (lang) => {
    const en = lang === 'en', PW = 1600, PH = 2300, c = document.createElement('canvas'); c.width = PW; c.height = PH;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, PW, PH);
    const s1 = shot1().layers, s2 = shot2().layers, s3 = shot3('"Arial Black", Impact, sans-serif').layers;
    const panel = (x, y, w, h, layers, crop) => {
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      let cr = crop;
      if (!cr) { const k = Math.max(w / SW, h / SH); cr = { w: w / k, h: h / k }; cr.x = (SW - cr.w) / 2; cr.y = (SH - cr.h) / 2; }
      layers.forEach((l) => g.drawImage(l.c, cr.x, cr.y, cr.w, cr.h, x, y, w, h));
      g.restore(); g.strokeStyle = '#0A0A14'; g.lineWidth = 9; g.strokeRect(x, y, w, h);
    };
    panel(70, 70, 860, 580, s1);
    panel(980, 70, 550, 580, s1, { x: 760, y: 120, w: 620, h: 657 });
    panel(70, 700, 1460, 550, s2);
    panel(70, 1300, 650, 930, s3);
    panel(770, 1300, 760, 930, s2, { x: 560, y: 120, w: 780, h: 955 });
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    const asset = await MC.assets.add(blob, (en ? 'Example page' : 'Página de ejemplo') + '.png');
    const p = MC.newProject({ name: en ? 'Example project · Page mode' : 'Proyecto de ejemplo · Modo Página', ratio: '9:16', res: '1080p', zoom: 1.5 });
    p.mode = 'page'; p.dir = 'ltr';
    p.shots = [MC.pageShot(p, asset, 'ltr', en ? 'Page 1' : 'Página 1')];
    const a = await MC.audio.add(MC.audio.wav(await MC.audio.renderLibrary(MC.audio.LIBRARY.find((x) => x.id === 'aventura'))), (en ? 'Music · Adventure' : 'Música · Aventura') + '.wav');
    MC.finalizePages(p);
    const cl = MC.audio.newClip('musica', a, 0); cl.dur = Math.min(a.dur, p.shots[0].duration); cl.vol = 0.8; cl.fadeOut = 1.5; p.clips.push(cl);
    p.thumb = MC.makeThumb(p); p.sample = true; p.samplePage = true;
    return p;
  };

  MC.createSampleProject = async (lang) => {
    let font = '"Arial Black", Impact, sans-serif';
    try { await document.fonts.load('800 100px "Bricolage Grotesque"'); if (document.fonts.check('800 100px "Bricolage Grotesque"')) font = '"Bricolage Grotesque", ' + font; } catch (e) { /* usa la tipografía de reserva */ }
    const en = lang === 'en';
    const p = MC.newProject({ name: en ? 'Example project' : 'Proyecto de ejemplo', ratio: '16:9', res: '1080p', zoom: 1.3 });
    p.shots = [];
    for (const spec of [shot1(), shot2(), shot3(font)]) {
      const sh = MC.newShot(spec.name);
      sh.duration = spec.duration; sh.transition = spec.transition; sh.camera.curve = spec.curve;
      for (const l of spec.layers) {
        const blob = await new Promise((res) => l.c.toBlob(res, 'image/png'));
        const a = await MC.assets.add(blob, l.name + '.png');
        const layer = MC.newLayer(a, { z: l.z, role: l.role });
        layer.z = l.z; layer.role = l.role; layer.name = l.name;
        sh.layers.push(layer);
      }
      MC.applyPreset(sh.camera, spec.preset[0], spec.preset[1]);
      p.shots.push(sh);
    }
    /* audio de ejemplo generado por código: música de fondo y dos efectos en los cambios de plano */
    const lib = (id) => MC.audio.LIBRARY.find((x) => x.id === id), starts = MC.shotStarts(p), total = MC.totalTime(p);
    const put = async (id, track, start, opts) => {
      const it = lib(id), a = await MC.audio.add(MC.audio.wav(await MC.audio.renderLibrary(it)), (en ? it.en : it.es) + '.wav');
      const c = MC.audio.newClip(track, a, start); Object.assign(c, opts || {}); p.clips.push(c);
    };
    await put('noche', 'musica', 0, { dur: Math.min(total, 16), vol: 0.9, fadeIn: 0.8, fadeOut: 1.8 });
    await put('whoosh', 'sfx', Math.max(0, starts[1] - 0.15), { vol: 0.8 });
    await put('explosion', 'sfx', starts[2], { vol: 0.9 });
    /* texto de ejemplo en dos idiomas */
    p.langs = ['es', 'en']; p.lang = en ? 'en' : 'es';
    const tx = (kind, start, dur, es, enT, o) => { const it = MC.newText(kind, start, p); it.t = { es, en: enT }; it.start = start; it.dur = dur; Object.assign(it, o || {}); p.texts.push(it); return it; };
    tx('box', 0.3, 3.6, 'Esa misma noche…', 'That same night…', { reveal: 'chars', speed: 22 });
    tx('bubble', 1.4, 3.4, 'Otra noche más\nsin dormir.', 'Another night\nwithout sleep.', { x: 0.18, y: -0.3, w: 0.3, size: 0.048, tail: { x: -0.06, y: 0.2 }, reveal: 'words', speed: 24, loop: 'float' });
    tx('bubble', starts[1] + 0.5, 3, '¡Tenemos que irnos!', 'We have to go!', { shape: 'shout', x: -0.2, y: -0.28, w: 0.3, size: 0.06, anim: 'bounce', color: '#14141c', fill: '#FFE08A', tail: { x: 0, y: 0.2 } });
    tx('sfx', starts[2] + 0.05, 2.2, '¡BOOM!', 'BOOM!', { y: 0.05 });
    /* efectos de ejemplo: rack focus, líneas de velocidad, golpe con aberración y aspecto de cómic */
    const lid = (sh, name) => (sh.layers.find((l) => l.name === name) || {}).id;
    p.shots[0].rack = { on: true, a: lid(p.shots[0], 'Ciudad lejana'), b: lid(p.shots[0], 'Personaje'), start: 1.6, dur: 1.4, amount: 12 };
    const f1 = MC.newFx('speed', 0.6); f1.dur = 2.6; f1.intensity = 1; p.shots[1].fx.push(f1);
    const f2 = MC.newFx('impact', 0.05); f2.intensity = 1.2; p.shots[2].fx.push(f2);
    const f3 = MC.newFx('aberration', 0.05); f3.dur = 0.7; f3.intensity = 1; p.shots[2].fx.push(f3);
    const f4 = MC.newFx('sparks', 0.4); f4.dur = 2; f4.intensity = 0.8; p.shots[2].fx.push(f4);
    p.look = { vignette: 0.35, grain: 0.22, halftone: 0, tint: null };
    p.thumb = MC.makeThumb(p);
    p.sample = true; p.sampleV = 4;
    return p;
  };
})();
