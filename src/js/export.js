/* Exportación de vídeo MP4 en el propio navegador (WebCodecs + muxer). Usa el mismo motor de dibujo que el visor. */
(function () {
  const MC = window.MC;
  const { h, t } = MC;

  MC.PLATFORMS = [
    { id: 'proj', es: 'Como el proyecto', en: 'Same as project', fps: 30 },
    { id: 'tiktok', es: 'TikTok, Reels y Shorts', en: 'TikTok, Reels and Shorts', ratio: '9:16', res: '1080p', fps: 30, mbps: 12 },
    { id: 'yt', es: 'YouTube 1080p', en: 'YouTube 1080p', ratio: '16:9', res: '1080p', fps: 30, mbps: 12 },
    { id: 'yt4k', es: 'YouTube 4K', en: 'YouTube 4K', ratio: '16:9', res: '4K', fps: 30, mbps: 35 },
    { id: 'ig', es: 'Instagram 4:5', en: 'Instagram 4:5', ratio: '4:5', res: '1080p', fps: 30, mbps: 10 },
    { id: 'sq', es: 'Cuadrado 1:1', en: 'Square 1:1', ratio: '1:1', res: '1080p', fps: 30, mbps: 10 },
  ];
  const defaultMbps = (w, h2) => Math.max(4, Math.round((w * h2) / 2073600 * 12));

  const E = (MC.exporter = {});
  E.supported = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && !!window.Mp4Muxer;

  async function pickVideo(w, hh, fps, bitrate) {
    const list = [['avc', 'avc1.640033'], ['avc', 'avc1.640028'], ['avc', 'avc1.4d0034'], ['vp9', 'vp09.00.51.08'], ['vp9', 'vp09.00.40.08']];
    for (const c of list) {
      const cfg = { codec: c[1], width: w, height: hh, bitrate, framerate: fps };
      try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return { mux: c[0], cfg, label: c[0] === 'avc' ? 'H.264' : 'VP9' }; } catch (e) { /* siguiente */ }
    }
    return null;
  }
  async function pickAudio() {
    if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return null;
    for (const c of [['aac', 'mp4a.40.2'], ['opus', 'opus']]) {
      const cfg = { codec: c[1], sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 };
      try { const r = await AudioEncoder.isConfigSupported(cfg); if (r.supported) return { mux: c[0], cfg }; } catch (e) { /* siguiente */ }
    }
    return null;
  }

  /* opt: { res, fps, mbps, from, to, audio, normalize } */
  E.run = async (project, opt, onProgress, signal) => {
    const p = Object.assign({}, project, { res: opt.res || project.res });
    const size = MC.frameSize(p.ratio, p.res), W = size.w, H = size.h, fps = opt.fps, bitrate = Math.round(opt.mbps * 1e6);
    const total = MC.totalTime(p), from = opt.from || 0, to = Math.min(opt.to == null ? total : opt.to, total), dur = Math.max(0.1, to - from);
    const frames = Math.max(1, Math.round(dur * fps));
    const vid = await pickVideo(W, H, fps, bitrate);
    if (!vid) throw new Error(t('Este navegador no puede codificar vídeo a ' + W + '×' + H + '. Prueba con una resolución menor.', 'This browser cannot encode video at ' + W + '×' + H + '. Try a lower resolution.'));
    let mixBuf = null, aud = null;
    if (opt.audio) { onProgress(0, t('Mezclando el audio…', 'Mixing audio…')); mixBuf = await MC.audio.mixdown(p, from, to, opt.normalize); if (mixBuf) aud = await pickAudio(); }

    const target = new Mp4Muxer.ArrayBufferTarget();
    const muxer = new Mp4Muxer.Muxer({ target, video: { codec: vid.mux, width: W, height: H, frameRate: fps }, audio: aud ? { codec: aud.mux, numberOfChannels: 2, sampleRate: 48000 } : undefined, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
    let encErr = null;
    const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { encErr = e; } });
    venc.configure(vid.cfg);

    const canvas = new OffscreenCanvas(W, H), ctx = canvas.getContext('2d'), o = MC.renderOpts(p, { W, H });
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) { venc.close(); throw new Error('cancelado'); }
      if (encErr) throw encErr;
      MC.renderFrame(ctx, p, Math.min(total - 0.0001, from + i / fps), o);
      const f = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      venc.encode(f, { keyFrame: i % (fps * 2) === 0 });
      f.close();
      while (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 4));
      if (i % 3 === 0) { onProgress((i / frames) * 0.92, t('Fotograma ', 'Frame ') + (i + 1) + ' / ' + frames); await new Promise((r) => setTimeout(r, 0)); }
    }
    await venc.flush(); venc.close();
    if (encErr) throw encErr;

    if (aud && mixBuf) {
      onProgress(0.94, t('Codificando el audio…', 'Encoding audio…'));
      const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { encErr = e; } });
      aenc.configure(aud.cfg);
      const chunk = 4800, l = mixBuf.getChannelData(0), r = mixBuf.numberOfChannels > 1 ? mixBuf.getChannelData(1) : l;
      for (let pos = 0; pos < mixBuf.length; pos += chunk) {
        const n = Math.min(chunk, mixBuf.length - pos), data = new Float32Array(n * 2);
        data.set(l.subarray(pos, pos + n), 0); data.set(r.subarray(pos, pos + n), n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((pos / 48000) * 1e6), data });
        aenc.encode(ad); ad.close();
      }
      await aenc.flush(); aenc.close();
    }
    muxer.finalize();
    onProgress(1, '');
    return { blob: new Blob([target.buffer], { type: 'video/mp4' }), codec: vid.label, audio: aud ? (aud.mux === 'aac' ? 'AAC' : 'Opus') : mixBuf ? 'sin' : '', W, H, fps, dur };
  };

  const download = (blob, name) => {
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
  };

  /* Ventana de exportación. api: { project, time, shot, applyFormat(ratio,res) } */
  MC.openExport = (api) => {
    const p = api.project;
    const st = { plat: 'proj', fps: 30, mbps: null, range: 'all', audio: true, normalize: true, res: p.res };
    const body = h('div', { style: { display: 'grid', gap: '16px' } });
    let ctl = null, resultUrl = null;
    const hasAudio = () => (p.clips || []).length > 0;
    const plat = () => MC.PLATFORMS.find((x) => x.id === st.plat);
    const cur = () => {
      const pl = plat(), ratio = pl.ratio || p.ratio, res = pl.res || p.res;
      return { ratio, res, size: MC.frameSize(ratio, res), mismatch: pl.ratio && (pl.ratio !== p.ratio) };
    };
    const range = () => { const total = MC.totalTime(p); if (st.range === 'shot') { const s = MC.shotStarts(p)[api.shotIndex()]; return [s, s + p.shots[api.shotIndex()].duration]; } return [0, total]; };

    const draw = () => {
      MC.clear(body);
      const c = cur(), pl = plat(), mbps = st.mbps || pl.mbps || defaultMbps(c.size.w, c.size.h), r = range(), secs = r[1] - r[0];
      const sum = h('div', { class: 'calc', 'aria-live': 'polite' });
      MC.put(body,
        h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Plataforma', 'Platform')),
          MC.ui.chips(MC.PLATFORMS.map((x) => ({ v: x.id, l: t(x.es, x.en) })), st.plat, (v) => { st.plat = v; st.mbps = null; st.fps = plat().fps || 30; draw(); })),
        c.mismatch ? h('div', { class: 'calc' }, h('span', { class: 'warn' }, t('Tu proyecto es ' + p.ratio + ' y esta plataforma pide ' + c.ratio + '.', 'Your project is ' + p.ratio + ' and this platform asks for ' + c.ratio + '.')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { api.applyFormat(c.ratio, c.res); st.plat = 'proj'; draw(); } }, t('Cambiar el proyecto a ' + c.ratio, 'Change the project to ' + c.ratio))) : null,
        h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Fotogramas por segundo', 'Frames per second')), MC.ui.seg([24, 30, 60].map((v) => ({ v, l: v + ' fps' })), st.fps, (v) => { st.fps = +v; draw(); })),
        MC.ui.slider({ label: t('Calidad (bitrate)', 'Quality (bitrate)'), min: 2, max: 60, step: 1, value: mbps, fmt: (v) => v + ' Mbps', onInput: (v) => { st.mbps = v; refreshSum(); }, onChange: draw }),
        h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Qué exportar', 'What to export')), MC.ui.seg([{ v: 'all', l: t('Todo el vídeo', 'Whole video') }, { v: 'shot', l: t('Solo el plano actual', 'Current shot only') }], st.range, (v) => { st.range = v; draw(); })),
        hasAudio() ? h('div', { style: { display: 'grid', gap: '8px' } },
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.audio, onChange: (e) => { st.audio = e.target.checked; draw(); } }), h('span', null, t('Incluir el audio de la línea de tiempo', 'Include timeline audio'))),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.normalize, disabled: !st.audio, onChange: (e) => { st.normalize = e.target.checked; } }), h('span', null, t('Normalizar el volumen', 'Normalize volume'), h('small', null, t('Sube o baja la mezcla a un nivel cómodo para redes, sin saturar.', 'Raises or lowers the mix to a comfortable level for social media, without clipping.'))))) : null,
        sum,
        c.size.w * c.size.h > 3000000 ? h('p', { class: 'cap warn' }, t('4K usa mucha memoria. Si el navegador se queda sin ella, exporta en 1080p.', '4K uses a lot of memory. If the browser runs out, export at 1080p.')) : null,
        !E.supported() ? h('p', { class: 'cap bad' }, t('Este navegador no puede exportar vídeo. Usa una versión reciente de Chrome, Edge o Safari.', 'This browser cannot export video. Use a recent Chrome, Edge or Safari.')) : null);
      function refreshSum() {
        const m2 = st.mbps || mbps, mb2 = (m2 * secs) / 8 + (st.audio && hasAudio() ? 0.02 * secs : 0);
        MC.clear(sum);
        MC.put(sum, h('span', { class: 'cap' }, t('Resumen', 'Summary')), h('span', { class: 'big' }, c.size.w + ' × ' + c.size.h + ' · ' + st.fps + ' fps'), h('span', null, secs.toFixed(1) + ' s · ' + t('≈ ', '≈ ') + (mb2 < 1 ? '<1' : mb2.toFixed(0)) + ' MB · MP4'));
      }
      refreshSum();
    };
    draw();

    const progress = h('div', { style: { display: 'none', gap: '8px' } });
    const modal = MC.modal(t('Exportar', 'Export'), h('div', { style: { display: 'grid', gap: '16px' } }, body, progress), (close) => {
      const go = h('button', { class: 'btn btn-p', type: 'button', disabled: !E.supported() }, t('Exportar vídeo', 'Export video'));
      const still = h('button', { class: 'btn btn-s', type: 'button', onClick: () => {
        const sz = MC.frameSize(p.ratio, p.res), c = document.createElement('canvas'); c.width = sz.w; c.height = sz.h;
        MC.renderFrame(c.getContext('2d'), p, api.time(), MC.renderOpts(p));
        c.toBlob((b) => { download(b, p.name.replace(/[^\w\- ]+/g, '') + '-portada.png'); MC.toast(t('Portada exportada', 'Cover exported')); }, 'image/png');
      } }, t('Portada (PNG)', 'Cover (PNG)'));
      go.addEventListener('click', async () => {
        const c = cur(), pl = plat(), r = range();
        ctl = new AbortController();
        go.disabled = true; still.disabled = true; body.style.display = 'none'; progress.style.display = 'grid';
        const bar = h('i', { style: { display: 'block', height: '100%', width: '0%', background: 'var(--accent)' } }), label = h('span', { class: 'cap' }, '');
        MC.clear(progress);
        MC.put(progress, h('div', { class: 'eyebrow' }, t('Exportando', 'Exporting')), h('div', { style: { height: '8px', background: 'var(--raised)', borderRadius: '99px', overflow: 'hidden' } }, bar), label,
          h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => ctl.abort() }, t('Cancelar exportación', 'Cancel export')));
        try {
          const res = await E.run(p, { res: c.res, fps: st.fps, mbps: st.mbps || pl.mbps || defaultMbps(c.size.w, c.size.h), from: r[0], to: r[1], audio: st.audio && hasAudio(), normalize: st.normalize },
            (f, msg) => { bar.style.width = Math.round(f * 100) + '%'; label.textContent = Math.round(f * 100) + ' % · ' + msg; }, ctl.signal);
          resultUrl = URL.createObjectURL(res.blob);
          const name = p.name.replace(/[^\w\- ]+/g, '') + '.mp4';
          MC.clear(progress);
          MC.put(progress, h('div', { class: 'eyebrow' }, t('Listo', 'Done')),
            h('video', { src: resultUrl, controls: true, style: { width: '100%', maxHeight: '46vh', background: '#000', borderRadius: '8px' } }),
            h('p', { class: 'cap' }, res.W + '×' + res.H + ' · ' + res.fps + ' fps · ' + res.codec + (res.audio && res.audio !== 'sin' ? ' + ' + res.audio : '') + ' · ' + (res.blob.size / 1e6).toFixed(1) + ' MB'),
            res.codec !== 'H.264' ? h('p', { class: 'cap warn' }, t('Este navegador no codifica H.264, así que el vídeo está en VP9. Para subirlo a redes, exporta desde Chrome, Edge o Safari de escritorio.', 'This browser does not encode H.264, so the video is VP9. To upload it to social media, export from desktop Chrome, Edge or Safari.')) : null,
            res.audio === 'Opus' ? h('p', { class: 'cap warn' }, t('El audio está en Opus porque este navegador no codifica AAC. Algunas redes y reproductores lo rechazan: exporta desde Chrome, Edge o Safari de escritorio.', 'Audio is Opus because this browser cannot encode AAC. Some networks and players reject it: export from desktop Chrome, Edge or Safari.')) : null,
            res.audio === 'sin' ? h('p', { class: 'cap warn' }, t('Este navegador no codifica audio: el vídeo se ha exportado sin sonido.', 'This browser does not encode audio: the video was exported without sound.')) : null,
            h('div', { class: 'row-end' }, h('button', { class: 'btn btn-p', type: 'button', onClick: () => { download(res.blob, name); MC.toast(t('Vídeo descargado', 'Video downloaded')); } }, MC.icon('download', 15), t('Descargar MP4', 'Download MP4'))));
        } catch (e) {
          MC.clear(progress);
          MC.put(progress, h('p', { class: e.message === 'cancelado' ? 'cap' : 'cap bad' }, e.message === 'cancelado' ? t('Exportación cancelada.', 'Export cancelled.') : (e.message || String(e))),
            h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { progress.style.display = 'none'; body.style.display = 'grid'; go.disabled = !E.supported(); still.disabled = false; } }, t('Volver', 'Back')));
        }
      });
      return [h('button', { class: 'btn btn-g', type: 'button', onClick: () => { if (ctl) ctl.abort(); if (resultUrl) URL.revokeObjectURL(resultUrl); close(); } }, t('Cerrar', 'Close')), still, go];
    });
    return modal;
  };
})();
