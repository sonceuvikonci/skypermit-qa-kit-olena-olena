# API-OP-004: Lead time 24 h (class "6 h to 60 days") passes TIME_WINDOW gate on validate

| Field | Value |
|---|---|
| **ID** | API-OP-004 |
| **Doc ref** | `06 — Business Rules` §1.4 (minimum lead time, maximum advance booking), §6; rule `TSD-4 §2.1`; `03 — API Contract` § Flight requests (endpoint 13, `validate`) |
| **Technique** | EP |
| **Priority** | High |
| **Level** | API |
| **Story** | SKY-2 |

## Preconditions

1. Pre 1 — `POST /api/v1/operators`, auth: none, body `legal_name`, `national_id`, `email`, `phone`, `address_line`, `city`, `postal_code`, `password` from Test data → operator session (cookie). Returns `201` (confirmed: `confirmed-facts.md` #1).
2. Pre 2 — `POST /api/v1/pilots`, auth: operator session, body `full_name`, `national_id`, `rating` = `R_BASIC`, `certified_on` = today − 1 month → `{{pilotId}}`. `PILOT` gate passes.
3. Pre 3 — `POST /api/v1/aircraft`, auth: operator session, body `manufacturer`, `model`, `serial_number`, `mtom_grams` = `500` → `{{aircraftId}}`. Band `C0`; `AIRCRAFT` gate passes.
4. Pre 4 — `POST /api/v1/flight-requests`, auth: operator session, body `pilot_id` = `{{pilotId}}`, `aircraft_id` = `{{aircraftId}}`, `zone_code`, `window_start`, `window_end`, `requested_altitude_metres`, `flight_purpose` from Test data → `{{flightRequestId}}` in `DRAFT`. Returns `201` (confirmed: `confirmed-facts.md` #8). `ZONE` gate passes.
5. Other `TIME_WINDOW` checks pass: 24 h is within the 60-day maximum, duration is 60 min, `DNI-OPN-1` has no curfew, no other request for the aircraft.

## Test data

| Item | Value |
|---|---|
| operator `email` | generated at run time, unique: `api-op-004-<timestamp>@example.test`, where `<timestamp>` is the run's Unix time in ms (assumed format) |
| operator `password` | set at run time, at least 8 characters, not stored in the case (from `confirmed-facts.md` #7) |
| operator `legal_name`, `phone`, `address_line`, `city`, `postal_code` | `QA Operator 004`, `380000000004`, `Test Street 4`, `Kyiv`, `01001` (assumed) |
| operator / pilot `national_id` | generated at run time, unique, digits only: operator `1<timestamp>`, pilot `2<timestamp>` (assumed format: `national_id` is unique per `01 — Data Model`) |
| aircraft `manufacturer`, `model` | `TestMaker`, `T-1` (assumed) |
| aircraft `serial_number` | generated at run time, unique: `SN<timestamp>` (assumed format: `serial_number` is unique per `01 — Data Model`) |
| `zone_code` | `DNI-OPN-1` (`OPEN`, ceiling 120 m, `C0`–`C3`, required level `L1`, no curfew, active) |
| `requested_altitude_metres` | `50` |
| `window_start` | time of Pre 4 + 24 h, UTC (representative of the valid class) |
| `window_end` | `window_start` + 60 min, UTC |
| `flight_purpose` | `QA lead time check` (assumed) |

## Steps

1. `POST /api/v1/flight-requests/{{flightRequestId}}/validate`
   Auth: operator session
   Body: —

## Expected result

1. Step 1 returns `200` with body `{"ok": true}` (confirmed: `confirmed-facts.md` #4).
