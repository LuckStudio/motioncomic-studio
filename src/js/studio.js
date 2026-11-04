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

    const S = { project, si: 0, li: -1, cl: null, time: 0, playing: false, loop: true, view: 'out', kf: 'to', adv: MC.store.get('adv', '0') === '1',
      ws: 'montaje', mtab: 'inspector', holes: false, safe: false, pps: 70, open: { plano: true, camara: true, capa: true, proyecto: false, audio: true, mezcla: false },
      hist: [], hpos: -1, dirty: true, alive: true, dpr: 1, savedAt: project.updated, dragging: false };
    const el = {};
    const shot = () => S.project.shots[S.si];
    const layer = () => (shot() ? shot().layers[S.li] : null);
    const opts = (extra) => MC.renderOpts(S.project, Object.assign({ holes: S.holes && S.view === 'out' }, extra));

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
    function commit() { pushHist(); touch(); renderLayers(); renderInspector(); renderTimeline(); updateHistBtns(); }
    function updateHistBtns() { if (el.undo) { el.undo.disabled = S.hpos <= 0; el.redo.disabled = S.hpos >= S.hist.length - 1; } }
    function restore(i) {
      S.hpos = i; S.project = JSON.parse(S.hist[i]);
      S.si = clamp(S.si, 0, S.project.shots.length - 1); S.li = clamp(S.li, -1, shot().layers.length - 1);
      fit(); renderAll(); touch(); updateHistBtns();
    }
    const undo = () => { if (S.hpos > 0) restore(S.hpos - 1); };
    const redo = () => { if (S.hpos < S.hist.length - 1) restore(S.hpos + 1); };
    pushHist();

    /* ---------- selección y tiempo ---------- */
    function selectShot(i, seek) {
      S.si = clamp(i, 0, S.project.shots.length - 1); S.li = -1; S.cl = null;
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
      for (const f of psds) await importPsd(f);
      if (auds.length) await importAudio(auds, 'auto');
      list = list.filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name));
      if (!list.length) return;
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
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
      el.undo = h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Deshacer (Ctrl+Z)', 'Undo (Ctrl+Z)'), 'aria-label': t('Deshacer', 'Undo'), onClick: undo }, MC.icon('undo'));
      el.redo = h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Rehacer (Ctrl+Mayús+Z)', 'Redo (Ctrl+Shift+Z)'), 'aria-label': t('Rehacer', 'Redo'), onClick: redo }, MC.icon('redo'));
      MC.put(MC.clear(el.top), 
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Volver a tus proyectos', 'Back to your projects'), 'aria-label': t('Volver a tus proyectos', 'Back to your projects'), onClick: close }, MC.icon('back')),
        MC.mark(24),
        h('input', { class: 'ttl', 'aria-label': t('Nombre del proyecto', 'Project name'), value: S.project.name, onChange: (e) => { S.project.name = e.target.value.trim() || S.project.name; commit(); } }),
        h('div', { class: 's-tabs', role: 'tablist', 'aria-label': t('Espacios de trabajo', 'Workspaces') },
          wsBtn('montaje', t('Montaje', 'Edit')), wsBtn('capas', t('Capas y profundidad', 'Layers and depth')), wsBtn('audio', 'Audio'), h('button', { type: 'button', role: 'tab', 'aria-selected': 'false', onClick: openExport }, t('Exportación', 'Export'))),
        h('span', { class: 'sp' }),
        el.status, el.undo, el.redo,
        MC.ui.seg([{ v: '0', l: t('Simple', 'Simple') }, { v: '1', l: t('Avanzado', 'Advanced') }], S.adv ? '1' : '0', (v) => { S.adv = v === '1'; MC.store.set('adv', v); renderInspector(); }, t('Nivel de uso', 'Skill level')),
        h('button', { class: 'btn btn-p hide-n', type: 'button', onClick: openExport }, t('Exportar', 'Export')));
      setStatus(true); updateHistBtns();
    }
    async function close() { S.alive = false; togglePlay(false); await save(); cleanup(); MC.app.render(); }

    /* ---------- capas ---------- */
    function renderLayers() {
      const b = el.layersBody, sh = shot();
      MC.clear(b);
      if (!sh) return;
      if (!sh.layers.length) b.append(h('p', { class: 'cap', style: { padding: '8px' } }, t('Este plano aún no tiene capas. Importa una ilustración.', 'This shot has no layers yet. Import an illustration.')));
      for (let i = sh.layers.length - 1; i >= 0; i--) {
        const l = sh.layers[i], a = MC.assets.get(l.assetId), idx = i;
        b.append(h('div', { class: 'layer' + (i === S.li ? ' on' : '') + (l.visible === false ? ' off' : ''), onClick: () => { S.li = idx; S.dirty = true; renderLayers(); renderInspector(); } },
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
      if (S.adv) {
        const kf = cam[S.kf];
        camNodes.push(h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Fotogramas clave', 'Keyframes')),
          MC.ui.seg([{ v: 'from', l: t('Inicio', 'Start') }, { v: 'to', l: t('Fin', 'End') }], S.kf, (v) => { S.kf = v; renderInspector(); renderVbar(); S.dirty = true; })),
          MC.ui.slider({ label: t('Posición X', 'Position X'), min: -0.5, max: 0.5, step: 0.005, value: kf.x, fmt: (v) => v.toFixed(3), onInput: (v) => setKf('x', v), onChange: commit }),
          MC.ui.slider({ label: t('Posición Y', 'Position Y'), min: -0.5, max: 0.5, step: 0.005, value: kf.y, fmt: (v) => v.toFixed(3), onInput: (v) => setKf('y', v), onChange: commit }),
          MC.ui.slider({ label: 'Zoom', min: 1, max: 4, step: 0.01, value: kf.zoom, fmt: (v) => '×' + v.toFixed(2), onInput: (v) => setKf('zoom', v), onChange: commit }),
          MC.ui.slider({ label: t('Giro', 'Rotation'), min: -20, max: 20, step: 0.5, value: kf.rot || 0, fmt: (v) => v.toFixed(1) + '°', onInput: (v) => setKf('rot', v), onChange: commit }),
          MC.ui.slider({ label: t('Temblor', 'Shake'), min: 0, max: 3, step: 0.05, value: cam.shake || 0, fmt: (v) => v.toFixed(2), onInput: (v) => { cam.shake = v; cam.preset = 'custom'; S.dirty = true; touch(); }, onChange: commit }));
      }
      camNodes.push(h('p', { class: 'cap' }, t('Arrastra el marco en la vista «Cámara» para encuadrar a mano.', 'Drag the frame in the “Camera” view to frame by hand.')));
      if (hi.any) camNodes.push(h('p', { class: 'cap ' + (p.overscan !== false || hi.ratio <= 1.002 ? 'good' : 'bad') },
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
      MC.put(b, S.ws === 'audio' ? audioSecs.concat(ordered) : ordered.slice(0, 3).concat(audioSecs, ordered.slice(3)));
      b.scrollTop = top;
    }

    /* ---------- visor ---------- */
    function renderVbar() {
      const tog = (key, label, title) => h('button', { class: 'btn btn-g btn-sm', type: 'button', 'aria-pressed': String(S[key]), title, onClick: () => { S[key] = !S[key]; renderVbar(); S.dirty = true; } }, label);
      const portrait = opts().W / opts().H < 0.8;
      MC.put(MC.clear(el.vbar), 
        MC.ui.seg([{ v: 'out', l: t('Salida', 'Output') }, { v: 'cam', l: t('Cámara', 'Camera') }], S.view, (v) => { S.view = v; if (v === 'cam') togglePlay(false); renderVbar(); fit(); }, t('Vista', 'View')),
        S.view === 'cam' ? MC.ui.seg([{ v: 'from', l: t('Inicio', 'Start') }, { v: 'to', l: t('Fin', 'End') }], S.kf, (v) => { S.kf = v; S.dirty = true; renderInspector(); }, t('Fotograma clave', 'Keyframe')) : null,
        tog('holes', t('Huecos', 'Gaps'), t('Marca en rojo los huecos del fondo', 'Marks background gaps in red')),
        portrait ? tog('safe', t('Zonas seguras', 'Safe zones'), t('Muestra lo que tapa la interfaz de TikTok, Reels y Shorts', 'Shows what the TikTok, Reels and Shorts interface covers')) : null,
        h('span', { style: { flex: 1 } }),
        h('span', { class: 'status' }, S.project.ratio + ' · ' + S.project.res + ' · ' + opts().W + '×' + opts().H));
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
    }
    function fit() {
      const c = el.canvas, st = el.stage, o = opts();
      const A = o.W / o.H, pw = st.clientWidth - 24, ph = st.clientHeight - 12;
      if (pw <= 0 || ph <= 0) return;
      const w = Math.min(pw, ph * A), dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.style.width = w + 'px'; c.style.height = w / A + 'px';
      const cw = Math.round(w * dpr), chh = Math.round(cw / A);
      if (c.width !== cw || c.height !== chh) { c.width = cw; c.height = chh; }
      S.dpr = dpr; S.dirty = true; renderVbar();
    }
    const frameRect = (kf, o) => ({ cx: o.W / 2 + kf.x * o.W, cy: o.H / 2 + kf.y * o.H, hw: o.W / (2 * kf.zoom), hh: o.H / (2 * kf.zoom) });
    const camMap = (c, o) => { const k = c.width / (o.W * VIEW_W); return { k, ox: (c.width - o.W * k) / 2, oy: (c.height - o.H * k) / 2 }; };

    function draw() {
      const c = el.canvas; if (!c.width) return;
      const ctx = c.getContext('2d'), o = opts(), sh = shot();
      el.empty.hidden = !!(sh && sh.layers.length);
      if (S.view === 'cam' && sh) return drawCam(ctx, o, sh);
      const k = c.width / o.W;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      MC.renderFrame(ctx, S.project, S.time, o);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (S.safe) drawSafe(ctx, c);
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

    /* interacción con el visor */
    let drag = null;
    function wire(c) {
      const px = (e) => { const r = c.getBoundingClientRect(), s = c.width / r.width; return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s }; };
      c.addEventListener('pointerdown', (e) => {
        const sh = shot(), o = opts(), p = px(e);
        if (!sh) return;
        if (S.view === 'cam') {
          const { k, ox, oy } = camMap(c, o), kf = sh.camera[S.kf], fr = frameRect(kf, o);
          const hx = (fr.cx + fr.hw) * k + ox, hy = (fr.cy + fr.hh) * k + oy;
          const wx = (p.x - ox) / k, wy = (p.y - oy) / k;
          if (Math.hypot(p.x - hx, p.y - hy) < 26 * S.dpr) drag = { m: 'zoom', k, ox, oy, fr, o, kf };
          else if (Math.abs(wx - fr.cx) <= fr.hw && Math.abs(wy - fr.cy) <= fr.hh) drag = { m: 'move', p0: p, x0: kf.x, y0: kf.y, k, o, kf };
        } else if (layer() && !S.playing) {
          const l = layer(), img = MC.assets.get(l.assetId);
          if (!img) return;
          const tl = clamp(S.time - MC.shotStarts(S.project)[S.si], 0, sh.duration);
          drag = { m: 'layer', p0: p, x0: l.x || 0, y0: l.y || 0, zl: MC.layerGeom(l, img, MC.camAt(sh, tl, false), o).zl, l };
        }
        if (drag) { c.setPointerCapture(e.pointerId); S.dragging = true; }
      });
      c.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const p = px(e), sh = shot();
        if (drag.m === 'move') {
          drag.kf.x = clamp(drag.x0 + (p.x - drag.p0.x) / drag.k / drag.o.W, -0.6, 0.6); drag.kf.y = clamp(drag.y0 + (p.y - drag.p0.y) / drag.k / drag.o.H, -0.6, 0.6);
          sh.camera.preset = 'custom';
        } else if (drag.m === 'zoom') {
          const wx = (p.x - drag.ox) / drag.k; drag.kf.zoom = clamp(drag.o.W / (2 * Math.max(1, wx - drag.fr.cx)), 1, 4); sh.camera.preset = 'custom';
        } else if (drag.m === 'layer') {
          drag.l.x = drag.x0 + (p.x - drag.p0.x) / c.width / drag.zl; drag.l.y = drag.y0 + (p.y - drag.p0.y) / c.height / drag.zl;
        }
        S.dirty = true; scheduleSave();
      });
      const up = () => { if (!drag) return; drag = null; S.dragging = false; commit(); };
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
      { es: '1 · Planos', en: '1 · Shots' }, { es: '2 · Texto y efectos', en: '2 · Text and effects' }, { es: '3 · Locución', en: '3 · Voice' },
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
      const end = Math.max(total, ...p.clips.map((c) => c.start + c.dur));
      el.tlContent.style.width = Math.max(end * pps + 120, 320) + 'px';
      el.tlContent.querySelectorAll('.clip[data-i]').forEach((c) => {
        const i = +c.dataset.i, sh = p.shots[i]; if (!sh) return;
        c.style.left = starts[i] * pps + 'px'; c.style.width = Math.max(8, sh.duration * pps - 2) + 'px';
      });
      el.tlContent.querySelectorAll('.clip[data-tr]').forEach((c) => {
        const i = +c.dataset.tr, sh = p.shots[i]; if (!sh) return;
        c.style.left = starts[i] * pps + 'px'; c.style.width = Math.max(8, Math.min(sh.transition.dur, sh.duration * 0.9) * pps - 2) + 'px';
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
      const end = Math.max(total, ...p.clips.map((c) => c.start + c.dur));
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
        rz.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); rz.setPointerCapture(e.pointerId);
          const x0 = e.clientX, d0 = sh.duration; clip._moved = true;
          const mv = (ev) => { sh.duration = clamp(Math.round((d0 + (ev.clientX - x0) / S.pps) * 10) / 10, 0.5, 60); clip.firstChild.textContent = sh.name + ' · ' + sh.duration.toFixed(1) + ' s'; layoutClips(); S.dirty = true; };
          const endd = () => { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', endd); rz.removeEventListener('pointercancel', endd); setTimeout(() => { clip._moved = false; }, 0); commit(); };
          rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', endd); rz.addEventListener('pointercancel', endd);
        });
        rows[0].append(clip);
        if (i > 0 && sh.transition.type !== 'cut') {
          const tr = MC.TRANSITIONS.find((x) => x.v === sh.transition.type);
          rows[1].append(h('div', { class: 'clip fx', 'data-tr': i, title: t('Transición de entrada', 'Entry transition') }, h('span', null, t(tr.es, tr.en))));
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
          el2.classList.add('on'); S.cl = c.id;
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
    el.stage = h('div', { class: 'stage' }, el.canvas, el.empty);
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
      else if (k === 's' && S.cl) splitClip();
      else if ((k === 'delete' || k === 'backspace') && S.cl && !layer()) { S.project.clips = S.project.clips.filter((c) => c.id !== S.cl); S.cl = null; commit(); }
      else if ((k === 'delete' || k === 'backspace') && layer()) { shot().layers.splice(S.li, 1); S.li = -1; commit(); }
    }
    document.addEventListener('keydown', onKey);
    const onHide = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    function cleanup() { MC.audio.stop(); cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', save); }
    MC.studioCleanup = () => { S.alive = false; cleanup(); };
  };
})();
