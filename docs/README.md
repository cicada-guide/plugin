# cicada-guide plugin documentation

Pick the entry that matches what you are doing.

## Using the plugin

- [README](../README.md): installation, example questions, scope, the tools, skills and agents,
  privacy, and data sources.
- [Troubleshooting](troubleshooting.md): the server doesn't connect, a tool isn't found, rate
  limits, truncated output, and the two error shapes.
- [Tool reference](../skills/state-legislation/references/tool-reference.md): every tool's
  parameters, pagination, and errors.
- [Workflows](../skills/state-legislation/references/workflows.md): call sequences for multi-step
  research.
- [Project settings](../skills/state-legislation/references/project-settings.md): the
  `.claude/cicada-guide.local.md` contract.
  [`cicada-guide.local.md.example`](../cicada-guide.local.md.example) is the template.

## Changing the plugin

- [CONTRIBUTING.md](../CONTRIBUTING.md): how to propose a change and verify it.
- [Architecture](architecture.md): how the manifests, the MCP endpoint, skills and agents fit
  together, and why the repo is shaped the way it is.
- [CLAUDE.md](../CLAUDE.md): the invariants, product constraints and conventions. It is the
  authoritative list, for people and for Claude alike.
- [Solutions](solutions/): write-ups of past problems, with YAML frontmatter (`module`, `tags`,
  `problem_type`). For example,
  [Cloudflare WAF 403s in the live-tools check](solutions/integration-issues/cloudflare-waf-403-live-tools-diagnostics.md).

## Releasing the plugin

- [PUBLISHING.md](../PUBLISHING.md): the release checklist, and the decisions that are settled.
- [CHANGELOG.md](../CHANGELOG.md): what changed in each version.
- [SECURITY.md](../SECURITY.md): how to report a vulnerability, and what is in scope.
