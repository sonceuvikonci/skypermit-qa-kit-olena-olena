# TC-AUTH-001: Registration ignores client-supplied `authorisation_level` and creates the operator at `L1`

| Field | Value |
|---|---|
| **ID** | TC-AUTH-001 |
| **Doc ref** | `03-api-contract.md` §Authentication & authorisation ("`authorisation_level` is no longer self-service"; `POST /operators`, `GET /auth/me`) |
| **Priority** | High |
| **Level** | API |

## Preconditions

1. No operator exists with the email or `national_id` from Test data.
2. The caller has no session (logged out).

## Test data

| Item | Value |
|---|---|
| `legal_name` | `QA Bypass Operator` |
| `national_id` | `QA-NID-0001` (unique) |
| `email` | `qa.bypass.001@example.com` (unique) |
| password | `Passw0rd!QA1` (field name not defined in the docs, see Open question) |
| `phone` | `+380501234567` |
| `address_line` | `1 Test Street` |
| `city` | `Kyiv` |
| `postal_code` | `01001` |
| `authorisation_level` (injected) | `L3` |

## Steps

1. Send `POST /api/v1/operators` with the Test data above, including the extra field `authorisation_level` = `L3`.

## Verification

1. Send `GET /api/v1/auth/me` with the session cookie set by the registration response.

## Expected result

`POST /operators` succeeds with `201` (confirmed by the user; not stated in `03-api-contract.md`), the injected `authorisation_level` field is ignored (confirmed by the user; not stated in `03-api-contract.md`), and `GET /auth/me` returns the new operator's profile with `authorisation_level` = `L1`.

Open question: the request field names (password in particular) and the response body of `POST /operators` are not defined in `03-api-contract.md`. The field names in Test data are an assumption.
