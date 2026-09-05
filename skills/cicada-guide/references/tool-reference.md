# cicada-guide tool reference

Verified against server `cicada-guide-mcp-server` 1.2.0, MCP protocol revision `2025-06-18`, on
2026-09-05. The endpoint is unversioned, so re-check this document against a live `tools/list` if
tool behavior appears to disagree with it.

13 tools over MCP Streamable HTTP. All read-only in effect: they retrieve legislative data and
never modify it. Every invocation emits an analytics event, which is why the descriptors carry
`readOnlyHint: false` alongside `destructiveHint: false`, `idempotentHint: true`,
`openWorldHint: false`.

Every input schema is strict — an unknown parameter is rejected before the handler runs.

## Parameters shared by most tools

| Parameter | Type | Default | Constraints |
| --- | --- | --- | --- |
| `context` | string | — | Accepted by every tool. 15-25 words, third person, no personal data. Advertised as required; not enforced by the server. |
| `limit` | integer | `20` | 1-100 |
| `offset` | integer | `0` | >= 0. Absent on `get_votes` and `get_person_votes`. |
| `response_format` | `"markdown"` \| `"json"` | `"markdown"` | Absent on `show_bill`. |

Every tool returns a `content` array of text blocks. List tools also return `structuredContent`
holding the typed envelope. Text truncates at 25,000 characters with a pagination hint.

Errors never throw: a failed tool returns one text block beginning with `Error:` and no
`structuredContent`.

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

**Bill-number matching is loose by design.** The pattern splits the alpha prefix from the digits
and joins with `%`, so `"HB 314"` matches both `HB 314` and `HB314` — and, because of the trailing
wildcard, also `HB 3140`. Confirm the `bill` field on each result.

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

`id` (UUID, required). The only tool with no `response_format`.

Renders an interactive card in hosts supporting MCP Apps, via the registered resource
`ui://cicada-guide/bill-card-v2.html`. `content` still holds a markdown summary, so calling it in
a host without card support is always safe. `structuredContent` adds `_display.divisionName` and
`_display.sessionName`.

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
`format`, `summarization`, `legiscan`.

---

## People

### `search_people`

| Parameter | Type | Notes |
| --- | --- | --- |
| `ids` | UUID array, 1-100 | Resolve a batch of person ids in one call |
| `name` | string | Partial match across `full_name`, `first_name`, `last_name` |
| `party` | string | Partial, case-insensitive: `"D"`, `"R"`, `"Democratic"` |

Ordered by `last_name`. Returns `id`, `full_name`, `first_name`, `middle_name`, `last_name`,
`suffix`, `party`, `nickname`.

**There is no jurisdiction, chamber, or district field, and no `division_id` filter.** A search for
a common surname matches legislators nationwide and the result cannot separate them. To
disambiguate, call `get_person` on each candidate and read role and district out of the `legiscan`
JSONB, or check which candidate has votes in the expected jurisdiction via `get_person_votes`.

**`ids` is how vote records become names.** When `ids` is present the effective page size widens to
`max(limit, ids.length)`, so one call returns the whole batch instead of silently paginating. The
envelope gains `unresolved_ids` listing ids that matched no row — present only when `ids` was
supplied, so a caller never reports fewer legislators than it asked about. When every id misses,
the tool returns explanatory text instead of an empty envelope.

### `get_person`

`id` (UUID, required). Full row including `contact_details` and `legiscan` JSONB. A missing id
returns `No person found with id=<id>.` Prefer `search_people` with `ids` for more than one
person.

---

## Votes

### `get_rollcalls`

`bill_id` (UUID, required), plus `limit` / `offset`. Aggregate floor-vote summaries, ordered by
`date` descending, nulls last. Items carry `id`, `bill_id`, `date`, `description`, `legiscan`.

Yea / nay / absent / passed totals live inside the `legiscan` JSONB. Markdown output surfaces them
as `**Yea**`, `**Nay**`, `**Absent**`, `**Passed**` lines; JSON leaves them nested.

A bill with no recorded floor vote returns explanatory text, not an error.

Start here for "how was this bill voted on", then pass a rollcall `id` to `get_votes`.

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
