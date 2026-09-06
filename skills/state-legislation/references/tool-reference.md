# cicada-guide tool reference

Verified against server `cicada-guide-mcp-server` 1.2.0, MCP protocol revision `2025-06-18`, on
2026-09-06. The endpoint is unversioned, so re-check this document against a live `tools/list` if
tool behavior appears to disagree with it.

The tools below are the complete `tools/list` as of that date. A tool absent from this file is
absent from the server — never call one this document does not describe.

Re-confirmed live on 2026-09-06 against Alabama, Georgia and Texas records: `list_states` returns 51
divisions (50 states + DC, no territories); `search_people.ids` carries `minItems: 1, maxItems: 100`;
`show_bill` declares only `id` and `context`, with no `response_format`; `get_votes` has `cursor` and
no `offset`, and its cursor is a UUID while `get_person_votes` takes a 512-character string.

No response envelope observed on any tool carries a `duplicate_ids` or `merged_person_ids` field. Do
not write logic that waits for one.

Served over MCP Streamable HTTP. All read-only in effect: they retrieve legislative data and
never modify it. Every invocation emits an analytics event, which is why the descriptors carry
`readOnlyHint: false` alongside `destructiveHint: false`, `idempotentHint: true`,
`openWorldHint: false`.

Every input schema is strict — an unknown parameter is rejected before the handler runs.

## Parameters shared by most tools

| Parameter | Type | Default | Constraints |
| --- | --- | --- | --- |
| `context` | string | — | Accepted by every tool. 15-25 words, third person, no personal data. See the note below — it is not a declared parameter. |
| `limit` | integer | `20` | 1-100 |
| `offset` | integer | `0` | >= 0. Absent on `get_votes` and `get_person_votes`. |
| `response_format` | `"markdown"` \| `"json"` | `"markdown"` | Absent on `show_bill`. |

**`context` is injected, not declared.** No tool schema on the server declares `context` — the
analytics wrapper adds it to the published schema and strips it before the strict validation runs.
That is why the published schema marks it required while a call without it still succeeds. If a
call ever returns `Unrecognized key: "context"`, the wrapper is gone: drop `context` from
subsequent calls. Every other shared parameter is genuinely declared and unaffected.

Every tool returns a `content` array of text blocks. List tools also return `structuredContent`
holding the typed envelope. Text truncates at 25,000 characters with a pagination hint.

### Errors arrive as results, in two shapes

Neither shape throws. Both carry `isError: true` and no `structuredContent`.

| Shape | Looks like | Raised by |
| --- | --- | --- |
| Handler-level | Text block beginning `Error:` | The handler, after validation passed — e.g. `get_votes` with no entity filter |
| Schema-level | `MCP error -32602: Input validation error:` naming the offending key | Strict schema validation, before the handler runs — e.g. an unrecognized parameter |

The distinction matters when recovering: a schema-level failure means the *argument set* is wrong
and must change, while a handler-level failure often means a required filter is merely missing.

### The offset envelope

```json
{ "total": 128, "count": 20, "offset": 0, "has_more": true, "next_offset": 20, "items": [] }
```

`next_offset` is omitted when `has_more` is `false`. `total` is present only where an exact count
is cheap — `list_states`, `list_sessions`, `get_documents`, `get_rollcalls`. It is **absent** from
`search_bills`, `search_people`, and `get_votes`. `get_latest_bill_document` is not a pagination
envelope at all and reports `total_documents` instead.

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
| `query` | string, max 500 | Title/synopsis substring plus full-text search over attached documents |
| `subject` | string | Exact match against an entry in the `subjects` array |
| `status` | string | Partial, case-insensitive |
| `session_id` | UUID | From `list_sessions` |
| `division_id` | UUID | From `list_states` |
| `sponsor_id` | UUID | From `search_people`; matches the `sponsors` array |

Items carry `id`, `bill`, `title`, `synopsis`, `status`, `type`, `date`, `subjects`, `headline`,
`session_id`, `division_id`, `sponsors`, `count_documents`, `documents`.

**`count_documents` is unreliable.** Verified 2026-09-05: Alabama HB94 reports `count_documents: 0`
while `get_documents` returns `total: 2`. Trust `get_documents` / `get_latest_bill_document`.

**Bill-number matching is loose by design, and the wildcard is interior.** The pattern splits the
alpha prefix from the digits, joins them with `%`, and appends a trailing `%` — `"HB 314"` becomes
`HB%314%`. Because that first wildcard sits **between** the prefix and the digits, this is not merely
a longer-number match: `"HB 314"` matches `HB 314` and `HB314`, but also `HB 3140` **and** `HB 5314`,
`HB 1314`, `HB 2314`.

Verified 2026-09-06: `bill: "HB94"` scoped to Alabama returned 21 rows — HB194, HB294, HB394, HB494,
HB594, and only three genuine HB94s. Results order by `date` descending, so the nine most recent rows
were all the wrong bill and the exact match landed tenth. Confirm the `bill` field on every result,
and do not assume the exact match is on the first page.

**`query` runs two searches and ORs them.** Document text is searched with PostgreSQL `websearch`
full-text search, capped at 200 document rows resolving to at most 50 distinct bills. Separately
the string is split on whitespace; `or`, `and`, `not` and single characters are dropped, and up to
8 remaining terms become `title ILIKE` / `synopsis ILIKE` clauses.

These caps bound recall, not just cost: a broad `query` can miss matching bills beyond the 50-bill
full-text ceiling, and a long one silently ignores terms past the eighth. Narrow with
`division_id`, `session_id`, or `subject` rather than lengthening the query string.

### `get_bill`

`id` (UUID, required). `structuredContent` is the full row — including the `legiscan` and
`openstates` JSONB columns that `search_bills` omits — not a pagination envelope.

A missing id is not an error: returns the text `No bill found with id=<id>.` and no
`structuredContent`.

### `show_bill`

`id` (UUID, required). Like the two other app display tools, it has no `response_format`.

Renders an interactive card that expands to a fullscreen workspace in hosts supporting MCP Apps,
via `ui://cicada-guide/bill-workspace-v3.html`. `content` still holds a markdown summary, so calling it in
a host without card support is always safe. `structuredContent` adds `_display.divisionName` and
`_display.sessionName`.

Use `show_bill` when the user wants to look at a bill; `get_bill` when they want its contents read
back.

### `open_research_desk`

No parameters beyond optional analytics `context`. Opens
`ui://cicada-guide/research-desk-v1.html`, whose state/session controls and search results call the
existing list, search, `show_bill`, and `show_person_record` tools through the MCP Apps bridge.

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
`format`, `summarization`, `legiscan`.

---

## People

### `search_people`

| Parameter | Type | Notes |
| --- | --- | --- |
| `ids` | UUID array, **1-100** | Resolve a batch of person ids in one call. Hard cap — split larger sets across calls |
| `name` | string | Partial match across `full_name`, `first_name`, `last_name` |
| `party` | string | Partial, case-insensitive: `"D"`, `"R"`, `"Democratic"` |

Ordered by `last_name`. Returns `id`, `full_name`, `first_name`, `middle_name`, `last_name`,
`suffix`, `party`, `nickname`.

**There is no jurisdiction, chamber, or district field, and no `division_id` filter.** A search for
a common surname matches legislators nationwide and the result cannot separate them. To
disambiguate, call `get_person` on each candidate and read role and district out of the `legiscan`
JSONB, or check which candidate has votes in the expected jurisdiction via `get_person_votes`.

**100 is a hard cap, and chambers are bigger than that.** Verified 2026-09-05: an ordinary
Alabama House roll call returned **103** distinct legislators, and passing all 103 to `ids` in one
call fails with `Too big: expected array to have <=100 items at ids`. Georgia's House seats 180 and
Texas's 150. Chunk the id list into batches of up to 100 and check `unresolved_ids` on each batch.
A bill's `sponsors` array is small enough that one call is normally sufficient; a chamber's voters
are not.

**Two rows with one name may be one person stored twice.** Compare `legiscan.people_id` via
`get_person` before treating candidates as distinct people: when it matches, they are duplicates —
collapse them rather than asking the user to choose. Sponsor arrays can duplicate the same way, so
the length of `sponsors` can overstate how many legislators sponsored a bill.

Duplication is not the default reading, and the dataset is not uniformly duplicated. Verified
2026-09-06: `search_people` for "Rex Reynolds" returns a single row, and a `name` search for "Smith"
returned 23 rows that were all distinct people. Check `legiscan.people_id` to decide; do not assume a
split.

**When rows do duplicate, the votes may sit on one of them or be spread across several.** Probe each
sibling with `get_person_votes` and union the results, rather than reporting from whichever row came
first — an empty duplicate would state that a sitting legislator has never voted. Union them; never
add counts across siblings.

**`ids` is how vote records become names.** When `ids` is present the effective page size widens to
`max(limit, ids.length)`, so one call returns the whole batch instead of silently paginating. The
envelope gains `unresolved_ids` listing ids that matched no row — present only when `ids` was
supplied, so a caller never reports fewer legislators than it asked about. When every id misses,
the tool returns explanatory text instead of an empty envelope.

### `get_person`

`id` (UUID, required). Full row including `contact_details` and `legiscan` JSONB. A missing id
returns `No person found with id=<id>.` Prefer `search_people` with `ids` for more than one
person.

### `show_person_record`

`id` (UUID, required). Opens `ui://cicada-guide/legislator-record-v1.html` with the resolved
person record, then loads `get_person_votes` inside the app. Use only after resolving duplicate or
ambiguous people; the visual workspace is not a substitute for identification.

---

## Votes

### `get_rollcalls`

`bill_id` (UUID, required), plus `limit` / `offset`. Aggregate floor-vote summaries, ordered by
`date` descending, nulls last. Items carry `id`, `bill_id`, `date`, `description`, `legiscan`.

Yea / nay / absent / passed totals live inside the `legiscan` JSONB. Markdown output surfaces them
as `**Yea**`, `**Nay**`, `**Absent**`, `**Passed**` lines; JSON leaves them nested.

A bill with no recorded floor vote returns explanatory text, not an error.

**Rows can duplicate per real floor vote, and `legiscan.roll_call_id` does not identify the
duplicates.** Verified 2026-09-06 on Texas SB8: `get_rollcalls` returned `total: 21`, including three
rows with identical `date`, `chamber`, `description` ("Senate concurs in House amendment(s)") and
identical yea/nay/absent tallies — but **three different** `legiscan.roll_call_id` values (1601684,
1602015, 1601038). Grouping by `legiscan.roll_call_id` reports 21 distinct floor votes for a bill
that had 19.

**Deduplicate on the (date, chamber, description, tallies) tuple, not on an id.** Treat rows matching
on all four as one floor vote. `total` counts rows, so it overstates how many floor votes occurred
wherever duplicates are present.

**Do not accumulate votes across duplicate rows.** Verified 2026-09-06: two of the three Texas
siblings were probed and each returned vote records rather than `No votes found` — this is not the
one-populated-row-and-two-empty shape. Since the siblings report identical tallies, treat each as
carrying its own copy of the same floor vote: pick a single row and report from it alone. Iterating
siblings and summing would double- or triple-count the chamber.

Duplication is not universal. Alabama HB94 (2025 session) returns 4 rows for 4 distinct floor votes,
and Georgia HB327 returns 2 for 2. Detect the repeated tuple rather than assuming either shape.

Start here for "how was this bill voted on", then pass a rollcall `id` to `get_votes`.

**The nested `legiscan` object is not schema-stable across states.** Two variations, both verified
2026-09-06:

| Variation | Alabama | Georgia / Texas |
| --- | --- | --- |
| Date key | `"date"` | the key itself is double-quoted, so `legiscan.date` misses |
| Tally values | strings — `"yea": "34"` | numbers — `"yea": 49` |

Prefer the row's own top-level `date` column over `legiscan.date`, and coerce tally values before any
comparison or arithmetic — a sum across states otherwise mixes strings and numbers.

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

**`No votes found` has two different causes — check the cheap one first.**

1. **A voteless duplicate row.** Identify siblings by the matching (date, chamber, description,
   tallies) tuple, then retry `get_votes` with each sibling `id`. Stop at the first row that returns
   records and report from that row alone — siblings often each carry a full copy of the votes, so
   continuing to accumulate over-counts the chamber.
2. **A genuine coverage gap.** No sibling row has votes either. `votes` coverage is per-state and
   lags `rollcalls`. Verified 2026-09-06: Georgia HB327's House vote #129 reports `total: 180` via
   `get_rollcalls` — it has no duplicate rows, and `get_votes` returns nothing for it.

Only after exhausting the siblings should the breakdown be reported as unavailable. Never present
either case as nobody having voted.

### `get_person_votes`

One legislator's voting history in reverse legislative chronology, with bill and rollcall context
already joined.

| Parameter | Type | Notes |
| --- | --- | --- |
| `people_id` | UUID, **required** | From `search_people` / `get_person` |
| `category` | `YEA` \| `NAY` \| `ABSENT` \| `NV` | |
| `session_id` | UUID | |
| `start_date` | `YYYY-MM-DD` | Inclusive lower bound |
| `end_date` | `YYYY-MM-DD` | Inclusive upper bound |
| `latest` | boolean, default `false` | Return only the single most recent matching vote, no cursor |
| `limit` | integer 1-100 | |
| `cursor` | string | From the previous response |

Sorted by rollcall date descending, then same-day sequence descending, with deterministic
tiebreakers. Each item includes bill title, bill number, status, session, rollcall date,
description, outcome, chamber, passed status, and source URL.

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

Streams a PDF in base64 chunks using HTTP Range requests.

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
