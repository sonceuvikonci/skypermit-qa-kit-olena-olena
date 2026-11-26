# TD-TW-001 — Тест-дизайн: тривалість польоту (TIME_WINDOW / TSD-4 §3)

| Поле | Значення |
|---|---|
| Правило | Тривалість **15–240 хв, включно з обох боків**. `window_end` строго після `window_start`. |
| Джерело | `../skypermit/docs/06-business-rules.md` §1.4, рядок «Duration» (`TSD-4 §3`); `rule_reference` — §6 |
| Пов'язані специфікації | `01-data-model.md` (window_end > window_start, UTC), `02-state-machine.md`, `03-api-contract.md` (400 / 409 / 422, endpoints 9, 10, 13) |
| Код (лише для уточнення) | `lib/gates/time-window-gate.ts:28-31`, `app/api/v1/flight-requests/route.ts:38-40`, `supabase/migrations/0001_init.sql:148` |
| Техніки | Класи еквівалентності (EP), аналіз граничних значень (BVA, 3-value), переходи станів (STT) |
| Дата | 2026-11-23 |

> Джерело: локальна копія `06 — Business Rules` у `../skypermit/docs/`. Сторінку в Confluence не відкривав, бо Atlassian MCP не автентифікований. Якщо версія в Confluence відрізняється, документ треба перезвірити.

---

## 1. Модель правила

```
d = (window_end − window_start), у хвилинах, обчислюється в UTC

d ≤ 0              → 400 на створенні (POST /flight-requests), DRAFT не створюється
0 < d < 15         → 422, failing_gate = TIME_WINDOW, rule_reference = "TSD-4 §3"
15 ≤ d ≤ 240       → перевірку тривалості пройдено
d > 240            → 422, failing_gate = TIME_WINDOW, rule_reference = "TSD-4 §3"
```

Де перевіряється:
- **Створення (endpoint 9):** лише `window_end > window_start` → інакше `400` (у коді й CHECK-обмеженні БД `window_valid`).
- **Submit (10) / Validate (13):** діапазон 15–240 хв у гейті `TIME_WINDOW`.
- Ендпоінта для редагування `window_*` немає: тривалість фіксується при створенні.

Порядок перевірок у коді (у межах `TIME_WINDOW`): lead time ≥ 6 год → advance ≤ 60 днів → **тривалість** → curfew → overlap. Спека задає порядок лише *між* гейтами, а не всередині `TIME_WINDOW` (див. OQ-3).

### Базові тестові дані (нейтральні, щоб спрацювала лише перевірка тривалості)

| Сутність | Значення | Навіщо |
|---|---|---|
| Operator | `ACTIVE`, `L1` | проходить ZONE (auth level) |
| Pilot | `R_BASIC`, `certified_on` = сьогодні − 1 міс. | проходить PILOT |
| Aircraft | `mtom_grams` = 500 (C0), `ACTIVE` | проходить AIRCRAFT |
| Zone | `DNI-OPN-1` (OPEN, ceiling 120 м, curfew немає) | без curfew, щоб він не маскував результат |
| `requested_altitude_metres` | 100 | ≤ ceiling |
| `window_start` | **T0** = сьогодні + 2 доби, 10:00:00Z | lead time 6 год – 60 днів виконано |
| Інші заявки на це aircraft | немає `APPROVED`/`UNDER_REVIEW` | без overlap |

`window_end` = T0 + d.

---

## 2. Класи еквівалентності

| ID | Клас | Діапазон d | Тип | Очікувана поведінка | Представник |
|---|---|---|---|---|---|
| EC-V1 | Допустима тривалість | 15 ≤ d ≤ 240 хв | Valid | submit → `UNDER_REVIEW`; validate → PASS | 120 хв |
| EC-I1 | Кінець раніше за початок | d < 0 | Invalid | `400` на створенні, заявка не створюється | −30 хв |
| EC-I2 | Нульова тривалість | d = 0 | Invalid | `400` на створенні | 0 |
| EC-I3 | Занадто короткий | 0 < d < 15 хв | Invalid | submit → `422` TIME_WINDOW / `TSD-4 §3`, стан `REJECTED` | 5 хв |
| EC-I4 | Занадто довгий | d > 240 хв | Invalid | submit → `422` TIME_WINDOW / `TSD-4 §3`, стан `REJECTED` | 360 хв |
| EC-I5 | Дуже довгий / кілька діб | d ≥ 24 год | Invalid (підклас I4) | як EC-I4 | 1500 хв (25 год) |
| EC-F1 | `window_end` відсутній / не ISO-дата | — | Invalid (формат) | `400` на створенні | `"abc"`, поле відсутнє |

Окремо від діапазону (valid-представники з особливостями):

| ID | Особливість | Приклад | Очікувано |
|---|---|---|---|
| EC-V2 | Вікно перетинає північ UTC | 23:00Z → 01:00Z наступного дня (120 хв) | PASS, тривалість рахується по timestamp, а не по годиннику |
| EC-V3 | `window_*` передані з різними offset-ами | `start` = `2026-11-25T12:00:00+02:00`, `end` = `2026-11-25T10:30:00Z` (90 хв) | PASS, обидва значення нормалізуються до UTC |
| EC-V4 | Вікно перетинає перехід DST у зоні (Europe/Kyiv) | 2027-03-28 00:30Z → 01:30Z (60 хв UTC; на локальному годиннику 02:30 → 04:30) | PASS, бо тривалість = 60 хв за UTC, а не 120 за локальним часом |

---

## 3. Граничні значення (3-value BVA, крок 1 хв)

| ID | d | Межа | Клас | Очікувано: створення | Очікувано: submit | Пріоритет |
|---|---|---|---|---|---|---|
| BV-01 | −1 хв | 0 | EC-I1 | `400` «window_end must be after window_start» | — | Medium |
| BV-02 | 0 | 0 | EC-I2 | `400` | — | High |
| BV-03 | +1 хв | 0 | EC-I3 | `201`, DRAFT | `422`, TIME_WINDOW, `TSD-4 §3`, `REJECTED` | Medium |
| BV-04 | 14 хв | 15 | EC-I3 | `201` | `422`, `TSD-4 §3` | **High** |
| BV-05 | 15 хв | 15 | EC-V1 | `201` | `200`, `UNDER_REVIEW` | **High** |
| BV-06 | 16 хв | 15 | EC-V1 | `201` | `UNDER_REVIEW` | Medium |
| BV-07 | 239 хв | 240 | EC-V1 | `201` | `UNDER_REVIEW` | Medium |
| BV-08 | 240 хв | 240 | EC-V1 | `201` | `UNDER_REVIEW` | **High** |
| BV-09 | 241 хв | 240 | EC-I4 | `201` | `422`, `TSD-4 §3` | **High** |

### Під-хвилинні межі (API дозволяє секунди; див. OQ-1)

Правило задане в хвилинах, а код рахує дробові хвилини (`ms / 60000`) і порівнює строго. Тому:

| ID | d | Очікувано за кодом | Очікувано за спекою |
|---|---|---|---|
| BV-10 | 14 хв 59 с | `422` | не визначено |
| BV-11 | 15 хв 00 с | PASS | PASS |
| BV-12 | 240 хв 00 с | PASS | PASS |
| BV-13 | 240 хв 01 с | `422` | не визначено |
| BV-14 | 0 хв 0.001 с (1 мс) | створення `201`, submit `422` | `422` |

BV-10/BV-13 вважати тестами з **невизначеним очікуваним результатом**, доки OQ-1 не закрито.

---

## 4. Переходи станів

### 4.1 Фрагмент state machine, на який впливає тривалість

```
               POST /flight-requests
  (немає) ──── d ≤ 0 ──────────────────► 400, запис не створено
     │
     └──── d > 0 ──► DRAFT ──submit, d ∈ [15;240], інші гейти PASS──► UNDER_REVIEW
                       │
                       ├──submit, d ∉ [15;240] (+ PILOT/AIRCRAFT/ZONE/lead time PASS)──► REJECTED
                       │                                                failing_gate=TIME_WINDOW
                       │                                                rule_reference="TSD-4 §3"
                       ├──validate (будь-яке d)──► DRAFT (стан не змінюється)
                       └──cancel──► CANCELLED
  REJECTED ──submit / будь-яка дія──► 409 (термінальний стан)
```

### 4.2 Таблиця переходів (тест-кейси)

| ID | Початковий стан | Подія / вхід | Очікуваний стан | Відповідь / перевірки | Пріоритет |
|---|---|---|---|---|---|
| ST-01 | — | create, d = 0 (або < 0) | — (запису немає) | `400`; `GET /flight-requests` не повертає нової заявки | High |
| ST-02 | — | create, d = 14 хв | `DRAFT` | `201`; на створенні діапазон не перевіряється | High |
| ST-03 | `DRAFT` (d = 15) | submit | `UNDER_REVIEW` | `200`; `failing_gate`/`rejection_reason`/`rule_reference` = null; `submitted_at` заповнено; `SUBMITTED` у стані спокою не спостерігається | High |
| ST-04 | `DRAFT` (d = 241) | submit | `REJECTED` | `422` `{failing_gate:"TIME_WINDOW", rule_reference:"TSD-4 §3", message}`; у БД `rejection_reason` = message, `decided_by` = null, `submitted_at` = `decided_at` | High |
| ST-05 | `DRAFT` (d = 14) | validate | `DRAFT` | `422`/результат з `TIME_WINDOW` + `TSD-4 §3`; стан, `submitted_at`, `failing_gate` у БД не змінилися | High |
| ST-06 | `DRAFT` (d = 240) | validate | `DRAFT` | PASS; стан не змінився | Medium |
| ST-07 | `REJECTED` (через d = 241) | submit ще раз | `REJECTED` | `409`; поля відхилення не перезаписано | High |
| ST-08 | `REJECTED` (через d = 241) | cancel | `REJECTED` | `409` | Medium |
| ST-09 | `DRAFT` (d = 241) | cancel | `CANCELLED` | дозволено, бо cancel із DRAFT не запускає гейтів | Low |
| ST-10 | `DRAFT` (d = 14) | validate → submit | `REJECTED` | validate і submit повертають однакові `failing_gate`/`rule_reference` (спільний pipeline) | Medium |
| ST-11 | audit log | ST-03 / ST-04 | — | тригер записав рівно одну зміну стану DRAFT→UNDER_REVIEW / DRAFT→REJECTED | Low |

---

## 5. Взаємодія з іншими перевірками (маскування)

Тривалість не можна перевірити ізольовано, якщо інша умова падає раніше. Ці кейси перевіряють порядок:

| ID | Вхід | Очікувано | Підстава |
|---|---|---|---|
| IX-01 | d = 241, пілот `R_BASIC` у зоні `KBP-CTR-3` (CONTROLLED) | `failing_gate = PILOT`, `OH-1 §2.1` | порядок гейтів, `API-REF §5` |
| IX-02 | d = 241, lead time = 3 год | `TIME_WINDOW`, `TSD-4 §2.1` (не `§3`) | порядок у коді; спека не визначає (OQ-3) |
| IX-03 | d = 241, вікно повністю в curfew `LVV-RST-2` (22:00–06:00 local) | `TIME_WINDOW`, `TSD-4 §3` (не `ZC-2026.1 §3`) | порядок у коді (OQ-3) |
| IX-04 | d = 240, вікно перетинає overlap з `APPROVED` заявкою того ж aircraft | `TIME_WINDOW`, `TSD-4 §5`, тобто тривалість пройдено | regression: межа 240 не маскує overlap |
| IX-05 | d = 240, `window_start` = рівно now + 60 днів − 1 хв | PASS: advance рахується від `window_start`, а не `window_end` | `TSD-4 §2.2` |

---

## 6. UI (frontend, `04-frontend-spec.md`: поля «Window start» / «Window end»)

| ID | Перевірка | Очікувано |
|---|---|---|
| UI-01 | Ввести end = start + 14 хв, натиснути «check before submitting» (validate) | показано помилку TIME_WINDOW з текстом про 15–240 хв |
| UI-02 | end = start + 15 хв і + 240 хв | validate PASS |
| UI-03 | end < start | помилка `400` «window_end must be after window_start» показана зрозуміло |
| UI-04 | Ввід у локальному часі браузера (Europe/Kyiv) поруч із DST, як EC-V4 | у payload ISO у UTC, тривалість рахується за UTC |

Чи має UI власну клієнтську валідацію діапазону, спека не каже (OQ-4).

---

## 7. Покриття

| Техніка | Елементи | Покрито |
|---|---|---|
| EP | EC-V1..V4, EC-I1..I5, EC-F1 | 10/10 |
| BVA (хвилини) | межі 0, 15, 240 × 3 значення | 9/9 (BV-01..09) |
| BVA (під-хвилинні) | 15, 240, 0+ | BV-10..14 (частково заблоковано OQ-1) |
| STT (валідні переходи, що стосуються правила) | create, DRAFT→UNDER_REVIEW, DRAFT→REJECTED, DRAFT→DRAFT (validate), DRAFT→CANCELLED | 5/5 |
| STT (невалідні) | REJECTED→submit, REJECTED→cancel | 2/2 |

**Мінімальний набір для smoke:** BV-02, BV-04, BV-05, BV-08, BV-09, ST-04, ST-05, ST-07.

---

## 8. Відкриті питання (не вгадувати, уточнити в rules owner)

| # | Питання | Чому важливо |
|---|---|---|
| OQ-1 | Правило в хвилинах, але API приймає ISO з секундами й мілісекундами. Чи 14 хв 59 с і 240 хв 01 с — це fail (так поводиться код), чи значення округлюються або обрізаються до хвилин? | Визначає очікуваний результат BV-10, BV-13, BV-14 |
| OQ-2 | `06` відносить «window_end строго після window_start» до гейту `TIME_WINDOW` (тобто `422` + `TSD-4 §3`), але код повертає `400` ще на створенні, і через CHECK у БД такий DRAFT неможливий. Яка відповідь правильна, `400` чи `422`? | Очікуваний результат BV-01, BV-02, ST-01. Зараз в очікуваних результатах стоїть `400` за кодом і `01-data-model.md` |
| OQ-3 | Порядок підперевірок усередині `TIME_WINDOW` (lead time / advance / duration / curfew / overlap) не специфіковано, а від нього залежить `rule_reference`, коли падає кілька умов. | IX-02, IX-03 |
| OQ-4 | Чи має форма створення заявки валідувати тривалість на клієнті до виклику API? | UI-01..03 |
| OQ-5 | Коди відповіді для успішних create (`201`?) і submit (`200`?) у `03-api-contract.md` явно не вказані. У таблицях вище вони взяті з поведінки, а не зі спеки. | Чи можна фіксувати коди в очікуваних результатах |
