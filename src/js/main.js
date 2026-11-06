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
    async openProject(p, fromEl) {
      const reduced = MC.store.get('motion', 'auto') === 'reduce' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
      let fx = null;
      if (fromEl && !reduced && p.thumb && fromEl.getBoundingClientRect) {
        const r = fromEl.getBoundingClientRect();
        fx = document.createElement('div'); fx.className = 'zoomfx';
        Object.assign(fx.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', backgroundImage: 'url(' + p.thumb + ')', backgroundSize: 'contain', backgroundRepeat: 'no-repeat' });
        document.body.append(fx);
        fx.animate([{ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }, { left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      }
      const full = (await MC.db.get('projects', p.id)) || p;
      const mounted = MC.mountStudio(root, full);
      await Promise.all([mounted, fx ? new Promise((r) => setTimeout(r, 380)) : null]);
      if (fx) { const a = fx.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }); a.onfinish = () => fx.remove(); }
    },
  };

  async function boot() {
    MC.lang = MC.store.get('lang', (navigator.language || 'es').slice(0, 2) === 'en' ? 'en' : 'es');
    /* primera vez en una tablet: la interfaz sube al 115–130 % para que los controles se toquen bien */
    let autoZoom = null;
    if (!MC.store.get('uizoom', '') && !MC.store.get('uizoom_auto', '') && window.matchMedia && matchMedia('(pointer: coarse)').matches) {
      const short = Math.min(screen.width, screen.height), long = Math.max(screen.width, screen.height);
      if (short >= 600 && long >= 900) { autoZoom = short <= 760 ? '1.3' : '1.15'; MC.store.set('uizoom', autoZoom); }
      MC.store.set('uizoom_auto', '1');
    }
    MC.applyPrefs();
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
    if (autoZoom) setTimeout(() => MC.toast(t('Hemos puesto la interfaz al ', 'We set the interface to ') + Math.round(autoZoom * 100) + t(' % para tu tablet. Puedes cambiarlo en Preferencias.', '% for your tablet. You can change it in Preferences.'), { label: t('Cambiar', 'Change'), onClick: () => MC.openPrefs(), ms: 10000 }), 600);
    if (/[?&]new=1/.test(location.search)) { history.replaceState(null, '', location.pathname + location.hash); MC.newProjectDialog(); }
    if (MC.update) MC.update.start();
  }
  boot();
})();
