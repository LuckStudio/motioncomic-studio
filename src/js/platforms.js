/* Vista previa en plataforma: cómo se vería tu vídeo dentro de TikTok, Reels, Shorts, YouTube, Twitch, Vimeo, LinkedIn o Instagram según su proporción.
   Es una simulación aproximada y genérica: no usa logotipos ni marcas, solo la distribución de cada app. */
(function () {
  'use strict';
  const MC = window.MC, h = MC.h, t = MC.t;

  /* iconos propios que no están en la biblioteca general (trazo, 24×24) */
  const P = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.400 3.600-7 8-7s8 2.600 8 7"/>', users: '<circle cx="9" cy="8" r="3.500"/><path d="M2 20c0-3.500 3-6 7-6s7 2.500 7 6"/><circle cx="17" cy="9" r="2.500"/><path d="M17 14c3 0 5 2 5 5"/>',
    inbox: '<path d="M3 13l3-9h12l3 9v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1 3h6l1-3h5"/>', plus: '<path d="M12 5v14M5 12h14"/>', up: '<path d="M7 11V21H3V11zM7 11l4-8c2 0 3 1.500 2.500 3.500L13 9h6a2 2 0 0 1 2 2.300l-1 7A2 2 0 0 1 18 20H7"/>',
    down: '<path d="M7 13V3H3v10zM7 13l4 8c2 0 3-1.500 2.500-3.500L13 15h6a2 2 0 0 0 2-2.300l-1-7A2 2 0 0 0 18 4H7"/>', share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v12M7 8l5-5 5 5"/>', reply: '<path d="M10 9V4L3 11l7 7v-5c6 0 9 2 11 7-1-7-5-11-11-11z"/>',
    vol: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11"/>', cc: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 10.500a2 2 0 1 0 0 3M17 10.500a2 2 0 1 0 0 3"/>', full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>', pause: '<path d="M7 4h4v16H7zM14 4h4v16h-4z" fill="currentColor"/>', skip: '<path d="M5 4l10 8-10 8zM17 4h2v16h-2z" fill="currentColor"/>',
    send: '<path d="M21 3L3 10l7 3 3 7z"/><path d="M10 13l11-10"/>', comment: '<path d="M4 5h16v11H9l-5 4z"/>', repost: '<path d="M4 9V7a2 2 0 0 1 2-2h12l-3-3M20 15v2a2 2 0 0 1-2 2H6l3 3"/>', heart: '<path d="M12 21s-8-5.300-8-11a4.500 4.500 0 0 1 8-2.500A4.500 4.500 0 0 1 20 10c0 5.700-8 11-8 11z"/>', bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>', dots: '<circle cx="5" cy="12" r="1.600" fill="currentColor"/><circle cx="12" cy="12" r="1.600" fill="currentColor"/><circle cx="19" cy="12" r="1.600" fill="currentColor"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.500"/>', note: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', star: '<path d="M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z"/>',
  };
  const ic = (n, s, fill) => { const sp = document.createElement('span'); sp.className = 'ppi'; sp.style.cssText = 'display:inline-flex;width:' + (s || 20) + 'px;height:' + (s || 20) + 'px'; sp.innerHTML = '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="' + (fill ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[n] || '') + '</svg>'; return sp; };
  const em = (n, s, fill) => { const e = ic(n, 0, fill); e.style.width = e.style.height = (s || 1.6) + 'em'; return e; };
  const lines = (n, w) => h('div', { class: 'pp-lines' }, Array.from({ length: n }, (_, i) => h('i', { style: { width: (w ? w[i % w.length] : 100 - (i % 3) * 18) + '%' } })));

  /* qué plataformas se ofrecen para cada proporción */
  const PLATS = {
    tiktok: ['TikTok', 'vertical'], reels: ['Reels', 'vertical'], shorts: ['YouTube Shorts', 'vertical'],
    youtube: ['YouTube', 'wide'], twitch: ['Twitch', 'wide'], vimeo: ['Vimeo', 'wide'],
    linkedin: ['LinkedIn', 'feed'], instagram: ['Instagram', 'feed'],
  };
  const classOf = (ratio) => { const q = MC.parseRatio(ratio), r = q[0] / q[1]; return r <= 0.7 ? 'vertical' : r >= 1.3 ? 'wide' : 'feed'; };
  const listFor = (ratio) => {
    const q = MC.parseRatio(ratio), r = q[0] / q[1], c = classOf(ratio);
    if (c === 'vertical') return ['tiktok', 'reels', 'shorts'];
    if (c === 'wide') return r >= 1.9 ? ['youtube', 'twitch'] : ['youtube', 'twitch', 'vimeo'];
    return ['linkedin', 'instagram', 'tiktok'];
  };

  /* interfaz vertical (TikTok, Reels, Shorts): se usa dentro del móvil de la vista previa y encima del visor. Todo en «em». */
  function verticalUI(p) {
    const act = (n, label, fill) => h('div', { class: 'pp-act' }, em(n, 2.1, fill), label ? h('span', null, label) : null);
    const disc = h('div', { class: 'pp-disc' }, em('note', 0.9));
    const nav = (items) => h('div', { class: 'pp-nav' }, items.map((q) => (q[2] ? h('div', { class: 'pp-navplus' }, em('plus', 1.2)) : h('div', { class: q[3] ? 'on' : '' }, em(q[0], 1.45), h('span', null, q[1])))));
    const caption = t('Ya está aquí el capítulo 3. ¿Qué te ha parecido el final? #cómic #motioncomic', 'Chapter 3 is out. What did you think of the ending? #comic #motioncomic');
    let ui;
    if (p === 'tiktok') {
      ui = [h('div', { class: 'pp-top c' }, h('span', null, t('Siguiendo', 'Following')), h('b', null, t('Para ti', 'For you')), h('div', { class: 'pp-topr' }, em('search', 1.5))),
        h('div', { class: 'pp-side' }, h('div', { class: 'pp-av' }, h('i', null, '+')), act('heart', t('12,4 mil', '12.4K'), true), act('comment', '238', true), act('bookmark', t('1.032', '1,032'), true), act('share', t('Compartir', 'Share'), false), disc),
        h('div', { class: 'pp-bot' }, h('b', null, '@tu_usuario'), h('span', null, caption), h('span', { class: 'pp-snd' }, em('note', 1), t('Sonido original · tu_usuario', 'Original sound · your_user'))),
        nav([['home', t('Inicio', 'Home'), 0, 1], ['users', t('Amigos', 'Friends')], ['plus', '', 1], ['inbox', t('Bandeja', 'Inbox')], ['user', t('Perfil', 'Profile')]])];
    } else if (p === 'reels') {
      ui = [h('div', { class: 'pp-top l' }, h('b', null, 'Reels'), h('div', { class: 'pp-topr' }, em('camera', 1.6))),
        h('div', { class: 'pp-side' }, act('heart', t('12,4 mil', '12.4K')), act('comment', '238'), act('send', '1.032'), act('dots', ''), h('div', { class: 'pp-sq' }, em('note', 0.9))),
        h('div', { class: 'pp-bot' }, h('div', { class: 'pp-who' }, h('i', { class: 'pp-av2' }), h('b', null, 'tu_usuario'), h('span', { class: 'pp-btn' }, t('Seguir', 'Follow'))), h('span', null, caption), h('span', { class: 'pp-snd' }, em('note', 1), t('Audio original', 'Original audio'))),
        nav([['home', ''], ['search', ''], ['plus', '', 1], ['camera', '', 0, 1], ['user', '']])];
    } else {
      ui = [h('div', { class: 'pp-top r' }, em('search', 1.5), em('dots', 1.5)),
        h('div', { class: 'pp-side' }, act('up', t('12 mil', '12K')), act('down', t('No me gusta', 'Dislike')), act('comment', '238'), act('reply', t('Compartir', 'Share')), act('repost', t('Remix', 'Remix')), h('div', { class: 'pp-sq' }, em('note', 0.9))),
        h('div', { class: 'pp-bot' }, h('div', { class: 'pp-who' }, h('i', { class: 'pp-av2' }), h('b', null, '@tu_canal'), h('span', { class: 'pp-btn red' }, t('Suscribirse', 'Subscribe'))), h('span', null, caption)),
        nav([['home', t('Inicio', 'Home')], ['play', t('Shorts', 'Shorts'), 0, 1], ['plus', '', 1], ['users', t('Suscripciones', 'Subscriptions')], ['user', t('Tú', 'You')]])];
    }
    const prog = h('i');
    const root = h('div', { class: 'pp-v', 'data-p': p }, ui, h('div', { class: 'pp-prog' }, prog));
    root.prog = prog; return root;
  }

  /* contenedores con proporción fija en los que se copia el visor */
  function mirror(src, car, mode) {
    const c = document.createElement('canvas'), W = 640, H = Math.round(W / car); c.width = W; c.height = H; c.className = 'pp-mirror';
    const g = c.getContext('2d');
    c.draw = () => {
      const s = src(); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); if (!s || !s.width) return;
      const sa = s.width / s.height; let dw = W, dh = H, dx = 0, dy = 0;
      if (mode === 'cover') { if (sa > car) { dw = H * sa; dx = (W - dw) / 2; } else { dh = W / sa; dy = (H - dh) / 2; } } else if (sa > car) { dh = W / sa; dy = (H - dh) / 2; } else { dw = H * sa; dx = (W - dw) / 2; }
      g.drawImage(s, dx, dy, dw, dh);
    };
    return c;
  }
  const frame = (car, canvas, extra) => { const f = h('div', { class: 'pp-media', style: { aspectRatio: String(car) } }, canvas, extra); return f; };

  /* ---------- cada plataforma ---------- */
  function skin(p, ctx) {
    const { src, ratio, onSeek } = ctx, q = MC.parseRatio(ratio), ar = q[0] / q[1];
    const bars = []; const mk = (el, k) => { bars.push([el, k]); return el; };
    const lbl = mk(h('span', null, '0:00'), 'time'), total = h('span', null, '0:00');
    mk(total, 'total');
    if (p === 'tiktok' || p === 'reels' || p === 'shorts') {
      const mc = mirror(src, 9 / 16, 'contain'), ui = verticalUI(p);
      mk(ui.prog, 'bar');
      return { node: h('div', { class: 'pp-phone' }, h('div', { class: 'pp-screen' }, frame(9 / 16, mc), ui)), canvases: [mc], bars };
    }
    if (p === 'youtube') {
      const mc = mirror(src, 16 / 9, 'contain'), bar = h('i'), dot = h('b');
      mk(bar, 'bar'); mk(dot, 'dot');
      const ctl = h('div', { class: 'pp-ytctl' }, h('div', { class: 'pp-ytbar', onClick: (e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek((e.clientX - r.left) / r.width); } }, bar, dot),
        h('div', { class: 'pp-row' }, ic('play', 18, true), ic('skip', 18, true), ic('vol', 18), h('span', { class: 'pp-time' }, lbl, ' / ', total), h('span', { class: 'sp' }), ic('cc', 18), ic('gear', 18), ic('full', 18)));
      const side = Array.from({ length: 4 }, (_, i) => h('div', { class: 'pp-next' }, h('div', { class: 'pp-th' }), h('div', null, lines(2, [90, 60]), h('small', null, t('Canal · 12 mil visualizaciones', 'Channel · 12K views')))));
      return { node: h('div', { class: 'pp-page yt' }, h('div', { class: 'pp-hdr' }, ic('menu', 20), h('b', { class: 'pp-logo' }, t('Vídeo', 'Video')), h('div', { class: 'pp-srch' }, t('Buscar', 'Search')), ic('user', 20)),
        h('div', { class: 'pp-cols' }, h('div', { class: 'pp-main' }, frame(16 / 9, mc, ctl), h('h3', null, t('Capítulo 3 · Tráiler', 'Chapter 3 · Trailer')),
          h('div', { class: 'pp-chan' }, h('i', { class: 'pp-av2' }), h('div', null, h('b', null, t('Tu canal', 'Your channel')), h('small', null, t('1,2 mil suscriptores', '1.2K subscribers'))), h('span', { class: 'pp-btn wht' }, t('Suscribirse', 'Subscribe')), h('span', { class: 'sp' }), h('span', { class: 'pp-pill' }, ic('up', 16), '12 mil', ic('down', 16)), h('span', { class: 'pp-pill' }, ic('reply', 16), t('Compartir', 'Share'))),
          h('div', { class: 'pp-desc' }, h('b', null, t('12.450 visualizaciones · hace 2 horas', '12,450 views · 2 hours ago')), lines(2, [95, 70]))), h('div', { class: 'pp-sidebar' }, side))), canvases: [mc], bars };
    }
    if (p === 'twitch') {
      const mc = mirror(src, 16 / 9, 'contain'), bar = h('i');
      mk(bar, 'bar');
      const live = h('div', { class: 'pp-tlive' }, h('span', { class: 'pp-badge' }, t('EN DIRECTO', 'LIVE')), h('span', { class: 'pp-view' }, '● 1.204'));
      const ctl = h('div', { class: 'pp-twctl' }, h('div', { class: 'pp-twbar' }, bar), h('div', { class: 'pp-row' }, ic('pause', 18, true), ic('vol', 18), h('span', { class: 'sp' }), ic('clock', 18), ic('gear', 18), ic('full', 18)));
      const msgs = [['luna_ink', '#ff6fa8', t('¡Qué buena animación!', 'Great animation!')], ['pixelfox', '#5ec8ff', t('esa transición 🔥', 'that transition 🔥')], ['goti', '#a5ff5e', t('capítulo nuevo por fin', 'new chapter at last')], ['mika', '#ffb45e', t('el final me ha dejado loca', 'the ending blew my mind')], ['tintazul', '#c08cff', 'GG'], ['nube', '#ff6f6f', t('más páginas por favor', 'more pages please')]];
      return { node: h('div', { class: 'pp-page tw' }, h('div', { class: 'pp-twrail' }, ic('home', 20), ic('users', 20), ic('star', 20)),
        h('div', { class: 'pp-twmain' }, frame(16 / 9, mc, [live, ctl]), h('div', { class: 'pp-chan' }, h('i', { class: 'pp-av2 tw' }), h('div', null, h('b', null, t('tu_canal', 'your_channel')), h('small', null, t('Estreno del capítulo 3 · Arte y cómic', 'Chapter 3 premiere · Art and comics'))), h('span', { class: 'sp' }), h('span', { class: 'pp-btn tw' }, t('Seguir', 'Follow')), h('span', { class: 'pp-btn gry' }, t('Suscribirse', 'Subscribe'))),
          h('div', { class: 'pp-tags' }, ['Arte', 'Cómic', 'Español'].map((x) => h('span', null, x)))),
        h('div', { class: 'pp-chat' }, h('div', { class: 'pp-chath' }, t('Chat del directo', 'Stream chat')), msgs.map((m) => h('p', null, h('b', { style: { color: m[1] } }, m[0] + ': '), m[2])), h('div', { class: 'pp-chatin' }, t('Enviar un mensaje', 'Send a message')))), canvases: [mc], bars };
    }
    if (p === 'vimeo') {
      const mc = mirror(src, 16 / 9, 'contain'), bar = h('i');
      mk(bar, 'bar');
      const ctl = h('div', { class: 'pp-vmctl' }, ic('play', 16, true), h('span', { class: 'pp-time' }, lbl), h('div', { class: 'pp-vmbar', onClick: (e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek((e.clientX - r.left) / r.width); } }, bar), h('span', { class: 'pp-time' }, total), ic('vol', 16), ic('cc', 16), ic('gear', 16), ic('full', 16));
      const side = h('div', { class: 'pp-vmside' }, ic('heart', 20), ic('clock', 20), ic('bookmark', 20), ic('share', 20));
      return { node: h('div', { class: 'pp-page vm' }, h('div', { class: 'pp-hdr' }, h('b', { class: 'pp-logo' }, t('Vídeo', 'Video')), h('div', { class: 'pp-srch' }, t('Buscar', 'Search')), h('span', { class: 'sp' }), h('span', { class: 'pp-btn vm' }, t('Subir', 'Upload'))),
        h('div', { class: 'pp-vmwrap' }, h('div', { class: 'pp-vmplayer' }, frame(16 / 9, mc, ctl), side), h('h3', null, t('Capítulo 3 · Tráiler', 'Chapter 3 · Trailer')),
          h('div', { class: 'pp-chan' }, h('i', { class: 'pp-av2' }), h('div', null, h('small', null, t('de ', 'by ')), h('b', null, t('Tu nombre', 'Your name'))), h('span', { class: 'pp-btn vm' }, t('Seguir', 'Follow'))), lines(3, [100, 90, 55]))), canvases: [mc], bars };
    }
    /* feed: LinkedIn e Instagram */
    if (p === 'linkedin') {
      const car = Math.max(0.8, Math.min(1.91, ar)), mc = mirror(src, car, 'cover'), bar = h('i');
      mk(bar, 'bar');
      return { node: h('div', { class: 'pp-card li' }, h('div', { class: 'pp-ch' }, h('i', { class: 'pp-av2' }), h('div', null, h('b', null, t('Tu nombre', 'Your name')), h('small', null, t('Ilustrador · 3.214 seguidores', 'Illustrator · 3,214 followers')), h('small', null, t('2 h · ', '2h · '), ic('globe', 11))), h('span', { class: 'pp-link' }, '+ ' + t('Seguir', 'Follow'))),
        h('p', { class: 'pp-txt' }, t('Os presento el capítulo 3 de mi cómic animado. ¿Qué os parece?', 'Here is chapter 3 of my animated comic. What do you think?')),
        frame(car, mc, h('div', { class: 'pp-mini' }, ic('play', 14, true), h('div', { class: 'pp-minibar' }, bar))),
        h('div', { class: 'pp-react' }, h('span', null, '👍 ❤️ 238'), h('span', null, t('12 comentarios · 3 veces compartido', '12 comments · 3 reposts'))),
        h('div', { class: 'pp-acts' }, [['up', t('Me gusta', 'Like')], ['comment', t('Comentar', 'Comment')], ['repost', t('Compartir', 'Repost')], ['send', t('Enviar', 'Send')]].map((a) => h('span', null, ic(a[0], 18), a[1])))), canvases: [mc], bars };
    }
    if (p === 'instagram') {
      const car = Math.max(0.8, Math.min(1.91, ar)), mc = mirror(src, car, 'cover'), bar = h('i');
      mk(bar, 'bar');
      return { node: h('div', { class: 'pp-card ig' }, h('div', { class: 'pp-ch' }, h('i', { class: 'pp-av2 ig' }), h('b', null, 'tu_usuario'), h('span', { class: 'sp' }), ic('dots', 18)),
        frame(car, mc, h('div', { class: 'pp-mini' }, ic('play', 14, true), h('div', { class: 'pp-minibar' }, bar))),
        h('div', { class: 'pp-igacts' }, ic('heart', 24), ic('comment', 24), ic('send', 24), h('span', { class: 'sp' }), ic('bookmark', 24)),
        h('div', { class: 'pp-igtxt' }, h('b', null, t('1.248 Me gusta', '1,248 likes')), h('p', null, h('b', null, 'tu_usuario '), t('Capítulo 3 ya disponible. ¡Contadme qué os parece! #cómic #motioncomic', 'Chapter 3 is out. Tell me what you think! #comic #motioncomic')), h('small', null, t('Ver los 38 comentarios', 'View all 38 comments')), h('small', { class: 'up' }, t('HACE 2 HORAS', '2 HOURS AGO')))), canvases: [mc], bars };
    }
    return null;
  }

  /* ventana de la vista previa. api = { src(): canvas, ratio, time(), dur(), playing(), toggle(), seek(sec), pick? } */
  MC.platforms = {
    list: listFor, name: (id) => PLATS[id][0], verticalUI, classOf,
    open(api) {
      const list = listFor(api.ratio); let cur = MC.store.get('platPrev', '');
      if (!list.includes(cur)) cur = list[0];
      const body = h('div', { class: 'pp-wrap' }), stage = h('div', { class: 'pp-stage' });
      const playBtn = h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { api.toggle(); upd(); } }), timeL = h('span', { class: 'cap' });
      let s = null, raf = 0, modal = null;
      const upd = () => { MC.clear(playBtn); MC.put(playBtn, MC.icon(api.playing() ? 'pause' : 'play', 14), api.playing() ? t('Pausar', 'Pause') : t('Reproducir', 'Play')); };
      const draw = () => {
        MC.clear(stage); s = skin(cur, { src: api.src, ratio: api.ratio, onSeek: (f) => api.seek(f * api.dur()) });
        stage.dataset.p = cur; MC.put(stage, s.node); s.canvases.forEach((c) => c.draw());
        MC.clear(seg); MC.put(seg, MC.ui.seg(list.map((id) => ({ v: id, l: PLATS[id][0] })), cur, (v) => { cur = v; MC.store.set('platPrev', v); draw(); }, t('Plataforma', 'Platform')));
      };
      const seg = h('div');
      const loop = () => {
        if (!body.isConnected) { cancelAnimationFrame(raf); return; }
        if (s) {
          s.canvases.forEach((c) => c.draw()); const f = api.dur() ? Math.min(1, api.time() / api.dur()) : 0;
          s.bars.forEach(([el, k]) => { if (k === 'bar') el.style.width = f * 100 + '%'; else if (k === 'dot') el.style.left = f * 100 + '%'; else if (k === 'time') el.textContent = MC.fmtTime(api.time()); else if (k === 'total') el.textContent = MC.fmtTime(api.dur()); });
        }
        timeL.textContent = MC.fmtTime(api.time()) + ' / ' + MC.fmtTime(api.dur()); upd();
        raf = requestAnimationFrame(loop);
      };
      MC.put(body, h('p', { class: 'cap' }, t('Así se vería tu vídeo en cada plataforma según su proporción (' + api.ratio + '). Es una simulación aproximada y genérica: cada app cambia su diseño con el tiempo.', 'This is how your video would look on each platform for its ratio (' + api.ratio + '). It is a generic, approximate simulation: each app changes its design over time.')), seg, stage,
        h('div', { class: 'pp-ctl' }, playBtn, h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => api.seek(0) }, MC.icon('first', 14), t('Al inicio', 'Restart')), timeL));
      modal = MC.modal(t('Vista previa en plataforma', 'Platform preview'), body, (close) => [h('button', { class: 'btn btn-p', type: 'button', onClick: () => { cancelAnimationFrame(raf); close(); } }, t('Cerrar', 'Close'))], { wide: true });
      draw(); upd(); raf = requestAnimationFrame(loop);
    },
  };
})();
