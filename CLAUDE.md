# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This is a QA kit for **skypermit**. The application under test lives next to this repo at `../skypermit` and is **read-only** for us.

Claude is used here mainly to **generate test cases and test plans** based on the specs in the Confluence space **SkyPermit Docs** (data model, request lifecycle, API contract, frontend scope, business rules, clarifications, open questions, UML diagrams). It is **not** used to write automated tests.

## Source of specs: Confluence

The specs are no longer read from `../skypermit/docs/`. Read them through the Atlassian MCP server (`.mcp.json`):
- Site `olena-seletska.atlassian.net`, cloudId `c9a6e720-6440-4213-9958-60d9811da7d6`, space **SkyPermit Docs** (spaceId `131075`, key `~630f4fb43778a7aadf187453`).
- Pages: `01 — Data Model`, `02 — Request Lifecycle`, `03 — API Contract`, `04 — Frontend Scope`, `05 — Open Questions — Canonical Status`, `06 — Business Rules`, `07 — Clarifications — Answers From the Business Rules Owner`, `08 — UML Diagrams`.
- Use `searchConfluenceUsingCql` (filter by `space` and `title`/`text`) to find a section, then `getConfluencePage` to read it. Read only; never create or update pages or comments.
- Cite sources as `<page title> § <section>` (e.g. `06 — Business Rules § 1.2`).
- If Confluence is unreachable, say so and stop. Do not guess and do not fall back to `../skypermit/docs/`.

### Exception: `scripts/uncovered-rules.mjs`

This script cannot call MCP, so it keeps reading the local `../skypermit/docs/06-business-rules.md` (and `07-clarifications.md`). It is the only place that still uses local docs. Its list of `rule_reference` values can be stale if Confluence changed; test-case-creator and tc-verifier still check every rule against Confluence.

## Layout

```
workspace/
├── skypermit/                  # app under test (read-only)
└── skypermit-qa-kit-*/         # this repo
    ├── README.md
    ├── CLAUDE.md
    ├── test-cases/             # generated test cases, grouped by role, e.g. test-cases/operator/E2E-OP-001.md
    └── .claude/                # planned
        ├── settings.json       # shared project permissions
        ├── settings.local.json # personal settings, not committed
        ├── skills/             # planned: test-plan, test-case-creator (with examples/ and templates/)
        └── agents/             # planned: tc-verifier subagent
```

Only `README.md` and this file exist so far; the other directories are planned and should be created as needed.

## Rules for `../skypermit`

- Read only: never edit, create, delete, move or format files there.
- Do not run anything there that changes state: no `npm install`, builds, migrations, Supabase commands, test runs, or git operations that write (commit, checkout, stash, etc.).
- Use it only for reading code to clarify behavior, including `data-testid` selectors (search `app/` and `components/`). Specs come from Confluence (see above); the only local-docs exception is `scripts/uncovered-rules.mjs`.
- If the docs (Confluence) are ambiguous or contradict the code, record it as an open question in the output instead of changing anything there.
- All generated artifacts go in this repo, never in `../skypermit`.
