/* Conexión con IA (MCP): el estudio se conecta a un conector local que tú ejecutas, solo si lo activas. */
(function () {
  'use strict';
  const MC = window.MC, h = MC.h, t = MC.t;
  const S = { es: null, port: 0, code: '', state: 'off', all: false, log: [] };
  const LOCAL = /^(127\.0\.0\.1|localhost)$/;
  const say = (m) => { S.log.unshift(new Date().toLocaleTimeString() + ' · ' + m); S.log.length = Math.min(S.log.length, 12); };
  const base = () => 'http://127.0.0.1:' + S.port;
  const post = (path, body) => fetch(base() + path + '?code=' + encodeURIComponent(S.code), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : '' });

  function disconnect(msg) {
    if (S.es) { S.es.close(); S.es = null; }
    S.state = 'off'; S.all = false; if (msg) say(msg);
    if (S.redraw) S.redraw();
  }
  /* confirmación de cada acción que cambia algo */
  function confirmAction(title, detail) {
    if (S.all) return Promise.resolve(true);
    return new Promise((ok) => {
      let done = false; const fin = (v) => { if (!done) { done = true; ok(v); } };
      MC.modal(t('La IA pide permiso', 'The AI asks permission'), h('div', { style: { display: 'grid', gap: '10px' } }, h('p', null, title), detail ? h('p', { class: 'cap' }, detail) : null),
        (close) => [
          h('button', { class: 'btn btn-g', type: 'button', onClick: () => { fin(false); close(); } }, t('Rechazar', 'Decline')),
          h('button', { class: 'btn', type: 'button', onClick: () => { S.all = true; fin(true); close(); } }, t('Permitir todo en esta sesión', 'Allow all this session')),
          h('button', { class: 'btn btn-p', type: 'button', onClick: () => { fin(true); close(); } }, t('Permitir', 'Allow'))]);
    });
  }
  async function toFiles(list) {
    const out = [];
    for (const f of list) { const r = await fetch(f.url); if (!r.ok) throw new Error('No se pudo recibir ' + f.name); out.push(new File([await r.blob()], f.name, { type: f.mime })); }
    return out;
  }
  const HANDLERS = {
    async status() { const api = MC.studioApi; return { conectado: true, proyecto: api && api.info ? api.info() : null, pantalla: api ? 'estudio' : 'inicio' }; },
    /* el estilo de la persona: sus notas (guía de estilo en Markdown) y los ajustes guardados en «Mi estilo». Solo lectura. */
    async get_style() { const st = MC.myStyle.get(); return { guia_markdown: MC.styleGuide.full(), mi_estilo_guardado: !!st, guia_escrita: MC.styleGuide.has(), ajustes: st }; },
    async list_projects() { return (await MC.db.all('projects')).map((p) => ({ id: p.id, nombre: p.name, formato: p.ratio, planos: (p.shots || []).length })); },
    async new_project(a) {
      if (!(await confirmAction(t('Crear el proyecto «' + a.name + '» (' + a.ratio + ', ' + a.res + ')', 'Create project “' + a.name + '” (' + a.ratio + ', ' + a.res + ')')))) throw new Error('El usuario rechazó la acción.');
      const p = MC.newProject({ name: a.name, ratio: a.ratio, res: a.res, zoom: 1.5 }); p.mode = a.mode || 'free';
      const style = MC.myStyle && MC.myStyle.get(); if (style) MC.applyStyle(p, style);
      await MC.db.put('projects', p); document.querySelectorAll('.scrim').forEach((n) => n.remove());
      await MC.app.openProject(p); await waitStudio(p.id);
      return { id: p.id, nombre: p.name, mi_estilo_aplicado: !!style };
    },
    async open_project(a) {
      const all = await MC.db.all('projects'), q = String(a.project).toLowerCase();
      const p = all.find((x) => x.id === a.project) || all.find((x) => (x.name || '').toLowerCase() === q) || all.find((x) => (x.name || '').toLowerCase().includes(q));
      if (!p) throw new Error('No hay ningún proyecto llamado «' + a.project + '».');
      if (!(await confirmAction(t('Abrir el proyecto «' + p.name + '»', 'Open project “' + p.name + '”')))) throw new Error('El usuario rechazó la acción.');
      await MC.app.openProject(p); await waitStudio(p.id); return { id: p.id, nombre: p.name };
    },
    async import_assets(a) {
      const api = MC.studioApi; if (!api || !api.importFiles) throw new Error('No hay ningún proyecto abierto. Usa «nuevo_proyecto» o «abrir_proyecto».');
      const names = a.files.map((f) => f.name);
      if (!(await confirmAction(a.as === 'shots' ? t('Crear un plano por cada archivo (' + names.length + ')', 'Create one shot per file (' + names.length + ')') : t('Añadir ' + names.length + ' archivo(s) como recursos', 'Add ' + names.length + ' file(s) as assets'), names.join(', ')))) throw new Error('El usuario rechazó la acción.');
      const before = api.info(); await api.aiBegin((a.as === 'shots' ? 'Planos nuevos: ' : 'Recursos añadidos: ') + names.join(', ')); await api.importFiles(await toFiles(a.files), a.as === 'shots' ? 'shots' : 'layers');
      await new Promise((r) => setTimeout(r, 400)); await api.saveNow(); const now = api.info();
      return { importados: names, planos: now.shots, planos_antes: before.shots, nota: 'Los cambios están en una «versión IA» que el usuario debe aceptar o descartar en el estudio; su proyecto original no se ha tocado.' };
    },
  };
  async function waitStudio(id) { for (let i = 0; i < 80; i++) { const a = MC.studioApi; if (a && a.info && a.info().id === id) return; await new Promise((r) => setTimeout(r, 100)); } }

  function start(port, code, ask) {
    port = +port; if (!port || port < 1024 || port > 65535 || !/^[A-Za-z0-9]{4,16}$/.test(code || '')) { MC.toast(t('Datos de conexión no válidos.', 'Invalid connection details.')); return; }
    disconnect(); S.port = port; S.code = code; S.state = 'wait';
    const go = () => {
      const es = new EventSource(base() + '/events?code=' + encodeURIComponent(code)); S.es = es;
      es.addEventListener('hello', async () => { await post('/ready'); S.state = 'on'; say(t('Conectado', 'Connected')); MC.toast(t('IA conectada. Cada acción te pedirá permiso.', 'AI connected. Every action will ask for your permission.'), { label: t('Desconectar', 'Disconnect'), onClick: () => disconnect(t('Desconectado', 'Disconnected')), ms: 8000 }); if (S.redraw) S.redraw(); });
      es.addEventListener('cmd', async (ev) => {
        const m = JSON.parse(ev.data); say(m.name);
        try { const data = await HANDLERS[m.name](m.args || {}); await post('/result', { id: m.id, ok: true, data }); }
        catch (e) { await post('/result', { id: m.id, ok: false, error: e.message || String(e) }); }
        if (S.redraw) S.redraw();
      });
      es.onerror = () => { if (S.state === 'wait') { disconnect(t('No se pudo conectar. ¿Está el conector en marcha?', 'Could not connect. Is the connector running?')); MC.toast(t('No se pudo conectar con el conector local.', 'Could not reach the local connector.')); } else disconnect(t('Conexión cerrada', 'Connection closed')); };
    };
    if (ask === false) { go(); return; }
    MC.modal(t('Conectar una IA', 'Connect an AI'), h('div', { style: { display: 'grid', gap: '10px' } },
      h('p', null, t('Un asistente de IA que has configurado en tu ordenador quiere abrir proyectos y añadir archivos en este estudio.', 'An AI assistant you set up on your computer wants to open projects and add files in this studio.')),
      h('p', { class: 'cap' }, t('Código de emparejamiento: ', 'Pairing code: '), h('b', null, code), t(' · debe coincidir con el que muestra el conector. Cada cambio te pedirá confirmación y puedes desconectar cuando quieras.', ' · it must match the one the connector shows. Every change asks for confirmation and you can disconnect any time.'))),
      (close) => [h('button', { class: 'btn btn-g', type: 'button', onClick: () => { S.state = 'off'; close(); history.replaceState(null, '', location.pathname + location.hash); } }, t('No permitir', 'Do not allow')),
        h('button', { class: 'btn btn-p', type: 'button', onClick: () => { close(); go(); history.replaceState(null, '', location.pathname + location.hash); } }, t('Permitir', 'Allow'))]);
  }

  const CFG = (path) => JSON.stringify({ mcpServers: { motioncomic: { command: 'node', args: [path || '/ruta/a/motioncomic-mcp/server.js'] } } }, null, 2);
  function pane(el, redraw) {
    S.redraw = redraw; const pid = 'mcp-p-' + MC.uid(), cid = 'mcp-c-' + MC.uid();
    const lab = { off: t('Desconectado', 'Disconnected'), wait: t('Conectando…', 'Connecting…'), on: t('Conectado', 'Connected') }[S.state];
    MC.put(el, h('h3', null, t('Conexión con IA', 'AI connection')),
      h('p', { class: 'cap' }, t('Opcional y desactivada por defecto. Un asistente de IA (Claude Desktop, Claude Code u otro cliente MCP) puede abrir el estudio, crear un proyecto y añadir imágenes, vídeos o audio. Hablan por un conector pequeño que ejecutas tú en tu ordenador; nada sale a internet y cada cambio te pide permiso.', 'Optional and off by default. An AI assistant (Claude Desktop, Claude Code or another MCP client) can open the studio, create a project and add images, video or audio. They talk through a small connector you run on your computer; nothing goes to the internet and every change asks your permission.')),
      h('div', { class: 'field' }, h('span', { class: 'cap' }, t('Estado', 'Status')), h('p', { role: 'status' }, h('b', null, lab), S.port ? ' · 127.0.0.1:' + S.port : '')),
      h('div', { class: 'field' }, h('label', { for: pid }, t('Puerto del conector', 'Connector port')), h('input', { id: pid, class: 'input', inputmode: 'numeric', value: S.port || '47821' })),
      h('div', { class: 'field' }, h('label', { for: cid }, t('Código de emparejamiento', 'Pairing code')), h('input', { id: cid, class: 'input', autocomplete: 'off', placeholder: 'A1B2C3D4' })),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-p', type: 'button', onClick: () => start(document.getElementById(pid).value, document.getElementById(cid).value.trim(), false) }, t('Conectar', 'Connect')),
        h('button', { class: 'btn', type: 'button', disabled: S.state === 'off', onClick: () => disconnect(t('Desconectado', 'Disconnected')) }, t('Desconectar', 'Disconnect')),
        h('button', { class: 'btn', type: 'button', onClick: () => MC.download(new Blob([CFG()], { type: 'application/json' }), 'motioncomic-mcp-config.json') }, t('Descargar configuración', 'Download configuration'))),
      h('h4', null, t('Cómo se instala', 'How to set it up')),
      h('ol', { class: 'cap' }, h('li', null, t('Necesitas Node.js 18 o superior. Descarga el conector (carpeta «tools/mcp» del proyecto o del paquete de la web).', 'You need Node.js 18 or later. Get the connector (the “tools/mcp” folder of the project or web package).')),
        h('li', null, t('Añádelo a tu cliente de IA con este bloque (cambia la ruta):', 'Add it to your AI client with this block (change the path):')),
        h('li', null, t('Pide a la IA «abre MotionComic Studio y crea un proyecto…». Se abrirá esta web ya emparejada y solo tendrás que pulsar «Permitir».', 'Ask the AI “open MotionComic Studio and create a project…”. This site opens already paired and you only press “Allow”.'))),
      h('pre', { class: 'cap', tabindex: '0', style: { overflow: 'auto', padding: '8px', background: 'var(--bg2, rgba(0,0,0,.2))', borderRadius: '8px' } }, CFG()),
      S.log.length ? h('details', null, h('summary', null, t('Actividad reciente', 'Recent activity')), h('ul', { class: 'cap' }, S.log.map((l) => h('li', null, l)))) : null);
  }

  MC.mcp = { pane, start, disconnect, state: () => S.state };
  /* enlace desde el conector: ?mcp=PUERTO&code=CODIGO → pide permiso antes de conectar */
  window.addEventListener('load', () => {
    const q = new URLSearchParams(location.search), port = q.get('mcp'), code = q.get('code');
    if (port && code && LOCAL.test('127.0.0.1')) setTimeout(() => start(port, code, true), 900);
  });
})();
