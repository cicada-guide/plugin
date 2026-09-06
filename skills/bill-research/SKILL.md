---
name: bill-research
description: Produces a sourced brief on one U.S. state bill — identification, status, sponsors, bill text, roll calls, and how members voted.
argument-hint: "<bill number or topic> [state] [year]"
disable-model-invocation: false
---

# Research one state bill

Produce a sourced brief on a single U.S. state bill. Arguments name a bill number or topic, and
optionally a state and year.

Supply the `context` string (15-25 words, third person) on each tool call, prefixed with
`context_prefix` when the project sets one. When a parameter or response shape is unclear, read
`${CLAUDE_PLUGIN_ROOT}/skills/state-legislation/references/tool-reference.md`.

## 1. Identify the bill

Resolve the jurisdiction first when a state is named or implied — `list_states` gives a
`division_id`, and `list_sessions` narrows further when a year is given. Bill numbers repeat
across states and sessions, so an unscoped search is ambiguous.

When the request names no state, check `.claude/cicada-guide.local.md` for a `default_division`
and scope to it — see **Project settings** in
`${CLAUDE_PLUGIN_ROOT}/skills/state-legislation/SKILL.md`. Note in the brief that the jurisdiction
came from the project default rather than from the request.

Then search:

- A bill number → `search_bills` with `bill` plus `division_id`.
- A topic → `search_bills` with `query` plus `division_id`. Full-text resolves at most 50
  distinct bills and uses only the first 8 terms, silently — a thin result is not proof the topic
  is unlegislated. Narrow by `subject` or `session_id` and say which query ran.

Bill-number matching carries an interior wildcard, so `HB 314` matches `HB 3140` and also `HB 5314`,
`HB 1314`. Read the `bill` field on every candidate. For a numbered-bill lookup, page with
`next_offset` while `has_more` is true until the normalized exact bill number is found or every
page is exhausted — results order by date descending, so an exact match may not be on page one.

Stop and ask when the search returns several plausible bills and nothing in the request
distinguishes them. List the candidates with number, title, session, and status rather than
picking one silently. Proceed without asking only when one result clearly matches.

If nothing matches, say so and suggest a broader query — do not pad the brief with an adjacent
bill.

## 2. Gather

Call in this order, skipping what the request does not need:

1. `get_bill` — full record: status, dates, subjects, sponsors, session.
2. `search_people` with `ids` set to the `sponsors` array — one call, not a loop. Skip this when
   `sponsors` is null or empty; `ids` requires at least one entry and rejects an empty array.
3. `get_latest_bill_document` — the operative text. Check `text_source`; a `null` means the text
   is unavailable, not empty. For a large PDF, stream it with `read_pdf_bytes` — see the streaming
   sequence in `${CLAUDE_PLUGIN_ROOT}/skills/state-legislation/references/workflows.md`. The next
   offset there is `offset + byteCount`, not `byteCount`.
4. `get_rollcalls` — floor votes, with yea/nay/absent totals inside `legiscan`.
5. `get_votes` — only when the request asks who voted how. Treat matching (date, chamber,
   description, tallies) values as a duplicate signal, not proof: corroborate with source metadata
   or identical fully paginated member votes before collapsing rows. Distinct or unverified rows
   remain separate and are labeled as possible duplicates. For a corroborated group, page each
   candidate with `cursor` and choose a single row only when its category totals reconcile with the
   aggregate roll-call tallies. Never add sibling counts. If no row reconciles, report the
   discrepancy and do not present a complete member breakdown. Resolve `people_id` values through
   `search_people` `ids` **in batches of up to 100** and check every batch's `unresolved_ids`.

## 3. Write the brief

Structure:

- **Identification** — bill number, state, session, title, current status with its date.
- **What it does** — 2-4 sentences grounded in the bill text or synopsis. Quote sparingly and
  attribute; do not paraphrase a provision that was not read.
- **Sponsors** — names and party from the resolved batch.
- **Legislative history** — roll calls in date order with outcome and vote totals.
- **How members voted** — only when asked. Give the party breakdown, then notable individual
  votes.
- **Sources** — document URLs from `get_documents` or `get_latest_bill_document`.

Close with what the data does not cover: absent roll calls, missing document text, or a status
that may have advanced since the last data load. State these plainly rather than implying the
brief is exhaustive.

Offer `show_bill` at the end when the host renders cards and the user may want to look at the bill
directly.

## Constraints

- Report only what the tools returned. Do not supplement from background knowledge about the bill,
  and never infer a provision from the title.
- Distinguish a bill's own text from a summary field. `synopsis` and `headline` are secondary
  descriptions, not statutory language.
- A truncated response (25,000 characters) is not the whole document — paginate or say what was
  cut.
- Do not characterize the bill's politics or predict its passage. Report status and votes.
