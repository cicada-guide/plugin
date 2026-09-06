# cicada-guide plugin

A Claude Code / Codex **plugin**, not an application. Every file here is Markdown or JSON read by a
plugin loader: there is no build step, no test suite, no dependencies, and nothing to compile. The
MCP server the plugin points at is a separate, private repo (`cicada-guide/mcp`) — its source is
not in this tree and cannot be changed from here.

This file covers working *on* the repo. User-facing behavior is [README.md](README.md); release
process and already-settled decisions are [PUBLISHING.md](PUBLISHING.md). Neither is duplicated
here — prefer fixing those files over growing this one.

## Verifying a change

There is no automated check. Load the checkout into a real session:

```bash
claude --plugin-dir /path/to/plugin
```

`/mcp` should list `guide-public` as connected, and `/help` should show the plugin's slash
commands. `curl https://public.cicada.guide/health` reports server health.

The server is public and needs no account, so **anyone can run that check from a fork** — there is
no privileged setup. What an outside contributor cannot verify is anything about the server's
deployment or its private repo; treat the endpoint as a fixed external dependency.

## Layout

| Path | Role |
| --- | --- |
| `.claude-plugin/plugin.json` | Claude manifest |
| `.claude-plugin/marketplace.json` | Marketplace entry, `"source": "./"` — the repo root *is* the plugin |
| `.codex-plugin/plugin.json` | Codex manifest: separate `interface` block and its own description text |
| `.mcp.json` | The single declaration of the MCP endpoint |
| `skills/state-legislation/` | Always-on skill, plus `references/` (tool reference, workflows, project settings) |
| `skills/*/SKILL.md` | Other skills are slash commands, one directory each |
| `agents/` | Subagents, one Markdown file each |
| `cicada-guide.local.md.example` | Template users copy to `.claude/cicada-guide.local.md` |

## Invariants

These break installed users silently — no error, no failing check, sometimes no symptom until
someone reports a wrong answer.

**Version is four fields in three files.** `.claude-plugin/plugin.json`,
`.codex-plugin/plugin.json`, and *both* `metadata.version` and `plugins[0].version` in
`.claude-plugin/marketplace.json`. They
are independent fields that drift when one is missed. Grep before committing a bump:
`grep -rn '"version"' .claude-plugin .codex-plugin`.

**Cross-component links use `${CLAUDE_PLUGIN_ROOT}`, never relative paths.** A subagent's working
directory is the user's project, so `../skills/...` resolves to nothing. Within
`skills/state-legislation/`, sibling `references/*.md` may be referenced relatively.

**The MCP `<server>` path segment is mandatory.** Tools reach the model as
`mcp__plugin_cicada-guide_guide-public__<tool>`. Dropping `guide-public` produces a name no
configuration can reach.

**The endpoint hostname is a published API surface.** It appears in `.mcp.json` and in prose.
Changing it breaks every installed user with no warning and no fallback; it moves only with a
version bump and a transition period where the old hostname still resolves.

**Tool documentation drifts silently.** The endpoint is unversioned, so nothing signals when the
live server gains, renames, or drops a tool. Tool lists are duplicated in `README.md`,
`skills/state-legislation/SKILL.md`, and `references/tool-reference.md`. Before editing any of
them, run `tools/list` against the live endpoint and reconcile all three against the server — not
against each other. Avoid writing a tool *count* into prose; it is the first thing to go stale.

**Never document a tool or parameter that you have not seen the server return.** Input schemas
reject unknown keys outright rather than ignoring them, so a plausible invented name is not a
harmless doc error — it is a runtime failure for every user who follows it.

## Product constraints

Deliberate limits, not oversights. Restating them is much of what the skills do, so relaxing one
means editing many files — do it as an explicit decision, never as a side effect.

- **U.S. state legislatures only.** No federal bills, municipal ordinances, or ballot measures.
- **Read-only.** Nothing here contacts officials, files documents, or changes state.
- **Legislators are never graded, scored, ranked, or predicted**, and claims come only from what a
  tool actually returned.
- **No account, API key, or OAuth.** Anonymous access is a feature; keep it that way.
- **The `context` analytics string carries no credentials, personal data, or names.**

## Conventions

- Prose wraps at ~100 columns. Frontmatter `description:` values stay on one line; tables unwrapped.
- Skill and agent prose is addressed to Claude at runtime: imperative and specific ("Pass at least
  one of `rollcall_id`, `bill_id`, or `people_id`"), not explanatory.
- Match the surrounding files for tone and heading style rather than introducing a new one.
- Commit subjects are plain sentence case with no prefix or tag.
- Nothing in this repo is secret, but nothing user-specific belongs in it either: per-project
  settings live in `.claude/*.local.md`, which is gitignored.
