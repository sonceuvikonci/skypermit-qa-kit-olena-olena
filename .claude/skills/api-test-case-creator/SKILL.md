---
name: api-test-case-creator
model: sonnet
argument-hint: '{"gate": "TIME_WINDOW", "rule_reference": "TSD-4 §2.1", "story": "SKY-2"}'
allowed-tools: Read(test-cases/**), Read(../skypermit/public/openapi.yaml), Grep(test-cases/**), Glob(test-cases/**), Write(test-cases/api/**), Write(test-cases/confirmed-facts.md), mcp__atlassian__getConfluencePage, mcp__atlassian__searchConfluenceUsingCql, mcp__atlassian__getPagesInConfluenceSpace
description: Generate API test cases for ONE business rule as Markdown files test-cases/api/API-OP-<NNN>.md, with the same fields as the UI cases (ID, Doc ref, Priority, Level, Preconditions, Test data, Steps, optional Verification, Expected result), where Steps are HTTP requests to /api/v1 (method, path, body, auth = operator session OR X-Reviewer-Id, never both) and Expected result is a status code plus, for 422, the body with failing_gate, rule_reference and message. Endpoints and codes come from Confluence `03 — API Contract`, rules from `06 — Business Rules` (as corrected by `07 — Clarifications`). Applies BV and EP as separate single checks through POST /flight-requests/{id}/validate, and state transition as end-to-end request chains (validate → GET, submit → REJECTED, repeat submit → 409) that become a Postman collection. Use when the user asks for API test cases, "API-кейси", API checks of a rule, gate, boundary or transition. Do NOT use for UI/E2E cases or anything with data-testid (use ui-test-case-creator), for building the Postman collection (api-postman-collection), for test plans (test-plan) or verifying a case (tc-verifier).
---

# API test cases for one business rule

Input: **one business rule** (a rule code such as `ZC-2026.1 §2`, a section of `06 — Business Rules`, or a gate condition). Output: a set of API test cases for that rule, one Markdown file each, in `test-cases/api/`.

For UI/E2E cases (form, pages, `data-testid`) use **ui-test-case-creator**. This skill never uses or mentions `data-testid`.

## Sources (Confluence only, read-only)

Read through the Atlassian MCP tools (site, cloudId and space are in `CLAUDE.md`): `searchConfluenceUsingCql` to find the section, `getConfluencePage` to read it. Never create or edit pages or comments.

| What | Page |
|---|---|
| Endpoints, methods, auth, status codes, `422` body | `03 — API Contract` |
| The rule, its limits and `rule_reference` | `06 — Business Rules` (§6 for citations), as corrected by `07 — Clarifications` |
| States and allowed / forbidden transitions | `02 — Request Lifecycle` |
| Field names and types for request bodies | `01 — Data Model` |
| Known undefined behaviour | `05 — Open Questions — Canonical Status` |

- Read `03`, `06` and `07` before writing anything; read `02` before any state-transition chain.
- Where pages disagree, `07` and `06` win over the source wording; cite the one you followed.
- Cite as `<page title> § <section>`.
- If Confluence is unreachable, say so and stop. Do not guess and do not fall back to `../skypermit/docs/`.
- `../skypermit` is read-only. You may read `public/openapi.yaml` or route handlers under `app/api/v1/` to confirm a request shape; if the code contradicts Confluence, follow Confluence and add an `Open question:` line.

## Requests: what a Step looks like

Every Step is one HTTP request, written as:

```
POST /api/v1/flight-requests/{{flightRequestId}}/validate
Auth: operator session (cookie from Pre 1)
Body: —
```

- **Method and path**: exactly as in `03 — API Contract`, with the `/api/v1` base path. Path ids are named variables (`{{flightRequestId}}`, `{{pilotId}}`), each created in a Precondition, so the chain maps 1:1 to a Postman collection.
- **Body**: JSON with concrete values, or `—` when there is none. Only fields the docs define; never `operator_id` (it comes from the session, `03 § Authentication & authorisation`).
- **Auth**: exactly one of
  - `operator session` — the cookie set by `POST /operators` or `POST /auth/login` in Preconditions;
  - `X-Reviewer-Id: <value>` — reviewer endpoints and reviewer-or-owner reads;
  - `none` — only when the case tests `401`.

  **Never both** in one request. Pick the one `03` allows for that endpoint: `submit` and `cancel` are owner-only; `validate` and single-entity `GET` accept either; `approve`/`reject` require `X-Reviewer-Id`.

## Expected result

- One numbered item per Step and per Verification request, same order.
- Always the **status code** from `03 § Error semantics` (or `confirmed-facts.md`).
- For `422`, the body: `failing_gate` = one of `PILOT`/`AIRCRAFT`/`ZONE`/`TIME_WINDOW`, `rule_reference` = the verbatim citation from `06 § 6` (as corrected by `07`), and `message` = present, non-empty string (its wording is not specified, so never assert exact text).
- For a `GET` in Verification: the field and value it shows (e.g. `state` = `DRAFT`).
- For `409`: status only, plus "conflict detail" body present; no exact text.
- A code or body the docs do not define (e.g. `validate` when all gates pass): `TBD` plus `Open question: <what>, <page> § <section>`. Check `test-cases/confirmed-facts.md` first; never invent a value.

## Test design techniques

From the rule, list the candidate cases first (technique, condition, one line each), show the list, then write all of them unless the user narrows it.

### BV and EP — single checks via `validate`

- **BV**: for each numeric, date/time or length limit of the rule, one case at the exact boundary and one at one unit past it, each its own file.
- **EP**: one case per valid class and one per invalid class, one representative value each.
- Each BV/EP case has **one Step**: `POST /api/v1/flight-requests/{id}/validate` on a `DRAFT` request built in Preconditions so that only the value under test decides the outcome. `validate` never changes state (`03 § Flight requests`, endpoint 13), so these cases are cheap and independent.
- Preconditions make all **earlier gates pass** (order `PILOT` → `AIRCRAFT` → `ZONE` → `TIME_WINDOW`, stop at first failure) and say that later gates are not reached on the failing side.
- Valid side: expected status per `03`/`confirmed-facts.md`, else `TBD`. Invalid side: `422` with the body above.

### State transition — end-to-end chains

One case per chain, title prefixed `[ST]`. A chain exercises one transition model of the rule (from `02 — Request Lifecycle`) and every Step has its own expected result. This is the one exception to "one step under test": the chain *is* the check. The standard chain for a rule that fails a gate:

1. `POST /flight-requests/{id}/validate` → `422`, `failing_gate`, `rule_reference` (the dry run).
2. `GET /flight-requests/{id}` → `state` = `DRAFT` (validate did not change state).
3. `POST /flight-requests/{id}/submit` → `422` with the same `failing_gate` and `rule_reference`.
4. `GET /flight-requests/{id}` → `state` = `REJECTED`.
5. `POST /flight-requests/{id}/submit` again → `409` (`REJECTED` is not submittable).

Adapt it to what `02` defines for the rule (e.g. a passing chain to `UNDER_REVIEW`, or `cancel` after the deadline), but keep: one rule, one starting request, writes and reads alternating so every transition is observed by a `GET`. If `02`/`03` do not say what `submit` returns on a gate failure, write `TBD` and an `Open question:` line instead of assuming `422`.

ST chains will be turned into a Postman collection by **api-postman-collection**, so:
- each Step is self-contained (method, path with `{{variables}}`, auth, body);
- every variable a Step uses is created in a Precondition and named the same everywhere;
- each Expected result item is assertable: status code, and exact field values where the docs define them.

## Output location and ID

- Path: `test-cases/api/API-OP-<NNN>.md`; ID `API-OP-<NNN>`, starting at `001`. `NNN` is the next free number in `test-cases/api/` (check existing files; never ask).
- Before writing, search `test-cases/` (including `gates/`, `state-machine/`) for a case with the same Doc ref and condition. If one exists, ask: skip, replace, or variant.
- Never write into `../skypermit`.
- **Do not change the skill's own files while generating cases** (`SKILL.md`, `references/`). If the template lacks a field or section the case needs, write the case with the template as it is and say what is missing in the final message to the user.

## Template

Build every case from `references/output-template.md`, keeping section order (header table: ID, Doc ref, Technique, Priority, Level; then Preconditions, Test data, Steps, optional Verification, Expected result). Replace every `<placeholder>`, delete template comments. See `references/example-st-chain.md` for the shape of an ST chain (placeholders, not real data: take every value from the spec).

Write the case in English; paths, field names, states, enum values and rule codes stay exactly as in the docs.

### Field rules

- **Title**: condition and outcome, e.g. `Altitude one metre above zone ceiling fails ZONE gate on validate`.
- **Doc ref**: `06 — Business Rules § <section>` (plus `07 … item <n>` if it corrects it) and rule code; `03 — API Contract § <section>` for the endpoint and codes; `02 — Request Lifecycle § <section>` for ST chains. Never cite `04 — Frontend Scope`.
- **Technique**: `BV`, `EP` or `ST`.
- **Priority**: High for gates, `rule_reference`, illegal transitions, access control; Medium for field validation and secondary limits; Low otherwise.
- **Level**: always `API`.
- **Preconditions**: numbered setup requests (`Pre 1 … Pre n`), each with method, path, auth and the key body values, plus the variable it stores (e.g. `→ {{flightRequestId}}`). Setup is never in Steps. If setup needs access the API does not give (raising `authorisation_level`, editing `certified_on`), say "via DB" or "admin action".
- **Test data**: concrete values, one boundary value per case; times relative to execution (`now + 24 h`, UTC or zone-local). Mark any value not from the Doc ref: "(from `01 — Data Model`)", "(from `confirmed-facts.md` #<n>)" or "(assumed)". Prefer neutral values that cannot fail an undocumented format check.
- **No hardcoded identities, dates or UUIDs in Test data.** Unique fields (`email`, `national_id`, `serial_number`, anything else `01 — Data Model` marks unique) are described as values generated at run time, with their format, e.g. `api-op-<NNN>-<timestamp>@example.test`, `1<timestamp>` (digits only), `SN<timestamp>`, where `<timestamp>` is the run's Unix time in ms; mark the format "(assumed)". Dates and times are relative to execution (`today − 1 month`, `time of Pre 4 + 2 h`), never calendar dates. Ids are `{{variables}}` stored by a Precondition, never literal UUIDs. Why: fixed values collide on the second run (unique constraints) and go stale with time.
- **Verification**: read-only `GET`s only, for BV/EP cases when the step response does not show the value. In ST chains the `GET`s are Steps.

## Before saving

1. One rule per case; BV/EP: exactly one Step, the `validate` call; ST: one chain with an expected result per Step.
2. Every request has method, `/api/v1` path, body (or `—`) and exactly one auth mode; none has both session and `X-Reviewer-Id`.
3. Every status code comes from `03` or `confirmed-facts.md`; every `422` lists `failing_gate`, `rule_reference` (verbatim from `06 § 6`/`07`) and `message`.
4. Earlier gates pass in Preconditions; no `operator_id` in any body.
5. No `data-testid`, no UI spec reference; no literal email, unique id, calendar date or UUID in Test data.
6. Every non-Doc-ref value is marked with its source; undefined values are `TBD` with an `Open question:` line.
7. File name, ID and title match; the number is free; section order matches the template.

## Final message to the user

In the user's language, 3–6 lines: the rule, the list of files written (path, technique, one-line condition), any `TBD` with a question to confirm a value (record answers in `test-cases/confirmed-facts.md`, as ui-test-case-creator does), anything the template was missing (see "Output location and ID"), and that the `[ST]` chains are ready for **api-postman-collection**.

## Reference

- `references/output-template.md` — structure of every case.
- `references/example-st-chain.md` — shape of a state-transition chain.
