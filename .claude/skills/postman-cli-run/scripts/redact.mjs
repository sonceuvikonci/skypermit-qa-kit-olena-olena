#!/usr/bin/env node
// Removes secret values from Postman CLI run output before anything is written to api-automation/runs/
// (those files are committed), and checks finished files for leftovers.
//
// Secret VALUES are never passed on the command line: the script gets the NAMES of shell variables
// (e.g. SKY_OPERATOR_PASSWORD) and reads their values from its own environment.
//
// Usage:
//   node redact.mjs redact --secrets SKY_OPERATOR_PASSWORD[,MORE] --in <raw file> --out <file>
//   node redact.mjs check  --secrets SKY_OPERATOR_PASSWORD[,MORE] <file> [file...]
//
// redact: rewrites every secret value (plain, JSON-escaped, URL-encoded, base64) and every value of a
//         secret-looking field (password, token, secret, api key, cookie, authorization, session) as ***.
// check:  exit 0 if no file contains a secret value or an unmasked secret-looking field; exit 1 and list
//         file + kind of leak (never the value) otherwise. Exit 2 on bad usage or an unset variable.

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const MASK = '***';

// Field names whose values are always masked, whatever the value is.
const SECRET_KEY = '(?:password|passwd|pwd|token|access_token|refresh_token|secret|api[-_]?key|authorization|cookie|set-cookie|session)';

export function secretValues(names) {
  const values = [];
  for (const name of names) {
    const v = process.env[name];
    if (v === undefined || v === '') {
      throw new Error(`Shell variable ${name} is not set`);
    }
    values.push(v);
  }
  return values;
}

// All the shapes a secret value can take in a report.
function variants(value) {
  const set = new Set([
    value,
    JSON.stringify(value).slice(1, -1),
    encodeURIComponent(value),
    Buffer.from(value, 'utf8').toString('base64'),
  ]);
  return [...set].filter((s) => s.length >= 4).sort((a, b) => b.length - a.length);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redactString(text, values) {
  let out = String(text);
  for (const v of values) {
    for (const form of variants(v)) {
      out = out.split(form).join(MASK);
    }
  }
  // "password": "..."  /  'password': '...'
  out = out.replace(new RegExp(`(["']${SECRET_KEY}["']\\s*:\\s*)(["'])(?:\\\\.|(?!\\2).)*\\2`, 'gi'), `$1$2${MASK}$2`);
  // password=...  (query strings, form bodies, --env-var / --global-var arguments)
  out = out.replace(new RegExp(`(\\b[\\w.-]*${SECRET_KEY}[\\w.-]*=)[^\\s&"';]+`, 'gi'), `$1${MASK}`);
  // Header lines: "Cookie: ...", "Authorization: Bearer ..."
  out = out.replace(/^(\s*(?:cookie|set-cookie|authorization)\s*:\s*).+$/gim, `$1${MASK}`);
  return out;
}

// Deep redaction for parsed JSON (used by summarize.mjs). Masks values under secret-looking keys,
// {key, value} pairs with a secret-looking key or type "secret", and every string.
export function redactJson(node, values) {
  const keyRe = new RegExp(`^${SECRET_KEY}$`, 'i');
  if (typeof node === 'string') return redactString(node, values);
  if (Array.isArray(node)) return node.map((x) => redactJson(x, values));
  if (node && typeof node === 'object') {
    const out = {};
    const pairKey = typeof node.key === 'string' ? node.key : null;
    const pairIsSecret = (pairKey && (keyRe.test(pairKey) || /pass|token|secret/i.test(pairKey))) || node.type === 'secret';
    for (const [k, v] of Object.entries(node)) {
      if (k === 'value' && pairIsSecret) out[k] = MASK;
      else if (keyRe.test(k) && (typeof v === 'string' || typeof v === 'number')) out[k] = MASK;
      else out[k] = redactJson(v, values);
    }
    return out;
  }
  return node;
}

export function findLeaks(text, values) {
  const leaks = [];
  values.forEach((v, i) => {
    for (const form of variants(v)) {
      if (text.includes(form)) {
        leaks.push(`value of secret #${i + 1}`);
        break;
      }
    }
  });
  const field = new RegExp(`["']${SECRET_KEY}["']\\s*:\\s*["'](?!\\*\\*\\*["'])[^"']+["']`, 'i');
  if (field.test(text)) leaks.push('unmasked secret-looking JSON field');
  const assign = new RegExp(`\\b[\\w.-]*${SECRET_KEY}[\\w.-]*=(?!\\*\\*\\*)[^\\s&"';]+`, 'i');
  if (assign.test(text)) leaks.push('unmasked secret-looking key=value');
  return leaks;
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const opts = { mode, secrets: [], files: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--secrets') opts.secrets = rest[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--in') opts.in = rest[++i];
    else if (a === '--out') opts.out = rest[++i];
    else opts.files.push(a);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!['redact', 'check'].includes(opts.mode) || opts.secrets.length === 0) {
    console.error('Usage: redact.mjs redact|check --secrets VAR[,VAR] (--in raw --out file | file...)');
    process.exit(2);
  }
  let values;
  try {
    values = secretValues(opts.secrets);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }

  if (opts.mode === 'redact') {
    if (!opts.in || !opts.out) {
      console.error('redact needs --in and --out');
      process.exit(2);
    }
    const clean = redactString(readFileSync(opts.in, 'utf8'), values);
    const leaks = findLeaks(clean, values);
    if (leaks.length) {
      console.error(`Not written: still contains ${leaks.join(', ')}`);
      process.exit(1);
    }
    writeFileSync(opts.out, clean, 'utf8');
    console.log(`redacted -> ${opts.out}`);
    return;
  }

  let bad = 0;
  for (const f of opts.files) {
    const leaks = findLeaks(readFileSync(f, 'utf8'), values);
    if (leaks.length) {
      bad++;
      console.log(`LEAK ${f}: ${leaks.join(', ')}`);
    } else {
      console.log(`clean ${f}`);
    }
  }
  process.exit(bad ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
