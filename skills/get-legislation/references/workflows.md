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

Once one bill is settled, answer the question, then end with its card, as in "Show a bill with a
summary" below:

```jsonc
// 4. end with the card, carrying your plain-language headline and summary
{ "tool": "show_bill", "arguments": { "id": "<bill uuid>", "headline": "<plain text, at most 120 characters>", "summary": "<plain prose, at most 1500 characters>" } }
```

## Research a topic

```jsonc
{ "tool": "search_bills", "arguments": { "query": "voucher", "division_id": "<uuid>", "limit": 25 } }
```

In a host that renders cards, every `search_bills` call also shows a results card with "Show more";
tapping a result posts a request to show that bill (see "Show-bill request from a card" below).
Summarize what matched and why, rather than tabulating
every row the card already lists, and still name the bills your answer rests on.

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
has votes whose `bill.division_id` is the expected jurisdiction. Ask rather than guessing when two
remain equally plausible.

State chamber and district only as `show_official` or `show_person_record` returns them: the seat
line in text, or `office.chamber` and `office.district` in `structuredContent`. When the seat line
has none, or `office` is `null`, say they are not recorded. Never infer them from `search_people` or
`get_person`.

Write the answer from `get_person_votes`, then end with the legislator's record card. It returns
identity and seat only, so it does not replace the votes you read:

```jsonc
// 5. end with the record card for the resolved legislator
{ "tool": "show_person_record", "arguments": { "id": "<person uuid>" } }
```

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

## Show a bill with a summary

```jsonc
// 1. resolve the bill, scoped as in "Find a bill by number in a named state"
{ "tool": "search_bills", "arguments": { "bill": "HB 314", "division_id": "<uuid>" } }

// 2. read what it says; fall back to the synopsis when text_source is null
{ "tool": "get_latest_bill_document", "arguments": { "bill_id": "<bill uuid>" } }

// 3. show the card with your headline and summary
{ "tool": "show_bill", "arguments": { "id": "<bill uuid>", "headline": "<plain text, at most 120 characters>", "summary": "<plain prose, at most 1500 characters>" } }
```

Always pass both `headline` and `summary`: a call without either fails with `-32602`. Write both
for a voter, from the document text or the synopsis:

- `headline`: 1–120 characters of plain text saying what the bill does, e.g. "Bans buying soda and
  candy with SNAP benefits". No markdown, no trailing period needed. The card's title plate shows
  it first; tapping the plate toggles to the official title and back.
- `summary`: 1–1500 characters of plain prose: what the bill does, who it affects, and where it
  stands as recorded. The card labels it as written by the AI assistant.

The card renders both as text, so markdown does not render. When neither text nor synopsis is on
record, say so in the summary rather than guess, and write the headline from the official title
alone. Build the summary only from what the tools returned — the title, status, sponsors, and
recorded votes — and point to the document URL for the text. Never fill it from news coverage, web
search, or general knowledge, even with a note saying so: the card presents the summary as the
bill's. Never infer or claim passage or an outcome in either.

Depending on the host, `show_bill` hands you either its text fallback or its `structuredContent`.
Neither carries the floor votes or sponsors the card fetches for itself, so take those claims from
`get_bill_dossier`, `get_rollcalls`, or `get_rollcall_breakdown`. In a card host, don't re-list the
card's rows; write the answer, context, and caveats so the reply still stands on its own where no
card renders. `show_bill` takes no `response_format`.

## Show-bill request from a card

Tapping a bill in the `search_bills` results card, a vote in the `show_person_record` card, or a
sponsored bill's "Show in the conversation" button posts a user turn such as:

```text
Show HB 314 (bill id <uuid>) with show_bill. First read its text with get_latest_bill_document, or its synopsis, and pass a short plain-language headline as headline and a plain-language summary for a voter as summary: what it does, who it affects, and where it stands.
```

```jsonc
// 1. read every part of the text; use the synopsis when text_source is null
{ "tool": "get_latest_bill_document", "arguments": { "bill_id": "<bill uuid from the turn>" } }

// 2. show the card with your headline and summary
{ "tool": "show_bill", "arguments": { "id": "<bill uuid from the turn>", "headline": "<your headline>", "summary": "<your summary>" } }
```

Write the headline and summary under the rules above, then call `show_bill`; a short chat answer
alongside is optional. A summary written from part of a long text says which characters it rests on.

## React to what the user selected on a card

Selecting a vote, filter, or document on a card sends a model-context update, such as:

- `User is viewing HB 314 votes. Selected floor vote: <description>, <date>.`
- `User is reading <document> of HB 314.`
- `User is viewing <name>'s votes, filtered to Yea.`

Updates carry names and numbers, never ids. Map them to ids from earlier results in the
conversation. Answer "which vote am I looking at" from the latest update, without a tool call. For
the selected vote's details:

```jsonc
// 1. find the roll call: match the update's description and date against the items
{ "tool": "get_rollcalls", "arguments": { "bill_id": "<bill uuid from earlier results>" } }

// 2. who voted which way, and the split by party
{ "tool": "get_rollcall_breakdown", "arguments": { "rollcall_id": "<matched rollcall uuid>" } }
```

When no item matches the description and date, page with `next_offset` while `has_more` is true;
when still none matches, say so and ask which vote the user means. Report that roll call's own
`counts`; never add counts across roll calls.

## Contact a legislator

```jsonc
// 1. find them; disambiguate as in "How did one legislator vote"
{ "tool": "search_people", "arguments": { "name": "Rex Reynolds" } }

// 2. the contact card for the one resolved id
{ "tool": "show_official", "arguments": { "id": "<person uuid>" } }
```

Report only what `show_official` returned: the seat (title, state and chamber, district when
recorded), term, party, and the contact details on record. Depending on the host, that is the text
fallback, with one email, phone, and website each, or the `structuredContent`, whose
`contact_options` lists every email, phone, website, and address. When the text reads `No email,
website or phone number is on record.`, or every `contact_options` list is empty, say the contact
details are not on record, never guess one, and do not offer a web search for one. Pass each value
on as recorded: never judge from its domain or form whether it is official, personal, or current,
never say what another site lists, and add no role, party office, or news about the person from
outside the tools. When the seat line has no chamber or district, or `office` is `null`, say they
are not recorded. In a card host the contact buttons are on screen: don't re-list them. For how the
legislator voted, point to `show_person_record` and read votes through `get_person_votes`.

No tool maps an address or district to a legislator. For "who is my representative", ask for the
legislator's name and state rather than searching by address.

## Votes by subject

Bill subjects reach you only in `get_person_votes` JSON, at `items[].bill.subjects`; the markdown
text does not list them.

```jsonc
{ "tool": "get_person_votes", "arguments": { "people_id": "<person uuid>", "session_id": "<session uuid>", "response_format": "json", "limit": 100 } }
// → keep items whose bill.subjects contains the subject; bill is null for procedural roll calls
// → pass next_cursor back as cursor while has_more is true, filtering each page
```

The filter runs on each page you read, not on the server, so page through the session or date range
before reporting a count, or say "at least N" and which range was read. Copy the subject spelling
from a returned `subjects` array. Report each vote with its bill, roll-call date, and description;
never grade the legislator or characterize the record from the subset.

## Who sponsored this bill

`search_bills` and `get_bill` return a `sponsors` array of person UUIDs. Resolve them in one call,
in batches of up to 100, and check `unresolved_ids`:

```jsonc
{ "tool": "search_people", "arguments": { "ids": ["<sponsor uuid>", "..."] } }
```

When the answer settles on one sponsor, end with their contact card:

```jsonc
{ "tool": "show_official", "arguments": { "id": "<sponsor uuid>" } }
```

The reverse direction — every bill a legislator sponsored — goes through `search_bills`:

```jsonc
{ "tool": "search_bills", "arguments": { "sponsor_id": "<person uuid>", "limit": 25 } }
```

## Recovering from the common errors

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Error: Provide at least one of rollcall_id, bill_id, or people_id...` | `get_votes` with no entity filter, or `category` alone | Add `rollcall_id`, `bill_id`, or `people_id` |
| `MCP error -32602: Input validation error:` naming a key | An invented or misremembered parameter, e.g. `offset` passed to `get_votes` / `get_person_votes`, or `response_format` passed to `show_bill`, `show_official`, `show_person_record`, `get_rollcall_breakdown`, or another tool without it | Schemas are strict; drop or correct the named key — see the two error shapes in `tool-reference.md` |
| Wrong legislator | `search_people` and `get_person` return no state or chamber, so a common surname is ambiguous | Confirm jurisdiction from `bill.division_id` in `get_person_votes`; ask when still tied |
| Two identical-looking candidates | Two legislators with the same name | List both with party, state, and vote dates, and ask; never combine their records |
| A sitting legislator appears to have no votes | The chosen row may be a different legislator with the same name | Surface other rows with the same name as candidates and ask |
| Right bill number, wrong bill | The same number exists in another session or state | Scope by `division_id` and `session_id` (or `session_name`); read each result's session |
| Names missing from a vote breakdown | `get_votes` returns UUIDs only | Use `get_rollcall_breakdown`, whose `members` carry names and party |
| `headline` or `summary` rejected by `show_bill` | Missing, empty, or too long: over 120 characters for `headline`, 1500 for `summary` | Always pass both, as plain text: a headline of at most 120 characters and a summary under 1500; when no text or synopsis is on record, say so in the summary |
| Asked for a legislator's chamber or district | `search_people` and `get_person` return neither | Use the `show_official` seat line; when it has none, say they are not recorded |
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
