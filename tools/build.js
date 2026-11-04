// Genera dist/artifact.html: un solo archivo con estilos y scripts incrustados, para previsualizar sin servidor.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const vendor = ['mp4-muxer', 'ag-psd'].map((n) => read('src/vendor/' + n + '.js'));
const scripts = ['util', 'formats', 'db', 'audio', 'render', 'psd', 'export', 'sample', 'home', 'studio', 'main'].map((n) => read('src/js/' + n + '.js')).join('\n');
const html = `<title>MotionComic Studio</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&display=swap">
<style>
${read('src/styles.css')}
</style>
<div id="app"></div>
<script>window.MC_PREVIEW = true;</script>
${vendor.map((v) => '<script>\n' + v.replace(/<\/script>/g, '<\\/script>') + '\n</script>').join('\n')}
<script>
${scripts.replace(/<\/script>/g, '<\\/script>')}
</script>
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/artifact.html'), html);
console.log('dist/artifact.html', (html.length / 1024).toFixed(0) + ' KB');
