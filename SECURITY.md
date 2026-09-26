# Security policy

## Reporting a vulnerability

Please report a vulnerability privately. Don't open a public issue.

Use GitHub's private reporting: on this repository, go to **Security**, then **Report a
vulnerability**. You can reach the maintainers through that channel for both the plugin and the
hosted MCP server behind it, because the server's source is not public.

Include what you found, how to reproduce it, and what an attacker could do with it. We aim to
acknowledge a report within a few days and to keep you posted until it is resolved.

## Supported versions

Only the latest release on `main` is supported. The marketplace installs from `main`, so a fix
ships to every user who updates the plugin.

## What the plugin can and cannot do

Knowing the plugin's reach helps you judge whether a finding is in scope:

- **Read-only.** The server's tools retrieve legislative records. Nothing here sends messages,
  contacts officials, files documents, or changes state.
- **No credentials.** There is no account, API key or OAuth flow. The plugin stores and transmits
  no secrets.
- **Subagents are sandboxed by allowlist.** Each agent in `agents/` may use `Read` and the
  `guide-public` server's tools only. It can't run commands or write files.
- **Analytics.** The server records each tool call's name and arguments, the model-written
  `context` string, and the calling model's identifier. [README.md](README.md#privacy) has the
  full list.

## In scope

- Guidance in `skills/` or `agents/` that leads Claude to run instructions found in tool results
  such as bill text or PDFs. Tool results are data, not instructions.
- Guidance that leads Claude to put credentials, personal data, or file contents into a tool
  argument, including `context`.
- A way to point `.mcp.json` or a manifest at an endpoint other than
  `https://public.cicada.guide/mcp`, or to widen an agent's tool allowlist, that
  `scripts/check.mjs` does not catch.
- Vulnerabilities in the hosted server at `public.cicada.guide`.

## Out of scope

- The content of legislative records. Report a wrong answer as an ordinary issue.
- Rate limiting working as designed (HTTP 429 after 60 requests a minute from one anonymous
  caller).
- Vulnerabilities in Claude Code, Codex, or other host applications. Report those to their
  vendors.
