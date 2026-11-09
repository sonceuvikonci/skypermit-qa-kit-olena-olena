---
name: story-to-api-tests
description: Orchestrator for ONE API user story from Jira to an executed Postman run reported in Testomat.io. Runs jira-intake, then story-doc-check and implementation-check (stops with a report and asks whether to continue), then writes cases with api-test-case-creator and verifies each with tc-verifier (mode api), shows the cases and asks for approval, after approval writes them to Testomat.io and creates the run "<KEY> · API" via testomat-sync, builds a Postman collection with postman-collection-builder, stops for the user's review in Postman, and only after "запускай" runs it with postman-cli-run and reports the results via testomat-sync. Stops at once if check_type is not api (UI stories go to /story-to-tests). Run manually as /story-to-api-tests <ISSUE-KEY>.
argument-hint: "<ISSUE-KEY>"
disable-model-invocation: true # long flow that writes to Testomat.io and Postman and runs requests: manual /story-to-api-tests only
allowed-tools: Read Grep Glob Write(intake/**) Write(test-cases/**) Write(reports/**) Edit(test-cases/open-questions.md) Skill(jira-intake) Skill(story-doc-check) Skill(api-test-case-creator) Skill(testomat-sync) Skill(postman-collection-builder) Skill(postman-cli-run) Agent(implementation-check) Agent(tc-verifier) mcp__atlassian__getJiraIssue mcp__atlassian__getConfluencePage mcp__atlassian__searchConfluenceUsingCql mcp__atlassian__getPagesInConfluenceSpace
---

# Story to API tests

Takes **one** API story from Jira to approved API test cases in Testomat.io, a Postman collection, and an executed run whose results are reported in Testomat.io. This skill only sequences the steps and holds the three stops; the work itself is done by the skills and agents below. It does not call `mcp__testomatio__*` or `mcp__postman__*` tools itself and does not run `postman` itself.

| Step | Performed by |
|---|---|
| 1. Intake | `jira-intake` skill |
| 2. Story check | `story-doc-check` skill + `implementation-check` agent |
| 3. Cases | `api-test-case-creator` skill, each case verified by `tc-verifier` agent with `mode: api` |
| 4. Approval gate | this session, with the user |
| 5. Testomat.io | `testomat-sync` skill (`upsert`, then `run`) |
| 6. Collection + review gate | `postman-collection-builder` skill, then `postman-cli-run` steps 1–3 (preflight, command), this session with the user |
| 7. Run + report | `postman-cli-run` steps 4–7, then `testomat-sync report` |

## Rules

- **Exactly one issue key** per run. If the user gave none or several, ask which one to take. Do not batch.
- **Three stops are mandatory** (after step 2, at step 4, at step 6). Wait for an explicit answer each time. Silence, or an answer about something else, is not consent.
- **Nothing is written to Testomat.io before the step 4 approval.**
- **Nothing is run before «запускай».** It counts only if the user writes it in this conversation **after** seeing the exact Postman CLI command at step 6. "ок", "давай", or a «запускай» given for an earlier command does not count. A re-run needs a new command shown and a new «запускай».
- **Nothing is fixed to make a test pass.** Failures are reported to Testomat.io as they are. No edits to cases, collection, environment or `../skypermit` after the run.
- **No secrets.** Ask only for the names of shell variables (e.g. `operatorPassword=SKY_OPERATOR_PASSWORD`), never for their values.
- Read-only for Jira, Confluence and `../skypermit`. Local writes only: `intake/`, `test-cases/`, `reports/story-to-api-tests/`; plus what the called skills write themselves (`postman/<KEY>/`, `api-automation/runs/`).
- Do not fill gaps from your own knowledge. If the docs are silent or contradict the code, say so and record it as an open question.
- If Confluence, Jira, Testomat.io or Postman is unreachable, say so and stop. Do not guess.

## Steps

### 1. Intake

1. Run `jira-intake` for the key. Result: `intake/<KEY>.json`.
2. Check `check_type`:
   - `ui`: **stop.** Say: "check_type is `ui`. This flow covers API stories only; run `/story-to-tests <KEY>` instead." Do not continue.
   - anything else that is not `api` (`null`, missing, unknown): **stop.** Say: "check_type is `<value>`. This flow needs `api` (set by the issue's label)." Do not infer the type from the title or text.
   - `acceptance_criteria` empty or missing: **stop** and say so.
3. Show a short intake summary: key, title, number of AC, `confluence_url` (or none).

### 2. Story check, then stop

1. Run `story-doc-check` and `implementation-check` on `intake/<KEY>.json`. They are independent: start them together.
2. Merge into one report: a table with one row per AC (number, AC text, docs status, code status, **business rule** the docs-check found for the AC, e.g. `06 — Business Rules § 2.1`), then the side findings from both (undefined boundaries, open questions from `05`, `confluence_url` problems, contradictions).
3. Save it to `reports/story-to-api-tests/<KEY>.md`.
4. Mark the AC that are not clean: docs status «суперечить» or «не описано», code status `partial` or `not_found`, or no business rule found. Do not silently drop any AC.
5. **Stop.** Show the report and ask: "Continue?" Ask which of the marked AC to keep or leave out. If the answer is no, finish here and say where the report is.
   - If the overall `implementation-check` verdict is `not_implemented`, do not go to step 3 even after the answer "Continue". Stop and explain: which AC have no implementation; what is missing in the docs (page + section) and in the code (which files were checked); which open questions were recorded. Write no cases and send nothing to Testomat.io. Save the report to `reports/story-to-api-tests/<KEY>.md`.

### 3. Cases and verification

Source for the cases: the page that `confluence_url` / the intake notes point at (a hint, not an override) plus the pages the docs-check found for each AC. When `07` or `05` touch the rule, they govern over `06`. Endpoints and status codes come from `03 — API Contract`.

`api-test-case-creator` takes **one business rule** per call. For each AC the user kept, one at a time:

1. Take the business rule mapped to the AC in step 2. If an AC has no rule, do not invent one: leave the AC without cases and say why in the report. If several AC map to the same rule, call the creator once for that rule and list all those AC against its cases.
2. Write the case(s) with `api-test-case-creator` into `test-cases/api/` (`API-OP-<NNN>.md`). It decides BV / EP single checks and state-transition chains. Do not touch the existing cases' IDs.
3. Verify each case with `tc-verifier` and `mode: api` right after writing it, not once at the end.
4. Verdict handling:
   - matches → keep.
   - does not match → one fix, then verify again. Still does not match → **leave the case out of the final set** and put the reason in the report. Do not send it on.
     Exception: skip the fix round only when `tc-verifier` says "does not match" because the feature is in neither the spec nor the code, not because of a mistake in the case. Record that reason in the report. In all other cases the rule above stays as is.
   - the specs are ambiguous or contradict the code → add an entry to `test-cases/open-questions.md`; the case stays only if the verifier accepts it.
5. Add the verdicts to `reports/story-to-api-tests/<KEY>.md`.

### 4. Approval gate

1. Show the final set: a table with case ID, title, priority, AC number, business rule, technique (BV / EP / state transition), tc-verifier verdict. Also list the AC with no case and why.
2. Ask: "Approve these cases for Testomat.io?"
3. Answer handling:
   - explicit yes → step 5.
   - changes requested → fix, re-verify the touched cases with `tc-verifier` (`mode: api`), show the set again, ask again.
   - no → finish; the cases stay in `test-cases/api/`, nothing is sent.
4. After the answer (yes, changes or no), append the section `## Step 4: approval` to `reports/story-to-api-tests/<KEY>.md`: the set that was shown (case IDs), the question asked, the user's answer. Do this before step 5 starts. If something is not known, write «не зафіксовано»; do not invent it.

### 5. Testomat.io: upsert and run (only after approval)

1. `testomat-sync upsert`: `issue_key` = key, `suite` = the story title, `cases[]` from the approved files (pass the file paths; do not rewrite their wording). API cases are created with `state: "automated"`.
2. Save the upsert result as is to `reports/story-to-api-tests/<KEY>-upsert.json` (it is passed to `postman-cli-run` in step 7).
3. `testomat-sync run`: `run_title` = `<KEY> · API`, `kind` = `automated`, `test_ids` from the upsert result. `testomat-sync` creates an `automated` run **empty** (its rule 5); keep the planned `test_ids` for `report`. Expect `tests_count: 0`.
4. Do **not** run `report` yet: there are no execution results.
5. Append the section `## Step 5: Testomat.io` to `reports/story-to-api-tests/<KEY>.md`: per case `created` / `reused` / `updated` with `test_id`, `duplicates` (reported, never deleted), `run_id`, the run URL, `kind`, the planned `test_ids`, and the check of `tests_count` (0 expected for `automated`; anything else = mismatch). Use only data returned by `testomat-sync`; if a value is missing, write «не зафіксовано».

### 6. Postman collection, then review gate

1. Run `postman-collection-builder` for **all** approved case IDs in one collection: name `<KEY> · API cases`, local copy `postman/<KEY>/<KEY>-api.postman_collection.json`, plus its build report. Let it reuse or create the environment by its own rules. If it skips a case (not `Level: API`, no matching path in `openapi.yaml`), carry that into the report; the case gets no result later.
2. Run `postman-cli-run` steps 1–3 for that local collection and environment: preflight (upload guard: CLI logged out, `POSTMAN_API_KEY` not set; secret shell variables set) and the exact command. Ask the user for the shell variable **names** for each secret the build report lists if they were not given.
   - If the upload guard fails, stop as `postman-cli-run` says (the user logs out in their own terminal) and wait; then repeat the preflight.
3. **Stop.** In one message show: collection name and uid, environment name and uid, the build report path, its warnings (time boundaries) and open questions, and the exact command from `postman-cli-run`. Ask the user to review the collection in Postman and write «запускай» when ready.
4. Answer handling:
   - «запускай» (after this command) → step 7.
   - changes requested → do not edit the existing collection (`postman-collection-builder` is create-only). Build a **new** collection with a new name (suffix `v2`, …) and new local file, repeat 6.2–6.3, ask again. If the change is in a case, go back to step 3 for that case (fix + `tc-verifier`), then step 4 approval and step 5 upsert for it, before building again.
   - no / stop → finish. The Testomat.io run from step 5 stays open and empty; do not delete it. Say so in the report.
5. Append the section `## Step 6: collection review` to `reports/story-to-api-tests/<KEY>.md`: collection name, uid and local path, environment, build report path, the command shown (secrets as `***`), the user's answer.

### 7. Run and report (only after «запускай»)

1. Run `postman-cli-run` steps 4–7 with exactly the command shown, passing `reports/story-to-api-tests/<KEY>-upsert.json` as the upsert result so `test_id` is filled. Its hard rules apply as written (no fixes, no reruns, redaction, secret check, upload check).
   - If `summarize.mjs` could not parse the report (exit `3`) or a secret check failed, stop: do **not** call `report`, do not build results by hand. Record it in the report.
2. `testomat-sync report`: `run_id` from step 5, `results` = the `api-automation/runs/<slug>-<stamp>-results.json` path from `postman-cli-run`, plus the planned `test_ids` from step 5. Statuses and messages go in exactly as given (`failed` with its message, `skipped` with `Blocked: ...`). The run is closed even with failures.
3. Append the section `## Step 7: run & report` to `reports/story-to-api-tests/<KEY>.md`: run log path(s) in `api-automation/runs/`, exit code, uploaded to Postman Cloud (no / YES), per case status and message, Testomat counts (passed / failed / skipped), the check that their sum equals the number of results and that `tests_count` equals it too, planned tests with no result, closed status, run URL. Use only data returned by the two skills; if a value is missing, write «не зафіксовано».

## Output

At the end, give the user: the path to `reports/story-to-api-tests/<KEY>.md`, the approved case IDs, the open questions added, the collection name and local path, the run results per case, and the Testomat.io run link (or at which step the flow stopped and why).

The report is **not complete** without the sections `Step 4: approval`, and, if the flow reached them, `Step 5: Testomat.io`, `Step 6: collection review` and `Step 7: run & report`. Before the final reply, re-read `reports/story-to-api-tests/<KEY>.md` and check that they are there. If one is missing, add it first; if the flow stopped earlier, state in the report which step it stopped at and what was not done (e.g. "run `<run_id>` left open and empty: no «запускай»").
