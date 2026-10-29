# TC-GATE-003: Window shorter than 15 minutes fails TIME_WINDOW gate

| Field | Value |
|---|---|
| **ID** | TC-GATE-003 |
| **Doc ref** | `06-business-rules.md` §1.4 (duration), §6; `03-api-contract.md` "The `422` body", endpoint 10 (`submit`); rule `TSD-4 §3` |
| **Priority** | High |
| **Level** | API |

## Preconditions

1. An operator is registered and logged in; it owns everything below.
2. A pilot of that operator with `rating` = `R_BASIC` and `certified_on` = today minus 1 month, so the `PILOT` gate passes (`OPEN` zone accepts any rating, certification is current for 18 months).
3. An aircraft of that operator with `mtom_grams` = `500` (band `C0`), so the `AIRCRAFT` gate passes (`DNI-OPN-1` permits `C0`–`C3`).
4. A flight request of that operator in `DRAFT`, created with the pilot, aircraft and Test data below. The `ZONE` gate passes (altitude is below the ceiling, `L1` operator meets `L1` required level, zone is active).
5. The lead-time, advance-booking, curfew and overlap checks never decide the outcome: the window starts about 24 h ahead, `DNI-OPN-1` has no curfew and the aircraft has no other request.

## Test data

| Item | Value |
|---|---|
| `zone_code` | `DNI-OPN-1` (`OPEN`, ceiling 120 m, `C0`–`C3`, required level `L1`, no curfew, active) |
| `requested_altitude_metres` | `50` |
| `window_start` | submission time + 24 h, UTC |
| `window_end` | `window_start` + 14 min, UTC (duration one minute under the 15-minute minimum) |
| `flight_purpose` | `QA duration check` (assumed) |
| operator `authorisation_level` | `L1` (default at registration, `03-api-contract.md`) |

## Steps

1. Send `POST /api/v1/flight-requests/{id}/submit` for the `DRAFT` request, using the owning operator's session.

## Expected result

1. Step 1 returns `422` with `failing_gate` = `TIME_WINDOW` and `rule_reference` = `TSD-4 §3`.
