# Worked call sequences

Every call also accepts an optional `context` string (15-25 words, third person, feeding the
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

Read the `bill` field on every result before reporting. `"HB 314"` also matches `HB 3140`.

## Research a topic

```jsonc
{ "tool": "search_bills", "arguments": { "query": "school funding", "division_id": "<uuid>", "limit": 50 } }
```

`query` searches title and synopsis *and* the full text of attached documents, then ORs the two
result sets. Skip `division_id` for a nationwide sweep. There is no `total` on this envelope — use
`has_more` and `next_offset`, and describe counts as "at least N".

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
// continue with the returned byteCount as the next offset
{ "tool": "read_pdf_bytes", "arguments": { "url": "<item url>", "offset": 750000, "response_format": "json" } }
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

// 4. turn people_id values into names, one call for up to 100
{ "tool": "search_people", "arguments": { "ids": ["<people_id>", "<people_id>", "..."] } }
```

Step 4 is not optional — `get_votes` returns UUIDs only. Batch them; never loop `get_person`.
Check `unresolved_ids` on the response and account for anyone it lists.

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
| `Unrecognized key` validation error | An invented or misremembered parameter, e.g. `offset` passed to `get_votes` / `get_person_votes` | Schemas are strict; use `cursor`, and check the parameter list |
| Wrong legislator | `search_people` returns no state or chamber, so a common surname is ambiguous | Check `legiscan` via `get_person`, or confirm jurisdiction through `get_person_votes`; ask when still tied |
| Right bill number, wrong bill | Trailing-wildcard match (`HB 314` → `HB 3140`) | Read the `bill` field; scope by `division_id` and `session_id` |
| Names missing from a vote breakdown | `get_votes` returns UUIDs only | Batch-resolve with `search_people` `ids` |
| A count looks wrong | `search_bills` / `search_people` / `get_votes` have no `total` | Report "at least N", or paginate to exhaustion |
| Response ends mid-sentence | 25,000-character truncation | Paginate; do not treat it as the full answer |
| `No bill found with id=...` | Valid UUID, no row | Not an error — re-derive the id from `search_bills` |
