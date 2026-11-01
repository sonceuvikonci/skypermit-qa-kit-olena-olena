---
name: jira-intake
description: Read ONE Jira issue by key and return a normalized JSON intake record - key, title, check_type, acceptance_criteria, confluence_url, notes. check_type comes only from the issue's labels (ui / api), never guessed from the title or text; confluence_url is only a real link, never a textual mention. Use when the user gives a Jira issue key (e.g. SKY-1) and wants the task "taken in", parsed, normalized or turned into structured input for the next step (ui-test-case-creator, story-doc-check, test-plan), or asks "what are the AC / check type / doc link of this ticket". Do NOT use for several issues at once (an epic, a sprint, a JQL list - run it once per key), to check the story against the docs (story-doc-check), to generate test cases (ui-test-case-creator) or test plans (test-plan), to read Confluence pages, or to create, edit, comment on or transition anything in Jira. Read-only in Jira; the only write is the local file intake/<KEY>.json in this repo.
argument-hint: "<issue key, e.g. SKY-1>"
allowed-tools: mcp__atlassian__getJiraIssue, mcp__atlassian__getJiraIssueRemoteIssueLinks, Write
---

# Jira intake

Input: **one** Jira issue key. Output: **one JSON object**, saved to `intake/<KEY>.json` in this repo and shown in the reply.

If the user gives several keys, an epic or a JQL query, do not batch: ask which single issue to take in first (or offer to run the skill once per key).

## Rules

- **Read-only in Jira.** Only read from Jira. Never create, edit, comment, transition, link or log work. Do not touch Confluence at all (not even to open the link found).
- **The only write is `intake/<KEY>.json`** in this repo (path relative to the repo root, `<KEY>` = the issue key exactly as in Jira, e.g. `intake/SKY-1.json`). Write nowhere else, and never in `../skypermit`. An existing file with the same key is overwritten (git keeps the history). Do not save anything if Jira failed or the key does not exist.
- **Report only what is in the issue.** No guessing, no filling gaps from your own knowledge, the code, or local files.
- If Jira is unreachable or the key does not exist, say so and stop. Do not invent a record.
- **`check_type` only from labels**:
  - label `ui` only → `"ui"`
  - label `api` only → `"api"`
  - both labels, or neither → `null`, and `notes` explains why (e.g. "обидві мітки: ui, api" / "немає міток ui/api; наявні мітки: ...").
  - Never infer it from the title, description, AC wording, issue type, or component. Compare labels case-insensitively, exact match (`ui`, `api`); other labels (e.g. `ui-bug`) do not count, but may be listed in notes.
- **`confluence_url` only a real link**: a URL (`https://…/wiki/…`) found in the description, in the issue's remote links (`getJiraIssueRemoteIssueLinks`), or a Confluence smart link/hyperlink in the text. A textual mention without a link («Confluence → простір SkyPermit → сторінка 06») is **not** a link: `confluence_url` is `null` and the quote goes to `notes`. If there are several real Confluence links, put the first one (description order, then remote links) in `confluence_url` and list the rest in `notes`. Do not build a URL from a page title or id yourself.

## Steps

1. **Read the issue** with `getJiraIssue` (site `olena-seletska.atlassian.net`, cloudId `c9a6e720-6440-4213-9958-60d9811da7d6`, `responseContentFormat: markdown`, fields at least summary, labels, description). Take `key` and `title` (= summary) as is.
2. **check_type**: apply the label rule above.
3. **acceptance_criteria**: take the "Acceptance criteria" section of the description, one array item per criterion, in order, wording verbatim (strip only list markers/numbering). Do not merge, split, rephrase or add criteria. If the section is absent or empty: `[]` and say so in `notes`.
4. **confluence_url**: look in the description first, then call `getJiraIssueRemoteIssueLinks` and take links whose URL points to Confluence (`atlassian.net/wiki`). Apply the real-link rule above.
5. **notes**: a list of short strings (Ukrainian for Ukrainian issues) for everything that did not fit cleanly: why `check_type` is null, quoted textual doc mentions without a link, missing AC section, extra Confluence links, other labels worth knowing, hints the issue itself gives (e.g. "Правило"/"Вимоги" sections - quote, do not interpret). Empty list `[]` if nothing.
6. **Save** the JSON (exactly the object from Output, pretty-printed with 2 spaces, UTF-8, trailing newline) to `intake/<KEY>.json` with `Write`. Create the folder if it does not exist.

## Output

The same JSON in a single fenced `json` block, then one line with the saved path (e.g. `Збережено: intake/SKY-1.json`). No further commentary unless something failed:

```json
{
  "key": "SKY-1",
  "title": "<summary>",
  "check_type": "ui | api | null",
  "acceptance_criteria": ["<AC 1>", "<AC 2>"],
  "confluence_url": "https://… | null",
  "notes": ["<note>"]
}
```

- Valid JSON: double quotes, `null` (not the string "null"), no comments, no trailing commas. `check_type` is the string `"ui"`, the string `"api"`, or `null`.
- `notes` is always an array of strings; `acceptance_criteria` is always an array of strings.
