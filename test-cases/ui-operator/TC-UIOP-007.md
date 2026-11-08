# TC-UIOP-007: Window 22:00–22:45 in KBP-CTR-3 passes TIME_WINDOW

| Field | Value |
|---|---|
| **ID** | TC-UIOP-007 |
| **Doc ref** | `06 — Business Rules` §1.4 (Curfew; curfew values per zone); `04 — Frontend Scope` § Operator portal; rule `A-7 §1` |
| **Priority** | High |
| **Level** | UI |

## Preconditions

1. An operator is registered and logged in. Its `authorisation_level` is `L2` (admin action, out-of-band).
2. A pilot of that operator with `rating` = `R_ADVANCED` and `certified_on` = today minus 1 month.
3. An aircraft of that operator with `mtom_grams` = `500`, band `C0`.
4. A `DRAFT` flight request created in the UI with the Test data below; altitude is under the ceiling and the zone is active.
5. The browser time zone is `Europe/Kyiv`.
6. Lead time, advance booking, duration (45 min) and overlap hold: date is today + 3 days, no other request for the aircraft.

## Test data

| Item | Value |
|---|---|
| `zone_code` | `KBP-CTR-3` (curfew 23:00–05:00 per `A-7 §1`; the ZC-2026.1 value 22:00–06:00 is not applied) |
| `requested_altitude_metres` | `50` |
| `window_start` | today + 3 days, 22:00 zone-local |
| `window_end` | same date, 22:45 zone-local (ends 15 min before the curfew) |
| `flight_purpose` | `QA curfew pass check` (assumed) |

## Steps

1. Open the request detail view of the `DRAFT` request and click `flight-request-validate-button`.

## Expected result

1. `flight-request-gate-result-TIME_WINDOW` shows `data-gate-status` = `PASS`.

Open question: which time zone is "zone-local" for curfews, and how the request form interprets typed times, is not defined in `06 — Business Rules` §1.4 or `04 — Frontend Scope`; the code assumes `Europe/Kyiv` and the browser time zone (precondition: browser in `Europe/Kyiv`).
Open question: the selectors `flight-request-validate-button` and `flight-request-gate-result-<GATE>` / `data-gate-status`, and the placement of "Check before submitting" on the request detail view, are taken from the code, not from `04 — Frontend Scope`.
