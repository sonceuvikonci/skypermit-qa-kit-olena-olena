# API-OP-<NNN>: [ST] <Condition that violates the rule>: validate keeps DRAFT, submit rejects, resubmit is 409

<!-- Shape example of a state-transition chain. Values are described, not given, so cases do not
     copy each other's data. Take real values from the pages in Doc ref. -->

| Field | Value |
|---|---|
| **ID** | API-OP-<NNN> |
| **Doc ref** | `06 — Business Rules` §<section> (as corrected by `07 — Clarifications` item <n> if it applies); rule `<rule_reference>`; `03 — API Contract` § Flight requests, § Error semantics; `02 — Request Lifecycle` §<section with DRAFT → REJECTED and the forbidden transition from REJECTED> |
| **Technique** | ST |
| **Priority** | High |
| **Level** | API |

## Preconditions

1. Pre 1 — `POST /api/v1/operators`, auth: none, body <registration fields> → operator session.
2. Pre 2 — `POST /api/v1/pilots`, auth: operator session, body <a pilot that passes every earlier gate> → `{{pilotId}}`.
3. Pre 3 — `POST /api/v1/aircraft`, auth: operator session, body <an aircraft that passes every earlier gate> → `{{aircraftId}}`.
4. Pre 4 — `POST /api/v1/flight-requests`, auth: operator session, body <`{{pilotId}}`, `{{aircraftId}}`, the zone and the value that violates only the rule under test> → `{{flightRequestId}}` in `DRAFT`.

## Test data

| Item | Value |
|---|---|
| <Zone> | <a seed zone whose attributes make only this rule fail; name it> |
| <Attribute under test> | <the violating value> |
| <Time fields> | <relative to execution, UTC or zone-local, outside any curfew> |

## Steps

1. `POST /api/v1/flight-requests/{{flightRequestId}}/validate` — auth: operator session — body: —
2. `GET /api/v1/flight-requests/{{flightRequestId}}` — auth: operator session
3. `POST /api/v1/flight-requests/{{flightRequestId}}/submit` — auth: operator session — body: —
4. `GET /api/v1/flight-requests/{{flightRequestId}}` — auth: operator session
5. `POST /api/v1/flight-requests/{{flightRequestId}}/submit` — auth: operator session — body: —

## Expected result

1. Step 1 returns `422` with `failing_gate` = `<GATE>`, `rule_reference` = `<rule_reference>`, `message` = non-empty string.
2. Step 2 returns <status from 03 or confirmed-facts> with `state` = `DRAFT`.
3. Step 3 returns <`422` with the same `failing_gate` and `rule_reference`, or TBD if 02/03 do not define it>.
4. Step 4 returns <status> with `state` = `REJECTED`.
5. Step 5 returns `409`.
