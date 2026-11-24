'use strict';

const fs = require('fs');
const path = require('path');
const { buildHtml } = require('./export-template');
const { loadPrintCss } = require('./print-css');

const MAX_WIDTH = 1047;   // A4 landscape z 10 mm marginesem, px CSS
const MAX_HEIGHT = 718;
const MIN_SCALE = 0.5;

function loadChromium(root) {
  const candidates = [
    'playwright',
    path.join(root, 'node_modules', 'playwright'),
    path.join(__dirname, '..', '..', 'node_modules', 'playwright'),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate).chromium;
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND' && !String(error.message).includes('Cannot find module')) {
        throw error;
      }
    }
  }
  throw new Error('Brak Playwright — uruchom npm install w folderze głównym projektu.');
}

function makeGroups(sections, pack, onePdf) {
  if (!onePdf) return sections.map((_section, index) => [index]);
  if (!pack) return sections.map((_section, index) => [index]);

  const groups = [];
  let current = [];
  let used = 0;
  sections.forEach((section, index) => {
    const height = Math.ceil(section.height * section.scale);
    if (current.length && used + height > MAX_HEIGHT) {
      groups.push(current);
      current = [];
      used = 0;
    }
    current.push(index);
    used += height;
  });
  if (current.length) groups.push(current);
  return groups;
}

async function applyScales(page, scales) {
  await page.evaluate((values) => {
    document.querySelectorAll('.section').forEach((section, index) => {
      const plan = section.querySelector('.screen-plan');
      const scale = values[index] || 1;
      plan.style.transformOrigin = 'top left';
      plan.style.transform = `scale(${scale})`;
      section.style.width = `${Math.ceil(plan.scrollWidth * scale)}px`;
      section.style.height = `${Math.ceil(plan.scrollHeight * scale)}px`;
      section.style.overflow = 'hidden';
    });
  }, scales);
}

async function exportPlan(root, payload) {
  const sections = payload && payload.sections;
  if (!sections || !sections.length) throw new Error('Brak zaznaczonych planów do eksportu.');

  const formats = payload.formats || ['pdf', 'png'];
  const onePdf = payload.onePdf !== false;
  const pack = Boolean(payload.pack);
  const chromium = loadChromium(root);
  const css = loadPrintCss(root);
  const html = buildHtml(payload, css);
  const dir = path.join(root, 'out', 'eksport');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const base = `plan-${payload.view || 'widok'}-${stamp}`;
  const pdfOptions = {
    format: 'A4',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
  };

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 1000 },
      deviceScaleFactor: 3,
    });
    await page.setContent(html, { waitUntil: 'load' });

    const pngs = [];
    if (formats.includes('png')) {
      const nodes = page.locator('.section');
      for (let i = 0; i < sections.length; i++) {
        const file = path.join(dir, `${base}-${String(i + 1).padStart(2, '0')}.png`);
        await nodes.nth(i).screenshot({ path: file });
        pngs.push(file);
      }
    }

    const pdfs = [];
    if (formats.includes('pdf')) {
      const measured = await page.evaluate(() =>
        [...document.querySelectorAll('.section')].map((section) => {
          const plan = section.querySelector('.screen-plan');
          return { width: plan.scrollWidth, height: plan.scrollHeight };
        }));
      const sized = measured.map((size) => ({
        ...size,
        scale: Math.max(MIN_SCALE, Math.min(1, MAX_WIDTH / size.width, MAX_HEIGHT / size.height)),
      }));
      const groups = makeGroups(sized, pack, onePdf);

      if (onePdf) {
        const groupedHtml = buildHtml({ ...payload, groups: groups.map((group) => group.map((index) => sections[index])) }, css);
        const pdfPage = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
        await pdfPage.setContent(groupedHtml, { waitUntil: 'load' });
        await applyScales(pdfPage, sized.map((item) => item.scale));
        const file = path.join(dir, `${base}.pdf`);
        await pdfPage.pdf({ ...pdfOptions, path: file });
        pdfs.push(file);
        await pdfPage.close();
      } else {
        for (const group of groups) {
          const index = group[0];
          const singleHtml = buildHtml({ ...payload, sections: [sections[index]] }, css);
          const pdfPage = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
          await pdfPage.setContent(singleHtml, { waitUntil: 'load' });
          await applyScales(pdfPage, [sized[index].scale]);
          const file = path.join(dir, `${base}-${String(index + 1).padStart(2, '0')}.pdf`);
          await pdfPage.pdf({ ...pdfOptions, path: file });
          pdfs.push(file);
          await pdfPage.close();
        }
      }
    }

    return { dir, pdfs, pngs };
  } finally {
    await browser.close();
  }
}

module.exports = { exportPlan };
