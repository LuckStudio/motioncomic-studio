/* Packs de sonidos: importar un ZIP o una carpeta descargada (cada subcarpeta pasa a ser una etiqueta), saber de dónde sacar sonidos libres
   y generar los créditos de lo que usa el proyecto. Todo ocurre en este equipo. */
(function () {
  'use strict';
  const MC = window.MC, h = MC.h, t = MC.t;
  const AUD = /\.(wav|mp3|m4a|ogg|aac|flac)$/i, MIME = { wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', aac: 'audio/aac', flac: 'audio/flac' };
  const LIC = [['cc0', 'CC0 · libre del todo', 'CC0 · completely free'], ['free', 'Libre, también para vídeos comerciales', 'Free, also for commercial videos'], ['ccby', 'CC-BY · hay que citar al autor', 'CC-BY · the author must be credited'], ['personal', 'Solo uso personal o educativo', 'Personal or educational use only'], ['other', 'Otra o no lo sé', 'Other or unknown']];
  MC.SOUND_LICENSES = LIC;
  const licName = (v) => { const q = LIC.find((x) => x[0] === v); return q ? t(q[1], q[2]) : ''; };
  /* de dónde sacar sonidos: resumen orientativo, hay que mirar la licencia de cada descarga */
  const SOURCES = [
    ['Kenney', 'https://kenney.nl/assets?q=audio', 'cc0', 'Packs de efectos de interfaz, impactos, sci-fi y más. Todo en dominio público (CC0): se puede usar en cualquier proyecto sin citar.', 'Packs of interface sounds, impacts, sci-fi and more. All public domain (CC0): usable in any project without credit.'],
    ['Sonniss GDC Game Audio Bundle', 'https://sonniss.com/gameaudiogdc', 'free', 'Miles de efectos profesionales, gratis cada año y con uso comercial permitido. No se pueden volver a repartir como biblioteca: descárgalos tú. Lee la licencia del pack.', 'Thousands of professional effects, free every year and cleared for commercial use. They cannot be redistributed as a library: download them yourself. Read the pack licence.'],
    ['Pixabay · Efectos de sonido', 'https://pixabay.com/sound-effects/', 'free', 'Sonidos y músicas gratis con la licencia de contenido de Pixabay (uso comercial permitido, sin citar). No tiene API de audio: se descargan a mano.', 'Free sounds and music under the Pixabay content licence (commercial use allowed, no credit). No audio API: download them by hand.'],
    ['Mixkit · Efectos de sonido', 'https://mixkit.co/free-sound-effects/', 'free', 'Efectos gratuitos con la licencia de Mixkit (uso en vídeos y proyectos, también comerciales). Descarga manual.', 'Free effects under the Mixkit licence (use in videos and projects, also commercial). Manual download.'],
    ['Freesound', 'https://freesound.org/', 'ccby', 'La mayor biblioteca colaborativa. Cada sonido trae su licencia: CC0, CC-BY (citar al autor) o CC-BY-NC (no vale para monetizar). Mira siempre la de cada archivo.', 'The largest collaborative library. Each sound has its own licence: CC0, CC-BY (credit the author) or CC-BY-NC (not for monetising). Always check each file.'],
    ['BBC Sound Effects', 'https://sound-effects.bbcrewind.co.uk/', 'personal', 'Más de 30 000 grabaciones, pero su licencia es solo para uso personal, educativo o de investigación: no sirven para vídeos que den dinero.', 'Over 30,000 recordings, but the licence is for personal, educational or research use only: not for videos that earn money.'],
  ];
  const safe = (s) => String(s || '').replace(/[<>]/g, '').trim();

  /* lista plana [{ file, path }] a partir de ZIP, carpetas o archivos sueltos */
  async function entriesOf(files) {
    const out = []; let pack = '';
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) {
        pack = pack || f.name.replace(/\.zip$/i, '');
        const ents = (await MC.zip.read(f)).filter((e) => !e.dir && !/(^|\/)(__MACOSX|\.)/.test(e.name) && AUD.test(e.name));
        for (const e of ents) { const b = await e.blob(), ext = e.name.split('.').pop().toLowerCase(); out.push({ file: new File([b], e.name.split('/').pop(), { type: MIME[ext] || b.type }), path: e.name }); }
      } else if (AUD.test(f.name)) { const rel = f.webkitRelativePath || f.name; if (f.webkitRelativePath && !pack) pack = f.webkitRelativePath.split('/')[0]; if (!/(^|\/)\./.test(rel)) out.push({ file: f, path: rel }); }
    }
    return { out, pack };
  }

  /* ---------- Freesound (opcional, con clave propia) ----------
     Las búsquedas y las descargas van directamente de este navegador a freesound.org con la clave de la persona: no pasan por ningún servidor nuestro. */
  const FSB = () => (MC.store.get('fsbase', '') || 'https://freesound.org/apiv2').replace(/\/$/, '');
  const FSK = () => MC.store.get('fskey', '');
  const fsLic = (url) => { const u = String(url || ''); if (/publicdomain\/zero|\/zero\/1/i.test(u)) return 'cc0'; if (/by-nc/i.test(u)) return 'personal'; if (/creativecommons\.org\/licenses\/by\//i.test(u)) return 'ccby'; return 'other'; };
  MC.fsLic = fsLic;
  const fsErr = (e) => (e && e.status === 401 || e && e.status === 403 ? t('Freesound no acepta esa clave. Revisa que la hayas copiado entera.', 'Freesound does not accept that key. Check that you copied all of it.') : e && e.status === 429 ? t('Freesound dice que has hecho demasiadas peticiones. Espera un minuto.', 'Freesound says you made too many requests. Wait a minute.') : e && e.status ? t('Freesound ha respondido con un error (', 'Freesound answered with an error (') + e.status + ').' : t('No se pudo conectar con Freesound. Puede que tu navegador o tu red bloqueen la conexión directa, o que no tengas internet.', 'Could not connect to Freesound. Your browser or network may block the direct connection, or you may be offline.'));
  async function fsSearch(q) {
    const url = FSB() + '/search/text/?query=' + encodeURIComponent(q) + '&page_size=40&fields=' + encodeURIComponent('id,name,username,license,duration,previews,tags,url') + '&filter=' + encodeURIComponent('duration:[0 TO 30]') + '&token=' + encodeURIComponent(FSK());
    const r = await fetch(url); if (!r.ok) { const e = new Error('http'); e.status = r.status; throw e; }
    const j = await r.json(); return j.results || [];
  }
  MC.fsSearch = fsSearch;

  MC.openSoundPacks = (onDone, tab0) => {
    const st = { tab: tab0 || 'import', files: [], pack: '', lic: 'other', author: '', busy: false, fs: { q: '', res: null, allow: 'free', msg: '', busy: false, added: {} } };
    const body = h('div', { style: { display: 'grid', gap: '12px' } });
    let modal = null;
    const fileIn = h('input', { type: 'file', accept: '.zip,audio/*,.wav,.mp3,.m4a,.ogg,.aac,.flac', multiple: true, hidden: true, onChange: async (e) => { const fs = [...e.target.files]; e.target.value = ''; await pick(fs); } });
    const dirIn = h('input', { type: 'file', webkitdirectory: '', directory: '', multiple: true, hidden: true, onChange: async (e) => { const fs = [...e.target.files]; e.target.value = ''; await pick(fs); } });
    async function pick(fs) { try { const r = await entriesOf(fs); st.files = r.out; if (!st.pack) st.pack = r.pack || ''; if (!r.out.length) MC.toast(t('No hay audio en esa selección (WAV, MP3, M4A, OGG, AAC o FLAC).', 'No audio in that selection (WAV, MP3, M4A, OGG, AAC or FLAC).')); draw(); } catch (e) { MC.toast(t('No se pudo leer esa selección.', 'Could not read that selection.')); } }
    async function run() {
      if (st.busy || !st.files.length) return; st.busy = true; draw();
      const pack = safe(st.pack) || t('Mi pack', 'My pack'), total = st.files.length; let done = 0, fail = 0;
      for (const q of st.files.slice(0, 600)) {
        try {
          const segs = q.path.split('/').slice(0, -1), tags = ['pack'].concat(segs.slice(segs.length > 1 ? 1 : 0).map((x) => safe(x).toLowerCase()).filter(Boolean)).slice(0, 4);
          const a = await MC.audio.add(q.file, q.file.name.replace(/\.[a-z0-9]+$/i, ''));
          await MC.library.add(a.id, { folder: pack, tags: [...new Set(tags)], lic: st.lic, author: safe(st.author), pack });
          done++;
        } catch (e) { fail++; }
        if (done % 5 === 0) { st.msg = t('Importando… ', 'Importing… ') + done + ' / ' + total; const m = body.querySelector('[data-msg]'); if (m) m.textContent = st.msg; await new Promise((r) => setTimeout(r, 0)); }
      }
      st.busy = false; st.files = []; st.msg = '';
      MC.toast(t(done + ' sonidos añadidos a la Biblioteca (carpeta «' + pack + '»)' + (fail ? ' · ' + fail + ' no se pudieron leer' : '') + '.', done + ' sounds added to the Library (folder “' + pack + '”)' + (fail ? ' · ' + fail + ' could not be read' : '') + '.'));
      if (onDone) onDone(); draw();
    }
    const tabImport = () => [
      h('p', { class: 'cap' }, t('Descarga un pack de sonidos libres (mira «Dónde conseguirlos») y súbelo aquí como ZIP o como carpeta. Se guardan en tu Biblioteca, en una carpeta con el nombre del pack, y cada subcarpeta pasa a ser una etiqueta para buscarlos. No se sube nada a internet.', 'Download a pack of free sounds (see “Where to get them”) and add it here as a ZIP or a folder. They are saved in your Library, in a folder named after the pack, and each subfolder becomes a tag for searching. Nothing is uploaded to the internet.')),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn btn-p btn-sm', type: 'button', disabled: st.busy, onClick: () => fileIn.click() }, MC.icon('upload', 14), t('Elegir ZIP o audios', 'Choose ZIP or audio')), h('button', { class: 'btn btn-s btn-sm', type: 'button', disabled: st.busy, onClick: () => dirIn.click() }, MC.icon('folder', 14), t('Elegir una carpeta', 'Choose a folder')), fileIn, dirIn),
      st.files.length ? h('div', { class: 'field' }, h('p', { class: 'cap', role: 'status' }, st.files.length + t(' sonidos encontrados. Dime de dónde vienen para apuntarlo.', ' sounds found. Tell me where they come from so it gets noted.')),
        MC.ui.field(t('Nombre del pack', 'Pack name'), h('input', { class: 'input', id: 'pk-n', value: st.pack, onInput: (e) => { st.pack = e.target.value; } }), 'pk-n'),
        h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Licencia', 'Licence')), MC.ui.chips(LIC.map((q) => ({ v: q[0], l: t(q[1], q[2]) })), st.lic, (v) => { st.lic = v; draw(); }),
          st.lic === 'personal' ? h('p', { class: 'cap warn' }, t('Ojo: no los uses en vídeos que den dinero. El programa te lo recordará al sacar los créditos.', 'Careful: do not use them in videos that earn money. The programme will remind you when you get the credits.')) : null),
        MC.ui.field(t('Autor o fuente (opcional)', 'Author or source (optional)'), h('input', { class: 'input', id: 'pk-a', value: st.author, placeholder: t('Kenney, Sonniss, el nombre del autor…', 'Kenney, Sonniss, the author’s name…'), onInput: (e) => { st.author = e.target.value; } }), 'pk-a'),
        h('button', { class: 'btn btn-p', type: 'button', disabled: st.busy, onClick: run }, st.busy ? t('Importando…', 'Importing…') : t('Añadir ', 'Add ') + st.files.length + t(' sonidos a la Biblioteca', ' sounds to the Library')),
        h('p', { class: 'cap', 'data-msg': '1', role: 'status' }, st.msg || '')) : null,
    ];
    const tabSources = () => [
      h('p', { class: 'cap' }, t('Sitios con sonidos libres. Es un resumen orientativo: las licencias cambian, así que comprueba siempre la de lo que descargas.', 'Sites with free sounds. This is a rough summary: licences change, so always check the one of what you download.')),
      ...SOURCES.map((s) => h('div', { class: 'layer', style: { cursor: 'default', alignItems: 'start' } }, h('span', { class: 'ln', style: { whiteSpace: 'normal' } }, h('b', null, s[0]), h('span', { class: 'cap', style: { display: 'block', whiteSpace: 'normal' } }, t(s[3], s[4])), h('span', { class: 'cap', style: { display: 'block' } }, t('Licencia: ', 'Licence: ') + licName(s[2]))),
        h('a', { class: 'btn btn-s btn-sm', href: s[1], target: '_blank', rel: 'noopener noreferrer', style: { textDecoration: 'none' } }, t('Abrir', 'Open')))),
      h('p', { class: 'cap' }, t('Cuando los tengas descargados, usa «Importar un pack» para guardarlos en tu Biblioteca con su licencia.', 'Once downloaded, use “Import a pack” to save them to your Library with their licence.')),
    ];
    let prev = null; const stopPrev = () => { if (prev) { try { prev.pause(); } catch (e) { /* parado */ } prev = null; } };
    const tabFreesound = () => {
      const k = FSK(), F = st.fs;
      const steps = h('ol', { class: 'cap', style: { margin: 0, paddingLeft: '20px', display: 'grid', gap: '4px' } },
        h('li', null, t('Crea una cuenta gratuita en freesound.org (o entra si ya la tienes).', 'Create a free account at freesound.org (or sign in if you have one).')),
        h('li', null, t('Entra en freesound.org/apiv2/apply y pide una credencial: ponle un nombre (por ejemplo «MotionComic Studio») y una descripción corta. Los nombres exactos de las casillas pueden cambiar.', 'Go to freesound.org/apiv2/apply and request a credential: give it a name (for example “MotionComic Studio”) and a short description. The exact names of the fields may change.')),
        h('li', null, t('Copia la clave que te da (la llaman «Client secret» o «API key»).', 'Copy the key it gives you (they call it “Client secret” or “API key”).')),
        h('li', null, t('Pégala aquí abajo y pulsa «Guardar y probar».', 'Paste it below and press “Save and test”.')));
      const keyIn = h('input', { class: 'input', id: 'fs-k', type: 'password', autocomplete: 'off', spellcheck: 'false', value: k, placeholder: t('Pega aquí tu clave de Freesound', 'Paste your Freesound key here') });
      const status = h('p', { class: 'cap', role: 'status', 'aria-live': 'polite' }, F.msg || '');
      const saveKey = async () => { const v = keyIn.value.trim(); if (!v) { status.textContent = t('Pega primero la clave.', 'Paste the key first.'); return; } MC.store.set('fskey', v); status.textContent = t('Probando…', 'Testing…'); try { await fsSearch('click'); F.msg = t('✔ La clave funciona. Ya puedes buscar.', '✔ The key works. You can search now.'); } catch (e) { F.msg = fsErr(e); } draw(); };
      const nodes = [
        h('p', { class: 'cap' }, t('Opcional. Freesound es una biblioteca enorme de sonidos de la comunidad. Con tu propia clave gratuita puedes buscarlos, oírlos y añadirlos a tu Biblioteca sin salir del estudio. Sin clave, esta sección no hace nada.', 'Optional. Freesound is a huge library of community sounds. With your own free key you can search them, listen to them and add them to your Library without leaving the studio. Without a key, this section does nothing.')),
        h('details', { open: !k }, h('summary', null, t('Cómo conseguir tu clave (3 minutos)', 'How to get your key (3 minutes)')), steps),
        h('div', { class: 'field' }, h('label', { for: 'fs-k', class: 'cap' }, t('Tu clave de Freesound', 'Your Freesound key')), keyIn,
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' } }, h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: saveKey }, t('Guardar y probar', 'Save and test')), k ? h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => { MC.store.set('fskey', ''); F.msg = t('Clave borrada de este equipo.', 'Key removed from this device.'); F.res = null; draw(); } }, t('Borrar la clave', 'Remove the key')) : null),
          h('p', { class: 'cap' }, t('Privacidad: la clave se guarda solo en este navegador, sin cifrar. Las búsquedas y descargas van directamente a freesound.org, no pasan por ningún servidor nuestro. No la compartas, y bórrala si usas un ordenador que no es tuyo.', 'Privacy: the key is stored only in this browser, unencrypted. Searches and downloads go straight to freesound.org, not through any server of ours. Do not share it, and remove it if you use a computer that is not yours.')), status),
      ];
      if (!k) return nodes;
      const searchIn = h('input', { class: 'input', type: 'search', id: 'fs-q', value: F.q, placeholder: t('Busca en inglés para más resultados: door slam, rain, whoosh…', 'Search: door slam, rain, whoosh…'), 'aria-label': t('Buscar en Freesound', 'Search Freesound'), onKeydown: (e) => { if (e.key === 'Enter') go(); } });
      const go = async () => { F.q = searchIn.value.trim(); if (!F.q) return; F.busy = true; F.msg = t('Buscando…', 'Searching…'); F.res = null; draw(); try { F.res = await fsSearch(F.q); F.msg = F.res.length ? '' : t('Nada con ese nombre. Prueba otra palabra.', 'Nothing with that name. Try another word.'); } catch (e) { F.msg = fsErr(e); } F.busy = false; draw(); };
      nodes.push(h('div', { class: 'field' }, h('div', { style: { display: 'flex', gap: '8px' } }, searchIn, h('button', { class: 'btn btn-p btn-sm', type: 'button', disabled: F.busy, onClick: go }, t('Buscar', 'Search'))),
        h('span', { class: 'cap' }, t('Qué licencias mostrar', 'Which licences to show')), MC.ui.chips([{ v: 'cc0', l: t('Solo CC0 (sin citar)', 'CC0 only (no credit)') }, { v: 'free', l: t('CC0 y CC-BY (recomendado)', 'CC0 and CC-BY (recommended)') }, { v: 'all', l: t('Todas, con aviso', 'All, with a warning') }], F.allow, (v) => { F.allow = v; draw(); })));
      const shown = (F.res || []).filter((r) => { const l = fsLic(r.license); return F.allow === 'all' || (F.allow === 'cc0' ? l === 'cc0' : l === 'cc0' || l === 'ccby'); });
      if (F.res && F.res.length && !shown.length) nodes.push(h('p', { class: 'cap' }, t('Hay resultados, pero ninguno con las licencias elegidas. Prueba con «Todas, con aviso».', 'There are results, but none with the chosen licences. Try “All, with a warning”.')));
      shown.slice(0, 30).forEach((r) => {
        const l = fsLic(r.license), pv = r.previews && (r.previews['preview-hq-mp3'] || r.previews['preview-lq-mp3'] || r.previews['preview-hq-ogg']), done = F.added[r.id];
        nodes.push(h('div', { class: 'layer fsrow', style: { cursor: 'default' } },
          h('span', { class: 'ln', style: { whiteSpace: 'normal' } }, h('b', null, r.name), h('span', { class: 'cap', style: { display: 'block' } }, (r.username || '?') + ' · ' + (r.duration || 0).toFixed(1) + ' s · ' + licName(l)), l === 'personal' ? h('span', { class: 'cap warn', style: { display: 'block' } }, t('No comercial: no vale para vídeos que den dinero.', 'Non-commercial: not for videos that earn money.')) : null),
          h('button', { class: 'btn btn-s btn-sm', type: 'button', 'aria-label': t('Oír ', 'Play ') + r.name, disabled: !pv, onClick: () => { stopPrev(); prev = new Audio(pv); prev.play().catch(() => MC.toast(t('No se pudo reproducir la muestra.', 'Could not play the sample.'))); } }, MC.icon('play', 13)),
          h('button', { class: 'btn btn-p btn-sm', type: 'button', disabled: !pv || !!done, 'aria-label': t('Añadir ', 'Add ') + r.name, onClick: async (e) => {
            const b2 = e.currentTarget; b2.disabled = true;
            try {
              const resp = await fetch(pv); if (!resp.ok) throw new Error('descarga'); const blob = await resp.blob();
              const a = await MC.audio.add(blob, safe(r.name).replace(/\.[a-z0-9]+$/i, ''));
              await MC.library.add(a.id, { folder: 'Freesound', tags: ['freesound'].concat((r.tags || []).slice(0, 3).map((x) => safe(x).toLowerCase())), lic: l, author: safe(r.username), src: 'https://freesound.org/s/' + r.id + '/', pack: 'Freesound' });
              F.added[r.id] = true; MC.toast(t('Añadido a la Biblioteca (carpeta «Freesound»)', 'Added to the Library (folder “Freesound”)')); if (onDone) onDone(); draw();
            } catch (err) { b2.disabled = false; MC.toast(t('No se pudo descargar ese sonido (el navegador puede bloquear la descarga directa).', 'Could not download that sound (the browser may block the direct download).')); }
          } }, done ? t('Añadido', 'Added') : t('Añadir', 'Add'))));
      });
      nodes.push(h('p', { class: 'cap' }, t('Se añade la versión de vista previa (MP3), de calidad suficiente para vídeo. Los créditos se apuntan solos y salen en «Créditos del proyecto» y en la pantalla de Exportar.', 'The preview version (MP3) is added, good enough for video. Credits are noted automatically and show up in “Project credits” and on the Export screen.')));
      return nodes;
    };
    const tabCredits = () => {
      if (MC.studioApi && MC.studioApi.libReady && !st.libReady) { st.libReady = true; MC.studioApi.libReady().then(() => { if (st.tab === 'credits') draw(); }); }
      const items = MC.packCreditItems(); const warn = items.some((x) => x.lic === 'personal');
      const txt = MC.packCredits();
      return [
        h('p', { class: 'cap' }, t('Los sonidos de tu Biblioteca que usa este proyecto y que llevan autor o licencia. Los sonidos generados por el programa no necesitan créditos.', 'The sounds from your Library that this project uses and that carry an author or licence. Sounds generated by the programme need no credit.')),
        warn ? h('p', { class: 'cap warn', role: 'status' }, t('Este proyecto usa sonidos «solo de uso personal o educativo»: no los publiques en vídeos que den dinero.', 'This project uses sounds that are “personal or educational use only”: do not publish them in videos that earn money.')) : null,
        items.length ? h('textarea', { class: 'input', rows: 8, readonly: true, 'aria-label': t('Créditos', 'Credits'), value: txt }) : h('p', { class: 'cap' }, MC.studioApi ? t('Este proyecto aún no usa sonidos con autor ni licencia apuntados.', 'This project does not use sounds with a noted author or licence yet.') : t('Abre un proyecto para ver sus créditos.', 'Open a project to see its credits.')),
        items.length ? h('button', { class: 'btn btn-p btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: async () => { try { await navigator.clipboard.writeText(txt); MC.toast(t('Créditos copiados. Pégalos en la descripción del vídeo.', 'Credits copied. Paste them into the video description.')); } catch (e) { MC.toast(t('No se pudo copiar.', 'Could not copy.')); } } }, MC.icon('copy', 14), t('Copiar los créditos', 'Copy the credits')) : null,
      ];
    };
    function draw() { MC.clear(body); MC.put(body, MC.ui.seg([{ v: 'import', l: t('Importar un pack', 'Import a pack') }, { v: 'sources', l: t('Dónde conseguirlos', 'Where to get them') }, { v: 'freesound', l: 'Freesound' }, { v: 'credits', l: t('Créditos del proyecto', 'Project credits') }], st.tab, (v) => { stopPrev(); st.tab = v; draw(); }, t('Sección', 'Section')), ...({ import: tabImport, sources: tabSources, freesound: tabFreesound, credits: tabCredits }[st.tab]())); }
    draw();
    modal = MC.modal(t('Packs y sonidos libres', 'Packs and free sounds'), body, (close) => [h('button', { class: 'btn btn-p', type: 'button', onClick: () => { stopPrev(); close(); } }, t('Cerrar', 'Close'))], { wide: true });
  };

  /* créditos: sonidos de la Biblioteca usados por el proyecto abierto que llevan autor o licencia */
  MC.packCreditItems = () => {
    const api = MC.studioApi; if (!api || !api.project || !api.libItems) return [];
    const p = api.project(), used = new Set([].concat(p.clips || [], p.overlays || []).map((c) => c.assetId));
    return (api.libItems() || []).filter((x) => x.kind === 'audio' && used.has(x.id) && (x.author || (x.lic && x.lic !== 'other')));
  };
  MC.packCredits = () => MC.packCreditItems().map((x) => '«' + x.name + '»' + (x.author ? ' — ' + x.author : '') + (x.lic ? ' (' + licName(x.lic) + ')' : '') + (x.src ? ' · ' + x.src : x.pack ? ' · ' + x.pack : '')).join('\n');
  /* tarjeta para la pantalla de Exportar: los créditos de los sonidos que usa el proyecto, listos para pegar */
  MC.creditsCard = () => {
    const items = MC.packCreditItems(); if (!items.length) return null; const txt = MC.packCredits(), warn = items.some((x) => x.lic === 'personal'), need = items.some((x) => x.lic === 'ccby');
    return h('section', { class: 'box creditscard', 'aria-label': t('Créditos de sonidos', 'Sound credits') }, h('div', { class: 'eyebrow' }, t('Créditos de sonidos', 'Sound credits')),
      h('p', { class: 'cap' }, need ? t('Este proyecto usa sonidos CC-BY: hay que citar al autor. Pega esto en la descripción del vídeo.', 'This project uses CC-BY sounds: the author must be credited. Paste this into the video description.') : t('Sonidos de tu Biblioteca que usa este proyecto, por si quieres citarlos.', 'Sounds from your Library that this project uses, in case you want to credit them.')),
      warn ? h('p', { class: 'cap warn', role: 'status' }, t('Ojo: hay sonidos «solo de uso personal o educativo». No publiques este vídeo si da dinero.', 'Careful: some sounds are “personal or educational use only”. Do not publish this video if it earns money.')) : null,
      h('textarea', { class: 'input', rows: Math.min(8, items.length + 1), readonly: true, 'aria-label': t('Créditos', 'Credits'), value: txt }),
      h('button', { class: 'btn btn-s btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: async () => { try { await navigator.clipboard.writeText(txt); MC.toast(t('Créditos copiados.', 'Credits copied.')); } catch (e) { MC.toast(t('No se pudo copiar.', 'Could not copy.')); } } }, MC.icon('copy', 14), t('Copiar los créditos', 'Copy the credits')));
  };
  MC.soundLicName = licName;
})();
