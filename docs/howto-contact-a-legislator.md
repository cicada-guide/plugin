# How to contact a legislator

For anyone who wants to know who a U.S. state legislator is and how to reach them. It covers the
contact-legislator command, why it needs a name, what the contact card shows, and what to do when
contact details are not on record.

The plugin is read-only. It shows you the contact details on record; it never emails, calls, or
messages anyone on your behalf.

## Ask by name

Use the command with the legislator's name and, ideally, the state:

```text
/cicada-guide:contact-legislator Rex Reynolds Alabama
```

The argument is `<name> [state]`. With no argument, the command asks which legislator and which
state. You can also just ask:

```text
How do I contact Alabama Representative Rex Reynolds?
```

Claude reaches for the same workflow when a request asks how to reach a legislator.

Scope is U.S. state legislators only: not members of Congress, governors, or local officials.

## Why it needs a name

No tool maps an address, ZIP code, or district to a legislator. So "who is my representative" or
"how do I reach my senator" gets a question back asking for the legislator's name and state.
Claude does not guess one from where you live.

If you don't know the name, find it first (your state legislature's website is one place to look),
then come back with it.

## Confirm it's the right person

Legislator search returns name and party only, with no state, chamber, or district, and a common
surname matches legislators in many states. Claude confirms the state from each candidate's
recorded votes. When more than one person still fits, including two records with the same name,
party, and state, it lists the candidates with party, state, and the date range of their recorded
votes, and asks which one you mean.

It never picks one silently: contact details for the wrong person would send your message to
someone else. Giving the state and the party up front usually settles it in one step.

If your project pins a `default_division`, candidates are tested against that state when you name
none; see [Configure a project](howto-configure-a-project.md).

## What the contact card shows

Once the person is identified, Claude calls `show_official` without being asked. In a host that
renders MCP Apps, the card shows:

- the legislator's photo, when one is on record;
- the seat line: office title, state and chamber, and district, each when recorded;
- party;
- every contact option on record, as buttons and menus (emails, phone numbers, websites, and
  addresses);
- a district map, when an outline of the district is on record;
- a tally of their most recent recorded votes, and recent votes.

The card does not show the term or any other seats held, but the written answer does when they are
recorded.

Hosts that cannot render cards get a text version: the seat line, the term and the election that
filled the seat when recorded, party, and one email, phone, and website each, plus any other seats
under "Also held".

## What the answer says

The written answer reports only what the contact lookup returned:

- **The seat,** exactly as recorded: office title, state, chamber, and district. When no seat is on
  record, it says the chamber and district are not recorded. It never infers them from the
  legislator's name search or from the bills they voted on.
- **The contact details on record,** naming each kind (email, phone, website) that is not on
  record. In a card host, the contact options are already on screen as buttons, so Claude names
  what is and isn't on record rather than listing every one again.
- **Term dates** only when recorded, and other seats as "also held", never merged into the current
  one.

The card's vote tally labels what it covers. It is never used to grade, score, rank, or
characterize the legislator.

## When contact details are not on record

Contact details and term dates are absent for most officials. When none are on record, the text
reads:

```text
No email, website or phone number is on record.
```

What happens then:

- **Claude says so plainly.** It does not guess an email address or phone number from a pattern.
- **Claude does not search the web on its own.** If your host has web search and you want Claude
  to look, ask it to. Anything it finds that way comes from that source, not from this dataset.
- **Use what is on record.** When a website is on record but no email or phone, start there.
- **Check outside the plugin.** Your state legislature's own website is another place to look.

## Next steps

- For how the legislator voted, ask for their voting record or run `/cicada-guide:voting-record`,
  which ends with the legislator record card. See
  [Check a voting record](howto-check-a-voting-record.md).
- For everything the contact card shows and sends back, see [Cards reference](reference-cards.md).
- Calls are rate limited to 60 a minute. Past that a call fails with `Rate limit exceeded. Retry in
  60 seconds.` Claude tells you and resumes after a minute.
