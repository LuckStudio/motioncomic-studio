/* Pantalla de inicio: proyectos guardados, proyecto nuevo, copia de seguridad (PRD 12 y 13). */
(function () {
  const MC = window.MC;
  const { h, t } = MC;

  MC.topBar = (extra) => h('div', { class: 'top' },
    h('div', { class: 'brand', 'aria-label': 'MotionComic Studio' }, MC.mark(28), h('div', null, 'MotionComic ', h('span', null, 'Studio'))),
    h('div', { class: 'top-actions' }, extra,
      MC.ui.seg([{ v: 'es', l: 'ES' }, { v: 'en', l: 'EN' }], MC.lang, (v) => { MC.lang = v; MC.store.set('lang', v); MC.app.render(); }, t('Idioma', 'Language')),
      h('button', { class: 'btn btn-s btn-ic', type: 'button', title: t('Cambiar tema', 'Toggle theme'), 'aria-label': t('Cambiar tema', 'Toggle theme'), onClick: () => MC.toggleTheme() }, MC.icon(MC.isLight() ? 'moon' : 'sun'))));

  MC.isLight = () => {
    const a = document.documentElement.getAttribute('data-theme');
    return a ? a === 'light' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
  };
  MC.toggleTheme = () => {
    const v = MC.isLight() ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', v);
    MC.store.set('theme', v);
    MC.app.render();
  };

  /* Copia de seguridad: un solo archivo con proyecto e imágenes. */
  const blobToDataUrl = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
  MC.exportProject = async (p) => {
    const assets = [];
    for (const id of MC.projectAssetIds(p)) {
      const rec = await MC.db.get('assets', id);
      if (rec) assets.push({ id, name: rec.name, type: rec.type, data: await blobToDataUrl(rec.blob) });
    }
    const file = new Blob([JSON.stringify({ app: 'motioncomic-studio', v: 1, project: p, assets })], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(file), download: p.name.replace(/[^\w\- ]+/g, '') + '.motioncomic.json' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  MC.importProject = async (file) => {
    const data = JSON.parse(await file.text());
    if (data.app !== 'motioncomic-studio') throw new Error('formato');
    for (const a of data.assets) { const blob = await (await fetch(a.data)).blob(); await MC.assets.add(blob, a.name, a.id); }
    const p = data.project;
    if ((await MC.db.get('projects', p.id))) { p.id = MC.uid(); p.name += ' (importado)'; }
    p.updated = Date.now();
    await MC.db.put('projects', p);
    return p;
  };
  MC.duplicateProject = async (p) => {
    const c = JSON.parse(JSON.stringify(p));
    c.id = MC.uid(); c.name = p.name + ' (copia)'; c.created = c.updated = Date.now(); delete c.sample;
    await MC.db.put('projects', c);
    return c;
  };
  MC.deleteProject = async (p) => {
    await MC.db.del('projects', p.id);
    const used = new Set();
    (await MC.db.all('projects')).forEach((q) => MC.projectAssetIds(q).forEach((id) => used.add(id)));
    for (const id of MC.projectAssetIds(p)) if (!used.has(id)) { await MC.db.del('assets', id); MC.assets.cache.delete(id); }
  };

  MC.newProjectDialog = () => {
    const st = { name: '', ratio: '9:16', res: '1080p', zoom: 1.5, mode: 'free' };
    const nameId = 'np-' + MC.uid();
    const body = h('div', { style: { display: 'grid', gap: '16px' } },
      MC.ui.field(t('Nombre', 'Name'), h('input', { class: 'input', id: nameId, placeholder: t('Capítulo 1 · Tráiler', 'Chapter 1 · Trailer'), onInput: (e) => { st.name = e.target.value; } }), nameId),
      h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Modo de trabajo', 'Work mode')),
        h('div', { class: 'modes' },
          h('button', { class: 'mode', type: 'button', 'aria-pressed': 'true' }, h('b', null, t('Libre', 'Free')), h('span', null, t('Plano a plano, con capas y cámara propia', 'Shot by shot, with layers and their own camera'))),
          h('button', { class: 'mode', type: 'button', disabled: true }, h('b', null, t('Página completa', 'Full page')), h('span', null, t('Próximo paso', 'Next step'))),
          h('button', { class: 'mode', type: 'button', disabled: true }, h('b', null, 'Webtoon'), h('span', null, t('Segunda versión', 'Second version'))))),
      MC.formatPicker(st));
    MC.modal(t('Proyecto nuevo', 'New project'), body, (close) => [
      h('button', { class: 'btn btn-g', type: 'button', onClick: close }, t('Cancelar', 'Cancel')),
      h('button', { class: 'btn btn-p', type: 'button', onClick: async () => {
        const p = MC.newProject({ name: st.name.trim() || t('Proyecto sin título', 'Untitled project'), ratio: st.ratio, res: st.res, zoom: st.zoom });
        await MC.db.put('projects', p);
        close();
        MC.app.openProject(p);
      } }, t('Crear', 'Create'))]);
  };

  MC.renderHome = async (root) => {
    const projects = (await MC.db.all('projects')).sort((a, b) => b.updated - a.updated);
    const usage = await MC.db.usage();
    const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, id: 'imp-file', onChange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { await MC.importProject(f); MC.toast(t('Proyecto importado', 'Project imported')); MC.app.render(); }
      catch (err) { MC.toast(t('Ese archivo no es una copia de MotionComic Studio.', 'That file is not a MotionComic Studio backup.')); }
    } });
    const grid = h('div', { class: 'grid' });
    projects.forEach((p) => grid.append(card(p)));
    MC.put(MC.clear(root), h('div', { class: 'home' },
      MC.topBar(),
      h('div', { class: 'home-head' },
        h('div', null, h('h1', null, t('Tus proyectos', 'Your projects')),
          h('p', null, t('Un cuarto oscuro para que el arte brille. Todo se guarda en este equipo y funciona sin conexión.', 'A dark room where the art shines. Everything is saved on this device and works offline.'))),
        h('div', { class: 'top-actions' },
          h('button', { class: 'btn btn-s', type: 'button', onClick: () => fileIn.click() }, MC.icon('upload'), t('Importar copia', 'Import backup')), fileIn,
          h('button', { class: 'btn btn-p', type: 'button', onClick: MC.newProjectDialog }, MC.icon('plus'), t('Proyecto nuevo', 'New project')))),
      h('div', { class: 'notice' },
        h('span', { class: 'cap', style: { color: 'var(--fg)' } }, MC.db.persistent
          ? t('Tus proyectos viven en este navegador. Exporta una copia de vez en cuando.', 'Your projects live in this browser. Export a backup from time to time.')
          : t('Este navegador no permite guardar aquí: los cambios se perderán al cerrar. Exporta una copia.', 'This browser does not allow saving here: changes will be lost on close. Export a backup.')),
        usage ? h('span', { class: 'status' }, h('span', { class: 'meter', 'aria-hidden': 'true' }, h('i', { style: { width: Math.max(2, Math.min(100, (usage.used / usage.quota) * 100)) + '%' } })), t('Espacio usado: ', 'Space used: ') + MC.fmtBytes(usage.used)) : null),
      projects.length ? grid : h('div', { class: 'empty' }, h('p', null, t('Aún no hay proyectos. Crea uno con «Proyecto nuevo».', 'No projects yet. Create one with “New project”.')),
        h('button', { class: 'btn btn-s', type: 'button', onClick: async () => { MC.toast(t('Preparando el ejemplo…', 'Preparing the example…')); const p = await MC.createSampleProject(MC.lang); await MC.db.put('projects', p); MC.app.render(); } }, t('Crear el proyecto de ejemplo', 'Create the example project'))),
      h('section', { 'aria-label': t('Primeros pasos', 'First steps') },
        h('div', { class: 'eyebrow', style: { marginBottom: '10px' } }, t('Primeros pasos', 'First steps')),
        h('div', { class: 'steps' },
          step(t('Importar', 'Import'), t('Arrastra tus ilustraciones al visor. Cada archivo es una capa.', 'Drag your artwork onto the viewer. Each file becomes a layer.')),
          step(t('Profundidad', 'Depth'), t('Dale a cada capa su Z y mira el parallax al instante.', 'Give each layer its Z and watch the parallax instantly.')),
          step(t('Cámara', 'Camera'), t('Elige un preset por plano o arrastra el marco de cámara.', 'Pick a preset per shot or drag the camera frame.')),
          step(t('Duración', 'Timing'), t('Estira los planos en la línea de tiempo y añade transiciones.', 'Stretch shots on the timeline and add transitions.'))))));
  };
  const step = (a, b) => h('div', null, h('b', null, a), h('span', null, b));

  function card(p) {
    const el = h('div', { class: 'card' });
    const draw = (mode) => {
      MC.clear(el);
      const info = h('div', { class: 'info' });
      const nm = h('div', { class: 'nm', title: p.name }, p.name);
      el.append(
        h('button', { class: 'thumb', type: 'button', 'aria-label': t('Abrir ', 'Open ') + p.name, onClick: () => MC.app.openProject(p) },
          p.thumb ? h('img', { src: p.thumb, alt: '' }) : MC.icon('image', 28)),
        info);
      if (mode === 'rename') {
        const inp = h('input', { class: 'input', 'aria-label': t('Nombre', 'Name'), value: p.name, onKeydown: (e) => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = p.name; inp.blur(); } }, onBlur: async () => {
          p.name = inp.value.trim() || p.name; p.updated = Date.now(); await MC.db.put('projects', p); draw();
        } });
        info.append(inp); setTimeout(() => { inp.focus(); inp.select(); }, 0);
      } else info.append(nm);
      const [rw, rh] = MC.parseRatio(p.ratio), sz = MC.frameSize(p.ratio, p.res);
      info.append(h('div', { class: 'meta' }, h('span', { class: 'tag' }, p.ratio), h('span', null, sz.w + '×' + sz.h), h('span', null, '· ' + MC.fmtDate(p.updated))));
      if (mode === 'delete') {
        info.append(h('div', { class: 'confirm' }, h('span', null, t('¿Eliminar este proyecto?', 'Delete this project?')),
          h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', onClick: async () => { await MC.deleteProject(p); MC.app.render(); } }, t('Eliminar', 'Delete')),
          h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => draw() }, t('Cancelar', 'Cancel'))));
      } else {
        const b = (ic, title, fn) => h('button', { class: 'btn btn-g btn-ic', type: 'button', title, 'aria-label': title, onClick: fn }, MC.icon(ic));
        info.append(h('div', { class: 'acts' },
          b('edit', t('Renombrar', 'Rename'), () => draw('rename')),
          b('copy', t('Duplicar', 'Duplicate'), async () => { await MC.duplicateProject(p); MC.app.render(); }),
          b('download', t('Exportar copia', 'Export backup'), async () => { await MC.exportProject(p); MC.toast(t('Copia exportada', 'Backup exported')); }),
          b('trash', t('Eliminar', 'Delete'), () => draw('delete'))));
      }
    };
    draw();
    return el;
  }
})();
