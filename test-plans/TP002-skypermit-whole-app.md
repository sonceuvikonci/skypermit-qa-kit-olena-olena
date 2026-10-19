# Test Plan #TP002

| | | |
|---|---|---|
| **Project:** skypermit | **Site:** TBD | **Owner:** TBD |
| **Release:** TBD | **Sprint:** TBD | **Sources:** `../skypermit/docs/` — `01-data-model.md`, `02-state-machine.md`, `03-api-contract.md`, `04-frontend-spec.md`, `05-open-questions.md`, `06-business-rules.md`, `07-clarifications.md`, `08-uml-diagrams.md` |

## Introduction

Master test plan for the whole Skypermit application: operator registry and login, flight request lifecycle, the four-gate validation pipeline, reviewer decisions, and the operator/reviewer UI. Where docs disagree, `07-clarifications.md` governs `06-business-rules.md`, and `05-open-questions.md` is the canonical status of open items. Header fields marked TBD need an owner.

## Goals

1. Verify every legal and illegal state transition of `FlightRequest` and every `rule_reference` returned by the gate pipeline.
2. Verify authentication and authorisation (`401`/`403`, operator isolation, reviewer access via `X-Reviewer-Id`).
3. Verify the main operator and reviewer UI flows, including the `data-testid` contract.
4. Produce test cases (`test-cases/`) and a test report; record doc gaps as open questions.

## Risks

| # | Area | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| 1 | State machine | An illegal `(from, action)` pair is accepted instead of `409` (e.g. `submit` on `UNDER_REVIEW`, anything from `REJECTED`/`CANCELLED`/`COMPLETED`); cancel of `APPROVED` less than 2 h before `window_start` is allowed (`TSD-4 §6`) | M | H | Execute every row of the transition table in `02-state-machine.md` plus every non-listed pair via the API; for the 2 h boundary see Entry Criteria (fixtures) |
| 2 | Gates | Wrong `failing_gate` or `rule_reference`: gates not evaluated in `PILOT→AIRCRAFT→ZONE→TIME_WINDOW` order; weight band reported as `ZONE` instead of `AIRCRAFT`; the shared `ZC-2026.1 §2` citation confusing altitude and weight-band failures | M | H | One case per `rule_reference` in `06-business-rules.md` §6; cases with two failing gates at once to check "first failure wins" |
| 3 | TIME_WINDOW | Boundary errors: lead time 6 h (`TSD-4 §2.1`), advance 60 days (`§2.2`), duration 15 and 240 min inclusive (`§3`), windows touching at a boundary treated as overlap (`§5`), only `APPROVED`/`UNDER_REVIEW` counted in overlap | H | H | Boundary-value cases at value, value−1 min, value+1 min; overlap cases for each of the 6 states |
| 4 | TIME_WINDOW | Curfew evaluated wrongly: `KBP-CTR-3`/`ODS-CTR-5` must use `A-7` 23:00–05:00, not 22:00–06:00; midnight-crossing curfew; window partly inside curfew; UTC → zone-local conversion | H | H | Windows starting/ending at 22:30, 23:30, 04:30, 05:30 local on all four curfew zones; window straddling the curfew edge; zones without curfew (`DNI-OPN-1`, `KHR-OPN-4`) as control |
| 5 | Auth | Operator reads or changes another operator's pilot/aircraft/request (must be `403`); no session returns something other than `401`; `GET /flight-requests` not scoped to the session operator; reviewer header not accepted for reviewer-or-owner reads | M | H | Two operator accounts: cross-access to every operator-scoped endpoint; no-session calls; list with and without `X-Reviewer-Id` |
| 6 | Validate/submit | `validate` changes state or writes `AuditLog`; `validate` and `submit` results diverge; request that passed `validate` but fails `submit` after another request for the same aircraft was approved (expected per `02-state-machine.md`) | M | H | Call `validate` repeatedly and compare state/`submitted_at`; reproduce the "approved in the interim" scenario with two requests on one aircraft |
| 7 | Aircraft | Weight band wrong at 900 / 3,500 / 12,000 g or after correcting `mtom_grams`; `mtom_grams` > 30,000 g not refused with `422` (`OH-1 §3`) at `POST /aircraft`; band stored instead of derived | M | H | Register aircraft at 900, 901, 3,500, 3,501, 12,000, 12,001, 30,000, 30,001 g; check `GET /aircraft/{id}` band and the `422` |
| 8 | Pilot | Certification currency not 18 months (`OH-1 §2.3`), checked against submission time instead of `window_start`; rating vs zone class matrix wrong (`OH-1 §2.1`) | M | H | Pilots with `certified_on` at exactly 18 months and one day beyond, relative to `window_start`; 3 ratings × 3 zone classes |
| 9 | Reviewer | `reject` accepted without `note`; missing `X-Reviewer-Id` not `400`; approve/reject on a non-`UNDER_REVIEW` request not `409`; `ReviewAction` or `AuditLog` row not written | M | M | API cases for each; confirm the rows through the UI detail view (`decided_by`, `decided_at`) and, if no UI shows them, via DB read access |
| 10 | ZONE gate | Altitude > `ceiling_metres` not caught; operator `authorisation_level` below `required_authorisation_level` not caught (`OH-1 §4`); inactive zone not caught (`ZC-2026.1 §4`) | M | M | Altitude = ceiling and ceiling+1 per zone; a fresh `L1` operator against `KBP-CTR-3` (`L2`) and `LVV-RST-2` (`L3`); inactive zone needs DB access (all seeded zones are active) |
| 11 | Operator status | `SUSPENDED` operator can still create, submit or approve; response is not defined in the docs (`05-open-questions.md` §1) | L | M | Set `status = SUSPENDED` via DB (no API path); record observed code/body as an Open Question, do not assert one |
| 12 | UI | `data-testid` values missing or renamed; pickers filter by business rules (must not, `04-frontend-spec.md`); "Check before submitting" changes state; rejection reason/`rule_reference` not shown on detail | M | M | Walk both roles through every screen and verify the `data-testid` of each interactive element; select an ineligible combination and confirm it reaches the gate result |

## In Scope

- Auth: register (`POST /operators`, always `L1`), login, logout, `GET /auth/me`; pages `/login`, `/register`
- Registry: operators, pilots (with derived currency), aircraft (with derived weight band, 30,000 g limit), zones (read-only)
- Flight request create (`DRAFT`), field validation incl. `window_end` after `window_start` and `flight_purpose` ≤ 2,000 characters
- `PILOT`, `AIRCRAFT`, `ZONE`, `TIME_WINDOW` gates via `validate` and `submit`
- State machine: all legal transitions and all illegal pairs (`409`)
- Cancellation incl. the 2 h deadline for `APPROVED`
- Reviewer queue: approve, reject with note, `X-Reviewer-Id` handling
- Error semantics: `400`, `401`, `403`, `404`, `409`, `422` body (`failing_gate`, `rule_reference`, `message`)
- Operator portal UI: registry pages, request form, "Check before submitting", "My requests" filter by state, request detail
- Reviewer UI: pending table sorted by submission time, detail with all four gate results
- Data integrity: `AuditLog` entry per state change, append-only (no update/delete path), derived values never stored
- `data-testid` contract and role switcher in the header

## Out of Scope

- Performance, load and security (penetration) testing
- Writing automated tests
- `COMPLETED` transition: maintenance-only endpoint, not part of the documented API; `SUBMITTED` at rest (transient, never observable)
- Unwired fields: `Aircraft.status = RETIRED`, `Pilot.status = INACTIVE` (`05-open-questions.md` row 2) — only check that they do not affect gates
- `CR-1` proposal and superseded `OH-1` v1.4 values (24 months, 4,000 g)
- Raising `authorisation_level` (out-of-band admin action) and zone maintenance

## Test Strategy

| Area | Level | Approach | Reason |
|---|---|---|---|
| State transitions (legal and illegal) | API | Manual, automation candidate | Stable table, many repeated combinations |
| Gate rules and `rule_reference` per condition | API | Automation candidate | Data-driven boundary values, one case per rule code |
| `TIME_WINDOW` boundaries and curfew | API | Automation candidate | Relative-date fixtures, many boundary pairs |
| Auth and operator isolation | API | Manual, automation candidate | Few accounts, repeatable matrix of endpoint × caller |
| Registration and login flows | UI | Manual | Combined form, session cookie behaviour |
| Operator request flow incl. "Check before submitting" | UI | Manual | Exploratory value, multi-step |
| Reviewer queue, approve/reject | UI | Manual | Role switcher, note validation |
| Form validation (lengths, required fields, dates) | UI | Automation candidate | Repetitive data-driven checks |
| `data-testid` presence | UI | Automation candidate | Mechanical check of a fixed contract |
| `AuditLog`, `ReviewAction`, SUSPENDED, inactive zone | DB | Manual | Needs direct DB access, small number of checks |
| Visual layout, UX | UI | Manual | Minimal styling by design; human judgement only |

## Entry Criteria

1. Docs in Sources are reviewed with testers; open items from 05 are acknowledged.
2. Environment, browsers and test accounts are available (see Environments).
3. Fixtures prepared:
   - Two operator accounts (A, B) at `L1`; one operator raised to `L2` and one to `L3` via DB
   - Pilots: one per rating; `certified_on` exactly 18 months and 18 months + 1 day before a chosen `window_start`
   - Aircraft at 900, 901, 3,500, 3,501, 12,000, 12,001, 30,000 and 30,001 g
   - All six zones from `06-business-rules.md` §4; one zone set `active = false`
   - Windows relative to now: +6 h, +6 h − 1 min, +60 days, +60 days + 1 min; durations 14, 15, 240, 241 min
4. Direct DB access (read; write for `status`, `active`, `authorisation_level`, `window_start` shifting) is granted — needed for SUSPENDED, inactive zone, higher auth levels, and an `APPROVED` request less than 2 h before `window_start` (the 6 h lead time prevents creating it via the UI).
5. A reviewer identifier for `X-Reviewer-Id` is agreed.
6. Test cases for all High risks (1–8) are written and reviewed.

## Environments

- Application URL, hosting and database: TBD
- Browsers and OS: TBD
- API client for manual calls: TBD

## Exit Criteria

1. ≥ 85% of planned test cases executed; 100% of cases for risks 1–8 executed.
2. 0 open Critical/High defects.
3. Every legal and illegal transition in `02-state-machine.md` and every `rule_reference` in `06-business-rules.md` §6 is covered by at least one executed case.
4. Every error status in `03-api-contract.md` (`400`, `401`, `403`, `404`, `409`, `422`) is observed at least once.
5. Every `data-testid` on the operator and reviewer screens is checked.
6. Test report is delivered, with Open Questions status attached.

## Tools

- Test documentation: Markdown in this repo (`test-cases/`, `test-plans/`)
- Defect tracker, version control host, API client: TBD

## Schedule and Estimations

**Start date:** TBD | **End date:** TBD

1. Analysis of docs and fixture preparation: TBD
2. Test case design (API gates and state machine, UI flows, auth): TBD
3. Execution and defect reporting: TBD
4. Test report: TBD

## People

- QA Engineer: TBD

## Open Questions

1. [doc gap] Status code and body for a `SUSPENDED` operator's blocked create/submit/approve — `05-open-questions.md` §1, `07-clarifications.md` §3.
2. [doc vs doc] `03-api-contract.md` (Error semantics) lists `403` for the "pre-existing `SUSPENDED`-operator precondition", while `05-open-questions.md` §1 says the code is undefined and `403` is only a placeholder.
3. [doc gap] Citation `ZC-2026.1 §4` for an inactive zone is unconfirmed — `05-open-questions.md` §2, `06-business-rules.md` §6.
4. [doc vs doc] Gate pipeline stops at the first failure (`03-api-contract.md` Gate pipeline, `06-business-rules.md` Evaluation order), but `04-frontend-spec.md` requires "per-gate pass/fail" in "Check before submitting" and "all four gate results" in the reviewer detail view. Unclear what is shown for gates after the first failure.
5. [doc gap] The completion endpoint (`APPROVED → COMPLETED`) has no path, caller or contract in `03-api-contract.md` — `02-state-machine.md` table.
6. [doc vs doc] Missing `X-Reviewer-Id` on approve/reject: `400` in `03-api-contract.md` Reviewer section, but `401` ("no operator session and no `X-Reviewer-Id`") in the Error semantics table.
7. [doc gap] Status codes for input validation at create are not defined: `window_end` ≤ `window_start`, `flight_purpose` > 2,000 characters (`01-data-model.md` Time handling), duplicate `national_id`/`email`/`serial_number` — `400`, `409` or `422`?
8. [doc gap] Success status and body of `submit` ("200/201" in `08-uml-diagrams.md`) and the per-gate response shape of `validate` are not specified — `03-api-contract.md` endpoints 10 and 13.
9. [doc gap] Time zone of each zone's curfew and daylight-saving handling are not stated — `01-data-model.md` Time handling, `06-business-rules.md` §1.4.
10. [doc gap] How "18 months" and "6 hours / 60 days" are counted (calendar months vs. days; reference instant for lead time — `submitted_at` or request time) — `06-business-rules.md` §1.1, §1.4.
