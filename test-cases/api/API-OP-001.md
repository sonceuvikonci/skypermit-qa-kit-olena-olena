# API-OP-001: Lead time 5 h 59 min (one minute under the 6 h minimum) fails TIME_WINDOW gate on validate

| Field | Value |
|---|---|
| **ID** | API-OP-001 |
| **Doc ref** | `06 — Business Rules` §1.4 (minimum lead time), §6; rule `TSD-4 §2.1`; `03 — API Contract` § Flight requests (endpoint 13, `validate`), § Error semantics, § The `422` body |
| **Technique** | BV |
| **Priority** | High |
| **Level** | API |
| **Story** | SKY-2 |

## Preconditions

1. Pre 1 — `POST /api/v1/operators`, auth: none, body `legal_name`, `national_id`, `email`, `phone`, `address_line`, `city`, `postal_code`, `password` from Test data → operator session (cookie). Returns `201` (confirmed: `confirmed-facts.md` #1).
2. Pre 2 — `POST /api/v1/pilots`, auth: operator session, body `full_name`, `national_id`, `rating` = `R_BASIC`, `certified_on` = today − 1 month → `{{pilotId}}`. `PILOT` gate passes (`OPEN` zone accepts any rating; certification is current for 18 months).
3. Pre 3 — `POST /api/v1/aircraft`, auth: operator session, body `manufacturer`, `model`, `serial_number`, `mtom_grams` = `500` → `{{aircraftId}}`. Band `C0`; `AIRCRAFT` gate passes (`DNI-OPN-1` permits `C0`–`C3`).
4. Pre 4 — `POST /api/v1/flight-requests`, auth: operator session, body `pilot_id` = `{{pilotId}}`, `aircraft_id` = `{{aircraftId}}`, `zone_code`, `window_start`, `window_end`, `requested_altitude_metres`, `flight_purpose` from Test data → `{{flightRequestId}}` in `DRAFT`. Returns `201` (confirmed: `confirmed-facts.md` #8). `ZONE` gate passes (altitude 50 m ≤ 120 m ceiling; operator `L1` ≥ required `L1`; zone active).
5. Later `TIME_WINDOW` checks (advance booking, duration, curfew, overlap) are not the cause of failure: duration is 60 min, `DNI-OPN-1` has no curfew, the aircraft has no other request.

## Test data

| Item | Value |
|---|---|
| operator `email` | generated at run time, unique: `api-op-001-<timestamp>@example.test`, where `<timestamp>` is the run's Unix time in ms (assumed format) |
| operator `password` | set at run time, at least 8 characters, not stored in the case (from `confirmed-facts.md` #7) |
| operator `legal_name`, `phone`, `address_line`, `city`, `postal_code` | neutral values: `QA Operator 001`, `380000000001`, `Test Street 1`, `Kyiv`, `01001` (assumed) |
| operator / pilot `national_id` | generated at run time, unique, digits only: operator `1<timestamp>`, pilot `2<timestamp>` (assumed format: `national_id` is unique per `01 — Data Model`) |
| aircraft `manufacturer`, `model` | `TestMaker`, `T-1` (assumed) |
| aircraft `serial_number` | generated at run time, unique: `SN<timestamp>` (assumed format: `serial_number` is unique per `01 — Data Model`) |
| `zone_code` | `DNI-OPN-1` (`OPEN`, ceiling 120 m, `C0`–`C3`, required level `L1`, no curfew, active) |
| `requested_altitude_metres` | `50` |
| `window_start` | time of Pre 4 + 5 h 59 min, UTC (lead time one minute under the 6 h minimum) |
| `window_end` | `window_start` + 60 min, UTC |
| `flight_purpose` | `QA lead time check` (assumed) |

## Steps

1. `POST /api/v1/flight-requests/{{flightRequestId}}/validate`
   Auth: operator session
   Body: —

## Expected result

1. Step 1 returns `422` with `failing_gate` = `TIME_WINDOW`, `rule_reference` = `TSD-4 §2.1`, `message` = non-empty string.

## Note

`06 — Business Rules` § 1.4 counts lead time from submission; for `validate` the code takes the moment of the call (`app/api/v1/flight-requests/[id]/validate/route.ts:38`, `evaluatedAt: new Date()`), not Pre 4. The actual lead time at Step 1 is therefore a few seconds under 5 h 59 min. The expected result does not change. Run Step 1 right after Pre 4. See OQ-SKY2-1 in `open-questions.md`.
