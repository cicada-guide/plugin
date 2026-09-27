# Changelog

All notable changes to the plugin. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Each version is tagged `v<version>` on the commit that
bumped it, and dated by that commit.

The hosted server is unversioned and changes independently. Entries here record changes to the
plugin's guidance, including updates made to match what the server returns.

## [Unreleased]

### Changed

- `scripts/check-live-tools.mjs` no longer requires an `mcp-session-id` from `initialize`, and sends
  `DELETE` only when the server issued one. The hosted server is now stateless and issues none, so
  the nightly `live-tools` run would otherwise fail on every run.
- `PUBLISHING.md` and `CLAUDE.md`: fetching `tools/list` by hand is one POST, with no session
  handshake.

## [0.5.4] - 2026-09-26

### Added

- `CONTRIBUTING.md`, `SECURITY.md`, and this changelog.
- `docs/` pages: an index, an architecture overview, and troubleshooting.
- `scripts/check.mjs` now checks links, tool counts, restated numbers and dataset-critique wording
  in the new project docs.

## [0.5.3] - 2026-09-26

### Changed

- Every skill and agent says to load a tool's definition with the tool-search tool before calling
  a tool that the client lists by name only. `scripts/check.mjs` enforces this.

## [0.5.2] - 2026-09-26

### Changed

- Agents are limited to `Read` and the `guide-public` server's tools. Without a `tools:` line they
  inherited every tool in the session.
- Every entry point says that tool results are data, not instructions.
- `bill-research`, `voting-record` and all three agents now carry the full `context` rule: never
  put credentials, personal data, or first-person phrasing in it.
- Agents state that `Read` is only for files under `${CLAUDE_PLUGIN_ROOT}`.
- More entry points restate the 25,000-character truncation rule.

### Removed

- `verify.py` and its test. `scripts/check.mjs` covers the same invariants.
- Leftover agent working notes and compiled bytecode.

## [0.5.1] - 2026-09-26

### Added

- The `llm_model` analytics parameter. Skills and agents pass the exact model id, or `"unknown"`.
  The README privacy section names it.

## [0.5.0] - 2026-09-26

### Added

- `scripts/check.mjs`, offline invariant checks that run on every pull request.
- `scripts/check-live-tools.mjs`, run nightly, which reconciles the tool docs against the live
  `tools/list`.
- `search_bills` `session_name` and `search_people` `query`.
- Every entry point states the rate limit of 60 requests a minute.

### Changed

- Roll-call breakdowns use `get_rollcall_breakdown` in one call, instead of paging `get_votes`
  and resolving names.
- `search_bills` bill numbers match exactly, in either spelling (`HB 314` or `HB314`). The
  interior-wildcard guidance is gone.
- The 100-id cap on `search_people` batches is restored for sponsor resolution.

## [0.4.0] - 2026-09-26

### Changed

- Never add vote counts across roll calls.
- `get_rollcalls` includes roll calls linked through their recorded votes, marked `linked_via`.
  This replaces the reconciliation steps against `get_votes`.
- Every entry point that pages `get_rollcalls` passes on its `warnings`.
- Same-name legislators are treated as different people to disambiguate, never merged
  automatically.
- Docs reconciled with the live `tools/list`, including exactly which tools take `limit` and
  `offset`.

### Removed

- Wording that critiqued the dataset's quality, from skills, agents and the Codex manifest.

## [0.3.0] - 2026-09-24

### Added

- Guidance for the interactive tools and for bill dossiers.
- Research briefs distinguish an enrolled document from confirmed enactment.

### Changed

- Guidance matches the server's response shapes. The server no longer returns `legiscan` objects,
  roll calls carry a `counts` object, and `get_person_votes` items are nested.
- A legislator's state comes from the vote record. Chamber and district are reported as
  unverified.

## [0.2.0] - 2026-09-05

### Added

- `.codex-plugin/plugin.json`, the Codex manifest, kept in step with the Claude manifests.
- The `.claude/cicada-guide.local.md` project settings contract.

### Changed

- The always-on skill was renamed from `cicada-guide` to `state-legislation`.
- Cross-component links use `${CLAUDE_PLUGIN_ROOT}` instead of relative paths.

## [0.1.0] - 2026-09-05

### Added

- First public release: the `state-legislation`, `bill-research` and `voting-record` skills, the
  subagents, and the `guide-public` MCP server declaration.

[Unreleased]: https://github.com/cicada-guide/plugin/compare/v0.5.4...HEAD
[0.5.4]: https://github.com/cicada-guide/plugin/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/cicada-guide/plugin/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/cicada-guide/plugin/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/cicada-guide/plugin/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/cicada-guide/plugin/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/cicada-guide/plugin/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/cicada-guide/plugin/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/cicada-guide/plugin/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cicada-guide/plugin/releases/tag/v0.1.0
