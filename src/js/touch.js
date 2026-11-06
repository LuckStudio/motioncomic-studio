/* Modo táctil: nombres de los iconos con una pulsación larga y vistas previas «mantener pulsado» (en táctil no hay ratón que pase por encima). */
(() => {
  const { h } = MC;
  const isOn = () => document.documentElement.dataset.touch === '1';
  let tip = null, timer = 0, sx = 0, sy = 0, suppress = false;
  const hideTip = () => { if (tip) { tip.remove(); tip = null; } };
  const sel = 'button, [role="tab"], [role="separator"], input[type="range"], [role="switch"]';
  const nameOf = (n) => n.getAttribute('data-tip') || n.getAttribute('title') || n.getAttribute('aria-label') || '';
  function showTip(n, label) {
    hideTip();
    const d = n.ownerDocument, z = parseFloat(getComputedStyle(d.documentElement).getPropertyValue('--ui-zoom')) || 1, r = n.getBoundingClientRect();
    tip = h('div', { class: 'tiptouch', role: 'tooltip' }, label);
    d.body.append(tip);
    const w = tip.offsetWidth, cx = (r.left + r.width / 2) / z, vw = d.defaultView.innerWidth / z;
    tip.style.left = Math.max(6, Math.min(vw - w - 6, cx - w / 2)) + 'px';
    const above = r.top / z > 70; tip.style.top = (above ? r.top / z - tip.offsetHeight - 10 : r.bottom / z + 10) + 'px';
    if (MC.announce) MC.announce(label);
  }
  function wireDoc(d) {
    d.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || !isOn()) return;
      const n = e.target.closest && e.target.closest(sel); if (!n || n.closest('.tiptouch')) return;
      const label = nameOf(n); if (!label) return;
      sx = e.clientX; sy = e.clientY; clearTimeout(timer);
      timer = setTimeout(() => { showTip(n, label); suppress = true; }, 520);
    }, true);
    d.addEventListener('pointermove', (e) => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) { clearTimeout(timer); timer = 0; } }, true);
    const end = () => { clearTimeout(timer); timer = 0; if (tip) setTimeout(hideTip, 1600); };
    d.addEventListener('pointerup', end, true); d.addEventListener('pointercancel', end, true);
    d.addEventListener('click', (e) => { if (suppress) { suppress = false; e.preventDefault(); e.stopPropagation(); } }, true);
  }
  MC.touch = {
    on: isOn,
    wireDoc,
    /* vista previa al mantener pulsado (táctil): start() al empezar, stop() al soltar */
    hold(node, start, stop, ms) {
      let t0 = 0, held = false;
      node.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; held = false; clearTimeout(t0); t0 = setTimeout(() => { held = true; node._held = true; start(); }, ms || 380); });
      const end = () => { clearTimeout(t0); if (held) { held = false; stop(); } };
      node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end); node.addEventListener('pointerleave', end);
      node.addEventListener('click', (e) => { if (node._held) { node._held = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    },
  };
  wireDoc(document);
})();
