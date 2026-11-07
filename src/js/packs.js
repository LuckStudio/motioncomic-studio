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

  MC.openSoundPacks = (onDone, tab0) => {
    const st = { tab: tab0 || 'import', files: [], pack: '', lic: 'other', author: '', busy: false };
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
    const tabCredits = () => {
      const items = MC.packCreditItems(); const warn = items.some((x) => x.lic === 'personal');
      const txt = MC.packCredits();
      return [
        h('p', { class: 'cap' }, t('Los sonidos de tu Biblioteca que usa este proyecto y que llevan autor o licencia. Los sonidos generados por el programa no necesitan créditos.', 'The sounds from your Library that this project uses and that carry an author or licence. Sounds generated by the programme need no credit.')),
        warn ? h('p', { class: 'cap warn', role: 'status' }, t('Este proyecto usa sonidos «solo de uso personal o educativo»: no los publiques en vídeos que den dinero.', 'This project uses sounds that are “personal or educational use only”: do not publish them in videos that earn money.')) : null,
        items.length ? h('textarea', { class: 'input', rows: 8, readonly: true, 'aria-label': t('Créditos', 'Credits'), value: txt }) : h('p', { class: 'cap' }, MC.studioApi ? t('Este proyecto aún no usa sonidos con autor ni licencia apuntados.', 'This project does not use sounds with a noted author or licence yet.') : t('Abre un proyecto para ver sus créditos.', 'Open a project to see its credits.')),
        items.length ? h('button', { class: 'btn btn-p btn-sm', type: 'button', style: { justifySelf: 'start' }, onClick: async () => { try { await navigator.clipboard.writeText(txt); MC.toast(t('Créditos copiados. Pégalos en la descripción del vídeo.', 'Credits copied. Paste them into the video description.')); } catch (e) { MC.toast(t('No se pudo copiar.', 'Could not copy.')); } } }, MC.icon('copy', 14), t('Copiar los créditos', 'Copy the credits')) : null,
      ];
    };
    function draw() { MC.clear(body); MC.put(body, MC.ui.seg([{ v: 'import', l: t('Importar un pack', 'Import a pack') }, { v: 'sources', l: t('Dónde conseguirlos', 'Where to get them') }, { v: 'credits', l: t('Créditos del proyecto', 'Project credits') }], st.tab, (v) => { st.tab = v; draw(); }, t('Sección', 'Section')), ...({ import: tabImport, sources: tabSources, credits: tabCredits }[st.tab]())); }
    draw();
    modal = MC.modal(t('Packs y sonidos libres', 'Packs and free sounds'), body, (close) => [h('button', { class: 'btn btn-p', type: 'button', onClick: close }, t('Cerrar', 'Close'))], { wide: true });
  };

  /* créditos: sonidos de la Biblioteca usados por el proyecto abierto que llevan autor o licencia */
  MC.packCreditItems = () => {
    const api = MC.studioApi; if (!api || !api.project || !api.libItems) return [];
    const p = api.project(), used = new Set([].concat(p.clips || [], p.overlays || []).map((c) => c.assetId));
    return (api.libItems() || []).filter((x) => x.kind === 'audio' && used.has(x.id) && (x.author || (x.lic && x.lic !== 'other')));
  };
  MC.packCredits = () => MC.packCreditItems().map((x) => '«' + x.name + '»' + (x.author ? ' — ' + x.author : '') + (x.lic ? ' (' + licName(x.lic) + ')' : '') + (x.pack ? ' · ' + x.pack : '')).join('\n');
  MC.soundLicName = licName;
})();
