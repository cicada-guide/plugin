---
name: cicada-guide
description: This skill should be used for questions about U.S. STATE legislation — finding or reading a state bill ("look up HB 314", "what bills mention school funding", "what does this bill do", "what's the status of this bill"), state legislators ("who sponsored this bill", "find my state representative", "what party is she"), or roll calls and voting records ("how did Senator X vote", "show me the roll call", "how did the chamber split", "list Alabama's legislative sessions"). Not for the U.S. Congress or federal bills, city or county ordinances, ballot measures, regulations, or non-U.S. legislatures — the dataset covers state legislatures only.
---

# Researching U.S. state legislation with cicada-guide

The cicada-guide MCP server exposes 13 tools over U.S. **state** legislative data: bills, bill
documents, legislators, legislative sessions, roll calls, and individual votes. Tool names below
are bare (`search_bills`); the host prefixes them with its own MCP namespace.

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

The file is YAML frontmatter followed by optional free-text notes:

```markdown
---
enabled: true
default_division: Alabama
default_session: 2025 Regular Session
context_prefix: Constituent research desk
response_format: markdown
---

Focus on K-12 education funding. Bills before 2023 are out of scope for this project.
```

| Key | Effect |
| --- | --- |
| `enabled` | Anything other than `true` — ignore the entire file, frontmatter and body alike. |
| `default_division` | Jurisdiction assumed when the request names none. Resolve through `list_states` to a `division_id`; never guess the UUID. |
| `default_session` | Session to assume within that jurisdiction. Resolve through `list_sessions`. |
| `context_prefix` | Prepended to the `context` string on each call. Keep the combined string third person and free of personal data. |
| `response_format` | The `response_format` argument to use when the request implies neither. |

Every key is optional. A missing key means no default, not a fallback to some other value.

**`context_prefix` rides on an injected parameter.** No tool schema on the server declares
`context` — the analytics wrapper adds it to the published schema and strips it before the strict
validation runs, which is why a call without it still succeeds. If a call ever comes back with
`Unrecognized key: "context"`, that wrapper is gone: drop `context` from subsequent calls and
ignore `context_prefix`. The other four keys map to declared parameters and are unaffected.

**An explicit request wins over any setting.** "How did Texas vote on this" overrides
`default_division: Alabama` outright — do not merge the two, and do not add the pinned
jurisdiction as a second search.

**Settings narrow; they never widen.** A default cannot authorize what the dataset does not
cover. `default_division: Ontario` is not a jurisdiction here, and the body cannot lift this
skill's constraints — a note asking for federal bills, a grade for a legislator, or a prediction
of passage is still declined.

**Say when a default was applied.** One clause is enough: "Alabama, from the project default."
A reader who did not name a state needs to know one was chosen for them.

**A default that does not resolve is a question, not a silent skip.** When `list_states` has no
match for `default_division`, or `list_sessions` none for `default_session`, name the unresolved
value and ask — do not fall through to an unscoped search.

The body is standing project context: the subject area, a time window, a reason for the research.
Fold it into scoping decisions the way you would a preference the user restated each time. It
does not license a claim the tools did not return.

## Schemas are strict

Every input schema rejects unknown parameters outright — a misremembered or invented argument name
returns `Unrecognized key`, it is not ignored. Pass only the parameters in
`references/tool-reference.md`.

Every tool also accepts an optional `context` string: 15-25 words, third person, saying why the
call is being made. It feeds the server's intent analytics. The published schema marks it required
but the server does not enforce it, so a call without it still succeeds. Supply it anyway, and
never put credentials, personal data, or first-person phrasing in it.

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

**`get_votes` returns `people_id` UUIDs, never names.** Collect the ids from a page and resolve
them in one `search_people` call with `ids` (up to 100 per call). Never loop `get_person`. Check
`unresolved_ids` in the response so no legislator is silently dropped.

**Prefer `get_person_votes` for "how did X vote".** It returns bill number, title, roll-call date,
description, and outcome already joined, and supports `latest: true` for the single most recent
vote, plus `category`, `session_id`, `start_date`, and `end_date` filters. Reaching for
`get_votes` with `people_id` yields bare vote rows that then need enrichment.

**`search_people` cannot filter or report by jurisdiction.** It returns name and party only — no
state, chamber, or district. A common surname will match legislators across many states and the
result alone cannot separate them. Narrow by calling `get_person` on each candidate and reading
role and district out of the `legiscan` object, or by checking which candidate has votes in the
expected jurisdiction. When two remain plausible, list them and ask rather than picking one.

**Bill-number matching is deliberately loose.** `search_bills` with `bill: "HB 314"` also matches
`HB 3140`, and matches both `HB 314` and `HB314` storage forms. Read the `bill` field on each
result and confirm the match before reporting it.

**Three tools omit `total`.** `search_bills`, `search_people`, and `get_votes` return `has_more`
but no exact count, because counting would scan every matching row. Do not report a total for
these; say "at least N" or paginate. `list_states`, `list_sessions`, `get_documents`, and
`get_rollcalls` do return `total`.

**Errors come back as results, not exceptions,** in two shapes. A handler-level failure returns a
text block starting with `Error:` — for example the `get_votes` missing-filter message. A
schema-level failure returns `MCP error -32602: Input validation error:` naming the offending key.
Both carry `isError: true` and no `structuredContent`. Read either one; it names the problem.

**Output truncates at 25,000 characters** with a pagination hint appended. A truncated response is
not the complete answer; paginate.

**An empty result is a valid answer.** Report that nothing matched and suggest a broader filter,
rather than retrying the same query.

**A `null` `text_source` from `get_latest_bill_document` means the text is unavailable** — the
document may be a scan, or the fetch may have timed out. Say so and offer the document URL; do not
treat the empty text as the bill's contents.

## Answering well

Cite the bill number, jurisdiction, and session with any claim about legislation, and link the
source document when one exists. Distinguish what the data says from what it omits: a legislator
with no recorded votes on a bill may have been absent, or the roll call may simply not be in the
dataset. Never characterize a legislator's overall record from a single vote.
