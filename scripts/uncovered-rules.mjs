#!/usr/bin/env node
// Lists skypermit business rules (rule_reference rows of ../skypermit/docs/06-business-rules.md §6)
// that no case in test-cases/ covers yet, grouped by gate. Read-only everywhere.
//
// Usage: node scripts/uncovered-rules.mjs [max-rules] [gate]
//        node scripts/uncovered-rules.mjs [--max N] [--gate PILOT|AIRCRAFT|ZONE|TIME_WINDOW|REGISTRATION|ALL]
// Defaults: --gate ALL --max 5
// Output: JSON on stdout.
//
// A rule is covered when some file under test-cases/ mentions both its rule_reference and its gate
// (gate is skipped for REGISTRATION, which is not a gate). The pair is the key because
// `ZC-2026.1 §2` is shared by AIRCRAFT and ZONE.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE_ORDER = ['PILOT', 'AIRCRAFT', 'ZONE', 'TIME_WINDOW', 'REGISTRATION'];
const NOT_CASES = new Set(['confirmed-facts.md', 'open-questions.md']);

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = resolve(repoRoot, '..', 'skypermit', 'docs');
const casesDir = join(repoRoot, 'test-cases');

function parseArgs(argv) {
  const args = { gate: 'ALL', max: 5 };
  // Accepts both "/cover-gaps 3 TIME_WINDOW" (positional, any order) and "--max 3 --gate TIME_WINDOW".
  // $ARGUMENTS may arrive as one quoted string, so split every argument on spaces first.
  const tokens = argv.flatMap((a) => a.split(/\s+/)).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '--gate') args.gate = (tokens[++i] ?? '').toUpperCase();
    else if (t === '--max') args.max = Number(tokens[++i]);
    else if (/^\d+$/.test(t)) args.max = Number(t); // a number is max-rules
    else if (/^[a-z_]+$/i.test(t)) args.gate = t.toUpperCase(); // a word is the gate
    else fail(`Unknown argument: ${t}. Usage: /cover-gaps [max-rules] [gate]`);
  }
  if (args.gate !== 'ALL' && !GATE_ORDER.includes(args.gate)) {
    fail(`--gate must be one of ${GATE_ORDER.join(', ')}, ALL`);
  }
  if (!(args.max > 0)) fail('--max must be a positive number');
  return args;
}

function fail(message) {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}

function readDoc(name) {
  const path = join(docsDir, name);
  if (!existsSync(path)) fail(`Missing spec: ${path}`);
  return readFileSync(path, 'utf8');
}

function stripMd(cell) {
  return cell.replace(/[`*]/g, '').trim();
}

// §6 table rows: | Gate | Condition | rule_reference |
function parseRules(businessRules) {
  const section = businessRules.split(/^## 6\./m)[1]?.split(/^## 7\./m)[0];
  if (!section) fail('Section "## 6. rule_reference values" not found in 06-business-rules.md');
  const rules = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line) || /^\|\s*Gate\s*\|/.test(line)) continue;
    const [gateCell, conditionCell, refCell] = line.split('|').slice(1, 4);
    if (!refCell) continue;
    const gateRaw = stripMd(gateCell);
    const gate = /^[A-Z_]+$/.test(gateRaw) ? gateRaw : 'REGISTRATION';
    const ref = refCell.match(/`([^`]+)`/)?.[1];
    if (!ref) continue;
    rules.push({
      gate,
      rule_reference: ref,
      condition: stripMd(conditionCell),
      note: stripMd(refCell.replace(/`[^`]+`/, '')) || null,
    });
  }
  return rules;
}

// 07-clarifications.md governs over 06. 06 is already updated to match, so this only guards against drift
// and records what 07 leaves unconfirmed.
function applyClarifications(rules, clarifications) {
  const warnings = [];
  const weightToAircraft = /Weight band\s*→\s*`AIRCRAFT`/.test(clarifications);
  const zoneCitationOpen = /Zone `active` flag\s*→\s*still unattributed/.test(clarifications);
  for (const rule of rules) {
    if (weightToAircraft && /weight band/i.test(rule.condition) && rule.gate !== 'AIRCRAFT') {
      warnings.push(`06 lists "${rule.condition}" under ${rule.gate}; 07 §1/§4 moves it to AIRCRAFT. Overridden.`);
      rule.gate = 'AIRCRAFT';
    }
    if (zoneCitationOpen && /zone inactive/i.test(rule.condition)) {
      rule.citation_confirmed = false;
      rule.note = rule.note ?? 'citation not confirmed (07 §4)';
    }
  }
  return warnings;
}

function listCaseFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listCaseFiles(path);
    return name.endsWith('.md') && !NOT_CASES.has(name) ? [path] : [];
  });
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// `OH-1 §2.1` must not match `OH-1 §2.10`.
function mentionsRef(text, ref) {
  return new RegExp(`${escapeRe(ref)}(?![\\w]|\\.\\d)`).test(text);
}

function mentionsGate(text, gate) {
  return gate === 'REGISTRATION' || new RegExp(`\\b${gate}\\b`).test(text);
}

const args = parseArgs(process.argv.slice(2));
const rules = parseRules(readDoc('06-business-rules.md'));
const warnings = applyClarifications(rules, readDoc('07-clarifications.md'));
const cases = listCaseFiles(casesDir).map((path) => ({
  path: path.slice(repoRoot.length + 1).replaceAll('\\', '/'),
  text: readFileSync(path, 'utf8'),
}));

const withCoverage = rules.map((rule) => ({
  ...rule,
  covered_by: cases
    .filter((c) => mentionsRef(c.text, rule.rule_reference) && mentionsGate(c.text, rule.gate))
    .map((c) => c.path),
}));
const uncovered = withCoverage.filter((r) => r.covered_by.length === 0);
const selected = uncovered
  .filter((r) => args.gate === 'ALL' || r.gate === args.gate)
  .sort((a, b) => GATE_ORDER.indexOf(a.gate) - GATE_ORDER.indexOf(b.gate));
const limited = selected.slice(0, args.max);

const byGate = {};
for (const { covered_by, ...rule } of limited) (byGate[rule.gate] ??= []).push(rule);

console.log(
  JSON.stringify(
    {
      filter: { gate: args.gate, max: args.max },
      total_rules: rules.length,
      covered: rules.length - uncovered.length,
      uncovered_total: uncovered.length,
      uncovered_matching_filter: selected.length,
      returned: limited.length,
      skipped_by_max: selected.length - limited.length,
      warnings,
      gaps_by_gate: byGate,
    },
    null,
    2,
  ),
);
