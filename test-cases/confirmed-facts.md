# Confirmed facts

Values not stated in the specs, confirmed by the user. Cite as `confirmed-facts.md` #<n>.

| # | Fact | Not stated in | Confirmed by | Date |
|---|---|---|---|---|
| 1 | `POST /api/v1/operators` returns `201` on success | `03-api-contract.md` | user | 2026-10-19 |
| 2 | `POST /api/v1/auth/login` with valid credentials returns `200` | `03-api-contract.md` | user | 2026-10-19 |
| 3 | `GET /api/v1/auth/me` with a valid session returns `200` | `03-api-contract.md` | user | 2026-10-19 |
| 4 | `POST /api/v1/flight-requests/{id}/validate` when all four gates pass returns `200` with body `{"ok": true}` (schema `ValidateOk`) | `03 — API Contract` | `../skypermit/public/openapi.yaml` (`/flight-requests/{id}/validate`, `ValidateOk`), at user's request | 2026-11-09 |
| 5 | `GET /api/v1/flight-requests/{id}` for the owning operator returns `200` with the `FlightRequest` body | `03 — API Contract` | `../skypermit/public/openapi.yaml` (`/flight-requests/{id}` get), at user's request | 2026-11-09 |
| 6 | `POST /api/v1/flight-requests/{id}/submit` on a gate failure returns `422` (`GateFailure`: `failing_gate`, `rule_reference`, `message`) and moves the request `DRAFT` → `REJECTED` | `03 — API Contract` | `../skypermit/public/openapi.yaml` (`/flight-requests/{id}/submit`), at user's request | 2026-11-09 |
| 7 | `POST /api/v1/operators` body (`RegisterOperatorInput`): required `email`, `password` (string, min length 8), `legal_name`, `national_id`; optional `phone`, `address_line`, `city`, `postal_code` | `01 — Data Model` (no `password`), `03 — API Contract` | `../skypermit/public/openapi.yaml` (`RegisterOperatorInput`), at user's request | 2026-11-09 |
| 8 | `POST /api/v1/flight-requests` on success returns `201` with the `FlightRequest` body | `03 — API Contract` | `../skypermit/public/openapi.yaml` (`/flight-requests` post), at user's request | 2026-11-09 |
| 9 | `POST /api/v1/flight-requests/{id}/submit` on a request not in `DRAFT` returns `409` with body `{"error": "<string>"}` (schema `Error`, `error` required) | `03 — API Contract` (says only "conflict detail") | `../skypermit/public/openapi.yaml` (`/flight-requests/{id}/submit` 409, `Error`), at user's request | 2026-11-09 |
