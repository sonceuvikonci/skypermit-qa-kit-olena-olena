---
name: api-postman-collection
description: >-
  Build a NEW Postman collection (and, if needed, a clean environment) from one or more API test cases in test-cases/ and ../skypermit/public/openapi.yaml through the Postman MCP server - precondition requests, the steps of each case, and status + response-body assertions taken from its Expected result. Every request is named "<case id>: ..." so run results map back to cases. Saves a local copy and a build report with the Postman CLI command, then stops for review. Use when the user asks to "збери колекцію", build, create or generate a Postman collection for API test cases (e.g. TC-GATE-001) or for a story key whose API cases are saved locally. Create-only: never runs, updates or deletes anything in Postman. Do NOT use to run a collection (the user runs it with Postman CLI), to write test cases (ui-test-case-creator), to verify a case (tc-verifier), or for UI cases (ui-run-playwright).
argument-hint: "<TC id | path to test-cases/*.md> [more ids...] [collection name]"
allowed-tools: Read, Write, Grep, Glob, mcp__atlassian__searchConfluenceUsingCql, mcp__atlassian__getConfluencePage, mcp__postman__getWorkspaces, mcp__postman__getWorkspace, mcp__postman__getCollections, mcp__postman__getCollection, mcp__postman__getEnvironments, mcp__postman__getEnvironment, mcp__postman__createCollection, mcp__postman__createEnvironment
---

# API test cases → Postman collection

Input: one or more API test cases (ids or paths). Output: one new Postman collection in the workspace **SkyPermit** (one folder per case), a local copy `postman/<ISSUE-KEY>/<FILE-ID>.postman_collection.json`, a build report `postman/<ISSUE-KEY>/<FILE-ID>-build-<YYYY-MM-DD>.md`, and a review summary in chat. `<FILE-ID>` is the case id for one case, or `<ISSUE-KEY>-api` for several. Then **stop**: nothing is run.

## Forbidden (applies even if a tool would be allowed)

`allowed-tools` above only lists what may run without a permission prompt; it is not a guarantee that nothing else is callable. So these bans are stated here and must be followed regardless of permission settings:

- **No Postman writes other than create.** Never call `mcp__postman__put*`, `mcp__postman__update*`, `mcp__postman__delete*`, `mcp__postman__sync*`, `mcp__postman__duplicateCollection`, or any `runCollection` / run tool, even if it is available. An existing collection or environment is never changed; a corrected version is a **new** collection with a new name.
- **No Postman CLI.** Do not run `postman ...` (or `newman`) through Bash/PowerShell. Running is the user's step; the report gives them the command.
- **No secrets in Postman or files.** Never ask for, store or print a password or token. Secret variables are created with an empty value; the user passes them at run time with `--env-var`.
- `../skypermit` is read-only (only `public/openapi.yaml` and code may be read). Confluence is read-only. No Jira or Testomat.io calls.

## Sources

- **The case is the file** `test-cases/**/<ID>.md` (find it with `Glob`). It decides the data, the steps and what is asserted. If it is not an API case (`Level` ≠ `API`), stop and say so.
- **Request shapes:** `../skypermit/public/openapi.yaml` (paths, required fields, auth = `session` cookie set by `POST /operators` or `POST /auth/login`).
- **Rules:** Confluence space SkyPermit Docs (see CLAUDE.md), mainly `03 — API Contract` and `06 — Business Rules`. Confirm every value the case asserts (`failing_gate`, `rule_reference`, limits) and cite it as `<page> § <section>`. If Confluence is unreachable, stop. If the case, the docs and the OpenAPI disagree, do not pick one silently: build from the case and list the conflict under *Open questions* in the report.

## Collection design

1. **Name:** `<ISSUE-KEY> · <ID> <short name>` for one case, `<ISSUE-KEY> · API cases` for several, unless the user gives one. Before creating, `getCollections` in the workspace; if it errors (it has returned `500`), use `getWorkspace` and read its `collections` list. If the name exists, do not overwrite: ask for a new name or add a suffix (`v2`, date).
2. **Folders and order:** one folder per case, named `<ID>: <case title>`. Inside it, `<ID>: Pre 01 …`, `<ID>: Pre 02 …` for every precondition (register operator, create pilot, aircraft, request, ...), then `<ID>: Step 1 …` for each step of the case. **Every request name starts with `<ID>: `** so a run result can be matched to its case. One request per action, run top to bottom. Each folder is self-contained (its own operator, pilot, ...) so cases do not depend on each other; collection variables are prefixed per case if two cases would otherwise share a name (e.g. `gate001_flightRequestId`).
3. **Assertions:**
   - `Step` requests assert **only** the Expected result of the case, item by item, with the item text as the test name. Each step has at least one status assertion and one response-body assertion; for a `422` the body checks are `failing_gate`, `rule_reference` and `message` (non-empty string; exact text only if the case fixes it), per the `GateFailure` schema. Do not add checks the case does not have; suggest them in the report instead.
   - `Pre` requests assert only that the setup worked, with names prefixed `Precondition:` (e.g. `Precondition: pilot created (201)`), so a setup failure is not read as a product failure.
   - Parse the body defensively: `let body = {}; try { body = pm.response.json(); } catch (e) {}` so an empty or HTML body fails the assertion, not the script.
4. **Unique values are generated in pre-request scripts** (`Date.now()`-based email, national ids, serial numbers) and stored as **collection variables**. Dates relative to today (e.g. `certified_on`) are computed there too.
5. **Environment holds only `baseUrl` and secret variables** (e.g. `operatorPassword`, type `secret`, empty value). No `operatorEmail` or other generated values in the environment: an environment variable overrides a collection variable of the same name and would replace the generated value with `""`.
   - Reuse an existing environment in the workspace only if it has exactly these keys. Otherwise create a new one (`createEnvironment`) named `SkyPermit API · <host>`; never edit the old one, and mention in the report why it was not reused.
6. **Fail fast without cascades.**
   - In the first request, if a required secret is missing or too short: `throw new Error('Pass operatorPassword with --env-var ...')`. The error is visible in the run.
   - Every later request first checks the ids it needs (`operatorId`, `pilotId`, ...); if one is missing, call `pm.execution.skipRequest()` so the run does not send broken URLs such as `/flight-requests//submit`.
7. **Session:** rely on the cookie set by `POST /operators`; Postman CLI carries it inside one run. Do not copy cookies into variables.

## Time-based data

Time windows are computed in the pre-request script of the request that **creates** the flight request, from `Date.now()`, rounded to the minute, in UTC. Time passes between create and submit (seconds, more on a slow server), and the effect depends on the side of the boundary:

- **Negative cases below a minimum lead time** (e.g. start in 5 h 59 min against `≥ 6 h`) are **stable**: the delay only shortens the remaining time, so the request stays below the limit. No warning needed; note in the report that the actual lead time at submit is slightly less than the case value.
- **Positive cases near a lower boundary** (e.g. exactly 6 h, 6 h 01 min) are **unstable**: by submit time the lead time can drop below 6 h and the gate fails. Warn about this in the report and either use the margin given in the case or propose one (e.g. ≥ 6 h + 10 min); never shrink the margin silently.
- The mirror applies to upper limits (e.g. `≤ 60 days`): a case just **under** the maximum is stable, a case just **over** it can become valid by submit time. Warn the same way.

## Procedure

1. Read each case; extract ID, name, Doc ref, Preconditions, Test data, Steps, Expected result. Skip (and report) any case whose `Level` ≠ `API` or whose steps have no matching path + method in `openapi.yaml`. Find `<ISSUE-KEY>` from the user, `intake/*.json`, or the cases; if none, ask.
2. Confirm the asserted rules in Confluence; read the needed paths in `openapi.yaml`.
3. `getWorkspaces` → workspace `SkyPermit`; `getCollections` (fallback `getWorkspace`) and `getEnvironments` there.
4. Build the collection JSON (v2.1) per the design above. Write it to `postman/<ISSUE-KEY>/<FILE-ID>.postman_collection.json` first, then `createCollection` with the same content. If `createCollection` returns an error or times out, check with `getCollections`/`getWorkspace` before trying again: never create a second copy.
5. Reuse a clean environment or `createEnvironment`.
6. Write the report (below) and reply with: collection name and uid, environment name and uid, the requests with their assertions, warnings, open questions, and the run command. **Write this final reply in Ukrainian** (names, uids, paths, request names, assertion names and commands stay as they are; the report file itself stays in English). **Stop here** and wait for the user's review; do not run anything and do not offer to run it yourself.

## Report

File `postman/<ISSUE-KEY>/<ID>-build-<YYYY-MM-DD>.md`; if it exists, add `-HHMM`. Fill every heading; write `none` rather than dropping one.

````markdown
# Postman collection: <collection name>

Test case: `<path>` · Built: <YYYY-MM-DD HH:MM> (<timezone>)
Collection: <name> (`<uid>`) · Environment: <name> (`<uid>`) · Workspace: SkyPermit
Local copy: `postman/<ISSUE-KEY>/<ID>.postman_collection.json`
Sources: <case Doc ref>; <Confluence page § section, ...>; `openapi.yaml` <paths>

## Requests

| # | Request | Purpose | Assertions |
|---|---|---|---|
| `<ID>: Pre 01 …` | `POST /operators` | precondition: ... | Precondition: ... |
| `<ID>: Step 1 …` | `POST /flight-requests/{id}/submit` | step 1 of the case | <Expected result items> |

Skipped cases: <id — reason; or none>

## Test data

| Item | Value / how it is generated |
|---|---|

## Environment

| Variable | Type | Value |
|---|---|---|
| baseUrl | default | <url> |
| operatorPassword | secret | empty, passed at run time |

## Warnings

<time-boundary warnings per "Time-based data", environment not reused and why, untested script features; or none>

## Open questions

<conflicts between the case, Confluence and OpenAPI; checks suggested but not added; or none>

## How to run (Postman CLI)

Run the **local copy** with a **logged-out** Postman CLI (`postman whoami` shows no account, `POSTMAN_API_KEY` not set) and from a folder outside the repo. A run by cloud uid, or any run while logged in, is uploaded to Postman Cloud with request bodies; `--no-report-events` does not stop that (CLI 1.87.0). Non-secret environment values (`baseUrl`) go in with `--env-var` instead of `-e`. Secrets come from environment variables of the shell, never from the command text itself. The usual way is the `postman-cli-run` skill, which checks all of this before it runs.

```bash
# bash (from a folder outside the repo)
export SKY_OPERATOR_PASSWORD='...'   # min 8 chars
postman collection run "<absolute path>/postman/<ISSUE-KEY>/<FILE-ID>.postman_collection.json" \
  --env-var "baseUrl=<baseUrl of the environment>" \
  --env-var "operatorPassword=$SKY_OPERATOR_PASSWORD" \
  --no-report-events
```

```powershell
# PowerShell (from a folder outside the repo)
$env:SKY_OPERATOR_PASSWORD = '...'   # min 8 chars
postman collection run "<absolute path>\postman\<ISSUE-KEY>\<FILE-ID>.postman_collection.json" --env-var "baseUrl=<baseUrl of the environment>" --env-var "operatorPassword=$env:SKY_OPERATOR_PASSWORD" --no-report-events
```

Pass one `--env-var "<name>=<value>"` per non-secret variable and per secret variable of the environment.
````
