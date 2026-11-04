// Genera dist/artifact.html: un solo archivo con estilos y scripts incrustados, para previsualizar sin servidor.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const fontsCss = read('src/fonts.css').replace(/url\(fonts\/([^)]+)\)/g, (m, f) => 'url(data:font/woff2;base64,' + fs.readFileSync(path.join(root, 'src/fonts', f)).toString('base64') + ')');
const vendor = ['mp4-muxer', 'ag-psd', 'pdf.min'].map((n) => read('src/vendor/' + n + '.js'));
const scripts = ['util', 'formats', 'db', 'audio', 'render', 'fx', 'psd', 'pdf', 'text', 'style', 'page', 'export', 'sample', 'keys', 'presets', 'help', 'home', 'studio', 'main'].map((n) => read('src/js/' + n + '.js')).join('\n');
const html = `<title>MotionComic Studio</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${fontsCss}
${read('src/styles.css')}
</style>
<div id="app"></div>
<script>window.MC_PREVIEW = true;</script>
<script type="text/plain" id="pdf-worker">
${read('src/vendor/pdf.worker.min.js').replace(/<\/script>/g, '<\\/script>')}
</script>
${vendor.map((v) => '<script>\n' + v.replace(/<\/script>/g, '<\\/script>') + '\n</script>').join('\n')}
<script>
${scripts.replace(/<\/script>/g, '<\\/script>')}
</script>
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/artifact.html'), html);
console.log('dist/artifact.html', (html.length / 1024).toFixed(0) + ' KB');
