---
name: testomat-sync
description: >-
  The single place for all work with Testomat.io (MCP server `testomatio`) - used by both orchestrators, UI and API. Three operations. upsert - finds or creates the suite, and for each test case looks for an existing test titled "<case_id>: ..." and reuses it instead of creating a duplicate; new tests get a tag with the Jira key. run - creates a run with those tests and returns run_id. report - writes results into the run, failures included, and closes the run. Use whenever test cases (test-cases/*.md) must be written to, run in, or reported to Testomat.io, e.g. "запиши кейси у Testomat", "створи ран", "дпиши результати в ран". Do NOT use to generate test cases (ui-test-case-creator), to read specs, or to touch Jira/Confluence.
argument-hint: "upsert|run|report <args>"
allowed-tools: mcp__testomatio__project_info, mcp__testomatio__suites_list, mcp__testomatio__suites_create, mcp__testomatio__tests_list, mcp__testomatio__tests_get, mcp__testomatio__tests_create, mcp__testomatio__tests_update, mcp__testomatio__runs_create, mcp__testomatio__runs_get, mcp__testomatio__runs_update, mcp__testomatio__testruns_list, mcp__testomatio__testruns_create, mcp__testomatio__testruns_update, Read
---

# testomat-sync

All Testomat.io work lives here. Orchestrators call one of three operations and pass plain data; they do not call `mcp__testomatio__*` tools themselves.

Lessons from the first manual run, now rules:

1. **Never trust an error as "nothing was created".** `tests_create` once returned `400 Validation failed: Jiraproject must exist` and still created the test (only the link failed). Retrying then made 7 duplicates. After **any** error or timeout on a create call, run `tests_list` to check before retrying.
2. **Never use `link` of type `jira`.** The project has no Jira integration. Use `type: "tag"` with the issue key.
3. **A suite that holds tests must be `file_type: "file"`.** A `folder` rejects tests (`422 Can't save test into a folder suite`).
4. Testomat shows tags inside the title (`... @SKY-1`). Match cases by the `<case_id>:` prefix only, never by the full title.

## Input contract

Operations take plain fields (a JSON object or the same stated in prose):

| Field | Used by | Meaning |
|---|---|---|
| `issue_key` | upsert, run | Jira key, e.g. `SKY-1`. Becomes the tag on new tests. |
| `suite` | upsert | Suite title, e.g. `Flight request`. |
| `cases[]` | upsert | Per case: `case_id` (e.g. `TC-UIOP-001`), `title` (the part after `<case_id>: `), `priority` (`low\|normal\|important\|high\|critical`), `description` (Markdown body). |
| `run_title` | run | e.g. `SKY-1 · UI` or `SKY-1 · API`. |
| `kind` | run | `manual` (default), `automated` or `mixed`. |
| `test_ids[]` | run | Testomat test ids, taken from the `upsert` result. |
| `run_id` | report | From `run`. |
| `results[]` | report | Per test: `test_id`, `status` (`passed\|failed\|skipped`), `message` (required for `failed`: what was observed vs expected). |

Read case bodies from `test-cases/**/<case_id>.md` with `Read` when the caller gives file paths instead of `description`. Keep the file's wording; do not rewrite it.

## Operation: upsert

Goal: after the call, every case exists exactly once in the suite.

1. **Suite.** `suites_list` with `search_text` = suite title. Take the item whose `title` equals it exactly and whose `file_type` is `file`.
   - Found as `file` → use its id.
   - Not found → `suites_create` with `title` and `file_type: "file"`.
   - Found only as a `folder` of that name → do not delete it; create the `file` suite and tell the user (two suites of one name now exist).
2. **Existing tests.** `tests_list` with `tql` = `suite % '<suite title>'` (the `==` form returned nothing in practice), `fields` = `["id","title","self_tags"]`, `per_page` 100, and page through `meta.has_more`. If the TQL returns nothing for a suite that exists, fall back to listing all tests (no `tql`) and filter by `suite_id` client-side.
3. **Per case**, find tests whose title starts with `<case_id>:` (ignore a trailing ` @TAG`).
   - **Exactly one** → reuse its id. Do not create. If `title`/`description`/`priority` differ from the case, `tests_update` that test to match the case, and add the issue tag if it is missing (`link: [{action:"add", type:"tag", value:"<issue_key>"}]`). Report it as `updated`, or `reused` when nothing differed.
   - **None** → `tests_create` with `suite_id`, `title` = `<case_id>: <title>`, `priority`, `state: "manual"` (or `"automated"` for API/automated cases), `description`, and `link: [{action:"add", type:"tag", value:"<issue_key>"}]`. Report as `created`.
   - **More than one** → a duplicate already exists. Reuse the oldest (earliest `created_at`), do **not** delete anything, and list the extra ids in the result under `duplicates` for the user to decide.
4. Create cases **one at a time or in a small parallel batch, then verify** with step 2's listing: each `case_id` must appear exactly once. If a create errored, apply rule 1 before retrying.

### upsert result

```json
{
  "suite_id": "…",
  "tests": [
    { "case_id": "TC-UIOP-001", "test_id": "…", "action": "created | reused | updated" }
  ],
  "duplicates": [ { "case_id": "…", "extra_test_ids": ["…"] } ]
}
```

## Operation: run

1. Require non-empty `test_ids`. Do not create an empty run.
2. `runs_create` with `title` = `run_title`, `kind`, `test_ids`, and `description` = one line naming the issue key and title.
3. Check `tests_count` in the response equals `len(test_ids)`; if not, say so.
4. Return `run_id` (and the run `url`). Do not report results here.

Each call creates a new run. If the caller says "re-run", create another run and state its id; never reuse or reopen an old one.

## Operation: report

Writes results of a finished execution; do not invent results. A status with no evidence from the caller is not allowed - ask for it.

1. `runs_get` for `run_id`; stop if it does not exist. If it is already finished, say so and stop.
2. For every item in `results`, `testruns_create` with `run_id`, `test_id`, `status`, and `message`.
   - `failed` **must** carry a `message` (observed vs expected, selector or HTTP status if known). Failures are never dropped or downgraded to `skipped`.
   - Tests in the run with no result stay `pending`; list them in the reply, do not mark them.
3. Verify with `runs_get`: `passed_count + failed_count + skipped_count` must match the number of results written. If a write errored, `testruns_list` for that `run_id` before retrying (rule 1).
4. **Close the run** with `runs_update`: `status_event: "finish_manual"` for `manual` runs, `"finish"` for `automated`/`mixed`. Close even when there are failures. Do not close if some tests are still `pending`, unless the caller says to; then use `terminate` only on their explicit instruction.
5. Return counts (passed / failed / skipped / pending), the closed status and the run `url`.

## Not done here

- No deleting of suites, tests or runs. Duplicates are reported, not removed.
- No Jira calls (no `jira` link type), no Confluence, nothing in `../skypermit`.
- Does not decide pass/fail: results come from the caller.

## Status of this skill

`upsert` and `run` follow calls that were exercised by hand (suite as `file`, tag link, run with `test_ids`). `report` (`testruns_create` per test, then `runs_update` with `finish_manual`) has **not been exercised yet**; check the first real report against the Testomat UI.
