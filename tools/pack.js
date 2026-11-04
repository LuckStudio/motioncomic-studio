// Prepara la carpeta de publicación: node tools/pack.js  ->  public/ (y public.zip si hay «zip» instalado)
// Copia solo lo necesario, calcula la versión a partir del contenido y escribe la lista de archivos del modo sin conexión.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const root = path.join(__dirname, '..'), out = path.join(root, 'public');
const include = ['index.html', 'manifest.webmanifest', '.htaccess', 'sw.js', 'src/styles.css', 'src/fonts.css', 'icons', 'src/js', 'src/vendor', 'src/fonts'];
/* Dirección pública de la web (para las imágenes al compartir): SITE_URL=https://tudominio.com node tools/pack.js, o un archivo tools/site.txt con la dirección */
let SITE = process.env.SITE_URL || '';
try { if (!SITE) SITE = fs.readFileSync(path.join(__dirname, 'site.txt'), 'utf8').trim(); } catch (e) { /* sin archivo */ }
SITE = SITE.replace(/\/+$/, '');
if (SITE && !/^https:\/\/[^\s"]+$/.test(SITE)) { console.error('SITE_URL debe empezar por https:// (recibido: ' + SITE + ')'); process.exit(1); }
fs.rmSync(out, { recursive: true, force: true });
const files = [];
const walk = (rel) => {
  const abs = path.join(root, rel);
  if (fs.statSync(abs).isDirectory()) fs.readdirSync(abs).sort().forEach((f) => walk(path.join(rel, f)));
  else files.push(rel.split(path.sep).join('/'));
};
include.forEach(walk);
const hash = crypto.createHash('sha1');
files.filter((f) => f !== 'sw.js').forEach((f) => { hash.update(f); hash.update(fs.readFileSync(path.join(root, f))); });
const version = hash.digest('hex').slice(0, 10);
const core = files.filter((f) => f !== 'sw.js' && f !== '.htaccess' && !/\.(LICENSE|txt|svg)$/i.test(f) && f !== 'icons/share.png' || f === 'icons/icon.svg');
files.forEach((f) => {
  const dst = path.join(out, f); fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (f === 'sw.js') fs.writeFileSync(dst, fs.readFileSync(path.join(root, f), 'utf8').replace("const VERSION = 'dev';", "const VERSION = '" + version + "';").replace('/*CORE*/[]', JSON.stringify(core)));
  else if (f === 'index.html' && SITE) {
    /* WhatsApp y otras redes necesitan URLs absolutas en las etiquetas de compartir */
    const abs = (v) => SITE + '/' + v.replace(/^\.\//, '');
    let h = fs.readFileSync(path.join(root, f), 'utf8');
    h = h.replace(/(<meta (?:property="og:(?:image|url)"|name="twitter:image") content=")([^"]*)(")/g, (m, a, v, c) => a + abs(v) + c)
      .replace(/(<link rel="canonical" href=")([^"]*)(")/, (m, a, v, c) => a + (SITE + '/') + c);
    fs.writeFileSync(dst, h);
  } else fs.copyFileSync(path.join(root, f), dst);
});
const size = files.reduce((a, f) => a + fs.statSync(path.join(root, f)).size, 0);
if (!SITE) console.log('Aviso: sin SITE_URL, las etiquetas de compartir quedan con rutas relativas y WhatsApp no mostrará la imagen. Usa: SITE_URL=https://tudominio.com node tools/pack.js');
console.log('public/ listo · versión ' + version + ' · ' + files.length + ' archivos · ' + (size / 1048576).toFixed(1) + ' MB');
try { fs.rmSync(path.join(root, 'public.zip'), { force: true }); cp.execSync('zip -qr ../public.zip .', { cwd: out }); console.log('public.zip creado'); } catch (e) { console.log('(sin zip: sube el contenido de public/ tal cual)'); }
