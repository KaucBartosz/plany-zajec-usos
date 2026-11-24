// Plany pojedynczych sal: out/shot-*.html -> out/png/*.png
// deviceScaleFactor 3 = render ~3x, żeby wydruk A4 był ostry.
const path = require('path');
const fs = require('fs');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Brak Playwright. Uruchom w folderze projektu: npm install');
  console.error('Potem (raz na maszynę): npx playwright install chromium');
  process.exit(1);
}

const dir = path.join(__dirname, '..');
const out = path.join(dir, 'out');
const shots = path.join(out, 'shots.json');

if (!fs.existsSync(shots)) {
  console.error('Brak out/shots.json — najpierw uruchom: python scripts/build_rooms.py');
  process.exit(1);
}

(async () => {
  fs.mkdirSync(path.join(out, 'png'), { recursive: true });
  const names = JSON.parse(fs.readFileSync(shots, 'utf8'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  let low = 0;
  for (const [key, png] of Object.entries(names)) {
    await page.goto('file:///' + path.join(out, `shot-${key}.html`).replace(/\\/g, '/'));
    const info = await page.evaluate(() => {
      const el = document.querySelector('.card');
      return { h: el.getBoundingClientRect().height, target: +el.dataset.targetH };
    });
    const zoom = Math.min(1, info.target / info.h);
    if (zoom < 0.7) { console.log('WARN low zoom', png, zoom.toFixed(2)); low++; }
    await page.evaluate((z) => { document.body.style.zoom = z; }, zoom);
    await (await page.$('.card')).screenshot({ path: path.join(out, 'png', png) });
    console.log(png, 'zoom', zoom.toFixed(2));
  }
  await browser.close();
  console.log(`gotowe: ${Object.keys(names).length} PNG w out/png/` +
              (low ? ` (${low} z niskim zoomem)` : ''));
})();
