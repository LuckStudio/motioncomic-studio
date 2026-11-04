// Genera la imagen que se ve al compartir el enlace (WhatsApp, Telegram, X, Facebook…): node tools/share.js
// Salida: icons/share.png (1200×630). Necesita Playwright.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const root = path.join(__dirname, '..');
const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="file://${root}/src/fonts.css">
<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;background:#F3F4F6;font-family:'Bricolage Grotesque',sans-serif;color:#15171A;position:relative;overflow:hidden;display:flex;align-items:center;padding:0 90px;gap:70px}
  .dots{position:absolute;inset:0;background-image:radial-gradient(#15171A14 2px,transparent 2.5px);background-size:26px 26px;-webkit-mask-image:linear-gradient(100deg,transparent 40%,#000);mask-image:linear-gradient(100deg,transparent 40%,#000)}
  .bar{position:absolute;left:0;top:0;bottom:0;width:18px;background:#8C7CFF}
  .logo{flex:none;width:300px;height:300px;position:relative;filter:drop-shadow(0 22px 30px #15171A33)}
  .logo svg{width:100%;height:100%;display:block}
  .tx{position:relative;display:grid;gap:22px}
  .eyebrow{font-weight:700;font-size:24px;letter-spacing:.14em;text-transform:uppercase;color:#6A59E8}
  h1{font-weight:800;font-size:92px;line-height:.95;letter-spacing:-.025em}
  p{font-size:34px;line-height:1.28;font-weight:500;color:#3d4249;max-width:620px}
  .chips{display:flex;gap:12px;margin-top:6px}
  .chips span{font-weight:700;font-size:21px;padding:8px 16px;background:#15171A;color:#F3F4F6}
</style>
<div class="dots"></div><div class="bar"></div>
<div class="logo"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0F1012"/><rect x="26" y="10" width="28" height="28" rx="7" fill="none" stroke="#ECEEF0" stroke-width="4.5"/><rect x="10" y="26" width="28" height="28" rx="7" fill="#8C7CFF"/></svg></div>
<div class="tx">
  <div class="eyebrow">Estudio de vídeo-cómic</div>
  <h1>MotionComic<br>Studio</h1>
  <p>Convierte tus ilustraciones de cómic en vídeo animado. Instalable, sin cuentas y en tu navegador.</p>
  <div class="chips"><span>Parallax</span><span>Viñetas</span><span>Voz y texto</span><span>MP4</span></div>
</div>`;
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const tmp = path.join(root, 'icons', '.share.html');
  fs.writeFileSync(tmp, html);
  await p.goto('file://' + tmp, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(root, 'icons', 'share.png') });
  await b.close(); fs.rmSync(tmp, { force: true });
  console.log('icons/share.png');
})();
