# API-OP-<NNN>: <[ST] for chains> <Condition and outcome, one line>

<!--
How to use this template:
- Keep every section, in this order. Replace each <placeholder>; delete these comments.
- One rule per case. BV/EP: one Step (POST .../validate). ST: one chain, an expected result per Step.
- Every request: method, /api/v1 path, body (or —), and exactly ONE auth mode
  (operator session OR X-Reviewer-Id OR none for a 401 case). Never both.
- No data-testid, no 04 — Frontend Scope.
- Save as test-cases/api/API-OP-<NNN>.md.
-->

| Field | Value |
|---|---|
| **ID** | API-OP-<NNN> |
| **Doc ref** | `06 — Business Rules` §<section>; rule `<rule_reference>`; `03 — API Contract` §<section>; `02 — Request Lifecycle` §<section> <!-- ST only --> |
| **Technique** | <BV / EP / ST> |
| **Priority** | <High / Medium / Low> |
| **Level** | API |
| **Story** | <Jira key from the `story` argument; delete this row if none> |

## Preconditions

<!-- Setup requests only. Each one: method, path, auth, key body values, stored variable.
     Make every earlier gate pass (PILOT → AIRCRAFT → ZONE → TIME_WINDOW).
     Access the API does not give: "via DB" or "admin action". -->

1. Pre 1 — `POST /api/v1/operators`, auth: none, body `<registration fields>` → session cookie (operator session)
2. Pre 2 — `POST /api/v1/pilots`, auth: operator session, body `<fields that pass PILOT>` → `{{pilotId}}`
3. Pre 3 — `POST /api/v1/aircraft`, auth: operator session, body `<fields>` → `{{aircraftId}}`
4. Pre 4 — `POST /api/v1/flight-requests`, auth: operator session, body `<fields with the value under test>` → `{{flightRequestId}}` in `DRAFT`

## Test data

<!-- Concrete values; one boundary value per case; times relative to execution, UTC or zone-local.
     Mark sources: "(from `01 — Data Model`)", "(from `confirmed-facts.md` #<n>)", "(assumed)". -->

| Item | Value |
|---|---|
| <field under test> | <exact value> <(source)> |
| <other field> | <neutral passing value> |

## Steps

<!-- BV/EP: exactly one step, the validate call. ST: the chain, writes and GETs alternating. -->

1. `POST /api/v1/flight-requests/{{flightRequestId}}/validate`
   Auth: operator session
   Body: —

## Verification

<!-- Optional, BV/EP only. Read-only GETs defined in 03. Delete if not needed. -->

1. `GET /api/v1/flight-requests/{{flightRequestId}}`, auth: operator session

## Expected result

<!-- One item per Step / Verification, same order. Status code always; for 422 the full body
     contract; message = non-empty string, never exact text. Undefined → TBD + Open question. -->

1. Step 1 returns `422` with `failing_gate` = `<GATE>`, `rule_reference` = `<verbatim from 06 §6>`, `message` = non-empty string
2. Verification 1 returns `200` <(confirmed: `confirmed-facts.md` #<n>) if not in 03> with `state` = `DRAFT`

Open question: <what is undefined, page § section> <!-- only if a value is TBD -->
