# How to check a voting record

For anyone who wants to know how a U.S. state legislator voted, or how one roll call split. It
covers the three kinds of voting question the plugin answers, how to make sure you have the right
legislator, filtering votes by subject, and the legislator record card.

If you haven't installed the plugin yet, start with [Getting started](tutorial-getting-started.md).

## Pick the question you're asking

The voting-record command handles three shapes of request:

```text
/cicada-guide:voting-record <legislator name> [state] [bill] [session or date range]
```

| You want | Ask like this |
| --- | --- |
| One legislator's votes over time | `/cicada-guide:voting-record Rex Reynolds Alabama 2026` or "How did Alabama Representative Rex Reynolds vote most recently?" |
| One legislator's vote on one bill | "How did Alabama Representative Rex Reynolds vote on HB 591 in the 2026 Regular Session?" |
| One roll call broken down by party | "Show me how the chamber split on the final vote on Alabama HB 591 in 2026" |

With no argument, the command asks which legislator and which state. Claude may also reach for it
on its own when a question calls for a voting record.

"My senator" or "my representative" without a name gets a question back: give the legislator's
name and state. No tool maps an address or district to a legislator.

## A legislator's votes over time

Name the legislator and the state. Add a session or a date range to limit the window, and say if
you only want one side ("only the votes against").

```text
How did Alabama Representative Rex Reynolds vote in the 2026 Regular Session?
```

The answer leads with the identification (full name, party, jurisdiction, and seat as recorded) so
you can confirm it is the right person. Then come the votes, newest first: date, bill number, bill
title, the legislator's recorded position, and that roll call's tallies. It states the window the
votes cover and any filter applied.

**"Most recent vote" questions.** Several votes often share the newest date. Claude reads every
vote on that date and reports all of them rather than claiming one came last, and calls the result
the latest recorded vote in the available data.

**Pattern questions.** For "does she usually vote with her party", the answer states the sample
size and the window before describing anything, and keeps it descriptive. Absent and not-voting
records are counted separately, not folded into a yes/no tally. One vote is never presented as a
position on an issue.

## One legislator's vote on one bill

Name the legislator, the bill number, the state, and the session:

```text
How did Alabama Representative Rex Reynolds vote on HB 591 in the 2026 Regular Session?
```

Claude resolves the bill and the person separately, then lists that legislator's recorded position
on each roll call on the bill, in date order, with the roll call's description and its own counts.
It ends with the bill card.

When the data holds no recorded vote by that legislator on that bill, the answer says exactly that.
It does not say they abstained.

## One roll call by party

Name the bill and, when there were several floor votes, which one:

```text
Break down the final passage vote on Alabama HB 591 in 2026 by party
```

Claude lists the bill's roll calls and, when more than one could be meant, names them by date and
description and asks which. For the chosen roll call it reports the counts, each party's yea, nay,
absent, and not-voting tally, and every member's name, party, and vote. It ends with the bill card,
which shows every floor vote with its party split.

- A roll call with no individual votes on record gets "not recorded", never a 0-0 vote.
- When the breakdown reaches its row cap, Claude says the party tally covers only the rows
  returned.
- Counts are never added across roll calls.

## Make sure it's the right legislator

Legislator search returns name and party only, with no state, chamber, or district, and it cannot
filter by state. A common surname matches legislators nationwide. So Claude confirms jurisdiction
from each candidate's votes: which state's bills they voted on.

**Same-name rows are different people.** Two records with the same name, party, and state can be
two legislators in different chambers or years. Claude never combines their records and never
picks one silently. Instead it lists the candidates with party, state, and the date range of their
recorded votes, and asks which one you mean. Attributing a vote to the wrong person is the worst
mistake this kind of research can make.

To make identification quick:

- Give the full name and the state.
- Add the party, or a chamber or district, when you know it. A chamber or district is checked
  against the seat the legislator's record returns; when no seat is on record, Claude says the
  chamber and district are not recorded rather than inferring them.
- Answer the question when Claude lists candidates.

For a hard case, Claude can hand identification to the `legislator-disambiguator` agent, which
probes each candidate's votes and recorded seat and returns `RESOLVED`, `AMBIGUOUS`, or
`NOT FOUND`. It never guesses. See
[Commands and agents reference](reference-commands-and-agents.md).

If your project pins a `default_division`, candidates are tested against that state when you name
none. It narrows the list; it does not on its own confirm who you mean. See
[Configure a project](howto-configure-a-project.md).

## Filter votes by subject

```text
How did Alabama Representative Rex Reynolds vote on education bills in 2026?
```

There is no subject filter on the server. Claude reads the legislator's votes in structured form,
keeps those whose bill carries a matching subject, and pages through the whole window before
counting. The answer says which subject values it matched and which window it read. The subset is
reported vote by vote; it is never used to characterize the legislator.

In a card-rendering host you can also filter by subject on the legislator record card itself.

## The legislator record card

Once one person is identified, Claude calls `show_person_record` without being asked. In a host
that renders MCP Apps, the card shows the legislator's seat and contact options, their recorded
votes with session, vote, and subject filters, and the bills they sponsored.

The card loads the votes itself, and none of them reach Claude through the card. The written answer
comes from the votes Claude read directly, so it stands on its own in a host that cannot render
cards. In a card host, Claude reports the votes that answer your question, then adds what the card
doesn't show: the window covered, the filters applied, and what the record cannot establish.

When you filter on the card (for example to Yea votes), the card tells Claude what you are looking
at, so you can follow up with "what are these?" without restating the filter.

For everything each card shows, see [Cards reference](reference-cards.md).

## What the answer will never do

- **Grade, score, rate, or rank a legislator,** or compare them with an ideological baseline. The
  card's tallies label what they cover and are not a score.
- **Predict** future votes, or infer party discipline or motive.
- **Say a measure passed** unless the roll-call description or the bill's status says so. Tallies
  are not a result.
- **Treat a missing vote as a position.** A vote absent from the results is not evidence the
  legislator did not vote. `NV` is reported as "did not vote" and `ABSENT` as absent.

## Tips

- Name the state, and a session or date range. A narrower window is faster and easier to read.
- Long histories come in pages fitted under 25,000 characters; Claude pages on before tallying.
- Calls are rate limited to 60 a minute. Past that a call fails with `Rate limit exceeded. Retry in
  60 seconds.` Claude tells you and resumes after a minute.
- To reach the legislator instead, see [Contact a legislator](howto-contact-a-legislator.md).
