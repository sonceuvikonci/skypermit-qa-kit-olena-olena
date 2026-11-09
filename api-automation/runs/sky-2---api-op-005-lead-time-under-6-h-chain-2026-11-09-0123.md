# Run: SKY-2 · API-OP-005 Lead time under 6 h chain

| | |
|---|---|
| Date | 2026-11-09 01:23 local |
| Collection | SKY-2 · API-OP-005 Lead time under 6 h chain (`11172594-703d7bb6-6fd9-4ecc-b032-fa2a2daf4a18`) |
| Environment | Skypermit-vercel (`11172594-c44601ec-ebd8-4701-b7ea-68f771e16128`) |
| Secrets passed | operatorPassword from $SKY_OPERATOR_PASSWORD (value not shown) |
| Postman CLI | 1.87.0 |
| Command | `postman collection run 11172594-703d7bb6-6fd9-4ecc-b032-fa2a2daf4a18 -e 11172594-c44601ec-ebd8-4701-b7ea-68f771e16128 --env-var "operatorPassword=***" --no-report-events --disable-unicode -r cli,json` |
| Exit code | 0 |
| Uploaded to Postman Cloud | **YES - `Uploaded successfully! View on Postman: https://go.postman.co/workspace/dc11b9f6-0327-4aad-800a-70fefaa21793/run/11172594-53ee5307-f6c4-4c8f-980f-3c1c4d468418`** |

## Requests

`{id}` = flight request `3f04fd61-4577-411f-a144-f9f8d3d11d82`; base `https://skypermit.vercel.app/api/v1`.

| # | Case | Request | Method | URL | HTTP | Failed assertions |
|---|---|---|---|---|---|---|
| 1 | API-OP-005 | Pre 01 Register operator | POST | `/operators` | 201 | none (1/1 passed) |
| 2 | API-OP-005 | Pre 02 Create pilot (R_BASIC, certified 1 month ago) | POST | `/pilots` | 201 | none (1/1) |
| 3 | API-OP-005 | Pre 03 Create aircraft (500 g, C0) | POST | `/aircraft` | 201 | none (1/1) |
| 4 | API-OP-005 | Pre 04 Create flight request (start in 2 h, 60 min) | POST | `/flight-requests` | 201 | none (2/2) |
| 5 | API-OP-005 | Step 1 Validate -> 422 TIME_WINDOW | POST | `/flight-requests/{id}/validate` | 422 | none (4/4) |
| 6 | API-OP-005 | Step 2 GET -> still DRAFT | GET | `/flight-requests/{id}` | 200 | none (2/2) |
| 7 | API-OP-005 | Step 3 Submit -> 422 TIME_WINDOW | POST | `/flight-requests/{id}/submit` | 422 | none (4/4) |
| 8 | API-OP-005 | Step 4 GET -> REJECTED | GET | `/flight-requests/{id}` | 200 | none (2/2) |
| 9 | API-OP-005 | Step 5 Resubmit -> 409 | POST | `/flight-requests/{id}/submit` | 409 | none (2/2) |

Totals: 9 requests, 19 assertions, 0 failed. Duration 16.6 s.

## Results per case

| Case | test_id | Status | Message |
|---|---|---|---|
| API-OP-005 | null | passed | — |

## For testomat-sync report

```json
{ "run_id": null, "results": [ { "test_id": null, "case_id": "API-OP-005", "status": "passed", "message": null } ] }
```

## Notes

- `--no-report-events` did **not** stop the upload to Postman Cloud in CLI 1.87.0 (see table).
- Test data left on `skypermit.vercel.app`: operator `api-op-005-<ts>@example.test`, one pilot, one aircraft, flight request `3f04fd61-4577-411f-a144-f9f8d3d11d82` (`REJECTED`).

Files: `sky-2---api-op-005-lead-time-under-6-h-chain-2026-11-09-0123.log` (redacted CLI output; the only record of this run's results).
