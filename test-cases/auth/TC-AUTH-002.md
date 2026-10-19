# TC-AUTH-002: Login with valid operator credentials establishes a session that `GET /auth/me` resolves to that operator

| Field | Value |
|---|---|
| **ID** | TC-AUTH-002 |
| **Doc ref** | `03-api-contract.md` §Authentication & authorisation (`POST /auth/login`, `GET /auth/me`); `01-data-model.md` (Operator `email`) |
| **Priority** | High |
| **Level** | API |

## Preconditions

1. An operator exists with the email and password from Test data (registered via `POST /api/v1/operators` with all required fields: `legal_name`, `national_id`, `email`, `password`).
2. The caller has no session: `POST /operators` also signs the caller in, so after registration call `POST /api/v1/auth/logout` or send Step 1 without the session cookie.

## Test data

| Item | Value |
|---|---|
| `email` | `qa.login.002@example.com` (unique; field from `01-data-model.md`) |
| `password` | `Passw0rd!QA2` (12 characters; minimum is 8 per `operators/route.ts`; field name confirmed by `openapi.yaml` `/auth/login`) |
| `legal_name` | `QA Login Operator` (registration only) |
| `national_id` | `QA-LOGIN-002` (registration only; unique) |

## Steps

1. Send `POST /api/v1/auth/login` with the `email` and password from Test data.

## Verification

1. Send `GET /api/v1/auth/me` with the session cookie set by the login response.

## Expected result

1. Step 1 returns: status `200` (confirmed: `confirmed-facts.md` #2), and a `Set-Cookie` header setting the session cookie (`03-api-contract.md`: "sets the session cookie").
2. Verification 1 returns: status `200` (confirmed: `confirmed-facts.md` #3) and the profile with `email` = `qa.login.002@example.com`.

Open questions:

- `03-api-contract.md` does not define the request body, response body or success status of `POST /auth/login`. They are defined only in `public/openapi.yaml` and `app/api/v1/auth/login/route.ts` (body `{email, password}`, `200` with the Operator object). The docs should be updated.
- The session cookie name and attributes are not described in the docs.
