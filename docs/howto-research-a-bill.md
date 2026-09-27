# How to research a bill

For anyone who wants to find a U.S. state bill and understand it: what it does, where it stands,
who sponsored it, and how the floor voted. It covers finding a bill by number or by topic, getting
a sourced brief, reading the text, seeing the votes, and working with the bill card.

If you haven't installed the plugin yet, start with [Getting started](tutorial-getting-started.md).

## Find a bill by number

Name the bill number, the state, and the session or year:

```text
Find Alabama HB 591 from the 2026 Regular Session
```

Claude resolves the state, then searches for that number within it, adding the session when you
gave one. Bill-number matching is exact in either spelling: `HB 591` and `HB591` find the same
bill, but `HB 5910` does not match `HB 591`.

The same number recurs across states and sessions, so:

- **Name the state.** Without one, a number can match bills in several states. (If your project
  pins a default state, Claude uses it and says so; see
  [Configure a project](howto-configure-a-project.md).)
- **Name the session or year.** A year alone ("2026") matches every session that year, regular and
  special. If you leave it out, Claude does not assume the current session: it either finds the
  session or lists the candidates with number, title, session, and status and asks which one you
  mean.

## Find bills by topic

Ask with a topic and a state:

```text
Find recent Alabama bills about school funding
```

A topic usually returns several bills. Claude answers with a list, newest first, giving each bill's
number, title, session, and status as recorded, and offers to brief any one of them. It does not
pick one to brief unasked. `search_bills` returns no total, so a count is reported as "at least N"
when more pages remain.

In a host that renders MCP Apps, every search also puts a results card on screen, with "Show more"
paging. Tapping a result asks Claude to show that bill (see
[Use the bill card](#use-the-bill-card)). Claude then names the few bills that fit and why, rather
than restating every row.

### How topic search behaves

These are the query caps as the skills state them. Nothing in a response signals either cap, so
knowing them helps you read a short result correctly.

- **Each word is matched separately, and more words widen the results.** The words in the query
  are matched as separate substrings of the title and synopsis and ORed together. Only the first 8
  terms are used. "School choice" matches every bill with "school" in its title or synopsis.
- **The document-text half is capped.** Alongside the title and synopsis match, a full-text search
  over attached documents resolves at most 50 distinct bills. Scoping by state and session applies
  before that cap, so a scoped search draws its 50 from that state or session; an unscoped one
  draws 50 from every state combined.
- **Status is a partial match on the recorded text.** Filtering on "Passed" also matches a status
  recording one chamber's or a committee's passage. A status filter is not proof a bill became law.

So:

- Prefer one distinctive word ("voucher") over a phrase ("school choice programs").
- Scope by state and session.
- Narrow with a subject value copied from an earlier result.
- Treat a thin result as a prompt to try another word, not as proof that a state has no
  legislation on the topic. Claude says which query ran.

## Get a sourced brief

For the full picture on one bill, use the bill-research command:

```text
/cicada-guide:bill-research HB 591 Alabama 2026
```

The argument is `<bill number or topic> [state] [year]`. With no argument, it asks which bill and
which state. Given a topic, it lists matching bills first. Claude may also reach for it on its own
when a request calls for a full brief.

The brief has these parts:

| Section | What it holds |
| --- | --- |
| Identification | Bill number, state, session, title, and current status with its date |
| What it does | Two to four sentences grounded in the bill text or synopsis, with sparing, attributed quotes |
| Sponsors | Names and party |
| Legislative history | Roll calls in date order, with description and vote counts |
| How members voted | Only when you ask: the party breakdown, then notable individual votes |
| Sources | Document URLs |

It closes with what the brief could not establish (text that was unavailable or read only in part,
sponsors that did not resolve to a name, pages not fetched) and the date of the latest status.

Two rules shape how status is reported. An enrolled document alone does not establish a governor's
signature or enactment, so when the version label and the dated status disagree the brief reports
each with its source. And a bill is said to have passed only where a roll-call description or the
bill's status says so; the tools return tallies, not results.

For a brief assembled without the intermediate tool output filling the conversation, Claude can
hand the work to the `bill-brief-researcher` agent. It covers the same ground, and because it
cannot ask mid-run, it returns the candidates instead of picking when the bill is ambiguous. See
[Commands and agents reference](reference-commands-and-agents.md).

## Read the bill text

Ask what the bill says:

```text
What does the text of that bill actually say about eligibility?
```

Claude reads the newest attached document. Two things to expect:

- **Long text comes in parts.** Claude reads every part before describing what the bill does. If it
  stops early, it says which part the answer rests on.
- **Sometimes the text is not available,** for example a scanned document. Claude says so and
  gives you the document's link rather than treating the empty text as the bill's contents.

"The bill text" means the newest document, which is not necessarily the enacted law. For an older
version, ask for the list of documents; Claude gives you that version's link.

A bill's synopsis or headline is a secondary description, not statutory language, and Claude says
which one it is quoting.

## See the floor votes

```text
How did the legislature vote on Alabama HB 591 in 2026? Break it down by party.
```

Claude lists the bill's roll calls with each one's date, description, and yea, nay, absent, and
not-voting counts. For "who voted how", it breaks one roll call down by party and member. Each roll
call is reported with its own counts; counts are never added across roll calls.

- When no roll calls come back, the answer is "No recorded floor votes are available in this
  dataset", which is not the same as saying no vote happened.
- A roll call whose counts read "not recorded" has no individual votes on record. It is not a 0-0
  vote.
- `NV` is reported as "did not vote" and `ABSENT` as absent.

To look at one legislator's votes on the bill instead, see
[Check a voting record](howto-check-a-voting-record.md).

## Use the bill card

After the written answer, Claude calls `show_bill` for the bill without being asked. In a host that
renders MCP Apps, the card shows the bill number, a title plate with Claude's plain-language
headline (tap it to toggle to the official title and back), and the status, above four tabs:

- **Overview:** the path to becoming law, the recorded status, and a summary box holding Claude's
  plain-language summary, labeled "Summary · your AI assistant";
- **Sponsors:** the bill's sponsors;
- **Documents:** each version with a "Read" button that opens a viewer, or the document's link with
  a "Copy link" button where the host blocks the preview;
- **Votes:** the floor votes with party splits, and who voted how.

Hosts that cannot render cards get a short text version of the bill instead. The written answer is
built from the data tools either way, so it is complete without the card. In a card host, Claude
does not re-list the card's rows in chat: it writes what the card does not show, such as what the
bill does, context, and caveats.

**The assistant headline and summary.** Claude writes both for a voter, from the text or synopsis
it read. The headline is one plain-text line of up to 120 characters saying what the bill does,
such as "Bans buying soda and candy with SNAP benefits". The summary is plain prose of up to 1,500
characters saying what the bill does, who it affects, and where it stands as recorded. Neither
claims passage. Every bill card carries both: when neither text nor synopsis is on record, the
summary says so and the headline comes from the official title.

**Tapping a bill in another card.** Tapping a bill in the search results card, a vote in a
legislator record, or a sponsored bill's "Show in the conversation" button posts a request into the
conversation: `Show HB 314 (bill id <uuid>) with show_bill. …`. Claude reads the bill text (or the
synopsis), then shows the bill card with its plain-language headline and summary, sometimes with a
short answer in chat.

**Selecting on the card.** When you select a floor vote or open a document, the card tells Claude
what you are looking at. You can then ask "which vote am I looking at?" or "break this vote down by
party" without naming it again.

For the full list of what each card shows and sends back, see [Cards reference](reference-cards.md)
and [How cards work](explanation-cards.md).

## Tips

- **Name the state and the session.** It is the single biggest improvement to any bill question.
- **Ask for one bill at a time** when you want a brief; a topic gets a list first.
- **Big sweeps are paced.** Calls are rate limited to 60 a minute; past that a call fails with
  `Rate limit exceeded. Retry in 60 seconds.` Claude tells you and resumes after a minute.
- **Long lists come in pages** fitted under 25,000 characters, and Claude pages on from where it
  stopped. An answer marked as cut short is not complete; ask Claude to continue or narrow the
  request.
- **Across several states?** Ask about each state in turn, or name them all in one question;
  Claude searches each state separately.
- Data comes from LegiScan and Open States, and a bill's status may have moved on since the last
  data load. Treat answers as research support, not an authoritative legal record.
