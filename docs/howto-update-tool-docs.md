# How to update the tool docs

For contributors bringing the plugin's tool documentation back in line when the server adds,
renames, or removes a tool or a parameter. The server's source is in a private repository and its
endpoint is unversioned, so nothing announces a change: the nightly `live-tools` check failing is
usually the first sign.

The rule behind every step: **reconcile against the live server, never against the other docs.**
The tool list is repeated in three documents, and three copies agreeing with each other is exactly
the state drift leaves behind.

## When to do this

- The nightly `live-tools` workflow failed with a mismatch (exit 1), not a fetch error (exit 2).
- A tool behaves differently from what the
  [tool reference](../skills/get-legislation/references/tool-reference.md) says.
- You are about to edit a tool list, a parameter table, or a call example for any other reason.
- Before each release, per [PUBLISHING.md](../PUBLISHING.md).

## Steps

### 1. Save the live `tools/list`

The server is stateless, so this is one POST with no `initialize` (bash; the same command is in
PUBLISHING.md):

```bash
E=https://public.cicada.guide/mcp-anthropic
H=(-H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream'
   -H 'MCP-Protocol-Version: 2025-06-18')
curl -s "${H[@]}" "$E" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' |
  sed -n 's/^data: //p' > tools-list.json
```

Don't commit `tools-list.json`. To read it, with `jq`:

```bash
# Tool names
jq -r '.result.tools[].name' tools-list.json
# Each tool's parameters
jq -r '.result.tools[] | "\(.name): \(.inputSchema.properties | keys_unsorted | join(", "))"' tools-list.json
# Tools that take no response_format
jq -r '.result.tools[] | select(.inputSchema.properties.response_format == null) | .name' tools-list.json
# One tool's full schema: types, limits, required
jq '.result.tools[] | select(.name == "show_bill") | .inputSchema' tools-list.json
```

Every schema lists `context` and `llm_model`. The server's analytics wrapper adds both to each
tool; they are documented once, under "Shared parameters" in the tool reference, not per tool.

### 2. See what disagrees

```bash
node scripts/check-live-tools.mjs --file tools-list.json
```

Each line names a file and what is wrong: a live tool a list lacks, a documented tool the server
lacks, or a parameter an example or table passes that the schema does not declare. The
[checks reference](reference-checks.md#check-live-toolsmjs) has every message.

A clean run is necessary, not sufficient. The script checks that each live tool's name appears
somewhere in each list, not that it has a row, and it cannot see a changed type, limit, default,
or response shape. Read the schema for every tool you touch.

### 3. Reconcile the three tool lists

Edit each against `tools-list.json`:

| File | What to update |
| --- | --- |
| `README.md` | The table under `## Tools`: one row per live tool, with the name in backticks and a short purpose |
| `skills/get-legislation/SKILL.md` | The table under `## Tool selection` (`Goal` → `Tool`; a tool can have several rows), and any prose around it that names the tool |
| `skills/get-legislation/references/tool-reference.md` | The tool's `###` section, the "Shared parameters" rows that list which tools take `limit`, `offset`, and `response_format`, and the verification line at the top |

Update the tool reference's opening line to the date you checked, for example "Verified against
the live endpoint's `tools/list`, MCP protocol revision `2025-06-18`, on <date>." Record anything
you confirmed with a live call as dated, the way the existing notes do.

### 4. Keep parameter tables in the checked format

`check-live-tools.mjs` checks the parameter tables in the tool reference, but only in this shape:

````markdown
### `search_bills`

| Parameter | Type | Notes |
| --- | --- | --- |
| `bill` | string, max 50 | Bill number with its chamber prefix ("HB 314"); exact match ignoring case, spaces and dots. A number alone ("314") returns no bills and a prompt to add the prefix |
| `query` | string, max 500 | ... |
````

- The section starts at a `###` heading whose text is the tool name in backticks.
- The table's header row starts with `| Parameter |`.
- Each row's first cell is the parameter name in backticks.

Any `#`, `##`, or `###` line ends the section, even one inside a fenced code block, so put the
table before any example output that contains a Markdown heading. A table with a different header,
or with a tool that the server does not list, is not checked. Tools that take one or two
parameters describe them in a sentence instead (`` `id` (UUID, required) ``); that prose is not
checked, so compare it against the schema by eye.

### 5. Keep call examples in the checked format

Examples in the skills, agents, and README are checked when written like this, with a flat
`arguments` object:

```json
{ "tool": "search_bills", "arguments": { "bill": "HB 314", "division_id": "<division uuid>" } }
```

The script reads `"tool": "<name>", "arguments": { ... }` in that order and checks each quoted key
before the first closing brace. Keep `arguments` flat: a nested object ends the match early. An
example for a tool the server does not list is skipped, so remove examples for a removed tool by
hand.

### 6. Update the `response_format` exclusion lists

Some tools take no `response_format`, and a strict schema rejects it with `-32602`. A user who pins
one in project settings must never have it sent to those tools, so the list is spelled out in the
settings docs, in three places:

- `README.md`, the `response_format` row of the project-settings table.
- `skills/get-legislation/references/project-settings.md`, under "`response_format` must not
  reach the tools without it".
- `cicada-guide.local.md.example`, the comment above `response_format:`.

The tool reference's "Shared parameters" table repeats it in the `response_format` row. When a tool
gains or loses the parameter, or a tool without it is added or removed, update all four. The
`jq` query in step 1 gives the current list. Then grep for the other mentions, such as the
constraints sections of the command skills and the error table in `references/workflows.md`:

```bash
grep -rn "response_format" skills agents README.md cicada-guide.local.md.example
```

### 7. Update the other mentions

Skills and agents name tools in their workflows. Find every mention of the tool, here the one
0.8.0 removed:

```bash
grep -rn '`open_research_desk`' skills agents README.md docs cicada-guide.local.md.example
```

For a rename, update each mention. For a removal, remove it and the guidance that sent Claude to
it. For a new tool, decide which entry points should use it, and restate in each of them any
dataset rule the new guidance relies on (see
[How to add a command or agent](howto-add-a-command-or-agent.md#4-restate-the-dataset-rules-it-relies-on)).
`docs/` is not checked against the live server, so read its pages yourself.

### 8. Check, then record the change

```bash
node scripts/check.mjs
node scripts/check-live-tools.mjs --file tools-list.json
```

Add a line under `Unreleased` in `CHANGELOG.md`. Changes that follow the server start with
"Updated to match the server:".

## Rules that apply throughout

- **Never document a tool or parameter you have not seen the server return.** Every schema rejects
  unknown keys, so a plausible invented name is a runtime failure for every user who follows it,
  not a harmless doc error.
- **Don't write a tool count in prose.** A number followed by "tools" goes stale first, and
  `check.mjs` rejects it. Describe the tools instead.
- **Describe what the tools return.** Say "not recorded" or "not on record" rather than
  characterizing the data; `check.mjs` rejects wording that critiques the dataset.
- **Keep the `guide-public` segment** in any fully qualified name:
  `mcp__plugin_cicada-guide_guide-public__<tool>`.
- **A new name prefix needs the script too.** The "documented tool the server lacks" check only
  recognizes backticked names starting `get_`, `search_`, `list_`, `show_`, `open_`, or `read_`. A
  tool with another prefix needs `TOOL_SHAPE` in `scripts/check-live-tools.mjs` extended in the
  same commit, or its removal later goes unnoticed.

## Example: removing `open_research_desk` in 0.8.0

The server stopped serving `open_research_desk`, its interactive research workspace. Against the
new `tools/list`, `check-live-tools.mjs` reports each backticked `open_research_desk` left in the
skills or README as "not a tool on the live server". The 0.8.0 change removed it from:

| File | What was removed |
| --- | --- |
| `README.md` | Its row in the Tools table, and its name in the `response_format` settings row |
| `skills/get-legislation/SKILL.md` | The "Open an exploratory research workspace" row in Tool selection, and the sentence sending exploration requests to it |
| `skills/get-legislation/references/tool-reference.md` | Its `###` section, and its name in the Shared parameters `response_format` row |
| `skills/get-legislation/references/project-settings.md` | Its name in the list of tools without `response_format` |
| `cicada-guide.local.md.example` | Its name in the comment above `response_format:` |

What replaced it came from the server, not from the other docs: `search_bills` now renders a
results card, so exploration requests go there. The CHANGELOG entry went under `### Removed`:
"`open_research_desk`, which the server no longer serves, from README, the skills, the tool
reference, and the project-settings template."

## Related

- [Checks reference](reference-checks.md)
- [How to verify a change](howto-verify-a-change.md)
- [Tool reference](../skills/get-legislation/references/tool-reference.md)
- [PUBLISHING.md](../PUBLISHING.md): reconciling before a release.
