# TC-UIOP-009: Check before submitting shows AIRCRAFT as fail with rule ZC-2026.1 §2 for a C3 aircraft in KBP-CTR-3

| Field | Value |
|---|---|
| **ID** | TC-UIOP-009 |
| **Doc ref** | `06 — Business Rules` §1.2 (AIRCRAFT), §6 (`rule_reference` values); `07 — Clarifications — Answers From the Business Rules Owner` item 1; `04 — Frontend Scope` § Operator portal («Check before submitting»); rule `ZC-2026.1 §2` |
| **Priority** | High |
| **Level** | UI |

## Preconditions

1. An operator is registered and logged in. `authorisation_level` does not matter: the pipeline stops at AIRCRAFT before the ZONE gate.
2. A pilot of that operator with `rating` = `R_ADVANCED` and `certified_on` = today minus 1 month, so PILOT passes.
3. An aircraft of that operator with `mtom_grams` = `12001` (band `C3`).
4. A `DRAFT` flight request of that operator created in the UI with the Test data below.
5. Window, altitude and overlap do not matter: TIME_WINDOW and ZONE are never reached.

## Test data

| Item | Value |
|---|---|
| `zone_code` | `KBP-CTR-3` (permitted bands C0–C2) |
| Aircraft `mtom_grams` | `12001` (band `C3`, one gram past the C2 bound) |
| Pilot | `R_ADVANCED`, certification current |
| `requested_altitude_metres` | `50` |
| `window_start` / `window_end` | today + 3 days, 10:00 / 10:45 zone-local (assumed) |
| `flight_purpose` | `QA aircraft band check` (assumed) |

## Steps

1. Open the request detail view of the `DRAFT` request and click `flight-request-validate-button`.

## Expected result

1. `flight-request-gate-result-AIRCRAFT` shows `data-gate-status` = `FAIL` and its text contains `ZC-2026.1 §2`.

Open question: `04 — Frontend Scope` says "Check before submitting" shows a per-gate pass/fail result, but does not say that the result displays `rule_reference`. Only the request detail view is documented to show it, for rejections. Displaying `ZC-2026.1 §2` in the validate result comes from the code (`components/GateResultsPanel.tsx`), not from the docs.
Open question: the selectors `flight-request-validate-button` and `flight-request-gate-result-<GATE>` / `data-gate-status` come from the code, not from `04 — Frontend Scope`. The rule text has no `data-testid` of its own, so it is read from the text of the gate row.
