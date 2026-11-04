/* Estudio: visor, capas, inspector y línea de tiempo (PRD 7, 8, 11, 12). */
(function () {
  const MC = window.MC;
  const { h, t, clamp } = MC;

  const DEPTHS = [
    { z: 0.9, es: 'Primer plano', en: 'Foreground' }, { z: 0.6, es: 'Personaje', en: 'Character' },
    { z: 0.4, es: 'Plano medio', en: 'Midground' }, { z: 0.15, es: 'Fondo', en: 'Background' }, { z: 0, es: 'Cielo', en: 'Sky' },
  ];
  const VIEW_W = 1.5; // la vista de cámara muestra 1,5 veces el encuadre

  MC.mountStudio = async function mountStudio(root, project) {
    MC.put(MC.clear(root), h('div', { class: 'empty', style: { marginTop: '30vh' } }, t('Abriendo el proyecto…', 'Opening the project…')));
    MC.normalizeProject(project);
    await MC.loadProjectAssets(project);

    const SEL_KEYS = { li: 'layer', tx: 'text', cl: 'clip', fxsel: 'fx', pn: 'panel', sp: 'stop', ov: 'overlay', sb: 'subs' };
    const S = new Proxy({ project, selKind: 'project', tab: {}, si: 0, li: -1, cl: null, tx: null, ov: null, sb: null, swi: 0, kfid: null, vz: { z: 1, x: 0, y: 0 }, rulers: false, multi: [], hits: [], guides: false, ema: 0, slow: 0, quality: ((pq) => (pq === 'media' || pq === 'full' ? pq : null))(MC.store.get('pq', 'auto')) || ((innerWidth < 900 || (navigator.deviceMemory && navigator.deviceMemory <= 2) || (matchMedia('(pointer: coarse)').matches && (navigator.hardwareConcurrency || 4) <= 4)) ? 'media' : 'full'), pn: null, pageMap: null, sim: null, sp: null, wp: 0, fxsel: null, ptool: 'rect', poly: null, polyCur: null, pv: null, time: 0, playing: false, loop: true, view: 'out', kf: 'to', adv: true,
      ws: 'montaje', mtab: 'panel', thumbV: 0, holes: false, safe: false, pps: 70, open: { capa_rig: false, capa_look: false, capa_pivot: false, capa_kf: false, overlay_look: false, overlay_kf: false, vinetas: true, plano: true, camara: true, capa: true, proyecto: false, audio: true, mezcla: false, texto: true, idiomas: false, pagina: true, estilo: false, tira: true, tray: true, efectos: true, rack: false, aspecto: false },
      hist: [], hpos: -1, dirty: true, alive: true, dpr: 1, savedAt: project.updated, dragging: false },
      { set(o, k, v) { o[k] = v; if (SEL_KEYS[k] && v != null && v !== -1 && v !== false) o.selKind = SEL_KEYS[k]; return true; } });
    const el = {};
    const shot = () => S.project.shots[S.si];
    const layer = () => (shot() ? shot().layers[S.li] : null);
    const opts = (extra) => MC.renderOpts(S.project, Object.assign({ holes: S.holes && S.view === 'out', lang: S.project.lang }, extra));

    /* ---------- historial y guardado ---------- */
    const snap = () => JSON.stringify(S.project);
    function pushHist() {
      const s = snap();
      if (S.hist[S.hpos] === s) return;
      S.hist = S.hist.slice(0, S.hpos + 1); S.hist.push(s);
      if (S.hist.length > 300) S.hist.shift();
      S.hpos = S.hist.length - 1;
    }
    let saveT = 0;
    function scheduleSave() { clearTimeout(saveT); setStatus(false); saveT = setTimeout(save, 700); }
    async function save() {
      clearTimeout(saveT);
      const p = S.project;
      p.updated = Date.now(); p.thumb = MC.makeThumb(p);
      try { await MC.db.put('projects', p); S.savedAt = p.updated; } catch (e) { MC.toast(t('No se pudo guardar. Exporta una copia por si acaso.', 'Could not save. Export a backup just in case.')); }
      setStatus(true);
    }
    function setStatus(saved) {
      if (!el.status) return;
      MC.put(MC.clear(el.status), h('i'), !MC.db.persistent ? t('Sin guardado local', 'Not saved locally') : saved ? t('Guardado en este equipo · ', 'Saved on this device · ') + MC.fmtClock(S.savedAt) : t('Guardando…', 'Saving…'));
    }
    function touch() { S.dirty = true; S.dirtySinceVer = true; scheduleSave(); }
    function commit() {
      S.project.shots.forEach((sh) => { const pa = sh.camera.path; if (pa && pa.custom) sh.duration = Math.max(0.5, Math.round(MC.pathDuration(pa) * 10) / 10); });
      MC.finalizePages(S.project); pushHist(); touch(); renderLayers(); renderInspector(); renderTimeline(); updateHistBtns(); }
    function updateHistBtns() { if (el.undo) { el.undo.disabled = S.hpos <= 0; el.redo.disabled = S.hpos >= S.hist.length - 1; } }
    function restore(i) {
      S.hpos = i; S.project = JSON.parse(S.hist[i]); MC.finalizePages(S.project);
      S.si = clamp(S.si, 0, S.project.shots.length - 1); S.li = clamp(S.li, -1, shot().layers.length - 1);
      fit(); renderAll(); touch(); updateHistBtns();
    }
    const undo = () => { if (S.hpos > 0) restore(S.hpos - 1); };
    const redo = () => { if (S.hpos < S.hist.length - 1) restore(S.hpos + 1); };
    pushHist();

    /* ---------- selección y tiempo ---------- */
    function checkMemory() {
      if (S.memWarned) return;
      const me = MC.memEstimate(S.project), lim = MC.limits(), mb = me.edit / 1048576;
      if (mb > lim.editMB) { S.memWarned = true; MC.toast(t('Las imágenes ocupan ≈ ' + Math.round(mb) + ' MB en edición y para este equipo se recomienda no pasar de ≈ ' + Math.round(lim.editMB) + ' MB. Reduce capas o tamaño.', 'Images take ≈ ' + Math.round(mb) + ' MB while editing and about ' + Math.round(lim.editMB) + ' MB is recommended for this device. Reduce layers or size.')); }
    }
    function selectShot(i, seek) {
      S.si = clamp(i, 0, S.project.shots.length - 1); S.li = -1; S.cl = null; S.tx = null; S.pn = null; S.fxsel = null;
      if (S.ws === 'camara') S.view = editView(); else if (['cam', 'page', 'strip', 'depth'].includes(S.view)) S.view = 'out';
      S.selKind = 'shot';
      if (seek) S.time = MC.shotStarts(S.project)[S.si];
      S.dirty = true; renderLayers(); renderInspector(); renderTimeline(); updateTime();
      MC.announce(t('Plano ', 'Shot ') + (S.si + 1) + ': ' + (shot() ? shot().name : ''));
    }
    function setTime(tm) {
      S.time = clamp(tm, 0, Math.max(0, MC.totalTime(S.project) - 0.001));
      const i = MC.locate(S.project, S.time).i;
      if (i !== S.si) { S.si = i; S.li = -1; renderLayers(); renderInspector(); renderTimeline(); }
      S.dirty = true; updateTime();
    }
    function togglePlay(on) {
      S.playing = on == null ? !S.playing : on;
      if (S.playing && S.time >= MC.totalTime(S.project) - 0.05) setTime(0);
      if (S.playing && S.view === 'cam') { S.view = 'out'; renderVbar(); fit(); }
      if (S.playing) MC.audio.play(S.project, S.time); else MC.audio.stop();
      updateTransport();
    }

    /* ---------- importar ---------- */
    async function importFiles(files, mode) {
      let list = await MC.expandInputs([...files]);
      const warns = (await Promise.all(list.map((f) => MC.colorWarn(f)))).filter(Boolean); if (warns.length) MC.toast(warns[0] + (warns.length > 1 ? t(' (y ' + (warns.length - 1) + ' más)', ' (and ' + (warns.length - 1) + ' more)') : ''));
      for (let i = 0; i < list.length; i++) if (/\.svg$/i.test(list[i].name) || list[i].type === 'image/svg+xml') { try { list[i] = await MC.rasterSvg(list[i]); } catch (e) { MC.toast(t('No se pudo leer el SVG ', 'Could not read the SVG ') + list[i].name); } }
      const psds = list.filter((f) => /\.psd$/i.test(f.name)), auds = list.filter((f) => /^audio\//.test(f.type) || /\.(wav|mp3|m4a|ogg|aac)$/i.test(f.name));
      for (const f of list.filter((x) => /\.pdf$/i.test(x.name))) {
        try {
          const wpx = clamp(Math.round(opts().W * (S.project.zoomPlan || 1.5)), 1200, 3200);
          const r = await MC.pdfToImages(f, wpx, (i, n) => MC.toast(t('Leyendo el PDF · página ' + i + ' de ' + n, 'Reading the PDF · page ' + i + ' of ' + n)));
          list.push(...r.files); if (r.truncated) MC.toast(t('El PDF tiene más de 80 páginas: se importan las 80 primeras.', 'The PDF has more than 80 pages: the first 80 are imported.'));
        } catch (e) { console.error(e); MC.toast(t('No se pudo leer ese PDF.', 'Could not read that PDF.')); }
      }
      const pageMode = S.project.mode === 'page';
      if (S.project.mode !== 'free') { for (const f of psds) { try { list.push(await MC.psdComposite(f)); } catch (e) { MC.toast(t('No se pudo leer ese PSD.', 'Could not read that PSD.')); } } }
      else for (const f of psds) await importPsd(f);
      if (auds.length) await importAudio(auds, 'auto');
      const vids = list.filter((f) => MC.video.isFile(f));
      list = list.filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name));
      if (vids.length) { if (S.project.mode === 'free') await importVideoLayers(vids, mode === 'shots'); else await addOverlays(vids, 0); }
      if (!list.length) return;
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      if (S.project.mode === 'webtoon') { await importStrip(list); return; }
      if (pageMode) { await importPages(list); return; }
      try {
        if (mode === 'shots') {
          const first = S.project.shots.length;
          for (const f of list) {
            const a = await MC.assets.add(f, f.name);
            const sh = MC.newShot(f.name.replace(/\.[a-z0-9]+$/i, ''));
            sh.layers.push(MC.newLayer(a, { z: 0.1, role: 'fondo' }));
            MC.applyPreset(sh.camera, 'zoomin', 0.8);
            S.project.shots.push(sh);
          }
          commit(); selectShot(first, true); checkMemory();
        } else {
          const sh = shot(), empty = sh.layers.length === 0;
          for (let i = 0; i < list.length; i++) {
            const a = await MC.assets.add(list[i], list[i].name);
            sh.layers.push(MC.newLayer(a, empty && i === 0 ? { z: 0.1, role: 'fondo' } : { z: 0.5, role: '' }));
          }
          S.li = sh.layers.length - 1; commit(); checkMemory();
        }
      } catch (e) { MC.toast(t('No se pudo leer esa imagen.', 'Could not read that image.')); }
    }

    /* vídeos como capa del plano (con parallax, dentro de la ilustración) */
    async function importVideoLayers(files, asShots) {
      for (const f of files) {
        try {
          MC.toast(t('Leyendo el vídeo…', 'Reading the video…'));
          const a = await MC.video.add(f, f.name);
          if (asShots) { const ns = MC.newShot(a.name.replace(/\.[a-z0-9]+$/i, '')); MC.applyPreset(ns.camera, 'none', 1); S.project.shots.push(ns); S.si = S.project.shots.length - 1; }
          const sh = shot(), empty = sh.layers.length === 0;
          const L = MC.newLayer(a, empty ? { z: 0.1, role: 'fondo' } : { z: 0.5, role: '' }); L.vloop = true; sh.layers.push(L); S.li = sh.layers.length - 1;
          if (a.audioId) { const ab = MC.audio.get(a.audioId), c = MC.audio.newClip('sfx', ab, MC.shotStarts(S.project)[S.si]); c.dur = Math.min(ab.dur, sh.duration); c.name = a.name.replace(/\.[a-z0-9]+$/i, '') + ' · audio'; S.project.clips.push(c); }
          if (a.dur > sh.duration && empty) sh.duration = Math.min(60, Math.round(a.dur * 10) / 10);
          commit(); videoNote(a);
        } catch (e) { MC.toast(t('No se pudo leer ese vídeo. Prueba con MP4 (H.264) o WebM.', 'Could not read that video. Try MP4 (H.264) or WebM.')); }
      }
    }
    /* consejo de instalación (una vez) y aviso si queda poco espacio en el navegador */
    function installTip() {
      const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
      if (!standalone && !S.tipShown) { S.tipShown = true; setTimeout(() => MC.toast(t('Consejo: con vídeo y archivos pesados MotionComic Studio va mejor instalado en tu ordenador o tableta.', 'Tip: with video and heavy files MotionComic Studio works best installed on your computer or tablet.')), 3400); }
      MC.db.usage().then((u) => { if (u && u.quota && u.used / u.quota > 0.7) setTimeout(() => MC.toast(t('Queda poco espacio en el navegador. Guarda una copia en archivo desde el menú de carpeta.', 'The browser is running low on space. Save a file copy from the folder menu.')), 6200); });
    }
    function videoNote(a) {
      installTip();
      if (a.w * a.h > 2200 * 1250) MC.toast(t('Es un vídeo muy grande: para ir fluido en el visor usa la calidad «Media» o un vídeo de 1080p.', 'This is a very large video: use the “Medium” preview quality or a 1080p video to stay smooth.'));
      else MC.toast(t('Vídeo añadido' + (a.hasAudio ? ' con su audio' : ''), 'Video added' + (a.hasAudio ? ' with its audio' : '')));
    }
    /* superposiciones: imágenes y vídeos en pistas propias, por encima de todo */
    async function addOverlays(files, track) {
      const p = S.project; let at = S.time;
      for (const f of files) {
        try {
          const isV = MC.video.isFile(f);
          if (isV) MC.toast(t('Leyendo el vídeo…', 'Reading the video…'));
          const a = isV ? await MC.video.add(f, f.name) : await MC.assets.add(f, f.name);
          const it = MC.newOverlay(a, { track: clamp(track, 0, p.otracks.length - 1), start: at, dur: 4 }); it.scale = 0.6;
          if (!isV) { it.dur = Math.max(1, Math.min(MC.totalTime(p) - at, 6)) || 4; }
          p.overlays.push(it);
          if (isV && a.audioId) {
            const ab = MC.audio.get(a.audioId) || (await MC.audio.load(a.audioId)), c = MC.audio.newClip('voz', ab, it.start);
            c.dur = Math.min(ab.dur, it.dur); c.name = it.name + ' · audio'; p.clips.push(c); it.audioClip = c.id;
          }
          S.ov = it.id; S.cl = null; S.tx = null; S.li = -1; at += it.dur;
          commit(); if (isV) videoNote(a); else MC.toast(t('Superposición añadida', 'Overlay added'));
        } catch (e) { MC.toast(t('No se pudo leer ese archivo. Para vídeo prueba con MP4 (H.264) o WebM.', 'Could not read that file. For video try MP4 (H.264) or WebM.')); }
      }
      checkMemory();
    }
    /* el audio del vídeo sigue a la superposición (inicio, duración y desfase) */
    function syncOvAudio(it) {
      if (!it.audioClip) return; const c = clipById(it.audioClip); if (!c) { it.audioClip = null; return; }
      const ab = MC.audio.get(c.assetId); c.start = it.start; c.offset = it.offset || 0; c.dur = Math.max(0.1, Math.min(it.dur, ab ? ab.dur - c.offset : it.dur));
    }
    function removeOverlay(it) {
      const p = S.project; if (it.audioClip) p.clips = p.clips.filter((c) => c.id !== it.audioClip);
      p.overlays = p.overlays.filter((x) => x.id !== it.id); if (S.ov === it.id) S.ov = null;
    }

    async function importStrip(list) {
      const p = S.project, empty = p.shots.length === 1 && !p.shots[0].layers.length && !p.shots[0].webtoon && !p.shots[0].page;
      MC.toast(t('Montando la tira…', 'Building the strip…')); await new Promise((r) => setTimeout(r, 30));
      try {
        let asset, shrunk = false;
        if (list.length === 1) asset = await MC.assets.add(list[0], list[0].name);
        else { const st2 = await MC.stackImages(list); shrunk = st2.shrunk; asset = await MC.assets.add(st2.blob, t('Tira', 'Strip') + ' ' + list.length + '.png'); }
        const sh = MC.webtoonShot(p, asset, t('Tira ', 'Strip ') + (empty ? 1 : p.shots.length + 1));
        sh.webtoon.stops = MC.suggestStops(asset);
        if (!empty) sh.transition = { type: 'fade', dur: 0.6 };
        const first = empty ? 0 : p.shots.length;
        if (empty) p.shots[0] = sh; else p.shots.push(sh);
        S.view = 'strip'; S.sp = null; commit(); selectShot(first, true); fit(); checkMemory();
        MC.toast(t('Tira lista' + (sh.webtoon.stops.length ? ' con ' + sh.webtoon.stops.length + ' pausas sugeridas' : '') + (shrunk ? ' (se redujo para caber en memoria)' : '') + '. Ajusta las pausas en la vista «Tira».', 'Strip ready' + (sh.webtoon.stops.length ? ' with ' + sh.webtoon.stops.length + ' suggested pauses' : '') + (shrunk ? ' (reduced to fit in memory)' : '') + '. Adjust the pauses in the “Strip” view.'));
      } catch (e) { console.error(e); MC.toast(t('No se pudo leer esa imagen.', 'Could not read that image.')); }
    }
    async function importPages(list) {
      const p = S.project, style = MC.myStyle.get() || MC.myStyle.DEFAULT, empty = p.shots.length === 1 && !p.shots[0].layers.length && !p.shots[0].page;
      MC.toast(t('Detectando viñetas…', 'Detecting panels…')); await new Promise((r) => setTimeout(r, 30));
      let panels = 0, first = empty ? 0 : p.shots.length;
      try {
        for (let i = 0; i < list.length; i++) {
          const a = await MC.assets.add(list[i], list[i].name), sh = MC.pageShot(p, a, p.dir || 'ltr', t('Página ', 'Page ') + (first + i + 1));
          Object.assign(sh.page, { mode: style.mode, travel: style.travel, dim: style.dim });
          if (first + i > 0) sh.transition = { type: style.transition.type, dur: style.transition.dur };
          if (empty && i === 0) p.shots[0] = sh; else p.shots.push(sh);
          panels += sh.page.panels.length;
        }
      } catch (e) { MC.toast(t('No se pudo leer esa imagen.', 'Could not read that image.')); }
      S.view = 'page'; S.pn = null; commit(); selectShot(first, true); fit(); checkMemory();
      MC.toast(t(list.length + ' página(s) · ' + panels + ' viñeta(s) detectadas. Revisa el orden en la vista «Página».', list.length + ' page(s) · ' + panels + ' panel(s) detected. Check the order in the “Page” view.'));
    }
    async function importPsd(file) {
      MC.toast(t('Leyendo el PSD…', 'Reading the PSD…'));
      try {
        const r = await MC.importPsd(file), sh = shot(), warns = r.warnings.slice();
        const [pw, ph] = [r.doc.w, r.doc.h];
        if (Math.abs(pw / ph - opts().W / opts().H) > 0.06) warns.push(t('El PSD mide ' + pw + '×' + ph + ' y el proyecto es ' + S.project.ratio + ': se recorta para cubrir el encuadre. Puedes cambiar la proporción en «Formato».', 'The PSD is ' + pw + '×' + ph + ' and the project is ' + S.project.ratio + ': it is cropped to cover the frame. You can change the ratio in “Format”.'));
        const startAt = (!sh.layers.length ? MC.shotStarts(S.project)[S.si] : MC.shotStarts(S.project)[S.si] + sh.duration);
        if (!sh.layers.length) { sh.layers = r.shot.layers; sh.name = r.shot.name; S.li = -1; }
        else { S.project.shots.splice(S.si + 1, 0, r.shot); }
        (r.texts || []).forEach((q) => { const it = MC.newText('box', Math.round(startAt * 100) / 100, S.project); it.t[S.project.lang || 'es'] = q.text; Object.assign(it, { x: q.x, y: q.y, w: q.w, size: q.size, color: q.color, fill: 'rgba(255,255,255,0)', stroke: 'rgba(0,0,0,0)', align: 'center', anim: 'pop', dur: Math.min(4, (shot() ? r.shot.duration : 4)) }); S.project.texts.push(it); });
        if (!sh.layers.length || sh.layers === r.shot.layers) commit(); else { commit(); selectShot(S.si + 1, true); }
        MC.modal(t('PSD importado', 'PSD imported'), h('div', { style: { display: 'grid', gap: '10px' } },
          h('p', null, t(r.count + ' capas con su nombre y orden. Las capas que reconocemos (fondo, cielo, personaje, texto…) ya tienen su profundidad; revisa el resto.', r.count + ' layers with their names and order. Recognised layers (background, sky, character, text…) already have their depth; check the rest.')),
          warns.length ? h('ul', { class: 'cap', style: { margin: 0, paddingLeft: '18px', display: 'grid', gap: '4px' } }, warns.map((w) => h('li', null, w))) : h('p', { class: 'cap good' }, t('Sin avisos.', 'No warnings.'))),
          (c) => [h('button', { class: 'btn btn-p', type: 'button', onClick: c }, t('Entendido', 'Got it'))]);
      } catch (e) { console.error(e); MC.toast(t('No se pudo leer ese PSD.', 'Could not read that PSD.')); }
    }
    async function importAudio(files, track) {
      for (const f of files) {
        try {
          const a = await MC.audio.add(f, f.name), c = MC.audio.newClip(track === 'auto' ? (a.dur >= 20 ? 'musica' : 'sfx') : track, a, S.time);
          S.project.clips.push(c); S.cl = c.id;
        } catch (e) { MC.toast(t('No se pudo leer ese audio.', 'Could not read that audio.')); }
      }
      commit();
    }
    const clipById = (id) => S.project.clips.find((c) => c.id === id);
    /* elemento con fotogramas clave seleccionado (capa u superposición) y su tiempo local */
    const kfTarget = () => {
      const sel = S.selKind;
      if (sel === 'overlay' && S.ov && ovById(S.ov)) { const it = ovById(S.ov); return { it, start: it.start, dur: it.dur, kind: 'overlay' }; }
      if (sel === 'layer' && layer()) { const sh = shot(); return { it: layer(), start: MC.shotStarts(S.project)[S.si], dur: sh.duration, kind: 'layer' }; }
      return null;
    };
    const subById = (id) => (S.project.subs || []).find((x) => x.id === id);
    const ovById = (id) => (S.project.overlays || []).find((o) => o.id === id);
    function splitClip() {
      const c = clipById(S.cl); if (!c) return;
      if (S.time <= c.start + 0.05 || S.time >= c.start + c.dur - 0.05) { MC.toast(t('Coloca el cabezal dentro del clip para dividirlo.', 'Place the playhead inside the clip to split it.')); return; }
      const b = Object.assign({}, c, { id: MC.uid(), start: S.time, offset: c.offset + (S.time - c.start), dur: c.start + c.dur - S.time, fadeIn: 0 });
      c.dur = S.time - c.start; c.fadeOut = 0;
      S.project.clips.push(b); S.cl = b.id; commit();
    }
    async function recordVoice() {
      let rec;
      try { rec = await MC.audio.record(); } catch (e) { MC.toast(t('Aquí no se puede usar el micrófono. Importa un archivo de audio.', 'The microphone is not available here. Import an audio file.')); return; }
      const num = h('div', { style: { fontSize: '56px', fontWeight: 700, textAlign: 'center', letterSpacing: '-0.03em' } }, '3'), msg = h('p', { class: 'cap', style: { textAlign: 'center' } }, t('Se reproduce la imagen mientras grabas.', 'The picture plays while you record.'));
      let state = 'count', startT = S.time, timer = 0;
      const m = MC.modal(t('Grabar locución', 'Record voice-over'), h('div', { style: { display: 'grid', gap: '8px' } }, num, msg), (close) => {
        const stop = h('button', { class: 'btn btn-p', type: 'button', disabled: true }, t('Parar', 'Stop'));
        stop.addEventListener('click', async () => {
          clearInterval(timer); togglePlay(false); stop.disabled = true;
          try {
            const a = await MC.audio.add(await rec.stop(), t('Locución ', 'Voice ') + (S.project.clips.filter((c) => c.track === 'voz').length + 1) + '.webm');
            const c = MC.audio.newClip('voz', a, startT); S.project.clips.push(c); S.cl = c.id; commit();
          } catch (e) { MC.toast(t('No se pudo guardar la toma.', 'Could not save the take.')); }
          close();
        });
        let n = 3;
        timer = setInterval(() => {
          if (state === 'count') {
            n--;
            if (n > 0) num.textContent = String(n);
            else { state = 'rec'; startT = S.time; rec.start(); togglePlay(true); MC.audio.stop(); stop.disabled = false; num.textContent = t('Grabando', 'Recording'); num.style.color = 'var(--bad)'; }
          }
        }, 1000);
        return [h('button', { class: 'btn btn-g', type: 'button', onClick: () => { clearInterval(timer); togglePlay(false); if (state === 'rec') rec.stop(); else rec.cancel(); close(); } }, t('Cancelar', 'Cancel')), stop];
      });
      return m;
    }
    function openLibrary() {
      let cur = null;
      const stopPrev = () => { if (cur) { try { cur.stop(); } catch (e) { /* parado */ } cur = null; } };
      const rows = MC.audio.LIBRARY.map((it) => h('div', { class: 'layer', style: { cursor: 'default' } },
        h('span', { class: 'ln' }, t(it.es, it.en)), h('span', { class: 'lz' }, it.dur.toFixed(1) + ' s'),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: async () => { stopPrev(); cur = await MC.audio.preview(await MC.audio.renderLibrary(it)); } }, MC.icon('play', 12), t('Oír', 'Play')),
        h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: async (e) => {
          const btn = e.currentTarget; btn.disabled = true;
          const buf = await MC.audio.renderLibrary(it), a = await MC.audio.add(MC.audio.wav(buf), t(it.es, it.en) + '.wav'), c = MC.audio.newClip(it.kind === 'music' ? 'musica' : 'sfx', a, S.time);
          S.project.clips.push(c); S.cl = c.id; commit(); MC.toast(t('Añadido en el cabezal', 'Added at the playhead')); btn.disabled = false;
        } }, MC.icon('plus', 12), t('Añadir', 'Add'))));
      MC.modal(t('Sonidos', 'Sounds'), h('div', { style: { display: 'grid', gap: '10px' } }, h('p', { class: 'cap' }, t('Efectos y música ambiente generados por código, sin licencias. Se añaden donde está el cabezal.', 'Effects and ambient music generated by code, no licences. They are added at the playhead.')), h('div', { style: { display: 'grid', gap: '2px' } }, rows)),
        (c) => [h('button', { class: 'btn btn-s', type: 'button', onClick: () => { stopPrev(); c(); } }, t('Cerrar', 'Close'))]);
    }
    function addText(kind) {
      if (kind === 'sub') { newSubLayer(false); return; }
      const p = S.project, it = MC.newText(kind, Math.round(S.time * 100) / 100, p);
      const vc = p.clips.find((c) => c.track === 'voz' && S.time >= c.start && S.time < c.start + c.dur - 0.05);
      if (vc && kind !== 'sfx') { it.link = vc.id; MC.toast(t('Vinculado a la locución: aparece y se va con la voz.', 'Linked to the voice-over: it appears and leaves with the voice.')); }
      if (kind === 'bubble' || kind === 'sfx') { const n = p.texts.filter((x) => { const sp = MC.textSpan(x, p); return S.time >= sp.start && S.time < sp.start + sp.dur; }).length; it.x += (n % 3) * 0.12 * (n % 2 ? -1 : 1); it.y += (n % 3) * 0.08; }
      p.texts.push(it); S.tx = it.id; S.li = -1; S.cl = null; S.open.texto = true; commit();
    }
    async function addLibrarySound(item, start) {
      const buf = await MC.audio.renderLibrary(item), a = await MC.audio.add(MC.audio.wav(buf), t(item.es, item.en) + '.wav'), c = MC.audio.newClip(item.kind === 'music' ? 'musica' : 'sfx', a, start);
      S.project.clips.push(c); return c;
    }
    const exportApi = (host) => ({ host, project: S.project, time: () => S.time, shotIndex: () => S.si, applyFormat: (r, res) => { S.project.ratio = r; S.project.res = res; fit(); commit(); renderTop(); } });

    /* ---------- calidad y huecos ---------- */
    function quality(l) {
      const img = MC.assets.get(l.assetId); if (!img) return null;
      const o = opts({ overscan: S.project.overscan !== false });
      const s = MC.effScale(l, img, shot(), o);
      const zl = Math.max.apply(null, MC.coverNeeds(l, img, shot(), o).map((n) => n.zl));
      const eff = s * zl;
      return { img, eff, need: Math.ceil(img.w * eff), level: eff <= 1.02 ? 0 : eff <= 1.3 ? 1 : 2, o };
    }
    function holeInfo() {
      const sh = shot(), o = opts({ overscan: false });
      let ratio = 1, any = false;
      sh.layers.forEach((l) => {
        const img = MC.assets.get(l.assetId);
        if (!img || l.role !== 'fondo' || l.visible === false) return;
        any = true;
        ratio = Math.max(ratio, MC.coverScale(l, img, sh, o) / MC.layerBox(l, img, o).base);
      });
      return { any, ratio, margin: MC.safeMargin(sh, o) };
    }

    /* ---------- barra superior ---------- */
    /* ---------- espacios de trabajo ---------- */
    const WS = {
      montaje: { icon: 'film', es: 'Montaje', en: 'Edit', tl: 'big', tabs: ['planos', 'vinetas', 'transiciones', 'recursos', 'biblioteca', 'proyecto', 'aspecto', 'estilo'] },
      camara: { icon: 'camera', es: 'Cámara', en: 'Camera', tl: 'strip', tabs: ['planos', 'camara'] },
      capas: { icon: 'layersx', es: 'Capas y profundidad', en: 'Layers and depth', tl: 'strip', tabs: ['recursos', 'biblioteca', 'rack', 'aspecto'] },
      creativo: { icon: 'sparkle', es: 'Texto, FX y audio', en: 'Text, FX and audio', tl: 'big', tabs: ['texto', 'subtitulos', 'efectos', 'sonidos', 'mezclador', 'idiomas'] },
      exportar: { icon: 'export', es: 'Exportar', en: 'Export', tl: 'none', tabs: [] },
    };
    const TABS = { planos: ['film'], subtitulos: ['mic', 'Subtítulos', 'Subtitles'], biblioteca: ['bookmark', 'Biblioteca', 'Library'], vinetas: ['page', 'Viñetas', 'Panels'], transiciones: ['cut', 'Transiciones', 'Transitions'], recursos: ['folder', 'Recursos', 'Assets'], proyecto: ['sliders', 'Proyecto', 'Project'], aspecto: ['sun', 'Aspecto', 'Look'], estilo: ['star', 'Estilo', 'Style'], camara: ['camera', 'Cámara', 'Camera'], rack: ['frame', 'Rack focus', 'Rack focus'],
      texto: ['text', 'Texto', 'Text'], efectos: ['sparkle', 'Efectos', 'Effects'], sonidos: ['note', 'Sonidos', 'Sounds'], mezclador: ['mixer', 'Mezclador', 'Mixer'], idiomas: ['globe', 'Idiomas', 'Languages'] };
    const tabLabel = (id) => (id === 'planos' ? (S.project.mode === 'page' ? t('Páginas', 'Pages') : S.project.mode === 'webtoon' ? t('Tiras', 'Strips') : t('Planos', 'Shots')) : t(TABS[id][1], TABS[id][2]));
    const curTab = () => { const tabs = WS[S.ws].tabs; if (!tabs.length) return null; if (!tabs.includes(S.tab[S.ws])) S.tab[S.ws] = tabs[0]; return S.tab[S.ws]; };
    const editView = () => { const sh = shot(); return sh && sh.page ? 'page' : sh && sh.webtoon ? 'strip' : 'cam'; };
    function setWs(v) {
      if (S.ws === v || !WS[v]) return;
      S.ws = v; studio.dataset.ws = v; studio.dataset.tl = WS[v].tl;
      if (v === 'camara') S.view = editView(); else if (v === 'capas' && editView() === 'cam') S.view = 'depth'; else if (['cam', 'page', 'strip', 'depth'].includes(S.view)) S.view = 'out';
      if (v === 'exportar') { togglePlay(false); S.view = 'out'; if (!S.sim && opts().W / opts().H < 0.8) S.sim = 'tiktok'; buildExportPanel(); }
      S.fmtOpen = false; S.ovMenu = false; S.viewOpen = false; applyLayout();
      renderTop(); renderRail(); renderPanels(); renderVbar(); buildSim(); renderTimeline(); fit();
      [el.leftEl, el.rightEl].forEach((n) => { if (n) { n.classList.remove('wsfade'); void n.offsetWidth; n.classList.add('wsfade'); } });
      MC.announce(t(WS[v].es, WS[v].en));
    }
    const openExport = () => setWs('exportar');

    /* ---------- disposición ajustable ---------- */
    const LAYOUT_DEF = { left: null, right: null, tl: null, hl: false, hr: false, ht: false };
    const loadLayout = () => { try { return Object.assign({}, LAYOUT_DEF, JSON.parse(MC.store.get('layout', '{}')) || {}); } catch (e) { return Object.assign({}, LAYOUT_DEF); } };
    const LY = loadLayout();
    const saveLayout = () => MC.store.set('layout', JSON.stringify(LY));
    /* las medidas se guardan en píxeles de la interfaz (ya con la escala aplicada) */
    function applyLayout() {
      const st = studio.style, narrow = innerWidth <= 900;
      const set = (k, v) => (v == null ? st.removeProperty(k) : st.setProperty(k, v));
      if (narrow) { ['--left-w', '--right-w', '--tl-h'].forEach((k) => st.removeProperty(k)); studio.dataset.hl = studio.dataset.hr = studio.dataset.ht = '0'; return; }
      studio.dataset.hl = LY.hl ? '1' : '0'; studio.dataset.hr = LY.hr ? '1' : '0'; studio.dataset.ht = LY.ht ? '1' : '0';
      set('--left-w', LY.hl ? '0px' : LY.left ? LY.left + 'px' : null);
      set('--right-w', LY.hr ? '0px' : LY.right ? LY.right + 'px' : null);
      set('--tl-h', WS[S.ws].tl === 'none' ? null : LY.ht ? '46px' : LY.tl ? LY.tl + 'px' : null);
      S.dirty = true; if (el.canvas) requestAnimationFrame(() => fit());
    }
    const zf = (n) => (n.offsetWidth ? n.getBoundingClientRect().width / n.offsetWidth : 1) || 1;
    /* tirador para arrastrar el borde de un panel; doble clic lo oculta o lo restaura */
    function handle(kind, cls, label) {
      const hd = h('div', { class: 'pz pz-' + cls, role: 'separator', tabindex: '0', 'aria-label': label, 'aria-orientation': kind === 'tl' ? 'horizontal' : 'vertical',
        title: t('Arrastra para cambiar el tamaño · doble clic para ocultar', 'Drag to resize · double-click to hide'),
        onDblclick: () => toggleLayout(kind),
        onPointerdown: (e) => {
          if (e.button) return; e.preventDefault(); hd.setPointerCapture(e.pointerId); hd.classList.add('on');
          const f = zf(studio), x0 = e.clientX, y0 = e.clientY, size = kind === 'left' ? el.leftEl.offsetWidth : kind === 'right' ? el.rightEl.offsetWidth : timeline.offsetHeight;
          const move = (ev) => {
            const dx = (ev.clientX - x0) / f, dy = (ev.clientY - y0) / f, H = studio.offsetHeight;
            if (kind === 'left') { LY.left = clamp(Math.round(size + dx), 200, 620); LY.hl = false; }
            else if (kind === 'right') { LY.right = clamp(Math.round(size - dx), 220, 620); LY.hr = false; }
            else { LY.tl = clamp(Math.round(size - dy), 120, Math.round(H * 0.7)); LY.ht = false; }
            applyLayout();
          };
          const up = () => { hd.classList.remove('on'); hd.removeEventListener('pointermove', move); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up); saveLayout(); renderTop(); };
          hd.addEventListener('pointermove', move); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
        },
        onKeydown: (e) => {
          const st = e.shiftKey ? 40 : 10, k = e.key; let used = true;
          if (kind === 'left' && (k === 'ArrowLeft' || k === 'ArrowRight')) { LY.left = clamp((LY.left || el.leftEl.offsetWidth) + (k === 'ArrowRight' ? st : -st), 200, 620); LY.hl = false; }
          else if (kind === 'right' && (k === 'ArrowLeft' || k === 'ArrowRight')) { LY.right = clamp((LY.right || el.rightEl.offsetWidth) + (k === 'ArrowLeft' ? st : -st), 220, 620); LY.hr = false; }
          else if (kind === 'tl' && (k === 'ArrowUp' || k === 'ArrowDown')) { LY.tl = clamp((LY.tl || timeline.offsetHeight) + (k === 'ArrowUp' ? st : -st), 120, Math.round(studio.offsetHeight * 0.7)); LY.ht = false; }
          else if (k === 'Enter') toggleLayout(kind); else used = false;
          if (used) { e.preventDefault(); applyLayout(); saveLayout(); }
        } });
      return hd;
    }
    function toggleLayout(kind) {
      const k = { left: 'hl', right: 'hr', tl: 'ht' }[kind]; LY[k] = !LY[k]; applyLayout(); saveLayout(); renderTop();
      MC.announce(({ left: t('Panel izquierdo', 'Left panel'), right: t('Columna derecha', 'Right column'), tl: t('Línea de tiempo', 'Timeline') })[kind] + ': ' + (LY[k] ? t('oculto', 'hidden') : t('visible', 'visible')));
    }
    function resetLayout() { Object.assign(LY, LAYOUT_DEF); applyLayout(); saveLayout(); renderTop(); }
    const UI_SCALES = [['0.7', '70 %'], ['0.8', '80 %'], ['0.9', '90 %'], ['1', '100 %'], ['1.15', '115 %'], ['1.3', '130 %']];
    function setUiScale(v) { MC.store.set('uizoom', v); MC.applyPrefs(); S.dirty = true; renderTop(); requestAnimationFrame(() => { applyLayout(); fit(); }); }
    function renderViewMenu() {
      if (el.viewMenu) { el.viewMenu.remove(); el.viewMenu = null; }
      if (!S.viewOpen || !el.viewBtn) return;
      const z = MC.store.get('uizoom', '1'), cb = (key, kind, label) => h('label', null, h('input', { type: 'checkbox', checked: !LY[key], onChange: () => toggleLayout(kind) }), label);
      el.viewMenu = h('div', { class: 'tmenu vmenu', role: 'dialog', 'aria-label': t('Vista de la interfaz', 'Interface view'), onKeydown: (e) => { if (e.key === 'Escape') { S.viewOpen = false; renderViewMenu(); el.viewBtn.focus(); } } },
        h('div', { class: 'eyebrow', style: { padding: '6px 10px 2px' } }, t('Paneles', 'Panels')),
        cb('hl', 'left', t('Panel izquierdo', 'Left panel')), cb('hr', 'right', t('Columna derecha (capas y propiedades)', 'Right column (layers and properties)')), cb('ht', 'tl', t('Línea de tiempo', 'Timeline')),
        h('p', { class: 'cap', style: { padding: '2px 10px' } }, t('Arrastra los bordes de los paneles para cambiar su tamaño. Doble clic en un borde para ocultarlo.', 'Drag the panel edges to resize. Double-click an edge to hide it.')),
        h('div', { class: 'eyebrow', style: { padding: '8px 10px 2px' } }, t('Tamaño de la interfaz', 'Interface size')),
        h('div', { style: { padding: '2px 10px 6px' } }, MC.ui.seg(UI_SCALES.map((q) => ({ v: q[0], l: q[1] })), UI_SCALES.some((q) => q[0] === z) ? z : null, setUiScale, t('Tamaño de la interfaz', 'Interface size'))),
        h('button', { type: 'button', onClick: () => { resetLayout(); setUiScale('1'); } }, MC.icon('undo', 14), t('Restablecer disposición y tamaño', 'Reset layout and size')));
      el.viewBtn.parentNode.append(el.viewMenu);
    }

    /* ---------- barra superior ---------- */
    function renderTop() {
      const wsBtn = (v) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(S.ws === v), title: t(WS[v].es, WS[v].en), onClick: () => setWs(v) }, MC.icon(WS[v].icon, 18), h('span', null, t(WS[v].es, WS[v].en)));
      el.status = h('span', { class: 'status', 'aria-live': 'polite' });
      el.jobChip = h('button', { class: 'btn btn-s btn-sm', type: 'button', hidden: true, onClick: openExport });
      updateJobChip(MC.exportJob);
      el.undo = h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Deshacer (Ctrl+Z)', 'Undo (Ctrl+Z)'), 'aria-label': t('Deshacer', 'Undo'), onClick: undo }, MC.icon('undo'));
      el.redo = h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Rehacer (Ctrl+Mayús+Z)', 'Redo (Ctrl+Shift+Z)'), 'aria-label': t('Rehacer', 'Redo'), onClick: redo }, MC.icon('redo'));
      const sz = MC.parseRatio(S.project.ratio), rw = sz[0] >= sz[1] ? 16 : Math.round(16 * sz[0] / sz[1]), rh = sz[0] >= sz[1] ? Math.round(16 * sz[1] / sz[0]) : 16;
      el.fmt = h('button', { class: 'fmt', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': String(!!S.fmtOpen), title: t('Cambiar proporción y resolución', 'Change aspect ratio and resolution'), onClick: () => { S.fmtOpen = !S.fmtOpen; renderFmtPop(); el.fmt.setAttribute('aria-expanded', String(!!S.fmtOpen)); } },
        h('i', { style: { width: rw + 'px', height: rh + 'px' } }), S.project.ratio + ' · ' + S.project.res);
      MC.put(MC.clear(el.top),
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Volver a tus proyectos', 'Back to your projects'), 'aria-label': t('Volver a tus proyectos', 'Back to your projects'), onClick: close }, MC.icon('back')),
        MC.mark(24),
        h('input', { class: 'ttl', 'aria-label': t('Nombre del proyecto', 'Project name'), value: S.project.name, onChange: (e) => { S.project.name = e.target.value.trim() || S.project.name; commit(); } }),
        el.fmt,
        h('div', { class: 's-tabs', role: 'tablist', 'aria-label': t('Espacios de trabajo', 'Workspaces') }, Object.keys(WS).map(wsBtn)),
        el.jobChip, el.status, el.undo, el.redo,
        h('span', { class: 'vwrap' }, el.fileBtn = h('button', { class: 'btn btn-g btn-ic', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': String(!!S.fileOpen), title: t('Archivo: copia en archivo, versiones y biblioteca', 'File: file copy, versions and library'), 'aria-label': t('Menú de archivo', 'File menu'), onClick: () => { S.fileOpen = !S.fileOpen; S.viewOpen = false; renderTop(); } }, MC.icon('folder'))),
        h('span', { class: 'vwrap' }, el.viewBtn = h('button', { class: 'btn btn-g btn-ic', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': String(!!S.viewOpen), title: t('Vista: paneles y tamaño de la interfaz', 'View: panels and interface size'), 'aria-label': t('Vista de la interfaz', 'Interface view'), onClick: () => { S.viewOpen = !S.viewOpen; S.fileOpen = false; renderTop(); } }, MC.icon('sliders'))),
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Ayuda, atajos y tutoriales (?)', 'Help, shortcuts and tutorials (?)'), 'aria-label': t('Ayuda y atajos', 'Help and shortcuts'), onClick: () => MC.openHelp() }, h('b', { 'aria-hidden': 'true' }, '?')),
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Preferencias', 'Preferences'), 'aria-label': t('Preferencias', 'Preferences'), onClick: () => MC.openPrefs() }, MC.icon('gear')));
      setStatus(true); updateHistBtns(); renderFmtPop(); renderViewMenu(); renderFileMenu();
    }
    /* selector de formato: proporciones dibujadas a escala */
    function renderFmtPop() {
      if (el.fmtPop) { el.fmtPop.remove(); el.fmtPop = null; }
      if (!S.fmtOpen) return;
      const p = S.project, ratios = ['16:9', '9:16', '4:5', '3:4', '1:1', '2:1'], isPreset = ratios.includes(p.ratio), cur = MC.parseRatio(p.ratio);
      const apply = (r, res) => { if (r) p.ratio = r; if (res) p.res = res; commit(); fit(); renderTop(); };
      const sw = (r) => { const q = MC.parseRatio(r), w = q[0] >= q[1] ? 44 : Math.round(44 * q[0] / q[1]), hh = q[0] >= q[1] ? Math.round(44 * q[1] / q[0]) : 44; return h('button', { class: 'sw', type: 'button', 'aria-pressed': String(p.ratio === r), onClick: () => apply(r) }, h('i', { style: { width: w + 'px', height: hh + 'px' } }), r); };
      const size = MC.frameSize(p.ratio, p.res), idW = 'fw-' + MC.uid(), idH = 'fh-' + MC.uid();
      el.fmtPop = h('div', { class: 'fmtpop', role: 'dialog', 'aria-label': t('Formato del proyecto', 'Project format'), onKeydown: (e) => { if (e.key === 'Escape') { S.fmtOpen = false; renderFmtPop(); el.fmt.setAttribute('aria-expanded', 'false'); el.fmt.focus(); } } },
        h('div', { class: 'eyebrow' }, t('Proporción', 'Aspect ratio')), h('div', { class: 'sw-row' }, ratios.map(sw)),
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('span', { class: 'cap' }, t('Personalizada', 'Custom')),
          h('input', { class: 'input', id: idW, type: 'number', min: 1, max: 40, value: cur[0], 'aria-label': t('Ancho', 'Width'), style: { width: '70px' }, onChange: (e) => apply(Math.max(1, Math.round(+e.target.value || 1)) + ':' + cur[1]) }), h('span', null, ':'),
          h('input', { class: 'input', id: idH, type: 'number', min: 1, max: 40, value: cur[1], 'aria-label': t('Alto', 'Height'), style: { width: '70px' }, onChange: (e) => apply(cur[0] + ':' + Math.max(1, Math.round(+e.target.value || 1))) })),
        h('div', { class: 'eyebrow' }, t('Resolución de salida', 'Output resolution')), MC.ui.seg(Object.keys(MC.RES).map((r) => ({ v: r, l: r })), p.res, (v) => apply(null, v), t('Resolución', 'Resolution')),
        h('div', { class: 'calc' }, h('span', { class: 'big' }, size.w + ' × ' + size.h + ' px'), h('span', { class: 'cap' }, isPreset && MC.RATIO_HINT[p.ratio] ? t(MC.RATIO_HINT[p.ratio][0], MC.RATIO_HINT[p.ratio][1]) : t('El encuadre se reajusta solo: corrige a mano lo que haga falta.', 'The framing readjusts itself: fix by hand whatever needs it.'))));
      studio.append(el.fmtPop);
      const off = (e) => { if (el.fmtPop && !el.fmtPop.contains(e.target) && !el.fmt.contains(e.target)) { S.fmtOpen = false; renderFmtPop(); el.fmt.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', off, true); } };
      setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
    }
    function updateJobChip(job) {
      const c = el.jobChip; if (!c) return;
      c.hidden = !job || job.state === 'cancelled';
      if (c.hidden) return;
      c.textContent = job.state === 'running' ? t('Exportando ', 'Exporting ') + Math.round(job.progress * 100) + ' %' : job.state === 'done' ? t('Vídeo listo', 'Video ready') : t('Error al exportar', 'Export failed');
    }
    const offJobChip = MC.onExportJob(updateJobChip);
    async function close() { MC.studioApi = null; S.alive = false; togglePlay(false); await save(); try { await MC.versions.save(S.project, '', true); } catch (e) { /* sin versión */ } cleanup(); MC.app.render(); }

    /* ---------- capas ---------- */
    /* ---------- capas: como en Photoshop, arriba = más cerca y tapa lo de abajo ---------- */
    const MIME_ASSET = 'application/x-mc-asset', MIME_LAYER = 'application/x-mc-layer';
    const r2 = (v) => Math.round(v * 100) / 100;
    /* z (profundidad) entre dos vecinas de la lista, para que el orden y la profundidad coincidan */
    const zBetween = (list, idx) => { const lo = idx > 0 ? list[idx - 1].z : 0, hi = idx < list.length ? list[idx].z : 1; return clamp(r2(lo <= hi ? (lo + hi) / 2 : lo), 0.01, 0.99); };
    const evenZ = (sh) => { const n = sh.layers.length; sh.layers.forEach((l, i) => { l.z = n === 1 ? 0.5 : r2(0.04 + (0.92 * i) / (n - 1)); }); };
    function reorderLayer(sh, from, to) { /* to = posición final dentro de la lista nueva */
      const l = sh.layers.splice(from, 1)[0]; to = clamp(to, 0, sh.layers.length);
      const lo = to > 0 ? sh.layers[to - 1].z : 0, hi = to < sh.layers.length ? sh.layers[to].z : 1;
      sh.layers.splice(to, 0, l);
      if (lo > hi) evenZ(sh); else l.z = clamp(r2((lo + hi) / 2), 0, 1);
      return to;
    }
    /* si cambias la profundidad (z) de una capa, sube o baja en la lista hasta su sitio */
    function placeByZ(sh, l) { const others = sh.layers.filter((x) => x !== l), idx = others.filter((x) => x.z <= l.z).length; others.splice(idx, 0, l); sh.layers = others; return idx; }
    async function assetsToLayers(ids, idx) {
      const sh = shot(); if (!sh || sh.page || sh.webtoon) { MC.toast(t('Este plano se monta con su página: usa «Planos» para añadir páginas.', 'This shot is built from its page: use “Shots” to add pages.')); return; }
      let at = idx == null ? sh.layers.length : clamp(idx, 0, sh.layers.length), last = -1;
      for (const id of ids) {
        const a = await MC.assets.load(id); if (!a) continue;
        const L = MC.newLayer(a, { z: 0.5, role: '' }); L.z = sh.layers.length ? zBetween(sh.layers, at) : 0.1; if (!sh.layers.length) L.role = 'fondo'; if (a.video) L.vloop = true;
        sh.layers.splice(at, 0, L); last = at; at++;
      }
      if (last >= 0) { S.li = last; S.tx = null; S.ov = null; commit(); checkMemory(); }
    }
    /* ¿qué se ha soltado? recursos del proyecto o de la biblioteca, una capa que se reordena, o archivos del equipo */
    async function dropOnLayers(dt, idx) {
      const sh = shot(); if (!sh) return;
      const lay = dt.getData(MIME_LAYER);
      if (lay !== '' && lay != null && dt.types.includes(MIME_LAYER)) { const from = +lay, to0 = idx > from ? idx - 1 : idx; if (from !== to0 && sh.layers[from]) { S.li = reorderLayer(sh, from, to0); commit(); } return; }
      if (dt.types.includes(MIME_ASSET)) { try { const items = JSON.parse(dt.getData(MIME_ASSET)); const ids = items.filter((q) => q.kind !== 'audio').map((q) => q.id); if (ids.length) await assetsToLayers(ids, idx); } catch (e) { /* nada */ } return; }
      if (dt.files && dt.files.length) { const n0 = sh.layers.length, fs = await MC.collectDropped(dt); await importFiles(fs, 'layers'); const sh2 = shot(); if (sh2 === sh && sh.layers.length > n0 && idx < n0) { const blk = sh.layers.splice(n0, sh.layers.length - n0); sh.layers.splice(idx, 0, ...blk); blk.forEach((l, k) => { l.z = zBetween(sh.layers.slice(0, idx).concat(sh.layers.slice(idx + blk.length)), idx); }); S.li = idx + blk.length - 1; commit(); } }
    }
    /* selector: recursos del proyecto, de la biblioteca o del equipo */
    async function openAssetPicker(opts) {
      const p = S.project; await loadLib(false);
      const ids = new Set(); p.shots.forEach((sh) => sh.layers.forEach((l) => ids.add(l.assetId))); (p.overlays || []).forEach((o) => ids.add(o.assetId));
      const proj = [...ids].map((id) => MC.assets.get(id)).filter(Boolean), lib = (S.libItems || []).filter((x) => x.kind !== 'audio'), chosen = new Set();
      const btnAdd = h('button', { class: 'btn btn-p', type: 'button', disabled: true }, t('Añadir', 'Add'));
      const card = (id, thumb, name, meta) => { const b2 = h('button', { type: 'button', class: 'pickcard', 'aria-pressed': 'false', draggable: 'true', title: name, onClick: () => { if (chosen.has(id)) chosen.delete(id); else chosen.add(id); b2.setAttribute('aria-pressed', String(chosen.has(id))); btnAdd.disabled = !chosen.size; btnAdd.textContent = chosen.size ? t('Añadir ', 'Add ') + chosen.size : t('Añadir', 'Add'); } }, thumb ? h('img', { src: thumb, alt: '' }) : h('span', { class: 'ph0' }), h('b', null, name), h('small', null, meta || ''));
        b2.addEventListener('dragstart', (e) => { e.dataTransfer.setData(MIME_ASSET, JSON.stringify([{ id, kind: 'image' }])); }); return b2; };
      const body = h('div', { class: 'picker' },
        h('div', { class: 'eyebrow' }, t('En este proyecto · ', 'In this project · ') + proj.length), proj.length ? h('div', { class: 'pickgrid' }, proj.map((a) => card(a.id, a.thumb, a.name, a.video ? t('vídeo', 'video') : a.w + '×' + a.h))) : h('p', { class: 'cap' }, t('Aún no hay imágenes en el proyecto.', 'There are no images in the project yet.')),
        h('div', { class: 'eyebrow', style: { marginTop: '10px' } }, t('En la biblioteca · ', 'In the library · ') + lib.length), lib.length ? h('div', { class: 'pickgrid' }, lib.map((x) => card(x.id, x.thumb, x.name, x.kind === 'video' ? t('vídeo', 'video') : t('imagen', 'image')))) : h('p', { class: 'cap' }, t('La biblioteca está vacía.', 'The library is empty.')));
      MC.modal(opts.title || t('Elegir imágenes', 'Choose images'), body, (close) => [h('button', { class: 'btn btn-s', type: 'button', onClick: () => { close(); fileLayers.click(); } }, MC.icon('upload', 14), t('Desde el equipo…', 'From this device…')), h('button', { class: 'btn btn-g', type: 'button', onClick: close }, t('Cancelar', 'Cancel')),
        (() => { btnAdd.addEventListener('click', () => { const sel = [...chosen]; close(); opts.onPick(sel); }); return btnAdd; })()], { wide: true });
    }
    const BLENDS = [['', t('Normal', 'Normal')], ['multiply', t('Multiplicar', 'Multiply')], ['screen', t('Pantalla', 'Screen')], ['overlay', t('Superponer', 'Overlay')], ['soft-light', t('Luz suave', 'Soft light')], ['hard-light', t('Luz fuerte', 'Hard light')], ['lighten', t('Aclarar', 'Lighten')], ['darken', t('Oscurecer', 'Darken')], ['color-dodge', t('Sobreexponer color', 'Colour dodge')], ['color-burn', t('Subexponer color', 'Colour burn')], ['difference', t('Diferencia', 'Difference')], ['exclusion', t('Exclusión', 'Exclusion')]];
    function renderImpMenu() {
      if (el.impMenu) { el.impMenu.remove(); el.impMenu = null; }
      if (!S.impOpen || !el.impBtn) return;
      const item = (ic, label, fn) => h('button', { type: 'button', onClick: () => { S.impOpen = false; renderImpMenu(); fn(); } }, MC.icon(ic, 15), label);
      el.impMenu = h('div', { class: 'tmenu vmenu', role: 'menu', onKeydown: (e) => { if (e.key === 'Escape') { S.impOpen = false; renderImpMenu(); el.impBtn.focus(); } } },
        item('upload', t('Desde el equipo…', 'From this device…'), () => fileLayers.click()), item('image', t('Del proyecto o la biblioteca…', 'From the project or library…'), () => openAssetPicker({ onPick: (ids) => assetsToLayers(ids, S.li >= 0 ? S.li + 1 : null) })),
        item('plus', t('Capa de color liso', 'Solid colour layer'), addSolidLayer), item('folder', t('Carpeta o ZIP…', 'Folder or ZIP…'), () => document.querySelector('.leftpanel input[webkitdirectory]') ? document.querySelector('.leftpanel input[webkitdirectory]').click() : fileLayers.click()));
      el.impBtn.parentNode.append(el.impMenu);
    }
    async function addSolidLayer() {
      const sh = shot(); if (!sh || sh.page || sh.webtoon) return; const col = prompt(t('Color (por ejemplo #ffffff)', 'Colour (for example #ffffff)'), '#ffffff'); if (!col) return;
      const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, 64, 64);
      const blob = await new Promise((res) => c.toBlob(res, 'image/png')), a = await MC.assets.add(blob, t('Color ', 'Colour ') + col + '.png'); await assetsToLayers([a.id], S.li >= 0 ? S.li + 1 : null);
    }
    function renderLayers() {
      const b = el.layersBody, sh = shot(); MC.clear(b);
      if (!sh) return;
      const sel = sh.layers[S.li], free = !(sh.page || sh.webtoon);
      const ctlWrap = h('div', { class: 'ctlwrap' }); b.append(ctlWrap);
      const fillCtl = () => {
        MC.clear(ctlWrap); const sel = sh.layers[S.li];
        if (!(sel && free)) return;
        ctlWrap.append(h('div', { class: 'lctl' },
          h('select', { class: 'input', 'aria-label': t('Modo de mezcla', 'Blend mode'), onChange: (e) => { sel.blend = e.target.value; commit(); } }, BLENDS.map((q) => h('option', { value: q[0], selected: q[0] === (sel.blend || '') }, q[1]))),
          (() => { const v = h('span', null, Math.round((sel.opacity == null ? 1 : sel.opacity) * 100) + ' %'); return h('label', { class: 'lop' }, t('Opacidad', 'Opacity'), h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: sel.opacity == null ? 1 : sel.opacity, 'aria-label': t('Opacidad de la capa', 'Layer opacity'), onInput: (e) => { sel.opacity = +e.target.value; v.textContent = Math.round(sel.opacity * 100) + ' %'; S.dirty = true; touch(); }, onChange: commit }), v); })()));
        const tb = (ic, title, fn, dis) => h('button', { class: 'btn btn-g btn-ic', type: 'button', title, 'aria-label': title, disabled: !!dis, onClick: fn }, MC.icon(ic, 15));
        const n = sh.layers.length, mv = (to) => { S.li = reorderLayer(sh, S.li, to); commit(); };
        ctlWrap.append(h('div', { class: 'ltools' }, tb('up', t('Traer adelante', 'Bring forward'), () => mv(S.li + 1), S.li >= n - 1), tb('down', t('Enviar atrás', 'Send backward'), () => mv(S.li - 1), S.li <= 0),
          tb('tofront', t('Al frente de todo', 'Bring to front'), () => mv(n - 1), S.li >= n - 1), tb('toback', t('Al fondo de todo', 'Send to back'), () => mv(0), S.li <= 0),
          tb('copy', t('Duplicar capa (Ctrl+J)', 'Duplicate layer (Ctrl+J)'), dupLayer), tb('bookmark', t('Guardar en la biblioteca', 'Save to the library'), () => toLibrary(sel.assetId, sel.name)),
          tb('trash', t('Eliminar capa', 'Delete layer'), () => delLayer(S.li), sel.locked)));
      };
      fillCtl();
      if (!sh.layers.length) b.append(h('p', { class: 'cap', style: { padding: '8px' } }, free ? t('Este plano aún no tiene capas. Arrastra aquí imágenes o vídeos, o usa «Importar».', 'This shot has no layers yet. Drag images or videos here, or use “Import”.') : t('Este plano es una página: sus viñetas se editan en la vista «Página».', 'This shot is a page: edit its panels in the “Page” view.')));
      if (free && sh.layers.length) b.append(h('p', { class: 'cap lhint' }, t('Arriba = más cerca (tapa lo de abajo). Arrastra para ordenar.', 'Top = nearer (covers what is below). Drag to reorder.')));
      for (let i = sh.layers.length - 1; i >= 0; i--) {
        const l = sh.layers[i], a = MC.assets.get(l.assetId), idx = i;
        const nameEl = h('span', { class: 'ln', title: t('Doble clic para renombrar', 'Double-click to rename') }, l.name);
        const row = h('div', { class: 'layer lrow2' + (i === S.li ? ' on' : '') + (l.visible === false ? ' off' : '') + (l.locked ? ' lk' : ''), 'data-idx': idx, draggable: free ? 'true' : 'false', role: 'button', tabindex: '0', 'aria-label': l.name + ', ' + t('posición ', 'position ') + (sh.layers.length - i) + ' ' + t('de ', 'of ') + sh.layers.length,
          onClick: () => { if (S.li === idx && S.selKind === 'layer') return; S.li = idx; S.tx = null; S.ov = null; S.multi = []; S.dirty = true; b.querySelectorAll('.lrow2').forEach((n) => n.classList.toggle('on', +n.dataset.idx === idx)); fillCtl(); renderInspector(); renderTimeline(); },
          onKeydown: (e) => { if (e.key === 'Enter') e.currentTarget.click(); else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); S.li = reorderLayer(sh, idx, idx + (e.key === 'ArrowUp' ? 1 : -1)); commit(); setTimeout(() => { const n = el.layersBody.querySelector('.layer[data-idx="' + S.li + '"]'); if (n) n.focus(); }, 0); } } },
          h('span', { class: 'grip', 'aria-hidden': 'true' }, '⋮⋮'),
          h('button', { class: 'btn btn-g', type: 'button', title: t('Mostrar u ocultar', 'Show or hide'), 'aria-label': t('Mostrar u ocultar', 'Show or hide'), onClick: (e) => { e.stopPropagation(); l.visible = l.visible === false; commit(); } }, MC.icon(l.visible === false ? 'eyeoff' : 'eye', 16)),
          h('button', { class: 'btn btn-g lkb', type: 'button', 'aria-pressed': String(!!l.locked), title: l.locked ? t('Desbloquear', 'Unlock') : t('Bloquear (no se mueve en el visor)', 'Lock (does not move in the viewer)'), 'aria-label': t('Bloquear o desbloquear', 'Lock or unlock'), onClick: (e) => { e.stopPropagation(); l.locked = !l.locked; commit(); } }, MC.icon(l.locked ? 'lock' : 'unlock', 14)),
          a ? h('img', { class: 'lt', src: a.thumb, alt: '' }) : h('span', { class: 'lt' }), nameEl, h('span', { class: 'lz' }, 'z ' + l.z.toFixed(2)),
          h('span', { class: 'lacts' }, h('button', { class: 'btn btn-g', type: 'button', title: t('Duplicar', 'Duplicate'), 'aria-label': t('Duplicar capa', 'Duplicate layer'), onClick: (e) => { e.stopPropagation(); S.li = idx; dupLayer(); } }, MC.icon('copy', 14)),
            h('button', { class: 'btn btn-g', type: 'button', title: t('Eliminar', 'Delete'), 'aria-label': t('Eliminar capa', 'Delete layer'), disabled: !!l.locked, onClick: (e) => { e.stopPropagation(); delLayer(idx); } }, MC.icon('trash', 14))));
        row.addEventListener('dragstart', (e) => { e.dataTransfer.setData(MIME_LAYER, String(idx)); e.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging'); });
        row.addEventListener('dragend', () => { row.classList.remove('dragging'); b.querySelectorAll('.ins').forEach((n) => n.classList.remove('ins')); });
        b.append(row);
      }
      /* soltar: se calcula entre qué capas cae */
      const slot = (e) => { const rows = [...b.querySelectorAll('.lrow2')]; for (const r of rows) { const q = r.getBoundingClientRect(); if (e.clientY < q.top + q.height / 2) return { idx: +r.dataset.idx + 1, row: r, above: true }; } return { idx: 0, row: rows[rows.length - 1] || null, above: false }; };
      b.ondblclick = (e) => {
        const ln = e.target.closest && e.target.closest('.lrow2 .ln'); if (!ln) return; const l = sh.layers[+ln.closest('.lrow2').dataset.idx]; if (!l) return;
        let fin = false; const inp = h('input', { class: 'input', value: l.name, 'aria-label': t('Nombre de la capa', 'Layer name') }), done = (ok) => { if (fin) return; fin = true; if (ok && inp.value.trim()) l.name = inp.value.trim(); commit(); };
        inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') done(true); else if (ev.key === 'Escape') done(false); ev.stopPropagation(); }); inp.addEventListener('blur', () => done(true)); inp.addEventListener('click', (ev) => ev.stopPropagation());
        ln.replaceWith(inp); inp.focus(); inp.select();
      };
      b.ondragover = (e) => { if (!free) return; const dt = e.dataTransfer, ok = dt.types.includes(MIME_LAYER) || dt.types.includes(MIME_ASSET) || dt.types.includes('Files'); if (!ok) return; e.preventDefault(); dt.dropEffect = dt.types.includes(MIME_LAYER) ? 'move' : 'copy'; b.querySelectorAll('.ins, .insb').forEach((n) => n.classList.remove('ins', 'insb')); const sl = slot(e); if (sl.row) sl.row.classList.add(sl.above ? 'ins' : 'insb'); b.classList.add('dropping'); };
      b.ondragleave = (e) => { if (e.target === b) { b.classList.remove('dropping'); b.querySelectorAll('.ins, .insb').forEach((n) => n.classList.remove('ins', 'insb')); } };
      b.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); const sl = slot(e); b.classList.remove('dropping'); b.querySelectorAll('.ins, .insb').forEach((n) => n.classList.remove('ins', 'insb')); dropOnLayers(e.dataTransfer, sl.idx); };
      const ovs = S.project.overlays || [];
      if (ovs.length) {
        b.append(h('div', { class: 'eyebrow lgrp' }, t('Superposiciones · fijas sobre la ilustración', 'Overlays · fixed above the artwork')));
        ovs.slice().sort((x, y) => y.track - x.track).forEach((it) => {
          const a = MC.assets.get(it.assetId), tr = S.project.otracks[it.track] || {};
          b.append(h('div', { class: 'layer' + (it.id === S.ov ? ' on' : '') + (it.visible === false || tr.visible === false ? ' off' : ''), onClick: () => { S.ov = it.id; S.tx = null; S.cl = null; S.li = -1; if (S.time < it.start || S.time >= it.start + it.dur) setTime(it.start + Math.min(0.3, it.dur / 2)); S.dirty = true; renderLayers(); renderInspector(); renderTimeline(); } },
            h('button', { class: 'btn btn-g', type: 'button', title: t('Mostrar u ocultar', 'Show or hide'), 'aria-label': t('Mostrar u ocultar', 'Show or hide'), onClick: (e) => { e.stopPropagation(); it.visible = it.visible === false; commit(); } }, MC.icon(it.visible === false ? 'eyeoff' : 'eye', 16)),
            a ? h('img', { class: 'lt', src: a.thumb, alt: '' }) : h('span', { class: 'lt' }),
            h('span', { class: 'ln' }, (it.kind === 'video' ? '▶ ' : '') + it.name), h('span', { class: 'lz' }, tr.name || '')));
        });
      }
    }
    function dupLayer() { const sh = shot(), l = sh && sh.layers[S.li]; if (!l) return; const c = JSON.parse(JSON.stringify(l)); c.id = MC.uid(); c.name += ' 2'; const at = S.li + 1; sh.layers.splice(at, 0, c); c.z = zBetween(sh.layers, at); S.li = at; commit(); }
    function delLayer(i) { const sh = shot(), l = sh && sh.layers[i]; if (!l || l.locked) return; sh.layers.splice(i, 1); S.li = clamp(S.li >= i ? S.li - 1 : S.li, -1, sh.layers.length - 1); if (S.li < 0 && sh.layers.length) S.li = -1; commit(); }

    /* ---------- inspector ---------- */
    const secDom = (d) => { const open = S.open[d.id] !== false; return h('div', { class: 'sec', 'data-id': d.id, 'data-open': String(open) },
      h('button', { class: 'sh', type: 'button', 'aria-expanded': String(open), onClick: () => { S.open[d.id] = !open; renderPanels(); } }, h('span', { class: 'eyebrow' }, d.title), MC.icon(open ? 'up' : 'down', 14)),
      h('div', { class: 'sb' }, d.nodes)); };
    const boxDom = (d) => h('div', { class: 'box', 'data-id': d.id }, h('div', { class: 'eyebrow' }, d.title), d.nodes);
    const nameIn = (label, value, fn) => { const id = 'n-' + MC.uid(); return MC.ui.field(label, h('input', { class: 'input', id, value, onChange: (e) => fn(e.target.value.trim()) }), id); };

    /* ---------- transiciones ---------- */
    const reducedMotion = () => document.documentElement.getAttribute('data-motion') === 'reduce' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    let trAnim = 0;
    const trTiles = new Set();
    function trLoop() {
      if (trAnim) return;
      const step = (ts) => {
        let alive = 0;
        trTiles.forEach((c) => { if (!c.isConnected) { trTiles.delete(c); return; } alive++; if (c._still && !c._hover) return; const ph = ((ts / 1400) + (c._ofs || 0)) % 1.4; MC.trPreview(c, c._tr, clamp(ph - 0.2, 0, 1)); });
        trAnim = alive ? requestAnimationFrame(step) : 0;
      };
      trAnim = requestAnimationFrame(step);
    }
    function trTile(tr, selected, onPick, still) {
      const c = h('canvas', { width: 112, height: 70, 'aria-hidden': 'true' });
      c._tr = tr; c._still = still || reducedMotion(); c._ofs = (MC.TRANSITIONS.findIndex((x) => x.v === tr.type) % 5) * 0.13;
      MC.trPreview(c, tr, 0.5);
      if (!reducedMotion()) { trTiles.add(c); trLoop(); }
      const info = MC.trInfo(tr.type);
      return h('button', { type: 'button', class: 'trtile', 'aria-pressed': String(!!selected), title: t(info.es, info.en), onClick: onPick, onPointerenter: () => { c._hover = true; }, onPointerleave: () => { c._hover = false; MC.trPreview(c, tr, 0.5); } }, c, h('span', null, t(info.es, info.en)));
    }
    function previewTransition() {
      const st = MC.shotStarts(S.project)[S.si];
      setTime(Math.max(0, st - 0.6)); togglePlay(true);
      const stopAt = st + Math.min(shot().transition.dur || 0.6, shot().duration * 0.9) + 0.6;
      const iv = setInterval(() => { if (!S.playing || S.time >= stopAt) { clearInterval(iv); if (S.playing) togglePlay(false); } }, 50);
    }
    function transEditor(sh, withCatalog) {
      const tr = sh.transition, info = MC.trInfo(tr.type), p = S.project;
      const setT = (k, v, hard) => { tr[k] = v; if (hard) commit(); else { layoutClips(); touch(); } };
      const pickType = (v) => { const ni = MC.trInfo(v); tr.type = v; if (!ni.color) delete tr.color; if (!(tr.dur > 0)) tr.dur = 0.6; commit(); };
      const nodes = [];
      if (!withCatalog) {
        nodes.push(MC.TRANSITION_GROUPS.map((g) => h('div', { class: 'field' }, h('span', { class: 'cap' }, t(g.es, g.en)),
          MC.ui.chips(MC.TRANSITIONS.filter((x) => x.g === g.v).map((x) => ({ v: x.v, l: t(x.es, x.en) })), tr.type, pickType))));
      }
      if (tr.type !== 'cut') {
        nodes.push(MC.ui.slider({ label: t('Duración', 'Length'), min: 0.2, max: 3, step: 0.05, value: tr.dur, fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => setT('dur', v), onChange: commit }));
        if (info.dir) nodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Dirección', 'Direction')), MC.ui.seg(MC.TR_DIRS, tr.dir || 'l', (v) => setT('dir', v, true), t('Dirección', 'Direction'))));
        nodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Curva', 'Easing')), MC.ui.chips(MC.TR_EASES.map((x) => ({ v: x.v, l: t(x.es, x.en) })), tr.ease || 'smooth', (v) => setT('ease', v, true))));
        if (info.color || info.gap) {
          const def = info.color || (MC.frameOf(p, sh) || { bg: '#ffffff' }).bg, id = 'tc-' + MC.uid();
          nodes.push(h('div', { class: 'field' }, h('label', { for: id }, info.gap ? t('Color de la calle', 'Gutter colour') : t('Color', 'Colour')), h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
            h('input', { type: 'color', id, class: 'input', style: { padding: '2px', height: '34px', width: '90px' }, value: tr.color || def, onInput: (e) => setT('color', e.target.value), onChange: commit }),
            h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => setT('color', '#ffffff', true) }, t('Blanco', 'White')), h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => setT('color', '#000000', true) }, t('Negro', 'Black')),
            tr.color ? h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => { delete tr.color; commit(); } }, info.gap ? t('Usar la de la viñeta', 'Use the panel’s') : t('Por defecto', 'Default')) : null)));
        }
        if (info.gap) nodes.push(MC.ui.slider({ label: t('Distancia entre viñetas', 'Distance between panels'), min: 0, max: 0.3, step: 0.005, value: tr.gap == null ? (tr.type === 'pageview' ? 0.08 : tr.type === 'grid' ? 0.02 : 0.05) : tr.gap, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => setT('gap', v), onChange: commit }));
      }
      nodes.push(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: tr.type === 'cut', onClick: previewTransition }, MC.icon('play', 14), t('Ver la transición', 'Preview transition')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: p.shots.length < 3, onClick: () => { p.shots.forEach((x, i) => { if (i > 0 && x !== sh) x.transition = JSON.parse(JSON.stringify(tr)); }); commit(); MC.toast(t('Transición aplicada a todos los planos', 'Transition applied to every shot')); } }, t('Aplicar a todos', 'Apply to all'))));
      return nodes;
    }
    function transPanel() {
      const p = S.project, sh = shot(), can = S.si > 0;
      const cur = can ? sh.transition : null;
      const out = [h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, can ? t('Entrada del plano ', 'Entry of shot ') + (S.si + 1) + ' · ' + sh.name : t('Transiciones', 'Transitions')),
        h('p', { class: 'cap' }, can ? t('Elige cómo entra este plano. Pasa el ratón por encima para verlas moverse.', 'Choose how this shot comes in. Hover to see them move.') : t('El primer plano no tiene transición de entrada: selecciona otro plano en la línea de tiempo.', 'The first shot has no entry transition: pick another shot on the timeline.')),
        p.shots.length > 1 && !can ? h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => selectShot(1, true) }, t('Ir al plano 2', 'Go to shot 2')) : null)];
      MC.TRANSITION_GROUPS.forEach((g) => {
        out.push(h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t(g.es, g.en)), h('div', { class: 'trgrid' },
          MC.TRANSITIONS.filter((x) => x.g === g.v).map((x) => trTile({ type: x.v, dir: cur && cur.type === x.v ? cur.dir : 'l', color: cur && cur.type === x.v ? cur.color : undefined, gap: cur && cur.type === x.v ? cur.gap : undefined, ease: cur && cur.type === x.v ? cur.ease : undefined }, cur && cur.type === x.v, () => {
            if (!can) { MC.toast(t('Selecciona un plano a partir del segundo.', 'Select a shot from the second one on.')); return; }
            sh.transition.type = x.v; if (!x.color) delete sh.transition.color; commit(); renderPanels();
          })))));
      });
      if (can) out.splice(1, 0, h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Ajustes', 'Settings')), transEditor(sh, true)));
      return out;
    }

    function buildSections() {
      const sh = shot(), l = layer(), p = S.project;
      const sec = (id, title, nodes) => ({ id, title, nodes });

      /* plano */
      const planoNodes = [
        nameIn(t('Nombre del plano', 'Shot name'), sh.name, (v) => { if (v) { sh.name = v; commit(); } }),
        (() => { let rp = null, d0 = sh.duration; return MC.ui.slider({ label: t('Duración', 'Duration'), min: 0.5, max: 20, step: 0.1, value: sh.duration, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => { if (S.ripple && !rp) rp = rippleBegin(MC.shotStarts(p)[S.si] + d0); sh.duration = v; if (rp) rippleApply(rp, v - d0); layoutClips(); touch(); }, onChange: () => { rp = null; commit(); } }); })(),
      ];
      if (S.si > 0) { const ti = MC.trInfo(sh.transition.type); planoNodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Transición de entrada', 'Entry transition')), h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { S.open.transicion = true; renderPanels(); const n = el.inspBody.querySelector('[data-id="transicion"]'); if (n) n.scrollIntoView({ block: 'nearest' }); } }, MC.icon('cut', 14), t(ti.es, ti.en)))); }
      planoNodes.push(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const c = JSON.parse(JSON.stringify(sh)); c.id = MC.uid(); c.name += ' 2'; c.layers.forEach((x) => { x.id = MC.uid(); }); if (S.ripple) rippleApply(rippleBegin(MC.shotStarts(p)[S.si] + sh.duration), sh.duration); p.shots.splice(S.si + 1, 0, c); commit(); selectShot(S.si + 1, true); } }, MC.icon('copy', 14), t('Duplicar plano', 'Duplicate shot')),
        h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', disabled: p.shots.length < 2, onClick: () => { if (S.ripple) { const rp = rippleBegin(MC.shotStarts(p)[S.si] + sh.duration); rippleApply(rp, -sh.duration); } p.shots.splice(S.si, 1); S.si = clamp(S.si, 0, p.shots.length - 1); S.li = -1; S.time = clamp(S.time, 0, MC.totalTime(p) - 0.001); commit(); setTime(S.time); } }, MC.icon('trash', 14), t('Eliminar plano', 'Delete shot'))));

      /* cámara */
      const cam = sh.camera;
      const setKf = (k, v) => { cam[S.kf][k] = v; cam.preset = 'custom'; S.dirty = true; touch(); };
      const hi = holeInfo();
      const camNodes = [
        h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Movimiento', 'Movement')),
          (() => { const ch = MC.ui.chips(MC.CAM_PRESETS.map((x) => ({ v: x.v, l: t(x.es, x.en) })), cam.preset, (v) => { hoverStop(); MC.applyPreset(cam, v, cam.intensity); commit(); }); [...ch.children].forEach((b, i) => hoverable(b, 'cam', (sh) => { MC.applyPreset(sh.camera, MC.CAM_PRESETS[i].v, sh.camera.intensity); })); return ch; })()),
        MC.ui.slider({ label: t('Intensidad', 'Intensity'), min: 0.2, max: 2, step: 0.05, value: cam.intensity, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => { if (cam.preset !== 'custom') { MC.applyPreset(cam, cam.preset, v); } else cam.intensity = v; S.dirty = true; touch(); }, onChange: commit }),
        h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Curva de velocidad', 'Speed curve')),
          MC.ui.curveEditor(cam.curve, (v) => { cam.curve = v; if (cam.path) cam.path.curve = v; S.dirty = true; touch(); }, commit)),
      ];
      const autoCam = !!(sh.page || sh.webtoon);
      const presetBox = (kind, capture, apply, disabled, saveLabel) => {
        const list = MC.presets.of(kind), nameId = 'pn-' + MC.uid();
        return h('div', { class: 'field' }, h('span', { class: 'cap' }, kind === 'camera' ? t('Mis movimientos', 'My movements') : t('Mis efectos', 'My effects')),
          list.length ? h('div', { class: 'chips' }, list.map((q) => h('button', { type: 'button', class: 'chip-b', disabled, title: t('Aplicar «' + q.name + '»', 'Apply “' + q.name + '”'), onClick: () => apply(q) }, q.name))) : h('span', { class: 'cap' }, t('Aún no has guardado ninguno.', 'You have not saved any yet.')),
          h('div', { style: { display: 'flex', gap: '8px' } }, h('input', { class: 'input', id: nameId, placeholder: t('Nombre', 'Name'), 'aria-label': t('Nombre del preset', 'Preset name') }),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled, onClick: () => {
              const nm = document.getElementById(nameId).value.trim();
              if (!nm) { MC.toast(t('Ponle un nombre al preset.', 'Give the preset a name.')); return; }
              const d = capture(); if (!d) { MC.toast(t('No hay nada que guardar todavía.', 'There is nothing to save yet.')); return; }
              MC.presets.add(kind, nm, d); renderInspector(); MC.toast(t('Preset guardado: ', 'Preset saved: ') + nm);
            } }, saveLabel)));
      };
      if (autoCam) camNodes.length = 0;
      if (!autoCam) camNodes.push(presetBox('camera', () => MC.captureCamera(sh), (q) => { MC.applyCameraPreset(sh, q.data); commit(); MC.announce(t('Movimiento aplicado: ', 'Movement applied: ') + q.name); }, false, t('Guardar este movimiento', 'Save this movement')));
      if (S.adv && !autoCam) {
        const kf = cam[S.kf];
        camNodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Fotogramas clave', 'Keyframes')),
          MC.ui.seg([{ v: 'from', l: t('Inicio', 'Start') }, { v: 'to', l: t('Fin', 'End') }], S.kf, (v) => { S.kf = v; renderInspector(); renderVbar(); S.dirty = true; })),
          MC.ui.slider({ label: t('Posición X', 'Position X'), min: -0.5, max: 0.5, step: 0.005, value: kf.x, fmt: (v) => v.toFixed(3), onInput: (v) => setKf('x', v), onChange: commit }),
          MC.ui.slider({ label: t('Posición Y', 'Position Y'), min: -0.5, max: 0.5, step: 0.005, value: kf.y, fmt: (v) => v.toFixed(3), onInput: (v) => setKf('y', v), onChange: commit }),
          MC.ui.slider({ label: 'Zoom', min: 1, max: 4, step: 0.01, value: kf.zoom, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => setKf('zoom', v), onChange: commit }),
          MC.ui.slider({ label: t('Giro', 'Rotation'), min: -20, max: 20, step: 0.5, value: kf.rot || 0, fmt: (v) => v.toFixed(1) + '°', onInput: (v) => setKf('rot', v), onChange: commit }),
          MC.ui.slider({ label: t('Temblor', 'Shake'), min: 0, max: 3, step: 0.05, value: cam.shake || 0, fmt: (v) => v.toFixed(2), onInput: (v) => { cam.shake = v; cam.preset = 'custom'; S.dirty = true; touch(); }, onChange: commit }));
      }
      if (autoCam) camNodes.push(h('p', { class: 'cap' }, sh.page ? t('En un plano de página la cámara sigue las viñetas. Se ajusta en la sección «Página».', 'In a page shot the camera follows the panels. Adjust it in the “Page” section.') : t('En una tira la cámara hace scroll. Se ajusta en la sección «Tira».', 'In a strip the camera scrolls. Adjust it in the “Strip” section.')));
      else camNodes.push(h('p', { class: 'cap' }, t('Arrastra el marco en la vista «Cámara» para encuadrar a mano.', 'Drag the frame in the “Camera” view to frame by hand.')));
      if (hi.any && !autoCam) camNodes.push(h('p', { class: 'cap ' + (p.overscan !== false || hi.ratio <= 1.002 ? 'good' : 'bad') },
        p.overscan !== false ? (hi.ratio > 1.002 ? t('Sin huecos: el fondo se sobreescala ×', 'No gaps: the background is scaled ×') + hi.ratio.toFixed(2) : t('Sin huecos: el fondo cubre todo el movimiento.', 'No gaps: the background covers all movement.'))
          : (hi.ratio > 1.002 ? t('Hay huecos. Faltaría estirar el fondo ×', 'There are gaps. The background needs stretching ×') + hi.ratio.toFixed(2) : t('Margen seguro: ', 'Safe margin: ') + Math.round(Math.min(hi.margin.x, hi.margin.y) * 100) + ' %')));

      /* capa */
      let capaNodes;
      if (!l) capaNodes = [h('p', { class: 'cap' }, t('Selecciona una capa para ajustar su profundidad, desenfoque y encuadre.', 'Select a layer to adjust its depth, blur and framing.'))];
      else {
        const q = quality(l), set = (k, v) => { l[k] = v; touch(); };
        capaNodes = [
          nameIn(t('Nombre de la capa', 'Layer name'), l.name, (v) => { if (v) { l.name = v; commit(); } }),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Profundidad', 'Depth')),
            MC.ui.chips(DEPTHS.map((d) => ({ v: d.z, l: t(d.es, d.en), title: 'z ' + d.z })), DEPTHS.find((d) => Math.abs(d.z - l.z) < 0.001) ? l.z : null, (v) => { l.z = v; S.li = placeByZ(sh, l); commit(); }),
            h('span', { class: 'cap' }, t('Las capas cercanas se mueven más que las lejanas.', 'Near layers move more than far ones.'))),
          MC.ui.slider({ label: t('Profundidad (z)', 'Depth (z)'), min: 0, max: 1, step: 0.01, value: l.z, fmt: (v) => v.toFixed(2), onInput: (v) => set('z', v), onChange: () => { S.li = placeByZ(sh, l); commit(); } }),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: l.role === 'fondo', onChange: (e) => { l.role = e.target.checked ? 'fondo' : ''; commit(); } }),
            h('span', null, t('Es el fondo', 'This is the background'), h('small', null, t('Se sobreescala para no dejar huecos al mover la cámara.', 'Scaled up so no gaps show when the camera moves.')))),
          MC.ui.slider({ label: t('Desenfoque de profundidad', 'Depth blur'), min: 0, max: 30, step: 0.5, value: l.blur || 0, fmt: (v) => v.toFixed(1) + ' px', onInput: (v) => set('blur', v), onChange: commit }),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!l.over, disabled: !MC.frameOf(p, sh), onChange: (e) => { l.over = e.target.checked; if (l.over && l.role === 'fondo') l.role = ''; commit(); } }),
            h('span', null, t('Por encima del borde de la viñeta', 'Above the panel border'), h('small', null, MC.frameOf(p, sh) ? t('Rompe la viñeta: se dibuja sobre el trazo y la calle, como un personaje que se sale del recuadro.', 'Breaks the panel: drawn over the stroke and the gutter, like a character stepping out of the frame.') : t('Activa la viñeta del proyecto para usarlo.', 'Turn on the project panel to use it.')))),
        ];
        if (S.adv) capaNodes.push(
          MC.ui.slider({ label: t('Escala', 'Scale'), min: 0.5, max: 3, step: 0.01, value: l.scale || 1, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => set('scale', v), onChange: commit }),
          MC.ui.slider({ label: t('Posición X', 'Position X'), min: -0.5, max: 0.5, step: 0.005, value: l.x || 0, fmt: (v) => v.toFixed(3), onInput: (v) => set('x', v), onChange: commit }),
          MC.ui.slider({ label: t('Posición Y', 'Position Y'), min: -0.5, max: 0.5, step: 0.005, value: l.y || 0, fmt: (v) => v.toFixed(3), onInput: (v) => set('y', v), onChange: commit }),
          MC.ui.slider({ label: t('Opacidad', 'Opacity'), min: 0, max: 1, step: 0.01, value: l.opacity == null ? 1 : l.opacity, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => set('opacity', v), onChange: commit }));
        if (q) capaNodes.push(h('div', { class: 'calc' },
          h('span', { class: 'cap' }, t('Calidad de la imagen', 'Image quality')),
          h('span', null, q.img.w + ' × ' + q.img.h + ' px'),
          h('span', { class: q.level === 0 ? 'good' : q.level === 1 ? 'warn' : 'bad' }, q.level === 0 ? t('Nítida a ' + p.res, 'Sharp at ' + p.res)
            : t('Se amplía ×' + q.eff.toFixed(2) + ' en el vídeo. Para ' + p.res + ' necesita ' + q.need + ' px de ancho.', 'Enlarged ×' + q.eff.toFixed(2) + ' in the video. For ' + p.res + ' it needs ' + q.need + ' px wide.'))));
        if (l.role === 'fondo' && p.overscan === false) {
          const need = hi.ratio;
          if (need > 1.002) capaNodes.push(h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { l.scale = (l.scale || 1) * need * 1.003; commit(); } }, t('Tapar huecos estirando el fondo', 'Fill gaps by stretching the background')));
        }
      }

      /* proyecto */
      const st = { ratio: p.ratio, res: p.res, zoom: p.zoomPlan || 1.5 };
      const projNodes = [
        MC.formatPicker(st, () => { p.ratio = st.ratio; p.res = st.res; p.zoomPlan = st.zoom; fit(); commit(); }),
        h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Intensidad del parallax', 'Parallax intensity')),
          MC.ui.seg([{ v: 'subtle', l: t('Sutil', 'Subtle') }, { v: 'normal', l: 'Normal' }, { v: 'wild', l: t('Exagerado', 'Exaggerated') }], p.parallax, (v) => { p.parallax = v; commit(); })),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: p.overscan !== false, onChange: (e) => { p.overscan = e.target.checked; commit(); } }),
          h('span', null, t('Sobreescalado automático del fondo', 'Automatic background overscale'), h('small', null, t('Desactívalo para ver dónde aparecerían huecos con «Huecos» en el visor.', 'Turn it off to see where gaps would appear with “Gaps” in the viewer.')))),
      ];
      void 0;


      /* texto */
      const textSecs = [], tx = S.tx ? txById(S.tx) : null, lang = p.lang;
      const colorRow = (label, key, def) => { const id = 'c-' + MC.uid(); return h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { type: 'color', id, class: 'input', style: { padding: '2px', height: '34px' }, value: tx[key] || def, onInput: (e) => { tx[key] = e.target.value; touch(); }, onChange: commit })); };
      if (tx) {
        const isSub = tx.kind === 'sub', lib = MC.audio.LIBRARY.filter((x) => x.kind === 'sfx'), voz = p.clips.filter((c) => c.track === 'voz');
        const fonts = MC.FONTS.map((f) => ({ id: f.id, n: t(f.es, f.en) })).concat(p.fonts.map((f) => ({ id: f.id, n: f.name })));
        const taId = 'ta-' + MC.uid(), selFont = 'sf-' + MC.uid(), selLink = 'sl-' + MC.uid(), selSfx = 'ss-' + MC.uid();
        const nodes = [
          h('div', { class: 'field' }, h('label', { for: taId }, t('Texto', 'Text') + (p.langs.length > 1 ? ' · ' + lang.toUpperCase() : '')),
            h('textarea', { id: taId, class: 'input', rows: 3, value: tx.t[lang] == null ? '' : tx.t[lang], placeholder: tx.t[lang] == null && MC.textOf(tx, p) ? MC.textOf(tx, p) : t('Escribe aquí', 'Type here'), onInput: (e) => { tx.t[lang] = e.target.value; S.dirty = true; touch(); }, onChange: () => { commit(); } }),
            tx.t[lang] == null && p.langs.length > 1 ? h('span', { class: 'cap warn' }, t('Sin traducir: se muestra el texto de otro idioma.', 'Not translated: text from another language is shown.')) : null),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Tipo', 'Type')), MC.ui.seg([{ v: 'bubble', l: t('Bocadillo', 'Bubble') }, { v: 'box', l: t('Caja', 'Box') }, { v: 'sfx', l: t('Onomat.', 'SFX word') }, { v: 'sub', l: t('Subt.', 'Sub') }], tx.kind, (v) => { tx.kind = v; if (v === 'bubble' && !['speech', 'shout', 'thought'].includes(tx.shape)) tx.shape = 'speech'; commit(); })),
        ];
        if (tx.kind === 'bubble') nodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Forma', 'Shape')), MC.ui.chips([{ v: 'speech', l: t('Habla', 'Speech') }, { v: 'shout', l: t('Grito', 'Shout') }, { v: 'thought', l: t('Pensamiento', 'Thought') }], tx.shape, (v) => { tx.shape = v; commit(); }), h('span', { class: 'cap' }, t('Arrastra el punto violeta del visor para mover la cola.', 'Drag the violet dot in the viewer to move the tail.'))));
        if (!isSub) {
          nodes.push(
            h('div', { class: 'field' }, h('label', { for: selFont }, t('Tipografía', 'Font')), h('select', { id: selFont, class: 'input', onChange: (e) => { tx.font = e.target.value; commit(); } }, fonts.map((f) => h('option', { value: f.id, selected: f.id === tx.font }, f.n)))),
            MC.ui.slider({ label: t('Tamaño', 'Size'), min: 0.02, max: 0.3, step: 0.005, value: tx.size, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { tx.size = v; touch(); }, onChange: commit }),
            MC.ui.slider({ label: t('Ancho de la caja', 'Box width'), min: 0.15, max: 0.95, step: 0.01, value: tx.w, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { tx.w = v; touch(); }, onChange: commit }),
            h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' } }, colorRow(t('Texto', 'Text'), 'color', '#14141c'), tx.kind !== 'sfx' ? colorRow(t('Relleno', 'Fill'), 'fill', '#ffffff') : colorRow(t('Borde', 'Edge'), 'fill', '#ffffff'), colorRow(t('Contorno', 'Outline'), 'stroke', '#14141c')));
          if (tx.kind !== 'sfx') nodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Alineación', 'Alignment')), MC.ui.seg([{ v: 'left', l: t('Izq.', 'Left') }, { v: 'center', l: t('Centro', 'Center') }, { v: 'right', l: t('Der.', 'Right') }], tx.align, (v) => { tx.align = v; commit(); })));
          nodes.push(MC.ui.slider({ label: t('Giro', 'Rotation'), min: -30, max: 30, step: 0.5, value: tx.rot || 0, fmt: (v) => v.toFixed(1) + '°', onInput: (v) => { tx.rot = v; touch(); }, onChange: commit }));
        } else nodes.push(h('p', { class: 'cap' }, t('El estilo de los subtítulos se cambia en «Idiomas y subtítulos». Arrastra el subtítulo en el visor para subirlo o bajarlo.', 'Subtitle style is changed in “Languages and subtitles”. Drag the subtitle in the viewer to move it up or down.')));
        if (!isSub) {
          nodes.push(
            h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Revelado', 'Reveal')), MC.ui.seg([{ v: 'all', l: t('De golpe', 'At once') }, { v: 'words', l: t('Palabras', 'Words') }, { v: 'chars', l: t('Letras', 'Letters') }], tx.reveal, (v) => { tx.reveal = v; commit(); })),
            tx.reveal !== 'all' ? MC.ui.slider({ label: t('Velocidad', 'Speed'), min: 5, max: 90, step: 1, value: tx.speed, fmt: (v) => v + ' ' + t('letras/s', 'letters/s'), onInput: (v) => { tx.speed = v; touch(); }, onChange: commit }) : null,
            tx.reveal !== 'all' && tx.link ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!tx.fit, onChange: (e) => { tx.fit = e.target.checked; commit(); } }), h('span', null, t('Ajustar la velocidad a la locución', 'Fit speed to the voice-over'))) : null,
            h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Entrada', 'Entrance')), MC.ui.chips([{ v: 'none', l: t('Ninguna', 'None') }, { v: 'pop', l: 'Pop' }, { v: 'bounce', l: t('Rebote', 'Bounce') }, { v: 'shake', l: t('Golpe', 'Hit') }, { v: 'slide', l: t('Deslizar', 'Slide') }], tx.anim, (v) => { tx.anim = v; commit(); })),
            h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Movimiento continuo', 'Idle motion')), MC.ui.seg([{ v: 'none', l: t('Ninguno', 'None') }, { v: 'float', l: t('Flotar', 'Float') }, { v: 'pulse', l: t('Pulsar', 'Pulse') }], tx.loop || 'none', (v) => { tx.loop = v; commit(); })));
        }
        const sp = MC.textSpan(tx, p);
        nodes.push(
          h('div', { class: 'field' }, h('label', { for: selLink }, t('Sincronizar con la voz', 'Sync with voice')),
            h('select', { id: selLink, class: 'input', disabled: !voz.length, onChange: (e) => { tx.link = e.target.value || null; if (!tx.link) { tx.start = sp.start; tx.dur = sp.dur; } commit(); } },
              h('option', { value: '' }, voz.length ? t('Sin vincular', 'Not linked') : t('Añade una locución primero', 'Add a voice-over first')), voz.map((c) => h('option', { value: c.id, selected: c.id === tx.link }, c.name + ' · ' + MC.fmtTime(c.start)))),
            h('span', { class: 'cap' }, t('Vinculado: aparece cuando suena su línea y se va cuando termina.', 'Linked: it appears when its line plays and leaves when it ends.'))),
          tx.link ? null : MC.ui.slider({ label: t('Aparece en', 'Appears at'), min: 0, max: Math.max(1, MC.totalTime(p)), step: 0.05, value: clamp(tx.start, 0, Math.max(1, MC.totalTime(p))), fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { tx.start = v; layoutClips(); touch(); }, onChange: commit }),
          tx.link ? null : MC.ui.slider({ label: t('Dura', 'Lasts'), min: 0.2, max: 15, step: 0.05, value: clamp(tx.dur, 0.2, 15), fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { tx.dur = v; layoutClips(); touch(); }, onChange: commit }));
        if (tx.kind === 'sfx') nodes.push(h('div', { class: 'field' }, h('label', { for: selSfx }, t('Sonido de la onomatopeya', 'Sound for the word')),
          h('div', { style: { display: 'flex', gap: '8px' } }, h('select', { id: selSfx, class: 'input' }, lib.map((x) => h('option', { value: x.id }, t(x.es, x.en)))),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: async (e) => { const b2 = e.currentTarget; b2.disabled = true; const c = await addLibrarySound(lib.find((x) => x.id === document.getElementById(selSfx).value), MC.textSpan(tx, p).start); S.cl = c.id; S.tx = null; commit(); MC.toast(t('Sonido añadido en la pista SFX', 'Sound added to the SFX track')); } }, t('Añadir', 'Add')))));
        nodes.push(h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', style: { justifySelf: 'start' }, onClick: () => { p.texts = p.texts.filter((x) => x !== tx); S.tx = null; commit(); } }, MC.icon('trash', 14), t('Eliminar texto', 'Delete text')));
        textSecs.push(sec('texto', t('Texto', 'Text') + ' · ' + ({ bubble: t('bocadillo', 'bubble'), box: t('caja', 'box'), sfx: t('onomatopeya', 'sound word'), sub: t('subtítulo', 'subtitle') })[tx.kind], nodes));
      }
      const fontIn = h('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2', hidden: true, id: 'f-font', onChange: async (e) => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        try { const rec = await MC.fonts.add(f); p.fonts.push(rec); commit(); MC.toast(t('Tipografía añadida: ', 'Font added: ') + rec.name); } catch (err) { MC.toast(t('No se pudo leer esa tipografía.', 'Could not read that font.')); }
      } });
      const sub = p.sub, subFont = 'sf2-' + MC.uid();
      const idiomasSec = sec('idiomas', t('Idiomas y subtítulos', 'Languages and subtitles'), [
        h('button', { class: 'btn btn-p btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: openTranslations }, MC.icon('globe', 14), t('Tabla de traducción', 'Translation table')),
        h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Idiomas del proyecto', 'Project languages')),
          MC.ui.chips(MC.LANGS.map((l) => ({ v: l[0], l: l[1] })), null, (v) => {
            if (p.langs.includes(v)) { if (p.langs.length < 2) return; p.langs = p.langs.filter((x) => x !== v); if (p.lang === v) p.lang = p.langs[0]; } else { p.langs.push(v); p.lang = v; }
            commit();
          }), h('span', { class: 'cap' }, t('Activos: ', 'Active: ') + p.langs.map((x) => x.toUpperCase()).join(', ') + t('. Cada idioma tiene su propio texto y se exporta por separado.', '. Each language has its own text and exports separately.'))),
        h('div', { class: 'field' }, h('label', { for: subFont }, t('Tipografía de los subtítulos', 'Subtitle font')), h('select', { id: subFont, class: 'input', onChange: (e) => { sub.font = e.target.value; commit(); } }, MC.FONTS.map((f) => ({ id: f.id, n: t(f.es, f.en) })).concat(p.fonts.map((f) => ({ id: f.id, n: f.name }))).map((f) => h('option', { value: f.id, selected: f.id === sub.font }, f.n)))),
        MC.ui.slider({ label: t('Tamaño de los subtítulos', 'Subtitle size'), min: 0.025, max: 0.09, step: 0.0025, value: sub.size, fmt: (v) => (v * 100).toFixed(1) + ' %', onInput: (v) => { sub.size = v; touch(); }, onChange: commit }),
        MC.ui.slider({ label: t('Altura de los subtítulos', 'Subtitle position'), min: -0.3, max: 0.48, step: 0.01, value: MC.subY(p, opts().W, opts().H), fmt: (v) => (v >= 0 ? '↓ ' : '↑ ') + Math.abs(Math.round(v * 100)) + ' %', onInput: (v) => { sub.y = v; touch(); }, onChange: commit }),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: sub.bg !== false, onChange: (e) => { sub.bg = e.target.checked; commit(); } }), h('span', null, t('Fondo oscuro detrás del texto', 'Dark background behind the text'))),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !p.clips.some((c) => c.track === 'voz'), onClick: () => { const made = MC.subsFromVoice(p); p.texts.push(...made); if (made.length) { S.tx = made[0].id; S.open.texto = true; } commit(); MC.toast(t(made.length + ' subtítulos creados. Escribe el texto de cada uno.', made.length + ' subtitles created. Type the text of each one.')); } }, t('Crear subtítulos desde la locución', 'Create subtitles from the voice-over')),
        h('p', { class: 'cap' }, t('Crea un subtítulo por frase, con su tiempo. El texto lo escribes tú: no hay reconocimiento de voz, tu voz no sale del equipo.', 'Creates one subtitle per phrase, with its timing. You type the text: there is no speech recognition, your voice never leaves the device.')),
        h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Tipografías propias', 'Your own fonts')),
          p.fonts.length ? h('ul', { class: 'cap', style: { margin: 0, paddingLeft: '18px' } }, p.fonts.map((f) => h('li', null, f.name))) : null,
          h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => fontIn.click() }, MC.icon('plus', 14), t('Añadir TTF u OTF', 'Add TTF or OTF')), fontIn)]);


      /* página */
      const pageSecs = [];
      if (sh.page) {
        const pg = sh.page, selP = pg.panels.find((q) => q.id === S.pn);
        const edit = () => { pg.manual = true; };
        const rowsP = pg.panels.map((q, i) => h('div', { class: 'layer' + (q.id === S.pn ? ' on' : ''), onClick: () => { S.pn = q.id; if (S.view !== 'page') { S.view = 'page'; renderVbar(); fit(); } S.dirty = true; renderInspector(); } },
          h('span', { class: 'ln' }, t('Viñeta ', 'Panel ') + (i + 1)), h('span', { class: 'lz' }, MC.panelHold(q).toFixed(1) + ' s' + (q.hold == null ? '' : ' ✎')),
          h('button', { class: 'btn btn-g', type: 'button', title: t('Antes', 'Earlier'), 'aria-label': t('Subir en el orden', 'Move earlier'), disabled: i === 0, onClick: (e) => { e.stopPropagation(); pg.panels.splice(i - 1, 0, pg.panels.splice(i, 1)[0]); edit(); commit(); } }, MC.icon('up', 14)),
          h('button', { class: 'btn btn-g', type: 'button', title: t('Después', 'Later'), 'aria-label': t('Bajar en el orden', 'Move later'), disabled: i === pg.panels.length - 1, onClick: (e) => { e.stopPropagation(); pg.panels.splice(i + 1, 0, pg.panels.splice(i, 1)[0]); edit(); commit(); } }, MC.icon('down', 14))));
        const nodes = [
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Orden de lectura', 'Reading order')), MC.ui.seg([{ v: 'ltr', l: t('Occidental →', 'Western →') }, { v: 'rtl', l: t('Manga ←', 'Manga ←') }], pg.dir, (v) => {
            pg.dir = v; p.dir = v; const L = sh.layers.find((l) => l.page), img = MC.assets.get(L.assetId);
            if (!pg.manual && img) pg.panels = MC.detectPanels(img.bitmap, v); else pg.panels = MC.sortPanels(pg.panels, v);
            commit();
          })),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Cámara entre viñetas', 'Camera between panels')), MC.ui.seg([{ v: 'pan', l: t('Paneo suave', 'Smooth pan') }, { v: 'cut', l: t('Salto', 'Cut') }], pg.mode, (v) => { pg.mode = v; commit(); })),
          pg.mode === 'pan' ? MC.ui.slider({ label: t('Velocidad del paneo', 'Pan time'), min: 0.3, max: 2, step: 0.05, value: pg.travel, fmt: (v) => '×' + (v / 0.8).toFixed(2), onInput: (v) => { pg.travel = v; touch(); }, onChange: commit }) : null,
          MC.ui.slider({ label: t('Atenuación del resto de la página', 'Dimming outside the panel'), min: 0, max: 0.9, step: 0.01, value: pg.dim, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { pg.dim = v; touch(); S.dirty = true; }, onChange: commit }),
          MC.ui.slider({ label: t('Contorno de la viñeta activa', 'Active panel outline'), min: 0, max: 0.02, step: 0.0005, value: pg.outline || 0, fmt: (v) => (v > 0 ? (v * 1000).toFixed(1) + ' ‰' : t('sin contorno', 'none')), onInput: (v) => { pg.outline = v; touch(); }, onChange: commit }),
          (pg.outline > 0) ? h('div', { class: 'field' }, h('label', { for: 'pg-oc' }, t('Color del contorno', 'Outline colour')), h('input', { type: 'color', id: 'pg-oc', class: 'input', style: { padding: '2px', height: '34px', width: '90px' }, value: pg.outlineColor || '#ffffff', onInput: (e) => { pg.outlineColor = e.target.value; touch(); }, onChange: commit })) : null,
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const L = sh.layers.find((l) => l.page), img = MC.assets.get(L.assetId); pg.panels = MC.detectPanels(img.bitmap, pg.dir); pg.manual = false; S.pn = null; commit(); MC.toast(t(pg.panels.length + ' viñetas detectadas', pg.panels.length + ' panels detected')); } }, t('Detectar viñetas', 'Detect panels')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const q = { id: MC.uid(), x0: 0.3, y0: 0.3, x1: 0.7, y1: 0.7, hold: null }; pg.panels.push(q); S.pn = q.id; edit(); S.view = 'page'; commit(); fit(); } }, MC.icon('plus', 14), t('Añadir viñeta', 'Add panel'))),
          h('div', { style: { display: 'grid', gap: '2px' } }, rowsP),
          h('p', { class: 'cap' }, t('En la vista «Página» arrastra una viñeta para moverla, sus esquinas para cambiarla, o dibuja en un hueco para crear otra. Para viñetas con forma libre usa «Polígono» o «Convertir en polígono».', 'In the “Page” view drag a panel to move it, its corners to resize it, or draw in an empty spot to create another. For free-shaped panels use “Polygon” or “Turn into polygon”.')),
        ];
        const selNodes = [];
        if (selP) selNodes.push(
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, selP.pts
            ? [h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { selP.pts = null; S.pv = null; edit(); commit(); } }, t('Volver a rectángulo', 'Back to rectangle')),
              S.pv != null && selP.pts.length > 3 ? h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { selP.pts.splice(S.pv, 1); S.pv = null; MC.syncPanel(selP); edit(); commit(); } }, t('Quitar vértice', 'Remove vertex')) : null]
            : h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { MC.toPolygon(selP); edit(); commit(); } }, t('Convertir en polígono', 'Turn into polygon'))),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: selP.hold == null, onChange: (e) => { selP.hold = e.target.checked ? null : Math.round(MC.panelHold(selP) * 10) / 10; edit(); commit(); } }), h('span', null, t('Permanencia automática', 'Automatic hold'), h('small', null, t('Según el tamaño de la viñeta.', 'Based on the panel size.')))),
          selP.hold != null ? MC.ui.slider({ label: t('Permanencia de la viñeta', 'Panel hold'), min: 0.5, max: 10, step: 0.1, value: selP.hold, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => { selP.hold = v; touch(); }, onChange: () => { edit(); commit(); } }) : null,
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: async () => { const a = await MC.cropPanel(sh, selP), ns = MC.newShot(t('Viñeta ', 'Panel ') + (pg.panels.indexOf(selP) + 1)); ns.layers.push(MC.newLayer(a, { z: 0.1, role: 'fondo' })); MC.applyPreset(ns.camera, 'zoomin', 0.8); p.shots.splice(S.si + 1, 0, ns); commit(); MC.toast(t('Viñeta convertida en un plano libre después de esta página', 'Panel turned into a free shot after this page')); } }, t('Convertir en plano libre', 'Turn into free shot')),
            h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', onClick: () => { pg.panels = pg.panels.filter((q) => q !== selP); S.pn = null; edit(); commit(); } }, MC.icon('trash', 14), t('Quitar viñeta', 'Remove panel'))));
        pageSecs.push(sec('pagina', t('Página', 'Page') + ' · ' + pg.panels.length + ' ' + t('viñetas', 'panels'), nodes));
        pageSecs.push(sec('pagina_sel', t('Viñeta ', 'Panel ') + (selP ? pg.panels.indexOf(selP) + 1 : ''), selNodes));
      }
      if (sh.webtoon) {
        const wt = sh.webtoon, selS = wt.stops.find((q) => q.id === S.sp), L = sh.layers.find((l) => l.strip), asset = L && MC.assets.get(L.assetId);
        const sorted = wt.stops.slice().sort((a, b) => a.y - b.y);
        const nodes = [
          MC.ui.slider({ label: t('Velocidad del scroll', 'Scroll speed'), min: 0.05, max: 1.2, step: 0.05, value: wt.speed, fmt: (v) => v.toFixed(2) + ' ' + t('pantallas/s', 'screens/s'), onInput: (v) => { wt.speed = v; touch(); }, onChange: commit }),
          MC.ui.slider({ label: t('Pausa al empezar', 'Hold at start'), min: 0, max: 4, step: 0.1, value: wt.head, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => { wt.head = v; touch(); }, onChange: commit }),
          MC.ui.slider({ label: t('Pausa al final', 'Hold at end'), min: 0, max: 4, step: 0.1, value: wt.tail, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => { wt.tail = v; touch(); }, onChange: commit }),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !asset, onClick: () => { wt.stops = MC.suggestStops(asset); S.sp = null; commit(); MC.toast(wt.stops.length ? t(wt.stops.length + ' pausas sugeridas', wt.stops.length + ' pauses suggested') : t('No se han encontrado bloques separados', 'No separate blocks found')); } }, t('Sugerir pausas', 'Suggest pauses')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !asset, onClick: () => {
              const o2 = opts(), tl = clamp(S.time - MC.shotStarts(p)[S.si], 0, sh.duration), cam = MC.camAt(sh, tl, false), s0 = Math.max(o2.W / asset.w, o2.H / asset.h), PH = asset.h * s0;
              const sp = { id: MC.uid(), y: Math.round(clamp((o2.H / 2 + cam.y * o2.H - (o2.H / 2 - PH / 2)) / PH, 0, 1) * 1000) / 1000, hold: 1.5, zoom: 1, x: 0 }; wt.stops.push(sp); S.sp = sp.id; commit();
            } }, MC.icon('plus', 14), t('Pausa en el cabezal', 'Pause at playhead')),
            h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', disabled: !wt.stops.length, onClick: () => { wt.stops = []; S.sp = null; commit(); } }, t('Quitar todas', 'Remove all'))),
          h('div', { style: { display: 'grid', gap: '2px' } }, sorted.map((sp, i) => h('div', { class: 'layer' + (sp.id === S.sp ? ' on' : ''), onClick: () => { S.sp = sp.id; if (S.view !== 'strip') { S.view = 'strip'; renderVbar(); fit(); } S.dirty = true; renderInspector(); } },
            h('span', { class: 'ln' }, t('Pausa ', 'Pause ') + (i + 1)), h('span', { class: 'lz' }, Math.round(sp.y * 100) + ' % · ' + sp.hold.toFixed(1) + ' s' + (sp.zoom > 1.01 ? ' · ×' + sp.zoom.toFixed(1) : ''))))),
          h('p', { class: 'cap' }, t('En la vista «Tira» haz clic para añadir una pausa y arrástrala para moverla. Una pausa con zoom enseña un detalle.', 'In the “Strip” view click to add a pause and drag it to move it. A pause with zoom shows a detail.')),
        ];
        const selNodes2 = [];
        if (selS) selNodes2.push(
          MC.ui.slider({ label: t('Permanencia', 'Hold'), min: 0.3, max: 10, step: 0.1, value: selS.hold, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => { selS.hold = v; touch(); S.dirty = true; }, onChange: commit }),
          MC.ui.slider({ label: 'Zoom', min: 1, max: 3, step: 0.05, value: selS.zoom, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => { selS.zoom = v; touch(); }, onChange: commit }),
          selS.zoom > 1.01 ? MC.ui.slider({ label: t('Desplazamiento lateral', 'Sideways offset'), min: -0.4, max: 0.4, step: 0.01, value: selS.x || 0, fmt: (v) => v.toFixed(2), onInput: (v) => { selS.x = v; touch(); }, onChange: commit }) : null,
          h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', style: { justifySelf: 'start' }, onClick: () => { wt.stops = wt.stops.filter((q) => q !== selS); S.sp = null; commit(); } }, MC.icon('trash', 14), t('Quitar pausa', 'Remove pause')));
        pageSecs.push(sec('tira', t('Tira', 'Strip') + ' · ' + wt.stops.length + ' ' + t('pausas', 'pauses'), nodes));
        pageSecs.push(sec('tira_sel', t('Pausa', 'Pause'), selNodes2));
      }
      const styleIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, id: 'f-style', onChange: async (e) => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        try { const st = JSON.parse(await f.text()); if (!st.transition || !st.sub) throw new Error('formato'); MC.myStyle.set(st); renderInspector(); MC.toast(t('Mi estilo importado', 'My style imported')); } catch (err) { MC.toast(t('Ese archivo no es un estilo de MotionComic Studio.', 'That file is not a MotionComic Studio style.')); }
      } });
      const saved = MC.myStyle.get();
      const styleNodes = [
        h('p', { class: 'cap' }, saved ? t('Guardado en este equipo: transición ', 'Saved on this device: transition ') + saved.transition.type + ', ' + t('parallax ', 'parallax ') + saved.parallax + ', ' + t('tipografía ', 'font ') + saved.textFont + '.' : t('Aún no has guardado tu estilo.', 'You have not saved your style yet.')),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { MC.myStyle.set(MC.styleFromProject(p)); renderInspector(); MC.toast(t('Este proyecto es ahora tu estilo', 'This project is now your style')); } }, t('Guardar como Mi estilo', 'Save as My style')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !saved, onClick: () => { MC.applyStyle(p, saved); commit(); S.dirty = true; MC.toast(t('Mi estilo aplicado al proyecto', 'My style applied to the project')); } }, t('Aplicar al proyecto', 'Apply to project')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !saved, onClick: () => MC.download(new Blob([JSON.stringify(saved, null, 1)], { type: 'application/json' }), 'mi-estilo.motioncomic-style.json') }, MC.icon('download', 14), t('Exportar', 'Export')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => styleIn.click() }, MC.icon('upload', 14), t('Importar', 'Import')), styleIn),
        h('p', { class: 'cap' }, t('Se aplica a los proyectos nuevos y al borrador en un clic. Incluye transiciones, curva de cámara, ritmo de las viñetas, parallax y tipografías.', 'It is applied to new projects and to the one-click draft. It includes transitions, camera curve, panel pacing, parallax and fonts.')),
      ];

      const audioSecs = [], clip = S.cl ? clipById(S.cl) : null, mixv = p.mix;
      if (clip) {
        const a = MC.audio.get(clip.assetId), cs = (k, v) => { clip[k] = v; touch(); };
        audioSecs.push(sec('audio', t('Clip de audio', 'Audio clip') + ' · ' + clip.name, [
          nameIn(t('Nombre', 'Name'), clip.name, (v) => { if (v) { clip.name = v; commit(); } }),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Pista', 'Track')), MC.ui.seg([{ v: 'voz', l: t('Locución', 'Voice') }, { v: 'sfx', l: 'SFX' }, { v: 'musica', l: t('Música', 'Music') }], clip.track, (v) => { clip.track = v; commit(); })),
          MC.ui.slider({ label: t('Volumen del clip', 'Clip volume'), min: 0, max: 1.5, step: 0.01, value: clip.vol == null ? 1 : clip.vol, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => cs('vol', v), onChange: commit }),
          MC.ui.slider({ label: t('Fundido de entrada', 'Fade in'), min: 0, max: 5, step: 0.1, value: clip.fadeIn || 0, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => cs('fadeIn', v), onChange: commit }),
          MC.ui.slider({ label: t('Fundido de salida', 'Fade out'), min: 0, max: 5, step: 0.1, value: clip.fadeOut || 0, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => cs('fadeOut', v), onChange: commit }),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: splitClip }, MC.icon('cut', 14), t('Dividir en el cabezal (S)', 'Split at playhead (S)')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => toLibrary(clip.assetId, clip.name) }, MC.icon('bookmark', 14), t('Guardar en la biblioteca', 'Save to the library')),
            h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', onClick: () => { p.clips = p.clips.filter((c) => c !== clip); S.cl = null; commit(); } }, MC.icon('trash', 14), t('Eliminar clip', 'Delete clip'))),
          a ? h('p', { class: 'cap' }, t('Duración original: ', 'Original length: ') + a.dur.toFixed(1) + ' s') : null]));
      }
      const hasVoice = p.clips.some((c) => c.track === 'voz');
      mixv.mute = mixv.mute || {}; mixv.solo = mixv.solo || {};
      const mixRow = (tr, label, max) => {
        const tog = (key, ch, title) => h('button', { type: 'button', class: 'btn btn-s msb', 'aria-pressed': String(!!mixv[key][tr]), title, 'aria-label': title + ' · ' + label, onClick: () => { mixv[key][tr] = !mixv[key][tr]; if (key === 'solo' && mixv.solo[tr]) mixv.mute[tr] = false; commit(); if (S.playing) MC.audio.play(S.project, S.time); } }, ch);
        return h('div', { class: 'mixrow' + (mixv.mute[tr] ? ' muted' : '') },
          MC.ui.slider({ label, min: 0, max, step: 0.01, value: mixv[tr], fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { mixv[tr] = v; touch(); }, onChange: commit }),
          h('div', { class: 'mixctl' }, tog('mute', 'M', t('Silenciar', 'Mute')), tog('solo', 'S', t('Solo', 'Solo')), h('div', { class: 'meter', 'data-m': tr, role: 'meter', 'aria-label': t('Nivel de ', 'Level of ') + label, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i'))));
      };
      audioSecs.push(sec('mezcla', t('Mezcla de audio', 'Audio mix'), [
        mixRow('voz', t('Locución', 'Voice'), 1.5), mixRow('sfx', 'SFX', 1.5), mixRow('musica', t('Música', 'Music'), 1.5),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: mixv.duck !== false, onChange: (e) => { mixv.duck = e.target.checked; commit(); } }), h('span', null, t('Ducking automático', 'Automatic ducking'), h('small', null, t('La música baja sola cuando habla la voz.', 'Music lowers by itself when the voice speaks.')))),
        h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Pulso de la música', 'Music beat')),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !p.clips.some((c) => c.track === 'musica'), onClick: () => { const cs = p.clips.filter((c) => c.track === 'musica'); const n = cs.reduce((a, c) => a + detectBeats(c), 0); commit(); MC.toast(n ? t(n + ' pulsos marcados en la línea de tiempo', n + ' beats marked on the timeline') : t('No se encontró un pulso claro.', 'No clear beat found.')); } }, MC.icon('note', 14), t('Detectar el pulso', 'Detect the beat')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { addMarker('beat'); } }, t('Marcar un pulso aquí (B)', 'Mark a beat here (B)')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !(p.notes || []).some((n) => n.kind === 'beat') || p.shots.length < 2, onClick: () => { const n = cutsToBeat(); commit(); setTime(S.time); MC.toast(n ? t(n + ' cortes ajustados al pulso', n + ' cuts fitted to the beat') : t('Los cortes ya están cerca del pulso o no hay pulsos cercanos.', 'Cuts are already near the beat, or no beats are close.')); } }, t('Cortes al pulso', 'Cuts to the beat')))),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !hasVoice, onClick: () => { const ps = MC.audio.voicePauses(p); p.markers = ps.map((x) => Math.round(x.t * 100) / 100); commit(); MC.toast(ps.length ? t(ps.length + ' pausas marcadas en la regla', ps.length + ' pauses marked on the ruler') : t('No se han encontrado pausas', 'No pauses found')); } }, t('Marcar pausas de la voz', 'Mark voice pauses')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !hasVoice || p.shots.length < 2, onClick: () => { if (MC.audio.fitShotsToVoice(p)) { commit(); setTime(S.time); MC.toast(t('Planos ajustados a la voz', 'Shots fitted to the voice')); } else MC.toast(t('Faltan pausas en la voz para repartir ' + p.shots.length + ' planos.', 'Not enough voice pauses to split ' + p.shots.length + ' shots.')); } }, t('Ajustar planos a la voz', 'Fit shots to voice'))),
        !hasVoice ? h('p', { class: 'cap' }, t('Añade una locución en la pista 3 para marcar pausas y ajustar los planos.', 'Add a voice-over on track 3 to mark pauses and fit shots.')) : null]));

      /* trayectoria dibujada, efectos, rack focus y aspecto */
      const fxSecs = [], shotStart = MC.shotStarts(p)[S.si], localT = clamp(S.time - shotStart, 0, Math.max(0.1, sh.duration));
      if (!autoCam) {
        const cp = cam.path && cam.path.custom ? cam.path : null;
        const nodes = [];
        if (!cp) {
          nodes.push(h('p', { class: 'cap' }, t('Dibuja un recorrido con varios puntos en lugar de un solo movimiento: la cámara se detiene en cada uno y viaja al siguiente. Se edita en la vista «Cámara».', 'Draw a route with several points instead of a single movement: the camera holds at each one and travels to the next. Edit it in the “Camera” view.')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => {
              const f = cam.from, t2 = cam.to;
              cam.path = { custom: true, drift: 0, curve: cam.curve || 'smooth', pts: [{ x: f.x, y: f.y, zoom: f.zoom, hold: 0.5, travel: Math.max(0.5, sh.duration - 1), rect: null }, { x: t2.x, y: t2.y, zoom: t2.zoom, hold: 0.5, travel: 0, rect: null }] };
              cam.preset = 'path'; cam.shake = 0; S.wp = 0; S.view = 'cam'; renderVbar(); commit(); fit();
            } }, MC.icon('plus', 14), t('Dibujar trayectoria', 'Draw route')));
        } else {
          const selW = cp.pts[clamp(S.wp, 0, cp.pts.length - 1)];
          nodes.push(h('div', { style: { display: 'grid', gap: '2px' } }, cp.pts.map((q, i) => h('div', { class: 'layer' + (q === selW ? ' on' : ''), onClick: () => { S.wp = i; if (S.view !== 'cam') { S.view = 'cam'; renderVbar(); fit(); } S.dirty = true; renderInspector(); } },
            h('span', { class: 'ln' }, t('Punto ', 'Point ') + (i + 1)), h('span', { class: 'lz' }, q.hold.toFixed(1) + ' s · ×' + q.zoom.toFixed(2))))),
            MC.ui.slider({ label: t('Permanencia en el punto', 'Hold at the point'), min: 0, max: 8, step: 0.1, value: selW.hold, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => { selW.hold = v; touch(); }, onChange: commit }),
            selW !== cp.pts[cp.pts.length - 1] ? MC.ui.slider({ label: t('Viaje al siguiente', 'Travel to the next'), min: 0.1, max: 8, step: 0.1, value: selW.travel || 0.5, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => { selW.travel = v; touch(); }, onChange: commit }) : null,
            MC.ui.slider({ label: 'Zoom', min: 1, max: 4, step: 0.01, value: selW.zoom, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => { selW.zoom = v; touch(); S.dirty = true; }, onChange: commit }),
            h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
              h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const i = cp.pts.indexOf(selW), nx = cp.pts[i + 1], np = nx ? { x: (selW.x + nx.x) / 2, y: (selW.y + nx.y) / 2, zoom: (selW.zoom + nx.zoom) / 2 } : { x: clamp(selW.x + 0.06, -0.6, 0.6), y: selW.y, zoom: selW.zoom }; cp.pts.splice(i + 1, 0, Object.assign({ hold: 0.5, travel: 1, rect: null }, np)); S.wp = i + 1; commit(); } }, MC.icon('plus', 14), t('Añadir punto', 'Add point')),
              h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', onClick: () => { if (cp.pts.length <= 2) { MC.toast(t('Una trayectoria necesita al menos dos puntos.', 'A route needs at least two points.')); return; } cp.pts.splice(cp.pts.indexOf(selW), 1); S.wp = 0; commit(); } }, MC.icon('trash', 14), t('Quitar punto', 'Remove point')),
              h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { MC.applyPreset(cam, 'zoomin', 1); commit(); } }, t('Volver a un preset', 'Back to a preset'))),
            h('p', { class: 'cap' }, t('Arrastra un punto en el visor para moverlo y su esquina para el zoom. La duración del plano es la suma de las permanencias y los viajes.', 'Drag a point in the viewer to move it and its corner to zoom. The shot length is the sum of the holds and travels.')));
        }
        fxSecs.push(sec('tray', t('Trayectoria de cámara', 'Camera route') + (cp ? ' · ' + cp.pts.length : ''), nodes));
      }
      /* efectos */
      {
        const list = sh.fx, selF = list.find((q) => q.id === S.fxsel);
        const addFx = (type) => { const f = MC.newFx(type, localT); if (f.start + f.dur > sh.duration) f.start = Math.max(0, Math.round((sh.duration - f.dur) * 100) / 100); sh.fx.push(f); S.fxsel = f.id; S.open.efectos = true; commit(); };
        const nodes = [
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Animación dentro de la viñeta', 'Animation inside the panel')), h('div', { class: 'chips' }, MC.FX.filter((x) => x.g === 'anim').map((x) => hoverable(h('button', { type: 'button', class: 'chip-b', onClick: () => { hoverStop(); addFx(x.v); } }, '+ ' + t(x.es, x.en)), 'fx', (sh, st) => { const f = MC.newFx(x.v, clamp(S.time - st, 0, Math.max(0, sh.duration - 0.1))); sh.fx = (sh.fx || []).concat([f]); })))),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Acción y ambiente', 'Action and ambience')), h('div', { class: 'chips' }, MC.FX.filter((x) => x.g === 'fx').map((x) => hoverable(h('button', { type: 'button', class: 'chip-b', onClick: () => { hoverStop(); addFx(x.v); } }, '+ ' + t(x.es, x.en)), 'fx', (sh, st) => { const f = MC.newFx(x.v, clamp(S.time - st, 0, Math.max(0, sh.duration - 0.1))); sh.fx = (sh.fx || []).concat([f]); })))),
          h('div', { style: { display: 'grid', gap: '2px' } }, list.slice().sort((a, b) => MC.fxStart(sh, a) - MC.fxStart(sh, b)).map((f) => h('div', { class: 'layer' + (f.id === S.fxsel ? ' on' : ''), onClick: () => { S.fxsel = f.id; renderInspector(); } }, h('span', { class: 'ln' }, MC.fxName(f.type)), h('span', { class: 'lz' }, MC.fxStart(sh, f).toFixed(1) + ' s')))),
        ];
        nodes.splice(2, 0, presetBox('fx', () => MC.captureFx(sh, selF || null), (q) => { MC.applyFx(sh, q.data, localT); commit(); MC.announce(t('Efectos aplicados: ', 'Effects applied: ') + q.name); }, false, selF ? t('Guardar este efecto', 'Save this effect') : t('Guardar los efectos del plano', 'Save this shot’s effects')));
        const propNodes = [];
        if (selF) {
          const anim = MC.isAnimFx(selF.type), colored = ['speed', 'focus', 'flash', 'rain', 'dust', 'sparks', 'snow', 'smoke', 'impact', 'fog', 'beam'].includes(selF.type), selT = 'ft-' + MC.uid(), selA = 'fa-' + MC.uid();
          const targets = [{ v: '', l: t('Todo el plano', 'Whole shot') }].concat(anim ? sh.layers.map((l) => ({ v: 'l:' + l.id, l: t('Capa: ', 'Layer: ') + l.name })) : []);
          propNodes.push(
            h('div', { class: 'field' }, h('label', { for: selT }, anim ? t('Se aplica a', 'Applies to') : t('Zona', 'Area')), h('select', { id: selT, class: 'input', disabled: !anim, onChange: (e) => { selF.layer = e.target.value.startsWith('l:') ? e.target.value.slice(2) : null; commit(); } }, targets.map((q) => h('option', { value: q.v, selected: q.v === (selF.layer ? 'l:' + selF.layer : '') }, q.l)))),
            sh.page ? h('div', { class: 'field' }, h('label', { for: selA }, t('Empieza', 'Starts')), h('select', { id: selA, class: 'input', onChange: (e) => { selF.panel = e.target.value === '' ? null : +e.target.value; selF.start = 0; commit(); } }, [h('option', { value: '' }, t('En un momento del plano', 'At a time in the shot'))].concat(sh.page.panels.map((q, i) => h('option', { value: String(i), selected: selF.panel === i }, t('Al llegar a la viñeta ', 'On reaching panel ') + (i + 1)))))) : null,
            MC.ui.slider({ label: selF.panel != null ? t('Desfase', 'Offset') : t('Empieza en', 'Starts at'), min: 0, max: Math.max(0.5, sh.duration), step: 0.05, value: clamp(selF.start, 0, Math.max(0.5, sh.duration)), fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { selF.start = v; touch(); }, onChange: commit }),
            MC.ui.slider({ label: t('Dura', 'Lasts'), min: 0.1, max: Math.max(1, sh.duration), step: 0.05, value: clamp(selF.dur, 0.1, Math.max(1, sh.duration)), fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { selF.dur = v; touch(); }, onChange: commit }),
            MC.ui.slider({ label: t('Intensidad', 'Intensity'), min: 0.2, max: 3, step: 0.05, value: selF.intensity, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => { selF.intensity = v; touch(); }, onChange: commit }),
            selF.type === 'speed' ? MC.ui.slider({ label: t('Ángulo', 'Angle'), min: -90, max: 90, step: 1, value: selF.angle || 0, fmt: (v) => v + '°', onInput: (v) => { selF.angle = v; touch(); }, onChange: commit }) : null,
            colored ? h('div', { class: 'field' }, h('label', { for: 'fc-' + selF.id }, t('Color', 'Colour')), h('input', { type: 'color', id: 'fc-' + selF.id, class: 'input', style: { padding: '2px', height: '34px', width: '90px' }, value: selF.color || '#ffffff', onInput: (e) => { selF.color = e.target.value; touch(); }, onChange: commit })) : null,
            h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
              selF.type === 'impact' ? h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: async (e) => { const b2 = e.currentTarget; b2.disabled = true; const c = await addLibrarySound(MC.audio.LIBRARY.find((x) => x.id === 'golpe'), shotStart + MC.fxStart(sh, selF)); S.cl = c.id; S.fxsel = null; commit(); MC.toast(t('Sonido de golpe añadido en la pista SFX', 'Hit sound added to the SFX track')); } }, MC.icon('note', 14), t('Añadir sonido de golpe', 'Add hit sound')) : null,
              h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', onClick: () => { sh.fx = sh.fx.filter((q) => q !== selF); S.fxsel = null; commit(); } }, MC.icon('trash', 14), t('Quitar efecto', 'Remove effect'))));
        }
        fxSecs.push(sec('efectos', t('Efectos y animación', 'Effects and animation') + ' · ' + list.length, nodes));
        fxSecs.push(sec('efecto', selF ? MC.fxName(selF.type) : t('Efecto', 'Effect'), propNodes));
      }
      /* rack focus */
      {
        const r = sh.rack, ls = sh.layers;
        const nodes = [];
        if (ls.length < 2) nodes.push(h('p', { class: 'cap' }, t('Necesitas al menos dos capas en el plano para pasar el enfoque de una a otra.', 'You need at least two layers in the shot to shift focus from one to the other.')));
        else {
          nodes.push(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!(r && r.on), onChange: (e) => { if (e.target.checked) sh.rack = r ? Object.assign(r, { on: true }) : { on: true, a: ls[ls.length - 1].id, b: ls[0].id, start: Math.min(1, sh.duration / 3), dur: Math.min(1.2, sh.duration / 2), amount: 14 }; else if (r) r.on = false; commit(); } }), h('span', null, t('Rack focus', 'Rack focus'), h('small', null, t('Empieza nítida la primera capa y el enfoque pasa a la segunda.', 'The first layer starts sharp and focus shifts to the second.')))));
          if (r && r.on) {
            const sa = 'ra-' + MC.uid(), sb = 'rb-' + MC.uid();
            nodes.push(
              h('div', { class: 'field' }, h('label', { for: sa }, t('Empieza nítida', 'Starts sharp')), h('select', { id: sa, class: 'input', onChange: (e) => { r.a = e.target.value; commit(); } }, ls.map((l) => h('option', { value: l.id, selected: l.id === r.a }, l.name)))),
              h('div', { class: 'field' }, h('label', { for: sb }, t('Termina nítida', 'Ends sharp')), h('select', { id: sb, class: 'input', onChange: (e) => { r.b = e.target.value; commit(); } }, ls.map((l) => h('option', { value: l.id, selected: l.id === r.b }, l.name)))),
              MC.ui.slider({ label: t('Empieza en', 'Starts at'), min: 0, max: Math.max(0.5, sh.duration), step: 0.05, value: clamp(r.start, 0, Math.max(0.5, sh.duration)), fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { r.start = v; touch(); }, onChange: commit }),
              MC.ui.slider({ label: t('Duración del cambio', 'Shift length'), min: 0.2, max: 6, step: 0.1, value: r.dur, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => { r.dur = v; touch(); }, onChange: commit }),
              MC.ui.slider({ label: t('Desenfoque', 'Blur'), min: 2, max: 30, step: 0.5, value: r.amount, fmt: (v) => v.toFixed(1) + ' px', onInput: (v) => { r.amount = v; touch(); }, onChange: commit }));
          }
        }
        fxSecs.push(sec('rack', t('Rack focus', 'Rack focus') + (r && r.on ? ' · ' + t('activo', 'on') : ''), nodes));
      }
      const lk = p.look;
      const lookSec = sec('aspecto', t('Aspecto global', 'Global look'), [
        h('p', { class: 'cap' }, t('Capas de ajuste para todo el vídeo.', 'Adjustment layers for the whole video.')),
        MC.ui.slider({ label: t('Saturación', 'Saturation'), min: 0, max: 2, step: 0.01, value: lk.sat == null ? 1 : lk.sat, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { lk.sat = v; touch(); }, onChange: commit }),
        MC.ui.slider({ label: t('Contraste', 'Contrast'), min: 0.5, max: 1.8, step: 0.01, value: lk.contrast == null ? 1 : lk.contrast, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { lk.contrast = v; touch(); }, onChange: commit }),
        MC.ui.slider({ label: t('Brillo', 'Brightness'), min: 0.5, max: 1.5, step: 0.01, value: lk.bright == null ? 1 : lk.bright, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { lk.bright = v; touch(); }, onChange: commit }),
        MC.ui.slider({ label: t('Temperatura (frío ↔ cálido)', 'Temperature (cool ↔ warm)'), min: -1, max: 1, step: 0.01, value: lk.warm || 0, fmt: (v) => (v === 0 ? t('neutra', 'neutral') : (v > 0 ? t('cálida ', 'warm ') : t('fría ', 'cool ')) + Math.round(Math.abs(v) * 100) + ' %'), onInput: (v) => { lk.warm = v; touch(); }, onChange: commit }),
        MC.ui.slider({ label: t('Viñeteado', 'Vignette'), min: 0, max: 1, step: 0.01, value: lk.vignette, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { lk.vignette = v; touch(); }, onChange: commit }),
        MC.ui.slider({ label: t('Grano de película', 'Film grain'), min: 0, max: 1, step: 0.01, value: lk.grain, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { lk.grain = v; touch(); }, onChange: commit }),
        MC.ui.slider({ label: t('Tramado de cómic (halftone)', 'Comic halftone'), min: 0, max: 1, step: 0.01, value: lk.halftone, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { lk.halftone = v; touch(); }, onChange: commit }),
        h('div', { class: 'field' }, h('label', { for: 'lt-c' }, t('Tinte de color', 'Colour tint')), h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          h('input', { type: 'color', id: 'lt-c', class: 'input', style: { padding: '2px', height: '34px', width: '90px' }, value: lk.tint ? lk.tint.color : '#8c7cff', onInput: (e) => { lk.tint = { color: e.target.value, amount: lk.tint ? lk.tint.amount : 0.3 }; touch(); }, onChange: commit }),
          h('span', { class: 'cap' }, lk.tint ? Math.round(lk.tint.amount * 100) + ' %' : t('sin tinte', 'no tint')))),
        lk.tint ? MC.ui.slider({ label: t('Cantidad de tinte', 'Tint amount'), min: 0, max: 1, step: 0.01, value: lk.tint.amount, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { lk.tint.amount = v; touch(); }, onChange: commit }) : null,
        lk.tint ? h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { lk.tint = null; commit(); } }, t('Quitar tinte', 'Remove tint')) : null,
      ]);

      /* viñeta: contenedor del proyecto y del plano */
      const colorIn = (label, value, fn) => { const id = 'c-' + MC.uid(); return h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { type: 'color', id, class: 'input', style: { padding: '2px', height: '34px', width: '90px' }, value: value || '#000000', onInput: (e) => { fn(e.target.value); touch(); }, onChange: commit })); };
      const swatches = (value, fn, list) => h('div', { class: 'swatches' }, list.map((q) => h('button', { type: 'button', class: 'sw', title: q[1], 'aria-label': q[1], 'aria-pressed': String((value || '').toLowerCase() === q[0]), style: { background: q[0] }, onClick: () => { fn(q[0]); commit(); } })));
      const frameEditor = (f, scope) => {
        const shapeAmt = !['rect', 'circle'].includes(f.shape || 'rect');
        const BGS = [['#ffffff', t('Blanco', 'White')], ['#000000', t('Negro', 'Black')], ['#fbf7ee', t('Papel', 'Paper')], ['#e9e6df', t('Gris cálido', 'Warm grey')], ['#ffd84a', t('Amarillo', 'Yellow')], ['#16181b', t('Grafito', 'Graphite')]];
        return [
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Estilos de viñeta', 'Panel styles')),
            MC.ui.chips(MC.FRAME_PRESETS.map((x) => ({ v: x.v, l: t(x.es, x.en) })), null, (v) => { const pr = MC.FRAME_PRESETS.find((x) => x.v === v); Object.assign(f, { pattern: 'plain', shadow: 0, amount: 0.5 }, pr.f); commit(); })),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Calle (espacio entre viñetas)', 'Gutter (space between panels)')), swatches(f.bg, (v) => { f.bg = v; }, BGS)),
          MC.ui.slider({ label: t('Ancho de la calle', 'Gutter width'), min: 0, max: 0.15, step: 0.002, value: f.gutter || 0, fmt: (v) => (v * 100).toFixed(1) + ' %', onInput: (v) => { f.gutter = v; touch(); }, onChange: commit }),
          colorIn(t('Color de la calle', 'Gutter colour'), f.bg, (v) => { f.bg = v; }),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Textura de la calle', 'Gutter texture')), MC.ui.chips(MC.FRAME_BGS.map((x) => ({ v: x.v, l: t(x.es, x.en) })), f.pattern || 'plain', (v) => { f.pattern = v; commit(); })),
          f.pattern && f.pattern !== 'plain' ? colorIn(t('Color de la textura', 'Texture colour'), f.patColor, (v) => { f.patColor = v; }) : null,
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Forma de la viñeta', 'Panel shape')), MC.ui.chips(MC.FRAME_SHAPES.map((x) => ({ v: x.v, l: t(x.es, x.en) })), f.shape || 'rect', (v) => { f.shape = v; commit(); })),
          shapeAmt ? MC.ui.slider({ label: t('Intensidad de la forma', 'Shape amount'), min: 0, max: 1, step: 0.01, value: f.amount == null ? 0.5 : f.amount, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { f.amount = v; touch(); }, onChange: commit }) : null,
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Trazo que la bordea', 'Border stroke')), MC.ui.chips(MC.FRAME_STROKES.map((x) => ({ v: x.v, l: t(x.es, x.en) })), f.style || 'solid', (v) => { f.style = v; if (v !== 'none' && !(f.width > 0)) f.width = 0.006; commit(); })),
          f.style !== 'none' ? MC.ui.slider({ label: t('Grosor del trazo', 'Stroke width'), min: 0, max: 0.03, step: 0.0005, value: f.width || 0, fmt: (v) => (v * 1000).toFixed(1) + ' ‰', onInput: (v) => { f.width = v; touch(); }, onChange: commit }) : null,
          f.style !== 'none' ? colorIn(t('Color del trazo', 'Stroke colour'), f.color, (v) => { f.color = v; }) : null,
          MC.ui.slider({ label: t('Sombra de la viñeta', 'Panel shadow'), min: 0, max: 1, step: 0.01, value: f.shadow || 0, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { f.shadow = v; touch(); }, onChange: commit }),
          f.shadow > 0 ? colorIn(t('Color de la sombra', 'Shadow colour'), f.shadowColor, (v) => { f.shadowColor = v; }) : null,
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => fileOver.click() }, MC.icon('plus', 14), t('Añadir ilustración por encima', 'Add artwork on top')),
            scope === 'shot' ? null : h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !p.shots.some((x) => x.frame), onClick: () => { p.shots.forEach((x) => { x.frame = null; }); commit(); MC.toast(t('Todas las viñetas usan el estilo del proyecto', 'All panels use the project style')); } }, t('Quitar personalizaciones', 'Clear overrides'))),
          h('p', { class: 'cap' }, t('Las ilustraciones por encima rompen la viñeta: se dibujan sobre el trazo y la calle. Cualquier capa puede hacerlo desde sus propiedades.', 'Artwork on top breaks the panel: it is drawn over the stroke and the gutter. Any layer can do it from its properties.')),
        ];
      };
      const pf = p.frame || (p.frame = Object.assign({}, MC.FRAME_DEF, { on: (p.mode || 'free') === 'free' }));
      const isFree = (p.mode || 'free') === 'free';
      const vinetasNodes = [
        h('p', { class: 'cap' }, isFree ? t('Cada plano vive dentro de una viñeta: la calle se ve entre plano y plano como en una página de cómic. Esto es el estilo de todo el proyecto; cada plano puede personalizar el suyo.', 'Every shot lives inside a panel: the gutter shows between shots like on a comic page. This is the style for the whole project; each shot can customise its own.') : t('Tus páginas ya traen sus viñetas. Puedes añadir además un marco alrededor del encuadre.', 'Your pages already have their panels. You can also add a frame around the picture.')),
        isFree ? null : h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: pf.on !== false, onChange: (e) => { pf.on = e.target.checked; commit(); } }), h('span', null, t('Marco alrededor del encuadre', 'Frame around the picture'))),
      ].concat(isFree || pf.on !== false ? frameEditor(pf, 'project') : []);
      const own = !!sh.frame, sf = sh.frame;
      const vinetaNodes = [
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: own, disabled: !MC.frameOf(p, Object.assign({}, sh, { frame: null })), onChange: (e) => { if (e.target.checked) { const c = Object.assign({}, MC.frameOf(p, Object.assign({}, sh, { frame: null })) || MC.FRAME_DEF); delete c.on; sh.frame = c; } else sh.frame = null; commit(); } }),
          h('span', null, t('Personalizar la viñeta de este plano', 'Customise this shot’s panel'), h('small', null, own ? t('Este plano tiene su propio contenedor.', 'This shot has its own container.') : t('Usa el estilo de viñeta del proyecto (pestaña Viñetas).', 'Uses the project panel style (Panels tab).')))),
      ].concat(own ? frameEditor(sf, 'shot') : [h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { S.ws === 'montaje' || setWs('montaje'); S.tab.montaje = 'vinetas'; renderRail(); renderPanels(); } }, MC.icon('page', 14), t('Editar el estilo del proyecto', 'Edit the project style')), h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, disabled: !MC.frameOf(p, sh), onClick: () => fileOver.click() }, MC.icon('plus', 14), t('Añadir ilustración por encima', 'Add artwork on top'))]);

      /* transición de entrada del plano */
      const trNodes = S.si > 0 ? transEditor(sh) : [h('p', { class: 'cap' }, t('El primer plano no tiene transición de entrada.', 'The first shot has no entry transition.'))];

      /* superposición seleccionada */
      const ovx = ovById(S.ov), ovNodes = [];
      if (ovx) {
        const oa = MC.assets.get(ovx.assetId), isV = ovx.kind === 'video', total = MC.totalTime(p), set = (k, v) => { ovx[k] = v; S.dirty = true; touch(); };
        const setA = (k, v) => { ovx[k] = v; syncOvAudio(ovx); layoutClips(); S.dirty = true; touch(); };
        const BL = [['', t('Normal', 'Normal')], ['multiply', t('Multiplicar', 'Multiply')], ['screen', t('Pantalla', 'Screen')], ['overlay', t('Superponer', 'Overlay')], ['soft-light', t('Luz suave', 'Soft light')], ['lighten', t('Aclarar', 'Lighten')], ['darken', t('Oscurecer', 'Darken')]];
        const place = (ax, ay) => { const o2 = opts(), b = MC.overlayBox(Object.assign({}, ovx, { x: 0, y: 0, rot: 0 }), oa, o2, null); ovx.x = ax * (0.5 - b.w / o2.W / 2); ovx.y = ay * (0.5 - b.h / o2.H / 2); commit(); };
        const grid = h('div', { class: 'agrid', role: 'group', 'aria-label': t('Colocar en el encuadre', 'Place in the frame') }, [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map((q) =>
          h('button', { type: 'button', class: 'btn btn-s', title: t('Colocar aquí', 'Place here'), 'aria-label': t('Colocar ', 'Place ') + ['↖', '↑', '↗', '←', '·', '→', '↙', '↓', '↘'][(q[1] + 1) * 3 + q[0] + 1], onClick: () => place(q[0], q[1]) }, ['↖', '↑', '↗', '←', '·', '→', '↙', '↓', '↘'][(q[1] + 1) * 3 + q[0] + 1])));
        ovNodes.push(nameIn(t('Nombre', 'Name'), ovx.name, (v) => { if (v) { ovx.name = v; commit(); } }),
          h('p', { class: 'cap' }, isV ? t('Vídeo · ', 'Video · ') + (oa ? oa.w + '×' + oa.h + ' · ' + oa.dur.toFixed(1) + ' s' : '') + (ovx.audioClip ? t(' · con audio en la pista de locución', ' · with audio on the voice track') : '') : t('Imagen fija encima de la ilustración, sin moverse con la cámara.', 'Still image above the artwork, not moving with the camera.')),
          MC.ui.slider({ label: t('Empieza en', 'Starts at'), min: 0, max: Math.max(total, ovx.start + 1), step: 0.05, value: ovx.start, fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => setA('start', v), onChange: commit }),
          MC.ui.slider({ label: t('Dura', 'Length'), min: 0.2, max: Math.max(60, ovx.dur), step: 0.05, value: ovx.dur, fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => setA('dur', v), onChange: commit }));
        if (isV && oa) ovNodes.push(MC.ui.slider({ label: t('Empieza en el segundo (del vídeo)', 'Starts at second (of the video)'), min: 0, max: Math.max(0.1, oa.dur - 0.1), step: 0.05, value: ovx.offset || 0, fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => setA('offset', v), onChange: commit }),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!ovx.loop, onChange: (e) => { ovx.loop = e.target.checked; commit(); } }), h('span', null, t('Repetir en bucle', 'Loop'), h('small', null, t('Si dura más que el vídeo, vuelve a empezar.', 'If it runs longer than the video it starts over.')))),
          ovx.audioClip ? null : MC.ui.slider({ label: t('Velocidad', 'Speed'), min: 0.25, max: 3, step: 0.05, value: ovx.speed || 1, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => set('speed', v), onChange: commit }));
        ovNodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Colocar en el encuadre', 'Place in the frame')), grid),
          MC.ui.slider({ label: t('Posición X', 'Position X'), min: -1, max: 1, step: 0.005, value: ovx.x || 0, fmt: (v) => v.toFixed(3), onInput: (v) => set('x', v), onChange: commit }),
          MC.ui.slider({ label: t('Posición Y', 'Position Y'), min: -1, max: 1, step: 0.005, value: ovx.y || 0, fmt: (v) => v.toFixed(3), onInput: (v) => set('y', v), onChange: commit }),
          MC.ui.slider({ label: t('Tamaño', 'Size'), min: 0.05, max: 4, step: 0.01, value: ovx.scale == null ? 1 : ovx.scale, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => set('scale', v), onChange: commit }),
          MC.ui.slider({ label: t('Giro', 'Rotation'), min: -180, max: 180, step: 0.5, value: ovx.rot || 0, fmt: (v) => v.toFixed(1) + '°', onInput: (v) => set('rot', v), onChange: commit }),
          MC.ui.slider({ label: t('Opacidad', 'Opacity'), min: 0, max: 1, step: 0.01, value: ovx.opacity == null ? 1 : ovx.opacity, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => set('opacity', v), onChange: commit }),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!ovx.flip, onChange: (e) => { ovx.flip = e.target.checked; commit(); } }), h('span', null, t('Voltear en horizontal', 'Flip horizontally'))),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Mezcla', 'Blend')), MC.ui.chips(BL.map((q) => ({ v: q[0], l: q[1] })), ovx.blend || '', (v) => { ovx.blend = v; commit(); })),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Pista', 'Track')), MC.ui.chips(p.otracks.map((q, i) => ({ v: i, l: q.name })), clamp(ovx.track, 0, p.otracks.length - 1), (v) => { ovx.track = v; commit(); })),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!ovx.locked, onChange: (e) => { ovx.locked = e.target.checked; commit(); } }), h('span', null, t('Bloquear en el visor', 'Lock in the viewer'), h('small', null, t('No se mueve al hacer clic sobre ella; se sigue editando desde aquí.', 'It does not move when you click it; keep editing from here.')))));
        /* croma */
        const kx = ovx.key, setK = (k, v) => { ovx.key = Object.assign({ color: '#00ff00', tol: 0.28, soft: 0.12, spill: true, on: true }, ovx.key || {}); ovx.key[k] = v; S.dirty = true; touch(); };
        ovNodes.push(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!(kx && kx.on !== false), onChange: (e) => { if (e.target.checked) { ovx.key = Object.assign({ color: '#00ff00', tol: 0.28, soft: 0.12, spill: true }, ovx.key || {}, { on: true }); } else if (ovx.key) ovx.key.on = false; commit(); } }),
          h('span', null, t('Quitar un color de fondo (croma)', 'Remove a background colour (chroma key)'), h('small', null, t('Para personajes grabados sobre verde o azul. Si tu vídeo ya tiene transparencia (WebM con alfa), no hace falta.', 'For characters shot on green or blue. If your video already has transparency (WebM with alpha) you do not need it.')))));
        if (kx && kx.on !== false) ovNodes.push(h('div', { class: 'field' }, h('label', { for: 'k-c' }, t('Color a quitar', 'Colour to remove')), h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
            h('input', { type: 'color', id: 'k-c', class: 'input', style: { padding: '2px', height: '34px', width: '90px' }, value: kx.color || '#00ff00', onInput: (e) => setK('color', e.target.value), onChange: commit }),
            h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => { setK('color', '#00ff00'); commit(); } }, t('Verde', 'Green')), h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => { setK('color', '#0000ff'); commit(); } }, t('Azul', 'Blue')))),
          MC.ui.slider({ label: t('Tolerancia', 'Tolerance'), min: 0, max: 1, step: 0.01, value: kx.tol == null ? 0.28 : kx.tol, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => setK('tol', v), onChange: commit }),
          MC.ui.slider({ label: t('Suavizado del borde', 'Edge softness'), min: 0, max: 0.5, step: 0.01, value: kx.soft == null ? 0.12 : kx.soft, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => setK('soft', v), onChange: commit }),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: kx.spill !== false, onChange: (e) => { setK('spill', e.target.checked); commit(); } }), h('span', null, t('Quitar el reflejo del color en los bordes', 'Remove colour spill on the edges'))));
        ovNodes.push(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const c = JSON.parse(JSON.stringify(ovx)); c.id = MC.uid(); c.name += ' 2'; c.start = ovx.start + 0.5; c.audioClip = null; if (ovx.audioClip && clipById(ovx.audioClip)) { const k = JSON.parse(JSON.stringify(clipById(ovx.audioClip))); k.id = MC.uid(); c.audioClip = k.id; p.clips.push(k); } p.overlays.push(c); S.ov = c.id; syncOvAudio(c); commit(); } }, MC.icon('copy', 14), t('Duplicar', 'Duplicate')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => toLibrary(ovx.assetId, ovx.name) }, MC.icon('bookmark', 14), t('Guardar en la biblioteca', 'Save to the library')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', title: t('Se ve entera dentro del encuadre', 'Fits whole inside the frame'), onClick: () => { ovx.x = 0; ovx.y = 0; ovx.scale = 1; ovx.rot = 0; commit(); } }, t('Encajar', 'Fit')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', title: t('Cubre todo el encuadre', 'Covers the whole frame'), onClick: () => { const o2 = opts(); if (oa) { ovx.scale = Math.max(o2.W / oa.w, o2.H / oa.h) / Math.min(o2.W / oa.w, o2.H / oa.h); ovx.x = 0; ovx.y = 0; ovx.rot = 0; commit(); } } }, t('Rellenar', 'Fill')),
          h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', onClick: () => { removeOverlay(ovx); commit(); } }, MC.icon('trash', 14), t('Eliminar', 'Delete'))));
      }

      /* animación: entradas, salidas y bucles; personaje (parpadeo y boca); pivote */
      const animNodes = (it, durOf) => {
        const ensure = () => (it.anim = it.anim || { in: null, out: null, loop: null });
        const part = (key, list, label) => {
          const cur = it.anim && it.anim[key];
          return [h('div', { class: 'field' }, h('span', { class: 'cap' }, label), MC.ui.chips(list.map((q) => ({ v: q.v, l: t(q.es, q.en) })), (cur && cur.type) || '', (v) => { const a = ensure(); a[key] = v ? Object.assign({ dur: 0.5 }, a[key] || {}, { type: v }) : null; commit(); })),
            cur && cur.type ? MC.ui.slider({ label: t('Duración de ', 'Length of ') + label.toLowerCase(), min: 0.1, max: Math.max(0.2, durOf()), step: 0.05, value: cur.dur || 0.5, fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { cur.dur = v; S.dirty = true; touch(); }, onChange: commit }) : null,
            cur && cur.type && ['left', 'right', 'up', 'down', 'drop', 'zoom'].includes(cur.type) ? MC.ui.slider({ label: t('Recorrido', 'Distance'), min: 0.2, max: 2, step: 0.05, value: cur.dist == null ? 1 : cur.dist, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => { cur.dist = v; S.dirty = true; touch(); }, onChange: commit }) : null];
        };
        const L = it.anim && it.anim.loop;
        return [].concat(part('in', MC.ANIM_IN, t('Entrada', 'Entrance')), part('out', MC.ANIM_OUT, t('Salida', 'Exit')),
          [h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Bucle (movimiento continuo)', 'Loop (continuous motion)')), MC.ui.chips(MC.ANIM_LOOP.map((q) => ({ v: q.v, l: t(q.es, q.en) })), (L && L.type) || '', (v) => { const a = ensure(); a.loop = v ? Object.assign({ amp: 1, speed: 1 }, a.loop || {}, { type: v }) : null; commit(); })),
            L && L.type ? MC.ui.slider({ label: t('Fuerza', 'Amount'), min: 0.1, max: 3, step: 0.05, value: L.amp == null ? 1 : L.amp, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => { L.amp = v; S.dirty = true; touch(); }, onChange: commit }) : null,
            L && L.type ? MC.ui.slider({ label: t('Velocidad', 'Speed'), min: 0.1, max: 4, step: 0.05, value: L.speed == null ? 1 : L.speed, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => { L.speed = v; S.dirty = true; touch(); }, onChange: commit }) : null,
            h('p', { class: 'cap' }, t('Muévete por la línea de tiempo para ver el resultado.', 'Move through the timeline to see the result.'))]);
      };
      const rigNodes = (l2) => {
        const r = l2.rig, others = sh.layers.filter((q) => q.id !== l2.id), set = (k, v) => { l2.rig = Object.assign({}, l2.rig || {}, { [k]: v }); S.dirty = true; touch(); };
        const hid = h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Esconde esta otra capa mientras tanto', 'Hides this other layer meanwhile')),
          MC.ui.chips([{ v: '', l: t('Ninguna', 'None') }].concat(others.map((q) => ({ v: q.id, l: q.name }))), (r && r.hides) || '', (v) => { l2.rig = Object.assign({}, l2.rig, { hides: v || null }); commit(); }));
        return [h('p', { class: 'cap' }, t('Para personajes por capas: ojos cerrados que parpadean y bocas que se abren con la voz. Pon cada pieza en su propia capa.', 'For layered characters: closed eyes that blink and mouths that open with the voice. Put each piece on its own layer.')),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Esta capa es…', 'This layer is…')), MC.ui.chips([{ v: '', l: t('Normal', 'Normal') }, { v: 'blink', l: t('Ojos cerrados (parpadeo)', 'Closed eyes (blink)') }, { v: 'mouth', l: t('Boca (con la voz)', 'Mouth (with voice)') }], (r && r.type) || '', (v) => { l2.rig = v ? Object.assign({}, l2.rig || {}, { type: v }) : null; commit(); })),
          r && r.type === 'blink' ? [hid, MC.ui.slider({ label: t('Cada cuántos segundos', 'Every (seconds)'), min: 1, max: 8, step: 0.1, value: r.every || 3.6, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => set('every', v), onChange: commit }),
            MC.ui.slider({ label: t('Dura el parpadeo', 'Blink length'), min: 0.05, max: 0.4, step: 0.01, value: r.dur || 0.14, fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => set('dur', v), onChange: commit })] : null,
          r && r.type === 'mouth' ? [MC.ui.slider({ label: t('Se ve cuando la voz supera', 'Shown when the voice exceeds'), min: 0, max: 0.9, step: 0.02, value: r.open || 0, fmt: (v) => (v === 0 ? t('siempre (boca cerrada)', 'always (closed mouth)') : Math.round(v * 100) + ' %'), onInput: (v) => set('open', v), onChange: commit }),
            h('p', { class: 'cap' }, t('Crea varias capas de boca: la cerrada con 0 %, la media con ~20 % y la abierta con ~45 %. Se elige sola según el volumen de la pista de locución.', 'Make several mouth layers: closed at 0 %, half at ~20 % and open at ~45 %. The right one is picked from the voice track volume.'))] : null];
      };
      const pivotNodes = (l2) => {
        const pv = l2.pivot || { x: 0.5, y: 0.5 }, setP = (x, y) => { l2.pivot = { x, y }; S.dirty = true; touch(); };
        return [h('p', { class: 'cap' }, t('Punto desde el que gira y crece la capa al animarla: por ejemplo el hombro de un brazo.', 'The point the layer turns and grows from when animated: for example the shoulder of an arm.')),
          h('div', { class: 'agrid' }, [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [0.5, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]].map((q, i) => h('button', { type: 'button', class: 'btn btn-s', 'aria-pressed': String(Math.abs(pv.x - q[0]) < 0.01 && Math.abs(pv.y - q[1]) < 0.01), 'aria-label': t('Pivote ', 'Pivot ') + ['↖', '↑', '↗', '←', '·', '→', '↙', '↓', '↘'][i], onClick: () => { setP(q[0], q[1]); commit(); } }, ['↖', '↑', '↗', '←', '·', '→', '↙', '↓', '↘'][i]))),
          MC.ui.slider({ label: t('Pivote X', 'Pivot X'), min: 0, max: 1, step: 0.01, value: pv.x, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => setP(v, (l2.pivot || pv).y), onChange: commit }),
          MC.ui.slider({ label: t('Pivote Y', 'Pivot Y'), min: 0, max: 1, step: 0.01, value: pv.y, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => setP((l2.pivot || pv).x, v), onChange: commit }),
          MC.ui.slider({ label: t('Límite de desplazamiento por parallax', 'Parallax travel limit'), min: 0, max: 0.2, step: 0.005, value: l2.maxShift || 0, fmt: (v) => (v === 0 ? t('sin límite', 'no limit') : (v * 100).toFixed(1) + ' %'), onInput: (v) => { l2.maxShift = v; S.dirty = true; touch(); }, onChange: commit })];
      };
      const lookNodes = (it) => {
        const D = MC.ITEM_LOOK, L = it.look, ens = () => (it.look = it.look || {}), cb = (key, label, hint) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!(L && L[key] && L[key].on), onChange: (e) => { const l2 = ens(); l2[key] = Object.assign({}, D[key], l2[key] || {}, { on: e.target.checked }); commit(); } }), h('span', null, label, hint ? h('small', null, hint) : null));
        const colorF = (key, k, label) => h('div', { class: 'field' }, h('label', null, label), h('input', { type: 'color', class: 'input', style: { padding: '2px', height: '34px', width: '90px' }, value: (L[key] && L[key][k]) || D[key][k], onInput: (e) => { L[key][k] = e.target.value; S.dirty = true; touch(); }, onChange: commit }));
        const sl = (key, k, label, min, max, step, fmt) => MC.ui.slider({ label, min, max, step, value: L[key][k] == null ? D[key][k] : L[key][k], fmt, onInput: (v) => { L[key][k] = v; S.dirty = true; touch(); }, onChange: commit });
        const nodes = [cb('shadow', t('Sombra', 'Drop shadow'))];
        if (L && L.shadow && L.shadow.on) nodes.push(colorF('shadow', 'color', t('Color de la sombra', 'Shadow colour')), sl('shadow', 'a', t('Opacidad', 'Opacity'), 0, 1, 0.01, (v) => Math.round(v * 100) + ' %'), sl('shadow', 'blur', t('Desenfoque', 'Blur'), 0, 80, 1, (v) => v + ' px'), sl('shadow', 'x', t('Desplazamiento X', 'Offset X'), -60, 60, 1, (v) => v + ' px'), sl('shadow', 'y', t('Desplazamiento Y', 'Offset Y'), -60, 60, 1, (v) => v + ' px'));
        nodes.push(cb('glow', t('Resplandor', 'Glow')));
        if (L && L.glow && L.glow.on) nodes.push(colorF('glow', 'color', t('Color del resplandor', 'Glow colour')), sl('glow', 'blur', t('Alcance', 'Reach'), 2, 100, 1, (v) => v + ' px'), sl('glow', 'a', t('Fuerza', 'Strength'), 0, 1, 0.01, (v) => Math.round(v * 100) + ' %'));
        nodes.push(cb('outline', t('Contorno', 'Outline'), t('Un borde de color alrededor de la silueta, como una pegatina.', 'A coloured edge around the silhouette, like a sticker.')));
        if (L && L.outline && L.outline.on) nodes.push(colorF('outline', 'color', t('Color del contorno', 'Outline colour')), sl('outline', 'w', t('Grosor', 'Width'), 1, 30, 0.5, (v) => v + ' px'));
        const A = (L && L.adj) || D.adj, setA = (k, v) => { const l2 = ens(); l2.adj = Object.assign({}, D.adj, l2.adj || {}); l2.adj[k] = v; S.dirty = true; touch(); };
        nodes.push(h('div', { class: 'eyebrow', style: { marginTop: '6px' } }, t('Color de este elemento', 'Colour of this element')),
          MC.ui.slider({ label: t('Brillo', 'Brightness'), min: 0, max: 2, step: 0.01, value: A.bright == null ? 1 : A.bright, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => setA('bright', v), onChange: commit }),
          MC.ui.slider({ label: t('Contraste', 'Contrast'), min: 0, max: 2, step: 0.01, value: A.contrast == null ? 1 : A.contrast, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => setA('contrast', v), onChange: commit }),
          MC.ui.slider({ label: t('Saturación', 'Saturation'), min: 0, max: 2.5, step: 0.01, value: A.sat == null ? 1 : A.sat, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => setA('sat', v), onChange: commit }),
          MC.ui.slider({ label: t('Tono', 'Hue'), min: -180, max: 180, step: 1, value: A.hue || 0, fmt: (v) => v + '°', onInput: (v) => setA('hue', v), onChange: commit }),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, disabled: !MC.hasItemLook(it), onClick: () => { it.look = null; commit(); } }, t('Quitar todo el aspecto', 'Clear all styling')));
        return nodes;
      };
      const kfNodes = (it, start, dur) => {
        const local = clamp(S.time - start, 0, dur), list = (it.kf || []).slice().sort((a, b) => a.t - b.t), cur = list.find((q) => q.id === S.kfid);
        const sel = (q) => { S.kfid = q.id; setTime(start + clamp(q.t, 0, Math.max(0, dur - 0.001))); renderInspector(); renderTimeline(); };
        const add = () => {
          const local = clamp(S.time - start, 0, dur);
          const v = MC.kfValues(it.kf, local) || { x: 0, y: 0, sc: 1, rot: 0, op: 1 }, q = { id: MC.uid(), t: Math.round(local * 100) / 100, x: v.x, y: v.y, sc: v.sc, rot: v.rot, op: v.op, ease: 'smooth' };
          it.kf = (it.kf || []).filter((z) => Math.abs(z.t - q.t) > 0.01).concat([q]); S.kfid = q.id; commit();
        };
        const nodes = [h('p', { class: 'cap' }, t('Mueve, escala, gira o desvanece el elemento entre momentos concretos. Se suman a la animación de arriba. En la línea de tiempo salen como rombos: arrástralos o pulsa dos veces para crear uno.', 'Move, scale, turn or fade the element between exact moments. They add to the animation above. On the timeline they show as diamonds: drag them or double-click to create one.')),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: add }, MC.icon('plus', 14), t('Fotograma clave aquí', 'Keyframe here')),
            list.length ? h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { it.kf = []; S.kfid = null; commit(); } }, t('Quitar todos', 'Remove all')) : null)];
        if (list.length) nodes.push(h('div', { class: 'kflist', role: 'listbox', 'aria-label': t('Fotogramas clave', 'Keyframes') }, list.map((q) => h('button', { type: 'button', role: 'option', 'aria-selected': String(q.id === S.kfid), class: 'kfrow', onClick: () => sel(q) }, h('i', { 'aria-hidden': 'true' }), q.t.toFixed(2) + ' s'))));
        if (cur) {
          const setK = (k, v) => { cur[k] = v; S.dirty = true; touch(); };
          nodes.push(MC.ui.slider({ label: t('Momento', 'Time'), min: 0, max: Math.max(0.1, dur), step: 0.01, value: cur.t, fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { setK('t', v); layoutClips(); }, onChange: commit }),
            MC.ui.slider({ label: t('Desplazar X', 'Move X'), min: -1, max: 1, step: 0.005, value: cur.x || 0, fmt: (v) => v.toFixed(3), onInput: (v) => setK('x', v), onChange: commit }),
            MC.ui.slider({ label: t('Desplazar Y', 'Move Y'), min: -1, max: 1, step: 0.005, value: cur.y || 0, fmt: (v) => v.toFixed(3), onInput: (v) => setK('y', v), onChange: commit }),
            MC.ui.slider({ label: t('Escala', 'Scale'), min: 0.1, max: 3, step: 0.01, value: cur.sc == null ? 1 : cur.sc, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => setK('sc', v), onChange: commit }),
            MC.ui.slider({ label: t('Giro', 'Rotation'), min: -360, max: 360, step: 1, value: cur.rot || 0, fmt: (v) => v + '°', onInput: (v) => setK('rot', v), onChange: commit }),
            MC.ui.slider({ label: t('Opacidad', 'Opacity'), min: 0, max: 1, step: 0.01, value: cur.op == null ? 1 : cur.op, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => setK('op', v), onChange: commit }),
            h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Curva hasta el siguiente fotograma clave', 'Curve to the next keyframe')), MC.ui.curveEditor(cur.ease || 'smooth', (v) => { cur.ease = v; S.dirty = true; touch(); }, commit)),
            h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', style: { justifySelf: 'start' }, onClick: () => { it.kf = it.kf.filter((z) => z.id !== cur.id); S.kfid = null; commit(); } }, MC.icon('trash', 14), t('Eliminar este fotograma clave', 'Delete this keyframe')));
        }
        return nodes;
      };
      const layerAnimSecs = l ? [sec('capa_anim', t('Animación de la capa', 'Layer animation'), animNodes(l, () => sh.duration)), sec('capa_rig', t('Personaje: parpadeo y boca', 'Character: blink and mouth'), rigNodes(l)), sec('capa_look', t('Sombra, brillo, contorno y color', 'Shadow, glow, outline and colour'), lookNodes(l)), sec('capa_pivot', t('Pivote y límites', 'Pivot and limits'), pivotNodes(l)), sec('capa_kf', t('Fotogramas clave', 'Keyframes'), kfNodes(l, MC.shotStarts(p)[S.si], sh.duration))] : [];
      const ovAnimSec = ovx ? [sec('overlay_anim', t('Animación de la superposición', 'Overlay animation'), animNodes(ovx, () => ovx.dur)), sec('overlay_look', t('Sombra, brillo, contorno y color', 'Shadow, glow, outline and colour'), lookNodes(ovx)), sec('overlay_kf', t('Fotogramas clave', 'Keyframes'), kfNodes(ovx, ovx.start, ovx.dur))] : [];

      /* selección múltiple */
      const mItems = multiItems(), mNodes = [], mSet = (fn) => { mItems.forEach((q) => fn(q.it, q.k)); commit(); };
      if (mItems.length > 1) {
        const grouped = mItems.every((q) => q.it.group && q.it.group === mItems[0].it.group);
        mNodes.push(h('p', { class: 'cap' }, mItems.length + t(' elementos seleccionados. Arrastra cualquiera para moverlos juntos. Mayús + clic añade o quita; Mayús + arrastrar en una zona vacía selecciona con un recuadro.', ' items selected. Drag any to move them together. Shift-click adds or removes; Shift-drag on an empty area selects with a box.')),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => dupSelection() }, MC.icon('copy', 14), t('Duplicar', 'Duplicate')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const g = grouped ? null : MC.uid(); mSet((it) => { if (g) it.group = g; else delete it.group; }); MC.toast(grouped ? t('Desagrupado', 'Ungrouped') : t('Agrupados: se mueven y se seleccionan juntos', 'Grouped: they move and select together')); } }, MC.icon('layersx', 14), grouped ? t('Desagrupar', 'Ungroup') : t('Agrupar', 'Group')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const mn = Math.min(...mItems.filter((q) => !(q.k[0] === 'x' && q.it.link)).map((q) => q.it.start)), d = S.time - mn; mSet((it, k) => { if (k[0] === 'x' && it.link) return; it.start = Math.max(0, Math.round((it.start + d) * 100) / 100); if (k[0] === 'o') syncOvAudio(it); }); } }, t('Llevar al cabezal', 'Move to playhead')),
            h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', onClick: () => { mItems.forEach((q) => { if (q.k[0] === 'c') p.clips = p.clips.filter((c) => c.id !== q.it.id); else if (q.k[0] === 'x') p.texts = p.texts.filter((x) => x.id !== q.it.id); else removeOverlay(q.it); }); S.multi = []; S.selKind = 'shot'; commit(); } }, MC.icon('trash', 14), t('Eliminar', 'Delete'))),
          MC.ui.slider({ label: t('Desplazar todos', 'Nudge all'), min: -2, max: 2, step: 0.05, value: 0, fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(2) + ' s', onInput: () => {}, onChange: (v) => { mSet((it, k) => { if (k[0] === 'x' && it.link) return; it.start = Math.max(0, Math.round((it.start + v) * 100) / 100); if (k[0] === 'o') syncOvAudio(it); }); } }));
      }
      /* subtítulo seleccionado */
      const sbx = subById(S.sb), sbNodes = [];
      if (sbx) sbNodes.push(h('p', { class: 'cap' }, sbx.name + ' · ' + MC.fmtTime(sbx.start) + ' · ' + sbx.dur.toFixed(1) + ' s · ' + MC.subWordsOf(sbx, p.lang).filter((e) => !e.sil).length + t(' palabras', ' words')),
        h('button', { class: 'btn btn-p btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { if (S.ws !== 'creativo') setWs('creativo'); S.tab.creativo = 'subtitulos'; renderRail(); renderPanels(); } }, MC.icon('mic', 14), t('Abrir el editor de subtítulos', 'Open the subtitle editor')),
        h('p', { class: 'cap' }, t('Arrastra la capa para moverla con todas sus palabras. Haz clic en una línea para ir a ella.', 'Drag the layer to move it with all its words. Click a line to jump to it.')));
      /* marcador */
      const mkx = mkById(S.mk), mkNodes = [];
      if (mkx) {
        const MKC = ['#8C7CFF', '#e8c547', '#3ec97b', '#e5333d', '#4aa8ff', '#ffffff'];
        mkNodes.push(nameIn(t('Nota', 'Note'), mkx.text || '', (v) => { mkx.text = v; commit(); }),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Tipo', 'Type')), MC.ui.seg([{ v: 'note', l: t('Nota', 'Note') }, { v: 'beat', l: t('Pulso musical', 'Music beat') }], mkx.kind, (v) => { mkx.kind = v; commit(); })),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Color', 'Colour')), h('div', { class: 'swatches' }, MKC.map((c) => h('button', { type: 'button', class: 'sw', 'aria-label': c, 'aria-pressed': String((mkx.color || '').toLowerCase() === c.toLowerCase()), style: { background: c }, onClick: () => { mkx.color = c; commit(); } })))),
          MC.ui.slider({ label: t('Momento', 'Time'), min: 0, max: Math.max(MC.totalTime(p), mkx.t + 1), step: 0.01, value: mkx.t, fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { mkx.t = v; touch(); }, onChange: commit }),
          h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', style: { justifySelf: 'start' }, onClick: () => { p.notes = p.notes.filter((n) => n.id !== mkx.id); S.mk = null; S.selKind = 'shot'; commit(); } }, MC.icon('trash', 14), t('Eliminar', 'Delete')));
      }

      const ordered = [sec('plano', t('Plano', 'Shot') + ' · ' + sh.name, planoNodes), sec('camara', t('Cámara', 'Camera'), camNodes),
        sec('capa', l ? t('Capa', 'Layer') + ' · ' + l.name : t('Capa', 'Layer'), capaNodes), sec('proyecto', t('Formato y parallax', 'Format and parallax'), projNodes),
        sec('overlay', t('Superposición', 'Overlay') + (ovx ? ' · ' + ovx.name : ''), ovNodes), sec('multi', t('Selección múltiple', 'Multiple selection'), mNodes), sec('subs', t('Subtítulos', 'Subtitles') + (sbx ? ' · ' + sbx.name : ''), sbNodes), sec('marker', t('Marcador', 'Marker'), mkNodes), sec('vinetas', t('Viñetas del proyecto', 'Project panels'), vinetasNodes), sec('vineta', t('Viñeta del plano', 'Shot panel'), vinetaNodes), sec('transicion', t('Transición de entrada', 'Entry transition'), trNodes)];
      const allP = MC.presets.all(), presIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, id: 'f-presets', onChange: async (e) => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        try { const n = MC.presets.importFrom(await f.text()); renderInspector(); MC.toast(t(n + ' presets importados', n + ' presets imported')); } catch (err) { MC.toast(t('Ese archivo no es de presets de MotionComic Studio.', 'That file is not a MotionComic Studio presets file.')); }
      } });
      styleNodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Mis presets (cámara y efectos)', 'My presets (camera and effects)')),
        allP.length ? h('div', { style: { display: 'grid', gap: '2px' } }, allP.map((q) => h('div', { class: 'layer', style: { cursor: 'default' } }, h('span', { class: 'ln' }, q.name), h('span', { class: 'lz' }, q.kind === 'camera' ? t('cámara', 'camera') : t('efectos', 'effects')),
          h('button', { class: 'btn btn-g', type: 'button', title: t('Eliminar preset', 'Delete preset'), 'aria-label': t('Eliminar el preset ', 'Delete preset ') + q.name, onClick: () => { MC.presets.remove(q.id); renderInspector(); } }, MC.icon('trash', 14))))) : h('span', { class: 'cap' }, t('Guarda movimientos y pilas de efectos desde sus secciones.', 'Save movements and effect stacks from their sections.')),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !allP.length, onClick: () => MC.download(new Blob([MC.presets.exportAll()], { type: 'application/json' }), 'mis-presets.motioncomic-presets.json') }, MC.icon('download', 14), t('Exportar presets', 'Export presets')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => presIn.click() }, MC.icon('upload', 14), t('Importar presets', 'Import presets')), presIn)));
      const estiloSec = sec('estilo', t('Mi estilo y presets', 'My style and presets'), styleNodes);
      const D = {};
      [].concat(ordered, layerAnimSecs, ovAnimSec, textSecs, pageSecs, fxSecs, audioSecs, [idiomasSec, lookSec, estiloSec]).forEach((d) => { D[d.id] = d; });
      return D;
    }

    /* ---------- carril y paneles ---------- */
    function renderRail() {
      MC.clear(el.rail);
      MC.put(el.rail, WS[S.ws].tabs.map((id) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(curTab() === id), title: tabLabel(id), onClick: () => { S.tab[S.ws] = id; renderRail(); renderPanels(); [el.leftEl].forEach((n) => { n.classList.remove('wsfade'); void n.offsetWidth; n.classList.add('wsfade'); }); } }, MC.icon(TABS[id][0], 22), tabLabel(id))));
    }
    const thumbCache = new Map();
    const djb = (str) => { let hh = 5381; for (let i = 0; i < str.length; i++) hh = ((hh << 5) + hh + str.charCodeAt(i)) | 0; return hh; };
    const thumbKey = (sh) => sh.id + ':' + djb(JSON.stringify([sh.layers, sh.camera && sh.camera.from, sh.camera && sh.camera.to, sh.camera && sh.camera.path, sh.page && sh.page.panels.length, sh.frame, S.project.frame, S.project.ratio]));
    /* Miniatura del plano como imagen, para el fondo de su clip en la línea de tiempo. */
    const clipThumbs = new Map();
    function shotThumbURL(sh) {
      const key = thumbKey(sh); if (clipThumbs.has(key)) return clipThumbs.get(key);
      const c = shotThumb(sh), u = c.toDataURL('image/jpeg', 0.55);
      if (clipThumbs.size > 120) clipThumbs.clear(); clipThumbs.set(key, u); return u;
    }
    function shotThumb(sh) {
      const key = thumbKey(sh), c = document.createElement('canvas'); c.width = 172; c.height = 112;
      if (!thumbCache.has(key)) {
        const tc = document.createElement('canvas'), o = opts({ fx: false, noLook: true, lang: S.project.lang });
        const k = Math.min(172 / o.W, 112 / o.H); tc.width = Math.max(1, Math.round(o.W * k)); tc.height = Math.max(1, Math.round(o.H * k));
        const g = tc.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
        try { MC.renderShot(g, sh, Math.min(sh.duration * 0.15, 0.6), o); } catch (e) { /* sin miniatura */ }
        if (thumbCache.size > 80) thumbCache.clear();
        thumbCache.set(key, tc);
      }
      const tc = thumbCache.get(key), g = c.getContext('2d');
      g.drawImage(tc, (172 - tc.width) / 2, (112 - tc.height) / 2);
      return c;
    }
    function shotsPanel() {
      const p = S.project, mode = p.mode;
      const list = h('div', { style: { display: 'grid', gap: '8px' } }, p.shots.map((sh, i) => h('div', { class: 'shotcard' + (i === S.si ? ' on' : ''), role: 'button', tabindex: '0', 'aria-label': sh.name + ', ' + sh.duration.toFixed(1) + ' s', onClick: () => selectShot(i, true), onKeydown: (e) => { if (e.key === 'Enter') selectShot(i, true); } },
        shotThumb(sh), h('div', { style: { minWidth: 0 } }, h('b', null, sh.name), h('span', { class: 'cap' }, sh.duration.toFixed(1) + ' s' + (sh.page ? ' · ' + sh.page.panels.length + t(' viñetas', ' panels') : sh.webtoon ? ' · ' + sh.webtoon.stops.length + t(' pausas', ' pauses') : ''))),
        h('div', { style: { display: 'grid' } },
          h('button', { class: 'btn btn-g', type: 'button', style: { padding: '2px', width: '26px', height: '24px' }, disabled: i === 0, title: t('Subir', 'Move up'), 'aria-label': t('Subir', 'Move up'), onClick: (e) => { e.stopPropagation(); p.shots.splice(i - 1, 0, p.shots.splice(i, 1)[0]); S.si = i - 1; commit(); } }, MC.icon('up', 14)),
          h('button', { class: 'btn btn-g', type: 'button', style: { padding: '2px', width: '26px', height: '24px' }, disabled: i === p.shots.length - 1, title: t('Bajar', 'Move down'), 'aria-label': t('Bajar', 'Move down'), onClick: (e) => { e.stopPropagation(); p.shots.splice(i + 1, 0, p.shots.splice(i, 1)[0]); S.si = i + 1; commit(); } }, MC.icon('down', 14))))));
      return [h('div', { class: 'box' }, h('button', { class: 'btn btn-p', type: 'button', onClick: () => fileShots.click() }, MC.icon('plus', 15), mode === 'page' ? t('Añadir páginas', 'Add pages') : mode === 'webtoon' ? t('Añadir una tira', 'Add a strip') : t('Añadir planos desde imágenes', 'Add shots from images')), h('p', { class: 'cap' }, t('Acepta PNG, JPEG, WebP, PSD y PDF. Selecciona uno para editarlo; arrástralo en la línea de tiempo para estirarlo.', 'Accepts PNG, JPEG, WebP, PSD and PDF. Select one to edit it; stretch it on the timeline.'))), list];
    }
    function resourcesPanel() {
      const p = S.project, ids = [...new Set(p.shots.flatMap((sh) => sh.layers.map((l) => l.assetId)))], aud = [...new Set(p.clips.map((c) => c.assetId))];
      const row = (thumb, name, meta, drag) => h('div', Object.assign({ class: 'layer', style: { cursor: drag ? 'grab' : 'default' }, title: drag ? t('Arrástralo a la línea de tiempo o a las capas', 'Drag it to the timeline or the layers') : null }, drag ? { draggable: 'true', onDragstart: (e) => { e.dataTransfer.setData(MIME_ASSET, JSON.stringify([drag])); e.dataTransfer.effectAllowed = 'copy'; } } : {}), thumb ? h('img', { class: 'lt', src: thumb, alt: '' }) : h('span', { class: 'lt' }), h('span', { class: 'ln' }, name), h('span', { class: 'lz' }, meta));
      const dirIn = h('input', { type: 'file', webkitdirectory: '', directory: '', multiple: true, hidden: true, onChange: (e) => { const fs = [...e.target.files].filter((f) => !/(^|\/)\./.test(f.webkitRelativePath || f.name)); e.target.value = ''; if (fs.length) importFiles(fs, 'layers'); } });
      const fontIn = h('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2', hidden: true, onChange: async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const rec = await MC.fonts.add(f); p.fonts.push(rec); commit(); MC.toast(t('Tipografía añadida: ', 'Font added: ') + rec.name); } catch (err) { MC.toast(t('No se pudo leer esa tipografía.', 'Could not read that font.')); } } });
      return [h('div', { class: 'box' }, h('div', { class: 'big-btns' },
        h('button', { class: 'btn btn-s', type: 'button', onClick: () => fileLayers.click() }, MC.icon('image', 20), t('Capas o páginas', 'Layers or pages')),
        h('button', { class: 'btn btn-s', type: 'button', onClick: () => { fileAudio.dataset.track = 'auto'; fileAudio.click(); } }, MC.icon('speaker', 20), t('Audio', 'Audio')),
        h('button', { class: 'btn btn-s', type: 'button', onClick: () => fontIn.click() }, MC.icon('text', 20), t('Tipografía', 'Font')),
        h('button', { class: 'btn btn-s', type: 'button', onClick: () => fileShots.click() }, MC.icon('film', 20), t('Planos', 'Shots')),
        h('button', { class: 'btn btn-s', type: 'button', title: t('Importa todas las imágenes de una carpeta', 'Import every image in a folder'), onClick: () => dirIn.click() }, MC.icon('folder', 20), t('Carpeta', 'Folder'))), fontIn, dirIn),
      h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Imágenes del proyecto · ', 'Project images · ') + ids.length), ids.length ? h('div', { style: { display: 'grid', gap: '2px' } }, ids.map((id) => { const a = MC.assets.get(id); return a ? row(a.thumb, a.name, (a.video ? t('vídeo · ', 'video · ') : '') + a.w + '×' + a.h + (a.proxy ? ' · ' + t('proxy', 'proxy') : ''), { id, kind: a.video ? 'video' : 'image' }) : null; })) : h('p', { class: 'cap' }, t('Aún no hay imágenes.', 'No images yet.'))),
      h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Audio · ', 'Audio · ') + aud.length), aud.length ? h('div', { style: { display: 'grid', gap: '2px' } }, aud.map((id) => { const a = MC.audio.get(id); return a ? row(null, a.name, a.dur.toFixed(1) + ' s', { id, kind: 'audio' }) : null; })) : h('p', { class: 'cap' }, t('Aún no hay audio.', 'No audio yet.'))),
      p.fonts.length ? h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Tipografías propias', 'Your fonts')), h('div', { style: { display: 'grid', gap: '2px' } }, p.fonts.map((f) => row(null, f.name, 'TTF/OTF')))) : null];
    }
    /* ---------- biblioteca compartida entre proyectos ---------- */
    S.libItems = []; S.lib = { q: '', folder: '', tag: '' };
    async function loadLib(rerender) { try { S.libItems = await MC.library.list(); } catch (e) { S.libItems = []; } if (rerender !== false && S.alive && curTab() === 'biblioteca') renderPanels(); }
    async function toLibrary(assetId, label) {
      try { const it = await MC.library.add(assetId); if (!it) { MC.toast(t('No se pudo guardar en la biblioteca.', 'Could not save to the library.')); return; } await loadLib(); MC.toast(t('Guardado en la biblioteca: ', 'Saved to the library: ') + (label || it.name)); } catch (e) { MC.toast(t('No se pudo guardar en la biblioteca.', 'Could not save to the library.')); }
    }
    async function useFromLibrary(it, how) {
      const p = S.project;
      try {
        if (it.kind === 'audio') { const a = await MC.audio.load(it.id); const c = MC.audio.newClip(how === 'musica' ? 'musica' : how === 'sfx' ? 'sfx' : how === 'voz' ? 'voz' : (a.dur >= 20 ? 'musica' : 'sfx'), a, S.time); p.clips.push(c); S.cl = c.id; S.tx = null; commit(); return; }
        const a = await MC.assets.load(it.id); if (!a) { MC.toast(t('Ese recurso ya no está disponible.', 'That asset is no longer available.')); return; }
        if (how === 'overlay') { const o = MC.newOverlay(a, { track: 0, start: S.time, dur: 4 }); o.scale = 0.6; if (!a.video) o.dur = Math.max(1, Math.min(MC.totalTime(p) - S.time, 6)) || 4; p.overlays.push(o); S.ov = o.id; S.cl = null; S.tx = null; S.li = -1; commit(); return; }
        const sh = shot(), empty = sh.layers.length === 0, L = MC.newLayer(a, empty ? { z: 0.1, role: 'fondo' } : { z: 0.5, role: '' }); if (a.video) L.vloop = true; sh.layers.push(L); S.li = sh.layers.length - 1; commit(); checkMemory();
      } catch (e) { MC.toast(t('No se pudo usar ese recurso.', 'Could not use that asset.')); }
    }
    function libraryPanel() {
      if (!S.libLoaded) { S.libLoaded = true; loadLib(); }
      const items = S.libItems || [], q = (S.lib.q || '').toLowerCase().trim();
      const folders = [...new Set(items.map((x) => x.folder || '').filter(Boolean))].sort(), tags = [...new Set(items.flatMap((x) => x.tags || []))].sort();
      const shown = items.filter((x) => (!S.lib.folder || x.folder === S.lib.folder) && (!S.lib.tag || (x.tags || []).includes(S.lib.tag)) && (!q || (x.name + ' ' + (x.tags || []).join(' ') + ' ' + (x.folder || '')).toLowerCase().includes(q)));
      const libIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,video/*,.mp4,.m4v,.mov,.webm,audio/*,.wav,.mp3,.m4a,.ogg', multiple: true, hidden: true, onChange: async (e) => {
        const fs = [...e.target.files]; e.target.value = '';
        for (const f of fs) { try { const isV = MC.video.isFile(f), isA = /^audio\//.test(f.type) || /\.(wav|mp3|m4a|ogg)$/i.test(f.name); const a = isV ? await MC.video.add(f, f.name) : isA ? await MC.audio.add(f, f.name) : await MC.assets.add(f, f.name); await MC.library.add(a.id, { folder: S.lib.folder || '' }); } catch (err) { MC.toast(t('No se pudo leer ', 'Could not read ') + f.name); } }
        await loadLib(); MC.toast(t('Añadido a la biblioteca', 'Added to the library'));
      } });
      const editItem = (it) => {
        const nm = h('input', { class: 'input', value: it.name, id: 'lb-n' }), fo = h('input', { class: 'input', value: it.folder || '', id: 'lb-f', list: 'lb-fl', placeholder: t('Sin carpeta', 'No folder') }), tg = h('input', { class: 'input', value: (it.tags || []).join(', '), id: 'lb-t', placeholder: t('personaje, fondo, noche…', 'character, background, night…') });
        MC.modal(t('Editar recurso de la biblioteca', 'Edit library asset'), h('div', { style: { display: 'grid', gap: '12px' } }, MC.ui.field(t('Nombre', 'Name'), nm, 'lb-n'), MC.ui.field(t('Carpeta', 'Folder'), fo, 'lb-f'), h('datalist', { id: 'lb-fl' }, folders.map((f) => h('option', { value: f }))), MC.ui.field(t('Etiquetas (separadas por comas)', 'Tags (comma separated)'), tg, 'lb-t')),
          (close) => [h('button', { class: 'btn btn-s', type: 'button', onClick: close }, t('Cancelar', 'Cancel')), h('button', { class: 'btn btn-p', type: 'button', onClick: async () => { await MC.library.update(it.id, { name: nm.value.trim() || it.name, folder: fo.value.trim(), tags: tg.value.split(',').map((x) => x.trim()).filter(Boolean) }); close(); loadLib(); } }, t('Guardar', 'Save'))]);
      };
      const card = (it) => {
        const menu = h('div', { class: 'libact' },
          it.kind === 'audio' ? [h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => useFromLibrary(it, 'auto') }, MC.icon('plus', 13), t('Añadir al audio', 'Add to audio'))]
            : [h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => useFromLibrary(it, 'layer') }, MC.icon('layersx', 13), t('Como capa', 'As layer')), h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => useFromLibrary(it, 'overlay') }, MC.icon('image', 13), t('Superpuesto', 'As overlay'))],
          h('button', { class: 'btn btn-g btn-sm', type: 'button', title: t('Carpeta y etiquetas', 'Folder and tags'), 'aria-label': t('Editar ', 'Edit ') + it.name, onClick: () => editItem(it) }, MC.icon('gear', 13)),
          h('button', { class: 'btn btn-g btn-sm', type: 'button', title: t('Quitar de la biblioteca (no borra el archivo de tus proyectos)', 'Remove from the library (does not delete it from your projects)'), 'aria-label': t('Quitar ', 'Remove ') + it.name, onClick: async () => { await MC.library.remove(it.id); loadLib(); } }, MC.icon('trash', 13)));
        return h('div', { class: 'libcard', draggable: 'true', title: t('Arrástralo a la línea de tiempo o a las capas', 'Drag it to the timeline or the layers'), onDragstart: (e) => { e.dataTransfer.setData(MIME_ASSET, JSON.stringify([{ id: it.id, kind: it.kind }])); e.dataTransfer.effectAllowed = 'copy'; } }, it.thumb ? h('img', { class: 'lt', src: it.thumb, alt: '' }) : h('span', { class: 'lt' + (it.kind === 'audio' ? ' au' : '') }, it.kind === 'audio' ? MC.icon('note', 18) : null),
          h('div', { style: { minWidth: 0 } }, h('b', { class: 'ln' }, it.name), h('span', { class: 'cap' }, ({ image: t('imagen', 'image'), video: t('vídeo', 'video'), audio: t('audio', 'audio') })[it.kind] + (it.folder ? ' · ' + it.folder : '') + ((it.tags || []).length ? ' · #' + it.tags.join(' #') : '')), menu));
      };
      return [h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Biblioteca · ', 'Library · ') + items.length),
        h('p', { class: 'cap' }, t('Tus recursos guardados para usar en cualquier proyecto: personajes, fondos, efectos de sonido… Se quedan en este equipo.', 'Your saved assets to use in any project: characters, backgrounds, sound effects… They stay on this device.')),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: () => libIn.click() }, MC.icon('upload', 14), t('Importar a la biblioteca', 'Import to the library')), libIn),
        h('input', { class: 'input', type: 'search', 'aria-label': t('Buscar en la biblioteca', 'Search the library'), placeholder: t('Buscar por nombre, carpeta o etiqueta', 'Search by name, folder or tag'), value: S.lib.q, onInput: (e) => { S.lib.q = e.target.value; const pos = e.target.selectionStart; renderPanels(); const n = el.leftBody.querySelector('input[type=search]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } }),
        folders.length ? h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Carpeta', 'Folder')), MC.ui.chips([{ v: '', l: t('Todas', 'All') }].concat(folders.map((f) => ({ v: f, l: f }))), S.lib.folder, (v) => { S.lib.folder = v; renderPanels(); })) : null,
        tags.length ? h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Etiqueta', 'Tag')), MC.ui.chips([{ v: '', l: t('Todas', 'All') }].concat(tags.map((x) => ({ v: x, l: '#' + x }))), S.lib.tag, (v) => { S.lib.tag = v; renderPanels(); })) : null),
      h('div', { class: 'box' }, shown.length ? h('div', { style: { display: 'grid', gap: '6px' } }, shown.map(card)) : h('p', { class: 'cap' }, items.length ? t('Nada coincide con la búsqueda.', 'Nothing matches the search.') : t('La biblioteca está vacía. Importa archivos aquí, o usa «Guardar en la biblioteca» en una capa, una superposición o un clip de audio.', 'The library is empty. Import files here, or use “Save to the library” on a layer, overlay or audio clip.')))];
    }
    /* ---------- archivo del proyecto y versiones ---------- */
    async function saveFile() {
      try {
        MC.toast(t('Preparando el archivo…', 'Preparing the file…')); await save();
        const bytes = await MC.downloadProjectFile(S.project); MC.toast(t('Archivo guardado (', 'File saved (') + (bytes / 1048576).toFixed(1) + ' MB)');
      } catch (e) { console.error(e); MC.toast(t('No se pudo crear el archivo. Prueba a exportar con menos recursos.', 'Could not create the file. Try with fewer assets.')); }
    }
    async function saveVersion(label) { try { const v = await MC.versions.save(S.project, label || '', false); MC.toast(v ? t('Versión guardada', 'Version saved') : t('No se pudo guardar la versión.', 'Could not save the version.')); } catch (e) { MC.toast(t('No se pudo guardar la versión.', 'Could not save the version.')); } }
    async function openVersions() {
      const list = await MC.versions.list(S.project.id), fmt = (d) => new Date(d).toLocaleString(MC.lang === 'en' ? 'en-GB' : 'es-ES', { dateStyle: 'medium', timeStyle: 'short' });
      const body = h('div', { class: 'vers' }, list.length ? list.map((v) => { const pj = MC.versions.parse(v);
        return h('div', { class: 'verrow' }, h('div', { style: { minWidth: 0 } }, h('b', null, v.label || (v.auto ? t('Guardado automático', 'Autosave') : t('Versión', 'Version'))), h('span', { class: 'cap' }, fmt(v.t) + ' · ' + pj.shots.length + t(' planos', ' shots') + ' · ' + (v.size / 1024).toFixed(0) + ' KB')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: async () => { await MC.versions.save(S.project, t('Antes de restaurar', 'Before restoring'), false); const r = MC.versions.parse(v); r.id = S.project.id; r.updated = Date.now(); S.project = MC.normalizeProject(r); await MC.loadProjectAssets(S.project); S.si = 0; S.li = -1; S.selKind = 'project'; fit(); renderAll(); pushHist(); touch(); document.querySelector('.scrim') && document.querySelector('.scrim').remove(); MC.toast(t('Versión restaurada', 'Version restored')); } }, MC.icon('undo', 13), t('Restaurar', 'Restore')),
          h('button', { class: 'btn btn-g btn-sm', type: 'button', 'aria-label': t('Eliminar esta versión', 'Delete this version'), onClick: async (e) => { await MC.versions.remove(v.id); e.currentTarget.closest('.verrow').remove(); } }, MC.icon('trash', 13))); })
        : h('p', { class: 'cap' }, t('Aún no hay versiones guardadas. Se guardan solas cada pocos minutos mientras editas, y puedes guardar una a mano con un nombre.', 'No saved versions yet. They are saved automatically every few minutes while you edit, and you can save one by hand with a name.')));
      MC.modal(t('Versiones guardadas', 'Saved versions'), body, (close) => [h('button', { class: 'btn btn-s', type: 'button', onClick: async () => { const n = prompt(t('Nombre de la versión', 'Version name'), ''); if (n === null) return; await saveVersion(n.trim()); close(); openVersions(); } }, MC.icon('bookmark', 14), t('Guardar una versión ahora', 'Save a version now')), h('button', { class: 'btn btn-p', type: 'button', onClick: close }, t('Cerrar', 'Close'))], { wide: true });
    }
    /* tabla de traducción: todos los textos del proyecto, una columna por idioma */
    function openTranslations() {
      const p = S.project, langs = p.langs, rows = p.texts.slice().sort((a, b) => MC.textSpan(a, p).start - MC.textSpan(b, p).start);
      const miss = () => rows.reduce((n, x) => n + langs.filter((l) => !(x.t[l] || '').trim()).length, 0);
      const info = h('span', { class: 'cap' });
      const upd = () => { const m = miss(); info.textContent = m ? m + t(' celdas sin traducir', ' untranslated cells') : t('Todo traducido', 'Everything translated'); info.className = 'cap ' + (m ? 'warn' : 'good'); };
      const tbl = h('table', { class: 'trtable' }, h('thead', null, h('tr', null, h('th', null, t('Tiempo', 'Time')), h('th', null, t('Tipo', 'Type')), langs.map((l) => h('th', null, l.toUpperCase())))),
        h('tbody', null, rows.map((x) => h('tr', null, h('td', null, MC.fmtTime(MC.textSpan(x, p).start)), h('td', null, { bubble: t('bocadillo', 'bubble'), box: t('caja', 'box'), sfx: 'sfx', sub: t('subt.', 'sub') }[x.kind]),
          langs.map((l) => { const ta = h('textarea', { class: 'input', rows: 2, 'aria-label': l.toUpperCase() + ' · ' + MC.fmtTime(MC.textSpan(x, p).start), value: x.t[l] || '', onInput: (e) => { x.t[l] = e.target.value; ta.classList.toggle('empty', !e.target.value.trim()); upd(); S.dirty = true; touch(); } }); ta.classList.toggle('empty', !(x.t[l] || '').trim()); return h('td', null, ta); })))));
      upd();
      MC.modal(t('Tabla de traducción', 'Translation table'), h('div', { style: { display: 'grid', gap: '10px' } }, info, rows.length ? h('div', { class: 'trwrap' }, tbl) : h('p', { class: 'cap' }, t('Aún no hay textos en el proyecto.', 'There are no texts in the project yet.'))),
        (close) => [h('button', { class: 'btn btn-p', type: 'button', onClick: () => { close(); commit(); } }, t('Listo', 'Done'))], { wide: true });
    }
    function renderFileMenu() {
      if (el.fileMenu) { el.fileMenu.remove(); el.fileMenu = null; }
      if (!S.fileOpen || !el.fileBtn) return;
      const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
      const item = (ic, label, fn) => h('button', { type: 'button', onClick: () => { S.fileOpen = false; renderFileMenu(); el.fileBtn.setAttribute('aria-expanded', 'false'); fn(); } }, MC.icon(ic, 15), label);
      el.fileMenu = h('div', { class: 'tmenu vmenu', role: 'menu', onKeydown: (e) => { if (e.key === 'Escape') { S.fileOpen = false; renderFileMenu(); el.fileBtn.focus(); } } },
        item('download', t('Guardar una copia en un archivo (.motioncomic)', 'Save a copy to a file (.motioncomic)'), saveFile),
        item('bookmark', t('Guardar una versión ahora…', 'Save a version now…'), () => { const n = prompt(t('Nombre de la versión (opcional)', 'Version name (optional)'), ''); if (n !== null) saveVersion(n.trim()); }),
        item('undo', t('Versiones guardadas…', 'Saved versions…'), openVersions),
        item('copy', t('Duplicar este proyecto', 'Duplicate this project'), async () => { await save(); await MC.duplicateProject(S.project); MC.toast(t('Proyecto duplicado: lo verás en el inicio', 'Project duplicated: you will find it on the home screen')); }),
        h('p', { class: 'cap', style: { padding: '6px 10px', maxWidth: '300px' } }, standalone ? t('Tus proyectos viven en este equipo. Guarda copias en archivo de vez en cuando.', 'Your projects live on this device. Save file copies now and then.') : t('Consejo: MotionComic Studio funciona mejor instalado en tu ordenador o tableta: tiene más memoria, el navegador no borra tus datos y funciona sin conexión. Guarda también copias en archivo.', 'Tip: MotionComic Studio works best installed on your computer or tablet: more memory, the browser will not clear your data and it works offline. Also save file copies.')),
        !standalone && MC.installEvt ? h('button', { type: 'button', onClick: async () => { S.fileOpen = false; renderFileMenu(); MC.installEvt.prompt(); } }, MC.icon('download', 15), t('Instalar la aplicación', 'Install the app')) : null);
      el.fileBtn.parentNode.append(el.fileMenu);
    }
    /* ---------- subtítulos: capas con palabras y silencios ---------- */
    const SUB_FONTS = () => MC.FONTS.map((f) => ({ id: f.id, n: t(f.es, f.en) })).concat(S.project.fonts.map((f) => ({ id: f.id, n: f.name })));
    function newSubLayer(fromVoice) {
      const p = S.project; let start = S.time, dur = 6, link = null;
      if (fromVoice) { const vc = p.clips.find((c) => c.track === 'voz' && S.time >= c.start && S.time < c.start + c.dur) || p.clips.find((c) => c.track === 'voz'); if (!vc) { MC.toast(t('Añade antes una locución en la pista de voz.', 'Add a voice-over on the voice track first.')); return; } start = vc.start; dur = vc.dur; link = vc.id; }
      else { const vc = p.clips.find((c) => c.track === 'voz' && S.time >= c.start && S.time < c.start + c.dur - 0.05); if (vc) { start = vc.start; dur = vc.dur; link = vc.id; } }
      const it = MC.newSub(p, start, dur, link); p.subs.push(it); S.sb = it.id; S.swi = 0; S.cl = null; S.tx = null; S.ov = null; S.li = -1; S.multi = [];
      if (S.ws !== 'creativo') setWs('creativo'); S.tab.creativo = 'subtitulos'; renderRail(); commit();
      MC.toast(link ? t('Subtítulo creado sobre la locución. Escribe el texto y márcalo palabra a palabra.', 'Subtitle created over the voice-over. Type the text and mark it word by word.') : t('Subtítulo creado. Escribe el texto y márcalo palabra a palabra.', 'Subtitle created. Type the text and mark it word by word.'));
    }
    const subWords = (it) => it.words && it.words[S.project.lang] ? it.words[S.project.lang] : (it.words = it.words || {}, it.words[S.project.lang] = []);
    function markWord() {
      const it = subById(S.sb); if (!it) return; const list = subWords(it); let i = S.swi; while (i < list.length && list[i].sil) i++;
      if (i >= list.length) { MC.toast(t('Todas las palabras tienen ya su momento.', 'Every word already has its moment.')); return; }
      list[i].s = Math.round(S.time * 1000) / 1000; delete list[i].est; S.swi = i + 1; while (S.swi < list.length && list[S.swi].sil) S.swi++;
      touch(); renderPanels(); renderTimeline(); S.dirty = true; MC.announce(list[i].w);
    }
    function silenceHere() {
      const it = subById(S.sb); if (!it) return; const list = subWords(it), at = Math.min(list.length, S.swi);
      list.splice(at, 0, { sil: true, s: Math.round(S.time * 1000) / 1000 }); S.swi = at + 1; touch(); renderPanels(); renderTimeline(); S.dirty = true;
    }
    function unmarkWord() {
      const it = subById(S.sb); if (!it) return; const list = subWords(it); let i = Math.min(S.swi, list.length) - 1; if (i < 0) return;
      if (list[i].sil) { list.splice(i, 1); S.swi = i; } else { list[i].s = null; delete list[i].est; S.swi = i; }
      touch(); renderPanels(); renderTimeline(); S.dirty = true;
    }
    function subCountText(it) { const l = subWords(it).filter((e) => !e.sil); return l.length + t(' palabras · ', ' words · ') + l.filter((e) => e.s != null).length + t(' con su momento', ' timed'); }
    const subPresetGrid = (apply, current) => h('div', { class: 'subprs', role: 'group', 'aria-label': t('Estilos de subtítulos', 'Subtitle styles') }, MC.SUB_PRESETS.map((pr) => {
      const cv = h('canvas', { width: 220, height: 92, 'aria-hidden': 'true' }); try { MC.subPreview(cv, S.project, MC.subStyle(pr.s)); } catch (e) { /* sin muestra */ }
      return h('button', { type: 'button', class: 'subpr', 'aria-pressed': String(current === pr.v), title: t(pr.es, pr.en), onClick: () => apply(pr) }, cv, h('span', null, t(pr.es, pr.en)));
    }));
    function subsPanel() {
      const p = S.project, lang = p.lang, it = subById(S.sb), out = [];
      const imp = h('input', { type: 'file', accept: '.json,.srt,.vtt,.csv,.tsv,.txt,application/json,text/*', hidden: true, onChange: async (e) => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        try {
          const ws = MC.parseTimings(await f.text(), f.name); if (!ws.length) { MC.toast(t('No encontré palabras con tiempo en ese archivo.', 'I found no timed words in that file.')); return; }
          let tgt = subById(S.sb); const fresh = !tgt || subWords(tgt).length; let off = 0;
          if (!tgt || (subWords(tgt).length && !confirm(t('Ya hay palabras en este subtítulo. ¿Reemplazarlas con las del archivo?', 'This subtitle already has words. Replace them with the ones in the file?')))) { if (!tgt) { const vc = p.clips.find((c) => c.track === 'voz'); tgt = MC.newSub(p, vc ? vc.start : S.time, 5, vc ? vc.id : null); p.subs.push(tgt); } else return; }
          off = tgt.start; const n = MC.subApplyTimings(tgt, lang, ws, off, 0.35); S.sb = tgt.id; S.swi = 0; commit(); MC.toast(t(ws.length + ' palabras importadas con su momento (' + n + ' entradas).', ws.length + ' timed words imported (' + n + ' entries).'));
        } catch (err) { console.error(err); MC.toast(t('No pude leer ese archivo de tiempos.', 'I could not read that timing file.')); }
      } });
      const hasVoice = p.clips.some((c) => c.track === 'voz'), legacy = p.texts.filter((x) => x.kind === 'sub');
      out.push(h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Capas de subtítulos · ', 'Subtitle layers · ') + p.subs.length),
        h('p', { class: 'cap' }, t('Una capa guarda todo el texto de una locución y el momento de cada palabra. Se divide sola en líneas, que ves dentro de la capa en la línea de tiempo.', 'A layer holds all the text of a voice-over and the moment of every word. It splits into lines by itself, which you see inside the layer on the timeline.')),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: () => newSubLayer(false) }, MC.icon('plus', 14), t('Nuevo subtítulo', 'New subtitle')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !hasVoice, title: t('Crea la capa con la duración de la locución', 'Creates the layer with the voice-over length'), onClick: () => newSubLayer(true) }, MC.icon('mic', 14), t('Sobre la locución', 'Over the voice-over')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', title: t('JSON (Whisper, Deepgram, ElevenLabs…), SRT, VTT o CSV con el momento de cada palabra', 'JSON (Whisper, Deepgram, ElevenLabs…), SRT, VTT or CSV with the moment of each word'), onClick: () => imp.click() }, MC.icon('upload', 14), t('Importar tiempos', 'Import timings')), imp,
          legacy.length ? h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: convertLegacySubs }, t('Convertir los ' + legacy.length + ' subtítulos antiguos', 'Convert the ' + legacy.length + ' old subtitles')) : null),
        p.subs.length ? h('div', { style: { display: 'grid', gap: '2px' } }, p.subs.map((q) => h('div', { class: 'layer' + (q.id === S.sb ? ' on' : ''), role: 'button', tabindex: '0', onClick: () => { S.sb = q.id; S.swi = 0; S.cl = null; S.tx = null; S.ov = null; S.li = -1; setTime(q.start + 0.01); commit(); }, onKeydown: (e) => { if (e.key === 'Enter') e.currentTarget.click(); } },
          h('span', { class: 'lt' }, MC.icon('mic', 16)), h('span', { class: 'ln' }, q.name), h('span', { class: 'lz' }, MC.fmtTime(q.start))))) : h('p', { class: 'cap' }, t('Aún no hay subtítulos.', 'There are no subtitles yet.'))));
      if (it) {
        const list = subWords(it), cues = MC.subCues(it, lang, it.style), sel = list[S.swi];
        /* texto */
        const ta = h('textarea', { class: 'input', rows: 5, id: 'sb-text', 'aria-label': t('Texto del subtítulo', 'Subtitle text'), placeholder: t('Escribe o pega aquí todo lo que se dice…', 'Type or paste everything that is said here…'), value: (it.text && it.text[lang]) || '',
          onInput: (e) => { MC.subSetText(it, lang, e.target.value); cnt.textContent = subCountText(it); S.dirty = true; touch(); }, onChange: () => { commit(); } });
        const cnt = h('span', { class: 'cap' }, subCountText(it));
        out.push(h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Texto', 'Text') + ' · ' + lang.toUpperCase()), ta, cnt,
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !list.length, title: t('Reparte las palabras por igual en toda la capa', 'Spreads the words evenly across the whole layer'), onClick: () => { MC.subDistribute(it, lang, it.start, it.start + it.dur, false, p); commit(); } }, t('Repartir por igual', 'Spread evenly')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !list.length || !hasVoice, title: t('Reparte las palabras saltándose las pausas de la voz', 'Spreads the words skipping the voice pauses'), onClick: () => { MC.subDistribute(it, lang, it.start, it.start + it.dur, true, p); commit(); } }, t('Ajustar a las pausas de la voz', 'Fit to voice pauses')))));
        /* sincronizar */
        const wordChips = list.length ? h('div', { class: 'swords', role: 'listbox', 'aria-label': t('Palabras', 'Words') }, list.map((e, i) => e.sil
          ? h('button', { type: 'button', class: 'sw sil' + (i === S.swi ? ' cur' : ''), role: 'option', title: t('Silencio desde ', 'Silence from ') + e.s.toFixed(2) + ' s', onClick: () => { S.swi = i; setTime(e.s); renderPanels(); } }, '⏸ ' + e.s.toFixed(2))
          : h('button', { type: 'button', class: 'sw' + (e.s == null ? ' none' : '') + (i === S.swi ? ' cur' : '') + (e.br ? ' br' : ''), role: 'option', 'aria-selected': String(i === S.swi), onClick: () => { S.swi = i; if (e.s != null) setTime(e.s); renderPanels(); } }, e.w, e.s != null ? h('small', null, e.s.toFixed(2)) : null))) : h('p', { class: 'cap' }, t('Escribe el texto de arriba para ver aquí sus palabras.', 'Type the text above to see its words here.'));
        const next = (() => { let i = S.swi; while (i < list.length && list[i].sil) i++; return list[i]; })();
        out.push(h('div', { class: 'box sync' }, h('div', { class: 'eyebrow' }, t('Marcar palabra a palabra', 'Mark word by word')),
          h('p', { class: 'cap' }, t('Reproduce la voz (o mueve el cursor de la línea de tiempo) y, en el momento en que se dice la palabra marcada, pulsa «Fijar» o Intro. Pasa sola a la siguiente. Si hay un silencio, pulsa «Silencio» (o el punto) en ese momento.', 'Play the voice (or move the timeline cursor) and, at the moment the highlighted word is said, press “Set” or Enter. It moves to the next one by itself. If there is a silence, press “Silence” (or the full stop) at that moment.')),
          h('div', { class: 'syncbar' },
            h('button', { class: 'btn btn-s', type: 'button', onClick: () => togglePlay() }, MC.icon(S.playing ? 'pause' : 'play', 14), S.playing ? t('Pausar', 'Pause') : t('Reproducir', 'Play')),
            h('button', { class: 'btn btn-p', type: 'button', disabled: !next, onClick: markWord }, MC.icon('plus', 14), next ? t('Fijar «', 'Set “') + next.w + t('» aquí', '” here') + ' ↵' : t('Todo marcado', 'All set')),
            h('button', { class: 'btn btn-s', type: 'button', onClick: silenceHere, title: t('Hay un silencio a partir del cursor', 'There is a silence from the cursor on') }, '⏸ ' + t('Silencio', 'Silence') + ' ·'),
            h('button', { class: 'btn btn-g', type: 'button', onClick: unmarkWord, title: t('Deshacer la última palabra marcada', 'Undo the last marked word') }, MC.icon('undo', 14), t('Atrás', 'Back'))),
          wordChips,
          sel ? h('div', { class: 'swedit' }, sel.sil
            ? [h('span', { class: 'cap' }, t('Silencio desde', 'Silence from')), h('input', { class: 'input', type: 'number', step: '0.01', value: sel.s, 'aria-label': t('Inicio del silencio en segundos', 'Silence start in seconds'), onChange: (e) => { sel.s = Math.max(0, +e.target.value || 0); commit(); } }), h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => { list.splice(S.swi, 1); commit(); } }, MC.icon('trash', 13), t('Quitar', 'Remove'))]
            : [h('b', null, sel.w), h('input', { class: 'input', type: 'number', step: '0.01', value: sel.s == null ? '' : sel.s.toFixed(2), placeholder: t('sin marcar', 'not set'), 'aria-label': t('Momento de la palabra en segundos', 'Word moment in seconds'), onChange: (e) => { sel.s = e.target.value === '' ? null : Math.max(0, +e.target.value); delete sel.est; commit(); } }),
              h('button', { class: 'btn btn-g btn-sm', type: 'button', title: t('Quitar 0,05 s', 'Remove 0.05 s'), 'aria-label': '−0.05', onClick: () => { if (sel.s != null) { sel.s = Math.max(0, Math.round((sel.s - 0.05) * 1000) / 1000); commit(); } } }, '−'),
              h('button', { class: 'btn btn-g btn-sm', type: 'button', title: t('Añadir 0,05 s', 'Add 0.05 s'), 'aria-label': '+0.05', onClick: () => { if (sel.s != null) { sel.s = Math.round((sel.s + 0.05) * 1000) / 1000; commit(); } } }, '+'),
              h('button', { class: 'btn btn-s btn-sm', type: 'button', title: t('Fija esta palabra en el cursor', 'Sets this word at the cursor'), onClick: () => { sel.s = Math.round(S.time * 1000) / 1000; delete sel.est; commit(); } }, t('Aquí', 'Here')),
              h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!sel.br, onChange: (e) => { if (e.target.checked) sel.br = true; else delete sel.br; commit(); } }), h('span', null, t('Empieza línea nueva', 'Starts a new line')))]) : null,
          h('p', { class: 'cap' }, cues.length + t(' líneas de subtítulo. ', ' subtitle lines. ') + t('Intro = fijar · . = silencio · Retroceso = atrás', 'Enter = set · . = silence · Backspace = back'))));
        /* estilo */
        const st = MC.subStyle(it.style), setS = (k, v) => { it.style = Object.assign(MC.subStyle(it.style), { [k]: v }); S.dirty = true; touch(); }, setC = (k, v) => { setS(k, v); commit(); };
        const sl = (k, label, min, max, step, fmt) => MC.ui.slider({ label, min, max, step, value: st[k] == null ? 0 : st[k], fmt: fmt || ((v) => v.toFixed(2)), onInput: (v) => setS(k, v), onChange: commit });
        const col = (k, label, allowNone) => h('div', { class: 'field' }, h('label', null, label), h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('input', { type: 'color', class: 'input', style: { padding: '2px', height: '34px', width: '70px' }, value: st[k] || '#ffffff', onInput: (e) => setS(k, e.target.value), onChange: commit }), allowNone && st[k] ? h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => setC(k, null) }, t('Quitar', 'None')) : null));
        const pc = (v) => Math.round(v * 100) + ' %';
        out.push(h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Estilo', 'Style')), subPresetGrid((pr) => { MC.applySubPreset(it, pr.v); commit(); }, st.preset),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Cómo se muestra', 'How it shows')), MC.ui.chips([{ v: 'line', l: t('Línea entera', 'Whole line') }, { v: 'karaoke', l: t('Palabra que suena', 'Spoken word') }, { v: 'word', l: t('Una palabra', 'One word') }, { v: 'reveal', l: t('Va apareciendo', 'Builds up') }], st.mode, (v) => setC('mode', v))),
          h('div', { class: 'field' }, h('label', { for: 'sb-font' }, t('Tipografía', 'Font')), h('select', { id: 'sb-font', class: 'input', onChange: (e) => setC('font', e.target.value) }, SUB_FONTS().map((f) => h('option', { value: f.id, selected: f.id === st.font }, f.n)))),
          sl('size', t('Tamaño', 'Size'), 0.02, 0.14, 0.0025, (v) => (v * 100).toFixed(1) + ' %'),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!st.upper, onChange: (e) => setC('upper', e.target.checked) }), h('span', null, t('Todo en mayúsculas', 'All caps'))),
          col('color', t('Color del texto', 'Text colour')),
          st.mode === 'karaoke' ? [col('hi', t('Color de la palabra que suena', 'Spoken word colour')), col('hiBg', t('Fondo de la palabra que suena', 'Spoken word background'), true), sl('hiScale', t('Tamaño de la palabra que suena', 'Spoken word size'), 1, 1.6, 0.01, (v) => '×' + v.toFixed(2)), sl('upAlpha', t('Visibilidad de lo que aún no suena', 'Visibility of what is not spoken yet'), 0.1, 1, 0.01, pc), col('doneColor', t('Color de lo ya dicho', 'Colour of what was said'), true)] : null,
          sl('strokeW', t('Grosor del trazo', 'Stroke width'), 0, 0.4, 0.01, pc), st.strokeW > 0 ? col('strokeColor', t('Color del trazo', 'Stroke colour')) : null,
          sl('shadow', t('Sombra y brillo', 'Shadow and glow'), 0, 1, 0.01, pc), st.shadow > 0 ? col('shadowColor', t('Color de la sombra', 'Shadow colour')) : null,
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!st.bg, onChange: (e) => setC('bg', e.target.checked) }), h('span', null, t('Fondo detrás del texto', 'Background behind the text'))),
          st.bg ? [col('bgColor', t('Color del fondo', 'Background colour')), sl('bgAlpha', t('Opacidad del fondo', 'Background opacity'), 0, 1, 0.01, pc), h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Forma del fondo', 'Background shape')), MC.ui.seg([{ v: 'block', l: t('Un bloque', 'One block') }, { v: 'line', l: t('Por línea', 'Per line') }], st.bgMode === 'line' ? 'line' : 'block', (v) => setC('bgMode', v))), sl('pad', t('Margen interior', 'Padding'), 0, 1.2, 0.01, (v) => v.toFixed(2) + ' em'), sl('radius', t('Radio de las esquinas', 'Corner radius'), 0, 0.8, 0.01, (v) => (v === 0 ? t('rectas', 'square') : v.toFixed(2) + ' em'))] : null,
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Animación de cada línea', 'Animation of each line')), MC.ui.chips([['none', t('Ninguna', 'None')], ['fade', t('Aparecer', 'Fade')], ['pop', 'Pop'], ['slide', t('Deslizar', 'Slide')], ['zoom', 'Zoom']].map((q) => ({ v: q[0], l: q[1] })), st.anim, (v) => setC('anim', v))),
          MC.ui.slider({ label: t('Altura', 'Position'), min: -0.3, max: 0.48, step: 0.01, value: it.style && it.style.y != null ? it.style.y : MC.subY(p, opts().W, opts().H), fmt: (v) => (v >= 0 ? '↓ ' : '↑ ') + Math.abs(Math.round(v * 100)) + ' %', onInput: (v) => setS('y', v), onChange: commit }),
          sl('maxW', t('Ancho máximo', 'Maximum width'), 0.4, 0.95, 0.01, pc), sl('maxChars', t('Letras por línea', 'Letters per line'), 8, 60, 1, (v) => String(v)), sl('lines', t('Líneas a la vez', 'Lines at once'), 1, 4, 1, (v) => String(v)),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { p.subDefault = JSON.parse(JSON.stringify(it.style)); MC.toast(t('Este estilo se usará en los nuevos subtítulos.', 'This style will be used for new subtitles.')); touch(); } }, t('Usar para los nuevos', 'Use for new ones')))));
        /* capa */
        out.push(h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Capa', 'Layer')), nameIn(t('Nombre', 'Name'), it.name, (v) => { if (v) { it.name = v; commit(); } }),
          MC.ui.slider({ label: t('Empieza en', 'Starts at'), min: 0, max: Math.max(MC.totalTime(p), it.start + 1), step: 0.05, value: it.start, fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { const d = v - it.start; Object.keys(it.words || {}).forEach((l2) => it.words[l2].forEach((e) => { if (e.s != null) e.s = Math.max(0, Math.round((e.s + d) * 1000) / 1000); })); it.start = v; layoutClips(); S.dirty = true; touch(); }, onChange: commit }),
          MC.ui.slider({ label: t('Dura', 'Length'), min: 0.5, max: Math.max(60, it.dur), step: 0.05, value: it.dur, fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { it.dur = v; layoutClips(); S.dirty = true; touch(); }, onChange: commit }),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const txt = MC.subsSrt({ subs: [it] }, lang, 0); if (!txt) { MC.toast(t('Aún no hay texto con tiempos.', 'There is no timed text yet.')); return; } MC.download(new Blob([txt + '\n'], { type: 'text/plain' }), it.name.replace(/[^\w\- ]+/g, '') + '-' + lang + '.srt'); } }, MC.icon('download', 14), t('Exportar SRT', 'Export SRT')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const c = JSON.parse(JSON.stringify(it)); c.id = MC.uid(); c.name += ' 2'; p.subs.push(c); S.sb = c.id; commit(); } }, MC.icon('copy', 14), t('Duplicar', 'Duplicate')),
            h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', onClick: () => { p.subs = p.subs.filter((q) => q.id !== it.id); S.sb = null; S.selKind = 'shot'; commit(); } }, MC.icon('trash', 14), t('Eliminar', 'Delete')))));
      } else {
        out.push(h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Estilo para los subtítulos nuevos', 'Style for new subtitles')), subPresetGrid((pr) => { p.subDefault = Object.assign(MC.subStyle(pr.s), { preset: pr.v }); touch(); renderPanels(); MC.toast(t('Estilo «' + pr.es + '» para los nuevos subtítulos', 'Style “' + pr.en + '” for new subtitles')); }, (p.subDefault && p.subDefault.preset) || 'classic'),
          h('p', { class: 'cap' }, t('Crea o selecciona una capa para editar su texto, sus tiempos y su estilo.', 'Create or select a layer to edit its text, timings and style.'))));
      }
      return out;
    }
    function convertLegacySubs() {
      const p = S.project, lang = p.lang, leg = p.texts.filter((x) => x.kind === 'sub').sort((a, b) => MC.textSpan(a, p).start - MC.textSpan(b, p).start); if (!leg.length) return;
      const sps = leg.map((x) => MC.textSpan(x, p)), start = sps[0].start, end = Math.max(...sps.map((q) => q.start + q.dur)), it = MC.newSub(p, start, end - start, null), list = [];
      leg.forEach((x, i) => { const txt = MC.textOf(x, p, lang) || ''; const ws = txt.split(/\s+/).filter(Boolean), tot = ws.reduce((a, b) => a + Math.max(1, b.length), 0); let acc = 0; ws.forEach((w, j) => { list.push({ w, s: Math.round((sps[i].start + (sps[i].dur * acc) / tot) * 1000) / 1000, br: j === 0 ? true : undefined }); acc += Math.max(1, w.length); }); const nx = leg[i + 1] ? sps[i + 1].start : null; if (nx == null || nx - (sps[i].start + sps[i].dur) > 0.35) list.push({ sil: true, s: Math.round((sps[i].start + sps[i].dur) * 1000) / 1000 }); });
      it.words[lang] = list; it.text[lang] = list.filter((e) => !e.sil).map((e) => e.w).join(' '); if (p.sub) { it.style = Object.assign(MC.subStyle(), { font: p.sub.font || 'bric', size: p.sub.size || 0.045, color: p.sub.color || '#ffffff', bg: p.sub.bg !== false, y: p.sub.y }); }
      p.subs.push(it); p.texts = p.texts.filter((x) => x.kind !== 'sub'); S.sb = it.id; S.swi = 0; commit(); MC.toast(t('Subtítulos convertidos en una capa.', 'Subtitles converted into one layer.'));
    }
    function textPanel() {
      const p = S.project, KINDS = [['bubble', t('Bocadillo', 'Bubble'), 'chat'], ['box', t('Caja de texto', 'Text box'), 'text'], ['sfx', t('Onomatopeya', 'Sound word'), 'sparkle'], ['sub', t('Subtítulo', 'Subtitle'), 'film']];
      const label = (x) => (MC.textOf(x, p) || t('(sin texto)', '(no text)')).replace(/\n/g, ' ');
      return [h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Añadir en el cabezal', 'Add at the playhead')), h('div', { class: 'big-btns' }, KINDS.map((k) => h('button', { class: 'btn btn-s', type: 'button', onClick: () => addText(k[0]) }, MC.icon(k[2], 20), k[1]))),
        h('p', { class: 'cap' }, t('Si el cabezal está sobre una locución, el texto se vincula a ella y aparece y se va con la voz. Los bocadillos son óvalos; las cajas y los subtítulos, rectos.', 'If the playhead is over a voice-over, the text links to it and appears and leaves with the voice. Bubbles are ovals; boxes and subtitles are straight.'))),
      h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Textos del proyecto · ', 'Project texts · ') + p.texts.length),
        p.texts.length ? h('div', { style: { display: 'grid', gap: '2px' } }, p.texts.slice().sort((a, b) => MC.textSpan(a, p).start - MC.textSpan(b, p).start).map((x) => h('div', { class: 'layer' + (x.id === S.tx ? ' on' : ''), onClick: () => { S.tx = x.id; S.li = -1; S.cl = null; const sp = MC.textSpan(x, p); setTime(sp.start + Math.min(0.5, sp.dur / 2)); renderPanels(); renderLayers(); S.dirty = true; } },
          h('span', { class: 'ln' }, label(x)), h('span', { class: 'lz' }, { bubble: t('bocadillo', 'bubble'), box: t('caja', 'box'), sfx: 'sfx', sub: t('subt.', 'sub') }[x.kind] + ' · ' + MC.fmtTime(MC.textSpan(x, p).start)))))
          : h('p', { class: 'cap' }, t('Aún no hay textos.', 'No texts yet.')))];
    }
    function soundsPanel() {
      let cur = null; const stopPrev = () => { if (cur) { try { cur.stop(); } catch (e) { /* parado */ } cur = null; } };
      const rows = MC.audio.LIBRARY.map((it) => h('div', { class: 'layer', style: { cursor: 'default' } }, h('span', { class: 'ln' }, t(it.es, it.en)), h('span', { class: 'lz' }, it.dur.toFixed(1) + ' s'),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', 'aria-label': t('Oír ', 'Play ') + t(it.es, it.en), onClick: async () => { stopPrev(); cur = await MC.audio.preview(await MC.audio.renderLibrary(it)); } }, MC.icon('play', 12)),
        h('button', { class: 'btn btn-p btn-sm', type: 'button', 'aria-label': t('Añadir ', 'Add ') + t(it.es, it.en), onClick: async (e) => { const b2 = e.currentTarget; b2.disabled = true; const c = await addLibrarySound(it, S.time); S.cl = c.id; commit(); MC.toast(t('Añadido en el cabezal', 'Added at the playhead')); } }, MC.icon('plus', 12))));
      return [h('div', { class: 'box' }, h('div', { class: 'big-btns' },
        h('button', { class: 'btn btn-s', type: 'button', onClick: () => { fileAudio.dataset.track = 'auto'; fileAudio.click(); } }, MC.icon('upload', 20), t('Importar audio', 'Import audio')),
        h('button', { class: 'btn btn-s', type: 'button', onClick: recordVoice }, MC.icon('mic', 20), t('Grabar locución', 'Record voice-over')))),
      h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Biblioteca de sonidos', 'Sound library')), h('p', { class: 'cap' }, t('Efectos y música ambiente generados por código, sin licencias. Se añaden donde está el cabezal.', 'Effects and ambient music generated by code, no licences. They are added at the playhead.')), h('div', { style: { display: 'grid', gap: '2px' } }, rows))];
    }
    function summaryPanel() {
      const p = S.project, total = MC.totalTime(p), me = MC.memEstimate(p), size = MC.frameSize(p.ratio, p.res);
      const cell = (b, sp) => h('div', null, h('b', null, b), h('span', null, sp));
      return [h('div', { class: 'box' }, h('div', { class: 'sumgrid' }, cell(p.shots.length, t('planos', 'shots')), cell(total.toFixed(1) + ' s', t('duración', 'duration')), cell(p.ratio, size.w + '×' + size.h), cell(p.langs.map((l) => l.toUpperCase()).join(' '), t('idiomas', 'languages')),
        cell(p.clips.length, t('clips de audio', 'audio clips')), cell(p.texts.length, t('textos', 'texts')), cell(Math.round(me.edit / 1048576) + ' MB', t('imágenes en edición', 'images in editing')), cell(t(({ free: 'Libre', page: 'Página', webtoon: 'Webtoon' })[p.mode || 'free'], ({ free: 'Free', page: 'Page', webtoon: 'Webtoon' })[p.mode || 'free']), t('modo', 'mode')))),
      h('div', { class: 'box' }, h('p', { class: 'cap' }, t('No hay nada seleccionado. Elige un plano, una capa, un texto o un clip para ver sus propiedades aquí. Pulsa Esc para volver a este resumen.', 'Nothing is selected. Pick a shot, layer, text or clip to see its properties here. Press Esc to come back to this summary.')),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => selectShot(S.si, false) }, t('Seleccionar el plano actual', 'Select the current shot')), h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { setWs('montaje'); S.tab.montaje = 'proyecto'; renderRail(); renderPanels(); } }, t('Formato y parallax', 'Format and parallax')), h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => MC.openPrefs() }, t('Preferencias', 'Preferences'))))];
    }
    const selection = () => {
      const k = S.selKind, sh = shot();
      if (k === 'layer' && layer()) return 'layer';
      if (k === 'text' && S.tx && txById(S.tx)) return 'text';
      if (k === 'clip' && S.cl && clipById(S.cl)) return 'clip';
      if (k === 'overlay' && S.ov && ovById(S.ov)) return 'overlay';
      if (k === 'subs' && S.sb && subById(S.sb)) return 'subs';
      if (k === 'multi' && S.multi.length > 1) return 'multi';
      if (k === 'marker' && S.mk && mkById(S.mk)) return 'marker';
      if (k === 'fx' && S.fxsel && sh.fx.find((f) => f.id === S.fxsel)) return 'fx';
      if (k === 'panel' && S.pn && sh.page && sh.page.panels.find((q) => q.id === S.pn)) return 'panel';
      if (k === 'stop' && S.sp && sh.webtoon && sh.webtoon.stops.find((q) => q.id === S.sp)) return 'stop';
      return k === 'shot' || k === 'layer' || k === 'text' || k === 'clip' || k === 'fx' || k === 'panel' || k === 'stop' || k === 'overlay' || k === 'multi' || k === 'marker' || k === 'subs' ? 'shot' : 'project';
    };
    function crumbs(kind) {
      const p = S.project, sh = shot(), parts = [[t('Proyecto', 'Project'), () => { clearSel(); }]];
      if (kind !== 'project') parts.push([sh.name, () => { S.selKind = 'shot'; S.li = -1; S.tx = null; S.cl = null; S.fxsel = null; renderPanels(); renderLayers(); }]);
      const leaf = { layer: layer() && layer().name, text: S.tx && txById(S.tx) && (MC.textOf(txById(S.tx), p) || t('Texto', 'Text')).slice(0, 18), clip: S.cl && clipById(S.cl) && clipById(S.cl).name, overlay: S.ov && ovById(S.ov) && ovById(S.ov).name, subs: S.sb && subById(S.sb) && subById(S.sb).name, multi: S.multi.length + t(' elementos', ' items'), marker: S.mk && mkById(S.mk) && (mkById(S.mk).text || (mkById(S.mk).kind === 'beat' ? t('Pulso', 'Beat') : t('Marcador', 'Marker'))), fx: S.fxsel && sh.fx.find((f) => f.id === S.fxsel) && MC.fxName(sh.fx.find((f) => f.id === S.fxsel).type), panel: t('Viñeta', 'Panel'), stop: t('Pausa', 'Pause') }[kind];
      if (leaf) parts.push([leaf, null]);
      const box = h('div', { class: 'crumbs', 'aria-label': t('Ruta de la selección', 'Selection path') });
      parts.forEach((q, i) => { if (i) box.append(h('span', { 'aria-hidden': 'true' }, '›')); box.append(h('button', { type: 'button', disabled: !q[1], onClick: q[1] || undefined }, q[0])); });
      return box;
    }
    function clearSel() { S.selKind = 'project'; S.li = -1; S.tx = null; S.cl = null; S.ov = null; S.sb = null; S.multi = []; S.mk = null; S.fxsel = null; S.pn = null; S.sp = null; renderPanels(); renderLayers(); renderTimeline(); S.dirty = true; }
    function renderPanels() {
      const DL = buildSections(), DP = buildSections(), tab = curTab();
      /* panel izquierdo */
      const L = {
        subtitulos: subsPanel, planos: shotsPanel, recursos: resourcesPanel, biblioteca: libraryPanel, vinetas: () => [boxDom(DL.vinetas)], transiciones: transPanel, proyecto: () => [boxDom(DL.proyecto)], aspecto: () => [boxDom(DL.aspecto)], estilo: () => [boxDom(DL.estilo)],
        camara: () => [boxDom(DL.camara)].concat(DL.pagina ? [boxDom(DL.pagina)] : [], DL.tira ? [boxDom(DL.tira)] : [], DL.tray ? [boxDom(DL.tray)] : []),
        rack: () => [boxDom(DL.rack)], texto: textPanel, efectos: () => [boxDom(DL.efectos)], sonidos: soundsPanel, mezclador: () => [boxDom(DL.mezcla)], idiomas: () => [boxDom(DL.idiomas)],
      };
      if (tab) { const lt = el.leftBody.scrollTop; el.leftTitle.textContent = tabLabel(tab); MC.put(MC.clear(el.leftBody), L[tab] ? L[tab]() : null); el.leftBody.scrollTop = lt; }
      /* propiedades según la selección */
      const kind = selection(), top = el.inspBody.scrollTop, sh = shot();
      const pick = { project: () => summaryPanel().map((n) => n), shot: () => [DP.plano].concat(S.si > 0 ? [DP.transicion] : [], [DP.vineta], sh.page ? [DP.pagina] : sh.webtoon ? [DP.tira] : [DP.camara, DP.tray]).filter(Boolean).map(secDom),
        layer: () => [secDom(DP.capa), secDom(DP.capa_anim), secDom(DP.capa_rig), secDom(DP.capa_look), secDom(DP.capa_pivot), secDom(DP.capa_kf)], text: () => (DP.texto ? [secDom(DP.texto)] : []), clip: () => (DP.audio ? [secDom(DP.audio)] : []), overlay: () => [secDom(DP.overlay), secDom(DP.overlay_anim), secDom(DP.overlay_look), secDom(DP.overlay_kf)], multi: () => [secDom(DP.multi)], marker: () => [secDom(DP.marker)], subs: () => [secDom(DP.subs)], fx: () => [secDom(DP.efecto)], panel: () => [secDom(DP.pagina_sel)], stop: () => [secDom(DP.tira_sel)] };
      el.propsTitle.textContent = { project: t('Resumen', 'Summary'), shot: t('Propiedades del plano', 'Shot properties'), layer: t('Propiedades de la capa', 'Layer properties'), text: t('Propiedades del texto', 'Text properties'), clip: t('Propiedades del audio', 'Audio properties'), overlay: t('Propiedades de la superposición', 'Overlay properties'), multi: t('Selección múltiple', 'Multiple selection'), marker: t('Marcador', 'Marker'), subs: t('Subtítulos', 'Subtitles'), fx: t('Propiedades del efecto', 'Effect properties'), panel: t('Propiedades de la viñeta', 'Panel properties'), stop: t('Propiedades de la pausa', 'Pause properties') }[kind];
      MC.put(MC.clear(el.inspBody), crumbs(kind), h('div', { class: 'pbody', style: { padding: 0, overflow: 'visible' } }, pick[kind]())); el.inspBody.scrollTop = top;
    }
    function renderInspector() { renderPanels(); }
    function buildExportPanel() {
      MC.clear(el.exportHost);
      el.exportApi = MC.openExport(exportApi(el.exportHost));
    }

    /* ---------- visor ---------- */
    function renderVbar() {
      const portrait = opts().W / opts().H < 0.8, sh = shot(), edit = sh && sh.page ? 'page' : sh && sh.webtoon ? 'strip' : 'cam';
      const ovOn = [S.rulers && ['rulers', t('Reglas', 'Rulers')], S.guides && ['guides', t('Guías', 'Guides')], S.safe && ['safe', t('Zonas seguras', 'Safe zones')], S.holes && ['holes', t('Huecos', 'Gaps')], S.sim && ['sim', t('Simulador', 'Simulator')]].filter(Boolean);
      const off = (k) => { if (k === 'sim') { S.sim = null; buildSim(); } else S[k] = false; renderVbar(); S.dirty = true; };
      const chk = (key, label, disabled) => h('label', null, h('input', { type: 'checkbox', checked: !!S[key], disabled: !!disabled, onChange: (e) => { S[key] = e.target.checked; renderVbar(); S.dirty = true; } }), label);
      MC.put(MC.clear(el.vbar),
        MC.ui.seg([{ v: 'out', l: t('Salida', 'Output') }, { v: edit, l: edit === 'page' ? t('Página', 'Page') : edit === 'strip' ? t('Tira', 'Strip') : t('Cámara', 'Camera') }].concat(edit === 'cam' ? [{ v: 'depth', l: t('Profundidad', 'Depth') }] : []), S.view === 'out' || S.view === 'depth' ? S.view : edit, (v) => { S.view = v; if (v !== 'out') togglePlay(false); renderVbar(); buildSim(); fit(); }, t('Vista', 'View')),
        S.view === 'cam' && !(sh && sh.camera.path && sh.camera.path.custom) ? MC.ui.seg([{ v: 'from', l: t('Inicio', 'Start') }, { v: 'to', l: t('Fin', 'End') }], S.kf, (v) => { S.kf = v; S.dirty = true; renderInspector(); }, t('Fotograma clave', 'Keyframe')) : null,
        S.view === 'page' ? h('button', { class: 'btn btn-g btn-sm', type: 'button', 'aria-pressed': String(S.ptool === 'poly'), title: t('Dibujar una viñeta con vértices libres: un clic por vértice, Intro o clic en el primero para cerrar', 'Draw a free-vertex panel: one click per vertex, Enter or click the first to close'), onClick: () => { S.ptool = S.ptool === 'poly' ? 'rect' : 'poly'; S.poly = null; renderVbar(); S.dirty = true; } }, t('Polígono', 'Polygon')) : null,
        S.view === 'page' ? h('span', { class: 'status' }, S.ptool === 'poly' ? t('Un clic por vértice. Intro o clic en el primero para cerrar. Esc cancela.', 'One click per vertex. Enter or click the first to close. Esc cancels.') : t('Arrastra para mover, esquinas para cambiar, o dibuja una viñeta nueva', 'Drag to move, corners to resize, or draw a new panel')) : null,
        S.view === 'strip' ? h('span', { class: 'status' }, t('Clic en la tira para añadir una pausa; arrástrala para moverla', 'Click the strip to add a pause; drag it to move')) : null,
        S.project.langs.length > 1 ? MC.ui.seg(S.project.langs.map((l) => ({ v: l, l: l.toUpperCase() })), S.project.lang, (v) => { S.project.lang = v; commit(); }, t('Idioma del texto', 'Text language')) : null,
        h('span', { class: 'vzoom', role: 'group', 'aria-label': t('Zoom del visor', 'Viewer zoom') }, h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Alejar el visor (Ctrl + rueda)', 'Zoom the viewer out (Ctrl + wheel)'), 'aria-label': t('Alejar el visor', 'Zoom the viewer out'), onClick: () => setViewZoom(S.vz.z / 1.25) }, MC.icon('minus', 14)),
          el.zoomLbl = h('button', { class: 'btn btn-g btn-sm', type: 'button', title: t('Volver al tamaño ajustado', 'Back to fitted size'), onClick: resetViewZoom }, Math.round(S.vz.z * 100) + ' %'),
          h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Acercar el visor (Ctrl + rueda). Para moverte: rueda del ratón pulsada o Alt + arrastrar', 'Zoom the viewer in (Ctrl + wheel). To pan: middle mouse button or Alt + drag'), 'aria-label': t('Acercar el visor', 'Zoom the viewer in'), onClick: () => setViewZoom(S.vz.z * 1.25) }, MC.icon('plus', 14))),
        S.view === 'out' ? h('span', { class: 'vwrap' }, h('button', { class: 'btn btn-g btn-sm', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': String(!!S.ovMenu), title: t('Guías, zonas seguras, huecos y simulador', 'Guides, safe zones, gaps and simulator'), onClick: () => { S.ovMenu = !S.ovMenu; renderVbar(); if (S.ovMenu) setTimeout(() => { const f = el.vbar.querySelector('.tmenu input'); if (f) f.focus(); }, 0); } }, MC.icon('layersx', 14), t('Superposiciones', 'Overlays')),
          S.ovMenu ? h('div', { class: 'tmenu', role: 'menu', onKeydown: (e) => { if (e.key === 'Escape') { S.ovMenu = false; renderVbar(); } } },
            chk('guides', t('Guías (tercios y margen)', 'Guides (thirds and margin)')), chk('safe', t('Zonas seguras de redes', 'Social safe zones'), !portrait), chk('holes', t('Marcar huecos en rojo', 'Mark gaps in red')), chk('rulers', t('Reglas (en píxeles)', 'Rulers (in pixels)')),
            h('label', null, h('input', { type: 'checkbox', checked: !!S.sim, disabled: !portrait, onChange: (e) => { S.sim = e.target.checked ? 'tiktok' : null; renderVbar(); buildSim(); } }), t('Simulador de plataformas', 'Platform simulator')),
            S.sim ? h('div', { style: { padding: '4px 10px 8px' } }, MC.ui.seg([{ v: 'tiktok', l: 'TikTok' }, { v: 'reels', l: 'Reels' }, { v: 'shorts', l: 'Shorts' }], S.sim, (v) => { S.sim = v; buildSim(); }, t('Red social', 'Network'))) : null,
            !portrait ? h('span', { class: 'cap', style: { padding: '4px 10px' } }, t('Zonas seguras y simulador son para formatos verticales.', 'Safe zones and the simulator are for vertical formats.')) : null) : null) : null,
        S.view === 'out' ? ovOn.map((q) => h('button', { class: 'tag', type: 'button', title: t('Quitar ', 'Turn off ') + q[1], onClick: () => off(q[0]) }, q[1] + ' ×')) : null,
        h('span', { style: { flex: 1 } }),
        MC.ui.seg([{ v: 'media', l: t('Media', 'Medium') }, { v: 'full', l: t('Completa', 'Full') }], S.quality, (v) => { S.quality = v; MC.store.set('pq', v); S.slow = 0; fit(); }, t('Calidad de la previsualización', 'Preview quality')));
    }
    /* Simulador: interfaz genérica de una app de vídeo vertical encima del visor, para ver qué tapa. No usa marcas ni logos. */
    function buildSim() {
      const sim = el.sim;
      MC.clear(sim);
      sim.hidden = !S.sim || S.view !== 'out';
      if (sim.hidden) return;
      sim.dataset.p = S.sim;
      const act = (ic, label) => h('div', { class: 'sim-act' }, MC.icon(ic, 26), h('span', null, label));
      const top = S.sim === 'tiktok' ? h('div', { class: 'sim-top' }, h('span', null, t('Siguiendo', 'Following')), h('b', null, t('Para ti', 'For you')))
        : h('div', { class: 'sim-top l' }, h('b', null, S.sim === 'reels' ? 'Reels' : 'Shorts'));
      el.simBar = h('i');
      MC.put(sim, top,
        h('div', { class: 'sim-side' }, h('div', { class: 'sim-av' }), act('heart', t('12,4 mil', '12.4K')), act('chat', '238'), act('send', t('Enviar', 'Send')), act('bookmark', S.sim === 'reels' ? '' : t('Guardar', 'Save')), act('dots', '')),
        h('div', { class: 'sim-bot' }, h('b', null, '@tu_usuario'), h('span', null, t('Ya está aquí el capítulo 3. ¿Qué te ha parecido el final? #cómic #motioncomic', 'Chapter 3 is out. What did you think of the ending? #comic #motioncomic')), h('span', { class: 'sim-snd' }, MC.icon('note', 14), t('Sonido original · tu_usuario', 'Original sound · tu_usuario'))),
        h('div', { class: 'sim-prog' }, el.simBar), h('p', { class: 'sim-note' }, t('Simulación aproximada: cada app cambia sus zonas', 'Approximate simulation: each app changes its zones')));
      positionSim(); updateTime();
    }
    /* El simulador de redes va exactamente encima del lienzo. Se usan medidas de diseño (no del pantallazo), así no se descuadra con el tamaño de la interfaz ni con el zoom del visor. */
    function positionSim() {
      if (!el.sim || el.sim.hidden) return;
      const c = el.canvas;
      Object.assign(el.sim.style, { left: c.offsetLeft + 'px', top: c.offsetTop + 'px', width: c.offsetWidth + 'px', height: c.offsetHeight + 'px', transformOrigin: '50% 50%', transform: c.style.transform || '' });
      el.sim.style.setProperty('--u', c.offsetWidth / 100 + 'px');
    }
    function updateTransport() {
      MC.put(MC.clear(el.play), MC.icon(S.playing ? 'pause' : 'play', 14));
      el.play.setAttribute('aria-label', S.playing ? t('Pausar', 'Pause') : t('Reproducir', 'Play'));
      el.loop.setAttribute('aria-pressed', String(S.loop));
    }
    function updateTime() {
      const total = MC.totalTime(S.project);
      el.time.textContent = MC.fmtTime(S.time) + ' ';
      el.time.append(h('span', null, '/ ' + MC.fmtTime(total)));
      el.tlTime.textContent = MC.fmtTime(S.time) + ' / ' + MC.fmtTime(total);
      el.canvas.setAttribute('aria-label', t('Visor. Plano ' + (S.si + 1) + ' de ' + S.project.shots.length + ', ', 'Viewer. Shot ' + (S.si + 1) + ' of ' + S.project.shots.length + ', ') + MC.fmtTime(S.time));
      if (el.playhead) el.playhead.style.left = S.time * S.pps + 'px';
      if (el.simBar) el.simBar.style.width = (S.time / Math.max(0.1, total)) * 100 + '%';
    }
    function fit() {
      const c = el.canvas, st = el.stage, o = opts();
      const A = o.W / o.H, pw = st.clientWidth - 24, ph = st.clientHeight - 12;
      if (pw <= 0 || ph <= 0) return;
      const w = Math.min(pw, ph * A), dpr = S.quality === 'full' ? Math.min(window.devicePixelRatio || 1, 2) : Math.min(window.devicePixelRatio || 1, 1) * 0.75;
      c.style.width = w + 'px'; c.style.height = w / A + 'px';
      const cw = Math.round(w * dpr), chh = Math.round(cw / A);
      if (c.width !== cw || c.height !== chh) { c.width = cw; c.height = chh; }
      S.dpr = dpr; S.dirty = true; renderVbar(); positionSim();
    }
    const frameRect = (kf, o) => ({ cx: o.W / 2 + kf.x * o.W, cy: o.H / 2 + kf.y * o.H, hw: o.W / (2 * kf.zoom), hh: o.H / (2 * kf.zoom) });
    const camMap = (c, o) => { const k = c.width / (o.W * VIEW_W); return { k, ox: (c.width - o.W * k) / 2, oy: (c.height - o.H * k) / 2 }; };

    /* vista previa al pasar el cursor: aplica el preset a modo de prueba, reproduce el plano y lo deshace al salir */
    let hov = null;
    function hoverStop() {
      if (!hov) return; const h0 = hov; hov = null; clearInterval(h0.iv);
      const sh = S.project.shots[h0.si]; if (sh) { if (h0.cam) sh.camera = JSON.parse(h0.cam); if (h0.fx) sh.fx = JSON.parse(h0.fx); }
      S.view = h0.view; setTime(h0.time); renderVbar(); S.dirty = true;
    }
    function hoverStart(kind, apply) {
      if (S.playing || hov || S.view === 'page' || S.view === 'strip') return; const sh = shot(); if (!sh) return;
      const st = MC.shotStarts(S.project)[S.si]; hov = { si: S.si, cam: kind === 'cam' ? JSON.stringify(sh.camera) : null, fx: kind === 'fx' ? JSON.stringify(sh.fx) : null, time: S.time, view: S.view };
      apply(sh, st); S.view = 'out'; const t0 = performance.now(), from = kind === 'fx' ? clamp(S.time - st, 0, Math.max(0, sh.duration - 0.2)) : 0;
      hov.iv = setInterval(() => { const el2 = ((performance.now() - t0) / 1000); setTime(st + (kind === 'fx' ? from + (el2 % Math.max(0.5, sh.duration - from)) : el2 % sh.duration)); }, 33);
    }
    const hoverable = (node, kind, apply) => { node.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hoverStart(kind, apply); }); node.addEventListener('pointerleave', hoverStop); node.addEventListener('pointerdown', hoverStop, true); return node; };
    /* zoom y desplazamiento del visor (solo para trabajar: no cambia lo que se exporta) */
    function applyViewXf() { const v = S.vz; el.canvas.style.transformOrigin = '50% 50%'; el.canvas.style.transform = v.z === 1 && !v.x && !v.y ? '' : 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.z + ')'; if (el.zoomLbl) el.zoomLbl.textContent = Math.round(v.z * 100) + ' %'; el.stage.classList.toggle('zoomed', v.z !== 1); positionSim(); }
    function setViewZoom(z, cx, cy) {
      const v = S.vz, nz = clamp(z, 0.25, 8), r = el.stage.getBoundingClientRect(), mx = (cx == null ? r.left + r.width / 2 : cx) - (r.left + r.width / 2), my = (cy == null ? r.top + r.height / 2 : cy) - (r.top + r.height / 2), k = nz / v.z;
      v.x = mx - (mx - v.x) * k; v.y = my - (my - v.y) * k; v.z = nz; if (nz === 1) { v.x = 0; v.y = 0; } applyViewXf(); S.dirty = true;
    }
    const resetViewZoom = () => { S.vz = { z: 1, x: 0, y: 0 }; applyViewXf(); S.dirty = true; };
    /* reglas: marcas a lo largo de los bordes, en píxeles del vídeo */
    function drawRulers(ctx, o, k) {
      const W = ctx.canvas.width, H = ctx.canvas.height, st = getComputedStyle(document.documentElement), fg = st.getPropertyValue('--fg').trim() || '#fff', d = S.dpr;
      const stepPx = [10, 20, 50, 100, 200, 250, 500, 1000].find((n) => n * k * S.vz.z >= 46 / d * d / 1) || 1000;
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, 16 * d); ctx.fillRect(0, 0, 16 * d, H);
      ctx.fillStyle = fg; ctx.strokeStyle = fg; ctx.font = (10 * d) + 'px system-ui, sans-serif'; ctx.lineWidth = 1; ctx.textBaseline = 'top';
      for (let x = 0; x <= o.W; x += stepPx / 5) { const X = x * k, major = Math.round(x / stepPx * 5) % 5 === 0; ctx.beginPath(); ctx.moveTo(X, (major ? 4 : 11) * d); ctx.lineTo(X, 16 * d); ctx.stroke(); if (major) ctx.fillText(String(Math.round(x)), X + 3 * d, 2 * d); }
      for (let y = 0; y <= o.H; y += stepPx / 5) { const Y = y * k, major = Math.round(y / stepPx * 5) % 5 === 0; ctx.beginPath(); ctx.moveTo((major ? 4 : 11) * d, Y); ctx.lineTo(16 * d, Y); ctx.stroke(); if (major) { ctx.save(); ctx.translate(2 * d, Y + 3 * d); ctx.rotate(Math.PI / 2); ctx.fillText(String(Math.round(y)), 0, 0); ctx.restore(); } }
      if (S.mouse) { ctx.strokeStyle = '#e5333d'; ctx.beginPath(); ctx.moveTo(S.mouse.x, 0); ctx.lineTo(S.mouse.x, 16 * d); ctx.moveTo(0, S.mouse.y); ctx.lineTo(16 * d, S.mouse.y); ctx.stroke(); }
      ctx.restore();
    }
    /* vista lateral de profundidad: las capas «de perfil», de lejos a cerca; se arrastran para cambiar su z */
    const DEPTH = { pad: 70 };
    function drawDepth(ctx, sh) {
      const c = el.canvas, W = c.width, H = c.height, d = S.dpr, st = getComputedStyle(document.documentElement), acc = st.getPropertyValue('--accent').trim() || '#8C7CFF', fg = st.getPropertyValue('--fg').trim() || '#fff', mu = st.getPropertyValue('--muted').trim() || '#999', pad = DEPTH.pad * d;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#16181B'; ctx.fillRect(0, 0, W, H);
      const x0 = pad, x1 = W - pad, base = H - 46 * d; ctx.strokeStyle = mu; ctx.lineWidth = d; ctx.beginPath(); ctx.moveTo(x0, base); ctx.lineTo(x1, base); ctx.stroke();
      ctx.fillStyle = mu; ctx.font = (12 * d) + 'px system-ui, sans-serif'; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText(t('lejos · 0', 'far · 0'), x0, base + 10 * d); ctx.textAlign = 'right'; ctx.fillText(t('cerca · 1', 'near · 1'), x1, base + 10 * d); ctx.textAlign = 'center'; ctx.fillText(t('Arrastra una capa a izquierda o derecha para cambiar su profundidad', 'Drag a layer left or right to change its depth'), W / 2, 12 * d);
      for (let q = 0; q <= 10; q++) { const X = x0 + (q / 10) * (x1 - x0); ctx.beginPath(); ctx.moveTo(X, base); ctx.lineTo(X, base + 5 * d); ctx.stroke(); }
      const o = opts(), layers = sh.layers.map((l, i) => ({ l, i })).sort((a, b) => a.l.z - b.l.z), hit = [];
      layers.forEach((q, n) => {
        const l = q.l, a = MC.assets.get(l.assetId), X = x0 + clamp(l.z, 0, 1) * (x1 - x0), ch = (H - 120 * d), cw = Math.min(150 * d, ch * ((a ? a.w / a.h : 1)) * 0.5 + 24 * d), Y = base - ch + (n % 3) * 6 * d;
        ctx.save(); ctx.globalAlpha = l.visible === false ? 0.3 : 1;
        ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(X - cw / 2, Y, cw, ch);
        if (a) { const src = a.video ? a.bitmap : a.bitmap, k = Math.min(cw / a.w, ch / a.h); try { ctx.drawImage(src, X - (a.w * k) / 2, Y + ch - a.h * k, a.w * k, a.h * k); } catch (e) { /* sin imagen */ } }
        ctx.strokeStyle = i2sel(q.i) ? acc : mu; ctx.lineWidth = (i2sel(q.i) ? 2.5 : 1) * d; ctx.strokeRect(X - cw / 2, Y, cw, ch);
        ctx.fillStyle = i2sel(q.i) ? acc : fg; ctx.textAlign = 'center'; ctx.font = (11 * d) + 'px system-ui, sans-serif'; ctx.fillText(l.name.slice(0, 16) + ' · ' + l.z.toFixed(2), X, Y - 14 * d);
        ctx.restore(); hit.push({ i: q.i, x0: X - cw / 2, x1: X + cw / 2, y0: Y, y1: Y + ch });
      });
      S.depthHit = hit;
      /* cámara a la derecha */
      ctx.fillStyle = fg; const cx = x1 + 34 * d, cy = base - 40 * d; ctx.fillRect(cx - 14 * d, cy - 10 * d, 20 * d, 20 * d); ctx.beginPath(); ctx.moveTo(cx + 6 * d, cy); ctx.lineTo(cx + 18 * d, cy - 9 * d); ctx.lineTo(cx + 18 * d, cy + 9 * d); ctx.closePath(); ctx.fill();
    }
    const i2sel = (i) => i === S.li;
    function draw() {
      const c = el.canvas; if (!c.width) return;
      const hits = [], ctx = c.getContext('2d'), o = opts({ collect: hits }), sh = shot();
      S.hits = hits;
      el.empty.hidden = !!(sh && sh.layers.length);
      if (S.view === 'page' && !(sh && sh.page)) { S.view = 'out'; renderVbar(); }
      if (S.view === 'strip' && !(sh && sh.webtoon)) { S.view = 'out'; renderVbar(); }
      if (S.view === 'depth' && sh && !(sh.page || sh.webtoon)) return drawDepth(ctx, sh);
      if (S.view === 'depth') { S.view = 'out'; renderVbar(); }
      if (S.view === 'page') return drawPage(ctx, sh);
      if (S.view === 'strip') return drawStrip(ctx, sh);
      if (S.view === 'cam' && sh) return drawCam(ctx, o, sh);
      const k = c.width / o.W;
      if (!MC.video.isExporting()) { MC.video.sync(S.project, S.time, S.playing); if (!S.playing) MC.video.ensure(S.project, S.time, () => { S.dirty = true; }); }
      ctx.setTransform(k, 0, 0, k, 0, 0);
      MC.renderFrame(ctx, S.project, S.time, o);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawOvSel(ctx, o, k);
      if (S.rulers) drawRulers(ctx, o, k);
      if (S.safe) drawSafe(ctx, c);
      if (S.guides) drawGuides(ctx, c);
      const hit = !S.playing && S.tx && hits.find((x) => x.id === S.tx);
      if (hit) {
        const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8C7CFF', b = hit.bounds;
        ctx.save(); ctx.strokeStyle = acc; ctx.lineWidth = 1.5 * S.dpr; ctx.setLineDash([6, 4]); ctx.strokeRect(b.x0 * k, b.y0 * k, (b.x1 - b.x0) * k, (b.y1 - b.y0) * k);
        if (hit.tip) { ctx.setLineDash([]); ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(hit.tip.x * k, hit.tip.y * k, 6 * S.dpr, 0, 6.283); ctx.fill(); }
        ctx.restore();
      }
    }
    /* caja de la superposición seleccionada: arrastrar el cuerpo, esquina para el tamaño, círculo para girar */
    function drawOvSel(ctx, o, k) {
      const it = !S.playing && S.ov && ovById(S.ov); if (!it || S.view !== 'out' || !MC.overlaysAt(S.project, S.time).includes(it)) return;
      const a = MC.assets.get(it.assetId); if (!a) return;
      const b = MC.overlayBox(it, a, o, S.time), acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8C7CFF', d = S.dpr;
      ctx.save(); ctx.translate(b.cx * k, b.cy * k); ctx.rotate((b.rot * Math.PI) / 180);
      ctx.strokeStyle = acc; ctx.lineWidth = 1.5 * d; ctx.setLineDash([6 * d, 4 * d]); ctx.strokeRect((-b.w / 2) * k, (-b.h / 2) * k, b.w * k, b.h * k);
      ctx.setLineDash([]); ctx.fillStyle = acc; ctx.fillRect((b.w / 2) * k - 6 * d, (b.h / 2) * k - 6 * d, 12 * d, 12 * d);
      const ry = (-b.h / 2) * k - 36 * d; ctx.beginPath(); ctx.moveTo(0, (-b.h / 2) * k); ctx.lineTo(0, ry); ctx.stroke(); ctx.beginPath(); ctx.arc(0, ry, 7 * d, 0, 6.283); ctx.fill();
      ctx.restore();
    }
    function drawPage(ctx, sh) {
      const c = el.canvas, L = sh.layers.find((l) => l.page), img = L && MC.assets.get(L.assetId);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#16181B'; ctx.fillRect(0, 0, c.width, c.height);
      if (!img) return;
      const kp = Math.min(c.width / img.w, c.height / img.h) * 0.97, ox = (c.width - img.w * kp) / 2, oy = (c.height - img.h * kp) / 2, iw = img.w * kp, ih = img.h * kp;
      S.pageMap = { kp, ox, oy, img };
      ctx.drawImage(img.bitmap, ox, oy, iw, ih);
      const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8C7CFF', pg = sh.page, d = S.dpr;
      const pth = (q) => { if (q.pts) { q.pts.forEach((pt, i) => { const X = ox + pt[0] * iw, Y = oy + pt[1] * ih; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.closePath(); } else ctx.rect(ox + q.x0 * iw, oy + q.y0 * ih, (q.x1 - q.x0) * iw, (q.y1 - q.y0) * ih); };
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.rect(ox, oy, iw, ih); pg.panels.forEach((q) => { ctx.moveTo(0, 0); pth(q); }); ctx.fill('evenodd'); ctx.restore();
      ctx.save(); ctx.strokeStyle = acc; ctx.lineWidth = 1.2 * d; ctx.setLineDash([5 * d, 5 * d]); ctx.beginPath();
      pg.panels.forEach((q, i) => { const cx = ox + ((q.x0 + q.x1) / 2) * iw, cy = oy + ((q.y0 + q.y1) / 2) * ih; i ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy); }); ctx.stroke(); ctx.restore();
      const all = drag && drag.m === 'pnnew' ? pg.panels.concat([drag.q]) : pg.panels;
      all.forEach((q, i) => {
        const sel = q.id === S.pn;
        ctx.save(); ctx.strokeStyle = sel ? acc : 'rgba(255,255,255,.75)'; ctx.lineWidth = (sel ? 3 : 2) * d; ctx.beginPath(); pth(q); ctx.stroke();
        if (sel) {
          ctx.fillStyle = acc;
          const hs = q.pts ? q.pts.map((pt) => [ox + pt[0] * iw, oy + pt[1] * ih]) : [[ox + q.x0 * iw, oy + q.y0 * ih], [ox + q.x1 * iw, oy + q.y0 * ih], [ox + q.x0 * iw, oy + q.y1 * ih], [ox + q.x1 * iw, oy + q.y1 * ih]];
          hs.forEach((pt, k) => { const big = q.pts && S.pv === k ? 7 : 5; ctx.fillRect(pt[0] - big * d, pt[1] - big * d, big * 2 * d, big * 2 * d); });
        }
        if (pg.panels.includes(q)) {
          const rad = 12 * d, bx = ox + q.x0 * iw + rad + 4 * d, by = oy + q.y0 * ih + rad + 4 * d;
          ctx.fillStyle = sel ? acc : '#0F1012'; ctx.strokeStyle = sel ? '#0F1012' : acc; ctx.lineWidth = 2 * d;
          ctx.beginPath(); ctx.arc(bx, by, rad, 0, 6.283); ctx.fill(); ctx.stroke();
          ctx.fillStyle = sel ? '#0F1012' : '#ECEEF0'; ctx.font = '700 ' + 13 * d + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), bx, by + 0.5 * d);
        }
        ctx.restore();
      });
      if (S.poly && S.poly.length) {
        ctx.save(); ctx.strokeStyle = acc; ctx.fillStyle = acc; ctx.lineWidth = 2.5 * d; ctx.beginPath();
        S.poly.forEach((pt, i) => { const X = ox + pt[0] * iw, Y = oy + pt[1] * ih; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
        if (S.polyCur) ctx.lineTo(ox + S.polyCur[0] * iw, oy + S.polyCur[1] * ih);
        ctx.stroke(); S.poly.forEach((pt, i) => { ctx.beginPath(); ctx.arc(ox + pt[0] * iw, oy + pt[1] * ih, (i ? 4 : 7) * d, 0, 6.283); ctx.fill(); });
        ctx.restore();
      }
    }
    function drawStrip(ctx, sh) {
      const c = el.canvas, L = sh.layers.find((l) => l.strip), img = L && MC.assets.get(L.assetId);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#16181B'; ctx.fillRect(0, 0, c.width, c.height);
      if (!img) return;
      const o = opts(), ks = Math.min((c.height * 0.97) / img.h, (c.width * 0.6) / img.w), iw = img.w * ks, ih = img.h * ks, ox = (c.width - iw) / 2, oy = (c.height - ih) / 2, d = S.dpr;
      S.stripMap = { ks, ox, oy, img, iw, ih };
      ctx.drawImage(img.bitmap, ox, oy, iw, ih);
      const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8C7CFF', wt = sh.webtoon;
      const tl = clamp(S.time - MC.shotStarts(S.project)[S.si], 0, sh.duration), cam = MC.camAt(sh, tl, false);
      const s0 = Math.max(o.W / img.w, o.H / img.h) * (L.scale || 1), PW = img.w * s0, PH = img.h * s0, cyw = o.H / 2 + cam.y * o.H, cxw = o.W / 2 + cam.x * o.W;
      const wy = (cyw - (o.H / 2 - PH / 2)) / PH, wh = o.H / cam.zoom / PH, wx = (cxw - (o.W / 2 - PW / 2)) / PW, ww = o.W / cam.zoom / PW;
      ctx.save(); ctx.fillStyle = 'rgba(140,124,255,.18)'; ctx.strokeStyle = acc; ctx.lineWidth = 2 * d;
      ctx.fillRect(ox + (wx - ww / 2) * iw, oy + (wy - wh / 2) * ih, ww * iw, wh * ih); ctx.strokeRect(ox + (wx - ww / 2) * iw, oy + (wy - wh / 2) * ih, ww * iw, wh * ih); ctx.restore();
      wt.stops.slice().sort((a, b) => a.y - b.y).forEach((sp, i) => {
        const Y = oy + sp.y * ih, sel = sp.id === S.sp;
        ctx.save(); ctx.strokeStyle = sel ? acc : 'rgba(255,255,255,.8)'; ctx.lineWidth = (sel ? 3 : 2) * d; ctx.setLineDash(sel ? [] : [6 * d, 4 * d]);
        ctx.beginPath(); ctx.moveTo(ox - 40 * d, Y); ctx.lineTo(ox + iw + 40 * d, Y); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = sel ? acc : '#0F1012'; ctx.strokeStyle = acc; ctx.lineWidth = 2 * d; ctx.beginPath(); ctx.arc(ox + iw + 40 * d, Y, 9 * d, 0, 6.283); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ECEEF0'; ctx.font = '600 ' + 12 * d + 'px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText((i + 1) + ' · ' + sp.hold.toFixed(1) + ' s' + (sp.zoom > 1.01 ? ' · ×' + sp.zoom.toFixed(1) : ''), ox - 46 * d, Y - 10 * d);
        ctx.restore();
      });
    }
    function drawGuides(ctx, c) {
      const W = c.width, H = c.height;
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, S.dpr); ctx.beginPath();
      [1 / 3, 2 / 3].forEach((k) => { ctx.moveTo(W * k, 0); ctx.lineTo(W * k, H); ctx.moveTo(0, H * k); ctx.lineTo(W, H * k); });
      ctx.moveTo(W / 2 - 10 * S.dpr, H / 2); ctx.lineTo(W / 2 + 10 * S.dpr, H / 2); ctx.moveTo(W / 2, H / 2 - 10 * S.dpr); ctx.lineTo(W / 2, H / 2 + 10 * S.dpr); ctx.stroke();
      ctx.setLineDash([6 * S.dpr, 5 * S.dpr]); ctx.strokeStyle = 'rgba(140,124,255,.9)'; ctx.strokeRect(W * 0.05, H * 0.05, W * 0.9, H * 0.9); ctx.restore();
    }
    function drawSafe(ctx, c) {
      const W = c.width, H = c.height;
      ctx.save(); ctx.fillStyle = 'rgba(229,51,61,.22)'; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5;
      [[0, 0, W, H * 0.13], [0, H * 0.78, W, H * 0.22], [W * 0.84, H * 0.42, W * 0.16, H * 0.36]].forEach((r) => { ctx.fillRect(r[0], r[1], r[2], r[3]); ctx.strokeRect(r[0], r[1], r[2], r[3]); });
      ctx.restore();
    }
    function drawCam(ctx, o, sh) {
      const c = el.canvas, { k, ox, oy } = camMap(c, o), lw = (2 * S.dpr) / k;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#16181B'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.setTransform(k, 0, 0, k, ox, oy);
      MC.renderShot(ctx, sh, 0, Object.assign({}, o, { cam: { x: 0, y: 0, zoom: 1, rot: 0, sx: 0, sy: 0 }, noClip: true, holes: false }));
      const path = (fr, rot) => { ctx.save(); ctx.translate(fr.cx, fr.cy); ctx.rotate(((rot || 0) * Math.PI) / 180); ctx.rect(-fr.hw, -fr.hh, fr.hw * 2, fr.hh * 2); ctx.restore(); };
      const act = sh.camera[S.kf], oth = sh.camera[S.kf === 'from' ? 'to' : 'from'], fa = frameRect(act, o), fo = frameRect(oth, o);
      const css = getComputedStyle(document.documentElement), acc = css.getPropertyValue('--accent').trim() || '#8C7CFF';
      const cp = sh.camera.path;
      if (cp && cp.custom) {
        const pts = cp.pts, sel = pts[clamp(S.wp, 0, pts.length - 1)], fs = frameRect(sel, o);
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.rect(-ox / k, -oy / k, c.width / k, c.height / k); path(fs, 0); ctx.fill('evenodd'); ctx.restore();
        ctx.lineWidth = lw * 0.6; ctx.strokeStyle = 'rgba(236,238,240,.35)'; ctx.setLineDash([lw * 3, lw * 3]); ctx.strokeRect(0, 0, o.W, o.H); ctx.setLineDash([]);
        ctx.beginPath(); pts.forEach((q, i) => { const fr = frameRect(q, o); i ? ctx.lineTo(fr.cx, fr.cy) : ctx.moveTo(fr.cx, fr.cy); }); ctx.strokeStyle = acc; ctx.lineWidth = lw; ctx.stroke();
        pts.forEach((q, i) => {
          const fr = frameRect(q, o), on = q === sel;
          ctx.beginPath(); path(fr, 0); ctx.strokeStyle = on ? acc : 'rgba(236,238,240,.6)'; ctx.lineWidth = lw * (on ? 1.4 : 0.6); ctx.setLineDash(on ? [] : [lw * 3, lw * 3]); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = on ? acc : '#0F1012'; ctx.strokeStyle = acc; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(fr.cx, fr.cy, lw * 6, 0, 6.283); ctx.fill(); ctx.stroke();
          ctx.fillStyle = on ? '#0F1012' : '#ECEEF0'; ctx.font = '700 ' + lw * 7 + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), fr.cx, fr.cy + lw * 0.3);
        });
        ctx.fillStyle = acc; ctx.fillRect(fs.cx + fs.hw - lw * 5, fs.cy + fs.hh - lw * 5, lw * 10, lw * 10);
        const cu2 = MC.camAt(sh, clamp(S.time - MC.shotStarts(S.project)[S.si], 0, sh.duration), false), fc2 = frameRect(cu2, o);
        ctx.beginPath(); path(fc2, 0); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = lw * 0.6; ctx.stroke();
        ctx.setTransform(1, 0, 0, 1, 0, 0); return;
      }
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.rect(-ox / k, -oy / k, c.width / k, c.height / k); path(fa, act.rot); ctx.fill('evenodd'); ctx.restore();
      ctx.lineWidth = lw * 0.6; ctx.strokeStyle = 'rgba(236,238,240,.35)'; ctx.setLineDash([lw * 3, lw * 3]); ctx.strokeRect(0, 0, o.W, o.H);
      ctx.beginPath(); path(fo, oth.rot); ctx.strokeStyle = 'rgba(236,238,240,.6)'; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(fo.cx, fo.cy); ctx.lineTo(fa.cx, fa.cy); ctx.strokeStyle = acc; ctx.lineWidth = lw; ctx.stroke();
      const cur = MC.camAt(sh, clamp(S.time - MC.shotStarts(S.project)[S.si], 0, sh.duration), false), fc = frameRect(cur, o);
      ctx.beginPath(); path(fc, cur.rot); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = lw * 0.6; ctx.stroke();
      ctx.beginPath(); path(fa, act.rot); ctx.strokeStyle = acc; ctx.lineWidth = lw * 1.4; ctx.stroke();
      ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(fa.cx, fa.cy, lw * 3, 0, 6.283); ctx.fill();
      const hx = fa.cx + fa.hw, hy = fa.cy + fa.hh; ctx.fillStyle = acc; ctx.fillRect(hx - lw * 5, hy - lw * 5, lw * 10, lw * 10);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function closePoly() {
      const sh = shot(), pg = sh && sh.page;
      if (!pg || !S.poly || S.poly.length < 3) return;
      const q = MC.syncPanel({ id: MC.uid(), pts: S.poly.map((pt) => pt.slice()), x0: 0, y0: 0, x1: 1, y1: 1, hold: null });
      pg.panels.push(q); S.pn = q.id; pg.manual = true; S.poly = null; S.polyCur = null; S.ptool = 'rect'; renderVbar(); commit();
    }
    const camTarget = (sh) => { const pa = sh.camera.path; if (pa && pa.custom) { S.wp = clamp(S.wp, 0, pa.pts.length - 1); return pa.pts[S.wp]; } return sh.camera[S.kf]; };
    const txById = (id) => S.project.texts.find((x) => x.id === id);
    /* interacción con el visor */
    let drag = null;
    function wire(c) {
      const px = (e) => { const r = c.getBoundingClientRect(), s = c.width / r.width; return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s }; };
      c.addEventListener('pointerdown', (e) => {
        if (e.button === 1 || (e.altKey && S.vz.z !== 1)) { e.preventDefault(); c.setPointerCapture(e.pointerId); drag = { m: 'vpan', x0: e.clientX, y0: e.clientY, vx: S.vz.x, vy: S.vz.y }; S.dragging = true; return; }
        const sh = shot(), o = opts(), p = px(e);
        if (!sh) return;
        if (S.view === 'depth') {
          const hit = (S.depthHit || []).slice().reverse().find((q) => p.x >= q.x0 && p.x <= q.x1 && p.y >= q.y0 && p.y <= q.y1);
          if (hit) { S.li = hit.i; S.tx = null; S.cl = null; drag = { m: 'depthz', l: sh.layers[hit.i] }; c.setPointerCapture(e.pointerId); S.dragging = true; renderLayers(); renderInspector(); S.dirty = true; }
          return;
        }
        if (S.view === 'page') {
          const pg = sh.page, M = S.pageMap; if (!pg || !M) return;
          const iw = M.img.w * M.kp, ih = M.img.h * M.kp, nx = (p.x - M.ox) / iw, ny = (p.y - M.oy) / ih, sel = pg.panels.find((q) => q.id === S.pn);
          if (S.ptool === 'poly') {
            const pt = [clamp(nx, 0, 1), clamp(ny, 0, 1)];
            if (S.poly && S.poly.length >= 3 && Math.hypot((S.poly[0][0] - pt[0]) * iw, (S.poly[0][1] - pt[1]) * ih) < 14 * S.dpr) closePoly(); else S.poly = (S.poly || []).concat([pt]);
            S.dirty = true; return;
          }
          if (sel && sel.pts) {
            const idx = sel.pts.findIndex((q) => Math.hypot(M.ox + q[0] * iw - p.x, M.oy + q[1] * ih - p.y) < 14 * S.dpr);
            if (idx >= 0) { S.pv = idx; drag = { m: 'pnvert', q: sel, idx, M, iw, ih }; }
          }
          if (!drag && sel && !sel.pts) {
            const cs = [['tl', sel.x0, sel.y0], ['tr', sel.x1, sel.y0], ['bl', sel.x0, sel.y1], ['br', sel.x1, sel.y1]];
            const hit = cs.find((q) => Math.hypot(M.ox + q[1] * iw - p.x, M.oy + q[2] * ih - p.y) < 16 * S.dpr);
            if (hit) drag = { m: 'pnsize', q: sel, corner: hit[0], M, iw, ih };
          }
          if (!drag) {
            const hit = pg.panels.filter((q) => MC.panelHas(q, nx, ny)).sort((a, b) => (a.x1 - a.x0) * (a.y1 - a.y0) - (b.x1 - b.x0) * (b.y1 - b.y0))[0];
            if (hit) { S.pn = hit.id; S.pv = null; drag = { m: 'pnmove', q: hit, p0: p, o0: Object.assign({}, hit, { pts: hit.pts ? hit.pts.map((q) => q.slice()) : null }), iw, ih }; renderInspector(); }
            else { S.pn = null; drag = { m: 'pnnew', q: { id: MC.uid(), x0: clamp(nx, 0, 1), y0: clamp(ny, 0, 1), x1: clamp(nx, 0, 1), y1: clamp(ny, 0, 1), hold: null }, M, iw, ih, s0: { x: clamp(nx, 0, 1), y: clamp(ny, 0, 1) } }; }
          }
          if (drag) { c.setPointerCapture(e.pointerId); S.dragging = true; S.dirty = true; }
          return;
        }
        if (S.view === 'strip') {
          const M = S.stripMap, wt = sh.webtoon; if (!M || !wt) return;
          const hit = wt.stops.find((sp) => Math.abs(M.oy + sp.y * M.ih - p.y) < 14 * S.dpr && p.x > M.ox - 60 * S.dpr && p.x < M.ox + M.iw + 60 * S.dpr);
          if (hit) { S.sp = hit.id; drag = { m: 'spmove', sp: hit, M }; renderInspector(); }
          else if (p.x >= M.ox && p.x <= M.ox + M.iw && p.y >= M.oy && p.y <= M.oy + M.ih) drag = { m: 'spnew', y: clamp((p.y - M.oy) / M.ih, 0, 1), moved: false };
          if (drag) { c.setPointerCapture(e.pointerId); S.dragging = true; }
          return;
        }
        if (S.view === 'cam') {
          const { k, ox, oy } = camMap(c, o), wx = (p.x - ox) / k, wy = (p.y - oy) / k, pa = sh.camera.path && sh.camera.path.custom ? sh.camera.path : null;
          if (pa) {
            const cu = frameRect(pa.pts[clamp(S.wp, 0, pa.pts.length - 1)], o);
            if (Math.hypot(p.x - ((cu.cx + cu.hw) * k + ox), p.y - ((cu.cy + cu.hh) * k + oy)) >= 26 * S.dpr) {
              let best = -1, bd = 1e9;
              pa.pts.forEach((q, i) => { const f2 = frameRect(q, o); if (Math.abs(wx - f2.cx) <= f2.hw && Math.abs(wy - f2.cy) <= f2.hh) { const d2 = Math.hypot(wx - f2.cx, wy - f2.cy); if (d2 < bd) { bd = d2; best = i; } } });
              if (best >= 0 && best !== S.wp) { S.wp = best; renderInspector(); S.dirty = true; }
            }
          }
          const kf = camTarget(sh), fr = frameRect(kf, o), hx = (fr.cx + fr.hw) * k + ox, hy = (fr.cy + fr.hh) * k + oy;
          if (Math.hypot(p.x - hx, p.y - hy) < 26 * S.dpr) drag = { m: 'zoom', k, ox, oy, fr, o, kf };
          else if (Math.abs(wx - fr.cx) <= fr.hw && Math.abs(wy - fr.cy) <= fr.hh) drag = { m: 'move', p0: p, x0: kf.x, y0: kf.y, k, o, kf };
        } else if (!S.playing) {
          const k2 = c.width / o.W, fx = p.x / k2, fy = p.y / k2, cur = S.tx && txById(S.tx), chit = S.hits.find((x) => x.id === S.tx);
          const ovLocal = (b, X, Y) => { const r = (-b.rot * Math.PI) / 180, dx = X - b.cx, dy = Y - b.cy; return [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)]; };
          const ovSel = S.ov && ovById(S.ov), ovAct = MC.overlaysAt(S.project, S.time);
          if (ovSel && ovAct.includes(ovSel) && MC.assets.get(ovSel.assetId)) {
            const b = MC.overlayBox(ovSel, MC.assets.get(ovSel.assetId), o, S.time), [lx, ly] = ovLocal(b, fx, fy), tol = (22 * S.dpr) / k2;
            if (Math.hypot(lx - b.w / 2, ly - b.h / 2) < tol) { b.o_W = o.W; drag = { m: 'ovscale', it: ovSel, s0: ovSel.scale == null ? 1 : ovSel.scale, d0: Math.max(1, Math.hypot(fx - b.cx, fy - b.cy)), b }; }
            else if (Math.hypot(lx, ly + b.h / 2 + (36 * S.dpr) / k2) < tol) { b.o_W = o.W; drag = { m: 'ovrot', it: ovSel, a0: ovSel.rot || 0, an0: Math.atan2(fy - b.cy, fx - b.cx), b }; }
          }
          if (drag) { /* asa de la superposición */ }
          else if (cur && chit && chit.tip && Math.hypot(fx - chit.tip.x, fy - chit.tip.y) < (22 * S.dpr) / k2) drag = { m: 'tail', it: cur, hit: chit, o };
          else {
            const h2 = S.hits.slice().reverse().find((x) => fx >= x.bounds.x0 && fx <= x.bounds.x1 && fy >= x.bounds.y0 && fy <= x.bounds.y1);
            if (h2) {
              const it = txById(h2.id); S.tx = it.id; S.li = -1; S.cl = null;
              drag = it.kind === 'sub' ? { m: 'sub', p0: p, y0: MC.subY(S.project, o.W, o.H) } : { m: 'text', p0: p, x0: it.x, y0: it.y, it };
              renderInspector(); renderLayers(); renderTimeline(); S.dirty = true;
            } else if (S.tx) { S.tx = null; renderInspector(); renderTimeline(); S.dirty = true; }
          }
          if (!drag) {
            for (const it of ovAct.slice().reverse()) {
              if (it.locked) continue;
              const a = MC.assets.get(it.assetId); if (!a) continue;
              const b = MC.overlayBox(it, a, o, S.time), [lx, ly] = ovLocal(b, fx, fy);
              if (Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2) { S.ov = it.id; S.tx = null; S.cl = null; S.li = -1; drag = { m: 'ovmove', it, p0: p, x0: it.x || 0, y0: it.y || 0 }; renderInspector(); renderLayers(); renderTimeline(); S.dirty = true; break; }
            }
          }
          if (!drag && layer() && !layer().locked) {
          const l = layer(), img = MC.assets.get(l.assetId);
          if (!img) return;
          const tl = clamp(S.time - MC.shotStarts(S.project)[S.si], 0, sh.duration);
          const px2 = MC.panelXf(S.project, sh, o.W, o.H);
          drag = { m: 'layer', p0: p, x0: l.x || 0, y0: l.y || 0, zl: MC.layerGeom(l, img, MC.camAt(sh, tl, false), o).zl * (px2 && S.view === 'out' ? px2.s : 1), l };
          }
        }
        if (drag) { c.setPointerCapture(e.pointerId); S.dragging = true; }
      });
      c.addEventListener('pointermove', (e) => {
        { const r0 = c.getBoundingClientRect(), s0 = c.width / r0.width; S.mouse = { x: (e.clientX - r0.left) * s0, y: (e.clientY - r0.top) * s0 }; if (S.rulers && !drag) S.dirty = true; }
        if (!drag && S.view === 'page' && S.poly) { const M = S.pageMap, q = px(e); if (M) { S.polyCur = [clamp((q.x - M.ox) / (M.img.w * M.kp), 0, 1), clamp((q.y - M.oy) / (M.img.h * M.kp), 0, 1)]; S.dirty = true; } return; }
        if (!drag) return;
        if (drag.m === 'vpan') { S.vz.x = drag.vx + (e.clientX - drag.x0); S.vz.y = drag.vy + (e.clientY - drag.y0); applyViewXf(); return; }
        const p = px(e), sh = shot();
        if (drag.m === 'depthz') { drag.l.z = clamp(Math.round(((p.x - DEPTH.pad * S.dpr) / (c.width - 2 * DEPTH.pad * S.dpr)) * 100) / 100, 0, 1); S.dirty = true; scheduleSave(); return; }
        if (drag.m === 'pnmove') {
          const q = drag.q, o0 = drag.o0, dx = clamp((p.x - drag.p0.x) / drag.iw, -o0.x0, 1 - o0.x1), dy = clamp((p.y - drag.p0.y) / drag.ih, -o0.y0, 1 - o0.y1);
          q.x0 = o0.x0 + dx; q.x1 = o0.x1 + dx; q.y0 = o0.y0 + dy; q.y1 = o0.y1 + dy;
          if (o0.pts) q.pts = o0.pts.map((pt) => [pt[0] + dx, pt[1] + dy]);
        } else if (drag.m === 'pnvert') {
          drag.q.pts[drag.idx] = [clamp((p.x - drag.M.ox) / drag.iw, 0, 1), clamp((p.y - drag.M.oy) / drag.ih, 0, 1)]; MC.syncPanel(drag.q);
        } else if (drag.m === 'spmove') {
          drag.sp.y = clamp((p.y - drag.M.oy) / drag.M.ih, 0, 1);
        } else if (drag.m === 'spnew') {
          drag.moved = true;
        } else if (drag.m === 'pnsize') {
          const q = drag.q, nx = clamp((p.x - drag.M.ox) / drag.iw, 0, 1), ny = clamp((p.y - drag.M.oy) / drag.ih, 0, 1), cn = drag.corner;
          if (cn[1] === 'l') q.x0 = Math.min(nx, q.x1 - 0.03); else q.x1 = Math.max(nx, q.x0 + 0.03);
          if (cn[0] === 't') q.y0 = Math.min(ny, q.y1 - 0.03); else q.y1 = Math.max(ny, q.y0 + 0.03);
        } else if (drag.m === 'pnnew') {
          const nx = clamp((p.x - drag.M.ox) / drag.iw, 0, 1), ny = clamp((p.y - drag.M.oy) / drag.ih, 0, 1);
          drag.q.x0 = Math.min(drag.s0.x, nx); drag.q.x1 = Math.max(drag.s0.x, nx); drag.q.y0 = Math.min(drag.s0.y, ny); drag.q.y1 = Math.max(drag.s0.y, ny);
        } else if (drag.m === 'move') {
          drag.kf.x = clamp(drag.x0 + (p.x - drag.p0.x) / drag.k / drag.o.W, -0.6, 0.6); drag.kf.y = clamp(drag.y0 + (p.y - drag.p0.y) / drag.k / drag.o.H, -0.6, 0.6);
          sh.camera.preset = 'custom';
        } else if (drag.m === 'zoom') {
          const wx = (p.x - drag.ox) / drag.k; drag.kf.zoom = clamp(drag.o.W / (2 * Math.max(1, wx - drag.fr.cx)), 1, 4); sh.camera.preset = 'custom';
        } else if (drag.m === 'text') {
          drag.it.x = drag.x0 + (p.x - drag.p0.x) / c.width; drag.it.y = drag.y0 + (p.y - drag.p0.y) / c.height;
        } else if (drag.m === 'sub') {
          S.project.sub.y = clamp(drag.y0 + (p.y - drag.p0.y) / c.height, -0.3, 0.48);
        } else if (drag.m === 'tail') {
          const k2 = c.width / drag.o.W; drag.it.tail = { x: (p.x / k2 - drag.hit.cx) / drag.o.W, y: (p.y / k2 - drag.hit.cy) / drag.o.H };
        } else if (drag.m === 'ovmove') {
          drag.it.x = Math.round((drag.x0 + (p.x - drag.p0.x) / c.width) * 1000) / 1000; drag.it.y = Math.round((drag.y0 + (p.y - drag.p0.y) / c.height) * 1000) / 1000;
        } else if (drag.m === 'ovscale') {
          const k2 = c.width / drag.b.o_W, fx = p.x / k2, fy = p.y / k2;
          drag.it.scale = clamp(drag.s0 * (Math.hypot(fx - drag.b.cx, fy - drag.b.cy) / drag.d0), 0.05, 6);
        } else if (drag.m === 'ovrot') {
          const k2 = c.width / drag.b.o_W, fx = p.x / k2, fy = p.y / k2; let r = drag.a0 + ((Math.atan2(fy - drag.b.cy, fx - drag.b.cx) - drag.an0) * 180) / Math.PI;
          r = ((r + 540) % 360) - 180; const sn = Math.round(r / 15) * 15; if (Math.abs(r - sn) < 3) r = sn; drag.it.rot = Math.round(r * 10) / 10;
        } else if (drag.m === 'layer') {
          drag.l.x = drag.x0 + (p.x - drag.p0.x) / c.width / drag.zl; drag.l.y = drag.y0 + (p.y - drag.p0.y) / c.height / drag.zl;
        }
        S.dirty = true; scheduleSave();
      });
      const up = () => {
        if (!drag) return;
        if (drag.m === 'spnew') {
          const wt = shot().webtoon; if (!drag.moved) { const sp = { id: MC.uid(), y: Math.round(drag.y * 1000) / 1000, hold: 1.5, zoom: 1, x: 0 }; wt.stops.push(sp); S.sp = sp.id; }
        }
        if (drag.m && drag.m.slice(0, 2) === 'pn') {
          const pg = shot().page;
          if (drag.m === 'pnnew') { const q = drag.q; if (q.x1 - q.x0 > 0.04 && q.y1 - q.y0 > 0.03) { pg.panels.push(q); S.pn = q.id; } }
          pg.manual = true;
        }
        if (drag.m === 'vpan') { drag = null; S.dragging = false; return; }
        if (drag.m === 'depthz') { const sh0 = shot(); if (sh0) S.li = placeByZ(sh0, drag.l); }
        drag = null; S.dragging = false; commit();
      };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
      c.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); setViewZoom(S.vz.z * Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY); return; }
        const sh = shot(), f = Math.exp(-e.deltaY * 0.0012);
        if (S.view === 'cam' && sh) { const kf = sh.camera[S.kf]; kf.zoom = clamp(kf.zoom * f, 1, 4); sh.camera.preset = 'custom'; }
        else if (layer()) { const l = layer(); l.scale = clamp((l.scale || 1) * f, 0.5, 3); } else return;
        e.preventDefault(); S.dirty = true; touch();
        clearTimeout(wire.wt); wire.wt = setTimeout(commit, 350);
      }, { passive: false });
    }

    /* ---------- línea de tiempo ---------- */
    const TRACKS = [
      { es: '1 · Planos', en: '1 · Shots' }, { es: '2 · Texto', en: '2 · Text' }, { es: '3 · Locución', en: '3 · Voice' },
      { es: '4 · SFX', en: '4 · SFX' }, { es: '5 · Música', en: '5 · Music' },
    ];
    const AU = ['voz', 'sfx', 'musica'];
    const WAVE = { bg: '', fg: '' };
    function drawWave(canvas, c, w) {
      const a = MC.audio.get(c.assetId); if (!a) return;
      const hh = 26; canvas.width = Math.max(1, Math.floor(w)); canvas.height = hh;
      const g = canvas.getContext('2d'); g.clearRect(0, 0, canvas.width, hh);
      g.fillStyle = WAVE.fg || '#ECEEF0'; g.globalAlpha = 0.85;
      for (let x = 0; x < canvas.width; x += 2) {
        const i0 = Math.floor((c.offset + (x / canvas.width) * c.dur) * 50), i1 = Math.floor((c.offset + ((x + 2) / canvas.width) * c.dur) * 50);
        let m = 0; for (let i = i0; i <= Math.max(i0, i1); i++) m = Math.max(m, a.peaks[i] || 0);
        const bh = Math.max(1, (m / 255) * hh); g.fillRect(x, (hh - bh) / 2, 1.4, bh);
      }
    }
    function layoutClips() {
      const p = S.project, starts = MC.shotStarts(p), total = MC.totalTime(p), pps = S.pps;
      const end = Math.max(total, ...p.clips.map((c) => c.start + c.dur), ...(p.overlays || []).map((o) => o.start + o.dur), ...(p.subs || []).map((o) => o.start + o.dur), ...p.texts.map((x) => { const q = MC.textSpan(x, p); return q.start + q.dur; }));
      el.tlContent.style.width = Math.max(end * pps + 120, 320) + 'px';
      el.tlContent.querySelectorAll('.clip[data-i]').forEach((c) => {
        const i = +c.dataset.i, sh = p.shots[i]; if (!sh) return;
        c.style.left = starts[i] * pps + 'px'; c.style.width = Math.max(8, sh.duration * pps - 2) + 'px';
      });
      el.tlContent.querySelectorAll('.lyrbar').forEach((c) => {
        const i = +c.dataset.si, sh = p.shots[i]; if (!sh) return;
        c.style.left = starts[i] * pps + 'px'; c.style.width = Math.max(8, sh.duration * pps - 2) + 'px';
      });
      el.tlContent.querySelectorAll('.clip[data-tr]').forEach((c) => {
        const i = +c.dataset.tr, sh = p.shots[i]; if (!sh) return;
        c.style.left = starts[i] * pps + 'px'; c.style.width = Math.max(8, Math.min(sh.transition.dur, sh.duration * 0.9) * pps - 2) + 'px';
      });
      el.tlContent.querySelectorAll('.clip[data-x]').forEach((el2) => {
        const it = txById(el2.dataset.x); if (!it) return;
        const sp = MC.textSpan(it, p); el2.style.left = sp.start * pps + 'px'; el2.style.width = Math.max(8, sp.dur * pps - 2) + 'px';
      });
      el.tlContent.querySelectorAll('.clip[data-c]').forEach((el2) => {
        const c = clipById(el2.dataset.c); if (!c) return;
        el2.style.left = c.start * pps + 'px'; el2.style.width = Math.max(8, c.dur * pps - 2) + 'px';
        drawWave(el2.querySelector('canvas'), c, c.dur * pps - 2);
      });
      el.tlContent.querySelectorAll('.clip[data-s]').forEach((el2) => {
        const it = subById(el2.dataset.s); if (!it) return;
        el2.style.left = it.start * pps + 'px'; el2.style.width = Math.max(8, it.dur * pps - 2) + 'px';
        el2.querySelectorAll('.sbq, .sbw').forEach((n) => n.remove());
        MC.subCues(it, p.lang, it.style).forEach((c) => {
          el2.append(h('div', { class: 'sbq' + (c.words.some((w) => w.est) ? ' est' : ''), 'data-w': c.words[0].i, title: c.words.map((w) => w.w).join(' '), style: { left: (c.s - it.start) * pps + 'px', width: Math.max(4, (c.e - c.s) * pps - 2) + 'px' } }, c.words.map((w) => w.w).join(' ')));
          c.words.forEach((w) => el2.append(h('i', { class: 'sbw' + (w.est ? ' est' : ''), style: { left: (w.s - it.start) * pps + 'px' } })));
        });
      });
      el.tlContent.querySelectorAll('.clip[data-f]').forEach((el2) => {
        const si = +el2.dataset.fs, shx = p.shots[si], f = shx && (shx.fx || []).find((q) => q.id === el2.dataset.f); if (!f) return;
        el2.style.left = (starts[si] + MC.fxStart(shx, f)) * pps + 'px'; el2.style.width = Math.max(8, f.dur * pps - 2) + 'px';
      });
      el.tlContent.querySelectorAll('.clip[data-o]').forEach((el2) => {
        const it = ovById(el2.dataset.o); if (!it) return;
        el2.style.left = it.start * pps + 'px'; el2.style.width = Math.max(8, it.dur * pps - 2) + 'px';
        const aa = MC.assets.get(it.assetId); if (aa && aa.strip && el2.classList.contains('vid')) applyStrip(el2, it, aa);
      });
      const kt = kfTarget();
      if (kt) el.tlContent.querySelectorAll('.kfd').forEach((d) => { const q = (kt.it.kf || []).find((z) => z.id === d.dataset.kf); if (q) d.style.left = (kt.start + q.t) * pps - 7 + 'px'; });
      layoutLanes();
      updateTime();
    }
    /* Si varios clips de una misma pista se solapan, pasan a una segunda (tercera…) fila dentro de esa pista. */
    const p0 = () => S.project;
    function layoutLanes() {
      const LH0 = parseFloat(getComputedStyle(el.tlContent).getPropertyValue('--lh')) || 34;
      el.tlContent.querySelectorAll('.tl-track').forEach((row) => {
        const LH = row.dataset.k === 'subs' ? Math.max(LH0, 46) : LH0;
        const clips = [...row.children].filter((c) => c.classList.contains('clip') && !c.classList.contains('thin'));
        const items = clips.map((c) => ({ c, a: parseFloat(c.style.left) || 0, b: (parseFloat(c.style.left) || 0) + (parseFloat(c.style.width) || 0) })).sort((x, y) => x.a - y.a || x.b - y.b);
        const ends = [];
        items.forEach((it) => { let l = ends.findIndex((e2) => e2 <= it.a + 0.5); if (l < 0) { l = ends.length; ends.push(0); } ends[l] = it.b; it.c.style.top = (l * LH + 4) + 'px'; it.c.style.bottom = 'auto'; it.c.style.height = (LH - 8) + 'px'; });
        let n = Math.max(1, ends.length);
        if (row.dataset.k === 'shots') {
          const ex = Math.max(0, ...p0().shots.filter((q) => S.expand[q.id] && !(q.page || q.webtoon)).map((q) => q.layers.length)); if (ex) n = Math.max(n, 1 + ex);
          row.querySelectorAll('.lyrbar').forEach((b2) => { const sh2 = p0().shots[+b2.dataset.si]; if (!sh2) return; const k = sh2.layers.length - 1 - +b2.dataset.li; b2.style.top = (LH * (1 + k) + 3) + 'px'; b2.style.height = (LH - 6) + 'px'; });
          row.querySelectorAll('.clip.thin').forEach((c) => { c.style.top = (LH - 7) + 'px'; c.style.bottom = 'auto'; });
        }
        row.style.height = n * LH + 'px';
        const lab = el.tlLabels.querySelector('[data-k="' + row.dataset.k + '"]'); if (lab) lab.style.height = n * LH + 'px';
        row.classList.toggle('multi', n > 1);
      });
    }
    /* tiras de fotogramas de los vídeos dentro de sus clips */
    function applyStrip(n, it, a) { n.style.backgroundImage = 'url(' + a.strip + ')'; n.style.backgroundRepeat = 'no-repeat'; n.style.backgroundSize = a.dur * S.pps + 'px 100%'; n.style.backgroundPosition = -(it.offset || 0) * S.pps + 'px center'; n.classList.add('film'); }
    function stripPending() {
      el.tlContent.querySelectorAll('.clip.ov.vid').forEach((n) => {
        const it = ovById(n.dataset.o), a = it && MC.assets.get(it.assetId); if (!a || !a.video) return;
        if (a.strip) { applyStrip(n, it, a); return; }
        if (a._stripBusy) return; a._stripBusy = true;
        MC.video.strip(a).then((u) => { a.strip = u; a._stripBusy = false; if (S.alive) layoutClips(); }).catch(() => { a._stripBusy = false; });
      });
    }
    function snapT(tm, ignore) {
      const pts = [0, S.time].concat(MC.shotStarts(S.project), (S.project.notes || []).map((n) => n.t), S.project.clips.filter((c) => c.id !== ignore).flatMap((c) => [c.start, c.start + c.dur]), S.project.overlays.flatMap((o) => [o.start, o.start + o.dur]));
      let best = tm; const thr = 8 / S.pps;
      pts.forEach((x) => { if (Math.abs(x - tm) < thr && Math.abs(x - tm) <= Math.abs(best - tm)) best = x; });
      return Math.max(0, Math.round(best * 100) / 100);
    }
    /* ---------- línea de tiempo avanzada: ripple, selección múltiple, grupos y marcadores ---------- */
    S.ripple = MC.store.get('ripple', '0') === '1'; S.expand = S.expand || {};
    const rippleBegin = (fromT) => {
      const p = S.project, snap = [];
      p.clips.forEach((c) => { if (c.start >= fromT - 0.001) snap.push([c, 'start', c.start]); });
      p.overlays.forEach((o) => { if (o.start >= fromT - 0.001) snap.push([o, 'start', o.start]); });
      p.texts.forEach((x) => { if (!x.link && x.start >= fromT - 0.001) snap.push([x, 'start', x.start]); });
      (p.notes || []).forEach((n) => { if (n.t >= fromT - 0.001) snap.push([n, 't', n.t]); });
      return snap;
    };
    const rippleApply = (snap, delta) => { snap.forEach((q) => { q[0][q[1]] = Math.max(0, Math.round((q[2] + delta) * 100) / 100); }); S.project.overlays.forEach(syncOvAudio); };
    const mkKey = { c: 'clip', x: 'text', o: 'overlay' };
    const itemOfKey = (k) => (k[0] === 'c' ? clipById(k.slice(2)) : k[0] === 'x' ? txById(k.slice(2)) : k[0] === 'o' ? ovById(k.slice(2)) : null);
    const allKeys = () => S.project.clips.map((c) => 'c:' + c.id).concat(S.project.overlays.map((o) => 'o:' + o.id), S.project.texts.filter((x) => !x.link).map((x) => 'x:' + x.id));
    const keyEl = (el2) => (el2.dataset.c ? 'c:' + el2.dataset.c : el2.dataset.x ? 'x:' + el2.dataset.x : el2.dataset.o ? 'o:' + el2.dataset.o : null);
    const multiItems = () => S.multi.map((k) => ({ k, it: itemOfKey(k) })).filter((q) => q.it);
    function setMulti(keys) {
      S.multi = keys.filter((k) => itemOfKey(k));
      if (S.multi.length > 1) { S.selKind = 'multi'; S.cl = null; S.tx = null; S.ov = null; S.li = -1; }
      else if (S.multi.length === 1) { const k = S.multi[0]; S.multi = []; if (k[0] === 'c') S.cl = k.slice(2); else if (k[0] === 'x') S.tx = k.slice(2); else S.ov = k.slice(2); }
      renderInspector(); renderTimeline(); renderLayers(); S.dirty = true;
    }
    const markMulti = () => el.tlContent.querySelectorAll('.clip[data-c], .clip[data-x], .clip[data-o]').forEach((n) => n.classList.toggle('sel', S.multi.includes(keyEl(n))));
    function dupSelection() {
      const p = S.project; let keys = S.multi.length > 1 ? S.multi.slice() : S.cl ? ['c:' + S.cl] : S.tx ? ['x:' + S.tx] : S.ov ? ['o:' + S.ov] : [];
      const items = keys.map((k) => ({ k, it: itemOfKey(k) })).filter((q) => q.it && !(q.k[0] === 'x' && q.it.link)); if (!items.length) return false;
      let a = Infinity, b = 0; items.forEach((q) => { const st = q.k[0] === 'x' ? MC.textSpan(q.it, p) : { start: q.it.start, dur: q.it.dur }; a = Math.min(a, st.start); b = Math.max(b, st.start + st.dur); });
      const shift = Math.round((b - a) * 100) / 100 || 1, ng = {}, out = [];
      items.forEach((q) => {
        const c = JSON.parse(JSON.stringify(q.it)); c.id = MC.uid(); c.start = Math.round((q.it.start + shift) * 100) / 100;
        if (q.it.group) { ng[q.it.group] = ng[q.it.group] || MC.uid(); c.group = ng[q.it.group]; }
        if (q.k[0] === 'c') { p.clips.push(c); out.push('c:' + c.id); }
        else if (q.k[0] === 'x') { p.texts.push(c); out.push('x:' + c.id); }
        else { c.audioClip = null; if (q.it.audioClip && clipById(q.it.audioClip)) { const k2 = JSON.parse(JSON.stringify(clipById(q.it.audioClip))); k2.id = MC.uid(); c.audioClip = k2.id; p.clips.push(k2); } p.overlays.push(c); syncOvAudio(c); out.push('o:' + c.id); }
      });
      S.multi = out.length > 1 ? out : []; if (out.length === 1) { const k = out[0]; if (k[0] === 'c') S.cl = k.slice(2); else if (k[0] === 'x') S.tx = k.slice(2); else S.ov = k.slice(2); }
      if (out.length > 1) S.selKind = 'multi';
      commit(); MC.announce(t('Duplicado', 'Duplicated')); return true;
    }
    /* marcadores con notas y de pulso */
    S.mk = null;
    const mkById = (id) => (S.project.notes || []).find((n) => n.id === id);
    function addMarker(kind) {
      const p = S.project; p.notes = p.notes || [];
      const n = { id: MC.uid(), t: Math.round(S.time * 100) / 100, text: '', color: kind === 'beat' ? '#e8c547' : '#8C7CFF', kind: kind || 'note' };
      p.notes.push(n); S.mk = n.id; S.selKind = 'marker'; commit(); return n;
    }
    function detectBeats(c) {
      const p = S.project, a = MC.audio.get(c.assetId); if (!a || !a.peaks) return 0;
      p.notes = (p.notes || []).filter((n) => !(n.kind === 'beat' && n.t >= c.start - 0.01 && n.t <= c.start + c.dur + 0.01));
      const pk = a.peaks, i0 = Math.floor(c.offset * 50), i1 = Math.min(pk.length, Math.floor((c.offset + c.dur) * 50)); let last = -99, n = 0;
      const sm = (i) => (pk[i - 1] || 0) * 0.25 + (pk[i] || 0) * 0.5 + (pk[i + 1] || 0) * 0.25;
      for (let i = i0 + 2; i < i1 - 1; i++) {
        let av = 0; for (let j = Math.max(i0, i - 25); j < i; j++) av += pk[j]; av /= Math.max(1, Math.min(25, i - i0));
        const v = sm(i);
        if (v > av * 1.45 + 8 && v >= sm(i - 1) && v > sm(i + 1) && v > 40 && i - last > 12) { last = i; n++; p.notes.push({ id: MC.uid(), t: Math.round((c.start + (i / 50 - c.offset)) * 100) / 100, text: '', color: '#e8c547', kind: 'beat' }); }
      }
      return n;
    }
    function cutsToBeat() {
      const p = S.project, beats = (p.notes || []).filter((n) => n.kind === 'beat').map((n) => n.t).sort((a, b) => a - b); if (!beats.length) return 0;
      let t0 = 0, n = 0;
      p.shots.forEach((sh, i) => {
        if (i < p.shots.length - 1 && !(sh.page || sh.webtoon)) { const end = t0 + sh.duration, near = beats.reduce((b, x) => (Math.abs(x - end) < Math.abs(b - end) ? x : b), beats[0]); if (Math.abs(near - end) <= 0.4 && near - t0 >= 0.5 && Math.abs(near - end) > 0.01) { sh.duration = Math.round((near - t0) * 100) / 100; n++; } }
        t0 += sh.duration;
      });
      return n;
    }
    function renderTimeline() {
      const p = S.project, total = MC.totalTime(p), pps = S.pps;
      const cs = getComputedStyle(document.documentElement); WAVE.fg = cs.getPropertyValue('--clip').trim();
      const addBtn = (tr) => h('button', { class: 'btn btn-g', type: 'button', title: t('Añadir audio a esta pista', 'Add audio to this track'), 'aria-label': t('Añadir audio a esta pista', 'Add audio to this track'), onClick: () => { fileAudio.dataset.track = tr; fileAudio.click(); } }, MC.icon('plus', 13));
      const ots = p.otracks, kft = kfTarget(), KEYS = ots.map((q, i) => 'o' + i).concat(kft ? ['kf'] : [], ['shots', 'text', 'subs', 'fxr', 'voz', 'sfx', 'musica']);
      const ovBtn = (i) => h('button', { class: 'btn btn-g', type: 'button', title: t('Añadir una imagen o un vídeo encima de la ilustración', 'Add an image or video above the artwork'), 'aria-label': t('Añadir una superposición a ', 'Add an overlay to ') + ots[i].name, onClick: () => { fileOv.dataset.track = i; fileOv.click(); } }, MC.icon('plus', 13));
      const eyeBtn = (i) => h('button', { class: 'btn btn-g', type: 'button', 'aria-pressed': String(ots[i].visible !== false), title: ots[i].visible === false ? t('Mostrar la pista', 'Show track') : t('Ocultar la pista', 'Hide track'), 'aria-label': t('Mostrar u ocultar ', 'Show or hide ') + ots[i].name, onClick: () => { ots[i].visible = ots[i].visible === false; commit(); } }, MC.icon(ots[i].visible === false ? 'eyeoff' : 'eye', 13));
      const delBtn = (i) => h('button', { class: 'btn btn-g', type: 'button', title: t('Quitar la pista vacía', 'Remove the empty track'), 'aria-label': t('Quitar ', 'Remove ') + ots[i].name, onClick: () => { p.overlays.forEach((o) => { if (o.track > i) o.track--; }); ots.splice(i, 1); commit(); } }, MC.icon('trash', 13));
      const labelOf = (k) => {
        if (/^o\d+$/.test(k)) { const i = +k.slice(1); return h('div', { class: 'trl ot', 'data-k': k }, h('span', { title: t('Doble clic para renombrar', 'Double-click to rename'), onDblclick: () => { const v = prompt(t('Nombre de la pista', 'Track name'), ots[i].name); if (v && v.trim()) { ots[i].name = v.trim(); commit(); } } }, ots[i].name),
          h('span', { class: 'trb' }, ovBtn(i), eyeBtn(i), ots.length > 1 && !p.overlays.some((o) => o.track === i) ? delBtn(i) : null)); }
        if (k === 'kf') return h('div', { class: 'trl kfl', 'data-k': k }, h('span', null, t('Fotogramas clave', 'Keyframes')));
        if (k === 'fxr') return h('div', { class: 'trl', 'data-k': k }, h('span', null, t('Efectos', 'Effects')));
        if (k === 'subs') return h('div', { class: 'trl', 'data-k': k }, h('span', null, t('Subtítulos', 'Subtitles')), h('span', { class: 'trb' }, h('button', { class: 'btn btn-g', type: 'button', title: t('Nuevo subtítulo', 'New subtitle'), 'aria-label': t('Nuevo subtítulo', 'New subtitle'), onClick: () => newSubLayer(false) }, MC.icon('plus', 13))));
        const ix = ['shots', 'text', 'voz', 'sfx', 'musica'].indexOf(k), tr = TRACKS[ix];
        return h('div', { class: 'trl', 'data-k': k }, h('span', null, t(tr.es, tr.en)),
          ix >= 2 ? h('span', { class: 'trb' }, addBtn(AU[ix - 2]), ix === 2 ? h('button', { class: 'btn btn-g', type: 'button', title: t('Grabar locución', 'Record voice-over'), 'aria-label': t('Grabar locución', 'Record voice-over'), onClick: recordVoice }, MC.icon('mic', 13)) : null) : null);
      };
      MC.put(MC.clear(el.tlLabels), h('div', { class: 'rs' }), KEYS.map(labelOf));
      MC.clear(el.tlContent);
      const ruler = h('div', { class: 'tl-ruler', 'aria-label': t('Regla de tiempo', 'Time ruler') });
      const step = pps >= 55 ? 1 : pps >= 28 ? 2 : 5;
      const end = Math.max(total, ...p.clips.map((c) => c.start + c.dur), ...p.overlays.map((o) => o.start + o.dur), ...p.texts.map((x) => { const q = MC.textSpan(x, p); return q.start + q.dur; }));
      for (let s = 0; s <= end + 40; s += step) ruler.append(h('b', { style: { left: s * pps + 'px' } }, Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')));
      p.markers.forEach((m) => ruler.append(h('i', { class: 'mk', title: t('Pausa de la voz', 'Voice pause'), style: { left: m * pps + 'px' } })));
      (p.notes || []).forEach((n) => {
        const b = h('button', { type: 'button', class: 'mkn ' + n.kind + (n.id === S.mk ? ' on' : ''), 'data-mk': n.id, style: { left: n.t * pps - 5 + 'px', color: n.color || '#8C7CFF' }, title: (n.kind === 'beat' ? t('Pulso · ', 'Beat · ') : t('Marcador · ', 'Marker · ')) + MC.fmtTime(n.t) + (n.text ? ' · ' + n.text : ''), 'aria-label': (n.kind === 'beat' ? t('Pulso en ', 'Beat at ') : t('Marcador en ', 'Marker at ')) + MC.fmtTime(n.t) + (n.text ? ': ' + n.text : '') });
        b.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); b.setPointerCapture(e.pointerId); S.mk = n.id; S.selKind = 'marker'; S.cl = null; S.tx = null; S.ov = null; S.li = -1; S.multi = [];
          const x0 = e.clientX, t0 = n.t; let moved = false;
          const mv = (ev) => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved) return; n.t = Math.max(0, Math.round((t0 + (ev.clientX - x0) / S.pps) * 100) / 100); b.style.left = n.t * S.pps - 5 + 'px'; touch(); };
          const up = () => { b.removeEventListener('pointermove', mv); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up); if (moved) commit(); else { setTime(n.t); renderInspector(); renderTimeline(); } };
          b.addEventListener('pointermove', mv); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
        });
        ruler.append(b);
      });
      el.tlContent.append(ruler);
      const R = {};
      KEYS.forEach((k) => {
        const ov = /^o\d+$/.test(k), audio = AU.includes(k);
        if (k === 'subs') { R.subs = h('div', { class: 'tl-track' + (p.subs.length ? '' : ' off'), 'data-k': 'subs', 'data-hint': t('Pulsa + para crear un subtítulo: una capa con todas las palabras y sus tiempos', 'Press + to create a subtitle: one layer with all the words and their timings') }); el.tlContent.append(R.subs); return; }
        if (k === 'fxr') { R.fxr = h('div', { class: 'tl-track' + (p.shots.some((q) => q.fx && q.fx.length) ? '' : ' off'), 'data-k': 'fxr', 'data-hint': t('Los efectos de cada plano (temblor, lluvia, niebla…) aparecen aquí', 'Each shot’s effects (shake, rain, fog…) show up here') }); el.tlContent.append(R.fxr); return; }
        if (k === 'kf') { R.kf = h('div', { class: 'tl-track kft', 'data-k': 'kf', 'data-hint': '' }); el.tlContent.append(R.kf); return; }
        R[k] = h('div', { class: 'tl-track' + (ov ? ' ovt' : '') + ((audio && !p.clips.some((c) => c.track === k)) || (ov && !p.overlays.some((o) => o.track === +k.slice(1))) ? ' off' : ''), 'data-k': k,
          'data-hint': ov ? t('Pulsa + para añadir una imagen o un vídeo por encima de la ilustración', 'Press + to add an image or video above the artwork') : t('Importa o graba audio con los botones de la izquierda', 'Import or record audio with the buttons on the left') });
        el.tlContent.append(R[k]);
      });
      p.shots.forEach((sh, i) => {
        const expd = !!S.expand[sh.id] && !(sh.page || sh.webtoon);
        let thumbU = ''; if (p.shots.length <= 40) { try { thumbU = shotThumbURL(sh); } catch (e) { thumbU = ''; } }
        const clip = h('div', { class: 'clip shotc' + (thumbU ? ' th' : '') + (i === S.si ? ' on' : ''), 'data-i': i, style: thumbU ? { backgroundImage: 'url(' + thumbU + ')' } : null, role: 'button', tabindex: '0', title: sh.name + ' · ' + sh.duration.toFixed(1) + ' s',
          onClick: () => { if (!clip._moved) selectShot(i, true); },
          'aria-label': sh.name + ', ' + sh.duration.toFixed(1) + ' s', 'aria-pressed': String(i === S.si),
          onKeydown: (e) => {
            if (e.key === 'Enter') selectShot(i, true);
            else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !(sh.page || sh.webtoon)) {
              e.preventDefault(); sh.duration = clamp(Math.round((sh.duration + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 0.1)) * 10) / 10, 0.5, 60); commit();
              MC.announce(sh.name + ', ' + sh.duration.toFixed(1) + ' s'); setTimeout(() => { const n = el.tlContent.querySelector('.clip[data-i="' + i + '"]'); if (n) n.focus(); }, 0);
            }
          } },
          (sh.page || sh.webtoon) ? null : h('button', { type: 'button', class: 'cvx', 'aria-expanded': String(expd), title: expd ? t('Plegar las capas del plano', 'Fold the shot’s layers') : t('Ver las capas del plano', 'Show the shot’s layers'), 'aria-label': (expd ? t('Plegar las capas de ', 'Fold the layers of ') : t('Ver las capas de ', 'Show the layers of ')) + sh.name, onPointerdown: (e) => e.stopPropagation(), onClick: (e) => { e.stopPropagation(); S.expand[sh.id] = !expd; renderTimeline(); } }, expd ? '▾' : '▸'),
          h('span', null, sh.name + ' · ' + sh.duration.toFixed(1) + ' s'), h('div', { class: 'rz', 'aria-label': t('Cambiar duración', 'Change length') }));
        const rz = clip.querySelector('.rz');
        if (sh.page || sh.webtoon) rz.remove();
        else rz.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); rz.setPointerCapture(e.pointerId);
          const x0 = e.clientX, d0 = sh.duration; clip._moved = true; const rp = S.ripple ? rippleBegin(MC.shotStarts(p)[i] + sh.duration) : null;
          const mv = (ev) => { sh.duration = clamp(Math.round((d0 + (ev.clientX - x0) / S.pps) * 10) / 10, 0.5, 60); if (rp) rippleApply(rp, sh.duration - d0); clip.firstChild.textContent = sh.name + ' · ' + sh.duration.toFixed(1) + ' s'; layoutClips(); S.dirty = true; };
          const endd = () => { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', endd); rz.removeEventListener('pointercancel', endd); setTimeout(() => { clip._moved = false; }, 0); commit(); };
          rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', endd); rz.addEventListener('pointercancel', endd);
        });
        R.shots.append(clip);
        if (expd) sh.layers.forEach((l, li) => {
          const a = MC.assets.get(l.assetId);
          const bar = h('div', { class: 'lyrbar' + (i === S.si && li === S.li ? ' on' : '') + (l.visible === false ? ' off' : ''), 'data-si': i, 'data-li': li, role: 'button', tabindex: '0', title: l.name + ' · z ' + l.z.toFixed(2), 'aria-label': l.name + ', ' + t('capa ', 'layer ') + (sh.layers.length - li) + t(' de ', ' of ') + sh.layers.length },
            a && a.thumb ? h('img', { src: a.thumb, alt: '' }) : null, h('span', null, l.name), l.locked ? h('i', null, '🔒') : null);
          bar.addEventListener('pointerdown', (e) => {
            e.stopPropagation(); bar.setPointerCapture(e.pointerId); if (S.si !== i) selectShot(i, false); S.li = li; S.tx = null; S.ov = null; S.cl = null; S.multi = [];
            const y0 = e.clientY, LHx = parseFloat(getComputedStyle(el.tlContent).getPropertyValue('--lh')) || 34; let moved = false, tgt = li;
            const mv = (ev) => { if (Math.abs(ev.clientY - y0) > 4) moved = true; if (!moved || l.locked) return; tgt = clamp(li - Math.round((ev.clientY - y0) / LHx), 0, sh.layers.length - 1); R.shots.querySelectorAll('.lyrbar[data-si="' + i + '"]').forEach((n) => n.classList.toggle('tgt', +n.dataset.li === tgt && tgt !== li)); };
            const up = () => { bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); if (moved && tgt !== li && !l.locked) { S.li = reorderLayer(sh, li, tgt); commit(); } else { renderLayers(); renderInspector(); R.shots.querySelectorAll('.lyrbar').forEach((n) => n.classList.toggle('on', +n.dataset.si === S.si && +n.dataset.li === S.li)); S.dirty = true; } };
            bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
          });
          R.shots.append(bar);
        });
        if (i > 0 && sh.transition.type !== 'cut') {
          const tr = MC.TRANSITIONS.find((x) => x.v === sh.transition.type);
          R.shots.append(h('div', { class: 'clip fx thin', 'data-tr': i, title: t('Transición de entrada: ', 'Entry transition: ') + t(tr.es, tr.en) }));
        }
      });
      p.clips.forEach((c) => {
        const a = MC.audio.get(c.assetId);
        const el2 = h('div', { class: 'clip au' + (c.id === S.cl ? ' on' : ''), 'data-c': c.id, role: 'button', tabindex: '0', title: c.name, 'aria-label': c.name + ', ' + MC.fmtTime(c.start) + ', ' + c.dur.toFixed(1) + ' s', 'aria-pressed': String(c.id === S.cl),
          onKeydown: (e) => { if (e.key === 'Enter') { S.cl = c.id; S.tx = null; commit(); } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); c.start = Math.max(0, Math.round((c.start + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 0.1)) * 100) / 100); S.cl = c.id; commit(); MC.announce(c.name + ', ' + MC.fmtTime(c.start)); setTimeout(() => { const n = el.tlContent.querySelector('.clip[data-c="' + c.id + '"]'); if (n) n.focus(); }, 0); } } }, h('canvas'), h('span', null, c.name), h('div', { class: 'rz', 'aria-label': t('Recortar el final', 'Trim the end') }));
        const rz = el2.querySelector('.rz');
        el2.addEventListener('pointerdown', (e) => {
          if (e.target === rz) return;
          el2.setPointerCapture(e.pointerId);
          el2.parentNode.parentNode.querySelectorAll('.clip.on').forEach((n) => n.classList.remove('on'));
          el2.classList.add('on'); S.cl = c.id; S.tx = null;
          const x0 = e.clientX, s0 = c.start; let moved = false;
          const mv = (ev) => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (moved) { c.start = snapT(s0 + (ev.clientX - x0) / S.pps, c.id); layoutClips(); touch(); } };
          const up = () => { el2.removeEventListener('pointermove', mv); el2.removeEventListener('pointerup', up); el2.removeEventListener('pointercancel', up); if (moved) commit(); else renderInspector(); };
          el2.addEventListener('pointermove', mv); el2.addEventListener('pointerup', up); el2.addEventListener('pointercancel', up);
        });
        rz.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); rz.setPointerCapture(e.pointerId);
          const x0 = e.clientX, d0 = c.dur, maxd = a ? a.dur - c.offset : 600;
          const mv = (ev) => { c.dur = clamp(Math.round((d0 + (ev.clientX - x0) / S.pps) * 100) / 100, 0.1, maxd); layoutClips(); touch(); };
          const up = () => { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', up); rz.removeEventListener('pointercancel', up); commit(); };
          rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', up); rz.addEventListener('pointercancel', up);
        });
        (R[c.track] || R.voz).append(el2);
      });
      p.texts.forEach((it) => {
        const sp = MC.textSpan(it, p), label = MC.textOf(it, p) || t('(sin texto)', '(no text)');
        const el2 = h('div', { class: 'clip tx' + (it.kind === 'sub' ? ' sub' : '') + (it.id === S.tx ? ' on' : ''), 'data-x': it.id, role: 'button', tabindex: '0', 'aria-label': label + ', ' + MC.fmtTime(sp.start) + ', ' + sp.dur.toFixed(1) + ' s', 'aria-pressed': String(it.id === S.tx),
          onKeydown: (e) => { if (e.key === 'Enter') { S.tx = it.id; S.cl = null; S.li = -1; commit(); } else if (e.altKey && !it.link && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); it.start = Math.max(0, Math.round((it.start + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 0.1)) * 100) / 100); S.tx = it.id; commit(); MC.announce(label + ', ' + MC.fmtTime(it.start)); setTimeout(() => { const n = el.tlContent.querySelector('.clip[data-x="' + it.id + '"]'); if (n) n.focus(); }, 0); } }, title: label + (it.link ? t(' · vinculado a la voz', ' · linked to voice') : '') }, h('span', null, label.replace(/\n/g, ' ')), it.link ? null : h('div', { class: 'rz', 'aria-label': t('Cambiar duración', 'Change length') }));
        const rz = el2.querySelector('.rz');
        el2.addEventListener('pointerdown', (e) => {
          if (e.target === rz) return;
          el2.setPointerCapture(e.pointerId);
          el2.parentNode.parentNode.querySelectorAll('.clip.on').forEach((n) => n.classList.remove('on'));
          el2.classList.add('on'); S.tx = it.id; S.cl = null; S.li = -1;
          const x0 = e.clientX, s0 = it.start; let moved = false;
          const mv = (ev) => { if (it.link) return; if (Math.abs(ev.clientX - x0) > 3) moved = true; if (moved) { it.start = snapT(s0 + (ev.clientX - x0) / S.pps, null); layoutClips(); touch(); } };
          const up = () => {
            el2.removeEventListener('pointermove', mv); el2.removeEventListener('pointerup', up); el2.removeEventListener('pointercancel', up);
            if (moved) { commit(); return; }
            const s2 = MC.textSpan(it, p);
            if (S.time < s2.start || S.time >= s2.start + s2.dur) setTime(s2.start + Math.min(0.5, s2.dur / 2));
            renderLayers(); renderInspector(); S.dirty = true;
          };
          el2.addEventListener('pointermove', mv); el2.addEventListener('pointerup', up); el2.addEventListener('pointercancel', up);
        });
        if (rz) rz.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); rz.setPointerCapture(e.pointerId);
          const x0 = e.clientX, d0 = it.dur;
          const mv = (ev) => { it.dur = clamp(Math.round((d0 + (ev.clientX - x0) / S.pps) * 100) / 100, 0.2, 60); layoutClips(); touch(); };
          const up = () => { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', up); rz.removeEventListener('pointercancel', up); commit(); };
          rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', up); rz.addEventListener('pointercancel', up);
        });
        R.text.append(el2);
      });
      /* capas de subtítulos: un clip con sus líneas dentro */
      p.subs.forEach((it) => {
        const el2 = h('div', { class: 'clip sb' + (it.id === S.sb ? ' on' : ''), 'data-s': it.id, role: 'button', tabindex: '0', title: it.name, 'aria-label': it.name + ', ' + MC.fmtTime(it.start) + ', ' + it.dur.toFixed(1) + ' s', 'aria-pressed': String(it.id === S.sb),
          onKeydown: (e) => { if (e.key === 'Enter') { S.sb = it.id; S.cl = null; S.tx = null; S.ov = null; S.li = -1; commit(); } } }, h('span', { class: 'sbn' }, it.name), h('div', { class: 'rz', 'aria-label': t('Cambiar duración', 'Change length') }));
        const rz = el2.querySelector('.rz');
        el2.addEventListener('pointerdown', (e) => {
          if (e.target === rz) return; el2.setPointerCapture(e.pointerId);
          const q = e.target.closest('.sbq'); S.sb = it.id; S.cl = null; S.tx = null; S.ov = null; S.li = -1; S.multi = []; if (q) S.swi = +q.dataset.w;
          const x0 = e.clientX, s0 = it.start, snap = []; Object.keys(it.words || {}).forEach((l2) => it.words[l2].forEach((w) => { if (w.s != null) snap.push([w, w.s]); })); let moved = false;
          const mv = (ev) => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved) return; const ns = Math.max(0, snapT(s0 + (ev.clientX - x0) / S.pps, null)), d = ns - s0; it.start = ns; snap.forEach((z) => { z[0].s = Math.max(0, Math.round((z[1] + d) * 1000) / 1000); }); layoutClips(); S.dirty = true; touch(); };
          const up = () => { el2.removeEventListener('pointermove', mv); el2.removeEventListener('pointerup', up); el2.removeEventListener('pointercancel', up); if (moved) commit(); else { const cue = q ? MC.subCues(it, p.lang, it.style).find((c) => c.words[0].i === +q.dataset.w) : null; setTime(cue ? cue.s + 0.01 : it.start + 0.01); S.selKind = 'subs'; renderInspector(); renderPanels(); renderTimeline(); } };
          el2.addEventListener('pointermove', mv); el2.addEventListener('pointerup', up); el2.addEventListener('pointercancel', up);
        });
        rz.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); rz.setPointerCapture(e.pointerId); const x0 = e.clientX, d0 = it.dur;
          const mv = (ev) => { it.dur = clamp(Math.round((d0 + (ev.clientX - x0) / S.pps) * 100) / 100, 0.5, 600); layoutClips(); S.dirty = true; touch(); };
          const up = () => { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', up); rz.removeEventListener('pointercancel', up); commit(); };
          rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', up); rz.addEventListener('pointercancel', up);
        });
        R.subs.append(el2);
      });
      /* efectos de todos los planos */
      p.shots.forEach((shx, si) => (shx.fx || []).forEach((f) => {
        const el2 = h('div', { class: 'clip ef' + (f.id === S.fxsel && si === S.si ? ' on' : ''), 'data-f': f.id, 'data-fs': si, role: 'button', tabindex: '0', title: MC.fxName(f.type) + ' · ' + shx.name, 'aria-label': MC.fxName(f.type) + ', ' + shx.name + ', ' + f.dur.toFixed(1) + ' s', 'aria-pressed': String(f.id === S.fxsel && si === S.si) },
          h('span', null, MC.fxName(f.type)), h('div', { class: 'rz', 'aria-label': t('Cambiar duración', 'Change length') }));
        const rz = el2.querySelector('.rz');
        el2.addEventListener('pointerdown', (e) => {
          if (e.target === rz) return; el2.setPointerCapture(e.pointerId);
          S.si = si; S.li = -1; S.cl = null; S.tx = null; S.ov = null; S.multi = []; S.fxsel = f.id;
          const x0 = e.clientX, s0 = f.start; let moved = false;
          const mv = (ev) => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved || f.panel != null) return; f.start = clamp(Math.round((s0 + (ev.clientX - x0) / S.pps) * 100) / 100, 0, Math.max(0, shx.duration - 0.1)); layoutClips(); S.dirty = true; touch(); };
          const up = () => { el2.removeEventListener('pointermove', mv); el2.removeEventListener('pointerup', up); el2.removeEventListener('pointercancel', up); if (moved) commit(); else { setTime(MC.shotStarts(p)[si] + clamp(MC.fxStart(shx, f), 0, Math.max(0, shx.duration - 0.001))); S.fxsel = f.id; S.selKind = 'fx'; renderLayers(); renderInspector(); renderTimeline(); } };
          el2.addEventListener('pointermove', mv); el2.addEventListener('pointerup', up); el2.addEventListener('pointercancel', up);
        });
        rz.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); rz.setPointerCapture(e.pointerId);
          const x0 = e.clientX, d0 = f.dur;
          const mv = (ev) => { f.dur = clamp(Math.round((d0 + (ev.clientX - x0) / S.pps) * 100) / 100, 0.1, 30); layoutClips(); S.dirty = true; touch(); };
          const up = () => { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', up); rz.removeEventListener('pointercancel', up); commit(); };
          rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', up); rz.addEventListener('pointercancel', up);
        });
        R.fxr.append(el2);
      }));
      /* superposiciones: clips con miniatura, arrastrables entre pistas */
      p.overlays.forEach((it) => {
        const a = MC.assets.get(it.assetId), vis = (ots[it.track] || {}).visible !== false && it.visible !== false;
        const el2 = h('div', { class: 'clip ov' + (it.kind === 'video' ? ' vid' : '') + (it.id === S.ov ? ' on' : '') + (vis ? '' : ' hid'), 'data-o': it.id, role: 'button', tabindex: '0', title: it.name, 'aria-label': it.name + ', ' + MC.fmtTime(it.start) + ', ' + it.dur.toFixed(1) + ' s', 'aria-pressed': String(it.id === S.ov),
          style: a && a.thumb ? { backgroundImage: 'url(' + a.thumb + ')' } : null,
          onKeydown: (e) => { if (e.key === 'Enter') { S.ov = it.id; S.cl = null; S.tx = null; S.li = -1; commit(); } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); it.start = Math.max(0, Math.round((it.start + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 0.1)) * 100) / 100); syncOvAudio(it); commit(); setTimeout(() => { const n = el.tlContent.querySelector('.clip[data-o="' + it.id + '"]'); if (n) n.focus(); }, 0); } } },
          h('span', null, it.name), h('div', { class: 'rz', 'aria-label': t('Cambiar duración', 'Change length') }));
        const rz = el2.querySelector('.rz');
        el2.addEventListener('pointerdown', (e) => {
          if (e.target === rz) return;
          el2.setPointerCapture(e.pointerId);
          el2.parentNode.parentNode.querySelectorAll('.clip.on').forEach((n) => n.classList.remove('on'));
          el2.classList.add('on'); S.ov = it.id; S.cl = null; S.tx = null; S.li = -1;
          const x0 = e.clientX, s0 = it.start, tr0 = it.track; let moved = false, over = null;
          const mv = (ev) => {
            if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved && Math.abs(ev.clientY - e.clientY) < 6) return; moved = true;
            it.start = snapT(s0 + (ev.clientX - x0) / S.pps, null); syncOvAudio(it);
            const row = ots.map((q, i) => R['o' + i]).find((r2) => { const b2 = r2.getBoundingClientRect(); return ev.clientY >= b2.top && ev.clientY < b2.bottom; });
            ots.forEach((q, i) => R['o' + i].classList.toggle('drop', R['o' + i] === row)); if (row) { over = +row.dataset.k.slice(1); it.track = over; }
            layoutClips(); touch();
          };
          const up = () => { el2.removeEventListener('pointermove', mv); el2.removeEventListener('pointerup', up); el2.removeEventListener('pointercancel', up); if (moved) commit(); else { if (S.time < it.start || S.time >= it.start + it.dur) setTime(it.start + Math.min(0.3, it.dur / 2)); renderInspector(); renderLayers(); S.dirty = true; } };
          el2.addEventListener('pointermove', mv); el2.addEventListener('pointerup', up); el2.addEventListener('pointercancel', up);
        });
        rz.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); rz.setPointerCapture(e.pointerId);
          const x0 = e.clientX, d0 = it.dur, maxd = it.kind === 'video' && !it.loop && a ? Math.max(0.2, (a.dur - (it.offset || 0)) / (it.speed || 1)) : 600;
          const mv = (ev) => { it.dur = clamp(Math.round((d0 + (ev.clientX - x0) / S.pps) * 100) / 100, 0.2, maxd); syncOvAudio(it); layoutClips(); touch(); };
          const up = () => { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', up); rz.removeEventListener('pointercancel', up); commit(); };
          rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', up); rz.addEventListener('pointercancel', up);
        });
        (R['o' + clamp(it.track, 0, ots.length - 1)] || R.o0).append(el2);
      });
      /* fotogramas clave del elemento seleccionado */
      if (kft && R.kf) (kft.it.kf || []).forEach((q) => {
        const d = h('button', { type: 'button', class: 'kfd' + (q.id === S.kfid ? ' on' : ''), 'data-kf': q.id, title: t('Fotograma clave · ', 'Keyframe · ') + q.t.toFixed(2) + ' s', 'aria-label': t('Fotograma clave en ', 'Keyframe at ') + q.t.toFixed(2) + ' s' });
        d.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); d.setPointerCapture(e.pointerId); S.kfid = q.id; R.kf.querySelectorAll('.kfd.on').forEach((n) => n.classList.remove('on')); d.classList.add('on');
          const x0 = e.clientX, t0 = q.t; let moved = false;
          const mv = (ev) => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved) return; q.t = clamp(Math.round((t0 + (ev.clientX - x0) / S.pps) * 100) / 100, 0, kft.dur); layoutClips(); S.dirty = true; touch(); };
          const up = () => { d.removeEventListener('pointermove', mv); d.removeEventListener('pointerup', up); d.removeEventListener('pointercancel', up); if (moved) commit(); else { setTime(kft.start + clamp(q.t, 0, Math.max(0, kft.dur - 0.001))); renderInspector(); renderTimeline(); } };
          d.addEventListener('pointermove', mv); d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
        });
        R.kf.append(d);
      });
      if (kft && R.kf) R.kf.addEventListener('dblclick', (e) => {
        if (e.target.closest('.kfd')) return; const local = clamp((e.clientX - el.tlContent.getBoundingClientRect().left) / S.pps - kft.start, 0, kft.dur);
        const v = MC.kfValues(kft.it.kf, local) || { x: 0, y: 0, sc: 1, rot: 0, op: 1 };
        const q = { id: MC.uid(), t: Math.round(local * 100) / 100, x: v.x, y: v.y, sc: v.sc, rot: v.rot, op: v.op, ease: 'smooth' }; kft.it.kf = (kft.it.kf || []).concat([q]); S.kfid = q.id; commit();
      });
      el.playhead = h('div', { class: 'playhead' }); el.tlContent.append(el.playhead);
      layoutClips();
      el.tlContent.querySelectorAll('.clip[data-c], .clip[data-x], .clip[data-o]').forEach((n) => { const it = itemOfKey(keyEl(n)); n.classList.toggle('grp', !!(it && it.group)); });
      markMulti(); stripPending();
    }
    /* arrastrar recursos (o archivos) a la línea de tiempo: en el hueco crea un plano; sobre un plano lo añade como capa; en una pista de superposición o de audio, lo coloca ahí */
    const kindOfFile = (f) => (MC.video.isFile(f) ? 'video' : /^audio\//.test(f.type) || /\.(wav|mp3|m4a|ogg)$/i.test(f.name) ? 'audio' : /^image\/(png|jpeg|webp|svg)/.test(f.type) || /\.(png|jpe?g|webp|svg)$/i.test(f.name) ? 'image' : 'other');
    async function storeFiles(files) {
      const out = [], rest = [];
      for (const f0 of await MC.expandInputs(files)) {
        const k = kindOfFile(f0);
        try {
          if (k === 'video') { const a = await MC.video.add(f0, f0.name); out.push({ id: a.id, kind: 'video' }); }
          else if (k === 'audio') { const a = await MC.audio.add(f0, f0.name); out.push({ id: a.id, kind: 'audio' }); }
          else if (k === 'image') { const f = /\.svg$/i.test(f0.name) || f0.type === 'image/svg+xml' ? await MC.rasterSvg(f0) : f0; const a = await MC.assets.add(f, f.name); out.push({ id: a.id, kind: 'image' }); }
          else rest.push(f0);
        } catch (e) { MC.toast(t('No se pudo leer ', 'Could not read ') + f0.name); }
      }
      return { items: out, rest };
    }
    async function newShotFromAsset(a, at) {
      const p = S.project, sh = MC.newShot(a.name.replace(/\.[a-z0-9]+$/i, '')); const L = MC.newLayer(a, { z: 0.1, role: 'fondo' }); if (a.video) { L.vloop = true; sh.duration = clamp(Math.round(a.dur * 10) / 10, 1, 30); }
      sh.layers.push(L); MC.applyPreset(sh.camera, a.video ? 'none' : 'zoomin', 0.8);
      if (S.ripple) rippleApply(rippleBegin(at < p.shots.length ? MC.shotStarts(p)[at] : MC.totalTime(p)), sh.duration);
      p.shots.splice(at, 0, sh); return sh;
    }
    function dropInfo(e) {
      const row = e.target.closest && e.target.closest('.tl-track'); if (!row) return null; const key = row.dataset.k, p = S.project, pps = S.pps;
      const time = Math.max(0, Math.round(((e.clientX - el.tlContent.getBoundingClientRect().left) / pps) * 100) / 100);
      const bar = e.target.closest('.lyrbar'), clip = e.target.closest('.clip[data-i]');
      return { row, key, time, bar, clip, si: bar ? +bar.dataset.si : clip ? +clip.dataset.i : null };
    }
    async function dropOnTimeline(e) {
      const info = dropInfo(e); if (!info) return; const dt = e.dataTransfer, p = S.project; let items = [], rest = [];
      if (dt.types.includes(MIME_ASSET)) { try { items = JSON.parse(dt.getData(MIME_ASSET)); } catch (x) { items = []; } }
      else if (dt.files && dt.files.length) { const fs = await MC.collectDropped(dt); MC.toast(t('Leyendo los archivos…', 'Reading the files…')); const r = await storeFiles(fs); items = r.items; rest = r.rest; }
      const imgs = items.filter((q) => q.kind !== 'audio'), auds = items.filter((q) => q.kind === 'audio'), key = info.key;
      if (auds.length && (key === 'voz' || key === 'sfx' || key === 'musica' || key === 'shots' || key === 'text')) {
        for (const q of auds) { const a = MC.audio.get(q.id) || (await MC.audio.load(q.id)); if (!a) continue; const c = MC.audio.newClip(AU.includes(key) ? key : a.dur >= 20 ? 'musica' : 'sfx', a, info.time); p.clips.push(c); S.cl = c.id; S.tx = null; S.ov = null; S.li = -1; }
        commit(); return;
      }
      if (/^o\d+$/.test(key) && imgs.length) { let at = info.time; for (const q of imgs) { const a = await MC.assets.load(q.id); if (!a) continue; const it = MC.newOverlay(a, { track: +key.slice(1), start: at, dur: 4 }); it.scale = 0.6; if (!a.video) it.dur = Math.max(1, Math.min(MC.totalTime(p) - at, 6)) || 4; p.overlays.push(it); S.ov = it.id; S.cl = null; S.tx = null; S.li = -1; at += it.dur; } commit(); return; }
      if (key === 'shots' && imgs.length) {
        if (info.si != null) { /* sobre un plano: capas */
          selectShot(info.si, false); let idx = null;
          if (info.bar) { const li = +info.bar.dataset.li, r = info.bar.getBoundingClientRect(); idx = e.clientY < r.top + r.height / 2 ? li + 1 : li; }
          await assetsToLayers(imgs.map((q) => q.id), idx); return;
        }
        const starts = MC.shotStarts(p); let at = p.shots.length; for (let i = 0; i < p.shots.length; i++) if (info.time < starts[i] + p.shots[i].duration / 2) { at = i; break; }
        let first = -1; for (const q of imgs) { const a = await MC.assets.load(q.id); if (!a) continue; await newShotFromAsset(a, at); if (first < 0) first = at; at++; }
        if (first >= 0) { commit(); selectShot(first, true); checkMemory(); MC.toast(imgs.length > 1 ? t(imgs.length + ' planos creados', imgs.length + ' shots created') : t('Plano creado', 'Shot created')); }
        return;
      }
      if (rest.length) { await importFiles(rest, 'shots'); return; }
      if (imgs.length || auds.length) MC.toast(t('Suéltalo en la pista de planos, de superposición o de audio.', 'Drop it on the shots, overlay or audio track.'));
    }
    function wireTimeline() {
      let down = false, marq = null;
      const okDrag = (e) => { const ty = e.dataTransfer.types; return ty.includes(MIME_ASSET) || ty.includes('Files'); };
      el.tlContent.addEventListener('dragover', (e) => { if (!okDrag(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; const info = dropInfo(e); el.tlContent.querySelectorAll('.dropt').forEach((n) => n.classList.remove('dropt')); if (info) { (info.bar || info.clip || info.row).classList.add('dropt'); } });
      el.tlContent.addEventListener('dragleave', (e) => { if (!el.tlContent.contains(e.relatedTarget)) el.tlContent.querySelectorAll('.dropt').forEach((n) => n.classList.remove('dropt')); });
      el.tlContent.addEventListener('drop', (e) => { if (!okDrag(e)) return; e.preventDefault(); el.tlContent.querySelectorAll('.dropt').forEach((n) => n.classList.remove('dropt')); dropOnTimeline(e); });
      const at = (e) => (e.clientX - el.tlContent.getBoundingClientRect().left) / S.pps;
      /* selección múltiple (Mayús o Ctrl + clic), mover varios a la vez y grupos: se atiende antes que los controladores de cada clip */
      el.tlContent.addEventListener('pointerdown', (e) => {
        const c = e.target.closest('.clip[data-c], .clip[data-x], .clip[data-o]');
        if (!c || e.target.classList.contains('rz')) { if (c) return; return; }
        const k = keyEl(c), it = itemOfKey(k); if (!it) return;
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          e.stopPropagation(); e.preventDefault();
          const cur = S.multi.length ? S.multi.slice() : (S.cl ? ['c:' + S.cl] : S.tx ? ['x:' + S.tx] : S.ov ? ['o:' + S.ov] : []);
          const grp = it.group ? allKeys().filter((q) => (itemOfKey(q) || {}).group === it.group) : [k];
          const has = cur.includes(k); setMulti(has ? cur.filter((q) => !grp.includes(q)) : cur.concat(grp.filter((q) => !cur.includes(q)))); return;
        }
        const grpKeys = it.group ? allKeys().filter((q) => (itemOfKey(q) || {}).group === it.group) : [];
        if (grpKeys.length > 1 && !S.multi.includes(k)) { S.multi = grpKeys; S.selKind = 'multi'; S.cl = null; S.tx = null; S.ov = null; S.li = -1; renderInspector(); markMulti(); }
        if (S.multi.length > 1 && S.multi.includes(k)) {
          e.stopPropagation(); c.setPointerCapture(e.pointerId);
          const items = multiItems().filter((q) => !(q.k[0] === 'x' && q.it.link)), x0 = e.clientX, starts0 = items.map((q) => q.it.start); let moved = false;
          const mv = (ev) => {
            if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved) return;
            const mn = Math.min(...starts0), d = Math.max(-mn, Math.round(((ev.clientX - x0) / S.pps) * 100) / 100);
            items.forEach((q, i) => { q.it.start = Math.round((starts0[i] + d) * 100) / 100; if (q.k[0] === 'o') syncOvAudio(q.it); });
            layoutClips(); touch();
          };
          const up = () => { c.removeEventListener('pointermove', mv); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); if (moved) commit(); };
          c.addEventListener('pointermove', mv); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up); return;
        }
        if (S.multi.length) { S.multi = []; markMulti(); }
      }, true);
      el.tlContent.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.clip') || e.target.closest('.mkn')) return;
        if (e.shiftKey) { /* recuadro de selección */
          const box = el.tlContent.getBoundingClientRect(); el.tlContent.setPointerCapture(e.pointerId);
          marq = { x0: e.clientX, y0: e.clientY, n: h('div', { class: 'marq' }) }; el.tlContent.append(marq.n); return;
        }
        down = true; el.tlContent.setPointerCapture(e.pointerId); togglePlay(false); setTime(at(e));
      });
      el.tlContent.addEventListener('pointermove', (e) => {
        if (marq) {
          const box = el.tlContent.getBoundingClientRect(), x = Math.min(e.clientX, marq.x0) - box.left, y = Math.min(e.clientY, marq.y0) - box.top, w = Math.abs(e.clientX - marq.x0), hh = Math.abs(e.clientY - marq.y0);
          Object.assign(marq.n.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' }); return;
        }
        if (down) setTime(at(e));
      });
      const end = (e) => {
        down = false;
        if (marq) {
          const r = marq.n.getBoundingClientRect(); marq.n.remove(); marq = null;
          const hit = [...el.tlContent.querySelectorAll('.clip[data-c], .clip[data-x], .clip[data-o]')].filter((n) => { const q = n.getBoundingClientRect(); return !(q.right < r.left || q.left > r.right || q.bottom < r.top || q.top > r.bottom); }).map(keyEl).filter((k) => { const it = itemOfKey(k); return it && !(k[0] === 'x' && it.link); });
          setMulti(hit);
        }
      };
      el.tlContent.addEventListener('pointerup', end); el.tlContent.addEventListener('pointercancel', end);
    }

    /* ---------- montaje de la interfaz ---------- */
    const fileOver = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', multiple: true, hidden: true, id: 'f-over', onChange: async (e) => {
      const list = [...e.target.files]; e.target.value = ''; if (!list.length) return;
      const sh = shot();
      try {
        for (const f of list) { const a = await MC.assets.add(f, f.name); const L = MC.newLayer(a, { z: 0.95, role: '' }); L.over = true; sh.layers.push(L); }
        S.li = sh.layers.length - 1; commit(); checkMemory(); MC.toast(t('Ilustración añadida por encima de la viñeta', 'Artwork added above the panel'));
      } catch (err) { MC.toast(t('No se pudo leer esa imagen.', 'Could not read that image.')); }
    } });
    const fileOv = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,video/*,.mp4,.m4v,.mov,.webm', multiple: true, hidden: true, id: 'f-ov', onChange: (e) => { addOverlays([...e.target.files], +fileOv.dataset.track || 0); e.target.value = ''; } });
    const fileLayers = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml,.svg,.zip,video/*,.mp4,.m4v,.mov,.webm,.psd,.pdf,audio/*', multiple: true, hidden: true, id: 'f-layers', onChange: (e) => { importFiles(e.target.files, 'layers'); e.target.value = ''; } });
    const fileShots = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml,.svg,.zip,video/*,.mp4,.m4v,.mov,.webm,.psd,.pdf', multiple: true, hidden: true, id: 'f-shots', onChange: (e) => { importFiles(e.target.files, 'shots'); e.target.value = ''; } });
    const fileAudio = h('input', { type: 'file', accept: 'audio/*,.wav,.mp3,.m4a,.ogg', multiple: true, hidden: true, id: 'f-audio', onChange: (e) => { importAudio([...e.target.files], fileAudio.dataset.track || 'auto'); e.target.value = ''; } });
    el.top = h('div', { class: 's-top' });
    el.layersBody = h('div', { class: 'pbody' });
    el.inspBody = h('div', { class: 'pbody insp' });
    el.vbar = h('div', { class: 'vbar', role: 'toolbar', 'aria-label': t('Herramientas del visor', 'Viewer tools') });
    el.canvas = h('canvas', { 'aria-label': t('Visor del plano', 'Shot viewer') });
    el.empty = h('div', { class: 'drop' }, h('div', { class: 'in' }, MC.icon('image', 28),
      h('div', null, S.project.mode === 'page' ? t('Arrastra aquí tus páginas (PNG, JPEG, WebP, PSD o PDF). Se detectan las viñetas.', 'Drag your pages here (PNG, JPEG, WebP, PSD or PDF). Panels are detected.') : S.project.mode === 'webtoon' ? t('Arrastra aquí tu tira vertical, o varias imágenes para apilarlas.', 'Drag your vertical strip here, or several images to stack them.') : t('Arrastra aquí tus ilustraciones. Cada archivo será una capa.', 'Drag your artwork here. Each file becomes a layer.')),
      h('button', { class: 'btn btn-p', type: 'button', onClick: () => fileLayers.click() }, MC.icon('upload', 15), t('Importar', 'Import'))));
    el.sim = h('div', { class: 'sim', hidden: true, 'aria-hidden': 'true' });
    el.stage = h('div', { class: 'stage' }, el.canvas, el.empty, el.sim);
    el.play = h('button', { class: 'play', type: 'button', onClick: () => togglePlay() });
    el.loop = h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Repetir', 'Loop'), 'aria-label': t('Repetir', 'Loop'), onClick: () => { S.loop = !S.loop; updateTransport(); } }, MC.icon('loop'));
    el.time = h('div', { class: 'num' });
    el.tlTime = h('span', { class: 'num' });
    el.tlLabels = h('div', { class: 'tl-labels' });
    el.tlContent = h('div', { class: 'tl-content' });

    el.rail = h('div', { class: 'rail', role: 'tablist', 'aria-label': t('Paneles', 'Panels'), 'aria-orientation': 'vertical' });
    el.leftTitle = h('h3', null, '');
    el.leftBody = h('div', { class: 'pbody' });
    el.leftEl = h('div', { class: 'panel-col leftpanel' }, h('div', { class: 'ph' }, el.leftTitle), el.leftBody, handle('left', 'r', t('Ancho del panel izquierdo', 'Left panel width')));
    el.propsTitle = h('h3', null, '');
    el.exportHost = h('div', { class: 'exp-panel' });
    const layersPanel = h('div', { class: 'panel-col p-layers' },
      h('div', { class: 'ph' }, h('h3', null, t('Capas', 'Layers')), h('span', { class: 'vwrap' }, el.impBtn = h('button', { class: 'btn btn-s btn-sm', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onClick: () => { S.impOpen = !S.impOpen; el.impBtn.setAttribute('aria-expanded', String(S.impOpen)); renderImpMenu(); } }, MC.icon('plus', 14), t('Importar', 'Import'), MC.icon('down', 12)))),
      h('div', { style: { display: 'contents' }, onClick: (e) => { if (e.target === e.currentTarget || e.target === el.layersBody) { S.selKind = 'shot'; S.li = -1; renderLayers(); renderPanels(); S.dirty = true; } } }, el.layersBody));
    const propsPanel = h('div', { class: 'panel-col p-props' }, h('div', { class: 'ph' }, el.propsTitle), el.inspBody);
    el.rightEl = h('div', { class: 'rightcol' }, layersPanel, propsPanel, handle('right', 'l', t('Ancho de la columna derecha', 'Right column width')));
    const exportPanel = h('div', { class: 'panel-col p-export' }, h('div', { class: 'ph' }, h('h3', null, t('Exportar', 'Export'))), el.exportHost);
    const viewer = el.viewerEl = h('div', { class: 'viewer' }, el.vbar, el.stage,
      h('div', { class: 'tbar' },
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Ir al inicio (Inicio)', 'Go to start (Home)'), 'aria-label': t('Ir al inicio', 'Go to start'), onClick: () => setTime(0) }, MC.icon('first')),
        el.play, el.loop, el.time,
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Pantalla completa (F)', 'Full screen (F)'), 'aria-label': t('Pantalla completa', 'Full screen'), onClick: () => ACT.fullscreen() }, MC.icon('frame'))));
    const timeline = h('div', { class: 'p-timeline' }, handle('tl', 't', t('Alto de la línea de tiempo', 'Timeline height')),
      h('div', { class: 'tl-head' }, h('span', { class: 'eyebrow' }, t('Línea de tiempo', 'Timeline')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => fileShots.click() }, MC.icon('plus', 14), t('Planos desde imágenes', 'Shots from images')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', title: t('Añadir una imagen o un vídeo encima de la ilustración, en su propia pista', 'Add an image or video above the artwork, on its own track'), onClick: () => { fileOv.dataset.track = 0; fileOv.click(); } }, MC.icon('layersx', 14), t('Superposición', 'Overlay')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', title: t('Añadir otra pista de superposición (hasta 6)', 'Add another overlay track (up to 6)'), onClick: () => { const o2 = S.project.otracks; if (o2.length >= 6) { MC.toast(t('Máximo 6 pistas de superposición.', 'At most 6 overlay tracks.')); return; } o2.push(MC.newOtrack(o2.length + 1)); commit(); } }, MC.icon('plus', 14), t('Pista', 'Track')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', 'aria-pressed': String(!!S.ripple), title: t('Ripple: al cambiar la duración de un plano, todo lo que va detrás se mueve con él', 'Ripple: when a shot’s length changes, everything after it moves along'), onClick: (e) => { S.ripple = !S.ripple; MC.store.set('ripple', S.ripple ? '1' : '0'); e.currentTarget.setAttribute('aria-pressed', String(S.ripple)); MC.toast(S.ripple ? t('Ripple activado: lo de detrás sigue al plano', 'Ripple on: later items follow the shot') : t('Ripple desactivado', 'Ripple off')); } }, t('Ripple', 'Ripple')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', title: t('Marcador con nota en el cabezal (M)', 'Marker with a note at the playhead (M)'), onClick: () => addMarker('note') }, MC.icon('bookmark', 14), t('Marcador', 'Marker')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', title: t('Duplicar lo seleccionado (Ctrl+D)', 'Duplicate selection (Ctrl+D)'), onClick: () => { if (!dupSelection()) MC.toast(t('Selecciona un clip, un texto o una superposición.', 'Select a clip, text or overlay.')); } }, MC.icon('copy', 14), t('Duplicar', 'Duplicate')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: splitClip, title: t('Dividir el clip de audio seleccionado en el cabezal (S)', 'Split the selected audio clip at the playhead (S)') }, MC.icon('cut', 14), t('Dividir', 'Split')),
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Alejar', 'Zoom out'), 'aria-label': t('Alejar', 'Zoom out'), onClick: () => { S.pps = clamp(S.pps / 1.3, 12, 240); renderTimeline(); } }, MC.icon('minus')),
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Acercar', 'Zoom in'), 'aria-label': t('Acercar', 'Zoom in'), onClick: () => { S.pps = clamp(S.pps * 1.3, 12, 240); renderTimeline(); } }, MC.icon('plus')), el.tlTime),
      h('div', { class: 'tl-body' }, el.tlLabels, h('div', { class: 'tl-scroll' }, el.tlContent)));
    const mtabs = h('div', { class: 'mtabs' }, [['panel', t('Panel', 'Panel')], ['props', t('Capas y propiedades', 'Layers and properties')], ['timeline', t('Línea', 'Timeline')]].map((x) =>
      h('button', { type: 'button', 'aria-pressed': String(S.mtab === x[0]), onClick: (e) => { S.mtab = x[0]; studio.dataset.mtab = x[0]; e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); } }, x[1])));
    const studio = h('div', { class: 'studio enter', 'data-ws': S.ws, 'data-tl': WS[S.ws].tl, 'data-mtab': S.mtab }, el.top, h('div', { class: 's-main' }, el.rail, el.leftEl, viewer, el.rightEl, exportPanel), mtabs, timeline, fileLayers, fileOver, fileOv, fileShots, fileAudio);
    setTimeout(() => studio.classList.remove('enter'), 1400);

    function renderAll() { renderTop(); renderRail(); renderLayers(); renderPanels(); renderVbar(); renderTimeline(); updateTransport(); updateTime(); }
    MC.put(MC.clear(root), studio);
    renderAll(); wire(el.canvas); wireTimeline(); applyLayout();
    const onWinResize = () => applyLayout(); window.addEventListener('resize', onWinResize);
    const verTimer = setInterval(() => { if (S.alive && S.dirtySinceVer) { S.dirtySinceVer = false; MC.versions.save(S.project, '', true).catch(() => {}); } }, 300000);
    const onDocDown = (e) => { if (S.impOpen && el.impMenu && !el.impMenu.contains(e.target) && !(el.impBtn && el.impBtn.contains(e.target))) { S.impOpen = false; renderImpMenu(); if (el.impBtn) el.impBtn.setAttribute('aria-expanded', 'false'); }
      if (S.fileOpen && el.fileMenu && !el.fileMenu.contains(e.target) && !(el.fileBtn && el.fileBtn.contains(e.target))) { S.fileOpen = false; renderFileMenu(); if (el.fileBtn) el.fileBtn.setAttribute('aria-expanded', 'false'); }
      if (S.viewOpen && el.viewMenu && !el.viewMenu.contains(e.target) && !(el.viewBtn && el.viewBtn.contains(e.target))) { S.viewOpen = false; renderViewMenu(); if (el.viewBtn) el.viewBtn.setAttribute('aria-expanded', 'false'); } };
    document.addEventListener('pointerdown', onDocDown);
    MC.ensureFonts().then(() => { S.dirty = true; });
    MC.fonts.loadFor(S.project).then((miss) => { if (miss.length) MC.toast(t('Falta la tipografía: ', 'Missing font: ') + miss.join(', ') + t('. Se usa otra de reserva.', '. A fallback is used.')); S.dirty = true; });

    el.stage.addEventListener('dragover', (e) => { e.preventDefault(); el.stage.classList.add('over'); });
    el.stage.addEventListener('dragleave', () => el.stage.classList.remove('over'));
    el.stage.addEventListener('drop', async (e) => { e.preventDefault(); el.stage.classList.remove('over'); const fs = await MC.collectDropped(e.dataTransfer); if (fs.length) importFiles(fs, 'layers'); });

    const ro = new ResizeObserver(() => fit());
    ro.observe(el.stage);
    requestAnimationFrame(fit);

    /* bucle de reproducción */
    let last = performance.now(), raf = 0;
    function loop(now) {
      if (!S.alive) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (S.playing) {
        const total = MC.totalTime(S.project);
        let tm = S.time + dt, wrapped = false;
        if (tm >= total) { if (S.loop) { tm = 0; wrapped = true; } else { tm = Math.max(0, total - 0.001); S.playing = false; MC.audio.stop(); updateTransport(); } }
        setTime(tm);
        if (wrapped) MC.audio.play(S.project, 0);
      }
      if (S.playing && (now - (loop.mt || 0)) > 50) {
        loop.mt = now; const mt = el.rightEl && el.rightEl.querySelectorAll('.meter, .meter'), lv = MC.audio.levels();
        document.querySelectorAll('.studio .meter').forEach((m) => { const v = lv[m.dataset.m] || 0; m.firstChild.style.width = Math.round(v * 100) + '%'; m.setAttribute('aria-valuenow', Math.round(v * 100)); m.classList.toggle('hot', v > 0.92); });
      } else if (!S.playing && loop.mt) { loop.mt = 0; document.querySelectorAll('.studio .meter i').forEach((i) => { i.style.width = '0'; }); }
      if (S.dirty) {
        S.dirty = false; const t0 = performance.now();
        try { draw(); } catch (e) { console.error(e); }
        S.ema = S.ema * 0.9 + (performance.now() - t0) * 0.1;
        if (S.playing && S.quality === 'full' && S.ema > 42) { if (++S.slow > 90) { S.quality = 'media'; MC.store.set('pq', 'media'); S.slow = 0; fit(); MC.toast(t('Se bajó la calidad de la previsualización para que vaya fluida. Puedes subirla en el visor.', 'Preview quality was lowered to keep playback smooth. You can raise it in the viewer.')); } } else S.slow = 0;
      }
    }
    raf = requestAnimationFrame(loop);

    /* atajos de teclado */
    const total = () => MC.totalTime(S.project);
    const ACT = {
      play: () => togglePlay(), pause: () => togglePlay(false), forward: () => togglePlay(true),
      back1: () => setTime(S.time - 1), stepBack: () => setTime(S.time - 1 / 30), stepFwd: () => setTime(S.time + 1 / 30), secBack: () => setTime(S.time - 1), secFwd: () => setTime(S.time + 1),
      start: () => setTime(0), end: () => setTime(total() - 0.001),
      prevShot: () => selectShot(S.si - 1, true), nextShot: () => selectShot(S.si + 1, true),
      split: () => { if (S.cl) splitClip(); else return false; },
      duplicate: () => { if (S.selKind === 'layer' && layer()) { dupLayer(); return; } return dupSelection(); }, marker: () => { addMarker('note'); }, tapBeat: () => { addMarker('beat'); },
      selectAll: () => { setMulti(allKeys()); },
      undo: () => { undo(); MC.announce(t('Deshacer', 'Undo')); }, redo: () => { redo(); MC.announce(t('Rehacer', 'Redo')); },
      addBubble: () => addText('bubble'), save: () => { save().then(() => MC.toast(t('Guardado en este equipo', 'Saved on this device'))); },
      fullscreen: () => { const v = el.viewerEl; if (!v) return; if (document.fullscreenElement) document.exitFullscreen(); else if (v.requestFullscreen) v.requestFullscreen().catch(() => MC.toast(t('Tu navegador no permite la pantalla completa aquí.', 'Your browser does not allow full screen here.'))); else MC.toast(t('Tu navegador no permite la pantalla completa aquí.', 'Your browser does not allow full screen here.')); },
      viewSwitch: () => { const sh = shot(), next = sh.page ? 'page' : sh.webtoon ? 'strip' : 'cam'; S.view = S.view === 'out' ? next : 'out'; togglePlay(false); renderVbar(); buildSim(); fit(); MC.announce(S.view === 'out' ? t('Vista de salida', 'Output view') : t('Vista de edición', 'Editing view')); },
      zoomIn: () => { S.pps = clamp(S.pps * 1.3, 12, 240); renderTimeline(); }, zoomOut: () => { S.pps = clamp(S.pps / 1.3, 12, 240); renderTimeline(); },
      export: () => openExport(), help: () => MC.openHelp(), keys: () => MC.openHelp('keys'),
      delete: () => {
        if (S.view === 'page' && S.pn && shot().page) { const pg = shot().page; pg.panels = pg.panels.filter((q) => q.id !== S.pn); S.pn = null; pg.manual = true; commit(); }
        else if (S.view === 'strip' && S.sp && shot().webtoon) { const wt = shot().webtoon; wt.stops = wt.stops.filter((q) => q.id !== S.sp); S.sp = null; commit(); }
        else if (S.selKind === 'subs' && S.sb && subById(S.sb)) { S.project.subs = S.project.subs.filter((q) => q.id !== S.sb); S.sb = null; S.selKind = 'shot'; commit(); MC.announce(t('Subtítulo eliminado', 'Subtitle deleted')); }
        else if (S.multi.length > 1) { multiItems().forEach((q) => { if (q.k[0] === 'c') S.project.clips = S.project.clips.filter((c) => c.id !== q.it.id); else if (q.k[0] === 'x') S.project.texts = S.project.texts.filter((x) => x.id !== q.it.id); else removeOverlay(q.it); }); S.multi = []; S.selKind = 'shot'; commit(); }
        else if (S.selKind === 'marker' && S.mk && mkById(S.mk)) { S.project.notes = S.project.notes.filter((n) => n.id !== S.mk); S.mk = null; S.selKind = 'shot'; commit(); }
        else if (S.kfid && kfTarget() && (kfTarget().it.kf || []).some((q) => q.id === S.kfid)) { const kt = kfTarget(); kt.it.kf = kt.it.kf.filter((q) => q.id !== S.kfid); S.kfid = null; commit(); MC.announce(t('Fotograma clave eliminado', 'Keyframe deleted')); }
        else if (S.ov && ovById(S.ov) && !layer() && S.selKind === 'overlay') { removeOverlay(ovById(S.ov)); commit(); MC.announce(t('Superposición eliminada', 'Overlay deleted')); }
        else if (S.tx) { S.project.texts = S.project.texts.filter((x) => x.id !== S.tx); S.tx = null; commit(); MC.announce(t('Texto eliminado', 'Text deleted')); }
        else if (S.cl && !layer()) { S.project.clips = S.project.clips.filter((c) => c.id !== S.cl); S.cl = null; commit(); MC.announce(t('Clip eliminado', 'Clip deleted')); }
        else if (layer() && layer().locked) { MC.toast(t('La capa está bloqueada. Desbloquéala para borrarla.', 'The layer is locked. Unlock it to delete it.')); }
        else if (layer()) { delLayer(S.li); MC.announce(t('Capa eliminada', 'Layer deleted')); }
        else return false;
      },
    };
    function onKey(e) {
      if (!S.alive || document.querySelector('.scrim, .tour') || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === 'Enter' && S.poly) { closePoly(); return; }
      if (e.key === 'Escape') { if (S.poly) { S.poly = null; S.polyCur = null; S.dirty = true; } else if (S.fmtOpen || S.ovMenu) { S.fmtOpen = false; S.ovMenu = false; renderFmtPop(); renderVbar(); } else clearSel(); return; }
      if (S.ws === 'creativo' && curTab() === 'subtitulos' && subById(S.sb) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'Enter') { e.preventDefault(); markWord(); return; }
        if (e.key === '.') { e.preventDefault(); silenceHere(); return; }
        if (e.key === 'Backspace') { e.preventDefault(); unmarkWord(); return; }
      }
      const id = MC.keys.match(e), c = MC.keys.combo(e);
      if (!id || !ACT[id]) return;
      if (/^(BUTTON|A)$/.test(e.target.tagName) && (c === 'Space' || c === 'Enter')) return; // el control enfocado lo usa
      if (ACT[id](e) !== false) e.preventDefault();
    }
    const onFs = () => setTimeout(fit, 120);
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('keydown', onKey);
    const onHide = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    function cleanup() { clearInterval(verTimer); offJobChip(); MC.audio.stop(); cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', save); window.removeEventListener('resize', onWinResize); document.removeEventListener('pointerdown', onDocDown); }
    MC.studioCleanup = () => { S.alive = false; MC.studioApi = null; cleanup(); };
    MC.studioApi = {
      seek: (tm) => { togglePlay(false); setTime(tm); },
      selectLayer: () => { const sh = shot(); if (sh && sh.layers.length && S.li < 0) { S.li = sh.layers.length - 1; S.tx = null; renderLayers(); renderInspector(); } },
      openMix: () => { setWs('creativo'); S.tab.creativo = 'mezclador'; renderRail(); renderPanels(); },
      openWs: (v, tab) => { setWs(v); if (tab) { S.tab[v] = tab; renderRail(); renderPanels(); } },
      proyectoTab: () => { setWs('montaje'); S.tab.montaje = 'proyecto'; renderRail(); renderPanels(); },
      openExportWs: () => { setWs('exportar'); },
      refit: () => { fit(); }, redraw: () => { S.dirty = true; renderPanels(); },
      applyQuality: () => { const pq = MC.store.get('pq', 'auto'); S.quality = pq === 'media' || pq === 'full' ? pq : (innerWidth < 900 || (navigator.deviceMemory && navigator.deviceMemory <= 2)) ? 'media' : 'full'; renderVbar(); fit(); },
    };
    if (MC.pendingTour) { const id = MC.pendingTour; MC.pendingTour = null; setTimeout(() => MC.startTour(id), 500); }
  };
})();
