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
    await MC.loadProjectAssets(project);

    const S = { project, si: 0, li: -1, time: 0, playing: false, loop: true, view: 'out', kf: 'to', adv: MC.store.get('adv', '0') === '1',
      ws: 'montaje', mtab: 'inspector', holes: false, safe: false, pps: 70, open: { plano: true, camara: true, capa: true, proyecto: false },
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
      S.si = clamp(i, 0, S.project.shots.length - 1); S.li = -1;
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
      updateTransport();
    }

    /* ---------- importar ---------- */
    async function importFiles(files, mode) {
      let list = [...files];
      if (list.some((f) => /\.(psd|pdf)$/i.test(f.name))) MC.toast(t('PSD y PDF llegan en el siguiente paso. Por ahora usa PNG, JPEG o WebP.', 'PSD and PDF arrive in the next step. For now use PNG, JPEG or WebP.'));
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
        ratio = Math.max(ratio, MC.coverScale(l, img, sh, o) / (Math.max(o.W / img.w, o.H / img.h) * (l.scale || 1)));
      });
      return { any, ratio, margin: MC.safeMargin(sh, o) };
    }

    /* ---------- barra superior ---------- */
    function renderTop() {
      const wsBtn = (v, l, off) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(S.ws === v), disabled: !!off, title: off ? t('Llega en un paso posterior', 'Arrives in a later step') : '', onClick: () => { S.ws = v; studio.dataset.ws = v; S.open.capa = true; S.open.camara = v === 'montaje'; renderTop(); renderInspector(); fit(); } }, l);
      el.status = h('span', { class: 'status', 'aria-live': 'polite' });
      el.undo = h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Deshacer (Ctrl+Z)', 'Undo (Ctrl+Z)'), 'aria-label': t('Deshacer', 'Undo'), onClick: undo }, MC.icon('undo'));
      el.redo = h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Rehacer (Ctrl+Mayús+Z)', 'Redo (Ctrl+Shift+Z)'), 'aria-label': t('Rehacer', 'Redo'), onClick: redo }, MC.icon('redo'));
      MC.put(MC.clear(el.top), 
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Volver a tus proyectos', 'Back to your projects'), 'aria-label': t('Volver a tus proyectos', 'Back to your projects'), onClick: close }, MC.icon('back')),
        MC.mark(24),
        h('input', { class: 'ttl', 'aria-label': t('Nombre del proyecto', 'Project name'), value: S.project.name, onChange: (e) => { S.project.name = e.target.value.trim() || S.project.name; commit(); } }),
        h('div', { class: 's-tabs', role: 'tablist', 'aria-label': t('Espacios de trabajo', 'Workspaces') },
          wsBtn('montaje', t('Montaje', 'Edit')), wsBtn('capas', t('Capas y profundidad', 'Layers and depth')), wsBtn('audio', 'Audio', true), wsBtn('export', t('Exportación', 'Export'), true)),
        h('span', { class: 'sp' }),
        el.status, el.undo, el.redo,
        MC.ui.seg([{ v: '0', l: t('Simple', 'Simple') }, { v: '1', l: t('Avanzado', 'Advanced') }], S.adv ? '1' : '0', (v) => { S.adv = v === '1'; MC.store.set('adv', v); renderInspector(); }, t('Nivel de uso', 'Skill level')),
        h('button', { class: 'btn btn-p hide-n', type: 'button', disabled: true, title: t('La exportación de vídeo es el siguiente paso del desarrollo', 'Video export is the next development step') }, t('Exportar', 'Export')));
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

      b.append(sec('plano', t('Plano', 'Shot') + ' · ' + sh.name, planoNodes), sec('camara', t('Cámara', 'Camera'), camNodes),
        sec('capa', l ? t('Capa', 'Layer') + ' · ' + l.name : t('Capa', 'Layer'), capaNodes), sec('proyecto', t('Formato y parallax', 'Format and parallax'), projNodes));
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
    function layoutClips() {
      const p = S.project, starts = MC.shotStarts(p), total = MC.totalTime(p), pps = S.pps;
      el.tlContent.style.width = Math.max(total * pps + 120, 320) + 'px';
      el.tlContent.querySelectorAll('.clip[data-i]').forEach((c) => {
        const i = +c.dataset.i, sh = p.shots[i]; if (!sh) return;
        c.style.left = starts[i] * pps + 'px'; c.style.width = Math.max(8, sh.duration * pps - 2) + 'px';
      });
      el.tlContent.querySelectorAll('.clip[data-tr]').forEach((c) => {
        const i = +c.dataset.tr, sh = p.shots[i]; if (!sh) return;
        c.style.left = starts[i] * pps + 'px'; c.style.width = Math.max(8, Math.min(sh.transition.dur, sh.duration * 0.9) * pps - 2) + 'px';
      });
      updateTime();
    }
    function renderTimeline() {
      const p = S.project, total = MC.totalTime(p), pps = S.pps;
      MC.put(MC.clear(el.tlLabels), h('div', { class: 'rs' }), TRACKS.map((tr) => h('div', null, t(tr.es, tr.en))));
      MC.clear(el.tlContent);
      const ruler = h('div', { class: 'tl-ruler', 'aria-label': t('Regla de tiempo', 'Time ruler') });
      const step = pps >= 55 ? 1 : pps >= 28 ? 2 : 5;
      for (let s = 0; s <= total + 40; s += step) ruler.append(h('b', { style: { left: s * pps + 'px' } }, Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')));
      el.tlContent.append(ruler);
      const rows = TRACKS.map((tr, i) => h('div', { class: 'tl-track' + (i > 1 ? ' off' : ''), 'data-hint': i > 1 ? t('Llega con el audio', 'Arrives with audio') : '' }));
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
          const end = () => { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', end); rz.removeEventListener('pointercancel', end); setTimeout(() => { clip._moved = false; }, 0); commit(); };
          rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', end); rz.addEventListener('pointercancel', end);
        });
        rows[0].append(clip);
        if (i > 0 && sh.transition.type !== 'cut') {
          const tr = MC.TRANSITIONS.find((x) => x.v === sh.transition.type);
          rows[1].append(h('div', { class: 'clip fx', 'data-tr': i, title: t('Transición de entrada', 'Entry transition') }, h('span', null, t(tr.es, tr.en))));
        }
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
    const fileLayers = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,.psd,.pdf', multiple: true, hidden: true, id: 'f-layers', onChange: (e) => { importFiles(e.target.files, 'layers'); e.target.value = ''; } });
    const fileShots = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,.psd,.pdf', multiple: true, hidden: true, id: 'f-shots', onChange: (e) => { importFiles(e.target.files, 'shots'); e.target.value = ''; } });
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
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Alejar', 'Zoom out'), 'aria-label': t('Alejar', 'Zoom out'), onClick: () => { S.pps = clamp(S.pps / 1.3, 12, 240); renderTimeline(); } }, MC.icon('minus')),
        h('button', { class: 'btn btn-g btn-ic', type: 'button', title: t('Acercar', 'Zoom in'), 'aria-label': t('Acercar', 'Zoom in'), onClick: () => { S.pps = clamp(S.pps * 1.3, 12, 240); renderTimeline(); } }, MC.icon('plus')), el.tlTime),
      h('div', { class: 'tl-body' }, el.tlLabels, h('div', { class: 'tl-scroll' }, el.tlContent)));
    const mtabs = h('div', { class: 'mtabs' }, [['layers', t('Capas', 'Layers')], ['inspector', 'Inspector'], ['timeline', t('Línea', 'Timeline')]].map((x) =>
      h('button', { type: 'button', 'aria-pressed': String(S.mtab === x[0]), onClick: (e) => { S.mtab = x[0]; studio.dataset.mtab = x[0]; e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); } }, x[1])));
    const studio = h('div', { class: 'studio', 'data-ws': S.ws, 'data-mtab': S.mtab }, el.top, h('div', { class: 's-main' }, layersPanel, viewer, inspector), mtabs, timeline, fileLayers, fileShots);

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
        let tm = S.time + dt;
        if (tm >= total) { if (S.loop) tm = 0; else { tm = Math.max(0, total - 0.001); S.playing = false; updateTransport(); } }
        setTime(tm);
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
      else if ((k === 'delete' || k === 'backspace') && layer()) { shot().layers.splice(S.li, 1); S.li = -1; commit(); }
    }
    document.addEventListener('keydown', onKey);
    const onHide = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    function cleanup() { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', save); }
    MC.studioCleanup = () => { S.alive = false; cleanup(); };
  };
})();
