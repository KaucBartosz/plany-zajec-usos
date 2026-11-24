'use strict';

const fs = require('fs');
const path = require('path');
const { parseGroupKey } = require('./filters');

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Nie mogę wczytać ${file}: ${error.message}`);
  }
}

function flatten(plan, source) {
  const entries = [];
  const groups = [];
  if (!plan) return { entries, groups };

  for (const [key, value] of Object.entries(plan)) {
    const meta = parseGroupKey(key);
    const label = value.label || meta.label;
    groups.push({ ...meta, label, title: value.title || '', rowCount: (value.rows || []).length, source });

    (value.rows || []).forEach((row, index) => {
      entries.push({
        ...row,
        id: `${source}:${key}:${index}`,
        groupKey: key,
        groupLabel: label,
        groupTitle: value.title || '',
        year: meta.year,
        studyType: meta.studyType,
        speciality: meta.speciality,
        source,
      });
    });
  }
  return { entries, groups };
}

function loadAll(rootDir) {
  const root = rootDir || path.resolve(__dirname, '..', '..', '..');
  const configFile = path.join(root, 'scripts', 'config.py');
  const configText = fs.existsSync(configFile) ? fs.readFileSync(configFile, 'utf8') : '';
  const configValue = (name) =>
    configText.match(new RegExp(`^${name}\\s*=\\s*['"]([^'"]+)['"]`, 'm'))?.[1] || '';

  const semesterPlan = readJson(path.join(root, 'plan.json'));
  const weekPlan = readJson(path.join(root, 'html', 'week', 'plan.json'));
  const weekPonPtPlan = readJson(path.join(root, 'html', 'week', 'plan-pon-pt.json'));
  const semester = flatten(semesterPlan, 'semester');
  const week = flatten(weekPlan, 'week');
  const weekPonPt = flatten(weekPonPtPlan, 'week');

  return {
    entries: [...semester.entries, ...week.entries, ...weekPonPt.entries],
    groups: [...semester.groups, ...week.groups, ...weekPonPt.groups],
    meta: {
      semesterAvailable: Boolean(semesterPlan),
      weekAvailable: Boolean(weekPlan) || Boolean(weekPonPtPlan),
      semesterCount: semester.entries.length,
      weekCount: week.entries.length + weekPonPt.entries.length,
      weekPonPtCount: weekPonPt.entries.length,
      faculty: configValue('FACULTY'),
      semester: configValue('SEMESTER'),
    },
  };
}

module.exports = { loadAll, readJson, flatten };
