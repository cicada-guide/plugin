# Publishing

The original blockers — a private repository and no license — are resolved. This file is now the
release checklist and the record of what was decided, so the settled questions are not reopened
every release.

## Settled decisions

| Decision | Choice | Why |
| --- | --- | --- |
| License | Apache-2.0 | Permissive with an explicit patent grant. `LICENSE` at the repo root, `"license": "Apache-2.0"` in the plugin manifest. |
| Repository | `cicada-guide/plugin-anthropic`, public | The plugin lives here; the Worker source stays private in `cicada-guide/mcp-anthropic`. |
| Layout | Repo root is the plugin | `.claude-plugin/` holds both `marketplace.json` (`"source": "./"`) and `plugin.json`. |
| MCP endpoint | `https://public.cicada.guide/mcp-anthropic` | Cloudflare Custom Domain on the Worker, rather than the `workers.dev` hostname. The path was `/mcp` until 0.9.0; the server still answers it for earlier installs. |
| MCP server key | `guide-public` | Tools surface as `mcp__plugin_cicada-guide_guide-public__search_bills`. The `<server>` segment is mandatory — `mcp__plugin_cicada-guide__search_bills` is not reachable by any configuration. |
| Contact email | None | The manifests' `author` and `owner` carry a name and URL only, and issues route through the repo. |
| Always-on skill name | `get-legislation` | Named `state-legislation` in 0.2.0, renamed from `cicada-guide`, which had produced `/cicada-guide:cicada-guide`; that pass also converted cross-component links to `${CLAUDE_PLUGIN_ROOT}`, since both touch the same sites. Renamed `get-legislation` after 0.9.5, when the `bill-research` command became `research-legislation`. |
| Cross-component links | `${CLAUDE_PLUGIN_ROOT}/skills/...` | Skills and agents reference shared files by plugin root, never by a relative path. A subagent's working directory is the user's project, so `../skills/...` resolves to nothing. |
| Hosts | Claude only | The Codex manifest (`.codex-plugin/plugin.json`) was removed in 0.9.0, along with ChatGPT and Codex support. |

## Before each release

- **Reconcile the tool reference against the live server.** Run `tools/list` against
  `https://public.cicada.guide/mcp-anthropic` and diff it against
  `skills/get-legislation/references/tool-reference.md`, which records the server version it was
  verified against. The endpoint is unversioned, so nothing else signals drift. The server is
  stateless: it issues no `mcp-session-id`, and a bare `tools/list` POST is answered directly, with
  no `initialize` first. Reconcile against the server, never against the other copies: the tool
  names are repeated in `README.md` and `skills/get-legislation/SKILL.md`, and those three
  agreeing with each other is exactly the state drift leaves behind.
  `node scripts/check-live-tools.mjs` does the fetch and the reconciliation in one step, and the
  `live-tools` workflow runs it nightly. To inspect the raw list by hand, this writes it to
  `tools-list.json` (bash):

  ```bash
  E=https://public.cicada.guide/mcp-anthropic
  H=(-H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream'
     -H 'MCP-Protocol-Version: 2025-06-18')
  curl -s "${H[@]}" "$E" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' |
    sed -n 's/^data: //p' > tools-list.json
  ```

- **Bump all three `version` fields together.** They live in two files:
  `.claude-plugin/plugin.json`, and *both* `metadata.version` and `plugins[0].version` in
  `.claude-plugin/marketplace.json`. They are independent fields and drift silently if one is
  missed. `node scripts/check.mjs` fails until all three match.
- **Date the changelog.** Move the `Unreleased` entries in `CHANGELOG.md` under a heading for the
  new version. At the bottom, add its link (`compare/v<previous>...v<new>`) and point `Unreleased`
  at `compare/v<new>...HEAD`.
- **Confirm the server is healthy.** `curl https://public.cicada.guide/health` returns
  `{"status":"ok"}`.
- **Land on `main` before announcing.** The marketplace resolver reads the default branch, not a
  feature branch. An install command shared against unmerged work resolves a stale manifest, or
  none at all.
- **The release tags itself.** When a change to `.claude-plugin/plugin.json` lands on `main`,
  `.github/workflows/tag-release.yml` reads the version and, if `v<version>` does not exist yet,
  pushes an annotated tag on the `main` commit that brought the bump in (for a merged pull request,
  its merge commit, where every earlier tag points). Check the Actions tab for the run; it can also
  be started by hand there. The changelog's links resolve only once the tag exists.

## Verifying an install

Locally, from a checkout:

```bash
claude --plugin-dir /path/to/plugin
```

Then `/mcp` should list `guide-public` as connected, and `/help` should show
`/cicada-guide:research-legislation`, `/cicada-guide:voting-record`, and
`/cicada-guide:contact-legislator`.

End to end, the way a stranger gets it:

```text
/plugin marketplace add cicada-guide/plugin-anthropic
/plugin install cicada-guide@cicada-guide
```

Run that from an account outside the `cicada-guide` org. It is the only check that actually proves
the repo is reachable — everything else passes just as well while the repo is private.

## Infrastructure dependency

The plugin points at `public.cicada.guide`, a Cloudflare Custom Domain routed to the
`cicada-guide-mcp-server` Worker. That route is configured in the private
`cicada-guide/mcp-anthropic` repo's `wrangler.jsonc` and activated by `wrangler deploy`.

If that domain is ever retired or re-pointed, this plugin breaks for every installed user with no
warning and no fallback. Treat the hostname as a published API surface: change it only with a
version bump here, and keep the old hostname resolving through the transition.
