const fs = require('fs');
const path = require('path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Brak Playwright. Uruchom w folderze projektu: npm install');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const out = path.join(root, 'out');
const dayOrder = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
const configText = fs.readFileSync(path.join(__dirname, 'config.py'), 'utf8');
const buildingMatch = configText.match(/^BUILDING\s*=\s*['"]([^'"]+)['"]/m);
if (!buildingMatch) throw new Error('Nie można odczytać BUILDING z scripts/config.py.');
const building = buildingMatch[1];
const configValue = (name) =>
  configText.match(new RegExp(`^${name}\\s*=\\s*['"]([^'"]+)['"]`, 'm'))?.[1] || '';
const faculty = configValue('FACULTY');
const semester = configValue('SEMESTER');
const cardWidth = Number(configText.match(/^CARDW\s*=\s*(\d+)/m)?.[1] || 1400);

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function timeValue(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : Infinity;
}

function firstGroup(event) {
  return event.locations.flatMap((location) => location.groups)
    .sort((a, b) => a.localeCompare(b, 'pl', { numeric: true }))[0] || '';
}

function concurrentRows(events) {
  const rows = [];
  let current = null;
  for (const event of events) {
    const start = timeValue(event.start);
    const end = timeValue(event.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      rows.push([event]);
      current = null;
    } else if (current && start < current.end) {
      current.events.push(event);
      current.end = Math.max(current.end, end);
    } else {
      current = { events: [event], end };
      rows.push(current.events);
    }
  }
  return rows.map((row) => row.sort((a, b) => {
    const groupA = firstGroup(a);
    const groupB = firstGroup(b);
    if (groupA && groupB) return groupA.localeCompare(groupB, 'pl', { numeric: true });
    if (groupA) return -1;
    if (groupB) return 1;
    return String(a.course || '').localeCompare(String(b.course || ''), 'pl');
  }));
}

function formatWeekRange(title) {
  const match = String(title || '').match(
    /(\d{4})-(\d{2})-(\d{2})\s*-\s*(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = match;
  const start = `${startDay}.${startMonth}`;
  const end = `${endDay}.${endMonth}`;
  return startYear === endYear
    ? `${start}–${end}.${endYear}`
    : `${start}.${startYear}–${end}.${endYear}`;
}

function htmlDocument(content, groupMode = false) {
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><style>
@page { size: A4 landscape; margin: ${groupMode ? '10mm' : '0'}; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; color: #1a1d23; font-family: "Segoe UI", Arial, sans-serif; }
${groupMode ? `
.group { break-before: page; }
.group:first-child { break-before: auto; }
.screen-plan { width: ${cardWidth}px; padding: 26px 28px 20px; background: #fff; }
.screen-kicker { margin-bottom: 5px; color: #b02a37; font-size: 11.5px; font-weight: 600;
                 letter-spacing: .13em; text-transform: uppercase; }
.screen-plan h1 { margin: 0; font-size: 21px; font-weight: 700; }
.screen-plan h1 span { color: #5b6472; font-size: 13.5px; font-weight: 500; }
.screen-days { display: flex; gap: 10px; margin-top: 16px; align-items: flex-start; }
.screen-daycol { flex: 1 1 0; min-width: 0; }
.screen-dayhead { border-radius: 3px 3px 0 0; background: #23303f; color: #fff;
                  padding: 7px 2px; text-align: center; font-size: 13.5px; font-weight: 700; }
.screen-daybody { display: flex; flex-direction: column; gap: 6px; padding: 6px;
                  border: 1px solid #c8d0da; border-top: 0; border-radius: 0 0 3px 3px;
                  background: #fbfcfd; }
.screen-event-row { min-width: 0; }
.screen-event { position: relative; flex: 1 1 0; min-width: 0; padding: 5px 8px;
                border: 1.5px solid #6b7280; border-left-width: 5px;
                border-radius: 3px; background: #fffdf0; font-size: 12.5px; line-height: 1.38;
                overflow-wrap: anywhere; }
.screen-event .time { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.screen-event .course { margin-top: 1px; font-weight: 600; }
.screen-event .meta { color: #5b6472; }
.screen-event .room { color: #1a1d23; font-weight: 600; }
.screen-event .teacher { display: block; margin-top: 1px; font-size: 11.5px; color: #374151; }
.screen-event.parallel-event { line-height: 1.55; }
.screen-event.parallel-event .parallel-segment { display: inline-block; max-width: 100%; vertical-align: top; }
.screen-event.parallel-event .time,
.screen-event.parallel-event .course,
.screen-event.parallel-event .meta { display: inline; }
.screen-event.parallel-event .time { white-space: nowrap; }
.screen-event.parallel-event .course { margin: 0; }
.screen-event.parallel-event .meta { margin-left: 4px; }
.screen-event.parallel-event .teacher { display: inline; margin: 0; font-size: inherit; }
.screen-event.parallel-event .assignment-separator {
  color: #9aa3ae; padding: 0 6px; white-space: nowrap;
}
.screen-event.acc-WYK { border-color: #1d4ed8; }
.screen-event.acc-LAB { border-color: #15803d; }
.screen-event.acc-KON { border-color: #c2410c; }
.screen-event.acc-SEM { border-color: #7e22ce; }
.screen-event.acc-PRZ { border-color: #475569; }
.screen-event.acc-MIX { border-color: #64748b; }
@media print {
  .screen-plan { width: 100%; padding: 20px 22px 14px; }
  .screen-days { margin-top: 12px; }
  .screen-daybody { gap: 4px; padding: 5px; }
  .screen-event { padding: 4px 7px; font-size: 12px; line-height: 1.4; }
  .screen-event .time { font-size: 12.5px; }
  .screen-event.parallel-event { line-height: 1.4; }
  .screen-event .teacher { font-size: 11px; margin-top: 0; }
}
` : `
.room-page { width: 297mm; height: 210mm; display: flex; align-items: center; justify-content: center; break-after: page; overflow: hidden; }
.room-page:last-child { break-after: auto; }
.room-page img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; }
`}
</style></head><body>${content}</body></html>`;
}

function roomDocument() {
  const shotsPath = path.join(out, 'shots.json');
  if (!fs.existsSync(shotsPath)) {
    throw new Error('Brak out/shots.json — najpierw uruchom run-all.cmd.');
  }
  const shots = JSON.parse(fs.readFileSync(shotsPath, 'utf8'));
  const files = Object.values(shots)
    .filter((name) => name.endsWith('-pn-pt.png'))
    .sort((a, b) => a.localeCompare(b, 'pl'));
  if (!files.length) throw new Error('Brak planów sal Pn–Pt w out/shots.json.');

  const pages = files.map((name) => {
    const imagePath = path.join(out, 'png', name);
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Brak ${imagePath} — najpierw uruchom run-all.cmd.`);
    }
    const image = fs.readFileSync(imagePath).toString('base64');
    return `<section class="room-page"><img src="data:image/png;base64,${image}"></section>`;
  });
  return { html: htmlDocument(pages.join('')), count: files.length, files };
}

function groupDocument() {
  const planPath = path.join(root, 'html', 'week', 'plan.json');
  if (!fs.existsSync(planPath)) {
    throw new Error('Brak html/week/plan.json — odśwież plany skryptem run-all.cmd.');
  }
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const periods = [...new Set(Object.values(plan).map((group) => formatWeekRange(group.title)))];
  if (periods.length !== 1 || !periods[0]) {
    throw new Error('Brak jednej, spójnej daty tygodnia w planach — odśwież dane w USOS.');
  }
  const weekPeriod = periods[0];
  const groups = Object.entries(plan).map(([key, value]) => {
    const yearGroupCount = new Set((value.rows || [])
      .map((row) => String(row.group || '').trim())
      .filter(Boolean)).size;
    const rows = (value.rows || []).filter((row) =>
      ['Sobota', 'Niedziela'].includes(row.day) &&
      !(/\bjęzyk\b/i.test(String(row.course || '')) && !String(row.room || '').trim()));
    if (!rows.length) return null;
    const consolidated = new Map();
    for (const row of rows) {
      const signature = JSON.stringify([row.day, row.start, row.end, row.course]);
      if (!consolidated.has(signature)) {
        consolidated.set(signature, { ...row, locations: new Map(), teachers: new Set() });
      }
      const item = consolidated.get(signature);
      if (row.teacher) item.teachers.add(String(row.teacher).trim());
      const locations = item.locations;
      const room = String(row.room || '').trim();
      if (!locations.has(room)) locations.set(room, new Set());
      if (row.group) locations.get(room).add(String(row.group));
    }
    const schedule = [...consolidated.values()].map((row) => ({
      ...row,
      teachers: [...row.teachers],
      locations: [...row.locations].map(([room, groups]) => ({
        room,
        groups: [...groups].sort((a, b) => a.localeCompare(b, 'pl', { numeric: true })),
      })).sort((a, b) => {
        const ag = a.groups[0];
        const bg = b.groups[0];
        if (ag && bg) return ag.localeCompare(bg, 'pl', { numeric: true });
        if (ag) return -1;
        if (bg) return 1;
        return a.room.localeCompare(b.room, 'pl', { numeric: true });
      }),
    }));
    schedule.sort((a, b) =>
      dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day) ||
      timeValue(a.start) - timeValue(b.start) ||
      timeValue(a.end) - timeValue(b.end) ||
      String(a.course || '').localeCompare(String(b.course || ''), 'pl'));

    const title = key.replace(/^NJ-/, 'N-').replace(/^SJ-/, 'S-');
    const subtitle = value.label || '';
    const assignmentHtml = (row) => {
      return row.locations.map((location) => {
        const group = yearGroupCount > 1 && location.groups.length
          ? `gr. ${location.groups.join(', ')} — ` : '';
        return `<span class="assignment">${esc(group)}<b>${esc(location.room || '—')}</b></span>`;
      }).join('<span class="assignment-separator"> | </span>');
    };
    const teacherHtml = (row, inline = false) => {
      const teachers = [...new Set((row.teachers || []).filter(Boolean))];
      if (!teachers.length) return '';
      const names = esc(teachers.join(', '));
      return inline
        ? `<span class="teacher"> (${names})</span>`
        : `<span class="teacher">${names}</span>`;
    };
    const dayColumns = dayOrder
      .filter((day) => ['Sobota', 'Niedziela'].includes(day) && schedule.some((row) => row.day === day))
      .map((day) => {
        const eventRows = concurrentRows(schedule.filter((row) => row.day === day)).map((row) => {
          if (row.length === 1) {
            const event = row[0];
            const accent = ['WYK', 'LAB', 'KON', 'SEM', 'PRZ'].includes(event.type)
              ? `acc-${event.type}` : '';
            return `<article class="screen-event ${accent}">
              <div class="time">${esc(event.start || '—')}–${esc(event.end || '—')}</div>
              <div class="course">${esc(event.course || '—')}</div>
              <div class="meta">${assignmentHtml(event)}${teacherHtml(event)}</div>
            </article>`;
          }
          const types = new Set(row.map((event) => event.type).filter(Boolean));
          const accent = types.size === 1 && ['WYK', 'LAB', 'KON', 'SEM', 'PRZ'].includes([...types][0])
            ? `acc-${[...types][0]}` : 'acc-MIX';
          const events = row.map((event, index) => `<span class="parallel-segment">
            ${index ? '<span class="assignment-separator">|</span>' : ''}
            <span class="parallel-item">
              <span class="time">${esc(event.start || '—')}–${esc(event.end || '—')}</span>
              <span class="course">${esc(event.course || '—')}</span>
              <span class="meta">${assignmentHtml(event)}${teacherHtml(event, true)}</span>
            </span>
          </span>`).join('');
          return `<div class="screen-event-row"><article class="screen-event parallel-event ${accent}">
            ${events}
          </article></div>`;
        }).join('');
        return `<div class="screen-daycol"><div class="screen-dayhead">${esc(day)}</div>
          <div class="screen-daybody">${eventRows}</div></div>`;
      }).join('');
    return { key, title, html: `<section class="group" data-group-key="${esc(key)}">
      <div class="screen-plan">
        <div class="screen-kicker">${esc(faculty)} &middot; ${esc(semester)} &middot; tydzień ${esc(weekPeriod)}</div>
        <h1>Grupa ${esc(title)} <span>${esc(subtitle)}</span></h1>
        <div class="screen-days">${dayColumns}</div>
      </div>
    </section>` };
  }).filter(Boolean);

  if (!groups.length) throw new Error('Nie znaleziono grup z zajęciami w sobotę lub niedzielę.');
  return { html: htmlDocument(groups.map((group) => group.html).join(''), true), count: groups.length, groups };
}

async function main() {
  const mode = process.argv[2];
  if (!['rooms', 'groups'].includes(mode)) {
    throw new Error('Użycie: node scripts/print-additional.js rooms|groups');
  }

  const result = mode === 'rooms' ? roomDocument() : groupDocument();
  const printDir = path.join(out, 'druk', mode === 'rooms' ? 'sale-pon-pt' : 'grupy-weekend');
  const pngDir = path.join(printDir, 'png');
  fs.mkdirSync(printDir, { recursive: true });
  fs.mkdirSync(pngDir, { recursive: true });
  const output = path.join(printDir, mode === 'rooms'
    ? `sale-pon-pt-bud-${building}.pdf`
    : `grupy-weekend-bud-${building}.pdf`);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: cardWidth, height: 1000 },
      deviceScaleFactor: 3,
    });
    await page.setContent(result.html, { waitUntil: 'load' });
    if (mode === 'rooms') {
      for (const name of result.files) {
        fs.copyFileSync(path.join(out, 'png', name), path.join(pngDir, name));
      }
    } else {
      const expectedPngs = new Set(result.groups.map((group) => `${group.title}.png`));
      for (const name of fs.readdirSync(pngDir)) {
        if (/^[NS]-.+\.png$/i.test(name) && !expectedPngs.has(name)) {
          fs.unlinkSync(path.join(pngDir, name));
        }
      }
      const groups = page.locator('.group');
      for (let i = 0; i < result.groups.length; i++) {
        const title = result.groups[i].title;
        await groups.nth(i).screenshot({ path: path.join(pngDir, `${title}.png`) });
      }
    }
    await page.pdf({
      path: output,
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
  console.log(`PDF: ${output}`);
  console.log(`${mode === 'rooms' ? 'sale' : 'grupy'}: ${result.count} | PNG: ${pngDir}`);
}

main().catch((error) => {
  console.error(`[BLAD] ${error.message}`);
  process.exitCode = 1;
});
