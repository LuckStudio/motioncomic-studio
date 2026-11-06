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
    { id: 'split', g: 'edit', es: 'Dividir lo seleccionado en el cabezal', en: 'Split the selection at the playhead' },
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
    { id: 'selectTool', g: 'tools', es: 'Herramienta de selección', en: 'Selection tool' },
    { id: 'blade', g: 'tools', es: 'Cuchilla (cortar donde pulsas)', en: 'Blade (cut where you click)' },
    { id: 'trimStart', g: 'tools', es: 'Recortar el principio hasta el cabezal', en: 'Trim the start to the playhead' },
    { id: 'trimEnd', g: 'tools', es: 'Recortar el final desde el cabezal', en: 'Trim the end from the playhead' },
    { id: 'snap', g: 'tools', es: 'Activar o desactivar el imán', en: 'Turn the magnet on or off' },
    { id: 'keyframe', g: 'tools', es: 'Añadir un fotograma clave en el cabezal', en: 'Add a keyframe at the playhead' },
    { id: 'export', g: 'app', es: 'Exportar', en: 'Export' },
    { id: 'help', g: 'app', es: 'Abrir la ayuda', en: 'Open help' },
    { id: 'keys', g: 'app', es: 'Ver los atajos', en: 'Show shortcuts' },
  ];
  const GROUPS = { play: ['Reproducción y tiempo', 'Playback and time'], edit: ['Edición', 'Editing'], tools: ['Herramientas', 'Tools'], view: ['Vista', 'View'], app: ['Aplicación', 'Application'] };

  const BASE = {
    motioncomic: {
      play: ['Space'], pause: ['K'], forward: ['L'], back1: ['J'], stepBack: ['ArrowLeft'], stepFwd: ['ArrowRight'], secBack: ['Shift+ArrowLeft'], secFwd: ['Shift+ArrowRight'],
      start: ['Home'], end: ['End'], prevShot: ['['], nextShot: [']'], split: ['S'], delete: ['Delete', 'Backspace'], undo: ['Ctrl+Z'], redo: ['Ctrl+Shift+Z', 'Ctrl+Y'],
      addBubble: ['T'], save: ['Ctrl+S'], duplicate: ['Ctrl+D', 'Ctrl+J'], selectAll: ['Ctrl+A'], marker: ['M'], tapBeat: ['B'], viewSwitch: ['C'], fullscreen: ['F'], zoomIn: ['=', 'Plus'], zoomOut: ['-'], export: ['Ctrl+E'], help: ['?'], keys: ['Ctrl+/'],
      selectTool: ['V'], blade: ['X'], trimStart: ['Q'], trimEnd: ['W'], snap: ['N'], keyframe: ['I'],
    },
  };
  /* Premiere: J K L, Ctrl+K para cortar, flechas arriba y abajo entre cortes, Ctrl+M para exportar. */
  BASE.premiere = Object.assign({}, BASE.motioncomic, { split: ['Ctrl+K', 'S'], prevShot: ['ArrowUp'], nextShot: ['ArrowDown'], export: ['Ctrl+M'], zoomIn: ['=', 'Plus'], zoomOut: ['-'] });
  /* Photoshop: T para texto, Ctrl+Alt+Z para deshacer varios pasos, Ctrl+Alt+Mayús+S para exportar. */
  BASE.photoshop = Object.assign({}, BASE.motioncomic, { undo: ['Ctrl+Z', 'Ctrl+Alt+Z'], addBubble: ['T'], zoomIn: ['Ctrl+=', 'Ctrl+Plus'], zoomOut: ['Ctrl+-'], export: ['Ctrl+Alt+Shift+S'], viewSwitch: ['C'] });
  /* Bases de otros programas, escritas con los atajos habituales de cada uno y llevadas a las acciones de este estudio. Lo que el programa no tiene queda «sin atajo». */
  BASE.aftereffects = Object.assign({}, BASE.motioncomic, {
    play: ['Space'], pause: [], forward: [], back1: [], stepBack: ['PageUp', 'Ctrl+ArrowLeft'], stepFwd: ['PageDown', 'Ctrl+ArrowRight'], secBack: ['Shift+PageUp'], secFwd: ['Shift+PageDown'], start: ['Home'], end: ['End'],
    prevShot: ['J'], nextShot: ['K'], split: ['Ctrl+Shift+D'], duplicate: ['Ctrl+D'], addBubble: ['Ctrl+T'], marker: ['*'], tapBeat: [], fullscreen: ['`'], zoomIn: ['='], zoomOut: ['-'], export: ['Ctrl+M'], help: ['F1'],
    selectTool: ['V'], blade: [], trimStart: ['Alt+['], trimEnd: ['Alt+]'], snap: [], keyframe: [] });
  BASE.affinity = Object.assign({}, BASE.photoshop, { duplicate: ['Ctrl+J'], redo: ['Ctrl+Shift+Z', 'Ctrl+Y'], zoomIn: ['Ctrl+=', 'Ctrl+Plus'], zoomOut: ['Ctrl+-'], addBubble: ['T'], selectTool: ['V'], export: ['Ctrl+E'] });
  BASE.capcut = Object.assign({}, BASE.motioncomic, {
    play: ['Space'], pause: [], forward: [], back1: [], stepBack: ['ArrowLeft'], stepFwd: ['ArrowRight'], secBack: ['Shift+ArrowLeft'], secFwd: ['Shift+ArrowRight'], start: ['Home'], end: ['End'], prevShot: ['ArrowUp'], nextShot: ['ArrowDown'],
    split: ['Ctrl+B'], duplicate: ['Ctrl+D'], marker: ['M'], tapBeat: [], fullscreen: ['Ctrl+F'], zoomIn: ['Ctrl+=', 'Ctrl+Plus'], zoomOut: ['Ctrl+-'], export: ['Ctrl+E'],
    selectTool: ['V'], blade: [], trimStart: ['Q'], trimEnd: ['W'], snap: ['S'], keyframe: ['Ctrl+K'] });
  BASE.resolve = Object.assign({}, BASE.motioncomic, {
    play: ['Space'], pause: ['K'], forward: ['L'], back1: ['J'], stepBack: ['ArrowLeft'], stepFwd: ['ArrowRight'], secBack: ['Shift+ArrowLeft'], secFwd: ['Shift+ArrowRight'], start: ['Home'], end: ['End'], prevShot: ['ArrowUp'], nextShot: ['ArrowDown'],
    split: ['Ctrl+\\'], delete: ['Backspace', 'Delete'], marker: ['M'], tapBeat: [], fullscreen: ['Ctrl+F'], zoomIn: ['Ctrl+=', 'Ctrl+Plus'], zoomOut: ['Ctrl+-'],
    selectTool: ['A'], blade: ['B'], trimStart: [], trimEnd: [], snap: ['N'], keyframe: [] });
  BASE.blender = Object.assign({}, BASE.motioncomic, {
    play: ['Space'], pause: [], forward: [], back1: [], stepBack: ['ArrowLeft'], stepFwd: ['ArrowRight'], secBack: [], secFwd: [], start: ['Shift+ArrowLeft'], end: ['Shift+ArrowRight'], prevShot: ['ArrowDown'], nextShot: ['ArrowUp'],
    split: ['K'], delete: ['X', 'Delete'], addBubble: ['Shift+A'], duplicate: ['Shift+D'], selectAll: ['A'], marker: ['M'], tapBeat: [], viewSwitch: [], fullscreen: ['Ctrl+Space'], zoomIn: ['Plus'], zoomOut: ['-'], export: ['F12'], help: ['F1'],
    selectTool: ['W'], blade: [], trimStart: [], trimEnd: [], snap: ['Shift+Tab'], keyframe: ['I'] });
  const PRESET_NAMES = { motioncomic: 'MotionComic Studio', premiere: 'Premiere', photoshop: 'Photoshop', aftereffects: 'After Effects', affinity: 'Affinity', capcut: 'CapCut', resolve: 'DaVinci Resolve', blender: 'Blender' };
  /* las bases de programas ajenos están escritas de memoria con los atajos más habituales: se avisa de que conviene revisarlas */
  const PRESET_REVIEW = { aftereffects: 1, affinity: 1, capcut: 1, resolve: 1, blender: 1 };

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

  const K = (MC.keys = { ACTIONS, GROUPS, PRESET_NAMES, PRESET_REVIEW, BASE, combo, pretty });
  /* atajos de una acción en una base concreta (para la tabla de comparación) */
  K.baseKeys = (base, id) => (BASE[base] && BASE[base][id]) || [];
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
