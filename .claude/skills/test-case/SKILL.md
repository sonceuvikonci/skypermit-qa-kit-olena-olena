---
name: test-case
description: Generate one atomic, low-level test case (a single check, not a scenario) as a Markdown file with ID, Doc ref, Priority, Level, Preconditions, Test data, Steps, optional Verification and Expected result, based on the project specs (e.g. ../skypermit/docs/). Use whenever the user asks for a test case, "тест-кейс", a TC, a single check, or wants to turn a risk, rule, boundary or test-plan item into a test, even if they don't say "test case" explicitly. Not for test plans or checklists of many scenarios.
---

# Test Case

Generate **one** atomic test case from the specs and save it as a Markdown file.

## What "atomic" means here

One test case verifies **one behaviour or one rule condition**, with **one expected outcome**. That outcome may be checked through several fields of the same response (e.g. `failing_gate` and `rule_reference` of one `422`), because together they describe one result.

It is **not** atomic if it:
- checks two rules, two boundaries or two transitions (e.g. "exactly 15 min passes and 14 min fails");
- walks through a flow with several outcomes (register → create pilot → submit → approve);
- has an expected result after more than one step.

Why: atomic cases fail for exactly one reason, so a failure points to one defect, and each case can be automated or re-run on its own.

A second rule hides easily in Expected result: if the outcome contains values that come from different rules or different docs (e.g. "`authorisation_level` = `L1`" from the API contract and "`id` equals the auth user id" from the data model), it is two cases. Split them.

Setup work (accounts, pilots, aircraft, requests in a given state) belongs in **Preconditions**, not Steps. Steps are only the action under test, usually 1–3 lines. Read-only calls that only observe the result go in **Verification** (see Template), so they do not count as extra steps.

If the request implies several checks, do not merge them. List the candidate atomic checks (one line each) and ask which one to write, or offer to generate each as a separate case.

## Inputs

- The user's request: a rule, field, boundary, transition, UI element, or a risk/item from a test plan in `test-plans/`.
- When the case comes from a test-plan risk about a rule being bypassed (e.g. "registration allows choosing `authorisation_level`"), write the negative variant first, the one that tries the bypass (send `authorisation_level: "L3"`, expect `L1`). The default-value variant is weaker and comes second. Why: the risk is about the bypass, so that is the check most likely to find the defect.
- The specs (for skypermit: `../skypermit/docs/`, read-only). Read the docs that govern the check before writing. Where docs disagree, follow the governing or corrected one (for skypermit, `07-clarifications.md` and `06-business-rules.md` override the source wording) and cite it.

## Confirmed facts register

Some expected values are not in the docs and only the user can confirm them (e.g. `POST /operators` returns `201`). Keep these answers in one file so they are asked once and every case cites the same source.

- File: `test-cases/confirmed-facts.md`. Create it on first use with this table:

```markdown
# Confirmed facts

Values not stated in the specs, confirmed by the user. Cite as `confirmed-facts.md` #<n>.

| # | Fact | Not stated in | Confirmed by | Date |
|---|---|---|---|---|
| 1 | `POST /api/v1/operators` returns `201` on success | `03-api-contract.md` | user | 2026-10-19 |
```

- **Before asking** the user about an undefined value, read this file. If the fact is there, use it and cite its number; do not ask again.
- **After the user answers**, add a row (next number, today's date, "user" or the name they give), then cite it in the case. If they say "keep TBD", do not add a row.
- If a later answer contradicts a row, ask which is right, update the row, and list the cases that cite it so they can be updated.
- One fact per row, stated as an observable value, so it can be reused across cases.

## Output location and ID

- Save to `test-cases/<area>/TC-<AREA>-<NNN>.md` in this repo. Never write into `../skypermit`.
- Areas for skypermit:

| Folder | `AREA` code | Covers |
|---|---|---|
| `auth` | `AUTH` | register, login, logout, session, `401`/`403`, operator scoping |
| `registry` | `REG` | operators, pilots, aircraft, zones (create, get, list, field validation) |
| `gates` | `GATE` | `PILOT`, `AIRCRAFT`, `ZONE`, `TIME_WINDOW`, `validate`, `rule_reference` |
| `state-machine` | `SM` | transitions, `409`, cancellation deadline |
| `ui-operator` | `UIOP` | operator portal pages, `data-testid`, no pre-filtering |
| `ui-reviewer` | `UIRV` | reviewer queue, approve/reject in the UI |
| `data` | `DATA` | audit log, review actions, derived values, constraints |

  If a check fits no area, propose a new folder and code and ask before creating it.
- `NNN` is the next free three-digit number within that area folder (check existing files first). Never ask the user for it.
- Before writing, search `test-cases/` for a case with the same Doc ref and the same condition. If one exists, tell the user and ask whether to skip, replace, or write a variant.

## Template

Use exactly this structure and field order. Write the case in English; identifiers, paths, `data-testid` values, states, enum values and rule codes stay as in the docs.

```markdown
# TC-<AREA>-<NNN>: <What is verified, one line>

| Field | Value |
|---|---|
| **ID** | TC-<AREA>-<NNN> |
| **Doc ref** | `<doc file>` §<section>; rule `<rule code>` if any |
| **Priority** | High / Medium / Low |
| **Level** | UI / API / DB |

## Preconditions

1. <State of the system before the step: accounts, records, request state, clock assumptions>

## Test data

| Item | Value |
|---|---|
| <field> | <concrete value> |

## Steps

1. <Single action under test>

## Verification

1. <Optional. Read-only call that makes the result visible, e.g. GET of the changed resource. Omit the section if the step's own response shows the result.>

## Expected result

1. Step 1 <returns / shows>: <exact observable value, e.g. status code, field value, state, UI text/selector>
2. Verification 1 <returns / shows>: <exact observable value>  (only if there is a Verification section)
```

### Field rules

- **Title**: states the condition and the outcome, e.g. "Weight band not in zone's permitted bands fails AIRCRAFT gate".
- **Doc ref**: the doc and section that define the expected result, plus the rule code if the docs give one (e.g. `06-business-rules.md` §1.2; rule `ZC-2026.1 §2`). Cite the governing doc, not just the one that mentions it. Cite docs that match the Level: an API case does not cite the UI spec, and a UI case cites the UI spec plus the rule doc, not the API contract alone. Also cite the doc that defines any endpoint used in Verification.
- **Priority**:
  - High: gates and `rule_reference`, illegal transitions, access control, data loss/integrity, the two frontend contracts.
  - Medium: field validation, boundaries of secondary limits, list filters and sorting.
  - Low: cosmetic or informational UI.
- **Level**: where the check is observed. Use API when the expected result is a status code or response body; UI when it is what the user sees or a `data-testid`; DB only when neither UI nor API can show it.
- **Preconditions**: everything needed to make the single step meaningful. Make other gates pass explicitly when testing a later gate (gates run `PILOT` → `AIRCRAFT` → `ZONE` → `TIME_WINDOW` and stop at the first failure). If a precondition needs access the product does not give (e.g. editing `certified_on` with no update endpoint, setting `authorisation_level` above `L1`), say how: "via DB" or "admin action", so the tester knows.
- **Test data**: concrete values, not ranges. Every value must be traceable: if a field name or format does not come from the doc in Doc ref, mark where it comes from right in the Value cell: "(from `01-data-model.md`)", "(from `confirmed-facts.md` #<n>)" or "(assumed)". Prefer neutral values that are unlikely to fail an undocumented format check (e.g. digits only for an id whose format is not defined), so the case fails because of the rule, not because of the data. For boundaries, use the exact boundary value or one unit past it, one value per case. Express times relative to execution (e.g. "now + 24 h") and say whether they are UTC or zone-local.
- **Steps**: imperative, numbered, the action under test only. For UI, name the `data-testid` where the docs give one. For API, give method and path.
- **Verification**: only read-only actions that do not change state (a `GET`, opening a page, reading a list). Use it when the step's own response does not show the expected value, e.g. the response body is undefined in the docs. Only use endpoints or pages the docs define. Never put a write action here; if one is needed, it is setup and goes in Preconditions.
- **Observability**: the expected result must be visible at the stated Level by a documented means: the step's response, a Verification read, or the UI. If neither the API nor the UI can show it (e.g. comparing with `auth.users`), set Level to DB and say "via DB" in Verification. If nothing documented can show it, keep the value but add `Open question: how to observe <value>, source`.
- **Expected result**: a numbered list, one item per Step and per Verification action, in the same order, each with the exact value that action shows ("Verification 1 returns `authorisation_level` = `L1`"). Write only observable values, not conclusions drawn from them: not "the operator is created" or "the injected field is ignored", because those follow from the values and cannot be checked on their own. Use only values the docs define or the facts register confirms; mark a confirmed value as "(confirmed: `confirmed-facts.md` #<n>)". If the docs do not define the expected value (e.g. the response for a `SUSPENDED` operator, the status for a duplicate `national_id`, UI error text), write `TBD` for that value and add a line `Open question: <what is undefined, source>` under Expected result. Never invent a code or message.

## Before saving

1. Exactly one behaviour is verified, with one expected outcome; all values in Expected result come from one rule. If not, split.
2. Steps contain no setup; setup is in Preconditions; Verification contains only read-only actions.
3. Every value in Expected result is traceable to the Doc ref, including endpoints used in Verification.
4. Every value in Expected result is observable at the stated Level (step response, Verification read, UI or DB); Expected result has one numbered item per Step/Verification action and no conclusions.
5. Every Test data value not from the Doc ref is marked with its source or "(assumed)".
6. Doc ref matches the Level (no UI spec in an API case unless the case is UI).
7. Preconditions make all earlier gates pass when a later gate is tested.
8. File path, ID and title match; the number is not already used.
9. Every user-confirmed value cites a row in `confirmed-facts.md`.

## Final message to the user

2–4 lines in the user's language: file path, what the case verifies, priority and level. Then, if the case contains any `TBD` not covered by `confirmed-facts.md`, list each one and ask the user to give a value or confirm it stays `TBD`; record each given value in `confirmed-facts.md` and update the case to cite it. If nothing is `TBD`, offer the next related atomic case (e.g. the other side of the boundary, or the negative bypass variant) in one line. If you split a request into several cases, list the ones not yet written.

## Reference

See `references/TC-GATE-001-example.md` for a complete example.