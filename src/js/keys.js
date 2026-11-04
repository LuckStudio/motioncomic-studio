/* Atajos de teclado configurables, con mapas de Premiere y Photoshop como opción (PRD 11 y 12). */
(function () {
  const MC = window.MC;
  const t = (a, b) => MC.t(a, b);

  const ACTIONS = [
    { id: 'play', g: 'play', es: 'Reproducir o pausar', en: 'Play or pause' },
    { id: 'pause', g: 'play', es: 'Pausar', en: 'Pause' },
    { id: 'forward', g: 'play', es: 'Reproducir', en: 'Play' },
    { id: 'back1', g: 'play', es: 'Retroceder 1 s', en: 'Go back 1 s' },
    { id: 'stepBack', g: 'play', es: 'Un fotograma atrás', en: 'One frame back' },
    { id: 'stepFwd', g: 'play', es: 'Un fotograma adelante', en: 'One frame forward' },
    { id: 'secBack', g: 'play', es: '1 segundo atrás', en: '1 second back' },
    { id: 'secFwd', g: 'play', es: '1 segundo adelante', en: '1 second forward' },
    { id: 'start', g: 'play', es: 'Ir al inicio', en: 'Go to start' },
    { id: 'end', g: 'play', es: 'Ir al final', en: 'Go to end' },
    { id: 'prevShot', g: 'play', es: 'Plano anterior', en: 'Previous shot' },
    { id: 'nextShot', g: 'play', es: 'Plano siguiente', en: 'Next shot' },
    { id: 'split', g: 'edit', es: 'Dividir el clip de audio en el cabezal', en: 'Split the audio clip at the playhead' },
    { id: 'delete', g: 'edit', es: 'Eliminar lo seleccionado', en: 'Delete selection' },
    { id: 'undo', g: 'edit', es: 'Deshacer', en: 'Undo' },
    { id: 'redo', g: 'edit', es: 'Rehacer', en: 'Redo' },
    { id: 'addBubble', g: 'edit', es: 'Añadir un bocadillo', en: 'Add a speech bubble' },
    { id: 'save', g: 'edit', es: 'Guardar ahora', en: 'Save now' },
    { id: 'duplicate', g: 'edit', es: 'Duplicar lo seleccionado', en: 'Duplicate selection' },
    { id: 'selectAll', g: 'edit', es: 'Seleccionar todos los clips', en: 'Select all clips' },
    { id: 'marker', g: 'edit', es: 'Añadir un marcador con nota', en: 'Add a marker with a note' },
    { id: 'tapBeat', g: 'edit', es: 'Marcar un pulso musical', en: 'Mark a music beat' },
    { id: 'viewSwitch', g: 'view', es: 'Cambiar de vista (cámara, página o tira)', en: 'Switch view (camera, page or strip)' },
    { id: 'fullscreen', g: 'view', es: 'Pantalla completa del visor', en: 'Viewer full screen' },
    { id: 'zoomIn', g: 'view', es: 'Acercar la línea de tiempo', en: 'Zoom the timeline in' },
    { id: 'zoomOut', g: 'view', es: 'Alejar la línea de tiempo', en: 'Zoom the timeline out' },
    { id: 'export', g: 'app', es: 'Exportar', en: 'Export' },
    { id: 'help', g: 'app', es: 'Abrir la ayuda', en: 'Open help' },
    { id: 'keys', g: 'app', es: 'Ver los atajos', en: 'Show shortcuts' },
  ];
  const GROUPS = { play: ['Reproducción y tiempo', 'Playback and time'], edit: ['Edición', 'Editing'], view: ['Vista', 'View'], app: ['Aplicación', 'Application'] };

  const BASE = {
    motioncomic: {
      play: ['Space'], pause: ['K'], forward: ['L'], back1: ['J'], stepBack: ['ArrowLeft'], stepFwd: ['ArrowRight'], secBack: ['Shift+ArrowLeft'], secFwd: ['Shift+ArrowRight'],
      start: ['Home'], end: ['End'], prevShot: ['['], nextShot: [']'], split: ['S'], delete: ['Delete', 'Backspace'], undo: ['Ctrl+Z'], redo: ['Ctrl+Shift+Z', 'Ctrl+Y'],
      addBubble: ['T'], save: ['Ctrl+S'], duplicate: ['Ctrl+D'], selectAll: ['Ctrl+A'], marker: ['M'], tapBeat: ['B'], viewSwitch: ['C'], fullscreen: ['F'], zoomIn: ['=', 'Plus'], zoomOut: ['-'], export: ['Ctrl+E'], help: ['?'], keys: ['Ctrl+/'],
    },
  };
  /* Premiere: J K L, Ctrl+K para cortar, flechas arriba y abajo entre cortes, Ctrl+M para exportar. */
  BASE.premiere = Object.assign({}, BASE.motioncomic, { split: ['Ctrl+K', 'S'], prevShot: ['ArrowUp'], nextShot: ['ArrowDown'], export: ['Ctrl+M'], zoomIn: ['=', 'Plus'], zoomOut: ['-'] });
  /* Photoshop: T para texto, Ctrl+Alt+Z para deshacer varios pasos, Ctrl+Alt+Mayús+S para exportar. */
  BASE.photoshop = Object.assign({}, BASE.motioncomic, { undo: ['Ctrl+Z', 'Ctrl+Alt+Z'], addBubble: ['T'], zoomIn: ['Ctrl+=', 'Ctrl+Plus'], zoomOut: ['Ctrl+-'], export: ['Ctrl+Alt+Shift+S'], viewSwitch: ['C'] });
  const PRESET_NAMES = { motioncomic: 'MotionComic Studio', premiere: 'Premiere', photoshop: 'Photoshop' };

  const load = () => { try { return JSON.parse(MC.store.get('keymap', '')) || {}; } catch (e) { return {}; } };
  const save = (m) => MC.store.set('keymap', JSON.stringify(m));

  /* Combinación de una tecla pulsada, por ejemplo «Ctrl+Shift+Z». */
  const combo = (e) => {
    const k = e.key;
    if (!k || ['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'Dead'].includes(k)) return null;
    let name = k === ' ' ? 'Space' : k === '+' ? 'Plus' : k.length === 1 ? k.toUpperCase() : k;
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey && (k.length > 1 || /[a-z]/i.test(k))) parts.push('Shift');
    parts.push(name);
    return parts.join('+');
  };
  const pretty = (c) => c.replace(/ArrowLeft/, '←').replace(/ArrowRight/, '→').replace(/ArrowUp/, '↑').replace(/ArrowDown/, '↓').replace(/Plus/, '+').replace(/Space/, t('Espacio', 'Space')).replace(/Delete/, t('Supr', 'Del')).replace(/Backspace/, t('Retroceso', 'Backspace')).replace(/Ctrl/, /Mac/i.test(navigator.platform || '') ? '⌘' : 'Ctrl');

  const K = (MC.keys = { ACTIONS, GROUPS, PRESET_NAMES, combo, pretty });
  K.base = () => (load().base && BASE[load().base] ? load().base : 'motioncomic');
  K.setBase = (b) => { const m = load(); m.base = b; m.custom = {}; save(m); };
  K.bindings = (id) => { const m = load(), c = m.custom && m.custom[id]; return c || (BASE[K.base()][id] || []); };
  K.isCustom = (id) => !!(load().custom && load().custom[id]);
  K.set = (id, c) => {
    const m = load(); m.custom = m.custom || {};
    ACTIONS.forEach((a) => { if (a.id !== id) { const cur = K.bindings(a.id); if (cur.includes(c)) m.custom[a.id] = cur.filter((x) => x !== c); } });
    m.custom[id] = [c]; save(m);
  };
  K.clear = (id, c) => { const m = load(); m.custom = m.custom || {}; m.custom[id] = K.bindings(id).filter((x) => x !== c); save(m); };
  K.reset = () => save({});
  K.conflict = (id, c) => { const a = ACTIONS.find((x) => x.id !== id && K.bindings(x.id).includes(c)); return a ? t(a.es, a.en) : null; };
  K.match = (e) => { const c = combo(e); if (!c) return null; const a = ACTIONS.find((x) => K.bindings(x.id).includes(c)); return a ? a.id : null; };
})();
