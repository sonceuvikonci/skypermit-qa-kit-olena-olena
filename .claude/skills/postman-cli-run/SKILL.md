---
name: postman-cli-run
description: Run an existing Postman collection with Postman CLI against a Postman environment, ONLY after the user explicitly writes "запускай" in this conversation for that exact command. Secrets go in with --env-var from shell variables and are never printed. Writes a redacted log to api-automation/runs/ (committed, so every file passes a secret check) and returns per-request status, failed assertions, and a pass/fail/skipped result per test case in the `testomat-sync report` input format. Use when the user asks to run, "запусти" or execute a Postman collection (e.g. one built by api-postman-collection, "SKY-2 · TC-GATE-001 ...") with Postman CLI. Never fixes anything to make a test pass. Do NOT use to build or change a collection (api-postman-collection), to write results to Testomat.io (testomat-sync), or for UI cases (ui-run-playwright).
argument-hint: "<collection name | uid> <environment name | uid> <postmanVar=SHELL_VAR ...> [upsert result path]"
allowed-tools: Read, Glob, Grep, Write, mcp__postman__searchPostmanElements, mcp__postman__getCollections, mcp__postman__getEnvironments
---

# postman-cli-run

Runs a Postman collection with Postman CLI and reports results per test case. The run itself, and only the run, needs the user's "запускай".

## Hard rules

1. **No run without "запускай".** Show the exact command first (step 3), then stop. Run only after the user writes «запускай» (or "run it" in clear words) in this conversation **after** seeing that command. "ок", "давай", a "запускай" given earlier for another command, or one from another conversation does not count. Each run, including a re-run after a failure, needs a new «запускай». The same applies when another skill or orchestrator calls this one.
2. **Nothing is fixed to make a test pass.** Do not edit the collection, environment, test cases, scripts, data, or `../skypermit`, and do not rerun with changed parameters on your own. A failure is reported as it is.
3. **No secret is shown or written.** Secret values come only from shell variables (`--env-var "<postmanVar>=$<SHELL_VAR>"`). Never print a value, never `echo` a variable, never put a value in a command, chat, or file. Check that a variable is set with a test that prints only "set"/"NOT set".
4. **No upload to Postman Cloud.** Always pass `--no-report-events`. After the run, look for upload lines in the log (step 6); if any are there, say so plainly.
5. **The raw output never enters the repo.** Raw CLI output and the raw JSON report go to a scratchpad folder only (the JSON report contains request bodies with passwords). Only files that passed `redact.mjs check` are written to `api-automation/runs/`. The raw files are deleted at the end, whatever the outcome.
6. No Testomat.io, Jira or Confluence calls. No Postman writes (no create, put, update, delete, run tools of the Postman MCP).

## Input

- Collection: name or uid (`<owner>-<uuid>`).
- Environment: name or uid.
- Secrets: one pair per secret variable of the environment, `postmanVar=SHELL_VAR` (e.g. `operatorPassword=SKY_OPERATOR_PASSWORD`). If not given, read the collection or its build report (`postman/<KEY>/*-build-*.md`, "How to run") to find which secrets it needs, then ask for the shell variable names.
- Optional: the `testomat-sync upsert` result (path or pasted JSON with `tests[]: {case_id, test_id}`) to fill `test_id`.

## Steps

### 1. Preflight (no run)

- `postman --version`.
- For each shell variable: `if ($env:VAR) { "VAR is set" } else { "VAR is NOT set" }` (PowerShell) or `[ -n "$VAR" ] && echo "VAR is set" || echo "VAR is NOT set"` (bash). If one is not set, stop and tell the user to set it in the shell Claude Code runs in.

### 2. Find the uids

A uid given by the user is used as is. Otherwise:
- `searchPostmanElements` with `entityType: "collections"`, `q` = collection name, filtered to the workspace if known. Take the item whose `name` **equals** the given name. `getCollections` has returned `500` before; use it only as a second try.
- Same for the environment with `entityType: "environments"` (or `getEnvironments`).
- Zero or several exact matches → list them with uids and ask. Never pick one by a partial name (e.g. "SKY-2 lead time" is a different collection from "SKY-2 · TC-GATE-001 lead time under 6 h").

### 3. Show the command and stop

Pick `<stamp>` = `YYYY-MM-DD-HHmm` (local time) and `<slug>` = the collection name in lower case, non-alphanumerics → `-`. `<RAW>` = a new folder in the scratchpad, `<RAW>/<slug>-<stamp>`.

Show this (bash, so stdout and stderr go to the raw file and not to chat):

```bash
postman collection run <collection uid> -e <environment uid> \
  --env-var "<postmanVar>=$<SHELL_VAR>" \
  --no-report-events --disable-unicode \
  -r 'cli,json' --reporter-json-export "<RAW>/report.json" \
  > "<RAW>/cli.raw.log" 2>&1; echo "exit $?"
```

State: collection name + uid, environment name + uid, which secrets are passed (names only), that the target environment will get new test data (operators, pilots, ...), and that the files will be written to `api-automation/runs/`. Then ask for «запускай» and **stop**.

### 4. Run

Only after «запускай»: run the exact command shown, nothing else changed, with a timeout of 5 minutes. Do not print `cli.raw.log`. Exit code `1` with failed assertions is a normal outcome, not an error to fix.

### 5. Redact and summarize

Scripts are in `.claude/skills/postman-cli-run/scripts/` (`<S>` below). `<OUT>` = `api-automation/runs/<slug>-<stamp>`. `--secrets` takes the shell variable **names**, comma-separated.

```bash
node <S>/redact.mjs redact --secrets SKY_OPERATOR_PASSWORD --in "<RAW>/cli.raw.log" --out "<OUT>.log"
node <S>/summarize.mjs --report "<RAW>/report.json" --secrets SKY_OPERATOR_PASSWORD --out "<OUT>-results.json" [--upsert <upsert.json>]
```

- `summarize.mjs` copies no bodies, headers or environment values: only request name, method, URL, HTTP status, failed assertion names and messages, all redacted.
- Case status (testomat-sync has `passed | failed | skipped`, no "blocked"):
  - `failed`: a non-`Precondition:` assertion failed, or a Step request got no response. `message` = request, HTTP status, assertion, error.
  - `skipped`: only setup failed (`Precondition:` assertions or a `Pre NN` request). `message` starts with `Blocked: setup failed, the checked behaviour was not reached.`
  - `skipped`: nothing failed but no Step request ran (`Blocked: no Step request was executed.`).
  - `passed`: everything else.
- Exit `3` from `summarize.mjs` = unknown report shape. Then do **not** guess statuses: build the table from `<OUT>.log` by hand and say the summary script needs updating.
- Exit `1` from either script = it refused to write because a secret was still there. Stop, write nothing more, tell the user (without the value).

### 6. Write the run log, check, clean up

Write `<OUT>.md`:

```markdown
# Run: <collection name>

| | |
|---|---|
| Date | <YYYY-MM-DD HH:mm local> |
| Collection | <name> (`<uid>`) |
| Environment | <name> (`<uid>`) |
| Secrets passed | <postmanVar> from $<SHELL_VAR> (value not shown) |
| Postman CLI | <version> |
| Command | `postman collection run <uid> -e <uid> --env-var "<postmanVar>=***" --no-report-events --disable-unicode -r cli,json` |
| Exit code | <n> |
| Uploaded to Postman Cloud | no / **YES - <line from log>** |

## Requests

| # | Case | Request | Method | URL | HTTP | Failed assertions |
|---|---|---|---|---|---|---|

## Results per case

| Case | test_id | Status | Message |
|---|---|---|---|

## For testomat-sync report

\`\`\`json
{ "run_id": null, "results": [ { "test_id": null, "case_id": "...", "status": "passed", "message": null } ] }
\`\`\`

Files: `<slug>-<stamp>.log` (redacted CLI output), `<slug>-<stamp>-results.json`.
```

Then, in this order:
1. **Upload check:** grep `<OUT>.log` for `Uploading Postman CLI run data|Uploaded successfully|go\.postman\.co/.*/run/`. A match means `--no-report-events` did not stop the upload: put **YES** in the table and tell the user first thing in the reply.
2. **Secret check (mandatory):** `node <S>/redact.mjs check --secrets <VARS> "<OUT>.md" "<OUT>.log" "<OUT>-results.json"`. Exit `0` is required. On exit `1`, delete the leaking file(s), say which file and what kind of leak (never the value), and stop.
3. Delete `<RAW>` (raw log and raw JSON report) whatever happened before.

### 7. Reply

- One line: collection, environment, totals (requests, assertions, failed).
- The table per request (status, failed assertions) and the table per case.
- The JSON for `testomat-sync report`. `test_id` is filled only from the upsert mapping, otherwise `null`; `run_id` stays `null` (testomat-sync `run` creates it). Do not call testomat-sync yourself.
- Paths of the three files in `api-automation/runs/`.
- Notes: upload happened or not, test data left on the target environment, anything odd (for example a 5xx in a precondition). No fixes, no reruns.

## Status of this skill

Built from one manual run (CLI 1.87.0, collection `SKY-2 · TC-GATE-001 lead time under 6 h`, environment `Skypermit-vercel`). Not yet verified:
- `--no-report-events` is the closest flag in `postman collection run --help` (1.87.0); the help has no flag named after uploading. Whether it stops `Uploading Postman CLI run data to Postman Cloud...` is checked on the first run (step 6.1).
- `-r` / `--reporter-json-export` work in 1.87.0 but are not in `--help`.
- `summarize.mjs` expects a newman-style `run.executions[]` report; it was tested on a synthetic report only. Check the first real summary against the CLI log.
