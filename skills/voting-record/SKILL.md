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
jurisdiction filter.** A common surname matches legislators nationwide, and the search result
alone cannot separate them. To narrow: call `get_person` on each candidate and read role and
district out of the `legiscan` object, or call `get_person_votes` on each and see which one has
votes in the jurisdiction the request implies.

A `default_division` in `.claude/cicada-guide.local.md` is the jurisdiction to test candidates
against when the request names none — see **Project settings** in
`${CLAUDE_PLUGIN_ROOT}/skills/state-legislation/SKILL.md`. It narrows the candidate list; it does
not on its own confirm an identification.

**Before treating two candidates as two people, compare `legiscan.people_id` from `get_person`.**
Identical ids mean one legislator stored on several rows — collapse them and do not ask the user to
choose. Do not assume a split, though: most names resolve to a single row.

When rows genuinely do duplicate, the votes may be spread across them rather than sitting on one.
Call `get_person_votes` on each sibling and union the results, and say the record was assembled that
way. Using a single row would either report a sitting legislator as having no voting history, or
silently return part of one. Union the records; never add counts across siblings.

When candidates have genuinely different `legiscan.people_id` values and both remain plausible, list
them with party and whatever jurisdiction evidence was found, and ask. Never pick one silently —
attributing a vote to the wrong person is the worst failure this skill can produce.

### 2. Pull the record

Use `get_person_votes`, not `get_votes`. It returns bill number, title, status, session, rollcall
date, description, outcome, chamber, and source URL already joined.

- Latest vote only → `latest: true`.
- A session → `session_id` from `list_sessions`.
- A period → `start_date` and `end_date` as `YYYY-MM-DD`.
- Only one side → `category` of `YEA`, `NAY`, `ABSENT`, or `NV`.

Page with `cursor`. There is no `offset`.

Call `get_person` when the request also asks for contact details or biography.

### 3. Report

Lead with the identification — full name, party, jurisdiction — so the reader can confirm it is
the right person. Then the votes in reverse chronological order: date, bill number, bill title,
the legislator's category, and whether the measure passed.

After identification is resolved, use `show_person_record` when the user asks to see, open, or
explore the record visually. Pass the selected person UUID; the workspace loads the enriched
history through `get_person_votes` and keeps `ABSENT` and `NV` separate from yes/no positions.

For a pattern question ("does she usually vote with her party"), state the sample size and the
window covered before drawing any characterization, and keep it descriptive. `ABSENT` and `NV` are
not positions — count them separately and do not fold them into a yes/no tally.

## Path B — one roll call across the chamber

1. `search_bills` → the bill, then `get_rollcalls` with its `bill_id`.
2. Deduplicate the rows on the (date, chamber, description, tallies) tuple — **not** on
   `legiscan.roll_call_id`, which differs between duplicates. Texas SB8 returns 21 rows for 19 floor
   votes that way. Pick the roll call the user means; when several remain, name them by date and
   description and confirm.
3. `get_votes` with one `rollcall_id` from that tuple and `limit: 100`. Report from that single row —
   siblings often each carry a full copy of the votes, so querying several and combining them
   double-counts the chamber. On `No votes found`, try the tuple's other `id`s and stop at the first
   that returns records. Page with `cursor` until `has_more` is false — a partial page gives a wrong
   breakdown.
4. Collect every `people_id` and resolve in batches of up to 100 through `search_people` `ids`.
   Check `unresolved_ids` and account for anyone listed.
5. Join party from step 4 to category from step 3 for the breakdown.

Markdown output truncates at 25,000 characters with a pagination hint appended. A truncated page
is not a complete page — keep paging rather than tallying what arrived, and prefer
`response_format: "json"` so the structured envelope carries the full page.

When no `id` in the tuple returns votes, the individual rows are genuinely absent for that
jurisdiction — Georgia HB327's House vote reports 180 recorded votes and returns none. Report the
aggregate outcome and say the member-by-member breakdown is unavailable. Do not present it as nobody
having voted.

Report the aggregate totals from `get_rollcalls` alongside the computed breakdown. When the two
disagree, say so rather than picking one — the discrepancy is itself the finding.

## Constraints

- Never generalize from a single vote. One `NAY` is one vote, not a position on an issue.
- Report the coverage window. Absence of a vote in the dataset is not evidence the legislator did
  not vote; roll calls may be missing.
- Do not score, grade, or rate a legislator, and do not compare them to an ideological baseline.
  Report what was voted and when.
- Attribute every claim to the bill and roll call it came from, with the source URL when present.
- Do not infer party discipline, motive, or future behavior from the record.
