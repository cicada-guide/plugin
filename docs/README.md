# cicada-guide plugin documentation

The plugin connects Claude Code to U.S. state legislative data — bills, legislators,
roll calls, and sessions — through the hosted cicada-guide MCP server, and ships the skills and
agents that tell Claude how to use it. These pages are for people: nothing here is loaded into a
Claude session. Pick the section that matches what you are doing.

## Tutorial

- [Getting started](tutorial-getting-started.md): install the plugin, confirm the server is
  connected, and ask your first bill and legislator questions.

## How-to guides

Using the plugin:

- [Research a bill](howto-research-a-bill.md): find a bill by number or topic, get a sourced
  brief, and show the bill card with a plain-language headline and summary.
- [Check a voting record](howto-check-a-voting-record.md): a legislator's history, a vote on one
  bill, or one roll call broken down by party.
- [Contact a legislator](howto-contact-a-legislator.md): the contact card and what to do when
  details are not on record.
- [Configure a project](howto-configure-a-project.md): set defaults in
  `.claude/cicada-guide.local.md`.

Changing the plugin:

- [Verify a change](howto-verify-a-change.md): the offline checks, the live tools check, and
  loading a checkout into a real session.
- [Add a command or agent](howto-add-a-command-or-agent.md): the files, frontmatter, and rules a
  new entry point must carry.
- [Update the tool docs](howto-update-tool-docs.md): reconcile the three tool lists when the
  server changes.

## Reference

- [Commands and agents](reference-commands-and-agents.md): every skill and subagent, how it is
  invoked, what it returns, and the card it ends with.
- [Cards](reference-cards.md): the interactive cards, what each shows, and what reaches the model.
- [Checks](reference-checks.md): every rule `scripts/check.mjs` and `scripts/check-live-tools.mjs`
  enforce, and how to fix each failure.
- [Tool reference](../skills/get-legislation/references/tool-reference.md): every tool's
  parameters, pagination, and errors.
- [Workflows](../skills/get-legislation/references/workflows.md): call sequences for multi-step
  research.
- [Project settings](../skills/get-legislation/references/project-settings.md): the
  `.claude/cicada-guide.local.md` contract.
  [`cicada-guide.local.md.example`](../cicada-guide.local.md.example) is the template.
- [Troubleshooting](troubleshooting.md): connection problems, missing tools, rate limits,
  truncated output, the two error shapes, and cards.

## Explanation

- [Architecture](architecture.md): how the manifests, the MCP endpoint, skills, and agents fit
  together, and why the repo is shaped the way it is.
- [Cards](explanation-cards.md): why answers end with a card, and why the written answer still
  comes from the data tools.
- [Dataset rules](explanation-dataset-rules.md): why every entry point restates the same rules,
  and the failure each one prevents.

## Project

- [README](../README.md): installation, example questions, scope, tools, privacy, and data sources.
- [CONTRIBUTING.md](../CONTRIBUTING.md): how to propose a change.
- [CLAUDE.md](../.claude/CLAUDE.md): the invariants, product constraints, and conventions. It is the
  authoritative list, for people and for Claude alike.
- [PUBLISHING.md](../PUBLISHING.md): the release checklist, and the decisions that are settled.
- [CHANGELOG.md](../CHANGELOG.md): what changed in each version.
- [SECURITY.md](../SECURITY.md): how to report a vulnerability, and what is in scope.
- [Solutions](solutions/): write-ups of past problems, with YAML frontmatter (`module`, `tags`,
  `problem_type`). For example,
  [Cloudflare WAF 403s in the live-tools check](solutions/integration-issues/cloudflare-waf-403-live-tools-diagnostics.md).
