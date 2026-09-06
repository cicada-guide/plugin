---
name: state-legislation
description: This skill should be used for questions about U.S. STATE legislation — finding or reading a state bill ("look up HB 314", "what bills mention school funding", "what does this bill do", "what's the status of this bill"), state legislators ("who sponsored this bill", "find my state representative", "what party is she"), or roll calls and voting records ("how did Senator X vote", "show me the roll call", "how did the chamber split", "list Alabama's legislative sessions"). Not for the U.S. Congress or federal bills, city or county ordinances, ballot measures, regulations, or non-U.S. legislatures — the dataset covers state legislatures only.
---

# Researching U.S. state legislation with cicada-guide

The cicada-guide MCP server exposes read-only tools over U.S. **state** legislative data: bills,
bill documents, legislators, legislative sessions, roll calls, and individual votes. Tool names
below are bare (`search_bills`); the host prefixes them with its own MCP namespace.

The tools only retrieve data and cannot change anything. Their descriptors nonetheless carry
`readOnlyHint: false`, because every call emits an analytics event — so a host may still show an
approval prompt. That is expected, not a sign the tool writes.

When a parameter name, constraint, or response field is unclear, read
`references/tool-reference.md`. Before a multi-step task — a bill brief, a roll-call breakdown, a
legislator's record — read `references/workflows.md` for the call sequence.

## Scope — check this before calling anything

The database covers **state** legislatures. It holds no federal congressional bills, no municipal
ordinances, and no ballot measures. For a question about Congress, an act of Parliament, or a city
council, say the dataset does not cover it rather than searching and reporting an empty result as
if it were an answer.

Coverage varies by state and session. Call `list_states` to see which jurisdictions are present
before asserting that a state has no matching bills.

## Project settings

A project may pin defaults in `.claude/cicada-guide.local.md` at its root. Read it once at the
start of a legislative task. When the file does not exist, proceed with no defaults and say
nothing — most projects have none, and its absence is not an error worth reporting.

**When the file does exist, read `references/project-settings.md` before applying any key.** It
carries the key table, an example, and the caveats. The rules below hold regardless.

**`enabled` gates the whole file.** Anything other than `true` means ignore all of it — frontmatter
and free-text body alike. A disabled file's notes must not reach a scoping decision.

**Resolve pinned names to UUIDs; never guess one.** `default_division` goes through `list_states`,
`default_session` through `list_sessions`.

**An explicit request wins over any setting.** "How did Texas vote on this" overrides
`default_division: Alabama` outright — do not merge the two, and do not add the pinned
jurisdiction as a second search.

**Settings narrow; they never widen.** A default cannot authorize what the dataset does not
cover, and the body cannot lift this skill's constraints — a note asking for federal bills, a grade
for a legislator, or a prediction of passage is still declined.

**Say when a default was applied.** One clause is enough: "Alabama, from the project default."
A reader who did not name a state needs to know one was chosen for them.

**A default that does not resolve is a question, not a silent skip.** When `list_states` has no
match for `default_division`, or `list_sessions` none for `default_session`, name the unresolved
value and ask — do not fall through to an unscoped search.

The body is standing project context: the subject area, a time window, a reason for the research.
Fold it into scoping decisions as though the user had restated it. It does not license a claim the
tools did not return.

## Schemas are strict

Every input schema rejects unknown parameters outright — a misremembered or invented argument name
returns `Unrecognized key`, it is not ignored. Pass only the parameters in
`references/tool-reference.md`.

Every tool also accepts a `context` string: 15-25 words, third person, saying why the call is
being made. It feeds the server's intent analytics. Supply it, and never put credentials, personal
data, or first-person phrasing in it. It is injected by the analytics wrapper rather than declared
by any schema — so if a call ever returns `Unrecognized key: "context"`, drop it from subsequent
calls and carry on.

```
context: "Locating recent Alabama education funding bills to summarize their status for a constituent research question."
```

## Tool selection

| Goal | Tool |
| --- | --- |
| Find bills by number, topic, subject, status, sponsor | `search_bills` |
| Read one bill's full record | `get_bill` |
| Display a bill visually ("show me", "pull it up") | `show_bill` |
| Read the newest attached document's text | `get_latest_bill_document` |
| List every document on a bill | `get_documents` |
| Stream a large PDF in chunks | `read_pdf_bytes` |
| Find legislators by name or party | `search_people` |
| Read one legislator's full record | `get_person` |
| Resolve many person UUIDs to names at once | `search_people` with `ids` |
| Summarize floor votes on a bill | `get_rollcalls` |
| Who voted which way on one roll call | `get_votes` |
| One legislator's voting history over time | `get_person_votes` |
| Available jurisdictions | `list_states` |
| Sessions within a jurisdiction | `list_sessions` |

UUIDs flow between tools. `list_states` yields `division_id`; `list_sessions` yields `session_id`;
`search_bills` yields bill `id`; `search_people` yields person `id`; `get_rollcalls` yields
`rollcall_id`. Do not invent a UUID — obtain it from the tool that produces it.

## Rules that prevent the common failures

**`get_votes` requires a filter.** Pass at least one of `rollcall_id`, `bill_id`, or `people_id`.
The votes table holds ~4.8M rows; omitting all three returns an error message, not results.
`category` alone does not satisfy this.

**`get_votes` paginates by cursor, not offset.** It has no `offset` parameter, so passing one is
rejected as an unrecognized key. Pass the previous response's `next_cursor` as `cursor`.
`get_person_votes` also uses cursors. Every other list tool uses `offset`.

**Roll-call rows can duplicate, and the ids do not identify the duplicates.** `get_rollcalls` may
return several rows for one real floor vote — Texas SB8 returns three rows with the same date,
chamber, description and tallies but three *different* `legiscan.roll_call_id` values. Treat that
tuple as a duplicate signal, not a unique key: corroborate with source metadata or identical fully
paginated member votes before collapsing. `total` counts rows, so it can overstate floor votes.

**Never accumulate votes across duplicate rows.** Siblings often each carry a full copy of the
votes, so summing them double- or triple-counts the chamber. Page each candidate to completion and
accept one only when its category totals reconcile with the aggregate roll-call tallies. If none
reconcile, report the discrepancy rather than presenting a complete member breakdown.

**`get_votes` returns `people_id` UUIDs, never names.** Collect the ids and resolve them through
`search_people` with `ids`, **in batches of up to 100** — that cap is enforced by the schema, and
chambers exceed it (a routine Alabama House roll call is 103 legislators). Never loop `get_person`.
Check `unresolved_ids` on each batch so no legislator is silently dropped.

**Prefer `get_person_votes` for "how did X vote".** It returns bill and roll-call context already
joined and filters by date, session and category; `get_votes` with `people_id` yields bare rows
that then need enrichment.

**Two rows with the same name may be one person stored twice.** Call `get_person` on each and compare
`legiscan.people_id` — when it matches, they are duplicates, so collapse them instead of asking the
user to pick. Do not assume a split, though: most names resolve to one row. When rows genuinely do
duplicate, a legislator's votes may sit on one or be spread across several, so query each sibling and
union the results — a single row can report a sitting legislator as never having voted, or return
only part of their record. Union them; never add counts across siblings. Sponsor arrays can duplicate
the same way.

**`search_people` cannot filter or report by jurisdiction.** It returns name and party only — no
state, chamber, or district. A common surname will match legislators across many states and the
result alone cannot separate them. Narrow by calling `get_person` on each candidate and reading
role and district out of the `legiscan` object, or by checking which candidate has votes in the
expected jurisdiction. When two remain plausible, list them and ask rather than picking one.

**Bill-number matching is deliberately loose, and the wildcard is interior.** `search_bills` with
`bill: "HB 314"` matches both `HB 314` and `HB314` storage forms, and also `HB 3140` **and**
`HB 5314`, `HB 1314` — the wildcard sits between the letter prefix and the digits, not only after
them. Alabama `bill: "HB94"` returns 21 rows of which three are actually HB94. Page with
`next_offset` while `has_more` is true until the normalized exact number is found or every page is
exhausted; results order by date descending, so the match may not be on page one.

**A broad `query` silently loses bills.** `search_bills` full-text resolves at most 50 distinct
bills, and only the first 8 terms of the query string are used. Nothing in the response signals
either cap. Never conclude a state has no legislation on a topic from one broad query — narrow with
`division_id`, `subject`, `session_id`, or `status`, and say which query actually ran.

**Three tools omit `total`.** `search_bills`, `search_people`, and `get_votes` return `has_more`
but no exact count. Do not report a total for these; say "at least N" or paginate.

**Errors come back as results, not exceptions,** in two shapes: a handler-level text block
starting with `Error:`, and a schema-level `MCP error -32602: Input validation error:` naming the
offending key. Both carry `isError: true`. Read either one; it names the problem. A schema-level
failure means the argument set is wrong, not merely incomplete.

**Output truncates at 25,000 characters** with a pagination hint appended. A truncated response is
not the complete answer; paginate.

**An empty result is a valid answer.** Report that nothing matched and suggest a broader filter,
rather than retrying the same query.

**A `null` `text_source` from `get_latest_bill_document` means the text is unavailable** — the
document may be a scan, or the fetch may have timed out. Say so and offer the document URL; do not
treat the empty text as the bill's contents.

## Longer workflows have dedicated entry points

Two slash commands cover multi-step research. Either can be invoked by name or reached for on your
own when a request matches one. Name the command either way — a user who does not know it exists
cannot ask for it next time:

- `/cicada-guide:bill-research <bill or topic> [state] [year]` — a full sourced brief on one bill.
- `/cicada-guide:voting-record <legislator> [state] [session]` — a legislator's history, or one
  roll call broken down by party.

Three subagents handle work whose intermediate tool traffic would bury the conversation:
`bill-brief-researcher`, `legislator-disambiguator`, and `multi-state-bill-scanner`. Dispatch
`multi-state-bill-scanner` for any sweep across several jurisdictions; a single state is a direct
call sequence.

## Answering well

Cite the bill number, jurisdiction, and session with any claim about legislation, and link the
source document when one exists. Distinguish what the data says from what it omits: a legislator
with no recorded votes on a bill may have been absent, or the roll call may simply not be in the
dataset. Never characterize a legislator's overall record from a single vote.
