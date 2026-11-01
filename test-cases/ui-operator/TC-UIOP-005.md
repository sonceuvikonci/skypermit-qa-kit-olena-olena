# TC-UIOP-005: ZONE gate is shown as passed when only TIME_WINDOW fails on a KBP-CTR-3 curfew

| Field | Value |
|---|---|
| **ID** | TC-UIOP-005 |
| **Doc ref** | `06 — Business Rules` Evaluation order, §1.3, §1.4 (Curfew); `04 — Frontend Scope` § Operator portal; rule `A-7 §1` |
| **Priority** | High |
| **Level** | UI |

## Preconditions

1. An operator is registered and logged in. Its `authorisation_level` is `L2` (admin action, out-of-band), meeting the zone's required level `L2`.
2. A pilot of that operator with `rating` = `R_ADVANCED` and `certified_on` = today minus 1 month.
3. An aircraft of that operator with `mtom_grams` = `500`, band `C0`.
4. A `DRAFT` flight request created in the UI with the Test data below; the zone is active.
5. The browser time zone is `Europe/Kyiv`.
6. Lead time, advance booking, duration and overlap never decide the outcome.

## Test data

| Item | Value |
|---|---|
| `zone_code` | `KBP-CTR-3` (ceiling 120 m, required level `L2`) |
| `requested_altitude_metres` | `120` (equals the ceiling, still within it) |
| `window_start` | today + 3 days, 22:30 zone-local |
| `window_end` | same date, 23:15 zone-local |
| `flight_purpose` | `QA gate order check` (assumed) |

## Steps

1. Open the request detail view of the `DRAFT` request and click `flight-request-validate-button`.

## Expected result

1. `flight-request-gate-result-ZONE` shows `data-gate-status` = `PASS`.

Open question: which time zone is "zone-local" for curfews, and how the request form interprets typed times, is not defined in `06 — Business Rules` §1.4 or `04 — Frontend Scope`; the code assumes `Europe/Kyiv` and the browser time zone (precondition: browser in `Europe/Kyiv`).
Open question: the selectors `flight-request-validate-button` and `flight-request-gate-result-<GATE>` / `data-gate-status`, and the placement of "Check before submitting" on the request detail view, are taken from the code, not from `04 — Frontend Scope`.
Open question: how gates before the failing one are displayed (`PASS`) is inferred by the UI; `03 — API Contract` and `04 — Frontend Scope` do not state it.
