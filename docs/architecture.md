# Architecture

The plugin is configuration and guidance, not code. It declares one remote MCP server and ships
Markdown that tells Claude how to use that server's tools well. Every behavior a user sees comes
from one of two places: the hosted server, which decides what data comes back, or the guidance in
this repo, which decides how Claude asks and how it reports. In hosts that support MCP Apps, the
server also renders interactive cards; the guidance decides when to show one and what to write
beside it.

```text
 host (Claude Code)
   │  reads the manifest
   ▼
 .claude-plugin/plugin.json ─┐
 .claude-plugin/marketplace.json
   │                          │
   │ skills/  agents/         │ .mcp.json  ──  "guide-public"
   ▼                          ▼
 guidance loaded into    Streamable HTTP ──► https://public.cicada.guide/mcp-anthropic
 the model's context                          (Cloudflare Worker, private repo
                                               cicada-guide/mcp-anthropic, read-only data)
```

## Manifests

- **`.claude-plugin/plugin.json`** is the Claude manifest.
- **`.claude-plugin/marketplace.json`** lets `/plugin marketplace add cicada-guide/plugin-anthropic` work.
  Its single entry has `"source": "./"`: the repo root *is* the plugin, so there is no
  sub-directory to package.
The two files carry three independent `version` fields. They must match, or hosts see different
releases. `scripts/check.mjs` fails until they agree.

## The MCP server

`.mcp.json` declares exactly one server, keyed `guide-public`, at
`https://public.cicada.guide/mcp-anthropic`. Two consequences follow:

- **Tool names include the server key.** A host exposes each tool to the model as
  `mcp__plugin_cicada-guide_guide-public__<tool>`. Agent allowlists and any prose that names a
  fully qualified tool must keep the `guide-public` segment. Without it the name matches nothing.
- **The hostname is a published API.** Every installed copy of the plugin has it baked in. It
  moves only with a version bump and a transition period in which the old hostname still
  resolves. See [PUBLISHING.md](../PUBLISHING.md#infrastructure-dependency).

The server is public and anonymous: no account, API key or OAuth. Its source lives in a private
repository, so this repo treats the endpoint as a fixed external dependency. The endpoint is also
unversioned: nothing announces a new, renamed or removed tool. That is why the nightly live check
below exists.

## Skills and agents

The plugin ships four skills and two subagents. There are three kinds of entry point, and each
reaches the model differently:

| Kind | Where | How it loads |
| --- | --- | --- |
| Always-on skill | `skills/get-legislation/` | Loads automatically on any state-legislation question. Its `references/` hold the tool reference, workflows and project-settings contract |
| Slash-command skills | `skills/research-legislation/`, `skills/voting-record/`, `skills/contact-legislator/` | Run as `/cicada-guide:<name>`, or when Claude judges a request needs the full workflow |
| Subagents | `agents/*.md`: `bill-brief-researcher`, `legislator-disambiguator` | Dispatched by Claude for long, autonomous jobs; each returns one consolidated report |

The three slash commands each own one workflow and end with a card when the answer fits one:
`research-legislation` writes a sourced brief on one bill and ends with `show_bill`, or lists the
bills that match a topic; `voting-record` covers a legislator's history, their vote on one bill, or
one roll call by party, and ends with `show_person_record` or `show_bill`; `contact-legislator`
resolves one legislator by name and ends with `show_official`. A request about "my senator" without
a name gets a question back, because no tool maps an address or district to a legislator.

Two design rules follow from how they load.

**Each entry point restates the dataset rules it relies on.** A subagent never loads the
always-on skill, and a slash command can run without it. So the rate limit, truncation, the error
shapes, the `context` rule and the rest are copied into each file that needs them, not linked.
The copies must agree. `scripts/check.mjs` checks that every entry point carries the rules it
relies on, and that every restated number matches the server's value. The reasons for each rule
are in [why each entry point restates the dataset rules](explanation-dataset-rules.md).

**Cross-component links use `${CLAUDE_PLUGIN_ROOT}`.** A subagent runs with the user's project as
its working directory, so a relative path such as `../skills/...` resolves to nothing. Only files
inside `skills/get-legislation/` may link their sibling `references/` relatively.

Agents are also sandboxed. Their frontmatter `tools:` allowlist names only `Read` and the
`guide-public` server's tools, so an agent that reads bill text or a PDF cannot run commands or
write files, whatever that text says.

## Cards

Four tools carry an MCP Apps resource: `search_bills`, `show_bill`, `show_official`, and
`show_person_record`. The split of responsibility is simple:

- **The server renders.** Each card is a static HTML resource on the server. In a host that
  supports MCP Apps, the call puts the card on screen, and the card fetches the rest of its data,
  such as floor votes, sponsors, and vote history, over the host bridge. Nothing in this repo draws
  a card, and a card's layout changes with the server, not with a plugin release.
- **The plugin decides when.** The skills end each answer with the card that fits, without asking:
  `show_bill` with an assistant-written `headline` and `summary` for a bill, `show_official` for
  who a legislator is or how to reach them, `show_person_record` for their record. `search_bills`
  renders a results
  card on every call.

What reaches the model is thinner than what the card shows: depending on the host, either the text
fallback or `structuredContent`, and neither carries what the card fetched for itself. So the
written answer is always built from the data tools, and stands on its own in a host that renders no
cards, such as the terminal. When the user selects something on a card, the host passes the model a
short text update naming what they are viewing; it carries names, not ids.

**Subagents name a card instead of calling it.** A subagent's output goes to the conversation that
dispatched it, not to the user, so a card it opened would render nowhere. Each agent ends its report
with the card that fits, such as `show_bill {id, headline, summary}`, and the main conversation
calls it.
`legislator-disambiguator` calls `show_official` only to read a candidate's recorded seat.

A legislator's chamber and district come only from `show_official` and `show_person_record`, which
return the recorded seat. `search_people` and `get_person` return a name and party only.

The reasoning, and how this changed in 0.8.0 when `open_research_desk` was removed, is in
[why the plugin is card-first](explanation-cards.md). What each card shows and returns is in the
[cards reference](reference-cards.md).

## Project settings

Users can put a `.claude/cicada-guide.local.md` in their own project, copied from
[`cicada-guide.local.md.example`](../cicada-guide.local.md.example). It sets a default response
format, a `context` prefix and default jurisdictions. A pinned response format is never sent to
the card tools or `get_rollcall_breakdown`, which take no `response_format`. The contract is in
[project-settings.md](../skills/get-legislation/references/project-settings.md). The file is
per-user and gitignored. Nothing user-specific belongs in this repo.

## Checks

| Script | When | What it proves |
| --- | --- | --- |
| `scripts/check.mjs` | Every pull request and push to `main` (`.github/workflows/check.yml`) | Offline invariants: versions, manifest names, the pinned endpoint and server key, frontmatter, agent allowlists, links, tool counts in prose, restated numbers, required rules per entry point, and wording that critiques the dataset |
| `scripts/check-live-tools.mjs` | Nightly and on demand (`.github/workflows/live-tools.yml`), never on a pull request | The tool lists in the README, the always-on skill and the tool reference match the live `tools/list`, and no example passes a parameter the schema lacks |

The live check stays off pull requests so that a server outage cannot block a merge. Neither
script can tell whether Claude *follows* the guidance. For that, load a checkout with
`claude --plugin-dir /path/to/plugin` and try it (see [CONTRIBUTING.md](../CONTRIBUTING.md)).

## Related

- [Why the plugin is card-first](explanation-cards.md)
- [Why each entry point restates the dataset rules](explanation-dataset-rules.md)
- [Troubleshooting](troubleshooting.md)
