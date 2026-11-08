# SKY-3 — Оператор бачить відмову AIRCRAFT, якщо вагова категорія борту не дозволена в зоні

Крок 1–2 (intake + перевірка історії). Статус: чекає відповіді користувача на «Continue?».

- check_type: `ui`, AC: 5, `confluence_url`: немає (лише текстова згадка «06 — Business rules», розділи 1.2 і 3)
- Загальний вердикт `implementation-check`: **implemented**

## Таблиця за AC

| # | AC | Документація | Код | Чисте? |
|---|---|---|---|---|
| 1 | C3 + `KBP-CTR-3`, форма не блокує вибір | покрито (`04 — Frontend Scope` § Two contracts; `06 — Business Rules` § 3, § 4) | implemented (`app/operator/requests/new/page.tsx:104-137`) | так |
| 2 | Перевірка показує провал `AIRCRAFT` з `ZC-2026.1 §2` | **не описано** (правило є: `06` § 1.2, § 6, `07` § 1; не описано, як UI показує `rule_reference` для результату `validate`) | implemented (`lib/gates/aircraft-gate.ts:11-17`, `components/GateResultsPanel.tsx:48-52`) | **позначено** |
| 3 | `PILOT` пройдено (R_ADVANCED); `ZONE`, `TIME_WINDOW` не перевірялися | **не описано** (логіка є: `06` § 1.1, «Evaluation order»; не описано, як UI показує пройдений `PILOT` і не-перевірені гейти) | implemented (`lib/gates/pipeline.ts:14-21`, `components/GateResultsPanel.tsx:13-21,42-43`) | **позначено** |
| 4 | 12 000 г (C2) проходить `AIRCRAFT` | покрито (`06` § 3, § 4) | implemented (`lib/derived.ts:28`, `lib/gates/aircraft-gate.ts:12`) | так |
| 5 | Після перевірки заявка лишається `DRAFT` | покрито (`03 — API Contract` endpoint 13; `04`; `02`) | implemented (`app/api/v1/flight-requests/[id]/validate/route.ts:37-43`) | так |

## Побічні знахідки

- `07 — Clarifications` § 1 виправляє `ZC-2026.1` §2: відмова належить `AIRCRAFT`, а не `ZONE`. `06` оновлено, суперечності між сторінками немає. Код це підтверджує (`aircraft-gate.ts:4-7`).
- Те саме джерело `ZC-2026.1 §2` у `ZONE` стосується висоти над стелею; різниця лише в `failing_gate` (`06` § 1.2).
- `05 — Open Questions`: рядок 1 закрито. Відкриті рядки 4 (`SUSPENDED`) і 5 (citation для zone `active`) на історію не впливають.
- `03` задає форму тіла лише для `422`. Тіло `validate` для результату по гейтах у документації не описане; код повертає 422 з `failing_gate` (`lib/http.ts:37`), а UI збирає результат (`FlightRequestPanel.tsx:47-48`).
- Код, AC 3: статус PASS для `PILOT` виводиться в UI з порядку гейтів, API окремого результату `PILOT` не повертає (`GateResultsPanel.tsx:9-12`). Для сценарію AC результат той самий.
- Код, AC 2: окремого `data-testid` для тексту `rule_reference` немає, лише клас `sp-gate__rule` (`GateResultsPanel.tsx:51`). Перевірка тексту йде через `flight-request-gate-result-AIRCRAFT`.
- Передумови даних: борт C3 (> 12 000 г), борт рівно 12 000 г, пілот R_ADVANCED з чинною сертифікацією (18 міс. від `certified_on` до `window_start`). Наповнення БД `implementation-check` не перевіряв.
- Не перевірено в коді: `SelectField` (чи `testId` потрапляє в DOM як `data-testid`), вміст `GateBadge` для PASS/FAIL, повний `gateFailure`.
- `confluence_url` = null: посилання на сторінку немає, лише текстова згадка. Згадані розділи `06` § 1.2 і § 3 існують.

## selectors (з implementation-check)

`flight-request-create-form`, `flight-request-zone-select`, `flight-request-aircraft-select`, `flight-request-pilot-select`, `flight-request-create-submit-button`, `flight-request-validate-button`, `flight-request-validate-result`, `flight-request-gate-result-{PILOT|AIRCRAFT|ZONE|TIME_WINDOW}` (`data-gate-status` = PASS/FAIL/NOT_EVALUATED), `flight-request-detail-state`.

## Step 2 result

Користувач відповів «Так, продовжуй», залишив усі AC 1–5 (включно з AC 2 і AC 3, позначеними як «не описано» в документації).

## Step 3: cases and verification

Кейси TC-UIOP-008…013 вже існували в `test-cases/ui-operator/`. За вказівкою користувача нові кейси не писались (дублікати пропущено), наявні файли взято як набір. Кожен перевірено `tc-verifier`. Фіксів не було, ID не змінювались.

| Case | AC | Verdict tc-verifier | Примітка |
|---|---|---|---|
| TC-UIOP-008 | 1 | partial (збігається; формат підпису борту, маршрут і селектори лише в коді) | OQ-SKY3-5, OQ-SKY3-6 |
| TC-UIOP-009 | 2 | matches | OQ-SKY3-1, OQ-SKY3-5, OQ-SKY3-7. Верифікатор зазначає, що `03` endpoint 13 і «The 422 body» частково відповідають на OQ-SKY3-1 |
| TC-UIOP-010 | 3 | partial (збігається; мітка `PASS` для гейта до провального виведена UI з порядку гейтів, у доках її немає) | OQ-SKY3-3, OQ-SKY3-4, OQ-SKY3-5 |
| TC-UIOP-011 | 3 | specs ambiguous (поведінка збігається; `NOT_EVALUATED` лише в коді; `03` і `04` («all four gate results») суперечать правилу першої відмови) | OQ-SKY3-2, OQ-SKY3-3, OQ-SKY3-5. Кейс залишається: розбіжностей між кейсом і специфікацією чи кодом немає |
| TC-UIOP-012 | 4 | partial (збігається; селектори лише в коді, кнопка в документації описана на формі створення, а не на сторінці заявки) | OQ-SKY3-5, OQ-SKY3-7 |
| TC-UIOP-013 | 5 | matches | OQ-SKY3-5, OQ-SKY3-7 |

Нових записів у `test-cases/open-questions.md` не додано: усі прогалини вже покриті OQ-SKY3-1…7.

Побічні зауваження верифікаторів (не змінюють очікувані результати): оператор з реєстрації має рівень `L1`, а `KBP-CTR-3` вимагає `L2`, тому в TC-UIOP-009, 010, 011 і 013 ZONE провалився б, якби до нього дійшло. Для цих кейсів це неважливо, бо зупинка на `AIRCRAFT`. У TC-UIOP-012 `L2` заявлено в передумовах.

## Step 4: approval

- Показаний набір: TC-UIOP-008, TC-UIOP-009, TC-UIOP-010, TC-UIOP-011, TC-UIOP-012, TC-UIOP-013 (AC 1–5; AC без кейсу немає).
- Питання: «Approve these cases for Testomat.io?»
- Відповідь користувача: «Так, схвалюю».

## Step 5: Testomat.io

Сьют: `477a11fb` («Оператор бачить відмову AIRCRAFT, якщо вагова категорія борту не дозволена в зоні», `file`), знайдений наявним.

| Case | test_id | Дія |
|---|---|---|
| TC-UIOP-008 | 9c9a3c8f | reused |
| TC-UIOP-009 | 47a34735 | reused |
| TC-UIOP-010 | 34a2f2bd | reused |
| TC-UIOP-011 | 365f1705 | reused |
| TC-UIOP-012 | a28a78fd | reused |
| TC-UIOP-013 | 0f666dd3 | reused |

- Назва, тег `SKY-3`, пріоритет `high` і опис кожного тесту збігаються з файлами, тому оновлень не було. Нових тестів не створювалось.
- duplicates: немає.
- run_id: `77ed4565`, назва «SKY-3 · UI», kind `manual`, статус `running`.
- URL: https://app.testomat.io/projects/skypermit-4e9a2/runs/77ed4565
- `tests_count` = 6, схвалених кейсів 6: збігається.
- `report` не запускався: результатів виконання ще немає.
