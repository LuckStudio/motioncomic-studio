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

    const S = { project, si: 0, li: -1, cl: null, tx: null, hits: [], pn: null, pageMap: null, sim: null, time: 0, playing: false, loop: true, view: 'out', kf: 'to', adv: MC.store.get('adv', '0') === '1',
      ws: 'montaje', mtab: 'inspector', holes: false, safe: false, pps: 70, open: { plano: true, camara: true, capa: true, proyecto: false, audio: true, mezcla: false, texto: true, idiomas: false, pagina: true, estilo: false },
      hist: [], hpos: -1, dirty: true, alive: true, dpr: 1, savedAt: project.updated, dragging: false };
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
    function touch() { S.dirty = true; scheduleSave(); }
    function commit() { MC.finalizePages(S.project); pushHist(); touch(); renderLayers(); renderInspector(); renderTimeline(); updateHistBtns(); }
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
    function selectShot(i, seek) {
      S.si = clamp(i, 0, S.project.shots.length - 1); S.li = -1; S.cl = null; S.tx = null; S.pn = null;
      if (seek) S.time = MC.shotStarts(S.project)[S.si];
      S.dirty = true; renderLayers(); renderInspector(); renderTimeline(); updateTime();
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
      let list = [...files];
      const psds = list.filter((f) => /\.psd$/i.test(f.name)), auds = list.filter((f) => /^audio\//.test(f.type) || /\.(wav|mp3|m4a|ogg|aac)$/i.test(f.name));
      if (list.some((f) => /\.pdf$/i.test(f.name))) MC.toast(t('El PDF llega más adelante. Por ahora usa PSD, PNG, JPEG o WebP.', 'PDF arrives later. For now use PSD, PNG, JPEG or WebP.'));
      const pageMode = S.project.mode === 'page';
      if (pageMode) { for (const f of psds) { try { list.push(await MC.psdComposite(f)); } catch (e) { MC.toast(t('No se pudo leer ese PSD.', 'Could not read that PSD.')); } } }
      else for (const f of psds) await importPsd(f);
      if (auds.length) await importAudio(auds, 'auto');
      list = list.filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name));
      if (!list.length) return;
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
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
          commit(); selectShot(first, true);
        } else {
          const sh = shot(), empty = sh.layers.length === 0;
          for (let i = 0; i < list.length; i++) {
            const a = await MC.assets.add(list[i], list[i].name);
            sh.layers.push(MC.newLayer(a, empty && i === 0 ? { z: 0.1, role: 'fondo' } : { z: 0.5, role: '' }));
          }
          S.li = sh.layers.length - 1; commit();
        }
      } catch (e) { MC.toast(t('No se pudo leer esa imagen.', 'Could not read that image.')); }
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
      S.view = 'page'; S.pn = null; commit(); selectShot(first, true); fit();
      MC.toast(t(list.length + ' página(s) · ' + panels + ' viñeta(s) detectadas. Revisa el orden en la vista «Página».', list.length + ' page(s) · ' + panels + ' panel(s) detected. Check the order in the “Page” view.'));
    }
    async function importPsd(file) {
      MC.toast(t('Leyendo el PSD…', 'Reading the PSD…'));
      try {
        const r = await MC.importPsd(file), sh = shot(), warns = r.warnings.slice();
        const [pw, ph] = [r.doc.w, r.doc.h];
        if (Math.abs(pw / ph - opts().W / opts().H) > 0.06) warns.push(t('El PSD mide ' + pw + '×' + ph + ' y el proyecto es ' + S.project.ratio + ': se recorta para cubrir el encuadre. Puedes cambiar la proporción en «Formato».', 'The PSD is ' + pw + '×' + ph + ' and the project is ' + S.project.ratio + ': it is cropped to cover the frame. You can change the ratio in “Format”.'));
        if (!sh.layers.length) { sh.layers = r.shot.layers; sh.name = r.shot.name; S.li = -1; commit(); }
        else { S.project.shots.splice(S.si + 1, 0, r.shot); commit(); selectShot(S.si + 1, true); }
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
    const openExport = () => MC.openExport({ project: S.project, time: () => S.time, shotIndex: () => S.si, applyFormat: (r, res) => { S.project.ratio = r; S.project.res = res; fit(); commit(); } });

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
    function renderTop() {
      const wsBtn = (v, l, off) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(S.ws === v), disabled: !!off, title: off ? t('Llega en un paso posterior', 'Arrives in a later step') : '', onClick: () => { S.ws = v; studio.dataset.ws = v; S.open.capa = true; S.open.camara = v === 'montaje'; if (v === 'audio') S.open.mezcla = true; renderTop(); renderInspector(); fit(); } }, l);
      el.status = h('span', { class: 'status', 'aria-live': 'polite' });
      el.jobChip = h('button', { class: 'btn btn-s btn-sm hide-n', type: 'button', hidden: true, onClick: openExport });
      updateJobChip(MC.exportJob);
      el.undo = h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Deshacer (Ctrl+Z)', 'Undo (Ctrl+Z)'), 'aria-label': t('Deshacer', 'Undo'), onClick: undo }, MC.icon('undo'));
      el.redo = h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Rehacer (Ctrl+Mayús+Z)', 'Redo (Ctrl+Shift+Z)'), 'aria-label': t('Rehacer', 'Redo'), onClick: redo }, MC.icon('redo'));
      MC.put(MC.clear(el.top), 
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Volver a tus proyectos', 'Back to your projects'), 'aria-label': t('Volver a tus proyectos', 'Back to your projects'), onClick: close }, MC.icon('back')),
        MC.mark(24),
        h('input', { class: 'ttl', 'aria-label': t('Nombre del proyecto', 'Project name'), value: S.project.name, onChange: (e) => { S.project.name = e.target.value.trim() || S.project.name; commit(); } }),
        h('div', { class: 's-tabs', role: 'tablist', 'aria-label': t('Espacios de trabajo', 'Workspaces') },
          wsBtn('montaje', t('Montaje', 'Edit')), wsBtn('capas', t('Capas y profundidad', 'Layers and depth')), wsBtn('audio', 'Audio'), h('button', { type: 'button', role: 'tab', 'aria-selected': 'false', onClick: openExport }, t('Exportación', 'Export'))),
        h('span', { class: 'sp' }),
        el.jobChip, el.status, el.undo, el.redo,
        MC.ui.seg([{ v: '0', l: t('Simple', 'Simple') }, { v: '1', l: t('Avanzado', 'Advanced') }], S.adv ? '1' : '0', (v) => { S.adv = v === '1'; MC.store.set('adv', v); renderInspector(); }, t('Nivel de uso', 'Skill level')),
        h('button', { class: 'btn btn-p hide-n', type: 'button', onClick: openExport }, t('Exportar', 'Export')));
      setStatus(true); updateHistBtns();
    }
    function updateJobChip(job) {
      const c = el.jobChip; if (!c) return;
      c.hidden = !job || job.state === 'cancelled';
      if (c.hidden) return;
      c.textContent = job.state === 'running' ? t('Exportando ', 'Exporting ') + Math.round(job.progress * 100) + ' %' : job.state === 'done' ? t('Vídeo listo', 'Video ready') : t('Error al exportar', 'Export failed');
    }
    const offJobChip = MC.onExportJob(updateJobChip);
    async function close() { S.alive = false; togglePlay(false); await save(); cleanup(); MC.app.render(); }

    /* ---------- capas ---------- */
    function renderLayers() {
      const b = el.layersBody, sh = shot();
      MC.clear(b);
      if (!sh) return;
      if (!sh.layers.length) b.append(h('p', { class: 'cap', style: { padding: '8px' } }, t('Este plano aún no tiene capas. Importa una ilustración.', 'This shot has no layers yet. Import an illustration.')));
      for (let i = sh.layers.length - 1; i >= 0; i--) {
        const l = sh.layers[i], a = MC.assets.get(l.assetId), idx = i;
        b.append(h('div', { class: 'layer' + (i === S.li ? ' on' : '') + (l.visible === false ? ' off' : ''), onClick: () => { S.li = idx; S.tx = null; S.dirty = true; renderLayers(); renderInspector(); renderTimeline(); } },
          h('button', { class: 'btn btn-g', type: 'button', title: t('Mostrar u ocultar', 'Show or hide'), 'aria-label': t('Mostrar u ocultar', 'Show or hide'), onClick: (e) => { e.stopPropagation(); l.visible = l.visible === false; commit(); } }, MC.icon(l.visible === false ? 'eyeoff' : 'eye')),
          a ? h('img', { class: 'lt', src: a.thumb, alt: '' }) : h('span', { class: 'lt' }),
          h('span', { class: 'ln' }, l.name), h('span', { class: 'lz' }, 'z ' + l.z.toFixed(2))));
        if (i === S.li) {
          const mv = (d) => { const j = idx + d; if (j < 0 || j >= sh.layers.length) return; sh.layers.splice(j, 0, sh.layers.splice(idx, 1)[0]); S.li = j; commit(); };
          const b2 = (ic, title, fn) => h('button', { class: 'btn btn-g btn-ic', type: 'button', title, 'aria-label': title, onClick: fn }, MC.icon(ic));
          b.append(h('div', { class: 'lrow' }, b2('up', t('Traer adelante', 'Bring forward'), () => mv(1)), b2('down', t('Enviar atrás', 'Send back'), () => mv(-1)),
            b2('copy', t('Duplicar capa', 'Duplicate layer'), () => { const c = JSON.parse(JSON.stringify(l)); c.id = MC.uid(); c.name += ' 2'; sh.layers.splice(idx + 1, 0, c); S.li = idx + 1; commit(); }),
            b2('trash', t('Eliminar capa', 'Delete layer'), () => { sh.layers.splice(idx, 1); S.li = -1; commit(); })));
        }
      }
    }

    /* ---------- inspector ---------- */
    const sec = (id, title, nodes) => h('div', { class: 'sec', 'data-open': String(!!S.open[id]) },
      h('button', { class: 'sh', type: 'button', 'aria-expanded': String(!!S.open[id]), onClick: () => { S.open[id] = !S.open[id]; renderInspector(); } }, h('span', { class: 'eyebrow' }, title), MC.icon(S.open[id] ? 'up' : 'down', 14)),
      h('div', { class: 'sb' }, nodes));
    const nameIn = (label, value, fn) => { const id = 'n-' + MC.uid(); return MC.ui.field(label, h('input', { class: 'input', id, value, onChange: (e) => fn(e.target.value.trim()) }), id); };

    function renderInspector() {
      const b = el.inspBody, sh = shot(), l = layer(), p = S.project;
      if (!sh) return;
      const top = b.scrollTop;
      MC.clear(b);

      /* plano */
      const planoNodes = [
        nameIn(t('Nombre del plano', 'Shot name'), sh.name, (v) => { if (v) { sh.name = v; commit(); } }),
        MC.ui.slider({ label: t('Duración', 'Duration'), min: 0.5, max: 20, step: 0.1, value: sh.duration, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => { sh.duration = v; layoutClips(); touch(); }, onChange: commit }),
      ];
      if (S.si > 0) {
        planoNodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Transición de entrada', 'Entry transition')),
          MC.ui.chips(MC.TRANSITIONS.map((x) => ({ v: x.v, l: t(x.es, x.en) })), sh.transition.type, (v) => { sh.transition.type = v; commit(); })));
        if (sh.transition.type !== 'cut') planoNodes.push(MC.ui.slider({ label: t('Duración de la transición', 'Transition length'), min: 0.2, max: 2, step: 0.1, value: sh.transition.dur, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => { sh.transition.dur = v; layoutClips(); touch(); }, onChange: commit }));
      }
      planoNodes.push(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const c = JSON.parse(JSON.stringify(sh)); c.id = MC.uid(); c.name += ' 2'; c.layers.forEach((x) => { x.id = MC.uid(); }); p.shots.splice(S.si + 1, 0, c); commit(); selectShot(S.si + 1, true); } }, MC.icon('copy', 14), t('Duplicar plano', 'Duplicate shot')),
        h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', disabled: p.shots.length < 2, onClick: () => { p.shots.splice(S.si, 1); S.si = clamp(S.si, 0, p.shots.length - 1); S.li = -1; S.time = clamp(S.time, 0, MC.totalTime(p) - 0.001); commit(); setTime(S.time); } }, MC.icon('trash', 14), t('Eliminar plano', 'Delete shot'))));

      /* cámara */
      const cam = sh.camera;
      const setKf = (k, v) => { cam[S.kf][k] = v; cam.preset = 'custom'; S.dirty = true; touch(); };
      const hi = holeInfo();
      const camNodes = [
        h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Movimiento', 'Movement')),
          MC.ui.chips(MC.CAM_PRESETS.map((x) => ({ v: x.v, l: t(x.es, x.en) })), cam.preset, (v) => { MC.applyPreset(cam, v, cam.intensity); commit(); })),
        MC.ui.slider({ label: t('Intensidad', 'Intensity'), min: 0.2, max: 2, step: 0.05, value: cam.intensity, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => { if (cam.preset !== 'custom') { MC.applyPreset(cam, cam.preset, v); } else cam.intensity = v; S.dirty = true; touch(); }, onChange: commit }),
        h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Curva de velocidad', 'Speed curve')),
          MC.ui.seg([{ v: 'linear', l: t('Constante', 'Linear') }, { v: 'smooth', l: t('Suave', 'Smooth') }, { v: 'in', l: t('Acelerada', 'Ease in') }, { v: 'out', l: t('Frenada', 'Ease out') }], cam.curve, (v) => { cam.curve = v; commit(); })),
      ];
      if (sh.page) camNodes.length = 0;
      if (S.adv && !sh.page) {
        const kf = cam[S.kf];
        camNodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Fotogramas clave', 'Keyframes')),
          MC.ui.seg([{ v: 'from', l: t('Inicio', 'Start') }, { v: 'to', l: t('Fin', 'End') }], S.kf, (v) => { S.kf = v; renderInspector(); renderVbar(); S.dirty = true; })),
          MC.ui.slider({ label: t('Posición X', 'Position X'), min: -0.5, max: 0.5, step: 0.005, value: kf.x, fmt: (v) => v.toFixed(3), onInput: (v) => setKf('x', v), onChange: commit }),
          MC.ui.slider({ label: t('Posición Y', 'Position Y'), min: -0.5, max: 0.5, step: 0.005, value: kf.y, fmt: (v) => v.toFixed(3), onInput: (v) => setKf('y', v), onChange: commit }),
          MC.ui.slider({ label: 'Zoom', min: 1, max: 4, step: 0.01, value: kf.zoom, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => setKf('zoom', v), onChange: commit }),
          MC.ui.slider({ label: t('Giro', 'Rotation'), min: -20, max: 20, step: 0.5, value: kf.rot || 0, fmt: (v) => v.toFixed(1) + '°', onInput: (v) => setKf('rot', v), onChange: commit }),
          MC.ui.slider({ label: t('Temblor', 'Shake'), min: 0, max: 3, step: 0.05, value: cam.shake || 0, fmt: (v) => v.toFixed(2), onInput: (v) => { cam.shake = v; cam.preset = 'custom'; S.dirty = true; touch(); }, onChange: commit }));
      }
      if (sh.page) camNodes.push(h('p', { class: 'cap' }, t('En un plano de página la cámara sigue las viñetas. Se ajusta en la sección «Página».', 'In a page shot the camera follows the panels. Adjust it in the “Page” section.')));
      else camNodes.push(h('p', { class: 'cap' }, t('Arrastra el marco en la vista «Cámara» para encuadrar a mano.', 'Drag the frame in the “Camera” view to frame by hand.')));
      if (hi.any && !sh.page) camNodes.push(h('p', { class: 'cap ' + (p.overscan !== false || hi.ratio <= 1.002 ? 'good' : 'bad') },
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
            MC.ui.chips(DEPTHS.map((d) => ({ v: d.z, l: t(d.es, d.en), title: 'z ' + d.z })), DEPTHS.find((d) => Math.abs(d.z - l.z) < 0.001) ? l.z : null, (v) => { l.z = v; commit(); }),
            h('span', { class: 'cap' }, t('Las capas cercanas se mueven más que las lejanas.', 'Near layers move more than far ones.'))),
          MC.ui.slider({ label: t('Profundidad (z)', 'Depth (z)'), min: 0, max: 1, step: 0.01, value: l.z, fmt: (v) => v.toFixed(2), onInput: (v) => set('z', v), onChange: commit }),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: l.role === 'fondo', onChange: (e) => { l.role = e.target.checked ? 'fondo' : ''; commit(); } }),
            h('span', null, t('Es el fondo', 'This is the background'), h('small', null, t('Se sobreescala para no dejar huecos al mover la cámara.', 'Scaled up so no gaps show when the camera moves.')))),
          MC.ui.slider({ label: t('Desenfoque de profundidad', 'Depth blur'), min: 0, max: 30, step: 0.5, value: l.blur || 0, fmt: (v) => v.toFixed(1) + ' px', onInput: (v) => set('blur', v), onChange: commit }),
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
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const L = sh.layers.find((l) => l.page), img = MC.assets.get(L.assetId); pg.panels = MC.detectPanels(img.bitmap, pg.dir); pg.manual = false; S.pn = null; commit(); MC.toast(t(pg.panels.length + ' viñetas detectadas', pg.panels.length + ' panels detected')); } }, t('Detectar viñetas', 'Detect panels')),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { const q = { id: MC.uid(), x0: 0.3, y0: 0.3, x1: 0.7, y1: 0.7, hold: null }; pg.panels.push(q); S.pn = q.id; edit(); S.view = 'page'; commit(); fit(); } }, MC.icon('plus', 14), t('Añadir viñeta', 'Add panel'))),
          h('div', { style: { display: 'grid', gap: '2px' } }, rowsP),
          h('p', { class: 'cap' }, t('En la vista «Página» arrastra una viñeta para moverla, sus esquinas para cambiarla, o dibuja en un hueco para crear otra. Las viñetas son rectángulos; el polígono libre llega más adelante.', 'In the “Page” view drag a panel to move it, its corners to resize it, or draw in an empty spot to create another. Panels are rectangles; free polygons come later.')),
        ];
        if (selP) nodes.push(
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: selP.hold == null, onChange: (e) => { selP.hold = e.target.checked ? null : Math.round(MC.panelHold(selP) * 10) / 10; edit(); commit(); } }), h('span', null, t('Permanencia automática', 'Automatic hold'), h('small', null, t('Según el tamaño de la viñeta.', 'Based on the panel size.')))),
          selP.hold != null ? MC.ui.slider({ label: t('Permanencia de la viñeta', 'Panel hold'), min: 0.5, max: 10, step: 0.1, value: selP.hold, fmt: (v) => v.toFixed(1) + ' s', onInput: (v) => { selP.hold = v; touch(); }, onChange: () => { edit(); commit(); } }) : null,
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: async () => { const a = await MC.cropPanel(sh, selP), ns = MC.newShot(t('Viñeta ', 'Panel ') + (pg.panels.indexOf(selP) + 1)); ns.layers.push(MC.newLayer(a, { z: 0.1, role: 'fondo' })); MC.applyPreset(ns.camera, 'zoomin', 0.8); p.shots.splice(S.si + 1, 0, ns); commit(); MC.toast(t('Viñeta convertida en un plano libre después de esta página', 'Panel turned into a free shot after this page')); } }, t('Convertir en plano libre', 'Turn into free shot')),
            h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', onClick: () => { pg.panels = pg.panels.filter((q) => q !== selP); S.pn = null; edit(); commit(); } }, MC.icon('trash', 14), t('Quitar viñeta', 'Remove panel'))));
        pageSecs.push(sec('pagina', t('Página', 'Page') + ' · ' + pg.panels.length + ' ' + t('viñetas', 'panels'), nodes));
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
            h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', onClick: () => { p.clips = p.clips.filter((c) => c !== clip); S.cl = null; commit(); } }, MC.icon('trash', 14), t('Eliminar clip', 'Delete clip'))),
          a ? h('p', { class: 'cap' }, t('Duración original: ', 'Original length: ') + a.dur.toFixed(1) + ' s') : null]));
      }
      const hasVoice = p.clips.some((c) => c.track === 'voz');
      audioSecs.push(sec('mezcla', t('Mezcla de audio', 'Audio mix'), [
        MC.ui.slider({ label: t('Locución', 'Voice'), min: 0, max: 1.5, step: 0.01, value: mixv.voz, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { mixv.voz = v; touch(); }, onChange: commit }),
        MC.ui.slider({ label: 'SFX', min: 0, max: 1.5, step: 0.01, value: mixv.sfx, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { mixv.sfx = v; touch(); }, onChange: commit }),
        MC.ui.slider({ label: t('Música', 'Music'), min: 0, max: 1.5, step: 0.01, value: mixv.musica, fmt: (v) => Math.round(v * 100) + ' %', onInput: (v) => { mixv.musica = v; touch(); }, onChange: commit }),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: mixv.duck !== false, onChange: (e) => { mixv.duck = e.target.checked; commit(); } }), h('span', null, t('Ducking automático', 'Automatic ducking'), h('small', null, t('La música baja sola cuando habla la voz.', 'Music lowers by itself when the voice speaks.')))),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !hasVoice, onClick: () => { const ps = MC.audio.voicePauses(p); p.markers = ps.map((x) => Math.round(x.t * 100) / 100); commit(); MC.toast(ps.length ? t(ps.length + ' pausas marcadas en la regla', ps.length + ' pauses marked on the ruler') : t('No se han encontrado pausas', 'No pauses found')); } }, t('Marcar pausas de la voz', 'Mark voice pauses')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: !hasVoice || p.shots.length < 2, onClick: () => { if (MC.audio.fitShotsToVoice(p)) { commit(); setTime(S.time); MC.toast(t('Planos ajustados a la voz', 'Shots fitted to the voice')); } else MC.toast(t('Faltan pausas en la voz para repartir ' + p.shots.length + ' planos.', 'Not enough voice pauses to split ' + p.shots.length + ' shots.')); } }, t('Ajustar planos a la voz', 'Fit shots to voice'))),
        !hasVoice ? h('p', { class: 'cap' }, t('Añade una locución en la pista 3 para marcar pausas y ajustar los planos.', 'Add a voice-over on track 3 to mark pauses and fit shots.')) : null]));
      const ordered = [sec('plano', t('Plano', 'Shot') + ' · ' + sh.name, planoNodes), sec('camara', t('Cámara', 'Camera'), camNodes),
        sec('capa', l ? t('Capa', 'Layer') + ' · ' + l.name : t('Capa', 'Layer'), capaNodes), sec('proyecto', t('Formato y parallax', 'Format and parallax'), projNodes)];
      const estiloSec = sec('estilo', t('Mi estilo', 'My style'), styleNodes);
      MC.put(b, S.ws === 'audio' ? audioSecs.concat(textSecs, pageSecs, ordered.slice(0, 3), [idiomasSec], ordered.slice(3), [estiloSec]) : textSecs.concat(pageSecs, ordered.slice(0, 3), audioSecs, [idiomasSec], ordered.slice(3), [estiloSec]));
      b.scrollTop = top;
    }

    /* ---------- visor ---------- */
    function renderVbar() {
      const tog = (key, label, title) => h('button', { class: 'btn btn-g btn-sm', type: 'button', 'aria-pressed': String(S[key]), title, onClick: () => { S[key] = !S[key]; renderVbar(); S.dirty = true; } }, label);
      const portrait = opts().W / opts().H < 0.8;
      MC.put(MC.clear(el.vbar), 
        MC.ui.seg([{ v: 'out', l: t('Salida', 'Output') }].concat(shot() && shot().page ? [{ v: 'page', l: t('Página', 'Page') }] : [{ v: 'cam', l: t('Cámara', 'Camera') }]), S.view, (v) => { S.view = v; if (v !== 'out') togglePlay(false); renderVbar(); buildSim(); fit(); }, t('Vista', 'View')),
        S.view === 'cam' ? MC.ui.seg([{ v: 'from', l: t('Inicio', 'Start') }, { v: 'to', l: t('Fin', 'End') }], S.kf, (v) => { S.kf = v; S.dirty = true; renderInspector(); }, t('Fotograma clave', 'Keyframe')) : null,
        S.view === 'page' ? h('span', { class: 'status' }, t('Arrastra para mover, esquinas para cambiar, o dibuja una viñeta nueva', 'Drag to move, corners to resize, or draw a new panel')) : null,
        S.view !== 'page' ? tog('holes', t('Huecos', 'Gaps'), t('Marca en rojo los huecos del fondo', 'Marks background gaps in red')) : null,
        portrait && S.view === 'out' ? h('button', { class: 'btn btn-g btn-sm', type: 'button', 'aria-pressed': String(!!S.sim), title: t('Vista previa con la interfaz de una red social encima', 'Preview with a social app interface on top'), onClick: () => { S.sim = S.sim ? null : 'tiktok'; renderVbar(); buildSim(); } }, t('Simulador', 'Simulator')) : null,
        S.sim && S.view === 'out' ? MC.ui.seg([{ v: 'tiktok', l: 'TikTok' }, { v: 'reels', l: 'Reels' }, { v: 'shorts', l: 'Shorts' }], S.sim, (v) => { S.sim = v; buildSim(); }, t('Red social', 'Network')) : null,
        portrait ? tog('safe', t('Zonas seguras', 'Safe zones'), t('Muestra lo que tapa la interfaz de TikTok, Reels y Shorts', 'Shows what the TikTok, Reels and Shorts interface covers')) : null,
        S.view === 'out' ? h('span', { class: 'status', style: { marginLeft: '6px' } }, t('Texto', 'Text')) : null,
        S.view === 'out' ? [['bubble', t('Bocadillo', 'Bubble')], ['box', t('Caja', 'Box')], ['sfx', t('Onomatopeya', 'Sound word')], ['sub', t('Subtítulo', 'Subtitle')]].map((k) => h('button', { class: 'btn btn-g btn-sm', type: 'button', title: t('Añadir ', 'Add ') + k[1].toLowerCase() + t(' en el cabezal', ' at the playhead'), onClick: () => addText(k[0]) }, MC.icon('plus', 12), k[1])) : null,
        S.project.langs.length > 1 ? MC.ui.seg(S.project.langs.map((l) => ({ v: l, l: l.toUpperCase() })), S.project.lang, (v) => { S.project.lang = v; commit(); }, t('Idioma del texto', 'Text language')) : null,
        h('span', { style: { flex: 1 } }),
        h('span', { class: 'status' }, S.project.ratio + ' · ' + S.project.res + ' · ' + opts().W + '×' + opts().H));
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
    function positionSim() {
      if (!el.sim || el.sim.hidden) return;
      const c = el.canvas, st = el.stage.getBoundingClientRect(), r = c.getBoundingClientRect();
      Object.assign(el.sim.style, { left: r.left - st.left + 'px', top: r.top - st.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      el.sim.style.setProperty('--u', r.width / 100 + 'px');
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
      if (el.playhead) el.playhead.style.left = S.time * S.pps + 'px';
      if (el.simBar) el.simBar.style.width = (S.time / Math.max(0.1, total)) * 100 + '%';
    }
    function fit() {
      const c = el.canvas, st = el.stage, o = opts();
      const A = o.W / o.H, pw = st.clientWidth - 24, ph = st.clientHeight - 12;
      if (pw <= 0 || ph <= 0) return;
      const w = Math.min(pw, ph * A), dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.style.width = w + 'px'; c.style.height = w / A + 'px';
      const cw = Math.round(w * dpr), chh = Math.round(cw / A);
      if (c.width !== cw || c.height !== chh) { c.width = cw; c.height = chh; }
      S.dpr = dpr; S.dirty = true; renderVbar(); positionSim();
    }
    const frameRect = (kf, o) => ({ cx: o.W / 2 + kf.x * o.W, cy: o.H / 2 + kf.y * o.H, hw: o.W / (2 * kf.zoom), hh: o.H / (2 * kf.zoom) });
    const camMap = (c, o) => { const k = c.width / (o.W * VIEW_W); return { k, ox: (c.width - o.W * k) / 2, oy: (c.height - o.H * k) / 2 }; };

    function draw() {
      const c = el.canvas; if (!c.width) return;
      const hits = [], ctx = c.getContext('2d'), o = opts({ collect: hits }), sh = shot();
      S.hits = hits;
      el.empty.hidden = !!(sh && sh.layers.length);
      if (S.view === 'page' && !(sh && sh.page)) { S.view = 'out'; renderVbar(); }
      if (S.view === 'page') return drawPage(ctx, sh);
      if (S.view === 'cam' && sh) return drawCam(ctx, o, sh);
      const k = c.width / o.W;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      MC.renderFrame(ctx, S.project, S.time, o);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (S.safe) drawSafe(ctx, c);
      const hit = !S.playing && S.tx && hits.find((x) => x.id === S.tx);
      if (hit) {
        const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8C7CFF', b = hit.bounds;
        ctx.save(); ctx.strokeStyle = acc; ctx.lineWidth = 1.5 * S.dpr; ctx.setLineDash([6, 4]); ctx.strokeRect(b.x0 * k, b.y0 * k, (b.x1 - b.x0) * k, (b.y1 - b.y0) * k);
        if (hit.tip) { ctx.setLineDash([]); ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(hit.tip.x * k, hit.tip.y * k, 6 * S.dpr, 0, 6.283); ctx.fill(); }
        ctx.restore();
      }
    }
    function drawPage(ctx, sh) {
      const c = el.canvas, L = sh.layers.find((l) => l.page), img = L && MC.assets.get(L.assetId);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#16181B'; ctx.fillRect(0, 0, c.width, c.height);
      if (!img) return;
      const kp = Math.min(c.width / img.w, c.height / img.h) * 0.97, ox = (c.width - img.w * kp) / 2, oy = (c.height - img.h * kp) / 2, iw = img.w * kp, ih = img.h * kp;
      S.pageMap = { kp, ox, oy, img };
      ctx.drawImage(img.bitmap, ox, oy, iw, ih);
      const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8C7CFF', pg = sh.page, d = S.dpr;
      const R = (q) => [ox + q.x0 * iw, oy + q.y0 * ih, (q.x1 - q.x0) * iw, (q.y1 - q.y0) * ih];
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.rect(ox, oy, iw, ih); pg.panels.forEach((q) => { const r = R(q); ctx.rect(r[0], r[1], r[2], r[3]); }); ctx.fill('evenodd'); ctx.restore();
      ctx.save(); ctx.strokeStyle = acc; ctx.lineWidth = 1.2 * d; ctx.setLineDash([5 * d, 5 * d]); ctx.beginPath();
      pg.panels.forEach((q, i) => { const r = R(q), cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2; i ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy); }); ctx.stroke(); ctx.restore();
      const all = drag && drag.m === 'pnnew' ? pg.panels.concat([drag.q]) : pg.panels;
      all.forEach((q, i) => {
        const r = R(q), sel = q.id === S.pn;
        ctx.save(); ctx.strokeStyle = sel ? acc : 'rgba(255,255,255,.75)'; ctx.lineWidth = (sel ? 3 : 2) * d; ctx.strokeRect(r[0], r[1], r[2], r[3]);
        if (sel) { ctx.fillStyle = acc; [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0], r[1] + r[3]], [r[0] + r[2], r[1] + r[3]]].forEach((pt) => ctx.fillRect(pt[0] - 5 * d, pt[1] - 5 * d, 10 * d, 10 * d)); }
        if (pg.panels.includes(q)) {
          const rad = 12 * d; ctx.fillStyle = sel ? acc : '#0F1012'; ctx.strokeStyle = sel ? '#0F1012' : acc; ctx.lineWidth = 2 * d;
          ctx.beginPath(); ctx.arc(r[0] + rad + 4 * d, r[1] + rad + 4 * d, rad, 0, 6.283); ctx.fill(); ctx.stroke();
          ctx.fillStyle = sel ? '#0F1012' : '#ECEEF0'; ctx.font = '700 ' + 13 * d + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), r[0] + rad + 4 * d, r[1] + rad + 4.5 * d);
        }
        ctx.restore();
      });
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

    const txById = (id) => S.project.texts.find((x) => x.id === id);
    /* interacción con el visor */
    let drag = null;
    function wire(c) {
      const px = (e) => { const r = c.getBoundingClientRect(), s = c.width / r.width; return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s }; };
      c.addEventListener('pointerdown', (e) => {
        const sh = shot(), o = opts(), p = px(e);
        if (!sh) return;
        if (S.view === 'page') {
          const pg = sh.page, M = S.pageMap; if (!pg || !M) return;
          const iw = M.img.w * M.kp, ih = M.img.h * M.kp, nx = (p.x - M.ox) / iw, ny = (p.y - M.oy) / ih, sel = pg.panels.find((q) => q.id === S.pn);
          if (sel) {
            const cs = [['tl', sel.x0, sel.y0], ['tr', sel.x1, sel.y0], ['bl', sel.x0, sel.y1], ['br', sel.x1, sel.y1]];
            const hit = cs.find((q) => Math.hypot(M.ox + q[1] * iw - p.x, M.oy + q[2] * ih - p.y) < 16 * S.dpr);
            if (hit) drag = { m: 'pnsize', q: sel, corner: hit[0], M, iw, ih };
          }
          if (!drag) {
            const hit = pg.panels.filter((q) => nx >= q.x0 && nx <= q.x1 && ny >= q.y0 && ny <= q.y1).sort((a, b) => (a.x1 - a.x0) * (a.y1 - a.y0) - (b.x1 - b.x0) * (b.y1 - b.y0))[0];
            if (hit) { S.pn = hit.id; drag = { m: 'pnmove', q: hit, p0: p, o0: Object.assign({}, hit), iw, ih }; renderInspector(); }
            else { S.pn = null; drag = { m: 'pnnew', q: { id: MC.uid(), x0: clamp(nx, 0, 1), y0: clamp(ny, 0, 1), x1: clamp(nx, 0, 1), y1: clamp(ny, 0, 1), hold: null }, M, iw, ih, s0: { x: clamp(nx, 0, 1), y: clamp(ny, 0, 1) } }; }
          }
          if (drag) { c.setPointerCapture(e.pointerId); S.dragging = true; S.dirty = true; }
          return;
        }
        if (S.view === 'cam') {
          const { k, ox, oy } = camMap(c, o), kf = sh.camera[S.kf], fr = frameRect(kf, o);
          const hx = (fr.cx + fr.hw) * k + ox, hy = (fr.cy + fr.hh) * k + oy;
          const wx = (p.x - ox) / k, wy = (p.y - oy) / k;
          if (Math.hypot(p.x - hx, p.y - hy) < 26 * S.dpr) drag = { m: 'zoom', k, ox, oy, fr, o, kf };
          else if (Math.abs(wx - fr.cx) <= fr.hw && Math.abs(wy - fr.cy) <= fr.hh) drag = { m: 'move', p0: p, x0: kf.x, y0: kf.y, k, o, kf };
        } else if (!S.playing) {
          const k2 = c.width / o.W, fx = p.x / k2, fy = p.y / k2, cur = S.tx && txById(S.tx), chit = S.hits.find((x) => x.id === S.tx);
          if (cur && chit && chit.tip && Math.hypot(fx - chit.tip.x, fy - chit.tip.y) < (22 * S.dpr) / k2) drag = { m: 'tail', it: cur, hit: chit, o };
          else {
            const h2 = S.hits.slice().reverse().find((x) => fx >= x.bounds.x0 && fx <= x.bounds.x1 && fy >= x.bounds.y0 && fy <= x.bounds.y1);
            if (h2) {
              const it = txById(h2.id); S.tx = it.id; S.li = -1; S.cl = null;
              drag = it.kind === 'sub' ? { m: 'sub', p0: p, y0: MC.subY(S.project, o.W, o.H) } : { m: 'text', p0: p, x0: it.x, y0: it.y, it };
              renderInspector(); renderLayers(); renderTimeline(); S.dirty = true;
            } else if (S.tx) { S.tx = null; renderInspector(); renderTimeline(); S.dirty = true; }
          }
          if (!drag && layer()) {
          const l = layer(), img = MC.assets.get(l.assetId);
          if (!img) return;
          const tl = clamp(S.time - MC.shotStarts(S.project)[S.si], 0, sh.duration);
          drag = { m: 'layer', p0: p, x0: l.x || 0, y0: l.y || 0, zl: MC.layerGeom(l, img, MC.camAt(sh, tl, false), o).zl, l };
          }
        }
        if (drag) { c.setPointerCapture(e.pointerId); S.dragging = true; }
      });
      c.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const p = px(e), sh = shot();
        if (drag.m === 'pnmove') {
          const q = drag.q, o0 = drag.o0, dx = (p.x - drag.p0.x) / drag.iw, dy = (p.y - drag.p0.y) / drag.ih, w = o0.x1 - o0.x0, hh = o0.y1 - o0.y0;
          q.x0 = clamp(o0.x0 + dx, 0, 1 - w); q.y0 = clamp(o0.y0 + dy, 0, 1 - hh); q.x1 = q.x0 + w; q.y1 = q.y0 + hh;
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
        } else if (drag.m === 'layer') {
          drag.l.x = drag.x0 + (p.x - drag.p0.x) / c.width / drag.zl; drag.l.y = drag.y0 + (p.y - drag.p0.y) / c.height / drag.zl;
        }
        S.dirty = true; scheduleSave();
      });
      const up = () => {
        if (!drag) return;
        if (drag.m && drag.m.slice(0, 2) === 'pn') {
          const pg = shot().page;
          if (drag.m === 'pnnew') { const q = drag.q; if (q.x1 - q.x0 > 0.04 && q.y1 - q.y0 > 0.03) { pg.panels.push(q); S.pn = q.id; } }
          pg.manual = true;
        }
        drag = null; S.dragging = false; commit();
      };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
      c.addEventListener('wheel', (e) => {
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
      const end = Math.max(total, ...p.clips.map((c) => c.start + c.dur), ...p.texts.map((x) => { const q = MC.textSpan(x, p); return q.start + q.dur; }));
      el.tlContent.style.width = Math.max(end * pps + 120, 320) + 'px';
      el.tlContent.querySelectorAll('.clip[data-i]').forEach((c) => {
        const i = +c.dataset.i, sh = p.shots[i]; if (!sh) return;
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
      updateTime();
    }
    function snapT(tm, ignore) {
      const pts = [0, S.time].concat(MC.shotStarts(S.project), S.project.clips.filter((c) => c.id !== ignore).flatMap((c) => [c.start, c.start + c.dur]));
      let best = tm; const thr = 8 / S.pps;
      pts.forEach((x) => { if (Math.abs(x - tm) < thr && Math.abs(x - tm) <= Math.abs(best - tm)) best = x; });
      return Math.max(0, Math.round(best * 100) / 100);
    }
    function renderTimeline() {
      const p = S.project, total = MC.totalTime(p), pps = S.pps;
      const cs = getComputedStyle(document.documentElement); WAVE.fg = cs.getPropertyValue('--clip').trim();
      const addBtn = (tr) => h('button', { class: 'btn btn-g', type: 'button', title: t('Añadir audio a esta pista', 'Add audio to this track'), 'aria-label': t('Añadir audio a esta pista', 'Add audio to this track'), onClick: () => { fileAudio.dataset.track = tr; fileAudio.click(); } }, MC.icon('plus', 13));
      MC.put(MC.clear(el.tlLabels), h('div', { class: 'rs' }), TRACKS.map((tr, i) => h('div', { class: 'trl' }, h('span', null, t(tr.es, tr.en)),
        i >= 2 ? h('span', { class: 'trb' }, addBtn(AU[i - 2]), i === 2 ? h('button', { class: 'btn btn-g', type: 'button', title: t('Grabar locución', 'Record voice-over'), 'aria-label': t('Grabar locución', 'Record voice-over'), onClick: recordVoice }, MC.icon('mic', 13)) : null) : null)));
      MC.clear(el.tlContent);
      const ruler = h('div', { class: 'tl-ruler', 'aria-label': t('Regla de tiempo', 'Time ruler') });
      const step = pps >= 55 ? 1 : pps >= 28 ? 2 : 5;
      const end = Math.max(total, ...p.clips.map((c) => c.start + c.dur), ...p.texts.map((x) => { const q = MC.textSpan(x, p); return q.start + q.dur; }));
      for (let s = 0; s <= end + 40; s += step) ruler.append(h('b', { style: { left: s * pps + 'px' } }, Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')));
      p.markers.forEach((m) => ruler.append(h('i', { class: 'mk', title: t('Pausa de la voz', 'Voice pause'), style: { left: m * pps + 'px' } })));
      el.tlContent.append(ruler);
      const rows = TRACKS.map((tr, i) => h('div', { class: 'tl-track' + (i > 1 && !p.clips.some((c) => c.track === AU[i - 2]) ? ' off' : ''), 'data-hint': t('Importa o graba audio con los botones de la izquierda', 'Import or record audio with the buttons on the left') }));
      rows.forEach((r) => el.tlContent.append(r));
      p.shots.forEach((sh, i) => {
        const clip = h('div', { class: 'clip' + (i === S.si ? ' on' : ''), 'data-i': i, role: 'button', tabindex: '0', title: sh.name + ' · ' + sh.duration.toFixed(1) + ' s',
          onClick: () => { if (!clip._moved) selectShot(i, true); },
          onKeydown: (e) => { if (e.key === 'Enter') selectShot(i, true); } },
          h('span', null, sh.name + ' · ' + sh.duration.toFixed(1) + ' s'), h('div', { class: 'rz', 'aria-label': t('Cambiar duración', 'Change length') }));
        const rz = clip.querySelector('.rz');
        if (sh.page) rz.remove();
        else rz.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); rz.setPointerCapture(e.pointerId);
          const x0 = e.clientX, d0 = sh.duration; clip._moved = true;
          const mv = (ev) => { sh.duration = clamp(Math.round((d0 + (ev.clientX - x0) / S.pps) * 10) / 10, 0.5, 60); clip.firstChild.textContent = sh.name + ' · ' + sh.duration.toFixed(1) + ' s'; layoutClips(); S.dirty = true; };
          const endd = () => { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', endd); rz.removeEventListener('pointercancel', endd); setTimeout(() => { clip._moved = false; }, 0); commit(); };
          rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', endd); rz.addEventListener('pointercancel', endd);
        });
        rows[0].append(clip);
        if (i > 0 && sh.transition.type !== 'cut') {
          const tr = MC.TRANSITIONS.find((x) => x.v === sh.transition.type);
          rows[0].append(h('div', { class: 'clip fx thin', 'data-tr': i, title: t('Transición de entrada: ', 'Entry transition: ') + t(tr.es, tr.en) }));
        }
      });
      p.clips.forEach((c) => {
        const a = MC.audio.get(c.assetId);
        const el2 = h('div', { class: 'clip au' + (c.id === S.cl ? ' on' : ''), 'data-c': c.id, role: 'button', tabindex: '0', title: c.name }, h('canvas'), h('span', null, c.name), h('div', { class: 'rz', 'aria-label': t('Recortar el final', 'Trim the end') }));
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
        rows[2 + Math.max(0, AU.indexOf(c.track))].append(el2);
      });
      p.texts.forEach((it) => {
        const sp = MC.textSpan(it, p), label = MC.textOf(it, p) || t('(sin texto)', '(no text)');
        const el2 = h('div', { class: 'clip tx' + (it.kind === 'sub' ? ' sub' : '') + (it.id === S.tx ? ' on' : ''), 'data-x': it.id, role: 'button', tabindex: '0', title: label + (it.link ? t(' · vinculado a la voz', ' · linked to voice') : '') }, h('span', null, label.replace(/\n/g, ' ')), it.link ? null : h('div', { class: 'rz', 'aria-label': t('Cambiar duración', 'Change length') }));
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
        rows[1].append(el2);
      });
      el.playhead = h('div', { class: 'playhead' }); el.tlContent.append(el.playhead);
      layoutClips();
    }
    function wireTimeline() {
      let down = false;
      const at = (e) => (e.clientX - el.tlContent.getBoundingClientRect().left) / S.pps;
      el.tlContent.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.clip')) return;
        down = true; el.tlContent.setPointerCapture(e.pointerId); togglePlay(false); setTime(at(e));
      });
      el.tlContent.addEventListener('pointermove', (e) => { if (down) setTime(at(e)); });
      const end = () => { down = false; };
      el.tlContent.addEventListener('pointerup', end); el.tlContent.addEventListener('pointercancel', end);
    }

    /* ---------- montaje de la interfaz ---------- */
    const fileLayers = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,.psd,audio/*', multiple: true, hidden: true, id: 'f-layers', onChange: (e) => { importFiles(e.target.files, 'layers'); e.target.value = ''; } });
    const fileShots = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,.psd', multiple: true, hidden: true, id: 'f-shots', onChange: (e) => { importFiles(e.target.files, 'shots'); e.target.value = ''; } });
    const fileAudio = h('input', { type: 'file', accept: 'audio/*,.wav,.mp3,.m4a,.ogg', multiple: true, hidden: true, id: 'f-audio', onChange: (e) => { importAudio([...e.target.files], fileAudio.dataset.track || 'auto'); e.target.value = ''; } });
    el.top = h('div', { class: 's-top' });
    el.layersBody = h('div', { class: 'pbody' });
    el.inspBody = h('div', { class: 'pbody insp' });
    el.vbar = h('div', { class: 'vbar' });
    el.canvas = h('canvas', { 'aria-label': t('Visor del plano', 'Shot viewer') });
    el.empty = h('div', { class: 'drop' }, h('div', { class: 'in' }, MC.icon('image', 28),
      h('div', null, t('Arrastra aquí tus ilustraciones. Cada archivo será una capa.', 'Drag your artwork here. Each file becomes a layer.')),
      h('button', { class: 'btn btn-p', type: 'button', onClick: () => fileLayers.click() }, MC.icon('upload', 15), t('Importar', 'Import'))));
    el.sim = h('div', { class: 'sim', hidden: true, 'aria-hidden': 'true' });
    el.stage = h('div', { class: 'stage' }, el.canvas, el.empty, el.sim);
    el.play = h('button', { class: 'play', type: 'button', onClick: () => togglePlay() });
    el.loop = h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Repetir', 'Loop'), 'aria-label': t('Repetir', 'Loop'), onClick: () => { S.loop = !S.loop; updateTransport(); } }, MC.icon('loop'));
    el.time = h('div', { class: 'num' });
    el.tlTime = h('span', { class: 'num' });
    el.tlLabels = h('div', { class: 'tl-labels' });
    el.tlContent = h('div', { class: 'tl-content' });

    const layersPanel = h('div', { class: 'panel-col p-layers' },
      h('div', { class: 'ph' }, h('span', { class: 'eyebrow' }, t('Capas', 'Layers')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => fileLayers.click() }, MC.icon('plus', 14), t('Importar', 'Import'))), el.layersBody);
    const viewer = h('div', { class: 'viewer' }, el.vbar, el.stage,
      h('div', { class: 'tbar' },
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Ir al inicio (Inicio)', 'Go to start (Home)'), 'aria-label': t('Ir al inicio', 'Go to start'), onClick: () => setTime(0) }, MC.icon('first')),
        el.play, el.loop, el.time));
    const inspector = h('div', { class: 'panel-col p-inspector' }, h('div', { class: 'ph' }, h('span', { class: 'eyebrow' }, 'Inspector')), el.inspBody);
    const timeline = h('div', { class: 'p-timeline' },
      h('div', { class: 'tl-head' }, h('span', { class: 'eyebrow' }, t('Línea de tiempo', 'Timeline')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => fileShots.click() }, MC.icon('plus', 14), t('Planos desde imágenes', 'Shots from images')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: openLibrary }, MC.icon('note', 14), t('Sonidos', 'Sounds')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: splitClip, title: t('Dividir el clip de audio seleccionado en el cabezal (S)', 'Split the selected audio clip at the playhead (S)') }, MC.icon('cut', 14), t('Dividir', 'Split')),
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Alejar', 'Zoom out'), 'aria-label': t('Alejar', 'Zoom out'), onClick: () => { S.pps = clamp(S.pps / 1.3, 12, 240); renderTimeline(); } }, MC.icon('minus')),
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Acercar', 'Zoom in'), 'aria-label': t('Acercar', 'Zoom in'), onClick: () => { S.pps = clamp(S.pps * 1.3, 12, 240); renderTimeline(); } }, MC.icon('plus')), el.tlTime),
      h('div', { class: 'tl-body' }, el.tlLabels, h('div', { class: 'tl-scroll' }, el.tlContent)));
    const mtabs = h('div', { class: 'mtabs' }, [['layers', t('Capas', 'Layers')], ['inspector', 'Inspector'], ['timeline', t('Línea', 'Timeline')]].map((x) =>
      h('button', { type: 'button', 'aria-pressed': String(S.mtab === x[0]), onClick: (e) => { S.mtab = x[0]; studio.dataset.mtab = x[0]; e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); } }, x[1])));
    const studio = h('div', { class: 'studio', 'data-ws': S.ws, 'data-mtab': S.mtab }, el.top, h('div', { class: 's-main' }, layersPanel, viewer, inspector), mtabs, timeline, fileLayers, fileShots, fileAudio);

    function renderAll() { renderTop(); renderLayers(); renderInspector(); renderVbar(); renderTimeline(); updateTransport(); updateTime(); }
    MC.put(MC.clear(root), studio);
    renderAll(); wire(el.canvas); wireTimeline();
    MC.ensureFonts().then(() => { S.dirty = true; });
    MC.fonts.loadFor(S.project).then((miss) => { if (miss.length) MC.toast(t('Falta la tipografía: ', 'Missing font: ') + miss.join(', ') + t('. Se usa otra de reserva.', '. A fallback is used.')); S.dirty = true; });

    el.stage.addEventListener('dragover', (e) => { e.preventDefault(); el.stage.classList.add('over'); });
    el.stage.addEventListener('dragleave', () => el.stage.classList.remove('over'));
    el.stage.addEventListener('drop', (e) => { e.preventDefault(); el.stage.classList.remove('over'); if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files, 'layers'); });

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
      if (S.dirty) { S.dirty = false; try { draw(); } catch (e) { console.error(e); } }
    }
    raf = requestAnimationFrame(loop);

    /* atajos de teclado */
    function onKey(e) {
      if (!S.alive || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && k === 'y') { e.preventDefault(); redo(); }
      else if (mod) return;
      else if (k === ' ' || k === 'k') { e.preventDefault(); togglePlay(k === 'k' ? false : null); }
      else if (k === 'l') togglePlay(true);
      else if (k === 'j') setTime(S.time - 1);
      else if (k === 'arrowleft') setTime(S.time - (e.shiftKey ? 1 : 1 / 30));
      else if (k === 'arrowright') setTime(S.time + (e.shiftKey ? 1 : 1 / 30));
      else if (k === 'home') setTime(0);
      else if (k === 'c') { S.view = S.view === 'cam' ? 'out' : 'cam'; togglePlay(false); renderVbar(); fit(); }
      else if ((k === 'delete' || k === 'backspace') && S.view === 'page' && S.pn && shot().page) { const pg = shot().page; pg.panels = pg.panels.filter((q) => q.id !== S.pn); S.pn = null; pg.manual = true; commit(); }
      else if (k === 's' && S.cl) splitClip();
      else if ((k === 'delete' || k === 'backspace') && S.tx) { S.project.texts = S.project.texts.filter((x) => x.id !== S.tx); S.tx = null; commit(); }
      else if ((k === 'delete' || k === 'backspace') && S.cl && !layer()) { S.project.clips = S.project.clips.filter((c) => c.id !== S.cl); S.cl = null; commit(); }
      else if ((k === 'delete' || k === 'backspace') && layer()) { shot().layers.splice(S.li, 1); S.li = -1; commit(); }
    }
    document.addEventListener('keydown', onKey);
    const onHide = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    function cleanup() { offJobChip(); MC.audio.stop(); cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', save); }
    MC.studioCleanup = () => { S.alive = false; cleanup(); };
  };
})();
