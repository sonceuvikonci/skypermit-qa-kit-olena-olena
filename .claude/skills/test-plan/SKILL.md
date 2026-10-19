---
name: test-plan
description: Generate a concise test plan (scope, risks, strategy, entry/exit criteria, environments, tools, schedule) from a provided spec file or documentation directory. Use whenever the user asks for a test plan, "тест-план", QA plan, or test strategy based on docs, e.g. the specs in ../skypermit/docs/, even if they don't say "test plan" explicitly.
---

# Test Plan

Generate a test plan from a spec file or a docs directory.

## Inputs

- A file or a directory of documentation (for skypermit: `../skypermit/docs/`, read-only).
- Read every doc the plan relies on before writing, and list them in Sources.

### Single-file input
- The given file is the **main source**. Goals and In Scope cover only what it describes.
- Adjacent docs may be read only to derive expected results (rules, states, error codes). List them in Sources as "(for expected results)". Do not add their features to scope.

### Directory / whole-application input
- All docs are sources. Scope spans every layer they describe (UI, API, DB).
- See "Size limits" for how to keep the plan readable.

## Output

- Save to `test-plans/TP<NNN>-<slug>.md` in this repo. Never write into `../skypermit`.
- `NNN` is the next free three-digit number among existing `test-plans/TP*.md` files. It is a plan number, not a sprint number. Never ask the user for it.
- Follow the structure of `references/TP007-skypermit.md`: header block (including Sources), then Introduction, Goals, Risks (table), In Scope, Out of Scope, Test Strategy (table), Entry Criteria, Environments, Exit Criteria, Tools, Schedule and Estimations, People, Open Questions.
- Keep the reference's column names exactly (e.g. `Likelihood`, `Impact`, not `L`, `I`).
- Language: write the plan in English, like the reference, unless the user asks for another language. Identifiers, paths, `data-testid` values, states, enum values and rule codes always stay in English.
- The plan is for stakeholders: never mention Claude, this skill, or how the plan was generated.

## Size limits

| Scope | Length | Risks | Open Questions | In Scope bullets |
|---|---|---|---|---|
| Single spec / feature | ~1 page (≤ 90 lines) | ≤ 8 | ≤ 7 | ≤ 8 |
| Whole application (3+ docs or several areas) | ≤ 2 pages (≤ 160 lines) | ≤ 12 | ≤ 10 | ≤ 12 |

- Merge risks that share a mitigation; merge questions about the same gap.
- For whole-application plans, group risks by area (e.g. Auth, Gates, State machine, UI, Data) with an `Area` column.
- Rank risks: no more than a third may be `H`/`H`. Order the table by priority.
- If the scope cannot fit the limits without losing important risks, write a master plan plus one plan per area, and link them from the master plan's In Scope.

## Content rules

### Facts and TBD
- Do not invent facts (people, dates, URLs, releases, environments, tools) that are not in the docs; mark them `TBD`.
- Project-level facts in the reference plan (Site, People, Tools) may be reused only if they are also in the docs or the user confirms them. Otherwise `TBD`.
- Never infer environments from the local machine, file paths or the terminal.
- Do not turn TBD header fields into separate Open Questions. One line is enough: "Header fields marked TBD need an owner."

### Risks
- Each risk is tied to a concrete feature, rule, field, selector or state transition from the docs, citing the rule code or doc section when there is one.
- No generic risks copied from the reference (e.g. "docs differ from code", "time issue") unless the docs give a concrete instance.
- Every mitigation must be executable with the documented UI or endpoints. If it needs direct DB access (e.g. the API has no update path), say so and add that access to Entry Criteria.
- Exclude or flag states and transitions that cannot be reached through the product (transient states, maintenance-only endpoints).

### Expected results
- Use only values the docs define (status codes, rule references, thresholds, boundaries). Prefer the governing or corrected doc when docs disagree, and note which one.
- Do not state an expected status code or message the docs do not define; make it an Open Question instead.

### Test Strategy
- Label each area `Manual`, `Automation candidate`, or both, with a one-line reason. Do not write automated tests here.
- When scope spans layers, add a `Level` column (`UI`, `API`, `DB`).

### Entry and Exit Criteria
- Measurable, e.g. "≥ 85% of planned cases executed", "0 open Critical/High defects".
- If expected results need specific test data (dates relative to now, weights at band boundaries, inactive records, several accounts), list the fixtures concretely in Entry Criteria.
- For whole-application plans, add a coverage criterion tied to the docs (e.g. every legal/illegal transition and every `rule_reference` covered by at least one executed case).

### Open Questions
- List ambiguities, gaps and contradictions, each with a link to the source doc and section.
- Prefix each with a label: `[doc gap]` (not specified), `[doc vs doc]` (two docs disagree), `[doc vs code]` (only if code was actually read).
- If code was not checked, do not claim code contradictions.

## Before saving

Check and fix:
1. Size limits for the chosen scope are respected.
2. Every risk cites a concrete rule, field, selector or transition.
3. Every mitigation is executable as written.
4. Every `TBD` is a fact genuinely absent from the docs; nothing was copied from the reference without confirmation.
5. Column names and section order match the reference.
6. No mention of Claude or the generation process.

## Final message to the user

3–6 lines in the user's language: file path, scope (single spec or whole app), number of risks and open questions, the 2–3 most important open questions, and which header fields are TBD. Make sure it matches the saved file.

## Reference

See `references/TP007-skypermit.md` for the expected layout and level of detail.