# Why the plugin is card-first

This page is for contributors changing how the skills and agents use the server's interactive
cards. It explains why an answer ends with a card, why the card is never the source of a written
claim, and why subagents name a card instead of showing one. For what each card shows and
returns, see the [cards reference](reference-cards.md) and the
[tool reference](../skills/state-legislation/references/tool-reference.md#cards).

## The problem

The server renders four tools as MCP Apps cards: `search_bills` (a results list), `show_bill`,
`show_official`, and `show_person_record`. In a host that supports MCP Apps, a card is the best
view of the data it covers. A bill card has a floor-vote timeline with party splits, a document
viewer, and tabs for sponsors and votes. A legislator's contact card has a photo, a menu for every
recorded contact option and a district map. A written answer can't match that, and trying to
re-create it in prose buries the reader in rows they can already see.

The cards raise three problems for guidance, though:

- **Not every host renders them.** A terminal, or any host without MCP Apps, gets only what the
  tool call returns. The answer has to work there too.
- **The card shows more than the model sees.** A card fetches its own data over the host bridge
  after it opens. That data never passes through the model.
- **A card only renders in the conversation the user is looking at.** A subagent's tool calls
  are not shown to the user.

## Card-first, not card-only

Since 0.8.0 each workflow ends with the card that fits, without asking the user first:

| Answer | Card |
| --- | --- |
| A bill brief, or a roll-call breakdown on one bill | `show_bill` with the bill's `id` and an assistant-written `summary` |
| Who a legislator is, or how to reach them | `show_official` |
| A resolved legislator's voting record | `show_person_record` |
| Any bill search | `search_bills` renders its own results card on every call |

The card comes last, after the written answer is ready. Showing it without asking saves a round
trip spent asking permission, and a host that can't render cards gets the call's text back
instead, so the call is always safe.

The written answer changes shape when a card is on screen. It doesn't re-list rows, tallies, or
contact buttons the card already shows. It gives what the card doesn't: the answer to the
question, the context, and the caveats. It still stands on its own, because the guidance can't
know whether the host rendered anything.

## What reaches the model

A card tool returns two things, and the host decides which one the model receives:

- **The text fallback.** A short Markdown body. For `show_bill` it holds the bill number, state
  and session, title, status, the synopsis (cut at 300 characters), subjects, the newest
  document's link, the document count, and the `id`. For `show_official` it holds the seat line,
  the term when recorded, party, and one email, phone and website each.
- **`structuredContent`.** The typed JSON the card renders from. For `show_official` it carries
  every recorded contact option in `contact_options`, where the text has only one of each.

Neither carries what the card fetches for itself. The bill card calls `get_bill_dossier` and
`get_rollcall_breakdown` for its sponsors and votes; the legislator record calls
`get_person_votes` for its vote history. None of those results reach the model through the card.
`show_person_record` returns the person and their seat, never their votes, and `show_bill` does
not echo back the `summary` it was given.

So every written claim comes from the data tools: `get_bill_dossier`, `get_rollcalls`,
`get_rollcall_breakdown`, `get_person_votes`, and `get_latest_bill_document`. The card is the
view; the data tools are the evidence. That split also keeps the answer honest in a text-only host,
where the card never existed.

The server takes the same approach from its side. Each card is a static HTML resource that
receives its data from the tool result and never interpolates it into markup, so every tool has a
text representation and a card representation. The server repository's UI explanation covers that
design; this repo only decides when to show a card and what to write beside it.

## Why subagents name a card instead of calling it

A subagent's output goes back to the conversation that dispatched it, not to the user. A card it
opened would render nowhere, and would spend a rate-limited call on nothing. So each agent ends its
report with the card that fits its result, and the main conversation makes the call:

- `bill-brief-researcher` ends with `show_bill {id, summary}` and a `summary` the caller must
  pass, written under the same rules as the skills' own; when neither text nor synopsis is on
  record, the summary says so.
- `legislator-disambiguator` names `show_official` or `show_person_record`, and only for a
  `RESOLVED` verdict. An ambiguous result names no card, because showing one would present a
  guess as an identification.

`legislator-disambiguator` does call `show_official`, but only to read a candidate's recorded
seat, never to display it. That is the one exception, and the agent's prose says so.

## The assistant summary

`show_bill` requires a `summary`: plain prose for a voter, 1 to 1,500 characters, saying what the
bill does, who it affects, and where it stands as recorded. The card puts it in a summary box, so
a bill card never appears without one.

Three rules shape it, each for a reason:

- **It is labelled as AI-written.** The card shows it under "Summary · your AI assistant", with a
  note that the AI wrote it in this chat and the official text is the record. A reader can't tell
  a summary's source from its position on a card, so the label keeps the assistant's words
  separate from the legislature's.
- **It never infers passage or an outcome.** Passage thresholds vary by chamber and question, and
  a status such as `Passed` can record one chamber or a committee. The summary states the recorded
  `status` and stops there. A prediction on a card that looks official would read as a fact.
- **It comes from text the model read.** The model reads the bill before calling, and bases the
  summary on `get_latest_bill_document` text or the synopsis. When neither text nor synopsis is on
  record, the summary says so rather than guess.

The server trims the value and rejects an empty one; Markdown doesn't render, because the card
shows it as text.

No card opens a bill by itself. Tapping a bill in the `search_bills` results card or in the
legislator record posts an ordinary user turn, `Show HB 314 (bill id <uuid>) with show_bill. …`,
asking the model to read the bill and call `show_bill` with a summary. Routing the tap through the
conversation is what keeps the summary required: only the model can write one. The skills handle
that turn as a small workflow of its own: read the text or synopsis, then call `show_bill` with the
summary, with a short chat answer optional.

## Model-context updates carry names, not ids

When the user selects something on a card, such as a floor vote, a document, or a vote filter,
the card tells the host, and the host passes the model a short text update such as
`User is viewing HB 314. Selected floor vote: <description>, <date>.` It is context, not a new
turn.

These updates carry the names and numbers the user sees, never ids. The guidance therefore maps
them back to ids from earlier results in the conversation. A question such as "which vote am I
looking at" is answered from the update alone, with no tool call. For that vote's details, the
model finds the roll call with `get_rollcalls` on the bill, matching the description and date,
and passes its `id` to `get_rollcall_breakdown`.

## Legislator cards and the no-grading rule

The contact card and the legislator record both show a tally of recent recorded votes. Each tally
labels what it covers, and the guidance never uses one to grade, score, or rank a legislator. A
tally over a handful of votes is a view of those votes, nothing more. See
[why legislators are never graded](explanation-dataset-rules.md#why-legislators-are-never-graded).

Contact details are absent for most officials. When the card has none, the answer says so and
never supplies an address, phone, or email from a pattern or from elsewhere.

## How this changed in 0.8.0

Before 0.8.0 the display tools were used on request: "show me" or "pull it up" led to `show_bill`,
and exploration went to `open_research_desk`, a separate search workspace. The server has since
stopped serving that workspace, and 0.8.0 removed it from the README, the skills, the tool
reference, and the project-settings template. Its job moved to the `search_bills` results card,
which pages itself with "Show more" and, in 0.8.0, opened a bill in place when the user tapped it.

The same release made the workflows card-first, added the `show_bill` summary and the handling
for the card's summary request, and added the model-context update guidance. It also made subagents
name the card that fits their result.

After 0.8.0 the server made `summary` required and stopped opening bills inside the results card
and the legislator record. A tapped bill now posts a request to show it with `show_bill`, and the
bill card's own summary button went away with the optional summary. The full list is in the
[changelog](../CHANGELOG.md).

## Trade-offs

- **Two representations to keep in step.** Every card workflow writes an answer from the data
  tools and shows a card that fetches the same data independently. A change to what a card shows
  can change what the answer should leave out, so the guidance and the tool reference both need
  review when a card changes.
- **Extra calls.** Grounding a bill answer in `get_bill_dossier` and `get_rollcalls` and then
  showing the card costs more calls than showing the card alone, against the rate limit. The
  plugin accepts that cost so that every written claim has a source the model actually read.
- **The host decides.** Which of the text fallback and `structuredContent` reaches the model
  differs by host, so the guidance describes both and relies on neither for anything beyond
  identity, seat, and contact details.

## Related

- [Cards reference](reference-cards.md)
- [Why each entry point restates the dataset rules](explanation-dataset-rules.md)
- [Architecture](architecture.md)
- [Troubleshooting](troubleshooting.md#cards-dont-appear)
- [The always-on skill's card rules](../skills/state-legislation/SKILL.md)
