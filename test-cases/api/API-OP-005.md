# API-OP-005: [ST] Lead time under 6 h: validate keeps DRAFT, submit rejects with failing_gate and rejection_reason, resubmit is 409

| Field | Value |
|---|---|
| **ID** | API-OP-005 |
| **Doc ref** | `06 — Business Rules` §1.4 (minimum lead time), §6; rule `TSD-4 §2.1`; `03 — API Contract` § Flight requests (endpoints 10, 11, 13), § Error semantics, § The `422` body; `02 — Request Lifecycle` § transition table (`DRAFT` → submit → `REJECTED`, "`failing_gate`/`rejection_reason` populated"; `REJECTED` → anything is illegal and returns `409`); `01 — Data Model` § FlightRequest (`rejection_reason`, `failing_gate`, `rule_reference`) |
| **Technique** | ST |
| **Priority** | High |
| **Level** | API |
| **Story** | SKY-2 |

## Preconditions

1. Pre 1 — `POST /api/v1/operators`, auth: none, body `email`, `password`, `legal_name`, `national_id`, `phone`, `address_line`, `city`, `postal_code` from Test data → operator session (cookie). Returns `201` (confirmed: `confirmed-facts.md` #1). The operator is created at `L1` (`03 — API Contract` § Authentication & authorisation).
2. Pre 2 — `POST /api/v1/pilots`, auth: operator session, body `full_name`, `national_id`, `rating` = `R_BASIC`, `certified_on` = today − 1 month → `{{pilotId}}`. `PILOT` passes.
3. Pre 3 — `POST /api/v1/aircraft`, auth: operator session, body `manufacturer`, `model`, `serial_number`, `mtom_grams` = `500` → `{{aircraftId}}`. Band `C0` → `AIRCRAFT` passes.
4. Pre 4 — `POST /api/v1/flight-requests`, auth: operator session, body `pilot_id` = `{{pilotId}}`, `aircraft_id` = `{{aircraftId}}`, `zone_code`, `window_start`, `window_end`, `requested_altitude_metres`, `flight_purpose` from Test data → `{{flightRequestId}}` in `DRAFT`. Returns `201` (confirmed: `confirmed-facts.md` #8). `ZONE` passes.
5. All other `TIME_WINDOW` checks pass: duration 60 min, `DNI-OPN-1` has no curfew, no other request for this aircraft. Only the lead time decides the outcome.

## Test data

| Item | Value |
|---|---|
| operator `email` | generated at run time, unique: `api-op-005-<timestamp>@example.test`, `<timestamp>` = run's Unix time in ms (assumed format) |
| operator `password` | set at run time, at least 8 characters, not stored in the case (from `confirmed-facts.md` #7) |
| operator `legal_name`, `phone`, `address_line`, `city`, `postal_code` | `QA Operator 005`, `380000000005`, `Test Street 5`, `Kyiv`, `01001` (assumed) |
| operator / pilot `national_id` | generated at run time, unique, digits only: operator `1<timestamp>`, pilot `2<timestamp>` (assumed format; unique per `01 — Data Model`) |
| pilot `full_name` | `QA Pilot 005` (assumed) |
| aircraft `manufacturer`, `model` | `TestMaker`, `T-1` (assumed) |
| aircraft `serial_number` | generated at run time, unique: `SN<timestamp>` (assumed format; unique per `01 — Data Model`) |
| `zone_code` | `DNI-OPN-1` (`OPEN`, ceiling 120 m, `C0`–`C3`, required level `L1`, no curfew, active — `06 — Business Rules` § 4) |
| `requested_altitude_metres` | `50` |
| `window_start` | time of Pre 4 + 2 h, UTC (lead time under 6 h at every step of the chain) |
| `window_end` | `window_start` + 60 min, UTC |
| `flight_purpose` | `QA lead time check` (assumed) |

## Steps

1. `POST /api/v1/flight-requests/{{flightRequestId}}/validate`
   Auth: operator session
   Body: —
2. `GET /api/v1/flight-requests/{{flightRequestId}}`
   Auth: operator session
3. `POST /api/v1/flight-requests/{{flightRequestId}}/submit`
   Auth: operator session
   Body: —
4. `GET /api/v1/flight-requests/{{flightRequestId}}`
   Auth: operator session
5. `POST /api/v1/flight-requests/{{flightRequestId}}/submit`
   Auth: operator session
   Body: —

## Expected result

1. Step 1 returns `422` with `failing_gate` = `TIME_WINDOW`, `rule_reference` = `TSD-4 §2.1`, `message` = non-empty string.
2. Step 2 returns `200` (confirmed: `confirmed-facts.md` #5) with `state` = `DRAFT`.
3. Step 3 returns `422` (confirmed: `confirmed-facts.md` #6) with `failing_gate` = `TIME_WINDOW`, `rule_reference` = `TSD-4 §2.1`, `message` = non-empty string.
4. Step 4 returns `200` (confirmed: `confirmed-facts.md` #5) with `state` = `REJECTED`, `failing_gate` = `TIME_WINDOW`, `rule_reference` = `TSD-4 §2.1`, `rejection_reason` = non-empty string.
5. Step 5 returns `409` with body `error` = non-empty string (confirmed: `confirmed-facts.md` #9).

Open question: the content of `rejection_reason` for a gate failure is not defined (`01 — Data Model` § FlightRequest: "populated only on rejection"); the code stores the gate `message`. Only "non-empty" is asserted. See OQ-SKY2-4.
