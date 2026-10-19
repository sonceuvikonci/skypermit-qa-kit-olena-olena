# TC-GATE-001: Weight band not in zone's permitted bands fails AIRCRAFT gate

| Field | Value |
|---|---|
| **ID** | TC-GATE-001 |
| **Doc ref** | `06-business-rules.md` §1.2, §3, §6 (as corrected by `07-clarifications.md` item 1); rule `ZC-2026.1 §2` |
| **Priority** | High |
| **Level** | API |

## Preconditions

1. Operator A is registered and logged in (session cookie present).
2. Pilot P belongs to Operator A, `rating` = `R_BVLOS`, `certified_on` less than 18 months before the request's `window_start` (PILOT gate passes).
3. Aircraft X belongs to Operator A, `mtom_grams` = 3,501 (derived band `C2`).
4. Flight request R belongs to Operator A, is in `DRAFT`, and uses Pilot P, Aircraft X and the test data below.
5. Operator A's `authorisation_level` does not matter: the AIRCRAFT gate runs before the ZONE gate and stops the pipeline.

## Test data

| Item | Value |
|---|---|
| Zone | `LVV-RST-2` (`RESTRICTED`, permitted bands `C0`–`C1`, ceiling 60 m) |
| `mtom_grams` | 3,501 (band `C2`, first value above the `C1` upper bound) |
| `window_start` | now + 24 h, at 12:00 zone-local time (outside curfew 22:00–06:00) |
| `window_end` | `window_start` + 30 min |
| `requested_altitude_metres` | 30 |

## Steps

1. Send `POST /api/v1/flight-requests/{R.id}/validate` with Operator A's session.

## Expected result

1. Step 1 returns `422` with `failing_gate` = `AIRCRAFT` and `rule_reference` = `ZC-2026.1 §2`.