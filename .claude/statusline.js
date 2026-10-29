#!/usr/bin/env node
// Claude Code status line: model, dir, git branch, git email / context bar, cost, duration.
const { execSync } = require('child_process');
const path = require('path');

const C = { r: '\x1b[0m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m' };
const git = (args, cwd) => {
  try {
    return execSync(`git ${args}`, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let j = {};
  try { j = JSON.parse(raw); } catch {}

  const model = (j.model && j.model.display_name) || 'Claude';
  const dir = (j.workspace && j.workspace.current_dir) || j.cwd || process.cwd();
  const branch = git('branch --show-current', dir);
  const email = git('config user.email', dir);

  const pct = Math.max(0, Math.min(100, Math.round((j.context_window && j.context_window.used_percentage) || 0)));
  const color = pct < 30 ? C.green : pct <= 75 ? C.yellow : C.red;
  const width = 20;
  const filled = Math.round((pct * width) / 100);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);

  const cost = ((j.cost && j.cost.total_cost_usd) || 0).toFixed(2);
  const secs = Math.floor(((j.cost && j.cost.total_duration_ms) || 0) / 1000);
  const dur = `${Math.floor(secs / 60)}m ${secs % 60}s`;

  const line1 = [
    `${C.cyan}[${model}]${C.r} 📁 ${path.basename(dir)}`,
    branch && `🌿 ${branch}`,
    email && `👤 ${email}`,
  ].filter(Boolean).join(' | ');
  const line2 = `${color}${bar} ${pct}%${C.r} | ${C.yellow}$${cost}${C.r} | ⏱ ${dur}`;

  process.stdout.write(`${line1}\n${line2}\n`);
});
