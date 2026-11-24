'use strict';

/* Szablon wydruku w stylu istniejących wydruków z print-additional.js.
 * HTML -> Playwright -> PNG (3x) + PDF A4 landscape (300 dpi w oryginale). */

const DAY_ORDER = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

// Jeden blok = jedna pora w sali; linie są scalone przez views.mergeEntries.
function mergedEventHtml(entry, visible) {
  const show = (key) => visible.includes(key);
  const accent = show('type') && ['WYK', 'LAB', 'KON', 'SEM', 'PRZ'].includes(entry.type)
    ? `acc-${entry.type}` : '';
  const time = show('time')
    ? `<div class="time">${esc(entry.start || '—')}–${esc(entry.end || '—')}</div>` : '';
  const showNotes = show('note') || show('event');
  const lines = (entry.lines || []).map((line) => {
    const parts = [];
    if (show('type') && line.type) parts.push(`<b>${esc(line.type)}</b>`);
    if (show('course') && line.courses.length) parts.push(esc(line.courses.join(', ')));
    if (show('code') && line.codes.length) parts.push(esc(line.codes.join(', ')));
    if (show('group') && line.groups.length) parts.push(`gr. ${esc(line.groups.join(', '))}`);
    if (line.tags.length) parts.push(esc(line.tags.join(' · ')));
    const meta = parts.length ? `<div class="meta">${parts.join(' · ')}</div>` : '';
    const teacher = show('teacher') ? `<span class="teacher">${esc(line.teacher || '—')}</span>` : '';
    const note = showNotes && line.note.length
      ? `<span class="nt">${esc(line.note.join('; '))}</span>` : '';
    return `<div class="ln">${meta}${teacher}${note}</div>`;
  }).join('');
  return `<article class="screen-event ${accent}">${time}${lines}</article>`;
}

function eventHtml(entry, visible) {
  if (entry.merged) return mergedEventHtml(entry, visible);
  const show = (key) => visible.includes(key);
  const accent = show('type') && ['WYK', 'LAB', 'KON', 'SEM', 'PRZ'].includes(entry.type)
    ? `acc-${entry.type}` : '';
  const parts = [];
  if (show('group') && entry.group) parts.push(`gr. ${esc(entry.group)} — `);
  if (show('room')) parts.push(`<b class="room">${esc(entry.room || '—')}</b>`);
  if (show('teacher') && entry.teacher) parts.push(`<span class="teacher">${esc(entry.teacher)}</span>`);
  const meta = parts.length ? `<div class="meta">${parts.join('')}</div>` : '';

  let time = '';
  let course = '';
  if (show('time')) time = `<div class="time">${esc(entry.start || '—')}–${esc(entry.end || '—')}</div>`;
  if (show('course')) course = `<div class="course">${esc(entry.course || '—')}</div>`;
  return `<article class="screen-event ${accent}">${time}${course}${meta}</article>`;
}

// --- Widok grup: wiersze równoległe w stylu N-III.png ---
function groupExtra(event, visible) {
  const parts = [];
  if (visible.includes('code') && event.code) parts.push(esc(event.code));
  if (visible.includes('event') && event.note) parts.push(esc(event.note));
  if (visible.includes('note') && event.info) parts.push(esc(event.info));
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}

function groupAssignmentHtml(event, yearGroupCount, visible) {
  return (event.locations || []).map((location) => {
    const group = visible.includes('group') && yearGroupCount > 1 && location.groups.length
      ? `gr. ${esc(location.groups.join(', '))} — ` : '';
    return `<span class="assignment">${group}<b>${esc(location.room || '—')}</b></span>`;
  }).join('<span class="assignment-separator"> | </span>');
}

function groupTeacherHtml(event, visible, inline) {
  if (!visible.includes('teacher')) return '';
  const teachers = [...new Set((event.teachers || []).filter(Boolean))];
  if (!teachers.length) return '';
  const names = esc(teachers.join(', '));
  return inline ? `<span class="teacher"> (${names})</span>` : `<span class="teacher">${names}</span>`;
}

function groupRowHtml(row, visible, yearGroupCount) {
  const accents = ['WYK', 'LAB', 'KON', 'SEM', 'PRZ'];
  if (row.length === 1) {
    const event = row[0];
    const accent = visible.includes('type') && accents.includes(event.type) ? `acc-${event.type}` : '';
    const time = visible.includes('time')
      ? `<div class="time">${esc(event.start || '—')}–${esc(event.end || '—')}</div>` : '';
    const course = visible.includes('course')
      ? `<div class="course">${esc(event.course || '—')}</div>` : '';
    const meta = `<div class="meta">${groupAssignmentHtml(event, yearGroupCount, visible)}${
      groupTeacherHtml(event, visible)}${groupExtra(event, visible)}</div>`;
    return `<article class="screen-event ${accent}">${time}${course}${meta}</article>`;
  }
  const types = new Set(row.map((event) => event.type).filter(Boolean));
  const single = [...types][0];
  const accent = visible.includes('type') && types.size === 1 && accents.includes(single)
    ? `acc-${single}` : 'acc-MIX';
  const events = row.map((event, index) => `<span class="parallel-segment">
    ${index ? '<span class="assignment-separator">|</span>' : ''}
    <span class="parallel-item">
      ${visible.includes('time') ? `<span class="time">${esc(event.start || '—')}–${esc(event.end || '—')}</span>` : ''}
      ${visible.includes('course') ? `<span class="course">${esc(event.course || '—')}</span>` : ''}
      <span class="meta">${groupAssignmentHtml(event, yearGroupCount, visible)}${
    groupTeacherHtml(event, visible, true)}${groupExtra(event, visible)}</span>
    </span></span>`).join('');
  return `<div class="screen-event-row"><article class="screen-event parallel-event ${accent}">${events}</article></div>`;
}

function sectionHtml(section, kicker, visible, groupMode) {
  const days = [...(section.days || [])].sort((a, b) => {
    const ia = DAY_ORDER.indexOf(a.day);
    const ib = DAY_ORDER.indexOf(b.day);
    return (ia === -1 ? DAY_ORDER.length : ia) - (ib === -1 ? DAY_ORDER.length : ib);
  });
  const columns = days.map((day) => `<div class="screen-daycol">
    <div class="screen-dayhead">${esc(day.day)}</div>
    <div class="screen-daybody">${(day.events || []).map((event) => groupMode
      ? groupRowHtml(event, visible, section.yearGroupCount || 0) : eventHtml(event, visible)).join('')}</div>
  </div>`).join('');
  const fullKicker = groupMode && section.week ? `${kicker} · tydzień ${section.week}` : kicker;
  return `<section class="section"><div class="screen-plan">
    <div class="screen-kicker">${esc(fullKicker)}</div>
    <h1>${esc(section.title || 'Plan zajęć')} <span>${esc(section.subtitle || '')}</span></h1>
    <div class="screen-days">${columns}</div>
  </div></section>`;
}

function buildHtml(payload, css) {
  const kicker = payload.kicker || '';
  const visible = payload.visible || [];
  const groupMode = payload.view === 'groups';
  const body = payload.groups
    ? payload.groups.map((group) => `<div class="pdf-page">${
      group.map((section) => sectionHtml(section, kicker, visible, groupMode)).join('')}</div>`).join('')
    : (payload.sections || []).map((section) => sectionHtml(section, kicker, visible, groupMode)).join('');
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
    <style>${css || ''}</style></head><body>${body}</body></html>`;
}

module.exports = { buildHtml, sectionHtml, DAY_ORDER };
