# TC-GATE-002: Window starting more than 60 days ahead fails TIME_WINDOW gate

| Field | Value |
|---|---|
| **ID** | TC-GATE-002 |
| **Doc ref** | `06-business-rules.md` §1.4 (maximum advance booking), §6; `03-api-contract.md` "The `422` body", endpoint 10 (`submit`); rule `TSD-4 §2.2` |
| **Priority** | High |
| **Level** | API |

## Preconditions

1. An operator is registered and logged in; it owns everything below.
2. A pilot of that operator with `rating` = `R_BASIC` and `certified_on` = today minus 1 month, so the `PILOT` gate passes (`OPEN` zone accepts any rating, certification is current for 18 months). Currency is checked against `window_start` (about 60 days ahead), which is still within 18 months.
3. An aircraft of that operator with `mtom_grams` = `500` (band `C0`), so the `AIRCRAFT` gate passes (`DNI-OPN-1` permits `C0`–`C3`).
4. A flight request of that operator in `DRAFT`, created with the pilot, aircraft and Test data below. The `ZONE` gate passes (altitude is below the ceiling, `L1` operator meets `L1` required level, zone is active).
5. The lead-time minimum, curfew and overlap checks never decide the outcome: the window starts far beyond 6 h, `DNI-OPN-1` has no curfew and the aircraft has no other request.

## Test data

| Item | Value |
|---|---|
| `zone_code` | `DNI-OPN-1` (`OPEN`, ceiling 120 m, `C0`–`C3`, required level `L1`, no curfew, active) |
| `requested_altitude_metres` | `50` |
| `window_start` | submission time + 60 days + 1 h, UTC (one hour over the 60-day maximum; the margin absorbs the delay between computing the value and submitting, which only shortens the lead) |
| `window_end` | `window_start` + 60 min, UTC (duration within 15–240 min) |
| `flight_purpose` | `QA advance booking check` (assumed) |
| operator `authorisation_level` | `L1` (default at registration, `03-api-contract.md`) |

## Steps

1. Send `POST /api/v1/flight-requests/{id}/submit` for the `DRAFT` request, using the owning operator's session.

## Expected result

1. Step 1 returns `422` with `failing_gate` = `TIME_WINDOW` and `rule_reference` = `TSD-4 §2.2`.
