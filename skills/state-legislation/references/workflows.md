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
{ "tool": "search_bills", "arguments": { "bill": "HB 314", "division_id": "<division uuid>" } }
```

Read the `bill` field on every result before reporting. The wildcard is interior, so `"HB 314"` also
matches `HB 3140` **and** `HB 5314`, `HB 1314`. Results order by date descending, so the exact match
may not be on the first page.

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
// → items carry date, description, and yea/nay/absent totals inside legiscan

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

## How did one legislator vote

```jsonc
// 1. find them
{ "tool": "search_people", "arguments": { "name": "Rex Reynolds" } }

// 2. their most recent vote, enriched
{ "tool": "get_person_votes", "arguments": { "people_id": "<person uuid>", "latest": true } }

// 3. or a filtered history
{ "tool": "get_person_votes", "arguments": { "people_id": "<person uuid>", "category": "NAY",
  "start_date": "2024-01-01", "end_date": "2024-12-31", "limit": 50 } }
```

`get_person_votes` already joins bill number, title, status, session, rollcall date, description,
outcome, chamber, and source URL — no enrichment step needed. Page with `cursor`.

`search_people` returns name and party only — no state, chamber, or district — so several matches
for a common surname cannot be separated from the search result alone. Call `get_person` on each
candidate and read role and district from the `legiscan` object, or check which candidate has
votes in the expected jurisdiction. Ask rather than guessing when two remain equally plausible.

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
| `MCP error -32602: Input validation error:` naming a key | An invented or misremembered parameter, e.g. `offset` passed to `get_votes` / `get_person_votes`, or `response_format` passed to `show_bill` | Schemas are strict; drop or correct the named key — see the two error shapes in `tool-reference.md` |
| Wrong legislator | `search_people` returns no state or chamber, so a common surname is ambiguous | Check `legiscan` via `get_person`, or confirm jurisdiction through `get_person_votes`; ask when still tied |
| Two identical-looking candidates | One person stored on duplicate rows | Compare `legiscan.people_id` via `get_person`; if equal, collapse — do not ask the user to choose |
| A sitting legislator appears to have no votes | The chosen row is the empty duplicate | Try the sibling row with the same `legiscan.people_id`; union records across siblings, never add counts |
| Right bill number, wrong bill | Interior-wildcard match (`HB 314` → `HB 3140`, `HB 5314`) | Read the `bill` field; scope by `division_id` and `session_id`; the exact match may not be on page one |
| Names missing from a vote breakdown | `get_votes` returns UUIDs only | Batch-resolve with `search_people` `ids` |
| A count looks wrong | `search_bills` / `search_people` / `get_votes` have no `total` | Report "at least N", or paginate to exhaustion |
| A topic search finds nothing, or suspiciously little | `search_bills` full-text caps at 50 bills and 8 terms, silently | Narrow by `division_id` / `subject`; do not report absence from one broad query |
| `ids` rejected on a big roll call | `search_people` `ids` caps at 100; large chambers exceed it | Chunk into batches of 100 |
| Response ends mid-sentence | 25,000-character truncation | Paginate; do not treat it as the full answer |
| `No bill found with id=...` | Valid UUID, no row | Not an error — re-derive the id from `search_bills` |
| `No votes found` on a rollcall whose totals are non-zero | A voteless duplicate row, or a genuine per-state coverage gap | Retry each sibling matching on (date, chamber, description, tallies); stop at the first that returns records |
| More roll calls than the bill plausibly had | `get_rollcalls` `total` counts rows, and rows can duplicate | Collapse on the (date, chamber, description, tallies) tuple — **not** `legiscan.roll_call_id`, which differs between duplicates |
| A chamber's vote total comes out 2-3x too high | Votes were accumulated across duplicate rows that each carry a full copy | Report from one row per floor vote, never a sum across siblings |
| `legiscan.date` is missing, or tallies will not compare | The `legiscan` object is not schema-stable: some states double-quote the `date` key and return tallies as strings | Use the row's top-level `date`; coerce tally values before arithmetic |
