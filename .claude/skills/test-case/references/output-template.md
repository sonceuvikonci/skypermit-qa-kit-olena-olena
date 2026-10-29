# TC-<AREA>-<NNN>: <Condition and outcome, one line>

<!--
How to use this template:
- Keep every section, in this order. Replace each <placeholder>; delete these comments.
- One case = one behaviour, one rule, one expected outcome. If Expected result needs values
  from two rules or two docs, split into two cases.
- Write in English; identifiers, paths, data-testid values, states, enum values and rule codes
  stay exactly as in the docs.
- Save as test-cases/<area>/TC-<AREA>-<NNN>.md (areas and codes: see SKILL.md).
-->

| Field | Value |
|---|---|
| **ID** | TC-<AREA>-<NNN> |
| **Doc ref** | `<governing doc>` §<section>; rule `<rule code>` <!-- if the docs give one --> |
| **Priority** | <High / Medium / Low> |
| **Level** | <UI / API / DB> |

<!-- Doc ref matches the Level: no UI spec in an API case. Also cite the doc that defines
     any endpoint used in Verification. -->

## Preconditions

<!-- All setup goes here, not in Steps. When a later gate is tested, make every earlier gate pass
     explicitly (PILOT → AIRCRAFT → ZONE → TIME_WINDOW). If setup needs access the product does
     not give, say how: "via DB" or "admin action". -->

1. <State before the step: session / accounts>
2. <Records and their relevant field values>
3. <Request state, clock assumptions>

## Test data

<!-- Concrete values, not ranges; one boundary value per case. Times relative to execution
     ("now + 24 h"), stating UTC or zone-local. Mark any value or field name not from Doc ref:
     "(from `<doc>`)", "(from `confirmed-facts.md` #<n>)" or "(assumed)". Prefer neutral values
     that cannot fail an undocumented format check. -->

| Item | Value |
|---|---|
| <field> | <concrete value> <(source) if not from Doc ref> |
| <field> | <concrete value> |

## Steps

<!-- The action under test only, usually 1–3 lines. UI: name the data-testid when the docs give one.
     API: method and path. -->

1. <Single action under test>

## Verification

<!-- Optional. Read-only actions only (GET, open a page, read a list), using endpoints or pages
     the docs define. Use when the step's own response does not show the expected value.
     Delete this section if it is not needed. -->

1. <Read-only call that makes the result visible>

## Expected result

<!-- One numbered item per Step and per Verification action, in the same order. Exact observable
     values only (status code, field value, state, UI text or selector), no conclusions such as
     "is created" or "is ignored". Values come from the docs or from confirmed-facts.md.
     Undefined value → TBD plus an Open question line. -->

1. Step 1 <returns / shows> <exact value> <(confirmed: `confirmed-facts.md` #<n>) if user-confirmed>
2. Verification 1 <returns / shows> <exact value>

Open question: <what is undefined, source doc and section> <!-- only if a value is TBD or not observable -->