/* Transiciones entre el inicio y el estudio: el inicio se deshace pieza a pieza, el estudio se construye pieza a pieza, y al volver pasa lo mismo al revés. Se pueden saltar con un toque o una tecla. */
(() => {
  const MC = window.MC;
  const reduced = () => MC.store.get('motion', 'auto') === 'reduce' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const EASE = 'cubic-bezier(.45,.05,.35,1)';
  const finishAll = () => { try { document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) { /* infinita: no se salta */ } }); } catch (e) { /* sin getAnimations */ } };
  /* ejecuta una lista de animaciones y devuelve una promesa que termina cuando acaban todas (o al saltarlas) */
  const run = (items) => new Promise((res) => {
    const anims = items.map((q) => q.el.animate(q.kf, Object.assign({ fill: 'forwards', easing: EASE }, q.o)));
    if (!anims.length) { res(); return; }
    const skip = () => anims.forEach((a) => { try { a.finish(); } catch (e) { /* ya terminada */ } });
    const off = () => { document.removeEventListener('pointerdown', skip, true); document.removeEventListener('keydown', skip, true); };
    document.addEventListener('pointerdown', skip, true); document.addEventListener('keydown', skip, true);
    Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => { off(); res(); });
  });
  const M = (MC.motion = {
    reduced,
    /* el inicio se desvanece: cabecera, bloques y tarjetas de uno en uno */
    leaveHome(root) {
      if (reduced()) return Promise.resolve();
      const home = root.querySelector('.home'); if (!home) return Promise.resolve();
      const items = []; let d = 0;
      [...home.children].forEach((c) => {
        const cards = c.querySelectorAll ? [...c.querySelectorAll('.card')] : [];
        if (cards.length) { cards.slice(0, 12).forEach((k, i) => items.push({ el: k, kf: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(10px) scale(.98)' }], o: { duration: 380, delay: d + i * 45 } })); cards.slice(12).forEach((k) => { k.style.opacity = '0'; }); d += 120; }
        else { items.push({ el: c, kf: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-14px)' }], o: { duration: 420, delay: d } }); d += 70; }
      });
      return run(items);
    },
    /* el estudio se desmonta: la línea de tiempo baja, los lados salen, el visor se apaga y la barra sube */
    leaveStudio(studio) {
      if (reduced() || !studio) return Promise.resolve();
      const q = (s) => [...studio.querySelectorAll(s)].filter((n) => n.getClientRects().length);
      const items = [];
      const add = (nodes, kf, delay) => nodes.forEach((n) => items.push({ el: n, kf: [{ opacity: 1, transform: 'none' }].concat(kf), o: { duration: 480, delay } }));
      add(q('.s-bot'), [{ opacity: 0, transform: 'translateY(60px)' }], 0);
      add(q('.sidecol'), [{ opacity: 0, transform: 'translateX(60px)' }], 90);
      add(q('.rail, .leftpanel'), [{ opacity: 0, transform: 'translateX(-60px)' }], 180);
      add(q('.viewer, .vghost'), [{ opacity: 0, transform: 'scale(.96)' }], 270);
      add(q('.s-top'), [{ opacity: 0, transform: 'translateY(-100%)' }], 360);
      add(q('.mtabs'), [{ opacity: 0, transform: 'translateY(40px)' }], 0);
      return run(items);
    },
    /* mientras el estudio se construye, un toque o una tecla lo termina al instante */
    watchEnter(ms) {
      const skip = () => { finishAll(); off(); };
      const off = () => { document.removeEventListener('pointerdown', skip, true); document.removeEventListener('keydown', skip, true); clearTimeout(t0); };
      const t0 = setTimeout(off, ms || 2600);
      document.addEventListener('pointerdown', skip, true); document.addEventListener('keydown', skip, true);
    },
  });
})();
