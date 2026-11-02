# TC-UIOP-013: Check before submitting leaves a DRAFT request in DRAFT when AIRCRAFT fails

| Field | Value |
|---|---|
| **ID** | TC-UIOP-013 |
| **Doc ref** | `03 — API Contract` § Flight requests (endpoint 13: validate «never changes state»); `02 — Request Lifecycle` § States (`DRAFT`); `04 — Frontend Scope` § Operator portal |
| **Priority** | High |
| **Level** | UI |

## Preconditions

1. An operator is registered and logged in.
2. A pilot of that operator with `rating` = `R_ADVANCED` and `certified_on` = today minus 1 month.
3. An aircraft of that operator with `mtom_grams` = `12001` (band `C3`), so AIRCRAFT fails.
4. A `DRAFT` flight request of that operator created in the UI with the Test data below; `flight-request-detail-state` shows `DRAFT` before the step.

## Test data

| Item | Value |
|---|---|
| `zone_code` | `KBP-CTR-3` (permitted bands C0–C2) |
| Aircraft `mtom_grams` | `12001` |
| `requested_altitude_metres` | `50` |
| `window_start` / `window_end` | today + 3 days, 10:00 / 10:45 zone-local (assumed) |
| `flight_purpose` | `QA validate keeps draft` (assumed) |

## Steps

1. Open the request detail view of the `DRAFT` request and click `flight-request-validate-button`.

## Verification

1. Reload the request detail view of the same request.

## Expected result

1. `flight-request-detail-state` shows `DRAFT`.
2. Verification 1: `flight-request-detail-state` shows `DRAFT`.

Open question: the selectors `flight-request-validate-button` and `flight-request-detail-state` come from the code, not from `04 — Frontend Scope`.
Note: TC-UIOP-006 covers the same "stays DRAFT" check for a TIME_WINDOW failure; this case covers the AIRCRAFT failure, a different condition.
