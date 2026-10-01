# Getting started with the cicada-guide plugin

This tutorial is for someone who has never used the plugin. By the end you will have it installed
in Claude Code, confirmed that its server is connected, asked about a bill and a legislator, seen
how cards appear, and run one of its slash commands. It takes about ten minutes and needs no
account, API key, or sign-in.

The plugin connects your AI host to the hosted cicada-guide server at
`https://public.cicada.guide/mcp-anthropic`, which serves U.S. state legislative data: bills, bill text,
legislators, sessions, roll calls, and individual votes. It covers state legislatures only, and it
is read-only: it looks things up and never contacts anyone or changes anything.

## What you'll need

- Claude Code.
- Network access to `https://public.cicada.guide` over HTTPS.
- Nothing else. The server accepts anonymous callers, so there is no key to paste and no OAuth
  flow to complete.

## Step 1: Install the plugin

In Claude Code, add the marketplace and install the plugin from it:

```text
/plugin marketplace add cicada-guide/plugin-anthropic
/plugin install cicada-guide@cicada-guide
```

Then start a new session. A host reads plugin configuration when a session starts, so a session
that was already open will not see the new tools.

**Done looks like:** the install command reports success, and you are in a fresh session.

If you are working from a checkout of the repository instead, load it for a single session:

```bash
claude --plugin-dir /path/to/plugin
```

## Step 2: Confirm the server and the commands

Run:

```text
/mcp
```

Find `guide-public`, listed under the cicada-guide plugin. It should show as **connected**.

Then run:

```text
/help
```

The list should include the plugin's three slash commands:

- `/cicada-guide:research-legislation`
- `/cicada-guide:voting-record`
- `/cicada-guide:contact-legislator`

The always-on `get-legislation` skill has no command of its own. It loads by itself whenever you
ask about state legislation.

**Done looks like:** `guide-public` is connected and the three commands appear in `/help`.

If `guide-public` is missing or disconnected, check that the server itself is up:

```bash
curl https://public.cicada.guide/health
```

It should print `{"status":"ok"}`. If it does and the server still doesn't connect, work through
[Troubleshooting](troubleshooting.md).

## Step 3: Ask about a bill

Ask in plain language, naming the state and the session:

```text
What does Alabama HB 591 from the 2026 Regular Session do?
```

Claude may ask for approval before each tool runs. The tools only read legislative data, so you
can allow them for the session. (They are marked as not read-only only because every call records
an analytics event on the server.)

Behind the scenes Claude resolves Alabama to its jurisdiction, searches for the bill number within
it, and reads the bill's record and its newest document. Naming the state matters: the same bill
number recurs across states and sessions, and a search for `HB 591` in 2026 alone can match bills
in more than one state.

**Done looks like:** an answer that names the bill by number, state, and session, gives its title
and its status as recorded, says what the bill does based on the text or synopsis it read, and
links the source document. If Claude comes back with a question about which bill or session you
mean, that is expected when a request leaves room for more than one match: answer it.

The answer describes the latest recorded status. It says a bill passed only when the record says
so: a roll call's tallies are not a result, and an enrolled document alone does not confirm
enactment.

## Step 4: See the bill card

Once the written answer is ready, Claude calls `show_bill` for that bill without being asked.

- **In a host that renders MCP Apps**, this puts a bill card on screen: the bill number, a title
  plate with Claude's plain-language headline (tap it to see the official title), the status, and
  tabs for Overview, Sponsors, Documents, and Votes. Overview holds a
  summary box with Claude's plain-language summary (labeled as written by your AI assistant), the
  Votes tab shows the floor votes with party splits, and the Documents tab opens each version in a
  viewer.
- **In a host that shows only text**, you get the written answer and a short text version of the
  bill instead. Nothing is lost: the written answer is built from the data tools so it stands on
  its own.

Whether you see a card depends on the host, not on the plugin.

**Done looks like:** either a bill card below the answer, or a `show_bill` call in the transcript
followed by the bill in text.

For everything each card shows and sends back, see [Cards reference](reference-cards.md).

## Step 5: Ask about a legislator

```text
How do I contact Alabama Representative Rex Reynolds?
```

Claude finds the legislator by name, confirms which person you mean, and ends with their contact
card from `show_official`. In a card-rendering host that card shows the photo, the seat, every
contact option on record as buttons, a district map when an outline exists, and a Recent
votes panel.

**Done looks like:** an answer that states the seat (office, state, chamber, district) as recorded,
names which contact details are on record and which are not, and ends with the contact card or
its text version. Contact details are not on record for most officials; when they are absent the
answer says so instead of guessing an address or number.

Two things to know about legislator questions:

- **Use a name.** No tool maps an address or ZIP code to a legislator, so "who is my
  representative" gets a question back asking for the legislator's name and state.
- **Same name, different people.** Legislator search returns name and party only. When a name
  matches more than one person, Claude lists the candidates and asks which one you mean rather
  than picking.

## Step 6: Run a slash command

The slash commands run longer, packaged workflows. Try the voting-record command:

```text
/cicada-guide:voting-record Rex Reynolds Alabama
```

**Done looks like:** the answer leads with the identification (full name, party, jurisdiction, and
seat as recorded) so you can confirm it is the right person, then lists recorded votes newest
first with the date, bill, the legislator's recorded position, and that roll call's tallies. It
states the window the votes cover. In a card-rendering host it ends with the legislator record from
`show_person_record`, where you can filter the votes by session, vote, and subject.

The answer reports votes; it never grades, scores, ranks, or predicts a legislator.

Run any command with no argument and it asks which bill or legislator you mean, and in which state.

## What you did

- Installed the plugin and confirmed `guide-public` is connected.
- Asked a bill question scoped by state and session, and saw the bill card or its text version.
- Asked a legislator question by name, and saw the contact card.
- Ran `/cicada-guide:voting-record`, which ends with the legislator record.

## Where to go next

- [Research a bill](howto-research-a-bill.md): find bills by number or topic and get a sourced
  brief.
- [Check a voting record](howto-check-a-voting-record.md): a legislator's history, one vote on one
  bill, or one roll call by party.
- [Contact a legislator](howto-contact-a-legislator.md): the contact card and what to do when
  details are not on record.
- [Configure a project](howto-configure-a-project.md): stop restating the same state and session.
- [Commands and agents reference](reference-commands-and-agents.md) and
  [Cards reference](reference-cards.md).
- [Troubleshooting](troubleshooting.md) if something doesn't connect or an answer looks cut off.
