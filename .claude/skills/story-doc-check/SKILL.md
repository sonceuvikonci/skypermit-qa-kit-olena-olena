---
name: story-doc-check
description: Check ONE user story against the documentation in the Confluence space SkyPermit Docs - one JSON record per run. Input is the JSON produced by the jira-intake skill (key, title, check_type, acceptance_criteria, confluence_url, notes), given as a path to a saved file (intake/<KEY>.json), as an issue key whose intake file is already saved, or as pasted JSON; the skill does not read Jira itself. For every acceptance criterion it finds where the docs describe it and gives a status - "покрито" (page, section, short quote), "суперечить" (what exactly and where) or "не описано" - then a table and a one-line summary. Use when the user passes an intake JSON (or a story already taken in by jira-intake) and asks to check, verify or cross-check it against the docs or specs, find documentation gaps or contradictions in acceptance criteria, or asks "is this AC described anywhere" - before writing test cases or starting work on the task. Do NOT use when the key has no saved intake file (run jira-intake first), for several stories at once (run it once per JSON), to generate test cases (ui-test-case-creator), test plans (test-plan), to verify an existing test case (tc-verifier), to check code against the docs, or to edit anything in Jira or Confluence. Read-only.
argument-hint: "<path to intake/<KEY>.json | issue key | JSON from jira-intake>"
allowed-tools: Read, mcp__atlassian__getConfluencePage, mcp__atlassian__searchConfluenceUsingCql, mcp__atlassian__getPagesInConfluenceSpace
---

# Story ↔ docs check

Input: **one** JSON object from `jira-intake`. Output: a table with one row per acceptance criterion of that story and a one-line summary.

Expected input shape:

```json
{
  "key": "SKY-1",
  "title": "...",
  "check_type": "ui | api | null",
  "acceptance_criteria": ["...", "..."],
  "confluence_url": "https://... | null",
  "notes": ["..."]
}
```

## Input handling

- **This skill does not read Jira.** Never call Jira tools and never re-fetch the issue. The JSON is the only description of the story.
- Get the JSON from, in this order:
  1. a path to a file (e.g. `intake/SKY-1.json`): read it with `Read`;
  2. an issue key (e.g. `SKY-1`): read the saved `intake/<KEY>.json` with `Read` (never fetch from Jira);
  3. JSON pasted in the message, or the preceding `jira-intake` output in the conversation.
  If the file for the key does not exist, say so and tell the user to run `jira-intake` for that key first. Read only files in `intake/`; never write anything.
- If the input is an array, several objects, several keys or several paths, do not batch: ask which single story to check first (or offer to run the skill once per object, each with its own table).
- Validate before working: it must be parseable JSON with `key`, `title` and a non-empty `acceptance_criteria` array of strings. If it is not valid, or `acceptance_criteria` is empty or missing, say what is wrong and stop. Do not repair or invent criteria.
- Missing optional fields (`check_type`, `confluence_url`, `notes`) are treated as `null` / `[]`.

## Rules

- **Read-only.** Never create or edit Jira issues, comments, or Confluence pages.
- **The only source of truth is the documentation** (Confluence space SkyPermit Docs). Do not fill gaps from your own knowledge, from `../skypermit` code, or from local files. If the docs do not say it, the status is «не описано», even if the behaviour looks obvious or the code does it.
- If Confluence is unreachable, say so and stop. Do not guess.
- Do not judge the criteria's quality or suggest rewrites. Only report what the docs say.
- Fields other than `acceptance_criteria` are context, not proof:
  - `confluence_url` and quotes in `notes` (e.g. "Правило", "Вимоги", a textual mention of a page) are hints about where to look. Check them like any other claim; the docs decide the status.
  - `check_type` (`ui` / `api`) only narrows where to look first (`04 — Frontend Scope` for `ui`, `03 — API Contract` for `api`). It does not limit the search: a criterion often touches other pages too. If `null`, do not infer it.

## Steps

1. **Parse the JSON** (see Input handling). Keep the criteria's numbering (1..N by array order) and wording.
2. **List the space's pages** (`searchConfluenceUsingCql` with `space = "~630f4fb43778a7aadf187453" AND type = page`, or `getPagesInConfluenceSpace`; site `olena-seletska.atlassian.net`, cloudId `c9a6e720-6440-4213-9958-60d9811da7d6`). The relevant pages are usually `01 — Data Model`, `02 — Request Lifecycle`, `03 — API Contract`, `04 — Frontend Scope`, `05 — Open Questions — Canonical Status`, `06 — Business Rules`, `07 — Clarifications — Answers From the Business Rules Owner`, `08 — UML Diagrams`.
3. **Read the pages** that can bear on the criteria with `getConfluencePage` (`contentFormat: markdown`). If `confluence_url` is set and points into this space, read that page too (it is a pointer, not an override). Always read `07` and `05` when the topic touches a rule: they override `06`/`03` where they conflict (`07` states it governs over `06`). Do not stop at the first match: a criterion often touches several pages (rule in `06`, response shape in `03`, UI in `04`, state in `02`).
4. **Split compound criteria.** If one criterion contains several claims (e.g. "shows gate X failed" and "cites rule Y"), judge each claim; the row status is the weakest one, and the notes say which part drives it.
5. **Assign a status per criterion**:
   - **покрито**: every claim of the criterion is stated in the docs, directly or by a direct consequence of stated rules (say "випливає з ..." if it is a consequence, and name the rules it follows from). Give page, section, and a short quote.
   - **суперечить**: the docs state something incompatible with the criterion, or two docs disagree on what the criterion depends on. Say what exactly contradicts what and where (both sides with page and section).
   - **не описано**: the docs do not state it, or state only part of it. Name what is missing. If a criterion is partly described, use «не описано» and say which part is covered and which is not; do not round up to «покрито».
6. **Collect side findings** only if they come from the docs (or from the intake `notes`, marked as such) and bear on the criteria: undefined boundaries, ambiguous wording, open questions from `05`, dependencies a test would need (e.g. a precondition the docs impose), a `confluence_url` that does not lead to a page of this space or does not contain what the story points at. Keep them to a short list under the table.

## Output

Reply in the language of the issue (Ukrainian for Ukrainian issues). Format:

```
**<key> — <title>**

| # | Критерій | Статус | Де в документації | Примітка |
|---|---|---|---|---|
| 1 | <short wording> | покрито / суперечить / не описано | `<page> § <section>`: «<short quote>» | <what is missing or contradicts> |

**Підсумок:** <N> критеріїв: <a> покрито, <b> суперечить, <c> не описано.
```

- Cite sources as `<page title> § <section>` (e.g. `06 — Business Rules § 1.4`). Quotes are short and verbatim from the page; do not paraphrase inside quotation marks.
- For «не описано» put "—" in the "Де" column, or the closest page and section with what it covers, and say in the note what it does not cover.
- The summary is **one line**. No recommendations after it unless the user asks.
- If there are extra findings from step 6, put them in a short list between the table and the summary, titled «Також у документації».
