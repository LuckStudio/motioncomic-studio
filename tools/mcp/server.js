#!/usr/bin/env node
/* MotionComic Studio · conector MCP local (sin dependencias).
   Un asistente de IA (Claude Desktop, Claude Code u otro cliente MCP) habla con este programa por la entrada y salida estándar,
   y este programa habla con el estudio abierto en tu navegador por una conexión local (127.0.0.1) protegida por un código de emparejamiento.
   Uso: node server.js     Variables: MOTIONCOMIC_URL (dirección del estudio), MOTIONCOMIC_PORT (puerto local, por defecto 47821). */
'use strict';
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), cp = require('child_process');

const VERSION = '1.0.0';
const STUDIO_URL = (process.env.MOTIONCOMIC_URL || 'https://luckstudio.github.io/motioncomic-studio/').replace(/\/?$/, '/');
const CODE = crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.psd': 'image/vnd.adobe.photoshop', '.pdf': 'application/pdf', '.zip': 'application/zip', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg' };
const MAX_FILE = 600 * 1024 * 1024;
const log = (...a) => process.stderr.write('[motioncomic-mcp] ' + a.join(' ') + '\n');

/* ---------- puente con el navegador ---------- */
let port = 0, sse = null, connected = false, bad = 0, lockedUntil = 0, seq = 0;
const pending = new Map(), files = new Map(), waiters = [];
const allowedOrigin = (o) => { if (!o) return true; try { const u = new URL(o), s = new URL(STUDIO_URL); return u.origin === s.origin || /^(localhost|127\.0\.0\.1)$/.test(u.hostname); } catch (e) { return false; } };
const cors = (req, res) => {
  const o = req.headers.origin;
  if (o && allowedOrigin(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true'); res.setHeader('Cache-Control', 'no-store');
};
const checkCode = (url) => {
  if (Date.now() < lockedUntil) return false;
  if (url.searchParams.get('code') === CODE) { bad = 0; return true; }
  if (++bad >= 5) { lockedUntil = Date.now() + 60000; bad = 0; log('demasiados intentos: bloqueado un minuto'); }
  return false;
};
const server = http.createServer((req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.headers.origin && !allowedOrigin(req.headers.origin)) { res.writeHead(403); res.end('origen no permitido'); return; }
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/ping') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ app: 'motioncomic-mcp', v: VERSION })); return; }
  if (!checkCode(url)) { res.writeHead(401); res.end('código incorrecto'); return; }
  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive', 'Cache-Control': 'no-store' });
    if (sse) { try { sse.end(); } catch (e) { /* ya cerrada */ } }
    sse = res; connected = false; res.write('event: hello\ndata: ' + JSON.stringify({ v: VERSION }) + '\n\n');
    const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch (e) { /* cerrada */ } }, 15000);
    req.on('close', () => { clearInterval(hb); if (sse === res) { sse = null; connected = false; } });
    return;
  }
  if (url.pathname === '/ready' && req.method === 'POST') { connected = true; waiters.splice(0).forEach((w) => w()); res.writeHead(200); res.end('ok'); log('estudio conectado'); return; }
  if (url.pathname === '/result' && req.method === 'POST') {
    let b = ''; req.on('data', (d) => { b += d; if (b.length > 5e6) req.destroy(); });
    req.on('end', () => { try { const m = JSON.parse(b), p = pending.get(m.id); if (p) { pending.delete(m.id); clearTimeout(p.t); m.ok ? p.res(m.data) : p.rej(new Error(m.error || 'error en el estudio')); } res.writeHead(200); res.end('ok'); } catch (e) { res.writeHead(400); res.end('json'); } });
    return;
  }
  if (url.pathname.startsWith('/f/')) {
    const f = files.get(url.pathname.slice(3));
    if (!f) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': f.mime, 'Content-Length': f.size }); fs.createReadStream(f.path).pipe(res); return;
  }
  res.writeHead(404); res.end();
});
const listen = (p, tries) => new Promise((ok, no) => {
  const onErr = (e) => { server.removeListener('listening', onOk); if (e.code === 'EADDRINUSE' && tries > 0) listen(p + 1, tries - 1).then(ok, no); else no(e); };
  const onOk = () => { server.removeListener('error', onErr); port = p; ok(); };
  server.once('error', onErr); server.once('listening', onOk); server.listen(p, '127.0.0.1');
});
const ready = listen(+process.env.MOTIONCOMIC_PORT || 47821, 20).then(() => log('escuchando en 127.0.0.1:' + port + ' · código ' + CODE), (e) => log('no se pudo abrir el puerto local: ' + e.message));
const sendCmd = (name, args, ms) => new Promise((res, rej) => {
  if (!sse || !connected) { rej(new Error('El estudio no está conectado. Usa primero la herramienta «abrir_estudio» y pide al usuario que pulse «Permitir» en el estudio.')); return; }
  const id = ++seq, t = setTimeout(() => { pending.delete(id); rej(new Error('El estudio no respondió a tiempo (¿está esperando una confirmación del usuario?).')); }, ms || 90000);
  pending.set(id, { res, rej, t });
  sse.write('event: cmd\ndata: ' + JSON.stringify({ id, name, args }) + '\n\n');
});
const waitConnected = (ms) => new Promise((ok) => { if (connected) { ok(true); return; } const t = setTimeout(() => ok(connected), ms); waiters.push(() => { clearTimeout(t); ok(true); }); });
const openBrowser = (url) => {
  const cmd = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url.replace(/&/g, '^&')]] : ['xdg-open', [url]];
  try { const c = cp.spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true, windowsVerbatimArguments: true }); c.on('error', () => {}); c.unref(); return true; } catch (e) { return false; }
};
/* un archivo local (o una dirección web) se publica un momento en el puente para que el estudio lo descargue */
async function exposeFile(src) {
  let p = String(src);
  if (/^https?:\/\//i.test(p)) {
    const r = await fetch(p); if (!r.ok) throw new Error('No se pudo descargar ' + p + ' (' + r.status + ')');
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > MAX_FILE) throw new Error('Archivo demasiado grande: ' + p);
    const name = decodeURIComponent(new URL(p).pathname.split('/').pop() || 'archivo'), tmp = path.join(os.tmpdir(), 'mc-' + crypto.randomBytes(4).toString('hex') + '-' + name.replace(/[^\w.\-]+/g, '_'));
    fs.writeFileSync(tmp, buf); p = tmp;
  } else { p = path.resolve(p.replace(/^~(?=$|[\\/])/, os.homedir())); }
  const st = fs.statSync(p); if (!st.isFile()) throw new Error('No es un archivo: ' + src); if (st.size > MAX_FILE) throw new Error('Archivo demasiado grande (' + Math.round(st.size / 1048576) + ' MB): ' + src);
  const id = crypto.randomBytes(8).toString('hex'), name = path.basename(p), ext = path.extname(name).toLowerCase();
  files.set(id, { path: p, size: st.size, mime: MIME[ext] || 'application/octet-stream', name });
  return { url: 'http://127.0.0.1:' + port + '/f/' + id + '?code=' + CODE, name, mime: MIME[ext] || 'application/octet-stream', size: st.size };
}

/* ---------- herramientas MCP ---------- */
const FMT = ['16:9', '9:16', '1:1', '4:5', '3:4', '21:9'];
const TOOLS = [
  { name: 'abrir_estudio', description: 'Abre MotionComic Studio en una pestaña nueva del navegador y lo empareja con este asistente. El usuario debe pulsar «Permitir» en el estudio. Úsala primero.', inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => { await ready; const url = STUDIO_URL + '?mcp=' + port + '&code=' + CODE; if (connected) return 'El estudio ya estaba conectado.'; const opened = openBrowser(url); const ok = await waitConnected(60000);
      return ok ? 'Estudio abierto y conectado.' : (opened ? 'He abierto el estudio en el navegador, pero el usuario aún no ha pulsado «Permitir». Pídeselo y vuelve a llamar a «estado».' : 'No pude abrir el navegador. Pide al usuario que abra esta dirección: ' + url); } },
  { name: 'estado', description: 'Dice si el estudio está conectado y qué proyecto tiene abierto.', inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => { if (!connected) return 'No conectado. Usa «abrir_estudio».'; return JSON.stringify(await sendCmd('status', {}), null, 1); } },
  { name: 'leer_estilo', description: 'Devuelve el estilo de la persona: su guía de estilo escrita (cuándo usa cada transición, ritmo, lo que nunca hace…) y los ajustes guardados en «Mi estilo». Léelo antes de crear o montar un proyecto y respétalo. Solo lectura.', inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => { const r = await sendCmd('get_style', {}); return r.guia_markdown + '\n\n' + JSON.stringify({ mi_estilo_guardado: r.mi_estilo_guardado, guia_escrita: r.guia_escrita, ajustes: r.ajustes }, null, 1); } },
  { name: 'listar_proyectos', description: 'Lista los proyectos guardados en el estudio del usuario (nombre, formato, tipo de línea de tiempo y planos o pistas y clips).', inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => JSON.stringify(await sendCmd('list_projects', {}), null, 1) },
  { name: 'nuevo_proyecto', description: 'Crea un proyecto nuevo en el estudio y lo abre. El usuario tendrá que confirmarlo en el estudio.', inputSchema: { type: 'object', properties: { nombre: { type: 'string', description: 'Nombre del proyecto' }, linea_de_tiempo: { type: 'string', enum: ['planos', 'pistas'], description: 'Tipo de línea de tiempo (solo en modo libre): «planos» (por defecto, planos seguidos con sus capas) o «pistas» (como Premiere o CapCut: imágenes, vídeos, texto y capas agrupadas mezclados en pistas V1, V2, V3…). No se puede cambiar después.' }, formato: { type: 'string', enum: FMT, description: 'Proporción del vídeo (por defecto 9:16)' }, resolucion: { type: 'string', enum: ['720p', '1080p', '1440p', '2160p'], description: 'Por defecto 1080p' }, modo: { type: 'string', enum: ['libre', 'pagina', 'webtoon'], description: 'Libre (por capas), Página (viñetas) o Tira vertical' } }, required: ['nombre'], additionalProperties: false },
    run: async (a) => JSON.stringify(await sendCmd('new_project', { name: a.nombre, ratio: a.formato || '9:16', res: a.resolucion || '1080p', tl: a.linea_de_tiempo === 'pistas' ? 'free' : 'classic', mode: { libre: 'free', pagina: 'page', webtoon: 'webtoon' }[a.modo || 'libre'] || 'free' }), null, 1) },
  { name: 'abrir_proyecto', description: 'Abre un proyecto ya guardado, por nombre o identificador.', inputSchema: { type: 'object', properties: { proyecto: { type: 'string', description: 'Nombre o id' } }, required: ['proyecto'], additionalProperties: false },
    run: async (a) => JSON.stringify(await sendCmd('open_project', { project: a.proyecto }), null, 1) },
  { name: 'anadir_recursos', description: 'Añade imágenes, vídeos, PSD, PDF o audio al proyecto abierto como recursos del estudio (en un proyecto por pistas, las imágenes y vídeos caen como clips en la pista elegida, en la posición del cabezal). Acepta rutas de archivos de este ordenador o direcciones web. El usuario tendrá que confirmarlo.', inputSchema: { type: 'object', properties: { archivos: { type: 'array', items: { type: 'string' }, description: 'Rutas locales o direcciones https' } }, required: ['archivos'], additionalProperties: false },
    run: async (a) => { const fs2 = []; for (const f of a.archivos || []) fs2.push(await exposeFile(f)); return JSON.stringify(await sendCmd('import_assets', { files: fs2, as: 'layers' }, 180000), null, 1); } },
  { name: 'crear_planos', description: 'Crea un plano nuevo por cada imagen (o página/PDF) en el proyecto abierto, como «Planos desde imágenes». Solo para proyectos por planos: en uno por pistas añade las imágenes como clips (usa anadir_recursos). El usuario tendrá que confirmarlo.', inputSchema: { type: 'object', properties: { archivos: { type: 'array', items: { type: 'string' }, description: 'Rutas locales o direcciones https' } }, required: ['archivos'], additionalProperties: false },
    run: async (a) => { const fs2 = []; for (const f of a.archivos || []) fs2.push(await exposeFile(f)); return JSON.stringify(await sendCmd('import_assets', { files: fs2, as: 'shots' }, 180000), null, 1); } },
];
TOOLS.forEach((t) => { t.mcpName = t.name; });

/* ---------- MCP por stdio (JSON-RPC 2.0, un mensaje por línea) ---------- */
const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });
async function handle(m) {
  const { id, method, params } = m;
  try {
    if (method === 'initialize') return reply(id, { protocolVersion: (params && params.protocolVersion) || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'motioncomic-studio', version: VERSION }, instructions: 'Controla MotionComic Studio, un estudio de vídeo-cómic en el navegador del usuario. Llama primero a «abrir_estudio». Antes de crear o montar nada, lee el estilo de la persona con «leer_estilo» y respétalo (los proyectos nuevos ya aplican su «Mi estilo»). Cada acción que cambia algo pide confirmación al usuario en el estudio.' });
    if (method === 'ping') return reply(id, {});
    if (method === 'tools/list') return reply(id, { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
    if (method === 'tools/call') {
      const t = TOOLS.find((x) => x.name === params.name); if (!t) return fail(id, -32602, 'Herramienta desconocida: ' + params.name);
      try { const out = await t.run(params.arguments || {}); return reply(id, { content: [{ type: 'text', text: String(out) }] }); }
      catch (e) { return reply(id, { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true }); }
    }
    if (id !== undefined && id !== null) return fail(id, -32601, 'Método no soportado: ' + method);
  } catch (e) { if (id != null) fail(id, -32603, e.message); }
}
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue; try { handle(JSON.parse(line)); } catch (e) { log('mensaje no válido: ' + e.message); } } });
process.stdin.on('end', () => process.exit(0));
if (process.argv.includes('--help')) { console.log('MotionComic Studio · conector MCP ' + VERSION + '\nNo se usa a mano: añádelo a tu cliente MCP con el comando «node ruta/server.js».'); process.exit(0); }
