# Test Plan #TP007

| | | |
|---|---|---|
| **Project:** skypermit | **Site:** https://skypermit.vercel.app/ | **Owner:** IraVol |
| **Release:** ReleaseVersion 3.15 | **Sprint:** 7 | **Sources:** `../skypermit/docs/` (data model, state machine, business rules, frontend spec) |

## Introduction

Shows the basic approaches to testing the web application Skypermit.
Additional info about the site: https://skypermit.vercel.app/

## Goals

1. UI testing of the main user flows per role.
2. Create test documentation: Checklist and Test Report according to the UI testing.

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Invalid or missing state transitions (state machine) | M | H | Cover every allowed and forbidden transition |
| 2 | Business rules differ between docs and code | M | H | Record in Open Questions, confirm before testing |
| 3 | Issues with definition of right requirements | M | M | Review specs with the owner before testing |
| 4 | Time issue | M | M | Prioritise by risk, cut low-risk checks first |
| 5 | Network / environment issues | L | M | Retest on failure, note the environment in the report |

## In Scope

- UI testing (https://skypermit.vercel.app/)
- ...

## Out of Scope

Performance, API, Security, Load testing

## Test Strategy

| Area | Approach | Reason |
|---|---|---|
| Main user flows per role | Manual | Specs still changing, exploratory value |
| State transitions | Manual, automation candidate | Stable rules, many repeated combinations |
| Form validation | Automation candidate | Repetitive data-driven checks |
| Visual layout, UX | Manual | Needs human judgement |

## Entry Criteria

1. Requirements and test goals are clear for testers.
2. All test environments and test tools are ready and can be used.
3. Test data and test documentation are available and can be used.
4. Checklist is ready and can be used.

## Environments

- OS: Microsoft Windows 7+
- Browser: Chrome (latest version), FF (latest version)

## Exit Criteria

1. Test time was finished.
2. More than 85% of all test scenarios from Checklist were passed.
3. No open Critical or High defects.
4. Test Report is ready and can be provided to stakeholders.

## Tools

- SVC: GitHub
- Test documentation: Markdown in this repo (`test-cases/`, `test-plans/`)

## Schedule and Estimations

**Start date:** 25.05.23 | **End date:** 03.06.23

1. Analysis and investigation of all testing scope: 2 days
2. Create Test Documentation (Test Plan and Checklist): 2 days
3. Testing: 2 days
4. Create Test Report and provide full information about testing: 1 day

## People

- QA Engineer: Olena Olena

## Open Questions

1. <Ambiguity in the docs, or a doc vs. code contradiction, with a link to the source>
2. <Anything marked TBD above that needs an owner's answer>
