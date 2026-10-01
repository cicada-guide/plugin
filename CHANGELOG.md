# Changelog

All notable changes to the plugin. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Each version is tagged `v<version>` on the commit that
bumped it, and dated by that commit.

The hosted server is unversioned and changes independently. Entries here record changes to the
plugin's guidance, including updates made to match what the server returns.

## [Unreleased]

### Added

- `get_more_tools` in the tool lists. The server now advertises it, from its analytics library:
  it returns no data and records a note on a capability the tools lack. The always-on skill says
  to call it only after the other tools cannot serve a request, and to keep names out of its
  `context`. The README's privacy section describes it, and the generic `context` note the
  server records when a model omits one.
- A `displayName`, "cicada.guide", in the plugin manifest and its marketplace entry, so plugin
  lists show the product name rather than the `cicada-guide` id. Commands still use the id.

### Changed

- The install command is now `/plugin marketplace add cicada-guide/plugin-anthropic`, the
  repository's current name. The manifests' `homepage` and `repository`, the README and the docs
  name it the same way.
- Contact replies no longer offer a web search for a missing phone number or address. In
  `claude plugin eval`, two of three `contact-recorded-only` runs ended with "I can do that if you
  want" after saying none was on record. Every entry point that reports contact details now says
  not to offer one; the case passed five of five after the change.
- A bill answer delegated to `bill-brief-researcher` now ends with the bill card. The agent's
  brief carried the `show_bill` arguments, but a session that went straight to the agent without
  the always-on skill never called the card. The agent's description and the brief now tell the
  caller to show it, and the always-on skill says the same. The `bill-brief` eval now grades
  Claude's text across the whole reply, since the final message can be a note after the card.
- Card resource URI `bill-workspace-v17`, after the bill card's "Who voted how" stopped loading
  forever when several floor votes share the newest date. Earlier URIs still resolve.
- Card resource URI `official-card-v12`, after the official card's contact buttons stopped
  overlapping: four buttons now sit two by two, and a dropdown chevron sits beside its icon.
  Earlier URIs still resolve.
- Card resource URIs `bill-workspace-v18`, `official-card-v13` and `legislator-record-v17`,
  after each card section whose first load fails (the bill's floor votes and party split, the
  official's recent votes, the record's votes and sponsored bills) gained a **Try again** button.
  Before, the card said to try again but offered no way to. Earlier URIs still resolve.

## [0.10.1] - 2026-09-30

### Changed

- Card resource URI `official-card-v11`, after the official card's Recent votes panel stopped
  scrolling: each vote title is clamped to two lines and a page holds as many whole rows as fit.
  Earlier URIs still resolve.

### Fixed

- Bill summaries, including the one passed to `show_bill`, now come only from what the tools
  returned. When a bill had no text or synopsis on record and its document would not open, Claude
  had written the card summary from news coverage of the session. Every entry point now says to
  name the gap, build the summary from the title, status, sponsors, and recorded votes, and point
  to the document URL, never to fill it from news, web search, or general knowledge. The always-on
  skill states the rule in its scope section.
- Contact details are now passed on as recorded. Asked how to reach a state senator, Claude had
  called the recorded email a Gmail address that might not be official, said a phone number should
  be on the legislature's page, added a party office no tool returned, and offered to look up the
  party's contact page. `/contact-legislator` now states that every claim comes from a tool result,
  and every entry point that reports contact details says not to judge a value from its domain or
  say what another site lists. A new eval case, `contact-recorded-only`, checks it.

## [0.10.0] - 2026-09-30

### Added

- An eval suite under `evals/` for `claude plugin eval`: a bill brief, a voting record, a contact
  request with no legislator named, and a request to rank legislators, each graded with and
  without the plugin against the live server. Results go to `evals/results/`, which is ignored.

### Fixed

- A request to rank state legislators by ideology is now declined. The always-on skill's
  description now names ranking, grading, scoring, and vote prediction as declined, and its scope
  section states the rule before any tool call. In `claude plugin eval`, Claude with the plugin had
  built or delegated a conservative-to-liberal ranking in two of three runs while Claude without it
  declined; after the change it declined in three of three.

### Changed

- Two skills are renamed. The always-on `state-legislation` skill is now `get-legislation`, and
  the `bill-research` slash command is now `research-legislation`, invoked as
  `/cicada-guide:research-legislation`. `/cicada-guide:bill-research` no longer exists.
- README's Privacy section now lists everything the plugin runs, sends, and fetches, as the
  directory's pre-submission checklist asks: the one optional settings file the skills read, where
  the server sends analytics and logs, the documents it fetches from legislature websites, and what
  the cards load. It links the full policy at `https://public.cicada.guide/privacy`.
- The manifests name the author and marketplace owner `cicada.guide`, where they said
  `Cicada Guide`.

## [0.9.5] - 2026-09-30

### Changed

- The bill-brief-researcher agent gives every roll call `get_rollcalls` returns its own row, even
  when two share a date or identical counts. A live run had merged two such rows and then reported
  one roll call as missing.

## [0.9.4] - 2026-09-30

### Changed

- Every skill and agent now keeps people's names out of the `context` analytics string, alongside
  credentials, personal data and first-person phrasing. A live run had sent "a state senator named
  Orr".

## [0.9.3] - 2026-09-28

### Changed

- The tools now declare `readOnlyHint: true`, as the Claude directory requires. The skill, tool
  reference and verification how-to no longer say an approval prompt is expected because of
  `readOnlyHint: false`.
- The state-legislation skill notes that a voting record starts from `search_people`, and that
  `search_bills` never returns votes, matching the server's rewritten tool descriptions.

## [0.9.2] - 2026-09-28

### Changed

- Card resource URIs, to match the server: `bill-workspace-v15`, `legislator-record-v15`, and
  `official-card-v9`, after the cards stopped breaking labels mid-word at 320px. Earlier URIs still
  resolve.
- Card resource URIs `bill-workspace-v16`, `legislator-record-v16`, and `official-card-v10`, after
  long names started shrinking to fit their box instead of breaking mid-word.

## [0.9.1] - 2026-09-27

### Changed

- Card resource URIs, to match the server: `bill-results-v13`, `bill-workspace-v14`,
  `legislator-record-v14`, and `official-card-v8`. Earlier URIs still resolve.
- The card descriptions follow the server's MCP Apps design-guidelines update. Inline, a bill
  document opens on its first page, with "Read full screen" for five pages at a time and "Open
  original" in place of "Open full screen". Several contact options of one kind open as a list
  under the contact row rather than a menu. The contact card offers no location toggle on mobile.

## [0.9.0] - 2026-09-27

### Added

- A full documentation set under `docs/`, arranged as a tutorial, how-to guides, reference, and
  explanation: getting started; researching a bill, checking a voting record, contacting a
  legislator, and configuring a project; verifying a change, adding a command or
  agent, and updating the tool docs; references for the commands and agents, the cards, and the
  checks; and explanations of the cards and the dataset rules. `docs/README.md` indexes them.
- The contact card's district map note, when the viewer turns location on: "You're in this
  district." or "You're not in this district.", below the map and dismissible, with a dashed line
  to the nearest edge from outside. The card and its two side panels share one width and sit side
  by side. The location stays in the card.
- The bill card's document viewer draws a PDF's pages inside the card, from bytes it fetches with
  `read_pdf_bytes`, and shows the latest non-PDF version as text. A document it can't show, or a
  refused "Open full screen", gets the document link with a "Copy link" button. It no longer
  embeds a Google Docs preview, which hosts such as Claude block.

### Changed

- The bill card always opens on its tabbed layout: a header, then Overview (the path to becoming
  law, the recorded status, and the summary), Sponsors, Documents, and Votes. The front view with
  its floor-vote timeline, "Read bill", and "Explore bill" is gone. The summary box keeps its
  "Summary · your AI assistant" label and has no note under it; it no longer says the official
  text is the record. Selecting a floor vote sends `User is viewing HB 314 votes. Selected floor vote: …`,
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
- Updated to match the server: `read_pdf_bytes` reads a source that ignores Range from the start,
  for files up to 20 MB, instead of refusing it.
- The contact card (`show_official`) shows no vote tally; its Recent votes panel and district map
  stay. The legislator record (`show_person_record`) shows no contact buttons; its tally stays as
  the vote filter. Each card does one job.
- The plugin's MCP endpoint is `https://public.cicada.guide/mcp-anthropic`. The server still
  answers the old `https://public.cicada.guide/mcp`, so copies installed before this release keep
  working until they update.
- Card resource URIs: `bill-results-v12`, `bill-workspace-v13`, `legislator-record-v13`, and
  `official-card-v7`. The bill cards no longer carry ChatGPT compatibility paths.

### Removed

- ChatGPT, Codex and OpenAI support. `.codex-plugin/plugin.json`, the Codex manifest, is gone, so
  the version is three fields in two files, and the docs describe Claude only.
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

[Unreleased]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.10.1...HEAD
[0.10.1]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.9.5...v0.10.0
[0.9.5]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.9.4...v0.9.5
[0.9.4]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.9.3...v0.9.4
[0.9.3]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.9.2...v0.9.3
[0.9.2]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.5.4...v0.6.0
[0.5.4]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/cicada-guide/plugin-anthropic/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cicada-guide/plugin-anthropic/releases/tag/v0.1.0
