# Postman collection: SKY-2 · API cases

Test cases: `test-cases/api/API-OP-001.md` … `API-OP-005.md` · Built: 2026-11-09 15:18 (Europe/Kyiv, FLEST)
Collection: SKY-2 · API cases (`11172594-bea9276f-c5e9-49a1-9576-94b0ff4f82e0`) · Environment: Skypermit-vercel (`11172594-c44601ec-ebd8-4701-b7ea-68f771e16128`) · Workspace: SkyPermit
Local copy: `postman/SKY-2/SKY-2-api.postman_collection.json` (cloud copy compared after create: items, scripts, bodies and 55 variables identical)
Sources: case Doc refs; `06 — Business Rules` § 1.4 (minimum lead time ≥ 6 h, `TSD-4 §2.1`), § 4 (`DNI-OPN-1`), § 6 (`rule_reference` values); `03 — API Contract` § Flight requests (endpoints 9, 10, 11, 13), § Error semantics, § The `422` body; `02 — Request Lifecycle` (transition table); `openapi.yaml` `/operators`, `/pilots`, `/aircraft`, `/flight-requests`, `/flight-requests/{id}`, `/flight-requests/{id}/validate`, `/flight-requests/{id}/submit` (`RegisterOperatorInput`, `CreatePilotInput`, `CreateAircraftInput`, `CreateFlightRequestInput`, `GateFailure`, `ValidateOk`, `Error`)

## Requests

Each folder has the same four preconditions; `<ID>` = API-OP-001 … 005, variables prefixed `op001_` … `op005_`.

| # | Request | Purpose | Assertions |
|---|---|---|---|
| `<ID>: Pre 01 Register operator` | `POST /operators` | precondition 1: operator (L1) + session cookie; throws if `operatorPassword` is missing / < 8 chars | Precondition: operator registered (201) |
| `<ID>: Pre 02 Create pilot (R_BASIC, certified 1 month ago)` | `POST /pilots` | precondition 2: PILOT passes | Precondition: pilot created (201) |
| `<ID>: Pre 03 Create aircraft (500 g, C0)` | `POST /aircraft` | precondition 3: AIRCRAFT passes | Precondition: aircraft created (201) |
| `<ID>: Pre 04 Create flight request (start in <lead>, 60 min)` | `POST /flight-requests` | precondition 4: `DNI-OPN-1`, 50 m, window 60 min | Precondition: flight request created (201); Precondition: flight request is in DRAFT |
| `API-OP-001: Step 1 Validate -> 422 TIME_WINDOW` | `POST /flight-requests/{id}/validate` | lead 5 h 59 min | Expected 1: returns 422; failing_gate = TIME_WINDOW; rule_reference = TSD-4 §2.1; message is a non-empty string |
| `API-OP-002: Step 1 Validate -> 200 ok` | `POST /flight-requests/{id}/validate` | lead 6 h 01 min | Expected 1: returns 200; body ok = true |
| `API-OP-003: Step 1 Validate -> 422 TIME_WINDOW` | `POST /flight-requests/{id}/validate` | lead 2 h | as API-OP-001 |
| `API-OP-004: Step 1 Validate -> 200 ok` | `POST /flight-requests/{id}/validate` | lead 6 h 30 min | Expected 1: returns 200; body ok = true |
| `API-OP-005: Step 1 Validate -> 422 TIME_WINDOW` | `POST /flight-requests/{id}/validate` | chain step 1, lead 2 h | Expected 1: 422; failing_gate; rule_reference; message |
| `API-OP-005: Step 2 GET -> still DRAFT` | `GET /flight-requests/{id}` | chain step 2 | Expected 2: returns 200; state = DRAFT |
| `API-OP-005: Step 3 Submit -> 422 TIME_WINDOW` | `POST /flight-requests/{id}/submit` | chain step 3 | Expected 3: 422; failing_gate; rule_reference; message |
| `API-OP-005: Step 4 GET -> REJECTED with failing_gate, rule_reference, rejection_reason` | `GET /flight-requests/{id}` | chain step 4 | Expected 4: returns 200; state = REJECTED; failing_gate = TIME_WINDOW; rule_reference = TSD-4 §2.1; rejection_reason is a non-empty string |
| `API-OP-005: Step 5 Resubmit -> 409` | `POST /flight-requests/{id}/submit` | chain step 5 | Expected 5: returns 409; error is a non-empty string |

Total: 29 requests (5 folders). Every later request calls `pm.execution.skipRequest()` if an id it needs is missing.

Skipped cases: none.

## Test data

| Item | Value / how it is generated |
|---|---|
| operator `email` | `api-op-<NNN>-<Date.now()>@example.test` (collection variable, pre-request of Pre 01) |
| operator / pilot `national_id` | `1<Date.now()>` / `2<Date.now()>` |
| aircraft `serial_number` | `SN<Date.now()>` |
| operator `legal_name`, `phone`, `address_line`, `city`, `postal_code` | `QA Operator <NNN>`, `380000000<NNN>`, `Test Street <N>`, `Kyiv`, `01001` |
| pilot | `QA Pilot <NNN>`, `R_BASIC`, `certified_on` = today (UTC) − 1 month |
| aircraft | `TestMaker`, `T-1`, `mtom_grams` 500 |
| `zone_code`, altitude, purpose | `DNI-OPN-1`, 50, `QA lead time check` |
| `window_start` | computed in Pre 04: API-OP-001 floor(now, min) + 359 min; API-OP-002 ceil(now, min) + 361 min; API-OP-003 / 005 floor(now, min) + 120 min; API-OP-004 ceil(now, min) + 390 min (UTC, ISO without ms) |
| `window_end` | `window_start` + 60 min |

## Environment

Reused `Skypermit-vercel`: it has exactly the two allowed keys and no generated values.

| Variable | Type | Value |
|---|---|---|
| baseUrl | default | `https://skypermit.vercel.app/api/v1` |
| operatorPassword | default (not `secret`) | empty, passed at run time |

## Warnings

- **Time boundary — API-OP-002 (unstable, positive near lower bound).** Lead time 6 h 01 min against `≥ 6 h`. `window_start` is rounded **up** to the minute (so rounding never shortens it), giving 6 h 01 min – 6 h 02 min at Pre 04. The margin left for the delay Pre 04 → Step 1 is ≥ 60 s; on a slow or cold server (Vercel cold start) the lead time could drop under 6 h and Step 1 would get 422. The case's own margin (6 h 01 min, precondition 6: "within 60 seconds") is kept; it was not widened. If this case fails with 422 TIME_WINDOW, check the elapsed time in the log before reading it as a product defect.
- **Time boundary — API-OP-004 (positive, margin 30 min).** Rounded up; stable unless more than 30 min pass between Pre 04 and Step 1.
- **Time boundary — API-OP-001, -003, -005 (stable, negative below minimum).** Rounded down; elapsed time only shortens the lead time, so it stays under 6 h. The actual lead time at validate / submit is slightly below the case value.
- **Rounding differs from the older single-case collections** (`SKY-2 · API-OP-005 …`, `SKY-2 · TC-GATE-001 …`), which always floor. Here positive cases use `Math.ceil` on purpose.
- **Environment variable type.** In the reused environment `operatorPassword` is `default`, not `secret`. Its value is empty and the password comes only from `--env-var`. This skill does not edit existing environments.
- **Curfew / midnight:** not relevant, `DNI-OPN-1` has no curfew.
- **Collection listing.** `getCollections` (unfiltered) and `getWorkspace` returned `500`; `getCollections` with the name filter returned the workspace list (3 collections, none named `SKY-2 · API cases`), so the collection was created once.
- **Shared session cookie.** All five folders run in one CLI run; each Pre 01 registers a new operator and the new session cookie replaces the previous one, so each folder acts as its own operator. Not exercised yet with five operators in one run.
- **Not run.** Scripts were syntax-checked locally only. `pm.execution.skipRequest()` needs a recent Postman CLI / runtime.

## Open questions

- **Lead time on `validate`** (OQ-SKY2-1): `06 — Business Rules` § 1.4 measures it "between submission and `window_start`"; for the `validate` dry run the code uses "now". The cases rely on that. Built from the cases.
- **Success response of `validate`** (200 `{"ok": true}`) is not in `03 — API Contract`; taken from `confirmed-facts.md` #4 / `openapi.yaml` `ValidateOk`.
- **`rejection_reason` content** (OQ-SKY2-4): only non-empty is asserted.
- **Checks suggested but not added (not in the Expected results):** `message` exact text; in API-OP-003 a `GET` showing the request is still `DRAFT` after validate (suggested by `tc-verifier`); in API-OP-005 Step 2 `failing_gate` / `rule_reference` still `null` after validate; a final `GET` after the 409.

## How to run (Postman CLI)

Run the **local copy** with a **logged-out** Postman CLI (`postman whoami` shows no account, `POSTMAN_API_KEY` not set) and from a folder outside the repo. A run by cloud uid, or any run while logged in, is uploaded to Postman Cloud with request bodies; `--no-report-events` does not stop that (CLI 1.87.0). Non-secret environment values (`baseUrl`) go in with `--env-var` instead of `-e`. Secrets come from environment variables of the shell, never from the command text itself. The usual way is the `postman-cli-run` skill, which checks all of this before it runs.

```bash
# bash (from a folder outside the repo)
export SKY_OPERATOR_PASSWORD='...'   # min 8 chars
postman collection run "C:/Users/Lena/Desktop/Courses/ISTQB/gen_ai/workspace/skypermit-qa-kit-olena-olena/postman/SKY-2/SKY-2-api.postman_collection.json" \
  --env-var "baseUrl=https://skypermit.vercel.app/api/v1" \
  --env-var "operatorPassword=$SKY_OPERATOR_PASSWORD" \
  --no-report-events
```

```powershell
# PowerShell (from a folder outside the repo)
$env:SKY_OPERATOR_PASSWORD = '...'   # min 8 chars
postman collection run "C:\Users\Lena\Desktop\Courses\ISTQB\gen_ai\workspace\skypermit-qa-kit-olena-olena\postman\SKY-2\SKY-2-api.postman_collection.json" --env-var "baseUrl=https://skypermit.vercel.app/api/v1" --env-var "operatorPassword=$env:SKY_OPERATOR_PASSWORD" --no-report-events
```

Pass one `--env-var "<name>=<value>"` per non-secret variable and per secret variable of the environment.
