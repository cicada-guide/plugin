# Cicada Guide

Research U.S. state legislation in ChatGPT, Codex, or Claude: search bills, read bill text, look up legislators, and
trace roll-call and individual voting records.

The plugin connects compatible AI hosts to the hosted cicada-guide MCP server at
`https://public.cicada.guide/mcp`, which serves state legislative data — bills, documents,
legislators, sessions, roll calls, and ~4.8M individual vote records.

## Installation

```text
/plugin marketplace add cicada-guide/plugin
/plugin install cicada-guide@cicada-guide
```

For local development, run a single session with the plugin loaded from a checkout:

```bash
claude --plugin-dir /path/to/plugin
```

No API key, no account, no OAuth flow. The server is open to anonymous callers, so the tools work
as soon as the plugin is enabled.

To verify, inspect the connected MCP tools and confirm the `guide-public` server is connected. It serves 15 tools as of
server version 1.2.0; the count grows as tools are added.

## What it does

Ask in plain language:

- "Find recent Alabama bills about school funding"
- "What does HB 314 actually do?"
- "Who sponsored this bill?"
- "How did Representative Reynolds vote most recently?"
- "Show me how the chamber split on that roll call"
- "Which states are in the data?"

Two packaged skills drive longer workflows:

| Command | Purpose |
| --- | --- |
| `/cicada-guide:bill-research <bill or topic> [state] [year]` | Sourced brief on one bill: status, sponsors, text, roll calls, votes |
| `/cicada-guide:voting-record <legislator> [state] [session]` | One legislator's voting history, or a party breakdown of one roll call |

## Scope

**U.S. state legislatures only.** The dataset holds no federal congressional bills, no municipal
ordinances, and no ballot measures. Coverage varies by state and session — `list_states` reports
which jurisdictions are present.

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
| **Rollcall** | A single recorded floor vote on a Bill, carrying the **aggregate** outcome: yea, nay, and absent totals, and whether the measure carried. |
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
[`cicada-guide.local.md.example`](cicada-guide.local.md.example) and edit it:

```markdown
---
enabled: true
default_division: Alabama
default_session: 2025 Regular Session
context_prefix: Constituent research desk
response_format: markdown
---

Focus on K-12 education funding. Bills before 2023 are out of scope for this project.
```

| Key | Effect |
| --- | --- |
| `enabled` | Anything but `true` disables the file entirely |
| `default_division` | Jurisdiction assumed when a question names no state |
| `default_session` | Session assumed within that jurisdiction |
| `context_prefix` | Prepended to the `context` string sent with each tool call |
| `response_format` | `markdown` or `json`, when a question implies neither. Not sent to `show_bill`, the one tool without the parameter |

Every key is optional, and so is the file — without it the plugin behaves exactly as before.
Text below the frontmatter is standing project context, folded into scoping decisions.

One caveat on `context_prefix`: the `context` parameter it extends is injected by the analytics
wrapper rather than declared by any tool schema, so it stops working if that instrumentation is
removed. The full contract, including how Claude recovers from that, is in
[`skills/state-legislation/references/project-settings.md`](skills/state-legislation/references/project-settings.md).

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
| `search_bills` | Search bills by number, topic, subject, status, sponsor, session, or state |
| `get_bill` | Full record for one bill |
| `show_bill` | Render a bill as an interactive card |
| `get_latest_bill_document` | Newest attached document, with its text |
| `get_documents` | All documents attached to a bill |
| `read_pdf_bytes` | Stream a large legislative PDF in chunks |
| `search_people` | Find legislators by name or party, or batch-resolve up to 100 ids |
| `get_person` | Full record for one legislator |
| `get_rollcalls` | Floor-vote summaries for a bill |
| `get_votes` | Individual positions on a roll call |
| `get_person_votes` | One legislator's voting history, with bill context joined |
| `list_states` | Available jurisdictions |
| `list_sessions` | Legislative sessions within a jurisdiction |

Full parameter reference: [`skills/state-legislation/references/tool-reference.md`](skills/state-legislation/references/tool-reference.md).

## Skills

- **`state-legislation`** — loads automatically on any state-legislation question. Carries tool
  selection, the votes-table filter rule, cursor-versus-offset pagination, the silent recall caps on
  topic search, the limits of legislator search, how to turn vote records into legislator names, and
  the `.claude/cicada-guide.local.md` settings contract.
- **`bill-research`** — the `/cicada-guide:bill-research` workflow. User-invoked only.
- **`voting-record`** — the `/cicada-guide:voting-record` workflow. User-invoked only.

## Agents

Three subagents handle work that would otherwise flood the conversation with intermediate tool
output. Claude dispatches them on its own when a request matches; each returns one consolidated
report rather than its call-by-call traffic.

- **`multi-state-bill-scanner`** — sweeps one policy topic across many jurisdictions and returns a
  side-by-side comparison. For cross-state questions only; a single bill or single state is a direct
  call sequence.
- **`legislator-disambiguator`** — resolves an ambiguous legislator name to one person id, probing
  each candidate for chamber and district evidence. Returns `RESOLVED`, `AMBIGUOUS`, or `NOT FOUND`
  and never guesses, because attributing a vote to the wrong person is this dataset's worst failure.
- **`bill-brief-researcher`** — assembles a full sourced brief on one bill: record, text, sponsors,
  roll calls, and the vote breakdown. Same ground as `/cicada-guide:bill-research`, run
  autonomously; it returns candidates instead of picking when the bill is ambiguous, since it cannot
  ask mid-run.

## Privacy

Requests go to `https://public.cicada.guide/mcp`. The server records anonymous usage analytics per
tool call — tool name, duration, result count, and the `context` string the model supplies,
including any `context_prefix` set in project settings. It does not require or store an account,
and anonymous callers are never challenged for credentials.

## Data sources

Legislative records are sourced from LegiScan and Open States. Accuracy and freshness depend on
those upstreams; a bill's status may have advanced since the last data load. Treat the output as
research support, not as an authoritative legal record.

## Links

- Issues and plugin source: <https://github.com/cicada-guide/plugin>
- Tool reference: [`skills/state-legislation/references/tool-reference.md`](skills/state-legislation/references/tool-reference.md)
- Call sequences for multi-step research: [`skills/state-legislation/references/workflows.md`](skills/state-legislation/references/workflows.md)
- Project settings contract: [`skills/state-legislation/references/project-settings.md`](skills/state-legislation/references/project-settings.md)

## License

[Apache-2.0](LICENSE). Copyright 2026 Cicada Bot, LLC.
