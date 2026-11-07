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
    /* el aviso solo sale si la carga tarda; así no queda un texto suelto entre las dos animaciones */
    const openingT = setTimeout(() => MC.put(MC.clear(root), h('div', { class: 'empty', style: { marginTop: '30vh' } }, t('Abriendo el proyecto…', 'Opening the project…'))), 900);
    /* versión IA pendiente de revisar: el proyecto guardado sigue siendo el tuyo, se abre la copia de la IA */
    let aiInit = null;
    try { const r = await MC.db.get('versions', 'ia-' + project.id); if (r && r.kind === 'ia') { aiInit = { base: r.base, t: r.t, log: r.log || [] }; const w = JSON.parse(r.json); w.id = project.id; project = w; } } catch (e) { /* sin versión IA */ }
    MC.normalizeProject(project);
    await MC.loadProjectAssets(project);

    const SEL_KEYS = { li: 'layer', tx: 'text', cl: 'clip', fxsel: 'fx', pn: 'panel', sp: 'stop', ov: 'overlay', sb: 'subs', xs: 'shot' };
    const S = new Proxy({ project, selKind: 'project', tab: {}, si: 0, xs: null, li: -1, cl: null, tx: null, ov: null, sb: null, swi: 0, kfid: null, vz: { z: 1, x: 0, y: 0 }, rulers: false, multi: [], hits: [], guides: false, ema: 0, slow: 0, quality: ((pq) => (pq === 'media' || pq === 'full' ? pq : null))(MC.store.get('pq', 'auto')) || ((innerWidth < 900 || (navigator.deviceMemory && navigator.deviceMemory <= 2) || (matchMedia('(pointer: coarse)').matches && (navigator.hardwareConcurrency || 4) <= 4)) ? 'media' : 'full'), pn: null, pageMap: null, sim: null, sp: null, wp: 0, fxsel: null, ptool: 'rect', poly: null, polyCur: null, pv: null, time: 0, playing: false, loop: true, view: 'out', kf: 'to', adv: true,
      ws: 'montaje', mtab: '', thumbV: 0, holes: false, safe: false, pps: 70, open: { capa_3d: false, overlay_3d: false, capa_rig: true, capa_look: false, capa_pivot: true, capa_kf: true, overlay_look: false, overlay_kf: true, vinetas: true, plano: true, camara: true, capa: true, proyecto: false, audio: true, mezcla: false, texto: true, idiomas: false, pagina: true, estilo: false, tira: true, tray: true, efectos: true, rack: false, aspecto: false },
      hist: [], hpos: -1, dirty: true, alive: true, dpr: 1, savedAt: project.updated, dragging: false },
      { set(o, k, v) { o[k] = v; if (SEL_KEYS[k] && v != null && v !== -1 && v !== false) o.selKind = SEL_KEYS[k]; return true; } });
    const el = {};
    const shot = () => (S.xs && xById(S.xs)) || S.project.shots[S.si];
    const xById = (id) => (S.project.xshots || []).find((x) => x.id === id);
    const curStart = () => { const x = S.xs && xById(S.xs); return x ? x.start : MC.shotStarts(S.project)[S.si]; };
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
      if (S.ai && S.aiView === 'base') return;
      p.updated = Date.now(); p.thumb = MC.makeThumb(p);
      if (S.ai) { try { await MC.db.put('versions', { id: 'ia-' + p.id, projectId: p.id, kind: 'ia', t: S.ai.t, json: JSON.stringify(p), base: S.ai.base, log: S.ai.log, size: 0 }); S.savedAt = p.updated; } catch (e) { MC.toast(t('No se pudo guardar la versión IA.', 'Could not save the AI version.')); } setStatus(true); return; }
      try { await MC.db.put('projects', p); S.savedAt = p.updated; } catch (e) { MC.toast(t('No se pudo guardar. Exporta una copia por si acaso.', 'Could not save. Export a backup just in case.')); }
      setStatus(true);
    }
    function setStatus(saved) {
      if (!el.status) return;
      MC.put(MC.clear(el.status), h('i'), !MC.db.persistent ? t('Sin guardado local', 'Not saved locally') : saved ? t('Guardado en este equipo · ', 'Saved on this device · ') + MC.fmtClock(S.savedAt) : t('Guardando…', 'Saving…'));
    }
    /* línea de tiempo libre: pista V elegida (donde se añade lo nuevo); por defecto la más alta */
    const curVt = () => { const n = S.project.otracks.length; return S.vt == null ? n - 1 : Math.max(0, Math.min(n - 1, S.vt)); };
    function touch() { S.dirty = true; S.dirtySinceVer = true; scheduleSave(); }
    function commit() {
      S.project.shots.concat(S.project.xshots || []).forEach((sh) => { const pa = sh.camera.path; if (pa && pa.custom) sh.duration = Math.max(0.5, Math.round(MC.pathDuration(pa) * 10) / 10); });
      if (S.project.tl === 'free') MC.syncFree(S.project);
      MC.finalizePages(S.project); pushHist(); touch(); renderLayers(); renderInspector(); renderTimeline(); updateHistBtns(); }
    function updateHistBtns() { if (el.undo) { el.undo.disabled = S.hpos <= 0; el.redo.disabled = S.hpos >= S.hist.length - 1; } if (typeof refreshTlBar === 'function' && el.tlBar) refreshTlBar(); }
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
    function selectXs(id, seek) {
      const x = xById(id); if (!x) return; S.xs = id; S.li = -1; S.cl = null; S.tx = null; S.ov = null; S.sb = null; S.multi = []; S.fxsel = null; S.selKind = 'shot';
      if (seek) S.time = clamp(x.start + 0.01, 0, Math.max(0, MC.totalTime(S.project) - 0.001));
      S.dirty = true; renderLayers(); renderInspector(); renderTimeline(); updateTime();
    }
    function selectShot(i, seek) {
      S.xs = null; S.si = clamp(i, 0, S.project.shots.length - 1); S.li = -1; S.cl = null; S.tx = null; S.pn = null; S.fxsel = null;
      if (S.ws === 'montaje' && curTab() === 'camara') S.view = editView(); else if (['cam', 'page', 'strip', 'depth'].includes(S.view)) S.view = 'out';
      S.selKind = 'shot';
      if (seek) S.time = curStart();
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
      if (S.project.tl === 'free' && !S.xs) { const all = vids.concat(list.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))); if (all.length) await addOverlays(all, curVt()); return; }
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
          if (a.audioId) { const ab = MC.audio.get(a.audioId), c = MC.audio.newClip('sfx', ab, curStart()); c.dur = Math.min(ab.dur, sh.duration); c.name = a.name.replace(/\.[a-z0-9]+$/i, '') + ' · audio'; S.project.clips.push(c); }
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
          if (!isV) { it.dur = p.tl === 'free' ? 4 : (Math.max(1, Math.min(MC.totalTime(p) - at, 6)) || 4); }
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
        const startAt = (!sh.layers.length ? curStart() : curStart() + sh.duration);
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
    /* ---------- fotogramas clave avanzados (una fila por propiedad, como en After Effects) ---------- */
    S.kfAdv = MC.store.get('kfadv', '') === '1';
    const KFADV_CORE = ['x', 'y', 'sc', 'rot', 'op'];
    const KFROW = 22;
    /* filas visibles: las cinco principales siempre (para poder crear fotogramas en ellas) y las demás solo si ya se animan */
    const kfAdvProps = (it) => MC.KF_PROPS.filter((pr) => KFADV_CORE.includes(pr) || (it.kf || []).some((q) => q[pr] != null));
    const kfPropName = (pr) => { const d = KFP.find((q) => q[0] === pr); return d ? t(d[1], d[2]) : pr; };
    /* mueve solo UNA propiedad de un fotograma a otro instante: si había más propiedades en él, se separa en un fotograma nuevo; si ya hay uno en ese instante, se une */
    function kfMoveProp(it, q, pr, newT) {
      newT = round2(newT); if (Math.abs(newT - q.t) < 0.0001) return q;
      const others = Object.keys(q).some((k) => MC.KF_PROPS.includes(k) && k !== pr && q[k] != null);
      const dest = (it.kf || []).find((z) => z !== q && Math.abs(z.t - newT) < 0.015);
      if (!others && !dest) { q.t = newT; return q; }
      const val = q[pr]; delete q[pr];
      if (!others) it.kf = it.kf.filter((z) => z !== q);
      if (dest) { dest[pr] = val; return dest; }
      const nq = { id: MC.uid(), t: newT, ease: q.ease || 'smooth' }; nq[pr] = val; it.kf.push(nq); return nq;
    }
    function kfDelProp(it, q, pr) { delete q[pr]; if (!Object.keys(q).some((k) => MC.KF_PROPS.includes(k) && q[k] != null)) it.kf = it.kf.filter((z) => z !== q); }
    function kfAdvToggle() { S.kfAdv = !S.kfAdv; MC.store.set('kfadv', S.kfAdv ? '1' : ''); renderTimeline(); }
    const kfTarget = () => {
      const sel = S.selKind;
      if (sel === 'overlay' && S.ov && ovById(S.ov)) { const it = ovById(S.ov); return { it, start: it.start, dur: it.dur, kind: 'overlay' }; }
      if (sel === 'layer' && layer()) { const sh = shot(), l = layer(), ts = l.ts || 0; return { it: l, start: curStart() + ts, dur: (l.te == null ? sh.duration : l.te) - ts, kind: 'layer' }; }
      if (sel === 'text' && S.tx && txById(S.tx) && !txById(S.tx).link) { const it = txById(S.tx), sp = MC.textSpan(it, S.project); return { it, start: sp.start, dur: sp.dur, kind: 'text' }; }
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
      if (p.tl === 'free' && it.kind !== 'sub') it.track = curVt();
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
      montaje: { icon: 'film', es: 'Montaje', en: 'Edit', tl: 'big', tabs: ['planos', 'vinetas', 'camara', 'curvas', 'rack', 'recursos', 'biblioteca', 'proyecto', 'aspecto', 'estilo', 'favs'] },
      creativo: { icon: 'sparkle', es: 'Efectos y audio', en: 'Effects and audio', tl: 'big', tabs: ['texto', 'subtitulos', 'efectos', 'transiciones', 'sfx', 'musica', 'mezclador', 'idiomas', 'favs'] },
      exportar: { icon: 'export', es: 'Exportar', en: 'Export', tl: 'none', tabs: [] },
    };
    const TABS = { planos: ['film'], subtitulos: ['mic', 'Subtítulos', 'Subtitles'], biblioteca: ['bookmark', 'Biblioteca', 'Library'], vinetas: ['page', 'Viñetas', 'Panels'], transiciones: ['cut', 'Transiciones', 'Transitions'], recursos: ['folder', 'Recursos', 'Assets'], proyecto: ['clipboard', 'Proyecto', 'Project'], aspecto: ['sun', 'Aspecto', 'Look'], estilo: ['star', 'Estilo', 'Style'], camara: ['camera', 'Cámara', 'Camera'], rack: ['frame', 'Rack focus', 'Rack focus'],
      texto: ['text', 'Texto', 'Text'], efectos: ['sparkle', 'Efectos', 'Effects'], sfx: ['speaker', 'Efectos de sonido', 'Sound effects'], musica: ['note', 'Música', 'Music'], favs: ['star', 'Favoritos', 'Favourites'], curvas: ['curve', 'Curvas', 'Curves'], mezclador: ['mixer', 'Mezclador', 'Mixer'], idiomas: ['globe', 'Idiomas', 'Languages'] };
    const tabLabel = (id) => (id === 'planos' ? (S.project.tl === 'free' ? t('Clips', 'Clips') : S.project.mode === 'page' ? t('Páginas', 'Pages') : S.project.mode === 'webtoon' ? t('Tiras', 'Strips') : t('Planos', 'Shots')) : t(TABS[id][1], TABS[id][2]));
    /* pestañas visibles del espacio actual (según lo que el usuario haya ocultado en Preferencias › Interfaz) */
    const wsTabs = (ws) => { const all = WS[ws].tabs, k = ws === 'montaje' ? 'm' : 'c', vis = all.filter((id) => !MC.cfg.isHidden('tab:' + k + ':' + id)); return vis.length ? vis : all; };
    const curTab = () => { const tabs = wsTabs(S.ws); if (!tabs.length) return null; if (!tabs.includes(S.tab[S.ws])) S.tab[S.ws] = tabs[0]; return S.tab[S.ws]; };
    const editView = () => { const sh = shot(); return sh && sh.page ? 'page' : sh && sh.webtoon ? 'strip' : 'cam'; };
    /* la pestaña de Cámara abre la vista de edición de cámara; la de Capas y profundidad, la vista 3D */
    function tabView(tab) {
      if (tab === 'camara') S.view = editView(); else if (tab === 'rack' && editView() === 'cam') S.view = 'depth';
      else if (['cam', 'page', 'strip', 'depth'].includes(S.view)) S.view = 'out';
    }
    function setWs(v) {
      if (S.ws === v || !WS[v]) return;
      S.ws = v; studio.dataset.ws = v; studio.dataset.tl = WS[v].tl;
      tabView(v === 'montaje' ? curTab() : null);
      if (v === 'exportar') { togglePlay(false); S.view = 'out'; if (!S.sim && opts().W / opts().H < 0.8) S.sim = 'tiktok'; buildExportPanel(); }
      S.fmtOpen = false; S.ovMenu = false; S.viewOpen = false; applyLayout();
      renderTop(); renderRail(); renderPanels(); renderVbar(); buildSim(); renderTimeline(); fit();
      [el.leftEl, el.colL, el.colR].forEach((n) => { if (n) { n.classList.remove('wsfade'); void n.offsetWidth; n.classList.add('wsfade'); } });
      MC.announce(t(WS[v].es, WS[v].en));
    }
    const openExport = () => setWs('exportar');

    /* ---------- disposición ajustable: paneles acoplables y ventanas separadas ---------- */
    const DEF_DOCK = { tools: 'l', layers: 'r', props: 'r', tl: 'b' };
    const LAYOUT_DEF = { left: null, right: null, cl: null, bl: null, br: null, tl: null, hl: false, hr: false, ht: false, hy: false, hp: false, dock: Object.assign({}, DEF_DOCK), geo: {}, last: [] };
    const loadLayout = () => {
      let o = {}; try { o = JSON.parse(MC.store.get('layout', '{}')) || {}; } catch (e) { o = {}; }
      if (o.hr) { o.hy = o.hp = true; o.hr = false; }
      const r = Object.assign({}, LAYOUT_DEF, o); r.dock = Object.assign({}, DEF_DOCK, o.dock || {}); r.geo = Object.assign({}, o.geo || {}); return r;
    };
    const LY = loadLayout();
    const saveLayout = () => MC.store.set('layout', JSON.stringify(LY));
    const PANEL_NAME = { viewer: ['Visor', 'Viewer'], timeline: ['Línea de tiempo', 'Timeline'], tools: ['Herramientas', 'Tools'], layers: ['Capas', 'Layers'], props: ['Propiedades', 'Properties'] };
    const HIDE_KEY = { tools: 'hl', layers: 'hy', props: 'hp', timeline: 'ht' };
    const POP = {}; // id → { win, host, ro, closing }
    const PNODES = () => ({ viewer: [viewer], timeline: [timeline], tools: [el.rail, el.leftEl], layers: [layersPanel], props: [propsPanel] });
    const docsOpen = () => [document].concat(Object.keys(POP).map((k) => POP[k].win.document));
    const qAll = (sel) => docsOpen().reduce((a, d) => a.concat([...d.querySelectorAll(sel)]), []);
    const dockOf = (id) => (id === 'timeline' ? LY.dock.tl : LY.dock[id]);
    const colOf = (id) => (innerWidth <= 900 ? DEF_DOCK[id] : LY.dock[id]);
    const hiddenP = (id) => !!LY[HIDE_KEY[id]];
    const zf = (n) => (n.offsetWidth ? n.getBoundingClientRect().width / n.offsetWidth : 1) || 1;

    function placePanels(narrow) {
      const main = el.sMain;
      if (!POP.tools) { [el.rail, el.leftEl].forEach((n) => { if (n.parentNode !== main) main.append(n); }); }
      if (!POP.viewer && viewer.parentNode !== main) main.append(viewer);
      if (!POP.timeline && timeline.parentNode !== el.sBot) el.sBot.insertBefore(timeline, el.zBR);
      const want = { l: [], r: [], bl: [], br: [] };
      [['layers', layersPanel], ['props', propsPanel]].forEach((x) => { if (!POP[x[0]]) want[narrow ? DEF_DOCK[x[0]] : LY.dock[x[0]]].push(x[1]); });
      [['l', el.colL, el.hCl], ['r', el.colR, el.hCr], ['bl', el.zBL, el.hBl], ['br', el.zBR, el.hBr]].forEach((c) => {
        const cur = [...c[1].children].filter((n) => n !== c[2]);
        if (cur.length !== want[c[0]].length || cur.some((n, i) => n !== want[c[0]][i])) { want[c[0]].forEach((n) => c[1].append(n)); c[1].append(c[2]); }
      });
      [layersPanel, propsPanel].forEach((n) => n.classList.toggle('solo', n.parentNode.querySelectorAll(':scope > .panel-col').length === 1));
    }
    /* las medidas se guardan en píxeles de la interfaz (ya con la escala aplicada) */
    function applyLayout() {
      const st = studio.style, narrow = innerWidth <= 900;
      const set = (k, v) => (v == null ? st.removeProperty(k) : st.setProperty(k, v));
      placePanels(narrow); if (typeof applyRows === 'function' && el.tlContent) applyRows();
      const ts = narrow ? 'l' : LY.dock.tools, tlTop = !narrow && LY.dock.tl === 't', ex = S.ws === 'exportar';
      studio.dataset.pviewer = POP.viewer ? '1' : '0'; document.documentElement.dataset.compact = narrow ? '1' : '0';
      Object.keys(POP).forEach((k) => syncDoc(POP[k].win.document, true));
      if (narrow) {
        ['--left-w', '--right-w', '--tl-h', '--g1', '--g2', '--g3', '--g5', '--g6', '--g7'].forEach((k) => st.removeProperty(k));
        st.gridTemplateRows = ''; el.sBot.style.gridRow = ''; el.sMain.style.gridRow = ''; el.sBot.style.removeProperty('--bl-w'); el.sBot.style.removeProperty('--br-w');
        [el.rail, el.leftEl, el.colL, el.colR, viewer, el.vghost, el.exportEl].forEach((n) => { n.style.gridColumn = ''; n.style.gridRow = ''; n.style.display = ''; });
        studio.dataset.hl = studio.dataset.hr = studio.dataset.ht = studio.dataset.hy = studio.dataset.hp = '0'; studio.dataset.ts = 'l'; studio.dataset.tlp = 'b';
        return;
      }
      studio.dataset.hl = LY.hl ? '1' : '0'; studio.dataset.hy = LY.hy ? '1' : '0'; studio.dataset.hp = LY.hp ? '1' : '0'; studio.dataset.ht = LY.ht ? '1' : '0';
      studio.dataset.hr = LY.hy && LY.hp ? '1' : '0'; studio.dataset.ts = ts; studio.dataset.tlp = tlTop ? 't' : 'b';
      const tw = LY.left ? LY.left + 'px' : 'var(--left-w)', vis = (side) => ['layers', 'props'].some((id) => LY.dock[id] === side && !POP[id] && !LY[HIDE_KEY[id]]);
      const onT = !POP.tools, lw = (LY.hl ? '0px' : tw), cw = (v) => (v ? v + 'px' : 'var(--right-w)');
      const vl = vis('l'), vr = vis('r');
      set('--g1', onT && ts === 'l' ? 'var(--rail-w)' : '0px'); set('--g2', onT && ts === 'l' ? lw : '0px');
      set('--g3', vl ? cw(LY.cl) : '0px'); set('--g5', vr ? cw(LY.right) : '0px');
      set('--g6', onT && ts === 'r' ? lw : '0px'); set('--g7', onT && ts === 'r' ? 'var(--rail-w)' : '0px');
      const vbl = vis('bl'), vbr = vis('br');
      el.sBot.style.setProperty('--bl-w', vbl ? (LY.bl ? LY.bl + 'px' : '340px') : '0px'); el.sBot.style.setProperty('--br-w', vbr ? (LY.br ? LY.br + 'px' : '340px') : '0px');
      el.zBL.style.display = vbl ? '' : 'none'; el.zBR.style.display = vbr ? '' : 'none';
      el.colL.style.display = vl ? '' : 'none'; el.colR.style.display = vr ? '' : 'none';
      [el.rail, el.leftEl, el.colL, el.colR, viewer, el.vghost, el.exportEl].forEach((n) => { n.style.gridRow = '1'; });
      el.rail.style.gridColumn = ts === 'l' ? '1' : '7'; el.leftEl.style.gridColumn = ts === 'l' ? '2' : '6';
      el.colL.style.gridColumn = '3'; el.colR.style.gridColumn = '5';
      viewer.style.gridColumn = el.vghost.style.gridColumn = ex ? '1' : '4'; el.exportEl.style.gridColumn = ex ? '2' : '';
      el.hTools.className = 'pz ' + (ts === 'l' ? 'pz-r' : 'pz-l'); el.hTools.hidden = LY.hl;
      el.hTl.className = 'pz ' + (tlTop ? 'pz-b' : 'pz-t');
      set('--tl-h', POP.timeline || WS[S.ws].tl === 'none' ? (POP.timeline ? '0px' : null) : LY.ht ? '46px' : LY.tl ? LY.tl + 'px' : null);
      st.gridTemplateRows = tlTop ? 'auto var(--tl-h, 260px) minmax(0, 1fr)' : '';
      el.sBot.style.gridRow = tlTop ? '2' : ''; el.sMain.style.gridRow = tlTop ? '3' : '';
      S.dirty = true; if (el.canvas) requestAnimationFrame(() => fit());
    }
    /* tirador para arrastrar el borde de un panel; doble clic lo oculta o lo restaura */
    function handle(kind, cls, label) {
      const sgn = () => (kind === 'left' ? (LY.dock.tools === 'l' ? 1 : -1) : kind === 'cl' || kind === 'bl' ? 1 : kind === 'right' || kind === 'br' ? -1 : (LY.dock.tl === 'b' ? -1 : 1));
      const cur = () => (kind === 'left' ? el.leftEl.offsetWidth : kind === 'cl' ? el.colL.offsetWidth : kind === 'right' ? el.colR.offsetWidth : kind === 'bl' ? el.zBL.offsetWidth : kind === 'br' ? el.zBR.offsetWidth : timeline.offsetHeight);
      const put = (size) => {
        if (kind === 'left') { LY.left = clamp(Math.round(size), 200, 620); LY.hl = false; }
        else if (kind === 'cl') { LY.cl = clamp(Math.round(size), 220, 620); }
        else if (kind === 'right') { LY.right = clamp(Math.round(size), 220, 620); }
        else if (kind === 'bl') { LY.bl = clamp(Math.round(size), 240, 900); }
        else if (kind === 'br') { LY.br = clamp(Math.round(size), 240, 900); }
        else { LY.tl = clamp(Math.round(size), 120, Math.round(studio.offsetHeight * 0.82)); LY.ht = false; }
        applyLayout();
      };
      const hd = h('div', { class: 'pz pz-' + cls, role: 'separator', tabindex: '0', 'aria-label': label, 'aria-orientation': kind === 'tl' ? 'horizontal' : 'vertical',
        title: t('Arrastra para cambiar el tamaño · doble clic para ocultar', 'Drag to resize · double-click to hide'),
        onDblclick: () => toggleLayout(kind),
        onPointerdown: (e) => {
          if (e.button) return; e.preventDefault(); hd.setPointerCapture(e.pointerId); hd.classList.add('on');
          const f = zf(studio), x0 = e.clientX, y0 = e.clientY, size = cur(), sg = sgn();
          const move = (ev) => put(size + sg * (kind === 'tl' ? (ev.clientY - y0) : (ev.clientX - x0)) / f);
          const up = () => { hd.classList.remove('on'); hd.removeEventListener('pointermove', move); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up); saveLayout(); renderTop(); };
          hd.addEventListener('pointermove', move); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
        },
        onKeydown: (e) => {
          const st = e.shiftKey ? 40 : 10, k = e.key; let used = true;
          if (kind !== 'tl' && (k === 'ArrowLeft' || k === 'ArrowRight')) put(cur() + sgn() * (k === 'ArrowRight' ? st : -st));
          else if (kind === 'tl' && (k === 'ArrowUp' || k === 'ArrowDown')) put(cur() + sgn() * (k === 'ArrowDown' ? st : -st));
          else if (k === 'Enter') toggleLayout(kind); else used = false;
          if (used) { e.preventDefault(); saveLayout(); }
        } });
      return hd;
    }
    function toggleLayout(kind) {
      let on;
      if (kind === 'left') { LY.hl = !LY.hl; on = LY.hl; }
      else if (kind === 'tl') { LY.ht = !LY.ht; on = LY.ht; }
      else {
        const side = { cl: 'l', right: 'r', bl: 'bl', br: 'br' }[kind] || 'r', ids = ['layers', 'props'].filter((id) => LY.dock[id] === side && !POP[id]);
        on = ids.some((id) => !LY[HIDE_KEY[id]]); ids.forEach((id) => { LY[HIDE_KEY[id]] = on; });
      }
      applyLayout(); saveLayout(); renderTop();
      MC.announce(({ left: t('Herramientas', 'Tools'), cl: t('Columna izquierda', 'Left column'), right: t('Columna derecha', 'Right column'), bl: t('Zona junto a la línea de tiempo (izquierda)', 'Zone beside the timeline (left)'), br: t('Zona junto a la línea de tiempo (derecha)', 'Zone beside the timeline (right)'), tl: t('Línea de tiempo', 'Timeline') })[kind] + ': ' + (on ? t('oculto', 'hidden') : t('visible', 'visible')));
    }
    function resetLayout() { Object.keys(POP).forEach((k) => dockBack(k)); const g = LY.geo; Object.assign(LY, LAYOUT_DEF, { dock: Object.assign({}, DEF_DOCK), geo: g, last: [] }); applyLayout(); saveLayout(); renderTop(); }
    function setDock(id, side) { if (id === 'timeline') LY.dock.tl = side; else LY.dock[id] = side; LY[HIDE_KEY[id]] = false; applyLayout(); saveLayout(); renderTop(); MC.announce(t(PANEL_NAME[id][0], PANEL_NAME[id][1]) + ': ' + side); }
    function hidePanel(id) { LY[HIDE_KEY[id]] = true; applyLayout(); saveLayout(); renderTop(); }
    const PRESETS = [
      ['std', ['Estándar', 'Standard'], { tools: 'l', layers: 'r', props: 'r', tl: 'b' }, {}],
      ['izq', ['Todo a la izquierda', 'All on the left'], { tools: 'l', layers: 'l', props: 'l', tl: 'b' }, {}],
      ['der', ['Todo a la derecha', 'All on the right'], { tools: 'r', layers: 'r', props: 'r', tl: 'b' }, {}],
      ['cruz', ['Capas a un lado, propiedades al otro', 'Layers one side, properties the other'], { tools: 'l', layers: 'l', props: 'r', tl: 'b' }, {}],
      ['arriba', ['Línea de tiempo arriba', 'Timeline on top'], { tools: 'l', layers: 'r', props: 'r', tl: 't' }, {}],
      ['capder', ['Capas junto a la línea de tiempo (a su derecha)', 'Layers beside the timeline (on its right)'], { tools: 'l', layers: 'br', props: 'r', tl: 'b' }, { tl: 330 }],
      ['capizq', ['Capas a la izquierda de la línea de tiempo', 'Layers on the timeline’s left'], { tools: 'l', layers: 'bl', props: 'r', tl: 'b' }, { tl: 330 }],
      ['propab', ['Capas y propiedades junto a la línea de tiempo', 'Layers and properties beside the timeline'], { tools: 'l', layers: 'bl', props: 'br', tl: 'b' }, { tl: 360 }],
      ['foco', ['Solo visor y línea de tiempo', 'Viewer and timeline only'], { tools: 'l', layers: 'r', props: 'r', tl: 'b' }, { hl: true, hy: true, hp: true }],
    ];
    function applyPreset(p) {
      LY.dock = Object.assign({}, p[2]); LY.left = LY.right = LY.cl = LY.bl = LY.br = LY.tl = null;
      LY.hl = LY.hy = LY.hp = LY.ht = false; Object.assign(LY, p[3]);
      applyLayout(); saveLayout(); renderTop(); MC.announce(t(p[1][0], p[1][1]));
    }

    /* ----- ventanas separadas ----- */
    function syncDoc(d, again) {
      const r = document.documentElement, q = d.documentElement;
      [...r.attributes].forEach((a) => { if (q.getAttribute(a.name) !== a.value) q.setAttribute(a.name, a.value); });
      if (!again || !d.head.querySelector('[data-mcsync]')) {
        d.head.querySelectorAll('[data-mcsync]').forEach((n) => n.remove());
        document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => { const c = d.importNode(n, true); c.setAttribute('data-mcsync', '1'); d.head.append(c); });
      }
      try { document.fonts.forEach((ff) => { try { d.fonts.add(ff); } catch (e) { /* ya estaba */ } }); } catch (e) { /* sin API de fuentes */ }
    }
    function popOut(id, o) {
      o = o || {};
      if (POP[id]) { try { POP[id].win.focus(); } catch (e) { /* cerrada */ } return; }
      const g = LY.geo[id] || {}, dfl = { viewer: [1280, 760], timeline: [1280, 420], tools: [460, 760], layers: [360, 520], props: [380, 760] }[id];
      const w = o.w || g.w || dfl[0], hh = o.h || g.h || dfl[1], x = o.x != null ? o.x : g.x != null ? g.x : (window.screenX || 0) + 60, y = o.y != null ? o.y : g.y != null ? g.y : (window.screenY || 0) + 60;
      let win = null;
      try { win = window.open('', 'mc-' + id, 'popup=yes,width=' + Math.round(w) + ',height=' + Math.round(hh) + ',left=' + Math.round(x) + ',top=' + Math.round(y)); } catch (e) { win = null; }
      if (!win) { MC.toast(t('El navegador ha bloqueado la ventana. Permite las ventanas emergentes para este sitio y vuelve a intentarlo.', 'The browser blocked the window. Allow pop-ups for this site and try again.')); return; }
      const d = win.document, base = /^(https?|file):/.test(document.baseURI) ? '<base href="' + document.baseURI + '">' : '';
      d.open(); d.write('<!doctype html><html><head><meta charset="utf-8">' + base + '<meta name="viewport" content="width=device-width,initial-scale=1"><title></title></head><body class="pop"></body></html>'); d.close();
      d.title = t(PANEL_NAME[id][0], PANEL_NAME[id][1]) + ' · ' + (S.project.name || 'MotionComic Studio');
      syncDoc(d, false);
      const host = d.createElement('div'); host.className = 'studio popped pop-' + id; host.dataset.ws = S.ws; host.dataset.pop = id;
      d.body.append(host);
      const rec = POP[id] = { win, host, closing: false, ro: null };
      PNODES()[id].forEach((n) => host.append(n));
      d.addEventListener('keydown', onKey); d.addEventListener('pointerdown', (e) => onDocDown(e), true); if (MC.touch) MC.touch.wireDoc(d); wireCtx(host);
      win.addEventListener('focus', () => { MC.hostDoc = d; });
      win.addEventListener('pagehide', () => { if (!rec.closing) dockBack(id, true); });
      let rt = 0; win.addEventListener('resize', () => { fit(); clearTimeout(rt); rt = setTimeout(() => saveGeo(id, win), 300); });
      try { rec.ro = new win.ResizeObserver(() => fit()); rec.ro.observe(el.stage); } catch (e) { /* sin ResizeObserver */ }
      MC.hostDoc = d; try { win.focus(); } catch (e) { /* sin foco */ }
      LY.last = Array.from(new Set((LY.last || []).concat(id))); saveLayout();
      applyLayout(); renderTop(); S.dirty = true; setTimeout(fit, 60);
      MC.announce(t(PANEL_NAME[id][0], PANEL_NAME[id][1]) + ': ' + t('en otra ventana', 'in another window'));
    }
    function saveGeo(id, win) { try { LY.geo[id] = { x: win.screenX, y: win.screenY, w: win.outerWidth, h: win.outerHeight }; saveLayout(); } catch (e) { /* cerrada */ } }
    function dockBack(id, fromClose) {
      const rec = POP[id]; if (!rec) return;
      rec.closing = true; delete POP[id];
      if (!fromClose) saveGeo(id, rec.win);
      try { if (rec.ro) rec.ro.disconnect(); } catch (e) { /* nada */ }
      if (!Object.keys(POP).length || MC.hostDoc === rec.win.document) MC.hostDoc = document;
      LY.last = (LY.last || []).filter((k) => k !== id);
      applyLayout();
      if (!fromClose) { try { rec.win.close(); } catch (e) { /* nada */ } }
      saveLayout(); renderTop(); S.dirty = true; setTimeout(fit, 60);
    }
    function closePops() { Object.keys(POP).forEach((k) => { const keep = LY.last; dockBack(k, false); LY.last = keep; }); }
    async function pickScreen(id) {
      let det = null;
      try { det = await window.getScreenDetails(); } catch (e) { det = null; }
      if (!det || !det.screens || !det.screens.length) { MC.toast(t('No se pudo leer la lista de pantallas (hay que permitir «Gestión de ventanas»). Se abre en una ventana normal.', 'Could not read the screen list (“Window management” must be allowed). Opening a normal window.')); popOut(id); return; }
      let m = null;
      const body = h('div', { class: 'wlist' }, det.screens.map((s, i) => h('div', null, h('span', null, t('Pantalla ', 'Screen ') + (i + 1) + ' · ' + s.width + '×' + s.height + (s === det.currentScreen ? t(' (esta)', ' (this one)') : '')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { if (m) m.close(); popOut(id, { x: s.availLeft + 16, y: s.availTop + 16, w: s.availWidth - 32, h: s.availHeight - 32 }); } }, t('Abrir aquí', 'Open here')))));
      m = MC.modal(t('¿En qué pantalla?', 'Which screen?'), body, (close) => [h('button', { class: 'btn btn-g', type: 'button', onClick: close }, t('Cancelar', 'Cancel'))]);
    }
    function closeDockMenu() { qAll('.dockmenu').forEach((n) => n.remove()); }
    function panelMenu(id, btn) {
      const had = btn.dataset.open === '1'; closeDockMenu(); qAll('.dockctl button[data-open]').forEach((b) => { b.dataset.open = ''; b.setAttribute('aria-expanded', 'false'); });
      if (had) return;
      const hostEl = btn.closest('.studio'); if (!hostEl) return;
      const item = (ic, label, fn, dis) => h('button', { type: 'button', role: 'menuitem', disabled: !!dis, onClick: () => { closeDockMenu(); btn.dataset.open = ''; btn.setAttribute('aria-expanded', 'false'); fn(); } }, MC.icon(ic, 14), label);
      const items = [h('div', { class: 'eyebrow' }, t(PANEL_NAME[id][0], PANEL_NAME[id][1]))];
      if (POP[id]) items.push(item('undo', t('Devolver a la ventana principal', 'Return to the main window'), () => dockBack(id)));
      else {
        if (id === 'timeline') items.push(item('up', t('Mover arriba', 'Move to the top'), () => setDock(id, 't'), LY.dock.tl === 't'), item('down', t('Mover abajo', 'Move to the bottom'), () => setDock(id, 'b'), LY.dock.tl === 'b'));
        else if (id !== 'viewer') items.push(item('back', t('Mover a la izquierda', 'Move to the left'), () => setDock(id, 'l'), dockOf(id) === 'l'), item('chevron', t('Mover a la derecha', 'Move to the right'), () => setDock(id, 'r'), dockOf(id) === 'r'));
        if (id === 'layers' || id === 'props') items.push(item('down', t('Abajo, a la izquierda de la línea de tiempo', 'Bottom, left of the timeline'), () => setDock(id, 'bl'), dockOf(id) === 'bl'), item('down', t('Abajo, a la derecha de la línea de tiempo', 'Bottom, right of the timeline'), () => setDock(id, 'br'), dockOf(id) === 'br'));
        items.push(item('frame', t('Sacar a otra ventana', 'Detach to a new window'), () => popOut(id)));
        if ('getScreenDetails' in window) items.push(item('frame', t('Sacar a otra pantalla…', 'Detach to another screen…'), () => pickScreen(id)));
        if (id !== 'viewer') items.push(item('close', t('Ocultar', 'Hide'), () => hidePanel(id)));
      }
      items.push(item('undo', t('Restablecer toda la disposición', 'Reset the whole layout'), resetLayout));
      const menu = h('div', { class: 'dockmenu', role: 'menu', 'aria-label': t('Opciones del panel', 'Panel options'), onKeydown: (e) => { if (e.key === 'Escape') { closeDockMenu(); btn.dataset.open = ''; btn.focus(); } } }, items);
      hostEl.append(menu); btn.dataset.open = '1'; btn.setAttribute('aria-expanded', 'true');
      const f = zf(hostEl), hr = hostEl.getBoundingClientRect(), br = btn.getBoundingClientRect();
      const right = Math.max(4, (hr.right - br.right) / f), up = br.top - hr.top > hr.height / 2;
      menu.style.right = right + 'px'; if (up) menu.style.bottom = ((hr.bottom - br.top) / f + 4) + 'px'; else menu.style.top = ((br.bottom - hr.top) / f + 4) + 'px';
      const first = menu.querySelector('button:not([disabled])'); if (first) first.focus();
    }
    function dockCtl(id) {
      const more = h('button', { class: 'btn btn-g btn-ic', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', title: t('Opciones del panel: mover, sacar a otra ventana, ocultar', 'Panel options: move, detach to a window, hide'), 'aria-label': t('Opciones del panel ', 'Panel options ') + t(PANEL_NAME[id][0], PANEL_NAME[id][1]), onClick: (e) => panelMenu(id, e.currentTarget) }, MC.icon('dots', 16));
      const grip = h('button', { class: 'btn btn-g btn-ic grip-btn', type: 'button', tabindex: '-1', 'aria-hidden': 'true', title: t('Arrastra para mover el panel de lado; suéltalo fuera de la ventana para sacarlo a otra pantalla', 'Drag to move the panel to the other side; drop it outside the window to detach it to another screen'), onPointerdown: (e) => dragPanel(id, e) }, '⠿');
      return h('span', { class: 'dockctl', 'data-pid': id }, grip, more);
    }
    function dragPanel(id, e) {
      if (e.button || POP[id] || innerWidth <= 900) return; e.preventDefault();
      const g = e.currentTarget; try { g.setPointerCapture(e.pointerId); } catch (er) { /* sin captura */ }
      let hint = null, drop = null;
      const out = (ev) => ev.clientX < 0 || ev.clientY < 0 || ev.clientX > innerWidth || ev.clientY > innerHeight;
      const move = (ev) => {
        const r = studio.getBoundingClientRect(), f = zf(studio), mr = el.sMain.getBoundingClientRect();
        if (!hint) { hint = h('div', { class: 'dockhint' }); studio.append(hint); }
        let box;
        if (out(ev)) { drop = { pop: true }; box = [0, 0, r.width / f, r.height / f, t('Soltar: sacar a otra ventana', 'Drop: detach to a new window')]; }
        else if (id === 'timeline') {
          const top = ev.clientY < r.top + r.height / 2; drop = { side: top ? 't' : 'b' };
          box = top ? [0, (mr.top - r.top) / f, r.width / f, r.height * 0.3 / f, t('Línea de tiempo arriba', 'Timeline on top')] : [0, (r.height * 0.7) / f, r.width / f, r.height * 0.3 / f, t('Línea de tiempo abajo', 'Timeline at the bottom')];
        } else if ((id === 'layers' || id === 'props') && (() => { const tr = timeline.getBoundingClientRect(); return tr.height > 0 && ev.clientY >= tr.top && ev.clientY <= tr.bottom && (ev.clientX < tr.left + tr.width * 0.25 || ev.clientX > tr.right - tr.width * 0.25); })()) {
          const tr = timeline.getBoundingClientRect(), left = ev.clientX < tr.left + tr.width / 2; drop = { side: left ? 'bl' : 'br' };
          box = [(left ? tr.left - r.left : tr.right - r.left - tr.width * 0.25) / f, (tr.top - r.top) / f, tr.width * 0.25 / f, tr.height / f, left ? t('Abajo, a la izquierda de la línea de tiempo', 'Bottom, left of the timeline') : t('Abajo, a la derecha de la línea de tiempo', 'Bottom, right of the timeline')];
        } else {
          const left = ev.clientX < r.left + r.width / 2; drop = { side: left ? 'l' : 'r' };
          box = [left ? 0 : r.width * 0.7 / f, (mr.top - r.top) / f, r.width * 0.3 / f, mr.height / f, left ? t('A la izquierda', 'On the left') : t('A la derecha', 'On the right')];
        }
        Object.assign(hint.style, { left: box[0] + 'px', top: box[1] + 'px', width: box[2] + 'px', height: box[3] + 'px' }); hint.textContent = box[4];
      };
      const up = (ev) => {
        g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
        if (hint) hint.remove();
        if (ev.type === 'pointercancel' || !drop) return;
        if (drop.pop) popOut(id, { x: ev.screenX - 200, y: ev.screenY - 30 }); else setDock(id, drop.side);
      };
      g.addEventListener('pointermove', move); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    }
    const UI_SCALES = [['0.7', '70 %'], ['0.8', '80 %'], ['0.9', '90 %'], ['1', '100 %'], ['1.15', '115 %'], ['1.3', '130 %']];
    function setUiScale(v) { MC.store.set('uizoom', v); MC.applyPrefs(); S.dirty = true; renderTop(); requestAnimationFrame(() => { applyLayout(); fit(); }); }
    function renderViewMenu() {
      if (el.viewMenu) { el.viewMenu.remove(); el.viewMenu = null; }
      if (!S.viewOpen || !el.viewBtn) return;
      const z = MC.store.get('uizoom', '1'), cb = (key, kind, label) => h('label', null, h('input', { type: 'checkbox', checked: !LY[key], onChange: () => toggleLayout(kind) }), label), pcb = (key, id, label) => h('label', null, h('input', { type: 'checkbox', checked: !LY[key], onChange: () => { LY[key] = !LY[key]; applyLayout(); saveLayout(); renderTop(); } }), label);
      el.viewMenu = h('div', { class: 'tmenu vmenu', role: 'dialog', 'aria-label': t('Vista de la interfaz', 'Interface view'), onKeydown: (e) => { if (e.key === 'Escape') { S.viewOpen = false; renderViewMenu(); el.viewBtn.focus(); } } },
        h('div', { class: 'eyebrow', style: { padding: '6px 10px 2px' } }, t('Paneles', 'Panels')),
        cb('hl', 'left', t('Herramientas (panel izquierdo)', 'Tools (side panel)')), pcb('hy', 'layers', t('Capas', 'Layers')), pcb('hp', 'props', t('Propiedades', 'Properties')), cb('ht', 'tl', t('Línea de tiempo', 'Timeline')),
        h('p', { class: 'cap', style: { padding: '2px 10px' } }, t('Arrastra los bordes para cambiar el tamaño (doble clic oculta). Cada panel tiene un menú ⋮ para moverlo de lado o sacarlo a otra ventana; también puedes arrastrar su asa ⠿ a un lado o fuera de la ventana.', 'Drag the edges to resize (double-click hides). Each panel has a ⋮ menu to move it or detach it to another window; you can also drag its ⠿ grip to a side or outside the window.')),
        h('div', { class: 'eyebrow', style: { padding: '8px 10px 2px' } }, t('Disposición', 'Arrangement')),
        h('div', { class: 'presets' }, PRESETS.map((p) => h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => applyPreset(p) }, t(p[1][0], p[1][1])))),
        h('div', { class: 'eyebrow', style: { padding: '8px 10px 2px' } }, t('Ventanas (varias pantallas)', 'Windows (multi-screen)')),
        h('div', { class: 'wlist' }, ['viewer', 'timeline', 'tools', 'layers', 'props'].map((id) => h('div', null, h('span', null, t(PANEL_NAME[id][0], PANEL_NAME[id][1])),
          POP[id] ? h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { dockBack(id); S.viewOpen = false; renderViewMenu(); } }, t('Devolver', 'Return')) : h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { S.viewOpen = false; renderViewMenu(); popOut(id); } }, t('Sacar a otra ventana', 'Detach'))))),
        (LY.last || []).filter((k) => !POP[k]).length ? h('button', { type: 'button', onClick: () => { S.viewOpen = false; renderViewMenu(); (LY.last || []).slice().forEach((k) => popOut(k)); } }, MC.icon('frame', 14), t('Reabrir las ventanas de la última vez', 'Reopen last session’s windows')) : null,
        h('div', { class: 'eyebrow', style: { padding: '8px 10px 2px' } }, t('Tamaño de la interfaz', 'Interface size')),
        h('div', { style: { padding: '2px 10px 6px' } }, MC.ui.seg(UI_SCALES.map((q) => ({ v: q[0], l: q[1] })), UI_SCALES.some((q) => q[0] === z) ? z : null, setUiScale, t('Tamaño de la interfaz', 'Interface size'))),
        h('div', { class: 'eyebrow', style: { padding: '8px 10px 2px' } }, t('Mis vistas', 'My views')),
        h('div', { class: 'wlist' }, Object.keys(MC.cfg.views()).map((n) => h('div', null, h('span', null, n), h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { MC.cfg.apply(MC.cfg.views()[n]); S.viewOpen = false; renderViewMenu(); MC.toast(t('Vista aplicada: ', 'View applied: ') + n); } }, t('Aplicar', 'Apply'))))),
        h('button', { type: 'button', onClick: () => { S.viewOpen = false; renderViewMenu(); askName(t('Nombre de la vista', 'View name'), '', (v) => { MC.cfg.save(v.slice(0, 40)); MC.toast(t('Vista guardada: ', 'View saved: ') + v); }); } }, MC.icon('bookmark', 14), t('Guardar la vista actual…', 'Save the current view…')),
        h('button', { type: 'button', onClick: () => { S.viewOpen = false; renderViewMenu(); MC.openPrefs('ui'); } }, MC.icon('gear', 14), t('Personalizar la interfaz…', 'Customise the interface…')),
        h('button', { type: 'button', onClick: () => { resetLayout(); setUiScale('1'); } }, MC.icon('undo', 14), t('Restablecer disposición y tamaño', 'Reset layout and size')));
      el.viewBtn.parentNode.append(el.viewMenu);
    }

    /* ---------- barra superior ---------- */
    function renderTop() {
      if (el.h1) el.h1.textContent = 'MotionComic Studio · ' + (S.project.name || t('Sin título', 'Untitled'));
      const wsBtn = (v) => h('button', { type: 'button', role: 'tab', 'data-ws': v, 'aria-selected': String(S.ws === v), title: t(WS[v].es, WS[v].en), onClick: () => setWs(v) }, MC.icon(WS[v].icon, 18), h('span', null, t(WS[v].es, WS[v].en)));
      el.status = h('span', { class: 'status', 'aria-live': 'polite' });
      el.jobChip = h('button', { class: 'btn btn-s btn-sm', type: 'button', hidden: true, onClick: openExport });
      updateJobChip(MC.exportJob);
      el.undo = h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Deshacer (Ctrl+Z)', 'Undo (Ctrl+Z)'), 'aria-label': t('Deshacer', 'Undo'), onClick: undo }, MC.icon('undo'));
      el.redo = h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Rehacer (Ctrl+Mayús+Z)', 'Redo (Ctrl+Shift+Z)'), 'aria-label': t('Rehacer', 'Redo'), onClick: redo }, MC.icon('redo'));
      const sz = MC.parseRatio(S.project.ratio), rw = sz[0] >= sz[1] ? 16 : Math.round(16 * sz[0] / sz[1]), rh = sz[0] >= sz[1] ? Math.round(16 * sz[1] / sz[0]) : 16;
      el.fmt = h('button', { class: 'fmt', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': String(!!S.fmtOpen), title: t('Cambiar proporción y resolución', 'Change aspect ratio and resolution'), onClick: () => { S.fmtOpen = !S.fmtOpen; renderFmtPop(); el.fmt.setAttribute('aria-expanded', String(!!S.fmtOpen)); } },
        h('i', { style: { width: rw + 'px', height: rh + 'px' } }), MC.fmtLabel(S.project.ratio, S.project.res));
      MC.put(MC.clear(el.top),
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Volver a tus proyectos', 'Back to your projects'), 'aria-label': t('Volver a tus proyectos', 'Back to your projects'), onClick: close }, MC.icon('back')),
        MC.mark(24),
        h('input', { class: 'ttl', 'aria-label': t('Nombre del proyecto', 'Project name'), value: S.project.name, onChange: (e) => { S.project.name = e.target.value.trim() || S.project.name; commit(); } }),
        el.fmt,
        h('div', { class: 's-tabs', role: 'tablist', 'aria-label': t('Espacios de trabajo', 'Workspaces') }, Object.keys(WS).filter((v) => v === S.ws || !MC.cfg.isHidden('ws:' + v)).map(wsBtn)),
        el.jobChip, MC.update && MC.update.state ? h('button', { class: 'btn btn-p btn-sm updchip', type: 'button', title: t('Hay una versión nueva del estudio', 'There is a new version of the studio'), onClick: () => MC.update.show() }, MC.icon('download', 14), t('Actualizar', 'Update')) : null, el.status, el.undo, el.redo,
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
      const p = S.project, pst = { ratio: p.ratio, res: p.res, zoom: p.zoomPlan || 1.5 };
      el.fmtPop = h('div', { class: 'fmtpop', role: 'dialog', 'aria-label': t('Formato del proyecto', 'Project format'), onKeydown: (e) => { if (e.key === 'Escape') { S.fmtOpen = false; renderFmtPop(); el.fmt.setAttribute('aria-expanded', 'false'); el.fmt.focus(); } } },
        MC.formatPicker(pst, () => { p.ratio = pst.ratio; p.res = pst.res; commit(); fit(); renderTop(); }, { zoom: false }),
        h('p', { class: 'cap' }, t('El encuadre se reajusta solo: corrige a mano lo que haga falta.', 'The framing readjusts itself: fix by hand whatever needs it.')));
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
    async function close() { S.alive = false; togglePlay(false); await save(); try { if (!S.ai) await MC.versions.save(S.project, '', true); } catch (e) { /* sin versión */ } if (MC.motion) await MC.motion.leaveStudio(studio); MC.studioApi = null; cleanup(); MC.app.render(); }

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
      const ids = new Set(); p.shots.forEach((sh) => sh.layers.forEach((l) => MC.layerAssetIds(l).forEach((q) => ids.add(q)))); (p.overlays || []).forEach((o) => ids.add(o.assetId));
      const proj = [...ids].map((id) => MC.assets.get(id)).filter(Boolean), lib = (S.libItems || []).filter((x) => x.kind !== 'audio'), chosen = new Set();
      const btnAdd = h('button', { class: 'btn btn-p', type: 'button', disabled: true }, t('Añadir', 'Add'));
      const card = (id, thumb, name, meta) => { const b2 = h('button', { type: 'button', class: 'pickcard', 'aria-pressed': 'false', draggable: 'true', title: name, onClick: () => { if (chosen.has(id)) chosen.delete(id); else chosen.add(id); b2.setAttribute('aria-pressed', String(chosen.has(id))); btnAdd.disabled = !chosen.size; btnAdd.textContent = chosen.size ? t('Añadir ', 'Add ') + chosen.size : t('Añadir', 'Add'); } }, thumb ? h('img', { src: thumb, alt: '' }) : h('span', { class: 'ph0' }), h('b', null, name), h('small', null, meta || ''));
        b2.addEventListener('dragstart', (e) => { e.dataTransfer.setData(MIME_ASSET, JSON.stringify([{ id, kind: 'image' }])); }); return b2; };
      const body = h('div', { class: 'picker' },
        h('div', { class: 'eyebrow' }, t('En este proyecto · ', 'In this project · ') + proj.length), proj.length ? h('div', { class: 'pickgrid' }, proj.map((a) => card(a.id, a.thumb, a.name, a.video ? t('vídeo', 'video') : a.w + '×' + a.h))) : h('p', { class: 'cap' }, t('Aún no hay imágenes en el proyecto.', 'There are no images in the project yet.')),
        h('div', { class: 'eyebrow', style: { marginTop: '10px' } }, t('En la biblioteca · ', 'In the library · ') + lib.length), lib.length ? h('div', { class: 'pickgrid' }, lib.map((x) => card(x.id, x.thumb, x.name, x.kind === 'video' ? t('vídeo', 'video') : t('imagen', 'image')))) : h('p', { class: 'cap' }, t('La biblioteca está vacía.', 'The library is empty.')));
      MC.modal(opts.title || t('Elegir imágenes', 'Choose images'), body, (close) => [opts.noDevice ? null : h('button', { class: 'btn btn-s', type: 'button', onClick: () => { close(); fileLayers.click(); } }, MC.icon('upload', 14), t('Desde el equipo…', 'From this device…')), h('button', { class: 'btn btn-g', type: 'button', onClick: close }, t('Cancelar', 'Cancel')),
        (() => { btnAdd.addEventListener('click', () => { const sel = [...chosen]; close(); opts.onPick(sel); }); return btnAdd; })()], { wide: true });
    }
    const BLENDS = [['', t('Normal', 'Normal')], ['multiply', t('Multiplicar', 'Multiply')], ['screen', t('Pantalla', 'Screen')], ['overlay', t('Superponer', 'Overlay')], ['soft-light', t('Luz suave', 'Soft light')], ['hard-light', t('Luz fuerte', 'Hard light')], ['lighten', t('Aclarar', 'Lighten')], ['darken', t('Oscurecer', 'Darken')], ['color-dodge', t('Sobreexponer color', 'Colour dodge')], ['color-burn', t('Subexponer color', 'Colour burn')], ['difference', t('Diferencia', 'Difference')], ['exclusion', t('Exclusión', 'Exclusion')]];
    function renderImpMenu() {
      if (el.impMenu) { el.impMenu.remove(); el.impMenu = null; }
      if (!S.impOpen || !el.impBtn) return;
      const item = (ic, label, fn) => h('button', { type: 'button', onClick: () => { S.impOpen = false; renderImpMenu(); fn(); } }, MC.icon(ic, 15), label);
      el.impMenu = h('div', { class: 'tmenu vmenu', role: 'menu', onKeydown: (e) => { if (e.key === 'Escape') { S.impOpen = false; renderImpMenu(); el.impBtn.focus(); } } },
        item('upload', t('Desde el equipo…', 'From this device…'), () => fileLayers.click()), item('image', t('Del proyecto o la biblioteca…', 'From the project or library…'), () => openAssetPicker({ onPick: (ids) => assetsToLayers(ids, S.li >= 0 ? S.li + 1 : null) })),
        item('plus', t('Capa de color liso', 'Solid colour layer'), addSolidLayer), item('folder', t('Carpeta o ZIP…', 'Folder or ZIP…'), () => el.leftEl.querySelector('input[webkitdirectory]') ? el.leftEl.querySelector('input[webkitdirectory]').click() : fileLayers.click()));
      el.impBtn.parentNode.append(el.impMenu);
    }
    async function addSolidLayer() {
      const sh = shot(); if (!sh || sh.page || sh.webtoon) return; const col = prompt(t('Color (por ejemplo #ffffff)', 'Colour (for example #ffffff)'), '#ffffff'); if (!col) return;
      const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, 64, 64);
      const blob = await new Promise((res) => c.toBlob(res, 'image/png')), a = await MC.assets.add(blob, t('Color ', 'Colour ') + col + '.png'); await assetsToLayers([a.id], S.li >= 0 ? S.li + 1 : null);
    }
    /* Si se escribe en un campo y se pulsa otro control, el campo "confirma" al perder el foco y el panel se redibuja antes de que llegue el clic:
       el botón ya no existe y hay que pulsar dos veces. Mientras dura esa pulsación se aplaza el redibujado y se hace justo después. */
    const RG = { on: false, x: 0, y: 0, pend: new Set() };
    function rgFlush() { RG.on = false; const list = [renderLayers, renderPanels, renderTimeline].filter((f) => RG.pend.has(f)); RG.pend.clear(); list.forEach((f) => f()); }
    function rgDefer(fn) { if (!RG.on) return false; RG.pend.add(fn); return true; }
    function rgDown(e) { const a = document.activeElement; RG.on = !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a !== e.target && !(e.target.closest && e.target.closest('input, textarea, select'))); RG.x = e.clientX; RG.y = e.clientY; }
    function rgMove(e) { if (RG.on && Math.hypot(e.clientX - RG.x, e.clientY - RG.y) > 6) rgFlush(); }
    function rgUp() { if (RG.on) setTimeout(() => { if (S.alive) rgFlush(); }, 40); }
    document.addEventListener('pointerdown', rgDown, true); document.addEventListener('pointermove', rgMove, true); document.addEventListener('pointerup', rgUp, true); document.addEventListener('pointercancel', rgUp, true);
    function renderLayers() {
      if (rgDefer(renderLayers)) return;
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
      if (S.project.tl === 'free' && !S.xs) b.append(h('p', { class: 'cap', style: { padding: '8px' } }, t('Aquí se ven las capas de una capa agrupada. Selecciona una en la línea de tiempo o en el panel Clips. Para añadir imágenes sueltas, usa «Importar» o arrástralas a una pista.', 'Here you see the layers of a grouped layer. Pick one on the timeline or in the Clips panel. To add loose images, use “Import” or drag them onto a track.')));
      else if (!sh.layers.length) b.append(h('p', { class: 'cap', style: { padding: '8px' } }, free ? t('Este plano aún no tiene capas. Arrastra aquí imágenes o vídeos, o usa «Importar».', 'This shot has no layers yet. Drag images or videos here, or use “Import”.') : t('Este plano es una página: sus viñetas se editan en la vista «Página».', 'This shot is a page: edit its panels in the “Page” view.')));
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
    function delLayer(i) { const sh = shot(), l = sh && sh.layers[i]; if (!l || l.locked) return; sh.layers.splice(i, 1); S.li = clamp(S.li >= i ? S.li - 1 : S.li, -1, sh.layers.length - 1); if (S.li < 0 && sh.layers.length) S.li = -1; commit(); undoToast(t('Capa eliminada', 'Layer deleted')); }

    /* ---------- inspector ---------- */
    const secDom = (d) => { const open = S.open[d.id] !== false; return h('div', { class: 'sec', 'data-id': d.id, 'data-open': String(open) },
      h('div', { class: 'shw' }, h('button', { class: 'sh', type: 'button', 'aria-expanded': String(open), onClick: () => { S.open[d.id] = !open; renderPanels(); } }, h('span', { class: 'eyebrow' }, d.title), MC.icon(open ? 'up' : 'down', 14)), MC.HELP.has(d.id) ? MC.helpBtn(d.id) : null),
      h('div', { class: 'sb' }, d.nodes)); };
    const boxDom = (d) => h('div', { class: 'box', 'data-id': d.id }, h('div', { class: 'eyebrow' }, d.title), d.nodes);
    const nameIn = (label, value, fn) => { const id = 'n-' + MC.uid(); return MC.ui.field(label, h('input', { class: 'input', id, value, onChange: (e) => fn(e.target.value.trim()) }), id); };

    /* ---------- transiciones ---------- */
    const reducedMotion = () => document.documentElement.getAttribute('data-motion') === 'reduce' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    let trAnim = 0;
    /* envuelve un elemento con una estrella de favoritos en la esquina */
    const favWrap = (kind, id, node, again) => h('div', { class: 'favwrap' }, node, MC.fav.btn(kind, id, () => { if (again && again()) renderPanels(); }));
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
      const st = curStart();
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
    /* vista previa de una transición con tus propios planos: se prueba en el visor sin aplicarla */
    function trHover(x, tile) {
      if (S.si < 1) return tile;
      return hoverable(tile, 'trans', (sh) => { sh.transition = Object.assign({}, sh.transition, { type: x.v }); },
        { label: tile.getAttribute('title') || x.v, snap: () => { const o0 = shot().transition; return () => { shot().transition = o0; }; }, win: () => { const st = curStart(), d = Math.max(0.2, Object.assign({ dur: 1 }, shot().transition).dur || 1); return [Math.max(0, st - 0.7), st + d + 0.7]; } });
    }
    function transPanel(onlyFav) {
      if (S.project.tl === 'free') return onlyFav ? [] : freeTransPanel();
      const p = S.project, sh = shot(), can = S.si > 0;
      const cur = can ? sh.transition : null;
      const out = [h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, can ? t('Entrada del plano ', 'Entry of shot ') + (S.si + 1) + ' · ' + sh.name : t('Transiciones', 'Transitions')),
        h('p', { class: 'cap' }, can ? t('Elige cómo entra este plano. Pasa el ratón por encima para verlas moverse.', 'Choose how this shot comes in. Hover to see them move.') : t('El primer plano no tiene transición de entrada: selecciona otro plano en la línea de tiempo.', 'The first shot has no entry transition: pick another shot on the timeline.')),
        p.shots.length > 1 && !can ? h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => selectShot(1, true) }, t('Ir al plano 2', 'Go to shot 2')) : null)];
      const favTr = MC.TRANSITIONS.filter((x) => MC.fav.has('tr', x.v));
      const trMk = (x) => favWrap('tr', x.v, trHover(x, trTile({ type: x.v, dir: cur && cur.type === x.v ? cur.dir : 'l', color: cur && cur.type === x.v ? cur.color : undefined, gap: cur && cur.type === x.v ? cur.gap : undefined, ease: cur && cur.type === x.v ? cur.ease : undefined }, cur && cur.type === x.v, () => {
            if (!can) { MC.toast(t('Selecciona un plano a partir del segundo.', 'Select a shot from the second one on.')); return; }
            hoverStop(); sh.transition.type = x.v; if (!x.color) delete sh.transition.color; commit(); renderPanels();
          })), () => true);
      if (onlyFav) return favTr.length ? [h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('★ Transiciones favoritas', '★ Favourite transitions')), h('div', { class: 'trgrid' }, favTr.map(trMk)))] : [];
      if (favTr.length) out.push(h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('★ Favoritas', '★ Favourites')), h('div', { class: 'trgrid' }, favTr.map(trMk))));
      MC.TRANSITION_GROUPS.forEach((g) => {
        out.push(h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t(g.es, g.en)), h('div', { class: 'trgrid' }, MC.TRANSITIONS.filter((x) => x.g === g.v).map(trMk))));
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
        (() => { let rp = null, d0 = sh.duration; return MC.ui.slider({ label: t('Duración', 'Duration'), min: 0.5, max: 20, step: 0.1, value: sh.duration, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => { if (S.ripple && !rp) rp = rippleBegin(curStart() + d0); sh.duration = v; if (rp) rippleApply(rp, v - d0); layoutClips(); touch(); }, onChange: () => { rp = null; commit(); } }); })(),
      ];
      const isX = !!(S.xs && xById(S.xs));
      if (isX && p.tl === 'free') planoNodes.push(h('p', { class: 'cap' }, t('Capa agrupada: reúne varias capas con profundidad (parallax). Tiene su propia cámara, capas y efectos. Las zonas vacías son transparentes. Despliégala en la línea de tiempo con la flecha y ordena sus capas en el panel Capas.', 'Grouped layer: bundles several layers with depth (parallax). It has its own camera, layers and effects. Empty areas are transparent. Unfold it on the timeline with the arrow and order its layers in the Layers panel.')));
      else if (isX) planoNodes.push(h('p', { class: 'cap' }, t('Plano superpuesto: suena y se ve a la vez que el plano principal, encima de él. Tiene su propia cámara, capas y efectos. Las zonas vacías son transparentes.', 'Overlapping shot: it plays at the same time as the main shot, on top of it. It has its own camera, layers and effects. Empty areas are transparent.')),
        MC.ui.slider({ label: t('Empieza en', 'Starts at'), min: 0, max: Math.max(MC.totalTime(p), sh.start + 1), step: 0.05, value: sh.start, fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { sh.start = v; layoutClips(); S.dirty = true; touch(); }, onChange: commit }),
        h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Pista', 'Track')), MC.ui.chips(p.xtracks.map((q, i) => ({ v: i, l: q.name })), sh.xtrack || 0, (v) => { sh.xtrack = v; commit(); })));
      if (!isX && S.si > 0) { const ti = MC.trInfo(sh.transition.type); planoNodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Transición de entrada', 'Entry transition')), h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { S.open.transicion = true; renderPanels(); const n = el.inspBody.querySelector('[data-id="transicion"]'); if (n) n.scrollIntoView({ block: 'nearest' }); } }, MC.icon('cut', 14), t(ti.es, ti.en)))); }
      planoNodes.push(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const c = JSON.parse(JSON.stringify(sh)); c.id = MC.uid(); c.name += ' 2'; c.layers.forEach((x) => { x.id = MC.uid(); }); if (isX) { c.start = r2(sh.start + 0.5); p.xshots.push(c); commit(); selectXs(c.id, true); return; } if (S.ripple) rippleApply(rippleBegin(curStart() + sh.duration), sh.duration); p.shots.splice(S.si + 1, 0, c); commit(); selectShot(S.si + 1, true); } }, MC.icon('copy', 14), t('Duplicar plano', 'Duplicate shot')),
        h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', disabled: false, onClick: () => { if (isX) { p.xshots = p.xshots.filter((x) => x.id !== S.xs); S.xs = null; S.li = -1; S.selKind = 'shot'; commit(); return; } delShot(); } }, MC.icon('trash', 14), t('Eliminar plano', 'Delete shot')),
        isX ? h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const x = sh, starts = MC.shotStarts(p); let at = p.shots.length; for (let i = 0; i < p.shots.length; i++) if (x.start < starts[i] + p.shots[i].duration / 2) { at = i; break; } p.xshots = p.xshots.filter((q) => q !== x); delete x.start; delete x.xtrack; x.transition = x.transition || { type: 'cut', dur: 0.6 }; p.shots.splice(at, 0, x); S.xs = null; commit(); selectShot(at, true); } }, t('Pasar a la pista principal', 'Move to the main track'))
          : h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: p.shots.length < 2 || !!(sh.page || sh.webtoon), title: t('Lo saca de la secuencia y lo pone encima, a la vez que los demás', 'Takes it out of the sequence and puts it on top, playing at the same time'), onClick: () => { const st = curStart(), x = sh; p.shots.splice(S.si, 1); x.start = r2(st); x.xtrack = 0; x.transition = { type: 'cut', dur: 0.6 }; p.xshots.push(x); S.si = clamp(S.si, 0, p.shots.length - 1); commit(); selectXs(x.id, true); } }, t('Pasar a plano superpuesto', 'Make it an overlapping shot'))));

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
          animSlider(l, { prop: 'sc', es: 'Escala', en: 'Scale', min: 0.5, max: 3, step: 0.01, fmt: (v) => '×' + v.toFixed(2), mode: 'mul', base: () => l.scale || 1, set: (v) => set('scale', v), start: () => curStart() + (l.ts || 0), dur: () => (l.te == null ? sh.duration : l.te) - (l.ts || 0) }),
          animSlider(l, { prop: 'x', es: 'Posición X', en: 'Position X', min: -0.5, max: 0.5, step: 0.005, fmt: (v) => v.toFixed(3), mode: 'add', base: () => l.x || 0, set: (v) => set('x', v), start: () => curStart() + (l.ts || 0), dur: () => (l.te == null ? sh.duration : l.te) - (l.ts || 0) }),
          animSlider(l, { prop: 'y', es: 'Posición Y', en: 'Position Y', min: -0.5, max: 0.5, step: 0.005, fmt: (v) => v.toFixed(3), mode: 'add', base: () => l.y || 0, set: (v) => set('y', v), start: () => curStart() + (l.ts || 0), dur: () => (l.te == null ? sh.duration : l.te) - (l.ts || 0) }),
          animSlider(l, { prop: 'op', es: 'Opacidad', en: 'Opacity', min: 0, max: 1, step: 0.01, fmt: (v) => Math.round(v * 100) + ' %', mode: 'mul', base: () => (l.opacity == null ? 1 : l.opacity), set: (v) => set('opacity', v), start: () => curStart() + (l.ts || 0), dur: () => (l.te == null ? sh.duration : l.te) - (l.ts || 0) }),
          animSlider(l, { prop: 'rot', es: 'Giro', en: 'Rotation', min: -180, max: 180, step: 1, fmt: (v) => Math.round(v) + '°', mode: 'add', base: () => l.rot || 0, set: (v) => set('rot', v), start: () => curStart() + (l.ts || 0), dur: () => (l.te == null ? sh.duration : l.te) - (l.ts || 0) }));
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
        h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Curva de profundidad', 'Depth curve')),
          MC.ui.seg([{ v: '0.6', l: t('Marcada', 'Strong') }, { v: '1', l: t('Lineal', 'Linear') }, { v: '1.8', l: t('Suave', 'Soft') }], String(p.pxGamma || 1), (v) => { if (+v === 1) delete p.pxGamma; else p.pxGamma = +v; commit(); }, t('Curva de profundidad', 'Depth curve')),
          h('span', { class: 'cap' }, t('Marcada separa más las capas cercanas y lejanas del centro; suave las junta.', 'Strong pulls near and far layers further from the middle; soft pulls them together.'))),
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
        textSecs.push(sec('texto', t('Texto', 'Text') + ' · ' + ({ bubble: t('bocadillo', 'bubble'), box: t('caja', 'box'), sfx: t('onomatopeya', 'sound word'), sub: t('subtítulo', 'subtitle') })[tx.kind], nodes.concat([safeNote(tx.id), alignRow(false)])));
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
        h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Posición rápida (según el formato)', 'Quick position (by format)')), MC.ui.chips([['top', t('Arriba (zona segura)', 'Top (safe)')], ['mid', t('Centro', 'Middle')], ['low', t('Tercio inferior', 'Lower third')], ['safe', t('Abajo (zona segura)', 'Bottom (safe)')]].map((q) => ({ v: q[0], l: q[1] })), (() => { const pr = subPresets(opts().W, opts().H), y0 = sub.y; return y0 == null ? 'safe' : Math.abs(y0 - pr.top) < 0.02 ? 'top' : Math.abs(y0) < 0.02 ? 'mid' : Math.abs(y0 - pr.low) < 0.02 ? 'low' : null; })(), (v) => { sub.y = subPresets(opts().W, opts().H)[v]; commit(); })),
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
              const o2 = opts(), tl = clamp(S.time - curStart(), 0, sh.duration), cam = MC.camAt(sh, tl, false), s0 = Math.max(o2.W / asset.w, o2.H / asset.h), PH = asset.h * s0;
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
        h('p', null, t('«Mi estilo» es tu receta: guarda cómo montas (transiciones, curva de cámara, ritmo de las viñetas, parallax, viñeta y tipografías) para repetirlo en proyectos nuevos y en el borrador en un clic, sin empezar de cero. No guarda tus dibujos.', '“My style” is your recipe: it saves how you edit (transitions, camera curve, panel pacing, parallax, panel look and fonts) so you can repeat it on new projects and on the one-click draft without starting over. It does not save your drawings.')),
        saved ? h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Guardado el ', 'Saved on ') + (MC.myStyle.savedAt() ? new Date(MC.myStyle.savedAt()).toLocaleString(MC.lang === 'en' ? 'en-GB' : 'es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : t('(antes de que se anotara la fecha)', '(before dates were recorded)'))),
          h('ul', { class: 'cap' }, MC.styleLines(saved).map((q) => h('li', null, h('b', null, q[0] + ': '), q[1]))),
          (() => { const d = MC.styleDiff(saved, MC.styleFromProject(p)); return d.length ? h('div', null, h('p', { class: 'cap' }, h('b', null, t('Este proyecto se diferencia de Mi estilo en:', 'This project differs from My style in:'))), h('ul', { class: 'cap' }, d.map((x) => h('li', null, x)))) : h('p', { class: 'cap' }, t('✔ Este proyecto coincide con Mi estilo.', '✔ This project matches My style.')); })())
          : h('p', { class: 'cap' }, t('Aún no has guardado tu estilo. Monta un proyecto a tu gusto y pulsa «Guardar como Mi estilo».', 'You have not saved your style yet. Build a project the way you like and press “Save as My style”.')),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => MC.styleGuideDialog() }, MC.icon('edit', 14), t('Mi guía de estilo (notas)', 'My style guide (notes)')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => MC.copyForAI() }, MC.icon('copy', 14), t('Copiar para una IA', 'Copy for an AI'))),
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
        const ac = audioSecs[audioSecs.length - 1], nd = ac.nodes; ac.nodes = [nd[0], nd[1], nd[5], nd[6]];
        audioSecs.push(sec('audio_vol', t('Volumen y fundidos', 'Volume and fades'), [nd[2], nd[3], nd[4]]));
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
      const fxSecs = [], shotStart = curStart(), localT = clamp(S.time - shotStart, 0, Math.max(0.1, sh.duration));
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
      if (p.tl === 'free' && !S.xs) fxSecs.push(sec('efectos', t('Efectos', 'Effects'), [h('p', { class: 'cap' }, t('En la línea de tiempo por pistas los efectos van en una capa agrupada (afectan solo a ella) o en una capa de ajuste (afectan a todo lo que hay debajo). Elige una en la línea de tiempo, o crea una capa de ajuste con el botón de reglas de cualquier pista.', 'On the by-tracks timeline, effects go on a grouped layer (they affect only it) or on an adjustment layer (they affect everything below). Pick one on the timeline, or create an adjustment layer with the sliders button of any track.'))]));
      else {
        const list = sh.fx, selF = list.find((q) => q.id === S.fxsel);
        const fxSl = (f, k, label, min, max, step, fmt, def) => MC.ui.slider({ label, min, max, step, value: f[k] == null ? def : f[k], fmt, onInput: (v) => { f[k] = v; touch(); }, onChange: commit });
        const fxCol = (f, k, label) => h('div', { class: 'field' }, h('label', null, label), h('input', { type: 'color', class: 'input', style: { padding: '2px', height: '34px', width: '90px' }, value: f[k] || '#ffffff', onInput: (e) => { f[k] = e.target.value; touch(); }, onChange: commit }));
        const pc = (v) => Math.round(v * 100) + ' %';
        /* ajustes propios de cada efecto de estilo y ajustes comunes a todos (velocidad, escala, opacidad, entrada y salida, mezcla, variación) */
        const fxParamNodes = (f) => {
          const n = [];
          if (f.type === 'pixelate') n.push(fxSl(f, 'size', t('Tamaño del píxel', 'Pixel size'), 2, 80, 1, (v) => v + ' px', 16));
          if (f.type === 'posterize') n.push(fxSl(f, 'lv', t('Niveles de color', 'Colour levels'), 2, 12, 1, (v) => String(v), 4));
          if (f.type === 'duotone') n.push(fxCol(f, 'color2', t('Color de las luces', 'Highlight colour')), fxSl(f, 'mix', t('Mezcla con la imagen', 'Mix with the image'), 0, 1, 0.01, pc, 1));
          if (f.type === 'glitch') n.push(fxSl(f, 'shift', t('Desplazamiento de las franjas', 'Slice shift'), 0.01, 0.2, 0.005, pc, 0.06), fxSl(f, 'split', t('Separación de color', 'Colour split'), 0, 0.04, 0.001, (v) => (v * 100).toFixed(1) + ' %', 0.012), fxSl(f, 'rate', t('Cambios por segundo', 'Changes per second'), 2, 40, 1, (v) => String(v), 14));
          if (f.type === 'vhs') n.push(fxSl(f, 'lines', t('Grosor de las líneas', 'Scanline width'), 1, 8, 0.5, (v) => v + ' px', 3), fxSl(f, 'noise', t('Ruido', 'Noise'), 0, 1, 0.01, pc, 0.5), fxSl(f, 'wobble', t('Temblor horizontal', 'Horizontal wobble'), 0, 2, 0.05, pc, 0.5), fxSl(f, 'bleed', t('Desborde del color', 'Colour bleed'), 0, 2, 0.05, pc, 0.5));
          if (f.type === 'edges') n.push(fxSl(f, 'thresh', t('Sensibilidad (más bajo = más líneas)', 'Sensitivity (lower = more lines)'), 0.05, 0.8, 0.01, (v) => v.toFixed(2), 0.25), fxSl(f, 'thick', t('Grosor de la línea', 'Line thickness'), 1, 5, 0.1, (v) => v.toFixed(1), 1.5), fxSl(f, 'mix', t('Opacidad de la tinta', 'Ink opacity'), 0, 1, 0.01, pc, 1),
            h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!f.only, onChange: (e) => { f.only = e.target.checked; commit(); } }), h('span', null, t('Solo las líneas, sobre papel blanco', 'Lines only, on white paper'))));
          if (f.type === 'htone') n.push(fxSl(f, 'size', t('Tamaño de los puntos', 'Dot size'), 3, 40, 1, (v) => v + ' px', 10), fxSl(f, 'mix', t('Mezcla con la imagen', 'Mix with the image'), 0, 1, 0.01, pc, 1));
          if (f.type === 'aberration') n.push(fxSl(f, 'opacity', t('Fuerza final', 'Final strength'), 0, 1.5, 0.05, pc, 1));
          if (MC.FX2 && MC.FX2.params[f.type]) MC.FX2.params[f.type].forEach((q) => {
            const kd = MC.FX2.kindOf(q), fid = 'fp-' + f.id + q[0];
            if (kd === 'text') n.push(h('div', { class: 'field' }, h('label', { for: fid }, t(q[1], q[2])), h('input', { id: fid, class: 'input', value: f[q[0]] == null ? q[3] : f[q[0]], maxlength: 24, onInput: (e) => { f[q[0]] = e.target.value; touch(); }, onChange: commit })));
            else if (kd === 'select') n.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t(q[1], q[2])), MC.ui.chips(q[3].map((o2) => ({ v: o2[0], l: t(o2[1], o2[2]) })), f[q[0]] == null ? q[4] : f[q[0]], (v) => { f[q[0]] = v; commit(); })));
            else n.push(fxSl(f, q[0], t(q[1], q[2]), q[3], q[4], q[5], (v) => (q[5] < 1 ? v.toFixed(2) : String(v)), q[6]));
          });
          if (f.type === 'motionblur' || f.type === 'slash') n.push(fxSl(f, 'angle', t('Ángulo', 'Angle'), -90, 90, 1, (v) => v + '°', f.type === 'slash' ? -25 : 0));
          const anim = MC.isAnimFx(f.type), adv = [];
          if (!anim && f.type !== 'aberration' && !MC.isStyleFx(f.type)) adv.push(fxSl(f, 'scale', t('Escala del efecto', 'Effect scale'), 0.5, 2.5, 0.05, (v) => '×' + v.toFixed(2), 1));
          if (!anim && f.type !== 'aberration') adv.push(fxSl(f, 'speed', t('Velocidad', 'Speed'), 0.2, 3, 0.05, (v) => '×' + v.toFixed(2), 1), fxSl(f, 'opacity', t('Opacidad', 'Opacity'), 0, 1, 0.01, pc, 1), fxSl(f, 'fadeIn', t('Aparece en', 'Fades in over'), 0, 2, 0.05, (v) => v.toFixed(2) + ' s', 0.12), fxSl(f, 'fadeOut', t('Desaparece en', 'Fades out over'), 0, 2, 0.05, (v) => v.toFixed(2) + ' s', 0.2), fxSl(f, 'seed', t('Variación', 'Variation'), 0, 20, 1, (v) => String(v), 0));
          if (!anim && f.type !== 'aberration' && !MC.isStyleFx(f.type)) adv.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Mezcla', 'Blend')), MC.ui.chips([{ v: '', l: t('Normal', 'Normal') }, { v: 'screen', l: t('Pantalla', 'Screen') }, { v: 'overlay', l: t('Superponer', 'Overlay') }, { v: 'soft-light', l: t('Luz suave', 'Soft light') }, { v: 'multiply', l: t('Multiplicar', 'Multiply') }, { v: 'lighten', l: t('Aclarar', 'Lighten') }], f.blend || '', (v) => { f.blend = v; commit(); })));
          if (adv.length) n.push(h('details', { class: 'fxadv' }, h('summary', null, t('Ajustes avanzados', 'Advanced settings')), h('div', { style: { display: 'grid', gap: '10px', paddingTop: '8px' } }, adv)));
          return n;
        };
        const addFx = (type) => { const f = MC.newFx(type, localT); if (f.start + f.dur > sh.duration) f.start = Math.max(0, Math.round((sh.duration - f.dur) * 100) / 100); sh.fx.push(f); S.fxsel = f.id; S.open.efectos = true; commit(); };
        const nodes = [
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Animación dentro de la viñeta', 'Animation inside the panel')), h('div', { class: 'chips' }, MC.FX.filter((x) => x.g === 'anim').map((x) => hoverable(h('button', { type: 'button', class: 'chip-b', onClick: () => { hoverStop(); addFx(x.v); } }, '+ ' + t(x.es, x.en)), 'fx', (sh, st) => { const f = MC.newFx(x.v, clamp(S.time - st, 0, Math.max(0, sh.duration - 0.1))); sh.fx = (sh.fx || []).concat([f]); })))),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Acción y ambiente', 'Action and ambience')), h('div', { class: 'chips' }, MC.FX.filter((x) => x.g === 'fx').map((x) => hoverable(h('button', { type: 'button', class: 'chip-b', onClick: () => { hoverStop(); addFx(x.v); } }, '+ ' + t(x.es, x.en)), 'fx', (sh, st) => { const f = MC.newFx(x.v, clamp(S.time - st, 0, Math.max(0, sh.duration - 0.1))); sh.fx = (sh.fx || []).concat([f]); })))),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Estilo de imagen', 'Image style')), h('div', { class: 'chips' }, MC.FX.filter((x) => x.g === 'style').map((x) => hoverable(h('button', { type: 'button', class: 'chip-b', onClick: () => { hoverStop(); addFx(x.v); } }, '+ ' + t(x.es, x.en)), 'fx', (sh, st) => { const f = MC.newFx(x.v, clamp(S.time - st, 0, Math.max(0, sh.duration - 0.1))); sh.fx = (sh.fx || []).concat([f]); })))),
          ...(MC.FX2 ? MC.FX2.groups.map((g) => h('div', { class: 'field' }, h('span', { class: 'cap' }, t(g[1], g[2])), h('div', { class: 'chips' }, MC.FX.filter((x) => x.g === g[0]).map((x) => hoverable(h('button', { type: 'button', class: 'chip-b', title: MC.FX2.heavy.has(x.v) ? t('Más pesado: puede ir lento en equipos modestos', 'Heavier: may be slow on modest computers') : '', onClick: () => { hoverStop(); addFx(x.v); } }, '+ ' + t(x.es, x.en) + (MC.FX2.heavy.has(x.v) ? ' ⚙' : '')), 'fx', (sh, st) => { const f = MC.newFx(x.v, clamp(S.time - st, 0, Math.max(0, sh.duration - 0.1))); sh.fx = (sh.fx || []).concat([f]); }))))) : []),
          h('div', { style: { display: 'grid', gap: '2px' } }, list.slice().sort((a, b) => MC.fxStart(sh, a) - MC.fxStart(sh, b)).map((f) => h('div', { class: 'layer' + (f.id === S.fxsel ? ' on' : ''), onClick: () => { S.fxsel = f.id; renderInspector(); } }, h('span', { class: 'ln' }, MC.fxName(f.type)), h('span', { class: 'lz' }, MC.fxStart(sh, f).toFixed(1) + ' s')))),
        ];
        nodes.splice(2, 0, presetBox('fx', () => MC.captureFx(sh, selF || null), (q) => { MC.applyFx(sh, q.data, localT); commit(); MC.announce(t('Efectos aplicados: ', 'Effects applied: ') + q.name); }, false, selF ? t('Guardar este efecto', 'Save this effect') : t('Guardar los efectos del plano', 'Save this shot’s effects')));
        const propNodes = [];
        if (selF) {
          const anim = MC.isAnimFx(selF.type), colored = ['speed', 'focus', 'flash', 'rain', 'dust', 'sparks', 'snow', 'smoke', 'impact', 'fog', 'beam', 'duotone', 'edges', 'htone'].includes(selF.type) || !!(MC.FX2 && MC.FX2.colored.has(selF.type)), selT = 'ft-' + MC.uid(), selA = 'fa-' + MC.uid();
          const targets = [{ v: '', l: t('Todo el plano', 'Whole shot') }].concat(anim ? sh.layers.map((l) => ({ v: 'l:' + l.id, l: t('Capa: ', 'Layer: ') + l.name })) : []);
          propNodes.push(
            h('div', { class: 'field' }, h('label', { for: selT }, anim ? t('Se aplica a', 'Applies to') : t('Zona', 'Area')), h('select', { id: selT, class: 'input', disabled: !anim, onChange: (e) => { selF.layer = e.target.value.startsWith('l:') ? e.target.value.slice(2) : null; commit(); } }, targets.map((q) => h('option', { value: q.v, selected: q.v === (selF.layer ? 'l:' + selF.layer : '') }, q.l)))),
            sh.page ? h('div', { class: 'field' }, h('label', { for: selA }, t('Empieza', 'Starts')), h('select', { id: selA, class: 'input', onChange: (e) => { selF.panel = e.target.value === '' ? null : +e.target.value; selF.start = 0; commit(); } }, [h('option', { value: '' }, t('En un momento del plano', 'At a time in the shot'))].concat(sh.page.panels.map((q, i) => h('option', { value: String(i), selected: selF.panel === i }, t('Al llegar a la viñeta ', 'On reaching panel ') + (i + 1)))))) : null,
            MC.ui.slider({ label: selF.panel != null ? t('Desfase', 'Offset') : t('Empieza en', 'Starts at'), min: 0, max: Math.max(0.5, sh.duration), step: 0.05, value: clamp(selF.start, 0, Math.max(0.5, sh.duration)), fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { selF.start = v; touch(); }, onChange: commit }),
            MC.ui.slider({ label: t('Dura', 'Lasts'), min: 0.1, max: Math.max(1, sh.duration), step: 0.05, value: clamp(selF.dur, 0.1, Math.max(1, sh.duration)), fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { selF.dur = v; touch(); }, onChange: commit }),
            MC.ui.slider({ label: t('Intensidad', 'Intensity'), min: 0.2, max: 3, step: 0.05, value: selF.intensity, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => { selF.intensity = v; touch(); }, onChange: commit }),
            selF.type === 'speed' ? MC.ui.slider({ label: t('Ángulo', 'Angle'), min: -90, max: 90, step: 1, value: selF.angle || 0, fmt: (v) => v + '°', onInput: (v) => { selF.angle = v; touch(); }, onChange: commit }) : null,
            ...fxParamNodes(selF),
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
        {
          const dof = sh.dof || {}, setD = (k, v) => { sh.dof = Object.assign({ on: true, focus: 0.5, range: 0.08, amount: 14 }, sh.dof, { [k]: v }); S.dirty = true; touch(); }, dn = [];
          dn.push(h('p', { class: 'cap' }, t('Desenfoca las capas según lo lejos que estén de la profundidad enfocada, como una cámara real. Es fijo durante el plano; para pasar el foco de una capa a otra usa el rack focus.', 'Blurs layers according to how far they are from the focused depth, like a real camera. It is fixed during the shot; to move focus from one layer to another use rack focus.')),
            h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!dof.on, onChange: (e) => { setD('on', e.target.checked); commit(); } }), h('span', null, t('Profundidad de campo', 'Depth of field'))));
          if (dof.on) {
            const l0 = sh.layers[S.li];
            dn.push(MC.ui.slider({ label: t('Profundidad enfocada (z)', 'Focused depth (z)'), min: 0, max: 1, step: 0.01, value: dof.focus == null ? 0.5 : dof.focus, fmt: (v) => v.toFixed(2), onInput: (v) => setD('focus', v), onChange: commit }),
              l0 ? h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { setD('focus', l0.z); commit(); } }, t('Enfocar la capa «' + l0.name + '»', 'Focus layer “' + l0.name + '”')) : null,
              MC.ui.slider({ label: t('Zona nítida', 'Sharp zone'), min: 0, max: 0.5, step: 0.01, value: dof.range == null ? 0.08 : dof.range, fmt: (v) => '± ' + v.toFixed(2), onInput: (v) => setD('range', v), onChange: commit }),
              MC.ui.slider({ label: t('Desenfoque máximo', 'Maximum blur'), min: 1, max: 40, step: 0.5, value: dof.amount == null ? 14 : dof.amount, fmt: (v) => v + ' px', onInput: (v) => setD('amount', v), onChange: commit }));
          }
          fxSecs.push(sec('dof', t('Profundidad de campo', 'Depth of field') + (dof.on ? ' · ' + t('activa', 'on') : ''), dn));
        }
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
      /* mis estilos de viñeta: guardar el actual con un nombre, aplicarlo o borrarlo */
      const ownStyles = (f) => {
        const list = MC.frameStyles(), nid = 'fs-' + MC.uid(), inp = h('input', { class: 'input', id: nid, placeholder: t('Nombre del estilo', 'Style name'), maxlength: 40, 'aria-label': t('Nombre del estilo de viñeta', 'Panel style name') });
        const save = () => { const n = inp.value.trim(); if (!n) { inp.focus(); return; } MC.saveFrameStyle(n, f); MC.toast(t('Estilo guardado: ', 'Style saved: ') + n); renderPanels(); };
        return h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Mis estilos de viñeta', 'My panel styles')),
          list.length ? h('div', { class: 'views' }, list.map((q) => h('div', { class: 'viewrow' }, h('b', null, q.name),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { MC.applyFrameStyle(f, q.f); commit(); } }, t('Aplicar', 'Apply')),
            h('button', { class: 'btn btn-g btn-sm', type: 'button', 'aria-label': t('Borrar el estilo ', 'Delete style ') + q.name, onClick: () => { MC.removeFrameStyle(q.name); renderPanels(); } }, MC.icon('trash', 14))))) : h('span', { class: 'cap' }, t('Aún no has guardado ninguno.', 'You have not saved any yet.')),
          h('div', { class: 'viewadd' }, inp, h('button', { class: 'btn btn-s', type: 'button', onClick: save }, MC.icon('bookmark', 14), t('Guardar el estilo actual', 'Save the current style'))));
      };
      const frameEditor = (f, scope) => {
        const shapeAmt = !['rect', 'circle'].includes(f.shape || 'rect');
        const BGS = [['#ffffff', t('Blanco', 'White')], ['#000000', t('Negro', 'Black')], ['#fbf7ee', t('Papel', 'Paper')], ['#e9e6df', t('Gris cálido', 'Warm grey')], ['#ffd84a', t('Amarillo', 'Yellow')], ['#16181b', t('Grafito', 'Graphite')]];
        return [
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Estilos de viñeta', 'Panel styles')),
            MC.ui.chips(MC.FRAME_PRESETS.map((x) => ({ v: x.v, l: t(x.es, x.en) })), null, (v) => { const pr = MC.FRAME_PRESETS.find((x) => x.v === v); Object.assign(f, { pattern: 'plain', shadow: 0, amount: 0.5, radius: 0, bgGrad: 'none', strokeGrad: 'none', shadowBlur: 0, shadowAngle: 45 }, pr.f); commit(); })),
          ownStyles(f),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Calle (espacio entre viñetas)', 'Gutter (space between panels)')), swatches(f.bg, (v) => { f.bg = v; }, BGS)),
          MC.ui.slider({ label: t('Ancho de la calle', 'Gutter width'), min: 0, max: 0.15, step: 0.002, value: f.gutter || 0, fmt: (v) => (v * 100).toFixed(1) + ' %', onInput: (v) => { f.gutter = v; touch(); }, onChange: commit }),
          colorIn(t('Color de la calle', 'Gutter colour'), f.bg, (v) => { f.bg = v; }),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Relleno de la calle', 'Gutter fill')), MC.ui.chips([{ v: 'none', l: t('Color liso', 'Solid colour') }, { v: 'linear', l: t('Degradado lineal', 'Linear gradient') }, { v: 'radial', l: t('Degradado radial', 'Radial gradient') }], f.bgGrad || 'none', (v) => { f.bgGrad = v; commit(); })),
          f.bgGrad && f.bgGrad !== 'none' ? colorIn(t('Segundo color de la calle', 'Second gutter colour'), f.bg2, (v) => { f.bg2 = v; }) : null,
          f.bgGrad === 'linear' ? MC.ui.slider({ label: t('Ángulo del degradado', 'Gradient angle'), min: 0, max: 360, step: 5, value: f.bgAngle == null ? 90 : f.bgAngle, fmt: (v) => v + '°', onInput: (v) => { f.bgAngle = v; touch(); }, onChange: commit }) : null,
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Textura de la calle', 'Gutter texture')), MC.ui.chips(MC.FRAME_BGS.map((x) => ({ v: x.v, l: t(x.es, x.en) })), f.pattern || 'plain', (v) => { f.pattern = v; commit(); })),
          f.pattern && f.pattern !== 'plain' ? colorIn(t('Color de la textura', 'Texture colour'), f.patColor, (v) => { f.patColor = v; }) : null,
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Forma de la viñeta', 'Panel shape')), MC.ui.chips(MC.FRAME_SHAPES.map((x) => ({ v: x.v, l: t(x.es, x.en) })), f.shape || 'rect', (v) => { f.shape = v; commit(); })),
          !['circle', 'burst', 'wave'].includes(f.shape || 'rect') ? MC.ui.slider({ label: t('Esquinas redondeadas', 'Rounded corners'), min: 0, max: 0.5, step: 0.01, value: f.radius || 0, fmt: (v) => (v ? Math.round(v * 200) + ' %' : t('rectas', 'sharp')), onInput: (v) => { f.radius = v; touch(); }, onChange: commit }) : null,
          shapeAmt ? MC.ui.slider({ label: t('Intensidad de la forma', 'Shape amount'), min: 0, max: 1, step: 0.01, value: f.amount == null ? 0.5 : f.amount, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { f.amount = v; touch(); }, onChange: commit }) : null,
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Trazo que la bordea', 'Border stroke')), MC.ui.chips(MC.FRAME_STROKES.map((x) => ({ v: x.v, l: t(x.es, x.en) })), f.style || 'solid', (v) => { f.style = v; if (v !== 'none' && !(f.width > 0)) f.width = 0.006; commit(); })),
          f.style !== 'none' ? MC.ui.slider({ label: t('Grosor del trazo', 'Stroke width'), min: 0, max: 0.03, step: 0.0005, value: f.width || 0, fmt: (v) => (v * 1000).toFixed(1) + ' ‰', onInput: (v) => { f.width = v; touch(); }, onChange: commit }) : null,
          f.style !== 'none' ? colorIn(t('Color del trazo', 'Stroke colour'), f.color, (v) => { f.color = v; }) : null,
          f.style !== 'none' ? h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Relleno del trazo', 'Stroke fill')), MC.ui.chips([{ v: 'none', l: t('Color liso', 'Solid colour') }, { v: 'linear', l: t('Degradado', 'Gradient') }], f.strokeGrad || 'none', (v) => { f.strokeGrad = v; commit(); })) : null,
          f.style !== 'none' && f.strokeGrad === 'linear' ? colorIn(t('Segundo color del trazo', 'Second stroke colour'), f.color2, (v) => { f.color2 = v; }) : null,
          f.style !== 'none' && f.strokeGrad === 'linear' ? MC.ui.slider({ label: t('Ángulo del degradado del trazo', 'Stroke gradient angle'), min: 0, max: 360, step: 5, value: f.strokeAngle == null ? 0 : f.strokeAngle, fmt: (v) => v + '°', onInput: (v) => { f.strokeAngle = v; touch(); }, onChange: commit }) : null,
          MC.ui.slider({ label: t('Sombra de la viñeta', 'Panel shadow'), min: 0, max: 1, step: 0.01, value: f.shadow || 0, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { f.shadow = v; touch(); }, onChange: commit }),
          f.shadow > 0 ? colorIn(t('Color de la sombra', 'Shadow colour'), f.shadowColor, (v) => { f.shadowColor = v; }) : null,
          f.shadow > 0 ? MC.ui.slider({ label: t('Desenfoque de la sombra', 'Shadow blur'), min: 0, max: 1, step: 0.01, value: f.shadowBlur || 0, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { f.shadowBlur = v; touch(); }, onChange: commit }) : null,
          f.shadow > 0 ? MC.ui.slider({ label: t('Dirección de la sombra', 'Shadow direction'), min: 0, max: 360, step: 5, value: f.shadowAngle == null ? 45 : f.shadowAngle, fmt: (v) => v + '°', onInput: (v) => { f.shadowAngle = v; touch(); }, onChange: commit }) : null,
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
          animSlider(ovx, { prop: 'x', es: 'Posición X', en: 'Position X', min: -1, max: 1, step: 0.005, fmt: (v) => v.toFixed(3), mode: 'add', base: () => ovx.x || 0, set: (v) => set('x', v), start: () => ovx.start, dur: () => ovx.dur }),
          animSlider(ovx, { prop: 'y', es: 'Posición Y', en: 'Position Y', min: -1, max: 1, step: 0.005, fmt: (v) => v.toFixed(3), mode: 'add', base: () => ovx.y || 0, set: (v) => set('y', v), start: () => ovx.start, dur: () => ovx.dur }),
          animSlider(ovx, { prop: 'sc', es: 'Tamaño', en: 'Size', min: 0.05, max: 4, step: 0.01, fmt: (v) => '×' + v.toFixed(2), mode: 'mul', base: () => (ovx.scale == null ? 1 : ovx.scale), set: (v) => set('scale', v), start: () => ovx.start, dur: () => ovx.dur }),
          animSlider(ovx, { prop: 'rot', es: 'Giro', en: 'Rotation', min: -180, max: 180, step: 0.5, fmt: (v) => v.toFixed(1) + '°', mode: 'add', base: () => ovx.rot || 0, set: (v) => set('rot', v), start: () => ovx.start, dur: () => ovx.dur }),
          animSlider(ovx, { prop: 'op', es: 'Opacidad', en: 'Opacity', min: 0, max: 1, step: 0.01, fmt: (v) => Math.round(v * 100) + ' %', mode: 'mul', base: () => (ovx.opacity == null ? 1 : ovx.opacity), set: (v) => set('opacity', v), start: () => ovx.start, dur: () => ovx.dur }),
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
          return [h('div', { class: 'field' }, h('span', { class: 'cap' }, label), (() => { const ch = MC.ui.chips(list.map((q) => ({ v: q.v, l: t(q.es, q.en) })), (cur && cur.type) || '', (v) => { hoverStop(); const a = ensure(); a[key] = v ? Object.assign({ dur: 0.5 }, a[key] || {}, { type: v }) : null; commit(); }); [...ch.children].forEach((b, i) => { const v = list[i].v; animHover(b, it, key, () => (v ? Object.assign({ dur: 0.5 }, cur || {}, { type: v }) : null)); }); return ch; })()),
            cur && cur.type ? MC.ui.slider({ label: t('Duración de ', 'Length of ') + label.toLowerCase(), min: 0.1, max: Math.max(0.2, durOf()), step: 0.05, value: cur.dur || 0.5, fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { cur.dur = v; S.dirty = true; touch(); }, onChange: commit }) : null,
            cur && cur.type && ['left', 'right', 'up', 'down', 'drop', 'zoom'].includes(cur.type) ? MC.ui.slider({ label: t('Recorrido', 'Distance'), min: 0.2, max: 2, step: 0.05, value: cur.dist == null ? 1 : cur.dist, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => { cur.dist = v; S.dirty = true; touch(); }, onChange: commit }) : null];
        };
        const L = it.anim && it.anim.loop;
        return [].concat(part('in', MC.ANIM_IN, t('Entrada', 'Entrance')), part('out', MC.ANIM_OUT, t('Salida', 'Exit')),
          [h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Bucle (movimiento continuo)', 'Loop (continuous motion)')), (() => { const ch = MC.ui.chips(MC.ANIM_LOOP.map((q) => ({ v: q.v, l: t(q.es, q.en) })), (L && L.type) || '', (v) => { hoverStop(); const a = ensure(); a.loop = v ? Object.assign({ amp: 1, speed: 1 }, a.loop || {}, { type: v }) : null; commit(); }); [...ch.children].forEach((b, i) => { const v = MC.ANIM_LOOP[i].v; animHover(b, it, 'loop', () => (v ? Object.assign({ amp: 1, speed: 1 }, L || {}, { type: v }) : null)); }); return ch; })()),
            L && L.type ? MC.ui.slider({ label: t('Fuerza', 'Amount'), min: 0.1, max: 3, step: 0.05, value: L.amp == null ? 1 : L.amp, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => { L.amp = v; S.dirty = true; touch(); }, onChange: commit }) : null,
            L && L.type ? MC.ui.slider({ label: t('Velocidad', 'Speed'), min: 0.1, max: 4, step: 0.05, value: L.speed == null ? 1 : L.speed, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => { L.speed = v; S.dirty = true; touch(); }, onChange: commit }) : null,
            h('p', { class: 'cap' }, t('Pasa el ratón por encima de una opción (o enfócala con Tab, o mantenla pulsada en táctil) para verla en el visor antes de aplicarla; haz clic para aplicarla.', 'Hover over an option (or focus it with Tab, or long-press on touch) to see it in the viewer before applying it; click to apply it.'))]);
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
          h('p', { class: 'cap' }, t('El límite de desplazamiento por parallax está ahora en la pestaña Parallax.', 'The parallax travel limit is now in the Parallax tab.'))];
      };
      /* parallax de una sola capa: cuánto se mueve con la cámara en cada eje, con el zoom y con el giro */
      const pxNodes = (l2) => {
        const P = l2.px || {}, setP = (k, v) => { l2.px = Object.assign({}, l2.px, { [k]: v }); S.dirty = true; touch(); }, I = MC.PARALLAX[S.project.parallax] || 1;
        const f0 = 1 + (l2.z - 0.5) * I * 0.8, kx = P.x == null ? 1 : P.x, ky = P.y == null ? 1 : P.y;
        const PRS = [['normal', t('Normal', 'Normal'), null], ['fixed', t('Fija (sin parallax)', 'Fixed (no parallax)'), { x: 0, y: 0, zoom: 0, rot: 0 }], ['double', t('Doble', 'Double'), { x: 2, y: 2, zoom: 1.5 }], ['inv', t('Al revés', 'Reversed'), { x: -1, y: -1 }], ['horiz', t('Solo horizontal', 'Horizontal only'), { x: 1, y: 0 }], ['vert', t('Solo vertical', 'Vertical only'), { x: 0, y: 1 }]];
        const cur = PRS.find((q) => (q[2] == null ? !l2.px || !Object.keys(l2.px).length : ['x', 'y', 'zoom', 'rot'].every((k) => (P[k] == null ? (k === 'x' || k === 'y' || k === 'zoom' || k === 'rot' ? 1 : 0) : P[k]) === (q[2][k] == null ? 1 : q[2][k])) && !P.off));
        const sl = (key, label, min, max, step, def, fmt) => MC.ui.slider({ label, min, max, step, value: P[key] == null ? def : P[key], fmt, onInput: (v) => setP(key, v), onChange: commit });
        const ax = (v) => (v === 0 ? t('fija', 'fixed') : '×' + v.toFixed(2));
        return [h('p', { class: 'cap' }, t('Con la cámara en movimiento, esta capa se desplaza según su profundidad (z ' + l2.z.toFixed(2) + ') y la intensidad del proyecto. Aquí lo afinas solo para esta capa. Se ve al reproducir o al mover el cabezal.', 'With the camera moving, this layer shifts according to its depth (z ' + l2.z.toFixed(2) + ') and the project intensity. Here you fine-tune it for this layer only. You see it when playing or moving the playhead.')),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Ajustes rápidos', 'Quick settings')), MC.ui.chips(PRS.map((q) => ({ v: q[0], l: q[1] })), cur ? cur[0] : '', (v) => { const q = PRS.find((z) => z[0] === v); if (q[2]) l2.px = Object.assign({}, q[2]); else delete l2.px; commit(); })),
          sl('x', t('Desplazamiento horizontal', 'Horizontal travel'), -2, 3, 0.05, 1, ax), sl('y', t('Desplazamiento vertical', 'Vertical travel'), -2, 3, 0.05, 1, ax),
          sl('zoom', t('Respuesta al zoom', 'Zoom response'), 0, 3, 0.05, 1, ax), sl('rot', t('Respuesta al giro de la cámara', 'Camera rotation response'), 0, 2, 0.05, 1, ax),
          sl('off', t('Empuje extra', 'Extra push'), -1, 1, 0.02, 0, (v) => (v > 0 ? '+' : '') + v.toFixed(2)),
          MC.ui.slider({ label: t('Límite de desplazamiento', 'Travel limit'), min: 0, max: 0.2, step: 0.005, value: l2.maxShift || 0, fmt: (v) => (v === 0 ? t('sin límite', 'no limit') : (v * 100).toFixed(1) + ' %'), onInput: (v) => { l2.maxShift = v; S.dirty = true; touch(); }, onChange: commit }),
          h('p', { class: 'cap' }, t('Con la cámara a 10 % de desplazamiento, esta capa se mueve ' + (Math.abs(f0 * kx) * 10).toFixed(1) + ' % en horizontal y ' + (Math.abs(f0 * ky) * 10).toFixed(1) + ' % en vertical' + (kx < 0 || ky < 0 ? ' (en sentido contrario)' : '') + '.', 'With the camera shifting 10 %, this layer moves ' + (Math.abs(f0 * kx) * 10).toFixed(1) + ' % horizontally and ' + (Math.abs(f0 * ky) * 10).toFixed(1) + ' % vertically' + (kx < 0 || ky < 0 ? ' (the opposite way)' : '') + '.')),
          l2.px && Object.keys(l2.px).length ? h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { delete l2.px; commit(); } }, t('Restablecer el parallax de esta capa', 'Reset this layer’s parallax')) : null];
      };
      const COPY_KEYS = ['look', 'shape', 'crop', 'blend', 'opacity', 'flipX', 'flipY', 'flip', 'r3', 'persp', 'anim', 'pivot'];
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
          MC.ui.slider({ label: t('Blanco y negro', 'Black and white'), min: 0, max: 1, step: 0.01, value: A.gray || 0, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => setA('gray', v), onChange: commit }),
          MC.ui.slider({ label: t('Sepia', 'Sepia'), min: 0, max: 1, step: 0.01, value: A.sepia || 0, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => setA('sepia', v), onChange: commit }),
          MC.ui.slider({ label: t('Invertir colores', 'Invert colours'), min: 0, max: 1, step: 0.01, value: A.invert || 0, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => setA('invert', v), onChange: commit }),
          MC.ui.slider({ label: t('Desenfoque', 'Blur'), min: 0, max: 40, step: 0.5, value: A.blur || 0, fmt: (v) => v + ' px', onInput: (v) => setA('blur', v), onChange: commit }),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', title: t('Copia el aspecto, la forma, el recorte, la mezcla y las animaciones de este elemento', 'Copies the styling, shape, crop, blend and animations of this element'), onClick: () => { S.styleClip = JSON.parse(JSON.stringify(COPY_KEYS.reduce((o2, k) => { if (it[k] !== undefined) o2[k] = it[k]; return o2; }, {}))); MC.toast(t('Ajustes copiados. Pégalos en otra capa o superposición.', 'Settings copied. Paste them on another layer or overlay.')); } }, MC.icon('copy', 14), t('Copiar ajustes', 'Copy settings')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !S.styleClip, onClick: () => { COPY_KEYS.forEach((k) => { delete it[k]; }); Object.assign(it, JSON.parse(JSON.stringify(S.styleClip))); commit(); MC.toast(t('Ajustes pegados', 'Settings pasted')); } }, MC.icon('layersx', 14), t('Pegar ajustes', 'Paste settings')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !MC.hasItemLook(it), onClick: () => { it.look = null; commit(); } }, t('Quitar todo el aspecto', 'Clear all styling'))));
        return nodes;
      };
      const r3Nodes = (it) => {
        const r = it.r3 || { x: 0, y: 0 }, set = (k, v) => { it.r3 = Object.assign({ x: 0, y: 0 }, it.r3 || {}, { [k]: v }); S.dirty = true; touch(); };
        const PRS = [[t('Plano', 'Flat'), 0, 0], [t('Izquierda', 'Left'), 0, -35], [t('Derecha', 'Right'), 0, 35], [t('Arriba', 'Up'), 35, 0], [t('Abajo', 'Down'), -35, 0], [t('Isométrico', 'Isometric'), 30, -35], [t('De canto', 'Edge-on'), 0, 75]];
        return [h('p', { class: 'cap' }, t('Gira la capa en el espacio, con perspectiva: X la inclina hacia delante o atrás, Y la gira como una puerta. El giro en Z es el «Giro» normal. Se puede animar con fotogramas clave y con las entradas y salidas 3D.', 'Turn the layer in space, with perspective: X tilts it forward or back, Y turns it like a door. Turning in Z is the normal “Rotation”. It can be animated with keyframes and the 3D entrances and exits.')),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Posiciones rápidas', 'Quick poses')), MC.ui.chips(PRS.map((q, i) => ({ v: i, l: q[0] })), PRS.findIndex((q) => Math.abs(q[1] - (r.x || 0)) < 0.5 && Math.abs(q[2] - (r.y || 0)) < 0.5), (i) => { it.r3 = { x: PRS[i][1], y: PRS[i][2] }; commit(); })),
          MC.ui.slider({ label: t('Giro X (adelante y atrás)', 'Turn X (forward and back)'), min: -180, max: 180, step: 1, value: r.x || 0, fmt: (v) => v + '°', onInput: (v) => set('x', v), onChange: commit }),
          MC.ui.slider({ label: t('Giro Y (como una puerta)', 'Turn Y (like a door)'), min: -180, max: 180, step: 1, value: r.y || 0, fmt: (v) => v + '°', onInput: (v) => set('y', v), onChange: commit }),
          MC.ui.slider({ label: t('Perspectiva (más baja = más exagerada)', 'Perspective (lower = stronger)'), min: 0.8, max: 5, step: 0.05, value: it.persp || 1.8, fmt: (v) => v.toFixed(2), onInput: (v) => { it.persp = v; S.dirty = true; touch(); }, onChange: commit })];
      };
      const kfNodes = (it, start, dur) => kfPanel(it, start, dur);
      const cropNodes = (it, isOv) => {
        const base = (k) => (it.crop && it.crop[k]) || 0, setC = (k, v) => { it.crop = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, it.crop, { [k]: v }); S.dirty = true; touch(); };
        const fx = isOv ? 'flip' : 'flipX', pct = (v) => Math.round(v * 100) + ' %';
        const start = isOv ? () => it.start : () => curStart() + (it.ts || 0), dur = isOv ? () => it.dur : () => (it.te == null ? shot().duration : it.te) - (it.ts || 0);
        const row = [['l', 'cl', 'Recortar izquierda', 'Crop left'], ['t', 'ct', 'Recortar arriba', 'Crop top'], ['r', 'cr', 'Recortar derecha', 'Crop right'], ['b', 'cb', 'Recortar abajo', 'Crop bottom']];
        const sl = row.map((q) => animSlider(it, { prop: q[1], es: q[2], en: q[3], min: 0, max: 0.9, step: 0.005, fmt: pct, mode: 'add', base: () => base(q[0]), set: (v) => setC(q[0], v), start, dur }));
        /* valores exactos en %, al lado de los deslizadores: se actualizan al mover el cabezal si el recorte está animado */
        const nums = row.map((q, i) => { const id = 'cn-' + MC.uid(), inp = h('input', { class: 'input', id, type: 'number', min: 0, max: 90, step: 1, value: Math.round(sl[i].getEff() * 100), style: { width: '70px' }, onChange: (e) => { const v = clamp((+e.target.value || 0) / 100, 0, 0.9); sl[i].setEff(v); } }); S.animCtl.push({ refresh: () => { if (document.activeElement !== inp) inp.value = Math.round(sl[i].getEff() * 100); } }); return h('div', { class: 'field' }, h('label', { for: id }, t(q[2].replace('Recortar ', ''), q[3].replace('Crop ', '')) + ' %'), inp); });
        const SP = it.shape || {}, setS = (k, v) => { it.shape = Object.assign({ type: 'rect', r: 0.15, bw: 0, bc: '#ffffff' }, it.shape, { [k]: v }); S.dirty = true; touch(); };
        const shapeNodes = [h('div', { class: 'eyebrow', style: { marginTop: '6px' } }, t('Forma y marco', 'Shape and frame')),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Forma', 'Shape')), MC.ui.chips([{ v: 'rect', l: t('Rectángulo', 'Rectangle') }, { v: 'round', l: t('Esquinas redondeadas', 'Rounded corners') }, { v: 'ellipse', l: t('Círculo / elipse', 'Circle / ellipse') }], SP.type || 'rect', (v) => { setS('type', v); commit(); })),
          SP.type === 'round' ? MC.ui.slider({ label: t('Redondeo', 'Roundness'), min: 0, max: 0.5, step: 0.01, value: SP.r == null ? 0.15 : SP.r, fmt: (v) => Math.round(v * 200) + ' %', onInput: (v) => setS('r', v), onChange: commit }) : null,
          MC.ui.slider({ label: t('Grosor del marco', 'Frame width'), min: 0, max: 40, step: 0.5, value: SP.bw || 0, fmt: (v) => (v ? v + ' px' : t('sin marco', 'no frame')), onInput: (v) => setS('bw', v), onChange: commit }),
          SP.bw > 0 ? h('div', { class: 'field' }, h('label', null, t('Color del marco', 'Frame colour')), h('input', { type: 'color', class: 'input', style: { padding: '2px', height: '34px', width: '90px' }, value: SP.bc || '#ffffff', onInput: (e) => setS('bc', e.target.value), onChange: commit })) : null,
          it.shape ? h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { delete it.shape; commit(); } }, t('Quitar forma y marco', 'Remove shape and frame')) : null];
        return [h('p', { class: 'cap' }, t('Recorta los bordes de la imagen o del vídeo. No se borra nada: puedes devolverlos cuando quieras. Arrastra los tiradores del recuadro en el visor, usa los deslizadores o escribe el valor; el rombo de cada lado lo anima en el tiempo.', 'Crop the edges of the image or video. Nothing is deleted: you can bring them back any time. Drag the handles of the box in the viewer, use the sliders or type the value; the diamond on each side animates it over time.')),
          sl[0], sl[1], sl[2], sl[3],
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, nums),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', 'aria-pressed': String(!!it[fx]), onClick: () => { it[fx] = !it[fx]; commit(); } }, MC.icon('flipH', 14), t('Reflejar horizontal', 'Flip horizontal')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', 'aria-pressed': String(!!it.flipY), onClick: () => { it.flipY = !it.flipY; commit(); } }, MC.icon('flipV', 14), t('Reflejar vertical', 'Flip vertical')),
            it.crop || (it.kf || []).some((q) => MC.KF_CROP.some((k) => q[k] != null)) ? h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { delete it.crop; (it.kf || []).forEach((q) => MC.KF_CROP.forEach((k) => { delete q[k]; })); it.kf = (it.kf || []).filter((q) => KFP.some((d) => q[d[0]] != null)); commit(); } }, t('Quitar recorte', 'Remove crop')) : null), ...shapeNodes];
      };
      if (tx && !tx.link) { const tsp = MC.textSpan(tx, p); textSecs.push(sec('texto_kf', t('Fotogramas clave', 'Keyframes'), kfNodes(tx, tsp.start, tsp.dur))); }
      const timeNodes = (l) => {
        const dur = sh.duration, ts = l.ts || 0, te = l.te == null ? dur : l.te, rg = layerRegions(l, sh), upd = () => { layoutClips(); S.dirty = true; touch(); };
        const nodes = [h('p', { class: 'cap' }, t('Cada capa puede aparecer y desaparecer cuando quieras dentro del plano. Con «Dividir» el cabezal parte la capa en tramos, y a cada tramo le pones otra ilustración: así cambias de gesto sin perder la posición, la escala ni la animación.', 'Each layer can appear and disappear whenever you like within the shot. “Split” cuts the layer at the playhead into parts, and each part can show a different illustration: you change gesture without losing position, scale or animation.')),
          MC.ui.slider({ label: t('Aparece en', 'Appears at'), min: 0, max: Math.max(0.2, dur), step: 0.05, value: ts, fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { l.ts = v <= 0.02 ? 0 : Math.min(round2(v), te - 0.2); upd(); }, onChange: commit }),
          MC.ui.slider({ label: t('Desaparece en', 'Disappears at'), min: 0.2, max: Math.max(0.3, dur), step: 0.05, value: te, fmt: (v) => (v >= dur - 0.02 ? t('el final del plano', 'end of shot') : v.toFixed(2) + ' s'), onInput: (v) => { l.te = v >= dur - 0.02 ? null : Math.max(round2(v), ts + 0.2); upd(); }, onChange: commit }),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !!l.locked, onClick: () => { if (!splitAt(S.time)) return; } }, MC.icon('cut', 14), t('Dividir en el cabezal', 'Split at the playhead')))];
        if (rg.length > 1) nodes.push(MC.ui.slider({ label: t('Fundido entre gestos', 'Fade between gestures'), min: 0, max: 1, step: 0.05, value: l.xf || 0, fmt: (v) => (v ? v.toFixed(2) + ' s' : t('corte seco', 'hard cut')), onInput: (v) => { l.xf = v; S.dirty = true; touch(); }, onChange: commit }));
        nodes.push(h('div', { class: 'segs', role: 'listbox', 'aria-label': t('Tramos de la capa', 'Layer parts') }, rg.map((r) => {
          const a = MC.assets.get(r.assetId);
          return h('div', { class: 'segrow' + (S.sg === r.k ? ' on' : ''), role: 'option', 'aria-selected': String(S.sg === r.k) },
            h('button', { type: 'button', class: 'segpick', onClick: () => { S.sg = r.k; setTime(curStart() + Math.min(sh.duration - 0.01, r.t0 + 0.01)); renderInspector(); renderTimeline(); } },
              a && a.thumb ? h('img', { src: a.thumb, alt: '' }) : h('i', null), h('span', null, h('b', null, t('Tramo ', 'Part ') + (r.k + 1)), h('small', null, r.t0.toFixed(2) + ' – ' + r.t1.toFixed(2) + ' s · ' + (a ? a.name : '')))),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !!l.locked, onClick: () => pickReplace(l, r.k) }, t('Reemplazar', 'Replace')),
            r.k > 0 ? h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Quitar este corte (se une con el tramo anterior)', 'Remove this cut (merges with the previous part)'), 'aria-label': t('Quitar corte', 'Remove cut'), onClick: () => { l.segs = l.segs.filter((q) => q.id !== r.seg.id); S.sg = Math.max(0, r.k - 1); commit(); } }, MC.icon('trash', 14)) : null);
        })));
        if (l.ts || l.te != null || (l.segs && l.segs.length)) nodes.push(h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { delete l.ts; l.te = null; l.segs = []; delete l.xf; S.sg = 0; commit(); } }, t('Quitar todos los cortes y tiempos', 'Remove all cuts and timing')));
        return nodes;
      };
      const layerAnimSecs = l ? [sec('capa_anim', t('Animación de la capa', 'Layer animation'), animNodes(l, () => sh.duration)), sec('capa_rig', t('Personaje: parpadeo y boca', 'Character: blink and mouth'), rigNodes(l)), sec('capa_3d', t('Giro en 3D', '3D turn'), r3Nodes(l)), sec('capa_look', t('Sombra, brillo, contorno y color', 'Shadow, glow, outline and colour'), lookNodes(l)), sec('capa_pivot', t('Pivote', 'Pivot'), pivotNodes(l)), sec('capa_px', t('Parallax de la capa', 'Layer parallax'), pxNodes(l)), sec('capa_time', t('Tiempo y gestos', 'Timing and gestures'), timeNodes(l)), sec('capa_crop', t('Recorte, forma y marco', 'Crop, shape and frame'), cropNodes(l, false)), sec('capa_kf', t('Fotogramas clave', 'Keyframes'), kfNodes(l, curStart() + (l.ts || 0), (l.te == null ? sh.duration : l.te) - (l.ts || 0)))] : [];
      const ovAnimSec = ovx ? [sec('overlay_anim', t('Animación de la superposición', 'Overlay animation'), animNodes(ovx, () => ovx.dur)), sec('overlay_3d', t('Giro en 3D', '3D turn'), r3Nodes(ovx)), sec('overlay_look', t('Sombra, brillo, contorno y color', 'Shadow, glow, outline and colour'), lookNodes(ovx)), sec('overlay_crop', t('Recorte, forma y marco', 'Crop, shape and frame'), cropNodes(ovx, true)), sec('overlay_kf', t('Fotogramas clave', 'Keyframes'), kfNodes(ovx, ovx.start, ovx.dur))] : [];

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
        sec('capa', l ? t('Capa', 'Layer') + ' · ' + l.name : t('Capa', 'Layer'), l ? capaNodes.concat([alignRow(false)]) : capaNodes), sec('proyecto', t('Formato y parallax', 'Format and parallax'), projNodes),
        sec('overlay', t('Superposición', 'Overlay') + (ovx ? ' · ' + ovx.name : ''), ovx ? ovNodes.concat([alignRow(false)]) : ovNodes), sec('multi', t('Selección múltiple', 'Multiple selection'), mNodes.length ? mNodes.concat([alignRow(true)]) : mNodes), sec('subs', t('Subtítulos', 'Subtitles') + (sbx ? ' · ' + sbx.name : ''), sbNodes), sec('marker', t('Marcador', 'Marker'), mkNodes), sec('vinetas', t('Viñetas del proyecto', 'Project panels'), vinetasNodes), sec('vineta', t('Viñeta del plano', 'Shot panel'), vinetaNodes), sec('transicion', t('Transición de entrada', 'Entry transition'), trNodes)];
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
      MC.put(el.rail, wsTabs(S.ws).map((id) => h('button', { type: 'button', role: 'tab', 'data-tab': id, 'aria-selected': String(curTab() === id), title: tabLabel(id), onClick: () => { S.tab[S.ws] = id; if (S.ws === 'montaje') { tabView(id); renderVbar(); buildSim(); fit(); } renderRail(); renderPanels(); [el.leftEl].forEach((n) => { n.classList.remove('wsfade'); void n.offsetWidth; n.classList.add('wsfade'); }); } }, MC.icon(TABS[id][0], 22), tabLabel(id))));
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
    /* línea de tiempo por pistas: panel de clips (añadir y ver lo que hay en cada pista) */
    function clipsPanel() {
      const p = S.project, ots = p.otracks, cur = ots[curVt()];
      const row = (ic, label, kind, name, onClick) => h('div', { class: 'layer', role: 'button', tabindex: '0', onClick, onKeydown: (e) => { if (e.key === 'Enter') onClick(); } }, h('span', { class: 'ln' }, MC.icon(ic, 14), ' ', h('b', null, name), h('span', { class: 'cap' }, ' · ' + kind)));
      const items = [];
      ots.forEach((tr, i) => {
        p.xshots.filter((x) => (x.xtrack || 0) === i).forEach((x) => items.push({ i, o: x.start, n: row('layersx', '', t('capa agrupada', 'grouped layer'), x.name, () => selectXs(x.id, true)) }));
        p.overlays.filter((q) => q.track === i).forEach((q) => items.push({ i, o: q.start, n: row(q.kind === 'video' ? 'film' : 'image', '', q.kind === 'video' ? t('vídeo', 'video') : t('imagen', 'image'), q.name, () => { S.ov = q.id; S.tx = null; S.cl = null; S.li = -1; S.xs = null; S.selKind = 'overlay'; setTime(q.start + 0.01); renderInspector(); renderLayers(); renderTimeline(); }) }));
        p.texts.filter((q) => q.kind !== 'sub' && (q.track || 0) === i).forEach((q) => items.push({ i, o: q.start, n: row('text', '', t('texto', 'text'), (MC.textOf(q, p) || t('(sin texto)', '(no text)')).replace(/\n/g, ' ').slice(0, 28), () => { S.tx = q.id; S.ov = null; S.cl = null; S.li = -1; S.xs = null; S.selKind = 'text'; setTime(MC.textSpan(q, p).start + 0.01); renderInspector(); renderLayers(); renderTimeline(); }) }));
      });
      return [h('div', { class: 'box' },
        h('p', { class: 'cap' }, t('Pista elegida: ', 'Picked track: ') + cur.name + t('. Elígela pulsando su nombre en la línea de tiempo. Lo que añadas aquí cae en el cabezal.', '. Pick it by clicking its name on the timeline. What you add goes at the playhead.')),
        h('button', { class: 'btn btn-p', type: 'button', onClick: () => { fileOv.dataset.track = curVt(); fileOv.click(); } }, MC.icon('plus', 15), t('Añadir imágenes o vídeos', 'Add images or videos')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => addText('box') }, MC.icon('text', 14), t('Añadir texto o bocadillo', 'Add text or bubble')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => openAssetPicker({ title: t('Capa agrupada: elige imágenes', 'Grouped layer: choose images'), onPick: (ids) => addXShots(ids, curVt(), S.time) }) }, MC.icon('layersx', 14), t('Añadir capa agrupada (parallax)', 'Add grouped layer (parallax)')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { ots.push(Object.assign(MC.newOtrack(ots.length + 1), { name: 'V' + (ots.length + 1) })); S.vt = ots.length - 1; commit(); } }, MC.icon('plus', 14), t('Añadir una pista', 'Add a track'))),
        h('div', { class: 'eyebrow' }, t('Clips del proyecto', 'Project clips')),
        items.length ? h('div', { style: { display: 'grid', gap: '2px' } }, items.sort((a, b) => b.i - a.i || a.o - b.o).map((q) => q.n)) : h('p', { class: 'cap' }, t('Aún no hay clips: importa imágenes o vídeos, o añade un texto.', 'No clips yet: import images or videos, or add a text.')),
        h('p', { class: 'cap' }, t('Las capas agrupadas reúnen varias capas con profundidad (parallax): selecciónalas para ver y ordenar sus capas en el panel Capas.', 'Grouped layers bundle several layers with depth (parallax): select one to see and reorder its layers in the Layers panel.'))];
    }
    function shotsPanel() {
      if (S.project.tl === 'free') return clipsPanel();
      const p = S.project, mode = p.mode;
      const list = h('div', { style: { display: 'grid', gap: '8px' } }, p.shots.map((sh, i) => h('div', { class: 'shotcard' + (i === S.si ? ' on' : ''), role: 'button', tabindex: '0', 'aria-label': sh.name + ', ' + sh.duration.toFixed(1) + ' s', onClick: () => selectShot(i, true), onKeydown: (e) => { if (e.key === 'Enter') selectShot(i, true); } },
        shotThumb(sh), h('div', { style: { minWidth: 0 } }, h('b', null, sh.name), h('span', { class: 'cap' }, sh.duration.toFixed(1) + ' s' + (sh.page ? ' · ' + sh.page.panels.length + t(' viñetas', ' panels') : sh.webtoon ? ' · ' + sh.webtoon.stops.length + t(' pausas', ' pauses') : ''))),
        h('div', { style: { display: 'grid' } },
          h('button', { class: 'btn btn-g', type: 'button', style: { padding: '2px', width: '26px', height: '24px' }, disabled: i === 0, title: t('Subir', 'Move up'), 'aria-label': t('Subir', 'Move up'), onClick: (e) => { e.stopPropagation(); p.shots.splice(i - 1, 0, p.shots.splice(i, 1)[0]); S.si = i - 1; commit(); } }, MC.icon('up', 14)),
          h('button', { class: 'btn btn-g', type: 'button', style: { padding: '2px', width: '26px', height: '24px' }, disabled: i === p.shots.length - 1, title: t('Bajar', 'Move down'), 'aria-label': t('Bajar', 'Move down'), onClick: (e) => { e.stopPropagation(); p.shots.splice(i + 1, 0, p.shots.splice(i, 1)[0]); S.si = i + 1; commit(); } }, MC.icon('down', 14))))));
      return [h('div', { class: 'box' }, h('button', { class: 'btn btn-p', type: 'button', onClick: () => fileShots.click() }, MC.icon('plus', 15), mode === 'page' ? t('Añadir páginas', 'Add pages') : mode === 'webtoon' ? t('Añadir una tira', 'Add a strip') : t('Añadir planos desde imágenes', 'Add shots from images')), h('p', { class: 'cap' }, t('Acepta PNG, JPEG, WebP, PSD y PDF. Selecciona uno para editarlo; arrástralo en la línea de tiempo para estirarlo.', 'Accepts PNG, JPEG, WebP, PSD and PDF. Select one to edit it; stretch it on the timeline.'))), list].concat((S.project.xshots || []).length || S.project.mode === 'free' ? [h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Planos superpuestos · ', 'Overlapping shots · ') + S.project.xshots.length), h('p', { class: 'cap' }, t('Planos que se ven a la vez que el principal, encima de él. Arrastra una imagen a una pista de la línea de tiempo o usa el botón.', 'Shots that show at the same time as the main one, on top of it. Drag an image to a timeline track or use the button.')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: addXShotFromPicker }, MC.icon('plus', 14), t('Añadir plano superpuesto', 'Add overlapping shot')),
        S.project.xshots.length ? h('div', { style: { display: 'grid', gap: '2px' } }, S.project.xshots.map((x) => h('div', { class: 'layer' + (x.id === S.xs ? ' on' : ''), role: 'button', tabindex: '0', onClick: () => selectXs(x.id, true), onKeydown: (e) => { if (e.key === 'Enter') selectXs(x.id, true); } }, h('span', { class: 'lt' }, MC.icon('layersx', 16)), h('span', { class: 'ln' }, x.name), h('span', { class: 'lz' }, MC.fmtTime(x.start))))) : null)] : []);
    }
    async function addXShotFromPicker() { await openAssetPicker({ title: t('Plano superpuesto: elige imágenes', 'Overlapping shot: choose images'), onPick: (ids) => addXShots(ids, S.project.tl === 'free' ? curVt() : 0, S.time) }); }
    /* ---------- capas agrupadas (línea de tiempo por pistas) ----------
       Agrupar: las imágenes y vídeos elegidos pasan a ser capas de una capa agrupada (la de pista más alta queda más cerca) con su tramo de tiempo.
       Desagrupar: cada capa vuelve a ser un clip suelto, en pistas consecutivas. La posición y el tamaño de cada capa se reinician al agrupar y desagrupar. */
    /* capa de ajuste: una capa agrupada sin imágenes cuyos efectos afectan a todo lo que hay debajo (en pistas más bajas) */
    function addAdjustment(track) {
      const p = S.project, x = MC.newShot(t('Capa de ajuste', 'Adjustment layer'));
      Object.assign(x, { start: r2(S.time), duration: 4, xtrack: clamp(track, 0, p.otracks.length - 1), fx: [], adj: true }); delete x.transition; MC.applyPreset(x.camera, 'none', 1);
      p.xshots.push(x); S.expand[x.id] = true; commit(); selectXs(x.id, false); S.multi = [];
      setWs('creativo'); S.tab.creativo = 'efectos'; renderRail(); renderPanels();
      MC.toast(t('Capa de ajuste creada: añade efectos en la pestaña Efectos y afectarán a todo lo que haya debajo de ella.', 'Adjustment layer created: add effects in the Effects tab and they will affect everything below it.'));
    }
    /* clip elegido al que dar una transición de entrada o de salida (línea de tiempo por pistas) */
    function freeClip() {
      const p = S.project;
      if (S.selKind === 'shot' && S.xs && xById(S.xs)) { const x = xById(S.xs); return { it: x, name: x.name, dur: x.duration }; }
      if (S.selKind === 'overlay' && S.ov && ovById(S.ov)) { const o = ovById(S.ov); return { it: o, name: o.name, dur: o.dur }; }
      if (S.selKind === 'text' && S.tx && txById(S.tx) && txById(S.tx).kind !== 'sub') { const q = txById(S.tx), sp = MC.textSpan(q, p); return { it: q, name: (MC.textOf(q, p) || t('Texto', 'Text')).slice(0, 24), dur: sp.dur }; }
      return null;
    }
    function freeTransPanel() {
      const ct = freeClip(), which = S.trw || 'tin';
      const head = h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, ct ? t('Transición de ', 'Transition of ') + ct.name : t('Transiciones', 'Transitions')),
        h('p', { class: 'cap' }, ct ? t('Elige cómo entra o sale este clip sobre lo que hay debajo. La entrada se ve al empezar el clip y la salida al terminar.', 'Choose how this clip comes in or goes out over what is below. The entry shows when the clip starts and the exit when it ends.') : t('Elige un clip en la línea de tiempo (imagen, vídeo, texto o capa agrupada) para darle una transición de entrada o de salida.', 'Pick a clip on the timeline (image, video, text or grouped layer) to give it an entry or exit transition.')));
      if (!ct) return [head];
      head.append(MC.ui.seg([{ v: 'tin', l: t('Entrada', 'Entry') }, { v: 'tout', l: t('Salida', 'Exit') }], which, (v) => { S.trw = v; renderPanels(); }, t('Entrada o salida', 'Entry or exit')));
      if (!ct.it[which]) ct.it[which] = { type: 'cut', dur: Math.min(0.6, Math.max(0.2, ct.dur / 3)) };
      const holder = { transition: ct.it[which], duration: ct.dur, name: ct.name };
      return [head, h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Tipo y ajustes', 'Type and settings')), transEditor(holder, false))];
    }
    const selectedOverlays = () => (S.multi.length > 1 ? S.multi : S.ov ? ['o:' + S.ov] : []).filter((k) => k[0] === 'o').map((k) => ovById(k.slice(2))).filter(Boolean);
    function groupSelected() {
      const p = S.project; if (p.tl !== 'free') { MC.toast(t('Agrupar solo existe en la línea de tiempo por pistas.', 'Grouping only exists in the by-tracks timeline.')); return false; }
      const list = selectedOverlays(); if (!list.length) { MC.toast(t('Elige primero imágenes o vídeos (Ctrl o Mayús + clic para elegir varios).', 'Pick images or videos first (Ctrl or Shift + click to pick several).')); return false; }
      list.sort((a, b) => a.track - b.track || p.overlays.indexOf(a) - p.overlays.indexOf(b));
      const start = Math.min(...list.map((o) => o.start)), end = Math.max(...list.map((o) => o.start + o.dur)), x = MC.newShot(list.length === 1 ? list[0].name : t('Capa agrupada', 'Grouped layer'));
      Object.assign(x, { start: r2(start), duration: r2(Math.max(0.5, end - start)), xtrack: Math.min(...list.map((o) => o.track)), fx: [] }); delete x.transition; MC.applyPreset(x.camera, 'none', 1);
      list.forEach((o, i) => { const a = MC.assets.get(o.assetId); if (!a) return; const L = MC.newLayer(a, { z: 0.5, role: '' }); L.z = list.length > 1 ? Math.round((0.15 + (0.7 * i) / (list.length - 1)) * 100) / 100 : 0.5; L.name = o.name; if (a.video) L.vloop = true; L.ts = r2(o.start - start); L.te = r2(o.start + o.dur - start); x.layers.push(L); });
      p.overlays = p.overlays.filter((o) => !list.includes(o)); p.xshots.push(x); S.multi = []; S.ov = null; S.expand[x.id] = true; commit(); selectXs(x.id, true);
      MC.toast(t('Agrupado en una capa agrupada (' + list.length + ' capas). Desplégala con la flecha ▸ y ordena sus capas en el panel Capas.', 'Grouped into one grouped layer (' + list.length + ' layers). Unfold it with the ▸ arrow and order its layers in the Layers panel.')); return true;
    }
    function ungroupSelected() {
      const p = S.project, x = S.xs && xById(S.xs); if (p.tl !== 'free' || !x) { MC.toast(t('Elige primero una capa agrupada.', 'Pick a grouped layer first.')); return false; }
      const tr0 = x.xtrack || 0; while (p.otracks.length < tr0 + x.layers.length) p.otracks.push(Object.assign(MC.newOtrack(p.otracks.length + 1), { name: 'V' + (p.otracks.length + 1) }));
      const made = []; x.layers.forEach((l, i) => { const a = MC.assets.get(l.assetId); if (!a) return; const ts = l.ts || 0, te = l.te == null ? x.duration : l.te, o = MC.newOverlay(a, { track: tr0 + i, start: r2(x.start + ts), dur: r2(Math.max(0.2, te - ts)) }); o.scale = 1; o.name = l.name || o.name; made.push(o); });
      p.xshots = p.xshots.filter((q) => q !== x); p.overlays.push(...made); S.xs = null; S.li = -1; S.multi = made.length > 1 ? made.map((o) => 'o:' + o.id) : []; S.selKind = made.length > 1 ? 'multi' : 'overlay'; S.ov = made.length ? made[made.length - 1].id : null; commit();
      MC.toast(t('Desagrupada: ' + made.length + ' clips sueltos, uno por pista.', 'Ungrouped: ' + made.length + ' loose clips, one per track.')); return true;
    }
    /* crea planos superpuestos a partir de recursos */
    async function addXShots(ids, track, at) {
      const p = S.project; let last = null, t0 = at;
      for (const id of ids) { const a = await MC.assets.load(id); if (!a) continue; const x = MC.newShot(a.name.replace(/\.[a-z0-9]+$/i, '')); const L = MC.newLayer(a, { z: 0.5, role: '' }); L.z = 0.5; if (a.video) { L.vloop = true; x.duration = clamp(Math.round(a.dur * 10) / 10, 1, 30); } else x.duration = 4; x.layers.push(L); MC.applyPreset(x.camera, 'none', 1); x.start = r2(t0); x.xtrack = p.tl === 'free' ? clamp(track, 0, p.otracks.length - 1) : clamp(track, 0, p.xtracks.length - 1); x.fx = []; delete x.transition; p.xshots.push(x); last = x; t0 += x.duration; }
      if (last) { commit(); selectXs(last.id, true); MC.toast(p.tl === 'free' ? t('Capa agrupada creada. Despliégala con la flecha ▸ para ver sus capas.', 'Grouped layer created. Unfold it with the ▸ arrow to see its layers.') : t('Plano superpuesto creado: se ve a la vez que el principal.', 'Overlapping shot created: it shows at the same time as the main one.')); }
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
        const nm = h('input', { class: 'input', value: it.name, id: 'lb-n' }), fo = h('input', { class: 'input', value: it.folder || '', id: 'lb-f', list: 'lb-fl', placeholder: t('Sin carpeta', 'No folder') }), tg = h('input', { class: 'input', value: (it.tags || []).join(', '), id: 'lb-t', placeholder: t('personaje, fondo, noche…', 'character, background, night…') }), lic = { v: it.lic || 'other' }, au = h('input', { class: 'input', value: it.author || '', id: 'lb-a', placeholder: t('Kenney, Sonniss, el nombre del autor…', 'Kenney, Sonniss, the author’s name…') });
        MC.modal(t('Editar recurso de la biblioteca', 'Edit library asset'), h('div', { style: { display: 'grid', gap: '12px' } }, MC.ui.field(t('Nombre', 'Name'), nm, 'lb-n'), MC.ui.field(t('Carpeta', 'Folder'), fo, 'lb-f'), h('datalist', { id: 'lb-fl' }, folders.map((f) => h('option', { value: f }))), MC.ui.field(t('Etiquetas (separadas por comas)', 'Tags (comma separated)'), tg, 'lb-t'), it.kind === 'audio' ? h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Licencia del sonido', 'Sound licence')), MC.ui.chips((MC.SOUND_LICENSES || []).map((q) => ({ v: q[0], l: t(q[1], q[2]) })), lic.v, (v) => { lic.v = v; MC.toast(t('Licencia: ', 'Licence: ') + MC.soundLicName(v)); })) : null, it.kind === 'audio' ? MC.ui.field(t('Autor o fuente', 'Author or source'), au, 'lb-a') : null),
          (close) => [h('button', { class: 'btn btn-s', type: 'button', onClick: close }, t('Cancelar', 'Cancel')), h('button', { class: 'btn btn-p', type: 'button', onClick: async () => { await MC.library.update(it.id, { name: nm.value.trim() || it.name, folder: fo.value.trim(), tags: tg.value.split(',').map((x) => x.trim()).filter(Boolean), lic: it.kind === 'audio' ? lic.v : it.lic, author: it.kind === 'audio' ? au.value.trim() : it.author }); close(); loadLib(); } }, t('Guardar', 'Save'))]);
      };
      const card = (it) => {
        const menu = h('div', { class: 'libact' },
          it.kind === 'audio' ? [h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => useFromLibrary(it, 'auto') }, MC.icon('plus', 13), t('Añadir al audio', 'Add to audio'))]
            : [h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => useFromLibrary(it, 'layer') }, MC.icon('layersx', 13), t('Como capa', 'As layer')), h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => useFromLibrary(it, 'overlay') }, MC.icon('image', 13), t('Superpuesto', 'As overlay'))],
          h('button', { class: 'btn btn-g btn-sm', type: 'button', title: t('Carpeta y etiquetas', 'Folder and tags'), 'aria-label': t('Editar ', 'Edit ') + it.name, onClick: () => editItem(it) }, MC.icon('gear', 13)),
          h('button', { class: 'btn btn-g btn-sm', type: 'button', title: t('Quitar de la biblioteca (no borra el archivo de tus proyectos)', 'Remove from the library (does not delete it from your projects)'), 'aria-label': t('Quitar ', 'Remove ') + it.name, onClick: async () => { await MC.library.remove(it.id); loadLib(); } }, MC.icon('trash', 13)));
        return h('div', { class: 'libcard', draggable: 'true', title: t('Arrástralo a la línea de tiempo o a las capas', 'Drag it to the timeline or the layers'), onDragstart: (e) => { e.dataTransfer.setData(MIME_ASSET, JSON.stringify([{ id: it.id, kind: it.kind }])); e.dataTransfer.effectAllowed = 'copy'; } }, it.thumb ? h('img', { class: 'lt', src: it.thumb, alt: '' }) : h('span', { class: 'lt' + (it.kind === 'audio' ? ' au' : '') }, it.kind === 'audio' ? MC.icon('note', 18) : null),
          h('div', { style: { minWidth: 0 } }, h('b', { class: 'ln' }, it.name), h('span', { class: 'cap' }, ({ image: t('imagen', 'image'), video: t('vídeo', 'video'), audio: t('audio', 'audio') })[it.kind] + (it.lic && it.lic !== 'other' && MC.soundLicName ? ' · ' + MC.soundLicName(it.lic) : '') + (it.folder ? ' · ' + it.folder : '') + ((it.tags || []).length ? ' · #' + it.tags.join(' #') : '')), menu));
      };
      return [h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Biblioteca · ', 'Library · ') + items.length),
        h('p', { class: 'cap' }, t('Tus recursos guardados para usar en cualquier proyecto: personajes, fondos, efectos de sonido… Se quedan en este equipo.', 'Your saved assets to use in any project: characters, backgrounds, sound effects… They stay on this device.')),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: () => libIn.click() }, MC.icon('upload', 14), t('Importar a la biblioteca', 'Import to the library')), h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => MC.openSoundPacks(() => { S.libLoaded = false; loadLib(); }) }, MC.icon('folder', 14), t('Packs de sonidos', 'Sound packs')), libIn),
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
    S.sbCat = 'todos';
    const subPresetGrid = (apply, current) => {
      const list = MC.SUB_PRESETS.filter((pr) => S.sbCat === 'todos' || (S.sbCat === 'favs' ? MC.fav.has('subpr', pr.v) : pr.c === S.sbCat));
      const grid = h('div', { class: 'subprs', role: 'group', 'aria-label': t('Estilos de subtítulos', 'Subtitle styles') }, list.map((pr) => {
        const cv = h('canvas', { width: 280, height: 118, 'aria-hidden': 'true' }), nW = 5, still = () => { try { MC.subPreview(cv, S.project, MC.subStyle(pr.s), null, nW * 0.4 * 0.5); } catch (e) { /* sin muestra */ } };
        still(); MC.ensureFonts().then(still);
        let raf = 0; const loop = (ts) => { try { MC.subPreview(cv, S.project, MC.subStyle(pr.s), null, ((ts / 1000) % (nW * 0.4 + 0.6))); } catch (e) { /* nada */ } raf = requestAnimationFrame(loop); };
        const btn = h('button', { type: 'button', class: 'subpr', 'aria-pressed': String(current === pr.v), title: t(pr.es, pr.en), onClick: () => apply(pr) }, cv, h('span', null, t(pr.es, pr.en)));
        btn.addEventListener('pointerenter', (e) => { if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && !reducedMotion() && !raf) raf = requestAnimationFrame(loop); });
        if (MC.touch) MC.touch.hold(btn, () => { if (!reducedMotion() && !raf) raf = requestAnimationFrame(loop); }, () => { cancelAnimationFrame(raf); raf = 0; still(); });
        btn.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); raf = 0; still(); });
        return favWrap('subpr', pr.v, btn, () => S.sbCat === 'favs');
      }));
      return h('div', { class: 'subpresets' }, MC.ui.chips(MC.SUB_CATS.concat([['favs', '★ Favoritos', '★ Favourites']]).map((c) => ({ v: c[0], l: t(c[1], c[2]) })), S.sbCat, (v) => { S.sbCat = v; renderPanels(); }), grid);
    };
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
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Alineación', 'Alignment')), MC.ui.seg([{ v: 'left', l: t('Izquierda', 'Left') }, { v: 'center', l: t('Centro', 'Centre') }, { v: 'right', l: t('Derecha', 'Right') }], st.align || 'center', (v) => setC('align', v))),
          sl('ls', t('Espacio entre letras', 'Letter spacing'), -2, 8, 0.25, (v) => v.toFixed(2)), sl('lineH', t('Espacio entre líneas', 'Line spacing'), 0.9, 1.8, 0.01, (v) => '×' + v.toFixed(2)), sl('rot', t('Inclinación', 'Tilt'), -12, 12, 0.5, (v) => v + '°'),
          sl('hs', t('Sombra dura (como en cómic)', 'Hard shadow (comic style)'), 0, 0.3, 0.01, (v) => (v === 0 ? t('sin sombra', 'none') : pc(v / 0.3))), st.hs > 0 ? col('hsColor', t('Color de la sombra dura', 'Hard shadow colour')) : null,
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!st.grad, onChange: (e) => setC('grad', e.target.checked ? ['#fff2a8', '#c98a1a'] : null) }), h('span', null, t('Texto con degradado', 'Gradient text'))),
          st.grad ? h('div', { class: 'field' }, h('label', null, t('Colores del degradado (arriba y abajo)', 'Gradient colours (top and bottom)')), h('div', { style: { display: 'flex', gap: '8px' } }, [0, 1].map((k) => h('input', { type: 'color', class: 'input', style: { padding: '2px', height: '34px', width: '70px' }, value: st.grad[k], onInput: (e) => { const g2 = st.grad.slice(); g2[k] = e.target.value; setS('grad', g2); }, onChange: commit })))) : null,
          st.bg ? [sl('bgStroke', t('Borde del fondo', 'Background border'), 0, 0.3, 0.01, (v) => (v === 0 ? t('sin borde', 'none') : pc(v / 0.3))), st.bgStroke > 0 ? col('bgStrokeColor', t('Color del borde del fondo', 'Background border colour')) : null] : null,
          st.mode === 'karaoke' ? h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Efectos de la palabra que suena', 'Spoken word effects')), h('div', { class: 'chips' }, [['hiPop', t('Salto al entrar', 'Pop in')], ['hiBounce', t('Rebote', 'Bounce')], ['hiUnder', t('Subrayado', 'Underline')], ['hiGlow', t('Brillo', 'Glow')]].map((q) => h('button', { type: 'button', class: 'chip-b', 'aria-pressed': String(!!st[q[0]]), onClick: () => setC(q[0], !st[q[0]]) }, q[1])))) : null,
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Animación de cada línea', 'Animation of each line')), MC.ui.chips([['none', t('Ninguna', 'None')], ['fade', t('Aparecer', 'Fade')], ['pop', 'Pop'], ['slide', t('Deslizar', 'Slide')], ['zoom', 'Zoom']].map((q) => ({ v: q[0], l: q[1] })), st.anim, (v) => setC('anim', v))),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Posición rápida', 'Quick position')), MC.ui.chips([['top', t('Arriba (zona segura)', 'Top (safe)')], ['mid', t('Centro', 'Middle')], ['low', t('Tercio inferior', 'Lower third')], ['safe', t('Abajo (zona segura)', 'Bottom (safe)')]].map((q) => ({ v: q[0], l: q[1] })), (() => { const y0 = it.style && it.style.y, pr = subPresets(opts().W, opts().H); return y0 == null ? 'safe' : Math.abs(y0 - pr.top) < 0.02 ? 'top' : Math.abs(y0) < 0.02 ? 'mid' : Math.abs(y0 - pr.low) < 0.02 ? 'low' : null; })(), (v) => { const y = subPresets(opts().W, opts().H)[v]; it.style = Object.assign(MC.subStyle(it.style), { y }); commit(); })),
          safeNote(it.id),
          MC.ui.slider({ label: t('Altura', 'Position'), min: -0.4, max: 0.48, step: 0.01, value: it.style && it.style.y != null ? it.style.y : MC.subY(p, opts().W, opts().H), fmt: (v) => (v >= 0 ? '↓ ' : '↑ ') + Math.abs(Math.round(v * 100)) + ' %', onInput: (v) => setS('y', v), onChange: commit }),
          sl('maxW', t('Ancho máximo', 'Maximum width'), 0.4, 0.95, 0.01, pc), sl('maxChars', t('Letras por línea', 'Letters per line'), 8, 60, 1, (v) => String(v)), sl('lines', t('Líneas a la vez', 'Lines at once'), 1, 4, 1, (v) => String(v)),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: p.subs.length < 2, onClick: () => { p.subs.forEach((q) => { if (q !== it) q.style = JSON.parse(JSON.stringify(it.style)); }); commit(); MC.toast(t('Estilo aplicado a todas las capas de subtítulos', 'Style applied to every subtitle layer')); } }, t('Aplicar a todos los subtítulos', 'Apply to all subtitles')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !st.preset, onClick: () => { MC.applySubPreset(it, st.preset); commit(); } }, MC.icon('undo', 14), t('Restablecer al estilo', 'Reset to the style')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { p.subDefault = JSON.parse(JSON.stringify(it.style)); MC.toast(t('Este estilo se usará en los nuevos subtítulos.', 'This style will be used for new subtitles.')); touch(); } }, t('Usar para los nuevos', 'Use for new ones')))));
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
    S.snd = { q: '', cat: 'todos' };
    function soundsPanel(kind) {
      let cur = null; const stopPrev = () => { if (cur) { try { cur.stop(); } catch (e) { /* parado */ } cur = null; } };
      const q = (S.snd.q || '').toLowerCase().trim(), fav = kind === 'fav', music = kind === 'music', all = MC.audio.LIBRARY.filter((it) => (fav ? MC.fav.has('snd', it.id) : (it.kind === 'music') === music));
      const cats = MC.audio.CATS.filter((c) => c[0] === 'todos' || all.some((it) => it.cat === c[0])).concat([['favs', '★ Favoritos', '★ Favourites']]);
      if (!cats.some((c) => c[0] === S.snd.cat)) S.snd.cat = 'todos';
      const shown = all.filter((it) => (fav || S.snd.cat === 'todos' || (S.snd.cat === 'favs' ? MC.fav.has('snd', it.id) : it.cat === S.snd.cat)) && (!q || (it.es + ' ' + it.en).toLowerCase().includes(q)));
      const rows = shown.map((it) => h('div', { class: 'layer sndrow', draggable: 'true', title: t('Arrástralo a la línea de tiempo', 'Drag it to the timeline'), onDragstart: (e) => { e.dataTransfer.setData(MIME_ASSET, JSON.stringify([{ lib: it.id, kind: 'audio' }])); e.dataTransfer.effectAllowed = 'copy'; } },
        MC.fav.btn('snd', it.id, () => { if (fav || S.snd.cat === 'favs') renderPanels(); }), h('span', { class: 'lt au' }, MC.icon(it.kind === 'music' ? 'note' : 'speaker', 16)), h('span', { class: 'ln' }, t(it.es, it.en)), h('span', { class: 'lz' }, it.dur.toFixed(1) + ' s'),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', 'aria-label': t('Oír ', 'Play ') + t(it.es, it.en), onClick: async () => { stopPrev(); cur = await MC.audio.preview(await MC.audio.renderLibrary(it)); } }, MC.icon('play', 12)),
        h('button', { class: 'btn btn-p btn-sm', type: 'button', 'aria-label': t('Añadir ', 'Add ') + t(it.es, it.en), onClick: async (e) => { const b2 = e.currentTarget; b2.disabled = true; const c = await addLibrarySound(it, S.time); S.cl = c.id; commit(); b2.disabled = false; } }, MC.icon('plus', 12))));
      if (fav) return shown.length ? [h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('★ Sonidos favoritos', '★ Favourite sounds')), h('div', { style: { display: 'grid', gap: '2px' } }, rows))] : [];
      return [h('div', { class: 'box' }, h('div', { class: 'big-btns' },
        h('button', { class: 'btn btn-s', type: 'button', onClick: () => { fileAudio.dataset.track = 'auto'; fileAudio.click(); } }, MC.icon('upload', 20), t('Importar audio', 'Import audio')),
        h('button', { class: 'btn btn-s', type: 'button', onClick: recordVoice }, MC.icon('mic', 20), t('Grabar locución', 'Record voice-over')),
        h('button', { class: 'btn btn-s', type: 'button', title: t('Importa un pack de sonidos libres descargado, mira dónde conseguirlos y saca los créditos', 'Import a downloaded pack of free sounds, see where to get them and get the credits'), onClick: () => MC.openSoundPacks(() => { S.libLoaded = false; loadLib(false); }) }, MC.icon('folder', 20), t('Packs y sonidos libres', 'Packs and free sounds')))),
      h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Biblioteca de sonidos · ', 'Sound library · ') + all.length), h('p', { class: 'cap' }, t('Efectos y músicas generados por código, sin licencias. Pulsa + para añadirlos donde está el cabezal, o arrástralos a la línea de tiempo.', 'Effects and music generated by code, no licences. Press + to add them at the playhead, or drag them to the timeline.')),
        h('input', { class: 'input', type: 'search', 'aria-label': t('Buscar un sonido', 'Search for a sound'), placeholder: t('Buscar: lluvia, golpe, láser…', 'Search: rain, hit, laser…'), value: S.snd.q, onInput: (e) => { S.snd.q = e.target.value; const pos = e.target.selectionStart; renderPanels(); const n = el.leftBody.querySelector('input[type=search]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } }),
        MC.ui.chips(cats.map((c) => ({ v: c[0], l: t(c[1], c[2]) })), S.snd.cat, (v) => { S.snd.cat = v; renderPanels(); }),
        shown.length ? h('div', { style: { display: 'grid', gap: '2px' } }, rows) : h('p', { class: 'cap' }, t('No hay sonidos con ese nombre.', 'No sounds match.')))];
    }
    function favsPanel() {
      const out = soundsPanel('fav').concat(transPanel(true));
      return out.length ? out : [h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Favoritos', 'Favourites')), h('p', { class: 'cap' }, t('Aquí aparece lo que marques con la estrella ★: sonidos, transiciones y estilos de subtítulos. Pasa el ratón por encima de un elemento y pulsa la estrella.', 'Whatever you mark with the star ★ shows up here: sounds, transitions and subtitle styles. Hover an item and press the star.')))];
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
    /* ---------- propiedades con pestañas (una barra arriba, una a la vez, como en CapCut) ---------- */
    const PTABS = {
      shot: [['basic', ['Básico', 'Basic'], ['plano']], ['camera', ['Cámara', 'Camera'], ['camara', 'tray', 'pagina', 'tira']], ['trans', ['Transición', 'Transition'], ['transicion']], ['panel', ['Viñeta', 'Panel'], ['vineta']]],
      layer: [['basic', ['Básico', 'Basic'], ['capa']], ['anim', ['Animación', 'Animation'], ['capa_anim', 'capa_rig', 'capa_kf']], ['time', ['Tiempo y gestos', 'Timing and gestures'], ['capa_time']], ['d3', ['3D y pivote', '3D and pivot'], ['capa_3d', 'capa_pivot']], ['px', ['Parallax', 'Parallax'], ['capa_px']], ['crop', ['Recorte', 'Crop'], ['capa_crop']], ['look', ['Aspecto', 'Look'], ['capa_look']]],
      text: [['basic', ['Texto', 'Text'], ['texto']], ['anim', ['Animación', 'Animation'], ['texto_kf']]],
      clip: [['basic', ['Básico', 'Basic'], ['audio']], ['vol', ['Volumen y fundidos', 'Volume and fades'], ['audio_vol']]],
      overlay: [['basic', ['Básico', 'Basic'], ['overlay']], ['anim', ['Animación', 'Animation'], ['overlay_anim', 'overlay_kf']], ['d3', ['3D', '3D'], ['overlay_3d']], ['crop', ['Recorte', 'Crop'], ['overlay_crop']], ['look', ['Aspecto', 'Look'], ['overlay_look']]],
    };
    S.autoKf = MC.store.get('autokf', '') === '1';
    S.alignOn = MC.store.get('alignon', '1') !== '0';
    S.rowK = clamp(+MC.store.get('tlrow', '1') || 1, 0.6, 2.6);
    S.ptab = (() => { try { return JSON.parse(MC.store.get('ptab', '{}')) || {}; } catch (e) { return {}; } })();
    function setPtab(kind, id, keepScroll) { S.ptab[kind] = id; MC.store.set('ptab', JSON.stringify(S.ptab)); if (!keepScroll) el.inspBody.scrollTop = 0; renderPanels(); if (!keepScroll) el.inspBody.scrollTop = 0; }
    function tabbedInspector(kind, DP) {
      const defs = PTABS[kind]; if (!defs) return null;
      const tabs = defs.map((q) => ({ id: q[0], lab: t(q[1][0], q[1][1]), secs: q[2].map((i) => (i === 'transicion' && S.si < 1 ? null : DP[i])).filter(Boolean) })).filter((q) => q.secs.length);
      if (tabs.length < 2) return null;
      let k = tabs.findIndex((q) => q.id === S.ptab[kind]); if (k < 0) k = 0;
      const act = tabs[k], go = (d) => { const n = tabs[clamp(k + d, 0, tabs.length - 1)]; if (n && n !== act) { setPtab(kind, n.id); setTimeout(() => { const b = el.inspBody.querySelector('.ptab[aria-selected="true"]'); if (b) b.scrollIntoView({ inline: 'center', block: 'nearest' }); }, 0); } };
      const bar = h('div', { class: 'ptabs' },
        h('button', { class: 'ptnav', type: 'button', disabled: k === 0, 'aria-label': t('Pestaña anterior', 'Previous tab'), onClick: () => go(-1) }, MC.icon('back', 16)),
        h('div', { class: 'ptabs-scroll', role: 'tablist', 'aria-label': t('Secciones de las propiedades', 'Property sections'), onKeydown: (e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); const d = e.key === 'ArrowRight' ? 1 : -1, n = tabs[clamp(k + d, 0, tabs.length - 1)]; if (n !== act) { setPtab(kind, n.id); setTimeout(() => { const b = el.inspBody.querySelector('.ptab[aria-selected="true"]'); if (b) b.focus(); }, 0); } }
        } }, tabs.map((q) => h('button', { class: 'ptab', type: 'button', role: 'tab', id: 'pt-' + q.id, 'aria-selected': String(q === act), 'aria-controls': 'ptp', tabindex: q === act ? '0' : '-1', onClick: () => setPtab(kind, q.id) }, q.lab))),
        h('button', { class: 'ptnav', type: 'button', disabled: k === tabs.length - 1, 'aria-label': t('Pestaña siguiente', 'Next tab'), onClick: () => go(1) }, MC.icon('chevron', 16)));
      const single = act.secs.length === 1;
      const body = h('div', { id: 'ptp', role: 'tabpanel', 'aria-labelledby': 'pt-' + act.id, class: 'ptp' }, act.secs.map((d) => (single ? h('div', { class: 'sec bare', 'data-id': d.id, 'data-open': 'true' }, MC.HELP.has(d.id) ? h('div', { class: 'bhq' }, h('span', { class: 'cap' }, d.title), MC.helpBtn(d.id)) : null, h('div', { class: 'sb' }, d.nodes)) : secDom(d))));
      /* deslizar con el dedo a izquierda o derecha pasa de pestaña */
      let sw = null;
      body.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch' || e.target.closest('input, select, textarea, canvas, .seg, .chips')) { sw = null; return; } sw = { x: e.clientX, y: e.clientY }; });
      body.addEventListener('pointerup', (e) => { if (!sw) return; const dx = (e.clientX - sw.x) / MC.uz(), dy = (e.clientY - sw.y) / MC.uz(); sw = null; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) go(dx < 0 ? 1 : -1); });
      return { bar, body };
    }
    function renderPanels() {
      if (rgDefer(renderPanels)) return;
      S.animCtl = []; const DL = buildSections(), DP = buildSections(), tab = curTab();
      /* panel izquierdo */
      const L = {
        subtitulos: subsPanel, planos: shotsPanel, recursos: resourcesPanel, biblioteca: libraryPanel, vinetas: () => [boxDom(DL.vinetas)], transiciones: transPanel, curvas: graphPanel, favs: favsPanel, proyecto: () => [boxDom(DL.proyecto)], aspecto: () => [boxDom(DL.aspecto)], estilo: () => [boxDom(DL.estilo)],
        camara: () => [boxDom(DL.camara)].concat(DL.pagina ? [boxDom(DL.pagina)] : [], DL.tira ? [boxDom(DL.tira)] : [], DL.tray ? [boxDom(DL.tray)] : []),
        rack: () => [boxDom(DL.rack)].concat(DL.dof ? [boxDom(DL.dof)] : []), texto: textPanel, efectos: () => [boxDom(DL.efectos)], sfx: () => soundsPanel('sfx'), musica: () => soundsPanel('music'), mezclador: () => [boxDom(DL.mezcla)], idiomas: () => [boxDom(DL.idiomas)],
      };
      if (tab) { const lt = el.leftBody.scrollTop; el.leftTitle.textContent = tabLabel(tab); MC.put(MC.clear(el.leftBody), L[tab] ? L[tab]() : null); el.leftBody.scrollTop = lt; }
      /* propiedades según la selección */
      const kind = selection(), top = el.inspBody.scrollTop, sh = shot();
      const pick = { project: () => summaryPanel().map((n) => n), shot: () => [DP.plano].concat(S.si > 0 ? [DP.transicion] : [], [DP.vineta], sh.page ? [DP.pagina] : sh.webtoon ? [DP.tira] : [DP.camara, DP.tray]).filter(Boolean).map(secDom),
        layer: () => [secDom(DP.capa), secDom(DP.capa_anim), secDom(DP.capa_rig), secDom(DP.capa_3d), secDom(DP.capa_look), secDom(DP.capa_time), secDom(DP.capa_pivot), secDom(DP.capa_crop), secDom(DP.capa_kf)], text: () => (DP.texto ? [secDom(DP.texto)].concat(DP.texto_kf ? [secDom(DP.texto_kf)] : []) : []), clip: () => (DP.audio ? [secDom(DP.audio)] : []), overlay: () => [secDom(DP.overlay), secDom(DP.overlay_anim), secDom(DP.overlay_3d), secDom(DP.overlay_look), secDom(DP.overlay_crop), secDom(DP.overlay_kf)], multi: () => [secDom(DP.multi)], marker: () => [secDom(DP.marker)], subs: () => [secDom(DP.subs)], fx: () => [secDom(DP.efecto)], panel: () => [secDom(DP.pagina_sel)], stop: () => [secDom(DP.tira_sel)] };
      el.propsTitle.textContent = { project: t('Resumen', 'Summary'), shot: S.project.tl === 'free' && S.xs ? t('Propiedades de la capa agrupada', 'Grouped layer properties') : t('Propiedades del plano', 'Shot properties'), layer: t('Propiedades de la capa', 'Layer properties'), text: t('Propiedades del texto', 'Text properties'), clip: t('Propiedades del audio', 'Audio properties'), overlay: t('Propiedades de la superposición', 'Overlay properties'), multi: t('Selección múltiple', 'Multiple selection'), marker: t('Marcador', 'Marker'), subs: t('Subtítulos', 'Subtitles'), fx: t('Propiedades del efecto', 'Effect properties'), panel: t('Propiedades de la viñeta', 'Panel properties'), stop: t('Propiedades de la pausa', 'Pause properties') }[kind];
      { const KH = { project: 'proyecto', shot: 'plano', layer: 'capa', text: 'texto', clip: 'audio', overlay: 'overlay', fx: 'efecto', panel: 'pagina', stop: 'tira', subs: 'subs' };
        if (MC.helpClose) MC.helpClose();
        MC.clear(el.leftHelp); if (tab && MC.HELP.has(tab)) el.leftHelp.append(MC.helpBtn(tab));
        MC.clear(el.propsHelp); if (KH[kind] && MC.HELP.has(KH[kind])) el.propsHelp.append(MC.helpBtn(KH[kind])); }
      const tabbed = tabbedInspector(kind, DP);
      MC.put(MC.clear(el.inspBody), crumbs(kind), tabbed ? tabbed.bar : null, h('div', { class: 'pbody', style: { padding: 0, overflow: 'visible' } }, tabbed ? tabbed.body : pick[kind]())); el.inspBody.scrollTop = top;
    }
    function renderInspector() { renderPanels(); }
    function buildExportPanel() {
      MC.clear(el.exportHost);
      el.exportApi = MC.openExport(exportApi(el.exportHost));
      /* créditos de los sonidos de la Biblioteca que usa el proyecto (hay que cargar antes la Biblioteca) */
      loadLib(false).then(() => { try { const cc = MC.creditsCard && MC.creditsCard(); const host = el.exportHost; if (cc && host && host.isConnected) host.append(cc); } catch (e) { /* sin créditos */ } });
    }

    /* ---------- visor ---------- */
    function renderVbar() {
      const portrait = opts().W / opts().H < 0.8, sh = shot(), edit = sh && sh.page ? 'page' : sh && sh.webtoon ? 'strip' : 'cam';
      const ovOn = [S.rulers && ['rulers', t('Reglas', 'Rulers')], S.guides && ['guides', t('Guías', 'Guides')], S.safe && ['safe', t('Zonas seguras', 'Safe zones')], S.holes && ['holes', t('Huecos', 'Gaps')], S.sim && ['sim', t('Simulador', 'Simulator')]].filter(Boolean);
      const off = (k) => { if (k === 'sim') { S.sim = null; buildSim(); } else S[k] = false; renderVbar(); S.dirty = true; };
      const chk = (key, label, disabled) => h('label', null, h('input', { type: 'checkbox', checked: !!S[key], disabled: !!disabled, onChange: (e) => { S[key] = e.target.checked; renderVbar(); S.dirty = true; } }), label);
      MC.put(MC.clear(el.vbar),
        MC.ui.seg([{ v: 'out', l: t('Salida', 'Output') }, { v: edit, l: edit === 'page' ? t('Página', 'Page') : edit === 'strip' ? t('Tira', 'Strip') : t('Cámara', 'Camera') }].concat(edit === 'cam' ? [{ v: 'depth', l: t('Profundidad', 'Depth') }] : []), S.view === 'out' || S.view === 'depth' ? S.view : edit, (v) => { S.view = v; if (v !== 'out') togglePlay(false); renderVbar(); buildSim(); fit(); }, t('Vista', 'View')),
        S.view === 'depth' ? MC.ui.seg([{ v: 'f', l: t('Frontal', 'Front') }, { v: 'iso', l: '45°' }, { v: 'side', l: t('Lado', 'Side') }, { v: 'top', l: t('Arriba', 'Top') }], S.v3.pose || 'iso', (v) => { S.v3.pose = v; Object.assign(S.v3, { f: { yaw: 0, pitch: 0 }, iso: { yaw: 38, pitch: 18 }, side: { yaw: 90, pitch: 0 }, top: { yaw: 0, pitch: 78 } }[v]); S.dirty = true; renderVbar(); }, t('Punto de vista 3D', '3D viewpoint')) : null,
        S.view === 'cam' && !(sh && sh.camera.path && sh.camera.path.custom) ? MC.ui.seg([{ v: 'from', l: t('Inicio', 'Start') }, { v: 'to', l: t('Fin', 'End') }], S.kf, (v) => { S.kf = v; S.dirty = true; renderInspector(); }, t('Fotograma clave', 'Keyframe')) : null,
        S.view === 'page' ? h('button', { class: 'btn btn-g btn-sm', type: 'button', 'aria-pressed': String(S.ptool === 'poly'), title: t('Dibujar una viñeta con vértices libres: un clic por vértice, Intro o clic en el primero para cerrar', 'Draw a free-vertex panel: one click per vertex, Enter or click the first to close'), onClick: () => { S.ptool = S.ptool === 'poly' ? 'rect' : 'poly'; S.poly = null; renderVbar(); S.dirty = true; } }, t('Polígono', 'Polygon')) : null,
        S.view === 'page' ? h('span', { class: 'status' }, S.ptool === 'poly' ? t('Un clic por vértice. Intro o clic en el primero para cerrar. Esc cancela.', 'One click per vertex. Enter or click the first to close. Esc cancels.') : t('Arrastra para mover, esquinas para cambiar, o dibuja una viñeta nueva', 'Drag to move, corners to resize, or draw a new panel')) : null,
        S.view === 'strip' ? h('span', { class: 'status' }, t('Clic en la tira para añadir una pausa; arrástrala para moverla', 'Click the strip to add a pause; drag it to move')) : null,
        S.project.langs.length > 1 ? MC.ui.seg(S.project.langs.map((l) => ({ v: l, l: l.toUpperCase() })), S.project.lang, (v) => { S.project.lang = v; commit(); }, t('Idioma del texto', 'Text language')) : null,
        h('span', { class: 'vzoom', role: 'group', 'aria-label': t('Zoom del visor', 'Viewer zoom') }, h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Alejar el visor (Ctrl + rueda)', 'Zoom the viewer out (Ctrl + wheel)'), 'aria-label': t('Alejar el visor', 'Zoom the viewer out'), onClick: () => setViewZoom(S.vz.z / 1.25) }, MC.icon('minus', 14)),
          el.zoomLbl = h('button', { class: 'btn btn-g btn-sm', type: 'button', title: t('Volver al tamaño ajustado', 'Back to fitted size'), onClick: resetViewZoom }, Math.round(S.vz.z * 100) + ' %'),
          h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Acercar el visor (Ctrl + rueda). Para moverte: rueda del ratón pulsada o Alt + arrastrar', 'Zoom the viewer in (Ctrl + wheel). To pan: middle mouse button or Alt + drag'), 'aria-label': t('Acercar el visor', 'Zoom the viewer in'), onClick: () => setViewZoom(S.vz.z * 1.25) }, MC.icon('plus', 14))),
        S.view === 'out' ? h('button', { class: 'btn btn-sm recbtn', type: 'button', 'aria-pressed': String(!!S.autoKf), title: t('Grabar fotogramas: con esto activado, todo lo que muevas, escales o gires en el visor (o con los deslizadores) crea fotogramas clave en el instante del cabezal. Si un elemento ya tiene fotogramas clave, se crean aunque esté apagado.', 'Record keyframes: when on, everything you move, scale or rotate in the viewer (or with the sliders) creates keyframes at the playhead. If an element already has keyframes, they are created even when this is off.'),
          onClick: () => { S.autoKf = !S.autoKf; MC.store.set('autokf', S.autoKf ? '1' : ''); renderVbar(); MC.announce(S.autoKf ? t('Grabando fotogramas clave', 'Recording keyframes') : t('Grabación apagada', 'Recording off')); if (S.autoKf) MC.toast(t('Grabando: mueve el cabezal y cambia posición, escala o giro; cada cambio crea un fotograma clave.', 'Recording: move the playhead and change position, scale or rotation; every change creates a keyframe.'), { ms: 6000 }); } }, h('i', { class: 'recdot', 'aria-hidden': 'true' }), t('Grabar fotogramas', 'Record keyframes')) : null,
        S.view === 'out' ? h('span', { class: 'vwrap' }, h('button', { class: 'btn btn-g btn-sm', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': String(!!S.ovMenu), title: t('Guías, zonas seguras, huecos y simulador', 'Guides, safe zones, gaps and simulator'), onClick: () => { S.ovMenu = !S.ovMenu; renderVbar(); if (S.ovMenu) setTimeout(() => { const f = el.vbar.querySelector('.tmenu input'); if (f) f.focus(); }, 0); } }, MC.icon('layersx', 14), t('Superposiciones', 'Overlays')),
          S.ovMenu ? h('div', { class: 'tmenu', role: 'menu', onKeydown: (e) => { if (e.key === 'Escape') { S.ovMenu = false; renderVbar(); } } },
            h('label', null, h('input', { type: 'checkbox', checked: S.alignOn, onChange: (e) => { S.alignOn = e.target.checked; MC.store.set('alignon', S.alignOn ? '1' : '0'); renderVbar(); } }), t('Alineación automática (Alt la desactiva)', 'Auto alignment (Alt turns it off)')),
            chk('guides', t('Guías (tercios y margen)', 'Guides (thirds and margin)')), chk('safe', t('Zonas seguras de redes', 'Social safe zones'), !portrait), chk('holes', t('Marcar huecos en rojo', 'Mark gaps in red')), chk('rulers', t('Reglas (en píxeles)', 'Rulers (in pixels)')),
            h('label', null, h('input', { type: 'checkbox', checked: !!S.sim, disabled: !portrait, onChange: (e) => { S.sim = e.target.checked ? 'tiktok' : null; renderVbar(); buildSim(); } }), t('Simulador de plataformas', 'Platform simulator')),
            S.sim ? h('div', { style: { padding: '4px 10px 8px' } }, MC.ui.seg([{ v: 'tiktok', l: 'TikTok' }, { v: 'reels', l: 'Reels' }, { v: 'shorts', l: 'Shorts' }], S.sim, (v) => { S.sim = v; buildSim(); }, t('Red social', 'Network'))) : null,
            h('button', { type: 'button', role: 'menuitem', onClick: () => { S.ovMenu = false; renderVbar(); openPlatformPreview(); } }, MC.icon('frame', 14), t('Vista previa en plataforma…', 'Platform preview…')),
            !portrait ? h('span', { class: 'cap', style: { padding: '4px 10px' } }, t('Zonas seguras y simulador son para formatos verticales.', 'Safe zones and the simulator are for vertical formats.')) : null) : null) : null,
        S.view === 'out' ? ovOn.map((q) => h('button', { class: 'tag', type: 'button', title: t('Quitar ', 'Turn off ') + q[1], onClick: () => off(q[0]) }, q[1] + ' ×')) : null,
        h('span', { style: { flex: 1 } }),
        MC.ui.seg([{ v: 'media', l: t('Media', 'Medium') }, { v: 'full', l: t('Completa', 'Full') }], S.quality, (v) => { S.quality = v; MC.store.set('pq', v); S.slow = 0; fit(); }, t('Calidad de la previsualización', 'Preview quality')));
    }
    /* vista previa en TikTok, YouTube, LinkedIn… según la proporción (copia el visor en directo) */
    function openPlatformPreview() {
      togglePlay(false); if (S.view !== 'out') { S.view = 'out'; renderVbar(); fit(); }
      MC.platforms.open({ src: () => el.canvas, ratio: S.project.ratio, time: () => S.time, dur: () => MC.totalTime(S.project), playing: () => S.playing, toggle: () => togglePlay(), seek: (sec) => setTime(Math.max(0, Math.min(MC.totalTime(S.project), sec))) });
    }
    /* Simulador: interfaz genérica de una app de vídeo vertical encima del visor, para ver qué tapa. No usa marcas ni logos. */
    function buildSim() {
      const sim = el.sim;
      MC.clear(sim);
      sim.hidden = !S.sim || S.view !== 'out';
      if (sim.hidden) return;
      sim.dataset.p = S.sim;
      const ui = MC.platforms.verticalUI(S.sim); el.simBar = ui.prog;
      MC.put(sim, ui, h('p', { class: 'sim-note' }, t('Simulación aproximada: cada app cambia sus zonas', 'Approximate simulation: each app changes its zones')));
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
      if (el.grDraw) el.grDraw();
      if (S.animCtl && S.animCtl.length) S.animCtl.forEach((c) => c.refresh());
      el.tlTime.textContent = MC.fmtTime(S.time) + ' / ' + MC.fmtTime(total);
      el.canvas.setAttribute('aria-label', t('Visor. Plano ' + (S.si + 1) + ' de ' + S.project.shots.length + ', ', 'Viewer. Shot ' + (S.si + 1) + ' of ' + S.project.shots.length + ', ') + MC.fmtTime(S.time));
      if (el.playhead) el.playhead.style.left = S.time * S.pps + 'px';
      if (el.simBar) el.simBar.style.width = (S.time / Math.max(0.1, total)) * 100 + '%';
    }
    const dprNow = () => (((el.stage && el.stage.ownerDocument.defaultView) || window).devicePixelRatio || 1) * MC.uz();
    function fit() {
      const c = el.canvas, st = el.stage, o = opts();
      const A = o.W / o.H, pw = st.clientWidth - 24, ph = st.clientHeight - 12;
      if (pw <= 0 || ph <= 0) return;
      const w = Math.min(pw, ph * A), dpr = S.quality === 'full' ? Math.min(dprNow(), 2) : Math.min(dprNow(), 1) * 0.75;
      c.style.width = w + 'px'; c.style.height = w / A + 'px';
      const cw = Math.round(w * dpr), chh = Math.round(cw / A);
      if (c.width !== cw || c.height !== chh) { c.width = cw; c.height = chh; }
      S.dpr = dpr; S.dirty = true; renderVbar(); positionSim();
    }
    const frameRect = (kf, o) => ({ cx: o.W / 2 + kf.x * o.W, cy: o.H / 2 + kf.y * o.H, hw: o.W / (2 * kf.zoom), hh: o.H / (2 * kf.zoom) });
    const camMap = (c, o) => { const k = c.width / (o.W * VIEW_W); return { k, ox: (c.width - o.W * k) / 2, oy: (c.height - o.H * k) / 2 }; };

    /* vista previa al pasar el cursor: aplica el preset a modo de prueba, reproduce el plano y lo deshace al salir */
    let hov = null;
    function hoverTag(msg) { if (!el.hovTag) return; el.hovTag.hidden = !msg; el.hovTag.textContent = msg || ''; }
    function hoverStop() {
      if (!hov) return; const h0 = hov; hov = null; clearInterval(h0.iv); clearInterval(h0.wd);
      const sh = (h0.xs && xById(h0.xs)) || S.project.shots[h0.si]; if (sh) { if (h0.cam) sh.camera = JSON.parse(h0.cam); if (h0.fxRef) sh.fx = h0.fxRef; else if (h0.fx) sh.fx = JSON.parse(h0.fx); }
      if (h0.restore) h0.restore();
      hoverTag(''); S.view = h0.view; setTime(h0.time); renderVbar(); S.dirty = true;
    }
    /* o = { label, snap(): () => restaurar, win(): [desde, hasta] } para las vistas previas de animaciones y transiciones */
    function hoverStart(kind, apply, o) {
      if (S.playing || hov || S.view === 'page' || S.view === 'strip') return; const sh = shot(); if (!sh) return;
      const st = curStart(); hov = { si: S.si, xs: S.xs, cam: kind === 'cam' ? JSON.stringify(sh.camera) : null, fx: kind === 'fx' ? JSON.stringify(sh.fx) : null, fxRef: kind === 'fx' ? sh.fx : null, time: S.time, view: S.view, node: o && o.node };
      /* si el panel se redibuja y desaparece el botón sobre el que estaba el ratón, la vista previa se cierra sola */
      hov.wd = setInterval(() => { if (hov && hov.node && !hov.node.isConnected) hoverStop(); }, 150);
      if (kind === 'anim' || kind === 'trans') {
        hov.restore = o.snap(); apply(sh, st); S.view = 'out'; const win = o.win(), t0 = performance.now(), span = Math.max(0.5, win[1] - win[0]);
        hoverTag(t('Vista previa: ', 'Preview: ') + o.label + t(' · clic para aplicar', ' · click to apply'));
        /* se mueve solo el cabezal: sin cambiar de plano ni de selección aunque la animación cruce un corte */
        const go = (x) => { S.time = clamp(x, 0, Math.max(0, MC.totalTime(S.project) - 0.001)); S.dirty = true; updateTime(); };
        hov.iv = setInterval(() => go(win[0] + (((performance.now() - t0) / 1000) % span)), 33); go(win[0]); renderVbar(); return;
      }
      apply(sh, st); S.view = 'out'; const t0 = performance.now(), from = kind === 'fx' ? clamp(S.time - st, 0, Math.max(0, sh.duration - 0.2)) : 0;
      hoverTag(t('Vista previa · clic para aplicar', 'Preview · click to apply'));
      hov.iv = setInterval(() => { const el2 = ((performance.now() - t0) / 1000); setTime(st + (kind === 'fx' ? from + (el2 % Math.max(0.5, sh.duration - from)) : el2 % sh.duration)); }, 33);
    }
    const hoverable = (node, kind, apply, o0) => {
      const o = Object.assign({ node }, o0 || {});
      node.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') hoverStart(kind, apply, o); });
      if (MC.touch) MC.touch.hold(node, () => hoverStart(kind, apply, o), hoverStop);
      node.addEventListener('pointerleave', hoverStop); node.addEventListener('pointerdown', hoverStop, true);
      /* con teclado: al enfocar con Tab se ve la vista previa; al pulsar Intro o Espacio se aplica */
      node.addEventListener('focus', () => { if (node.matches && node.matches(':focus-visible')) hoverStart(kind, apply, o); }); node.addEventListener('blur', hoverStop);
      node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') hoverStop(); }, true);
      return node;
    };
    /* en qué momento se ve una animación de entrada, salida o bucle de una capa, superposición o texto */
    function animWin(it, key, def) {
      const p = S.project, sh = shot(), st = curStart(); let a, b;
      if (sh && sh.layers.includes(it)) { a = st + (it.ts || 0); b = st + (it.te == null ? sh.duration : it.te); }
      else if (p.overlays.includes(it)) { a = it.start; b = it.start + it.dur; }
      else { const sp = MC.textSpan(it, p); a = sp.start; b = sp.start + sp.dur; }
      const d = Math.max(0.1, (def && def.dur) || 0.5);
      if (key === 'in') return [Math.max(0, a - 0.3), a + d + 0.7];
      if (key === 'out') return [Math.max(0, b - d - 0.7), b + 0.3];
      return [a, Math.min(b, a + 3.2)];
    }
    const animHover = (btn, it, key, mk) => hoverable(btn, 'anim', () => { it.anim = Object.assign({}, it.anim || {}, { [key]: mk() }); },
      { label: btn.textContent, snap: () => { const o0 = it.anim; return () => { if (o0) it.anim = o0; else delete it.anim; }; }, win: () => animWin(it, key, mk()) });
    /* zoom y desplazamiento del visor (solo para trabajar: no cambia lo que se exporta) */
    function applyViewXf() { const v = S.vz; el.canvas.style.transformOrigin = '50% 50%'; el.canvas.style.transform = v.z === 1 && !v.x && !v.y ? '' : 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.z + ')'; if (el.zoomLbl) el.zoomLbl.textContent = Math.round(v.z * 100) + ' %'; el.stage.classList.toggle('zoomed', v.z !== 1); positionSim(); }
    function setViewZoom(z, cx, cy) {
      const v = S.vz, nz = clamp(z, 0.25, 8), r = el.stage.getBoundingClientRect(), mx = ((cx == null ? r.left + r.width / 2 : cx) - (r.left + r.width / 2)) / MC.uz(), my = ((cy == null ? r.top + r.height / 2 : cy) - (r.top + r.height / 2)) / MC.uz(), k = nz / v.z;
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
    /* vista 3D de profundidad: las capas como planos en el espacio, de lejos a cerca. Se gira con el ratón (órbita); arrastrar una capa cambia su profundidad. */
    S.v3 = { yaw: 38, pitch: 18, zoom: 1 };
    const V3 = { span: 1.7 };
    function v3Project(W, H, aspect, x, y, z) {
      const v = S.v3, ya = v.yaw * Math.PI / 180, pa = v.pitch * Math.PI / 180, cy = Math.cos(ya), sy = Math.sin(ya), cx = Math.cos(pa), sx = Math.sin(pa);
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy, y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx, Dc = 3.4 / v.zoom, sc = Math.min(W / 1.5, H / (1.5 / aspect + 0.6)) * (Dc / 3.4) * 1.0, k = (Dc * sc) / Math.max(0.3, Dc - z2) * 0.86;
      return { X: W / 2 + x1 * k, Y: H / 2 - y2 * k, z: z2 };
    }
    function drawDepth(ctx, sh) {
      const c = el.canvas, W = c.width, H = c.height, d = S.dpr, o = opts(), aspect = o.W / o.H, st = getComputedStyle(document.documentElement), acc = st.getPropertyValue('--accent').trim() || '#8C7CFF', fg = st.getPropertyValue('--fg').trim() || '#fff', mu = st.getPropertyValue('--muted').trim() || '#999';
      ctx.setTransform(1, 0, 0, 1, 0, 0); const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1c1f26'); bg.addColorStop(1, '#101215'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const P = (x, y, z) => v3Project(W, H, aspect, x, y, z), zw = (l) => (clamp(l.z, 0, 1) - 0.5) * V3.span, PH = 1 / aspect;
      /* suelo con rejilla y eje de profundidad */
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = d;
      for (let q = -4; q <= 4; q++) { const a = P(q * 0.25, -PH / 2 - 0.05, -V3.span / 2 - 0.1), b2 = P(q * 0.25, -PH / 2 - 0.05, V3.span / 2 + 0.3), a2 = P(-1, -PH / 2 - 0.05, (q / 4) * (V3.span / 2 + 0.2)), b3 = P(1, -PH / 2 - 0.05, (q / 4) * (V3.span / 2 + 0.2)); ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(b2.X, b2.Y); ctx.moveTo(a2.X, a2.Y); ctx.lineTo(b3.X, b3.Y); ctx.stroke(); }
      ctx.restore();
      const items = sh.layers.map((l, i) => { const a = MC.assets.get(l.assetId); const w = 1, h = a ? Math.min(PH * 1.5, w * a.h / a.w) : PH; const pts = [[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2]].map((q) => P(q[0], q[1], zw(l))); return { l, i, a, w, h, pts, depth: P(0, 0, zw(l)).z }; }).sort((x, y) => x.depth - y.depth);
      const hit = [];
      items.forEach((q, rank) => {
        const l = q.l, a = q.a; ctx.save(); ctx.globalAlpha = l.visible === false ? 0.2 : Math.max(0.35, l.opacity == null ? 1 : l.opacity);
        if (a) { const src = a.bitmap, sw = src.videoWidth || src.width, sh2 = src.videoHeight || src.height; try { MC.texQuad(ctx, src, sw, sh2, (u, v2) => { const p2 = P((u - 0.5) * q.w, (0.5 - v2) * q.h, zw(l)); return [p2.X, p2.Y]; }, 6); } catch (e) { /* sin textura */ } }
        else { ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); q.pts.forEach((p2, k) => (k ? ctx.lineTo(p2.X, p2.Y) : ctx.moveTo(p2.X, p2.Y))); ctx.closePath(); ctx.fill(); }
        ctx.globalAlpha = 1; const sel = q.i === S.li; ctx.strokeStyle = sel ? acc : 'rgba(255,255,255,.35)'; ctx.lineWidth = (sel ? 2.5 : 1) * d; ctx.beginPath(); q.pts.forEach((p2, k) => (k ? ctx.lineTo(p2.X, p2.Y) : ctx.moveTo(p2.X, p2.Y))); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = sel ? acc : fg; ctx.font = (11 * d) + 'px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(l.name.slice(0, 18) + ' · ' + l.z.toFixed(2), q.pts[0].X, q.pts[0].Y - (4 + (rank % 3) * 14) * d);
        ctx.restore(); hit.push({ i: q.i, poly: q.pts.map((p2) => [p2.X, p2.Y]) });
      });
      S.depthHit = hit;
      /* cámara delante: pirámide hacia el plano más lejano */
      const cam = P(0, 0, V3.span / 2 + 0.55), f0 = [[-0.5, PH / 2], [0.5, PH / 2], [0.5, -PH / 2], [-0.5, -PH / 2]].map((q) => P(q[0], q[1], -V3.span / 2));
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.setLineDash([5 * d, 5 * d]); ctx.lineWidth = d; ctx.beginPath(); f0.forEach((p2) => { ctx.moveTo(cam.X, cam.Y); ctx.lineTo(p2.X, p2.Y); }); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = fg; ctx.fillRect(cam.X - 12 * d, cam.Y - 8 * d, 20 * d, 16 * d); ctx.beginPath(); ctx.moveTo(cam.X + 8 * d, cam.Y); ctx.lineTo(cam.X + 19 * d, cam.Y - 8 * d); ctx.lineTo(cam.X + 19 * d, cam.Y + 8 * d); ctx.closePath(); ctx.fill();
      ctx.fillStyle = mu; ctx.font = (12 * d) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(t('Cámara', 'Camera'), cam.X, cam.Y + 12 * d);
      const far = P(0, -PH / 2 - 0.08, -V3.span / 2), near = P(0, -PH / 2 - 0.08, V3.span / 2); ctx.fillText(t('lejos', 'far'), far.X, far.Y + 4 * d); ctx.fillText(t('cerca', 'near'), near.X, near.Y + 4 * d);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = mu; ctx.fillText(t('Arrastra el fondo para girar · rueda para acercar · arrastra una capa para moverla en profundidad', 'Drag the background to orbit · wheel to zoom · drag a layer to move it in depth'), W / 2, 10 * d);
      ctx.restore();
    }
    const i2sel = (i) => i === S.li;
    function draw() {
      const c = el.canvas; if (!c.width) return;
      const hits = [], ctx = c.getContext('2d'); S.cropBoxes = {}; const o = opts({ collect: hits, cropBoxes: S.cropBoxes }), sh = shot();
      S.hits = hits;
      if (S.safeEls) { S.safeEls = S.safeEls.filter((b) => b.isConnected); setTimeout(() => S.safeEls && S.safeEls.forEach(safeFill), 0); }
      el.empty.hidden = S.project.tl === 'free' ? !!(S.xs || S.project.overlays.length || S.project.texts.length || S.project.xshots.length) : !!(sh && sh.layers.length);
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
      if (S.view === 'out' && !S.playing) drawCropUI(ctx);
      if (S.alignGuides) drawAlignGuides(ctx);
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
      const tl = clamp(S.time - curStart(), 0, sh.duration), cam = MC.camAt(sh, tl, false);
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
        const cu2 = MC.camAt(sh, clamp(S.time - curStart(), 0, sh.duration), false), fc2 = frameRect(cu2, o);
        ctx.beginPath(); path(fc2, 0); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = lw * 0.6; ctx.stroke();
        ctx.setTransform(1, 0, 0, 1, 0, 0); return;
      }
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.rect(-ox / k, -oy / k, c.width / k, c.height / k); path(fa, act.rot); ctx.fill('evenodd'); ctx.restore();
      ctx.lineWidth = lw * 0.6; ctx.strokeStyle = 'rgba(236,238,240,.35)'; ctx.setLineDash([lw * 3, lw * 3]); ctx.strokeRect(0, 0, o.W, o.H);
      ctx.beginPath(); path(fo, oth.rot); ctx.strokeStyle = 'rgba(236,238,240,.6)'; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(fo.cx, fo.cy); ctx.lineTo(fa.cx, fa.cy); ctx.strokeStyle = acc; ctx.lineWidth = lw; ctx.stroke();
      const cur = MC.camAt(sh, clamp(S.time - curStart(), 0, sh.duration), false), fc = frameRect(cur, o);
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
    /* ---------- recorte con tiradores en el visor ---------- */
    const CROP_PROP = { l: 'cl', t: 'ct', r: 'cr', b: 'cb' };
    function cropTargetBox() {
      const T = tgt(); if (!T || (T.k !== 'layer' && T.k !== 'overlay') || S.ptab[T.k] !== 'crop' || !S.cropBoxes) return null;
      const b = S.cropBoxes[(T.k === 'layer' ? 'L' : 'O') + T.it.id]; return b ? { T, b } : null;
    }
    function cropHandles(b) {
      const m = b.m, cr = b.crop || { l: 0, t: 0, r: 0, b: 0 }, X0 = b.x + b.w * cr.l, X1 = b.x + b.w * (1 - cr.r), Y0 = b.y + b.h * cr.t, Y1 = b.y + b.h * (1 - cr.b), XM = (X0 + X1) / 2, YM = (Y0 + Y1) / 2;
      const P = (x, y) => ({ X: m.a * x + m.c * y + m.e, Y: m.b * x + m.d * y + m.f });
      return [['lt', X0, Y0], ['t', XM, Y0], ['rt', X1, Y0], ['r', X1, YM], ['rb', X1, Y1], ['b', XM, Y1], ['lb', X0, Y1], ['l', X0, YM]].map((q) => Object.assign({ h: q[0] }, P(q[1], q[2])));
    }
    function drawCropUI(ctx) {
      const cb = cropTargetBox(); if (!cb) return; const b = cb.b, m = b.m, d = S.dpr, acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8C7CFF';
      const P = (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f], quad = (x0, y0, x1, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
      const path = (q) => { ctx.beginPath(); q.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]))); ctx.closePath(); };
      const cr = b.crop || { l: 0, t: 0, r: 0, b: 0 };
      ctx.save(); ctx.setLineDash([6 * d, 5 * d]); ctx.lineWidth = d; ctx.strokeStyle = 'rgba(255,255,255,.65)'; path(quad(b.x, b.y, b.x + b.w, b.y + b.h)); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 2 * d; ctx.strokeStyle = acc; path(quad(b.x + b.w * cr.l, b.y + b.h * cr.t, b.x + b.w * (1 - cr.r), b.y + b.h * (1 - cr.b))); ctx.stroke();
      cropHandles(b).forEach((q) => { const big = q.h.length === 2 ? 6 : 5; ctx.fillStyle = '#fff'; ctx.strokeStyle = acc; ctx.lineWidth = 2 * d; ctx.beginPath(); ctx.rect(q.X - big * d, q.Y - big * d, big * 2 * d, big * 2 * d); ctx.fill(); ctx.stroke(); });
      ctx.restore();
    }
    function cropHit(p) {
      const cb = cropTargetBox(); if (!cb) return null; const r = 12 * S.dpr;
      const hs = cropHandles(cb.b).filter((q) => Math.hypot(q.X - p.x, q.Y - p.y) <= r).sort((a, z) => Math.hypot(a.X - p.x, a.Y - p.y) - Math.hypot(z.X - p.x, z.Y - p.y));
      return hs.length ? Object.assign({ cb }, hs[0]) : null;
    }
    /* escribe el valor de un lado: en el recorte base, o como fotograma clave si ese lado está animado */
    function setCropSide(T, k, v) {
      const it = T.it, prop = CROP_PROP[k], opp = { l: 'r', r: 'l', t: 'b', b: 't' }[k], oppV = ((it.crop && it.crop[opp]) || 0);
      v = clamp(v, 0, Math.min(0.9, 0.95 - oppV));
      if ((it.kf || []).some((q) => q[prop] != null)) {
        const loc = clamp(S.time - T.start, 0, T.dur), delta = v - ((it.crop && it.crop[k]) || 0); let q = it.kf.find((z) => z[prop] != null && Math.abs(z.t - loc) < 0.03);
        if (q) q[prop] = delta; else { q = { id: MC.uid(), t: round2(loc), [prop]: delta, ease: 'smooth' }; it.kf.push(q); }
      } else it.crop = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, it.crop, { [k]: v });
    }
    function cropDrag(p) {
      const D = drag, b = D.b, inv = b.m.inverse(), pt = inv.transformPoint(new DOMPoint(p.x, p.y)), fx = (pt.x - b.x) / b.w, fy = (pt.y - b.y) / b.h;
      D.h.split('').forEach((ch) => { setCropSide(D.T, ch, ch === 'l' ? fx : ch === 'r' ? 1 - fx : ch === 't' ? fy : 1 - fy); });
      updateTime();
    }
    /* interacción con el visor */
    let drag = null;
    /* ---------- zonas seguras de subtítulos y textos ----------
       Vertical (TikTok, Reels, Shorts): arriba 13 %, abajo 22 % y una columna de botones a la derecha (84 %–100 %, entre el 42 % y el 78 % de alto).
       Horizontal o cuadrado: margen del 5 % (zona de título seguro). Son valores genéricos: cada app los cambia de vez en cuando. */
    function safeRects(W, H) {
      if (W / H < 0.8) return { portrait: true, top: 0.13, bottom: 0.78, right: 0.84, rY0: 0.42, rY1: 0.78, left: 0 };
      return { portrait: false, top: 0.05, bottom: 0.95, right: 0.95, rY0: 0, rY1: 1, left: 0.05 };
    }
    /* posiciones rápidas de subtítulos y textos (desplazamiento desde el centro, en fracción del alto) según el formato */
    function subPresets(W, H) {
      const z = safeRects(W, H), pad = 0.13; /* deja sitio para unas tres líneas */
      return z.portrait ? { top: z.top + pad - 0.5, mid: 0, low: 0.2, safe: null } : { top: -0.3, mid: 0, low: 0.3, safe: null };
    }
    /* ¿el texto se sale de la zona segura en este instante? Devuelve { msg, dy, dx } o null (usa los límites del visor, así que solo vale si se ve ahora) */
    function safeCheck(id) {
      const o = opts(), hit = (S.hits || []).find((x) => x.id === id); if (!hit || !hit.bounds) return null;
      const z = safeRects(o.W, o.H), b = hit.bounds, W = o.W, H = o.H, why = [];
      let dy = 0, dx = 0;
      if (b.y0 < z.top * H) { dy = (z.top * H - b.y0) / H; why.push(z.portrait ? t('la barra superior de la app', 'the top bar of the app') : t('el margen superior', 'the top margin')); }
      if (b.y1 > z.bottom * H) { dy = -(b.y1 - z.bottom * H) / H; why.push(z.portrait ? t('el pie con el nombre y la descripción', 'the footer with the name and caption') : t('el margen inferior', 'the bottom margin')); }
      if (b.x1 > z.right * W && b.y1 > z.rY0 * H && b.y0 < z.rY1 * H) { dx = -(b.x1 - z.right * W) / W; why.push(z.portrait ? t('los botones de la derecha', 'the buttons on the right') : t('el margen derecho', 'the right margin')); }
      if (b.x0 < z.left * W) { dx = (z.left * W - b.x0) / W; why.push(t('el margen izquierdo', 'the left margin')); }
      return why.length ? { msg: why.join(t(' y ', ' and ')), dy, dx } : null;
    }
    /* El aviso se vuelve a calcular tras cada dibujo del visor (los límites del texto salen del dibujo), así que no va con retraso. */
    function safeNote(id) {
      const box = h('div', { class: 'safenote', 'data-safe': id }); box.sig = ''; (S.safeEls = S.safeEls || []).push(box); safeFill(box); return box;
    }
    function safeFill(box) {
      const id = box.dataset.safe, isLayer = !!subById(id), it = isLayer ? subById(id) : txById(id); if (!it) return;
      const sp = isLayer ? { start: it.start, dur: it.dur } : MC.textSpan(it, S.project), vis = S.time >= sp.start && S.time <= sp.start + sp.dur, r = vis ? safeCheck(id) : null;
      const sig = !vis ? 'novis' : r ? 'bad' + r.msg + r.dy.toFixed(3) + r.dx.toFixed(3) : 'ok'; if (sig === box.sig) return; box.sig = sig; box.textContent = '';
      if (!vis) { box.append(h('p', { class: 'cap' }, t('Zona segura: coloca el cabezal sobre este texto para comprobar que no se sale.', 'Safe zone: place the playhead over this text to check it stays inside.'))); return; }
      if (!r) { box.append(h('p', { class: 'cap ok' }, t('✔ Dentro de la zona segura.', '✔ Inside the safe zone.'))); return; }
      const sub = isLayer || it.kind === 'sub', canFix = true;
      const fix = () => {
        if (sub) {
          const z = safeRects(opts().W, opts().H), st = MC.subStyle(it.style), patch = {};
          if (r.dy) patch.y = (it.style && it.style.y != null ? it.style.y : MC.subY(S.project, opts().W, opts().H)) + r.dy;
          if (r.dx) patch.maxW = Math.min(st.maxW, 2 * Math.min(z.right - 0.5, 0.5 - z.left)); /* el subtítulo va centrado: se estrecha */
          it.style = Object.assign(MC.subStyle(it.style), patch);
        }
        else { if (r.dx) it.x = (it.x || 0) + r.dx; if (r.dy) it.y = (it.y || 0) + r.dy; }
        commit(); MC.announce(t('Movido a la zona segura', 'Moved to the safe zone'));
      };
      box.append(h('div', { class: 'cap warn', role: 'status' }, t('Se sale de la zona segura: invade ', 'Leaves the safe zone: it overlaps ') + r.msg + '.',
        h('div', { style: { marginTop: '6px' } }, h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: fix }, sub && !r.dy ? t('Estrechar a la zona segura', 'Narrow to the safe zone') : t('Llevar a la zona segura', 'Move to the safe zone')))));
    }
    /* ---------- alineación automática (imán del visor) y alinear / distribuir ----------
       Al arrastrar una capa, superposición o texto en el visor, sus bordes y su centro se pegan al centro del encuadre, a los bordes, a los tercios,
       a los márgenes y zonas seguras y a los bordes y centros de los demás elementos, con una línea guía. Alt la desactiva mientras arrastras. */
    const bbOfBox = (b) => {
      const cr = b.crop || { l: 0, t: 0, r: 0, b: 0 }, X0 = b.x + b.w * cr.l, X1 = b.x + b.w * (1 - cr.r), Y0 = b.y + b.h * cr.t, Y1 = b.y + b.h * (1 - cr.b), m = b.m;
      const xs = [], ys = []; [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]].forEach((q) => { xs.push(m.a * q[0] + m.c * q[1] + m.e); ys.push(m.b * q[0] + m.d * q[1] + m.f); });
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    };
    /* cajas de todo lo que se ve en el visor, en píxeles del lienzo: { key, kind, it, x0, y0, x1, y1 } */
    function viewBoxes() {
      const c = el.canvas, o = opts(), k2 = c.width / o.W, out = [], sh = shot(), p = S.project;
      Object.keys(S.cropBoxes || {}).forEach((key) => {
        const id = key.slice(1); let it = null, kind = '';
        if (key[0] === 'L') { it = sh && sh.layers.find((l) => l.id === id); kind = 'layer'; } else { it = p.overlays.find((x) => x.id === id); kind = 'overlay'; }
        if (it) out.push(Object.assign({ key, kind, it }, bbOfBox(S.cropBoxes[key])));
      });
      (S.hits || []).forEach((hh) => { const it = txById(hh.id); if (it && hh.bounds) out.push({ key: 'T' + hh.id, kind: 'text', it, x0: hh.bounds.x0 * k2, x1: hh.bounds.x1 * k2, y0: hh.bounds.y0 * k2, y1: hh.bounds.y1 * k2 }); });
      return out;
    }
    const boxOfItem = (it) => viewBoxes().find((b) => b.it === it) || null;
    function alignSnap(p) {
      const c = el.canvas; S.alignGuides = null;
      if (!S.alignOn || S.altSnap || S.view !== 'out' || !drag) return { sx: 0, sy: 0 };
      if (!drag.bb) { const me = viewBoxes().find((b) => b.it === (drag.l || drag.it)); if (!me) return { sx: 0, sy: 0 }; drag.bb = me; drag.others = viewBoxes().filter((b) => b.it !== me.it); }
      const W = c.width, H = c.height, dx = p.x - drag.p0.x, dy = p.y - drag.p0.y, bb = drag.bb, thr = 8 * (c.width / c.getBoundingClientRect().width);
      /* si el elemento ya cubre casi todo el encuadre (fondo, capas con sobreescaneo) solo se pega su centro: sus bordes siempre rondan los del encuadre */
      const cur = { x: (bb.x1 - bb.x0 >= W * 0.9) ? [(bb.x0 + bb.x1) / 2 + dx] : [bb.x0 + dx, (bb.x0 + bb.x1) / 2 + dx, bb.x1 + dx], y: (bb.y1 - bb.y0 >= H * 0.9) ? [(bb.y0 + bb.y1) / 2 + dy] : [bb.y0 + dy, (bb.y0 + bb.y1) / 2 + dy, bb.y1 + dy] };
      const tx = [[0, 'borde'], [W, 'borde'], [W / 2, 'centro'], [W / 3, 'tercio'], [(2 * W) / 3, 'tercio'], [W * 0.05, 'margen'], [W * 0.95, 'margen']], ty = [[0, 'borde'], [H, 'borde'], [H / 2, 'centro'], [H / 3, 'tercio'], [(2 * H) / 3, 'tercio'], [H * 0.05, 'margen'], [H * 0.95, 'margen']];
      if (W / H < 0.8) { tx.push([W * 0.84, 'segura']); ty.push([H * 0.13, 'segura'], [H * 0.78, 'segura']); }
      drag.others.forEach((o2) => { tx.push([o2.x0, 'otro'], [(o2.x0 + o2.x1) / 2, 'otro'], [o2.x1, 'otro']); ty.push([o2.y0, 'otro'], [(o2.y0 + o2.y1) / 2, 'otro'], [o2.y1, 'otro']); });
      const best = (cands, targets) => { let r = null; cands.forEach((cv) => targets.forEach((tg) => { const d = tg[0] - cv; const sc = Math.abs(d) + (tg[1] === 'otro' ? 3 : 0); if (Math.abs(d) <= thr && (!r || sc < r.sc)) r = { d, v: tg[0], kind: tg[1], sc }; })); return r; };
      const bx = best(cur.x, tx), by = best(cur.y, ty), g = [];
      if (bx) g.push({ axis: 'x', v: bx.v, kind: bx.kind }); if (by) g.push({ axis: 'y', v: by.v, kind: by.kind });
      S.alignGuides = g.length ? g : null;
      return { sx: bx ? bx.d : 0, sy: by ? by.d : 0 };
    }
    function drawAlignGuides(ctx) {
      const g = S.alignGuides; if (!g) return; const c = el.canvas, d = S.dpr;
      ctx.save(); ctx.strokeStyle = '#ff2d95'; ctx.lineWidth = Math.max(1, 1.5 * d); ctx.setLineDash([5 * d, 4 * d]); ctx.beginPath();
      g.forEach((q) => { if (q.axis === 'x') { ctx.moveTo(q.v, 0); ctx.lineTo(q.v, c.height); } else { ctx.moveTo(0, q.v); ctx.lineTo(c.width, q.v); } }); ctx.stroke(); ctx.restore();
    }
    /* mueve un elemento una distancia en píxeles del lienzo (como arrastrarlo): a un fotograma clave si está animado o grabando */
    function nudgeDev(it, kind, dxDev, dyDev) {
      const c = el.canvas, o = opts(); let zl = 1;
      if (kind === 'layer') { const sh = shot(), img = MC.assets.get(it.assetId), tl = clamp(S.time - curStart(), 0, sh.duration), px2 = MC.panelXf(S.project, sh, o.W, o.H); zl = MC.layerGeom(it, img, MC.camAt(sh, tl, false), o).zl * (px2 && S.view === 'out' ? px2.s : 1); }
      const fx = dxDev / c.width / zl, fy = dyDev / c.width / zl * (kind === 'layer' ? c.width / c.height : 1);
      if (kfRecOn(it, ['x', 'y'])) { const kv = kfNow(it); kfPut(it, { x: kv.x + fx, y: kv.y + fy }); } else { it.x = (it.x || 0) + fx; it.y = (it.y || 0) + fy; }
    }
    /* alinear lo seleccionado (con el encuadre o, con varios elementos, entre sí) o repartirlo con huecos iguales */
    function alignItems(edge, multi) {
      if (S.view !== 'out') { S.view = 'out'; renderVbar(); fit(); S.dirty = true; MC.toast(t('Vuelve a pulsar: antes hay que ver la salida.', 'Press again: the output has to be shown first.')); return; }
      const c = el.canvas, W = c.width, H = c.height; let items;
      if (multi) items = multiItems().map((q) => boxOfItem(q.it)).filter(Boolean);
      else { const T = tgt(); const b = T && boxOfItem(T.it); items = b ? [b] : []; }
      if (!items.length) { MC.toast(t('No hay nada visible que alinear en este instante.', 'Nothing visible to align at this moment.')); return; }
      const grp = multi ? { x0: Math.min(...items.map((b) => b.x0)), x1: Math.max(...items.map((b) => b.x1)), y0: Math.min(...items.map((b) => b.y0)), y1: Math.max(...items.map((b) => b.y1)) } : { x0: 0, x1: W, y0: 0, y1: H };
      const mv = new Map();
      if (edge === 'dh' || edge === 'dv') {
        if (items.length < 3) { MC.toast(t('Para repartir hacen falta al menos tres elementos.', 'Distributing needs at least three items.')); return; }
        const hz = edge === 'dh', a = (b) => (hz ? b.x0 : b.y0), z = (b) => (hz ? b.x1 : b.y1), sorted = items.slice().sort((p1, p2) => a(p1) - a(p2)), span = z(sorted[sorted.length - 1]) - a(sorted[0]), used = sorted.reduce((n, b) => n + (z(b) - a(b)), 0), gap = (span - used) / (sorted.length - 1);
        let pos = a(sorted[0]); sorted.forEach((b) => { mv.set(b, [hz ? pos - a(b) : 0, hz ? 0 : pos - a(b)]); pos += z(b) - a(b) + gap; });
      } else items.forEach((b) => {
        const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
        mv.set(b, [edge === 'l' ? grp.x0 - b.x0 : edge === 'c' ? (grp.x0 + grp.x1) / 2 - cx : edge === 'r' ? grp.x1 - b.x1 : 0, edge === 't' ? grp.y0 - b.y0 : edge === 'm' ? (grp.y0 + grp.y1) / 2 - cy : edge === 'b' ? grp.y1 - b.y1 : 0]);
      });
      let n = 0; mv.forEach((d, b) => { if (Math.abs(d[0]) > 0.5 || Math.abs(d[1]) > 0.5) { nudgeDev(b.it, b.kind, d[0], d[1]); n++; } });
      if (MC.learnEvent) MC.learnEvent('align'); /* cuenta aunque ya estuviera alineado */
      commit(); MC.announce(n ? t('Alineado', 'Aligned') : t('Ya estaba alineado', 'Already aligned'));
    }
    function alignRow(multi) {
      const B = (edge, es, en, glyph) => h('button', { class: 'btn btn-s btn-sm', type: 'button', title: t(es, en), 'aria-label': t(es, en), onClick: () => alignItems(edge, multi) }, glyph);
      const ref = multi ? t('entre sí', 'to each other') : t('en el encuadre', 'in the frame');
      return h('div', { class: 'field alignrow' }, h('span', { class: 'cap' }, t('Alinear ', 'Align ') + ref),
        h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
          B('l', 'Alinear a la izquierda', 'Align left', '⇤ ' + t('Izq.', 'Left')), B('c', 'Centrar en horizontal', 'Centre horizontally', '↔ ' + t('Centro', 'Centre')), B('r', 'Alinear a la derecha', 'Align right', t('Der.', 'Right') + ' ⇥'),
          B('t', 'Alinear arriba', 'Align top', '⤒ ' + t('Arriba', 'Top')), B('m', 'Centrar en vertical', 'Centre vertically', '↕ ' + t('Medio', 'Middle')), B('b', 'Alinear abajo', 'Align bottom', t('Abajo', 'Bottom') + ' ⤓'),
          multi ? [B('dh', 'Repartir en horizontal con huecos iguales', 'Distribute horizontally with equal gaps', '⇔ ' + t('Repartir H', 'Distribute H')), B('dv', 'Repartir en vertical con huecos iguales', 'Distribute vertically with equal gaps', '⇕ ' + t('Repartir V', 'Distribute V'))] : null));
    }
    /* ---------- mover en el visor con fotogramas clave ----------
       Si el elemento ya tiene fotogramas clave de esa propiedad (o está activado «Grabar fotogramas»), lo que se mueve en el visor no cambia el valor base:
       crea o actualiza UN fotograma clave en el cabezal con todos los cambios a la vez (por ejemplo X e Y juntos). */
    const KV_NEUTRAL = { x: 0, y: 0, sc: 1, rot: 0 };
    function kfSpanOf(it) {
      const sh = shot(), p = S.project;
      if (sh && sh.layers.includes(it)) return { start: curStart() + (it.ts || 0), dur: (it.te == null ? sh.duration : it.te) - (it.ts || 0) };
      if (p.overlays.includes(it)) return { start: it.start, dur: it.dur };
      const sp = MC.textSpan(it, p); return { start: sp.start, dur: sp.dur };
    }
    const kfRecOn = (it, props) => !!S.autoKf || (it.kf || []).some((q) => props.some((k) => q[k] != null));
    const kfNow = (it) => { const T = kfSpanOf(it), v = MC.kfValues(it.kf, clamp(S.time - T.start, 0, T.dur)) || {}; return { x: v.x || 0, y: v.y || 0, sc: v.sc == null ? 1 : v.sc, rot: v.rot || 0 }; };
    function kfPut(it, vals) {
      const T = kfSpanOf(it), loc = round2(clamp(S.time - T.start, 0, Math.max(0.01, T.dur))), props = Object.keys(vals); it.kf = it.kf || [];
      if (!it.kf.some((q) => props.some((k) => q[k] != null)) && loc > 0.05) { const z = { id: MC.uid(), t: 0, ease: 'smooth' }; props.forEach((k) => { z[k] = KV_NEUTRAL[k]; }); it.kf.push(z); }
      let q = it.kf.find((z) => Math.abs(z.t - loc) < 0.03);
      if (!q) { q = { id: MC.uid(), t: loc, ease: 'smooth' }; it.kf.push(q); }
      props.forEach((k) => { q[k] = vals[k]; }); S.kfid = q.id; S.kfprop = null;
    }
    /* mueve algo en X e Y: devuelve true si lo ha escrito como fotograma clave */
    function dragXY(it, x0, y0, dx, dy) {
      if (kfRecOn(it, ['x', 'y'])) { if (!drag.kv0) drag.kv0 = kfNow(it); kfPut(it, { x: drag.kv0.x + dx, y: drag.kv0.y + dy }); layoutClips(); updateTime(); return true; }
      it.x = x0 + dx; it.y = y0 + dy; return false;
    }

    function wire(c) {
      const px = (e) => { const r = c.getBoundingClientRect(), s = c.width / r.width; return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s }; };
      c.addEventListener('pointerdown', (e) => {
        if (e.button === 1 || (e.altKey && S.vz.z !== 1)) { e.preventDefault(); c.setPointerCapture(e.pointerId); drag = { m: 'vpan', x0: e.clientX, y0: e.clientY, vx: S.vz.x, vy: S.vz.y }; S.dragging = true; return; }
        const sh = shot(), o = opts(), p = px(e);
        if (!sh) return;
        if (S.view === 'out') { const ch = cropHit(p); if (ch) { e.preventDefault(); c.setPointerCapture(e.pointerId); drag = { m: 'crop', T: ch.cb.T, b: ch.cb.b, h: ch.h }; S.dragging = true; return; } }
        if (S.view === 'depth') {
          const inPoly = (poly, x, y) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { if (((poly[i][1] > y) !== (poly[j][1] > y)) && (x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0])) ins = !ins; } return ins; };
          const hit = (S.depthHit || []).slice().reverse().find((q) => inPoly(q.poly, p.x, p.y));
          if (hit && !sh.layers[hit.i].locked) {
            const l = sh.layers[hit.i]; S.li = hit.i; S.tx = null; S.cl = null; const o2 = opts(), a0 = v3Project(c.width, c.height, o2.W / o2.H, 0, 0, (l.z - 0.5) * V3.span), a1 = v3Project(c.width, c.height, o2.W / o2.H, 0, 0, (l.z - 0.5) * V3.span + 0.1);
            drag = { m: 'depthz', l, p0: p, z0: l.z, vx: a1.X - a0.X, vy: a1.Y - a0.Y }; renderLayers(); renderInspector();
          } else drag = { m: 'orbit', p0: p, yaw: S.v3.yaw, pitch: S.v3.pitch };
          c.setPointerCapture(e.pointerId); S.dragging = true; S.dirty = true;
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
          const tl = clamp(S.time - curStart(), 0, sh.duration);
          const px2 = MC.panelXf(S.project, sh, o.W, o.H);
          drag = { m: 'layer', p0: p, x0: l.x || 0, y0: l.y || 0, zl: MC.layerGeom(l, img, MC.camAt(sh, tl, false), o).zl * (px2 && S.view === 'out' ? px2.s : 1), l };
          }
        }
        if (drag) { c.setPointerCapture(e.pointerId); S.dragging = true; }
      });
      c.addEventListener('pointermove', (e) => {
        { const r0 = c.getBoundingClientRect(), s0 = c.width / r0.width; S.mouse = { x: (e.clientX - r0.left) * s0, y: (e.clientY - r0.top) * s0 }; if (S.rulers && !drag) S.dirty = true; }
        if (!drag && S.view === 'out') { const hh = cropHit({ x: (e.clientX - c.getBoundingClientRect().left) * (c.width / c.getBoundingClientRect().width), y: (e.clientY - c.getBoundingClientRect().top) * (c.width / c.getBoundingClientRect().width) }); c.style.cursor = hh ? (hh.h === 'l' || hh.h === 'r' ? 'ew-resize' : hh.h === 't' || hh.h === 'b' ? 'ns-resize' : 'nwse-resize') : ''; }
        if (!drag && S.view === 'page' && S.poly) { const M = S.pageMap, q = px(e); if (M) { S.polyCur = [clamp((q.x - M.ox) / (M.img.w * M.kp), 0, 1), clamp((q.y - M.oy) / (M.img.h * M.kp), 0, 1)]; S.dirty = true; } return; }
        if (!drag) return;
        if (drag.m === 'vpan') { S.vz.x = drag.vx + (e.clientX - drag.x0) / MC.uz(); S.vz.y = drag.vy + (e.clientY - drag.y0) / MC.uz(); applyViewXf(); return; }
        const p = px(e), sh = shot();
        if (drag.m === 'crop') { cropDrag(p); S.dirty = true; scheduleSave(); return; }
        if (drag.m === 'layer' || drag.m === 'ovmove' || drag.m === 'text') { const sn = alignSnap(p); p.x += sn.sx; p.y += sn.sy; }
        if (drag.m === 'orbit') { S.v3.yaw = drag.yaw + (p.x - drag.p0.x) * 0.35; S.v3.pitch = clamp(drag.pitch - (p.y - drag.p0.y) * 0.3, -85, 85); S.dirty = true; return; }
        if (drag.m === 'depthz') { const dx = p.x - drag.p0.x, dy = p.y - drag.p0.y, vl = Math.hypot(drag.vx, drag.vy); let dz; if (vl > 4 * S.dpr) dz = ((dx * drag.vx + dy * drag.vy) / (vl * vl)) * 0.1 / V3.span; else dz = dx / (c.width * 0.4); drag.l.z = clamp(Math.round((drag.z0 + dz) * 100) / 100, 0, 1); S.dirty = true; scheduleSave(); return; }
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
          dragXY(drag.it, drag.x0, drag.y0, (p.x - drag.p0.x) / c.width, (p.y - drag.p0.y) / c.height);
        } else if (drag.m === 'sub') {
          S.project.sub.y = clamp(drag.y0 + (p.y - drag.p0.y) / c.height, -0.3, 0.48);
        } else if (drag.m === 'tail') {
          const k2 = c.width / drag.o.W; drag.it.tail = { x: (p.x / k2 - drag.hit.cx) / drag.o.W, y: (p.y / k2 - drag.hit.cy) / drag.o.H };
        } else if (drag.m === 'ovmove') {
          dragXY(drag.it, drag.x0, drag.y0, Math.round(((p.x - drag.p0.x) / c.width) * 1000) / 1000, Math.round(((p.y - drag.p0.y) / c.height) * 1000) / 1000);
        } else if (drag.m === 'ovscale') {
          const k2 = c.width / drag.b.o_W, fx = p.x / k2, fy = p.y / k2;
          { const ratio = Math.hypot(fx - drag.b.cx, fy - drag.b.cy) / drag.d0;
            if (kfRecOn(drag.it, ['sc'])) { if (!drag.kv0) drag.kv0 = kfNow(drag.it); kfPut(drag.it, { sc: clamp(drag.kv0.sc * ratio, 0.05, 6 / Math.max(0.05, drag.s0)) }); layoutClips(); updateTime(); }
            else drag.it.scale = clamp(drag.s0 * ratio, 0.05, 6); }
        } else if (drag.m === 'ovrot') {
          const k2 = c.width / drag.b.o_W, fx = p.x / k2, fy = p.y / k2; let r = drag.a0 + ((Math.atan2(fy - drag.b.cy, fx - drag.b.cx) - drag.an0) * 180) / Math.PI;
          r = ((r + 540) % 360) - 180; const sn = Math.round(r / 15) * 15; if (Math.abs(r - sn) < 3) r = sn; r = Math.round(r * 10) / 10;
          if (kfRecOn(drag.it, ['rot'])) { if (!drag.kv0) drag.kv0 = kfNow(drag.it); kfPut(drag.it, { rot: drag.kv0.rot + (r - drag.a0) }); layoutClips(); updateTime(); } else drag.it.rot = r;
        } else if (drag.m === 'layer') {
          dragXY(drag.l, drag.x0, drag.y0, (p.x - drag.p0.x) / c.width / drag.zl, (p.y - drag.p0.y) / c.height / drag.zl);
        }
        S.dirty = true; scheduleSave();
      });
      const up = () => {
        if (!drag) return;
        if (S.alignGuides) { S.alignGuides = null; S.dirty = true; if (MC.learnEvent) MC.learnEvent('snap'); }
        if (drag.m === 'spnew') {
          const wt = shot().webtoon; if (!drag.moved) { const sp = { id: MC.uid(), y: Math.round(drag.y * 1000) / 1000, hold: 1.5, zoom: 1, x: 0 }; wt.stops.push(sp); S.sp = sp.id; }
        }
        if (drag.m && drag.m.slice(0, 2) === 'pn') {
          const pg = shot().page;
          if (drag.m === 'pnnew') { const q = drag.q; if (q.x1 - q.x0 > 0.04 && q.y1 - q.y0 > 0.03) { pg.panels.push(q); S.pn = q.id; } }
          pg.manual = true;
        }
        if (drag.m === 'vpan') { drag = null; S.dragging = false; return; }
        if (drag.m === 'orbit') { drag = null; S.dragging = false; return; }
        if (drag.m === 'depthz') { const sh0 = shot(); if (sh0) S.li = placeByZ(sh0, drag.l); }
        drag = null; S.dragging = false; commit();
      };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
      c.addEventListener('wheel', (e) => {
        if (S.view === 'depth') { e.preventDefault(); S.v3.zoom = clamp(S.v3.zoom * Math.exp(-e.deltaY * 0.0012), 0.5, 3); S.dirty = true; return; }
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); setViewZoom(S.vz.z * Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY); return; }
        const sh = shot(), f = Math.exp(-e.deltaY * 0.0012);
        if (S.view === 'cam' && sh) { const kf = sh.camera[S.kf]; kf.zoom = clamp(kf.zoom * f, 1, 4); sh.camera.preset = 'custom'; }
        else if (layer()) { const l = layer(); if (kfRecOn(l, ['sc'])) { kfPut(l, { sc: clamp(kfNow(l).sc * f, 0.1, 3) }); layoutClips(); updateTime(); } else l.scale = clamp((l.scale || 1) * f, 0.5, 3); } else return;
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
      const end = Math.max(total, ...p.clips.map((c) => c.start + c.dur), ...(p.overlays || []).map((o) => o.start + o.dur), ...(p.subs || []).map((o) => o.start + o.dur), ...(p.xshots || []).map((o) => o.start + o.duration), ...p.texts.map((x) => { const q = MC.textSpan(x, p); return q.start + q.dur; }));
      el.tlContent.style.width = Math.max(end * pps + 120, 320) + 'px';
      el.tlContent.querySelectorAll('.clip[data-i]').forEach((c) => {
        const i = +c.dataset.i, sh = p.shots[i]; if (!sh) return;
        c.style.left = starts[i] * pps + 'px'; c.style.width = Math.max(8, sh.duration * pps - 2) + 'px';
      });
      el.tlContent.querySelectorAll('.lyrbar').forEach((c) => {
        const i = +c.dataset.si, sh = p.shots[i], l = sh && sh.layers[+c.dataset.li]; if (!sh || !l) return;
        const ts = l.ts || 0, te = l.te == null ? sh.duration : l.te;
        c.style.left = (starts[i] + ts) * pps + 'px'; c.style.width = Math.max(10, (te - ts) * pps - 2) + 'px';
        const rg = layerRegions(l, sh); c.querySelectorAll('.lseg').forEach((q, k) => { const r = rg[k]; if (!r) return; q.style.left = (r.t0 - ts) * pps + 'px'; q.style.width = Math.max(4, (r.t1 - r.t0) * pps) + 'px'; });
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
      el.tlContent.querySelectorAll('.clip[data-xf]').forEach((el2) => {
        const [xid, fid] = el2.dataset.xf.split(':'), x = xById(xid), f = x && (x.fx || []).find((q) => q.id === fid); if (!f) return;
        el2.style.left = (x.start + MC.fxStart(x, f)) * pps + 'px'; el2.style.width = Math.max(8, f.dur * pps - 2) + 'px';
      });
      el.tlContent.querySelectorAll('.clip[data-xs], .clip[data-o], .clip[data-x]').forEach((el2) => {
        const it = el2.dataset.xs ? xById(el2.dataset.xs) : el2.dataset.o ? ovById(el2.dataset.o) : txById(el2.dataset.x); if (!it || S.project.tl !== 'free') return;
        el2.dataset.tin = it.tin && it.tin.type !== 'cut' ? '1' : '0'; el2.dataset.tout = it.tout && it.tout.type !== 'cut' ? '1' : '0';
      });
      el.tlContent.querySelectorAll('.clip[data-xl]').forEach((el2) => {
        const [xid, li] = el2.dataset.xl.split(':'), x = xById(xid), l = x && x.layers[+li]; if (!l) return;
        const ts = l.ts || 0, te = l.te == null ? x.duration : l.te; el2.style.left = (x.start + ts) * pps + 'px'; el2.style.width = Math.max(8, (te - ts) * pps - 2) + 'px';
      });
      el.tlContent.querySelectorAll('.clip[data-xs]').forEach((el2) => { const x = xById(el2.dataset.xs); if (!x) return; el2.style.left = x.start * pps + 'px'; el2.style.width = Math.max(8, x.duration * pps - 2) + 'px'; });
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
        if (row.dataset.k === 'kf') return; /* la fila de fotogramas clave fija su propia altura */
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
    /* ---------- imán: inicio y final de lo que mueves se pegan a bordes de otros elementos ---------- */
    S.altSnap = false;
    function snapPoints(ignore, noShots) {
      const p = S.project, pts = [0, S.time], add = (a, d) => { pts.push(a); if (d != null) pts.push(a + d); };
      if (!noShots) { const st = MC.shotStarts(p); st.forEach((x, i) => add(x, p.shots[i].duration)); }
      (p.notes || []).forEach((n) => pts.push(n.t));
      p.clips.forEach((c) => { if (c.id !== ignore) add(c.start, c.dur); });
      p.overlays.forEach((o) => { if (o.id !== ignore) add(o.start, o.dur); });
      p.texts.forEach((x) => { if (x.id !== ignore && !x.link) add(x.start, x.dur); });
      (p.xshots || []).forEach((x) => { if (x.id !== ignore) add(x.start, x.duration); });
      (p.subs || []).forEach((x) => { if (x.id !== ignore && x.dur) add(x.start, x.dur); });
      if (S.snapExtra) S.snapExtra.forEach((x) => pts.push(x));
      return pts;
    }
    const snapThr = () => (document.documentElement.dataset.touch === '1' ? 16 : 10) / MC.uz() / S.pps;
    function snapGuide(tm) {
      if (tm == null) { if (el.tlGuide) el.tlGuide.style.display = 'none'; return; }
      if (!el.tlGuide || !el.tlGuide.isConnected) { el.tlGuide = h('div', { class: 'snapguide', 'aria-hidden': 'true' }); el.tlContent.append(el.tlGuide); }
      el.tlGuide.style.display = 'block'; el.tlGuide.style.left = tm * S.pps + 'px';
    }
    /* mueve un elemento que empieza en «start» y dura «dur»: el borde que quede más cerca de otro se pega */
    function snapMove(start, dur, ignore, noShots) {
      const r2 = (v) => Math.max(0, Math.round(v * 100) / 100);
      if (!S.snapOn || S.altSnap) { snapGuide(null); return r2(start); }
      const thr = snapThr(); let best = null, hit = null;
      snapPoints(ignore, noShots).forEach((x) => {
        [[x - start, x], [x - (start + (dur || 0)), x]].forEach((q) => { if (Math.abs(q[0]) < thr && (best === null || Math.abs(q[0]) < Math.abs(best))) { best = q[0]; hit = q[1]; } });
      });
      if (best === null) { snapGuide(null); return r2(start); }
      snapGuide(hit); return r2(start + best);
    }
    /* estira un borde final: devuelve el instante final ya pegado */
    function snapEnd(end, ignore, noShots) {
      if (!S.snapOn || S.altSnap) { snapGuide(null); return end; }
      const thr = snapThr(); let best = null, hit = null;
      snapPoints(ignore, noShots).forEach((x) => { const d = x - end; if (Math.abs(d) < thr && (best === null || Math.abs(d) < Math.abs(best))) { best = d; hit = x; } });
      if (best === null) { snapGuide(null); return end; }
      snapGuide(hit); return end + best;
    }
    function snapT(tm, ignore) { return snapMove(tm, 0, ignore); }
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
      if (rgDefer(renderTimeline)) return;
      const p = S.project, total = MC.totalTime(p), pps = S.pps;
      const cs = getComputedStyle(document.documentElement); WAVE.fg = cs.getPropertyValue('--clip').trim();
      const addBtn = (tr) => h('button', { class: 'btn btn-g', type: 'button', title: t('Añadir audio a esta pista', 'Add audio to this track'), 'aria-label': t('Añadir audio a esta pista', 'Add audio to this track'), onClick: () => { fileAudio.dataset.track = tr; fileAudio.click(); } }, MC.icon('plus', 13));
      const free = p.tl === 'free', ots = p.otracks, xts = p.xtracks, kft = kfTarget(), KEYS = free ? ['subs'].concat(ots.map((q, i) => 'o' + i).reverse(), kft ? ['kf'] : [], ['voz', 'sfx', 'musica']) : ots.map((q, i) => 'o' + i).concat((p.xshots.length || S.xs ? xts.map((q, i) => 'x' + i) : []), kft ? ['kf'] : [], ['shots', 'text', 'subs', 'fxr', 'voz', 'sfx', 'musica']);
      const ovBtn = (i) => h('button', { class: 'btn btn-g', type: 'button', title: t('Añadir una imagen o un vídeo encima de la ilustración', 'Add an image or video above the artwork'), 'aria-label': t('Añadir una superposición a ', 'Add an overlay to ') + ots[i].name, onClick: () => { fileOv.dataset.track = i; fileOv.click(); } }, MC.icon('plus', 13));
      const eyeBtn = (i) => h('button', { class: 'btn btn-g', type: 'button', 'aria-pressed': String(ots[i].visible !== false), title: ots[i].visible === false ? t('Mostrar la pista', 'Show track') : t('Ocultar la pista', 'Hide track'), 'aria-label': t('Mostrar u ocultar ', 'Show or hide ') + ots[i].name, onClick: () => { ots[i].visible = ots[i].visible === false; commit(); } }, MC.icon(ots[i].visible === false ? 'eyeoff' : 'eye', 13));
      const delBtn = (i) => h('button', { class: 'btn btn-g', type: 'button', title: t('Quitar la pista vacía', 'Remove the empty track'), 'aria-label': t('Quitar ', 'Remove ') + ots[i].name, onClick: () => { p.overlays.forEach((o) => { if (o.track > i) o.track--; }); if (free) { p.xshots.forEach((x) => { if ((x.xtrack || 0) > i) x.xtrack--; }); p.texts.forEach((x) => { if ((x.track || 0) > i) x.track--; }); } ots.splice(i, 1); commit(); } }, MC.icon('trash', 13));
      const labelOf = (k) => {
        if (free && /^o\d+$/.test(k)) { const i = +k.slice(1), sel = curVt() === i; return h('div', { class: 'trl ot vt' + (sel ? ' sel' : ''), 'data-k': k, onClick: () => { S.vt = i; el.tlLabels.querySelectorAll('.vt').forEach((n) => n.classList.toggle('sel', n.dataset.k === k)); } },
          h('span', { title: t('Doble clic para renombrar · clic para elegir esta pista', 'Double-click to rename · click to pick this track'), onDblclick: () => { const v = prompt(t('Nombre de la pista', 'Track name'), ots[i].name); if (v && v.trim()) { ots[i].name = v.trim(); commit(); } } }, ots[i].name),
          h('span', { class: 'trb' }, ovBtn(i),
            h('button', { class: 'btn btn-g', type: 'button', title: t('Añadir un texto en esta pista', 'Add a text on this track'), 'aria-label': t('Añadir un texto en ', 'Add a text on ') + ots[i].name, onClick: (e) => { e.stopPropagation(); S.vt = i; addText('box'); } }, MC.icon('text', 13)),
            h('button', { class: 'btn btn-g', type: 'button', title: t('Añadir una capa agrupada en esta pista', 'Add a grouped layer on this track'), 'aria-label': t('Añadir una capa agrupada en ', 'Add a grouped layer on ') + ots[i].name, onClick: (e) => { e.stopPropagation(); openAssetPicker({ title: t('Capa agrupada: elige imágenes', 'Grouped layer: choose images'), onPick: (ids) => addXShots(ids, i, S.time) }); } }, MC.icon('layersx', 13)),
            h('button', { class: 'btn btn-g', type: 'button', title: t('Añadir una capa de ajuste (sus efectos afectan a lo de debajo)', 'Add an adjustment layer (its effects affect what is below)'), 'aria-label': t('Añadir una capa de ajuste en ', 'Add an adjustment layer on ') + ots[i].name, onClick: (e) => { e.stopPropagation(); addAdjustment(i); } }, MC.icon('sliders', 13)),
            eyeBtn(i), ots.length > 1 && !p.overlays.some((o) => o.track === i) && !p.xshots.some((x) => (x.xtrack || 0) === i) && !p.texts.some((x) => x.kind !== 'sub' && (x.track || 0) === i) ? delBtn(i) : null)); }
        if (/^o\d+$/.test(k)) { const i = +k.slice(1); return h('div', { class: 'trl ot', 'data-k': k }, h('span', { title: t('Doble clic para renombrar', 'Double-click to rename'), onDblclick: () => { const v = prompt(t('Nombre de la pista', 'Track name'), ots[i].name); if (v && v.trim()) { ots[i].name = v.trim(); commit(); } } }, ots[i].name),
          h('span', { class: 'trb' }, ovBtn(i), eyeBtn(i), ots.length > 1 && !p.overlays.some((o) => o.track === i) ? delBtn(i) : null)); }
        if (/^x\d+$/.test(k)) { const i = +k.slice(1); return h('div', { class: 'trl xt', 'data-k': k }, h('span', { title: t('Planos que se ven a la vez que el principal', 'Shots shown at the same time as the main one') }, xts[i].name),
          h('span', { class: 'trb' }, h('button', { class: 'btn btn-g', type: 'button', title: t('Añadir un plano encima', 'Add a shot on top'), 'aria-label': t('Añadir plano superpuesto', 'Add overlapping shot'), onClick: () => openAssetPicker({ title: t('Plano superpuesto: elige imágenes', 'Overlapping shot: choose images'), onPick: (ids) => addXShots(ids, i, S.time) }) }, MC.icon('plus', 13)),
            h('button', { class: 'btn btn-g', type: 'button', 'aria-pressed': String(xts[i].visible !== false), title: t('Mostrar u ocultar la pista', 'Show or hide the track'), 'aria-label': t('Mostrar u ocultar ', 'Show or hide ') + xts[i].name, onClick: () => { xts[i].visible = xts[i].visible === false; commit(); } }, MC.icon(xts[i].visible === false ? 'eyeoff' : 'eye', 13)),
            xts.length > 1 && !p.xshots.some((x) => (x.xtrack || 0) === i) ? h('button', { class: 'btn btn-g', type: 'button', 'aria-label': t('Quitar ', 'Remove ') + xts[i].name, onClick: () => { p.xshots.forEach((x) => { if ((x.xtrack || 0) > i) x.xtrack--; }); xts.splice(i, 1); commit(); } }, MC.icon('trash', 13)) : null)); }
        if (k === 'kf') {
          const lab = h('div', { class: 'trl kfl' + (S.kfAdv ? ' adv' : ''), 'data-k': k }, h('span', { class: 'kfhead' }, t('Fotogramas clave', 'Keyframes'), h('button', { class: 'btn btn-g kfadv', type: 'button', 'aria-pressed': String(S.kfAdv), title: t('Vista avanzada: una fila por propiedad (posición, escala, giro…)', 'Advanced view: one row per property (position, scale, rotation…)'), 'aria-label': t('Vista avanzada de fotogramas clave', 'Advanced keyframe view'), onClick: kfAdvToggle }, S.kfAdv ? t('Simple', 'Simple') : t('Avanzada', 'Advanced'))));
          if (S.kfAdv && kft) kfAdvProps(kft.it).forEach((pr, i) => lab.append(h('span', { class: 'kfpl' + (S.kfprop === pr ? ' on' : ''), style: { top: 26 + i * KFROW + 'px' }, onClick: () => { S.kfprop = S.kfprop === pr ? null : pr; renderTimeline(); } }, kfPropName(pr))));
          if (S.kfAdv && kft) lab.style.setProperty('height', 26 + kfAdvProps(kft.it).length * KFROW + 'px', 'important');
          return lab;
        }
        if (k === 'fxr') return h('div', { class: 'trl', 'data-k': k }, h('span', null, t('Efectos', 'Effects')));
        if (k === 'subs') return h('div', { class: 'trl', 'data-k': k }, h('span', null, t('Subtítulos', 'Subtitles')), h('span', { class: 'trb' }, h('button', { class: 'btn btn-g', type: 'button', title: t('Nuevo subtítulo', 'New subtitle'), 'aria-label': t('Nuevo subtítulo', 'New subtitle'), onClick: () => newSubLayer(false) }, MC.icon('plus', 13))));
        const ix = ['shots', 'text', 'voz', 'sfx', 'musica'].indexOf(k), tr = TRACKS[ix];
        return h('div', { class: 'trl', 'data-k': k }, h('span', null, t(tr.es, tr.en)),
          ix >= 2 ? h('span', { class: 'trb' }, addBtn(AU[ix - 2]), ix === 2 ? h('button', { class: 'btn btn-g', type: 'button', title: t('Grabar locución', 'Record voice-over'), 'aria-label': t('Grabar locución', 'Record voice-over'), onClick: recordVoice }, MC.icon('mic', 13)) : null) : null);
      };
      MC.put(MC.clear(el.tlLabels), h('div', { class: 'rs' }, tracksBtn()), KEYS.map((k) => decorateLabel(labelOf(k), k)));
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
          const mv = (ev) => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved) return; n.t = Math.max(0, Math.round((t0 + fineDx(ev, x0) / S.pps) * 100) / 100); b.style.left = n.t * S.pps - 5 + 'px'; touch(); };
          const up = () => { b.removeEventListener('pointermove', mv); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up); if (moved) commit(); else { setTime(n.t); renderInspector(); renderTimeline(); } };
          b.addEventListener('pointermove', mv); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
        });
        ruler.append(b);
      });
      el.tlContent.append(ruler);
      const R = {};
      KEYS.forEach((k) => {
        const ov = /^o\d+$/.test(k), audio = AU.includes(k);
        if (/^x\d+$/.test(k)) { R[k] = h('div', { class: 'tl-track xtr' + (p.xshots.some((x) => (x.xtrack || 0) === +k.slice(1)) ? '' : ' off'), 'data-k': k, 'data-hint': t('Arrastra aquí una imagen o un vídeo: se verá a la vez que el plano principal', 'Drag an image or video here: it shows at the same time as the main shot') }); el.tlContent.append(R[k]); return; }
        if (k === 'subs') { R.subs = h('div', { class: 'tl-track' + (p.subs.length ? '' : ' off'), 'data-k': 'subs', 'data-hint': t('Pulsa + para crear un subtítulo: una capa con todas las palabras y sus tiempos', 'Press + to create a subtitle: one layer with all the words and their timings') }); el.tlContent.append(R.subs); return; }
        if (k === 'fxr') { R.fxr = h('div', { class: 'tl-track' + (p.shots.some((q) => q.fx && q.fx.length) ? '' : ' off'), 'data-k': 'fxr', 'data-hint': t('Los efectos de cada plano (temblor, lluvia, niebla…) aparecen aquí', 'Each shot’s effects (shake, rain, fog…) show up here') }); el.tlContent.append(R.fxr); return; }
        if (k === 'kf') { R.kf = h('div', { class: 'tl-track kft' + (S.kfAdv ? ' adv' : ''), 'data-k': 'kf', 'data-hint': '' }); if (S.kfAdv && kft) { const ps = kfAdvProps(kft.it); R.kf.style.setProperty('height', 26 + ps.length * KFROW + 'px', 'important'); ps.forEach((pr, i) => R.kf.append(h('div', { class: 'kfrow' + (S.kfprop === pr ? ' on' : ''), 'data-kp': pr, style: { top: 26 + i * KFROW + 'px' } }))); } el.tlContent.append(R.kf); return; }
        R[k] = h('div', { class: 'tl-track' + (ov ? ' ovt' : '') + ((audio && !p.clips.some((c) => c.track === k)) || (ov && !p.overlays.some((o) => o.track === +k.slice(1)) && !(free && (p.xshots.some((x) => (x.xtrack || 0) === +k.slice(1)) || p.texts.some((x) => x.kind !== 'sub' && (x.track || 0) === +k.slice(1))))) ? ' off' : ''), 'data-k': k,
          'data-hint': ov ? (free ? t('Arrastra aquí imágenes, vídeos o capas agrupadas, o usa los botones de la izquierda', 'Drop images, videos or grouped layers here, or use the buttons on the left') : t('Pulsa + para añadir una imagen o un vídeo por encima de la ilustración', 'Press + to add an image or video above the artwork')) : t('Importa o graba audio con los botones de la izquierda', 'Import or record audio with the buttons on the left') });
        el.tlContent.append(R[k]);
      });
      KEYS.forEach((k) => { if (k === 'kf') return; const f = trackFold(k), off = trackOff(k); [R[k], el.tlLabels.querySelector('[data-k="' + k + '"]')].forEach((n) => { if (n) { n.dataset.fold = f ? '1' : '0'; n.dataset.off = off ? '1' : '0'; } }); });
      (free ? [] : p.shots).forEach((sh, i) => {
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
          const st0 = MC.shotStarts(p)[i]; const mv = (ev) => { const raw = st0 + d0 + fineDx(ev, x0) / S.pps, e2 = snapEnd(raw, null, true); sh.duration = clamp(e2 !== raw ? Math.round((e2 - st0) * 100) / 100 : Math.round((raw - st0) * 10) / 10, 0.5, 60); if (rp) rippleApply(rp, sh.duration - d0); clip.firstChild.textContent = sh.name + ' · ' + sh.duration.toFixed(1) + ' s'; layoutClips(); S.dirty = true; };
          const endd = () => { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', endd); rz.removeEventListener('pointercancel', endd); setTimeout(() => { clip._moved = false; }, 0); commit(); };
          rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', endd); rz.addEventListener('pointercancel', endd);
        });
        R.shots.append(clip);
        if (expd) sh.layers.forEach((l, li) => {
          const bar = h('div', { class: 'lyrbar' + (i === S.si && li === S.li ? ' on' : '') + (l.visible === false ? ' off' : ''), 'data-si': i, 'data-li': li, role: 'button', tabindex: '0', title: l.name + ' · z ' + l.z.toFixed(2), 'aria-label': l.name + ', ' + t('capa ', 'layer ') + (sh.layers.length - li) + t(' de ', ' of ') + sh.layers.length },
            ...layerRegions(l, sh).map((r) => { const a = MC.assets.get(r.assetId); return h('div', { class: 'lseg' + (i === S.si && li === S.li && S.sg === r.k ? ' on' : ''), 'data-r': r.k, title: t('Tramo ', 'Part ') + (r.k + 1) + ' · ' + r.t0.toFixed(1) + '–' + r.t1.toFixed(1) + ' s' }, a && a.thumb ? h('img', { src: a.thumb, alt: '' }) : null, r.k === 0 ? h('span', null, l.name) : null); }),
            l.locked ? h('i', null, '🔒') : null, h('div', { class: 'lrz lrzl', 'aria-label': t('Cuándo aparece la capa', 'When the layer appears') }), h('div', { class: 'lrz lrzr', 'aria-label': t('Cuándo desaparece la capa', 'When the layer disappears') }));
          bar.addEventListener('pointerdown', (e) => {
            e.stopPropagation(); bar.setPointerCapture(e.pointerId); if (S.si !== i) selectShot(i, false); S.li = li; S.tx = null; S.ov = null; S.cl = null; S.multi = [];
            const segEl = e.target.closest && e.target.closest('.lseg'); if (segEl) S.sg = +segEl.dataset.r;
            const sStart = MC.shotStarts(p)[i], ts0 = l.ts || 0, te0 = l.te == null ? sh.duration : l.te, segs0 = (l.segs || []).map((q) => q.t);
            const edge = e.target.closest && e.target.closest('.lrz');
            if (edge && !l.locked) {
              /* aparece / desaparece: estirar un borde de la capa */
              let mvd = false;
              const mvE = (ev) => {
                mvd = true; const raw = sStart + (edge.classList.contains('lrzl') ? ts0 : te0) + (ev.clientX - e.clientX) / MC.uz() / S.pps, v = snapMove(raw, 0, l.id) - sStart;
                if (edge.classList.contains('lrzl')) l.ts = v <= 0.02 ? 0 : clamp(round2(v), 0, te0 - 0.2); else { const nv = clamp(round2(v), ts0 + 0.2, sh.duration); l.te = nv >= sh.duration - 0.02 ? null : nv; }
                layoutClips(); S.dirty = true; touch();
              };
              const upE = () => { bar.removeEventListener('pointermove', mvE); bar.removeEventListener('pointerup', upE); bar.removeEventListener('pointercancel', upE); if (mvd) commit(); };
              bar.addEventListener('pointermove', mvE); bar.addEventListener('pointerup', upE); bar.addEventListener('pointercancel', upE); return;
            }
            const x0 = e.clientX, y0 = e.clientY, LHx = parseFloat(getComputedStyle(el.tlContent).getPropertyValue('--lh')) || 34; let moved = false, mode = '', tgt = li;
            const mv = (ev) => {
              const dx = ev.clientX - x0, dy = ev.clientY - y0;
              if (!mode && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) mode = Math.abs(dx) > Math.abs(dy) ? 'time' : 'order';
              if (!mode || l.locked) return; moved = true;
              if (mode === 'time') {
                const span = te0 - ts0, abs = snapMove(sStart + ts0 + dx / MC.uz() / S.pps, span, l.id), ns = clamp(round2(abs - sStart), 0, sh.duration - span), d = ns - ts0;
                l.ts = ns <= 0.001 ? 0 : ns; l.te = ns + span >= sh.duration - 0.02 ? null : round2(ns + span); (l.segs || []).forEach((q, k2) => { q.t = round2(segs0[k2] + d); }); layoutClips(); S.dirty = true; touch();
              } else { tgt = clamp(li - Math.round(dy / MC.uz() / LHx), 0, sh.layers.length - 1); R.shots.querySelectorAll('.lyrbar[data-si="' + i + '"]').forEach((n) => n.classList.toggle('tgt', +n.dataset.li === tgt && tgt !== li)); }
            };
            const up = () => { bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); if (moved && mode === 'time') commit(); else if (moved && tgt !== li && !l.locked) { S.li = reorderLayer(sh, li, tgt); commit(); } else { renderLayers(); renderInspector(); R.shots.querySelectorAll('.lyrbar').forEach((n) => { const on = +n.dataset.si === S.si && +n.dataset.li === S.li; n.classList.toggle('on', on); n.querySelectorAll('.lseg').forEach((q) => q.classList.toggle('on', on && +q.dataset.r === S.sg)); }); S.dirty = true; } };
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
          const mv = (ev) => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (moved) { c.start = snapMove(s0 + fineDx(ev, x0) / S.pps, c.dur, c.id); layoutClips(); touch(); } };
          const up = () => { el2.removeEventListener('pointermove', mv); el2.removeEventListener('pointerup', up); el2.removeEventListener('pointercancel', up); if (moved) commit(); else renderInspector(); };
          el2.addEventListener('pointermove', mv); el2.addEventListener('pointerup', up); el2.addEventListener('pointercancel', up);
        });
        rz.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); rz.setPointerCapture(e.pointerId);
          const x0 = e.clientX, d0 = c.dur, maxd = a ? a.dur - c.offset : 600;
          const mv = (ev) => { c.dur = clamp(Math.round((snapEnd(c.start + d0 + fineDx(ev, x0) / S.pps, c.id) - c.start) * 100) / 100, 0.1, maxd); layoutClips(); touch(); };
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
          el2.classList.add('on'); S.tx = it.id; S.cl = null; S.li = -1; if (S.project.tl === 'free') { S.xs = null; S.ov = null; }
          const x0 = e.clientX, s0 = it.start; let moved = false;
          const mv = (ev) => { if (it.link) return; if (Math.abs(ev.clientX - x0) > 3) moved = true; if (moved) { it.start = snapMove(s0 + fineDx(ev, x0) / S.pps, it.dur, it.id); if (free && it.kind !== 'sub') { const row = ots.map((q, i) => R['o' + i]).find((r3) => r3 && ev.clientY >= r3.getBoundingClientRect().top && ev.clientY < r3.getBoundingClientRect().bottom); if (row) it.track = +row.dataset.k.slice(1); } layoutClips(); touch(); } };
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
          const mv = (ev) => { it.dur = clamp(Math.round((snapEnd(sp.start + d0 + fineDx(ev, x0) / S.pps, it.id) - sp.start) * 100) / 100, 0.2, 60); layoutClips(); touch(); };
          const up = () => { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', up); rz.removeEventListener('pointercancel', up); commit(); };
          rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', up); rz.addEventListener('pointercancel', up);
        });
        (free ? (it.kind === 'sub' ? R.subs : (R['o' + clamp(it.track || 0, 0, ots.length - 1)] || R.o0)) : R.text).append(el2);
      });
      /* planos superpuestos */
      p.xshots.forEach((x) => {
        let thumbU = ''; try { thumbU = shotThumbURL(x); } catch (e) { thumbU = ''; }
        const hid = ((free ? ots : xts)[x.xtrack || 0] || {}).visible === false;
        const el2 = h('div', { class: 'clip xs' + (x.adj ? ' adj' : '') + (x.id === S.xs ? ' on' : '') + (hid ? ' hid' : ''), 'data-xs': x.id, role: 'button', tabindex: '0', title: x.name + ' · ' + x.duration.toFixed(1) + ' s', 'aria-label': x.name + ', ' + MC.fmtTime(x.start) + ', ' + x.duration.toFixed(1) + ' s', 'aria-pressed': String(x.id === S.xs), style: thumbU ? { backgroundImage: 'url(' + thumbU + ')' } : null,
          onKeydown: (e) => { if (e.key === 'Enter') { selectXs(x.id, true); } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); x.start = Math.max(0, r2(x.start + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 0.1))); commit(); } } },
          free ? h('button', { type: 'button', class: 'cvx', 'aria-expanded': String(!!S.expand[x.id]), title: S.expand[x.id] ? t('Plegar las capas', 'Fold the layers') : t('Ver las capas de esta capa agrupada', 'Show the layers of this grouped layer'), 'aria-label': (S.expand[x.id] ? t('Plegar las capas de ', 'Fold the layers of ') : t('Ver las capas de ', 'Show the layers of ')) + x.name, onPointerdown: (e) => e.stopPropagation(), onClick: (e) => { e.stopPropagation(); S.expand[x.id] = !S.expand[x.id]; renderTimeline(); } }, S.expand[x.id] ? '▾' : '▸') : null,
          h('span', null, x.name), h('div', { class: 'rz', 'aria-label': t('Cambiar duración', 'Change length') }));
        const rz = el2.querySelector('.rz');
        el2.addEventListener('pointerdown', (e) => {
          if (e.target === rz) return; el2.setPointerCapture(e.pointerId); S.xs = x.id; S.li = -1; S.cl = null; S.tx = null; S.ov = null; S.sb = null; S.multi = []; S.fxsel = null; S.selKind = 'shot';
          const x0 = e.clientX, s0 = x.start; let moved = false;
          const mv = (ev) => {
            if (Math.abs(ev.clientX - x0) > 3 || Math.abs(ev.clientY - e.clientY) > 6) moved = true; if (!moved) return;
            x.start = snapMove(s0 + fineDx(ev, x0) / S.pps, x.duration, x.id);
            const pre = free ? 'o' : 'x', rows = free ? ots : xts, row = rows.map((q, i) => R[pre + i]).find((r3) => r3 && ev.clientY >= r3.getBoundingClientRect().top && ev.clientY < r3.getBoundingClientRect().bottom);
            rows.forEach((q, i) => R[pre + i] && R[pre + i].classList.toggle('drop', R[pre + i] === row)); if (row) x.xtrack = +row.dataset.k.slice(1);
            layoutClips(); S.dirty = true; touch();
          };
          const up = () => { el2.removeEventListener('pointermove', mv); el2.removeEventListener('pointerup', up); el2.removeEventListener('pointercancel', up); if (moved) commit(); else { selectXs(x.id, true); } };
          el2.addEventListener('pointermove', mv); el2.addEventListener('pointerup', up); el2.addEventListener('pointercancel', up);
        });
        rz.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); rz.setPointerCapture(e.pointerId); const x0 = e.clientX, d0 = x.duration;
          const mv = (ev) => { x.duration = clamp(Math.round((snapEnd(x.start + d0 + fineDx(ev, x0) / S.pps, x.id) - x.start) * 100) / 100, 0.5, 120); layoutClips(); S.dirty = true; touch(); };
          const up = () => { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', up); rz.removeEventListener('pointercancel', up); commit(); };
          rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', up); rz.addEventListener('pointercancel', up);
        });
        (free ? (R['o' + clamp(x.xtrack || 0, 0, ots.length - 1)] || R.o0) : (R['x' + clamp(x.xtrack || 0, 0, xts.length - 1)] || R.x0)).append(el2);
        if (free && S.expand[x.id]) (x.fx || []).forEach((f) => {
          const on = x.id === S.xs && f.id === S.fxsel, nm = MC.fxName(f.type);
          const bar = h('div', { class: 'clip xf' + (on ? ' on' : ''), 'data-xf': x.id + ':' + f.id, role: 'button', tabindex: '0', title: nm + ' · ' + f.dur.toFixed(1) + ' s', 'aria-label': t('Efecto ', 'Effect ') + nm + t(' de ', ' of ') + x.name, 'aria-pressed': String(on) }, h('span', null, nm), h('div', { class: 'rz', 'aria-label': t('Cambiar duración', 'Change length') }));
          const rzf = bar.querySelector('.rz'), pickF = () => { selectXs(x.id, false); S.fxsel = f.id; renderPanels(); renderInspector(); renderTimeline(); };
          bar.addEventListener('pointerdown', (e) => {
            if (e.target === rzf) return; e.stopPropagation(); bar.setPointerCapture(e.pointerId); const x0 = e.clientX, s0 = f.start; let moved = false;
            const mv = (ev) => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved) return; f.start = clamp(r2(s0 + fineDx(ev, x0) / S.pps), 0, Math.max(0, x.duration - f.dur)); layoutClips(); S.dirty = true; touch(); };
            const up = () => { bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); if (moved) commit(); else pickF(); };
            bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
          });
          rzf.addEventListener('pointerdown', (e) => {
            e.stopPropagation(); rzf.setPointerCapture(e.pointerId); const x0 = e.clientX, d0 = f.dur;
            const mv = (ev) => { f.dur = clamp(r2(d0 + fineDx(ev, x0) / S.pps), 0.1, 60); layoutClips(); S.dirty = true; touch(); };
            const up = () => { rzf.removeEventListener('pointermove', mv); rzf.removeEventListener('pointerup', up); rzf.removeEventListener('pointercancel', up); commit(); };
            rzf.addEventListener('pointermove', mv); rzf.addEventListener('pointerup', up); rzf.addEventListener('pointercancel', up);
          });
          bar.addEventListener('keydown', (e) => { if (e.key === 'Enter') pickF(); });
          el2.parentNode.append(bar);
        });
        if (free && S.expand[x.id]) for (let li = x.layers.length - 1; li >= 0; li--) {
          const l = x.layers[li], a = MC.assets.get(l.assetId), on = x.id === S.xs && li === S.li;
          const bar = h('div', { class: 'clip xl' + (on ? ' on' : '') + (l.visible === false ? ' hid' : ''), 'data-xl': x.id + ':' + li, role: 'button', tabindex: '0', title: l.name + ' · z ' + l.z.toFixed(2), 'aria-label': l.name + ', ' + t('capa ', 'layer ') + (x.layers.length - li) + t(' de ', ' of ') + x.layers.length + t(', de la capa agrupada ', ', of the grouped layer ') + x.name, 'aria-pressed': String(on), style: a && a.thumb ? { backgroundImage: 'url(' + a.thumb + ')' } : null },
            h('span', null, l.name));
          const pick = () => { selectXs(x.id, false); S.li = li; S.selKind = 'layer'; renderLayers(); renderInspector(); renderTimeline(); };
          bar.addEventListener('pointerdown', (e) => { e.stopPropagation(); pick(); });
          bar.addEventListener('keydown', (e) => { if (e.key === 'Enter') pick(); });
          el2.parentNode.append(bar);
        }
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
          const mv = (ev) => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved) return; const ns = snapMove(s0 + fineDx(ev, x0) / S.pps, it.dur, it.id), d = ns - s0; it.start = ns; snap.forEach((z) => { z[0].s = Math.max(0, Math.round((z[1] + d) * 1000) / 1000); }); layoutClips(); S.dirty = true; touch(); };
          const up = () => { el2.removeEventListener('pointermove', mv); el2.removeEventListener('pointerup', up); el2.removeEventListener('pointercancel', up); if (moved) commit(); else { const cue = q ? MC.subCues(it, p.lang, it.style).find((c) => c.words[0].i === +q.dataset.w) : null; setTime(cue ? cue.s + 0.01 : it.start + 0.01); S.selKind = 'subs'; renderInspector(); renderPanels(); renderTimeline(); } };
          el2.addEventListener('pointermove', mv); el2.addEventListener('pointerup', up); el2.addEventListener('pointercancel', up);
        });
        rz.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); rz.setPointerCapture(e.pointerId); const x0 = e.clientX, d0 = it.dur;
          const mv = (ev) => { it.dur = clamp(Math.round((snapEnd(it.start + d0 + fineDx(ev, x0) / S.pps, it.id) - it.start) * 100) / 100, 0.5, 600); layoutClips(); S.dirty = true; touch(); };
          const up = () => { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', up); rz.removeEventListener('pointercancel', up); commit(); };
          rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', up); rz.addEventListener('pointercancel', up);
        });
        R.subs.append(el2);
      });
      /* efectos de todos los planos */
      (free ? [] : p.shots).forEach((shx, si) => (shx.fx || []).forEach((f) => {
        const el2 = h('div', { class: 'clip ef' + (f.id === S.fxsel && si === S.si ? ' on' : ''), 'data-f': f.id, 'data-fs': si, role: 'button', tabindex: '0', title: MC.fxName(f.type) + ' · ' + shx.name, 'aria-label': MC.fxName(f.type) + ', ' + shx.name + ', ' + f.dur.toFixed(1) + ' s', 'aria-pressed': String(f.id === S.fxsel && si === S.si) },
          h('span', null, MC.fxName(f.type)), h('div', { class: 'rz', 'aria-label': t('Cambiar duración', 'Change length') }));
        const rz = el2.querySelector('.rz');
        el2.addEventListener('pointerdown', (e) => {
          if (e.target === rz) return; el2.setPointerCapture(e.pointerId);
          S.si = si; S.li = -1; S.cl = null; S.tx = null; S.ov = null; S.multi = []; S.fxsel = f.id;
          const x0 = e.clientX, s0 = f.start; let moved = false;
          const mv = (ev) => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved || f.panel != null) return; f.start = clamp(Math.round((s0 + fineDx(ev, x0) / S.pps) * 100) / 100, 0, Math.max(0, shx.duration - 0.1)); layoutClips(); S.dirty = true; touch(); };
          const up = () => { el2.removeEventListener('pointermove', mv); el2.removeEventListener('pointerup', up); el2.removeEventListener('pointercancel', up); if (moved) commit(); else { setTime(MC.shotStarts(p)[si] + clamp(MC.fxStart(shx, f), 0, Math.max(0, shx.duration - 0.001))); S.fxsel = f.id; S.selKind = 'fx'; renderLayers(); renderInspector(); renderTimeline(); } };
          el2.addEventListener('pointermove', mv); el2.addEventListener('pointerup', up); el2.addEventListener('pointercancel', up);
        });
        rz.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); rz.setPointerCapture(e.pointerId);
          const x0 = e.clientX, d0 = f.dur;
          const mv = (ev) => { f.dur = clamp(Math.round((d0 + fineDx(ev, x0) / S.pps) * 100) / 100, 0.1, 30); layoutClips(); S.dirty = true; touch(); };
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
          el2.classList.add('on'); S.ov = it.id; S.cl = null; S.tx = null; S.li = -1; if (S.project.tl === 'free') S.xs = null;
          const x0 = e.clientX, s0 = it.start, tr0 = it.track; let moved = false, over = null;
          const mv = (ev) => {
            if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved && Math.abs(ev.clientY - e.clientY) < 6) return; moved = true;
            it.start = snapMove(s0 + fineDx(ev, x0) / S.pps, it.dur, it.id); syncOvAudio(it);
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
          const mv = (ev) => { it.dur = clamp(Math.round((snapEnd(it.start + d0 + fineDx(ev, x0) / S.pps, it.id) - it.start) * 100) / 100, 0.2, maxd); syncOvAudio(it); layoutClips(); touch(); };
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
          const mv = (ev) => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved) return; q.t = clamp(Math.round((t0 + fineDx(ev, x0) / S.pps) * 100) / 100, 0, kft.dur); layoutClips(); S.dirty = true; touch(); };
          const up = () => { d.removeEventListener('pointermove', mv); d.removeEventListener('pointerup', up); d.removeEventListener('pointercancel', up); if (moved) commit(); else { setTime(kft.start + clamp(q.t, 0, Math.max(0, kft.dur - 0.001))); renderInspector(); renderTimeline(); } };
          d.addEventListener('pointermove', mv); d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
        });
        R.kf.append(d);
      });
      if (kft && R.kf && S.kfAdv) kfAdvProps(kft.it).forEach((pr, i) => (kft.it.kf || []).filter((q) => q[pr] != null).forEach((q) => {
        const d = h('button', { type: 'button', class: 'kfd kfp' + (q.id === S.kfid && S.kfprop === pr ? ' on' : ''), 'data-kf': q.id, 'data-kp': pr, style: { top: 26 + i * KFROW + 4 + 'px' }, title: kfPropName(pr) + ' · ' + q.t.toFixed(2) + ' s', 'aria-label': kfPropName(pr) + t(': fotograma clave en ', ': keyframe at ') + q.t.toFixed(2) + ' s' });
        d.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); d.setPointerCapture(e.pointerId); S.kfid = q.id; S.kfprop = pr; let cur = q;
          R.kf.querySelectorAll('.kfd.on').forEach((n) => n.classList.remove('on')); d.classList.add('on');
          const x0 = e.clientX, t0 = q.t; let moved = false;
          const mv = (ev) => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (!moved) return; const nt = clamp(round2(t0 + fineDx(ev, x0) / S.pps), 0, kft.dur); cur = kfMoveProp(kft.it, cur, pr, nt); S.kfid = cur.id; d.dataset.kf = cur.id; d.dataset.mv = '1'; d.style.left = (kft.start + cur.t) * S.pps - 7 + 'px'; S.dirty = true; touch(); };
          const up = () => { d.removeEventListener('pointermove', mv); d.removeEventListener('pointerup', up); d.removeEventListener('pointercancel', up); if (moved) commit(); else { setTime(kft.start + clamp(q.t, 0, Math.max(0, kft.dur - 0.001))); renderInspector(); renderTimeline(); } };
          d.addEventListener('pointermove', mv); d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
        });
        R.kf.append(d);
      }));
      if (kft && R.kf) R.kf.addEventListener('dblclick', (e) => {
        if (e.target.closest('.kfd') || e.target.closest('.kfrow')) return; const local = clamp((e.clientX - el.tlContent.getBoundingClientRect().left) / MC.uz() / S.pps - kft.start, 0, kft.dur);
        const q = newKf(kft.it, local); kft.it.kf = (kft.it.kf || []).concat([q]); S.kfid = q.id; commit();
      });
      el.playhead = h('div', { class: 'playhead' }); el.tlContent.append(el.playhead);
      layoutClips();
      el.tlContent.querySelectorAll('.clip[data-c], .clip[data-x], .clip[data-o]').forEach((n) => { const it = itemOfKey(keyEl(n)); n.classList.toggle('grp', !!(it && it.group)); });
      markMulti(); stripPending(); refreshTlBar();
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
      const time = Math.max(0, Math.round(((e.clientX - el.tlContent.getBoundingClientRect().left) / MC.uz() / pps) * 100) / 100);
      const bar = e.target.closest('.lyrbar'), clip = e.target.closest('.clip[data-i]'), xclip = e.target.closest('.clip[data-xs]');
      return { row, key, time, bar, clip, xclip, si: bar ? +bar.dataset.si : clip ? +clip.dataset.i : null };
    }
    async function dropOnTimeline(e) {
      const info = dropInfo(e); if (!info) return; const dt = e.dataTransfer, p = S.project; let items = [], rest = [];
      if (dt.types.includes(MIME_ASSET)) { try { items = JSON.parse(dt.getData(MIME_ASSET)); } catch (x) { items = []; } }
      else if (dt.files && dt.files.length) { const fs = await MC.collectDropped(dt); MC.toast(t('Leyendo los archivos…', 'Reading the files…')); const r = await storeFiles(fs); items = r.items; rest = r.rest; }
      const imgs = items.filter((q) => q.kind !== 'audio'), auds = items.filter((q) => q.kind === 'audio'), key = info.key;
      if (auds.length && (key === 'voz' || key === 'sfx' || key === 'musica' || key === 'shots' || key === 'text')) {
        for (const q of auds) { if (q.lib) { const it = MC.audio.LIBRARY.find((x) => x.id === q.lib); if (it) { const c = await addLibrarySound(it, info.time); if (AU.includes(key)) c.track = key; S.cl = c.id; S.tx = null; S.ov = null; S.li = -1; } continue; } const a = MC.audio.get(q.id) || (await MC.audio.load(q.id)); if (!a) continue; const c = MC.audio.newClip(AU.includes(key) ? key : a.dur >= 20 ? 'musica' : 'sfx', a, info.time); p.clips.push(c); S.cl = c.id; S.tx = null; S.ov = null; S.li = -1; }
        commit(); return;
      }
      if (/^x\d+$/.test(key) && imgs.length) { if (info.xclip) { selectXs(info.xclip.dataset.xs, false); await assetsToLayers(imgs.map((q) => q.id), null); return; } await addXShots(imgs.map((q) => q.id), +key.slice(1), info.time); return; }
      if (/^o\d+$/.test(key) && imgs.length) { let at = info.time; for (const q of imgs) { const a = await MC.assets.load(q.id); if (!a) continue; const it = MC.newOverlay(a, { track: +key.slice(1), start: at, dur: 4 }); it.scale = 0.6; if (!a.video) it.dur = Math.max(1, Math.min(MC.totalTime(p) - at, 6)) || 4; p.overlays.push(it); S.ov = it.id; S.cl = null; S.tx = null; S.li = -1; at += it.dur; } commit(); return; }
      if (key === 'shots' && imgs.length && info.bar && e.target.closest('.lseg')) { /* sobre un tramo de una capa: reemplaza su ilustración */
        const si = +info.bar.dataset.si, li = +info.bar.dataset.li, k = +e.target.closest('.lseg').dataset.r; selectShot(si, false); const l = S.project.shots[si].layers[li]; S.li = li; S.sg = k;
        if (l && !l.locked) { await replaceRegion(l, k, imgs[0].id); return; }
      }
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
      const at = (e) => (e.clientX - el.tlContent.getBoundingClientRect().left) / MC.uz() / S.pps;
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
            const mn = Math.min(...starts0), d = Math.max(-mn, Math.round((fineDx(ev, x0) / S.pps) * 100) / 100);
            items.forEach((q, i) => { q.it.start = Math.round((starts0[i] + d) * 100) / 100; if (q.k[0] === 'o') syncOvAudio(q.it); });
            layoutClips(); touch();
          };
          const up = () => { c.removeEventListener('pointermove', mv); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); if (moved) commit(); };
          c.addEventListener('pointermove', mv); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up); return;
        }
        if (S.multi.length) { S.multi = []; markMulti(); }
      }, true);
      /* doble pulsación en una fila de propiedad (vista avanzada): crea un fotograma clave solo de esa propiedad. Se detecta con dos pulsaciones seguidas porque una pulsación sencilla en la fila no mueve el cabezal (para eso están la regla y los rombos). */
      el.tlContent.addEventListener('pointerdown', (e) => {
        const row = e.target.closest && e.target.closest('.kfrow'), kt = row && !e.target.closest('.kfd') && kfTarget(); if (!kt) return;
        e.stopPropagation(); const now = performance.now(), L = S.kfLast; S.kfLast = { t: now, x: e.clientX, pr: row.dataset.kp };
        if (L && now - L.t < 450 && Math.abs(L.x - e.clientX) < 8 && L.pr === row.dataset.kp) {
          e.stopPropagation(); e.preventDefault(); S.kfLast = null;
          const local = clamp((e.clientX - el.tlContent.getBoundingClientRect().left) / MC.uz() / S.pps - kt.start, 0, kt.dur), q = newKf(kt.it, local, [row.dataset.kp]);
          kt.it.kf = (kt.it.kf || []).concat([q]); S.kfid = q.id; S.kfprop = row.dataset.kp; commit();
        }
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
          const box = el.tlContent.getBoundingClientRect(), uzz = MC.uz(), x = (Math.min(e.clientX, marq.x0) - box.left) / uzz, y = (Math.min(e.clientY, marq.y0) - box.top) / uzz, w = Math.abs(e.clientX - marq.x0) / uzz, hh = Math.abs(e.clientY - marq.y0) / uzz;
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
    el.canvas = h('canvas', { 'aria-label': t('Visor del plano', 'Shot viewer'), tabindex: '0', role: 'application', 'aria-describedby': 'mc-vhint' });
    el.empty = h('div', { class: 'drop' }, h('div', { class: 'in' }, MC.icon('image', 28),
      h('div', null, S.project.tl === 'free' ? t('Arrastra aquí imágenes o vídeos: caen en la pista elegida. También puedes añadir texto o una capa agrupada desde la línea de tiempo.', 'Drag images or videos here: they land on the picked track. You can also add text or a grouped layer from the timeline.') : S.project.mode === 'page' ? t('Arrastra aquí tus páginas (PNG, JPEG, WebP, PSD o PDF). Se detectan las viñetas.', 'Drag your pages here (PNG, JPEG, WebP, PSD or PDF). Panels are detected.') : S.project.mode === 'webtoon' ? t('Arrastra aquí tu tira vertical, o varias imágenes para apilarlas.', 'Drag your vertical strip here, or several images to stack them.') : t('Arrastra aquí tus ilustraciones. Cada archivo será una capa.', 'Drag your artwork here. Each file becomes a layer.')),
      h('button', { class: 'btn btn-p', type: 'button', onClick: () => fileLayers.click() }, MC.icon('upload', 15), t('Importar', 'Import'))));
    el.sim = h('div', { class: 'sim', hidden: true, 'aria-hidden': 'true' });
    el.hovTag = h('div', { class: 'hovtag', hidden: true, role: 'status' });
    el.stage = h('div', { class: 'stage' }, el.canvas, el.empty, el.sim, el.hovTag);
    el.play = h('button', { class: 'play', type: 'button', onClick: () => togglePlay() });
    el.loop = h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Repetir', 'Loop'), 'aria-label': t('Repetir', 'Loop'), onClick: () => { S.loop = !S.loop; updateTransport(); } }, MC.icon('loop'));
    el.time = h('div', { class: 'num' });
    el.tlTime = h('span', { class: 'num' });
    el.tlLabels = h('div', { class: 'tl-labels' });
    el.tlContent = h('div', { class: 'tl-content' });

    el.rail = h('div', { class: 'rail', role: 'tablist', 'aria-label': t('Paneles', 'Panels'), 'aria-orientation': 'vertical' });
    el.leftTitle = h('h3', null, '');
    el.leftBody = h('div', { class: 'pbody' });
    el.leftEl = h('div', { class: 'panel-col leftpanel' }, h('div', { class: 'ph' }, el.leftTitle, el.leftHelp = h('span', { class: 'hqw' }), dockCtl('tools')), el.leftBody, el.hTools = handle('left', 'r', t('Ancho del panel izquierdo', 'Left panel width')));
    el.propsTitle = h('h3', null, '');
    el.exportHost = h('div', { class: 'exp-panel' });
    const layersPanel = h('div', { class: 'panel-col p-layers' },
      h('div', { class: 'ph' }, h('h3', null, t('Capas', 'Layers')), h('span', { class: 'vwrap' }, el.impBtn = h('button', { class: 'btn btn-s btn-sm', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onClick: () => { S.impOpen = !S.impOpen; el.impBtn.setAttribute('aria-expanded', String(S.impOpen)); renderImpMenu(); } }, MC.icon('plus', 14), t('Importar', 'Import'), MC.icon('down', 12))), dockCtl('layers')),
      h('div', { style: { display: 'contents' }, onClick: (e) => { if (e.target === e.currentTarget || e.target === el.layersBody) { S.selKind = 'shot'; S.li = -1; renderLayers(); renderPanels(); S.dirty = true; } } }, el.layersBody));
    const propsPanel = h('div', { class: 'panel-col p-props' }, h('div', { class: 'ph' }, el.propsTitle, el.propsHelp = h('span', { class: 'hqw' }), dockCtl('props')), el.inspBody);
    el.colL = h('div', { class: 'sidecol colL' }, el.hCl = handle('cl', 'l', t('Ancho de la columna izquierda', 'Left column width')));
    el.colR = el.rightEl = h('div', { class: 'sidecol colR' }, layersPanel, propsPanel, el.hCr = handle('right', 'l', t('Ancho de la columna derecha', 'Right column width')));
    el.zBL = h('div', { class: 'sidecol zb zbl' }, el.hBl = handle('bl', 'r', t('Ancho de la zona izquierda junto a la línea de tiempo', 'Width of the zone left of the timeline')));
    el.zBR = h('div', { class: 'sidecol zb zbr' }, el.hBr = handle('br', 'l', t('Ancho de la zona derecha junto a la línea de tiempo', 'Width of the zone right of the timeline')));
    el.hCl.className = 'pz pz-r';
    const exportPanel = el.exportEl = h('div', { class: 'panel-col p-export' }, h('div', { class: 'ph' }, h('h3', null, t('Exportar', 'Export'))), el.exportHost);
    const viewer = el.viewerEl = h('div', { class: 'viewer' }, el.vbar, el.stage, h('p', { id: 'mc-vhint', class: 'sr-only' }, t('Visor. Tab pasa de capa en capa, las flechas mueven lo seleccionado (con Mayús, más), más y menos cambian el tamaño. F6 salta de panel en panel.', 'Viewer. Tab moves from layer to layer, arrow keys move the selection (with Shift, more), plus and minus resize it. F6 jumps between panels.')),
      h('div', { class: 'tbar' },
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Ir al inicio (Inicio)', 'Go to start (Home)'), 'aria-label': t('Ir al inicio', 'Go to start'), onClick: () => setTime(0) }, MC.icon('first')),
        el.play, el.loop, el.time,
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Pantalla completa (F)', 'Full screen (F)'), 'aria-label': t('Pantalla completa', 'Full screen'), onClick: () => ACT.fullscreen() }, MC.icon('frame')), dockCtl('viewer')));
    const timeline = h('div', { class: 'p-timeline' }, el.hTl = handle('tl', 't', t('Alto de la línea de tiempo', 'Timeline height')),
      tlToolbar(),
      h('div', { class: 'tl-body' }, el.tlLabels, h('div', { class: 'tl-scroll' }, el.tlContent)));
    /* pantallas estrechas (tablet en vertical): los paneles salen de una hoja que sube desde abajo */
    const MT = [['panel', t('Panel', 'Panel')], ['layers', t('Capas', 'Layers')], ['props', t('Propiedades', 'Properties')]];
    function setSheet(v) {
      S.mtab = S.mtab === v ? '' : v; studio.dataset.mtab = S.mtab;
      mtabs.querySelectorAll('button').forEach((b, k) => { b.setAttribute('aria-pressed', String(S.mtab === MT[k][0])); b.setAttribute('aria-expanded', String(S.mtab === MT[k][0])); });
      if (S.mtab) MC.announce(t('Abierto: ', 'Open: ') + MT.find((q) => q[0] === S.mtab)[1]); setTimeout(fit, 60);
    }
    const mtabs = h('div', { class: 'mtabs', role: 'toolbar', 'aria-label': t('Paneles', 'Panels') }, MT.map((x) => h('button', { type: 'button', 'aria-pressed': String(S.mtab === x[0]), 'aria-expanded': String(S.mtab === x[0]), onClick: () => setSheet(x[0]) }, x[1])));
    el.sheetGrab = h('div', { class: 'sheetgrab', role: 'button', tabindex: '0', 'aria-label': t('Cerrar el panel (arrastra hacia abajo)', 'Close the panel (drag down)'),
      onClick: () => { if (S.mtab) setSheet(S.mtab); }, onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); if (S.mtab) setSheet(S.mtab); } },
      onPointerdown: (e) => { const y0 = e.clientY; let moved = false; const g = e.currentTarget; try { g.setPointerCapture(e.pointerId); } catch (er) { /* sin captura */ } const mv = (ev) => { if (ev.clientY - y0 > 50) { moved = true; g.removeEventListener('pointermove', mv); if (S.mtab) setSheet(S.mtab); } }; g.addEventListener('pointermove', mv); g.addEventListener('pointerup', () => g.removeEventListener('pointermove', mv), { once: true }); } }, h('span', { 'aria-hidden': 'true' }));
    const studio = h('div', { class: 'studio enter', 'data-ws': S.ws, 'data-tl': WS[S.ws].tl, 'data-mtab': S.mtab },
      h('div', { class: 'skiplinks' }, [['viewer', 'Saltar al visor', 'Skip to the viewer'], ['timeline', 'Saltar a la línea de tiempo', 'Skip to the timeline'], ['props', 'Saltar a las propiedades', 'Skip to properties']].map((q) => h('button', { type: 'button', onClick: () => focusRegion(q[0]) }, t(q[1], q[2])))),
      el.h1 = h('h1', { class: 'sr-only' }, ''), el.top, el.sMain = h('div', { class: 's-main' }, el.rail, el.leftEl, el.colL, el.vghost = h('div', { class: 'vghost' }, h('p', null, t('El visor está en otra ventana.', 'The viewer is in another window.')), h('button', { class: 'btn btn-s', type: 'button', onClick: () => dockBack('viewer') }, MC.icon('undo', 14), t('Traerlo de vuelta', 'Bring it back'))), viewer, el.colR, exportPanel), el.sheetGrab, mtabs, el.sBot = h('div', { class: 's-bot' }, el.zBL, timeline, el.zBR), fileLayers, fileOver, fileOv, fileShots, fileAudio);
    setTimeout(() => studio.classList.remove('enter'), 3000); if (MC.motion && !MC.motion.reduced()) MC.motion.watchEnter(3000);


    /* ---------- versión IA: los cambios de la IA van a una copia que no pisa la tuya hasta que la aceptas ---------- */
    async function aiBegin(desc) {
      if (S.ai && S.aiView === 'base') await aiToggle();
      if (!S.ai) { await save(); await MC.versions.save(S.project, t('Antes de la IA', 'Before the AI'), false); S.ai = { base: JSON.stringify(S.project), t: Date.now(), log: [] }; S.aiView = 'ia'; }
      S.ai.log.push(new Date().toLocaleTimeString() + ' · ' + desc); renderAi();
    }
    async function aiToggle() {
      if (!S.ai) return;
      if (S.aiView === 'ia') { await save(); S.aiWork = S.project; const b = JSON.parse(S.ai.base); S.aiView = 'base'; S.project = MC.normalizeProject(b); }
      else { S.aiView = 'ia'; S.project = S.aiWork; S.aiWork = null; }
      await MC.loadProjectAssets(S.project); S.si = 0; S.li = -1; S.selKind = 'project'; fit(); renderAll(); renderAi();
    }
    async function aiAccept() {
      if (!S.ai) return; if (S.aiView === 'base') await aiToggle();
      const id = S.project.id; S.ai = null; await save(); try { await MC.db.del('versions', 'ia-' + id); } catch (e) { /* sin registro */ }
      renderAi(); MC.toast(t('Versión de la IA aceptada. Tu versión anterior está en el historial («Antes de la IA»).', 'AI version accepted. Your previous version is in the history (“Before the AI”).'), { ms: 8000 });
    }
    function aiDiscard() {
      if (!S.ai) return;
      MC.modal(t('¿Descartar la versión de la IA?', 'Discard the AI version?'), h('p', null, t('Se vuelve a tu proyecto tal y como estaba. Los cambios de la IA se pierden.', 'You go back to your project as it was. The AI changes are lost.')), (close) => [
        h('button', { class: 'btn btn-g', type: 'button', onClick: close }, t('Cancelar', 'Cancel')),
        h('button', { class: 'btn btn-p', type: 'button', onClick: async () => { close(); const id = S.project.id, b = JSON.parse(S.ai.base); S.ai = null; S.aiWork = null; S.aiView = 'ia'; S.project = MC.normalizeProject(b); try { await MC.db.del('versions', 'ia-' + id); } catch (e) { /* sin registro */ } await MC.loadProjectAssets(S.project); S.si = 0; S.li = -1; S.selKind = 'project'; fit(); renderAll(); pushHist(); await save(); renderAi(); MC.toast(t('Versión de la IA descartada.', 'AI version discarded.')); } }, t('Descartar', 'Discard'))]);
    }
    function renderAi() {
      const bar = el.aibar; if (!bar) return; MC.clear(bar); bar.hidden = !S.ai; if (!S.ai) return;
      const base = S.aiView === 'base', n = S.ai.log.length;
      MC.put(bar, h('span', { class: 'aitag' }, MC.icon('star', 14), base ? t('Viendo TU versión (solo lectura)', 'Viewing YOUR version (read only)') : t('Versión de la IA · sin aceptar', 'AI version · not accepted')),
        h('button', { class: 'btn btn-sm', type: 'button', onClick: aiToggle }, base ? t('Volver a la versión IA', 'Back to AI version') : t('Ver la mía', 'View mine')),
        h('button', { class: 'btn btn-sm', type: 'button', title: S.ai.log.join('\n'), onClick: () => MC.modal(t('Cambios de la IA', 'AI changes'), h('ul', null, S.ai.log.map((l) => h('li', null, l))), (close) => [h('button', { class: 'btn btn-p', type: 'button', onClick: close }, t('Cerrar', 'Close'))]) }, t('Cambios (' + n + ')', 'Changes (' + n + ')')),
        h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: aiAccept }, t('Aceptar', 'Accept')),
        h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: aiDiscard }, t('Descartar', 'Discard')));
    }

    function renderAll() { renderTop(); renderRail(); renderLayers(); renderPanels(); renderVbar(); renderTimeline(); updateTransport(); updateTime(); }
    S.ai = aiInit; S.aiView = 'ia'; studio.append(el.aibar = h('div', { class: 'aibar', role: 'region', 'aria-label': t('Versión de la IA', 'AI version'), hidden: true })); renderAi();
    clearTimeout(openingT);
    MC.put(MC.clear(root), studio);
    applyRows();
    renderAll(); wire(el.canvas); wireTimeline(); applyLayout();
    const onWinResize = () => applyLayout(); window.addEventListener('resize', onWinResize);
    const verTimer = setInterval(() => { if (S.alive && S.dirtySinceVer && !S.ai) { S.dirtySinceVer = false; MC.versions.save(S.project, '', true).catch(() => {}); } }, 300000);
    const onDocDown = (e) => {
      if (!e.target.closest || (!e.target.closest('.dockmenu') && !e.target.closest('.dockctl'))) { closeDockMenu(); qAll('.dockctl button[data-open]').forEach((b) => { b.dataset.open = ''; b.setAttribute('aria-expanded', 'false'); }); } if (S.impOpen && el.impMenu && !el.impMenu.contains(e.target) && !(el.impBtn && el.impBtn.contains(e.target))) { S.impOpen = false; renderImpMenu(); if (el.impBtn) el.impBtn.setAttribute('aria-expanded', 'false'); }
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
        loop.mt = now; const lv = MC.audio.levels();
        qAll('.studio .meter').forEach((m) => { const v = lv[m.dataset.m] || 0; m.firstChild.style.width = Math.round(v * 100) + '%'; m.setAttribute('aria-valuenow', Math.round(v * 100)); m.classList.toggle('hot', v > 0.92); });
      } else if (!S.playing && loop.mt) { loop.mt = 0; qAll('.studio .meter i').forEach((i) => { i.style.width = '0'; }); }
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
    /* elimina el plano seleccionado (con ripple si está activo); siempre queda al menos uno */
    function delShot() {
      const p = S.project, sh = p.shots[S.si]; if (!sh) return false;
      if (p.shots.length < 2) { MC.toast(t('El proyecto necesita al menos un plano. Añade otro antes de eliminar este.', 'The project needs at least one shot. Add another before deleting this one.')); return true; }
      if (S.ripple) { const rp = rippleBegin(curStart() + sh.duration); rippleApply(rp, -sh.duration); }
      p.shots.splice(S.si, 1); S.si = clamp(S.si, 0, p.shots.length - 1); S.li = -1; S.xs = null; S.selKind = 'shot';
      S.time = clamp(S.time, 0, Math.max(0, MC.totalTime(p) - 0.001)); commit(); setTime(S.time);
      undoToast(t('Plano eliminado', 'Shot deleted')); return true;
    }
    /* ---------- herramientas de edición de la línea de tiempo (estilo CapCut) ---------- */
    S.snapOn = MC.store.get('snapon', '1') !== '0'; S.tool = 'sel'; S.sg = 0;
    const round2 = (v) => Math.round(v * 100) / 100;
    /* tramos de una capa dentro del plano: cada uno muestra una ilustración (el primero, la de la capa; los demás, sus cortes) */
    function layerRegions(l, sh) {
      const ts = l.ts || 0, te = l.te == null ? sh.duration : l.te, cuts = MC.layerSegs(l).filter((q) => q.t > ts + 0.01 && q.t < te - 0.01);
      const out = [{ k: 0, t0: ts, t1: cuts.length ? cuts[0].t : te, assetId: l.assetId, seg: null }];
      cuts.forEach((q, i) => out.push({ k: i + 1, t0: q.t, t1: i + 1 < cuts.length ? cuts[i + 1].t : te, assetId: q.assetId, seg: q }));
      return out;
    }
    async function replaceRegion(l, k, aid) {
      const a = await MC.assets.load(aid); if (!a) return;
      const sh = shot(), r = layerRegions(l, sh)[k]; if (!r) return;
      if (k === 0) l.assetId = aid; else r.seg.assetId = aid;
      commit(); MC.announce(t('Ilustración reemplazada', 'Illustration replaced'));
    }
    function pickReplace(l, k) {
      openAssetPicker({ title: t('Reemplazar la ilustración de este tramo', 'Replace the illustration of this part'), noDevice: true, onPick: (ids) => { if (ids && ids[0]) replaceRegion(l, k, ids[0]); } });
    }
    /* sobre qué actúan las herramientas: el elemento seleccionado, o el plano actual si no hay otro */
    function tgt() {
      const p = S.project, k = S.selKind;
      if (k === 'clip' && S.cl && clipById(S.cl)) { const it = clipById(S.cl); return { k: 'clip', it, start: it.start, dur: it.dur }; }
      if (k === 'text' && S.tx && txById(S.tx)) { const it = txById(S.tx), sp = MC.textSpan(it, p); return { k: 'text', it, start: sp.start, dur: sp.dur, linked: !!it.link }; }
      if (k === 'overlay' && S.ov && ovById(S.ov)) { const it = ovById(S.ov); return { k: 'overlay', it, start: it.start, dur: it.dur }; }
      if (k === 'layer' && layer()) { const l = layer(), sh = shot(), ts = l.ts || 0; return { k: 'layer', it: l, start: curStart() + ts, dur: (l.te == null ? sh.duration : l.te) - ts }; }
      const sh = shot(); return sh ? { k: 'shot', it: sh, start: curStart(), dur: sh.duration } : null;
    }
    const cloneShot = (sh) => { const c = JSON.parse(JSON.stringify(sh)); c.id = MC.uid(); c.layers.forEach((x) => { x.id = MC.uid(); }); return c; };
    /* divide el elemento seleccionado en un instante (clip de audio, texto, superposición o plano) */
    function splitAt(tm) {
      let T = tgt(); if (!T) return false;
      const p = S.project;
      if (!(tm > T.start + 0.1 && tm < T.start + T.dur - 0.1)) { MC.toast(t('Coloca el cabezal dentro del elemento seleccionado para dividirlo.', 'Place the playhead inside the selected item to split it.')); return false; }
      const it = T.it;
      if (T.k === 'layer') {
        const sh = shot(), loc = round2(tm - curStart()); it.segs = (it.segs || []).concat([{ id: MC.uid(), t: loc, assetId: MC.layerAsset(it, loc) }]); S.sg = layerRegions(it, sh).length - 1;
        S.open.capa_time = true; S.ptab.layer = 'time'; commit(); MC.announce(t('Capa dividida: ahora puedes reemplazar la ilustración del nuevo tramo', 'Layer split: you can now replace the illustration of the new part')); return true;
      }
      if (T.k === 'clip') { const b = Object.assign({}, it, { id: MC.uid(), start: tm, offset: it.offset + (tm - it.start), dur: it.start + it.dur - tm, fadeIn: 0 }); it.dur = tm - it.start; it.fadeOut = 0; p.clips.push(b); S.cl = b.id; }
      else if (T.k === 'text') {
        if (T.linked) { MC.toast(t('Este texto sigue a un clip de audio: divide el clip.', 'This text follows an audio clip: split the clip.')); return false; }
        const b = JSON.parse(JSON.stringify(it)); b.id = MC.uid(); b.start = round2(tm); b.dur = round2(it.start + it.dur - tm); it.dur = round2(tm - it.start); p.texts.push(b); S.tx = b.id;
      } else if (T.k === 'overlay') {
        const b = Object.assign(JSON.parse(JSON.stringify(it)), { id: MC.uid(), start: round2(tm), dur: round2(it.start + it.dur - tm), offset: (it.offset || 0) + (tm - it.start) * (it.speed || 1), audioClip: null }); it.dur = round2(tm - it.start); p.overlays.push(b); S.ov = b.id;
      } else {
        if (it.page || it.webtoon) { MC.toast(t('Las páginas y tiras no se dividen aquí.', 'Pages and strips cannot be split here.')); return false; }
        const loc = round2(tm - T.start), b = cloneShot(it); b.name = it.name + ' B'; b.transition = Object.assign({}, it.transition, { type: 'cut' }); b.duration = round2(it.duration - loc); it.duration = loc;
        b.layers.forEach((l) => { if (l.kf) l.kf.forEach((q) => { q.t = round2(q.t - loc); }); });
        p.shots.splice(S.si + 1, 0, b); S.si++; S.li = -1; S.selKind = 'shot';
      }
      commit(); MC.announce(t('Dividido', 'Split')); return true;
    }
    /* recorta el principio o el final del elemento seleccionado hasta el cabezal */
    function trimEdge(side) {
      let T = tgt(); if (!T) return;
      const p = S.project, tm = S.time;
      if (!(tm > T.start + 0.05 && tm < T.start + T.dur - 0.05)) { MC.toast(t('Coloca el cabezal dentro del elemento seleccionado.', 'Place the playhead inside the selected item.')); return; }
      const it = T.it, d = tm - T.start;
      if (T.linked) { MC.toast(t('Este texto sigue a un clip de audio: recorta el clip.', 'This text follows an audio clip: trim the clip.')); return; }
      if (T.k === 'layer') { const loc = round2(tm - curStart()); if (side === 'start') it.ts = loc; else it.te = loc; commit(); MC.announce(side === 'start' ? t('La capa aparece desde aquí', 'The layer now appears from here') : t('La capa desaparece aquí', 'The layer now disappears here')); return; }
      if (T.k === 'shot') {
        if (it.page || it.webtoon) { MC.toast(t('Las páginas y tiras no se recortan aquí.', 'Pages and strips cannot be trimmed here.')); return; }
        const nd = side === 'start' ? it.duration - d : d; if (nd < 0.3) return;
        if (S.ripple) { const rp = rippleBegin(T.start + it.duration); rippleApply(rp, nd - it.duration); }
        if (side === 'start') it.layers.forEach((l) => { if (l.kf) l.kf.forEach((q) => { q.t = round2(q.t - d); }); });
        it.duration = round2(nd); S.time = clamp(S.time, T.start, T.start + it.duration - 0.001);
      } else if (side === 'start') {
        const nd = T.dur - d; it.start = round2(tm); it.dur = round2(nd);
        if (T.k === 'clip') it.offset = (it.offset || 0) + d; else if (T.k === 'overlay') it.offset = (it.offset || 0) + d * (it.speed || 1);
      } else it.dur = round2(d);
      commit(); setTime(S.time); MC.announce(side === 'start' ? t('Principio recortado', 'Start trimmed') : t('Final recortado', 'End trimmed'));
    }
    /* reflejar en horizontal (x) o en vertical (y) */
    function flipSel(axis) {
      const T = tgt(); if (!T) return;
      const key = axis === 'x' ? (T.k === 'overlay' ? 'flip' : 'flipX') : 'flipY';
      if (T.k === 'layer' || T.k === 'overlay') T.it[key] = !T.it[key];
      else if (T.k === 'shot' && T.it.layers.length) { const on = !T.it.layers.every((l) => l[key]); T.it.layers.forEach((l) => { l[key] = on; }); }
      else { MC.toast(t('Selecciona una capa, una superposición o un plano con capas para reflejar.', 'Select a layer, an overlay or a shot with layers to flip.')); return; }
      commit(); MC.announce(axis === 'x' ? t('Reflejado en horizontal', 'Flipped horizontally') : t('Reflejado en vertical', 'Flipped vertically'));
    }
    /* abre los controles de recorte de la capa o de la superposición seleccionada */
    function openCrop() {
      const T = tgt();
      if (!T || (T.k !== 'layer' && T.k !== 'overlay')) { MC.toast(t('Selecciona una capa o una superposición para recortarla.', 'Select a layer or an overlay to crop it.')); return; }
      S.open[T.k === 'layer' ? 'capa_crop' : 'overlay_crop'] = true; S.ptab[T.k] = 'crop'; renderPanels();
      const n = el.inspBody.querySelector('[data-id="' + (T.k === 'layer' ? 'capa_crop' : 'overlay_crop') + '"]'); if (n) { n.scrollIntoView({ block: 'nearest' }); const f = n.querySelector('input'); if (f) f.focus(); }
    }
    const newKf = (it, local, props) => { const v = MC.kfValues(it.kf, local) || {}, q = { id: MC.uid(), t: round2(local), ease: 'smooth' }; (props || MC.KF_CORE).forEach((k) => { q[k] = v[k] == null ? (k === 'sc' || k === 'op' || k === 'sx' || k === 'sy' ? 1 : 0) : v[k]; }); return q; };
    function addKfHere() {
      const kt = kfTarget(); if (!kt) { MC.toast(t('Selecciona una capa, un texto o una superposición para añadir un fotograma clave.', 'Select a layer, a text or an overlay to add a keyframe.')); return; }
      const local = clamp(S.time - kt.start, 0, kt.dur), q = newKf(kt.it, local);
      kt.it.kf = (kt.it.kf || []).filter((z) => Math.abs(z.t - q.t) > 0.01).concat([q]); S.kfid = q.id; S.ptab[kt.kind] = 'anim'; commit(); MC.announce(t('Fotograma clave añadido', 'Keyframe added'));
    }
    function setTool(v) { S.tool = v; el.tlContent.classList.toggle('blade', v === 'blade'); refreshTlBar(); }
    function toggleSnap() { S.snapOn = !S.snapOn; MC.store.set('snapon', S.snapOn ? '1' : '0'); refreshTlBar(); MC.toast(S.snapOn ? t('Imán activado: se pega a cortes, marcadores y cabezal', 'Magnet on: snaps to cuts, markers and playhead') : t('Imán desactivado', 'Magnet off')); }
    /* altura de las filas de la línea de tiempo (zoom vertical): se recuerda y se aplica sobre la altura de fila de la interfaz */
    function applyRows() { const base = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lh')) || 34; studio.style.setProperty('--lh', Math.round(base * (S.rowK || 1)) + 'px'); }
    function zoomRows(f) { S.rowK = clamp(Math.round(S.rowK * f * 100) / 100, 0.6, 2.6); MC.store.set('tlrow', String(S.rowK)); applyRows(); renderTimeline(); refreshTlBar(); MC.announce(t('Altura de las filas ', 'Row height ') + Math.round(S.rowK * 100) + ' %'); }
    function zoomTl(f) { const sc = el.tlContent.parentNode, mid = sc ? (sc.scrollLeft + sc.clientWidth / 2) / S.pps : 0; S.pps = clamp(S.pps * f, 6, 400); renderTimeline(); if (sc) sc.scrollLeft = mid * S.pps - sc.clientWidth / 2; refreshTlBar(); }
    function fitTl() { const sc = el.tlContent.parentNode; if (!sc) return; S.pps = clamp((sc.clientWidth - 24) / Math.max(1, MC.totalTime(S.project)), 6, 400); renderTimeline(); sc.scrollLeft = 0; refreshTlBar(); }
    function refreshTlBar() {
      if (!el.tlBar) return;
      const T = tgt(), has = (k) => T && (T.k === k), canFlip = T && (T.k === 'layer' || T.k === 'overlay' || (T.k === 'shot' && T.it.layers && T.it.layers.length)), canCrop = has('layer') || has('overlay'), canKf = !!kfTarget();
      const set = (k, f) => { const b = el.tlBar.querySelector('[data-tb="' + k + '"]'); if (b) f(b); };
      set('undo', (b) => { b.disabled = S.hpos <= 0; }); set('redo', (b) => { b.disabled = S.hpos >= S.hist.length - 1; });
      set('sel', (b) => b.setAttribute('aria-pressed', String(S.tool === 'sel'))); set('blade', (b) => b.setAttribute('aria-pressed', String(S.tool === 'blade')));
      set('snap', (b) => b.setAttribute('aria-pressed', String(!!S.snapOn))); set('fine', (b) => b.setAttribute('aria-pressed', String(!!S.fine))); set('ripple', (b) => b.setAttribute('aria-pressed', String(!!S.ripple)));
      set('flipx', (b) => { b.disabled = !canFlip; }); set('flipy', (b) => { b.disabled = !canFlip; }); set('crop', (b) => { b.disabled = !canCrop; }); set('kf', (b) => { b.disabled = !canKf; }); set('group', (b) => { b.disabled = S.project.tl !== 'free' || !selectedOverlays().length; }); set('ungroup', (b) => { b.disabled = S.project.tl !== 'free' || !(S.xs && xById(S.xs)); });
      set('vzin', (b) => { b.disabled = S.rowK >= 2.59; }); set('vzout', (b) => { b.disabled = S.rowK <= 0.61; });
      set('zoom', (b) => { b.value = String(Math.round(Math.log(S.pps / 6) / Math.log(400 / 6) * 100)); });
      const lab = el.tlBar.querySelector('[data-tb="target"]'); if (lab) lab.textContent = T ? ({ clip: t('Audio', 'Audio'), text: t('Texto', 'Text'), overlay: t('Superposición', 'Overlay'), layer: t('Capa', 'Layer'), shot: t('Plano', 'Shot') })[T.k] : '';
    }
    /* en pantallas estrechas la barra enseña lo esencial y el resto sale de este menú */
    const ESSENTIAL = ['undo', 'redo', 'sel', 'blade', 'split', 'del', 'kf', 'snap', 'more', 'zout', 'zin', 'fit', 'target'];
    function moreTools(btn) {
      const items = [...el.tlBar.querySelectorAll('[data-tb]')].filter((b) => !ESSENTIAL.includes(b.dataset.tb) && b.dataset.tb !== 'zoom' && !b.hidden)
        .map((b) => ({ ic: b.dataset.ic || 'dots', l: (b.getAttribute('aria-label') || b.title || '').split(/[:(,]/)[0].trim(), dis: b.disabled, fn: () => b.click() }));
      const r = btn.getBoundingClientRect(), host = btn.closest('.studio') || studio;
      ctxMenu(host, r.left, r.top, t('Más herramientas', 'More tools'), items, true);
    }
    function tlToolbar() {
      const B = (key, icon, es, en, fn, extra) => h('button', Object.assign({ class: 'btn btn-g btn-ic tlb', type: 'button', 'data-tb': key, 'data-ic': icon, title: t(es, en), 'aria-label': t(es, en), onClick: fn }, extra || {}), MC.icon(icon, 18));
      const sep = () => h('span', { class: 'tlsep', 'aria-hidden': 'true' });
      el.tlBar = h('div', { class: 'tl-head', role: 'toolbar', 'aria-label': t('Herramientas de la línea de tiempo', 'Timeline tools') },
        B('undo', 'undo', 'Deshacer (Ctrl+Z)', 'Undo (Ctrl+Z)', () => undo()), B('redo', 'redo', 'Rehacer (Ctrl+Mayús+Z)', 'Redo (Ctrl+Shift+Z)', () => redo()), sep(),
        B('sel', 'select', 'Selección (V)', 'Select (V)', () => setTool('sel'), { 'aria-pressed': 'true' }), B('blade', 'blade', 'Cuchilla: pulsa sobre un clip para cortarlo ahí (X)', 'Blade: click a clip to cut it there (X)', () => setTool('blade'), { 'aria-pressed': 'false' }), sep(),
        B('split', 'cut', 'Dividir en el cabezal (S)', 'Split at the playhead (S)', () => splitAt(S.time)), B('trimL', 'trimL', 'Recortar el principio hasta el cabezal (Q)', 'Trim the start to the playhead (Q)', () => trimEdge('start')), B('trimR', 'trimR', 'Recortar el final desde el cabezal (W)', 'Trim the end from the playhead (W)', () => trimEdge('end')),
        B('del', 'trash', 'Eliminar lo seleccionado (Supr)', 'Delete selection (Del)', () => { if (ACT.delete() === false) MC.toast(t('No hay nada que eliminar.', 'Nothing to delete.')); }), sep(),
        B('flipx', 'flipH', 'Reflejar en horizontal', 'Flip horizontally', () => flipSel('x')), B('flipy', 'flipV', 'Reflejar en vertical', 'Flip vertically', () => flipSel('y')), B('crop', 'crop', 'Recortar la imagen o el vídeo', 'Crop the image or video', openCrop),
        B('kf', 'diamond', 'Añadir un fotograma clave en el cabezal', 'Add a keyframe at the playhead', addKfHere), B('curves', 'curve', 'Editor de curvas de los fotogramas clave', 'Keyframe curve editor', () => openGraph()), sep(),
        B('marker', 'bookmark', 'Marcador con nota en el cabezal (M)', 'Marker with a note at the playhead (M)', () => addMarker('note')), B('dup', 'copy', 'Duplicar lo seleccionado (Ctrl+D)', 'Duplicate selection (Ctrl+D)', () => { if (!dupSelection()) MC.toast(t('Selecciona un clip, un texto o una superposición.', 'Select a clip, text or overlay.')); }), sep(),
        B('fine', 'crosshair', 'Precisión: arrastrar con más finura (o mantén Mayús)', 'Precision: drag more finely (or hold Shift)', () => { S.fine = !S.fine; refreshTlBar(); MC.toast(S.fine ? t('Precisión activada: los arrastres van a un cuarto de velocidad', 'Precision on: drags move at a quarter speed') : t('Precisión desactivada', 'Precision off')); }, { 'aria-pressed': 'false' }),
        B('snap', 'magnet', 'Imán: se pega a cortes, marcadores y cabezal (N)', 'Magnet: snaps to cuts, markers and playhead (N)', toggleSnap, { 'aria-pressed': String(!!S.snapOn) }),
        B('ripple', 'ripple', 'Ripple: al cambiar la duración de un plano, lo de detrás lo sigue', 'Ripple: when a shot’s length changes, everything after follows', () => { S.ripple = !S.ripple; MC.store.set('ripple', S.ripple ? '1' : '0'); refreshTlBar(); MC.toast(S.ripple ? t('Ripple activado: lo de detrás sigue al plano', 'Ripple on: later items follow the shot') : t('Ripple desactivado', 'Ripple off')); }, { 'aria-pressed': String(!!S.ripple) }), sep(),
        B('addshot', 'plus', 'Planos desde imágenes', 'Shots from images', () => fileShots.click()),
        B('addov', 'layersx', 'Añadir una imagen o un vídeo encima de la ilustración, en su propia pista', 'Add an image or video above the artwork, on its own track', () => { fileOv.dataset.track = 0; fileOv.click(); }),
        B('group', 'layersx', 'Agrupar los clips elegidos en una capa agrupada (línea de tiempo por pistas)', 'Group the picked clips into a grouped layer (by-tracks timeline)', groupSelected), B('ungroup', 'layers', 'Desagrupar la capa agrupada elegida', 'Ungroup the picked grouped layer', ungroupSelected),
        B('addx', 'film', 'Plano superpuesto: otro plano a la vez que el principal', 'Overlapping shot: another shot at the same time as the main one', () => { if (S.project.xtracks.length < 1) S.project.xtracks.push({ id: MC.uid(), name: t('Planos superpuestos 1', 'Overlapping shots 1'), visible: true }); addXShotFromPicker(); }),
        B('addtrack', 'layers', 'Añadir otra pista de superposición (hasta 6)', 'Add another overlay track (up to 6)', () => { const o2 = S.project.otracks; if (o2.length >= 6) { MC.toast(t('Máximo 6 pistas de superposición.', 'At most 6 overlay tracks.')); return; } o2.push(MC.newOtrack(o2.length + 1)); commit(); }),
        B('more', 'dots', 'Más herramientas', 'More tools', (e) => moreTools(e.currentTarget), { 'aria-haspopup': 'menu' }),
        h('span', { class: 'tlfill' }), h('span', { class: 'eyebrow', 'data-tb': 'target' }),
        B('zout', 'minus', 'Alejar', 'Zoom out', () => zoomTl(1 / 1.3)),
        h('input', { class: 'tlzoom', type: 'range', min: 0, max: 100, step: 1, 'data-tb': 'zoom', 'aria-label': t('Zoom de la línea de tiempo', 'Timeline zoom'), title: t('Zoom de la línea de tiempo (Ctrl + rueda)', 'Timeline zoom (Ctrl + wheel)'), onInput: (e) => { const sc = el.tlContent.parentNode, mid = sc ? (sc.scrollLeft + sc.clientWidth / 2) / S.pps : 0; S.pps = 6 * Math.pow(400 / 6, e.target.value / 100); renderTimeline(); if (sc) sc.scrollLeft = mid * S.pps - sc.clientWidth / 2; } }),
        B('zin', 'plus', 'Acercar', 'Zoom in', () => zoomTl(1.3)), B('fit', 'fit', 'Ajustar toda la línea de tiempo a la pantalla', 'Fit the whole timeline to the screen', fitTl),
        B('vzin', 'down', 'Filas más altas (Alt + rueda)', 'Taller rows (Alt + wheel)', () => zoomRows(1.2)), B('vzout', 'up', 'Filas más bajas (Alt + rueda)', 'Shorter rows (Alt + wheel)', () => zoomRows(1 / 1.2)),
        el.tlTime, dockCtl('timeline'));
      /* cuchilla: pulsar sobre un clip lo corta justo ahí */
      el.tlContent.addEventListener('pointerdown', (e) => {
        if (S.tool !== 'blade' || e.button) return; const c = e.target.closest && e.target.closest('.clip'); if (!c) return;
        const d = c.dataset; let tm = (e.clientX - el.tlContent.getBoundingClientRect().left) / MC.uz() / S.pps; if (S.snapOn) tm = snapT(tm);
        if (d.c) { S.cl = d.c; S.selKind = 'clip'; } else if (d.x) { S.tx = d.x; S.selKind = 'text'; } else if (d.o) { S.ov = d.o; S.selKind = 'overlay'; } else if (d.i != null) { S.si = +d.i; S.li = -1; S.selKind = 'shot'; } else return;
        e.preventDefault(); e.stopPropagation(); splitAt(tm);
      }, true);
      el.tlContent.addEventListener('wheel', (e) => { if (e.altKey && !e.ctrlKey) { e.preventDefault(); zoomRows(e.deltaY < 0 ? 1.12 : 1 / 1.12); return; } if (!e.ctrlKey) return; e.preventDefault(); zoomTl(e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
      return el.tlBar;
    }

    /* ---------- editor de curvas de los fotogramas clave (estilo After Effects) ---------- */
    const GR = [['x', 'Posición X', 'Move X', -1, 1, '#ff6b6b'], ['y', 'Posición Y', 'Move Y', -1, 1, '#51cf66'], ['sc', 'Escala', 'Scale', 0.1, 3, '#ffd43b'], ['sx', 'Ancho', 'Width', 0.1, 3, '#ffa94d'], ['sy', 'Alto', 'Height', 0.1, 3, '#f783ac'],
      ['rot', 'Giro', 'Rotation', -360, 360, '#74c0fc'], ['op', 'Opacidad', 'Opacity', 0, 1, '#d0bfff'], ['rx', 'Giro X 3D', 'Turn X 3D', -180, 180, '#63e6be'], ['ry', 'Giro Y 3D', 'Turn Y 3D', -180, 180, '#a9e34b']];
    S.gr = { prop: 'x' };
    const SVGNS = 'http://www.w3.org/2000/svg';
    const sv = (name, attrs, ...kids) => { const n = document.createElementNS(SVGNS, name); Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k])); kids.forEach((c) => c && n.append(c)); return n; };
    function openGraph() {
      if (S.ws !== 'montaje') setWs('montaje');
      S.tab.montaje = 'curvas'; LY.hl = false; applyLayout(); renderRail(); renderPanels();
    }
    function graphPanel() {
      const kt = kfTarget(), out = [];
      el.grSvg = null;
      if (!kt) return [h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Curvas de animación', 'Animation curves')),
        h('p', { class: 'cap' }, t('Selecciona una capa, un texto o una superposición en la línea de tiempo o en Capas, y añade fotogramas clave (el rombo de la barra de la línea de tiempo). Aquí verás sus curvas y podrás moverlas.', 'Select a layer, a text or an overlay in the timeline or in Layers and add keyframes (the diamond in the timeline toolbar). Here you will see its curves and can move them.')))];
      const it = kt.it, P = GR.find((g) => g[0] === S.gr.prop) || GR[0], list = () => (it.kf || []).filter((q) => q[P[0]] != null).sort((a, b) => a.t - b.t);
      const key = P[0], defV = (k) => (k === 'sc' || k === 'op' || k === 'sx' || k === 'sy' ? 1 : 0);
      const W = 320, Hh = 230, ML = 40, MR = 8, MT = 10, MB = 18, PW = W - ML - MR, PH = Hh - MT - MB;
      const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + Hh, class: 'grsvg', role: 'img', 'aria-label': t('Gráfica de la curva de ', 'Curve graph of ') + t(P[1], P[2]) });
      el.grSvg = svg;
      let drag = false;
      const range = () => {
        const ks = list(), vals = ks.map((q) => (q[key] == null ? defV(key) : q[key])); let lo = Math.min.apply(null, vals.concat([defV(key)])), hi = Math.max.apply(null, vals.concat([defV(key)]));
        if (ks.length > 1) for (let i = 0; i <= 60; i++) { const v = MC.kfValues(ks, ks[0].t + (ks[ks.length - 1].t - ks[0].t) * i / 60)[key]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
        const minSpan = { x: 0.2, y: 0.2, sc: 0.5, sx: 0.5, sy: 0.5, rot: 40, op: 1, rx: 40, ry: 40 }[key], span = Math.max(hi - lo, minSpan), mid = (hi + lo) / 2;
        return [mid - span * 0.65, mid + span * 0.65];
      };
      const tx = (tm) => ML + (tm / Math.max(0.1, kt.dur)) * PW;
      const draw = () => {
        const [lo, hi] = range(), vy = (v) => MT + PH - ((v - lo) / (hi - lo)) * PH, ks = list();
        while (svg.firstChild) svg.firstChild.remove();
        svg.append(sv('rect', { x: ML, y: MT, width: PW, height: PH, class: 'grbg' }));
        for (let i = 0; i <= 4; i++) { const v = lo + ((hi - lo) * i) / 4, y = vy(v); svg.append(sv('line', { x1: ML, x2: ML + PW, y1: y, y2: y, class: 'grgrid' })); const tl = sv('text', { x: ML - 4, y: y + 3, class: 'grlab', 'text-anchor': 'end' }); tl.textContent = (Math.abs(hi - lo) < 5 ? v.toFixed(2) : Math.round(v)); svg.append(tl); }
        const nT = Math.min(8, Math.max(2, Math.floor(kt.dur))); for (let i = 0; i <= nT; i++) { const tm = (kt.dur * i) / nT, x = tx(tm); svg.append(sv('line', { x1: x, x2: x, y1: MT, y2: MT + PH, class: 'grgrid' })); const tl = sv('text', { x, y: Hh - 4, class: 'grlab', 'text-anchor': 'middle' }); tl.textContent = tm.toFixed(1) + 's'; svg.append(tl); }
        if (ks.length) {
          let d = ''; const t0 = 0, t1 = kt.dur;
          for (let i = 0; i <= 120; i++) { const tm = t0 + ((t1 - t0) * i) / 120, v = MC.kfValues(ks, tm)[key]; d += (i ? 'L' : 'M') + tx(tm).toFixed(1) + ' ' + vy(v).toFixed(1); }
          svg.append(sv('path', { d, class: 'grcurve', stroke: P[5] }));
        }
        const lt = clamp(S.time - kt.start, 0, kt.dur); svg.append(sv('line', { x1: tx(lt), x2: tx(lt), y1: MT, y2: MT + PH, class: 'grplay' }));
        const sel = ks.findIndex((q) => q.id === S.kfid), nx = sel >= 0 ? ks[sel + 1] : null;
        if (sel >= 0 && nx) {
          const q = ks[sel], b = MC.curveBez(q.ease || 'smooth'), v0 = q[key] == null ? defV(key) : q[key], v1 = nx[key] == null ? defV(key) : nx[key], dv = Math.abs(v1 - v0) > 1e-4 ? v1 - v0 : (hi - lo) * 0.25;
          const hp = (xx, yy) => [tx(q.t + xx * (nx.t - q.t)), vy(v0 + yy * dv)], h1 = hp(b[0], b[1]), h2 = hp(b[2], b[3]), p0 = [tx(q.t), vy(v0)], p1 = [tx(nx.t), vy(v1)];
          svg.append(sv('line', { x1: p0[0], y1: p0[1], x2: h1[0], y2: h1[1], class: 'grhl' }), sv('line', { x1: p1[0], y1: p1[1], x2: h2[0], y2: h2[1], class: 'grhl' }));
          [[h1, 0], [h2, 1]].forEach(([pt, idx]) => {
            const c = sv('circle', { cx: pt[0], cy: pt[1], r: 5.5, class: 'grhandle', tabindex: '0', 'aria-label': t('Tirador de la curva ', 'Curve handle ') + (idx + 1) });
            c.addEventListener('pointerdown', (e) => {
              e.stopPropagation(); e.preventDefault(); c.setPointerCapture(e.pointerId); drag = true; const r = svg.getBoundingClientRect(), f = W / r.width;
              const mv = (ev) => {
                const px = (ev.clientX - r.left) * f, py = (ev.clientY - r.top) * f, bb = MC.curveBez(q.ease || 'smooth').slice();
                const xx = clamp((px - tx(q.t)) / Math.max(1, tx(nx.t) - tx(q.t)), 0, 1), val = lo + ((MT + PH - py) / PH) * (hi - lo), yy = clamp((val - v0) / dv, -1.5, 2.5);
                bb[idx * 2] = Math.round(xx * 100) / 100; bb[idx * 2 + 1] = Math.round(yy * 100) / 100; q.ease = { b: bb }; S.dirty = true; touch(); draw();
              };
              const up = () => { c.removeEventListener('pointermove', mv); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); drag = false; commit(); };
              c.addEventListener('pointermove', mv); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
            });
            svg.append(c);
          });
        }
        ks.forEach((q) => {
          const v = q[key] == null ? defV(key) : q[key], c = sv('rect', { x: tx(q.t) - 5, y: vy(v) - 5, width: 10, height: 10, class: 'grkey' + (q.id === S.kfid ? ' on' : ''), transform: 'rotate(45 ' + tx(q.t) + ' ' + vy(v) + ')', tabindex: '0', role: 'button', 'aria-label': t('Fotograma clave en ', 'Keyframe at ') + q.t.toFixed(2) + ' s' });
          c.addEventListener('pointerdown', (e) => {
            e.stopPropagation(); e.preventDefault(); c.setPointerCapture(e.pointerId); const sameSel = S.kfid === q.id; S.kfid = q.id; drag = true; const r = svg.getBoundingClientRect(), f = W / r.width; let moved = false;
            const mv = (ev) => {
              const px = (ev.clientX - r.left) * f, py = (ev.clientY - r.top) * f; moved = true;
              q.t = round2(clamp(((px - ML) / PW) * kt.dur, 0, kt.dur));
              const [l2, h2] = range(), val = l2 + ((MT + PH - py) / PH) * (h2 - l2), lim = P; q[key] = Math.round(clamp(val, lim[3], lim[4]) * 1000) / 1000;
              S.dirty = true; touch(); draw(); layoutClips();
            };
            const up = () => { c.removeEventListener('pointermove', mv); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); drag = false; if (moved) commit(); else { setTime(kt.start + clamp(q.t, 0, Math.max(0, kt.dur - 0.001))); renderPanels(); renderTimeline(); } };
            c.addEventListener('pointermove', mv); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
            if (!sameSel) draw();
          });
          svg.append(c);
        });
      };
      svg.addEventListener('dblclick', (e) => {
        const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width); if (px < ML || px > ML + PW) return;
        const local = round2(clamp(((px - ML) / PW) * kt.dur, 0, kt.dur)), q = newKf(it, local, [key]); it.kf = (it.kf || []).concat([q]); S.kfid = q.id; commit();
      });
      svg.addEventListener('pointerdown', (e) => { if (drag || e.target !== svg.firstChild && e.target.tagName !== 'svg' && e.target.getAttribute('class') !== 'grbg') return; const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width); if (px < ML || px > ML + PW) return; setTime(kt.start + clamp(((px - ML) / PW) * kt.dur, 0, Math.max(0, kt.dur - 0.001))); });
      draw(); el.grDraw = () => { if (!drag && svg.isConnected) draw(); };
      out.push(h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Curvas de animación', 'Animation curves')),
        h('p', { class: 'cap' }, t('Arrastra un rombo para cambiar su momento y su valor. Con uno seleccionado salen dos tiradores: tíralos para suavizar o endurecer el movimiento hasta el siguiente. Doble clic en la gráfica crea un fotograma clave.', 'Drag a diamond to change its time and value. With one selected, two handles appear: pull them to ease or sharpen the motion to the next one. Double-click the graph to create a keyframe.')),
        h('div', { class: 'grchips', role: 'group', 'aria-label': t('Propiedad', 'Property') }, GR.map((g) => h('button', { type: 'button', class: 'grchip', style: { '--c': g[5] }, 'aria-pressed': String(g[0] === key), onClick: () => { S.gr.prop = g[0]; renderPanels(); } }, t(g[1], g[2])))),
        svg,
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' } },
          h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: addKfHere }, MC.icon('diamond', 14), t('Fotograma clave aquí', 'Keyframe here')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !(it.kf || []).length, onClick: () => { (it.kf || []).forEach((q) => { q.ease = 'smooth'; }); commit(); } }, t('Suavizar todas', 'Ease all')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !(it.kf || []).length, onClick: () => { (it.kf || []).forEach((q) => { q.ease = 'linear'; }); commit(); } }, t('Lineal', 'Linear')),
          h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', disabled: !S.kfid || !(it.kf || []).some((q) => q.id === S.kfid), onClick: () => { it.kf = it.kf.filter((q) => q.id !== S.kfid); S.kfid = null; commit(); } }, MC.icon('trash', 14), t('Borrar el seleccionado', 'Delete selected')))));
      const cur = (it.kf || []).find((q) => q.id === S.kfid);
      if (cur) out.push(h('div', { class: 'box' }, h('div', { class: 'eyebrow' }, t('Curva hasta el siguiente fotograma clave', 'Curve to the next keyframe')), MC.ui.curveEditor(cur.ease || 'smooth', (v) => { cur.ease = v; S.dirty = true; touch(); if (el.grDraw) el.grDraw(); }, commit)));
      return out;
    }

    /* ---------- precisión, aviso de deshacer, gestos y menú contextual ---------- */
    S.fine = false;
    /* arrastre fino: con el modo «precisión» o con Mayús, el cursor o el dedo mueven una cuarta parte */
    const fineDx = (ev, x0) => ((ev.clientX - x0) / MC.uz()) * (S.fine || ev.shiftKey ? 0.25 : 1);
    const undoToast = (msg) => MC.toast(msg, { label: t('Deshacer', 'Undo'), onClick: () => undo(), ms: 7000 });
    const askName = (title, cur, cb) => {
      const inp = h('input', { class: 'input', value: cur || '', 'aria-label': title }); let m = null;
      const ok = () => { const v = inp.value.trim(); if (m) m.close(); if (v) cb(v); };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); e.stopPropagation(); });
      m = MC.modal(title, inp, (close) => [h('button', { class: 'btn btn-g', type: 'button', onClick: close }, t('Cancelar', 'Cancel')), h('button', { class: 'btn btn-p', type: 'button', onClick: ok }, t('Guardar', 'Save'))]);
      setTimeout(() => inp.select(), 60);
    };
    function dupShot() {
      const p = S.project, sh = shot(); if (!sh) return;
      const c = cloneShot(sh); c.name += ' 2'; p.shots.splice(S.si + 1, 0, c); S.si++; S.li = -1; S.selKind = 'shot'; commit(); MC.announce(t('Plano duplicado', 'Shot duplicated'));
    }
    function closeCtx() { qAll('.ctxmenu').forEach((n) => n.remove()); }
    function ctxMenu(host, x, y, title, items, above) {
      closeDockMenu(); closeCtx();
      const menu = h('div', { class: 'dockmenu ctxmenu', role: 'menu', 'aria-label': title, onKeydown: (e) => {
        const bs = [...menu.querySelectorAll('button:not([disabled])')], i = bs.indexOf(host.ownerDocument.activeElement);
        if (e.key === 'Escape') { closeCtx(); e.stopPropagation(); } else if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
      } }, h('div', { class: 'eyebrow' }, title), items.filter(Boolean).map((i) => (i === '-' ? h('hr', { role: 'separator' }) : h('button', { type: 'button', role: 'menuitem', disabled: !!i.dis, onClick: () => { closeCtx(); i.fn(); } }, MC.icon(i.ic || 'dots', 14), i.l))));
      host.append(menu);
      const f = zf(host), hr = host.getBoundingClientRect(), w = menu.offsetWidth, hh = menu.offsetHeight;
      menu.style.left = clamp((x - hr.left) / f, 4, Math.max(4, host.offsetWidth - w - 4)) + 'px'; menu.style.top = clamp((y - hr.top) / f - (above ? hh + 6 : 0), 4, Math.max(4, host.offsetHeight - hh - 4)) + 'px';
      const first = menu.querySelector('button:not([disabled])'); if (first) first.focus();
    }
    /* qué hay bajo el cursor o el dedo y lo selecciona */
    function ctxFor(e) {
      const n0 = e.target; if (!n0 || !n0.closest) return null;
      const rc = el.tlContent.getBoundingClientRect(), tm = clamp((e.clientX - rc.left) / MC.uz() / S.pps, 0, MC.totalTime(S.project));
      let n;
      if ((n = n0.closest('.kfd')) && kfTarget()) { S.kfid = n.dataset.kf; S.kfpd = n.dataset.kp || null; return { k: 'kf', tm }; }
      if ((n = n0.closest('.lyrbar'))) { const si = +n.dataset.si, li = +n.dataset.li, sg = n0.closest('.lseg'); if (S.si !== si) selectShot(si, false); S.li = li; S.selKind = 'layer'; S.tx = S.cl = S.ov = null; if (sg) S.sg = +sg.dataset.r; return { k: 'layer', tm, bar: true }; }
      if ((n = n0.closest('.lrow2'))) { S.li = +n.dataset.idx; S.selKind = 'layer'; S.tx = S.cl = S.ov = null; return { k: 'layer', tm: S.time, bar: false }; }
      if ((n = n0.closest('.clip[data-c]'))) { S.cl = n.dataset.c; S.selKind = 'clip'; S.tx = S.ov = null; S.li = -1; S.multi = []; return { k: 'clip', tm }; }
      if ((n = n0.closest('.clip[data-x]'))) { S.tx = n.dataset.x; S.selKind = 'text'; S.cl = S.ov = null; S.li = -1; S.multi = []; return { k: 'text', tm }; }
      if ((n = n0.closest('.clip[data-o]'))) { if (!(S.multi.length > 1 && S.multi.includes('o:' + n.dataset.o))) { S.ov = n.dataset.o; S.selKind = 'overlay'; S.cl = S.tx = null; S.li = -1; S.multi = []; } return { k: 'overlay', tm }; }
      if ((n = n0.closest('.clip[data-xs]'))) { selectXs(n.dataset.xs, false); return { k: 'xshot', tm }; }
      if ((n = n0.closest('.clip[data-s]'))) { S.sb = n.dataset.s; S.selKind = 'subs'; return { k: 'subs', tm }; }
      if ((n = n0.closest('.clip[data-i]'))) { selectShot(+n.dataset.i, false); S.selKind = 'shot'; return { k: 'shot', tm }; }
      if ((n = n0.closest('.trl.ot'))) return { k: 'otrack', tm, i: +n.dataset.k.slice(1) };
      if (n0.closest('.tl-track.kft')) return { k: 'kftrack', tm };
      return null;
    }
    function ctxItems(c) {
      const p = S.project, I = (ic, l, fn, dis) => ({ ic, l, fn, dis }), tm = round2(c.tm), at = () => { if (c.bar !== false) setTime(tm); };
      const split = I('cut', t('Dividir aquí', 'Split here'), () => { at(); splitAt(S.time); }), del = I('trash', t('Eliminar', 'Delete'), () => { if (ACT.delete() === false) MC.toast(t('No hay nada que eliminar.', 'Nothing to delete.')); });
      const kf = I('diamond', t('Fotograma clave aquí', 'Keyframe here'), () => { at(); addKfHere(); });
      const flips = [I('flipH', t('Reflejar en horizontal', 'Flip horizontally'), () => flipSel('x')), I('flipV', t('Reflejar en vertical', 'Flip vertically'), () => flipSel('y'))];
      if (c.k === 'shot') return [split, I('copy', t('Duplicar el plano', 'Duplicate the shot'), dupShot), I('edit', t('Renombrar', 'Rename'), () => { const sh = shot(); askName(t('Nombre del plano', 'Shot name'), sh.name, (v) => { sh.name = v; commit(); }); }), I('layers', S.expand[shot().id] ? t('Plegar las capas', 'Fold the layers') : t('Ver las capas', 'Show the layers'), () => { const sh = shot(); S.expand[sh.id] = !S.expand[sh.id]; renderTimeline(); }), '-', del];
      if (c.k === 'layer') { const l = layer(), sh = shot(); return [split, I('image', t('Reemplazar la ilustración de este tramo', 'Replace this part’s illustration'), () => pickReplace(l, S.sg || 0), !!(l && l.locked)), '-', ...flips, I('crop', t('Recortar…', 'Crop…'), openCrop), kf, '-', I('copy', t('Duplicar la capa', 'Duplicate the layer'), dupLayer), I('edit', t('Renombrar', 'Rename'), () => askName(t('Nombre de la capa', 'Layer name'), l.name, (v) => { l.name = v; commit(); })), I(l && l.locked ? 'unlock' : 'lock', l && l.locked ? t('Desbloquear', 'Unlock') : t('Bloquear', 'Lock'), () => { l.locked = !l.locked; commit(); }), '-', I('trash', t('Eliminar la capa', 'Delete the layer'), () => { if (l.locked) MC.toast(t('La capa está bloqueada. Desbloquéala para borrarla.', 'The layer is locked. Unlock it to delete it.')); else { delLayer(S.li); } })]; }
      if (c.k === 'clip') return [split, I('trimL', t('Recortar el principio hasta aquí', 'Trim the start to here'), () => { at(); trimEdge('start'); }), I('trimR', t('Recortar el final desde aquí', 'Trim the end from here'), () => { at(); trimEdge('end'); }), I('copy', t('Duplicar', 'Duplicate'), dupSelection), '-', del];
      if (c.k === 'text') return [split, kf, I('copy', t('Duplicar', 'Duplicate'), dupSelection), '-', del];
      const grp = S.project.tl === 'free' ? [I('layersx', t('Agrupar en una capa agrupada', 'Group into a grouped layer'), groupSelected), '-'] : [];
      if (c.k === 'overlay') return [...grp, split, '-', ...flips, I('crop', t('Recortar…', 'Crop…'), openCrop), kf, I('copy', t('Duplicar', 'Duplicate'), dupSelection), '-', del];
      if (c.k === 'xshot' && S.project.tl === 'free') return [I('layers', t('Desagrupar', 'Ungroup'), ungroupSelected), I('edit', t('Renombrar', 'Rename'), () => { const x = xById(S.xs); if (x) askName(t('Nombre de la capa agrupada', 'Grouped layer name'), x.name, (v) => { x.name = v; commit(); }); }), '-', del];
      if (c.k === 'xshot' || c.k === 'subs') return [del];
      if (c.k === 'kf') { const kt = kfTarget(), q = kt && (kt.it.kf || []).find((z) => z.id === S.kfid); return [I('play', t('Ir a este fotograma clave', 'Go to this keyframe'), () => { if (q) setTime(kt.start + clamp(q.t, 0, Math.max(0, kt.dur - 0.001))); }), I('curve', t('Movimiento suave hasta el siguiente', 'Smooth motion to the next'), () => { if (q) { q.ease = 'smooth'; commit(); } }), I('minus', t('Movimiento lineal', 'Linear motion'), () => { if (q) { q.ease = 'linear'; commit(); } }), '-', ...(S.kfpd ? [I('trash', t('Eliminar solo ', 'Delete only ') + kfPropName(S.kfpd), () => { if (kt && q) { kfDelProp(kt.it, q, S.kfpd); S.kfid = null; commit(); } })] : []), I('trash', S.kfpd ? t('Eliminar el fotograma clave entero', 'Delete the whole keyframe') : t('Eliminar el fotograma clave', 'Delete the keyframe'), () => { if (kt && q) { kt.it.kf = kt.it.kf.filter((z) => z.id !== q.id); S.kfid = null; commit(); } })]; }
      if (c.k === 'kftrack') return [I('diamond', t('Fotograma clave aquí', 'Keyframe here'), () => { setTime(clamp(tm, 0, MC.totalTime(p) - 0.001)); addKfHere(); })];
      if (c.k === 'otrack') { const ot = p.otracks[c.i], busy = p.overlays.some((o) => o.track === c.i); return [I('edit', t('Renombrar la pista', 'Rename the track'), () => askName(t('Nombre de la pista', 'Track name'), ot.name, (v) => { ot.name = v; commit(); })), I('plus', t('Añadir una superposición aquí', 'Add an overlay here'), () => { fileOv.dataset.track = c.i; fileOv.click(); }), I('trash', t('Quitar la pista vacía', 'Remove the empty track'), () => { p.overlays.forEach((o) => { if (o.track > c.i) o.track--; }); p.otracks.splice(c.i, 1); commit(); }, busy || p.otracks.length < 2)]; }
      return [];
    }

    /* ---------- clic derecho en toda la interfaz: ocultar lo que se puede ocultar y atajos a lo demás ---------- */
    function hideLabel(id) {
      const C = MC.cfg; let r;
      if (id.startsWith('tb:')) { r = C.TB.find((q) => 'tb:' + q[0] === id); if (id === 'tb:zoom') return t('Zoom de la línea de tiempo', 'Timeline zoom'); }
      else if (id.startsWith('tab:m:')) r = C.TABS_M.find((q) => 'tab:m:' + q[0] === id);
      else if (id.startsWith('tab:c:')) r = C.TABS_C.find((q) => 'tab:c:' + q[0] === id);
      else if (id.startsWith('ws:')) r = C.WSS.find((q) => 'ws:' + q[0] === id);
      return r ? t(r[1], r[2]) : id;
    }
    function confirmHide(id, name) {
      MC.modal(t('¿Ocultar «' + name + '»?', 'Hide “' + name + '”?'), h('div', { style: { display: 'grid', gap: '8px' } },
        h('p', null, t('Dejará de verse en la interfaz. No se borra nada: sigue funcionando con su atajo de teclado.', 'It will no longer show in the interface. Nothing is deleted: it keeps working with its keyboard shortcut.')),
        h('p', { class: 'cap' }, t('Para recuperarlo: clic derecho en la barra → «Mostrar…», o Preferencias → Interfaz.', 'To get it back: right-click the bar → “Show…”, or Preferences → Interface.'))),
        (close) => [h('button', { class: 'btn btn-g', type: 'button', onClick: close }, t('Cancelar', 'Cancel')),
          h('button', { class: 'btn btn-p', type: 'button', onClick: () => { close(); MC.cfg.set(id, true); MC.toast(t('Oculto: ', 'Hidden: ') + name, { label: t('Deshacer', 'Undo'), onClick: () => MC.cfg.set(id, false), ms: 8000 }); } }, t('Ocultar', 'Hide'))]);
    }
    function hideTargetFor(n0) {
      const C = MC.cfg; let n;
      if ((n = n0.closest('[data-tb]')) && n.dataset.tb !== 'target') { const k = n.dataset.tb, g = Object.keys(C.TB_GROUPS).find((q) => C.TB_GROUPS[q].includes(k)); return { id: 'tb:' + (g || k), kind: 'bar' }; }
      if ((n = n0.closest('.rail [data-tab]'))) return { id: 'tab:' + (S.ws === 'montaje' ? 'm' : 'c') + ':' + n.dataset.tab, kind: 'rail' };
      if ((n = n0.closest('.s-tabs [data-ws]')) && n.dataset.ws === 'creativo') return { id: 'ws:' + n.dataset.ws, kind: 'ws' };
      return null;
    }
    function uiCtx(e, host) {
      const n0 = e.target; if (!n0 || !n0.closest) return false;
      const C = MC.cfg, I = (ic, l, fn, dis) => ({ ic, l, fn, dis });
      let n, title = t('Interfaz', 'Interface'); const items = [];
      /* cabecera de un panel: mismo menú que el botón ⋮ */
      if ((n = n0.closest('.ph')) && !n0.closest('button')) { const dc = n.querySelector('.dockctl[data-pid]'); if (dc) { closeCtx(); panelMenu(dc.dataset.pid, dc.querySelector('button[aria-haspopup]')); return true; } }
      const tg = hideTargetFor(n0);
      if (tg) { const nm = hideLabel(tg.id); title = nm; items.push(I('close', t('Ocultar «' + nm + '»…', 'Hide “' + nm + '”…'), () => confirmHide(tg.id, nm))); }
      /* visor */
      if (!tg && n0.closest('.stage, .viewer')) {
        title = t('Visor', 'Viewer');
        items.push(I('frame', t('Ajustar al visor', 'Fit to viewer'), () => fit()), I('frame', t('Pantalla completa (F)', 'Full screen (F)'), () => ACT.fullscreen()),
          I('frame', S.guides ? t('Quitar las guías', 'Hide guides') : t('Mostrar guías', 'Show guides'), () => { S.guides = !S.guides; S.dirty = true; renderVbar(); }), I('sliders', S.rulers ? t('Quitar las reglas', 'Hide rulers') : t('Mostrar reglas', 'Show rulers'), () => { S.rulers = !S.rulers; S.dirty = true; renderVbar(); }));
      }
      /* cabecera de pista de la línea de tiempo */
      if (!tg && (n = n0.closest('.trl[data-k]')) && !/^[ox]\d+$/.test(n.dataset.k) && n.dataset.k !== 'kf') {
        const k = n.dataset.k; title = trackName(k);
        if (hasEye(k)) items.push(I(AU.includes(k) ? 'speaker' : 'eye', trackOff(k) ? t('Volver a mostrar / activar la pista', 'Show / turn the track back on') : AU.includes(k) ? t('Silenciar la pista', 'Mute the track') : t('Quitar la pista del vídeo', 'Take the track out of the video'), () => { setTrackOff(k, !trackOff(k)); commit(); }));
        items.push(I('up', t('Plegar la fila', 'Fold the row'), () => { setTrackFold(k, true); commit(); }), I('layers', t('Gestionar las pistas…', 'Manage tracks…'), () => openTracksMenu()));
      }
      const hidden = C.list().filter((id) => hideLabel(id) !== id);
      if (tg || hidden.length) {
        if (hidden.length) { if (items.length) items.push('-'); hidden.slice(0, 6).forEach((id) => items.push(I('eye', t('Mostrar «' + hideLabel(id) + '»', 'Show “' + hideLabel(id) + '”'), () => C.set(id, false)))); items.push(I('undo', t('Mostrar todo lo oculto (' + hidden.length + ')', 'Show everything hidden (' + hidden.length + ')'), () => C.reset())); }
      }
      if (items.length) items.push('-');
      items.push(I('sliders', t('Personalizar la interfaz…', 'Customize the interface…'), () => MC.openPrefs('ui')), I('text', t('Atajos y ayuda…', 'Shortcuts and help…'), () => MC.openHelp()));
      ctxMenu(host, e.clientX, e.clientY, title, items); return true;
    }
    function openCtx(e, host) {
      const c = ctxFor(e); if (!c) return uiCtx(e, host);
      renderPanels(); renderLayers(); renderTimeline();
      const items = ctxItems(c); if (!items.length) return false;
      const ttl = { shot: t('Plano', 'Shot'), layer: t('Capa', 'Layer'), clip: t('Audio', 'Audio'), text: t('Texto', 'Text'), overlay: t('Superposición', 'Overlay'), xshot: S.project.tl === 'free' ? t('Capa agrupada', 'Grouped layer') : t('Plano superpuesto', 'Overlapping shot'), subs: t('Subtítulo', 'Subtitle'), kf: t('Fotograma clave', 'Keyframe'), kftrack: t('Fotogramas clave', 'Keyframes'), otrack: t('Pista', 'Track') }[c.k];
      ctxMenu(host, e.clientX, e.clientY, ttl, items); return true;
    }
    /* clic derecho y pulsación larga */
    const onCtx = (e) => { const host = e.target.closest && e.target.closest('.studio'); if (!host || e.target.closest('input, textarea, select') || e.target.closest('.ctxmenu')) return; if (openCtx(e, host)) e.preventDefault(); };
    let lpTimer = 0, lpX = 0, lpY = 0, lpSuppress = false;
    const lpDown = (e) => {
      if (e.pointerType !== 'touch' || e.target.closest('.ctxmenu, .dockmenu, input, textarea, select')) return;
      lpX = e.clientX; lpY = e.clientY; clearTimeout(lpTimer);
      const tgt0 = e.target, host = tgt0.closest && tgt0.closest('.studio'); if (!host) return;
      lpTimer = setTimeout(() => { lpTimer = 0; if (openCtx({ target: tgt0, clientX: lpX, clientY: lpY }, host)) { lpSuppress = true; if (navigator.vibrate) navigator.vibrate(12); } }, 560);
    };
    const lpMove = (e) => { if (lpTimer && Math.hypot(e.clientX - lpX, e.clientY - lpY) > 10) { clearTimeout(lpTimer); lpTimer = 0; } };
    const lpEnd = () => { clearTimeout(lpTimer); lpTimer = 0; };
    const lpClick = (e) => { if (lpSuppress) { lpSuppress = false; e.preventDefault(); e.stopPropagation(); } };
    function wireCtx(host) {
      host.addEventListener('contextmenu', onCtx); host.addEventListener('pointerdown', lpDown, true); host.addEventListener('pointermove', lpMove, true);
      host.addEventListener('pointerup', lpEnd, true); host.addEventListener('pointercancel', lpEnd, true); host.addEventListener('click', lpClick, true);
    }
    /* dos dedos: pellizcar para acercar y arrastrar para desplazar (línea de tiempo y visor) */
    function wirePinch(node, onStart, onMove, onEnd) {
      const pts = new Map(); let g = null;
      const mid = () => { const a = [...pts.values()]; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1 }; };
      node.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'touch') return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size >= 2) { e.stopPropagation(); if (!g) { const m = mid(); g = { m0: m }; lpEnd(); onStart(m); } }
      }, true);
      node.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (g && pts.size >= 2) { e.stopPropagation(); e.preventDefault(); const m = mid(); onMove(m, m.d / g.m0.d, g.m0); }
      }, true);
      const up = (e) => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (g && pts.size < 2) { g = null; onEnd(); } };
      node.addEventListener('pointerup', up, true); node.addEventListener('pointercancel', up, true);
    }
    function wireGestures() {
      const sc = el.tlContent.parentNode, body = sc.parentNode; let tz = null, raf = 0, pan = null;
      /* línea de tiempo */
      wirePinch(sc, (m) => { tz = { pps: S.pps, anchor: (m.x - el.tlContent.getBoundingClientRect().left) / MC.uz() / S.pps, sl: sc.scrollLeft, st: body.scrollTop, m0x: m.x, m0y: m.y }; },
        (m, ratio) => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (!tz) return; S.pps = clamp(tz.pps * ratio, 6, 400); renderTimeline(); const r = sc.getBoundingClientRect(); sc.scrollLeft = tz.anchor * S.pps - (m.x - r.left) / MC.uz(); body.scrollTop = tz.st - (m.y - tz.m0y) / MC.uz(); refreshTlBar(); }); },
        () => { tz = null; });
      /* un dedo sobre el fondo vacío de la línea de tiempo la desplaza */
      sc.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch' || e.target.closest('.clip, .lyrbar, .kfd, .tl-ruler, .rz, .lrz, .playhead, button')) return; pan = { x: e.clientX, y: e.clientY, sl: sc.scrollLeft, st: body.scrollTop, on: false, id: e.pointerId }; });
      sc.addEventListener('pointermove', (e) => { if (!pan || pan.id !== e.pointerId) return; const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (!pan.on && Math.hypot(dx, dy) > 8) pan.on = true; if (pan.on) { sc.scrollLeft = pan.sl - dx / MC.uz(); body.scrollTop = pan.st - dy / MC.uz(); } });
      const pe = () => { pan = null; }; sc.addEventListener('pointerup', pe); sc.addEventListener('pointercancel', pe);
      /* visor */
      let vz = null;
      wirePinch(el.stage, (m) => { vz = { z: S.vz.z, x: S.vz.x, y: S.vz.y, m0x: m.x, m0y: m.y }; },
        (m, ratio) => { if (!vz) return; S.vz = { z: vz.z, x: vz.x, y: vz.y }; setViewZoom(vz.z * ratio, m.x, m.y); S.vz.x += (m.x - vz.m0x) / MC.uz(); S.vz.y += (m.y - vz.m0y) / MC.uz(); applyViewXf(); },
        () => { vz = null; });
    }

    /* ---------- teclado, regiones con nombre y lectores de pantalla ---------- */
    const REGIONS = { viewer: ['Visor', 'Viewer'], timeline: ['Línea de tiempo', 'Timeline'], tools: ['Herramientas', 'Tools'], layers: ['Capas', 'Layers'], props: ['Propiedades', 'Properties'] };
    const regionNode = (id) => ({ viewer: viewer, timeline: timeline, tools: el.leftEl, layers: layersPanel, props: propsPanel })[id];
    function labelRegions() {
      Object.keys(REGIONS).forEach((id) => { const n = regionNode(id); n.setAttribute('role', 'region'); n.setAttribute('aria-label', t(REGIONS[id][0], REGIONS[id][1])); n.dataset.reg = id; n.tabIndex = -1; });
      el.rail.dataset.reg = 'tools'; el.top.setAttribute('role', 'banner'); el.top.setAttribute('aria-label', t('Barra del estudio', 'Studio bar'));
    }
    function focusRegion(id) {
      const n = regionNode(id); if (!n || !n.isConnected || !n.getClientRects().length) return false;
      try { n.ownerDocument.defaultView.focus(); } catch (e) { /* sin foco de ventana */ }
      let f = null;
      if (id === 'viewer') f = el.canvas;
      else if (id === 'timeline') f = n.querySelector('.clip.on, .lyrbar.on') || n.querySelector('.clip[tabindex]') || n.querySelector('[data-tb]:not(:disabled)');
      else if (id === 'tools') f = el.rail.querySelector('[aria-selected="true"]') || n.querySelector('button, input, select');
      else if (id === 'layers') f = n.querySelector('.lrow2.on') || n.querySelector('.lrow2') || n.querySelector('select, .btn:not(.grip-btn)');
      else f = el.inspBody.querySelector('input:not([type="hidden"]), select, textarea, button') || n.querySelector('.btn:not(.grip-btn)');
      (f || n).focus(); MC.announce(t(REGIONS[id][0], REGIONS[id][1])); return true;
    }
    function cycleRegion(dir) {
      const ids = Object.keys(REGIONS).filter((id) => { const n = regionNode(id); return n && n.isConnected && n.getClientRects().length; });
      const cur = ids.findIndex((id) => { const n = regionNode(id), a = n.ownerDocument.activeElement, r = a && a.closest && a.closest('[data-reg]'); return r && r.dataset.reg === id; });
      for (let k = 1; k <= ids.length; k++) { const id = ids[(cur + dir * k + ids.length * 2) % ids.length]; if (focusRegion(id)) return; }
    }
    /* flechas, Tab y +/- sobre el visor: mueven la capa, la superposición o el texto seleccionados */
    function viewerKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const sh = shot(); if (!sh) return;
      if (e.key === 'Tab') {
        const n = sh.layers.length; if (!n) return; const order = sh.layers.map((l, i) => i).reverse(); /* de arriba (más cerca) a abajo */
        let k = S.selKind === 'layer' ? order.indexOf(S.li) : -1; k += e.shiftKey ? -1 : 1;
        if (k < 0 || k >= order.length) { if (S.selKind === 'layer') { /* sale del visor */ } return; }
        e.preventDefault(); S.li = order[k]; S.selKind = 'layer'; S.tx = S.cl = S.ov = null; renderLayers(); renderInspector(); renderTimeline(); S.dirty = true; MC.announce(sh.layers[S.li].name + t(', capa ', ', layer ') + (k + 1) + t(' de ', ' of ') + n); return;
      }
      const step = e.shiftKey ? 0.02 : 0.004, dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0, sc = e.key === '+' || e.key === '=' ? 1.03 : e.key === '-' ? 1 / 1.03 : 0;
      if (!dx && !dy && !sc) return;
      let it = null;
      if (S.selKind === 'layer' && layer() && !layer().locked) it = layer(); else if (S.selKind === 'overlay' && S.ov && ovById(S.ov) && !ovById(S.ov).locked) it = ovById(S.ov); else if (S.selKind === 'text' && S.tx && txById(S.tx) && txById(S.tx).kind !== 'sub') it = txById(S.tx);
      if (!it) return;
      e.preventDefault(); e.stopPropagation();
      if (sc) { if (it.kind !== undefined && it.size != null && it.scale == null) it.size = clamp(it.size * sc, 0.01, 0.4); else it.scale = clamp((it.scale || 1) * sc, 0.1, 4); }
      else { it.x = clamp(Math.round(((it.x || 0) + dx) * 1000) / 1000, -1.5, 1.5); it.y = clamp(Math.round(((it.y || 0) + dy) * 1000) / 1000, -1.5, 1.5); }
      S.dirty = true; touch(); clearTimeout(viewerKey.t); viewerKey.t = setTimeout(() => { commit(); }, 400);
      MC.announce(sc ? t('Escala ', 'Scale ') + (it.scale ? it.scale.toFixed(2) : '') : t('Posición ', 'Position ') + Math.round((it.x || 0) * 100) + ', ' + Math.round((it.y || 0) * 100));
    }
    /* línea de tiempo con teclado: vecino geométrico de un clip */
    function neighborClip(c, key) {
      const all = [...el.tlContent.querySelectorAll('.clip[tabindex], .lyrbar[tabindex]')].filter((n) => n !== c && n.getClientRects().length), r = c.getBoundingClientRect();
      const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2; let best = null, bd = Infinity;
      all.forEach((n) => {
        const q = n.getBoundingClientRect(), qx = (q.left + q.right) / 2, qy = (q.top + q.bottom) / 2, ovV = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top), ovH = Math.min(r.right, q.right) - Math.max(r.left, q.left);
        let d = Infinity;
        if (key === 'ArrowRight' && q.left >= r.right - 2 && ovV > 2) d = q.left - r.right;
        else if (key === 'ArrowLeft' && q.right <= r.left + 2 && ovV > 2) d = r.left - q.right;
        else if (key === 'ArrowDown' && qy > cy + 2 && q.top >= r.bottom - 4) d = (q.top - r.bottom) * 10 + Math.abs(qx - cx) / 100 - Math.max(0, ovH) / 1000;
        else if (key === 'ArrowUp' && qy < cy - 2 && q.bottom <= r.top + 4) d = (r.top - q.bottom) * 10 + Math.abs(qx - cx) / 100 - Math.max(0, ovH) / 1000;
        if (d < bd) { bd = d; best = n; }
      });
      return best;
    }
    function kbTrim(c, e) {
      const sel = c.classList.contains('lyrbar') ? '.lyrbar[data-si="' + c.dataset.si + '"][data-li="' + c.dataset.li + '"]' : c.dataset.c ? '.clip[data-c="' + c.dataset.c + '"]' : c.dataset.x ? '.clip[data-x="' + c.dataset.x + '"]' : c.dataset.o ? '.clip[data-o="' + c.dataset.o + '"]' : c.dataset.xs ? '.clip[data-xs="' + c.dataset.xs + '"]' : c.dataset.i != null ? '.clip[data-i="' + c.dataset.i + '"]' : null;
      const rc = ctxFor({ target: c, clientX: c.getBoundingClientRect().left + 4 }); if (!rc) return;
      const T = tgt(), d = e.ctrlKey ? 1 : 0.1, end = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      if (!T || T.linked) return;
      const it = T.it, p = S.project;
      if (end) {
        const dd = e.key === 'ArrowRight' ? d : -d;
        if (T.k === 'shot') { if (it.page || it.webtoon) return; it.duration = clamp(round2(it.duration + dd), 0.3, 120); }
        else if (T.k === 'layer') { const sh = shot(), te = (it.te == null ? sh.duration : it.te) + dd; it.te = te >= sh.duration - 0.01 ? null : clamp(round2(te), (it.ts || 0) + 0.2, sh.duration); }
        else it.dur = clamp(round2(it.dur + dd), 0.1, 600);
      } else {
        const dd = e.key === 'ArrowUp' ? d : -d; /* ↑ acorta el principio, ↓ lo alarga */
        if (T.k === 'shot') { if (it.page || it.webtoon) return; it.duration = clamp(round2(it.duration - dd), 0.3, 120); }
        else if (T.k === 'layer') { const sh = shot(), te = it.te == null ? sh.duration : it.te; it.ts = clamp(round2((it.ts || 0) + dd), 0, te - 0.2); if (it.ts <= 0) delete it.ts; }
        else if (T.k === 'clip' || T.k === 'overlay' || T.k === 'text') {
          const off = T.k === 'text' ? 0 : (it.offset || 0), dd2 = dd < 0 ? -Math.min(-dd, T.k === 'text' ? it.start : Math.min(it.start, off)) : Math.min(dd, it.dur - 0.1);
          it.start = round2(it.start + dd2); it.dur = round2(it.dur - dd2); if (T.k === 'clip') it.offset = (it.offset || 0) + dd2; else if (T.k === 'overlay') it.offset = (it.offset || 0) + dd2 * (it.speed || 1);
        }
      }
      commit(); MC.announce((end ? t('Final: ', 'End: ') : t('Principio: ', 'Start: ')) + (T.k === 'shot' ? it.duration.toFixed(1) : '') + ' s');
      setTimeout(() => { const n = sel && el.tlContent.querySelector(sel); if (n) n.focus(); }, 0);
    }
    function wireKb() {
      el.tlContent.addEventListener('keydown', (e) => {
        const c = e.target; if (!c || !c.matches || !c.matches('.clip[tabindex], .lyrbar[tabindex]')) return;
        const ar = e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown';
        if (!ar) return;
        if (e.altKey && e.shiftKey) { e.preventDefault(); e.stopPropagation(); kbTrim(c, e); return; }
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !c.matches(':focus-visible')) return;
        e.preventDefault(); e.stopPropagation();
        const n = neighborClip(c, e.key); if (n) { n.focus(); n.scrollIntoView({ block: 'nearest', inline: 'nearest' }); MC.announce(n.getAttribute('aria-label') || ''); }
      }, true);
      el.canvas.addEventListener('keydown', viewerKey);
    }
    /* hoja de atajos (?) según el espacio de trabajo */
    function shortcutSheet() {
      const K = MC.keys, kb = (id) => K.bindings(id).map(K.pretty).join(' / ') || '—', row = (keys, txt) => h('div', { class: 'ksrow' }, h('span', { class: 'kskeys' }, keys.split(' o ').map((q) => h('kbd', null, q))), h('span', null, txt));
      const act = (id) => { const a = K.ACTIONS.find((x) => x.id === id); return row(kb(id).replace(/ \/ /g, ' o '), a ? t(a.es, a.en) : id); };
      const sec = (title, rows, hot) => h('section', { class: 'kssec' + (hot ? ' hot' : '') }, h('h3', null, title), ...rows);
      const ws = S.ws, tab = curTab();
      const ctxRows = ws === 'creativo' && tab === 'subtitulos' ? [row('Intro', t('Marcar la palabra que se dice en el cabezal', 'Mark the word being said at the playhead')), row('.', t('Marcar un silencio', 'Mark a silence')), row('Retroceso', t('Quitar la última marca', 'Remove the last mark'))]
        : ws === 'exportar' ? [act('export')] : ws === 'creativo' ? [act('addBubble'), row('Intro o Espacio', t('Pulsar el botón enfocado', 'Press the focused button'))] : ['selectTool', 'blade', 'trimStart', 'trimEnd', 'snap', 'keyframe', 'groupClips', 'ungroupClips', 'split', 'marker'].map(act);
      const body = h('div', { class: 'ks' },
        sec(ws === 'montaje' ? t('Montaje', 'Edit') : ws === 'creativo' ? t('Efectos y audio', 'Effects and audio') : t('Exportar', 'Export'), ctxRows, true),
        sec(t('Reproducción', 'Playback'), ['play', 'stepBack', 'stepFwd', 'secBack', 'secFwd', 'start', 'end', 'prevShot', 'nextShot', 'back1', 'pause', 'forward'].map(act)),
        sec(t('Edición', 'Editing'), ['delete', 'undo', 'redo', 'duplicate', 'selectAll', 'save', 'tapBeat'].map(act)),
        sec(t('Línea de tiempo con teclado', 'Timeline by keyboard'), [row('Tab', t('Entrar en la línea de tiempo y pasar de clip en clip', 'Enter the timeline and move clip by clip')), row('← → ↑ ↓', t('Pasar al clip de al lado, de arriba o de abajo (tras llegar con Tab)', 'Go to the clip beside, above or below (after arriving with Tab)')), row('Intro', t('Seleccionar el clip', 'Select the clip')), row('Alt + ← →', t('Mover el clip 0,1 s (con Mayús, 1 s)', 'Move the clip 0.1 s (with Shift, 1 s)')), row('Alt + Mayús + ← →', t('Recortar el final (con Ctrl, 1 s)', 'Trim the end (with Ctrl, 1 s)')), row('Alt + Mayús + ↑ ↓', t('Recortar el principio: ↑ lo acorta, ↓ lo alarga', 'Trim the start: ↑ shortens it, ↓ lengthens it')), act('zoomIn'), act('zoomOut')]),
        sec(t('Visor con teclado', 'Viewer by keyboard'), [row('Alt + 1', t('Ir al visor', 'Go to the viewer')), row('Tab o Mayús + Tab', t('Pasar de capa en capa', 'Move from layer to layer')), row('← → ↑ ↓', t('Mover lo seleccionado (con Mayús, más)', 'Move the selection (with Shift, more)')), row('+ o -', t('Agrandar o reducir lo seleccionado', 'Enlarge or shrink the selection'))]),
        sec(t('Paneles', 'Panels'), [row('F6 o Mayús + F6', t('Saltar al panel siguiente o anterior', 'Jump to the next or previous panel')), row('Alt + 1 … 5', t('Visor, línea de tiempo, herramientas, capas y propiedades', 'Viewer, timeline, tools, layers and properties')), act('fullscreen'), act('viewSwitch'), act('export')]),
        sec(t('Ayuda', 'Help'), [act('help'), act('keys')]));
      MC.modal(t('Atajos de teclado', 'Keyboard shortcuts'), body, (close) => [h('button', { class: 'btn btn-s', type: 'button', onClick: () => { close(); MC.openHelp('keys'); } }, t('Personalizar atajos…', 'Customise shortcuts…')), h('button', { class: 'btn btn-p', type: 'button', onClick: close }, t('Cerrar', 'Close'))], { wide: true });
    }

    /* ---------- fotogramas clave por propiedad: rombo junto a cada valor, curvas y movimientos listos ---------- */
    const KFP = [
      ['x', 'Posición X', 'Position X', -1, 1, 0.005, (v) => v.toFixed(3), 0], ['y', 'Posición Y', 'Position Y', -1, 1, 0.005, (v) => v.toFixed(3), 0],
      ['sc', 'Escala', 'Scale', 0.1, 3, 0.01, (v) => '×' + v.toFixed(2), 1], ['sx', 'Ancho (estirar)', 'Width (stretch)', 0.1, 3, 0.01, (v) => '×' + v.toFixed(2), 1], ['sy', 'Alto (estirar)', 'Height (stretch)', 0.1, 3, 0.01, (v) => '×' + v.toFixed(2), 1],
      ['rot', 'Giro', 'Rotation', -360, 360, 1, (v) => Math.round(v) + '°', 0], ['op', 'Opacidad', 'Opacity', 0, 1, 0.01, (v) => Math.round(v * 100) + ' %', 1],
      ['rx', 'Giro X (3D)', 'Turn X (3D)', -180, 180, 1, (v) => Math.round(v) + '°', 0], ['ry', 'Giro Y (3D)', 'Turn Y (3D)', -180, 180, 1, (v) => Math.round(v) + '°', 0],
      ['cl', 'Recorte izquierda', 'Crop left', -0.9, 0.9, 0.005, (v) => Math.round(v * 100) + ' %', 0], ['ct', 'Recorte arriba', 'Crop top', -0.9, 0.9, 0.005, (v) => Math.round(v * 100) + ' %', 0],
      ['cr', 'Recorte derecha', 'Crop right', -0.9, 0.9, 0.005, (v) => Math.round(v * 100) + ' %', 0], ['cb', 'Recorte abajo', 'Crop bottom', -0.9, 0.9, 0.005, (v) => Math.round(v * 100) + ' %', 0],
    ];
    S.animCtl = []; S.kfprop = null;
    const kfDef = (pr) => KFP.find((q) => q[0] === pr)[7];
    const propsOfKey = (q) => KFP.filter((d) => q[d[0]] != null).map((d) => t(d[1], d[2]));
    /* slider de una propiedad animable. mode «rel»: valor relativo (se anima al tocarlo); «add» y «mul»: valor real de la capa, que se anima en cuanto hay un fotograma clave */
    function animSlider(it, o) {
      const dur = () => Math.max(0.1, o.dur()), loc = () => clamp(S.time - o.start(), 0, dur());
      const keys = () => (it.kf || []).filter((q) => q[o.prop] != null).sort((a, b) => a.t - b.t);
      const keyAt = () => keys().find((q) => Math.abs(q.t - loc()) < 0.03);
      const kv = () => { const v = MC.kfValues(it.kf, loc()); return v ? v[o.prop] : kfDef(o.prop); };
      const eff = () => (o.mode === 'add' ? o.base() + kv() : o.mode === 'mul' ? o.base() * kv() : kv());
      const fromEff = (v) => (o.mode === 'add' ? v - o.base() : o.mode === 'mul' ? (Math.abs(o.base()) > 1e-4 ? v / o.base() : v) : v);
      const id = 'as-' + MC.uid(), fmt = o.fmt || ((v) => v.toFixed(2));
      const val = h('span', { class: 'av' }, fmt(eff()));
      const inp = h('input', { type: 'range', id, min: o.min, max: o.max, step: o.step, value: eff() });
      const mkKey = (v) => { const q = { id: MC.uid(), t: round2(loc()), [o.prop]: v, ease: 'smooth' }; it.kf = (it.kf || []).concat([q]); S.kfid = q.id; return q; };
      const btn = h('button', { class: 'kfbtn', type: 'button', 'data-state': 'none', onClick: () => {
        const k = keyAt();
        if (k) { delete k[o.prop]; it.kf = it.kf.filter((q) => KFP.some((d) => q[d[0]] != null)); MC.announce(t('Fotograma clave quitado de ', 'Keyframe removed from ') + t(o.es, o.en)); }
        else { mkKey(kv()); MC.announce(t('Fotograma clave añadido a ', 'Keyframe added to ') + t(o.es, o.en)); }
        S.kfprop = o.prop; commit();
      } }, MC.icon('diamond', 14));
      const goKey = (d) => { const ks = keys(), l = loc(); const q = d < 0 ? ks.filter((z) => z.t < l - 0.03).pop() : ks.find((z) => z.t > l + 0.03); if (q) { setTime(o.start() + clamp(q.t, 0, Math.max(0, dur() - 0.001))); S.kfid = q.id; } };
      const prev = h('button', { class: 'kfnav', type: 'button', 'aria-label': t('Fotograma clave anterior de ', 'Previous keyframe of ') + t(o.es, o.en), onClick: () => goKey(-1) }, MC.icon('back', 12));
      const next = h('button', { class: 'kfnav', type: 'button', 'aria-label': t('Fotograma clave siguiente de ', 'Next keyframe of ') + t(o.es, o.en), onClick: () => goKey(1) }, MC.icon('chevron', 12));
      const labBtn = h('button', { class: 'kflab', type: 'button', title: t('Elegir esta propiedad para las curvas', 'Pick this property for the curves'), onClick: () => { S.kfprop = S.kfprop === o.prop ? null : o.prop; renderPanels(); } }, t(o.es, o.en));
      inp.addEventListener('input', () => {
        const v = +inp.value; val.textContent = fmt(v);
        if (keys().length || o.mode === 'rel' || S.autoKf) { const k = keyAt(); if (k) k[o.prop] = fromEff(v); else mkKey(fromEff(v)); S.dirty = true; touch(); layoutClips(); refresh(true); }
        else { o.set(v); }
      });
      inp.addEventListener('change', () => commit());
      const refresh = (keep) => {
        const n = keys().length, on = !!keyAt();
        btn.dataset.state = on ? 'on' : n ? 'has' : 'none'; btn.setAttribute('aria-pressed', String(on));
        btn.title = on ? t('Quitar el fotograma clave de aquí', 'Remove the keyframe here') : t('Añadir un fotograma clave aquí', 'Add a keyframe here');
        btn.setAttribute('aria-label', btn.title + ' · ' + t(o.es, o.en));
        prev.disabled = !keys().some((z) => z.t < loc() - 0.03); next.disabled = !keys().some((z) => z.t > loc() + 0.03);
        if (!keep) { inp.value = eff(); val.textContent = fmt(+inp.value); }
      };
      refresh(); S.animCtl.push({ refresh });
      const node = h('div', { class: 'slider anim' + (S.kfprop === o.prop ? ' on' : '') }, h('div', { class: 'alabel' }, labBtn, val), h('div', { class: 'arow' }, inp, h('span', { class: 'kfc' }, prev, btn, next)));
      node.getEff = eff; node.setEff = (v) => { inp.value = v; inp.dispatchEvent(new Event('input')); inp.dispatchEvent(new Event('change')); };
      return node;
    }
    /* movimientos listos: crean los fotogramas clave por ti y luego se retocan */
    const MOTIONS = [
      ['zin', 'Zoom lento: acercar', 'Slow zoom in', (D) => [['sc', 0, 1, 'smooth'], ['sc', D, 1.18]]], ['zout', 'Zoom lento: alejar', 'Slow zoom out', (D) => [['sc', 0, 1.18, 'smooth'], ['sc', D, 1]]],
      ['dr', 'Deriva a la derecha', 'Drift right', (D) => [['x', 0, 0, 'linear'], ['x', D, 0.05]]], ['dl', 'Deriva a la izquierda', 'Drift left', (D) => [['x', 0, 0, 'linear'], ['x', D, -0.05]]],
      ['du', 'Deriva hacia arriba', 'Drift up', (D) => [['y', 0, 0, 'linear'], ['y', D, -0.05]]], ['dd', 'Deriva hacia abajo', 'Drift down', (D) => [['y', 0, 0, 'linear'], ['y', D, 0.05]]],
      ['pulse', 'Latido', 'Heartbeat', (D) => [0, 0.2, 0.4, 0.6, 0.8, 1].map((f, i) => ['sc', D * f, i % 2 ? 1.09 : 1, 'smooth'])],
      ['pop', 'Entrada pop', 'Pop in', () => [['sc', 0, 0.4, 'back'], ['sc', 0.45, 1], ['op', 0, 0, 'linear'], ['op', 0.2, 1]]],
      ['slide', 'Entrada desde abajo', 'Slide in from below', () => [['y', 0, 0.15, 'out'], ['y', 0.5, 0], ['op', 0, 0, 'linear'], ['op', 0.35, 1]]],
      ['bounce', 'Entrada con bote', 'Bounce in', () => [['y', 0, -0.3, 'bounce'], ['y', 0.8, 0], ['op', 0, 0, 'linear'], ['op', 0.1, 1]]],
      ['fin', 'Aparecer', 'Fade in', () => [['op', 0, 0, 'smooth'], ['op', 0.6, 1]]], ['fout', 'Desvanecer al final', 'Fade out at the end', (D) => [['op', Math.max(0, D - 0.6), 1, 'smooth'], ['op', D, 0]]],
      ['shake', 'Temblor', 'Shake', (D) => { const o = []; for (let i = 0; i <= 10; i++) o.push(['x', i * 0.06, i === 10 ? 0 : (i % 2 ? 0.008 : -0.008), 'linear']); return o; }],
      ['sway', 'Balanceo', 'Sway', (D) => [['rot', 0, -3, 'smooth'], ['rot', D / 2, 3], ['rot', D, -3]]], ['spin', 'Giro completo', 'Full spin', (D) => [['rot', 0, 0, 'linear'], ['rot', D, 360]]],
    ];
    function applyMotion(it, dur, m) {
      const D = Math.max(0.2, dur), list = m[3](D).map((q) => ({ pr: q[0], t: round2(clamp(q[1], 0, D)), v: q[2], e: q[3] }));
      const props = new Set(list.map((q) => q.pr)); let last = {};
      (it.kf || []).forEach((q) => props.forEach((pr) => { delete q[pr]; })); it.kf = (it.kf || []).filter((q) => KFP.some((d) => q[d[0]] != null));
      list.forEach((q) => { if (q.e) last[q.pr] = q.e; it.kf.push({ id: MC.uid(), t: q.t, [q.pr]: q.v, ease: q.e || last[q.pr] || 'smooth' }); });
      S.kfid = null; commit(); MC.announce(t('Movimiento aplicado: ', 'Motion applied: ') + t(m[1], m[2]));
    }
    /* sección «Fotogramas clave»: propiedades con rombo, movimientos, curvas y lista de fotogramas */
    function kfPanel(it, start, dur) {
      const D = Math.max(0.1, dur), list = (it.kf || []).slice().sort((a, b) => a.t - b.t), cur = list.find((q) => q.id === S.kfid);
      const nodes = [h('p', { class: 'cap' }, t('Pulsa el rombo ◆ de una propiedad para animarla en el instante del cabezal; mueve el cabezal, cambia el valor y se crea otro fotograma. ◀ ▶ saltan entre fotogramas. Los fotogramas clave se suman a la animación de entrada, salida y bucle.', 'Press the diamond ◆ of a property to animate it at the playhead; move the playhead, change the value and another keyframe is created. ◀ ▶ jump between keyframes. Keyframes add to the in, out and loop animation.'))];
      nodes.push(h('div', { class: 'kfrows' }, KFP.map((d) => animSlider(it, { prop: d[0], es: d[1], en: d[2], min: d[3], max: d[4], step: d[5], fmt: d[6], mode: 'rel', start: () => start, dur: () => D, set: () => {} }))));
      nodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Movimientos listos (crean los fotogramas clave)', 'Ready-made motions (they create the keyframes)')), h('div', { class: 'motions' }, MOTIONS.map((m) => h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => applyMotion(it, D, m) }, t(m[1], m[2]))))));
      const target = cur ? t('el fotograma seleccionado', 'the selected keyframe') : S.kfprop ? t('todos los de «', 'all of “') + t(KFP.find((d) => d[0] === S.kfprop)[1], KFP.find((d) => d[0] === S.kfprop)[2]) + t('»', '”') : t('todos los fotogramas', 'all keyframes');
      nodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Curva del movimiento: se aplica a ', 'Motion curve: applies to ') + target), MC.ui.chips(MC.CURVES.map((q) => ({ v: q.v, l: t(q.es, q.en) })), cur && typeof cur.ease === 'string' ? cur.ease : null, (v) => {
        if (cur) cur.ease = v; else (it.kf || []).forEach((q) => { if (!S.kfprop || q[S.kfprop] != null) q.ease = v; });
        commit();
      })));
      nodes.push(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const q = newKf(it, clamp(S.time - start, 0, D)); it.kf = (it.kf || []).filter((z) => Math.abs(z.t - q.t) > 0.01 || !KFP.every((d) => z[d[0]] != null)).concat([q]); S.kfid = q.id; commit(); } }, MC.icon('diamond', 14), t('Fotograma de todo aquí', 'Keyframe of everything here')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { MC.ui && openGraph(); } }, MC.icon('curve', 14), t('Abrir las curvas', 'Open the curves')),
        list.length ? h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { it.kf = []; S.kfid = null; commit(); } }, t('Quitar toda la animación', 'Remove all animation')) : null));
      if (list.length) nodes.push(h('div', { class: 'kflist', role: 'listbox', 'aria-label': t('Fotogramas clave', 'Keyframes') }, list.map((q) => h('button', { type: 'button', role: 'option', 'aria-selected': String(q.id === S.kfid), class: 'kfrow', onClick: () => { S.kfid = q.id; setTime(start + clamp(q.t, 0, Math.max(0, D - 0.001))); renderInspector(); renderTimeline(); } }, h('i', { 'aria-hidden': 'true' }), h('b', null, q.t.toFixed(2) + ' s'), h('span', null, propsOfKey(q).join(', '))))));
      if (cur) {
        const setK = (k, v) => { cur[k] = v; S.dirty = true; touch(); };
        nodes.push(MC.ui.slider({ label: t('Momento del fotograma', 'Keyframe time'), min: 0, max: Math.max(0.1, D), step: 0.01, value: cur.t, fmt: (v) => v.toFixed(2) + ' s', onInput: (v) => { setK('t', v); layoutClips(); }, onChange: commit }));
        KFP.filter((d) => cur[d[0]] != null).forEach((d) => nodes.push(MC.ui.slider({ label: t(d[1], d[2]), min: d[3], max: d[4], step: d[5], value: cur[d[0]], fmt: d[6], onInput: (v) => setK(d[0], v), onChange: commit })));
        nodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Curva hasta el siguiente fotograma clave (arrastra los puntos para una curva propia)', 'Curve to the next keyframe (drag the points for a custom curve)')), MC.ui.curveEditor(cur.ease || 'smooth', (v) => { cur.ease = v; S.dirty = true; touch(); }, commit)),
          h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', style: { justifySelf: 'start' }, onClick: () => { it.kf = it.kf.filter((z) => z.id !== cur.id); S.kfid = null; commit(); } }, MC.icon('trash', 14), t('Eliminar este fotograma clave', 'Delete this keyframe')));
      }
      return nodes;
    }

    /* ---------- visibilidad de las pistas: el ojo las oculta del vídeo (o silencia el audio) y «plegar» quita la fila de la línea de tiempo ---------- */
    function trkNames() { return { shots: ['Planos', 'Shots'], text: ['Texto', 'Text'], subs: ['Subtítulos', 'Subtitles'], fxr: ['Efectos', 'Effects'], voz: ['Locución', 'Voice'], sfx: ['SFX', 'SFX'], musica: ['Música', 'Music'] }; }
    function tvOf(k) { const p = S.project; p.tv = p.tv || {}; return (p.tv[k] = p.tv[k] || {}); }
    function trackFold(k) { const p = S.project; return /^o\d+$/.test(k) ? !!(p.otracks[+k.slice(1)] || {}).fold : /^x\d+$/.test(k) ? !!(p.xtracks[+k.slice(1)] || {}).fold : !!((p.tv || {})[k] || {}).fold; }
    function trackOff(k) { const p = S.project; if (/^o\d+$/.test(k)) return (p.otracks[+k.slice(1)] || {}).visible === false; if (/^x\d+$/.test(k)) return (p.xtracks[+k.slice(1)] || {}).visible === false; if (AU.includes(k)) return !!((p.mix || {}).mute || {})[k]; return !!((p.tv || {})[k] || {}).off; }
    function hasEye(k) { return k !== 'kf' && k !== 'shots'; }
    function setTrackFold(k, v) { const p = S.project; if (/^o\d+$/.test(k)) p.otracks[+k.slice(1)].fold = !!v; else if (/^x\d+$/.test(k)) p.xtracks[+k.slice(1)].fold = !!v; else tvOf(k).fold = !!v; }
    function setTrackOff(k, v) { const p = S.project; if (/^o\d+$/.test(k)) p.otracks[+k.slice(1)].visible = !v; else if (/^x\d+$/.test(k)) p.xtracks[+k.slice(1)].visible = !v; else if (AU.includes(k)) { p.mix = p.mix || {}; p.mix.mute = p.mix.mute || {}; p.mix.mute[k] = !!v; } else tvOf(k).off = !!v; }
    function trackName(k) { return /^o\d+$/.test(k) ? S.project.otracks[+k.slice(1)].name : /^x\d+$/.test(k) ? S.project.xtracks[+k.slice(1)].name : t(trkNames()[k][0], trkNames()[k][1]); }
    function eyeIc(k, off) { return AU.includes(k) ? 'speaker' : off ? 'eyeoff' : 'eye'; }
    function eyeTitle(k, off) { return (AU.includes(k) ? (off ? t('Activar el sonido de la pista', 'Turn the track sound on') : t('Silenciar la pista', 'Mute the track')) : (off ? t('Mostrar la pista en el vídeo', 'Show the track in the video') : t('Ocultar la pista del vídeo', 'Hide the track from the video'))); }
    function allTrackKeys() { const p = S.project; if (p.tl === 'free') return ['subs'].concat(p.otracks.map((q, i) => 'o' + i).reverse(), ['voz', 'sfx', 'musica']); return p.otracks.map((q, i) => 'o' + i).concat(p.xtracks.length && (p.xshots.length || S.xs) ? p.xtracks.map((q, i) => 'x' + i) : [], ['shots', 'text', 'subs', 'fxr', 'voz', 'sfx', 'musica']); }
    function decorateLabel(lab, k) {
      if (k === 'kf') return lab;
      let tb = lab.querySelector('.trb'); if (!tb) { tb = h('span', { class: 'trb' }); lab.append(tb); }
      const off = trackOff(k);
      if (hasEye(k) && !/^[ox]\d+$/.test(k)) tb.append(h('button', { class: 'btn btn-g', type: 'button', 'aria-pressed': String(!off), title: eyeTitle(k, off), 'aria-label': eyeTitle(k, off) + ' · ' + trackName(k), onClick: () => { setTrackOff(k, !trackOff(k)); commit(); } }, MC.icon(eyeIc(k, off), 13)));
      tb.append(h('button', { class: 'btn btn-g trfold', type: 'button', title: t('Plegar esta pista (se recupera en el menú Pistas)', 'Fold this track (restore it from the Tracks menu)'), 'aria-label': t('Plegar la pista ', 'Fold the track ') + trackName(k), onClick: () => { setTrackFold(k, true); commit(); MC.toast(t('Pista plegada: ', 'Track folded: ') + trackName(k), { label: t('Mostrar', 'Show'), onClick: () => { setTrackFold(k, false); commit(); }, ms: 5000 }); } }, MC.icon('up', 13)));
      return lab;
    }
    function tracksBtn() {
      const n = allTrackKeys().filter(trackFold).length;
      return h('button', { class: 'rsbtn', type: 'button', 'aria-haspopup': 'menu', title: t('Pistas: mostrar, ocultar y plegar', 'Tracks: show, hide and fold'), 'aria-label': t('Menú de pistas', 'Tracks menu') + (n ? ' · ' + n + t(' plegadas', ' folded') : ''), onClick: () => openTracksMenu() }, MC.icon('layers', 13), t('Pistas', 'Tracks'), n ? h('b', { class: 'rsn' }, String(n)) : null);
    }
    function openTracksMenu() {
      closeDockMenu(); closeCtx();
      const host = studio, btn = el.tlLabels.querySelector('.rsbtn'); if (!btn) return;
      const rows = allTrackKeys().map((k) => {
        const off = trackOff(k), fold = trackFold(k);
        return h('div', { class: 'tkrow' }, h('span', { class: 'tkn' }, trackName(k)),
          hasEye(k) ? h('button', { class: 'btn btn-g btn-ic', type: 'button', 'aria-pressed': String(!off), title: eyeTitle(k, off), 'aria-label': eyeTitle(k, off) + ' · ' + trackName(k), onClick: () => { setTrackOff(k, !off); commit(); openTracksMenu(); } }, MC.icon(eyeIc(k, off), 15)) : h('span', { class: 'tkgap' }),
          h('button', { class: 'btn btn-g btn-ic', type: 'button', 'aria-pressed': String(!fold), title: fold ? t('Mostrar la fila en la línea de tiempo', 'Show the row in the timeline') : t('Plegar la fila', 'Fold the row'), 'aria-label': (fold ? t('Mostrar la fila de ', 'Show the row of ') : t('Plegar la fila de ', 'Fold the row of ')) + trackName(k), onClick: () => { setTrackFold(k, !fold); commit(); openTracksMenu(); } }, MC.icon(fold ? 'down' : 'up', 15)));
      });
      const menu = h('div', { class: 'dockmenu ctxmenu tkmenu', role: 'dialog', 'aria-label': t('Pistas', 'Tracks'), onKeydown: (e) => { if (e.key === 'Escape') { closeCtx(); const b = el.tlLabels.querySelector('.rsbtn'); if (b) b.focus(); } } },
        h('div', { class: 'eyebrow' }, t('Pistas de la línea de tiempo', 'Timeline tracks')), h('p', { class: 'cap' }, t('El ojo (o el altavoz) quita la pista del vídeo; la flecha quita su fila de la línea de tiempo.', 'The eye (or speaker) removes the track from the video; the arrow removes its row from the timeline.')), ...rows,
        h('button', { type: 'button', onClick: () => { allTrackKeys().forEach((k) => { setTrackFold(k, false); setTrackOff(k, false); }); commit(); openTracksMenu(); } }, MC.icon('undo', 14), t('Mostrar todas las pistas', 'Show all tracks')));
      host.append(menu);
      const f = zf(host), hr = host.getBoundingClientRect(), br = btn.getBoundingClientRect(), hh = menu.offsetHeight;
      menu.style.left = clamp((br.left - hr.left) / f, 4, Math.max(4, host.offsetWidth - menu.offsetWidth - 4)) + 'px'; menu.style.top = clamp((br.top - hr.top) / f - hh - 6 > 4 ? (br.top - hr.top) / f - hh - 6 : (br.bottom - hr.top) / f + 4, 4, Math.max(4, host.offsetHeight - hh - 4)) + 'px';
      const first = menu.querySelector('button'); if (first) first.focus();
    }

    const ACT = {
      play: () => togglePlay(), pause: () => togglePlay(false), forward: () => togglePlay(true),
      back1: () => setTime(S.time - 1), stepBack: () => setTime(S.time - 1 / 30), stepFwd: () => setTime(S.time + 1 / 30), secBack: () => setTime(S.time - 1), secFwd: () => setTime(S.time + 1),
      start: () => setTime(0), end: () => setTime(total() - 0.001),
      prevShot: () => selectShot(S.si - 1, true), nextShot: () => selectShot(S.si + 1, true),
      split: () => { splitAt(S.time); },
      duplicate: () => { if (S.selKind === 'layer' && layer()) { dupLayer(); return; } return dupSelection(); }, marker: () => { addMarker('note'); }, tapBeat: () => { addMarker('beat'); },
      selectAll: () => { setMulti(allKeys()); },
      undo: () => { undo(); MC.announce(t('Deshacer', 'Undo')); }, redo: () => { redo(); MC.announce(t('Rehacer', 'Redo')); },
      addBubble: () => addText('bubble'), save: () => { save().then(() => MC.toast(t('Guardado en este equipo', 'Saved on this device'))); },
      fullscreen: () => { const v = el.viewerEl; if (!v) return; if (v.ownerDocument.fullscreenElement) v.ownerDocument.exitFullscreen(); else if (v.requestFullscreen) v.requestFullscreen().catch(() => MC.toast(t('Tu navegador no permite la pantalla completa aquí.', 'Your browser does not allow full screen here.'))); else MC.toast(t('Tu navegador no permite la pantalla completa aquí.', 'Your browser does not allow full screen here.')); },
      viewSwitch: () => { const sh = shot(), next = sh.page ? 'page' : sh.webtoon ? 'strip' : 'cam'; S.view = S.view === 'out' ? next : 'out'; togglePlay(false); renderVbar(); buildSim(); fit(); MC.announce(S.view === 'out' ? t('Vista de salida', 'Output view') : t('Vista de edición', 'Editing view')); },
      zoomIn: () => { S.pps = clamp(S.pps * 1.3, 12, 240); renderTimeline(); }, zoomOut: () => { S.pps = clamp(S.pps / 1.3, 12, 240); renderTimeline(); },
      export: () => openExport(), help: () => shortcutSheet(), keys: () => MC.openHelp('keys'),
      selectTool: () => setTool('sel'), blade: () => setTool('blade'), trimStart: () => trimEdge('start'), trimEnd: () => trimEdge('end'), snap: () => toggleSnap(), keyframe: () => addKfHere(), groupClips: () => groupSelected(), ungroupClips: () => ungroupSelected(),
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
        else if (S.xs && xById(S.xs) && S.selKind === 'shot') { S.project.xshots = S.project.xshots.filter((x) => x.id !== S.xs); S.xs = null; S.li = -1; commit(); MC.announce(t('Plano superpuesto eliminado', 'Overlapping shot deleted')); }
        else if (S.selKind === 'shot' && !S.xs) { delShot(); }
        else return false;
      },
    };
    wireGestures(); wireCtx(studio); labelRegions(); wireKb();
    /* herramientas y pestañas que el usuario ha decidido ocultar */
    function applyUiHide() {
      if (!el.tlBar) return;
      const C = MC.cfg, gone = (key) => C.isHidden('tb:' + key) || Object.keys(C.TB_GROUPS).some((g) => C.TB_GROUPS[g].includes(key) && C.isHidden('tb:' + g));
      [...el.tlBar.children].forEach((n) => { if (n.dataset && n.dataset.tb && n.dataset.tb !== 'target') n.hidden = gone(n.dataset.tb); });
      const kids = [...el.tlBar.children].filter((n) => !n.hidden); let prevSep = true;
      kids.forEach((n, i) => { if (n.classList.contains('tlsep')) { const next = kids.slice(i + 1).find((q) => !q.classList.contains('tlsep') && !q.classList.contains('tlfill')); n.style.display = prevSep || !next ? 'none' : ''; if (n.style.display !== 'none') prevSep = true; } else if (!n.classList.contains('tlfill')) prevSep = false; });
    }
    const offCfg = MC.cfg.onChange(() => { applyUiHide(); renderTop(); renderRail(); renderPanels(); });
    const offUpd = MC.update ? MC.update.on(() => renderTop()) : () => {};
    applyUiHide();
    function setLayout(o) {
      o = o || {}; const g = LY.geo;
      Object.assign(LY, LAYOUT_DEF, o, { dock: Object.assign({}, DEF_DOCK, o.dock || {}), geo: g, last: [] });
      if (LY.hr) { LY.hy = LY.hp = true; LY.hr = false; }
      applyLayout(); saveLayout(); renderTop();
    }
    { const del0 = ACT.delete; ACT.delete = (e) => { const n = S.hpos, r = del0(e); if (r !== false && S.hpos > n && !document.querySelector('.toast .tact')) undoToast(t('Eliminado', 'Deleted')); return r; }; }
    function onKey(e) {
      if (S.alive && e.key === 'F6') { e.preventDefault(); cycleRegion(e.shiftKey ? -1 : 1); return; }
      if (S.alive && e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-5]$/.test(e.code) && !((e.target && e.target.ownerDocument) || document).querySelector('.scrim, .tour')) { e.preventDefault(); focusRegion(['viewer', 'timeline', 'tools', 'layers', 'props'][+e.code.slice(5) - 1]); return; }
      if (!S.alive || ((e.target && e.target.ownerDocument) || document).querySelector('.scrim, .tour') || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === 'Enter' && S.poly) { closePoly(); return; }
      if (e.key === 'Escape' && qAll('.ctxmenu').length) { closeCtx(); return; }
      if (e.key === 'Escape') { if (S.poly) { S.poly = null; S.polyCur = null; S.dirty = true; } else if (S.fmtOpen || S.ovMenu) { S.fmtOpen = false; S.ovMenu = false; renderFmtPop(); renderVbar(); } else clearSel(); return; }
      if (S.ws === 'creativo' && curTab() === 'subtitulos' && subById(S.sb) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'Enter') { e.preventDefault(); markWord(); return; }
        if (e.key === '.') { e.preventDefault(); silenceHere(); return; }
        if (e.key === 'Backspace') { e.preventDefault(); unmarkWord(); return; }
      }
      const id = MC.keys.match(e), c = MC.keys.combo(e);
      if (!id || !ACT[id]) return;
      /* las herramientas de una sola letra no se usan mientras se escribe en el editor de subtítulos */
      if (['selectTool', 'blade', 'trimStart', 'trimEnd', 'snap', 'keyframe'].includes(id) && S.ws === 'creativo' && curTab() === 'subtitulos' && !e.ctrlKey && !e.metaKey && !e.altKey) return;
      if (/^(BUTTON|A)$/.test(e.target.tagName) && (c === 'Space' || c === 'Enter')) return; // el control enfocado lo usa
      if (ACT[id](e) !== false) e.preventDefault();
    }
    const onFs = () => setTimeout(fit, 120);
    document.addEventListener('fullscreenchange', onFs);
    const altOn = (e) => { S.altSnap = !!e.altKey; }, guideOff = () => snapGuide(null);
    document.addEventListener('pointermove', altOn, true); document.addEventListener('keydown', altOn, true); document.addEventListener('keyup', altOn, true); document.addEventListener('pointerup', guideOff, true); document.addEventListener('pointercancel', guideOff, true);
    document.addEventListener('keydown', onKey);
    const onHide = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save); window.addEventListener('pagehide', closePops);
    window.addEventListener('focus', () => { MC.hostDoc = document; });
    function cleanup() { offCfg(); offUpd(); document.removeEventListener('pointermove', altOn, true); document.removeEventListener('keydown', altOn, true); document.removeEventListener('keyup', altOn, true); document.removeEventListener('pointerup', guideOff, true); document.removeEventListener('pointercancel', guideOff, true); closePops(); window.removeEventListener('pagehide', closePops); clearInterval(verTimer); offJobChip(); MC.audio.stop(); cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', save); window.removeEventListener('resize', onWinResize); document.removeEventListener('pointerdown', onDocDown); document.removeEventListener('pointerdown', rgDown, true); document.removeEventListener('pointermove', rgMove, true); document.removeEventListener('pointerup', rgUp, true); document.removeEventListener('pointercancel', rgUp, true); }
    MC.studioCleanup = () => { S.alive = false; MC.studioApi = null; cleanup(); };
    MC.studioApi = {
      seek: (tm) => { togglePlay(false); setTime(tm); },
      selectLayer: () => { const sh = shot(); if (sh && sh.layers.length && S.li < 0) { S.li = sh.layers.length - 1; S.tx = null; renderLayers(); renderInspector(); } },
      openMix: () => { setWs('creativo'); S.tab.creativo = 'mezclador'; renderRail(); renderPanels(); },
      openWs: (v, tab) => { setWs(v); if (tab) { S.tab[v] = tab; renderRail(); renderPanels(); } },
      proyectoTab: () => { setWs('montaje'); S.tab.montaje = 'proyecto'; renderRail(); renderPanels(); },
      openExportWs: () => { setWs('exportar'); }, platformPreview: () => openPlatformPreview(),
      importFiles: (files, mode) => importFiles(files, mode), aiBegin, ai: () => !!S.ai, project: () => S.project, time: () => S.time, cropHandles: () => { const cb = cropTargetBox(); if (!cb) return null; const c = el.canvas, r = c.getBoundingClientRect(), k = r.width / c.width; return cropHandles(cb.b).map((q) => ({ h: q.h, x: r.left + q.X * k, y: r.top + q.Y * k })); }, info: () => ({ id: S.project.id, name: S.project.name, linea_de_tiempo: S.project.tl === 'free' ? 'por pistas' : 'por planos', shots: S.project.tl === 'free' ? 0 : S.project.shots.length, clips: S.project.tl === 'free' ? S.project.overlays.length + S.project.xshots.length + S.project.texts.filter((q) => q.kind !== 'sub').length : undefined, pistas: S.project.tl === 'free' ? S.project.otracks.length : undefined, assets: (S.project.assets || []).length }),
      libItems: () => S.libItems, libReady: () => loadLib(false),
      learn: () => ({ selKind: S.selKind, xs: S.xs, ov: S.ov, multi: S.multi.length, tab: S.tab && S.tab[S.ws], shot: S.si, sim: !!S.sim, li: S.li, tx: S.tx, ov: S.ov, sb: S.sb, ws: S.ws, view: S.view, safe: !!S.safe, kfAdv: !!S.kfAdv, autoKf: !!S.autoKf, time: S.time, playing: !!S.playing }),
      refit: () => { fit(); }, saveNow: () => save(), redraw: () => { S.dirty = true; renderPanels(); renderTimeline(); }, setLayout,
      applyQuality: () => { const pq = MC.store.get('pq', 'auto'); S.quality = pq === 'media' || pq === 'full' ? pq : (innerWidth < 900 || (navigator.deviceMemory && navigator.deviceMemory <= 2)) ? 'media' : 'full'; renderVbar(); fit(); },
    };
    if (MC.learn && (MC.pendingLearn || MC.learn.active())) setTimeout(MC.learn.resume, 700);
    if (MC.pendingTour) { const id = MC.pendingTour; MC.pendingTour = null; setTimeout(() => MC.startTour(id), 500); }
  };
})();
