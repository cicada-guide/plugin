# Worked call sequences

Every call also takes a `context` string (15-25 words, third person, feeding the
server's intent analytics); it is omitted from the argument objects below for brevity.

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

Read the `bill` field on every result before reporting. The wildcard is interior, so `"HB 314"` also
matches `HB 3140` **and** `HB 5314`, `HB 1314`. Page with `next_offset` while `has_more` is true until
the normalized exact number is found or every page is exhausted; results order by date descending.

Omit `session_id` only when the session has not been resolved. In that case, the first exact-number
match is not enough: finish paging for other sessions or ask which session the user intends.

## Research a topic

```jsonc
{ "tool": "search_bills", "arguments": { "query": "school funding", "division_id": "<uuid>", "limit": 50 } }
```

`query` searches title and synopsis *and* the full text of attached documents, then ORs the two
result sets. Skip `division_id` for a nationwide sweep. There is no `total` on this envelope — use
`has_more` and `next_offset`, and describe counts as "at least N".

**A broad `query` silently loses bills.** Full-text resolves at most 50 distinct bills, and only the
first 8 terms of the string are used — and neither cap shows up in the response. A `limit: 50` that
comes back short is not evidence the state has no such legislation. Narrow by `division_id`,
`subject`, or `session_id` and say which query ran, rather than lengthening the query string.

To narrow further, add `status` (partial match, e.g. `"Passed"`), `subject` (exact match against
the `subjects` array), or `sponsor_id`.

## Read what a bill actually says

```jsonc
// fastest path: newest document, text included
{ "tool": "get_latest_bill_document", "arguments": { "bill_id": "<bill uuid>" } }
```

Check `text_source`. A `null` means no stored text and no successful fetch — report that the text
is unavailable and offer `item.url`, rather than treating the empty string as the bill's contents.

For a specific version rather than the newest:

```jsonc
{ "tool": "get_documents", "arguments": { "bill_id": "<bill uuid>" } }
// pick an item, then stream it if it is a large PDF
{ "tool": "read_pdf_bytes", "arguments": { "url": "<item url>", "response_format": "json" } }
// next offset = previous offset + byteCount (equal to byteCount only on the first chunk)
{ "tool": "read_pdf_bytes", "arguments": { "url": "<item url>", "offset": 750000, "response_format": "json" } }
// ...and chunk 3 starts at 1500000, not at 750000 again
```

## How did the legislature vote on this bill

```jsonc
// 1. the floor votes that happened
{ "tool": "get_rollcalls", "arguments": { "bill_id": "<bill uuid>" } }
// → items carry date, description, and counts { yea, nay, absent, nv, total } — null when unrecorded
// → includes roll calls linked through their votes; linked_via says "bill" or "votes"

// 2. individual positions on one roll call
{ "tool": "get_votes", "arguments": { "rollcall_id": "<rollcall uuid>", "limit": 100 } }

// 3. next page — cursor, never offset
{ "tool": "get_votes", "arguments": { "rollcall_id": "<rollcall uuid>", "limit": 100, "cursor": "<next_cursor>" } }

// 4. turn people_id values into names, in batches of up to 100 (hard schema cap)
{ "tool": "search_people", "arguments": { "ids": ["<people_id>", "<people_id>", "..."] } }
```

Step 4 is not optional — `get_votes` returns UUIDs only. Batch them in groups of at most 100 and
repeat step 4 per batch; a 400-member chamber needs four calls. Never loop `get_person`. Check
`unresolved_ids` on each response and account for anyone it lists.

For a party-line breakdown, the `party` field arrives with the `search_people` batch; join it to
the vote categories from step 2 rather than making further calls.

`counts` are the recorded votes, not a result — nothing returns pass/fail or the chamber. Say a
measure passed only when the roll-call `description` or the bill's `status` says so.

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
  "start_date": "2024-01-01", "end_date": "2024-12-31", "limit": 50 } }
```

Each `get_person_votes` item nests `vote` (category), `rollcall` (date, description, and `outcome`
— the recorded tallies, not pass/fail), and `bill` (number, title, status, `session_id`,
`division_id`, `source_url`) — no enrichment step needed beyond resolving ids to names. `bill` is
`null` for procedural roll calls attached to no bill. Page with `cursor`.

`search_people` and `get_person` return name and party only — no state, chamber, or district — so
several matches for a common surname cannot be separated from those results. Check which candidate
has votes whose `bill.division_id` is the expected jurisdiction. Chamber and district cannot be
confirmed from any tool. Ask rather than guessing when two remain equally plausible.

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
{ "tool": "search_bills", "arguments": { "sponsor_id": "<person uuid>", "limit": 50 } }
```

## Recovering from the common errors

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Error: Provide at least one of rollcall_id, bill_id, or people_id...` | `get_votes` with no entity filter, or `category` alone | Add `rollcall_id`, `bill_id`, or `people_id` |
| `MCP error -32602: Input validation error:` naming a key | An invented or misremembered parameter, e.g. `offset` passed to `get_votes` / `get_person_votes`, or `response_format` passed to `show_bill`, `get_bill_dossier`, or another tool without it | Schemas are strict; drop or correct the named key — see the two error shapes in `tool-reference.md` |
| Wrong legislator | `search_people` and `get_person` return no state or chamber, so a common surname is ambiguous | Confirm jurisdiction from `bill.division_id` in `get_person_votes`; ask when still tied |
| Two identical-looking candidates | Two legislators with the same name | List both with party, state, and vote dates, and ask; never combine their records |
| A sitting legislator appears to have no votes | The chosen row may be a different legislator with the same name | Surface other rows with the same name as candidates and ask |
| Right bill number, wrong bill | Interior-wildcard match (`HB 314` → `HB 3140`, `HB 5314`) | Read the `bill` field; scope by `division_id` and `session_id`; the exact match may not be on page one |
| Names missing from a vote breakdown | `get_votes` returns UUIDs only | Batch-resolve with `search_people` `ids` |
| A count looks wrong | `search_bills` / `search_people` / `get_votes` have no `total` | Report "at least N", or paginate to exhaustion |
| A topic search finds nothing, or suspiciously little | `search_bills` full-text caps at 50 bills and 8 terms, silently | Narrow by `division_id` / `subject`; do not report absence from one broad query |
| `ids` rejected on a big roll call | `search_people` `ids` caps at 100; large chambers exceed it | Chunk into batches of 100 |
| Response ends mid-sentence | 25,000-character truncation | Paginate; do not treat it as the full answer |
| `No bill found with id=...` | Valid UUID, no row | Not an error — re-derive the id from `search_bills` |
| `counts: null`, or `No votes found` on a roll call | No individual votes recorded for that roll call | Report the breakdown as unavailable, never as nobody voting |
| Code reads `legiscan` and finds nothing | The server no longer returns `legiscan` objects (absent as of 2026-09-24) | Use `counts` on roll calls and `bill.division_id` from `get_person_votes` |
