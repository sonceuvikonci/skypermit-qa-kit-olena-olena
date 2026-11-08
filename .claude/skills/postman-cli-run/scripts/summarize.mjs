#!/usr/bin/env node
// Turns the raw Postman CLI JSON report (-r cli,json --reporter-json-export) into a small, redacted
// summary: one row per request and one pass/fail result per test case, ready for `testomat-sync report`.
// Request/response bodies, headers, cookies and environment values are NOT copied to the output.
//
// Usage:
//   node summarize.mjs --report <raw report.json> --secrets VAR[,VAR] --out <results.json> [--upsert <upsert.json>]
//
// --upsert: the `testomat-sync upsert` result ({ tests: [{ case_id, test_id }] }). Without it test_id is null.
//
// Case id = prefix "<ID>: " of the request name, or of the nearest parent folder (api-postman-collection
// names every request and folder "<case id>: ..."). Status per case:
//   failed  - a non-"Precondition:" assertion failed, or a Step request got no response
//   skipped - only setup failed (a "Precondition:" assertion, or a Pre request got no response);
//             testomat-sync has no "blocked", so skipped + message "Blocked: setup failed ..."
//   skipped - nothing failed but no Step request was executed
//   passed  - everything else
// Exit 3 if the report is not in the expected shape (do not guess results then).

import { readFileSync, writeFileSync } from 'node:fs';
import { secretValues, redactString, findLeaks } from './redact.mjs';

const CASE_RE = /^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+):\s/;
const PRECONDITION_RE = /^Precondition:/i;
const PRE_REQUEST_RE = /:\s*Pre\s*\d+/i;

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) o[argv[i].replace(/^--/, '')] = argv[i + 1];
  return o;
}

function urlToString(url) {
  if (!url) return '';
  if (typeof url === 'string') return url;
  if (url.raw) return url.raw;
  const host = Array.isArray(url.host) ? url.host.join('.') : url.host || '';
  const path = Array.isArray(url.path) ? url.path.join('/') : url.path || '';
  const proto = url.protocol ? `${url.protocol}://` : '';
  return `${proto}${host}${path ? '/' + path : ''}`;
}

// itemId -> [own name, parent name, grandparent name, ...]
function ancestry(collection) {
  const map = new Map();
  const walk = (items, parents) => {
    for (const it of items || []) {
      const chain = [it.name, ...parents];
      if (it.id) map.set(it.id, chain);
      if (it.item) walk(it.item, chain);
    }
  };
  walk(collection?.item, []);
  return map;
}

function caseIdOf(names) {
  for (const n of names) {
    const m = CASE_RE.exec(n || '');
    if (m) return m[1];
  }
  return null;
}

function main() {
  const o = args(process.argv.slice(2));
  if (!o.report || !o.out || !o.secrets) {
    console.error('Usage: summarize.mjs --report raw.json --secrets VAR[,VAR] --out results.json [--upsert upsert.json]');
    process.exit(2);
  }
  const values = secretValues(o.secrets.split(','));
  const raw = JSON.parse(readFileSync(o.report, 'utf8'));
  const executions = raw?.run?.executions;
  if (!Array.isArray(executions)) {
    console.error('Unexpected report shape: run.executions not found. Read the redacted CLI log instead; do not guess results.');
    process.exit(3);
  }

  const testIds = new Map();
  if (o.upsert) {
    const up = JSON.parse(readFileSync(o.upsert, 'utf8'));
    for (const t of up.tests || []) if (t.case_id && t.test_id) testIds.set(t.case_id, t.test_id);
  }

  const names = ancestry(raw.collection);
  const red = (s) => (s == null ? s : redactString(String(s), values));

  const requests = executions.map((ex) => {
    const chain = names.get(ex.item?.id) || [ex.item?.name];
    const failed = (ex.assertions || [])
      .filter((a) => a.error && !a.skipped)
      .map((a) => ({ assertion: red(a.assertion), error: red(a.error.message || a.error.name || 'failed') }));
    return {
      case_id: caseIdOf(chain),
      name: red(ex.item?.name),
      method: ex.request?.method || null,
      url: red(urlToString(ex.request?.url)),
      status: ex.response ? `${ex.response.code} ${ex.response.status || ''}`.trim() : null,
      request_error: ex.requestError ? red(ex.requestError.message || ex.requestError.code || 'request error') : null,
      assertions_total: (ex.assertions || []).length,
      assertions_failed: failed,
    };
  });

  const byCase = new Map();
  for (const r of requests) {
    const key = r.case_id || '(no case id)';
    if (!byCase.has(key)) byCase.set(key, []);
    byCase.get(key).push(r);
  }

  const results = [];
  for (const [caseId, reqs] of byCase) {
    const productFail = [];
    const setupFail = [];
    let steps = 0;
    for (const r of reqs) {
      const isPre = PRE_REQUEST_RE.test(r.name || '');
      if (!isPre) steps++;
      if (r.request_error || !r.status) {
        (isPre ? setupFail : productFail).push(`${r.name}: no response (${r.request_error || 'not sent'})`);
      }
      for (const a of r.assertions_failed) {
        const line = `${r.name} [HTTP ${r.status || '-'}]: "${a.assertion}" - ${a.error}`;
        (PRECONDITION_RE.test(a.assertion) || isPre ? setupFail : productFail).push(line);
      }
    }
    let status = 'passed';
    let message = null;
    if (productFail.length) {
      status = 'failed';
      message = productFail.join('; ');
      if (setupFail.length) message += `; setup also failed: ${setupFail.join('; ')}`;
    } else if (setupFail.length) {
      status = 'skipped';
      message = `Blocked: setup failed, the checked behaviour was not reached. ${setupFail.join('; ')}`;
    } else if (steps === 0) {
      status = 'skipped';
      message = 'Blocked: no Step request was executed.';
    }
    results.push({ case_id: caseId, test_id: testIds.get(caseId) ?? null, status, message });
  }

  const out = {
    run_id: null,
    results,
    requests,
    stats: raw.run?.stats ?? null,
  };
  const text = JSON.stringify(out, null, 2) + '\n';
  const leaks = findLeaks(text, values);
  if (leaks.length) {
    console.error(`Not written: summary still contains ${leaks.join(', ')}`);
    process.exit(1);
  }
  writeFileSync(o.out, text, 'utf8');
  console.log(JSON.stringify({ cases: results.map((r) => `${r.case_id}=${r.status}`), out: o.out }));
}

main();
