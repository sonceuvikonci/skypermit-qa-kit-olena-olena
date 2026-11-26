#!/usr/bin/env node
// render-coverage.mjs — рендерить <назва>.design.json (вихід скіла test-design) у <назва>.coverage.html поруч.
//
//   node .claude/skills/test-design/scripts/render-coverage.mjs <шлях/до/назва.design.json> [ще.design.json ...]
//
// Що на сторінці:
//   1. Числова лінія для кожного числового параметра: класи (регіони між межами), межі (з включністю), точки BV,
//      представники EP. Нечислові BV показані таблицею.
//   2. Таблиця стан × дія (або причина not_applicable).
//   3. Трасування цитата → елемент → тест, елементи без тесту, биті посилання, і список unknowns.
// Цитати механічно звіряються з файлом специфікації (якщо він знайдений): quote.text має бути підрядком рядка quote.line.
//
// Без AI і без залежностей: лише Node (>= 18). Нічого, крім .coverage.html, не пише.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, basename, resolve, join } from 'node:path';

// ---------- утиліти ----------

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const arr = (v) => (Array.isArray(v) ? v : []);

// Число з рядка на кшталт "15 хв", "-3", "2,5 кг". Якщо чисел нема або їх кілька ("1 год 59 хв") — null:
// без одиниці виміру такий рядок на одну вісь коректно не покласти.
function num(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  const m = v.match(/[-−]?\d+(?:[.,]\d+)?/g);
  if (!m || m.length !== 1) return null;
  return Number(m[0].replace('−', '-').replace(',', '.'));
}

const fmt = (n) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(4)));

const STATUS = { valid: 'valid', invalid: 'invalid', unknown: 'unknown', legal: 'valid', illegal: 'invalid' };
const cls = (s) => STATUS[s] ?? 'unknown';

// ---------- вхід ----------

function main() {
  const inputs = process.argv.slice(2);
  if (!inputs.length) {
    console.error('Usage: node render-coverage.mjs <file.design.json> [more.design.json ...]');
    process.exit(2);
  }
  let failed = 0;
  for (const input of inputs) {
    try {
      const out = render(input);
      console.log(`OK  ${out}`);
    } catch (e) {
      failed++;
      console.error(`ERR ${input}: ${e.message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

// ---------- рендер одного файлу ----------

function render(input) {
  const path = resolve(input);
  if (!existsSync(path)) throw new Error('файл не знайдено');
  let d;
  try {
    d = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`невалідний JSON: ${e.message}`);
  }

  const outPath = path.replace(/(\.design)?\.json$/i, '') + '.coverage.html';
  const ep = arr(d.equivalence_classes);
  const bv = arr(d.boundary_values);
  const st = d.state_transitions ?? {};
  const matrix = arr(st.matrix);
  const tests = arr(d.tests);
  const unknowns = arr(d.unknowns);

  // --- індекси ---
  const elements = new Map(); // id -> {kind, item}
  ep.forEach((x) => elements.set(x.id, { kind: 'EP', item: x }));
  bv.forEach((x) => elements.set(x.id, { kind: 'BV', item: x }));
  matrix.forEach((x) => elements.set(x.id, { kind: 'ST', item: x }));

  const testsOf = new Map(); // element id -> [test id]
  const dangling = []; // {where, id}
  for (const t of tests) {
    for (const id of arr(t.covers)) {
      if (!elements.has(id)) dangling.push({ where: `${t.id}.covers`, id });
      if (!testsOf.has(id)) testsOf.set(id, []);
      testsOf.get(id).push(t.id);
    }
  }
  const unknownsOf = new Map(); // element id -> [U id]
  for (const u of unknowns) {
    for (const id of arr(u.affects)) {
      if (!elements.has(id)) dangling.push({ where: `${u.id}.affects`, id });
      if (!unknownsOf.has(id)) unknownsOf.set(id, []);
      unknownsOf.get(id).push(u.id);
    }
  }
  const uncovered = [...elements.keys()].filter((id) => !testsOf.has(id));

  // --- звірка цитат зі специфікацією ---
  const specLines = loadSpec(d.spec, dirname(path));
  const checkQuote = (q) => {
    if (!q || q.line == null || q.text == null) return 'missing';
    if (!specLines) return 'nospec';
    const line = specLines[q.line - 1];
    return line != null && line.includes(q.text) ? 'ok' : 'bad';
  };

  // усі цитати: з елементів і з response
  const quotes = []; // {q, ownerId, kind, role}
  for (const [id, { kind, item }] of elements) {
    quotes.push({ q: item.quote, ownerId: id, kind, role: 'element' });
    if (item.response) quotes.push({ q: item.response.quote, ownerId: id, kind, role: 'response' });
    for (const v of arr(item.values)) {
      if (v.response) quotes.push({ q: v.response.quote, ownerId: id, kind, role: `response @ ${v.value}` });
    }
  }
  const badQuotes = quotes.filter((x) => ['bad', 'missing'].includes(checkQuote(x.q)));

  // --- секції ---
  const params = groupParams(ep, bv);
  const numeric = params.filter((p) => p.numeric);
  const nonNumeric = params.filter((p) => !p.numeric);

  const stats = [
    ['EP', ep.length],
    ['BV', bv.length],
    ['ST', matrix.length],
    ['Тести', tests.length],
    ['Unknowns', unknowns.length],
    ['Без тесту', uncovered.length, uncovered.length ? 'bad' : 'good'],
    ['Биті id', dangling.length, dangling.length ? 'bad' : 'good'],
    [
      'Цитати ✓',
      specLines ? `${quotes.length - badQuotes.length}/${quotes.length}` : 'spec ?',
      !specLines ? 'warn' : badQuotes.length ? 'bad' : 'good',
    ],
  ];

  const html = `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coverage — ${esc(basename(String(d.spec ?? input)))}</title>
<style>${CSS}</style>
</head>
<body>
<header>
  <h1>Test design coverage</h1>
  <p class="meta">spec: <code>${esc(d.spec)}</code>${d.focus ? ` · focus: <b>${esc(d.focus)}</b>` : ''}
  · source: <code>${esc(basename(path))}</code> · rendered ${esc(new Date().toISOString().slice(0, 16).replace('T', ' '))}</p>
  ${specLines ? '' : `<p class="note warn">Файл специфікації не знайдено — цитати не звірено.</p>`}
  <div class="stats">${stats
    .map(([k, v, s]) => `<div class="stat ${s ?? ''}"><span>${esc(v)}</span>${esc(k)}</div>`)
    .join('')}</div>
  <p class="legend"><i class="sw valid"></i>valid / legal <i class="sw invalid"></i>invalid / illegal
  <i class="sw unknown"></i>unknown</p>
</header>

<section>
  <h2>1. Числові параметри: класи, межі, точки BV</h2>
  ${numeric.length ? numeric.map((p) => numberLine(p, testsOf, unknownsOf)).join('') : '<p class="empty">Числових параметрів немає.</p>'}
  ${nonNumeric.length ? `<h3>Нечислові параметри</h3>${nonNumeric.map((p) => paramTables(p, testsOf, unknownsOf)).join('')}` : ''}
</section>

<section>
  <h2>2. Стан × дія</h2>
  ${stTable(st, matrix, testsOf, unknownsOf)}
</section>

<section>
  <h2>3. Трасування: цитата → елемент → тест</h2>
  ${traceTable(quotes, elements, testsOf, checkQuote)}
  ${uncovered.length ? `<h3>Елементи без тесту</h3><p>${uncovered.map(chip).join(' ')}</p>` : ''}
  ${dangling.length ? `<h3>Биті посилання</h3><ul>${dangling.map((x) => `<li><code>${esc(x.where)}</code> → <code>${esc(x.id)}</code> (такого елемента немає)</li>`).join('')}</ul>` : ''}
  <h3>Тести</h3>
  ${testsTable(tests, elements)}
  <h3 id="unknowns">Unknowns (${unknowns.length})</h3>
  ${unknowns.length ? `<ol class="unknowns">${unknowns.map((u) => `<li id="${esc(u.id)}"><b>${esc(u.id)}</b> ${esc(u.question)}${arr(u.affects).length ? `<div class="aff">affects: ${arr(u.affects).map(chip).join(' ')}</div>` : ''}</li>`).join('')}</ol>` : '<p class="empty">Немає.</p>'}
</section>
</body>
</html>
`;
  writeFileSync(outPath, html, 'utf8');
  return outPath;
}

// ---------- специфікація ----------

function loadSpec(spec, jsonDir) {
  if (!spec) return null;
  const candidates = [resolve(spec), resolve(jsonDir, spec), join(jsonDir, basename(spec))];
  for (const c of candidates) {
    if (existsSync(c)) {
      try {
        return readFileSync(c, 'utf8').split(/\r?\n/);
      } catch {
        /* наступний кандидат */
      }
    }
  }
  return null;
}

// ---------- параметри ----------

function groupParams(ep, bv) {
  const map = new Map();
  const get = (name) => {
    const k = name ?? '(без параметра)';
    if (!map.has(k)) map.set(k, { name: k, ep: [], bv: [] });
    return map.get(k);
  };
  ep.forEach((x) => get(x.parameter).ep.push(x));
  bv.forEach((x) => get(x.parameter).bv.push(x));
  for (const p of map.values()) {
    // числовий, якщо є хоч одна межа, у якої межа й усі три значення — одне число
    p.numericBv = p.bv.filter((b) => num(b.boundary) != null && arr(b.values).length && arr(b.values).every((v) => num(v.value) != null));
    p.numeric = p.numericBv.length > 0;
  }
  return [...map.values()];
}

// ---------- числова лінія ----------

function numberLine(p, testsOf, unknownsOf) {
  const W = 900, PAD = 40, AXIS_Y = 120;
  const bounds = p.numericBv.map((b) => ({ b, x: num(b.boundary) }));
  const points = p.numericBv.flatMap((b) => arr(b.values).map((v) => ({ b, v, x: num(v.value) })));
  const reps = p.ep.map((e) => ({ e, x: num(e.representative) })).filter((r) => r.x != null);

  const xs = [...bounds.map((b) => b.x), ...points.map((pt) => pt.x), ...reps.map((r) => r.x)];
  let lo = Math.min(...xs), hi = Math.max(...xs);
  const span = hi - lo || Math.abs(hi) || 1;
  lo -= span * 0.12;
  hi += span * 0.12;
  const sx = (v) => PAD + ((v - lo) / (hi - lo)) * (W - 2 * PAD);

  // регіони між унікальними межами; статус регіону — за значеннями BV, що строго всередині
  const cuts = [...new Set(bounds.map((b) => b.x))].sort((a, b) => a - b);
  const edges = [lo, ...cuts, hi];
  const regions = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i], z = edges[i + 1];
    const inside = points.filter((pt) => pt.x > a && pt.x < z).map((pt) => pt.v.expected);
    const repsIn = reps.filter((r) => r.x > a && r.x < z).map((r) => (r.e.valid === true ? 'valid' : r.e.valid === false ? 'invalid' : 'unknown'));
    const all = [...new Set([...inside, ...repsIn])];
    const status = all.length === 1 ? cls(all[0]) : all.length ? 'mixed' : 'none';
    regions.push({ a, z, status });
  }

  // розкладка підписів у ряди без накладання
  const place = (items, rowsY, minGap) => {
    const last = rowsY.map(() => -Infinity);
    return items
      .sort((m, n) => m.x - n.x)
      .map((it) => {
        const px = sx(it.x);
        let r = last.findIndex((lx) => px - lx >= minGap);
        if (r < 0) r = last.indexOf(Math.min(...last));
        last[r] = px;
        return { ...it, px, y: rowsY[r] };
      });
  };

  const svg = [];
  svg.push(`<svg viewBox="0 0 ${W} 210" role="img" aria-label="Числова лінія ${esc(p.name)}">`);
  // регіони
  for (const r of regions) {
    const x1 = sx(r.a), x2 = sx(r.z);
    svg.push(`<rect class="reg ${r.status}" x="${x1}" y="${AXIS_Y - 9}" width="${Math.max(0, x2 - x1)}" height="18"><title>${esc(fmt(r.a))} … ${esc(fmt(r.z))}: ${r.status}</title></rect>`);
  }
  svg.push(`<line class="axis" x1="${PAD - 10}" y1="${AXIS_Y}" x2="${W - PAD + 10}" y2="${AXIS_Y}"/>`);
  svg.push(`<path class="axis" d="M${W - PAD + 10} ${AXIS_Y} l-7 -4 v8z"/>`);

  // межі: вертикальна риска, підпис знизу з включністю
  const bLabels = place(
    bounds.map((b) => ({ ...b })),
    [AXIS_Y + 34, AXIS_Y + 50, AXIS_Y + 66],
    70,
  );
  for (const bl of bLabels) {
    const inc = bl.b.inclusive === true ? 'включно' : bl.b.inclusive === false ? 'невключно' : 'включність ?';
    const incCls = bl.b.inclusive == null ? 'unknown' : '';
    svg.push(`<line class="bound" x1="${bl.px}" y1="${AXIS_Y - 22}" x2="${bl.px}" y2="${AXIS_Y + 22}"/>`);
    svg.push(`<text class="blabel ${incCls}" x="${bl.px}" y="${bl.y}" text-anchor="middle"><tspan font-weight="600">${esc(bl.b.id)}</tspan> ${esc(fmt(bl.x))} · ${esc(inc)}<title>${esc(bl.b.boundary)} — крок ${esc(bl.b.step)} — рядок ${esc(bl.b.quote?.line)}</title></text>`);
  }

  // точки BV на осі
  const ptsDedup = new Map();
  for (const pt of points) {
    const k = `${pt.x}|${pt.v.expected}`;
    if (!ptsDedup.has(k)) ptsDedup.set(k, { ...pt, ids: [] });
    ptsDedup.get(k).ids.push(pt.b.id);
  }
  for (const pt of ptsDedup.values()) {
    svg.push(`<circle class="pt ${cls(pt.v.expected)}" cx="${sx(pt.x)}" cy="${AXIS_Y}" r="5.5"><title>${esc(pt.v.value)} → ${esc(pt.v.expected)} (${esc(pt.ids.join(', '))})</title></circle>`);
  }
  // значення точок над віссю
  const vLabels = place([...ptsDedup.values()].map((pt) => ({ ...pt })), [AXIS_Y - 18, AXIS_Y - 32], 26);
  for (const vl of vLabels) {
    svg.push(`<text class="vlabel" x="${vl.px}" y="${vl.y}" text-anchor="middle">${esc(fmt(vl.x))}</text>`);
  }

  // представники EP: трикутники вгорі
  const rLabels = place(reps.map((r) => ({ ...r })), [26, 44, 62], 64);
  for (const rl of rLabels) {
    const s = rl.e.valid === true ? 'valid' : rl.e.valid === false ? 'invalid' : 'unknown';
    svg.push(`<line class="lead" x1="${rl.px}" y1="${rl.y + 4}" x2="${rl.px}" y2="${AXIS_Y - 12}"/>`);
    svg.push(`<path class="rep ${s}" d="M${rl.px} ${AXIS_Y - 10} l-5 -8 h10z"><title>${esc(rl.e.id)}: ${esc(rl.e.class)} — представник ${esc(rl.e.representative)}</title></path>`);
    svg.push(`<text class="rlabel" x="${rl.px}" y="${rl.y}" text-anchor="middle"><tspan font-weight="600">${esc(rl.e.id)}</tspan> ${esc(fmt(rl.x))}</text>`);
  }
  svg.push('</svg>');

  return `<div class="param">
  <h3>${esc(p.name)}</h3>
  <div class="nl">${svg.join('\n')}</div>
  ${paramTables(p, testsOf, unknownsOf)}
</div>`;
}

function paramTables(p, testsOf, unknownsOf) {
  const epRows = p.ep
    .map(
      (e) => `<tr><td>${chip(e.id)}</td><td>${esc(e.class)}</td><td>${badge(e.valid === true ? 'valid' : e.valid === false ? 'invalid' : 'unknown')}</td>
<td>${esc(e.representative)}</td><td>${resp(e.response)}</td><td>${line(e.quote)}</td><td>${links(testsOf.get(e.id))}</td><td>${links(unknownsOf.get(e.id), '#')}</td></tr>`,
    )
    .join('');
  const bvRows = p.bv
    .map(
      (b) => `<tr><td>${chip(b.id)}</td><td>${esc(b.boundary)}</td><td>${b.inclusive === true ? 'так' : b.inclusive === false ? 'ні' : '<span class="u">?</span>'}</td><td>${esc(b.step)}</td>
<td>${arr(b.values).map((v) => `<span class="val ${cls(v.expected)}">${esc(v.value)}</span>${v.response ? `<small> → ${esc(v.response.value)}</small>` : ''}`).join(' ')}</td>
<td>${line(b.quote)}</td><td>${links(testsOf.get(b.id))}</td><td>${links(unknownsOf.get(b.id), '#')}</td></tr>`,
    )
    .join('');
  return `${
    p.ep.length
      ? `<table><thead><tr><th>EP</th><th>Клас</th><th></th><th>Представник</th><th>Response</th><th>Рядок</th><th>Тести</th><th>Unknowns</th></tr></thead><tbody>${epRows}</tbody></table>`
      : ''
  }${
    p.bv.length
      ? `<table><thead><tr><th>BV</th><th>Межа</th><th>Включно</th><th>Крок</th><th>Значення</th><th>Рядок</th><th>Тести</th><th>Unknowns</th></tr></thead><tbody>${bvRows}</tbody></table>`
      : ''
  }`;
}

// ---------- стан × дія ----------

function stTable(st, matrix, testsOf, unknownsOf) {
  if (st.not_applicable) return `<p class="note">Не застосовується: ${esc(st.not_applicable)}</p>`;
  const states = arr(st.states), actions = arr(st.actions);
  if (!states.length || !actions.length) return '<p class="empty">Станів або дій немає.</p>';
  const cell = new Map();
  const dupes = [];
  for (const c of matrix) {
    const k = `${c.from}\u0000${c.action}`;
    if (cell.has(k)) dupes.push(c.id);
    cell.set(k, c);
  }
  let missing = 0;
  const rows = states
    .map((s) => {
      const tds = actions
        .map((a) => {
          const c = cell.get(`${s}\u0000${a}`);
          if (!c) {
            missing++;
            return `<td class="cell missing" title="клітинки немає в matrix">—</td>`;
          }
          const tip = `${c.id}: ${c.from} × ${c.action} → ${c.result}${c.to ? ' → ' + c.to : ''}\nрядок ${c.quote?.line}: ${c.quote?.text ?? ''}`;
          return `<td class="cell ${cls(c.result)}" title="${esc(tip)}"><div class="cid">${esc(c.id)}</div>
<div>${c.result === 'legal' ? `→ <b>${esc(c.to)}</b>` : esc(c.result)}</div>
${c.response ? `<div class="small">${esc(c.response.value)}</div>` : ''}
<div class="small">${links(testsOf.get(c.id)) || '<span class="bad">без тесту</span>'}${unknownsOf.get(c.id) ? ' · ' + links(unknownsOf.get(c.id), '#') : ''}</div></td>`;
        })
        .join('');
      return `<tr><th>${esc(s)}</th>${tds}</tr>`;
    })
    .join('');
  const counts = ['legal', 'illegal', 'unknown'].map((r) => `${r}: ${matrix.filter((c) => c.result === r).length}`).join(' · ');
  const warn = [
    missing ? `бракує ${missing} клітинок` : '',
    dupes.length ? `дублікати пар: ${dupes.join(', ')}` : '',
    matrix.length !== states.length * actions.length ? `matrix має ${matrix.length} клітинок, очікується ${states.length}×${actions.length}=${states.length * actions.length}` : '',
  ].filter(Boolean);
  return `<p class="meta">${states.length} станів × ${actions.length} дій · ${counts}</p>
${warn.length ? `<p class="note bad">${warn.map(esc).join('; ')}</p>` : ''}
<div class="scroll"><table class="st"><thead><tr><th>стан \\ дія</th>${actions.map((a) => `<th>${esc(a)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ---------- трасування ----------

function traceTable(quotes, elements, testsOf, checkQuote) {
  // групування за (рядок, текст)
  const groups = new Map();
  for (const x of quotes) {
    const k = `${x.q?.line ?? '?'}\u0000${x.q?.text ?? ''}`;
    if (!groups.has(k)) groups.set(k, { q: x.q, owners: [] });
    groups.get(k).owners.push(x);
  }
  const sorted = [...groups.values()].sort((a, b) => (a.q?.line ?? 1e9) - (b.q?.line ?? 1e9));
  const mark = { ok: '<span class="good" title="дослівний підрядок рядка">✓</span>', bad: '<span class="bad" title="не знайдено в цьому рядку">✗</span>', missing: '<span class="bad" title="немає quote">✗</span>', nospec: '<span class="muted" title="специфікацію не знайдено">?</span>' };
  const rows = sorted
    .map((g) => {
      const owners = g.owners
        .map((o) => {
          const { item } = elements.get(o.ownerId);
          const what = describe(o.kind, item);
          return `<div>${chip(o.ownerId)}${o.role !== 'element' ? ` <small>(${esc(o.role)})</small>` : ''} <small class="muted">${esc(what)}</small></div>`;
        })
        .join('');
      const ts = [...new Set(g.owners.flatMap((o) => testsOf.get(o.ownerId) ?? []))];
      return `<tr><td class="num">${esc(g.q?.line ?? '—')}</td><td>${mark[checkQuote(g.q)]}</td><td><q>${esc(g.q?.text ?? '')}</q></td><td>${owners}</td><td>${links(ts) || '<span class="bad">—</span>'}</td></tr>`;
    })
    .join('');
  return `<div class="scroll"><table class="trace"><thead><tr><th>Рядок</th><th></th><th>Цитата</th><th>Елементи</th><th>Тести</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function describe(kind, item) {
  if (kind === 'EP') return `${item.parameter}: ${item.class} (${item.valid === true ? 'valid' : item.valid === false ? 'invalid' : '?'})`;
  if (kind === 'BV') return `${item.parameter}: межа ${item.boundary}`;
  return `${item.from} × ${item.action} → ${item.result}${item.to ? ' ' + item.to : ''}`;
}

function testsTable(tests, elements) {
  if (!tests.length) return '<p class="empty">Тестів немає.</p>';
  return `<table><thead><tr><th>Тест</th><th>Покриває</th></tr></thead><tbody>${tests
    .map((t) => `<tr id="${esc(t.id)}"><td>${chip(t.id)}</td><td>${arr(t.covers).map((id) => `${chip(id)}${elements.has(id) ? '' : '<span class="bad">!</span>'}`).join(' ')}</td></tr>`)
    .join('')}</tbody></table>`;
}

// ---------- дрібні шматки html ----------

function chip(id) {
  const k = String(id ?? '').split('-')[0];
  return `<span class="chip k-${esc(k)}">${esc(id)}</span>`;
}
function links(ids, prefix = '#') {
  if (!ids || !ids.length) return '';
  return [...new Set(ids)].map((id) => `<a href="${prefix}${esc(id)}">${chip(id)}</a>`).join(' ');
}
function badge(s) {
  return `<span class="badge ${cls(s)}">${esc(s)}</span>`;
}
function line(q) {
  if (!q) return '<span class="bad">немає</span>';
  return `<span title="${esc(q.text)}">${esc(q.line)}</span>`;
}
function resp(r) {
  return r ? `<span title="рядок ${esc(r.quote?.line)}: ${esc(r.quote?.text)}">${esc(r.value)}</span>` : '<span class="muted">—</span>';
}

// ---------- стилі ----------

const CSS = `
:root{--bg:#fff;--fg:#1d1d1f;--muted:#6b6b70;--line:#d9d9de;--card:#f6f6f8;
--valid:#2e8b57;--valid-bg:#e3f3ea;--invalid:#c8323c;--invalid-bg:#fbe4e5;--unknown:#c08a00;--unknown-bg:#fbf0d4;--mixed-bg:#ececf0;}
@media (prefers-color-scheme:dark){:root{--bg:#18181b;--fg:#ececef;--muted:#9a9aa2;--line:#3a3a40;--card:#232328;
--valid:#5cc48a;--valid-bg:#1f3a2b;--invalid:#ef6b73;--invalid-bg:#432328;--unknown:#e5b83a;--unknown-bg:#3f3518;--mixed-bg:#2e2e34;}}
*{box-sizing:border-box}
body{margin:0 auto;max-width:1100px;padding:24px;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--fg)}
h1{margin:0 0 4px;font-size:22px}h2{margin:36px 0 12px;font-size:18px;border-bottom:1px solid var(--line);padding-bottom:6px}
h3{margin:22px 0 8px;font-size:15px}
.meta{color:var(--muted);margin:4px 0}code{font-size:12.5px}
.stats{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.stat{background:var(--card);border-radius:8px;padding:8px 12px;min-width:86px;color:var(--muted);font-size:12px}
.stat span{display:block;font-size:20px;font-weight:600;color:var(--fg)}
.stat.good span{color:var(--valid)}.stat.bad span{color:var(--invalid)}.stat.warn span{color:var(--unknown)}
.legend{color:var(--muted);font-size:12px}.sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 10px;vertical-align:-1px}
.sw.valid{background:var(--valid)}.sw.invalid{background:var(--invalid)}.sw.unknown{background:var(--unknown)}
.param{background:var(--card);border-radius:10px;padding:4px 16px 12px;margin-bottom:18px}
.nl svg{width:100%;height:auto;display:block}
.axis{stroke:var(--fg);fill:var(--fg);stroke-width:1.2}
.reg{stroke:none}.reg.valid{fill:var(--valid-bg)}.reg.invalid{fill:var(--invalid-bg)}.reg.unknown{fill:var(--unknown-bg)}.reg.mixed,.reg.none{fill:var(--mixed-bg)}
.bound{stroke:var(--fg);stroke-width:1.6}
.pt{stroke:var(--bg);stroke-width:1.5}.pt.valid,.rep.valid{fill:var(--valid)}.pt.invalid,.rep.invalid{fill:var(--invalid)}.pt.unknown,.rep.unknown{fill:var(--unknown)}
.lead{stroke:var(--muted);stroke-dasharray:2 2}
text{fill:var(--fg);font-size:11.5px}.vlabel{fill:var(--muted);font-size:10.5px}.blabel.unknown{fill:var(--unknown)}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:13px}
th,td{border-bottom:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}
th{font-weight:600;color:var(--muted);font-size:12px}
.scroll{overflow-x:auto}
.st th{white-space:nowrap}.st tbody th{color:var(--fg)}
.cell{min-width:96px;border:1px solid var(--line);font-size:12px}
.cell.valid{background:var(--valid-bg)}.cell.invalid{background:var(--invalid-bg)}.cell.unknown{background:var(--unknown-bg)}
.cell.missing{background:repeating-linear-gradient(45deg,transparent 0 5px,var(--line) 5px 6px);text-align:center}
.cid{color:var(--muted);font-size:11px}.small{font-size:11px;margin-top:2px}
.chip{display:inline-block;padding:0 6px;border-radius:9px;font:600 11px/18px ui-monospace,Consolas,monospace;background:var(--line);color:var(--fg);white-space:nowrap}
.chip.k-EP{background:#dde7fb;color:#1c3f8a}.chip.k-BV{background:#efe0fa;color:#5b2385}.chip.k-ST{background:#dff3f3;color:#16615f}
.chip.k-T{background:#e9e9ee;color:#333}.chip.k-U{background:var(--unknown-bg);color:var(--unknown)}
@media (prefers-color-scheme:dark){.chip.k-EP{background:#23345a;color:#a9c3ff}.chip.k-BV{background:#3a2650;color:#d7b3f5}.chip.k-ST{background:#1c3c3b;color:#8fdcd8}.chip.k-T{background:#33333a;color:#ddd}}
a{text-decoration:none}
.badge{font-size:11px;padding:1px 6px;border-radius:4px}.badge.valid{background:var(--valid-bg);color:var(--valid)}
.badge.invalid{background:var(--invalid-bg);color:var(--invalid)}.badge.unknown{background:var(--unknown-bg);color:var(--unknown)}
.val{display:inline-block;padding:0 6px;border-radius:4px;margin:1px 2px 1px 0;font-size:12px}
.val.valid{background:var(--valid-bg);color:var(--valid)}.val.invalid{background:var(--invalid-bg);color:var(--invalid)}.val.unknown{background:var(--unknown-bg);color:var(--unknown)}
.u{color:var(--unknown);font-weight:600}
.trace q{font-family:ui-monospace,Consolas,monospace;font-size:12px;quotes:none}.num{text-align:right;color:var(--muted)}
.good{color:var(--valid);font-weight:600}.bad{color:var(--invalid);font-weight:600}.muted{color:var(--muted)}
.note{padding:8px 12px;border-radius:6px;background:var(--card)}.note.warn{background:var(--unknown-bg)}.note.bad{background:var(--invalid-bg)}
.empty{color:var(--muted);font-style:italic}
.unknowns li{margin-bottom:8px}.unknowns li:target{background:var(--unknown-bg)}.aff{margin-top:3px}
tr:target{background:var(--card)}
`;

main();
