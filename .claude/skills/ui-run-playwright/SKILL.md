---
name: ui-run-playwright
description: Execute UI test cases from test-cases/ in a real browser through the Playwright MCP server and write a run report (scope, results table, and per case - test data, steps, expected vs actual, PASSED/FAILED, date and time). Use when the user asks to run, execute, walk through or "пройти" a UI case (e.g. TC-UIOP-009) or a file of cases through Playwright / the browser, optionally with a network check of a request (status and body). Uses only data-testid from the case for the steps and checks. Do NOT use to write or change test cases (ui-test-case-creator), to verify a case against the specs (tc-verifier), to automate tests as code, or to write results to Testomat.io (testomat-sync does that, and only when asked). The app under test (../skypermit) is read-only.
argument-hint: "<TC id | path to test-cases/*.md> [base URL]"
allowed-tools: Read, Write, Grep, Glob, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_fill_form, mcp__playwright__browser_type, mcp__playwright__browser_select_option, mcp__playwright__browser_wait_for, mcp__playwright__browser_tabs, mcp__playwright__browser_network_requests, mcp__playwright__browser_network_request, mcp__playwright__browser_console_messages, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_run_code_unsafe
---

# UI run through Playwright MCP

Input: one or more test cases (id or path). Output: a Markdown report in `run/<ISSUE-KEY>/` and a short summary in chat.

## Rules

- **Source of the case is the file** `test-cases/**/<ID>.md` (find it with `Glob`). If the user names a case that is only in Testomat.io, read the local file with the same id; if there is none, say so and stop. Do not reconstruct a case from memory.
- **Steps and checks use only `data-testid` written in the case** (`page.getByTestId(...)`, or `browser_click` on a ref only after confirming it is that testid). Do not click by text, role or CSS in the steps. If the case needs a selector it does not name, stop that case and report it as `BLOCKED` with the missing selector. Never guess.
- **Preconditions are not steps.** Data from Preconditions / Test data (pilot, aircraft, request) may be created through the UI by labels or by the testids the form exposes. Record every object created, with its identifier, under *Test data used*. Reuse existing objects when they match the case; create only what is missing.
- **Do not log in for the user.** If the browser shows no session, ask the user to log in in the Playwright window and wait for their reply. Never ask for or type a password.
- **Base URL:** take it from the user. If not given, ask; do not assume `localhost`. `../skypermit` stays read-only: do not start or build the app.
- **Read-only on specs and app code.** Selector lookups in `../skypermit/app` and `../skypermit/components` are allowed only to confirm a testid name; the case still decides what is checked.
- **Report faithfully.** Result comes from what the browser showed, not from what is expected. If the actual differs, status is `FAILED` with the observed value. A check that could not be run is `BLOCKED`, never `PASSED`.
- Never write to Testomat.io, Jira or Confluence from this skill. Offer `testomat-sync` as the next step.

## Procedure

1. **Read the case.** Extract: ID, name (H1 after `<ID>: `), Doc ref, Preconditions, Test data, Steps, Expected result, Open questions.
2. **Check the session.** `browser_navigate` to the base URL, `browser_snapshot`. Pages may show "Checking session…" first: wait for a logged-in marker (e.g. a "Log out" button) with `browser_wait_for` before judging the session. Not logged in → ask the user to log in, then continue.
3. **Prepare data.** For each precondition, find an existing matching object in the UI; if missing, create it. Note ids/URLs for the report.
4. **Run the steps with one `browser_run_code_unsafe` call per logical action** when a response must be captured, so the network wait and the click are one atomic call:
   ```js
   async (page) => {
     const btn = page.getByTestId('<step testid>');
     await btn.waitFor({ timeout: 20000 });
     const [resp] = await Promise.all([
       page.waitForResponse(r => /<url fragment>/.test(r.url()) && r.request().method() !== 'OPTIONS', { timeout: 20000 }),
       btn.click(),
     ]);
     const el = page.getByTestId('<result testid>');
     await el.waitFor({ timeout: 10000 });
     return { url: resp.url(), method: resp.request().method(), status: resp.status(), body: await resp.text(),
              attr: await el.getAttribute('<data-attr>'), text: (await el.innerText()).replace(/\s+/g, ' ') };
   }
   ```
   Register the response listener **before** the click: a click first and a listener second misses the request.
5. **Compare** each Expected result item with what was returned. Record Expected and Actual side by side.
6. **Console.** `browser_console_messages` with level `warning`; list errors and warnings and mark which are explained (e.g. a 4xx the case expects) and which are not.
7. **Write the report** (below), then reply with the verdict, the key evidence (status and body when a request was checked), and the report path.

## Status values

| Status | When |
|---|---|
| `PASSED` | every Expected item matched the actual result |
| `FAILED` | at least one Expected item differs; the actual value is in the report |
| `BLOCKED` | could not run: no session, missing selector, app unreachable, precondition could not be created |

An unexpected console error does not change the status, but it goes in the report.

## Report

File: `run/<ISSUE-KEY>/ui-run-<YYYY-MM-DD>-<ID or batch>.md`, e.g. `run/SKY-3/ui-run-2026-11-02-TC-UIOP-009.md`. Create the folder if it does not exist; never overwrite an existing report, add the time (`-HHMM`) to the name instead. `<ISSUE-KEY>` is the Jira key of the story the case belongs to: take it from the user, from `intake/<KEY>.json`, or from the key tag the case carries in Testomat.io (e.g. `@SKY-3`). If none of these gives it, ask the user; do not guess and do not write the report outside `run/<ISSUE-KEY>/`. Local time of the machine, ISO date; the time is the start of the run. Fill every heading; write `none` rather than dropping a heading.

````markdown
# UI run: <ID or batch name>

Test cases: `<path to the test-cases file>`
Date: <YYYY-MM-DD HH:MM> (<timezone>)
Environment: <base URL> · Playwright MCP · browser session of <logged-in user shown in the UI>

## Scope

Items for web testing: <n>

Code review (by test cases and structural items):

- QA (UI check): <ids run in the browser>
- FAIL (bug confirmation): <ids whose goal is to confirm a defect, or none>
- N/A (absence confirmation): <ids confirming that something is absent, or none>

Network (handed off from backend, "Browser needed:"): <ids or none>

## Results

| ID | Name | Surface | Status | Comment |
|---|---|---|---|---|
| TC-… | … | UI / network | PASSED / FAILED / BLOCKED | one line: what proved it, or what differed |

Totals: passed <n> · failed <n> · blocked <n>

## Details

### <ID>: <name>

Started: <YYYY-MM-DD HH:MM:SS> · Result: **PASSED | FAILED | BLOCKED**

**Test data used**

| Item | Value |
|---|---|
| (each Test data row, as actually used) | … |
| Objects created for preconditions | what, id or URL; or "reused existing: …" |
| Request / record under test | URL or id |

**Steps (reproducible)**

1. <step, with the data-testid used and the page URL>
2. …

**Expected result**

1. <as written in the case>

**Actual result**

1. <what the browser showed: attribute value, text, and so on>

**Network** (only if a request was checked)

- Request: `<METHOD> <URL>`
- Status: `<code>`
- Response body:
```json
<verbatim>
```

**Console:** <n errors, n warnings; which are explained and which are not>

**Open questions / notes:** <from the case, plus anything seen during the run, e.g. differences between docs and behaviour; or none>
````

Surface is `UI` for a check on the page and `network` for one that read a request.

## After the run

Ask whether to record the result in Testomat.io; if yes, call `testomat-sync` (run + report) and pass the result and the evidence. Do not call `mcp__testomatio__*` from here.

Known quirk: in `testomat-sync`, `runs_create` with `test_ids` already adds a `pending` entry, and `testruns_create` then adds a second one, so the run closes with a duplicate `skipped`. Tell the user before they approve, rather than after.
