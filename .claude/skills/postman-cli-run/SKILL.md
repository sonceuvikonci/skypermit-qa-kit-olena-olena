---
name: postman-cli-run
description: Run the local copy of a Postman collection (postman/<KEY>/*.postman_collection.json) with a logged-out Postman CLI, so nothing is uploaded to Postman Cloud, with baseUrl taken from a Postman environment, ONLY after the user explicitly writes "запускай" in this conversation for that exact command. Secrets go in with --env-var from shell variables and are never printed. Writes a redacted log to api-automation/runs/ (committed, so every file passes a secret check) and returns per-request status, failed assertions, and a pass/fail/skipped result per test case in the `testomat-sync report` input format. Use when the user asks to run, "запусти" or execute a Postman collection (e.g. one built by api-postman-collection, "SKY-2 · TC-GATE-001 ...") with Postman CLI. Never fixes anything to make a test pass. Do NOT use to build or change a collection (api-postman-collection), to write results to Testomat.io (testomat-sync), or for UI cases (ui-run-playwright).
argument-hint: "<collection name | uid | local .postman_collection.json> <environment name | uid> <postmanVar=SHELL_VAR ...> [upsert result path]"
allowed-tools: Read, Glob, Grep, Write, mcp__postman__searchPostmanElements, mcp__postman__getCollections, mcp__postman__getEnvironments, mcp__postman__getEnvironment
---

# postman-cli-run

Runs a Postman collection with Postman CLI and reports results per test case. The run itself, and only the run, needs the user's "запускай".

## Hard rules

1. **No run without "запускай".** Show the exact command first (step 3), then stop. Run only after the user writes «запускай» (or "run it" in clear words) in this conversation **after** seeing that command. "ок", "давай", a "запускай" given earlier for another command, or one from another conversation does not count. Each run, including a re-run after a failure, needs a new «запускай». The same applies when another skill or orchestrator calls this one.
2. **Nothing is fixed to make a test pass.** Do not edit the collection, environment, test cases, scripts, data, or `../skypermit`, and do not rerun with changed parameters on your own. A failure is reported as it is.
3. **No secret is shown or written.** Secret values come only from shell variables (`--env-var "<postmanVar>=$<SHELL_VAR>"`). Never print a value, never `echo` a variable, never put a value in a command, chat, or file. Check that a variable is set with a test that prints only "set"/"NOT set".
4. **No upload to Postman Cloud, checked BEFORE the run.** `--no-report-events` does **not** stop the run upload (CLI 1.87.0, run `…-2026-11-09-0123`). The CLI skips the upload only when it has no credentials and no cloud uid for the collection (`run-upload/index.js` in the CLI). So:
   - run only the **local collection file** (never a cloud uid), and no `-e <uid>` (that needs a login); `baseUrl` and other non-secret environment values go in with `--env-var`;
   - the CLI must be **logged out** (`postman whoami` says no account details) and `POSTMAN_API_KEY` must be **NOT set**, and no `--postman-api-key` is passed;
   - if any of these does not hold, **stop before showing the command** and warn that the run would be uploaded to Postman Cloud (with request bodies). Logging out is the user's step: `postman logout` asks for confirmation interactively, so the user runs it in their own terminal. Do not run `postman logout` or `postman login` yourself and do not suggest a way to run them from this session;
   - keep `--no-report-events` (it stops other event dispatch), and still grep the log for upload lines after the run (step 6) as a second check.
5. **Every `postman` command runs from a scratchpad folder, never from the repo.** Any Postman CLI command (`--version`, `whoami`, `collection run`) starts an analytics probe that runs `opencode plugin list` in the current folder, and opencode then creates `.opencode/` there (with `node_modules`). Run each `postman` call as `( cd "<CLI_CWD>" && postman … )`, where `<CLI_CWD>` is a scratchpad folder (for the run, `<RAW>`). After the run, check that no `.opencode/` appeared in the repo; if one did, say so and do not commit it (it is in `.gitignore`).
6. **The raw output never enters the repo, and nothing reads the raw JSON except `redact.mjs`.** Raw CLI output and the raw JSON report go to a scratchpad folder only (the JSON report contains request bodies with passwords). The raw JSON is redacted first (`redact.mjs redact-json`); `summarize.mjs` reads only that redacted copy. The redacted copy stays in the scratchpad (`<KEEP>`, step 3), never in the repo, so `summarize.mjs` can be fixed against a real report. Only files that passed `redact.mjs check` are written to `api-automation/runs/`. The raw files are deleted at the end, whatever the outcome.
7. **No hand-made results.** If `summarize.mjs` exits `3` (report not parsed), do not build `-results.json`, the per-case table or the `testomat-sync` JSON by hand from the log. Stop, say that the script could not parse the report, and give the path of the redacted copy so the script can be fixed.
8. No Testomat.io, Jira or Confluence calls. No Postman writes (no create, put, update, delete, run tools of the Postman MCP).
9. **Final reply in Ukrainian.** The message to the user at the end of the skill (step 7, and any stop message) is written in Ukrainian. File contents (run log, results JSON) and identifiers stay as they are.

## Input

- Collection: name, uid (`<owner>-<uuid>`) or path of the local file. Whatever is given, the run uses the **local file** `postman/<KEY>/<FILE-ID>.postman_collection.json` saved by api-postman-collection (step 2).
- Environment: name or uid. Used only to read its non-secret values (e.g. `baseUrl`) through the Postman MCP; they are passed with `--env-var`.
- Secrets: one pair per secret variable of the environment, `postmanVar=SHELL_VAR` (e.g. `operatorPassword=SKY_OPERATOR_PASSWORD`). If not given, read the collection or its build report (`postman/<KEY>/*-build-*.md`, "How to run") to find which secrets it needs, then ask for the shell variable names.
- Optional: the `testomat-sync upsert` result (path or pasted JSON with `tests[]: {case_id, test_id}`) to fill `test_id`.

## Steps

### 1. Preflight (no run)

`<CLI_CWD>` = `<scratchpad>/cli-cwd` (create it; delete it at the end). Every `postman` call runs there (hard rule 5).

- `( cd "<CLI_CWD>" && postman --version )`.
- **Upload guard (hard rule 4):** `( cd "<CLI_CWD>" && postman whoami )` must say that no account details are available, and `[ -n "$POSTMAN_API_KEY" ] && echo "POSTMAN_API_KEY is set" || echo "POSTMAN_API_KEY is NOT set"` must print `NOT set`. Otherwise **stop here**, before any command is shown: say that the CLI is logged in (or an API key is set), so the run would be uploaded to Postman Cloud with request bodies, and that the user has to run `postman logout` in their own terminal (or unset `POSTMAN_API_KEY`) and then tell you. Do not log out for them.
- For each secret shell variable: `[ -n "$VAR" ] && echo "VAR is set" || echo "VAR is NOT set"` (bash) or `if ($env:VAR) { "VAR is set" } else { "VAR is NOT set" }` (PowerShell). If one is not set, stop and tell the user to set it in the shell Claude Code runs in.

### 2. Find the local collection and the environment values

- **Collection file:** `Glob` `postman/**/*.postman_collection.json` and take the file whose `info.name` **equals** the given name (or whose cloud uid is named in the matching build report `postman/<KEY>/*-build-*.md`). Zero or several matches → list them and ask; never pick by a partial name (e.g. "SKY-2 lead time" is a different collection from "SKY-2 · TC-GATE-001 lead time under 6 h"). No local file → stop: the run would need the cloud uid and a login, which uploads (hard rule 4).
- **Environment:** a uid given by the user is used as is; otherwise `getEnvironments` in the workspace and take the one whose `name` **equals** the given name. `getEnvironment` → take every non-secret variable with a value (e.g. `baseUrl`) for `--env-var`. Secret variables (or any variable whose name looks like a password/token) are never read into the command; they come from shell variables.
- Every `{{variable}}` the collection uses must be either a collection variable, a non-secret `--env-var`, or a secret `--env-var`; if one is missing, stop and list it.

### 3. Show the command and stop

Pick `<stamp>` = `YYYY-MM-DD-HHmm` (local time) and `<slug>` = the collection name in lower case, non-alphanumerics → `-`. `<RAW>` = a new folder in the scratchpad, `<RAW>/<slug>-<stamp>` (deleted at the end). `<KEEP>` = `<scratchpad>/redacted-reports` (kept; holds `<slug>-<stamp>.report.redacted.json`).

Show this (bash, so stdout and stderr go to the raw file and not to chat; the CLI runs inside `<RAW>`, so the opencode probe writes there):

```bash
mkdir -p "<RAW>"
( cd "<RAW>" && postman collection run "<absolute path of the local .postman_collection.json>" \
    --env-var "baseUrl=<value from the environment>" \
    --env-var "<postmanVar>=$<SHELL_VAR>" \
    --no-report-events --disable-unicode \
    -r 'cli,json' --reporter-json-export "<RAW>/report.json" \
    > "<RAW>/cli.raw.log" 2>&1; echo "exit $?" )
```

State: the local collection file and its collection name; the environment name + uid the non-secret values come from and those values; which secrets are passed (names only); that the upload guard passed (logged out, no API key, local file); that the target system will get new test data (operators, pilots, ...); and that the files will be written to `api-automation/runs/`. Then ask for «запускай» and **stop**.

If the CLI state changes between this step and «запускай» (e.g. the user logs in again), repeat the upload guard right before the run; if it fails, stop as in step 1.

### 4. Run

Only after «запускай»: run the exact command shown, nothing else changed, with a timeout of 5 minutes. Do not print `cli.raw.log`. Exit code `1` with failed assertions is a normal outcome, not an error to fix.

### 5. Redact and summarize

Scripts are in `.claude/skills/postman-cli-run/scripts/` (`<S>` below). `<OUT>` = `api-automation/runs/<slug>-<stamp>`. `--secrets` takes the shell variable **names**, comma-separated.

In this order; each command runs only if the previous one exited `0`:

```bash
mkdir -p "<KEEP>"
# 1. redact the raw JSON report first (the only script that reads it)
node <S>/redact.mjs redact-json --secrets SKY_OPERATOR_PASSWORD --in "<RAW>/report.json" --out "<KEEP>/<slug>-<stamp>.report.redacted.json"
# 2. redact the CLI log
node <S>/redact.mjs redact --secrets SKY_OPERATOR_PASSWORD --in "<RAW>/cli.raw.log" --out "<OUT>.log"
# 3. summarize from the redacted copy only
node <S>/summarize.mjs --report "<KEEP>/<slug>-<stamp>.report.redacted.json" --secrets SKY_OPERATOR_PASSWORD --out "<OUT>-results.json" [--upsert <upsert.json>]
```

- `summarize.mjs` never sees the raw report. It copies no bodies, headers or environment values: only request name, method, URL, HTTP status, failed assertion names and messages, all redacted.
- Case status (testomat-sync has `passed | failed | skipped`, no "blocked"):
  - `failed`: a non-`Precondition:` assertion failed, or a Step request got no response. `message` = request, HTTP status, assertion, error.
  - `skipped`: only setup failed (`Precondition:` assertions or a `Pre NN` request). `message` starts with `Blocked: setup failed, the checked behaviour was not reached.`
  - `skipped`: nothing failed but no Step request ran (`Blocked: no Step request was executed.`).
  - `passed`: everything else.
- `summarize.mjs` reads two report shapes: newman-style (`item`, `request`, `assertions`) and Postman CLI 1.87.0 (`requestExecuted`, `tests[{name, status}]`, `errors[]`, stats in `run.summary`). Case ids come from the request-name prefix `<case id>: `.
- Exit `3` from `summarize.mjs` = report it cannot parse: no executions, executions in neither shape, an unknown test status, or request names without a `<case id>: ` prefix. It writes nothing. **Stop here** (hard rule 7): no `-results.json`, no hand-made tables or `testomat-sync` JSON. Still do step 6.2–6.3 for the files that exist (`<OUT>.log`), skip `<OUT>.md`, and tell the user: the run's exit code and the totals line from `<OUT>.log`, that the summary script could not parse the report, and the path `<KEEP>/<slug>-<stamp>.report.redacted.json` to fix it against.
- Exit `3` from `redact.mjs redact-json` = the report is not JSON. Stop the same way.
- Exit `1` from any script = it refused to write because a secret was still there. Stop, write nothing more, tell the user (without the value).

### 6. Write the run log, check, clean up

Write `<OUT>.md`:

```markdown
# Run: <collection name>

| | |
|---|---|
| Date | <YYYY-MM-DD HH:mm local> |
| Collection | <name>: local file `<repo-relative path>` |
| Environment | none (`-e` not used); <non-secret vars> passed with `--env-var` (values of <environment name>, `<uid>`) |
| Secrets passed | <postmanVar> from $<SHELL_VAR> (value not shown) |
| Postman CLI | <version>, logged out, `POSTMAN_API_KEY` not set; run from a scratchpad folder |
| Command | `postman collection run <repo-relative path> --env-var "baseUrl=<value>" --env-var "<postmanVar>=***" --no-report-events --disable-unicode -r cli,json` |
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
1. **Upload check (second line of defence):** grep `<OUT>.log` for `Uploading Postman CLI run data|Uploaded successfully|go\.postman\.co/.*/run/`. A match means the upload guard of step 1 missed something: put **YES** in the table and tell the user first thing in the reply. Also check that no `.opencode/` appeared in the repo root (hard rule 5).
2. **Secret check (mandatory):** `node <S>/redact.mjs check --secrets <VARS> "<OUT>.md" "<OUT>.log" "<OUT>-results.json" "<KEEP>/<slug>-<stamp>.report.redacted.json"` (only the files that exist). Exit `0` is required. On exit `1`, delete the leaking file(s), say which file and what kind of leak (never the value), and stop.
3. Delete `<RAW>` (raw log, raw JSON report, and the `.opencode/` the probe left there) and `<CLI_CWD>`, whatever happened before. Keep `<KEEP>`.

### 7. Reply (in Ukrainian)

Write the whole reply in Ukrainian (hard rule 9); table headers, statuses (`passed`/`failed`/`skipped`), names, paths and JSON stay as they are.

- One line: collection, environment, totals (requests, assertions, failed).
- The table per request (status, failed assertions) and the table per case.
- The JSON for `testomat-sync report`. `test_id` is filled only from the upsert mapping, otherwise `null`; `run_id` stays `null` (testomat-sync `run` creates it). Do not call testomat-sync yourself.
- Paths of the three files in `api-automation/runs/`.
- Notes: upload happened or not, test data left on the target environment, anything odd (for example a 5xx in a precondition). No fixes, no reruns.

## Status of this skill

Verified with CLI 1.87.0 on `SKY-2 · API-OP-005 Lead time under 6 h chain` (2026-11-09):
- Run `…-0123` (cloud uid + `-e uid`, logged in, `--no-report-events`): the run **was uploaded** to Postman Cloud. `--no-report-events` does not stop it.
- Run `…-1217` (local file, `--env-var baseUrl`, logged out, no `POSTMAN_API_KEY`): **no upload**. This is the setup hard rule 4 now requires. The guard was confirmed by one run; which of the two conditions (logout or local file) is enough on its own was read from the CLI code, not tested separately.
- Every `postman` command starts the `opencode plugin list` probe in the current folder; with the CLI run from `<RAW>`, `.opencode/` appeared there and not in the repo.
- `summarize.mjs` reads the 1.87.0 report shape; on run `…-1217` its per-request status codes and 19/19 passed assertions match the CLI log. The `failed` / `skipped` paths were checked on altered copies of that report. The exact field of a failed test's error message in a real 1.87.0 report has not been seen yet (the script tries `error.message`, `error`, `message`, `errorMessage`); check it on the first run with a failure.
- `-r` / `--reporter-json-export` work in 1.87.0 but are not in `--help`.
