#!/usr/bin/env node
// SessionEnd hook: sums token usage per model (main thread + subagents), prices it, writes reports/ws2/<date>-<session_id>.md.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// $ per 1M tokens. Cache read = 1/10 of input (slide). Cache write is not on the slide: ASSUMED 1.25x (5m) and 2x (1h) of input.
const PRICES = {
  haiku: { input: 0.1, output: 0.5 },
  sonnet: { input: 2, output: 10 },
  opus: { input: 4, output: 20 },
};
const CACHE_READ = 0.1;
const CACHE_WRITE_5M = 1.25;
const CACHE_WRITE_1H = 2;

const priceFor = (model) => PRICES[Object.keys(PRICES).find((k) => model.includes(k))];

const readJsonl = (file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((l) => {
      try { return [JSON.parse(l)]; } catch { return []; }
    });

const emptyTotals = () => ({ calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });

// One API call is split into several transcript records with the same message.id: keep the last one.
function usageByModel(records, into = {}) {
  const byId = new Map();
  for (const r of records) {
    if (r.type === 'assistant' && r.message?.usage && r.message.model) byId.set(r.message.id ?? r.uuid, r.message);
  }
  for (const m of byId.values()) {
    const u = m.usage;
    const t = (into[m.model] ??= emptyTotals());
    const cc = u.cache_creation;
    t.calls += 1;
    t.input += u.input_tokens ?? 0;
    t.output += u.output_tokens ?? 0;
    t.cacheRead += u.cache_read_input_tokens ?? 0;
    t.cacheWrite5m += cc ? cc.ephemeral_5m_input_tokens ?? 0 : u.cache_creation_input_tokens ?? 0;
    t.cacheWrite1h += cc?.ephemeral_1h_input_tokens ?? 0;
  }
  return into;
}

function cost(model, t) {
  const p = priceFor(model);
  if (!p) return null;
  return (
    (t.input * p.input +
      t.output * p.output +
      t.cacheRead * p.input * CACHE_READ +
      t.cacheWrite5m * p.input * CACHE_WRITE_5M +
      t.cacheWrite1h * p.input * CACHE_WRITE_1H) /
    1e6
  );
}

const fmt = (n) => n.toLocaleString('en-US');
const usd = (n) => (n === null ? 'n/a (немає в таблиці цін)' : `$${n.toFixed(4)}`);

function usageTable(byModel) {
  const rows = ['| Модель | Виклики | Input | Output | Cache read | Cache write 5m | Cache write 1h | $ |', '|---|---:|---:|---:|---:|---:|---:|---:|'];
  let total = 0;
  for (const [model, t] of Object.entries(byModel)) {
    const c = cost(model, t);
    if (c !== null) total += c;
    rows.push(`| ${model} | ${t.calls} | ${fmt(t.input)} | ${fmt(t.output)} | ${fmt(t.cacheRead)} | ${fmt(t.cacheWrite5m)} | ${fmt(t.cacheWrite1h)} | ${usd(c)} |`);
  }
  return { table: rows.join('\n'), total };
}

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  const input = JSON.parse(raw || '{}');
  const { transcript_path: transcriptPath, session_id: sessionId } = input;
  if (!transcriptPath || !sessionId || !existsSync(transcriptPath)) {
    console.error(`usage-report: missing/invalid transcript_path or session_id in stdin (keys: ${Object.keys(input).join(', ')})`);
    process.exit(1);
  }

  const main = readJsonl(transcriptPath);
  const mainByModel = usageByModel(main);

  // Subagents live in <transcript without .jsonl>/subagents/agent-<id>.jsonl (+ .meta.json).
  const subDir = path.join(transcriptPath.replace(/\.jsonl$/, ''), 'subagents');
  const subagents = [];
  const allByModel = structuredClone(mainByModel);
  if (existsSync(subDir)) {
    for (const f of readdirSync(subDir).filter((n) => n.endsWith('.jsonl'))) {
      const base = f.replace(/\.jsonl$/, '');
      const metaFile = path.join(subDir, `${base}.meta.json`);
      const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : {};
      const byModel = usageByModel(readJsonl(path.join(subDir, f)));
      for (const [model, t] of Object.entries(byModel)) {
        const a = (allByModel[model] ??= emptyTotals());
        for (const k of Object.keys(a)) a[k] += t[k];
      }
      const c = Object.entries(byModel).reduce((s, [m, t]) => s + (cost(m, t) ?? 0), 0);
      subagents.push({ id: base.replace(/^agent-/, ''), type: meta.agentType ?? '?', description: meta.description ?? '', models: Object.keys(byModel).join(', '), cost: c });
    }
  }

  // Compact: marker format was NOT observed in any local transcript, so this only looks at record type/subtype names.
  const compacts = main.filter((r) => /compact/i.test(`${r.type ?? ''} ${r.subtype ?? ''}`) || r.isCompactSummary);

  const date = new Date();
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const { table: mainTable, total: mainTotal } = usageTable(mainByModel);
  const { table: allTable, total: allTotal } = usageTable(allByModel);

  const md = [
    `# Usage report ${sessionId}`,
    '',
    `- Дата: ${day}`,
    `- Transcript: \`${transcriptPath}\``,
    `- Причина завершення: ${input.reason ?? 'n/a'}`,
    '',
    '## Усього (основна сесія + субагенти)',
    '',
    allTable,
    '',
    `**Разом: $${allTotal.toFixed(4)}**`,
    '',
    '## Основна сесія',
    '',
    mainTable,
    '',
    `Разом: $${mainTotal.toFixed(4)}`,
    '',
    '## Субагенти',
    '',
    subagents.length
      ? ['| agentId | Тип | Опис | Моделі | $ |', '|---|---|---|---|---:|', ...subagents.map((s) => `| ${s.id} | ${s.type} | ${s.description} | ${s.models} | $${s.cost.toFixed(4)} |`)].join('\n')
      : 'Не виявлено.',
    '',
    '## Compact',
    '',
    compacts.length ? `Знайдено записів: ${compacts.length} (за назвою type/subtype; структуру не верифіковано).` : 'Не виявлено.',
    '',
    '## Припущення',
    '',
    '- Ціни: Haiku 5.5 $0.10/$0.50, Sonnet 5.5 $2/$10, Opus 5.5 $4/$20 за 1M (вхід/вихід); cache read = 0.1 × вхід.',
    '- Cache write (немає на слайді): 1.25 × вхід для 5m, 2 × вхід для 1h.',
    '- Дублі `message.id` (один API-виклик розбитий на кілька записів) враховано один раз.',
    '- Токени advisor-моделі (`advisorModel`) у `message.usage` не відображені й тут не враховані.',
    '',
  ].join('\n');

  const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
  const outDir = path.join(root, 'reports', 'ws2');
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${day}-${sessionId}.md`);
  writeFileSync(out, md);
  console.error(`usage-report: wrote ${out}`);
});
