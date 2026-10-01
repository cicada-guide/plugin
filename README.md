# cicada.guide

Research U.S. state legislation in Claude: search bills, read bill text, look
up legislators, and trace roll-call and individual voting records.

The plugin connects compatible AI hosts to the hosted cicada-guide MCP server at
`https://public.cicada.guide/mcp-anthropic`, which serves state legislative data — bills, documents,
legislators, sessions, roll calls, and ~5.6M individual vote records.

## Installation

```text
/plugin marketplace add cicada-guide/plugin-anthropic
/plugin install cicada-guide@cicada-guide
```

For local development, run a single session with the plugin loaded from a checkout:

```bash
claude --plugin-dir /path/to/plugin
```

No API key, no account, no OAuth flow. The server is open to anonymous callers, so the tools work
as soon as the plugin is enabled. If the tools don't appear, start a new session: a host reads
plugin configuration when a session starts.

To verify, run `/mcp` and check that `guide-public` (listed under the cicada-guide plugin) shows as
connected. If it doesn't, see [Troubleshooting](docs/troubleshooting.md). The server provides the
tools listed under [Tools](#tools) below; that set grows as tools are added.

Claude Code may ask for approval before a tool runs. The tools only read legislative data, so you
can allow them for the session.

## What it does

Ask in plain language:

- "Find recent Alabama bills about school funding"
- "What does Alabama HB 591 from the 2026 Regular Session do?"
- "Which Alabama bills about school choice passed in 2026?"
- "Who sponsored this bill?"
- "How did Alabama Representative Rex Reynolds vote most recently?"
- "How did Alabama Representative Rex Reynolds vote on HB 591 in the 2026 Regular Session?"
- "Show me how the chamber split on that roll call"
- "How do I contact Alabama Representative Rex Reynolds?"
- "Which states are in the data?"

Name the state, and the session or year when you know it: the same bill number recurs across
states and sessions.

Three packaged skills drive longer workflows:

| Command | Purpose |
| --- | --- |
| `/cicada-guide:research-legislation <bill number or topic> [state] [year]` | Sourced brief on one bill: status, sponsors, text, roll calls, votes. A topic lists matching bills first |
| `/cicada-guide:voting-record <legislator name> [state] [bill] [session or date range]` | One legislator's voting history or vote on one bill, or a party breakdown of one roll call |
| `/cicada-guide:contact-legislator <name> [state]` | One legislator's recorded seat and contact details, on a contact card |

With no argument, each command asks which bill or legislator you mean, and in which state.

**Cards.** In hosts that render MCP Apps, answers end with the fitting card without being asked: a
bill card after bill research, a legislator record after a voting-record question, and a contact
card after a contact question. `search_bills` shows its results as a card too. Hosts that cannot
render cards get a shorter text version instead, so the written answer is complete on its own.

## Scope

Research briefs distinguish the latest available status from conflicting document labels: an
enrolled document alone does not confirm enactment. Latest-vote lookups confirm the legislator's
jurisdiction and report the date, measure, recorded position, roll-call tallies, and source when
available. Pass or fail is reported only where the record states it, since the tools return tallies
rather than results.

**U.S. state legislatures only.** The dataset holds no federal congressional bills, no municipal
ordinances, and no ballot measures. `list_states` reports which jurisdictions are present.

**Legislators are looked up by name.** No tool maps an address or district to a legislator, so
"my senator" or "my representative" gets a question back: give the legislator's name and state.
A legislator's chamber and district are stated only when their contact card or legislator record
returns a seat; otherwise the answer says they are not recorded.

Everything is read-only. The tools retrieve legislative records and cannot send messages, contact
officials, file documents, or change anything.

## Domain vocabulary

A **Division** holds many **Sessions**; a Session holds many **Bills**. A Bill accumulates
**Documents** as it is amended, and may be put to zero or more **Rollcalls**. Each Rollcall
contains one **Vote** per legislator who was recorded.

| Term | Meaning |
| --- | --- |
| **Division** | The top-level jurisdiction legislation belongs to. `list_states` returns exactly 51: the 50 states plus the District of Columbia. "State" is the everyday synonym; Division is the modelled term because DC is not a state. No territories. |
| **Session** | A bounded sitting of a Division's legislature, with dates it convenes and adjourns. A Bill belongs to exactly one Session. |
| **Bill** | One piece of proposed legislation within one Session. |
| **Document** | A text artifact attached to a Bill — introduced, engrossed, an amendment. "The bill text" means the most recent Document, not a fixed one. |
| **Rollcall** | A single recorded floor vote on a Bill, carrying the **aggregate** yea, nay, absent, and not-voting counts tallied from its recorded Votes. The dataset does not record whether the measure carried. |
| **Vote** | **One legislator's individual position** within a Rollcall. |

Two distinctions do real work here:

- **A Rollcall is not a Vote.** The aggregate floor result is a Rollcall; only an individual
  legislator's recorded position is a Vote. Using "vote" for both is the most common way to
  misread this data.
- **A bill number alone never identifies legislation.** It is unique only within its Division and
  Session. The same number recurs across states and years, so resolving one to a specific Bill
  requires jurisdiction and session as context. Every lookup takes an opaque UUID instead.

Votes are the finest grain and by far the most numerous, so they are only ever retrieved narrowed
to a Rollcall, a Bill, or a person — never surveyed in bulk.

## Project settings

Optional. A project can pin research defaults in `.claude/cicada-guide.local.md` at its root,
so you stop restating the same state and session in every question. Copy
[`cicada-guide.local.md.example`](cicada-guide.local.md.example) and edit it. If you installed
from the marketplace, the template is at
<https://github.com/cicada-guide/plugin-anthropic/blob/main/cicada-guide.local.md.example>.

```markdown
---
enabled: true
default_division: Alabama
# default_session: <session name from list_sessions>
context_prefix: Constituent research desk
response_format: markdown
---

Focus on K-12 education funding. Bills before 2023 are out of scope for this project.
```

| Key | Effect |
| --- | --- |
| `enabled` | Anything but `true` disables the file entirely |
| `default_division` | Jurisdiction assumed when a question names no state |
| `default_session` | Session assumed within that jurisdiction. Left commented out in the template, so copying it as-is pins no session |
| `context_prefix` | Prepended to the `context` string sent with each tool call |
| `response_format` | `markdown` or `json`, when a question implies neither. Not sent to `show_bill`, `show_person_record`, `show_official`, or `get_rollcall_breakdown`, which lack the parameter |

Every key is optional, and so is the file — without it the plugin behaves exactly as before.
Text below the frontmatter is standing project context, folded into scoping decisions.

One caveat on `context_prefix`: the `context` parameter it extends is added to every tool schema
by the server's analytics wrapper rather than by the tools themselves, so it stops working if that
instrumentation is removed. The full contract, including how Claude recovers from that, is in
[`skills/get-legislation/references/project-settings.md`](skills/get-legislation/references/project-settings.md).

Two things it deliberately cannot do. A default never overrides an explicit request — asking
about Texas gets Texas, whatever `default_division` says — and the file cannot widen scope or
lift the plugin's constraints, so federal bills stay out of reach and legislators stay ungraded.
When a default is applied, Claude says so in the answer.

The file is per-project and per-user. Add `.claude/*.local.md` to your `.gitignore`.

No restart needed — skills read the file at the start of a task. Mid-session is the exception: if
Claude already read the file this session it may still be working from that copy, so mention the
change when you make one.

## Tools

| Tool | Purpose |
| --- | --- |
| `search_bills` | Search bills by number, topic, subject, status, sponsor, session, or state. Hosts that support MCP Apps also show the results as a card |
| `get_bill` | Full record for one bill |
| `get_bill_dossier` | Bill card data: resolved sponsors, documents, and initial roll calls |
| `show_bill` | Show a bill as a card with floor votes, sponsors, documents, and a required assistant-written headline and summary |
| `get_latest_bill_document` | Newest attached document, with its text |
| `get_documents` | All documents attached to a bill |
| `read_pdf_bytes` | Stream a large legislative PDF in chunks |
| `search_people` | Find legislators by name or party, or batch-resolve up to 100 ids |
| `get_person` | Name, party, and contact details for one legislator |
| `show_person_record` | Show a legislator's record: seat, voting history with session, vote, and subject filters, and sponsored bills |
| `show_official` | Show a legislator's contact card: photo, seat, contact options, district map, and recent votes |
| `get_rollcalls` | Floor-vote summaries for a bill |
| `get_rollcall_breakdown` | One roll call's counts, per-party tally, and every member's name, party, and vote |
| `get_votes` | Individual positions on a roll call |
| `get_person_votes` | One legislator's voting history, with bill context joined |
| `list_states` | Available jurisdictions |
| `list_sessions` | Legislative sessions within a jurisdiction |
| `get_more_tools` | Report a request no tool can serve. Returns no data; the server keeps the note to learn which tools are missing |

Full parameter reference: [`skills/get-legislation/references/tool-reference.md`](skills/get-legislation/references/tool-reference.md).

## Skills

- **`get-legislation`** — loads automatically on any state-legislation question. Carries tool
  selection, the votes-table filter rule, cursor-versus-offset pagination, the silent recall caps on
  topic search, the limits of legislator search, how to turn vote records into legislator names, and
  the `.claude/cicada-guide.local.md` settings contract.
- **`research-legislation`** — the `/cicada-guide:research-legislation` workflow. Invoke it by name,
  or let Claude reach for it when a request calls for a full brief.
- **`voting-record`** — the `/cicada-guide:voting-record` workflow. Invoke it by name, or let
  Claude reach for it when a request calls for a voting record.
- **`contact-legislator`** — the `/cicada-guide:contact-legislator` workflow. Invoke it by name, or
  let Claude reach for it when a request asks how to reach a legislator.

## Agents

Two subagents handle work that would otherwise flood the conversation with intermediate tool
output. Claude dispatches them on its own when a request matches; each returns one consolidated
report rather than its call-by-call traffic.

- **`legislator-disambiguator`** — resolves an ambiguous legislator name to one person id, probing
  each candidate's vote history for the state they serve and reading their recorded seat. It checks
  a chamber or district in the request against that seat, and flags it as unverified when no seat
  is recorded. Returns `RESOLVED`, `AMBIGUOUS`, or `NOT FOUND` and never guesses, because
  attributing a vote to the wrong person is this dataset's worst failure.
- **`bill-brief-researcher`** — assembles a full sourced brief on one bill: record, text, sponsors,
  roll calls, and the vote breakdown. Same ground as `/cicada-guide:research-legislation`, run
  autonomously; it returns candidates instead of picking when the bill is ambiguous, since it cannot
  ask mid-run.

A subagent's output is not shown as a card, so each one names the card that fits its result, and
Claude shows it in the conversation.

## Privacy

Requests go to `https://public.cicada.guide/mcp-anthropic`. The server records anonymous usage
analytics per tool call: the tool name and the arguments passed to it (search terms, names, ids),
duration, result count, the calling client's name and user agent, the `context` string the model
supplies (including any `context_prefix` set in project settings), and the `llm_model` value — the
calling model's identifier, or `"unknown"`. When the model omits `context`, the server records
a generic note built from the tool's purpose and the argument names instead. A call to
`get_more_tools` records the model's note on what it was trying to do. Keep personal details out
of your requests for that reason. It does not require or store an account, and anonymous callers are never challenged for
credentials.

What the plugin runs, sends, and fetches:

- **Runs no code of its own.** The plugin has no hooks, no local MCP server, and no scripts that
  Claude Code executes; `scripts/` holds contributor checks that only a maintainer runs by hand.
  Its one component that reaches the network is the remote MCP server in `.mcp.json`. The skills
  ask Claude to read one optional file in your project, `.claude/cicada-guide.local.md`, for
  default settings, and values from it such as `default_division` and `context_prefix` can go into
  tool calls.
- **Sends** each tool call, as described above, to `public.cicada.guide` over HTTPS, and nowhere
  else. No credential, key, or environment variable is read or sent.
- **Where the server sends it:** analytics go to PostHog (United States). Cloudflare, which hosts
  the server, keeps request logs that can include your IP address and applies rate limits by it.
  Analytics are kept for up to 7 years and request logs for a few days.
- **Fetches on your behalf:** `get_latest_bill_document` and `read_pdf_bytes` have the server
  download a bill's public document from the state legislature's own website; `read_pdf_bytes`
  accepts only legislature hosts on the server's allowlist.
- **Cards** load legislator photos and the bill card's PDF viewer from `public.cicada.guide` only.
  Any other data a card shows comes from the same server's tools, called through the host, not
  fetched by the card itself.

The full policy is at <https://public.cicada.guide/privacy>.

## Data sources

Legislative records are sourced from LegiScan and Open States. Accuracy and freshness depend on
those upstreams; a bill's status may have advanced since the last data load. Treat the output as
research support, not as an authoritative legal record.

## Links

- Issues and plugin source: <https://github.com/cicada-guide/plugin-anthropic>
- Tool reference: [`skills/get-legislation/references/tool-reference.md`](skills/get-legislation/references/tool-reference.md)
- Call sequences for multi-step research: [`skills/get-legislation/references/workflows.md`](skills/get-legislation/references/workflows.md)
- Project settings contract: [`skills/get-legislation/references/project-settings.md`](skills/get-legislation/references/project-settings.md)
- Getting started: [`docs/tutorial-getting-started.md`](docs/tutorial-getting-started.md)
- Troubleshooting: [`docs/troubleshooting.md`](docs/troubleshooting.md)
- Documentation index — tutorial, how-to guides, reference, and explanation: [`docs/README.md`](docs/README.md)
- Contributing, changelog, and security policy: [`CONTRIBUTING.md`](CONTRIBUTING.md),
  [`CHANGELOG.md`](CHANGELOG.md), [`SECURITY.md`](SECURITY.md)

## License

[Apache-2.0](LICENSE). Copyright 2026 Cicada Bot, LLC.
