/* Grupowanie przefiltrowanych wpisów do widoków „karty grup” i „plansza sali”.
 * Czyste funkcje — działa w Node (testy) i w rendererze (globalThis.PlanerViews). */
(function (root, factory) {
  const filters = (typeof module === 'object' && module.exports)
    ? require('./filters')
    : root.PlanFilters;
  const api = factory(filters);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlanerViews = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (filters) {
  'use strict';

  const DAY_ORDER = filters.DAY_ORDER;

  function addToDay(byDay, entry) {
    const day = entry.day || '';
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(entry);
  }

  function daysFromMap(byDay) {
    const rank = (day) => {
      const index = DAY_ORDER.indexOf(day);
      return index === -1 ? DAY_ORDER.length : index;
    };
    return [...byDay.entries()]
      .map(([day, entries]) => ({ day: day || '—', entries: filters.sortEntries(entries) }))
      .sort((a, b) => rank(a.day) - rank(b.day) || a.day.localeCompare(b.day, 'pl'));
  }

  function byKey(a, b) {
    return String(a.key).localeCompare(String(b.key), 'pl', { numeric: true });
  }

  // --- Scalanie zajęć w jednej porze (odpowiednik merge_slots w build_rooms.py) ---
  function shortTag(key) {
    const text = String(key || '');
    const mode = text.startsWith('SJ') ? 'S' : 'N';
    const dash = text.indexOf('-');
    let rest = dash === -1 ? text : text.slice(dash + 1);
    rest = rest.replace(/wspomaganie/g, 'wsp').replace(/kliniczna/g, 'klin')
      .replace(/spoleczna/g, 'społ').replace(/zdrowia/g, 'zdr')
      .replace(/biznesu/g, 'biz');
    return `${mode}·${rest}`;
  }

  function normTeacher(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function notesOf(entry) {
    const out = [];
    const note = String(entry.note || '');
    const event = String(entry.event || '');
    if (note.includes('niep')) out.push('nieparz.');
    else if (note.includes('parz')) out.push('parz.');
    if (event.includes('niestandardowa')) out.push('niestandardowo');
    else if (note === 'inne') out.push('inne terminy');
    return out;
  }

  function pushUnique(list, value) {
    if (value && !list.includes(value)) list.push(value);
  }

  function mergeEntries(entries) {
    const slots = new Map();
    for (const entry of entries || []) {
      const key = `${entry.day || ''}|${entry.start || ''}|${entry.end || ''}`;
      if (!slots.has(key)) slots.set(key, []);
      slots.get(key).push(entry);
    }
    return [...slots.values()].map((items) => {
      const first = items[0];
      const parity = new Set();
      for (const item of items) {
        for (const note of notesOf(item)) {
          if (note === 'parz.' || note === 'nieparz.') parity.add(note);
        }
      }
      const cancelParity = parity.size === 2; // oba tygodnie = co tydzień
      const lines = new Map();
      const groupKeys = [];
      for (const item of items) {
        const note = notesOf(item).filter((value) =>
          !(cancelParity && (value === 'parz.' || value === 'nieparz.')));
        const lineKey = JSON.stringify([normTeacher(item.teacher), String(item.type || ''), note]);
        if (!lines.has(lineKey)) {
          lines.set(lineKey, {
            teacher: String(item.teacher || ''), type: String(item.type || ''), note,
            groups: [], tags: [], courses: [], codes: [],
          });
        }
        const line = lines.get(lineKey);
        pushUnique(line.groups, String(item.group || '').trim());
        pushUnique(line.tags, shortTag(item.groupKey));
        pushUnique(line.courses, String(item.course || '').trim());
        pushUnique(line.codes, String(item.code || '').trim());
        pushUnique(groupKeys, String(item.groupKey || '').trim());
      }
      for (const line of lines.values()) {
        line.groups.sort((a, b) => a.length - b.length || a.localeCompare(b, 'pl'));
        line.tags.sort((a, b) => a.localeCompare(b, 'pl'));
      }
      return {
        merged: true,
        day: first.day || '', start: first.start || '', end: first.end || '',
        type: first.type || '', room: first.room || '', groupKeys,
        lines: [...lines.values()],
      };
    });
  }

  // --- Układ grup w stylu wydruku grup-weekend (print-additional.js) ---
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
    const [, y1, m1, d1, y2, m2, d2] = match;
    return y1 === y2 ? `${d1}.${m1}–${d2}.${m2}.${y1}` : `${d1}.${m1}.${y1}–${d2}.${m2}.${y2}`;
  }

  function groupSchedule(entries, withTags) {
    const groupNumbers = new Set((entries || [])
      .map((entry) => String(entry.group || '').trim()).filter(Boolean));
    const consolidated = new Map();
    for (const entry of entries || []) {
      const signature = JSON.stringify([
        entry.day || '', entry.start || '', entry.end || '', entry.course || '',
      ]);
      if (!consolidated.has(signature)) {
        consolidated.set(signature, {
          day: entry.day || '', start: entry.start || '', end: entry.end || '',
          course: entry.course || '', code: entry.code || '', type: entry.type || '',
          note: entry.note || '', info: entry.info || '', teachers: [], locations: new Map(),
          tags: [],
        });
      }
      const item = consolidated.get(signature);
      for (const name of String(entry.teacher || '').split(',')) pushUnique(item.teachers, name.trim());
      const room = String(entry.room || '').trim();
      if (!item.locations.has(room)) item.locations.set(room, new Set());
      if (entry.group) item.locations.get(room).add(String(entry.group).trim());
      if (withTags && entry.groupKey) pushUnique(item.tags, shortTag(entry.groupKey));
    }
    const schedule = [...consolidated.values()].map((item) => ({
      ...item,
      tags: item.tags.sort((a, b) => a.localeCompare(b, 'pl')),
      locations: [...item.locations].map(([room, groups]) => ({
        room, groups: [...groups].sort((a, b) => a.localeCompare(b, 'pl', { numeric: true })),
      })).sort((a, b) => {
        const ag = a.groups[0] || '';
        const bg = b.groups[0] || '';
        if (ag && bg) return ag.localeCompare(bg, 'pl', { numeric: true });
        if (ag) return -1;
        if (bg) return 1;
        return a.room.localeCompare(b.room, 'pl', { numeric: true });
      }),
    }));
    schedule.sort((a, b) =>
      DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) ||
      timeValue(a.start) - timeValue(b.start) ||
      timeValue(a.end) - timeValue(b.end) ||
      String(a.course || '').localeCompare(String(b.course || ''), 'pl'));

    const byDay = new Map();
    for (const item of schedule) {
      if (!byDay.has(item.day)) byDay.set(item.day, []);
      byDay.get(item.day).push(item);
    }
    const rank = (day) => {
      const index = DAY_ORDER.indexOf(day);
      return index === -1 ? DAY_ORDER.length : index;
    };
    return {
      yearGroupCount: groupNumbers.size,
      days: [...byDay.entries()]
        .map(([day, events]) => ({ day: day || '—', rows: concurrentRows(events) }))
        .sort((a, b) => rank(a.day) - rank(b.day) || a.day.localeCompare(b.day, 'pl')),
    };
  }

  function collect(entries, keyOf, labelOf, extraOf) {
    const map = new Map();
    for (const entry of entries || []) {
      const key = keyOf(entry);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: labelOf(entry, key),
          ...extraOf(entry),
          byDay: new Map(),
        });
      }
      addToDay(map.get(key).byDay, entry);
    }
    return [...map.values()].map((group) => {
      const { byDay, ...rest } = group;
      return { ...rest, days: daysFromMap(byDay) };
    });
  }

  function buildGroupCards(entries, keyOf, labelOf, withTagsOf) {
    const map = new Map();
    for (const entry of entries || []) {
      const key = keyOf(entry);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: labelOf(entry, key),
          year: entry.year || '',
          studyType: entry.studyType || '',
          source: entry.source || '',
          week: formatWeekRange(entry.groupTitle || ''),
          entries: [],
        });
      }
      map.get(key).entries.push(entry);
    }
    return [...map.values()]
      .map(({ entries: list, ...group }) => ({
        ...group, ...groupSchedule(list, withTagsOf(group.key)),
      }))
      .sort(byKey);
  }

  function yearKey(groupKey) {
    return String(groupKey || '').split('-').slice(0, 2).join('-');
  }

  // Widok: specjalności jednego rocznika łączymy w jedną kartę, żeby ten sam
  // przedmiot w tej samej porze pokazać raz (z tagami specjalności).
  function groupEntriesByGroup(entries) {
    const keysByYear = new Map();
    for (const entry of entries || []) {
      const full = String(entry.groupKey || '').trim();
      const base = yearKey(full);
      if (!base) continue;
      if (!keysByYear.has(base)) keysByYear.set(base, new Set());
      keysByYear.get(base).add(full);
    }
    const combined = new Set([...keysByYear]
      .filter(([, keys]) => keys.size > 1).map(([base]) => base));
    const isCombined = (entry) => combined.has(yearKey(entry.groupKey));

    return buildGroupCards(
      entries,
      (entry) => isCombined(entry) ? yearKey(entry.groupKey) : (entry.groupKey || ''),
      (entry, key) => isCombined(entry)
        ? (entry.year ? `${entry.year} rok` : key)
        : (entry.groupLabel || key || '—'),
      (key) => combined.has(yearKey(key)),
    );
  }

  // Eksport i wydruk: każda specjalność dostaje osobny plan.
  function groupEntriesByPlan(entries) {
    return buildGroupCards(
      entries,
      (entry) => entry.groupKey || '',
      (entry, key) => entry.groupLabel || key || '—',
      () => false,
    );
  }

  // Sala bez budynku dostaje go tylko przy jednym jednoznacznym wariancie
  // (reguła z build_rooms.py / INSTRUKCJA.md 6.1).
  function roomNames(entries) {
    const candidates = new Map();
    for (const entry of entries || []) {
      const match = /^(.+?),\s*bud\.\s*(\d+)$/.exec(String(entry.room || '').trim());
      if (!match) continue;
      const name = match[1].trim();
      if (!candidates.has(name)) candidates.set(name, new Set());
      candidates.get(name).add(match[2]);
    }
    const names = {};
    for (const [name, buds] of candidates) {
      if (buds.size === 1) names[name] = `${name}, bud. ${[...buds][0]}`;
    }
    return names;
  }

  function groupEntriesByRoom(entries) {
    const names = roomNames(entries);
    const roomOf = (entry) => {
      const room = String(entry.room || '').trim();
      return names[room] || room;
    };
    return collect(
      entries,
      roomOf,
      (entry, key) => key || 'Brak sali (—)',
      () => ({}),
    ).map((room) => ({
      ...room,
      days: room.days.map((day) => ({
        ...day,
        entries: mergeEntries(day.entries).map((block) => ({ ...block, room: room.key })),
      })),
    })).sort((a, b) => (a.key ? 0 : 1) - (b.key ? 0 : 1) || byKey(a, b));
  }

  return {
    groupEntriesByGroup, groupEntriesByPlan, groupEntriesByRoom, mergeEntries, formatWeekRange,
  };
});
