/* Proyecto como archivo (.motioncomic), historial de versiones y biblioteca de recursos compartida.
   Los archivos .motioncomic son ZIP: project.json + manifest.json + los medios tal cual (imágenes, vídeos, audio, tipografías). */
(function () {
  const MC = window.MC;
  const { t } = MC;

  const extOf = (rec) => { const m = /\.([a-z0-9]{2,5})$/i.exec(rec.name || ''); if (m) return m[1].toLowerCase(); const ty = (rec.type || '').split('/')[1] || 'bin'; return ty.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin'; };

  /* ---------- guardar y abrir archivos de proyecto ---------- */
  MC.saveProjectFile = async (p, onProgress) => {
    const entries = [], manifest = { app: 'motioncomic-studio', v: 2, saved: Date.now(), name: p.name, assets: [] };
    const ids = [...MC.projectAssetIds(p)];
    for (const id of ids) {
      const rec = await MC.db.get('assets', id); if (!rec) continue;
      const meta = Object.assign({}, rec); delete meta.blob;
      if (meta.peaks) meta.peaks = Array.from(meta.peaks);
      if (rec.blob) { meta.file = 'assets/' + String(id).replace(/[^\w-]/g, '_') + '.' + extOf(rec); entries.push({ name: meta.file, blob: rec.blob }); }
      manifest.assets.push(meta);
    }
    entries.unshift({ name: 'manifest.json', data: JSON.stringify(manifest) }, { name: 'project.json', data: JSON.stringify(p) });
    return MC.zip.write(entries, onProgress);
  };
  MC.downloadProjectFile = async (p, onProgress) => {
    const blob = await MC.saveProjectFile(p, onProgress);
    MC.download(blob, p.name.replace(/[^\w\- ]+/g, '').trim() + '.motioncomic');
    return blob.size;
  };
  /* Abre un .motioncomic (o la copia de seguridad JSON antigua) y lo añade a tus proyectos. */
  MC.openProjectFile = async (file) => {
    if (/\.json$/i.test(file.name) || file.type === 'application/json') return MC.importProject(file);
    const ents = await MC.zip.read(file), by = {}; ents.forEach((e) => { by[e.name] = e; });
    if (!by['manifest.json'] || !by['project.json']) throw new Error('formato');
    const manifest = JSON.parse(await (await by['manifest.json'].blob()).text());
    if (manifest.app !== 'motioncomic-studio') throw new Error('formato');
    const p = JSON.parse(await (await by['project.json'].blob()).text());
    for (const meta of manifest.assets) {
      const rec = Object.assign({}, meta); delete rec.file;
      if (rec.peaks) rec.peaks = new Uint8Array(rec.peaks);
      if (meta.file && by[meta.file]) { const b = await by[meta.file].blob(); rec.blob = new Blob([b], { type: meta.type || b.type }); }
      await MC.db.put('assets', rec);
    }
    if (await MC.db.get('projects', p.id)) { p.id = MC.uid(); p.name += t(' (importado)', ' (imported)'); }
    p.updated = Date.now(); delete p.sample;
    await MC.db.put('projects', p);
    return p;
  };

  /* ---------- historial de versiones (persistente) ---------- */
  const V = (MC.versions = {});
  V.list = async (pid) => (await MC.db.all('versions')).filter((v) => v.projectId === pid).sort((a, b) => b.t - a.t);
  V.save = async (p, label, auto) => {
    const json = JSON.stringify(p), list = await V.list(p.id);
    if (auto && list[0] && list[0].json === json) return null;
    const v = { id: MC.uid(), projectId: p.id, t: Date.now(), label: label || '', auto: !!auto, json, size: json.length };
    await MC.db.put('versions', v);
    /* se conservan 24 automáticas y 60 en total; las manuales no se borran solas */
    const all = await V.list(p.id), autos = all.filter((x) => x.auto);
    for (const x of autos.slice(24)) await MC.db.del('versions', x.id);
    const rest = (await V.list(p.id)).filter((x) => !x.auto);
    for (const x of rest.slice(60)) await MC.db.del('versions', x.id);
    return v;
  };
  V.remove = (id) => MC.db.del('versions', id);
  V.removeAll = async (pid) => { for (const v of await V.list(pid)) await MC.db.del('versions', v.id); };
  V.parse = (v) => JSON.parse(v.json);

  /* ---------- biblioteca compartida entre proyectos ---------- */
  const L = (MC.library = {});
  L.list = async () => (await MC.db.all('library')).sort((a, b) => (a.folder || '').localeCompare(b.folder || '') || a.name.localeCompare(b.name));
  L.ids = async () => new Set((await MC.db.all('library')).map((x) => x.id));
  L.has = async (id) => !!(await MC.db.get('library', id));
  /* Guarda un recurso que ya está en el almacén (imagen, vídeo o audio) en la biblioteca. */
  L.add = async (assetId, extra) => {
    const rec = await MC.db.get('assets', assetId); if (!rec) return null;
    const kind = rec.kind || 'image'; if (kind === 'font') return null;
    const item = Object.assign({ id: assetId, name: (rec.name || '').replace(/\.[a-z0-9]+$/i, ''), kind, folder: '', tags: [], added: Date.now(), thumb: rec.thumb || null, dur: rec.dur || 0 }, extra || {}, { id: assetId, kind });
    await MC.db.put('library', item); return item;
  };
  L.update = async (id, patch) => { const it = await MC.db.get('library', id); if (!it) return null; Object.assign(it, patch); await MC.db.put('library', it); return it; };
  L.remove = (id) => MC.db.del('library', id);
  /* Los recursos de la biblioteca no se borran al eliminar un proyecto. */
  MC.protectedAssetIds = async () => { const s = await L.ids(); (await MC.db.all('library')).forEach((x) => { if (x.kind === 'video') { const r = MC.assets.cache.get(x.id); if (r && r.audioId) s.add(r.audioId); s.add(x.id + ':a'); } }); return s; };
})();
