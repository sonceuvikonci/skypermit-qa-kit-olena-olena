# TC-UIOP-002: TIME_WINDOW curfew failure in KBP-CTR-3 cites A-7 §1, not ZC-2026.1 §3

| Field | Value |
|---|---|
| **ID** | TC-UIOP-002 |
| **Doc ref** | `06 — Business Rules` §1.4 (curfew values per zone), §6 (`rule_reference` table); `04 — Frontend Scope` § Operator portal; `03 — API Contract` endpoint 13, § Error semantics, § The `422` body; rule `A-7 §1` |
| **Priority** | High |
| **Level** | UI |

## Preconditions

1. An operator is registered and logged in. Its `authorisation_level` is `L2` (admin action, out-of-band), so the `ZONE` gate passes for `KBP-CTR-3`.
2. A pilot of that operator with `rating` = `R_ADVANCED` and `certified_on` = today minus 1 month (`PILOT` passes).
3. An aircraft of that operator with `mtom_grams` = `500`, band `C0` (`AIRCRAFT` passes).
4. A flight request of that operator in `DRAFT`, created in the UI with the Test data below.
5. The browser time zone is `Europe/Kyiv`.
6. Lead time, advance booking, duration and overlap never decide the outcome (date is today + 3 days, duration 45 min, no other request for the aircraft).
7. Browser DevTools, Network tab, is open before the step so the request `POST /api/v1/flight-requests/{id}/validate` can be inspected.

## Test data

| Item | Value |
|---|---|
| `zone_code` | `KBP-CTR-3` (curfew 23:00–05:00 per `A-7 §1`) |
| `requested_altitude_metres` | `50` |
| `window_start` | today + 3 days, 22:30 zone-local |
| `window_end` | same date, 23:15 zone-local |
| `flight_purpose` | `QA curfew rule check` (assumed) |

## Steps

1. Open the request detail view of the `DRAFT` request and click `flight-request-validate-button`.

## Expected result

1. The `flight-request-gate-result-TIME_WINDOW` card shows the rule reference text `A-7 §1`.
2. The network call `POST /api/v1/flight-requests/{id}/validate` made by Step 1 returns status `422` with body `rule_reference` = `A-7 §1` (and `failing_gate` = `TIME_WINDOW`).

Open question: which time zone is "zone-local" for curfews, and how the request form interprets typed times, is not defined in `06 — Business Rules` §1.4 or `04 — Frontend Scope`; the code assumes `Europe/Kyiv` and the browser time zone (precondition: browser in `Europe/Kyiv`).
Open question: the selectors `flight-request-validate-button` and `flight-request-gate-result-<GATE>` / `data-gate-status`, and the placement of "Check before submitting" on the request detail view, are taken from the code, not from `04 — Frontend Scope`.
