# TC-<AREA>-<NNN>: <Condition that violates the rule> fails <GATE> gate

<!-- Shape example of a finished gate case. Every concrete value is described, not given, so cases do not copy each other's data. Take real values from the spec in Doc ref. -->

| Field | Value |
|---|---|
| **ID** | TC-<AREA>-<NNN> |
| **Doc ref** | `<rules doc>` §<sections>, as corrected by `<clarifications doc>` item <n> if it applies; rule `<rule_reference>` |
| **Priority** | <High for gates and rule_reference> |
| **Level** | <API: expected result is a status code and body> |

## Preconditions

1. <An operator who owns everything below is registered and logged in.>
2. <A pilot of that operator whose rating and certification pass the PILOT gate, so the pipeline reaches the gate under test.>
3. <An aircraft of that operator whose attribute sits exactly one unit past the boundary of the rule under test.>
4. <A flight request of that operator in the state the endpoint needs, using the pilot, aircraft and the test data below.>
5. <A note on any precondition that does not matter, with the reason: for example a later gate that is never reached because this one stops the pipeline.>

## Test data

| Item | Value |
|---|---|
| <Zone> | <a zone from the seed data whose class, bands and ceiling make only this rule fail; name the one chosen and its relevant attributes> |
| <Attribute under test> | <the boundary value or one unit past it, with the derived result it causes> |
| <Time fields> | <relative to execution, with UTC or zone-local stated, outside any curfew> |
| <Other required field> | <a neutral value that passes every other rule> |

## Steps

1. <Method and path of the single action under test, with whose session it uses.>

## Expected result

1. <Step 1 returns the status code with `failing_gate` = the gate and `rule_reference` = the rule's citation from the rules doc.>
