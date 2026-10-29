# Test Plan #TP<NNN>: <Scope title>

<!--
How to use this template:
- Keep every section, in this order. Replace each <placeholder>; delete these comments.
- A fact that is not in the docs and not confirmed by the user is written as TBD.
- Columns marked "whole-app only" are added only for whole-application plans;
  for a single-spec plan, delete them.
- Size limits (from SKILL.md): single spec ≤ 90 lines, ≤ 8 risks, ≤ 7 open questions;
  whole application ≤ 160 lines, ≤ 12 risks, ≤ 10 open questions.
-->

| | | |
|---|---|---|
| **Project:** <project> | **Site:** <application URL or TBD> | **Owner:** <plan owner or TBD> |
| **Release:** <release or TBD> | **Sprint:** <sprint or TBD> | **Sources:** <`path/main-doc.md` (main); `path/other.md` (for expected results)> |

## Introduction

<2–3 sentences: what the system under test does, which parts this plan covers (single spec or whole application), and which docs define the expected behaviour.>

## Goals

1. <Verifiable goal tied to the docs, e.g. "Verify all four gates against `06-business-rules.md`, including boundaries and `rule_reference` values".>
2. <...>
3. Produce test cases (`test-cases/<area>/`) and a test report.

## Risks

<!-- Ordered by priority. At most a third of the rows may be H/H.
     Every risk cites a concrete rule, field, selector or transition (with rule code or doc section).
     Every mitigation must be executable with the documented UI/API; say "via DB" when it is not. -->

| # | Area (whole-app only) | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| 1 | <Auth / Gates / State machine / UI / Data> | <What can go wrong, citing `<doc>` §<section> or rule `<code>`> | <L / M / H> | <L / M / H> | <Concrete check: values, boundaries, endpoints or pages> |
| 2 | <...> | <...> | <...> | <...> | <...> |

## In Scope

- <Feature, endpoint group or page, as named in the docs>
- <...>

## Out of Scope

- <What is not tested, with the reason, e.g. "`Operator.status = SUSPENDED` response — undefined, see Open Questions">
- <...>

## Test Strategy

| Area | Level (whole-app only) | Approach | Reason |
|---|---|---|---|
| <Area> | <UI / API / DB> | <Manual / Automation candidate / Manual, automation candidate> | <One-line reason> |
| <...> | <...> | <...> | <...> |

## Entry Criteria

1. Test environment and its URL are available (<URL or TBD>).
2. Test data / fixtures: <concrete list, e.g. "pilot with `certified_on` = window_start − 18 months", "aircraft at 900 / 3,500 / 12,000 / 30,000 g", "one inactive zone (via DB)", "two operator accounts and one reviewer id">.
3. Access needed beyond the product UI/API: <e.g. DB access to edit `certified_on`, or "none">.
4. Specs in Sources reviewed; Open Questions raised with their owners.
5. Test cases ready.

## Environments

- Browsers: <list or TBD>
- OS: <list or TBD>
- Backend / API instance, test data reset method: <value or TBD>

## Exit Criteria

1. ≥ <85>% of planned test cases executed, 100% of High-priority cases executed.
2. ≥ <90>% of executed cases passed.
3. No open Critical or High defects.
4. <Coverage criterion tied to the docs (whole-app), e.g. "every legal/illegal transition and every `rule_reference` covered by at least one executed case"; or a spec-specific criterion (single spec), e.g. "every interactive element checked for `data-testid`".>
5. Test report is ready for stakeholders.

## Tools

- Version control: <tool or TBD>
- Test documentation: Markdown in `test-cases/` and `test-plans/`
- Defect tracker: <tool or TBD>
- <API client, if API testing is in scope: tool or TBD>

## Schedule and Estimations

**Start date:** <DD.MM.YY or TBD> | **End date:** <DD.MM.YY or TBD>

1. Analysis of specs and open questions: <estimate or TBD>
2. Test cases: <estimate or TBD>
3. Test execution: <estimate or TBD>
4. Test report: <estimate or TBD>

## People

- QA Engineer: <name or TBD>
- Spec owner, rules owner, developer contacts: <names or TBD>

## Open Questions

<!-- Label each: [doc gap] not specified · [doc vs doc] two docs disagree · [doc vs code] only if code was actually read.
     Each item links to the source doc and section. Do not list TBD header fields one by one. -->

1. [doc gap] <What is undefined and what it blocks> (`<doc>` §<section>)
2. [doc vs doc] <Which docs disagree and how> (`<doc A>` §<x> vs `<doc B>` §<y>)
3. Header fields marked TBD need an owner.