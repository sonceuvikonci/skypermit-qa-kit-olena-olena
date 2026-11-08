# TC-UIOP-010: PILOT gate is shown as passed when only AIRCRAFT fails for a C3 aircraft in KBP-CTR-3

| Field | Value |
|---|---|
| **ID** | TC-UIOP-010 |
| **Doc ref** | `06 — Business Rules` §1.1 (PILOT: `R_ADVANCED` covers `CONTROLLED`; certification current 18 months), §4 (`KBP-CTR-3` is `CONTROLLED`); `04 — Frontend Scope` § Operator portal («Check before submitting» shows a per-gate pass/fail result) |
| **Priority** | High |
| **Level** | UI |

## Preconditions

1. An operator is registered and logged in.
2. A pilot of that operator with `rating` = `R_ADVANCED` and `certified_on` = today minus 1 month.
3. An aircraft of that operator with `mtom_grams` = `12001` (band `C3`), so AIRCRAFT fails and stops the pipeline.
4. A `DRAFT` flight request of that operator created in the UI with the Test data below.

## Test data

| Item | Value |
|---|---|
| `zone_code` | `KBP-CTR-3` (`CONTROLLED`, permitted bands C0–C2) |
| Pilot `rating` | `R_ADVANCED` |
| Pilot `certified_on` | today minus 1 month (current; the window is within 18 months) |
| Aircraft `mtom_grams` | `12001` |
| `requested_altitude_metres` | `50` |
| `window_start` / `window_end` | today + 3 days, 10:00 / 10:45 zone-local (assumed) |
| `flight_purpose` | `QA pilot pass check` (assumed) |

## Steps

1. Open the request detail view of the `DRAFT` request and click `flight-request-validate-button`.

## Expected result

1. `flight-request-gate-result-PILOT` shows `data-gate-status` = `PASS`.

Open question: the docs do not say that the validate result shows a passed gate before the failing one as `PASS`. `04 — Frontend Scope` only says "per-gate pass/fail result", and the `422` body names only the failing gate (`03 — API Contract`). The `PASS` for `PILOT` is inferred by the UI from gate order (source: code, `components/GateResultsPanel.tsx`).
Open question: the selectors `flight-request-validate-button` and `flight-request-gate-result-<GATE>` / `data-gate-status` come from the code, not from `04 — Frontend Scope`.
