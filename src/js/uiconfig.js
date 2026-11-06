/* Personalizar la interfaz: qué herramientas y pestañas se ven, y vistas guardadas con nombre (se pueden exportar a un archivo .mcview). */
(() => {
  const MC = window.MC, t = (a, b) => MC.t(a, b);
  const TB = [
    ['undo', 'Deshacer', 'Undo'], ['redo', 'Rehacer', 'Redo'], ['sel', 'Selección', 'Select'], ['blade', 'Cuchilla', 'Blade'], ['split', 'Dividir', 'Split'], ['trimL', 'Recortar el principio', 'Trim the start'], ['trimR', 'Recortar el final', 'Trim the end'],
    ['del', 'Eliminar', 'Delete'], ['flipx', 'Reflejar horizontal', 'Flip horizontal'], ['flipy', 'Reflejar vertical', 'Flip vertical'], ['crop', 'Recortar imagen o vídeo', 'Crop image or video'], ['kf', 'Fotograma clave', 'Keyframe'],
    ['curves', 'Editor de curvas', 'Curve editor'], ['marker', 'Marcador', 'Marker'], ['dup', 'Duplicar', 'Duplicate'], ['fine', 'Precisión', 'Precision'], ['snap', 'Imán', 'Magnet'], ['ripple', 'Ripple', 'Ripple'],
    ['addshot', 'Añadir planos desde imágenes', 'Add shots from images'], ['addov', 'Añadir superposición', 'Add overlay'], ['addx', 'Plano superpuesto', 'Overlapping shot'], ['addtrack', 'Añadir pista de superposición', 'Add overlay track'], ['zoom', 'Zoom de la línea de tiempo', 'Timeline zoom'],
  ];
  const TB_GROUPS = { zoom: ['zout', 'zoom', 'zin', 'fit'] };
  const TABS_M = [['planos', 'Planos', 'Shots'], ['vinetas', 'Viñetas', 'Panels'], ['camara', 'Cámara', 'Camera'], ['curvas', 'Curvas', 'Curves'], ['rack', 'Rack focus', 'Rack focus'], ['recursos', 'Recursos', 'Assets'], ['biblioteca', 'Biblioteca', 'Library'], ['proyecto', 'Proyecto', 'Project'], ['aspecto', 'Aspecto', 'Look'], ['estilo', 'Estilo', 'Style'], ['favs', 'Favoritos', 'Favourites']];
  const TABS_C = [['texto', 'Texto', 'Text'], ['subtitulos', 'Subtítulos', 'Subtitles'], ['efectos', 'Efectos', 'Effects'], ['transiciones', 'Transiciones', 'Transitions'], ['sfx', 'Efectos de sonido', 'Sound effects'], ['musica', 'Música', 'Music'], ['mezclador', 'Mezclador', 'Mixer'], ['idiomas', 'Idiomas', 'Languages'], ['favs', 'Favoritos', 'Favourites']];
  const WSS = [['creativo', 'Efectos y audio', 'Effects and audio']];
  const read = (k, d) => { try { return JSON.parse(MC.store.get(k, '')) || d; } catch (e) { return d; } };
  const subs = new Set();
  const C = (MC.cfg = {
    TB, TB_GROUPS, TABS_M, TABS_C, WSS,
    list: () => read('uihide', []),
    isHidden: (id) => C.list().includes(id),
    set(id, hide) { const l = C.list().filter((x) => x !== id); if (hide) l.push(id); MC.store.set('uihide', JSON.stringify(l)); C.emit(); },
    reset() { MC.store.set('uihide', '[]'); C.emit(); },
    onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
    emit() { subs.forEach((f) => { try { f(); } catch (e) { /* un suscriptor roto no frena a los demás */ } }); },
    /* ---- vistas guardadas ---- */
    views: () => read('views', {}),
    snapshot() {
      const lay = read('layout', {}); delete lay.geo; delete lay.last;
      return { app: 'MotionComic Studio', type: 'view', v: 1, layout: lay, hide: C.list(),
        theme: { theme: MC.store.get('theme', ''), cbase: MC.store.get('cbase', ''), caccent: MC.store.get('caccent', ''), cbg: MC.store.get('cbg', ''), contrast: MC.store.get('contrast', '0'), marks: MC.store.get('marks', '1') },
        uizoom: MC.store.get('uizoom', '1'), touch: MC.store.get('touch', 'auto') };
    },
    save(name) { const v = C.views(); v[name] = C.snapshot(); MC.store.set('views', JSON.stringify(v)); },
    remove(name) { const v = C.views(); delete v[name]; MC.store.set('views', JSON.stringify(v)); },
    rename(a, b) { const v = C.views(); if (!v[a] || !b || v[b]) return false; v[b] = v[a]; delete v[a]; MC.store.set('views', JSON.stringify(v)); return true; },
    valid: (o) => !!(o && typeof o === 'object' && o.type === 'view' && o.v === 1),
    apply(o) {
      if (!C.valid(o)) return false;
      MC.store.set('uihide', JSON.stringify(Array.isArray(o.hide) ? o.hide.filter((x) => typeof x === 'string') : []));
      const th = o.theme || {}; ['theme', 'cbase', 'caccent', 'cbg', 'contrast', 'marks'].forEach((k) => { if (th[k] != null) MC.store.set(k, String(th[k])); });
      if (o.uizoom) MC.store.set('uizoom', String(o.uizoom)); if (o.touch) MC.store.set('touch', String(o.touch));
      MC.applyPrefs();
      if (MC.studioApi && MC.studioApi.setLayout) MC.studioApi.setLayout(o.layout || {}); else MC.store.set('layout', JSON.stringify(o.layout || {}));
      if (MC.studioApi && MC.studioApi.redraw) MC.studioApi.redraw();
      C.emit(); return true;
    },
    exportFile(name, o) { MC.download(new Blob([JSON.stringify(Object.assign({ name }, o || C.snapshot()), null, 1)], { type: 'application/json' }), (name || 'vista').replace(/[^\w\- ]+/g, '').trim() + '.mcview'); },
    async importFile(file) {
      let o; try { o = JSON.parse(await file.text()); } catch (e) { return null; }
      if (!C.valid(o)) return null;
      let name = String(o.name || file.name.replace(/\.[^.]+$/, '') || 'Vista').slice(0, 40), n = name, i = 2; const v = C.views(); while (v[n]) n = name + ' ' + i++;
      v[n] = o; delete v[n].name; MC.store.set('views', JSON.stringify(v)); return n;
    },
  });
})();
