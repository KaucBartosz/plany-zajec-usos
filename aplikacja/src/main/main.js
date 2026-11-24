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

const FETCH_STEPS = [
  { label: 'Plany semestralne i tydzień (USOS)', script: 'fetch.py', exe: 'python' },
  { label: 'Bieżący tydzień Pon–Pt', script: 'fetch_week_pon_pt.py', exe: 'python' },
  { label: 'Parsowanie danych', script: 'parse.py', exe: 'python' },
  { label: 'Plansze sal', script: 'build_rooms.py', exe: 'python' },
  { label: 'PNG sal', script: 'shot_rooms.js', exe: 'node' },
  { label: 'Kartki A4', script: 'build_sheets.py', exe: 'python' },
  { label: 'PNG kartek A4', script: 'sheets.js', exe: 'node' },
  { label: 'PDF do druku', script: 'to_pdf.py', exe: 'python' },
  { label: 'Kontrola jakości', script: 'verify.py', exe: 'python' },
];

let fetchProcess = null;
let fetchCancelled = false;

function sendLine(sender, text, label) {
  const progress = text.match(/\[(?:tydz\.\s*)?(\d+)\s*\/\s*(\d+)\]/);
  sender.send('fetch:progress', {
    type: 'log',
    text,
    label,
    progress: progress ? { current: Number(progress[1]), total: Number(progress[2]) } : null,
  });
}

function runFetchStep(sender, index) {
  if (index >= FETCH_STEPS.length) {
    fetchProcess = null;
    sender.send('fetch:done', { code: 0 });
    return;
  }

  const step = FETCH_STEPS[index];
  sender.send('fetch:progress', { type: 'step', label: step.label, current: index + 1, total: FETCH_STEPS.length });

  const child = spawn(bundled(step.exe || 'python'), [path.join(DATA_ROOT, 'scripts', step.script)], {
    cwd: DATA_ROOT,
    env: childEnv(),
  });
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
      sender.send('fetch:done', { code: -1, cancelled: true, step: step.label });
      return;
    }
    if (code !== 0) {
      sender.send('fetch:done', { code, step: step.label });
      return;
    }
    runFetchStep(sender, index + 1);
  });
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
  fetchCancelled = false;
  runFetchStep(event.sender, 0);
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
