// Genera los iconos PNG de la PWA a partir de los SVG. Necesita Playwright: node tools/icons.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'icons');
const jobs = [['icon.svg', 'icon-192.png', 192, true], ['icon.svg', 'icon-512.png', 512, true], ['icon-maskable.svg', 'icon-maskable-512.png', 512, false], ['icon-maskable.svg', 'apple-touch-icon.png', 180, false], ['icon.svg', 'favicon-32.png', 32, true]];
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  for (const [src, out, size, alpha] of jobs) {
    const svg = fs.readFileSync(path.join(dir, src), 'utf8');
    await p.setViewportSize({ width: size, height: size });
    await p.setContent('<style>html,body{margin:0;background:transparent}svg{display:block;width:' + size + 'px;height:' + size + 'px}</style>' + svg);
    await p.screenshot({ path: path.join(dir, out), omitBackground: alpha });
    console.log(out, size);
  }
  await b.close();
})();
