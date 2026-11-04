/* 3D sencillo sobre el lienzo 2D: giros en X, Y y Z con perspectiva. Una imagen se dibuja como una malla de triángulos y cada triángulo
   se estira con una transformación afín. Lo usan las capas, las superposiciones, las transiciones 3D y la vista de profundidad. */
(function () {
  const MC = window.MC;
  const { clamp } = MC;
  const RAD = Math.PI / 180;

  /* Gira un punto (x, y, z): primero X, luego Y, luego Z. Ángulos en grados. */
  MC.rot3 = (x, y, z, rx, ry, rz) => {
    const cx = Math.cos(rx * RAD), sx = Math.sin(rx * RAD), cy = Math.cos(ry * RAD), sy = Math.sin(ry * RAD), cz = Math.cos(rz * RAD), sz = Math.sin(rz * RAD);
    const y1 = y * cx - z * sx, z1 = y * sx + z * cx;
    const x2 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy;
    return [x2 * cz - y1 * sz, x2 * sz + y1 * cz, z2];
  };
  /* Perspectiva: la cámara está a distancia D del plano z = 0 y mira hacia -z; z positivo = más cerca. */
  const persp = (D, x, y, z) => { const k = D / Math.max(D * 0.12, D - z); return [x * k, y * k]; };
  MC.persp3 = persp;

  function tri(ctx, src, sw, sh, s0, s1, s2, d0, d1, d2, grow) {
    const det = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]);
    if (Math.abs(det) < 1e-9) return;
    const a = (d0[0] * (s1[1] - s2[1]) + d1[0] * (s2[1] - s0[1]) + d2[0] * (s0[1] - s1[1])) / det, b = (d0[1] * (s1[1] - s2[1]) + d1[1] * (s2[1] - s0[1]) + d2[1] * (s0[1] - s1[1])) / det;
    const c = (d0[0] * (s2[0] - s1[0]) + d1[0] * (s0[0] - s2[0]) + d2[0] * (s1[0] - s0[0])) / det, d = (d0[1] * (s2[0] - s1[0]) + d1[1] * (s0[0] - s2[0]) + d2[1] * (s1[0] - s0[0])) / det;
    const e = (d0[0] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[0] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[0] * (s0[0] * s1[1] - s1[0] * s0[1])) / det, f = (d0[1] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[1] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[1] * (s0[0] * s1[1] - s1[0] * s0[1])) / det;
    const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3, ex = (p) => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + (dx / l) * grow, p[1] + (dy / l) * grow]; };
    const e0 = ex(d0), e1 = ex(d1), e2 = ex(d2);
    const bx0 = clamp(Math.floor(Math.min(s0[0], s1[0], s2[0]) - 1), 0, sw), by0 = clamp(Math.floor(Math.min(s0[1], s1[1], s2[1]) - 1), 0, sh), bx1 = clamp(Math.ceil(Math.max(s0[0], s1[0], s2[0]) + 1), 0, sw), by1 = clamp(Math.ceil(Math.max(s0[1], s1[1], s2[1]) + 1), 0, sh);
    if (bx1 <= bx0 || by1 <= by0) return;
    ctx.save(); ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]); ctx.closePath(); ctx.clip();
    ctx.transform(a, b, c, d, e, f); ctx.drawImage(src, bx0, by0, bx1 - bx0, by1 - by0, bx0, by0, bx1 - bx0, by1 - by0); ctx.restore();
  }
  /* Dibuja src (sw × sh píxeles) sobre una malla n × n. proj(u, v), con u y v entre 0 y 1, devuelve el punto [X, Y] donde cae ese punto de la imagen. */
  MC.texQuad = (ctx, src, sw, sh, proj, n) => {
    n = n || 8; const m = ctx.getTransform(), sc = Math.max(1e-6, Math.hypot(m.a, m.b)), grow = 0.7 / sc, pts = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) pts.push(proj(i / n, j / n));
    const S = (i, j) => [(i / n) * sw, (j / n) * sh], P = (i, j) => pts[j * (n + 1) + i];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      tri(ctx, src, sw, sh, S(i, j), S(i + 1, j), S(i, j + 1), P(i, j), P(i + 1, j), P(i, j + 1), grow);
      tri(ctx, src, sw, sh, S(i + 1, j), S(i + 1, j + 1), S(i, j + 1), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1), grow);
    }
  };
  /* Una imagen que gira en 3D dentro de la caja box = { x, y, w, h }. o: { rx, ry, rz, D (distancia de la cámara), pvx, pvy (pivote, 0 a 1), z0 (antes del giro), z1 (después), n } */
  MC.draw3D = (ctx, src, sw, sh, box, o) => {
    const px = box.x + (o.pvx == null ? 0.5 : o.pvx) * box.w, py = box.y + (o.pvy == null ? 0.5 : o.pvy) * box.h, D = o.D, z0 = o.z0 || 0, z1 = o.z1 || 0;
    MC.texQuad(ctx, src, sw, sh, (u, v) => { const r = MC.rot3(box.x + u * box.w - px, box.y + v * box.h - py, z0, o.rx || 0, o.ry || 0, o.rz || 0), q = persp(D, r[0], r[1], r[2] + z1); return [px + q[0], py + q[1]]; }, o.n || (Math.abs(o.rx || 0) + Math.abs(o.ry || 0) > 0.5 ? 10 : 4));
  };
  /* ¿se pinta con 3D? (hay algún giro en X o en Y) */
  MC.has3D = (rx, ry) => Math.abs(rx || 0) > 0.25 || Math.abs(ry || 0) > 0.25;
  /* distancia de la cámara en unidades locales, para que la perspectiva dependa del tamaño del encuadre y no de lo ampliada que esté la capa */
  MC.camDist = (ctx, o, k0, factor) => { const m = ctx.getTransform(), sc = Math.max(1e-6, Math.hypot(m.a, m.b)); return (factor || 1.8) * Math.max(o.W, o.H) * (k0 || 1) / sc; };
})();
