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

  /* Trabajo de exportación en segundo plano: sigue aunque se cierre la ventana. */
  const jobListeners = new Set();
  MC.exportJob = null;
  MC.onExportJob = (fn) => { jobListeners.add(fn); return () => jobListeners.delete(fn); };
  const emit = () => jobListeners.forEach((f) => f(MC.exportJob));
  const E = (MC.exporter = {});
  E.supportedFor = (f) => (f === 'gif' || f === 'png' ? typeof OffscreenCanvas !== 'undefined' : f === 'audio' ? typeof OfflineAudioContext !== 'undefined' : E.supported());
  E.supported = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && !!window.Mp4Muxer;

  async function pickVideo(w, hh, fps, bitrate, onlyVp9) {
    const list = onlyVp9 ? [['vp9', 'vp09.00.51.08'], ['vp9', 'vp09.00.40.08'], ['vp9', 'vp09.00.31.08']] : [['avc', 'avc1.640033'], ['avc', 'avc1.640028'], ['avc', 'avc1.4d0034'], ['vp9', 'vp09.00.51.08'], ['vp9', 'vp09.00.40.08']];
    for (const c of list) {
      const cfg = { codec: c[1], width: w, height: hh, bitrate, framerate: fps };
      try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return { mux: c[0], cfg, label: c[0] === 'avc' ? 'H.264' : 'VP9' }; } catch (e) { /* siguiente */ }
    }
    return null;
  }
  async function pickAudio(onlyOpus) {
    if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return null;
    for (const c of (onlyOpus ? [['opus', 'opus']] : [['aac', 'mp4a.40.2'], ['opus', 'opus']])) {
      const cfg = { codec: c[1], sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 };
      try { const r = await AudioEncoder.isConfigSupported(cfg); if (r.supported) return { mux: c[0], cfg }; } catch (e) { /* siguiente */ }
    }
    return null;
  }

  /* opt: { res, fps, mbps, from, to, audio, normalize } */
  const runOne = async (project, opt, onProgress, signal) => {
    const p = Object.assign({}, project, { res: opt.res || project.res });
    const fmt = opt.format || 'mp4';
    if (fmt === 'audio') return MC.exportAudioOnly(p, opt, onProgress);
    if (fmt === 'gif' || fmt === 'png') return MC.exportFrames(p, opt, fmt, onProgress, signal);
    const size = MC.frameSize(p.ratio, p.res), W = size.w + (size.w % 2), H = size.h + (size.h % 2), fps = opt.fps, bitrate = Math.round(opt.mbps * 1e6);
    const total = MC.totalTime(p), from = opt.from || 0, to = Math.min(opt.to == null ? total : opt.to, total), dur = Math.max(0.1, to - from);
    const frames = Math.max(1, Math.round(dur * fps));
    await MC.ensureFonts();
    const vid = fmt === 'webm' ? await pickVideo(W, H, fps, bitrate, true) : await pickVideo(W, H, fps, bitrate);
    if (!vid) throw new Error(t('Este navegador no puede codificar vídeo a ' + W + '×' + H + '. Prueba con una resolución menor.', 'This browser cannot encode video at ' + W + '×' + H + '. Try a lower resolution.'));
    let mixBuf = null, aud = null;
    if (opt.audio) { onProgress(0, t('Mezclando el audio…', 'Mixing audio…')); mixBuf = await MC.audio.mixdown(p, from, to, opt.normalize); if (mixBuf) aud = await pickAudio(fmt === 'webm'); }

    const target = new Mp4Muxer.ArrayBufferTarget();
    const muxer = fmt === 'webm' ? new MC.WebmMuxer({ width: W, height: H, audio: !!aud }) : new Mp4Muxer.Muxer({ target, video: { codec: vid.mux, width: W, height: H, frameRate: fps }, audio: aud ? { codec: aud.mux, numberOfChannels: 2, sampleRate: 48000 } : undefined, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
    let encErr = null;
    const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { encErr = e; } });
    venc.configure(vid.cfg);

    const canvas = new OffscreenCanvas(W, H), ctx = canvas.getContext('2d'), o = MC.renderOpts(p, { W, H, lang: opt.lang, subs: opt.subs });
    const hasVid = MC.video.hasVideo(p); MC.video.exporting = hasVid;
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) { MC.video.exporting = false; venc.close(); throw new Error('cancelado'); }
      if (encErr) throw encErr;
      const tt = Math.min(total - 0.0001, from + i / fps);
      if (hasVid) await MC.video.prepare(p, tt);
      MC.renderFrame(ctx, p, tt, o);
      const f = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      venc.encode(f, { keyFrame: i % (fps * 2) === 0 });
      f.close();
      while (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 4));
      if (i % 3 === 0) { onProgress((i / frames) * 0.92, t('Fotograma ', 'Frame ') + (i + 1) + ' / ' + frames); await new Promise((r) => setTimeout(r, 0)); }
    }
    MC.video.exporting = false;
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
    const wb = muxer.finalize();
    onProgress(1, '');
    return { blob: fmt === 'webm' ? wb : new Blob([target.buffer], { type: 'video/mp4' }), ext: fmt === 'webm' ? 'webm' : 'mp4', kind: fmt, codec: vid.label, audio: aud ? (aud.mux === 'aac' ? 'AAC' : 'Opus') : mixBuf ? 'sin' : '', W, H, fps, dur };
  };

  /* Reencuadra al formato pedido (la cámara de página y de tira se recalcula), carga las imágenes originales y libera la memoria al acabar. */
  E.run = async (project, opt, onProgress, signal) => {
    const p = project;
    if (opt.ratio) p.ratio = opt.ratio;
    p.res = opt.res || p.res;
    MC.finalizePages(p);
    await MC.assets.useFull([...new Set(p.shots.concat(p.xshots || []).flatMap((sh) => sh.layers.flatMap((l) => MC.layerAssetIds(l))))]);
    try { return await runOne(p, opt, onProgress, signal); } finally { MC.assets.useProxy(); }
  };

  const download = (blob, name) => {
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
  };

  /* Ventana de exportación. api: { project, time, shot, applyFormat(ratio,res) } */
  MC.openExport = (api) => {
    const p = api.project;
    const st = { multi: false, format: 'mp4', plats: ['tiktok', 'yt'], plat: 'proj', fps: 30, mbps: null, range: 'all', audio: true, normalize: true, res: p.res, lang: p.lang, subs: true };
    const body = h('div', { style: { display: 'grid', gap: '16px' } });
    let offJob = () => {}, goBtn = null;
    const goLabel = () => ({ mp4: t('Exportar vídeo', 'Export video'), webm: t('Exportar WebM', 'Export WebM'), gif: t('Exportar GIF', 'Export GIF'), png: t('Exportar PNG', 'Export PNGs'), audio: t('Exportar audio', 'Export audio') })[st.format];
    const hasAudio = () => (p.clips || []).length > 0;
    const hasSubs = () => (p.texts || []).some((x) => x.kind === 'sub') || (p.subs || []).length > 0;
    const plat = () => MC.PLATFORMS.find((x) => x.id === st.plat);
    const cur = () => {
      const pl = plat(), ratio = pl.ratio || p.ratio, res = pl.res || p.res;
      return { ratio, res, size: MC.frameSize(ratio, res), mismatch: pl.ratio && (pl.ratio !== p.ratio) };
    };
    const range = () => { const total = MC.totalTime(p); if (st.range === 'shot') { const s = MC.shotStarts(p)[api.shotIndex()]; return [s, s + p.shots[api.shotIndex()].duration]; } return [0, total]; };

    const memNote = (c) => {
      const me = MC.memEstimate(p), mb = (me.full + c.size.w * c.size.h * 4 * 6) / 1048576, dm = navigator.deviceMemory ? navigator.deviceMemory * 1024 : 0;
      const high = mb > 1800 || (dm && mb > dm * 0.5);
      return h('p', { class: 'cap ' + (high ? 'warn' : '') }, t('Memoria estimada al exportar: ≈ ' + Math.round(mb) + ' MB', 'Estimated memory when exporting: ≈ ' + Math.round(mb) + ' MB') + (high ? t('. Es mucho para este equipo: baja la resolución o reduce las imágenes.', '. That is a lot for this device: lower the resolution or reduce the images.') : ''));
    };
    const draw = () => {
      MC.clear(body);
      const c = cur(), pl = plat(), mbps = st.mbps || pl.mbps || defaultMbps(c.size.w, c.size.h), r = range(), secs = r[1] - r[0];
      const sum = h('div', { class: 'calc', 'aria-live': 'polite' });
      MC.put(body,
        h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, st.multi ? t('Formatos (elige varios)', 'Formats (pick several)') : t('Plataforma', 'Platform')),
          st.multi ? h('div', { class: 'chips' }, MC.PLATFORMS.filter((x) => x.id !== 'proj').map((x) => h('button', { type: 'button', class: 'chip-b', 'aria-pressed': String(st.plats.includes(x.id)), onClick: () => { st.plats = st.plats.includes(x.id) ? st.plats.filter((q) => q !== x.id) : st.plats.concat([x.id]); draw(); } }, t(x.es, x.en))))
            : MC.ui.chips(MC.PLATFORMS.map((x) => ({ v: x.id, l: t(x.es, x.en) })), st.plat, (v) => { st.plat = v; st.mbps = null; st.fps = plat().fps || 30; draw(); }),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.multi, onChange: (e) => { st.multi = e.target.checked; if (st.multi) st.range = 'all'; draw(); } }), h('span', null, t('Exportar varios formatos a la vez', 'Export several formats at once'), h('small', null, t('La cámara se reencuadra para cada formato; los ajustes de cada plataforma se aplican solos.', 'The camera is reframed for each format; each platform’s settings apply automatically.'))))),
        c.mismatch && !st.multi ? h('div', { class: 'calc' }, h('span', { class: 'warn' }, t('Tu proyecto es ' + p.ratio + ' y esta plataforma pide ' + c.ratio + '.', 'Your project is ' + p.ratio + ' and this platform asks for ' + c.ratio + '.')),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => { api.applyFormat(c.ratio, c.res); st.plat = 'proj'; draw(); } }, t('Cambiar el proyecto a ' + c.ratio, 'Change the project to ' + c.ratio))) : null,
        h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Tipo de archivo', 'File type')),
          MC.ui.chips([{ v: 'mp4', l: 'MP4' }, { v: 'webm', l: 'WebM' }, { v: 'gif', l: 'GIF' }, { v: 'png', l: t('Secuencia PNG', 'PNG sequence') }, { v: 'audio', l: t('Solo audio', 'Audio only') }], st.format, (v) => { st.format = v; if (v === 'gif' && st.fps > 24) st.fps = 15; if (v !== 'gif' && st.fps < 24 && v !== 'png') st.fps = 30; if (v === 'audio') st.multi = false; draw(); if (goBtn) { goBtn.textContent = goLabel(); goBtn.disabled = !E.supportedFor(st.format); } }),
          h('span', { class: 'cap' }, ({ mp4: t('El más compatible con redes y móviles.', 'The most compatible with social networks and phones.'), webm: t('Para webs y editores; VP9 con audio Opus.', 'For web and editors; VP9 with Opus audio.'), gif: t('Animación corta sin sonido, hasta 480 px de ancho y 30 s.', 'Short silent animation, up to 480 px wide and 30 s.'), png: t('Un PNG por fotograma, en un ZIP, para llevarlo a otro programa.', 'One PNG per frame, in a ZIP, to take into another program.'), audio: t('Solo la mezcla de audio, en WAV.', 'Only the audio mix, as WAV.') })[st.format]),
          st.format === 'gif' || st.format === 'png' ? null : null),
        st.format === 'audio' ? null : h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Fotogramas por segundo', 'Frames per second')), MC.ui.seg((st.format === 'gif' ? [10, 15, 24] : [24, 30, 60]).map((v) => ({ v, l: v + ' fps' })), st.fps, (v) => { st.fps = +v; draw(); })),
        p.langs.length > 1 ? h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Idioma del texto', 'Text language')), MC.ui.seg(p.langs.map((l) => ({ v: l, l: l.toUpperCase() })), st.lang, (v) => { st.lang = v; })) : null,
        hasSubs() ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.subs, onChange: (e) => { st.subs = e.target.checked; } }), h('span', null, t('Mostrar los subtítulos en el vídeo', 'Show subtitles in the video'), h('small', null, t('Desactívalo si los subirás aparte como archivo SRT.', 'Turn it off if you will upload them separately as an SRT file.')))) : null,
        ['mp4', 'webm'].includes(st.format) ? MC.ui.slider({ label: t('Calidad (bitrate)', 'Quality (bitrate)'), min: 2, max: 60, step: 1, value: mbps, fmt: (v) => v + ' Mbps', onInput: (v) => { st.mbps = v; refreshSum(); }, onChange: draw }) : null,
        h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, t('Qué exportar', 'What to export')), MC.ui.seg([{ v: 'all', l: t('Todo el vídeo', 'Whole video') }, { v: 'shot', l: t('Solo el plano actual', 'Current shot only'), off: st.multi }], st.range, (v) => { st.range = v; draw(); })),
        hasAudio() && !['gif', 'png'].includes(st.format) ? h('div', { style: { display: 'grid', gap: '8px' } },
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.audio, onChange: (e) => { st.audio = e.target.checked; draw(); } }), h('span', null, t('Incluir el audio de la línea de tiempo', 'Include timeline audio'))),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.normalize, disabled: !st.audio, onChange: (e) => { st.normalize = e.target.checked; } }), h('span', null, t('Normalizar el volumen', 'Normalize volume'), h('small', null, t('Sube o baja la mezcla a un nivel cómodo para redes, sin saturar.', 'Raises or lowers the mix to a comfortable level for social media, without clipping.'))))) : null,
        sum,
        memNote(c),
        c.size.w * c.size.h > 3000000 ? h('p', { class: 'cap warn' }, t('4K usa mucha memoria. Si el navegador se queda sin ella, exporta en 1080p.', '4K uses a lot of memory. If the browser runs out, export at 1080p.')) : null,
        !E.supportedFor(st.format) ? h('p', { class: 'cap bad' }, t('Este navegador no puede exportar vídeo. Usa una versión reciente de Chrome, Edge o Safari.', 'This browser cannot export video. Use a recent Chrome, Edge or Safari.')) : null);
      function refreshSum() {
        const m2 = st.mbps || mbps, mb2 = (m2 * secs) / 8 + (st.audio && hasAudio() ? 0.02 * secs : 0);
        MC.clear(sum);
        MC.put(sum, h('span', { class: 'cap' }, t('Resumen', 'Summary')), h('span', { class: 'big' }, c.size.w + ' × ' + c.size.h + ' · ' + st.fps + ' fps'), h('span', null, secs.toFixed(1) + ' s · ' + t('≈ ', '≈ ') + (mb2 < 1 ? '<1' : mb2.toFixed(0)) + ' MB · MP4'));
      }
      refreshSum();
    };
    draw();

    const progress = h('div', { style: { display: 'none', gap: '8px' } });
    const content = h('div', { style: { display: 'grid', gap: '16px' } }, body, progress);
    const hostMount = (actions) => { const foot = h('div', { class: 'row-end', style: { position: 'sticky', bottom: 0, background: 'var(--panel)', padding: '10px 0' } }, actions(() => {})); api.host.append(content, foot); return { close() { offJob(); } }; };
    const build = (close) => {
      const go = goBtn = h('button', { class: 'btn btn-p', type: 'button', disabled: !E.supportedFor(st.format) }, goLabel());
      const still = h('button', { class: 'btn btn-s', type: 'button', onClick: () => {
        const sz = MC.frameSize(p.ratio, p.res), c = document.createElement('canvas'); c.width = sz.w; c.height = sz.h;
        MC.renderFrame(c.getContext('2d'), p, api.time(), MC.renderOpts(p, { lang: st.lang, subs: st.subs }));
        c.toBlob((b) => { download(b, p.name.replace(/[^\w\- ]+/g, '') + '-portada.png'); MC.toast(t('Portada exportada', 'Cover exported')); }, 'image/png');
      } }, t('Portada (PNG)', 'Cover (PNG)'));
      let shown = '', bar = null, label = null;
      const showJob = () => {
        const job = MC.exportJob;
        if (!job) { if (shown) { shown = ''; progress.style.display = 'none'; body.style.display = 'grid'; } go.disabled = !E.supportedFor(st.format) || (st.multi && !st.plats.length); go.textContent = goLabel(); still.disabled = false; return; }
        body.style.display = 'none'; progress.style.display = 'grid';
        go.disabled = true; still.disabled = job.state === 'running';
        if (job.state === 'running') {
          if (shown !== 'running') {
            shown = 'running'; bar = h('i', { style: { display: 'block', height: '100%', width: '0%', background: 'var(--accent)' } }); label = h('span', { class: 'cap' }, '');
            MC.clear(progress);
            MC.put(progress, h('div', { class: 'eyebrow' }, t('Exportando', 'Exporting')), h('div', { style: { height: '8px', background: 'var(--raised)', overflow: 'hidden' } }, bar), label,
              h('p', { class: 'cap' }, t('Puedes cerrar esta ventana y seguir editando: la exportación usa una copia del proyecto de ahora.', 'You can close this window and keep editing: the export uses a copy of the project as it is now.')),
              h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: () => job.ctl.abort() }, t('Cancelar exportación', 'Cancel export')));
          }
          bar.style.width = Math.round(job.progress * 100) + '%'; label.textContent = Math.round(job.progress * 100) + ' % · ' + job.label;
          return;
        }
        if (shown === job.state) return;
        shown = job.state; MC.clear(progress);
        const back = h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { (job.items || []).forEach((it) => URL.revokeObjectURL(it.url)); MC.exportJob = null; emit(); } }, t('Volver a los ajustes', 'Back to settings'));
        if (job.state === 'done') {
          const items = job.items, first = items[0].result, mk = (u, r) => (r.kind === 'gif' ? h('img', { src: u, alt: '', style: { width: '100%', maxHeight: '40vh', objectFit: 'contain', background: '#000' } }) : r.kind === 'png' ? h('p', { class: 'cap' }, t('ZIP con un PNG por fotograma.', 'A ZIP with one PNG per frame.')) : r.kind === 'audio' ? h('audio', { src: u, controls: true, style: { width: '100%' } }) : h('video', { src: u, controls: true, style: { width: '100%', maxHeight: '40vh', background: '#000' } })), vid = mk(items[0].url, first);
          const rows = items.map((it) => h('div', { class: 'layer', style: { cursor: 'default' } }, h('span', { class: 'ln' }, it.label), h('span', { class: 'lz' }, it.result.W + '×' + it.result.H + ' · ' + (it.result.blob.size / 1e6).toFixed(1) + ' MB'),
            items.length > 1 && vid.src !== undefined ? h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { vid.src = it.url; } }, t('Ver', 'View')) : null,
            h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: () => { download(it.result.blob, it.file); MC.toast(t('Vídeo descargado', 'Video downloaded')); } }, MC.icon('download', 13), t('Descargar', 'Download'))));
          MC.put(progress, h('div', { class: 'eyebrow' }, t('Listo', 'Done') + (items.length > 1 ? ' · ' + items.length + ' ' + t('formatos', 'formats') : '')), vid, h('div', { style: { display: 'grid', gap: '2px' } }, rows),
            first.kind === 'mp4' && first.codec !== 'H.264' ? h('p', { class: 'cap warn' }, t('Este navegador no codifica H.264, así que el vídeo está en VP9. Para subirlo a redes, exporta desde Chrome, Edge o Safari de escritorio.', 'This browser does not encode H.264, so the video is VP9. To upload it to social media, export from desktop Chrome, Edge or Safari.')) : null,
            first.kind === 'mp4' && first.audio === 'Opus' ? h('p', { class: 'cap warn' }, t('El audio está en Opus porque este navegador no codifica AAC. Algunas redes y reproductores lo rechazan: exporta desde Chrome, Edge o Safari de escritorio.', 'Audio is Opus because this browser cannot encode AAC. Some networks and players reject it: export from desktop Chrome, Edge or Safari.')) : null,
            ['mp4', 'webm'].includes(first.kind) && first.audio === 'sin' ? h('p', { class: 'cap warn' }, t('Este navegador no codifica audio: el vídeo se ha exportado sin sonido.', 'This browser does not encode audio: the video was exported without sound.')) : null,
            h('div', { class: 'row-end' }, back, items.length > 1 ? h('button', { class: 'btn btn-p', type: 'button', onClick: async () => { for (const it of items) { download(it.result.blob, it.file); await new Promise((r) => setTimeout(r, 500)); } } }, MC.icon('download', 15), t('Descargar todos', 'Download all')) : null));
        } else {
          MC.put(progress, h('p', { class: job.state === 'cancelled' ? 'cap' : 'cap bad' }, job.state === 'cancelled' ? t('Exportación cancelada.', 'Export cancelled.') : job.error || ''), back);
        }
      };
      offJob = MC.onExportJob(showJob);
      go.addEventListener('click', async () => {
        if (MC.exportJob && MC.exportJob.state === 'running') return;
        const targets = st.multi ? st.plats.map((id) => MC.PLATFORMS.find((x) => x.id === id)) : [plat()];
        if (!targets.length) return;
        const r = range(), base = p.name.replace(/[^\w\- ]+/g, '');
        const job = (MC.exportJob = { state: 'running', progress: 0, label: '', ctl: new AbortController(), name: p.name, items: [] });
        emit();
        try {
          for (let i = 0; i < targets.length; i++) {
            const pl = targets[i], ratio = pl.ratio || p.ratio, res = pl.res || p.res, size = MC.frameSize(ratio, res), tag = targets.length > 1 ? '(' + (i + 1) + '/' + targets.length + ') ' + t(pl.es, pl.en) + ' · ' : '';
            const result = await E.run(JSON.parse(JSON.stringify(p)), { format: st.format, ratio, res, fps: st.multi ? (st.format === 'gif' ? 15 : pl.fps || 30) : st.fps, mbps: st.multi ? pl.mbps || defaultMbps(size.w, size.h) : st.mbps || pl.mbps || defaultMbps(size.w, size.h),
              from: r[0], to: st.range === 'shot' ? r[1] : null, audio: st.audio && hasAudio(), normalize: st.normalize, lang: st.lang, subs: st.subs },
            (f, msg) => { job.progress = (i + f) / targets.length; job.label = tag + msg; emit(); }, job.ctl.signal);
            job.items.push({ label: t(pl.es, pl.en), result, url: URL.createObjectURL(result.blob), file: base + (targets.length > 1 ? '-' + pl.id : '') + '.' + (result.ext || 'mp4') });
          }
          job.state = 'done'; MC.toast(t('Exportación lista: «' + p.name + '»', 'Export ready: “' + p.name + '”'));
        } catch (e) { job.state = e.message === 'cancelado' ? 'cancelled' : 'error'; job.error = e.message || String(e); }
        emit();
      });
      showJob();
      const srt = h('button', { class: 'btn btn-s', type: 'button', onClick: () => {
        const txt = MC.srt(p, st.lang);
        if (!txt) { MC.toast(t('Aún no hay subtítulos con texto.', 'There are no subtitles with text yet.')); return; }
        download(new Blob([txt], { type: 'text/plain' }), p.name.replace(/[^\w\- ]+/g, '') + '-' + st.lang + '.srt'); MC.toast(t('Subtítulos exportados (SRT)', 'Subtitles exported (SRT)'));
      } }, t('Subtítulos (SRT)', 'Subtitles (SRT)'));
      return [api.host ? null : h('button', { class: 'btn btn-g', type: 'button', onClick: () => { offJob(); close(); } }, t('Cerrar', 'Close')), hasSubs() ? srt : null, still, go];
    };
    return api.host ? hostMount(build) : MC.modal(t('Exportar', 'Export'), content, build);
  };
})();
