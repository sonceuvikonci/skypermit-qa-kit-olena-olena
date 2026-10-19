# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This is a QA kit for **skypermit**. The application under test lives next to this repo at `../skypermit` and is **read-only** for us.

Claude is used here mainly to **generate test cases and test plans** based on the specs in `../skypermit/docs/` (data model, state machine, API contract, frontend spec, business rules, clarifications, open questions, UML diagrams). It is **not** used to write automated tests.

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
- Use it only as a source of truth for specs (`docs/`) and, when needed, for reading code to clarify behavior.
- If the docs are ambiguous or contradict the code, record it as an open question in the output instead of changing anything there.
- All generated artifacts go in this repo, never in `../skypermit`.
