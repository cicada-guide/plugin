---
name: voting-record
description: Produces a sourced voting-record summary for one U.S. state legislator, or a party breakdown of a single roll call.
argument-hint: "<legislator name> [state] [session or date range]"
disable-model-invocation: false
---

# Summarize a legislator's voting record

Two shapes of request land here: one legislator's votes over time, and one roll call's breakdown
across a chamber. Identify which is being asked before calling anything.

Supply the `context` string (15-25 words, third person) on each tool call, prefixed with
`context_prefix` when the project sets one. When a parameter or response shape is unclear, read
`${CLAUDE_PLUGIN_ROOT}/skills/state-legislation/references/tool-reference.md`.

## Path A — one legislator over time

### 1. Identify the person

`search_people` with `name`. Narrow with `party` when given.

**`search_people` returns name and party only — no state, chamber, or district, and it has no
jurisdiction filter.** `get_person` adds nothing on this front. A common surname matches legislators
nationwide, and neither result can separate them. To narrow: call `get_person_votes` on each
candidate and check whether `bill.division_id` on the returned items is the jurisdiction the request
implies (resolve it with `list_states`). No tool returns chamber or district — do not state either.

A `default_division` in `.claude/cicada-guide.local.md` is the jurisdiction to test candidates
against when the request names none — see **Project settings** in
`${CLAUDE_PLUGIN_ROOT}/skills/state-legislation/SKILL.md`. It narrows the candidate list; it does
not on its own confirm an identification.

**Two rows with the same name may be one legislator stored twice.** There is no source id to
compare, so decide from vote history. If both rows voted on the same roll call, they are two
people. If they share full name, party, and `bill.division_id` and never share a roll call, treat
them as one legislator: union their `get_person_votes` records and say the record was assembled that
way. Using a single row would either report a sitting legislator as having no voting history, or
silently return part of one. Union the records; never add counts across siblings. Do not assume a
split, though: most names resolve to a single row.

When candidates remain plausibly different people, list them with party and whatever jurisdiction
evidence was found, and ask. Never pick one silently — attributing a vote to the wrong person is the
worst failure this skill can produce.

### 2. Pull the record

Use `get_person_votes`, not `get_votes`. Each item nests `vote.category`, `rollcall` (date,
description, and `outcome` — the roll call's recorded tallies, not pass/fail), and `bill` (number,
title, status, `session_id`, `division_id`, `source_url`). `bill` is `null` for procedural roll
calls attached to no bill; report those by description and date. Resolve `session_id` and
`division_id` to names with `list_sessions` and `list_states` when the report needs them.

- Latest vote only → a small `limit` such as 10, then every item on the newest `rollcall.date`.
  `latest: true` returns just one of them.
- A session → `session_id` from `list_sessions`.
- A period → `start_date` and `end_date` as `YYYY-MM-DD`.
- Only one side → `category` of `YEA`, `NAY`, `ABSENT`, or `NV`.

Page with `cursor`. There is no `offset`.

For a latest-vote request, confirm jurisdiction before attributing the result, even when the name
search has only one candidate. Do not rely on `latest: true` alone: within one date the tool sorts
by UUID, so it returns an arbitrary one of that day's votes. Fetch with a `limit`, and compare
roll-call dates across confirmed duplicate person rows; UUID order is not chronology. If dates tie
and no description establishes the order, report the tied records rather than claiming one occurred
last. Call it the latest recorded vote in the available data, and state any session, date, or
category filter that limits that claim.

Call `get_person` only when the request also asks for contact details; it returns no biography,
role, or jurisdiction.

### 3. Report

Lead with the identification — full name, party, jurisdiction — so the reader can confirm it is
the right person. Then the votes in reverse chronological order: date, bill number, bill title,
the legislator's category, and the roll-call tallies. Say the measure passed or failed only when
the roll-call description or bill status says so — the tools return no pass/fail field.

For a pattern question ("does she usually vote with her party"), state the sample size and the
window covered before drawing any characterization, and keep it descriptive. `ABSENT` and `NV` are
not positions — count them separately and do not fold them into a yes/no tally.

## Path B — one roll call across the chamber

1. `search_bills` → the bill, then `get_rollcalls` with its `bill_id`. When that is empty, call
   `get_votes` with `bill_id` — some roll calls are stored without their bill link — and describe
   each distinct `rollcall_id` with `get_rollcall_breakdown`.
2. Treat a shared (date, description, counts) tuple as a duplicate signal, not a unique key.
   Corroborate it with identical fully paginated member votes before collapsing rows; otherwise
   retain each row and label the possible duplication. Pick the roll call the user means, and when
   several remain, name them by date and description and confirm.
3. `get_votes` with the chosen `rollcall_id` and `limit: 100`, paging with `cursor` until
   `has_more` is false. For a corroborated duplicate group, use one row; never add counts across
   siblings.
4. Collect every `people_id` and resolve in batches of up to 100 through `search_people` `ids`.
   Check `unresolved_ids` and account for anyone listed.
5. Join party from step 4 to category from step 3 for the breakdown.

Markdown output truncates at 25,000 characters with a pagination hint appended. A truncated page
is not a complete page — keep paging rather than tallying what arrived, and prefer
`response_format: "json"` so the structured envelope carries the full page.

A roll call with `counts: null` has no recorded member votes. When no row in its duplicate group
has votes either, say the member-by-member breakdown is unavailable in this dataset. Do not present
it as nobody having voted.

Report the `counts` from `get_rollcalls` alongside the computed breakdown. They are tallied from the
same vote rows, so a disagreement means a page was missed or truncated — re-page before reporting,
and say so if it persists.

## Constraints

- Never generalize from a single vote. One `NAY` is one vote, not a position on an issue.
- Report the coverage window. Absence of a vote in the dataset is not evidence the legislator did
  not vote; roll calls may be missing.
- Do not score, grade, or rate a legislator, and do not compare them to an ideological baseline.
  Report what was voted and when.
- Attribute every claim to the bill and roll call it came from, with the source URL when present.
- Do not infer party discipline, motive, or future behavior from the record.
