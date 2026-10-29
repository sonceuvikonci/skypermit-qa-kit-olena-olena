#!/usr/bin/env node
// SessionEnd hook: sums token usage per model (main thread + subagents), prices it, writes reports/ws2/<date>-<session_id>.md.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// $ per 1M tokens. Columns: input, output, cache write 5m, cache write 1h, cache read.
const p = (input, output, w5m, w1h, read) => ({ input, output, w5m, w1h, read });
const FABLE = p(10, 50, 12.5, 20, 0.25);
// First match wins, so more specific patterns go first. Model-id patterns for pre-5.5 models are not verified against real transcripts.
const PRICES = [
  [/^claude-(fable-5|mythos-5)/, FABLE],
  [/^claude-opus-5-5/, p(4, 20, 5, 8, 0.2)],
  [/^claude-sonnet-5-5/, p(2, 10, 2.5, 4, 0.1)],
  // Haiku 5.5 has two tiers by total prompt length of a single call, see priceFor().
  [/^claude-haiku-5-5/, { tiers: [{ upTo: 100_000, ...p(0.1, 0.5, 0.125, 0.2, 0.01) }, { upTo: Infinity, ...p(0.5, 2.5, 0.625, 1, 0.05) }] }],
  [/^claude-opus-5(?!-)|^claude-opus-4-[5-8]/, p(5, 25, 6.25, 10, 0.5)],
  [/^claude-opus-4(-1|-2025|$)/, p(15, 75, 18.75, 30, 1.5)],
  [/^claude-sonnet-5(?!-)/, p(2, 10, 2.5, 4, 0.2)],
  [/^claude-sonnet-4-[56]/, p(3, 15, 3.75, 6, 0.3)],
  [/^claude-haiku-4-5/, p(1, 5, 1.25, 2, 0.1)],
];

function priceFor(model, promptTokens) {
  const hit = PRICES.find(([re]) => re.test(model));
  if (!hit) return null;
  return hit[1].tiers ? hit[1].tiers.find((t) => promptTokens <= t.upTo) : hit[1];
}

const readJsonl = (file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((l) => {
      try { return [JSON.parse(l)]; } catch { return []; }
    });

const emptyTotals = () => ({ calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0, cost: 0, unpriced: false });

// One API call is split into several transcript records with the same message.id: keep the last one.
// Priced per call because Haiku 5.5 tier depends on that call's prompt length (input + cache read + cache write).
function usageByModel(records, into = {}) {
  const byId = new Map();
  for (const r of records) {
    if (r.type === 'assistant' && r.message?.usage && r.message.model && r.message.model !== '<synthetic>') byId.set(r.message.id ?? r.uuid, r.message);
  }
  for (const m of byId.values()) {
    const u = m.usage;
    const cc = u.cache_creation;
    const call = {
      input: u.input_tokens ?? 0,
      output: u.output_tokens ?? 0, // already includes thinking tokens (cost-state check)
      cacheRead: u.cache_read_input_tokens ?? 0,
      cacheWrite5m: cc ? cc.ephemeral_5m_input_tokens ?? 0 : u.cache_creation_input_tokens ?? 0,
      cacheWrite1h: cc?.ephemeral_1h_input_tokens ?? 0,
    };
    const t = (into[m.model] ??= emptyTotals());
    t.calls += 1;
    for (const k of Object.keys(call)) t[k] += call[k];
    const pr = priceFor(m.model, call.input + call.cacheRead + call.cacheWrite5m + call.cacheWrite1h);
    if (!pr) t.unpriced = true;
    else t.cost += (call.input * pr.input + call.output * pr.output + call.cacheRead * pr.read + call.cacheWrite5m * pr.w5m + call.cacheWrite1h * pr.w1h) / 1e6;
  }
  return into;
}

function merge(into, from) {
  for (const [model, t] of Object.entries(from)) {
    const a = (into[model] ??= emptyTotals());
    for (const k of Object.keys(a)) a[k] = k === 'unpriced' ? a[k] || t[k] : a[k] + t[k];
  }
}

const fmt = (n) => n.toLocaleString('en-US');
const usd = (t) => (t.unpriced ? 'n/a (немає в таблиці цін)' : `$${t.cost.toFixed(4)}`);
const sumCost = (byModel) => Object.values(byModel).reduce((s, t) => s + (t.unpriced ? 0 : t.cost), 0);

function usageTable(byModel) {
  const rows = ['| Модель | Виклики | Input | Output | Cache read | Cache write 5m | Cache write 1h | $ |', '|---|---:|---:|---:|---:|---:|---:|---:|'];
  for (const [model, t] of Object.entries(byModel)) {
    rows.push(`| ${model} | ${t.calls} | ${fmt(t.input)} | ${fmt(t.output)} | ${fmt(t.cacheRead)} | ${fmt(t.cacheWrite5m)} | ${fmt(t.cacheWrite1h)} | ${usd(t)} |`);
  }
  return rows.join('\n');
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
      merge(allByModel, byModel);
      subagents.push({ id: base.replace(/^agent-/, ''), type: meta.agentType ?? '?', description: meta.description ?? '', models: Object.keys(byModel).join(', '), cost: sumCost(byModel) });
    }
  }

  // Claude Code's own totals; also the only place where side calls (e.g. title generation on Haiku) show up.
  const costState = main.findLast((r) => r.type === 'cost-state');

  // Compact: observed in a real transcript as {type:'system', subtype:'compact_boundary', compactMetadata:{trigger, preTokens, postTokens, durationMs}}
  // (followed by a user record with isCompactSummary:true). The summarisation call itself has no assistant record.
  const compacts = main.filter((r) => r.type === 'system' && r.subtype === 'compact_boundary');

  const date = new Date();
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const md = [
    `# Usage report ${sessionId}`,
    '',
    `- Дата: ${day}`,
    `- Transcript: \`${transcriptPath}\``,
    `- Причина завершення: ${input.reason ?? 'n/a'}`,
    '',
    '## Усього (основна сесія + субагенти)',
    '',
    usageTable(allByModel),
    '',
    `**Разом: $${sumCost(allByModel).toFixed(4)}**`,
    '',
    '## Основна сесія',
    '',
    usageTable(mainByModel),
    '',
    `Разом: $${sumCost(mainByModel).toFixed(4)}`,
    '',
    '## Субагенти',
    '',
    subagents.length
      ? ['| agentId | Тип | Опис | Моделі | $ |', '|---|---|---|---|---:|', ...subagents.map((s) => `| ${s.id} | ${s.type} | ${s.description} | ${s.models} | $${s.cost.toFixed(4)} |`)].join('\n')
      : 'Не виявлено.',
    '',
    '## Звірка з cost-state (Claude Code)',
    '',
    costState
      ? [
          '| Модель | Output | Cache read | $ (Claude Code) |',
          '|---|---:|---:|---:|',
          ...Object.entries(costState.modelUsage ?? {}).map(([m, u]) => `| ${m} | ${fmt(u.outputTokens ?? 0)} | ${fmt(u.cacheReadInputTokens ?? 0)} | $${(u.costUSD ?? 0).toFixed(4)} |`),
          '',
          `totalCostUSD: $${(costState.totalCostUSD ?? 0).toFixed(4)}; наш підрахунок: $${sumCost(allByModel).toFixed(4)}. \`cost-state\` — знімок на момент свого запису, тож усе після нього сюди не потрапило; службові виклики (заголовок тощо, напр. Haiku) є лише в \`cost-state\`, а не в \`assistant\`-записах.`,
        ].join('\n')
      : 'Запису `cost-state` немає.',
    '',
    '## Compact',
    '',
    compacts.length
      ? [
          '| Час | Тригер | Токенів до | Токенів після | Відкинуто | Тривалість, с |',
          '|---|---|---:|---:|---:|---:|',
          ...compacts.map((r) => {
            const m = r.compactMetadata ?? {};
            return `| ${r.timestamp ?? 'n/a'} | ${m.trigger ?? 'n/a'} | ${fmt(m.preTokens ?? 0)} | ${fmt(m.postTokens ?? 0)} | ${fmt(m.cumulativeDroppedTokens ?? 0)} | ${((m.durationMs ?? 0) / 1000).toFixed(1)} |`;
          }),
        ].join('\n')
      : 'Не виявлено.',
    '',
    '## Припущення',
    '',
    '- Ціни: таблиця користувача (input/output/cache write 5m/1h/cache read окремо для кожної моделі); звірено з `costUSD` у `cost-state` для Sonnet 5.5 та Haiku 5.5.',
    '- Haiku 5.5: поріг 100K визначається по кожному виклику як input + cache read + cache write.',
    '- `output_tokens` уже включає thinking-токени.',
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
