'use strict';

/* Generuje run-all.cmd z scripts/pipeline.json — jedyne źródło listy kroków. */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pipeline = JSON.parse(fs.readFileSync(path.join(__dirname, 'pipeline.json'), 'utf8'));
const steps = pipeline.phases.flatMap((phase) => phase.steps);

const lines = [
  '@echo off',
  'setlocal',
  'chcp 65001 >nul',
  'set PYTHONIOENCODING=utf-8',
  'cd /d "%~dp0"',
  'if exist "%~dp0runtime\\_env.cmd" call "%~dp0runtime\\_env.cmd"',
  '',
  'where python >nul 2>nul || (echo [BLAD] Brak Pythona w PATH. & exit /b 1)',
  'where node   >nul 2>nul || (echo [BLAD] Brak Node.js w PATH. & exit /b 1)',
  '',
  'if not exist node_modules\\playwright (',
  '  echo Instaluje Playwright ^(tylko pierwszy raz^)...',
  '  call npm install --no-audit --no-fund || goto :err',
  '  call npx playwright install chromium || goto :err',
  ')',
  'python -c "import PIL" 2>nul || (',
  '  echo Instaluje Pillow...',
  '  python -m pip install -r requirements.txt || goto :err',
  ')',
  '',
];

steps.forEach((step, index) => {
  const command = step.exe === 'node' ? 'node' : 'python';
  const args = (step.args || []).join(' ');
  lines.push(`echo [${index + 1}/${steps.length}] ${step.label}`);
  lines.push(`${command} scripts\\${step.script}${args ? ' ' + args : ''} || goto :err`);
});

lines.push(
  '',
  'echo.',
  'echo Gotowe. PDF: out\\a4\\pdf\\',
  'start "" "out\\a4\\pdf"',
  'exit /b 0',
  '',
  ':err',
  'echo.',
  'echo [BLAD] Przerwano - sprawdz komunikat powyzej.',
  'exit /b 1',
  '',
);

fs.writeFileSync(path.join(root, 'run-all.cmd'), lines.join('\r\n'), 'utf8');
console.log(`run-all.cmd: ${steps.length} kroków z pipeline.json`);
