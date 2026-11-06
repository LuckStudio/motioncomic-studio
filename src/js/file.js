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
  V.list = async (pid) => (await MC.db.all('versions')).filter((v) => v.projectId === pid && v.kind !== 'ia').sort((a, b) => b.t - a.t);
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
  V.removeAll = async (pid) => { try { await MC.db.del('versions', 'ia-' + pid); } catch (e) { /* sin registro */ } for (const v of await V.list(pid)) await MC.db.del('versions', v.id); };
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

  /* ---------- importación: SVG, ZIP, carpetas y aviso de CMYK ---------- */
  /* Un SVG se convierte en PNG de buen tamaño (se mantiene la transparencia). */
  MC.rasterSvg = async (file) => {
    const url = URL.createObjectURL(file), img = new Image();
    try {
      img.src = url; await img.decode();
      const nw = img.naturalWidth || 1024, nh = img.naturalHeight || 1024, k = Math.max(0.25, 2400 / Math.max(nw, nh)), c = document.createElement('canvas');
      c.width = Math.min(6000, Math.round(nw * k)); c.height = Math.min(6000, Math.round(nh * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
      return new File([blob], file.name.replace(/\.svg$/i, '') + '.png', { type: 'image/png' });
    } finally { URL.revokeObjectURL(url); }
  };
  const KIND = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', pdf: 'application/pdf', psd: 'image/vnd.adobe.photoshop' };
  /* Abre los ZIP (de carpetas de imágenes) y deja una lista plana de archivos. */
  MC.expandInputs = async (files) => {
    const out = [];
    for (const f of files) {
      if (/\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed') {
        try {
          const ents = (await MC.zip.read(f)).filter((e) => !e.dir && !/(^|\/)(__MACOSX|\.)/.test(e.name) && /\.(png|jpe?g|webp|svg|psd|pdf|mp4|m4v|mov|webm|wav|mp3|m4a|ogg)$/i.test(e.name));
          for (const e of ents) { const b = await e.blob(), ext = e.name.split('.').pop().toLowerCase(); out.push(new File([b], e.name.split('/').pop(), { type: KIND[ext] || b.type })); }
        } catch (e) { MC.toast(t('No se pudo abrir el ZIP ', 'Could not open the ZIP ') + f.name); }
      } else out.push(f);
    }
    return out;
  };
  /* Archivos arrastrados, incluidas las carpetas. */
  MC.collectDropped = async (dt) => {
    const items = dt.items ? [...dt.items].map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)) : [];
    if (!items.length || items.some((x) => !x)) return [...dt.files];
    const files = [];
    const walk = async (en) => {
      if (en.isFile) { await new Promise((res) => en.file((f) => { files.push(f); res(); }, res)); return; }
      const rd = en.createReader(); let batch;
      do { batch = await new Promise((res) => rd.readEntries(res, () => res([]))); for (const c of batch) await walk(c); } while (batch.length);
    };
    for (const en of items) await walk(en);
    return files;
  };
  /* ¿Está en CMYK? (JPEG con 4 componentes, o PSD en modo CMYK) Devuelve un aviso o null. */
  MC.colorWarn = async (file) => {
    try {
      const head = new Uint8Array(await file.slice(0, 131072).arrayBuffer()), cmyk = t('«' + file.name + '» está en CMYK (preparado para imprenta): en pantalla los colores pueden verse apagados o cambiados. Conviértelo a sRGB para que salga como esperas.', '“' + file.name + '” is in CMYK (made for print): colours may look dull or shifted on screen. Convert it to sRGB for the result you expect.');
      if (head[0] === 0xff && head[1] === 0xd8) {
        let i = 2; while (i + 9 < head.length) {
          if (head[i] !== 0xff) { i++; continue; } const m = head[i + 1];
          if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return head[i + 9] === 4 ? cmyk : null;
          if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; } i += 2 + ((head[i + 2] << 8) | head[i + 3]);
        }
      }
      if (head[0] === 0x38 && head[1] === 0x42 && head[2] === 0x50 && head[3] === 0x53 && ((head[24] << 8) | head[25]) === 4) return cmyk;
    } catch (e) { /* sin aviso */ }
    return null;
  };
})();
