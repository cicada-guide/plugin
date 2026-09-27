# Changelog

All notable changes to the plugin. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Each version is tagged `v<version>` on the commit that
bumped it, and dated by that commit.

The hosted server is unversioned and changes independently. Entries here record changes to the
plugin's guidance, including updates made to match what the server returns.

## [Unreleased]

### Added

- `voting-record` Path C and a matching workflow for one legislator's vote on one bill:
  `get_votes` with `bill_id` and `people_id` together, matched to `get_rollcalls` by roll call.
- `bill-research` answers a topic with a list of matching bills and offers a brief on one.
- Skills and agents say what to do when no cicada-guide tools are available: report that
  `guide-public` isn't connected and point to `/mcp` and a new session.
- A request about "my senator" or "my representative" with no name gets a question back for the
  legislator's name and state. No tool maps an address or district to a legislator.
- README: a `/mcp` verify step, a new-session hint, a note on tool approval prompts, and examples
  that name a state and session.

### Changed

- `scripts/check-live-tools.mjs` no longer requires an `mcp-session-id` from `initialize`, and sends
  `DELETE` only when the server issued one. The hosted server is now stateless and issues none, so
  the nightly `live-tools` run would otherwise fail on every run.
- `PUBLISHING.md` and `CLAUDE.md`: fetching `tools/list` by hand is one POST, with no session
  handshake.
- `voting-record` argument hint is `<legislator name> [state] [bill] [session or date range]`.
  README and the `state-legislation` skill quote both commands' hints exactly.
- Both slash commands ask which bill or legislator, and which state, when given no argument.
- `search_bills` guidance: each `query` word is matched separately and ORed, so one distinctive
  word beats a phrase; `status` is a partial match on recorded status text and is not proof of
  enactment.
- Updated to match the server: `search_bills` scopes its document full-text search by `division_id`,
  `session_id`, or `session_name` before the 50-bill cap, so the cap no longer reads as applying
  across every state before those filters. A search with none of them is still capped at 50 bills
  nationwide.
- Updated to match the server: list tools fit each page under 25,000 characters, returning fewer
  items than `limit` with `has_more` true and continuing from the last item returned. Guidance now
  says to follow `next_offset` or `next_cursor`, that a `count` below `limit` is not the end of the
  list, and that only a response ending in a truncation hint was cut. Example limits lowered.
- Updated to match the server: `get_latest_bill_document` takes `text_offset` and returns
  `text_total_chars` and `next_text_offset`. Long bill text is read in parts until
  `next_text_offset` is `null`, instead of reporting what was cut.
- Updated to match the server: the `read_pdf_bytes` refusal table lists the two URL checks it was
  missing, a URL carrying a username or password and a URL that names a port.
- Updated to match the server: `get_bill_dossier` takes `response_format` and renders a markdown
  body. It is dropped from the lists of tools without the parameter in README, the project-settings
  reference, and the settings template.
- On a rate-limit error, Claude tells the user and resumes after a minute.
- Answers keep UUIDs out unless asked, and say "did not vote" for `NV`.
- The settings template leaves `default_session` commented out, so a copied file pins no session.
  README links the template on GitHub for marketplace installs.

### Fixed

- `read_pdf_bytes` is no longer suggested for reading bill text; it returns PDF bytes. Older
  versions are cited by their `get_documents` URL.
- Offset-past-end guidance quotes the messages the tools return now: `Error: Offset past end.` from
  `get_documents`, `list_sessions`, and `get_rollcalls`, replacing `Error: Database error.`
- A `get_person_votes` cursor the tool cannot place is described as the error it now returns,
  `Error: cursor is not a next_cursor from get_person_votes. Omit cursor to restart from the newest
  vote.`, rather than an empty page.
- The `get_votes` no-filter error is quoted with `~5.6M vote records`, as the server now words it,
  and README gives the same figure.
- `get_person_votes` is listed among the tools without `total`.
- `get_rollcall_breakdown` output for a roll call with no vote rows is reported as not recorded,
  not as a 0-0 vote, and quoted as the server now words it:
  `no individual votes recorded (not a 0-0 vote).`
- Tool reference: `show_bill` and `open_research_desk` declare `llm_model` as well as `context`;
  `get_rollcalls` points to `get_rollcall_breakdown`; `search_people` `party` matching is stated
  exactly.

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
