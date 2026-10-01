# How to verify a change

For anyone changing a skill, an agent, a manifest, or the docs. This page walks through every check
this repo has, from the offline script to trying the change in a real session, and says what CI
runs for you. [CONTRIBUTING.md](../CONTRIBUTING.md) is the short version; this page adds the
detail behind each step.

The checks answer different questions. A green offline run does not prove the tool docs match the
server, and neither script can tell whether Claude follows the guidance. Run the ones that cover
your change.

## Prerequisites

- Node 22. Nothing to install: the plugin has no dependencies and no build step.
- Network access to `https://public.cicada.guide` for the live check and for a real session. The
  server is public and needs no account, so this works from any fork.
- Claude Code, for loading the checkout into a session.

## Steps

### 1. Run the offline checks

From the repo root:

```bash
node scripts/check.mjs
```

It needs no network and finishes in well under a second. On success it prints
`All checks passed (N entry points, M Markdown files).` On failure it prints
`N check(s) failed:`, then one line per failure in the form `file:line: message`, and exits 1. The
line number is omitted when a failure belongs to the whole file.

It covers the three version fields, manifest names and `source`, the pinned endpoint and server key,
skill and agent frontmatter, `${CLAUDE_PLUGIN_ROOT}` paths and Markdown links, tool counts in
prose, the numbers in each restated dataset rule, the rules each entry point must carry, and
phrases that critique the dataset. Every check, its message, and its fix are in the
[checks reference](reference-checks.md).

Run it before every commit. When you change a rule on purpose, change `scripts/check.mjs` in the
same commit.

If Claude Code is installed, also run its own validator, which knows the current manifest, skill
and agent schemas:

```bash
claude plugin validate --strict .claude-plugin/marketplace.json
claude plugin validate --strict .claude-plugin/plugin.json
claude plugin validate --strict skills
claude plugin validate --strict agents
```

`--strict` fails on warnings as well as errors. CI runs the same four commands.

### 2. Reconcile the tool docs against the live server

Run this whenever you touch a tool name, a parameter, a parameter table, or a call example:

```bash
node scripts/check-live-tools.mjs
```

It reads the endpoint from `.mcp.json`, fetches the live `tools/list`, and checks the docs against
it: every live tool is named in `README.md`, `skills/get-legislation/SKILL.md`, and
`skills/get-legislation/references/tool-reference.md`; no skill, agent, or README names a tool
the server lacks; and no example or parameter table passes a parameter the tool's schema does not
declare. It prints `Documentation matches the live tools/list (N tools).` on success, exits 1 on a
mismatch, and exits 2 when it could not get a tool list at all.

To check against a saved response instead, for example to work offline or to keep a snapshot of
what the server returned, save one with the command from [PUBLISHING.md](../PUBLISHING.md)
(bash). The server is stateless, so this is one POST with no `initialize` first:

```bash
E=https://public.cicada.guide/mcp-anthropic
H=(-H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream'
   -H 'MCP-Protocol-Version: 2025-06-18')
curl -s "${H[@]}" "$E" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' |
  sed -n 's/^data: //p' > tools-list.json
```

The server answers as a server-sent event stream; the `sed` keeps the JSON from the `data:` line.
Then pass the file:

```bash
node scripts/check-live-tools.mjs --file tools-list.json
```

`--file` takes a path relative to your current directory and expects plain JSON: either the
JSON-RPC response (`{"result": {"tools": [...]}}`) or a bare `{"tools": [...]}`. Don't commit the
saved file. `--endpoint <url>` points the script at a different server, such as a local mock.

When this check fails, [How to update the tool docs](howto-update-tool-docs.md) walks through the
fix. Reconcile against the server, never against the other docs.

### 3. Check the server is up

```bash
curl https://public.cicada.guide/health
```

It returns `{"status":"ok"}`. If it doesn't, the hosted server is down; a failing session or live
check is then not your change. The server lives in a private repository, so report it with an issue
here.

### 4. Load the checkout into a real session

Only a real session shows whether Claude follows the guidance you wrote:

```bash
claude --plugin-dir /path/to/plugin
```

Then confirm the plugin loaded:

- **`/mcp`** lists `guide-public` as connected. If it does not, see
  [Troubleshooting](troubleshooting.md#the-server-doesnt-show-up-or-shows-as-disconnected).
- **`/help`** lists `/cicada-guide:research-legislation`, `/cicada-guide:voting-record`, and
  `/cicada-guide:contact-legislator`, plus any command you added.

Try the entry point you changed, then one you didn't, to catch a rule you moved from one file to
another. These questions exercise each one:

| Entry point | Try | Look for |
| --- | --- | --- |
| `get-legislation` (always on) | "Which states are in the data?" | The skill loads with no command, and `list_states` answers |
| `/cicada-guide:research-legislation` | `/cicada-guide:research-legislation HB 591 Alabama 2026` | The bill is scoped to one state and session, the brief cites its sources, and it ends with a `show_bill` call carrying a `headline` and a `summary` |
| `/cicada-guide:voting-record` | `/cicada-guide:voting-record Rex Reynolds Alabama` | Identity is resolved before votes are reported, and the answer ends with `show_person_record` |
| `/cicada-guide:contact-legislator` | `/cicada-guide:contact-legislator Rex Reynolds Alabama` | A `show_official` call without asking, and only the seat and contact details it returned |
| Any command, no argument | `/cicada-guide:contact-legislator` | A question back asking which legislator and which state, before any tool call |

Also watch for:

- **Tool names.** Calls go to `mcp__plugin_cicada-guide_guide-public__<tool>`. The tools carry
  `readOnlyHint: true`.
- **Rules the change relies on.** A rate-limit error, a page with `has_more` true, or a strict
  schema rejection (`MCP error -32602`) should be handled the way the entry point says.
- **What it does not do.** No grading or ranking of legislators, no claim the tools did not return,
  nothing outside U.S. state legislatures.

### 5. Run the eval suite

A real session shows one answer. The eval suite in `evals/` runs fixed prompts several times, with
and without the plugin, and grades each answer, so it catches a rule that holds in one session and
breaks in the next. Run it after changing a skill or agent:

```bash
claude plugin eval . --trust-plugin --allow-real-servers \
  --allow-tools "mcp__plugin_cicada-guide_guide-public__*" ToolSearch \
  --judge-model sonnet --threshold 0.8
```

- **`--judge-model sonnet`** grades the `llm` rubrics with a stronger model than the small default.
  The default judge has failed correct `bill-brief` replies because their tallies sat in a table
  rather than prose; the free `regex` checks in the same case passed.
- **Bill answers end with the card.** Claude writes the answer, calls `show_bill`, and may add a
  one-line note after it, so `bill-brief` grades Claude's own text across the whole reply
  (`target: trace`, matching only assistant text lines) rather than `last_message`, which can be
  that note alone.
- **`--allow-real-servers`** runs the cases against the live public server, since there are no
  mocks. Nothing in them writes, but they count toward the 60-a-minute rate limit.
- **Cost.** Every run and every `llm` grader is a model call on your account. The full suite is 30
  runs; `--ablation none` skips the no-plugin baseline and halves that.

Read the `WITH` column against `--threshold`. Without the plugin there are no cicada-guide tools,
so the baseline mostly measures data access on the bill, voting-record, and contact cases;
`no-ranking` and `contact-without-name` show what the guidance itself adds. `contact-recorded-only`
fails a reply that doubts a recorded address, says what another site lists, or adds a role the
tools did not return. Results go to `evals/results/`, which
is ignored. The [plugin eval docs](https://code.claude.com/docs/en/plugin-evals) cover the case
and grader format.

### 6. Check the cards in a host that renders them

A terminal renders no cards. There, a card tool call shows up as a call with its text fallback, so
confirm the call happened, at the end, with the right arguments, and that the written answer stands
on its own without it.

To see a card itself, use a host that supports MCP Apps. Check that the answer ends with the card
without asking and does not re-list what the card shows. How a card looks is decided by the server,
not by this repo; see [Cards](reference-cards.md) for what each one shows.

## What CI runs

The workflows are in `.github/workflows/` and run on `ubuntu-latest`; the two checks use Node 22.

| Workflow | Runs | When | Blocks a merge |
| --- | --- | --- | --- |
| `check.yml` | `node scripts/check.mjs`, then `claude plugin validate` (pinned Claude Code version, from npm) | Every pull request, and every push to `main` | Yes, when it fails |
| `live-tools.yml` | `node scripts/check-live-tools.mjs` | Nightly at 07:17 UTC, and on demand from the Actions tab (`workflow_dispatch`) | No. It never runs on a pull request, so a server outage cannot block a merge |
| `tag-release.yml` | Tags a new version `v<version>` | Every push to `main` that changes `.claude-plugin/plugin.json`, and on demand | No. It runs only after the merge |

Nothing in CI loads the plugin into a session or runs the eval suite; steps 4 and 5 are yours to
do. A failed nightly `live-tools` run usually means the server changed; start at
[How to update the tool docs](howto-update-tool-docs.md). If the failure reads
`initialize returned HTTP 403`, see the
[write-up on Cloudflare WAF 403s](solutions/integration-issues/cloudflare-waf-403-live-tools-diagnostics.md).

## Related

- [Checks reference](reference-checks.md): every check, its failure message, and its fix.
- [How to add a command or agent](howto-add-a-command-or-agent.md)
- [How to update the tool docs](howto-update-tool-docs.md)
- [PUBLISHING.md](../PUBLISHING.md): the release checklist, including an end-to-end install check
  from the marketplace.
