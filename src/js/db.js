/* Guardado local: IndexedDB para proyectos e imágenes (PRD 13). Si el navegador no lo permite, trabaja en memoria y avisa. */
(function () {
  const MC = window.MC;
  const mem = { projects: new Map(), assets: new Map(), versions: new Map(), library: new Map() };
  let dbp = null;
  const db = (MC.db = { persistent: true });

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res) => {
      try {
        const r = indexedDB.open('motioncomic', 2);
        r.onupgradeneeded = () => {
          ['projects', 'assets', 'versions', 'library'].forEach((n) => { if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, { keyPath: 'id' }); });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = r.onblocked = () => { db.persistent = false; res(null); };
      } catch (e) { db.persistent = false; res(null); }
    });
    return dbp;
  }
  async function run(store, mode, op) {
    const d = await open();
    if (!d) return undefined;
    return new Promise((res, rej) => {
      const tx = d.transaction(store, mode);
      const req = op(tx.objectStore(store));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = tx.onabort = () => rej(tx.error);
    });
  }
  db.put = async (store, val) => { if (!(await open())) { mem[store].set(val.id, val); return; } await run(store, 'readwrite', (s) => s.put(val)); };
  db.get = async (store, id) => ((await open()) ? run(store, 'readonly', (s) => s.get(id)) : mem[store].get(id));
  db.all = async (store) => ((await open()) ? run(store, 'readonly', (s) => s.getAll()) : [...mem[store].values()]);
  db.del = async (store, id) => { if (!(await open())) { mem[store].delete(id); return; } await run(store, 'readwrite', (s) => s.delete(id)); };

  db.ready = async () => {
    const d = await open();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* opcional */ }
    return !!d;
  };
  db.usage = async () => {
    try { const e = await navigator.storage.estimate(); return { used: e.usage || 0, quota: e.quota || 0 }; } catch (e) { return null; }
  };

  /* Imágenes: el archivo original se guarda tal cual, sin recomprimir. */
  const cache = new Map();
  /* Proxies de edición: las imágenes de más de 4096 px se editan con una copia ligera (2048 px) y la exportación usa la original. */
  const PROXY_LIMIT = 4096, PROXY_SIZE = 2048;
  const small = async (src, w, h) => {
    const k = PROXY_SIZE / Math.max(w, h);
    return createImageBitmap(src, { resizeWidth: Math.max(1, Math.round(w * k)), resizeHeight: Math.max(1, Math.round(h * k)), resizeQuality: 'high' });
  };
  MC.assets = {
    cache,
    get: (id) => cache.get(id) || null,
    async load(id) {
      if (cache.has(id)) return cache.get(id);
      const rec = await db.get('assets', id);
      if (!rec) return null;
      if (rec.kind === 'video') { const v = MC.video.fromRec(rec); cache.set(id, v); return v; }
      let bitmap, proxy = false, w = rec.w, h = rec.h;
      if (w && h && Math.max(w, h) > PROXY_LIMIT) { bitmap = await small(rec.blob, w, h); proxy = true; }
      else { bitmap = await createImageBitmap(rec.blob); w = bitmap.width; h = bitmap.height; }
      const a = { id, name: rec.name, w, h, bitmap, proxy, thumb: rec.thumb };
      cache.set(id, a);
      return a;
    },
    async add(blob, name, existingId) {
      let bitmap = await createImageBitmap(blob);
      const w = bitmap.width, h = bitmap.height, id = existingId || MC.uid();
      const c = document.createElement('canvas');
      const k = 72 / Math.max(w, h);
      c.width = Math.max(1, Math.round(w * k));
      c.height = Math.max(1, Math.round(h * k));
      c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
      const thumb = c.toDataURL('image/png');
      let proxy = false;
      if (Math.max(w, h) > PROXY_LIMIT) { const sm = await small(bitmap, w, h); bitmap.close(); bitmap = sm; proxy = true; }
      await db.put('assets', { id, name, blob, type: blob.type, w, h, thumb });
      const a = { id, name, w, h, bitmap, proxy, thumb };
      cache.set(id, a);
      return a;
    },
    /* Antes de exportar: carga las originales de lo que usa el proyecto. Después: vuelve a los proxies. */
    async useFull(ids) {
      for (const id of ids) {
        const a = cache.get(id);
        if (!a || !a.proxy || a.small) continue;
        const rec = await db.get('assets', id);
        if (!rec) continue;
        a.small = a.bitmap; a.bitmap = await createImageBitmap(rec.blob);
      }
    },
    useProxy() {
      cache.forEach((a) => { if (a.small) { try { a.bitmap.close(); } catch (e) { /* ya cerrada */ } a.bitmap = a.small; delete a.small; } });
    },
  };
  /* Memoria de las imágenes (RGBA sin comprimir): en edición y al exportar. */
  MC.memEstimate = (p) => {
    let edit = 0, full = 0;
    new Set(p.shots.flatMap((s) => s.layers.map((l) => l.assetId))).forEach((id) => {
      const a = cache.get(id); if (!a) return;
      full += a.w * a.h * 4; edit += (a.proxy ? a.bitmap.width * a.bitmap.height : a.w * a.h) * 4;
    });
    return { edit, full };
  };

  MC.projectAssetIds = (p) => {
    const ids = new Set();
    p.shots.forEach((s) => s.layers.forEach((l) => ids.add(l.assetId)));
    (p.clips || []).forEach((c) => ids.add(c.assetId));
    (p.overlays || []).forEach((o) => ids.add(o.assetId));
    (p.fonts || []).forEach((f) => ids.add(f.id));
    [...ids].forEach((id) => { const a = cache.get(id); if (a && a.video && a.audioId) ids.add(a.audioId); });
    return ids;
  };
  MC.loadProjectAssets = (p) => Promise.all([
    ...[...new Set(p.shots.flatMap((s) => s.layers.map((l) => l.assetId)))].map((id) => MC.assets.load(id)),
    ...[...new Set((p.overlays || []).map((o) => o.assetId))].map((id) => MC.assets.load(id).catch(() => null)),
    ...[...new Set((p.clips || []).map((c) => c.assetId))].map((id) => MC.audio.load(id).catch(() => null)),
  ]);
  /* Contenedor de viñeta por defecto (calle, fondo, forma y trazo). En modo libre siempre existe. */
  MC.FRAME_DEF = { on: true, gutter: 0.035, bg: '#ffffff', pattern: 'plain', patColor: '#000000', width: 0.006, color: '#111111', style: 'solid', shape: 'rect', amount: 0.5, shadow: 0, shadowColor: '#000000' };
  /* Proyectos guardados con una versión anterior: añade los campos nuevos. */
  MC.normalizeProject = (p) => {
    p.clips = p.clips || []; p.markers = p.markers || [];
    p.look = Object.assign({ vignette: 0, grain: 0, halftone: 0, tint: null, sat: 1, contrast: 1, bright: 1, warm: 0 }, p.look || {}); p.shots.forEach((sh) => { sh.fx = sh.fx || []; });
    p.texts = p.texts || []; p.fonts = p.fonts || []; p.langs = p.langs && p.langs.length ? p.langs : ['es']; p.lang = p.lang || p.langs[0];
    p.sub = Object.assign({ font: 'bric', size: 0.045, color: '#ffffff', bg: true, y: null }, p.sub || {});
    p.mix = Object.assign({ voz: 1, sfx: 1, musica: 0.6, duck: true }, p.mix || {});
    p.notes = p.notes || []; p.subs = p.subs || [];
    p.overlays = p.overlays || []; p.otracks = p.otracks && p.otracks.length ? p.otracks : [MC.newOtrack(1)];
    p.frame = Object.assign({}, MC.FRAME_DEF, { on: (p.mode || 'free') === 'free' }, p.frame || {});
    if ((p.mode || 'free') === 'free') p.frame.on = true;
    return p;
  };

  /* Modelo de proyecto */
  MC.newCamera = () => ({ preset: 'zoomin', intensity: 1, curve: 'smooth', from: { x: 0, y: 0, zoom: 1, rot: 0 }, to: { x: 0, y: 0, zoom: 1.25, rot: 0 }, shake: 0 });
  MC.newShot = (name) => ({ id: MC.uid(), name: name || 'Plano', duration: 4, layers: [], fx: [], rack: null, camera: MC.newCamera(), transition: { type: 'cut', dur: 0.6 } });
  MC.newProject = (o) => ({
    id: MC.uid(), name: o.name || 'Proyecto sin título', mode: 'free', ratio: o.ratio || '9:16', res: o.res || '1080p', zoomPlan: o.zoom || 1.5,
    parallax: 'normal', overscan: true, created: Date.now(), updated: Date.now(), shots: [MC.newShot('Plano 1')], thumb: '',
    look: { vignette: 0, grain: 0, halftone: 0, tint: null }, texts: [], fonts: [], langs: ['es'], lang: 'es', sub: { font: 'bric', size: 0.045, color: '#ffffff', bg: true, y: null },
    clips: [], markers: [], mix: { voz: 1, sfx: 1, musica: 0.6, duck: true },
  });

  /* Presets de cámara (PRD 8) */
  MC.CAM_PRESETS = [
    { v: 'none', es: 'Quieta', en: 'Still' }, { v: 'zoomin', es: 'Zoom in', en: 'Zoom in' }, { v: 'zoomout', es: 'Zoom out', en: 'Zoom out' },
    { v: 'panl', es: 'Paneo ←', en: 'Pan ←' }, { v: 'panr', es: 'Paneo →', en: 'Pan →' }, { v: 'panu', es: 'Paneo ↑', en: 'Pan ↑' }, { v: 'pand', es: 'Paneo ↓', en: 'Pan ↓' },
    { v: 'kenburns', es: 'Ken Burns', en: 'Ken Burns' }, { v: 'shake', es: 'Temblor', en: 'Shake' }, { v: 'dutch', es: 'Ángulo holandés', en: 'Dutch angle' },
    { v: 'dolly', es: 'Dolly zoom (vértigo)', en: 'Dolly zoom (vertigo)' }, { v: 'dollyout', es: 'Dolly zoom inverso', en: 'Reverse dolly zoom' },
  ];
  MC.applyPreset = (cam, preset, intensity) => {
    const i = MC.clamp(intensity == null ? cam.intensity || 1 : intensity, 0.2, 2);
    const K = (x, y, zoom, rot) => ({ x, y, zoom, rot: rot || 0 });
    cam.preset = preset; cam.intensity = i; cam.shake = 0; cam.path = null; cam.dolly = 0;
    const P = {
      none: () => [K(0, 0, 1), K(0, 0, 1)],
      zoomin: () => [K(0, 0, 1), K(0, 0, 1 + 0.3 * i)],
      zoomout: () => [K(0, 0, 1 + 0.3 * i), K(0, 0, 1)],
      panl: () => [K(0.07 * i, 0, 1.2), K(-0.07 * i, 0, 1.2)],
      panr: () => [K(-0.07 * i, 0, 1.2), K(0.07 * i, 0, 1.2)],
      panu: () => [K(0, 0.07 * i, 1.2), K(0, -0.07 * i, 1.2)],
      pand: () => [K(0, -0.07 * i, 1.2), K(0, 0.07 * i, 1.2)],
      kenburns: () => [K(-0.015 * i, 0.01 * i, 1), K(0.02 * i, -0.015 * i, 1 + 0.15 * i)],
      shake: () => { cam.shake = i; return [K(0, 0, 1.06), K(0, 0, 1.06)]; },
      dutch: () => [K(0, 0, 1.12, 0), K(0, 0, 1.15, 6 * i)],
      dolly: () => { cam.dolly = i; return [K(0, 0, 1.1), K(0, 0, 1.1)]; },
      dollyout: () => { cam.dolly = -i; return [K(0, 0, 1.1), K(0, 0, 1.1)]; },
    };
    if (P[preset]) { const r = P[preset](); cam.from = r[0]; cam.to = r[1]; }
    return cam;
  };

  MC.detectLayer = (name) => {
    const n = String(name).toLowerCase();
    if (/cielo|sky/.test(n)) return { z: 0, role: 'fondo' };
    if (/fondo|bg|background/.test(n)) return { z: 0.1, role: 'fondo' };
    if (/lejan|far/.test(n)) return { z: 0.25, role: '' };
    if (/edif|ciudad|building/.test(n)) return { z: 0.4, role: '' };
    if (/personaje|char|figura/.test(n)) return { z: 0.6, role: '' };
    if (/primer|fore|front/.test(n)) return { z: 0.92, role: '' };
    if (/texto|bocadillo|sfx|text|bubble/.test(n)) return { z: 0.9, role: '' };
    return null;
  };
  MC.newLayer = (asset, hint) => {
    const d = MC.detectLayer(asset.name) || hint || { z: 0.5, role: '' };
    return { id: MC.uid(), name: asset.name.replace(/\.[a-z0-9]+$/i, ''), assetId: asset.id, z: d.z, role: d.role, scale: 1, x: 0, y: 0, blur: 0, opacity: 1, visible: true };
  };
})();
