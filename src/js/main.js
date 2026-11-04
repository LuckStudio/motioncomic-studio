/* Arranque de la aplicación. */
(function () {
  const MC = window.MC;
  const root = document.getElementById('app');
  const t = MC.t;
  root.setAttribute('role', 'main');

  MC.app = {
    async render() {
      if (MC.studioCleanup) { MC.studioCleanup(); MC.studioCleanup = null; }
      document.documentElement.lang = MC.lang;
      await MC.renderHome(root);
    },
    async openSample() {
      const all = await MC.db.all('projects');
      let p = all.find((q) => q.sampleV === 4) || all.find((q) => q.sample && !q.samplePage);
      if (!p) { MC.toast(t('Preparando el proyecto de ejemplo…', 'Preparing the example project…')); p = await MC.createSampleProject(MC.lang); await MC.db.put('projects', p); }
      await MC.app.openProject(p);
    },
    async openProject(p) {
      const full = (await MC.db.get('projects', p.id)) || p;
      await MC.mountStudio(root, full);
    },
  };

  async function boot() {
    MC.lang = MC.store.get('lang', (navigator.language || 'es').slice(0, 2) === 'en' ? 'en' : 'es');
    MC.applyPrefs();
    const th = MC.store.get('theme', '');
    if (th) document.documentElement.setAttribute('data-theme', th);
    await MC.db.ready();
    // primera vez: proyecto de ejemplo ya cargado
    if (!MC.store.get('seeded5', '')) {
      const existing = await MC.db.all('projects');
      if (!existing.some((q) => q.sampleV === 4)) {
        try { const p = await MC.createSampleProject(MC.lang); await MC.db.put('projects', p); } catch (e) { console.error(e); }
      }
      if (!existing.some((q) => q.samplePage)) {
        try { const p = await MC.createPageSample(MC.lang); await MC.db.put('projects', p); } catch (e) { console.error(e); }
      }
      MC.store.set('seeded5', '1');
    }
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); MC.installEvt = e; if (!MC.studioApi) MC.app.render(); });
    window.addEventListener('appinstalled', () => { MC.installEvt = null; });
    await MC.app.render();
    if (/[?&]new=1/.test(location.search)) { history.replaceState(null, '', location.pathname + location.hash); MC.newProjectDialog(); }
    if (!window.MC_PREVIEW && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        const watch = (w) => w && w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) { MC.swWaiting = w; MC.toast(t('Hay una versión nueva. Actualiza desde Inicio.', 'A new version is available. Update from Home.')); if (!MC.studioApi) MC.app.render(); }
        });
        if (reg.waiting && navigator.serviceWorker.controller) MC.swWaiting = reg.waiting;
        reg.addEventListener('updatefound', () => watch(reg.installing));
      }).catch(() => { /* sin modo sin conexión */ });
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (MC.reloadOnUpdate) location.reload(); });
    }
  }
  boot();
})();
