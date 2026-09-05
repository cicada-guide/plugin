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
| Contact email | Omitted | `author` and `owner` carry a name and URL only. Issues route through the repo rather than a published inbox. |

## Known cosmetic leftover

The always-on skill is still named `cicada-guide` inside a plugin named `cicada-guide`, so its
slash form is `/cicada-guide:cicada-guide`. Harmless in practice — the skill is model-invoked, and
nobody types it — but it is the one piece of name repetition that survived. Changeable later at the
cost of a version bump.

## Before each release

- **Reconcile the tool reference against the live server.** Run `tools/list` against
  `https://public.cicada.guide/mcp` and diff it against
  `skills/cicada-guide/references/tool-reference.md`, which records the server version it was
  verified against. The endpoint is unversioned, so nothing else signals drift.
- **Bump `version` in both manifests together** — `.claude-plugin/plugin.json` and the
  `plugins[0].version` entry in `.claude-plugin/marketplace.json`. They are independent fields and
  drift silently if one is missed.
- **Confirm the server is healthy.** `curl https://public.cicada.guide/health` returns
  `{"status":"ok"}`.
- **Land on `main` before announcing.** The marketplace resolver reads the default branch, not a
  feature branch. An install command shared against unmerged work resolves a stale manifest, or
  none at all.

## Verifying an install

Locally, from a checkout:

```bash
claude --plugin-dir /path/to/plugin
```

Then `/mcp` should list `guide-public` as connected with 13 tools, and `/help` should show
`/cicada-guide:bill-research` and `/cicada-guide:voting-record`.

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
