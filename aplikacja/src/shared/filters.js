/* Czyste funkcje filtrowania. Działa w Node (module.exports) i w przeglądarce
 * (globalThis.PlanFilters) — bez zależności zewnętrznych. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlanFilters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DAY_ORDER = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
  const WEEKEND = ['Sobota', 'Niedziela'];
  const FIELD_KEYS = ['day', 'time', 'course', 'code', 'type', 'group', 'room', 'teacher', 'event', 'note', 'info'];
  const DEFAULT_VISIBLE = ['day', 'time', 'course', 'type', 'group', 'room', 'teacher'];

  function parseGroupKey(key) {
    const text = String(key || '');
    const match = /^(SJ|NJ)-([IVX]+)(?:-(.+))?$/.exec(text);
    if (!match) {
      return { key: text, studyType: '', year: '', speciality: '', label: text };
    }
    const year = match[2];
    const speciality = match[3] || '';
    return {
      key: text,
      studyType: match[1] === 'SJ' ? 'stacjonarne' : 'niestacjonarne',
      year,
      speciality,
      label: `${year} rok${speciality ? ' - ' + speciality : ''}`,
    };
  }

  function asSet(value) {
    if (value == null) return new Set();
    const list = Array.isArray(value) ? value : [value];
    return new Set(list.map((v) => String(v).trim()).filter(Boolean));
  }

  function norm(value) {
    return String(value == null ? '' : value).trim().toLocaleLowerCase('pl');
  }

  function teacherMatches(entry, selected) {
    if (!selected.size) return true;
    const names = String(entry.teacher || '').split(',').map(norm).filter(Boolean);
    return [...selected].some((name) => names.includes(norm(name)));
  }

  function timeValue(value) {
    const [hours, minutes] = String(value || '').split(':').map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : Infinity;
  }

  function filterEntries(entries, criteria) {
    const c = criteria || {};
    const teachers = asSet(c.teachers);
    const years = asSet(c.years);
    const groupKeys = asSet(c.groupKeys);
    const groupNumbers = asSet(c.groupNumbers);
    const days = asSet(c.days);
    const types = asSet(c.types);
    const studyType = String(c.studyType || '');
    const query = norm(c.query);
    const source = c.source === 'week' ? 'week' : 'semester';
    const weekendOnly = Boolean(c.weekendOnly);

    return (entries || []).filter((entry) => {
      if (entry.source !== source) return false;
      if (weekendOnly && !WEEKEND.includes(entry.day)) return false;
      if (years.size && !years.has(String(entry.year || ''))) return false;
      if (groupKeys.size && !groupKeys.has(String(entry.groupKey || ''))) return false;
      if (groupNumbers.size && !groupNumbers.has(String(entry.group || '').trim())) return false;
      if (days.size && !days.has(String(entry.day || ''))) return false;
      if (types.size && !types.has(String(entry.type || '').trim())) return false;
      if (studyType && entry.studyType !== studyType) return false;
      if (!teacherMatches(entry, teachers)) return false;
      if (query) {
        const haystack = norm([entry.course, entry.teacher, entry.room, entry.code, entry.note].join(' '));
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  function sortEntries(entries) {
    return [...(entries || [])].sort((a, b) =>
      DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) ||
      timeValue(a.start) - timeValue(b.start) ||
      timeValue(a.end) - timeValue(b.end) ||
      String(a.course || '').localeCompare(String(b.course || ''), 'pl'));
  }

  function uniqueSorted(values) {
    return [...new Set((values || []).map((v) => String(v).trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pl', { numeric: true }));
  }

  function collectOptions(entries) {
    const list = entries || [];
    const teachers = [];
    for (const entry of list) {
      for (const name of String(entry.teacher || '').split(',')) {
        if (name.trim()) teachers.push(name.trim());
      }
    }
    return {
      teachers: uniqueSorted(teachers),
      years: uniqueSorted(list.map((entry) => entry.year)),
      groupKeys: uniqueSorted(list.map((entry) => entry.groupKey)),
      groupNumbers: uniqueSorted(list.map((entry) => entry.group)),
      days: uniqueSorted(list.map((entry) => entry.day))
        .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)),
      types: uniqueSorted(list.map((entry) => entry.type)),
      studyTypes: uniqueSorted(list.map((entry) => entry.studyType)),
    };
  }

  return {
    DAY_ORDER,
    WEEKEND,
    FIELD_KEYS,
    DEFAULT_VISIBLE,
    parseGroupKey,
    filterEntries,
    sortEntries,
    collectOptions,
  };
});
