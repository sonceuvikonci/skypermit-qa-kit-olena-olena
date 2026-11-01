---
name: story-doc-check
description: Check ONE user story (one Jira task) against the documentation in the Confluence space SkyPermit Docs - one issue key per run. Input is a Jira issue key (e.g. SKY-1). For every acceptance criterion it finds where the docs describe it and gives a status - "покрито" (page, section, short quote), "суперечить" (what exactly and where) or "не описано" - then a table and a one-line summary. Use when the user asks to check, verify or cross-check a story/ticket/task against the docs or specs, find documentation gaps or contradictions in acceptance criteria, or asks "is this AC described anywhere" - before writing test cases or starting work on the task. Do NOT use for several stories at once (an epic, a sprint, a JQL list - run it once per story), to generate test cases (test-case-creator), test plans (test-plan), to verify an existing test case (tc-verifier), to check code against the docs, or to edit anything in Jira or Confluence. Read-only.
argument-hint: "<issue key, e.g. SKY-1>"
allowed-tools: mcp__atlassian__getJiraIssue, mcp__atlassian__getConfluencePage, mcp__atlassian__searchConfluenceUsingCql, mcp__atlassian__getPagesInConfluenceSpace
---

# Story ↔ docs check

Input: **one** Jira issue key. Output: a table with one row per acceptance criterion of that one story and a one-line summary.

If the user gives several keys, an epic, or a JQL query, do not batch them: ask which single story to check first (or offer to run the skill once per key, one after another, each with its own table).

## Rules

- **Read-only.** Never create or edit Jira issues, comments, or Confluence pages.
- **The only source of truth is the documentation** (Confluence space SkyPermit Docs). Do not fill gaps from your own knowledge, from `../skypermit` code, or from local files. If the docs do not say it, the status is «не описано», even if the behaviour looks obvious or the code does it.
- If Jira or Confluence is unreachable, say so and stop. Do not guess.
- Do not judge the criteria's quality or suggest rewrites. Only report what the docs say.

## Steps

1. **Read the issue** with `getJiraIssue` (site `olena-seletska.atlassian.net`, cloudId `c9a6e720-6440-4213-9958-60d9811da7d6`, `responseContentFormat: markdown`). Extract the acceptance criteria (the "Acceptance criteria" section; if absent, say so and stop). Keep their numbering and wording. Note the "Правило" and "Вимоги" sections: they are hints about where to look, not proof. Check them like any other claim.
2. **List the space's pages** (`searchConfluenceUsingCql` with `space = "~630f4fb43778a7aadf187453" AND type = page`, or `getPagesInConfluenceSpace`). The relevant pages are usually `01 — Data Model`, `02 — Request Lifecycle`, `03 — API Contract`, `04 — Frontend Scope`, `05 — Open Questions — Canonical Status`, `06 — Business Rules`, `07 — Clarifications — Answers From the Business Rules Owner`, `08 — UML Diagrams`.
3. **Read the pages** that can bear on the criteria with `getConfluencePage` (`contentFormat: markdown`). Always read `07` and `05` when the topic touches a rule: they override `06`/`03` where they conflict (`07` states it governs over `06`). Do not stop at the first match: a criterion often touches several pages (rule in `06`, response shape in `03`, UI in `04`, state in `02`).
4. **Split compound criteria.** If one criterion contains several claims (e.g. "shows gate X failed" and "cites rule Y"), judge each claim; the row status is the weakest one, and the notes say which part drives it.
5. **Assign a status per criterion**:
   - **покрито**: every claim of the criterion is stated in the docs, directly or by a direct consequence of stated rules (say "випливає з ..." if it is a consequence, and name the rules it follows from). Give page, section, and a short quote.
   - **суперечить**: the docs state something incompatible with the criterion, or two docs disagree on what the criterion depends on. Say what exactly contradicts what and where (both sides with page and section).
   - **не описано**: the docs do not state it, or state only part of it. Name what is missing. If a criterion is partly described, use «не описано» and say which part is covered and which is not; do not round up to «покрито».
6. **Collect side findings** only if they come from the docs and bear on the criteria: undefined boundaries, ambiguous wording, open questions from `05`, dependencies a test would need (e.g. a precondition the docs impose). Keep them to a short list under the table.

## Output

Reply in the language of the issue (Ukrainian for Ukrainian issues). Format:

```
**<KEY> — <summary>**

| # | Критерій | Статус | Де в документації | Примітка |
|---|---|---|---|---|
| 1 | <short wording> | покрито / суперечить / не описано | `<page> § <section>`: «<short quote>» | <what is missing or contradicts> |

**Підсумок:** <N> критеріїв: <a> покрито, <b> суперечить, <c> не описано.
```

- Cite sources as `<page title> § <section>` (e.g. `06 — Business Rules § 1.4`). Quotes are short and verbatim from the page; do not paraphrase inside quotation marks.
- For «не описано» put "—" in the "Де" column, or the closest page and section with what it covers, and say in the note what it does not cover.
- The summary is **one line**. No recommendations after it unless the user asks.
- If there are extra findings from step 6, put them in a short list between the table and the summary, titled «Також у документації».
