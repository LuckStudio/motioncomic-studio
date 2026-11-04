/* Importar PDF: cada página se convierte en una imagen a la resolución elegida (PRD 6). */
(function () {
  const MC = window.MC;
  let ready = false;

  function setup() {
    if (ready || !window.pdfjsLib) return !!window.pdfjsLib;
    const emb = document.getElementById('pdf-worker');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = emb ? URL.createObjectURL(new Blob([emb.textContent], { type: 'text/javascript' })) : 'src/vendor/pdf.worker.min.js';
    ready = true;
    return true;
  }

  /* Devuelve un archivo PNG por página. width = ancho en píxeles de la imagen resultante. */
  MC.pdfToImages = async (file, width, onProgress) => {
    if (!setup()) throw new Error('sin lector de PDF');
    const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const total = doc.numPages, out = [], n = Math.min(total, 80), base = file.name.replace(/\.pdf$/i, '');
    for (let i = 1; i <= n; i++) {
      if (onProgress) onProgress(i, n);
      const page = await doc.getPage(i), v1 = page.getViewport({ scale: 1 });
      let scale = width / v1.width;
      const maxPx = 36e6; // tope de memoria por página
      if (v1.width * v1.height * scale * scale > maxPx) scale = Math.sqrt(maxPx / (v1.width * v1.height));
      const vp = page.getViewport({ scale }), c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
      out.push(new File([blob], base + '-' + String(i).padStart(3, '0') + '.png', { type: 'image/png' }));
      page.cleanup();
    }
    await doc.destroy();
    return { files: out, truncated: total > n };
  };
})();
