---
name: story-to-tests
description: Orchestrator for ONE UI user story from Jira to approved test cases in Testomat.io. Runs jira-intake, then story-doc-check and implementation-check (stops with a report and asks whether to continue), then writes cases with ui-test-case-creator and verifies each with tc-verifier, shows the cases and asks for approval, and only after approval writes them to Testomat.io and creates a run via testomat-sync. Stops at once if check_type is not ui (API stories get a separate flow). Run manually as /story-to-tests <ISSUE-KEY>.
argument-hint: "<ISSUE-KEY>"
disable-model-invocation: true # long flow that writes to Testomat.io: manual /story-to-tests only
allowed-tools: Read Grep Glob Write(intake/**) Write(test-cases/**) Write(reports/**) Edit(test-cases/open-questions.md) Skill(jira-intake) Skill(story-doc-check) Skill(ui-test-case-creator) Skill(testomat-sync) Agent(implementation-check) Agent(tc-verifier) mcp__atlassian__getJiraIssue mcp__atlassian__getConfluencePage mcp__atlassian__searchConfluenceUsingCql mcp__atlassian__getPagesInConfluenceSpace
---

# Story to tests

Takes **one** UI story from Jira to approved test cases in Testomat.io. This skill only sequences the steps and holds the two stops; the work itself is done by the skills and agents below. It does not call `mcp__testomatio__*` tools itself.

| Step | Performed by |
|---|---|
| 1. Intake | `jira-intake` skill |
| 2. Story check | `story-doc-check` skill + `implementation-check` agent |
| 3. Cases | `ui-test-case-creator` skill, each case verified by `tc-verifier` agent |
| 4. Approval gate | this session, with the user |
| 5. Testomat.io | `testomat-sync` skill (`upsert`, then `run`) |

## Rules

- **Exactly one issue key** per run. If the user gave none or several, ask which one to take. Do not batch.
- **Two stops are mandatory** (after step 2 and at step 4). Wait for an explicit answer each time. Silence, or an answer about something else, is not consent.
- **Nothing is written to Testomat.io before the step 4 approval.**
- Read-only for Jira, Confluence and `../skypermit`. Local writes only: `intake/`, `test-cases/`, `reports/story-to-tests/`.
- Do not fill gaps from your own knowledge. If the docs are silent or contradict the code, say so and record it as an open question.
- If Confluence, Jira or Testomat.io is unreachable, say so and stop. Do not guess.

## Steps

### 1. Intake

1. Run `jira-intake` for the key. Result: `intake/<KEY>.json`.
2. Check `check_type`:
   - not `ui` (`api` or `null`): **stop.** Say: "check_type is `<value>`. This flow covers UI stories only; API stories will get a separate flow." Do not infer the type from the title or text, and do not continue.
   - `acceptance_criteria` empty or missing: **stop** and say so.
3. Show a short intake summary: key, title, number of AC, `confluence_url` (or none).

### 2. Story check, then stop

1. Run `story-doc-check` and `implementation-check` on `intake/<KEY>.json`. They are independent: start them together.
2. Merge into one report: a table with one row per AC (number, AC text, docs status, code status), then the side findings from both (undefined boundaries, open questions from `05`, `confluence_url` problems, contradictions).
3. Save it to `reports/story-to-tests/<KEY>.md`.
4. Mark the AC that are not clean: docs status «суперечить» or «не описано», code status `partial` or `not_found`. Do not silently drop any AC.
5. **Stop.** Show the report and ask: "Continue?" Ask which of the marked AC to keep or leave out. If the answer is no, finish here and say where the report is.
   - If the overall `implementation-check` verdict is `not_implemented`, do not go to step 3 even after the answer "Continue". Stop and explain: which AC have no implementation; what is missing in the docs (page + section) and in the code (which files were checked); which open questions were recorded. Write no cases and send nothing to Testomat.io. Save the report to `reports/story-to-tests/<KEY>.md`.

### 3. Cases and verification

Source for the cases: the page that `confluence_url` / the intake notes point at (a hint, not an override) plus the pages the docs-check found for each AC. When `07` or `05` touch the rule, they govern over `06`.

For each AC the user kept, one at a time:

1. Write the case(s) with `ui-test-case-creator` into `test-cases/<role>/`. Default is one case per AC; more than one is allowed when BV, EP or state-transition applies to that AC. Do not touch the existing cases' IDs.
2. Verify the case with `tc-verifier` right after writing it, not once at the end.
3. Verdict handling:
   - matches → keep.
   - does not match → one fix, then verify again. Still does not match → **leave the case out of the final set** and put the reason in the report. Do not send it on.
     Exception: skip the fix round only when `tc-verifier` says "does not match" because the feature is in neither the spec nor the code, not because of a mistake in the case. Record that reason in the report. In all other cases the rule above stays as is.
   - the specs are ambiguous or contradict the code → add an entry to `test-cases/open-questions.md`; the case stays only if the verifier accepts it.
4. Add the verdicts to `reports/story-to-tests/<KEY>.md`.

### 4. Approval gate

1. Show the final set: a table with case ID, title, priority, AC number, tc-verifier verdict. Also list the AC with no case and why.
2. Ask: "Approve these cases for Testomat.io?"
3. Answer handling:
   - explicit yes → step 5.
   - changes requested → fix, re-verify the touched cases with `tc-verifier`, show the set again, ask again.
   - no → finish; the cases stay in `test-cases/`, nothing is sent.
4. After the answer (yes, changes or no), append the section `## Step 4: approval` to `reports/story-to-tests/<KEY>.md`: the set that was shown (case IDs), the question asked, the user's answer. Do this before step 5 starts. If something is not known, write «не зафіксовано»; do not invent it.

### 5. Testomat.io (only after approval)

1. `testomat-sync upsert`: `issue_key` = key, `suite` = the story title, `cases[]` from the approved files (pass the file paths; do not rewrite their wording).
2. `testomat-sync run`: `run_title` = `<KEY> · UI`, `kind` = `manual`, `test_ids` from the upsert result.
3. Do **not** run `report`: there are no execution results yet.
4. Reply with: per case `created` / `reused` / `updated`, any `duplicates` (reported, never deleted), the `run_id` and the run URL. If a count does not match (cases vs. `tests_count`), say so.
5. After `testomat-sync`, append the section `## Step 5: Testomat.io` to `reports/story-to-tests/<KEY>.md`: per case `created` / `reused` / `updated` with `test_id`, `duplicates`, `run_id`, the run URL, and the check of `tests_count` against the number of approved cases (match / mismatch). Use only data returned by `testomat-sync`; if a value is missing, write «не зафіксовано».

## Output

At the end, give the user: the path to `reports/story-to-tests/<KEY>.md`, the approved case IDs, the open questions added, and the Testomat.io run link (or why the flow stopped earlier).

The report is **not complete** without the sections `Step 4: approval` and (if the flow reached Testomat.io) `Step 5: Testomat.io`. Before the final reply, re-read `reports/story-to-tests/<KEY>.md` and check that they are there. If one is missing, add it first; if the flow stopped earlier, state in the report which step it stopped at and what was not done.
