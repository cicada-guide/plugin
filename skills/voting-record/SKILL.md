---
name: voting-record
description: Produces a sourced voting-record summary for one U.S. state legislator, or a party breakdown of a single roll call. This skill should be used when the user asks how a named state legislator voted ("how did Senator Reynolds vote on HB 314", "what was her latest vote") or how one roll call split by party ("break down the final passage vote by party").
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

**Same-name rows are different people.** Matching name, party, and state fits two legislators in
different chambers or years. Never combine their records. List the candidates with party, state,
and the date range of their recorded votes, and ask which one the user means.

Never pick one candidate silently — attributing a vote to the wrong person is the worst failure this
skill can produce.

### 2. Pull the record

Use `get_person_votes`, not `get_votes`. Each item nests `vote.category`, `rollcall` (date,
description, and `outcome` — the roll call's recorded tallies, not pass/fail), and `bill` (number,
title, status, `session_id`, `division_id`, `source_url`). `bill` is `null` for procedural roll
calls attached to no bill; report those by description and date. Resolve `session_id` and
`division_id` to names with `list_sessions` and `list_states` when the report needs them.

- Latest vote only → a page of about 10, then keep paging with `cursor` while `has_more` is true
  and the page's last item still carries the newest `rollcall.date`. Report every item on that
  date. `latest: true` returns just one of them.
- A session → `session_id` from `list_sessions`.
- A period → `start_date` and `end_date` as `YYYY-MM-DD`.
- Only one side → `category` of `YEA`, `NAY`, `ABSENT`, or `NV`.

Page with `cursor`. There is no `offset`.

For a latest-vote request, confirm jurisdiction before attributing the result, even when the name
search has only one candidate. Do not rely on `latest: true` alone: within one date the tool sorts
by UUID, so it returns an arbitrary one of that day's votes. Page through the whole newest date as
above; UUID order is not chronology. If dates tie and no description establishes the order, report
the tied records rather than claiming one occurred last. Call it the latest recorded vote in the
available data, and state any session, date, or category filter that limits that claim.

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

1. `search_bills` → the bill, then `get_rollcalls` with its `bill_id`. It can omit roll calls
   stored without their bill link, whether it returns rows or none. When the roll call the user
   means is not there, page `get_votes` with `bill_id` to the end with `cursor`, collect the
   distinct `rollcall_id` values, and describe the extra ones with `get_rollcall_breakdown`.
2. Pick the roll call the user means. When several remain, name them by date and description and
   confirm.
3. `get_votes` with the chosen `rollcall_id` and `limit: 100`, paging with `cursor` until
   `has_more` is false.
4. Collect every `people_id` and resolve in batches of up to 100 through `search_people` `ids`.
   Check `unresolved_ids` and account for anyone listed.
5. Join party from step 4 to category from step 3 for the breakdown.

Markdown output truncates at 25,000 characters with a pagination hint appended. A truncated page
is not a complete page — keep paging rather than tallying what arrived, and prefer
`response_format: "json"` so the structured envelope carries the full page.

A roll call with `counts: null` has no recorded member votes. Say the member-by-member breakdown
is unavailable in this dataset. Do not present it as nobody having voted.

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
