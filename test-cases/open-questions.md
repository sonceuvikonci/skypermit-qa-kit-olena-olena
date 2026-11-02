# Open questions

Spec gaps found while writing test cases. Nothing here changes `../skypermit` or Confluence; the questions go to the spec owner.

## SKY-3 (2026-11-02)

| # | Question | Source | Cases |
|---|---|---|---|
| OQ-SKY3-1 | Does the "Check before submitting" result display `rule_reference` for the failing gate? `04 — Frontend Scope` only documents it for rejections in the request detail view. The code shows it. | `04 — Frontend Scope` § Operator portal; `GateResultsPanel.tsx` | TC-UIOP-009 |
| OQ-SKY3-2 | How is a gate that was not evaluated (after the first failure) shown in the validate result, and which `data-gate-status` value is intended? The code uses `NOT_EVALUATED`; the docs do not define it. | `06 — Business Rules` § Evaluation order; `03 — API Contract` § Gate pipeline | TC-UIOP-011 |
| OQ-SKY3-3 | `03` and `04` say the reviewer detail view shows "all four gate results" via `validate`, while the pipeline stops at the first failure. How do both hold? | `03 — API Contract` endpoint 13; `04 — Frontend Scope` § Reviewer queue | TC-UIOP-010, TC-UIOP-011 |
| OQ-SKY3-4 | Is a gate before the failing one shown as `PASS`? The `422` body names only the failing gate and `validate` has no documented per-gate response shape; the UI infers `PASS` from gate order. | `03 — API Contract` § The `422` body | TC-UIOP-010 |
| OQ-SKY3-5 | Selectors `flight-request-zone-select`, `flight-request-aircraft-select`, `flight-request-validate-button`, `flight-request-gate-result-<GATE>` (`data-gate-status`), `flight-request-detail-state` and the route `/operator/requests/new` exist only in the code. Should they be in the `04` selector contract? Also unstated: which view hosts "Check before submitting". | `04 — Frontend Scope` § Two contracts to hold exactly | TC-UIOP-008 to 013 |
| OQ-SKY3-6 | The aircraft picker label (`manufacturer model (serial)`) does not show weight or band; is that intended? | `04 — Frontend Scope` § Operator portal | TC-UIOP-008 |
| OQ-SKY3-7 | Which time zone are form-entered window times interpreted in (the cases assume browser zone `Europe/Kyiv`)? | `06 — Business Rules` § 1.4 | TC-UIOP-009 to 013 |

## SKY-4 (2026-11-02)

| # | Question | Source | Cases |
|---|---|---|---|
| OQ-SKY4-1 | Does the reviewer queue have a zone filter? `04 — Frontend Scope` § Reviewer queue lists only the `UNDER_REVIEW` table sortable by submission time. The code (`app/reviewer/page.tsx`) has no filter. The API supports `zone_code` (`03 — API Contract` endpoint 12), but the UI does not use it. The story names the page «04 — Frontend spec»; the real title is «04 — Frontend Scope». | `04 — Frontend Scope` § Reviewer queue; `03 — API Contract` endpoint 12 | — (кейси не створені: фічі немає в доках і в коді) |
| OQ-SKY4-2 | Control type, `data-testid`, reset behaviour (button, "all zones" option, or clearing the select) and whether the filter is client-side or sends `zone_code`. | same | — (кейси не створені: фічі немає в доках і в коді) |
| OQ-SKY4-3 | "All active zones": should the list come from the catalogue or from `GET /zones`, which has no `active` filter? All six zones are active today, so a test cannot tell the two apart. The zone `active` citation is open in `05` row 5. | `06 — Business Rules` § 4; `05 — Open Questions` row 5 | — (кейси не створені: фічі немає в доках і в коді) |
| OQ-SKY4-4 | The empty-zone message «Немає заявок для цієї зони»: its `data-testid` and UI language. The app shows "No requests awaiting review." (`reviewer-queue-empty`) in English. | story SKY-4 AC 5; `app/reviewer/page.tsx:60-64` | — (кейси не створені: фічі немає в доках і в коді) |
| OQ-SKY4-5 | Initial sort direction and what each click does are not in `04`; the code starts ascending and a click makes it descending. | `04 — Frontend Scope` § Reviewer queue; `app/reviewer/page.tsx:28,46-50` | — (кейси не створені: фічі немає в доках і в коді) |
