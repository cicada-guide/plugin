# Contributing

Thanks for helping. This repo is a Claude Code **plugin**. It contains only Markdown and
JSON, which a plugin loader reads at runtime. There is no build step, no dependencies, and no
application code. The MCP server behind it (`https://public.cicada.guide/mcp-anthropic`) comes from a separate,
private repository, so this repo cannot change what the tools return.

For how the pieces fit together, read [docs/architecture.md](docs/architecture.md). To check your
change, see [Verify a change](docs/howto-verify-a-change.md); to add a slash command or subagent,
see [Add a command or agent](docs/howto-add-a-command-or-agent.md). Every check and its fix is in
[docs/reference-checks.md](docs/reference-checks.md).

## Before you start

- **Wrong or misleading answer?** Open an issue. Include the question you asked, the answer you
  got, and, if you can, the tool calls Claude made. Most fixes are guidance changes in `skills/`
  or `agents/`.
- **Server down or erroring?** Check `curl https://public.cicada.guide/health` first. It should
  return `{"status":"ok"}`. Server problems can still be reported here, since the server repo is
  not public.
- **Security issue?** Don't open a public issue. See [SECURITY.md](SECURITY.md).

## Making a change

1. Fork the repo and branch from `main`.
2. Make the change. [.claude/CLAUDE.md](.claude/CLAUDE.md) is the working guide for this repo,
   for people and for Claude alike. Read these three sections before editing:
   - **Invariants.** These break installed users silently: the three version fields, the
     `${CLAUDE_PLUGIN_ROOT}` links, the mandatory `guide-public` segment in tool names, the pinned
     endpoint, the three tool lists, and the dataset rules restated in every entry point.
   - **Product constraints.** State legislatures only, read-only, and no grading of legislators.
     There is no account, and nothing here critiques the dataset.
   - **Conventions.** Wrap prose at about 100 columns, keep `description:` frontmatter on one
     line, and address runtime prose to Claude.
3. Run the offline checks. They need only Node 22, with no install and no network:

   ```bash
   node scripts/check.mjs
   ```

   When you change a rule on purpose, change `scripts/check.mjs` in the same commit.
4. If you touched a tool name or a parameter, reconcile it against the live server. Don't
   reconcile it against the other docs:

   ```bash
   node scripts/check-live-tools.mjs
   ```

   Never document a tool or parameter you have not seen the server return. Schemas reject unknown
   keys, so an invented name fails for every user who follows it.
5. Load your checkout into a real session and try the change:

   ```bash
   claude --plugin-dir /path/to/plugin
   ```

   `/mcp` should list `guide-public` as connected, and `/help` should show the plugin's slash
   commands. The server is public and needs no account, so this works from any fork.
6. Add a line under `Unreleased` in [CHANGELOG.md](CHANGELOG.md) if the change is user-visible.
7. Open a pull request against `main`. `.github/workflows/check.yml` runs `scripts/check.mjs` and
   `claude plugin validate` on it.

Commit subjects are plain sentence case with no prefix or tag, for example "Restate the rate limit
in the voting-record skill".

## Releases

Maintainers cut releases with the checklist in [PUBLISHING.md](PUBLISHING.md).

## License

By contributing you agree that your contribution is licensed under the repo's
[Apache-2.0 license](LICENSE).
