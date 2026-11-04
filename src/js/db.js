/* Guardado local: IndexedDB para proyectos e imágenes (PRD 13). Si el navegador no lo permite, trabaja en memoria y avisa. */
(function () {
  const MC = window.MC;
  const mem = { projects: new Map(), assets: new Map() };
  let dbp = null;
  const db = (MC.db = { persistent: true });

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res) => {
      try {
        const r = indexedDB.open('motioncomic', 1);
        r.onupgradeneeded = () => {
          r.result.createObjectStore('projects', { keyPath: 'id' });
          r.result.createObjectStore('assets', { keyPath: 'id' });
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
  MC.assets = {
    cache,
    get: (id) => cache.get(id) || null,
    async load(id) {
      if (cache.has(id)) return cache.get(id);
      const rec = await db.get('assets', id);
      if (!rec) return null;
      const bitmap = await createImageBitmap(rec.blob);
      const a = { id, name: rec.name, w: bitmap.width, h: bitmap.height, bitmap, thumb: rec.thumb };
      cache.set(id, a);
      return a;
    },
    async add(blob, name, existingId) {
      const bitmap = await createImageBitmap(blob);
      const id = existingId || MC.uid();
      const c = document.createElement('canvas');
      const k = 72 / Math.max(bitmap.width, bitmap.height);
      c.width = Math.max(1, Math.round(bitmap.width * k));
      c.height = Math.max(1, Math.round(bitmap.height * k));
      c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
      const thumb = c.toDataURL('image/png');
      await db.put('assets', { id, name, blob, type: blob.type, w: bitmap.width, h: bitmap.height, thumb });
      const a = { id, name, w: bitmap.width, h: bitmap.height, bitmap, thumb };
      cache.set(id, a);
      return a;
    },
  };

  MC.projectAssetIds = (p) => {
    const ids = new Set();
    p.shots.forEach((s) => s.layers.forEach((l) => ids.add(l.assetId)));
    (p.clips || []).forEach((c) => ids.add(c.assetId));
    return ids;
  };
  MC.loadProjectAssets = (p) => Promise.all([
    ...[...new Set(p.shots.flatMap((s) => s.layers.map((l) => l.assetId)))].map((id) => MC.assets.load(id)),
    ...[...new Set((p.clips || []).map((c) => c.assetId))].map((id) => MC.audio.load(id).catch(() => null)),
  ]);
  /* Proyectos guardados con una versión anterior: añade los campos nuevos. */
  MC.normalizeProject = (p) => {
    p.clips = p.clips || []; p.markers = p.markers || [];
    p.mix = Object.assign({ voz: 1, sfx: 1, musica: 0.6, duck: true }, p.mix || {});
    return p;
  };

  /* Modelo de proyecto */
  MC.newCamera = () => ({ preset: 'zoomin', intensity: 1, curve: 'smooth', from: { x: 0, y: 0, zoom: 1, rot: 0 }, to: { x: 0, y: 0, zoom: 1.25, rot: 0 }, shake: 0 });
  MC.newShot = (name) => ({ id: MC.uid(), name: name || 'Plano', duration: 4, layers: [], camera: MC.newCamera(), transition: { type: 'cut', dur: 0.6 } });
  MC.newProject = (o) => ({
    id: MC.uid(), name: o.name || 'Proyecto sin título', mode: 'free', ratio: o.ratio || '9:16', res: o.res || '1080p', zoomPlan: o.zoom || 1.5,
    parallax: 'normal', overscan: true, created: Date.now(), updated: Date.now(), shots: [MC.newShot('Plano 1')], thumb: '',
    clips: [], markers: [], mix: { voz: 1, sfx: 1, musica: 0.6, duck: true },
  });

  /* Presets de cámara (PRD 8) */
  MC.CAM_PRESETS = [
    { v: 'none', es: 'Quieta', en: 'Still' }, { v: 'zoomin', es: 'Zoom in', en: 'Zoom in' }, { v: 'zoomout', es: 'Zoom out', en: 'Zoom out' },
    { v: 'panl', es: 'Paneo ←', en: 'Pan ←' }, { v: 'panr', es: 'Paneo →', en: 'Pan →' }, { v: 'panu', es: 'Paneo ↑', en: 'Pan ↑' }, { v: 'pand', es: 'Paneo ↓', en: 'Pan ↓' },
    { v: 'kenburns', es: 'Ken Burns', en: 'Ken Burns' }, { v: 'shake', es: 'Temblor', en: 'Shake' }, { v: 'dutch', es: 'Ángulo holandés', en: 'Dutch angle' },
  ];
  MC.applyPreset = (cam, preset, intensity) => {
    const i = MC.clamp(intensity == null ? cam.intensity || 1 : intensity, 0.2, 2);
    const K = (x, y, zoom, rot) => ({ x, y, zoom, rot: rot || 0 });
    cam.preset = preset; cam.intensity = i; cam.shake = 0;
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
