# Worked call sequences

Every call also takes a `context` string (15-25 words, third person, feeding the
server's intent analytics) and an `llm_model` string (the calling model's exact identifier, or
`"unknown"`); both are omitted from the argument objects below for brevity.

## Find a bill by number in a named state

Bill numbers repeat across states and sessions, so scope the search before trusting a match.

```jsonc
// 1. resolve the jurisdiction
{ "tool": "list_states", "arguments": { "name": "Alabama" } }
// → items[0].id  ⇒ division_id

// 2. narrow to a session when the user named a year
{ "tool": "list_sessions", "arguments": { "division_id": "<division uuid>" } }

// 3. search, scoped
{ "tool": "search_bills", "arguments": { "bill": "HB 314", "division_id": "<division uuid>", "session_id": "<resolved session uuid>" } }
```

`bill` matches the exact number in either stored spelling (`HB 314` or `HB314`), but the same number
repeats across sessions, so read each result's session before reporting. When the user named a year
but not a session, `session_name: "2025"` filters to every 2025 session without a UUID; it is a
partial match, so it can return regular and special sessions together.

Omit `session_id` only when the session has not been resolved. In that case, the first exact-number
match is not enough: finish paging for other sessions or ask which session the user intends.

## Research a topic

```jsonc
{ "tool": "search_bills", "arguments": { "query": "voucher", "division_id": "<uuid>", "limit": 25 } }
```

`query` searches title and synopsis *and* the full text of attached documents, then ORs the two
result sets. Skip `division_id` for a nationwide sweep. There is no `total` on this envelope — use
`has_more` and `next_offset`, and describe counts as "at least N".

**More words widen the results.** The title/synopsis half splits `query` into words, matches each
as a separate substring, and ORs them; only the first 8 terms of the string are used. Prefer one
distinctive word over a phrase: `"school choice"` matches every bill with "school" in its title or
synopsis.

**Scope before the full-text cap.** The document full-text half resolves at most 50 distinct
bills. `division_id`, `session_id`, and `session_name` scope it before that cap, so a scoped search
draws its 50 from that state or session; a nationwide sweep with none of them is capped at 50 bills
in all. `subject`, `status`, and `sponsor_id` apply after the cap. Neither cap shows up in the
response, so a short page is not evidence the state has no such legislation. Scope by state and
session, try another distinctive word, and say which query ran.

To narrow further, add `status`, `subject` (exact match against the `subjects` array), or
`sponsor_id`. `status` is a partial match on the recorded status text: `"Passed"` matches every
status containing that word, which can record one chamber's passage rather than enactment. Report
each bill's status as recorded; a `status` filter is not proof a bill became law.

## Read what a bill actually says

```jsonc
// fastest path: newest document, text included
{ "tool": "get_latest_bill_document", "arguments": { "bill_id": "<bill uuid>" } }
// → text, text_total_chars, next_text_offset (null when the text is complete)

// long text: the next part, until next_text_offset is null
{ "tool": "get_latest_bill_document", "arguments": { "bill_id": "<bill uuid>", "text_offset": 24410 } }
```

Check `text_source`. A `null` means no stored text and no successful fetch — report that the text
is unavailable and offer `item.url`, rather than treating the empty string as the bill's contents.

Long text comes in parts that fit under 25,000 characters. Pass each response's `next_text_offset`
as `text_offset` until it is `null`, and read every part before describing what the bill does.
Markdown marks a part `_Characters 0–24410 of 61234. Continue with text_offset=24410._`. If you
stop early, say which characters the answer rests on.

For a specific version rather than the newest, list the documents and report the version's URL:

```jsonc
{ "tool": "get_documents", "arguments": { "bill_id": "<bill uuid>" } }
// → items carry status, date, url, format — metadata only, no text
```

`read_pdf_bytes` is not a way to read a bill: it returns base64 PDF bytes, not text. Read text
through `get_latest_bill_document`, and give the user an older version's `url` from
`get_documents`.

## How did the legislature vote on this bill

```jsonc
// 1. the floor votes that happened
{ "tool": "get_rollcalls", "arguments": { "bill_id": "<bill uuid>" } }
// → items carry date, description, and counts { yea, nay, absent, nv, total } — null when unrecorded
// → includes roll calls linked through their votes; linked_via says "bill" or "votes"
// → relay anything in the envelope's warnings array

// 2. who voted which way, and the split by party, in one call
{ "tool": "get_rollcall_breakdown", "arguments": { "rollcall_id": "<rollcall uuid>" } }
// → counts, by_party [{ party, YEA, NAY, ABSENT, NV, total }], members [{ name, party, category }]
```

Step 2 needs no `get_votes` paging or `search_people` resolution: `members` already carries each
legislator's name and party. When `partial` is `true`, the 500-row cap was reached and `by_party`
covers only the rows returned; say so. When `members` is empty, the text reads `no individual votes
recorded (not a 0-0 vote).` and `counts` holds zeros: report the counts as not recorded.

`counts` are the recorded votes, not a result — nothing returns pass/fail or the chamber. Say a
measure passed only when the roll-call `description` or the bill's `status` says so. Report each
roll call's own `counts`; never add counts across roll calls.

When `get_rollcalls` returns nothing, "no recorded floor votes in this dataset" is the answer.

## How did one legislator vote

```jsonc
// 1. find them
{ "tool": "search_people", "arguments": { "name": "Rex Reynolds" } }

// 2. confirm jurisdiction from their votes before attributing anything —
//    read bill.division_id off the items and match it against list_states
{ "tool": "get_person_votes", "arguments": { "people_id": "<person uuid>", "limit": 10 } }

// 3. their most recent recorded votes: every item sharing the newest rollcall.date. Keep paging
//    with cursor while has_more is true and the last item is still on that date.
//    latest: true returns one of them, chosen by UUID, not by time of day

// 4. or a filtered history
{ "tool": "get_person_votes", "arguments": { "people_id": "<person uuid>", "category": "NAY",
  "start_date": "2024-01-01", "end_date": "2024-12-31", "limit": 25 } }
```

Each `get_person_votes` item nests `vote` (category), `rollcall` (date, description, and `outcome`
— the recorded tallies, not pass/fail), and `bill` (number, title, status, `session_id`,
`division_id`, `source_url`) — no enrichment step needed beyond resolving ids to names. `bill` is
`null` for procedural roll calls attached to no bill. Page with `cursor`.

`search_people` and `get_person` return name and party only — no state, chamber, or district — so
several matches for a common surname cannot be separated from those results. Check which candidate
has votes whose `bill.division_id` is the expected jurisdiction. Chamber and district cannot be
confirmed from any tool. Ask rather than guessing when two remain equally plausible.

When the user says "my senator" or "my representative" without a name, ask for the legislator's
name and state. No tool maps an address or district to a legislator.

## How did one legislator vote on one bill

```jsonc
// 1. resolve the bill, scoped
{ "tool": "search_bills", "arguments": { "bill": "HB 314", "division_id": "<division uuid>", "session_name": "2025" } }

// 2. resolve the person and confirm jurisdiction, as in the section above
{ "tool": "search_people", "arguments": { "name": "Rex Reynolds" } }

// 3. both filters together: that legislator's votes on that bill, one row per roll call
{ "tool": "get_votes", "arguments": { "bill_id": "<bill uuid>", "people_id": "<person uuid>" } }
// → items carry id, category, people_id, rollcall_id, bill_id; page with cursor while has_more

// 4. date and description for each roll call
{ "tool": "get_rollcalls", "arguments": { "bill_id": "<bill uuid>" } }
// → match each vote's rollcall_id to an item's id; page with next_offset while has_more
// → a rollcall_id that matches no item: get_rollcall_breakdown with it returns its date and description
```

Report each vote with its roll call's date, description, and own `counts`. When step 3 returns no
rows, the data holds no recorded vote by that legislator on that bill — say so, not that they
abstained. When several bills or legislators remain plausible after steps 1 and 2, list them and
ask.

## Show a bill visually

```jsonc
{ "tool": "search_bills", "arguments": { "bill": "HB 314", "division_id": "<uuid>" } }
{ "tool": "show_bill", "arguments": { "id": "<bill uuid>" } }
```

`show_bill` returns a card plus a text summary. Hosts without MCP Apps support display the text,
so the call is always safe. Use it for "show me" / "pull it up"; use `get_bill` when the user wants
the contents read back.

## Who sponsored this bill

`search_bills` and `get_bill` return a `sponsors` array of person UUIDs. Resolve them in one call:

```jsonc
{ "tool": "search_people", "arguments": { "ids": ["<sponsor uuid>", "..."] } }
```

The reverse direction — every bill a legislator sponsored — goes through `search_bills`:

```jsonc
{ "tool": "search_bills", "arguments": { "sponsor_id": "<person uuid>", "limit": 25 } }
```

## Recovering from the common errors

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Error: Provide at least one of rollcall_id, bill_id, or people_id...` | `get_votes` with no entity filter, or `category` alone | Add `rollcall_id`, `bill_id`, or `people_id` |
| `MCP error -32602: Input validation error:` naming a key | An invented or misremembered parameter, e.g. `offset` passed to `get_votes` / `get_person_votes`, or `response_format` passed to `show_bill`, `get_rollcall_breakdown`, or another tool without it | Schemas are strict; drop or correct the named key — see the two error shapes in `tool-reference.md` |
| Wrong legislator | `search_people` and `get_person` return no state or chamber, so a common surname is ambiguous | Confirm jurisdiction from `bill.division_id` in `get_person_votes`; ask when still tied |
| Two identical-looking candidates | Two legislators with the same name | List both with party, state, and vote dates, and ask; never combine their records |
| A sitting legislator appears to have no votes | The chosen row may be a different legislator with the same name | Surface other rows with the same name as candidates and ask |
| Right bill number, wrong bill | The same number exists in another session or state | Scope by `division_id` and `session_id` (or `session_name`); read each result's session |
| Names missing from a vote breakdown | `get_votes` returns UUIDs only | Use `get_rollcall_breakdown`, whose `members` carry names and party |
| A count looks wrong | `search_bills` / `search_people` / `get_votes` / `get_person_votes` have no `total` | Report "at least N", or paginate to exhaustion |
| A topic search finds nothing, or suspiciously little | `search_bills` full-text caps at 50 bills — nationwide unless scoped by `division_id` or a session — and uses 8 terms, silently | Try one distinctive word, scope by `division_id` and `session_id` / `session_name`; do not report absence from one query |
| A topic search returns many off-topic bills | Each `query` word is matched separately and ORed | Use one distinctive word rather than a phrase |
| `ids` rejected on a big batch | `search_people` `ids` caps at 100 | Chunk into batches of 100 |
| `Rate limit exceeded. Retry in 60 seconds.` | More than 60 calls in a minute | Tell the user the limit was hit and that you will resume after a minute; wait a full minute, then continue at a slower pace |
| Fewer items than `limit`, with `_Showing N of the requested M to stay under the 25,000-character limit` | The page was fitted under 25,000 characters | Nothing was lost: follow `next_offset` / `next_cursor` while `has_more` is true |
| Response ends in a truncation hint | 25,000-character truncation of a single oversized item or a tool that returns no list | That response was cut; say what it lacks. For bill text, use `text_offset` instead |
| `_Characters X–Y of N. Continue with text_offset=Y._` | `get_latest_bill_document` returned one part of a long text | Pass `next_text_offset` as `text_offset` until it is `null` |
| `No roll calls at offset <n>; bill <id> has <total>.`, or `Error: Offset past end.` | An `offset` past the end of the list | The list ended; page only while `has_more` is true |
| `Error: cursor is not a next_cursor from get_person_votes.` | A `get_person_votes` `cursor` that is not a `next_cursor` it returned | Pass `next_cursor` back exactly, or omit `cursor` to restart from the newest vote |
| `No bill found with id=...` | Valid UUID, no row | Not an error — re-derive the id from `search_bills` |
| `counts: null`, `No votes found`, or a breakdown reading `no individual votes recorded (not a 0-0 vote).` | No individual votes recorded for that roll call | Report the counts as not recorded and the breakdown as unavailable, never as nobody voting or a 0-0 vote |
| Code reads `legiscan` and finds nothing | The server no longer returns `legiscan` objects (absent as of 2026-09-24) | Use `counts` on roll calls and `bill.division_id` from `get_person_votes` |
