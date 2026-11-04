// Servidor estático para probar la carpeta de publicación con las mismas cabeceras que .htaccess:
//   node tools/pack.js && node tools/serve.js public 8080
const http = require('http'), fs = require('fs'), path = require('path');
const dir = path.resolve(process.argv[2] || 'public'), port = +(process.argv[3] || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; font-src 'self'; connect-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(dir, p);
  if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no encontrado'); return; }
  const h = { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
  if (/(sw\.js|index\.html|manifest\.webmanifest)$/.test(f)) h['Cache-Control'] = 'no-cache';
  res.writeHead(200, h); fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log('Sirviendo ' + dir + ' en http://localhost:' + port));
