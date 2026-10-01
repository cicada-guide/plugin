# Troubleshooting

Common problems when using the plugin, with the fix for each. For how the tools behave in normal
use, see the [tool reference](../skills/get-legislation/references/tool-reference.md).

## The server doesn't show up, or shows as disconnected

Run `/mcp` in Claude Code. The plugin's server is listed as `guide-public`.

1. **Check the server is up.** `curl https://public.cicada.guide/health` should return
   `{"status":"ok"}`. If it doesn't, the hosted server is down, and nothing on your side will
   fix it. Try again later, or open an issue.
2. **Check the plugin is installed and enabled.** `/plugin` opens the plugin manager. To
   reinstall:

   ```text
   /plugin marketplace add cicada-guide/plugin-anthropic
   /plugin install cicada-guide@cicada-guide
   ```

3. **Start a new session.** A host reads plugin configuration when a session starts.
4. **Check your network.** The host must reach `https://public.cicada.guide` over HTTPS. A
   corporate proxy or firewall that blocks it shows up as a failed connection, not as a tool
   error.

No sign-in is ever needed. If a host asks you to authenticate to `guide-public`, the host has made
a mistake; the server accepts anonymous callers.

## Slash commands are missing

`/help` should list `/cicada-guide:research-legislation`, `/cicada-guide:voting-record`, and
`/cicada-guide:contact-legislator`. If they're missing, the plugin isn't enabled in this session:
see step 2 above. The always-on skill has no command; it loads by itself when you ask about state
legislation.

## A call fails with "has not been loaded yet"

Some hosts list MCP tools by name only until the model loads their definitions. A call made before
that fails in the client and never reaches the server. The plugin's guidance tells Claude to load
a tool's definition with the tool-search tool before the first call. If it happens anyway, ask
Claude to load the tool and retry.

## Rate limit errors (HTTP 429)

Anonymous callers are rate limited to 60 a minute, counted per IP address. Past that a call fails
with `Rate limit exceeded. Retry in 60 seconds.` and the response carries `Retry-After: 60`.

- Claude tells you when the limit is hit and resumes after a minute. Retrying straight away uses
  up the next window too.
- Large sweeps, such as a topic across many states, run faster as a few narrower requests.
- Callers behind one shared IP address (an office NAT, a CI runner, a VPN) share one limit.

## An answer looks cut off

List results come in pages fitted under 25,000 characters, so a page can hold fewer items than
asked for; Claude pages on from where it stopped. Long bill text comes in parts the same way. Other
tool output truncates at 25,000 characters, with a pagination hint appended, and a truncated
response is not the complete answer. Ask Claude to page through the rest, or narrow the request
(one session, one chamber, a date range).

## Tool errors

Errors come back as tool results, not as a crash, in one of two shapes:

| Shape | Means | Fix |
| --- | --- | --- |
| Text starting `Error:` | The server understood the call but couldn't answer it, for example a votes query with no filter, or a search too broad for the time limit | The message names the problem. Narrow the request or add the missing filter |
| `MCP error -32602: Input validation error:` | The call passed a parameter the tool doesn't accept. Schemas reject unknown keys | Usually a guessed parameter name. The guidance names the valid ones; ask Claude to check the tool reference and retry |

An empty result is not an error. It means nothing matched; try a broader search.

## `-32602` from a card tool or `get_rollcall_breakdown`

`show_bill`, `show_official`, `show_person_record`, and `get_rollcall_breakdown` take no
`response_format`. Passing one fails with `MCP error -32602: Input validation error:` naming
`response_format`, because every schema rejects unknown keys.

The usual cause is a project default. A `.claude/cicada-guide.local.md` that pins
`response_format` applies to the other tools, and the guidance says to omit it from these four.
If the error appears anyway, ask Claude to retry the call without `response_format`. If it keeps
happening, update the plugin: versions before 0.8.0 predate some of these rules. The settings
contract is in [project-settings.md](../skills/get-legislation/references/project-settings.md).

## The bill card's headline or summary is rejected

`show_bill` requires a `headline` of 1 to 120 characters and a `summary` of 1 to 1,500 characters.
The server trims both first, so a value that is missing, empty, or only whitespace is rejected, and
so is one over its limit. Either way the call fails with `MCP error -32602: Input validation
error:` naming `headline` or `summary`, and no card appears.

Ask Claude to read the bill, write a plain-language headline under 120 characters and a summary
under 1,500, and show the bill again with both. When the bill has no text or synopsis on record,
the summary says so. If calls without a headline or summary keep happening, update the plugin:
versions through 0.8.0 treated `summary` as optional, and later ones before the `headline` change
never passed a headline.

## Cards don't appear

Cards render only in hosts that support MCP Apps. A text-only host, such as Claude Code in the
terminal, shows no card. Claude receives the call's text result or its structured data, depending
on the host: for `show_bill`, the bill's number, title, status and synopsis, but not the floor votes
or sponsors the card would fetch for itself. That is expected, not a fault. The plugin writes every answer from the data
tools so that it stands on its own without a card.

If you expected a card in a host that does render them:

- **Check that the call ran.** A card appears only when Claude calls `show_bill`, `show_official`,
  `show_person_record`, or `search_bills`. A topic search that lists several bills doesn't end with
  a bill card until you pick one.
- **A tapped bill appears in the conversation, not in the card.** Tapping a bill in the search
  results or a legislator record posts a request for Claude to show it. The bill card appears once
  Claude has read the bill and called `show_bill`. If the host can't send the request, the card
  says so; ask for the bill in the conversation instead.
- **Check for an error.** A card call that failed, for example with
  [`-32602`](#-32602-from-a-card-tool-or-get_rollcall_breakdown), puts nothing on screen.
- **Subagent results name a card rather than showing one.** A subagent's own calls are never shown
  to you, so the main conversation shows the card from the subagent's report. If it didn't, ask
  Claude to show it.

Why the plugin works this way is in [why the plugin is card-first](explanation-cards.md).

## A card shows something the answer doesn't mention

That is by design. A card fetches its own data, such as floor votes, sponsors, and a legislator's
vote history, and the written answer leaves out what the card already shows on screen. The answer
covers the question, the context, and the caveats instead.

To ask about something on the card, select it and ask. Selecting a floor vote, a document, or a
vote filter tells Claude what you are viewing, and Claude can look up the details with the data
tools. Claude doesn't see what the card fetched, so it answers from its own tool calls, not from
the card.

The summary on a bill card is labelled as written by the AI assistant. It is Claude's plain-language
reading of the bill text or synopsis, not an official summary, and it never predicts passage. The
headline on the card's title plate is Claude's too; tap the plate to see the official title. The
vote tallies on the legislator cards cover only the votes they name; the plugin never uses them to
grade or rank a legislator.

## A bill document shows as a link instead of its pages

The document viewer in the bill card's Documents tab draws a PDF's pages inside the card, and shows
the latest version of a non-PDF document as text. It shows the document's URL as a link with a
**Copy link** button instead when it can't: an older non-PDF version; a PDF over 20 MB, which is
the card's own limit; a PDF the server can't fetch from the legislature's site, such as one from a
site outside its list of known sources, or one over 20 MB from a site that can't send part of a
file; or a host that blocks the viewer's script from `public.cicada.guide`. Open the link, or copy it into a
browser. Claude can also
read the text with `get_latest_bill_document`.

## Contact details, chamber, or district are "not on record"

The plugin reports only what the tools return. Most officials have no contact details on record,
and some have no recorded seat. In both cases Claude says so rather than guessing:

- **Contact details** come from `show_official`. When none are recorded, it reports `No email,
  website or phone number is on record.` Claude never builds an email address or phone number
  from a pattern, and doesn't search the web for one unless you ask.
- **Chamber and district** come only from `show_official` and `show_person_record`, which return
  the recorded seat. When no seat is recorded, Claude says the chamber and district are not on
  record. It never infers them from a bill the legislator voted on, or from a name search, which
  returns a name and party only.

The state legislature's own website is another place to look.

## `/contact-legislator` asks for a name

`/cicada-guide:contact-legislator <name> [state]` looks a legislator up by name. With no argument,
it asks which legislator and which state. Asking for "my representative" or "my senator" also gets
a question back, because no tool maps an address, ZIP code or district to a legislator. Give the
legislator's name and state.

When several legislators share the name, Claude lists them with party, state and the dates of their
recorded votes, and asks which one you mean. Naming the state or party up front usually settles
it. See [the answer names the wrong legislator](#the-answer-names-the-wrong-legislator).

## The answer names the wrong legislator

Legislators with the same name are different people. Name the state, the party, or a session
or bill the person voted on, and Claude can tell them apart. A chamber or district you give is
checked against the seat the legislator's contact card returns; when no seat is recorded, it is
reported as unverified. When the records can't settle it, the plugin lists the candidates rather
than guessing.

No tool maps an address or district to a legislator. Asking about "my senator" or "my
representative" without a name gets a question back: give the legislator's name and state.

## Claude says the server isn't connected

If no cicada-guide tools are available in the session, Claude says the `guide-public` server isn't
connected rather than answering from general knowledge. See
[the server doesn't show up](#the-server-doesnt-show-up-or-shows-as-disconnected) above: run
`/mcp`, then start a new session.

## Using a host other than Claude Code

The endpoint `https://public.cicada.guide/mcp-anthropic` is a standard Streamable HTTP MCP server. Any host
that supports remote MCP servers can connect to it directly, with no credentials. Without the
plugin, though, the host doesn't get the skills and agents, only the raw tools.

## Still stuck

Open an issue at <https://github.com/cicada-guide/plugin-anthropic/issues>. Include the question you asked,
what happened, and the error text if there was one. Keep personal details out of it. Security
issues go through [SECURITY.md](../SECURITY.md) instead.
