/* Preferencias de MotionComic Studio: apariencia, datos guardados en este equipo, instalación según el dispositivo, rendimiento y más. */
(function () {
  const MC = window.MC;
  const { h, t } = MC;

  const device = () => {
    const ua = navigator.userAgent, iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const edge = /Edg\//.test(ua), chrome = /Chrome\/|CriOS\//.test(ua) && !edge, firefox = /Firefox\/|FxiOS\//.test(ua);
    return { iOS, android: /Android/i.test(ua), edge, chrome, firefox, safari: /Safari\//.test(ua) && !chrome && !edge && !firefox, mac: /Mac/.test(navigator.platform) && !iOS, win: /Win/.test(navigator.platform),
      standalone: (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true, secure: window.isSecureContext && (location.protocol === 'https:' || location.hostname === 'localhost') };
  };
  MC.device = device;

  const installHow = (d) => {
    if (d.standalone) return { ok: true, title: t('Ya la estás usando como aplicación', 'You are already using it as an app'), steps: [] };
    if (window.MC_PREVIEW || !d.secure) return { title: t('Esta copia no se puede instalar', 'This copy cannot be installed'), steps: [t('La instalación necesita la dirección publicada con HTTPS. Desde la previsualización no está disponible.', 'Installing needs the published address with HTTPS. It is not available from the preview.')] };
    if (d.iOS) return { title: d.safari ? t('Instalar en iPhone o iPad (Safari)', 'Install on iPhone or iPad (Safari)') : t('En iPhone y iPad se instala desde Safari', 'On iPhone and iPad you install from Safari'),
      steps: d.safari ? [t('Pulsa el botón Compartir (el cuadrado con la flecha hacia arriba).', 'Tap the Share button (the square with an arrow pointing up).'), t('Elige «Añadir a pantalla de inicio».', 'Choose “Add to Home Screen”.'), t('Pulsa «Añadir». Se abre como una aplicación a pantalla completa.', 'Tap “Add”. It opens as a full-screen app.')] : [t('Abre esta dirección en Safari.', 'Open this address in Safari.'), t('Sigue los pasos de instalar desde Safari: Compartir → «Añadir a pantalla de inicio».', 'Follow the Safari steps: Share → “Add to Home Screen”.')] };
    if (d.android) return { title: t('Instalar en Android', 'Install on Android'), steps: [t('Abre el menú del navegador (los tres puntos).', 'Open the browser menu (the three dots).'), t('Pulsa «Instalar aplicación» o «Añadir a la pantalla de inicio».', 'Tap “Install app” or “Add to Home screen”.'), t('Confirma. Aparece un icono de MotionComic en tu pantalla de inicio.', 'Confirm. A MotionComic icon appears on your home screen.')] };
    if (d.chrome || d.edge) return { title: d.edge ? t('Instalar en Edge', 'Install in Edge') : t('Instalar en Chrome', 'Install in Chrome'), steps: [t('Busca el icono de instalar a la derecha de la barra de direcciones.', 'Look for the install icon at the right of the address bar.'), t('O abre el menú (tres puntos) y elige «Instalar MotionComic Studio».', 'Or open the menu (three dots) and choose “Install MotionComic Studio”.'), t('Se abre en su propia ventana y también funciona sin conexión.', 'It opens in its own window and also works offline.')] };
    if (d.safari && d.mac) return { title: t('Instalar en Safari (Mac)', 'Install in Safari (Mac)'), steps: [t('En el menú Archivo, elige «Añadir al Dock».', 'In the File menu, choose “Add to Dock”.'), t('Necesitas macOS Sonoma o posterior.', 'You need macOS Sonoma or later.')] };
    if (d.firefox) return { title: t('Firefox de escritorio no instala aplicaciones web', 'Desktop Firefox does not install web apps'), steps: [t('Puedes usarla desde una pestaña: también funciona sin conexión.', 'You can use it from a tab: it also works offline.'), t('Para instalarla, abre esta dirección en Chrome o Edge.', 'To install it, open this address in Chrome or Edge.')] };
    return { title: t('Instalar la aplicación', 'Install the app'), steps: [t('Busca la opción «Instalar» o «Añadir a la pantalla de inicio» en el menú de tu navegador.', 'Look for “Install” or “Add to Home screen” in your browser menu.')] };
  };
  const fmt = (b) => (b > 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(0, Math.round(b / 1e3)) + ' KB');

  MC.openPrefs = (section) => {
    const st = { sec: section || 'look' }, pane = h('div', { class: 'pane' }), nav = h('nav', { role: 'tablist', 'aria-label': t('Secciones de las preferencias', 'Preference sections') });
    let modal = null;
    const SECS = [['look', 'sliders', t('Apariencia', 'Appearance')], ['data', 'folder', t('Datos guardados', 'Stored data')], ['install', 'download', t('Instalación', 'Installation')], ['perf', 'film', t('Rendimiento', 'Performance')], ['keys', 'text', t('Atajos y ayuda', 'Shortcuts and help')], ['about', 'star', t('Acerca de', 'About')]];
    const draw = async () => {
      MC.clear(nav); SECS.forEach((s) => nav.append(h('button', { type: 'button', role: 'tab', 'aria-selected': String(st.sec === s[0]), onClick: () => { st.sec = s[0]; draw(); } }, MC.icon(s[1], 18), s[2])));
      MC.clear(pane); await PANES[st.sec](pane);
    };

    const PANES = {
      async look(el) {
        const z = MC.store.get('uizoom', '1'), mo = MC.store.get('motion', 'auto'), th = MC.store.get('theme', '') || 'system';
        MC.put(el, h('h3', null, t('Apariencia', 'Appearance')),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Tema', 'Theme')), MC.ui.seg([{ v: 'system', l: t('Según el sistema', 'System') }, { v: 'dark', l: t('Oscuro', 'Dark') }, { v: 'light', l: t('Claro', 'Light') }], th, (v) => { if (v === 'system') { document.documentElement.removeAttribute('data-theme'); MC.store.set('theme', ''); } else { document.documentElement.setAttribute('data-theme', v); MC.store.set('theme', v); } if (MC.studioApi) MC.studioApi.redraw(); }, t('Tema', 'Theme')), h('span', { class: 'cap' }, t('El oscuro es el predeterminado: deja que el dibujo sea lo único con color.', 'Dark is the default: it lets the artwork be the only thing with colour.'))),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Tamaño de la interfaz', 'Interface size')), MC.ui.seg([['0.7', '70 %'], ['0.8', '80 %'], ['0.9', '90 %'], ['1', '100 %'], ['1.15', '115 %'], ['1.3', '130 %'], ['1.5', '150 %']].map((q) => ({ v: q[0], l: q[1] })), z, (v) => { MC.store.set('uizoom', v); MC.applyPrefs(); if (MC.studioApi) MC.studioApi.refit(); }, t('Tamaño de la interfaz', 'Interface size'))),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Animaciones de la interfaz', 'Interface animations')), MC.ui.seg([{ v: 'auto', l: t('Según el sistema', 'System default') }, { v: 'reduce', l: t('Reducidas', 'Reduced') }], mo, (v) => { MC.store.set('motion', v); MC.applyPrefs(); }, t('Animaciones', 'Animations')), h('span', { class: 'cap' }, t('Incluye las entradas al abrir un proyecto y al cambiar de espacio de trabajo.', 'Includes the entrances when opening a project and switching workspaces.'))),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Idioma', 'Language')), MC.ui.seg([{ v: 'es', l: 'Español' }, { v: 'en', l: 'English' }], MC.lang, (v) => { MC.lang = v; MC.store.set('lang', v); modal.close(); MC.app.render(); }, t('Idioma', 'Language'))));
      },
      async data(el) {
        const [projects, assets, usage] = await Promise.all([MC.db.all('projects'), MC.db.all('assets'), MC.db.usage()]);
        const by = { image: [0, 0], audio: [0, 0], font: [0, 0] };
        assets.forEach((a) => { const k = a.kind === 'audio' ? 'audio' : a.kind === 'font' ? 'font' : 'image'; by[k][0]++; by[k][1] += (a.blob && a.blob.size) || 0; });
        const pj = projects.reduce((n, p) => n + JSON.stringify(p).length, 0);
        let ls = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('mc.') === 0) ls += k.length + (localStorage.getItem(k) || '').length; } } catch (e) { /* sin acceso */ }
        const sizeOf = (p) => { let n = JSON.stringify(p).length; MC.projectAssetIds(p).forEach((id) => { const a = assets.find((x) => x.id === id); if (a && a.blob) n += a.blob.size; }); return n; };
        let persisted = null; try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (e) { /* no disponible */ }
        const pct = usage && usage.quota ? Math.max(1, Math.min(100, (usage.used / usage.quota) * 100)) : 0;
        const confirmBox = h('div');
        MC.put(el, h('h3', null, t('Datos guardados en este equipo', 'Data stored on this device')),
          h('p', { class: 'cap' }, t('Todo vive en este navegador: no hay cuentas ni servidor. Si borras los datos del sitio desde el navegador, se pierden los proyectos y los presets. Exporta copias de vez en cuando.', 'Everything lives in this browser: there are no accounts or servers. If you clear the site data from the browser, projects and presets are lost. Export backups from time to time.')),
          usage ? h('div', { class: 'field' }, h('div', { class: 'meter-b' }, h('i', { style: { width: pct + '%' } })), h('span', { class: 'cap' }, t('Espacio usado por MotionComic Studio: ', 'Space used by MotionComic Studio: ') + fmt(usage.used) + (usage.quota ? t(' de ', ' of ') + fmt(usage.quota) + t(' disponibles para este sitio', ' available to this site') : ''))) : null,
          h('table', null, h('thead', null, h('tr', null, h('th', null, t('Qué', 'What')), h('th', null, t('Cantidad', 'Count')), h('th', null, t('Tamaño', 'Size')))),
            h('tbody', null, [[t('Proyectos', 'Projects'), projects.length, fmt(pj)], [t('Imágenes y PSD', 'Images and PSD'), by.image[0], fmt(by.image[1])], [t('Audio', 'Audio'), by.audio[0], fmt(by.audio[1])], [t('Tipografías propias', 'Your fonts'), by.font[0], fmt(by.font[1])],
              [t('Presets, Mi estilo y ajustes', 'Presets, My style and settings'), '—', fmt(ls)]].map((r) => h('tr', null, h('td', null, r[0]), h('td', null, String(r[1])), h('td', null, r[2]))))),
          projects.length ? h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Por proyecto', 'Per project')), h('table', null, h('tbody', null, projects.slice().sort((a, b) => sizeOf(b) - sizeOf(a)).map((p) => h('tr', null, h('td', null, p.name), h('td', null, MC.fmtDate(p.updated)), h('td', null, fmt(sizeOf(p))))))) ) : null,
          h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Almacenamiento persistente', 'Persistent storage')),
            h('span', { class: persisted ? 'good' : 'warn' }, persisted == null ? t('Este navegador no informa del estado.', 'This browser does not report its status.') : persisted ? t('Concedido: el navegador no debería borrar tus datos por falta de espacio.', 'Granted: the browser should not delete your data when space runs low.') : t('No concedido: el navegador podría borrar los datos si le falta espacio.', 'Not granted: the browser may delete data if it runs out of space.')),
            persisted === false ? h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: async () => { try { const ok = await navigator.storage.persist(); MC.toast(ok ? t('Almacenamiento persistente concedido', 'Persistent storage granted') : t('El navegador no lo ha concedido todavía. Instalar la aplicación suele ayudar.', 'The browser has not granted it yet. Installing the app usually helps.')); draw(); } catch (e) { /* no disponible */ } } }, t('Pedir almacenamiento persistente', 'Request persistent storage')) : null),
          h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Borrar todo', 'Delete everything')),
            h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', style: { justifySelf: 'start' }, onClick: () => {
              MC.clear(confirmBox); MC.put(confirmBox, h('p', { class: 'bad' }, t('Se borrarán ' + projects.length + ' proyectos, todas las imágenes y audios, los presets y los ajustes. No se puede deshacer.', projects.length + ' projects, all images and audio, presets and settings will be deleted. This cannot be undone.')),
                h('div', { style: { display: 'flex', gap: '8px' } }, h('button', { class: 'btn btn-s btn-sm btn-danger', type: 'button', onClick: async () => {
                  for (const p of projects) await MC.db.del('projects', p.id);
                  for (const a of assets) await MC.db.del('assets', a.id);
                  try { Object.keys(localStorage).filter((k) => k.indexOf('mc.') === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* sin acceso */ }
                  location.reload();
                } }, t('Sí, borrar todo', 'Yes, delete everything')), h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => MC.clear(confirmBox) }, t('Cancelar', 'Cancel'))));
            } }, MC.icon('trash', 14), t('Borrar todos los datos de este equipo…', 'Delete all data on this device…')), confirmBox));
      },
      async install(el) {
        const d = device(), how = installHow(d), sw = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
        MC.put(el, h('h3', null, t('Instalación y uso sin conexión', 'Installation and offline use')),
          h('p', { class: 'cap' }, t('Instalada se abre en su propia ventana, funciona sin conexión y el navegador suele proteger mejor tus datos.', 'Installed, it opens in its own window, works offline and the browser usually protects your data better.')),
          h('div', { class: 'how' }, h('b', null, how.title), how.steps.length ? h('ol', null, how.steps.map((s) => h('li', null, s))) : null),
          MC.installEvt && !d.standalone ? h('button', { class: 'btn btn-p', type: 'button', style: { justifySelf: 'start' }, onClick: async () => { const ev = MC.installEvt; MC.installEvt = null; ev.prompt(); await ev.userChoice.catch(() => {}); draw(); } }, MC.icon('download', 15), t('Instalar ahora', 'Install now')) : null,
          h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Tu dispositivo', 'Your device')), h('span', { class: 'cap' }, [d.iOS ? 'iPhone/iPad' : d.android ? 'Android' : d.mac ? 'Mac' : d.win ? 'Windows' : t('Ordenador', 'Computer'), d.edge ? 'Edge' : d.chrome ? 'Chrome' : d.firefox ? 'Firefox' : d.safari ? 'Safari' : '', d.standalone ? t('instalada', 'installed') : t('en el navegador', 'in the browser')].filter(Boolean).join(' · '))),
          h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Modo sin conexión', 'Offline mode')), h('span', { class: sw ? 'good' : 'warn' }, sw ? t('Activo: puedes abrir MotionComic Studio sin internet.', 'Active: you can open MotionComic Studio without internet.') : t('Aún no está activo. Se activa tras la primera carga completa desde la dirección publicada.', 'Not active yet. It turns on after the first full load from the published address.'))),
          MC.swWaiting ? h('button', { class: 'btn btn-p btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { MC.reloadOnUpdate = true; MC.swWaiting.postMessage('SKIP_WAITING'); } }, t('Hay una versión nueva: actualizar ahora', 'A new version is available: update now')) : null);
      },
      async perf(el) {
        const lim = MC.limits(), bench = (() => { try { return JSON.parse(MC.store.get('bench', '')); } catch (e) { return null; } })(), out = h('div', { class: 'calc' });
        const show = (b) => {
          MC.clear(out);
          if (!b) { MC.put(out, h('span', { class: 'cap' }, t('Tu equipo', 'Your device')), h('span', null, t('Aún no se ha medido.', 'Not measured yet.'))); return; }
          const fps = 1000 / b.ms1080;
          MC.put(out, h('span', { class: 'cap' }, t('Tu equipo', 'Your device')), h('span', { class: 'big' }, '≈ ' + Math.min(60, Math.round(fps)) + ' fps · 1080p'), h('span', null, t('Fotograma 1080p: ', '1080p frame: ') + b.ms1080.toFixed(1) + ' ms · 4K: ' + b.ms4k.toFixed(0) + ' ms'),
            h('span', { class: fps >= 30 ? 'good' : 'warn' }, fps >= 30 ? t('La previsualización debería ir fluida.', 'Preview should run smoothly.') : t('Usa la calidad media y menos capas a la vez.', 'Use medium quality and fewer layers at once.')),
            h('span', { class: b.ms4k < 90 ? 'good' : 'warn' }, b.ms4k < 90 ? t('Exportar en 4K es razonable.', 'Exporting at 4K is reasonable.') : t('En 4K la exportación será lenta: prueba antes en 1080p.', 'At 4K export will be slow: try 1080p first.')));
        };
        show(bench);
        MC.put(el, h('h3', null, t('Rendimiento', 'Performance')),
          h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Calidad de la previsualización', 'Preview quality')), MC.ui.seg([{ v: 'auto', l: t('Automática', 'Automatic') }, { v: 'media', l: t('Media', 'Medium') }, { v: 'full', l: t('Completa', 'Full') }], MC.store.get('pq', 'auto'), (v) => { MC.store.set('pq', v); if (MC.studioApi) MC.studioApi.applyQuality(); }, t('Calidad', 'Quality')), h('span', { class: 'cap' }, t('Automática: media en móviles y equipos con poca memoria, y baja sola si la reproducción va lenta.', 'Automatic: medium on phones and low-memory devices, and it lowers itself if playback is slow.'))),
          out, h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: async (e) => { const b = e.currentTarget; b.disabled = true; b.textContent = t('Midiendo…', 'Measuring…'); show(await MC.benchmark()); b.disabled = false; b.textContent = t('Medir de nuevo', 'Measure again'); } }, bench ? t('Medir de nuevo', 'Measure again') : t('Medir mi equipo', 'Measure my device')),
          h('p', { class: 'cap' }, t('Límites recomendados: ≈ ' + Math.round(lim.editMB) + ' MB de imágenes al editar y ≈ ' + Math.round(lim.exportMB) + ' MB al exportar' + (lim.known ? '.' : ' (estimados: el navegador no informa de la memoria).'), 'Recommended limits: ≈ ' + Math.round(lim.editMB) + ' MB of images while editing and ≈ ' + Math.round(lim.exportMB) + ' MB when exporting' + (lim.known ? '.' : ' (estimated: the browser does not report memory).'))));
      },
      async keys(el) {
        MC.put(el, h('h3', null, t('Atajos y ayuda', 'Shortcuts and help')),
          h('p', { class: 'cap' }, t('Atajos con bases de MotionComic Studio, Premiere y Photoshop, cambiables uno a uno.', 'Shortcut sets for MotionComic Studio, Premiere and Photoshop, changeable one by one.')),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn btn-s', type: 'button', onClick: () => { modal.close(); MC.openHelp('keys'); } }, t('Ver y cambiar atajos', 'View and change shortcuts')),
            h('button', { class: 'btn btn-s', type: 'button', onClick: () => { modal.close(); MC.openHelp('tutorials'); } }, t('Tutoriales cortos', 'Short tutorials'))));
      },
      async about(el) {
        MC.put(el, h('h3', null, t('Acerca de', 'About')), h('div', { class: 'brand' }, MC.mark(28), h('div', null, 'MotionComic ', h('span', null, 'Studio'))),
          h('p', { class: 'cap' }, t('Versión ', 'Version ') + MC.VERSION + t(' · herramienta gratuita.', ' · free tool.')),
          h('p', null, t('Tus dibujos no salen de tu equipo: no hay cuentas, servidor ni IA que los procese.', 'Your artwork never leaves your device: there are no accounts, servers or AI processing it.')),
          h('p', { class: 'cap' }, t('Hecha con cariño para Goti y para cualquier dibujante. Incluye mp4-muxer (MIT), ag-psd (MIT), pdf.js (Apache-2.0) y las tipografías Bricolage Grotesque, Bangers, Comic Neue y Permanent Marker (OFL).', 'Made with care for Goti and for any artist. Includes mp4-muxer (MIT), ag-psd (MIT), pdf.js (Apache-2.0) and the fonts Bricolage Grotesque, Bangers, Comic Neue and Permanent Marker (OFL).')));
      },
    };
    draw();
    modal = MC.modal(t('Preferencias de MotionComic Studio', 'MotionComic Studio preferences'), h('div', { class: 'prefs' }, nav, pane), (close) => [h('button', { class: 'btn btn-s', type: 'button', onClick: close }, t('Cerrar', 'Close'))], { wide: true });
    return modal;
  };
})();
