---
name: cover-gaps
description: Find skypermit business rules (rule_reference values from ../skypermit/docs/06-business-rules.md) that have no test case in test-cases/, write one case per rule with the test-case-creator skill, verify each with the tc-verifier subagent, and return a JSON summary. Run manually as /cover-gaps. Arguments - max number of rules and gate (PILOT, AIRCRAFT, ZONE, TIME_WINDOW, REGISTRATION or ALL).
argument-hint: "[max-rules] [gate]"
disable-model-invocation: true # expensive pipeline: manual /cover-gaps only
allowed-tools: Read Grep Glob Write(test-cases/**) Write(reports/**) Edit(test-cases/open-questions.md) Bash(node scripts/uncovered-rules.mjs *) Bash(rm test-cases/*) Skill(test-case-creator) Agent(tc-verifier)
---

# Cover gaps

Close the gap between the business rules and `test-cases/`: find uncovered rules, write a case for each, verify each case against the specs, and keep only what the specs support.

Why the verification step exists: cases are generated from the same docs a reviewer would check, so a wrong value in a case is easy to miss. A separate read-only agent compares the case with the source and catches it before it enters the suite.

## Who does each step, and with which model

| Step | Performed by | Model |
|---|---|---|
| 1. List the gaps | `scripts/uncovered-rules.mjs` | none (plain comparison of two lists, no model) |
| 2. Write a case | `test-case-creator` skill | `sonnet` (set in its frontmatter): accuracy against the specs matters more than depth |
| 3. Verify a case | `tc-verifier` subagent | `haiku` (set in its frontmatter): comparing a case with the spec is a lookup task. This is the starting choice; whether Haiku is enough must be checked on a deliberately corrupted case (it should return "does not match"). If it misses, move the verifier up to `sonnet` |
| 4. Verdict handling and JSON | this session | the session's own model |

Steps 2 and 3 run as a loop, one rule at a time: write a case, verify it, then the next rule. The quality check sits after every written case, not once at the end (see "Steps 2–3"). Pass `model: "haiku"` explicitly on each Agent call in step 3 as well, so the choice does not depend on the agent file being picked up.

## Arguments

Parse from the user's message or `$ARGUMENTS`:

| Argument | Meaning | Default |
|---|---|---|
| `max-rules` (number) | most rules to process in this run | 5 |
| `gate` (word) | `PILOT`, `AIRCRAFT`, `ZONE`, `TIME_WINDOW`, `REGISTRATION` (the `OH-1 §3` weight ceiling, which is not a gate) or `ALL` | `ALL` |

If the user gives them in words ("три правила по ZONE"), map them to these. Do not ask for missing ones; use the defaults.

## Step 1: List the gaps

The list is injected before you start reasoning, so you do not need to read the docs to find it:

!`node scripts/uncovered-rules.mjs $ARGUMENTS`

`$ARGUMENTS` goes to the script as is: `/cover-gaps 3 TIME_WINDOW` (positional, any order, case-insensitive); the old `--max N --gate X` flags also work. With no arguments the script uses `ALL` and 5. If the output above is an `error`: when the user gave free-form words ("три правила по ZONE"), map them to `<max-rules> <gate>` and run `node scripts/uncovered-rules.mjs <max-rules> <gate>` once from the repo root with Bash; otherwise show the error to the user and stop, do not guess.

The JSON has: `gaps_by_gate` (the rules to process, already limited by `--max`), `skipped_by_max`, and `warnings`. A rule counts as covered when a file in `test-cases/` mentions both its `rule_reference` and its gate, because `ZC-2026.1 §2` is shared by `AIRCRAFT` and `ZONE`. The script applies `07-clarifications.md` over `06-business-rules.md`.

If `returned` is 0, report that nothing is uncovered for this filter and stop with the summary. Show any `warnings` to the user. A rule with `citation_confirmed: false` is still processed; the case must say the citation is unconfirmed (Open question line).

## Steps 2–3: For each rule, write a case and verify it before the next rule

Process rules in the order the script returned them, **one rule at a time**, as a loop:

```
for each rule:
  Step 2: write the case (test-case-creator)
  Step 3: verify that case (tc-verifier) and act on the verdict
  only then move to the next rule
```

Why one at a time: the gate sits after every case, so a bad case is dropped before the next one is written, and the next case is not built next to a wrong one. It also keeps IDs safe: `test-case-creator` picks the next free ID by looking at the folder, so parallel writes would collide. Never write several cases first and verify them together at the end, and never launch several `tc-verifier` calls in one message.

### Step 2: Write the case

Invoke the `test-case-creator` skill (Skill tool) with a request like:

> Rule: gate `<gate>`, `rule_reference` `<ref>`, condition "<condition>" (`06-business-rules.md` §6). Write the negative case that violates this rule and expects `422` with this `failing_gate` and `rule_reference`. Batch mode.

Notes:
- Gate cases go to `test-cases/gates/`. `REGISTRATION` goes to `registry`, and its Expected result is a registration `422`, not a gate response (the skill's area table decides).
- "Batch mode" switches on the skill's Batch mode section: it asks no questions, keeps undefined values as `TBD` with an Open question line, and ends with exactly one line.
- Read that line. `CREATED: <path>` gives the new file for Step 3. `SKIPPED: <reason>` means no case was written: record the rule as `skipped` with that reason, skip Step 3 for it and move to the next rule.
- Remember the paths of the files created in this run. Only these may be deleted in Step 3.

### Step 3: Verify this case

Right after Step 2, launch one `tc-verifier` subagent for the case just written (Agent tool, `subagent_type: "tc-verifier"`, `model: "haiku"`, prompt = the case path). Wait for its verdict before moving to the next rule.

Act on the **Overall** line of the verdict:

| Verdict | Action |
|---|---|
| matches | Keep. |
| does not match | Delete the file (only if created in this run), so it does not stay in `test-cases/`. Record the mismatch. The rule stays uncovered for the next run. |
| docs silent | Keep the file. Add each gap to `test-cases/open-questions.md`. |
| partial | Keep the file and mark `needs_review`. Add any listed gaps to `test-cases/open-questions.md`. |

Do not edit a case to make it pass; the verifier only reports, and silently fixing would hide the spec problem. If the verifier lists a docs-vs-code conflict, add it to the open questions too.

Then go back to Step 2 with the next rule. When all rules are done, go to Step 4.

**Do not end your turn inside the loop.** The `CREATED:`/`SKIPPED:` line from `test-case-creator` and the verifier's verdict are intermediate results, not the end of the run. Keep going in the same turn until Step 4 has printed the JSON summary; the run is finished only then. If a tool call or the verifier fails, record it in `results` (`verdict: "skipped"`, `reason` = what failed) and continue with the next rule.

### `test-cases/open-questions.md`

`../skypermit/docs/` is read-only, so our open questions live here. Create on first use:

```markdown
# Open questions

Gaps found while verifying test cases. Canonical spec status is in `../skypermit/docs/05-open-questions.md`.

| # | Case | Question | Where checked | Date |
|---|---|---|---|---|
```

Append one row per gap (next number, case ID, what is undefined, files looked at, today's date). Do not add a row that duplicates an existing question; add the case ID to that row instead.

## Step 4: Return the JSON summary

Print the JSON as the last thing in your reply, and also save it to `reports/cover-gaps-<YYYY-MM-DD-HHmm>.json` (create `reports/` if needed). Fields:

```json
{
  "rules_checked": 13,
  "gaps_found": 5,
  "results": [
    { "rule_reference": "<from 06-business-rules.md>", "gate": "TIME_WINDOW", "case_id": "TC-GATE-001", "verdict": "matches", "kept": true, "needs_review": false, "reason": null }
  ],
  "open_questions": [ { "case_id": "TC-GATE-002", "question": "..." } ]
}
```

This is the contract; do not add or rename top-level keys.

- `rules_checked`: `total_rules` from the script (all rules in `06` §6, not only the filtered ones).
- `gaps_found`: `uncovered_matching_filter` (gaps for this gate filter, before `--max`). If it is larger than `results.length`, the rest were cut by `--max`.
- `results`: one entry per processed rule. `verdict` is the verifier's Overall (`matches`, `partial`, `docs silent`, `does not match`) or `skipped` when no case was written (then `case_id` is `null`). `kept` is `false` for a deleted case (`case_id` still names it), and `reason` then says what the case claimed vs. what the spec says; for `skipped` it says why.
- `open_questions`: every row added to `test-cases/open-questions.md` in this run.

Add one or two lines before the JSON in the user's language: how many cases were kept, removed, and how many questions were added.

## Boundaries

- Never write, edit or delete anything in `../skypermit`.
- Delete only case files created in this run; never touch earlier cases, `confirmed-facts.md` or `open-questions.md` (except appending).
- One case per rule is the goal of this skill, not full coverage of a rule's boundaries; mention in the summary line if a rule clearly needs more (for example both sides of a boundary).