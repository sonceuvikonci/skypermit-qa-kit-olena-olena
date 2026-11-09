# SKY-2 — API: submit повертає 422, якщо до початку польоту менше 6 годин

- Intake: `intake/SKY-2.json` · `check_type: api` · 5 AC · `confluence_url`: null (лише текстова згадка «03 — API contract» і «06 — Business rules», розділ 1.4)
- Дата: 2026-11-09

## Step 2: story check

Docs: `story-doc-check` (Confluence SkyPermit Docs: 01, 02, 03, 05, 06, 07). Code: `implementation-check` (`../skypermit`), загальний вердикт **implemented**.

| # | AC (коротко) | Docs | Де в документації | Code | Evidence | Business rule |
|---|---|---|---|---|---|---|
| 1 | validate, `window_start` < 6 год → 422 {TIME_WINDOW, TSD-4 §2.1, message}, стан DRAFT | покрито | `06 — Business Rules § 1.4`: «≥ 6 hours between submission and `window_start`.» · `06 § 6`: `TIME_WINDOW` / Lead time too short / `TSD-4 §2.1` · `03 — API Contract § The 422 body` · `03 § Flight requests` (endpoint 13): «never changes state» | implemented | `lib/gates/time-window-gate.ts:20-23`, `lib/http.ts:34-43`, `app/api/v1/flight-requests/[id]/validate/route.ts:37-43` | `06 — Business Rules § 1.4` (TSD-4 §2.1) |
| 2 | submit для тієї ж заявки → 422 з тим самим тілом | покрито | `03 § Flight requests` (endpoint 10): «Run all four gates; move to `UNDER_REVIEW` or `REJECTED`»; endpoint 13 «runs every gate exactly as `submit` would»; `03 § Error semantics`: 422 = business rule violation | implemented | `submit/route.ts:49-55,69` | `06 — Business Rules § 1.4` (TSD-4 §2.1) |
| 3 | після submit: `REJECTED`, `failing_gate` і `rejection_reason` заповнені (GET) | покрито | `02 — Request Lifecycle § transitions`: `SUBMITTED` (gates fail) → `REJECTED` «`failing_gate`/`rejection_reason` populated»; `01 — Data Model § FlightRequest` | implemented | `submit/route.ts:56-67`, `[id]/route.ts:6-21` | `06 — Business Rules § 1.4` + `02 — Request Lifecycle` (state transition) |
| 4 | повторний submit відхиленої → 409 | покрито | `02 — Request Lifecycle`: «`REJECTED`→anything … is illegal and returns `409`» | implemented | `submit/route.ts:29-31`, `lib/state-machine.ts:8-10`, `lib/http.ts:20-22` | `06 — Business Rules § 1.4` + `02 — Request Lifecycle` (state transition) |
| 5 | `window_start` через 6 год 30 хв → проходить lead time | покрито (випливає з `06 § 1.4` «≥ 6 hours») | `06 — Business Rules § 1.4` | implemented | `time-window-gate.ts:20-26` | `06 — Business Rules § 1.4` (TSD-4 §2.1) |

Не чистих AC немає: усі «покрито», усі `implemented`, правило знайдено для кожного.

### Side findings

Docs:
- **Точка відліку для validate не визначена.** `06 § 1.4` рахує lead time «between submission and `window_start`», а validate нічого не подає. Код бере серверний `new Date()` і для validate, і для submit. → open question.
- **Межа 6 год.** Документація каже «≥ 6 hours», тобто рівно 6:00 проходить. Код використовує строге `<` (`time-window-gate.ts:21`), тобто так само: рівно 6 год проходить. Розбіжності немає. Ризик для тестів: «now» між validate і submit зсувається, тож значення близько 6:00 ± кілька секунд можуть дати різний результат.
- **Вміст `rejection_reason` не визначений** у документації (`01`: «populated only on rejection»). Код записує туди `message` гейту.
- **Передумови тестових даних:** PILOT, AIRCRAFT, ZONE мають проходити (`06 § Evaluation order`). Решта TIME_WINDOW теж має бути валідна: тривалість 15–240 хв, без curfew, без overlap, ≤ 60 днів. `now + 6h30m` може потрапити в curfew залежно від часу запуску, тож потрібна зона без curfew (`DNI-OPN-1` / `KHR-OPN-4`, `06 § 4`).
- `05 — Open Questions`: відкриті рядки 4 (SUSPENDED) і 5 (zone active) цієї історії не стосуються.
- У AC 3 зіпсований бектік (`{id`}`); шлях читається як `/api/v1/flight-requests/{id}`.

Code:
- 409 на повторний submit має тіло `{error: "Cannot submit a flight request in state REJECTED."}`, а не 422-тіло.
- validate не перевіряє стан: його можна викликати і на REJECTED (AC це не покриває).
- submit спершу може повернути 401 / 403 (інший оператор, SUSPENDED), і тільки потім запускаються гейти.
- Не перевірено: що `fetchFlightRequestById` повертає `failing_gate` / `rejection_reason` / `rule_reference`.

## Step 3: cases and verification

Користувач залишив усі 5 AC. Правило для всіх AC одне: `06 — Business Rules § 1.4` (`TSD-4 §2.1`), тому `api-test-case-creator` викликано один раз.
У `test-cases/api/` уже були кейси SKY-2 API-OP-001…005 з тим самим Doc ref. На запитання (skip / replace / variant) користувач відповів «Replace all»: файли перезаписано з тими самими ID.

| ID | Technique | Умова | AC | tc-verifier (mode: api) |
|---|---|---|---|---|
| API-OP-001 | BV | lead time 5 h 59 min → validate 422 TIME_WINDOW / `TSD-4 §2.1` | 1 | ambiguous, без mismatch: точка відліку lead time для validate не визначена (OQ-SKY2-1). Очікуваний 422 тримається за будь-якого прочитання → кейс залишено |
| API-OP-002 | BV | lead time 6 h 01 min → validate 200 `{ok:true}` | 5 | matches |
| API-OP-003 | EP | lead time 2 h → validate 422 | 1 | matches |
| API-OP-004 | EP | lead time 6 h 30 min → validate 200 `{ok:true}` | 5 | matches (некритична примітка: прив'язка `window_start` до часу Pre 4, запас 30 хв) |
| API-OP-005 | ST | validate 422 → GET DRAFT → submit 422 → GET REJECTED (+ `failing_gate`, `rule_reference`, `rejection_reason`) → submit 409 | 1, 2, 3, 4 | matches (дрібне: можна точніше процитувати рядки `02`; вміст `rejection_reason` — OQ-SKY2-4) |

Виправлень не знадобилось; жоден кейс не виключено.
Не написано: BV рівно 6 h 00 min. Через API цю межу не відтворити надійно, бо «now» береться в момент виклику (OQ-SKY2-5).

Нові open questions у `test-cases/open-questions.md`: OQ-SKY2-4 (вміст `rejection_reason`), OQ-SKY2-5 (межа рівно 6 h). Наявні: OQ-SKY2-1, OQ-SKY2-2.
Прогалини в документації, на які вказали верифікатори: у `03 — API Contract` немає success-відповіді validate (200 `{ok:true}`, підтверджено лише `confirmed-facts.md` #4 / openapi); у `03` немає статусу 200 для GET.

## Step 4: approval

- Показаний набір: API-OP-001, API-OP-002, API-OP-003, API-OP-004, API-OP-005.
- Запитання: "Approve these cases for Testomat.io?"
- Відповідь користувача: «Так, затверджую».

## Step 5: Testomat.io

Suite: `API: submit повертає 422, якщо до початку польоту менше 6 годин`, `0d461fcb` (`file`). Suite створено, бо раніше його не було.

| Case | Action | test_id |
|---|---|---|
| API-OP-001 | created | `1dc01130` |
| API-OP-002 | created | `09f8def5` |
| API-OP-003 | created | `5c40c7a4` |
| API-OP-004 | created | `e719ea3c` |
| API-OP-005 | created | `15e69db3` |

- `duplicates`: [] (у межах suite кожен case_id трапляється рівно один раз; перевірено через `tests_list`).
- Примітка: у проєкті вже є старий тест `3d13e83e` «API-OP-005: [ST] Lead time under 6 h: validate keeps DRAFT, submit rejects, resubmit is 409 @SKY-2» в іншому suite «Flight request · API» (`b7de80e3`). Його не змінено й не видалено. `report` має використовувати заплановані `test_ids` нижче.
- Результат upsert: `reports/story-to-api-tests/SKY-2-upsert.json`.
- Run: `a04f8926`, «SKY-2 · API», `kind: automated`, статус `scheduled`, https://app.testomat.io/projects/skypermit-4e9a2/runs/a04f8926
- Заплановані `test_ids`: `1dc01130`, `09f8def5`, `5c40c7a4`, `e719ea3c`, `15e69db3`.
- `tests_count` = 0 (для `automated` очікується 0) → OK.

## Step 6: collection review

- Колекція: `SKY-2 · API cases`, uid `11172594-bea9276f-c5e9-49a1-9576-94b0ff4f82e0` (workspace SkyPermit). Після створення хмарну копію звірено з локальною: однакові.
- Локальна копія: `postman/SKY-2/SKY-2-api.postman_collection.json` (5 папок, 29 запитів).
- Environment: `Skypermit-vercel`, `11172594-c44601ec-ebd8-4701-b7ea-68f771e16128` (перевикористано; `baseUrl` = `https://skypermit.vercel.app/api/v1`).
- Build report: `postman/SKY-2/SKY-2-api-build-2026-11-09.md`. Пропущених кейсів немає.
- Попередження: API-OP-002 стоїть біля межі (6 h 01 min, `window_start` округлено вгору, запас ≥ 60 с). API-OP-004 має запас 30 хв. Негативні кейси стабільні. `operatorPassword` в environment має тип `default`.
- Preflight: Postman CLI 1.87.0, logged out, `POSTMAN_API_KEY` NOT set, `SKY_OPERATOR_PASSWORD` set, запуск із локального файлу з папки в scratchpad.
- Показана команда (секрет як `***`): `postman collection run postman/SKY-2/SKY-2-api.postman_collection.json --env-var "baseUrl=https://skypermit.vercel.app/api/v1" --env-var "operatorPassword=***" --no-report-events --disable-unicode -r cli,json --reporter-json-export <scratchpad>/report.json`
- Відповідь користувача: «запускай» (написано після показу цієї команди; перед запуском upload guard перевірено ще раз).

## Step 7: run & report

- Логи запуску: `api-automation/runs/sky-2---api-cases-2026-11-09-1524.md`, `.log`, `-results.json`.
- Exit code: 0. Запитів 29 (0 помилок), assertions 54 (0 failed).
- Uploaded to Postman Cloud: no (рядків про upload у лозі немає). Secret check: clean (4 файли). `.opencode/` у репо не з'явився.

| Case | test_id | Status | Message |
|---|---|---|---|
| API-OP-001 | `1dc01130` | passed | — |
| API-OP-002 | `09f8def5` | passed | — |
| API-OP-003 | `5c40c7a4` | passed | — |
| API-OP-004 | `e719ea3c` | passed | — |
| API-OP-005 | `15e69db3` | passed | — |

- Testomat.io run `a04f8926`: passed 5 / failed 0 / skipped 0. Сума 5 = кількості результатів (5); `tests_count` = 5 → OK.
- Запланованих тестів без результату немає.
- Run закрито (`finish`), статус `passed`, `finished_at` 2026-11-09T13:26:26Z: https://app.testomat.io/projects/skypermit-4e9a2/runs/a04f8926
