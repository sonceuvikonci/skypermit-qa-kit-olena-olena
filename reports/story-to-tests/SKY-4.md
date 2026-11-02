# SKY-4 — Рецензент фільтрує чергу заявок за зоною

Дата: 2026-11-02 · check_type: ui · confluence_url: немає (лише текстова згадка «04 — Frontend spec», Reviewer queue)

## Зведена таблиця

| # | AC | Документація | Код | Позначка |
|---|---|---|---|---|
| 1 | У черзі є фільтр за зоною зі списком усіх активних зон | не описано | not_found | ⚠ |
| 2 | Вибір зони лишає лише `UNDER_REVIEW` з цієї зони | не описано (частково: черга = `UNDER_REVIEW`; API `zone_code`) | not_found | ⚠ |
| 3 | Фільтр працює разом із сортуванням за часом подання | не описано (сортування є, комбінація — ні) | not_found | ⚠ |
| 4 | Скидання фільтра повертає повну чергу | не описано | not_found | ⚠ |
| 5 | Повідомлення «Немає заявок для цієї зони» | не описано | not_found | ⚠ |

**Docs:** 0 покрито, 0 суперечить, 5 не описано.
**Code (implementation-check):** загальний вердикт `not_implemented`; усі 5 AC `not_found`.

## Докази в документації
- `04 — Frontend Scope § Reviewer queue`: «Pending requests table (state = `UNDER_REVIEW`), sortable by submission time». Фільтра за зоною, скидання й empty-state немає.
- `03 — API Contract § Flight requests` #12: `GET /flight-requests` фільтрується за `state`, `zone_code`, діапазоном дат; рецензент бачить усіх операторів.
- `03 — API Contract § Reference data` #7: `GET /zones` — каталог зон.
- `01 — Data Model § Zone`: поле `active`. `06 — Business Rules § 4`: усі 6 зон активні.

## Докази в коді (../skypermit)
- Екран `/reviewer`, `app/reviewer/page.tsx` (компонент `ReviewerQueueForReviewer`).
- `page.tsx:32` — єдиний фільтр жорстко `state: 'UNDER_REVIEW'`.
- `page.tsx:46-50`, `:73-78` — сортування за «Submitted at».
- `page.tsx:60-64` — empty-state `reviewer-queue-empty` з текстом "No requests awaiting review." (не зональний, інший текст).
- `data-testid`, що існують: `reviewer-queue-no-reviewer`, `reviewer-queue-error`, `reviewer-queue-empty`, `reviewer-queue-list`, `reviewer-queue-sort-submitted-at`, `reviewer-queue-row-${r.id}`. Для фільтра зони, скидання й зонального повідомлення `data-testid` немає.
- Бекенд готовий частково: `app/api/v1/flight-requests/route.ts:122-123` підтримує `?zone_code=`; `app/api/v1/zones/route.ts` існує (фільтр за `active` не перевірено).
- Пошук `Немає заявок|reviewer-queue-(zone|filter)|zone-filter|filter-zone` по репозиторію — збігів немає.

## Побічні знахідки
- Інтейк згадує сторінку «04 — Frontend spec»; у просторі вона називається `04 — Frontend Scope`. Прямого посилання (`confluence_url`) немає.
- Мова UI: AC вимагає українське повідомлення, а UI англомовний (`"No requests awaiting review."`). Питання до специфікації.
- Невідомо, чи `GET /zones` повертає лише активні зони; правила «у списку лише активні» в документації немає.
- Відкриті питання з `05`: рядок 5 (цитата для `Zone.active`) і рядок 4 (`SUSPENDED`) прямо до цієї історії не стосуються.
- Не перевірено в коді: `lib/client/api` (чи `listFlightRequests` приймає `zone_code`).

## Рішення
Крок 3 не виконується: загальний вердикт `not_implemented`. Кейси не писались, у Testomat.io нічого не надсилалось.
