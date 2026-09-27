# Publishing

The original blockers — a private repository and no license — are resolved. This file is now the
release checklist and the record of what was decided, so the settled questions are not reopened
every release.

## Settled decisions

| Decision | Choice | Why |
| --- | --- | --- |
| License | Apache-2.0 | Permissive with an explicit patent grant. `LICENSE` at the repo root, `"license": "Apache-2.0"` in both manifests. |
| Repository | `cicada-guide/plugin`, public | The plugin lives here; the Worker source stays private in `cicada-guide/mcp`. |
| Layout | Repo root is the plugin | `.claude-plugin/` holds both `marketplace.json` (`"source": "./"`) and `plugin.json`. |
| MCP endpoint | `https://public.cicada.guide/mcp` | Cloudflare Custom Domain on the Worker, rather than the `workers.dev` hostname. |
| MCP server key | `guide-public` | Tools surface as `mcp__plugin_cicada-guide_guide-public__search_bills`. The `<server>` segment is mandatory — `mcp__plugin_cicada-guide__search_bills` is not reachable by any configuration. |
| Contact email | Codex manifest only | The Claude manifests' `author` and `owner` carry a name and URL only, and issues route through the repo. `.codex-plugin/plugin.json` keeps `author.email` deliberately (confirmed 2026-09-24); do not strip it as drift. |
| Always-on skill name | `state-legislation` | Renamed from `cicada-guide` in 0.2.0, which had produced `/cicada-guide:cicada-guide`. Done in the same pass that converted cross-component links to `${CLAUDE_PLUGIN_ROOT}`, since both touch the same sites. |
| Cross-component links | `${CLAUDE_PLUGIN_ROOT}/skills/...` | Skills and agents reference shared files by plugin root, never by a relative path. A subagent's working directory is the user's project, so `../skills/...` resolves to nothing. |
| Codex manifest | `.codex-plugin/plugin.json`, kept in step | A separate manifest with its own `interface` block, description text, and `logo` pointing at `assets/logo.svg`. It carries its own `version`, which is why the bump below is four fields rather than two. |

## Before each release

- **Reconcile the tool reference against the live server.** Run `tools/list` against
  `https://public.cicada.guide/mcp` and diff it against
  `skills/state-legislation/references/tool-reference.md`, which records the server version it was
  verified against. The endpoint is unversioned, so nothing else signals drift. The server is
  stateless: it issues no `mcp-session-id`, and a bare `tools/list` POST is answered directly, with
  no `initialize` first. Reconcile against the server, never against the other copies: the tool
  names are repeated in `README.md` and `skills/state-legislation/SKILL.md`, and those three
  agreeing with each other is exactly the state drift leaves behind.
  `node scripts/check-live-tools.mjs` does the fetch and the reconciliation in one step, and the
  `live-tools` workflow runs it nightly. To inspect the raw list by hand, this writes it to
  `tools-list.json` (bash):

  ```bash
  E=https://public.cicada.guide/mcp
  H=(-H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream'
     -H 'MCP-Protocol-Version: 2025-06-18')
  curl -s "${H[@]}" "$E" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' |
    sed -n 's/^data: //p' > tools-list.json
  ```

- **Bump all four `version` fields together.** They live in three files:
  `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, and *both* `metadata.version` and
  `plugins[0].version` in `.claude-plugin/marketplace.json`. They are independent fields and drift
  silently if one is missed. `node scripts/check.mjs` fails until all four match.
- **Date the changelog.** Move the `Unreleased` entries in `CHANGELOG.md` under a heading for the
  new version. At the bottom, add its link (`compare/v<previous>...v<new>`) and point `Unreleased`
  at `compare/v<new>...HEAD`.
- **Confirm the server is healthy.** `curl https://public.cicada.guide/health` returns
  `{"status":"ok"}`.
- **Land on `main` before announcing.** The marketplace resolver reads the default branch, not a
  feature branch. An install command shared against unmerged work resolves a stale manifest, or
  none at all.
- **Tag the release.** Once the bump is on `main`, tag the commit that bumped the version with an
  annotated `v<version>` tag and push it: `git tag -a v0.5.5 <bump-commit> -m "cicada-guide plugin
  0.5.5"`, then `git push origin v0.5.5`. The changelog's links resolve only once the tag exists.

## Verifying an install

Locally, from a checkout:

```bash
claude --plugin-dir /path/to/plugin
```

Then `/mcp` should list `guide-public` as connected, and `/help` should show
`/cicada-guide:bill-research`, `/cicada-guide:voting-record`, and
`/cicada-guide:contact-legislator`.

End to end, the way a stranger gets it:

```text
/plugin marketplace add cicada-guide/plugin
/plugin install cicada-guide@cicada-guide
```

Run that from an account outside the `cicada-guide` org. It is the only check that actually proves
the repo is reachable — everything else passes just as well while the repo is private.

## Infrastructure dependency

The plugin points at `public.cicada.guide`, a Cloudflare Custom Domain routed to the
`cicada-guide-mcp-server` Worker. That route is configured in the private `cicada-guide/mcp` repo's
`wrangler.jsonc` and activated by `wrangler deploy`.

If that domain is ever retired or re-pointed, this plugin breaks for every installed user with no
warning and no fallback. Treat the hostname as a published API surface: change it only with a
version bump here, and keep the old hostname resolving through the transition.
