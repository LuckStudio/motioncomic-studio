/* Presets con nombre de cámara y efectos, guardados en este equipo y exportables a un archivo (PRD 8 y 13). */
(function () {
  const MC = window.MC;

  const P = (MC.presets = {
    all() { try { return JSON.parse(MC.store.get('presets', '[]')) || []; } catch (e) { return []; } },
    write(l) { MC.store.set('presets', JSON.stringify(l)); },
    of(kind) { return this.all().filter((x) => x.kind === kind); },
    add(kind, name, data) { const l = this.all().filter((x) => !(x.kind === kind && x.name === name)); l.push({ id: MC.uid(), kind, name, data }); this.write(l); },
    remove(id) { this.write(this.all().filter((x) => x.id !== id)); },
    exportAll() { return JSON.stringify({ app: 'motioncomic-studio', v: 1, presets: this.all() }, null, 1); },
    importFrom(text) {
      const d = JSON.parse(text);
      if (d.app !== 'motioncomic-studio' || !Array.isArray(d.presets)) throw new Error('formato');
      let n = 0;
      d.presets.forEach((q) => { if (q && (q.kind === 'camera' || q.kind === 'fx') && q.name && q.data) { this.add(q.kind, String(q.name).slice(0, 60), q.data); n++; } });
      return n;
    },
  });

  /* Movimiento de cámara: sirve para guardar un movimiento propio y reutilizarlo en otros planos. */
  MC.captureCamera = (shot) => {
    const c = shot.camera;
    return { preset: c.preset === 'path' && !(c.path && c.path.custom) ? 'custom' : c.preset, intensity: c.intensity, curve: c.curve, from: Object.assign({}, c.from), to: Object.assign({}, c.to), shake: c.shake || 0, path: c.path && c.path.custom ? JSON.parse(JSON.stringify(c.path)) : null };
  };
  MC.applyCameraPreset = (shot, d) => {
    const c = shot.camera;
    Object.assign(c, { preset: d.preset, intensity: d.intensity, curve: d.curve, shake: d.shake || 0 });
    c.from = Object.assign({}, d.from); c.to = Object.assign({}, d.to); c.path = d.path ? JSON.parse(JSON.stringify(d.path)) : null;
  };
  /* Pila de efectos: uno o varios efectos con sus tiempos relativos. */
  MC.captureFx = (shot, only) => {
    const list = only ? [only] : shot.fx;
    if (!list.length) return null;
    const t0 = Math.min.apply(null, list.map((f) => f.start));
    return list.map((f) => ({ type: f.type, start: Math.round((f.start - t0) * 100) / 100, dur: f.dur, intensity: f.intensity, color: f.color, angle: f.angle || 0 }));
  };
  MC.applyFx = (shot, stack, at) => {
    stack.forEach((q) => { const f = MC.newFx(q.type, at + q.start); Object.assign(f, { dur: q.dur, intensity: q.intensity, color: q.color, angle: q.angle }); shot.fx.push(f); });
  };
})();
