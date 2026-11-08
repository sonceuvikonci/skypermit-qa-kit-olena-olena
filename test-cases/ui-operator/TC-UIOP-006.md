# TC-UIOP-006: Check before submitting leaves a DRAFT request in DRAFT when TIME_WINDOW fails

| Field | Value |
|---|---|
| **ID** | TC-UIOP-006 |
| **Doc ref** | `04 — Frontend Scope` § Operator portal ("Check before submitting" … without changing state); `02 — Request Lifecycle` States (`DRAFT`) |
| **Priority** | High |
| **Level** | UI |

## Preconditions

1. An operator is registered and logged in. Its `authorisation_level` is `L2` (admin action, out-of-band).
2. A pilot of that operator with `rating` = `R_ADVANCED` and `certified_on` = today minus 1 month.
3. An aircraft of that operator with `mtom_grams` = `500`, band `C0`.
4. A `DRAFT` flight request created in the UI with the Test data below. Before the step, `flight-request-detail-state` shows the `DRAFT` badge.
5. The browser time zone is `Europe/Kyiv`.

## Test data

| Item | Value |
|---|---|
| `zone_code` | `KBP-CTR-3` |
| `requested_altitude_metres` | `50` |
| `window_start` | today + 3 days, 22:30 zone-local |
| `window_end` | same date, 23:15 zone-local (the window falls inside the curfew, so the check fails) |
| `flight_purpose` | `QA no state change check` (assumed) |

## Steps

1. Open the request detail view of the `DRAFT` request and click `flight-request-validate-button`.

## Verification

1. Reload the request detail view and read `flight-request-detail-state`.

## Expected result

1. Step 1 shows no `rejection-callout` (the request is not rejected).
2. Verification 1: `flight-request-detail-state` shows `DRAFT`.

Open question: the visible text of the `DRAFT` badge is not defined in the docs (`04 — Frontend Scope`); the selector `flight-request-detail-state` comes from the code, not from the docs.

Open question: which time zone is "zone-local" for curfews, and how the request form interprets typed times, is not defined in `06 — Business Rules` §1.4 or `04 — Frontend Scope`; the code assumes `Europe/Kyiv` and the browser time zone (precondition: browser in `Europe/Kyiv`).
Open question: the selectors `flight-request-validate-button` and `flight-request-gate-result-<GATE>` / `data-gate-status`, and the placement of "Check before submitting" on the request detail view, are taken from the code, not from `04 — Frontend Scope`.
