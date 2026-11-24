// Kartki A4: pomiar sekcji (measure) i zrzuty (domyślnie) -> out/a4/png/*.png
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
const out = path.join(dir, 'out', 'a4');

(async () => {
  if (!fs.existsSync(out)) {
    console.error('Brak out/a4 — najpierw uruchom: python scripts/build_sheets.py');
    process.exit(1);
  }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 3 });
  const page = await ctx.newPage();

  if (process.argv[2] === 'measure') {
    await page.goto('file:///' + path.join(out, 'measure.html').replace(/\\/g, '/'));
    const heights = await page.evaluate(() => {
      const r = {};
      document.querySelectorAll('.msec').forEach((el) => {
        r[el.dataset.key] = el.getBoundingClientRect().height;
      });
      return r;
    });
    fs.writeFileSync(path.join(out, 'heights.json'), JSON.stringify(heights, null, 1));
    console.log('zmierzono sekcji:', Object.keys(heights).length);
  } else {
    const shots = path.join(out, 'shots.json');
    if (!fs.existsSync(shots)) {
      console.error('Brak out/a4/shots.json — uruchom build_sheets.py (po measure)');
      process.exit(1);
    }
    fs.mkdirSync(path.join(out, 'png'), { recursive: true });
    const names = JSON.parse(fs.readFileSync(shots, 'utf8'));
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
    console.log(`gotowe: ${Object.keys(names).length} kartek w out/a4/png/` +
                (low ? ` (${low} z niskim zoomem)` : ''));
  }
  await browser.close();
})();
