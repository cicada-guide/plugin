# cicada-guide tool reference

Verified against the live endpoint's `tools/list`, MCP protocol revision `2025-06-18`, on
2026-09-27. The endpoint is unversioned, so re-check this document against a live `tools/list` if
tool behavior appears to disagree with it. Older behavioral observations below retain their dates.

The tools below match the live `tools/list` as of that date. Check the live list before concluding
an undocumented tool is unavailable. On 2026-09-27 live calls also confirmed fitted list pages,
`get_latest_bill_document`'s `text_offset` paging, `get_bill_dossier`'s markdown body,
`Error: Offset past end.`, the `get_person_votes` cursor error, and scoped `search_bills` full-text
search.

Re-confirmed live on 2026-09-06 against Alabama, Georgia and Texas records: `list_states` returns 51
divisions (50 states + DC, no territories); `search_people.ids` carries `minItems: 1, maxItems: 100`;
`get_votes` has `cursor` and no `offset`, and its cursor is a UUID while `get_person_votes` takes a
512-character string.

**Source `legiscan` objects are no longer returned.** Re-checked with live calls on 2026-09-24:
`get_bill`, `get_person`, `get_documents`, and `get_rollcalls` carry no `legiscan` field. Roll-call
tallies now arrive as a top-level `counts` object computed from recorded individual votes. No tool
returns a legislator's role, or an external source id for a person or roll call. Do not ask for
`legiscan` fields or build logic on them.

**Chamber and district come only from `show_official` and `show_person_record`.** State them only
as one of those returns them: the seat line in the text, or `office.chamber` and `office.district`
in `structuredContent`. When `office` is `null`, or the seat line is absent or reads
`Office and district: not recorded.`, they are not recorded. Never infer them from `search_people`,
`get_person`, a bill's `division_id`, or a roll-call description.

Served over MCP Streamable HTTP. All read-only: they retrieve legislative data and never modify
it, and the descriptors carry `readOnlyHint: true` alongside `destructiveHint: false` and
`idempotentHint: true`.
`openWorldHint` is `true` on `get_latest_bill_document` and `read_pdf_bytes`, which fetch documents
from legislative hosts outside the server, and `false` on every other tool.

Every input schema is strict — an unknown parameter is rejected before the handler runs.

## Shared parameters

| Parameter | Type | Default | Constraints |
| --- | --- | --- | --- |
| `context` | string | — | Declared and required by every published schema. 15-25 words, third person, no personal data or people's names. See the note below — the handler behind it does not declare it. |
| `llm_model` | string | — | Declared and required by every published schema. The exact model identifier of the calling model, or `"unknown"`. Added by the same wrapper as `context` — see below. |
| `limit` | integer | `20` | 1-100. Only on `search_bills`, `search_people`, `list_sessions`, `get_documents`, `get_rollcalls`, `get_votes`, and `get_person_votes`. |
| `offset` | integer | `0` | 0-10000. Only on `search_bills`, `search_people`, `list_sessions`, `get_documents`, and `get_rollcalls`. `get_votes` and `get_person_votes` page by `cursor`; `read_pdf_bytes` takes a byte `offset` of its own. |
| `response_format` | `"markdown"` \| `"json"` | `"markdown"` | Absent on `show_bill`, `show_person_record`, `show_official`, and `get_rollcall_breakdown`. Passing it to one of them fails with `-32602`. |

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
holding the typed envelope.

**List pages are fitted under 25,000 characters.** When a full page would render longer,
`search_bills`, `search_people`, `get_documents`, `get_rollcalls`, `list_sessions`, `get_votes`, and
`get_person_votes` return fewer items — the same ones in the text and in `items` — set `count` to
that number and `has_more` to `true`, and derive `next_offset` or `next_cursor` from the last item
returned. Following it resumes at the first item left out, so page as usual. Markdown adds a line
such as
`_Showing 12 of the requested 20 to stay under the 25,000-character limit; continue with offset=32._`
A `count` below `limit` is not the end of the list; only `has_more` is.

Any other text over 25,000 characters — one item longer than that, or a tool that returns no list —
is cut there with a pagination hint appended, in `response_format: "json"` as in markdown. Only a
response ending in that hint was cut. `get_latest_bill_document` pages its text separately, with
`text_offset`.

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

Markdown prints a progress line when more pages exist, e.g.
`_Showing 21–40 (of 95). Use offset=40 for the next page._`, without "of N" on `search_bills` and
`search_people`.

**Page only with `next_offset` while `has_more` is true; never compute an offset past it.** An
`offset` beyond the row count in `get_documents`, `list_sessions`, or `get_rollcalls` fails with
`Error: Offset past end. The offset is past the end of the results — the list has ended. Page only
while has_more is true.` and `isError: true`. `get_rollcalls` can instead return `No roll calls at
offset <n>; bill <id> has <total>.` Both mean the list ended, and neither is evidence about the
bill. `search_bills` and `search_people` return an empty page at any offset.

### The cursor envelope

```json
{ "count": 20, "has_more": true, "next_cursor": "b41e...", "items": [] }
```

Used by `get_votes` and `get_person_votes`. `next_cursor` is `null` on the last page. Pass it back
exactly as given; never construct one.

---

## Cards

`search_bills`, `show_bill`, `show_person_record`, and `show_official` carry an MCP Apps resource.
In a host that renders it, the call also puts an interactive card on screen; any other host gets
only the result. The cards fetch their own data over the bridge, so the card shows more than the
model receives.

**What reaches you is thinner than the card.** Depending on the host, you receive either the text
fallback or `structuredContent`. Neither includes what the card fetches for itself — floor votes,
sponsors, vote history. Get those from the data tools (`get_bill_dossier`, `get_rollcalls`,
`get_rollcall_breakdown`, `get_person_votes`, `get_latest_bill_document`), and base every written
claim on them.

**Don't re-list the card.** In a host that renders cards, its rows, tallies, and contact buttons
are already on screen. Write what the card does not show: the answer to the question, context, and
caveats. The host may not render cards at all, so the written answer must still stand on its own.

**A subagent's call renders nowhere.** A subagent returns the id and names the card that fits;
the main conversation calls it.

### Model-context updates

When the user selects something on a card, the host passes you a short text update, such as:

- `User is viewing HB 314 votes. Selected floor vote: <description>, <date>.`
- `User is reading <document> of HB 314.`
- `User is viewing <name>'s votes, filtered to Yea.`
- `User is viewing the voting record of <name>.`
- `User is viewing the contact card for <name>.`

They carry names and numbers, never ids. Map them to ids from earlier results in the conversation.
Answer "which vote am I looking at" from the update, without a tool call. For that vote's details,
find the roll call with `get_rollcalls` on the bill (match the description and date), then pass its
`id` to `get_rollcall_breakdown`.

---

## Bills

### `search_bills`

All parameters optional; with none supplied it returns the most recent bills. Ordered by `date`
descending, nulls last.

| Parameter | Type | Notes |
| --- | --- | --- |
| `bill` | string, max 50 | Bill number with its chamber prefix ("HB 314"); exact match ignoring case, spaces and dots. A number alone ("314") returns no bills and a prompt to add the prefix |
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
full-text search, capped at 200 document rows resolving to at most 50 distinct bills. When
`division_id`, `session_id`, or `session_name` is set, that search is scoped to the state or session
before the cap, so the 200 rows come from inside it. Separately the string is split on whitespace;
`or`, `and`, `not` and single characters are dropped, and up to 8 remaining terms become
`title ILIKE` / `synopsis ILIKE` clauses.

The ILIKE terms are ORed, so each extra word widens the title/synopsis matches rather than
narrowing them: `"school choice"` matches every bill with "school" in its title or synopsis. Prefer
one distinctive word.

With no `division_id`, `session_id`, or `session_name`, the full-text rows are drawn from every
state, so a nationwide search resolves at most 50 bills in all. `subject`, `status`, and
`sponsor_id` apply after the cap and only narrow those bills. These caps bound recall, not just
cost: a broad `query` can miss matching bills beyond the 50-bill full-text ceiling, and a long one
silently ignores terms past the eighth. Scope by state and session, try another distinctive word,
or narrow with `subject` rather than lengthening the query string, and say which query ran.

**`status` matches any status containing the string.** `status: "Passed"` matches every status
whose text contains "Passed", which can record one chamber's passage rather than enactment. Report
each bill's `status` as recorded, and never treat a `status` filter as proof a bill became law.

**Every call also renders a results card** in a host that supports MCP Apps, via
`ui://cicada-guide/bill-results-v13.html`. It lists the results with a "Show more" button that
pages with the same arguments. Tapping a result posts a user turn asking you to show that bill with
`show_bill` (see [`show_bill`](#show_bill)); the card opens no bill itself. You still receive
the full list as text or JSON, so read results from it as usual. Where the card renders, summarize
the results rather than tabulating every row it already shows.

### `get_bill`

`id` (UUID, required). `structuredContent` is the full row — adding `created_at`, `modified_on`,
and the `openstates` JSONB column (may be `null`) to the `search_bills` fields — not a pagination
envelope. There is no `legiscan` column.

A missing id is not an error: returns the text `No bill found with id=<id>.` and no
`structuredContent`.

### `get_bill_dossier`

| Parameter | Type | Notes |
| --- | --- | --- |
| `bill_id` | UUID, required | From `search_bills` or `get_bill` |
| `response_format` | `"markdown"` \| `"json"` | Default `"markdown"` |

Returns normalized bill, jurisdiction, session, resolved sponsors, document metadata, the first page
of roll calls, and partial-data warnings in one call — use it over `get_bill` when you also need
sponsor names and floor votes. It omits full document text and source blobs. Use
`get_latest_bill_document` for the text and `get_rollcalls` with the next offset when more roll
calls are available.

Markdown renders the same data as `structuredContent`: the bill number, title, state, session,
status and date; any warnings; sponsors (name, party, id); documents (type, date, URL); and roll
calls with their counts as yea, nay, absent, not voting, or `votes not recorded` when `counts` is
`null`, ending with a pointer to `get_rollcalls` when more exist. `response_format: "json"` returns
the object as text.

### `show_bill`

| Parameter | Type | Notes |
| --- | --- | --- |
| `id` | UUID, required | From `search_bills` or `get_bill` |
| `headline` | string, 1-120 characters, required | Your short plain-language headline for a voter, shown first on the card's title plate. Trimmed; a missing or empty one fails with `-32602` |
| `summary` | string, 1-1500 characters, required | Your plain-language summary for a voter, shown on the card. Trimmed; a missing or empty one fails with `-32602` |

Like the other display tools, it has no `response_format`.

Renders a bill card via `ui://cicada-guide/bill-workspace-v16.html` in hosts that support MCP Apps.
The card shows the state and session, the status, the bill number, and a title plate that shows your
`headline` first; tapping the plate toggles to the official title and back. Then come four tabs.
Overview holds the path to becoming law (Introduced, Engrossed, Enrolled, Enacted), the recorded
status, and your summary; Sponsors lists the sponsors; Documents lists each version with a Read
button that opens a viewer; Votes holds the floor votes with party splits and who voted how. The
card calls `get_bill_dossier` and `get_rollcall_breakdown` itself for the sponsors, documents, and
votes. The viewer draws a PDF's pages inside the card, fetching its bytes with `read_pdf_bytes`
itself, and shows the latest non-PDF version as text. Inline, a PDF opens on its first page; "Read
full screen" asks the host for full screen, which shows five pages at a time, and "Open original"
opens the document through the host. A document it can't show, or a refused "Open original", gets
the document URL as a link with a "Copy link" button. None of what the viewer
fetches reaches you: read a bill's text with `get_latest_bill_document`.

**The result carries none of that.** The text fallback holds the bill number, state and session,
title, status, type, date, synopsis (cut at 300 characters), subjects, the newest document's link,
the document count, and the `id` — no votes, no sponsors, and no echo of your `headline` or
`summary`. `structuredContent` is the bill row plus `_display.divisionName`, `_display.sessionName`,
`_display.aiHeadline` (your `headline`), and `_display.aiSummary` (your `summary`). A missing id
returns `No bill found with id=<id>.` Read votes and sponsors from `get_bill_dossier`,
`get_rollcalls`, and `get_rollcall_breakdown`, and the text from `get_latest_bill_document`.

Use `show_bill` when the user wants to look at a bill; `get_bill` when they want its contents read
back.

**Always pass both `headline` and `summary`, written for a voter.** Read the bill before calling,
then write them.

- `headline`: one short line, at most 120 characters, saying what the bill does, e.g. "Bans buying
  soda and candy with SNAP benefits". Plain text, no markdown, no trailing period needed. Never
  claim passage or an outcome. Write your own rather than copying the bill row's `headline` field.
- `summary`: say what the bill does, who it affects, and where it stands as recorded.
- Base both on `get_latest_bill_document` text or the synopsis. When neither text nor synopsis is on
  record, say so in the summary rather than guess, and write the headline from the official
  title alone.
- Never infer passage or an outcome; state the recorded `status`.
- Plain prose only. The card renders both as text, so markdown does not render.
- The card labels the summary "Summary · your AI assistant".

**"Show HB 314 … with show_bill" requests.** Tapping a bill in the `search_bills` results card, a
vote in the `show_person_record` card, or a sponsored bill's "Show in the conversation" button
posts a user turn: `Show HB 314 (bill id <uuid>) with show_bill. First read its text with
get_latest_bill_document, or its synopsis, and pass a short plain-language headline as headline
and a plain-language summary for a voter as summary: what it does, who it affects, and where it
stands.` Handle it in order: read the text with `get_latest_bill_document` (or the synopsis), then
call `show_bill` with that `id`, your `headline`, and your `summary`. A short chat answer is
optional.

### `get_latest_bill_document`

| Parameter | Type | Notes |
| --- | --- | --- |
| `bill_id` | UUID, required | From `search_bills` or `get_bill` |
| `text_offset` | integer 0-5000000, default `0` | Character offset into the text. Pass the previous `next_text_offset` |
| `response_format` | `"markdown"` \| `"json"` | Default `"markdown"` |

Newest document by `date` then `created_at`, both descending, nulls last.

```json
{ "bill_id": "...", "total_documents": 3, "text_source": "clean_text", "text": "AN ACT to ...",
  "text_offset": 0, "text_total_chars": 61234, "next_text_offset": 24410,
  "item": { "id": "...", "url": "...", "format": "PDF", "type": "Bill Text", "date": "2025-02-11" } }
```

**Long text comes in parts.** `text` holds the largest slice, from `text_offset`, that keeps the
whole response under 25,000 characters. `text_total_chars` is the full length; `next_text_offset`
is where the next part starts, or `null` once the text is complete. Until it is `null`, call again
with the same `bill_id` and `text_offset` set to it, and read every part before describing the bill.
Markdown prints the position before the text:
`_Characters 0–24410 of 61234. Continue with text_offset=24410._`, and on the last part
`This is the end of the text.` A text that fits in one response prints no position line, and its
`next_text_offset` is `null`. A `text_offset` at or past the end returns no text and says
`Omit text_offset to read from the start.` The text appears once, in `text`; `item` carries the
document's metadata, not its stored text.

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
`get_person` does not help: it returns no role, chamber, district, or jurisdiction either. For
jurisdiction, call `get_person_votes` on each candidate and read `bill.division_id` (and
`bill.session_id`) off the returned items; resolve the division with `list_states`. Chamber and
district come only from `show_official` or `show_person_record` on a candidate's `id`, as their
seat line or `office` returns them; when `office` is `null` they are not recorded. Never infer
them from these results.

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
the tool returns explanatory text instead of an empty envelope. If a batch does not fit under
25,000 characters, `has_more` is `true`: call again with the same `ids` and `offset` set to
`next_offset` for the rest. The first response's `unresolved_ids` covers the whole batch; use it,
and not any `unresolved_ids` on a later page of the same batch.

### `get_person`

`id` (UUID, required). Returns `id`, `created_at`, the name fields, `party`, and `contact_details`
(may be `null`) — nothing about jurisdiction, chamber, district, or role, and no `legiscan` object. A
missing id returns `No person found with id=<id>.` Prefer `search_people` with `ids` for more than
one person. It adds nothing to disambiguation, and for contact details `show_official` is the better
call: it returns every recorded option, sorted and checked.

### `show_official`

`id` (UUID, required), from `search_people` after resolving identity. It has no `response_format`.
Use it when the user wants to know who someone is or how to reach them. For how they voted, use
`get_person_votes` or `show_person_record`.

In a host that supports MCP Apps it renders a contact card via
`ui://cicada-guide/official-card-v11.html`: the photo, the seat line, party, contact buttons for
every entry in `contact_options` (several of one kind open as a list under the row), a district map when `office.outline` exists, and a Recent votes
panel. It shows no vote tally. The card asks the host for geolocation, and offers no location
toggle on mobile, where hosts grant none; when the viewer turns location on, the map places them and, below the map, reads "You're in this district." or
"You're not in this district." until dismissed; outside, a dashed line runs to the nearest edge. The
card and its recent-votes and map panels sit side by side at one width. The location
stays in the card and never reaches the server or you. The card does not show the term or other
seats held; the text and `structuredContent` do. The tally covers only the votes it names; never
use it to grade or rank.

The text fallback:

```text
## Rex Reynolds
State Representative · AL House · District 21
**Term**: 2022-11-08 to 2026-11-03 (2022 General Election)
**Party**: R
No email, website or phone number is on record.
**ID**: <id>
```

- **The seat line** is title · state chamber · `District N`, each part only when recorded. With no
  recorded seat, `Office and district: not recorded.` replaces it.
- The term line appears only when term dates are recorded.
- Contact lines are one `**Email**:`, `**Phone**:`, and `**Website**:` each, whichever are
  recorded, or `No email, website or phone number is on record.` when none is.
- A person with more than one seat gets the current one, with the others under `**Also held**:`.

`structuredContent` carries:

- `person` — the name fields, `party`, `contact_details`, and `photo_url`: a
  `https://public.cicada.guide/photos/<id>` proxy URL, or `null` when no photo is recorded.
- `office` — the current seat, or `null` when none is recorded: `title`, `chamber`, `state`,
  `district`, `division_id`, `division_name`, `term_start`, `term_end`, `election_name`,
  `election_date`, `current`, and `outline`, the district as GeoJSON or `null`.
- `other_offices` — earlier or concurrent seats, in the same shape without an outline.
- `contact` — the first `email`, `phone`, and `website`, each `null` when none is recorded.
- `contact_options` — every recorded entry as arrays: `emails`, `phones`, `websites` (official
  `.gov` and `.us` pages first), and `addresses`.

Contact details are absent for most officials. Report only the ones it returns, say "not on record"
for the rest, and never supply one from elsewhere.

### `show_person_record`

`id` (UUID, required), from `search_people` after resolving identity. It has no `response_format`.

In a host that supports MCP Apps it renders a legislator record via
`ui://cicada-guide/legislator-record-v16.html`: the seat (no contact buttons), the vote history
with session, vote, and subject filters, and the bills they sponsored. The card loads the votes
through `get_person_votes` itself; its session picker lists only sessions with the legislator's
votes, newest first, and its tally counts only the votes loaded, so never quote it as a career
total. Tapping a vote, or a sponsored bill's "Show in the conversation"
button, posts the same show-bill request as the results card (see [`show_bill`](#show_bill)); the
card opens no bill itself.

The text carries identity and seat only: the name, the seat line when a seat is recorded, party,
nickname, and `id`. It holds no votes, so call `get_person_votes` to read or summarize them.
`structuredContent` has the same `person`, `office`, `other_offices`, `contact`, and
`contact_options` as `show_official`. When the seat lookup fails, `office` is `null` and the record
still loads, so a `null` `office` here means the seat is not on record in this response.

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
`Error: Provide at least one of rollcall_id, bill_id, or people_id to filter the ~5.6M vote records.`
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
- A roll call with no individual vote rows returns zero `counts` and empty `members` and
  `by_party`, and the text reads `<label>: no individual votes recorded (not a 0-0 vote).` Report
  the counts as not recorded, never as a 0-0 vote.

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
| `latest` | boolean, default `false` | Return one vote from the newest rollcall date, no cursor. Ignores `cursor` |
| `limit` | integer 1-100 | |
| `cursor` | string, max 512 | Opaque `next_cursor` from the previous response, passed back exactly |

The envelope adds `retrieved_at`, `source_freshness`, `ordering`, and `active_filters` to `count`,
`has_more`, `next_cursor`, and `items`. Each item is nested (verified 2026-09-24):

```json
{ "vote": { "id": "...", "category": "YEA" },
  "person": { "id": "...", "name": "...", "party": "R" },
  "rollcall": { "id": "...", "date": "2025-09-03", "description": "Read 3rd time",
                "outcome": { "yea": 17, "nay": 8, "absent": 4, "nv": 1 } },
  "bill": { "id": "...", "bill": "HB7", "title": "...", "status": "Engrossed",
            "session_id": "...", "division_id": "...", "source_url": null, "type": "Bill",
            "subjects": ["Education"] } }
```

- **`bill.subjects` is in JSON only.** It is a string array, `[]` when none is recorded, and it
  appears in `structuredContent` and `response_format: "json"` but not in the markdown text. Pass
  `response_format: "json"` to group or filter a legislator's votes by subject.
- **`rollcall.outcome` is the roll call's recorded tallies, not a pass/fail result.** It is `null`
  when the roll call has no recorded individual votes. There is no chamber and no passed field.
- **`bill` is `null` when the vote is attached to no bill**, such as a procedural motion. Report
  those by roll-call description and date; do not attach a bill to them.
- **`bill` carries ids, not names.** Resolve `division_id` through `list_states` and `session_id`
  through `list_sessions` when the answer needs the state or session name. `bill.division_id` is
  jurisdiction evidence for the legislator, not their chamber or district.
- **Same-day order is not chronology.** `ordering` is `rollcall.date DESC`, `rollcall.id DESC`,
  `vote.id DESC` — within one date, rows sort by UUID. `latest: true` therefore picks arbitrarily
  among votes cast on the latest date. For a "most recent vote" question, fetch a page and keep
  paging with `cursor` while `has_more` is true and the page's last item still carries the newest
  `rollcall.date`; report every vote on that date unless a description establishes their order.

**A cursor it cannot place is an error, not an empty page.** It returns `Error: cursor is not a
next_cursor from get_person_votes. Omit cursor to restart from the newest vote.` Omit `cursor` to
start over from the newest vote; never build one.

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

Streams a PDF in base64 chunks using HTTP Range requests; a source that ignores Range is read from
the start instead, for files up to 20 MB. It returns file bytes, not readable text:
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

The tool refuses in these cases, each returning explanatory text:

| Condition | Message |
| --- | --- |
| Scheme is not `https:` | `Unable to read PDF: Only https URLs are supported.` |
| URL carries a username or password | `Unable to read PDF: URLs with credentials are not supported.` |
| URL names a port | `Unable to read PDF: Only the default https port is supported.` |
| Host not on the allowlist | `Unable to read PDF: This host is not on the allowed list of known legislative document sources.` |
| Status is neither `206` nor `200` | `Failed to fetch PDF bytes (status <status>).` |
| A `200` (Range ignored) for a file over 20 MB | `This PDF is too large to read from a source without byte-range support (over 20 MB).` |
| `Content-Type` is not `application/pdf` | `Response content-type is not a PDF (application/pdf).` |

Fetches run with `redirect: "manual"`, so redirects are rejected rather than followed.

