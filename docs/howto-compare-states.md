# How to compare states

For anyone who wants to see how several U.S. state legislatures have handled one policy topic, or
which states have acted on it at all. It covers asking for a cross-state sweep, what the
`multi-state-bill-scanner` agent does, what its report contains, and the limits to keep in mind.

For one bill, or one topic in one state, you don't need any of this: see
[Research a bill](howto-research-a-bill.md).

## Ask for a sweep

Ask a question that spans several states:

```text
Compare school funding bills in Alabama, Georgia, and Tennessee
```

```text
Which states have bills about school vouchers in 2025?
```

```text
Is the same age-verification bill showing up in several states?
```

Claude dispatches the `multi-state-bill-scanner` agent on its own when a request spans several
jurisdictions. You can also ask for it by name ("use the multi-state-bill-scanner agent to ..."). A
sweep is dozens of tool calls; the agent runs them out of sight and returns one consolidated report,
so the conversation isn't buried in intermediate output.

The agent handles three kinds of request:

| Request | What it does |
| --- | --- |
| Compare named states | Scans each named state, then reports side by side |
| Nationwide sweep, no state named | Takes the full roster of jurisdictions in the dataset and reports where activity exists and where it does not |
| Model-bill tracing | Compares titles, synopses, and document text across the hits to map a pattern recurring across state lines |

If a request turns out to cover one state after all, the agent finishes the search and notes that
a multi-state scan wasn't needed.

## Help the sweep find the right bills

- **Use one distinctive word.** The agent builds a short query, and prefers one word per search:
  "voucher" rather than "school choice programs". Each extra word widens the results rather than
  narrowing them. If you have a second term in mind, mention it and it runs as a separate search.
- **Give a year or session.** A year narrows every state's search to that year's sessions, regular
  and special.
- **Say whether you want votes.** Floor votes are added only when asked; they add calls per bill.
- **Be specific about the topic.** The agent cannot ask you questions mid-run. With a vague topic,
  it picks the most defensible reading and tells you, in the report, which reading and which query
  terms it used.

## What the report contains

| Section | What it holds |
| --- | --- |
| Answer | Two to four sentences stating what the sweep found |
| Comparison table | One row per jurisdiction: state, bills found (as "at least N"), the most relevant bill number and title, status, and date |
| Notable bills | For the one to three bills that most decide the answer: number, title, state, status, what it does in two or three sentences, and its bill id so Claude can fetch it again without repeating the search |
| Coverage and caveats | Jurisdictions not in the dataset, searches with more pages left unread, query terms dropped past the eighth, documents whose text was unavailable, and any state whose search errored |
| Cards to show | Optionally, the bill cards that fit, for Claude to show |

A few things about how the report is written:

- **Every state searched gets a row,** including those with no matching bills. A silent gap would
  read as a finding.
- **A state not in the dataset is reported differently from a state with no matching bills.** The
  dataset holds the 50 states and the District of Columbia; "not present" and "nothing found" are
  different answers.
- **Every hit is read, not just counted.** Off-topic matches are normal for a text search, and the
  agent drops them explicitly rather than padding the table.
- **Status is reported as recorded.** A status such as "Passed" can record one chamber's passage
  rather than enactment, so it is never presented as proof a bill became law.
- **Claims about what a bill does cite the bill** by number, and a synopsis is labeled as a
  synopsis rather than presented as the bill's text.

**Cards.** A subagent's output is not shown as a card, so the agent names the bill cards that fit
and Claude shows them in the conversation. In a host that renders MCP Apps you see those bill
cards; elsewhere you get their text versions.

## Limits

- **State legislatures only.** A question about Congress, city ordinances, ballot measures, or
  another country's legislature gets an immediate answer that the dataset doesn't cover it, with no
  sweep run to prove it.
- **Per-state recall is bounded by the query caps.** Each state's search matches title and synopsis
  on only the first 8 terms, and its full-text search over document text resolves at most 50
  distinct bills. Scoping each search by state is why the sweep runs one search per jurisdiction:
  each state draws its own 50. Neither cap is signalled in a response, which is why the report
  names the query that ran.
- **"None found" is not "none exist".** The agent never asserts a state has no legislation on a
  topic from one narrow query, and neither should you. Try another distinctive word.
- **Counts are "at least N".** Bill search returns no total. The report says "at least N", or says
  when it paged to the end.
- **Only a few bills are read in full.** Bill text is read for the one to three bills that carry the
  answer. Ask about any other bill in the table and Claude can research it directly.
- **Large sweeps take time.** Calls are rate limited to 60 a minute. Past that a call fails with
  `Rate limit exceeded. Retry in 60 seconds.`; the agent waits a full minute, resumes, and says in
  its report that it did. A sweep of every state is likely to reach it.
- **Long results are paged.** List pages are fitted under 25,000 characters. Anything left unread
  is listed under Coverage and caveats.
- **Comparison, not judgment.** The report describes what each state's bills say and where they
  stand as recorded. It does not grade states or legislators or predict what will pass.

## See also

- [Commands and agents reference](reference-commands-and-agents.md) for all three agents.
- [Research a bill](howto-research-a-bill.md) to go deep on one bill from the table.
- [Troubleshooting](troubleshooting.md) for rate limits and answers that look cut off.
