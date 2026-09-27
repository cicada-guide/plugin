# Cards reference

This page is for anyone who needs the facts about the plugin's interactive cards: what each one
shows, what it fetches for itself, and what the model actually receives when it calls a card tool.
It covers the four tools that carry a card, the `show_bill` headline and summary rules, the
show-bill request a tapped bill posts, and the model-context updates the cards send.

Parameters and response shapes are in the
[tool reference](../skills/state-legislation/references/tool-reference.md#cards); this page links
there rather than repeating them. Why the plugin ends answers with a card is in
[Cards explained](explanation-cards.md).

## Summary

| Tool | Card | Resource URI | The card fetches | The model receives |
| --- | --- | --- | --- | --- |
| `search_bills` | Bill results | `ui://cicada-guide/bill-results-v11.html` | More pages of the same search | The full result list, as text or JSON, as usual |
| `show_bill` | Bill card | `ui://cicada-guide/bill-workspace-v12.html` | Sponsors, documents, and floor votes (`get_bill_dossier`); each vote's party split (`get_rollcall_breakdown`) | The bill row: no votes, no sponsors. The text fallback omits the `headline` and `summary`; `structuredContent` echoes them in `_display` |
| `show_official` | Contact card | `ui://cicada-guide/official-card-v5.html` | Recent votes and their tally (`get_person_votes`) | Identity, seat, term, party, and the contact details on record |
| `show_person_record` | Legislator record | `ui://cicada-guide/legislator-record-v12.html` | Vote history (`get_person_votes`), sessions (`list_sessions`), and sponsored bills (`search_bills`) | Identity and seat only, never the votes |

The URIs are the ones the live `tools/list` advertises in each tool's `_meta.ui.resourceUri`. The
`-vN` suffix changes when the server changes a card's HTML shell, so a host that caches by URI
loads the new one.

## How a card reaches the screen

A card is an [MCP Apps](https://modelcontextprotocol.io/docs/extensions/apps) resource linked to a
tool. In a host that renders MCP Apps, calling the tool also puts the card on screen. Any other host
shows only the tool's result, so every card tool is safe to call everywhere.

- **The card is a static shell.** The tool result supplies the record; the card then calls the
  server's read tools over the host bridge for everything else. It never queries the database
  directly and loads no script, stylesheet, or font from the network.
- **What reaches the model depends on the host.** The model gets either the text fallback or the
  tool's `structuredContent`, never what the card fetched afterwards. So the skills take every
  written claim from the data tools — `get_bill_dossier`, `get_rollcalls`,
  `get_rollcall_breakdown`, `get_person_votes`, `get_latest_bill_document` — and the written
  answer stands on its own where no card renders.
- **Don't re-list the card.** In a card host, rows, tallies, and contact buttons are already on
  screen. The skills write what the card does not show: the answer, context, and caveats.
- **A subagent's card renders nowhere.** Subagents never call a card tool to display anything.
  They name the card that fits, and the main conversation calls it. See
  [Commands and agents](reference-commands-and-agents.md#agents).
- **One network host, with fallbacks.** Everything a card loads comes from
  `https://public.cicada.guide`. The document viewer draws a PDF's pages with pdf.js from there,
  from bytes it fetches with `read_pdf_bytes`; when the host blocks it or the document can't be
  fetched, or "Open full screen" is refused, the card shows the document URL as a link with a
  **Copy link** button instead. The legislator photo comes from
  `https://public.cicada.guide/photos/<id>`; without it, a silhouette stays. The district outline arrives in `show_official`'s `structuredContent`, so the map needs no
  host.
- **A tapped bill goes through the conversation.** No card opens a bill itself. Tapping a bill in
  the results card or the legislator record posts a user turn asking Claude to show it with
  `show_bill` (see [below](#the-show-bill-request)), so every bill card carries a headline and a
  summary.

## `search_bills`: bill results

Every `search_bills` call renders the results card in a card host; there is no separate display
tool for a list.

**The card shows** the matching bills, newest first, with a "Show more" button. When nothing
matches, it says so: `No bills matched these filters. Try a broader word, or ask about another
year.`

**Interactions.**

- **Show more** calls `search_bills` again with the same arguments and the next offset, and
  appends the page.
- **Tapping a result** posts the [show-bill request](#the-show-bill-request) for that bill. The
  result's footer then reads "Asked the assistant to show this bill".

**The model receives** the full result list as usual — text by default, or JSON with
`response_format: "json"`. `search_bills` does take `response_format`, unlike the display tools.

**How the skills react.** They summarize what matched and name the bills the answer rests on,
rather than tabulating every row the card shows. `bill-research` answers a topic with a list and
an offer to brief one, and shows no bill card until the user picks one.

## `show_bill`: bill card

Parameters: `id`, `headline`, and `summary`, all required —
[tool reference](../skills/state-legislation/references/tool-reference.md#show_bill).

**The card shows** a header, then four tabs. It always opens on this layout, inline.

- **Header:** the state and session, the status, the bill number, and a title plate showing the
  `headline` first (see [below](#the-title-plate)). Tapping the plate toggles to the official title
  and back.
- **Overview:** the path to becoming law (Introduced, Engrossed, Enrolled, Enacted), the recorded
  status, and the summary box (see [below](#the-summary-box)).
- **Sponsors:** the bill's sponsors.
- **Documents:** each version, with a **Read** button that shows its pages inside the card (a
  non-PDF latest version as text), or the document's link with **Copy link** where the card can't
  show it.
- **Votes:** the floor votes, each roll call's party split, and who voted how, filterable by party.

**The card fetches** `get_bill_dossier` for sponsors, documents, and floor votes, and
`get_rollcall_breakdown` for a selected vote's party split and members.

**The model receives** none of that.

- **Text fallback:** the bill number, state and session, title, status, type, date, synopsis (cut
  at 300 characters), subjects, the newest document's link, the document count, and the `id`.
- **`structuredContent`:** the bill row, plus `_display.divisionName`, `_display.sessionName`,
  `_display.aiHeadline` (the `headline` passed), and `_display.aiSummary` (the `summary` passed).
- A missing id returns `No bill found with id=<id>.`, and the card shows an unavailable state.

### The `headline` and `summary` parameters

Both are required: a call without either fails with `-32602`. The skills always pass both, written
for a voter after reading the bill.

- **What the headline says:** what the bill does, in one short line, such as "Bans buying soda and
  candy with SNAP benefits". It never claims passage or an outcome.
- **What the summary says:** what the bill does, who it affects, and where it stands as recorded.
- **What they rest on:** the text from `get_latest_bill_document`, or the synopsis. When neither
  text nor synopsis is on record, the summary says so rather than guess, and the headline comes
  from the official title alone.
- **What they never do:** infer passage or an outcome. The summary states the recorded status.
- **Form:** plain text. The headline is 1-120 characters, with no trailing period needed; the
  summary is 1-1,500 characters of prose. Both are trimmed, and an empty string is rejected. The
  card renders both as text, so markdown does not render.

Which entry points pass them: `state-legislation`, `bill-research`, and `voting-record` whenever
they show a bill. `bill-brief-researcher` returns a suggested headline and summary on its **Card to
show** line for the main conversation to pass.

### The title plate

The header's title plate shows the `headline` first. Tapping the plate toggles it to the bill's
official title, and tapping again toggles back.

### The summary box

The box is labeled "Summary · your AI assistant" and shows the `summary`, with no note under it.
Without a `summary`, it shows the bill's synopsis under "Official synopsis". The box has no button; the bill card posts no user turn.

### The show-bill request

Tapping a bill in the `search_bills` results card, a vote in the legislator record, or a sponsored
bill's **Show in the conversation** button posts a user turn. These are the only controls on any
card that post one. The turn reads:

```text
Show HB 314 (bill id <uuid>) with show_bill. First read its text with get_latest_bill_document, or its synopsis, and pass a short plain-language headline as headline and a plain-language summary for a voter as summary: what it does, who it affects, and where it stands.
```

After it is sent, the card's status line says the bill will appear in the conversation. If the host
cannot send the turn, the card asks the user to ask for the bill in the conversation instead.

**How the skills react** (`state-legislation`, `bill-research`, `voting-record`, and the
[workflow](../skills/state-legislation/references/workflows.md#show-bill-request-from-a-card)):

1. Read the text with `get_latest_bill_document`, every part, or use the synopsis when no text is
   available.
2. Call `show_bill` with that `id`, a `headline`, and a `summary`, under the rules above. A short
   chat answer alongside is optional.

No full brief is needed for this turn.

## `show_official`: contact card

Parameter: `id` (required), from `search_people` after identity is resolved —
[tool reference](../skills/state-legislation/references/tool-reference.md#show_official).

**The card shows:**

- the photo, or a silhouette when none is recorded;
- the seat line and party;
- a contact menu for every option on record: **Email**, **Call**, **Website**, and addresses,
  each opened through the host;
- a district map when the seat has an outline. The card asks the host for geolocation; when the
  viewer turns location on, the map places them and, below the map, reads "You're in this
  district." or "You're not in this district." until dismissed; from outside, a dashed line runs to
  the nearest edge. The location stays in the card: it never reaches the server or the model;
- the tally of the last recorded votes, and those recent votes.

It does not show the term or other seats held; the text and `structuredContent` do.

**The card fetches** the recent votes with `get_person_votes`.

**The model receives:**

- **Text fallback:** the seat line (title · state chamber · `District N`, each part only when
  recorded, or `Office and district: not recorded.`), the term and election when recorded, party,
  one `**Email**:`, `**Phone**:`, and `**Website**:` line each — or `No email, website or phone
  number is on record.` — and other seats under `**Also held**:`.
- **`structuredContent`:** `person` (with `photo_url`), `office` (title, chamber, state,
  district, term dates, election, and `outline`; `null` when no seat is recorded),
  `other_offices`, `contact`, and `contact_options` (`emails`, `phones`, `websites`,
  `addresses`).

**How the skills react.** `contact-legislator` reports the seat exactly as returned and every
contact option on record, names what is not on record, and never guesses an address or number. In
a card host it does not re-list the contact buttons. The card's tally labels what it covers, and
no skill uses it to grade, score, or rank a legislator. `legislator-disambiguator` calls
`show_official` only to read a candidate's seat, never to display it.

## `show_person_record`: legislator record

Parameter: `id` (required), from `search_people` after identity is resolved —
[tool reference](../skills/state-legislation/references/tool-reference.md#show_person_record).

**The card shows** the seat and contact options, then two views:

- **Voting history**, newest first, filterable by session, by how they voted (Yea, Nay, No vote,
  Absent), and by subject, with older votes loaded on request. The session picker lists only
  sessions the legislator has recorded votes in, newest first; older sessions appear after a short
  "Checking older sessions…" while the card confirms each with a one-vote lookup. The Yea / Nay /
  No vote / Absent counts cover the votes loaded so far.
- **Sponsored legislation**, the bills they sponsored. A bill's **Show in the conversation**
  button, like tapping a vote, posts the [show-bill request](#the-show-bill-request).

**The card fetches** the votes with `get_person_votes`, the session list with `list_sessions`,
and sponsored bills with `search_bills` and `sponsor_id`.

**The model receives** identity and seat only.

- **Text fallback:** the name, the seat line when a seat is recorded, party, nickname, and `id`.
- **`structuredContent`:** the same `person`, `office`, `other_offices`, `contact`, and
  `contact_options` as `show_official`. When the seat lookup fails, `office` is `null` and the
  record still loads.

Neither carries a vote. `voting-record` calls the card as soon as one person is identified, then
reads the votes with `get_person_votes` for the written report.

## Model-context updates

When the user selects something on a card, the card sends the host a short text update so the
model knows what is on screen. These are not user turns and ask for nothing. They carry names and
numbers, never ids.

| Update | Sent when | Card |
| --- | --- | --- |
| `User is viewing HB 314.` | The bill card loads | Bill card |
| `User is viewing HB 314 votes. Selected floor vote: <description>, <date>.` | A floor vote is selected in the **Votes** tab | Bill card |
| `User is reading <document> of HB 314.` | A document is opened in the **Documents** tab | Bill card |
| `User is viewing the contact card for <name>.` | The contact card loads | Contact card |
| `User is viewing the voting record of <name>.` | The record loads | Legislator record |
| `User is viewing <name>'s votes, filtered to Yea.` | A vote-category filter is set; without the suffix when cleared | Legislator record |
| `User is viewing <name>'s record for <session>.` | A session is picked; without `for <session>` for all sessions | Legislator record |

The skill guidance quotes the vote-selection update, the document update, the Yea filter, the
voting-record update, and the contact-card update; the others were read from the server's card
source on 2026-09-27 and follow the same pattern.

**How the skills react** (`state-legislation`, `bill-research`, `voting-record`, and the
[workflow](../skills/state-legislation/references/workflows.md#react-to-what-the-user-selected-on-a-card)):

- **Map names to ids** from earlier results in the conversation. An update never carries an id.
- **"Which vote am I looking at"** is answered from the update, without a tool call.
- **A selected vote's details:** call `get_rollcalls` for the bill, match the description and
  date, then call `get_rollcall_breakdown` with that roll call's `id`.
- **A filtered voting record:** call `get_person_votes` with the matching `category` or other
  filter for the already-resolved person.

## Tools that take no `response_format`

`show_bill`, `show_official`, `show_person_record`, and `get_rollcall_breakdown` have no
`response_format` parameter. Every schema is strict, so passing one fails with
`MCP error -32602: Input validation error:` rather than being ignored. The first three are display
tools; `get_rollcall_breakdown` is a data tool that returns one fixed shape.

This matters when a project pins `response_format` in `.claude/cicada-guide.local.md`: the skills
omit it from these four tools and pass it to everything else. See
[project settings](../skills/state-legislation/references/project-settings.md#response_format-must-not-reach-the-tools-without-it).
`search_bills`, the fourth card-bearing tool, does accept `response_format`.

## Related

- [Tool reference: Cards](../skills/state-legislation/references/tool-reference.md#cards): the
  guidance Claude reads, with each tool's parameters.
- [Commands and agents](reference-commands-and-agents.md): which card each entry point ends with.
- [Cards explained](explanation-cards.md): why answers are card-first, and why the written answer
  still comes from the data tools.
- [Workflows](../skills/state-legislation/references/workflows.md#show-a-bill-with-a-summary): the
  call sequences that end with a card.
- [Troubleshooting](troubleshooting.md): what to check when a card does not appear.
