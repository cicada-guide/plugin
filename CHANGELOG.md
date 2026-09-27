# Changelog

All notable changes to the plugin. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Each version is tagged `v<version>` on the commit that
bumped it, and dated by that commit.

The hosted server is unversioned and changes independently. Entries here record changes to the
plugin's guidance, including updates made to match what the server returns.

## [Unreleased]

### Added

- A full documentation set under `docs/`, arranged as a tutorial, how-to guides, reference, and
  explanation: getting started; researching a bill, checking a voting record, contacting a
  legislator, and configuring a project; verifying a change, adding a command or
  agent, and updating the tool docs; references for the commands and agents, the cards, and the
  checks; and explanations of the cards and the dataset rules. `docs/README.md` indexes them.
- The contact card's district map note, when the viewer turns location on: "You're in this
  district · 5.7 mi from its edge" or "You're 5.7 mi outside this district", with a dashed line to
  the nearest edge. The location stays in the card.
- The bill card's document viewer fallback: where the host blocks the Google Docs preview or
  refuses "Open full screen", the card shows the document link with a "Copy link" button.

### Changed

- The bill card always opens on its tabbed layout: a header, then Overview (the path to becoming
  law, the recorded status, and the summary), Sponsors, Documents, and Votes. The front view with
  its floor-vote timeline, "Read bill", and "Explore bill" is gone. The summary note now reads
  "Written by the AI in this chat. It can miss details." and no longer says the official text is
  the record. Selecting a floor vote sends `User is viewing HB 314 votes. Selected floor vote: …`,
  and `User opened the HB 314 workspace.` is no longer sent.
- Updated to match the server: `show_bill`'s `summary` is now required, and a call without it
  fails with `-32602`. Every skill, agent, workflow, and example always passes one, written after
  reading the bill's text or synopsis; when neither is on record, the summary says so. It never
  infers passage.
- Tapping a bill in the `search_bills` results card, a vote in the `show_person_record` card, or a
  sponsored bill's "Show in the conversation" button posts a user turn,
  `Show HB 314 (bill id <uuid>) with show_bill. …`. The skills handle it by reading the text or
  synopsis and calling `show_bill` with a summary, with a short chat answer optional.
- The legislator record's session picker lists only sessions with the legislator's votes, newest
  first, and its header tally no longer carries an "In the N votes loaded" caption.
- `search_bills`' `bill` matches the number exactly, ignoring case, spaces and dots, and needs the
  chamber prefix: a number alone ("314") returns no bills. Matches the server's fix for bill-number
  lookups that timed out.
- Updated to match the server: `show_bill` takes a required `headline`, 1-120 characters, next to
  `summary`, and a call without it fails with `-32602`. It is a short plain-language line for a
  voter, written from the bill's text or synopsis, that never claims passage. The bill card's title
  plate shows it first, and tapping the plate toggles to the official title and back. Every skill,
  agent, workflow, and example passes both, and the show-bill request a tapped bill posts now asks
  for a headline as well as a summary.
- Card resource URIs: `bill-results-v11`, `bill-workspace-v11`, `legislator-record-v12`, and
  `official-card-v4`.

### Removed

- The `multi-state-bill-scanner` subagent and the "Compare states" how-to. A question across
  several states is now answered directly, with one `search_bills` call per state.
- Handling for the bill card's "Summarize with AI" request, which the card no longer offers.
- Opening a bill in place inside the results card and the legislator record, and the
  `User opened HB 314 from the search results.` model-context update that went with it.

## [0.8.0] - 2026-09-27

### Added

- `/cicada-guide:contact-legislator <name> [state]`: resolves one legislator by name with
  `search_people`, shows their `show_official` contact card, and reports only the seat and contact
  details it returned. It asks for a name rather than looking up a district from an address.
- Card-first workflows. Bill research ends with `show_bill` and an assistant-written `summary` on
  the card, a voting-record answer with `show_person_record`, and a contact question with
  `show_official`, without asking first. The written answer covers what the card does not show and
  still stands on its own in hosts that cannot render cards.
- Guidance for the bill card's "Summarize with AI" request (answer in chat, then show the bill again
  with the summary) and for the cards' model-context updates, which name what the user is viewing
  and are mapped back to ids from earlier results.
- Votes by subject: `get_person_votes` in `json` carries `bill.subjects`, which the voting-record
  workflow filters on. The tool takes no subject parameter.
- Subagents end their report with the card that fits their result for the main conversation to
  show, since a subagent's output is not rendered as a card.

### Changed

- A legislator's chamber and district are stated when `show_official` or `show_person_record`
  returns a seat, and reported as not recorded otherwise. They are never inferred from
  `search_people` or `get_person`. This replaces the rule that no tool returns them.
  `legislator-disambiguator` reads each candidate's seat and checks a requested chamber or district
  against it.
- Updated to match the server: `show_bill` takes an optional `summary` (plain prose, up to 1,500
  characters) and shows floor votes, sponsors, and documents; `show_official` shows the photo,
  seat, contact options, district map, and a tally of recent recorded votes; `show_person_record`
  shows the voting history with session, vote, and subject filters, and sponsored bills.
  `search_bills` shows its results as a card in hosts that support MCP Apps.

### Removed

- `open_research_desk`, which the server no longer serves, from README, the skills, the tool
  reference, and the project-settings template.

## [0.7.0] - 2026-09-27

### Added

- `show_official`, the server's new contact card for one legislator: office, state chamber and
  district, party, term, and recorded contact details. Listed in README, the `state-legislation`
  skill, the tool reference, and the tools that take no `response_format`.

## [0.6.0] - 2026-09-27

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

[Unreleased]: https://github.com/cicada-guide/plugin/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/cicada-guide/plugin/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/cicada-guide/plugin/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/cicada-guide/plugin/compare/v0.5.4...v0.6.0
[0.5.4]: https://github.com/cicada-guide/plugin/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/cicada-guide/plugin/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/cicada-guide/plugin/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/cicada-guide/plugin/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/cicada-guide/plugin/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/cicada-guide/plugin/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/cicada-guide/plugin/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/cicada-guide/plugin/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cicada-guide/plugin/releases/tag/v0.1.0
