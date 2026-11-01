# TC-UIOP-001: Window that starts before and ends inside the KBP-CTR-3 curfew shows TIME_WINDOW as fail

| Field | Value |
|---|---|
| **ID** | TC-UIOP-001 |
| **Doc ref** | `06 — Business Rules` §1.4 (Curfew, curfew values per zone), §6; `04 — Frontend Scope` § Operator portal ("Check before submitting"); `03 — API Contract` endpoint 13, § Error semantics, § The `422` body; rule `A-7 §1` |
| **Priority** | High |
| **Level** | UI |

## Preconditions

1. An operator is registered and logged in. Its `authorisation_level` is `L2` (admin action, out-of-band: registration always starts at `L1`, `04 — Frontend Scope`), so the `ZONE` gate passes for `KBP-CTR-3` (required level `L2`).
2. A pilot of that operator with `rating` = `R_ADVANCED` and `certified_on` = today minus 1 month, so the `PILOT` gate passes (`CONTROLLED` zone, certification current for 18 months).
3. An aircraft of that operator with `mtom_grams` = `500` (band `C0`), so the `AIRCRAFT` gate passes (`KBP-CTR-3` permits `C0`–`C2`).
4. A flight request of that operator in `DRAFT`, created in the UI with the pilot, aircraft and Test data below. Altitude is under the ceiling (120 m) and the zone is active.
5. The browser time zone is `Europe/Kyiv` so values typed into `datetime-local` inputs are zone-local (the app treats zone-local as `Europe/Kyiv`).
6. Browser DevTools, Network tab, is open before the step so the request `POST /api/v1/flight-requests/{id}/validate` can be inspected.
7. Lead time (≥ 6 h), advance booking (≤ 60 days), duration (15–240 min) and overlap never decide the outcome: the date is 3 days ahead, the duration is 45 min, the aircraft has no other request.

## Test data

| Item | Value |
|---|---|
| `zone_code` | `KBP-CTR-3` (`CONTROLLED`, ceiling 120 m, `C0`–`C2`, required level `L2`, curfew 23:00–05:00 per `A-7 §1`, active) |
| `requested_altitude_metres` | `50` |
| `window_start` | date = today + 3 days, 22:30 zone-local (before the curfew starts) |
| `window_end` | same date, 23:15 zone-local (15 min inside the curfew; duration 45 min) |
| `flight_purpose` | `QA curfew check` (assumed) |

## Steps

1. Open the request detail view of the `DRAFT` request and click `flight-request-validate-button`.

## Expected result

1. `flight-request-gate-result-TIME_WINDOW` shows `data-gate-status` = `FAIL`.
2. The network call `POST /api/v1/flight-requests/{id}/validate` made by Step 1 returns status `422` with body `failing_gate` = `TIME_WINDOW` and `rule_reference` = `A-7 §1`.

Open question: the `message` text of the `422` is not defined in the docs and is not asserted.

Open question: which time zone is "zone-local" for curfews, and how the request form interprets typed times, is not defined in `06 — Business Rules` §1.4 or `04 — Frontend Scope`; the code assumes `Europe/Kyiv` and the browser time zone (precondition: browser in `Europe/Kyiv`).
Open question: the selectors `flight-request-validate-button` and `flight-request-gate-result-<GATE>` / `data-gate-status`, and the placement of "Check before submitting" on the request detail view, are taken from the code, not from `04 — Frontend Scope`.
