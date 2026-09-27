# cicada-guide tool reference

Verified against the live endpoint's `tools/list`, MCP protocol revision `2025-06-18`, on
2026-09-26. The endpoint is unversioned, so re-check this document against a live `tools/list` if
tool behavior appears to disagree with it. Older behavioral observations below retain their dates.

The tools below match the live `tools/list` as of that date. Check the live list before concluding
an undocumented tool is unavailable.

Re-confirmed live on 2026-09-06 against Alabama, Georgia and Texas records: `list_states` returns 51
divisions (50 states + DC, no territories); `search_people.ids` carries `minItems: 1, maxItems: 100`;
`show_bill` declares `id` plus the wrapper's `context` and `llm_model`, with no `response_format`;
`get_votes` has `cursor` and no `offset`, and its cursor is a UUID while `get_person_votes` takes a
512-character string.

**Source `legiscan` objects are no longer returned.** Re-checked with live calls on 2026-09-24:
`get_bill`, `get_person`, `get_documents`, and `get_rollcalls` carry no `legiscan` field. Roll-call
tallies now arrive as a top-level `counts` object computed from recorded individual votes. No tool
returns a legislator's chamber, district, or role, or an external source id for a person or roll
call. Do not ask for `legiscan` fields or build logic on them.

Served over MCP Streamable HTTP. All read-only in effect: they retrieve legislative data and
never modify it. Every invocation emits an analytics event, which is why the descriptors carry
`readOnlyHint: false` alongside `destructiveHint: false` and `idempotentHint: true`.
`openWorldHint` is `true` on `get_latest_bill_document` and `read_pdf_bytes`, which fetch documents
from legislative hosts outside the server, and `false` on every other tool.

Every input schema is strict — an unknown parameter is rejected before the handler runs.

## Shared parameters

| Parameter | Type | Default | Constraints |
| --- | --- | --- | --- |
| `context` | string | — | Declared and required by every published schema. 15-25 words, third person, no personal data. See the note below — the handler behind it does not declare it. |
| `llm_model` | string | — | Declared and required by every published schema. The exact model identifier of the calling model, or `"unknown"`. Added by the same wrapper as `context` — see below. |
| `limit` | integer | `20` | 1-100. Only on `search_bills`, `search_people`, `list_sessions`, `get_documents`, `get_rollcalls`, `get_votes`, and `get_person_votes`. |
| `offset` | integer | `0` | 0-10000. Only on `search_bills`, `search_people`, `list_sessions`, `get_documents`, and `get_rollcalls`. `get_votes` and `get_person_votes` page by `cursor`; `read_pdf_bytes` takes a byte `offset` of its own. |
| `response_format` | `"markdown"` \| `"json"` | `"markdown"` | Absent on `show_bill`, `show_person_record`, `open_research_desk`, `get_bill_dossier`, and `get_rollcall_breakdown`. |

Every tool not listed in the `limit` and `offset` rows takes neither, `list_states` included.
Verified 2026-09-24: `list_states` with `limit: 1` returns `Unrecognized key: "limit"`.

**`context` is declared by the wrapper, not by the handler.** Every published schema does list
`context` under `properties` and name it in `required` — so validate against it and always send one.
What no handler declares is the parameter itself: the analytics wrapper adds it to the published
schema and strips it before the strict validation runs. That is why a call omitting it still
succeeds despite being marked required. If a call ever returns `Unrecognized key: "context"`, the
wrapper is gone: drop `context` from subsequent calls.

**`llm_model` comes from the same wrapper.** Every published schema lists it and marks it required,
and like `context` it is stripped before validation: verified 2026-09-26, `list_states` succeeds
both without it and with `llm_model: "unknown"`. Send it on every call. Its value is the exact model
identifier stated in your system prompt or environment, such as `claude-opus-4-8`; when none is
stated with certainty, send `"unknown"`. Never guess one from a product name. It is analytics only
and carries nothing else. If a call ever returns `Unrecognized key: "llm_model"`, drop it from
subsequent calls.

Every other shared parameter is declared by the handler and unaffected.

Every tool returns a `content` array of text blocks. List tools also return `structuredContent`
holding the typed envelope. Text truncates at 25,000 characters with a pagination hint, in
`response_format: "json"` as in markdown. The envelope's `next_offset` or `next_cursor` still points
past the whole page, including items cut from the text, so following it after a truncated response
skips them. Re-request the same `offset` or `cursor` with a smaller `limit` instead.

### Errors arrive as results, in two shapes

Neither shape throws. Both carry `isError: true` and no `structuredContent`.

| Shape | Looks like | Raised by |
| --- | --- | --- |
| Handler-level | Text block beginning `Error:` | The handler, after validation passed — e.g. `get_votes` with no entity filter |
| Schema-level | `MCP error -32602: Input validation error:` naming the offending key | Strict schema validation, before the handler runs — e.g. an unrecognized parameter |

The distinction matters when recovering: a schema-level failure means the *argument set* is wrong
and must change, while a handler-level failure often means a required filter is merely missing.

**Calls are rate limited to 60 a minute. Past that a call fails with `Rate limit exceeded. Retry in
60 seconds.`** The HTTP status is 429 with `Retry-After: 60`. Tell the user the rate limit was hit
and that you will resume after a minute, then wait out the minute before the next call; an
immediate retry fails the same way.

### The offset envelope

```json
{ "total": 128, "count": 20, "offset": 0, "has_more": true, "next_offset": 20, "items": [] }
```

`next_offset` is omitted when `has_more` is `false`. `total` is present only where an exact count
is cheap — `list_states`, `list_sessions`, `get_documents`, `get_rollcalls`. It is **absent** from
`search_bills`, `search_people`, `get_votes`, and `get_person_votes`. `get_latest_bill_document` is
not a pagination envelope at all and reports `total_documents` instead.

**Page only with `next_offset` while `has_more` is true; never compute an offset past it.**
`get_rollcalls` at an offset past its last item returns `No roll calls at offset <n>; bill <id> has
<total>.` An `offset` beyond the row count in a tool that reports `total` — `get_rollcalls`,
`get_documents`, `list_sessions` — can instead fail with `Error: Database error.` and
`isError: true`. Both mean the list ended, and neither is evidence about the bill. `search_bills`
and `search_people` return an empty page at any offset.

### The cursor envelope

```json
{ "count": 20, "has_more": true, "next_cursor": "b41e...", "items": [] }
```

Used by `get_votes` and `get_person_votes`. `next_cursor` is `null` on the last page.

---

## Bills

### `search_bills`

All parameters optional; with none supplied it returns the most recent bills. Ordered by `date`
descending, nulls last.

| Parameter | Type | Notes |
| --- | --- | --- |
| `bill` | string, max 50 | Bill number, whitespace-insensitive |
| `query` | string, max 500 | Each word a separate title/synopsis substring, ORed, plus full-text search over attached documents |
| `subject` | string | Exact match against an entry in the `subjects` array |
| `status` | string, max 100 | Partial, case-insensitive match on the recorded status text |
| `session_id` | UUID | From `list_sessions` |
| `session_name` | string, max 200 | Partial, case-insensitive match on the session name, e.g. `"2025"` |
| `division_id` | UUID | From `list_states` |
| `sponsor_id` | UUID | From `search_people`; matches the `sponsors` array |

Items carry `id`, `bill`, `title`, `synopsis`, `status`, `type`, `date`, `subjects`, `headline`,
`session_id`, `division_id`, `sponsors`, `count_documents`, `documents`.

**Count a bill's documents with `get_documents`.** Report its `total`, not `count_documents`.

**Bill numbers match exactly, in either stored spelling.** `bill: "HB 314"` matches `HB 314` and
`HB314` and nothing else — not `HB 3140` or `HB 5314`. Verified 2026-09-26: `bill: "SB 8"` scoped to
Texas returned the four SB8 bills from four sessions and no other numbers. The same number repeats
across sessions and states, so scope by `division_id` and a session, and read each result's session
before reporting.

**`session_name` filters by session name without a UUID.** It is a partial match, so `"2025"` covers
every 2025 session, regular and special; use `session_id` from `list_sessions` to pin one session.
Add `division_id` to scope the name to one state. Verified 2026-09-26: `bill: "SB 8"`, Texas,
`session_name: "Regular Session"` returned the two regular-session SB8s. A name matching no
session returns a message naming `list_sessions` instead of results; one matching more than 100
sessions asks for a `division_id` or a more specific name.

**`query` runs two searches and ORs them.** Document text is searched with PostgreSQL `websearch`
full-text search, capped at 200 document rows resolving to at most 50 distinct bills. Separately
the string is split on whitespace; `or`, `and`, `not` and single characters are dropped, and up to
8 remaining terms become `title ILIKE` / `synopsis ILIKE` clauses.

The ILIKE terms are ORed, so each extra word widens the title/synopsis matches rather than
narrowing them: `"school choice"` matches every bill with "school" in its title or synopsis. Prefer
one distinctive word.

The full-text document rows are fetched across every state before any other filter applies, so
`division_id`, `session_id`, and the rest narrow those 50 bills but never reach past them. These
caps bound recall, not just cost: a broad `query` can miss matching bills beyond the 50-bill
full-text ceiling, and a long one silently ignores terms past the eighth. Try another distinctive
word or narrow with `subject` rather than lengthening the query string, and say which query ran.

**`status` matches any status containing the string.** `status: "Passed"` matches every status
whose text contains "Passed", which can record one chamber's passage rather than enactment. Report
each bill's `status` as recorded, and never treat a `status` filter as proof a bill became law.

### `get_bill`

`id` (UUID, required). `structuredContent` is the full row — adding `created_at`, `modified_on`,
and the `openstates` JSONB column (may be `null`) to the `search_bills` fields — not a pagination
envelope. There is no `legiscan` column.

A missing id is not an error: returns the text `No bill found with id=<id>.` and no
`structuredContent`.

### `get_bill_dossier`

`bill_id` (UUID, required), from `search_bills` or `get_bill`. Returns normalized bill, jurisdiction,
session, sponsors, document metadata, the first page of roll calls, and partial-data warnings for a
bill workspace. It omits full document text and source blobs. Use `get_latest_bill_document` for
the text and `get_rollcalls` with the next offset when more roll calls are available.

### `show_bill`

`id` (UUID, required). Like the other workspace/display tools, it has no `response_format`.

Renders an interactive card that expands to a fullscreen workspace in hosts supporting MCP Apps,
via `ui://cicada-guide/bill-workspace-v7.html`. `content` still holds a markdown summary, so calling
it in a host without card support is always safe. `structuredContent` adds `_display.divisionName`
and `_display.sessionName`.

Use `show_bill` when the user wants to look at a bill; `get_bill` when they want its contents read
back.

### `get_latest_bill_document`

`bill_id` (UUID, required). Newest document by `date` then `created_at`, both descending, nulls
last.

```json
{ "bill_id": "...", "total_documents": 3, "text_source": "clean_text", "text": "AN ACT to ...",
  "item": { "id": "...", "url": "...", "format": "PDF", "clean_text": "...", "raw_text": null } }
```

`text_source` is `"clean_text"`, `"raw_text"`, `"document_url"`, or `null`. The tool tries stored
`clean_text`, then `raw_text`, then fetches `item.url`. The network fallback aborts after 10
seconds or 2 MB and returns `null` text rather than failing. HTML is stripped to plain text;
binary content types yield `null`.

### `get_documents`

`bill_id` (UUID, required), plus `limit` / `offset`. Metadata only — no document text. Ordered by
`date` descending, nulls last. Items carry `id`, `bill_id`, `status`, `date`, `url`, `type`,
`format`, `summarization`.

---

## People

### `search_people`

| Parameter | Type | Notes |
| --- | --- | --- |
| `ids` | UUID array, **1-100** | Resolve a batch of person ids in one call. Hard cap — split larger sets across calls |
| `name` | string | Partial match across `full_name`, `first_name`, `last_name` |
| `query` | string | Alias for `name`. When both are set, `name` wins |
| `party` | string, max 100 | Case-insensitive. Matches a party abbreviation exactly (`"D"`, `"R"`; a spelled-out name such as `"Democratic"` maps to its abbreviation) or the party name partially |

Ordered by `last_name`. Returns `id`, `full_name`, `first_name`, `middle_name`, `last_name`,
`suffix`, `party`, `nickname`.

**There is no jurisdiction, chamber, or district field, and no `division_id` filter.** A search for
a common surname matches legislators nationwide and the result cannot separate them, and
`get_person` no longer helps: it returns no role, chamber, district, or jurisdiction either. The
one jurisdiction signal left is vote history. Call `get_person_votes` on each candidate and read
`bill.division_id` (and `bill.session_id`) off the returned items; resolve the division with
`list_states`. Chamber and district cannot be confirmed from any tool, so do not claim them.

**100 is a hard cap, and chambers are bigger than that.** Verified 2026-09-05: an ordinary
Alabama House roll call returned **103** distinct legislators, and passing all 103 to `ids` in one
call fails with `Too big: expected array to have <=100 items at ids`. Georgia's House seats 180 and
Texas's 150. Chunk the id list into batches of up to 100 and check `unresolved_ids` on each batch.
A bill's `sponsors` array is small enough that one call is normally sufficient; a chamber's voters
are not.

**Same-name rows are different people.** Verified 2026-09-24: `search_people` for "Reynolds"
returns three distinct people, and a `name` search for "Smith" returns 24 rows — including two
Charles Smiths, one `D` and one `R`. Matching name, party, and `bill.division_id` fits two
legislators in different chambers or years. Never combine their records. List the candidates with
the evidence found for each — party, jurisdiction, and the date range of their recorded votes — and
ask which one the user means.

**`ids` is how vote records become names.** When `ids` is present the effective page size widens to
`max(limit, ids.length)`, so one call returns the whole batch instead of silently paginating. The
envelope gains `unresolved_ids` listing ids that matched no row — present only when `ids` was
supplied, so a caller never reports fewer legislators than it asked about. When every id misses,
the tool returns explanatory text instead of an empty envelope.

### `get_person`

`id` (UUID, required). Returns `id`, `created_at`, the name fields, `party`, and `contact_details`
(may be `null`) — nothing about jurisdiction, chamber, district, or role, and no `legiscan` object. A
missing id returns `No person found with id=<id>.` Prefer `search_people` with `ids` for more than
one person. Call it only when contact details are wanted; it adds nothing to disambiguation.

### `show_person_record`

`id` (UUID, required), from `search_people` after resolving identity. Opens an interactive
legislator record with enriched voting history. Hosts without MCP Apps support receive the resolved
person as text. It has no `response_format`.

---

## Votes

### `get_rollcalls`

`bill_id` (UUID, required), plus `limit` / `offset`. Aggregate floor-vote summaries, ordered by
`date` descending, nulls last. Items carry `id`, `bill_id`, `date`, `description`, `counts`,
`linked_via`; the envelope adds `warnings`, normally empty.

```json
{ "id": "...", "bill_id": "...", "date": "2025-05-06",
  "description": "Motion to Read a Third Time and Pass - Roll Call 943",
  "counts": { "yea": 34, "nay": 0, "absent": 0, "nv": 0, "total": 34 }, "linked_via": "bill" }
```

**`counts` is tallied from the recorded individual votes, not from an official tally.** It is `null`
when no individual votes are recorded for the roll call, which means "not recorded", never a 0-0
vote. Tally values are numbers. Verified 2026-09-24. Report each roll call's own `counts`; never
add counts across roll calls.

**No field says whether the measure passed, and no field names the chamber.** Do not derive
passage from `yea > nay`: thresholds vary (supermajorities, majorities of members elected), and
`counts` reflects only the votes the dataset recorded. Report the tallies, and state passage only
when the `description` or the bill's `status` says it.

Start here for "how was this bill voted on", then pass a rollcall `id` to `get_rollcall_breakdown`.

**Roll calls linked through their votes are included.** A roll call can be tied to the bill
directly or through its recorded votes; both come back here, and `linked_via` is `"bill"` or
`"votes"`. On a `"votes"` item `bill_id` is `null`. No reconciliation through `get_votes` is needed.
Relay anything in `warnings` alongside the list. Verified 2026-09-26.

### `get_votes`

One row per legislator per rollcall.

| Parameter | Type | Notes |
| --- | --- | --- |
| `rollcall_id` | UUID | Preferred filter |
| `bill_id` | UUID | Votes across every rollcall on a bill |
| `people_id` | UUID | One legislator's votes |
| `category` | `YEA` \| `NAY` \| `ABSENT` \| `NV` | Not sufficient on its own |
| `limit` | integer 1-100 | |
| `cursor` | UUID | `next_cursor` from the previous response |

**At least one of `rollcall_id`, `bill_id`, `people_id` is required.** Omitting all three returns
`Error: Provide at least one of rollcall_id, bill_id, or people_id to filter the ~4.8M vote records.`
This is enforced by the handler at runtime, not by the schema — so it arrives as a normal tool
result containing error text, not a protocol validation rejection.

**No `offset` parameter.** Ordering is by row UUID ascending for deterministic, index-efficient
pages. The handler fetches `limit + 1` rows to set `has_more` without a `COUNT` scan, which is why
the envelope has no `total`.

Items carry `id`, `category`, `people_id`, `rollcall_id`, `bill_id` — no names.

**`No votes found` on a roll call matches `counts: null`.** Because `counts` is tallied from these
same rows, a roll call with `null` counts has no member votes to page. Report the
member-by-member breakdown as unavailable. Never present it as nobody having voted.

### `get_rollcall_breakdown`

`rollcall_id` (UUID, required), from `get_rollcalls`, `get_bill_dossier`, or `get_votes`. It has no
`response_format`. Returns the whole breakdown for one roll call in one call. Verified 2026-09-26.

```json
{ "rollcall": { "id": "...", "bill_id": "...", "date": "2025-08-28", "description": "Amendment tabled RV#121" },
  "counts": { "YEA": 83, "NAY": 47, "ABSENT": 18, "NV": 2, "total": 150 },
  "by_party": [ { "party": "D", "YEA": 0, "NAY": 47, "ABSENT": 15, "NV": 0, "total": 62 },
                { "party": "R", "YEA": 83, "NAY": 0, "ABSENT": 3, "NV": 2, "total": 88 } ],
  "members": [ { "vote_id": "...", "people_id": "...", "name": "...", "party": "R", "category": "YEA" } ],
  "returned": 150, "unresolved_people": 0, "partial": false }
```

- `by_party` is the per-party tally; `party: null` means no party is recorded.
- `members` names every legislator with their `party` and `category`, so no `get_votes` paging or
  `search_people` resolution is needed for a breakdown.
- The `counts` keys are upper-case here and lower-case in `get_rollcalls`.
- The member list is capped at 500 rows. `partial: true` means the cap was reached; `by_party`
  then covers only the rows returned, so say so.
- A roll call with no individual vote rows returns zero `counts` and empty `members`, and the text
  reads `0 yea, 0 nay, 0 absent, 0 not voting` followed by `No individual votes are recorded for
  this roll call.` That is not a 0-0 vote: report the counts as not recorded.

### `get_person_votes`

One legislator's voting history in reverse legislative chronology, with bill and rollcall context
already joined.

| Parameter | Type | Notes |
| --- | --- | --- |
| `people_id` | UUID, **required** | From `search_people` |
| `category` | `YEA` \| `NAY` \| `ABSENT` \| `NV` | |
| `session_id` | UUID | Excludes votes whose roll call has no bill |
| `start_date` | `YYYY-MM-DD` | Inclusive lower bound |
| `end_date` | `YYYY-MM-DD` | Inclusive upper bound |
| `latest` | boolean, default `false` | Return only the single most recent matching vote, no cursor |
| `limit` | integer 1-100 | |
| `cursor` | string, max 512 | Opaque `next_cursor` from the previous response |

The envelope adds `retrieved_at`, `source_freshness`, `ordering`, and `active_filters` to `count`,
`has_more`, `next_cursor`, and `items`. Each item is nested (verified 2026-09-24):

```json
{ "vote": { "id": "...", "category": "YEA" },
  "person": { "id": "...", "name": "...", "party": "R" },
  "rollcall": { "id": "...", "date": "2025-09-03", "description": "Read 3rd time",
                "outcome": { "yea": 17, "nay": 8, "absent": 4, "nv": 1 } },
  "bill": { "id": "...", "bill": "HB7", "title": "...", "status": "Engrossed",
            "session_id": "...", "division_id": "...", "source_url": null, "type": "Bill" } }
```

- **`rollcall.outcome` is the roll call's recorded tallies, not a pass/fail result.** It is `null`
  when the roll call has no recorded individual votes. There is no chamber and no passed field.
- **`bill` is `null` when the vote is attached to no bill**, such as a procedural motion. Report
  those by roll-call description and date; do not attach a bill to them.
- **`bill` carries ids, not names.** Resolve `division_id` through `list_states` and `session_id`
  through `list_sessions` when the answer needs the state or session name. `bill.division_id` is
  also the only jurisdiction evidence any tool returns for a legislator.
- **Same-day order is not chronology.** `ordering` is `rollcall.date DESC`, `rollcall.id DESC`,
  `vote.id DESC` — within one date, rows sort by UUID. `latest: true` therefore picks arbitrarily
  among votes cast on the latest date. For a "most recent vote" question, fetch a page and keep
  paging with `cursor` while `has_more` is true and the page's last item still carries the newest
  `rollcall.date`; report every vote on that date unless a description establishes their order.

Prefer this over `get_votes` with `people_id` — it needs no follow-up enrichment.

---

## Jurisdictions and sessions

### `list_states`

`name` (string, optional, partial case-insensitive match). Filters divisions to `type = "State"`,
ordered by `name`.

**Returns exactly 51 divisions: the 50 states plus the District of Columbia.** No territories —
Puerto Rico, Guam, the U.S. Virgin Islands, American Samoa and the Northern Mariana Islands are not
in the dataset. DC is the one non-state division, and its `geoidfq` is `null` where states carry a
two-digit Census code. Verified against the live server 2026-09-05.

Does not paginate: `offset` is always `0`, `has_more` always `false`, `next_offset` always absent.
Items carry `id`, `name`, `geoidfq`. Use a returned `id` as `division_id`.

### `list_sessions`

`division_id` (UUID, optional), `name` (string, optional), plus `limit` / `offset`. Ordered by
`convenes` descending, nulls last. Items carry `id`, `name`, `division_id`, `convenes`,
`adjourns`. Use a returned `id` as `session_id` in `search_bills`.

---

## Documents

### `read_pdf_bytes`

Streams a PDF in base64 chunks using HTTP Range requests. It returns file bytes, not readable text:
read a bill's text with `get_latest_bill_document`, and give the user an older version's `url` from
`get_documents` rather than reading its bytes.

| Parameter | Type | Default | Constraints |
| --- | --- | --- | --- |
| `url` | string, required | — | Must parse as a URL |
| `offset` | integer | `0` | Byte offset, not a row offset |
| `chunk_size` | integer | `750000` | 1 - 2,000,000 bytes |

```json
{ "bytes": "JVBERi0xLjQK...", "offset": 0, "byteCount": 750000, "totalBytes": 2400000, "hasMore": true }
```

**The next offset is `offset + byteCount`, not `byteCount`.** The two are equal only for the first
chunk, where `offset` is 0; treating `byteCount` as the next offset re-reads chunk 2 forever on any
document past 1.5 MB. Accumulate: chunk 3 of the 2.4 MB example above starts at 1,500,000.

`totalBytes` comes from the `Content-Range` header and is `undefined` when the server omits it;
`hasMore` then falls back to "the chunk came back full".

Markdown output deliberately omits the base64 payload and prints only chunk metadata. Read
`structuredContent.bytes`, or pass `response_format: "json"`.

The tool refuses to fetch in four cases, each returning explanatory text:

| Condition | Message |
| --- | --- |
| Scheme is not `https:` | `Unable to read PDF: Only https URLs are supported.` |
| Host not on the allowlist | `Unable to read PDF: This host is not on the allowed list of known legislative document sources.` |
| Status is not `206` | `PDF source does not support byte-range requests (expected HTTP 206).` |
| `Content-Type` is not `application/pdf` | `Response content-type is not a PDF (application/pdf).` |

Fetches run with `redirect: "manual"`, so redirects are rejected rather than followed.

---

## Exploration

### `open_research_desk`

Takes only the wrapper's `context` and `llm_model`. Opens an interactive research desk with state
and session filters, bill search, legislator search, and links to bill and voting-record
workspaces. Use it when the user
wants to explore rather than retrieve a known record. Hosts without MCP Apps support receive a
short text fallback. It has no `response_format`.
