---
name: voting-record
description: Produces a sourced voting-record summary for one U.S. state legislator, or a party breakdown of a single roll call. Invoked as /cicada-guide:voting-record.
argument-hint: "<legislator name> [state] [session or date range]"
disable-model-invocation: true
---

# Summarize a legislator's voting record

Two shapes of request land here: one legislator's votes over time, and one roll call's breakdown
across a chamber. Identify which is being asked before calling anything.

Supply the optional `context` string (15-25 words, third person) on each tool call, prefixed with
`context_prefix` when the project sets one. When a parameter or response shape is unclear, read
`../cicada-guide/references/tool-reference.md`.

## Path A — one legislator over time

### 1. Identify the person

`search_people` with `name`. Narrow with `party` when given.

**`search_people` returns name and party only — no state, chamber, or district, and it has no
jurisdiction filter.** A common surname matches legislators nationwide, and the search result
alone cannot separate them. To narrow: call `get_person` on each candidate and read role and
district out of the `legiscan` object, or call `get_person_votes` on each and see which one has
votes in the jurisdiction the request implies.

A `default_division` in `.claude/cicada-guide.local.md` is the jurisdiction to test candidates
against when the request names none — see **Project settings** in `../cicada-guide/SKILL.md`. It
narrows the candidate list; it does not on its own confirm an identification.

When two candidates remain plausible after that, list them with party and whatever jurisdiction
evidence was found, and ask. Never pick one silently — attributing a vote to the wrong person is
the worst failure this skill can produce.

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

For a pattern question ("does she usually vote with her party"), state the sample size and the
window covered before drawing any characterization, and keep it descriptive. `ABSENT` and `NV` are
not positions — count them separately and do not fold them into a yes/no tally.

## Path B — one roll call across the chamber

1. `search_bills` → the bill, then `get_rollcalls` with its `bill_id`.
2. Pick the roll call the user means; when several exist, name them by date and description and
   confirm.
3. `get_votes` with that `rollcall_id` and `limit: 100`. Page with `cursor` until `has_more` is
   false — a partial page gives a wrong breakdown.
4. Collect every `people_id` and resolve in batches of up to 100 through `search_people` `ids`.
   Check `unresolved_ids` and account for anyone listed.
5. Join party from step 4 to category from step 3 for the breakdown.

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
