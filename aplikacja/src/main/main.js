'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { loadAll } = require('../shared/data');
const { exportPlan } = require('./export');

// aplikacja/src/main -> trzy poziomy w górę = folder główny projektu (plan.json)
const DATA_ROOT = path.resolve(__dirname, '..', '..', '..');
const RUNTIME = path.join(DATA_ROOT, 'runtime');

function bundled(exe) {
  const file = exe === 'node' ? 'node.exe' : 'python.exe';
  const candidate = path.join(RUNTIME, exe, file);
  return fs.existsSync(candidate) ? candidate : exe;
}

function childEnv() {
  const env = { ...process.env, PYTHONUNBUFFERED: '1' };
  const browsers = path.join(RUNTIME, 'playwright-browsers');
  if (fs.existsSync(browsers)) env.PLAYWRIGHT_BROWSERS_PATH = browsers;
  const node = bundled('node');
  if (node !== 'node') env.PLANER_NODE = node;
  return env;
}

const PIPELINE = JSON.parse(fs.readFileSync(
  path.join(DATA_ROOT, 'scripts', 'pipeline.json'), 'utf8'));
const CHANGES_FILE = path.join(DATA_ROOT, 'html', 'week', 'changes.json');
const STATUS_FILE = path.join(DATA_ROOT, 'out', 'stan.json');

let fetchProcess = null;
let fetchCancelled = false;
let activePhases = [];
let phaseIndex = 0;
let completedSteps = 0;
let totalSteps = 0;

function sendLine(sender, text, label) {
  const progress = text.match(/\[(?:tydz\.\s*)?(\d+)\s*\/\s*(\d+)\]/);
  sender.send('fetch:progress', {
    type: 'log',
    text,
    label,
    progress: progress ? { current: Number(progress[1]), total: Number(progress[2]) } : null,
  });
}

function fetchChanges() {
  try {
    const report = JSON.parse(fs.readFileSync(CHANGES_FILE, 'utf8'));
    return [...new Set([
      ...(report.semester || []),
      ...(report.changed || []).map((item) => item.key || item),
    ])].filter(Boolean);
  } catch {
    return [];
  }
}

function writeStatus(patch) {
  let status = {};
  try {
    status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch {
    status = {};
  }
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...status, ...patch }, null, 1), 'utf8');
}

function finish(sender, code, extra) {
  fetchProcess = null;
  sender.send('fetch:done', { code, ...(extra || {}) });
}

function phaseFinished(sender, code) {
  const phase = activePhases[phaseIndex];
  if (code !== 0) {
    finish(sender, code, { phase: phase.id });
    return;
  }
  if (phase.id === 'data') {
    const changes = fetchChanges();
    writeStatus({ dataFetchedAt: new Date().toISOString(), changes });
    if (!changes.length) {
      sender.send('fetch:progress', {
        type: 'log', text: 'Brak nowych danych — wydruki nie zostały przebudowane.',
        label: phase.label,
      });
      finish(sender, 0, { noChanges: true });
      return;
    }
  } else if (phase.id === 'build') {
    writeStatus({ buildFinishedAt: new Date().toISOString() });
  }
  if (phaseIndex + 1 < activePhases.length) {
    phaseIndex++;
    const next = activePhases[phaseIndex];
    sender.send('fetch:phase', {
      phase: next.id, label: next.label, index: phaseIndex + 1, total: activePhases.length,
    });
    runStep(sender, next, 0);
    return;
  }
  finish(sender, 0);
}

function runStep(sender, phase, index) {
  if (index >= phase.steps.length) {
    phaseFinished(sender, 0);
    return;
  }
  const step = phase.steps[index];
  if (phase.id === 'data' && step.script === 'parse.py' && !fetchChanges().length) {
    sender.send('fetch:progress', {
      type: 'log', text: 'Brak nowych danych — pomijam parsowanie.', label: phase.label,
    });
    completedSteps++;
    runStep(sender, phase, index + 1);
    return;
  }
  sender.send('fetch:progress', {
    type: 'step', label: step.label,
    current: completedSteps + index + 1, total: totalSteps,
  });
  const child = spawn(bundled(step.exe || 'python'),
    [path.join(DATA_ROOT, 'scripts', step.script), ...(step.args || [])],
    { cwd: DATA_ROOT, env: childEnv() });
  fetchProcess = child;

  let buffer = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    for (const line of lines) if (line.trim()) sendLine(sender, line, step.label);
  });
  child.stderr.on('data', (chunk) => {
    sender.send('fetch:progress', { type: 'log', label: step.label, level: 'error', text: String(chunk) });
  });
  child.on('error', (error) => {
    sender.send('fetch:progress', { type: 'log', label: step.label, level: 'error', text: error.message });
  });
  child.on('close', (code) => {
    if (buffer.trim()) sendLine(sender, buffer, step.label);
    fetchProcess = null;
    if (fetchCancelled) {
      sender.send('fetch:done', { code: -1, cancelled: true, step: step.label, phase: phase.id });
      return;
    }
    if (code !== 0) {
      sender.send('fetch:done', { code, step: step.label, phase: phase.id });
      return;
    }
    completedSteps++;
    runStep(sender, phase, index + 1);
  });
}

function runPhases(sender, ids) {
  activePhases = PIPELINE.phases.filter((phase) => ids.includes(phase.id));
  phaseIndex = 0;
  completedSteps = 0;
  totalSteps = activePhases.reduce((sum, phase) => sum + phase.steps.length, 0);
  fetchCancelled = false;
  const first = activePhases[0];
  sender.send('fetch:phase', {
    phase: first.id, label: first.label, index: 1, total: activePhases.length,
  });
  runStep(sender, first, 0);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: 'Planer zajęć USOS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.on('closed', () => {
    if (fetchProcess) fetchProcess.kill();
    fetchProcess = null;
  });
  window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

ipcMain.handle('data:load', () => loadAll(DATA_ROOT));
ipcMain.handle('export:run', async (_event, payload) => {
  try {
    return { ok: true, ...(await exportPlan(DATA_ROOT, payload)) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});
ipcMain.handle('export:openDir', () =>
  shell.openPath(path.join(DATA_ROOT, 'out', 'eksport')));
ipcMain.handle('fetch:start', (event) => {
  if (fetchProcess) return { started: false, error: 'Pobieranie już trwa.' };
  runPhases(event.sender, ['data', 'build']);
  return { started: true };
});
ipcMain.handle('fetch:startBuild', (event) => {
  if (fetchProcess) return { started: false, error: 'Pobieranie już trwa.' };
  runPhases(event.sender, ['build']);
  return { started: true };
});
ipcMain.handle('fetch:cancel', () => {
  if (!fetchProcess) return { stopped: false };
  fetchCancelled = true;
  fetchProcess.kill();
  fetchProcess = null;
  return { stopped: true };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
