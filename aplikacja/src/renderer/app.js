'use strict';

const {
  DAY_ORDER, FIELD_KEYS, DEFAULT_VISIBLE,
  filterEntries, sortEntries, collectOptions, parseGroupKey,
} = window.PlanFilters;
const { groupEntriesByGroup, groupEntriesByPlan, groupEntriesByRoom } = window.PlanerViews;

const FIELD_LABELS = {
  day: 'Dzień', time: 'Godzina', course: 'Przedmiot', code: 'Kod', type: 'Typ',
  group: 'Grupa', room: 'Sala', teacher: 'Prowadzący', event: 'Częstotliwość',
  note: 'Uwagi', info: 'Info z USOS',
};

// Pola, których przełącznik realnie zmienia dany widok. Pozostałe to nagłówek
// kolumny, tytuł karty albo treść pokazywana niezależnie od flagi.
const VIEW_COLUMNS = {
  table: FIELD_KEYS,
  groups: ['time', 'course', 'teacher', 'code', 'event', 'note', 'info'],
  rooms: ['time', 'type', 'course', 'code', 'group', 'teacher', 'event', 'note'],
};

const state = {
  data: null,
  view: 'groups',
  openSections: new Set(['source', 'study']),
  closedCards: new Set(),
  exportPayload: null,
  lastFocus: null,
  criteria: {
    source: 'semester', studyType: '', teachers: [], years: [], groupKeys: [],
    groupNumbers: [], days: [], types: [], weekendOnly: false, query: '',
  },
  visible: new Set(DEFAULT_VISIBLE),
};

const SETTINGS_KEY = 'planer-ustawienia-v1';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveSettings() {
  try {
    const format = document.querySelector('input[name="export-format"]:checked');
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      view: state.view,
      criteria: state.criteria,
      visible: [...state.visible],
      openSections: [...state.openSections],
      exportFormat: format ? format.value : 'pdf',
      onePdf: $('#export-single-pdf').checked,
      pack: $('#export-pack').checked,
    }));
  } catch {
    // Brak localStorage (np. tryb prywatny) — aplikacja działa dalej bez zapisu.
  }
}

function applySettings() {
  const saved = loadSettings();
  const raw = saved.criteria && typeof saved.criteria === 'object' ? saved.criteria : {};
  const listKeys = ['teachers', 'years', 'groupKeys', 'groupNumbers', 'days', 'types'];
  for (const key of listKeys) {
    state.criteria[key] = Array.isArray(raw[key])
      ? raw[key].filter((value) => typeof value === 'string') : [];
  }
  if (raw.source === 'semester' || raw.source === 'week') state.criteria.source = raw.source;
  state.criteria.studyType = typeof raw.studyType === 'string' ? raw.studyType : '';
  state.criteria.weekendOnly = Boolean(raw.weekendOnly);
  state.criteria.query = typeof raw.query === 'string' ? raw.query : '';
  if (['table', 'groups', 'rooms'].includes(saved.view)) state.view = saved.view;
  state.visible = new Set(Array.isArray(saved.visible)
    ? saved.visible.filter((key) => FIELD_KEYS.includes(key)) : DEFAULT_VISIBLE);
  if (Array.isArray(saved.openSections)) {
    state.openSections = new Set(saved.openSections.filter((key) => typeof key === 'string'));
  }

  $('#query').value = state.criteria.query;
  $('#weekend-only').checked = state.criteria.weekendOnly;
  const viewRadio = document.querySelector(`input[name="view"][value="${state.view}"]`);
  if (viewRadio) viewRadio.checked = true;
  const format = ['pdf', 'png', 'both'].includes(saved.exportFormat) ? saved.exportFormat : 'pdf';
  const formatRadio = document.querySelector(`input[name="export-format"][value="${format}"]`);
  if (formatRadio) formatRadio.checked = true;
  $('#export-single-pdf').checked = saved.onePdf !== false;
  $('#export-pack').checked = Boolean(saved.pack);
  syncPdfOptions();
}

let searchTimer = null;

function zajeciaLabel(count) {
  if (count % 10 === 1 && count % 100 !== 11) return 'zajęcie';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'zajęcia';
  return 'zajęć';
}

function setQuery(value) {
  clearTimeout(searchTimer);
  state.criteria.query = value;
  $('#query').value = value;
}

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function fieldValue(entry, key) {
  if (key === 'time') return `${entry.start || '—'}–${entry.end || '—'}`;
  return entry[key] || '—';
}

function section(key, title, content, withBadge) {
  const open = state.openSections.has(key) ? ' open' : '';
  const count = withBadge ? state.criteria[key].length : 0;
  const badge = count ? ` <span class="badge">${count}</span>` : '';
  return `<details class="filter-group" data-section="${key}"${open}>
    <summary>${title}${badge}</summary>${content}</details>`;
}

function updateBadge(key) {
  const summary = document.querySelector(`#filtry details[data-section="${key}"] summary`);
  if (!summary) return;
  const count = state.criteria[key].length;
  let badge = summary.querySelector('.badge');
  if (!count) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'badge';
    summary.appendChild(badge);
  }
  badge.textContent = String(count);
}

function checkboxGroup(title, key, values) {
  if (!values.length) return '';
  return section(key, title, optionItems(key, values), true);
}

function groupKeyOptions(sourceEntries) {
  const options = collectOptions(sourceEntries);
  return options.groupKeys.filter((key) => {
    const info = parseGroupKey(key);
    if (state.criteria.studyType && info.studyType !== state.criteria.studyType) return false;
    if (state.criteria.years.length && !state.criteria.years.includes(info.year)) return false;
    return true;
  });
}

function optionItems(key, values) {
  return values.map((value) => {
    const checked = state.criteria[key].includes(value) ? ' checked' : '';
    return `<label class="opt"><input type="checkbox" data-filter="${key}" value="${escapeHtml(value)}"${checked}> <span>${escapeHtml(value)}</span></label>`;
  }).join('');
}

function refreshGroupKeyOptions() {
  const details = document.querySelector('#filtry details[data-section="groupKeys"]');
  if (!details) return;
  const sourceEntries = state.data.entries.filter((entry) => entry.source === state.criteria.source);
  const summary = details.querySelector('summary');
  details.innerHTML = summary.outerHTML + optionItems('groupKeys', groupKeyOptions(sourceEntries));
  updateBadge('groupKeys');
}

function renderFilters() {
  if (!state.data) return;
  const sourceEntries = state.data.entries.filter((entry) => entry.source === state.criteria.source);
  const options = collectOptions(sourceEntries);
  const keys = groupKeyOptions(sourceEntries);
  const sourceRadio = (value, label) => {
    const checked = state.criteria.source === value ? ' checked' : '';
    return `<label class="opt"><input type="radio" name="source" value="${value}"${checked}> <span>${label}</span></label>`;
  };

  $('#filtry').innerHTML = `
    <button type="button" id="wyczysc" class="clear">Wyczyść filtry</button>
    ${section('source', 'Zakres',
      sourceRadio('semester', 'cały semestr') + sourceRadio('week', 'ten tydzień'))}
    ${section('study', 'Tryb studiów', [
      ['', 'wszyscy (SJ + NJ)'],
      ['stacjonarne', 'SJ — stacjonarne'],
      ['niestacjonarne', 'NJ — niestacjonarne'],
    ].map(([value, label]) => {
      const checked = state.criteria.studyType === value ? ' checked' : '';
      return `<label class="opt"><input type="radio" name="study-type" value="${value}"${checked}> <span>${label}</span></label>`;
    }).join(''))}
    ${checkboxGroup('Prowadzący', 'teachers', options.teachers)}
    ${checkboxGroup('Rocznik', 'years', options.years)}
    ${checkboxGroup('Grupa planu', 'groupKeys', keys)}
    ${checkboxGroup('Numer grupy', 'groupNumbers', options.groupNumbers)}
    ${checkboxGroup('Dzień', 'days', options.days)}
    ${checkboxGroup('Typ zajęć', 'types', options.types)}
    ${section('visible', 'Widoczne kolumny', (VIEW_COLUMNS[state.view] || FIELD_KEYS).map((key) => {
      const checked = state.visible.has(key) ? ' checked' : '';
      return `<label class="opt"><input type="checkbox" data-visible="${key}"${checked}> <span>${FIELD_LABELS[key]}</span></label>`;
    }).join('') + '<p class="hint">Pozostałe pola są stałymi elementami tego widoku.</p>')}
  `;
}

function pruneGroupKeys() {
  if (!state.criteria.groupKeys.length) return;
  state.criteria.groupKeys = state.criteria.groupKeys.filter((key) => {
    const info = parseGroupKey(key);
    return (!state.criteria.studyType || info.studyType === state.criteria.studyType)
      && (!state.criteria.years.length || state.criteria.years.includes(info.year));
  });
  updateBadge('groupKeys');
}

function renderTable(entries) {
  const columns = FIELD_KEYS.filter((key) => state.visible.has(key));
  const byDay = new Map();
  for (const entry of entries) {
    if (!byDay.has(entry.day)) byDay.set(entry.day, []);
    byDay.get(entry.day).push(entry);
  }
  return DAY_ORDER.filter((day) => byDay.has(day)).map((day) => {
    const rows = byDay.get(day);
    const key = `table:${day}`;
    const head = columns.map((column) => `<th>${FIELD_LABELS[column]}</th>`).join('');
    const body = rows.map((entry) => `<tr>${columns.map((column) =>
      `<td class="cell-${column}">${escapeHtml(fieldValue(entry, column))}</td>`).join('')}</tr>`).join('');
    return `<details class="day" data-card="${key}"${state.closedCards.has(key) ? '' : ' open'}>
      <summary>${day} <small>${rows.length}</small></summary>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></details>`;
  }).join('');
}

function eventLine(entry, badge) {
  const pieces = [];
  const add = (key, html) => {
    if (state.visible.has(key)) pieces.push(html);
  };
  add('time', `<span class="ev-time">${escapeHtml(fieldValue(entry, 'time'))}</span>`);
  add('course', `<b class="ev-course">${escapeHtml(fieldValue(entry, 'course'))}</b>`);
  add('type', `<span class="ev-tag">${escapeHtml(fieldValue(entry, 'type'))}</span>`);
  add('group', `<span class="ev-meta">gr. ${escapeHtml(fieldValue(entry, 'group'))}</span>`);
  add('room', `<span class="ev-meta">${escapeHtml(fieldValue(entry, 'room'))}</span>`);
  add('teacher', `<span class="ev-teacher">${escapeHtml(fieldValue(entry, 'teacher'))}</span>`);
  add('code', `<span class="ev-meta">${escapeHtml(fieldValue(entry, 'code'))}</span>`);
  add('event', `<span class="ev-note">${escapeHtml(fieldValue(entry, 'event'))}</span>`);
  add('note', `<span class="ev-note">${escapeHtml(fieldValue(entry, 'note'))}</span>`);
  add('info', `<span class="ev-note">${escapeHtml(fieldValue(entry, 'info'))}</span>`);
  return `<li class="ev">${badge || ''}${pieces.join('')}</li>`;
}

// Jeden blok = jedna pora w sali. Linie szczegółów są już scalone w views.js.
function mergedEventLine(entry, badge) {
  const show = (key) => state.visible.has(key);
  const head = show('time')
    ? `<span class="ev-time">${escapeHtml(`${entry.start || '—'}–${entry.end || '—'}`)}</span>`
    : '';
  const showNotes = show('note') || show('event');
  const lines = entry.lines.map((line) => {
    const parts = [];
    if (show('type') && line.type) parts.push(`<b class="ev-tag">${escapeHtml(line.type)}</b>`);
    if (show('course') && line.courses.length) parts.push(`<b class="ev-course">${escapeHtml(line.courses.join(', '))}</b>`);
    if (show('code') && line.codes.length) parts.push(`<span class="ev-meta">${escapeHtml(line.codes.join(', '))}</span>`);
    if (show('group') && line.groups.length) parts.push(`<span class="ev-meta">gr. ${escapeHtml(line.groups.join(', '))}</span>`);
    if (line.tags.length) parts.push(`<span class="ev-meta">${escapeHtml(line.tags.join(' · '))}</span>`);
    if (show('teacher')) parts.push(`<span class="ev-teacher">${escapeHtml(line.teacher || '—')}</span>`);
    if (showNotes && line.note.length) parts.push(`<span class="ev-note">(${escapeHtml(line.note.join('; '))})</span>`);
    return `<div class="ev-merged-line">${parts.join('')}</div>`;
  }).join('');
  return `<li class="ev ev-merged">${badge || ''}${head}${lines}</li>`;
}

function renderCards(groups, badgeOf, keyPrefix) {
  return groups.map((group) => {
    const total = group.days.reduce((sum, day) => sum + day.entries.length, 0);
    const key = `${keyPrefix}:${group.key}`;
    return `<details class="view-card" data-card="${escapeHtml(key)}"${state.closedCards.has(key) ? '' : ' open'}>
      <summary>${escapeHtml(group.label)} <small>${escapeHtml(group.key)} · ${total} zajęć</small></summary>
      <div class="card-days">${group.days.map((day) => `
        <div class="card-day"><h3>${escapeHtml(day.day)}</h3>
          <ul class="ev-list">${day.entries.map((entry) =>
            (entry.merged ? mergedEventLine(entry, badgeOf && badgeOf(entry))
              : eventLine(entry, badgeOf && badgeOf(entry)))).join('')}</ul>
        </div>`).join('')}</div>
    </details>`;
  }).join('');
}

// --- Karty grup w układzie wydruku grup-weekend ---------------------------
function groupAssignmentHtml(row, yearGroupCount) {
  return row.locations.map((location) => {
    const group = yearGroupCount > 1 && location.groups.length
      ? `gr. ${escapeHtml(location.groups.join(', '))} — ` : '';
    return `<span class="g-assignment">${group}<b>${escapeHtml(location.room || '—')}</b></span>`;
  }).join('<span class="g-sep"> | </span>');
}

function groupMetaHtml(event, yearGroupCount) {
  const parts = [groupAssignmentHtml(event, yearGroupCount)];
  if (event.tags && event.tags.length) parts.push(escapeHtml(event.tags.join(' · ')));
  if (state.visible.has('code') && event.code) parts.push(escapeHtml(event.code));
  if (state.visible.has('event') && event.event) parts.push(escapeHtml(event.event));
  if (state.visible.has('note') && event.note) parts.push(escapeHtml(event.note));
  if (state.visible.has('info') && event.info) parts.push(escapeHtml(event.info));
  return parts.join(' · ');
}

function groupTeacherHtml(event, inline) {
  const names = [...new Set((event.teachers || []).filter(Boolean))];
  if (!names.length) return '';
  const html = escapeHtml(names.join(', '));
  return inline ? `<span class="g-teacher"> (${html})</span>` : `<span class="g-teacher">, ${html}</span>`;
}

function groupRowsHtml(rows, yearGroupCount) {
  const accents = ['WYK', 'LAB', 'KON', 'SEM', 'PRZ'];
  return rows.map((row) => {
    if (row.length === 1) {
      const e = row[0];
      const accent = accents.includes(e.type) ? ` acc-${e.type}` : '';
      const time = state.visible.has('time')
        ? `<div class="g-time">${escapeHtml(`${e.start || '—'}–${e.end || '—'}`)}</div>` : '';
      const course = state.visible.has('course')
        ? `<div class="g-course">${escapeHtml(e.course || '—')}</div>` : '';
      const teacher = state.visible.has('teacher') ? groupTeacherHtml(e) : '';
      return `<article class="g-event${accent}">${time}${course}<div class="g-meta">${
        groupMetaHtml(e, yearGroupCount)}${teacher}</div></article>`;
    }
    const types = new Set(row.map((e) => e.type).filter(Boolean));
    const single = [...types][0];
    const accent = types.size === 1 && accents.includes(single) ? ` acc-${single}` : ' acc-MIX';
    const segments = row.map((e, index) => {
      const time = state.visible.has('time')
        ? `<span class="g-time">${escapeHtml(`${e.start || '—'}–${e.end || '—'}`)}</span>` : '';
      const course = state.visible.has('course')
        ? `<span class="g-course">${escapeHtml(e.course || '—')}</span>` : '';
      const teacher = state.visible.has('teacher') ? groupTeacherHtml(e, true) : '';
      return `<span class="g-segment">${index ? '<span class="g-sep">|</span>' : ''}<span class="g-item">${
        time} ${course}<span class="g-meta">${groupMetaHtml(e, yearGroupCount)}${teacher}</span></span></span>`;
    }).join('');
    return `<article class="g-event g-parallel${accent}">${segments}</article>`;
  }).join('');
}

function renderGroupCards(groups) {
  const meta = state.data ? state.data.meta : {};
  return groups.map((group) => {
    const total = group.days.reduce((sum, day) => sum + day.rows.reduce((n, row) => n + row.length, 0), 0);
    const key = `group:${group.key}`;
    const title = group.key.replace(/^NJ-/, 'N-').replace(/^SJ-/, 'S-');
    const kicker = [meta.faculty, meta.semester,
      group.week ? `tydzień ${group.week}` : ''].filter(Boolean).join(' · ');
    const days = group.days.map((day) => `<div class="g-daycol">
      <div class="g-dayhead">${escapeHtml(day.day)}</div>
      <div class="g-daybody">${groupRowsHtml(day.rows, group.yearGroupCount)}</div>
    </div>`).join('');
    return `<details class="view-card group-card" data-card="${escapeHtml(key)}"${
      state.closedCards.has(key) ? '' : ' open'}>
      <summary><div class="g-kicker">${escapeHtml(kicker)}</div>
        <h1>Grupa ${escapeHtml(title)} <span>${escapeHtml(group.label)}</span></h1>
        <small>${total} ${zajeciaLabel(total)}</small></summary>
      <div class="group-plan"><div class="g-days">${days}</div></div>
    </details>`;
  }).join('');
}

function renderResults() {
  if (!state.data) return;
  const entries = sortEntries(filterEntries(state.data.entries, state.criteria));
  state.lastEntries = entries;
  let content = '';
  if (state.view === 'groups') {
    content = renderGroupCards(groupEntriesByGroup(entries));
  } else if (state.view === 'rooms') {
    content = renderCards(groupEntriesByRoom(entries),
      (entry) => `<span class="ev-plan">${escapeHtml(
        (entry.groupKeys || []).join(', ') || entry.groupKey || '—')}</span>`, 'room');
  } else {
    content = renderTable(entries);
  }
  $('#wyniki').innerHTML = `<p class="count">Znaleziono ${entries.length} ${zajeciaLabel(entries.length)}.</p>` +
    (content || '<p class="empty">Brak zajęć dla wybranych kryteriów.</p>');
}

function toggle(list, value, checked) {
  const index = list.indexOf(value);
  if (checked && index === -1) list.push(value);
  if (!checked && index !== -1) list.splice(index, 1);
}

// toggle nie bąbluje — przechwytujemy w fazie capture
document.addEventListener('toggle', (event) => {
  const target = event.target;
  if (target.tagName !== 'DETAILS') return;
  if (target.dataset.section) {
    if (target.open) state.openSections.add(target.dataset.section);
    else state.openSections.delete(target.dataset.section);
  } else if (target.dataset.card) {
    if (target.open) state.closedCards.delete(target.dataset.card);
    else state.closedCards.add(target.dataset.card);
  }
  saveSettings();
}, true);

document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.dataset.filter) {
    toggle(state.criteria[target.dataset.filter], target.value, target.checked);
    updateBadge(target.dataset.filter);
    if (target.dataset.filter === 'years') {
      pruneGroupKeys();
      refreshGroupKeyOptions();
    }
    renderResults();
  } else if (target.dataset.visible) {
    if (target.checked) state.visible.add(target.dataset.visible);
    else state.visible.delete(target.dataset.visible);
    renderResults();
  } else if (target.name === 'source') {
    const source = target.value;
    state.criteria = {
      source, studyType: '', teachers: [], years: [], groupKeys: [], groupNumbers: [],
      days: [], types: [], weekendOnly: false, query: '',
    };
    setQuery('');
    $('#weekend-only').checked = false;
    renderFilters();
    renderResults();
  } else if (target.name === 'study-type') {
    state.criteria.studyType = target.value;
    pruneGroupKeys();
    refreshGroupKeyOptions();
    renderResults();
  } else if (target.name === 'view') {
    state.view = target.value;
    renderFilters();
    renderResults();
  } else if (target.id === 'weekend-only') {
    state.criteria.weekendOnly = target.checked;
    renderResults();
  }
  saveSettings();
});

document.addEventListener('input', (event) => {
  if (event.target.id !== 'query') return;
  clearTimeout(searchTimer);
  const value = event.target.value;
  searchTimer = setTimeout(() => {
    state.criteria.query = value;
    renderResults();
    saveSettings();
  }, 150);
});

document.addEventListener('click', (event) => {
  const tabButton = event.target.closest('[data-tab]');
  if (tabButton) {
    switchTab(tabButton.dataset.tab);
    return;
  }
  if (event.target.id !== 'wyczysc') return;
  state.criteria = {
    source: state.criteria.source, studyType: '', teachers: [], years: [],
    groupKeys: [], groupNumbers: [], days: [], types: [], weekendOnly: false, query: '',
  };
  setQuery('');
  $('#weekend-only').checked = false;
  renderFilters();
  renderResults();
  saveSettings();
});

$('#odswiez').addEventListener('click', load);

async function load() {
  if (!window.planerApi) {
    $('#status').textContent = 'Uruchom aplikację przez npm start (Electron).';
    return;
  }
  try {
    state.data = await window.planerApi.loadData();
    const { semesterCount, weekCount, dataFetchedAt, buildFinishedAt } = state.data.meta;
    let statusText = `Dane: ${semesterCount} zajęć w semestrze, ${weekCount} w bieżącym tygodniu.`;
    if (dataFetchedAt) statusText += ` · pobrano ${dataFetchedAt.slice(0, 16).replace('T', ' ')}`;
    if (dataFetchedAt && (!buildFinishedAt || buildFinishedAt < dataFetchedAt)) {
      statusText += ' · wydruki nieaktualne';
    }
    $('#status').textContent = statusText;
    renderFilters();
    renderResults();
  } catch (error) {
    $('#status').textContent = `Błąd wczytania: ${error.message}`;
  }
}

applySettings();
load();

// --- Zakładka pobierania danych -------------------------------------------
let fetchRunning = false;

function switchTab(name) {
  document.querySelectorAll('.tabs button').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === name);
  });
  document.querySelectorAll('.page').forEach((page) => {
    page.classList.toggle('active', page.id === `page-${name}`);
  });
}

function appendLog(text, level) {
  const line = document.createElement('div');
  if (level === 'error') line.className = 'err';
  line.textContent = text;
  $('#fetch-log').appendChild(line);
  $('#fetch-log').scrollTop = $('#fetch-log').scrollHeight;
}

function setProgress(current, total, label) {
  if (!total) return;
  const percent = Math.round((current / total) * 100);
  const bar = $('#progress-bar');
  bar.classList.remove('indeterminate');
  bar.style.width = `${percent}%`;
  $('#progress-track').setAttribute('aria-valuenow', String(percent));
  $('#progress-label').textContent = `${label}: ${current}/${total} (${percent}%)`;
}

async function startFetchMode(start) {
  if (fetchRunning) return;
  fetchRunning = true;
  $('#start-fetch').disabled = true;
  $('#ponow-wydruki').disabled = true;
  $('#stop-fetch').disabled = false;
  $('#fetch-log').textContent = '';
  const bar = $('#progress-bar');
  bar.style.width = '';
  bar.classList.add('indeterminate');
  $('#progress-track').setAttribute('aria-valuenow', '0');
  $('#progress-label').textContent = 'Łączenie z USOS…';
  try {
    const result = await start();
    if (!result.started) {
      appendLog(result.error || 'Nie udało się rozpocząć pobierania.', 'error');
      fetchRunning = false;
      $('#start-fetch').disabled = false;
      $('#stop-fetch').disabled = true;
      $('#ponow-wydruki').disabled = false;
    }
  } catch (error) {
    appendLog(error.message, 'error');
    fetchRunning = false;
    $('#start-fetch').disabled = false;
    $('#stop-fetch').disabled = true;
    $('#ponow-wydruki').disabled = false;
  }
}

function startFetch() {
  return startFetchMode(() => window.planerApi.startFetch());
}

function startBuild() {
  return startFetchMode(() => window.planerApi.startBuild());
}

if (window.planerApi) {
  window.planerApi.onFetchPhase((payload) => {
    appendLog(`== Faza ${payload.index}/${payload.total}: ${payload.label}`);
    $('#progress-label').textContent = `Faza ${payload.index}/${payload.total}: ${payload.label}`;
  });

  window.planerApi.onFetchProgress((payload) => {
    if (payload.type === 'step') {
      appendLog(`== ${payload.label} (${payload.current}/${payload.total})`);
      $('#progress-label').textContent = payload.label;
      return;
    }
    appendLog(payload.text, payload.level);
    if (payload.progress) setProgress(payload.progress.current, payload.progress.total, 'Postęp');
  });

  window.planerApi.onFetchDone(async (result) => {
    fetchRunning = false;
    $('#start-fetch').disabled = false;
    $('#stop-fetch').disabled = true;
    const bar = $('#progress-bar');
    bar.classList.remove('indeterminate');
    if (result.cancelled) {
      bar.style.width = '0%';
      $('#progress-track').setAttribute('aria-valuenow', '0');
      $('#progress-label').textContent = 'Przerwano pobieranie.';
      appendLog(`Pobieranie przerwane: ${result.step || 'bieżący krok'}`, 'error');
    } else if (result.code === 0) {
      bar.style.width = '100%';
      $('#progress-label').textContent = result.noChanges
        ? 'Brak nowych danych.' : 'Zakończono. Dane i wydruki odświeżone.';
      $('#ponow-wydruki').disabled = false;
      await load();
    } else {
      $('#ponow-wydruki').disabled = false;
      $('#progress-label').textContent = `Zakończono z błędem (kod ${result.code}${result.step ? ', ' + result.step : ''}${result.phase ? ', faza: ' + result.phase : ''}).`;
      appendLog(`Pobieranie przerwane: ${result.step || 'nieznany krok'}`, 'error');
    }
  });
}

$('#start-fetch').addEventListener('click', startFetch);
$('#ponow-wydruki').addEventListener('click', startBuild);
$('#stop-fetch').addEventListener('click', async () => {
  try {
    await window.planerApi.cancelFetch();
  } catch (error) {
    appendLog(error.message, 'error');
  }
});

// --- Eksport do PDF/PNG ---------------------------------------------------
function filterSummary() {
  const labels = {
    teachers: 'prowadzący', years: 'rok', groupKeys: 'grupa planu',
    groupNumbers: 'nr grupy', days: 'dzień', types: 'typ',
  };
  const parts = [];
  if (state.criteria.studyType === 'stacjonarne') parts.push('SJ — stacjonarne');
  if (state.criteria.studyType === 'niestacjonarne') parts.push('NJ — niestacjonarne');
  if (state.criteria.source === 'week') parts.push('bieżący tydzień');
  if (state.criteria.weekendOnly) parts.push('tylko weekend');
  for (const [key, label] of Object.entries(labels)) {
    const values = state.criteria[key];
    if (!values.length) continue;
    parts.push(`${label}: ${values.slice(0, 3).join(', ')}${values.length > 3 ? '…' : ''}`);
  }
  if (state.criteria.query) parts.push(`szukanie: ${state.criteria.query}`);
  return parts.join(' | ') || 'wszystkie zajęcia';
}

function sectionFromEntries(title, subtitle, list) {
  const byDay = new Map();
  for (const entry of list) {
    if (!byDay.has(entry.day)) byDay.set(entry.day, []);
    byDay.get(entry.day).push(entry);
  }
  const days = [...byDay.entries()].map(([day, events]) => ({ day, events })).sort((a, b) => {
    const ia = DAY_ORDER.indexOf(a.day);
    const ib = DAY_ORDER.indexOf(b.day);
    return (ia === -1 ? DAY_ORDER.length : ia) - (ib === -1 ? DAY_ORDER.length : ib);
  });
  return { title, subtitle, days };
}

function buildExportPayload() {
  const entries = state.lastEntries || [];
  const summary = filterSummary();
  const views = window.PlanerViews;
  let sections;

  if (state.view === 'groups') {
    sections = views.groupEntriesByPlan(entries).map((group) => ({
      title: `Grupa ${group.key.replace(/^NJ-/, 'N-').replace(/^SJ-/, 'S-')}`,
      subtitle: group.label,
      week: group.week,
      yearGroupCount: group.yearGroupCount,
      days: group.days.map((day) => ({ day: day.day, events: day.rows })),
    }));
  } else if (state.view === 'rooms') {
    sections = views.groupEntriesByRoom(entries).map((room) => ({
      title: `Sala ${room.label}`,
      subtitle: `${room.days.reduce((sum, day) => sum + day.entries.length, 0)} zajęć`,
      days: room.days.map((day) => ({ day: day.day, events: day.entries })),
    }));
  } else if (entries.length <= 40) {
    sections = [sectionFromEntries('Plan zajęć', summary, entries)];
  } else {
    const byDay = new Map();
    for (const entry of entries) {
      if (!byDay.has(entry.day)) byDay.set(entry.day, []);
      byDay.get(entry.day).push(entry);
    }
    sections = [...byDay.entries()]
      .sort((a, b) => DAY_ORDER.indexOf(a[0]) - DAY_ORDER.indexOf(b[0]))
      .map(([day, list]) => sectionFromEntries(`Plan zajęć — ${day}`, summary, list));
  }

  const meta = state.data ? state.data.meta : {};
  return {
    view: state.view,
    kicker: [meta.faculty, meta.semester, summary].filter(Boolean).join(' · '),
    visible: [...state.visible],
    sections,
  };
}

function openExportModal() {
  state.exportPayload = buildExportPayload();
  const sections = state.exportPayload.sections;
  $('#eksport-status').textContent = '';
  $('#eksport-list').innerHTML = sections.map((section, index) => {
    const label = `${section.title}${section.subtitle ? ' — ' + section.subtitle : ''}`;
    const count = section.days.reduce((sum, day) => sum + day.events.length, 0);
    return `<label><input type="checkbox" data-export-index="${index}" checked>
      ${escapeHtml(label)} <small>(${count})</small></label>`;
  }).join('') || '<p class="hint">Brak zajęć do eksportu.</p>';
  state.lastFocus = document.activeElement;
  $('#eksport-modal').hidden = false;
  const first = $('#eksport-list input') || $('#eksport-potwierdz');
  first.focus();
}

function closeExportModal() {
  $('#eksport-modal').hidden = true;
  if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
}

function syncPdfOptions() {
  const format = document.querySelector('input[name="export-format"]:checked').value;
  const disabled = format === 'png';
  $('#export-single-pdf').disabled = disabled;
  $('#export-pack').disabled = disabled;
}

async function confirmExport() {
  const selected = [...document.querySelectorAll('#eksport-list input:checked')]
    .map((input) => state.exportPayload.sections[Number(input.dataset.exportIndex)]);
  if (!selected.length) {
    $('#eksport-status').textContent = 'Zaznacz co najmniej jeden plan.';
    return;
  }

  const format = document.querySelector('input[name="export-format"]:checked').value;
  const button = $('#eksport-potwierdz');
  button.disabled = true;
  $('#eksport-status').textContent = 'Eksportowanie…';
  try {
    const result = await window.planerApi.exportPlan({
      ...state.exportPayload,
      sections: selected,
      formats: format === 'both' ? ['pdf', 'png'] : [format],
      onePdf: $('#export-single-pdf').checked,
      pack: $('#export-pack').checked,
    });
    if (!result.ok) throw new Error(result.error || 'Eksport nie udał się.');
    const status = $('#eksport-status');
    status.textContent = '';
    const info = document.createElement('span');
    info.textContent = `Zapisano ${result.pdfs.length} PDF i ${result.pngs.length} PNG w ${result.dir}`;
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Otwórz folder';
    open.addEventListener('click', () => window.planerApi.openExportDir());
    status.append(info, open);
  } catch (error) {
    $('#eksport-status').textContent = `Błąd eksportu: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

$('#eksport').addEventListener('click', openExportModal);
$('#eksport-anuluj').addEventListener('click', closeExportModal);
$('#eksport-potwierdz').addEventListener('click', confirmExport);
$('#eksport-all').addEventListener('click', () => {
  document.querySelectorAll('#eksport-list input').forEach((input) => { input.checked = true; });
});
$('#eksport-none').addEventListener('click', () => {
  document.querySelectorAll('#eksport-list input').forEach((input) => { input.checked = false; });
});
document.querySelectorAll('input[name="export-format"]').forEach((input) => {
  input.addEventListener('change', () => {
    syncPdfOptions();
    saveSettings();
  });
});
['#export-single-pdf', '#export-pack'].forEach((selector) => {
  $(selector).addEventListener('change', saveSettings);
});
document.addEventListener('keydown', (event) => {
  const modal = $('#eksport-modal');
  if (modal.hidden) return;
  if (event.key === 'Escape') {
    closeExportModal();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...modal.querySelectorAll('button, input, [href]')]
    .filter((element) => !element.disabled && element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
$('#eksport-modal').addEventListener('click', (event) => {
  if (event.target.id === 'eksport-modal') closeExportModal();
});
syncPdfOptions();
