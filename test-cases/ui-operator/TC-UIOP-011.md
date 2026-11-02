# TC-UIOP-011: ZONE and TIME_WINDOW are not evaluated when AIRCRAFT fails for a C3 aircraft in KBP-CTR-3

| Field | Value |
|---|---|
| **ID** | TC-UIOP-011 |
| **Doc ref** | `06 — Business Rules` § Evaluation order («evaluation stops at the first failure») and §1.2 (AIRCRAFT); `03 — API Contract` § Gate pipeline; `04 — Frontend Scope` § Operator portal |
| **Priority** | High |
| **Level** | UI |

## Preconditions

1. An operator is registered and logged in.
2. A pilot of that operator with `rating` = `R_ADVANCED` and `certified_on` = today minus 1 month, so PILOT passes.
3. An aircraft of that operator with `mtom_grams` = `12001` (band `C3`), so AIRCRAFT fails.
4. A `DRAFT` flight request of that operator whose ZONE and TIME_WINDOW would also fail if evaluated: `requested_altitude_metres` = `200` (above the 120 m ceiling) and a window inside the curfew. This makes a not-evaluated result distinguishable from a pass.

## Test data

| Item | Value |
|---|---|
| `zone_code` | `KBP-CTR-3` (ceiling 120 m, curfew 23:00–05:00 per `A-7 §1`) |
| `requested_altitude_metres` | `200` |
| `window_start` / `window_end` | today + 3 days, 23:30 / 00:15 next day zone-local (assumed) |
| Aircraft `mtom_grams` | `12001` |
| `flight_purpose` | `QA stop at first failure` (assumed) |

## Steps

1. Open the request detail view of the `DRAFT` request and click `flight-request-validate-button`.

## Expected result

1. `flight-request-gate-result-ZONE` and `flight-request-gate-result-TIME_WINDOW` each show `data-gate-status` = `NOT_EVALUATED` (value from the code, not defined in the docs), and neither shows `PASS` or `FAIL`.

Open question: the docs say evaluation stops at the first failure (`06 — Business Rules` § Evaluation order) but do not define how a not-evaluated gate is shown in the validate result. The value `NOT_EVALUATED` comes only from the code (`components/GateResultsPanel.tsx`); it needs confirmation by the spec owner.
Open question: `03 — API Contract` and `04 — Frontend Scope` say the reviewer detail view shows «all four gate results» via `validate`, while the pipeline stops at the first failure; the docs do not reconcile the two.
Open question: the selectors `flight-request-validate-button` and `flight-request-gate-result-<GATE>` / `data-gate-status` come from the code, not from `04 — Frontend Scope`.
