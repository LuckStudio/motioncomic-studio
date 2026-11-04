/* Arranque de la aplicación. */
(function () {
  const MC = window.MC;
  const root = document.getElementById('app');

  MC.app = {
    async render() {
      if (MC.studioCleanup) { MC.studioCleanup(); MC.studioCleanup = null; }
      document.documentElement.lang = MC.lang;
      await MC.renderHome(root);
    },
    async openProject(p) {
      const full = (await MC.db.get('projects', p.id)) || p;
      await MC.mountStudio(root, full);
    },
  };

  async function boot() {
    MC.lang = MC.store.get('lang', (navigator.language || 'es').slice(0, 2) === 'en' ? 'en' : 'es');
    const th = MC.store.get('theme', '');
    if (th) document.documentElement.setAttribute('data-theme', th);
    await MC.db.ready();
    // primera vez: proyecto de ejemplo ya cargado
    if (!MC.store.get('seeded', '')) {
      const existing = await MC.db.all('projects');
      if (!existing.length) {
        try { const p = await MC.createSampleProject(MC.lang); await MC.db.put('projects', p); } catch (e) { console.error(e); }
      }
      MC.store.set('seeded', '1');
    }
    await MC.app.render();
    if (!window.MC_PREVIEW && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* sin modo sin conexión */ });
    }
  }
  boot();
})();
