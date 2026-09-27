# Cards reference

This page is for anyone who needs the facts about the plugin's interactive cards: what each one
shows, what it fetches for itself, and what the model actually receives when it calls a card tool.
It covers the four tools that carry a card, the `show_bill` summary rules, the "Summarize with AI"
turn, and the model-context updates the cards send.

Parameters and response shapes are in the
[tool reference](../skills/state-legislation/references/tool-reference.md#cards); this page links
there rather than repeating them. Why the plugin ends answers with a card is in
[Cards explained](explanation-cards.md).

## Summary

| Tool | Card | Resource URI | The card fetches | The model receives |
| --- | --- | --- | --- | --- |
| `search_bills` | Bill results | `ui://cicada-guide/bill-results-v9.html` | More pages of the same search; the bill card for a tapped result | The full result list, as text or JSON, as usual |
| `show_bill` | Bill card and workspace | `ui://cicada-guide/bill-workspace-v9.html` | Sponsors, documents, and floor votes (`get_bill_dossier`); each vote's party split (`get_rollcall_breakdown`) | The bill row: no votes, no sponsors, no echo of the `summary` |
| `show_official` | Contact card | `ui://cicada-guide/official-card-v3.html` | Recent votes and their tally (`get_person_votes`) | Identity, seat, term, party, and the contact details on record |
| `show_person_record` | Legislator record | `ui://cicada-guide/legislator-record-v10.html` | Vote history (`get_person_votes`), sessions (`list_sessions`), sponsored bills (`search_bills`), and a bill card for a tapped bill | Identity and seat only, never the votes |

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
- **Two network hosts, each with a fallback.** The document viewer frames `docs.google.com`; if the
  preview stays blank, "Open full screen" opens the original through the host. The legislator photo
  comes from `https://public.cicada.guide/photos/<id>`; without it, a silhouette stays. The
  district outline arrives in `show_official`'s `structuredContent`, so the map needs no host.

## `search_bills`: bill results

Every `search_bills` call renders the results card in a card host; there is no separate display
tool for a list.

**The card shows** the matching bills, newest first, with a "Show more" button. When nothing
matches, it says so: `No bills matched these filters. Try a broader word, or ask about another
year.`

**Interactions.**

- **Show more** calls `search_bills` again with the same arguments and the next offset, and
  appends the page.
- **Tapping a result** opens that bill's card in place, loading it with `get_bill_dossier`, with a
  way back to the list.

**The model receives** the full result list as usual — text by default, or JSON with
`response_format: "json"`. `search_bills` does take `response_format`, unlike the display tools.

**How the skills react.** They summarize what matched and name the bills the answer rests on,
rather than tabulating every row the card shows. `bill-research` answers a topic with a list and
an offer to brief one, and shows no bill card until the user picks one.

## `show_bill`: bill card and workspace

Parameters: `id` (required) and `summary` (optional) —
[tool reference](../skills/state-legislation/references/tool-reference.md#show_bill).

**The card shows:**

- the bill number, state, and session;
- the headline, with a toggle to the official title;
- the status;
- a summary box (see [below](#the-summary-box));
- a floor-vote timeline with each roll call's party split, and who voted how, filterable by party;
- **Read bill**, a viewer for the newest document with a readable link;
- **Explore bill**, a workspace with **Overview**, **Sponsors**, **Documents**, and **Votes** tabs,
  shown full screen where the host allows it.

**The card fetches** `get_bill_dossier` for sponsors, documents, and floor votes, and
`get_rollcall_breakdown` for a selected vote's party split and members.

**The model receives** none of that.

- **Text fallback:** the bill number, state and session, title, status, type, date, synopsis (cut
  at 300 characters), subjects, the newest document's link, the document count, and the `id`.
- **`structuredContent`:** the bill row, plus `_display.divisionName`, `_display.sessionName`,
  and `_display.aiSummary` when a `summary` was passed.
- A missing id returns `No bill found with id=<id>.`, and the card shows an unavailable state.

### The `summary` parameter

The skills write `summary` for a voter, and omit it rather than guess:

- **What it says:** what the bill does, who it affects, and where it stands as recorded.
- **What it rests on:** the text from `get_latest_bill_document`, or the synopsis. When neither was
  read, there is no summary.
- **What it never does:** infer passage or an outcome. It states the recorded status.
- **Form:** plain prose, 1-1,500 characters. It is trimmed, and an empty string is rejected. The
  card renders it as text, so markdown does not render.

Which entry points pass it: `state-legislation` and `bill-research` whenever they show a bill;
`voting-record` on Paths B and C when it read the text or synopsis. `bill-brief-researcher`
returns a suggested summary on its **Card to show** line, or `summary: none`, for the main
conversation to pass.

### The summary box

The box reads differently depending on what the card has:

| The card has | Label | Body | Note |
| --- | --- | --- | --- |
| A `summary` | Summary · your AI assistant | The summary | Written by the AI in this chat. It can miss details; the official text is the record. |
| A synopsis, no summary | Official synopsis | The synopsis, then "Summarize with AI" | The official text is the record. |
| Neither | Summary | `No summary yet for <bill>.`, then "Summarize with AI" | The official text is the record. |

### "Summarize with AI"

The button appears only when no `summary` was passed. It is the only control on any card that
posts a user turn to the conversation. The turn reads:

```text
Summarize HB 314 (bill id <uuid>) in plain language for a voter: what it does, who it affects, and where it stands. Then show it again with show_bill, passing your summary as summary.
```

After it is sent, the button reads "Asked…" and the box says the summary will appear in the
conversation. If the host cannot send the turn, the card asks the user to request a summary in
the conversation instead.

**How the skills react** (`state-legislation`, `bill-research`, and the
[workflow](../skills/state-legislation/references/workflows.md#summarize-with-ai-request)):

1. Read the text with `get_latest_bill_document`, every part, or use the synopsis when no text is
   available.
2. Answer in chat with the plain-language summary.
3. Call `show_bill` with the same `id` and that text as `summary`, under the rules above.

No full brief is needed for this turn.

## `show_official`: contact card

Parameter: `id` (required), from `search_people` after identity is resolved —
[tool reference](../skills/state-legislation/references/tool-reference.md#show_official).

**The card shows:**

- the photo, or a silhouette when none is recorded;
- the seat line and party;
- a contact menu for every option on record: **Email**, **Call**, **Website**, and addresses,
  each opened through the host;
- a district map when the seat has an outline;
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
  Absent), and by subject, with older votes loaded on request.
- **Sponsored legislation**, the bills they sponsored. Tapping one opens its bill card in place.

**The card fetches** the votes with `get_person_votes`, the session list with `list_sessions`,
sponsored bills with `search_bills` and `sponsor_id`, and a tapped bill with `get_bill_dossier`.

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
| `User is viewing HB 314. Selected floor vote: <description>, <date>.` | A floor vote is selected on the card | Bill card |
| `User is viewing HB 314 votes. Selected floor vote: <description>, <date>.` | A floor vote is selected in the workspace **Votes** tab | Bill workspace |
| `User opened the HB 314 workspace.` | **Explore bill** is opened | Bill workspace |
| `User is reading <document> of HB 314.` | A document is opened in the workspace | Bill workspace |
| `User opened HB 314 from the search results.` | A result is tapped | Bill results |
| `User is viewing the contact card for <name>.` | The contact card loads | Contact card |
| `User is viewing the voting record of <name>.` | The record loads | Legislator record |
| `User is viewing <name>'s votes, filtered to Yea.` | A vote-category filter is set; without the suffix when cleared | Legislator record |
| `User is viewing <name>'s record for <session>.` | A session is picked; without `for <session>` for all sessions | Legislator record |

The skill guidance quotes the first two bill updates, the document update, the Yea filter, the
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
