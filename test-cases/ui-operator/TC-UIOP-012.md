# TC-UIOP-012: A 12000 g (C2) aircraft in KBP-CTR-3 passes the AIRCRAFT gate

| Field | Value |
|---|---|
| **ID** | TC-UIOP-012 |
| **Doc ref** | `06 — Business Rules` §3 (band `C2` is above 3,500 g up to 12,000 g inclusive), §4 (`KBP-CTR-3` permits C0–C2), §1.2; `04 — Frontend Scope` § Operator portal |
| **Priority** | High |
| **Level** | UI |

## Preconditions

1. An operator is registered and logged in. Its `authorisation_level` is `L2` (admin action, out-of-band), so ZONE passes for `KBP-CTR-3`.
2. A pilot of that operator with `rating` = `R_ADVANCED` and `certified_on` = today minus 1 month, so PILOT passes.
3. An aircraft of that operator with `mtom_grams` = `12000` (upper bound of `C2`, inclusive).
4. A `DRAFT` flight request of that operator created in the UI with the Test data below; no other request exists for the aircraft.

## Test data

| Item | Value |
|---|---|
| `zone_code` | `KBP-CTR-3` (permitted bands C0–C2, ceiling 120 m, curfew 23:00–05:00) |
| Aircraft `mtom_grams` | `12000` (band `C2`, exact upper bound) |
| `requested_altitude_metres` | `50` |
| `window_start` / `window_end` | today + 3 days, 10:00 / 10:45 zone-local (assumed), outside the curfew, duration 45 min |
| `flight_purpose` | `QA boundary C2 check` (assumed) |

## Steps

1. Open the request detail view of the `DRAFT` request and click `flight-request-validate-button`.

## Expected result

1. `flight-request-gate-result-AIRCRAFT` shows `data-gate-status` = `PASS`.

Open question: the selectors `flight-request-validate-button` and `flight-request-gate-result-<GATE>` / `data-gate-status` come from the code, not from `04 — Frontend Scope`.
Open question: which time zone is "zone-local" for the window, and how the form interprets typed times, is not defined in `06 — Business Rules` §1.4 or `04 — Frontend Scope`; the browser time zone is assumed to be `Europe/Kyiv`.
