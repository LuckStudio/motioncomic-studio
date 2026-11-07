/* Pantalla de inicio: proyectos guardados, proyecto nuevo, copia de seguridad (PRD 12 y 13). */
(function () {
  const MC = window.MC;
  const { h, t } = MC;

  const REPO = 'https://github.com/LuckStudio/motioncomic-studio';
  /* enlace al repositorio: se abre en otra pestaña y avisa de ello a los lectores de pantalla */
  const repoLink = (label) => {
    const a = h('a', { class: 'btn btn-g btn-sm', href: REPO, target: '_blank', rel: 'noopener noreferrer', title: t('Código en GitHub (se abre en otra pestaña)', 'Source code on GitHub (opens in a new tab)') });
    a.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>';
    a.append(h('span', null, label || 'GitHub')); a.style.gap = '6px'; a.style.display = 'inline-flex'; a.style.alignItems = 'center';
    return a;
  };
  MC.repoLink = repoLink;

  MC.topBar = (extra) => h('div', { class: 'top' },
    h('div', { class: 'brand', 'aria-label': 'MotionComic Studio' }, MC.mark(28), h('div', null, 'MotionComic ', h('span', null, 'Studio'))),
    h('div', { class: 'top-actions' }, extra, repoLink(),
      MC.installEvt && !(window.matchMedia && matchMedia('(display-mode: standalone)').matches) ? h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: async () => { const ev = MC.installEvt; MC.installEvt = null; ev.prompt(); await ev.userChoice.catch(() => {}); MC.app.render(); } }, MC.icon('download', 14), t('Instalar la aplicación', 'Install the app')) : null,
      MC.ui.seg([{ v: 'es', l: 'ES' }, { v: 'en', l: 'EN' }], MC.lang, (v) => { MC.lang = v; MC.store.set('lang', v); MC.app.render(); }, t('Idioma', 'Language')),
      h('button', { class: 'btn btn-s btn-ic', type: 'button', title: t('Ayuda, atajos y tutoriales', 'Help, shortcuts and tutorials'), 'aria-label': t('Ayuda, atajos y tutoriales', 'Help, shortcuts and tutorials'), onClick: () => MC.openHelp() }, h('b', { 'aria-hidden': 'true' }, '?')),
      h('button', { class: 'btn btn-s btn-ic', type: 'button', title: t('Preferencias', 'Preferences'), 'aria-label': t('Preferencias', 'Preferences'), onClick: () => MC.openPrefs() }, MC.icon('gear'))));

  MC.isLight = () => document.documentElement.dataset.scheme === 'light';
  MC.toggleTheme = () => {
    MC.store.set('theme', MC.isLight() ? 'dark' : 'light'); MC.applyTheme();
    MC.app.render();
  };

  /* Copia de seguridad: un solo archivo con proyecto e imágenes. */
  const blobToDataUrl = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
  MC.exportProject = async (p) => { await MC.downloadProjectFile(p); };
  MC.exportProjectJson = async (p) => {
    const assets = [];
    for (const id of MC.projectAssetIds(p)) {
      const rec = await MC.db.get('assets', id);
      if (rec && rec.blob) assets.push({ id, name: rec.name, type: rec.type, kind: rec.kind || 'image', data: await blobToDataUrl(rec.blob) });
    }
    const file = new Blob([JSON.stringify({ app: 'motioncomic-studio', v: 1, project: p, assets })], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(file), download: p.name.replace(/[^\w\- ]+/g, '') + '.motioncomic.json' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  MC.importProject = async (file) => {
    const data = JSON.parse(await file.text());
    if (data.app !== 'motioncomic-studio') throw new Error('formato');
    for (const a of data.assets) { const blob = await (await fetch(a.data)).blob(); if (a.kind === 'font') await MC.fonts.add(new File([blob], a.name, { type: a.type }), a.id); else if (a.kind === 'video') await MC.video.add(new File([blob], a.name, { type: a.type }), a.name, a.id); else if (a.kind === 'audio' || /^audio\//.test(a.type || blob.type)) await MC.audio.add(blob, a.name, a.id); else await MC.assets.add(blob, a.name, a.id); }
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
    const keep = await MC.protectedAssetIds();
    for (const id of MC.projectAssetIds(p)) if (!used.has(id) && !keep.has(id)) { await MC.db.del('assets', id); MC.assets.cache.delete(id); }
    await MC.versions.removeAll(p.id);
  };

  /* Selector de modo reutilizable: Libre, Página completa, Webtoon (segunda versión). */
  const modePicker = (st, onChange) => {
    const root = h('div', { class: 'field' });
    const draw = () => {
      MC.clear(root);
      MC.put(root, h('span', { class: 'eyebrow' }, t('Modo de trabajo', 'Work mode')),
        h('div', { class: 'modes' },
          h('button', { class: 'mode', type: 'button', 'aria-pressed': String(st.mode === 'free'), onClick: () => { st.mode = 'free'; draw(); onChange && onChange(); } }, h('b', null, t('Libre', 'Free')), h('span', null, t('Plano a plano, con capas y cámara propia', 'Shot by shot, with layers and their own camera'))),
          h('button', { class: 'mode', type: 'button', 'aria-pressed': String(st.mode === 'page'), onClick: () => { st.mode = 'page'; draw(); onChange && onChange(); } }, h('b', null, t('Página completa', 'Full page')), h('span', null, t('La cámara recorre las viñetas de cada página', 'The camera walks through each page’s panels'))),
          h('button', { class: 'mode', type: 'button', 'aria-pressed': String(st.mode === 'webtoon'), onClick: () => { st.mode = 'webtoon'; draw(); onChange && onChange(); } }, h('b', null, 'Webtoon'), h('span', null, t('Scroll vertical con pausas y zooms', 'Vertical scroll with pauses and zooms')))),
        st.mode === 'page' ? h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Orden de lectura', 'Reading order')),
          MC.ui.seg([{ v: 'ltr', l: t('Occidental →', 'Western →') }, { v: 'rtl', l: t('Manga ←', 'Manga ←') }], st.dir, (v) => { st.dir = v; onChange && onChange(); })) : null);
    };
    draw();
    return root;
  };

  MC.newProjectDialog = (mode) => {
    const st = { name: '', ratio: mode === 'free' || !mode ? '9:16' : '9:16', res: '1080p', zoom: 1.5, mode: mode || 'free', dir: 'ltr' };
    const nameId = 'np-' + MC.uid();
    /* tipo de línea de tiempo (solo en el modo Libre): por planos (la de siempre) o por pistas (como Premiere o CapCut) */
    const tlHost = h('div', { class: 'field' });
    const drawTl = () => {
      MC.clear(tlHost); if (st.mode !== 'free') { st.tl = 'classic'; return; }
      const opt = (v, es, en, ds, de) => h('button', { class: 'mode', type: 'button', 'aria-pressed': String((st.tl || 'classic') === v), onClick: () => { st.tl = v; drawTl(); } }, h('b', null, t(es, en)), h('span', null, t(ds, de)));
      MC.put(tlHost, h('span', { class: 'eyebrow' }, t('Línea de tiempo', 'Timeline')), h('div', { class: 'modes' },
        opt('classic', 'Por planos', 'By shots', 'La de siempre: planos seguidos, con sus capas y su cámara. Más sencilla.', 'The usual one: shots in a row, with their layers and camera. Simpler.'),
        opt('free', 'Por pistas', 'By tracks', 'Como Premiere o CapCut: imágenes, vídeos, texto y capas agrupadas se mezclan en pistas.', 'Like Premiere or CapCut: images, videos, text and grouped layers mix on tracks.')),
        h('span', { class: 'cap' }, t('Se elige al empezar el proyecto.', 'Chosen when the project starts.')));
    };
    drawTl();
    const body = h('div', { style: { display: 'grid', gap: '16px' } },
      MC.ui.field(t('Nombre', 'Name'), h('input', { class: 'input', id: nameId, placeholder: t('Capítulo 1 · Tráiler', 'Chapter 1 · Trailer'), onInput: (e) => { st.name = e.target.value; } }), nameId),
      modePicker(st, () => { drawTl(); }), tlHost, MC.formatPicker(st));
    MC.modal(t('Proyecto nuevo', 'New project'), body, (close) => [
      h('button', { class: 'btn btn-g', type: 'button', onClick: close }, t('Cancelar', 'Cancel')),
      h('button', { class: 'btn btn-p', type: 'button', onClick: async () => {
        const p = MC.newProject({ name: st.name.trim() || t('Proyecto sin título', 'Untitled project'), ratio: st.ratio, res: st.res, zoom: st.zoom, tl: st.mode === 'free' ? st.tl : 'classic' });
        p.mode = st.mode; p.dir = st.dir;
        if (p.tl === 'free') { p.otracks = [1, 2, 3].map((n) => Object.assign(MC.newOtrack(n), { name: 'V' + n })); MC.syncFree(p); }
        const style = MC.myStyle.get(); if (style) MC.applyStyle(p, style);
        await MC.db.put('projects', p);
        close();
        MC.app.openProject(p);
      } }, t('Crear', 'Create'))]);
  };

  /* Borrador en un clic: sube las páginas o imágenes y sale un primer montaje para retocar. Sin IA ni servidor. */
  MC.draftDialog = () => {
    const st = { name: '', ratio: '9:16', res: '1080p', zoom: 1.5, mode: 'page', dir: 'ltr' };
    let files = [];
    const fileId = 'df-' + MC.uid(), nameId = 'dn-' + MC.uid(), info = h('p', { class: 'cap' }, t('Aún no has elegido archivos.', 'No files chosen yet.'));
    const go = h('button', { class: 'btn btn-p', type: 'button', disabled: true }, t('Crear borrador', 'Create draft'));
    const body = h('div', { style: { display: 'grid', gap: '16px' } },
      h('p', { class: 'cap' }, t('Sube tus páginas o ilustraciones. Se detectan las viñetas, se fija el orden de lectura y se montan la cámara, las duraciones y las transiciones. Es un punto de partida: todo se puede cambiar. Se calcula en este navegador y se aplica «Mi estilo» si lo tienes guardado.', 'Upload your pages or artwork. Panels are detected, reading order is set, and camera, timing and transitions are assembled. It is a starting point: everything can be changed. It is computed in this browser and applies “My style” if you saved one.')),
      h('div', { class: 'field' }, h('label', { for: fileId }, t('Páginas o imágenes (PNG, JPEG, WebP o PDF)', 'Pages or images (PNG, JPEG, WebP or PDF)')),
        h('input', { id: fileId, class: 'input', type: 'file', multiple: true, accept: 'image/png,image/jpeg,image/webp,.pdf', onChange: (e) => {
          files = [...e.target.files]; go.disabled = !files.length; MC.clear(info).append(files.length + t(' archivo(s) · se ordenan por nombre', ' file(s) · sorted by name'));
        } }), info),
      MC.ui.field(t('Nombre', 'Name'), h('input', { class: 'input', id: nameId, placeholder: t('Capítulo 1 · Borrador', 'Chapter 1 · Draft'), onInput: (e) => { st.name = e.target.value; } }), nameId),
      modePicker(st), MC.formatPicker(st));
    MC.modal(t('Borrador en un clic', 'One-click draft'), body, (close) => {
      go.addEventListener('click', async () => {
        go.disabled = true; info.textContent = t('Detectando viñetas y montando el borrador…', 'Detecting panels and assembling the draft…');
        await new Promise((r) => setTimeout(r, 30));
        try {
          const r = await MC.buildDraft({ files, name: st.name.trim() || t('Borrador', 'Draft'), ratio: st.ratio, res: st.res, zoom: st.zoom, mode: st.mode, dir: st.dir });
          close();
          MC.toast(st.mode === 'page' ? t('Borrador listo: ' + r.pages + ' página(s) y ' + r.panels + ' viñeta(s). Revísalo en la vista «Página».', 'Draft ready: ' + r.pages + ' page(s) and ' + r.panels + ' panel(s). Check it in the “Page” view.') : st.mode === 'webtoon' ? t('Borrador listo: una tira con ' + r.panels + ' pausa(s) sugeridas.', 'Draft ready: one strip with ' + r.panels + ' suggested pause(s).') : t('Borrador listo: ' + r.pages + ' plano(s).', 'Draft ready: ' + r.pages + ' shot(s).'));
          MC.app.openProject(r.project);
        } catch (e) { console.error(e); go.disabled = false; info.textContent = t('No se pudo montar el borrador. Comprueba que son imágenes PNG, JPEG o WebP.', 'Could not build the draft. Check that they are PNG, JPEG or WebP images.'); }
      });
      return [h('button', { class: 'btn btn-g', type: 'button', onClick: close }, t('Cancelar', 'Cancel')), go];
    });
  };

  const MODE_LABEL = { free: ['Libre', 'Free'], page: ['Página', 'Page'], webtoon: ['Webtoon', 'Webtoon'] };
  const ago = (ts) => {
    const m = Math.round((Date.now() - ts) / 60000), rtf = new Intl.RelativeTimeFormat(MC.lang === 'en' ? 'en' : 'es', { numeric: 'auto' });
    if (m < 1) return t('ahora mismo', 'just now');
    if (m < 60) return rtf.format(-m, 'minute');
    if (m < 1440) return rtf.format(-Math.round(m / 60), 'hour');
    return rtf.format(-Math.round(m / 1440), 'day');
  };

  /* Escena del inicio: capas reales del ejemplo con parallax que sigue al ratón. */
  async function heroScene(canvas, caption) {
    let p = (await MC.db.all('projects')).find((q) => q.sampleV === 4 && !q.samplePage);
    if (!p || !canvas.isConnected) return;
    MC.normalizeProject(p);
    await Promise.all(p.shots[0].layers.flatMap((l) => MC.layerAssetIds(l)).map((id) => MC.assets.load(id)));
    const sh = p.shots[0], o = MC.renderOpts(p, { W: 1280, H: 720, fx: false, noLook: true, frames: false }), ctx = canvas.getContext('2d');
    let mx = 0, my = 0, tx = 0, ty = 0, raf = 0;
    const move = (e) => { const r = canvas.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2; };
    window.addEventListener('pointermove', move);
    const still = MC.store.get('motion', 'auto') === 'reduce' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const frame = (now) => {
      if (!canvas.isConnected) { window.removeEventListener('pointermove', move); return; }
      raf = requestAnimationFrame(frame);
      const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5), w = Math.round(r.width * dpr), hh = Math.round(r.height * dpr);
      if (!w || !hh) return;
      if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
      mx += (tx - mx) * 0.06; my += (ty - my) * 0.06;
      const drift = still ? 0 : Math.sin(now / 2600) * 0.25;
      const cam = { x: (mx + drift) * 0.05, y: my * 0.03, zoom: 1.14, rot: 0, sx: 0, sy: 0 };
      const k = Math.max(w / 1280, hh / 720);
      ctx.setTransform(k, 0, 0, k, (w - 1280 * k) / 2, (hh - 720 * k) / 2);
      MC.renderShot(ctx, sh, 0, Object.assign({}, o, { cam }));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    raf = requestAnimationFrame(frame);
    if (caption) caption.hidden = false;
  }

  MC.renderHome = async (root) => {
    const projects = (await MC.db.all('projects')).sort((a, b) => b.updated - a.updated);
    const usage = await MC.db.usage();
    const q = { text: '', sort: 'recent' };
    const fileIn = h('input', { type: 'file', accept: '.motioncomic,.json,application/json,application/zip', hidden: true, id: 'imp-file', onChange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { await MC.openProjectFile(f); MC.toast(t('Proyecto importado', 'Project imported')); MC.app.render(); }
      catch (err) { MC.toast(t('Ese archivo no es una copia de MotionComic Studio.', 'That file is not a MotionComic Studio backup.')); }
    } });
    const grid = h('div', { class: 'grid' });
    const drawGrid = () => {
      MC.clear(grid);
      let list = projects.filter((p) => p.name.toLowerCase().includes(q.text.toLowerCase()));
      if (q.sort === 'name') list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
      else if (q.sort === 'mode') list = list.slice().sort((a, b) => (a.mode || 'free').localeCompare(b.mode || 'free') || b.updated - a.updated);
      list.forEach((p, i) => { const c = card(p); c.style.animationDelay = (250 + Math.min(i, 10) * 80) + 'ms'; grid.append(c); });
      if (!list.length) grid.append(h('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, h('p', null, t('Ningún proyecto coincide con la búsqueda.', 'No project matches the search.'))));
    };
    const scene = h('canvas', { 'aria-hidden': 'true' }), sceneCap = h('span', { class: 'cap', hidden: true }, t('El parallax responde a tu ratón', 'The parallax follows your mouse'));
    const last = projects[0];
    const resume = last ? h('button', { class: 'resume', type: 'button', onClick: (e) => MC.app.openProject(last, e.currentTarget.querySelector('.th')) },
      h('div', { class: 'th' }, last.thumb ? h('img', { src: last.thumb, alt: '' }) : MC.icon('image', 32)),
      h('div', { class: 'tx' }, h('span', { class: 'eyebrow' }, t('Continúa donde lo dejaste', 'Pick up where you left off')), h('h3', null, last.name),
        h('div', { class: 'meta', style: { display: 'flex', gap: '8px', flexWrap: 'wrap', color: 'var(--muted)', fontSize: '14px' } }, h('span', { class: 'tag' }, t(MODE_LABEL[last.mode || 'free'][0], MODE_LABEL[last.mode || 'free'][1])), h('span', { class: 'tag' }, last.ratio + ' · ' + last.res), h('span', null, t('Editado ', 'Edited ') + ago(last.updated))),
        h('span', { class: 'btn btn-p', style: { justifySelf: 'start', marginTop: '6px' } }, t('Abrir el estudio', 'Open the studio'), MC.icon('chevron', 16)))) : null;
    const tile = (ic, title, desc, fn) => h('button', { class: 'tile', type: 'button', onClick: fn }, h('div', { class: 'pic' }, MC.icon(ic, 30)), h('b', null, title), h('span', { class: 'd' }, desc));
    const openMode = (mode) => MC.newProjectDialog(mode);
    MC.put(MC.clear(root), h('div', { class: 'home' },
      MC.topBar(),
      MC.swWaiting ? h('div', { class: 'notice' }, h('span', null, t('Hay una versión nueva de MotionComic Studio. Tus proyectos no se tocan.', 'There is a new version of MotionComic Studio. Your projects are not touched.')),
        h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: () => { MC.update.now(); } }, t('Actualizar ahora', 'Update now'))) : null,
      (() => {
        /* aviso para quien abre la herramienta desde una tablet o un móvil: el ordenador es el mejor sitio para editar vídeo */
        const d = MC.device(), small = d.iOS || d.android || (window.matchMedia && matchMedia('(pointer: coarse)').matches) || innerWidth < 900 || /[?&]pcnote=1/.test(location.search);
        if (!small || MC.store.get('pcnote', '') === '1') return null;
        return h('div', { class: 'notice hint pcnote', role: 'note' }, h('span', null, h('b', null, t('Mejor en un ordenador. ', 'Best on a computer. ')), t('Editar vídeo va mucho mejor en un PC: más memoria, ratón y teclado, y exportar sin sorpresas. En tablets y móviles puedes mirar y retocar, pero algunas funciones (arrastrar con precisión, ventanas separadas, atajos, exportaciones pesadas) no funcionan del todo bien.', 'Editing video works much better on a PC: more memory, mouse and keyboard, and exports without surprises. On tablets and phones you can look around and tweak, but some features (precise dragging, separate windows, shortcuts, heavy exports) do not work fully well.')),
          h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => { MC.store.set('pcnote', '1'); MC.app.render(); } }, t('Entendido', 'Got it')));
      })(),
      (() => {
        const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
        if (standalone || MC.store.get('hintInstall', '') === '1') return null;
        return h('div', { class: 'notice hint', role: 'note' }, h('span', null, h('b', null, t('Funciona mejor instalado. ', 'Works best installed. ')), t('Instálalo en tu ordenador o tableta: tiene más memoria para vídeo y PSD pesados, el navegador no borra tus proyectos y funciona sin conexión.', 'Install it on your computer or tablet: more memory for video and heavy PSDs, the browser will not clear your projects and it works offline.')),
          h('span', { style: { display: 'inline-flex', gap: '8px', flexWrap: 'wrap' } },
            MC.installEvt ? h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: async () => { const ev = MC.installEvt; MC.installEvt = null; ev.prompt(); try { await ev.userChoice; } catch (e) { /* nada */ } MC.app.render(); } }, MC.icon('download', 14), t('Instalar', 'Install')) : h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => MC.openPrefs('install') }, t('Cómo instalarlo', 'How to install')),
            h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => { MC.store.set('hintInstall', '1'); MC.app.render(); } }, t('Ocultar', 'Hide'))));
      })(),
      h('section', { class: 'hero' },
        h('div', { class: 'hero-copy' },
          h('div', { class: 'hero-logo' }, h('span', { style: { animation: 'slide-a 1s cubic-bezier(.2,.8,.2,1) both', display: 'inline-flex' } }, MC.mark(46)), h('span', { class: 'eyebrow', style: { animation: 'rise .9s .35s both' } }, t('Estudio de vídeo-cómic', 'Motion-comic studio'))),
          h('h1', { style: { animation: 'rise .9s .2s both' } }, t('Un cuarto oscuro para que el arte brille', 'A dark room for your art to shine')),
          h('p', { style: { animation: 'rise .9s .35s both' } }, t('Convierte tus páginas en vídeo animado sin pasar por After Effects. Todo ocurre en este equipo: tus dibujos no salen de aquí.', 'Turn your pages into animated video without After Effects. Everything happens on this device: your art never leaves it.')),
          h('div', { class: 'hero-cta', style: { animation: 'rise .9s .5s both' } },
            h('button', { class: 'btn btn-p', type: 'button', onClick: () => MC.newProjectDialog() }, MC.icon('plus'), t('Proyecto nuevo', 'New project')),
            h('button', { class: 'btn btn-s', type: 'button', onClick: MC.draftDialog }, MC.icon('sparkle'), t('Borrador en un clic', 'One-click draft')),
            h('button', { class: 'btn btn-g', type: 'button', onClick: () => MC.app.openSample() }, t('Abrir el ejemplo', 'Open the example')))),
        h('div', { class: 'hero-scene' }, scene, sceneCap)),
      h('section', { class: 'pipeline', 'aria-label': t('Cómo funciona', 'How it works') },
        [['01', t('Importa', 'Import'), t('Arrastra PSD, páginas, PDF o imágenes. Las capas y las viñetas se reconocen solas.', 'Drag PSD, pages, PDF or images. Layers and panels are recognised automatically.')],
          ['02', t('Anima', 'Animate'), t('Cámara, parallax, texto, efectos y voz con presets pensados para cómic.', 'Camera, parallax, text, effects and voice with presets made for comics.')],
          ['03', t('Publica', 'Publish'), t('Exporta MP4 para TikTok, Reels, Shorts o YouTube y comprueba el resultado con el simulador.', 'Export MP4 for TikTok, Reels, Shorts or YouTube and check the result with the simulator.')]].map((s, i) => h('div', { style: { animationDelay: 0.25 + i * 0.1 + 's' } }, h('span', { class: 'n' }, s[0]), h('b', null, s[1]), h('span', null, s[2])))),
      resume,
      h('section', { 'aria-label': t('Tus proyectos', 'Your projects'), style: { display: 'grid', gap: '16px' } },
        h('div', { class: 'sec-head' }, h('h2', null, t('Tus proyectos', 'Your projects') + (projects.length ? ' · ' + projects.length : '')),
          h('div', { class: 'tools' },
            h('label', { class: 'search' }, MC.icon('search', 16), h('input', { type: 'search', 'aria-label': t('Buscar proyectos', 'Search projects'), placeholder: t('Buscar', 'Search'), onInput: (e) => { q.text = e.target.value; drawGrid(); } })),
            MC.ui.seg([{ v: 'recent', l: t('Recientes', 'Recent') }, { v: 'name', l: t('Nombre', 'Name') }, { v: 'mode', l: t('Modo', 'Mode') }], 'recent', (v) => { q.sort = v; drawGrid(); }, t('Ordenar', 'Sort')))),
        projects.length ? grid : h('div', { class: 'empty' }, h('p', null, t('Aún no hay proyectos. Crea uno con «Proyecto nuevo» o abre el ejemplo.', 'No projects yet. Create one with “New project” or open the example.')), h('button', { class: 'btn btn-s', type: 'button', onClick: () => MC.app.openSample() }, t('Abrir el proyecto de ejemplo', 'Open the example project')))),
      h('section', { 'aria-label': t('Crear', 'Create'), style: { display: 'grid', gap: '12px' } },
        h('div', { class: 'sec-head' }, h('h2', null, t('Empezar algo nuevo', 'Start something new'))),
        h('div', { class: 'create' },
          tile('film', t('Modo Libre', 'Free mode'), t('Plano a plano, con capas, parallax y cámara propia.', 'Shot by shot, with layers, parallax and its own camera.'), () => openMode('free')),
          tile('page', t('Página completa', 'Full page'), t('La cámara recorre las viñetas de cada página.', 'The camera walks through each page’s panels.'), () => openMode('page')),
          tile('layersx', 'Webtoon', t('Scroll vertical con pausas y zooms.', 'Vertical scroll with pauses and zooms.'), () => openMode('webtoon')),
          tile('sparkle', t('Borrador en un clic', 'One-click draft'), t('Sube las páginas y sale un primer montaje.', 'Upload the pages and get a first assembly.'), MC.draftDialog),
          tile('upload', t('Importar una copia', 'Import a backup'), t('Recupera un proyecto exportado desde otro equipo.', 'Recover a project exported from another device.'), () => fileIn.click()))),
      fileIn,
      MC.learnCard ? MC.learnCard() : null,
      MC.styleGuideCard ? MC.styleGuideCard() : null,
      h('footer', { class: 'foot' },
        h('span', null, MC.db.persistent ? t('Tus proyectos viven en este navegador. Exporta una copia de vez en cuando.', 'Your projects live in this browser. Export a backup from time to time.') : t('Este navegador no permite guardar aquí: los cambios se perderán al cerrar.', 'This browser does not allow saving here: changes will be lost on close.')),
        h('span', null, usage ? [h('span', { class: 'meter', 'aria-hidden': 'true' }, h('i', { style: { width: Math.max(2, Math.min(100, (usage.used / usage.quota) * 100)) + '%' } })), t('Espacio usado: ', 'Space used: ') + MC.fmtBytes(usage.used)] : null),
        repoLink(t('Código en GitHub', 'Source on GitHub')),
        h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => MC.openPrefs('data') }, t('Datos guardados', 'Stored data')),
        h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => MC.openPrefs('install') }, t('Instalar la aplicación', 'Install the app')))));
    drawGrid();
    heroScene(scene, sceneCap).catch(() => {});
  };

  function card(p) {
    const el = h('div', { class: 'card' });
    const draw = (mode) => {
      MC.clear(el);
      const info = h('div', { class: 'info' }), nm = h('div', { class: 'nm', title: p.name }, p.name);
      MC.put(el, h('button', { class: 'thumb', type: 'button', 'aria-label': t('Abrir ', 'Open ') + p.name, onClick: (e) => MC.app.openProject(p, e.currentTarget) }, p.thumb ? h('img', { src: p.thumb, alt: '' }) : MC.icon('image', 28)),
        mode ? null : h('button', { class: 'btn btn-g btn-ic more', type: 'button', 'aria-haspopup': 'menu', 'aria-label': t('Más acciones de ', 'More actions for ') + p.name, onClick: (e) => openMenu(e.currentTarget) }, MC.icon('dots')), info);
      if (mode === 'rename') {
        const inp = h('input', { class: 'input', 'aria-label': t('Nombre', 'Name'), value: p.name, onKeydown: (e) => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = p.name; inp.blur(); } }, onBlur: async () => { p.name = inp.value.trim() || p.name; p.updated = Date.now(); await MC.db.put('projects', p); draw(); } });
        info.append(inp); setTimeout(() => { inp.focus(); inp.select(); }, 0);
      } else info.append(nm);
      const sz = MC.frameSize(p.ratio, p.res), dur = (p.shots || []).reduce((a, s) => a + s.duration, 0);
      info.append(h('div', { class: 'meta' }, h('span', { class: 'tag' }, t(MODE_LABEL[p.mode || 'free'][0], MODE_LABEL[p.mode || 'free'][1])), h('span', { class: 'tag' }, p.ratio), h('span', null, sz.w + '×' + sz.h)),
        h('div', { class: 'meta' }, h('span', null, (p.shots || []).length + t(' planos', ' shots') + ' · ' + dur.toFixed(0) + ' s'), h('span', null, '· ' + ago(p.updated))));
      if (mode === 'delete') info.append(h('div', { class: 'confirm' }, h('span', null, t('¿Eliminar este proyecto?', 'Delete this project?')),
        h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', onClick: async () => { await MC.deleteProject(p); MC.app.render(); } }, t('Eliminar', 'Delete')), h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => draw() }, t('Cancelar', 'Cancel'))));
    };
    function openMenu(btn) {
      document.querySelectorAll('.card .tmenu').forEach((m) => m.remove());
      const item = (ic, label, fn) => h('button', { type: 'button', role: 'menuitem', onClick: () => { menu.remove(); fn(); } }, MC.icon(ic, 16), label);
      const menu = h('div', { class: 'tmenu', role: 'menu', style: { top: '44px', right: '8px', minWidth: '190px' }, onKeydown: (e) => { if (e.key === 'Escape') { menu.remove(); btn.focus(); } } },
        item('chevron', t('Abrir', 'Open'), () => MC.app.openProject(p, el.querySelector('.thumb'))), item('edit', t('Renombrar', 'Rename'), () => draw('rename')), item('copy', t('Duplicar', 'Duplicate'), async () => { await MC.duplicateProject(p); MC.app.render(); }),
        item('download', t('Exportar copia', 'Export backup'), async () => { await MC.exportProject(p); MC.toast(t('Copia exportada', 'Backup exported')); }), item('trash', t('Eliminar…', 'Delete…'), () => draw('delete')));
      el.append(menu); menu.querySelector('button').focus();
      const off = (e) => { if (!menu.contains(e.target) && e.target !== btn) { menu.remove(); document.removeEventListener('pointerdown', off, true); } };
      setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
    }
    draw();
    return el;
  }
})();
