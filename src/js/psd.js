/* Importar PSD: cada capa del archivo es una capa del plano, con su nombre, visibilidad y sitio dentro del documento (PRD 6). */
(function () {
  const MC = window.MC;
  const { t } = MC;

  /* Para el modo Página: el PSD se usa como una sola imagen (la composición ya aplanada). */
  MC.psdComposite = async (file) => {
    if (!window.agPsd) throw new Error('sin lector de PSD');
    const psd = window.agPsd.readPsd(await file.arrayBuffer(), { skipThumbnail: true, skipLayerImageData: true });
    if (!psd.canvas) throw new Error('sin composición');
    const blob = await new Promise((res) => psd.canvas.toBlob(res, 'image/png'));
    return new File([blob], file.name.replace(/\.psd$/i, '') + '.png', { type: 'image/png' });
  };

  /* Devuelve { shot, warnings, doc }. El archivo original no se modifica. */
  MC.importPsd = async (file) => {
    if (!window.agPsd) throw new Error('sin lector de PSD');
    const psd = window.agPsd.readPsd(await file.arrayBuffer(), { skipThumbnail: true, skipCompositeImageData: true });
    const doc = { w: psd.width, h: psd.height };
    const leaves = [], names = new Map(), warnings = [];
    let hidden = 0, empty = 0;
    const walk = (children, parentHidden, group) => {
      (children || []).forEach((l) => {
        const hid = parentHidden || !!l.hidden;
        if (l.children) { walk(l.children, hid, group ? group + '/' + l.name : l.name); return; }
        if (!l.canvas || !l.canvas.width || !l.canvas.height) { empty++; return; }
        if (hid) hidden++;
        names.set(l.name, (names.get(l.name) || 0) + 1);
        leaves.push({ l, hid, group: group || '' });
      });
    };
    walk(psd.children, false, '');
    if (!leaves.length) throw new Error('sin capas');
    const dup = [...names.entries()].filter((e) => e[1] > 1).map((e) => e[0]);
    if (empty) warnings.push(t(empty + ' capa(s) vacía(s) sin importar.', empty + ' empty layer(s) skipped.'));
    if (hidden) warnings.push(t(hidden + ' capa(s) oculta(s) en el PSD: se importan apagadas.', hidden + ' hidden layer(s) in the PSD: imported turned off.'));
    if (dup.length) warnings.push(t('Nombres repetidos: ', 'Duplicate names: ') + dup.slice(0, 4).join(', ') + (dup.length > 4 ? '…' : ''));

    const shot = MC.newShot(file.name.replace(/\.psd$/i, ''));
    const n = leaves.length;
    for (let i = 0; i < n; i++) {
      const { l, hid, group } = leaves[i];
      const blob = await new Promise((res) => l.canvas.toBlob(res, 'image/png'));
      const asset = await MC.assets.add(blob, l.name || 'Capa ' + (i + 1) + '.png');
      const det = MC.detectLayer(l.name || '') || MC.detectLayer(group);
      const area = (l.canvas.width * l.canvas.height) / (doc.w * doc.h);
      const bottom = i === 0 && area > 0.85;
      const layer = MC.newLayer(asset, det || { z: bottom ? 0.1 : n > 1 ? 0.15 + (0.7 * i) / (n - 1) : 0.5, role: bottom ? 'fondo' : '' });
      layer.name = l.name || layer.name;
      layer.doc = { w: doc.w, h: doc.h, left: l.left || 0, top: l.top || 0 };
      layer.visible = !hid;
      if (l.opacity != null && l.opacity < 1) layer.opacity = l.opacity;
      const bm = String(l.blendMode || '').replace(/\s+/g, '-');
      if (bm && bm !== 'normal' && bm !== 'pass-through') layer.blend = bm;
      shot.layers.push(layer);
    }
    return { shot, warnings, doc, count: n };
  };
})();
