/* Avisos de versión nueva: registra el modo sin conexión, vigila si hay una versión más reciente y ofrece actualizar (o forzarlo si el navegador se queda con una copia vieja). */
(() => {
  const MC = window.MC, h = MC.h, t = (a, b) => MC.t(a, b);
  const BUILD = (document.querySelector('meta[name="mc-build"]') || {}).content || 'dev';
  const U = (MC.update = { state: null, reg: null, last: 0, build: BUILD });
  const subs = new Set();
  U.on = (f) => { subs.add(f); return () => subs.delete(f); };
  const emit = () => subs.forEach((f) => { try { f(); } catch (e) { /* un suscriptor roto no frena a los demás */ } });
  const snoozed = () => { try { return sessionStorage.getItem('mc-upd-snooze') === U.state; } catch (e) { return false; } };
  const snooze = () => { try { sessionStorage.setItem('mc-upd-snooze', U.state || ''); } catch (e) { /* sin sessionStorage */ } };
  /* qué combinación de teclas fuerza la recarga completa en este equipo */
  U.platform = () => {
    const ua = navigator.userAgent || '', ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), android = /Android/.test(ua), mac = !ios && /Mac/.test(navigator.platform || ua);
    const safari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|CriOS|FxiOS|Android/.test(ua), firefox = /Firefox/.test(ua);
    return { ios, android, mac, safari, firefox };
  };
  U.howTo = () => {
    const p = U.platform(), standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    if (p.ios || (p.android && standalone)) return t('Cierra la app del todo (desliza hacia arriba desde el selector de apps) y vuelve a abrirla. Si sigue igual, pulsa «Forzar actualización».', 'Close the app completely (swipe up in the app switcher) and open it again. If it is still the same, press “Force update”.');
    if (p.android) return t('Abre el menú del navegador (⋮) › Actualizar, o cierra la pestaña y ábrela de nuevo. Si sigue igual, pulsa «Forzar actualización».', 'Open the browser menu (⋮) › Reload, or close the tab and open it again. If it is still the same, press “Force update”.');
    if (p.mac && p.safari) return t('Pulsa Cmd + Opción + E para vaciar la caché y luego Cmd + R. Si sigue igual, pulsa «Forzar actualización».', 'Press Cmd + Option + E to empty the cache, then Cmd + R. If it is still the same, press “Force update”.');
    if (p.mac) return t('Pulsa Cmd + Mayús + R (recarga sin usar la copia guardada).', 'Press Cmd + Shift + R (reloads without using the stored copy).');
    return t('Pulsa Ctrl + Mayús + R (o Ctrl + F5): recarga sin usar la copia guardada.', 'Press Ctrl + Shift + R (or Ctrl + F5): reloads without using the stored copy.');
  };
  const saveFirst = async () => { try { if (MC.studioApi && MC.studioApi.saveNow) await MC.studioApi.saveNow(); } catch (e) { /* se guarda de todos modos al cerrar */ } };
  /* actualizar: guarda el proyecto, activa la versión nueva y recarga */
  U.now = async () => {
    await saveFirst();
    const w = U.reg && U.reg.waiting;
    if (w) { MC.reloadOnUpdate = true; w.postMessage('SKIP_WAITING'); setTimeout(() => location.reload(), 2500); } else U.force();
  };
  /* forzar: quita el modo sin conexión y las copias guardadas del programa (los proyectos no se tocan) y recarga */
  U.force = async () => {
    await saveFirst();
    try { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map((r) => r.unregister())); const ks = await caches.keys(); await Promise.all(ks.filter((k) => k.startsWith('motioncomic-')).map((k) => caches.delete(k))); } catch (e) { /* sin SW */ }
    location.reload();
  };
  function setState(s) { if (U.state === s) return; U.state = s; emit(); if (!snoozed()) U.show(); }
  U.show = () => {
    document.querySelectorAll('.updcard').forEach((n) => n.remove());
    if (!U.state) return;
    const stale = U.state === 'stale', close = () => card.remove();
    const card = h('div', { class: 'updcard', role: 'alertdialog', 'aria-labelledby': 'upd-t', 'aria-describedby': 'upd-d' },
      h('h3', { id: 'upd-t' }, stale ? t('Tu navegador tiene una versión anterior', 'Your browser has an older version') : t('Hay una versión nueva del estudio', 'There is a new version of the studio')),
      h('p', { id: 'upd-d' }, stale ? t('Se ha publicado una versión más reciente, pero el navegador sigue mostrando la guardada. ', 'A newer version has been published, but the browser is still showing the stored one. ') + U.howTo()
        : t('Se actualiza en un momento. Antes se guarda tu proyecto y no pierdes nada.', 'It updates in a moment. Your project is saved first and you lose nothing.')),
      h('div', { class: 'updbtns' },
        h('button', { class: 'btn btn-p', type: 'button', onClick: () => { U.now(); } }, stale ? t('Forzar actualización', 'Force update') : t('Actualizar ahora', 'Update now')),
        h('button', { class: 'btn btn-s', type: 'button', onClick: () => { snooze(); close(); } }, t('Más tarde', 'Later'))));
    document.body.append(card); const b = card.querySelector('button'); if (b && !(MC.studioApi && document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))) b.focus({ preventScroll: true });
  };
  U.check = async (manual) => {
    if (!/^https?:$/.test(location.protocol) || window.MC_PREVIEW || BUILD === 'dev') { if (manual) MC.toast(t('Esta copia es de desarrollo: no comprueba versiones.', 'This is a development copy: it does not check versions.')); return; }
    U.last = Date.now();
    try { if (U.reg) await U.reg.update(); } catch (e) { /* sin red */ }
    if (U.reg && U.reg.waiting && navigator.serviceWorker.controller) { MC.swWaiting = U.reg.waiting; setState('waiting'); return; }
    try {
      const r = await fetch('version.json?' + Date.now(), { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); if (j && j.version && j.version !== BUILD) { setState('stale'); return; } }
      if (manual) MC.toast(t('Ya tienes la última versión.', 'You already have the latest version.'));
    } catch (e) { if (manual) MC.toast(t('No se pudo comprobar ahora (¿sin conexión?).', 'Could not check right now (offline?).')); }
  };
  U.start = () => {
    if (!window.MC_PREVIEW && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        U.reg = reg;
        const watch = (w) => w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { MC.swWaiting = w; setState('waiting'); } });
        if (reg.waiting && navigator.serviceWorker.controller) { MC.swWaiting = reg.waiting; setState('waiting'); }
        reg.addEventListener('updatefound', () => watch(reg.installing));
        U.check();
      }).catch(() => { /* sin modo sin conexión */ });
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (MC.reloadOnUpdate) location.reload(); });
    } else setTimeout(() => U.check(), 1500);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - U.last > 5 * 60 * 1000) U.check(); });
    setInterval(() => { if (document.visibilityState === 'visible') U.check(); }, 20 * 60 * 1000);
  };
})();
