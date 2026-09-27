# Troubleshooting

Common problems when using the plugin, with the fix for each. For how the tools behave in normal
use, see the [tool reference](../skills/state-legislation/references/tool-reference.md).

## The server doesn't show up, or shows as disconnected

Run `/mcp` in Claude Code. The plugin's server is listed as `guide-public`.

1. **Check the server is up.** `curl https://public.cicada.guide/health` should return
   `{"status":"ok"}`. If it doesn't, the hosted server is down, and nothing on your side will
   fix it. Try again later, or open an issue.
2. **Check the plugin is installed and enabled.** `/plugin` opens the plugin manager. To
   reinstall:

   ```text
   /plugin marketplace add cicada-guide/plugin
   /plugin install cicada-guide@cicada-guide
   ```

3. **Start a new session.** A host reads plugin configuration when a session starts.
4. **Check your network.** The host must reach `https://public.cicada.guide` over HTTPS. A
   corporate proxy or firewall that blocks it shows up as a failed connection, not as a tool
   error.

No sign-in is ever needed. If a host asks you to authenticate to `guide-public`, the host has made
a mistake; the server accepts anonymous callers.

## Slash commands are missing

`/help` should list `/cicada-guide:bill-research`, `/cicada-guide:voting-record`, and
`/cicada-guide:contact-legislator`. If they're missing, the plugin isn't enabled in this session:
see step 2 above. The always-on skill has no command; it loads by itself when you ask about state
legislation.

## A call fails with "has not been loaded yet"

Some hosts list MCP tools by name only until the model loads their definitions. A call made before
that fails in the client and never reaches the server. The plugin's guidance tells Claude to load
a tool's definition with the tool-search tool before the first call. If it happens anyway, ask
Claude to load the tool and retry.

## Rate limit errors (HTTP 429)

Anonymous callers are rate limited to 60 a minute, counted per IP address. Past that a call fails
with `Rate limit exceeded. Retry in 60 seconds.` and the response carries `Retry-After: 60`.

- Claude tells you when the limit is hit and resumes after a minute. Retrying straight away uses
  up the next window too.
- Large sweeps, such as a topic across many states, run faster as a few narrower requests.
- Callers behind one shared IP address (an office NAT, a CI runner, a VPN) share one limit.

## An answer looks cut off

List results come in pages fitted under 25,000 characters, so a page can hold fewer items than
asked for; Claude pages on from where it stopped. Long bill text comes in parts the same way. Other
tool output truncates at 25,000 characters, with a pagination hint appended, and a truncated
response is not the complete answer. Ask Claude to page through the rest, or narrow the request
(one session, one chamber, a date range).

## Tool errors

Errors come back as tool results, not as a crash, in one of two shapes:

| Shape | Means | Fix |
| --- | --- | --- |
| Text starting `Error:` | The server understood the call but couldn't answer it, for example a votes query with no filter, or a search too broad for the time limit | The message names the problem. Narrow the request or add the missing filter |
| `MCP error -32602: Input validation error:` | The call passed a parameter the tool doesn't accept. Schemas reject unknown keys | Usually a guessed parameter name. The guidance names the valid ones; ask Claude to check the tool reference and retry |

An empty result is not an error. It means nothing matched; try a broader search.

## The answer names the wrong legislator

Legislators with the same name are different people. Name the state, the party, or a session
or bill the person voted on, and Claude can tell them apart. A chamber or district you give is
checked against the seat the legislator's contact card returns; when no seat is recorded, it is
reported as unverified. When the records can't settle it, the plugin lists the candidates rather
than guessing.

No tool maps an address or district to a legislator. Asking about "my senator" or "my
representative" without a name gets a question back: give the legislator's name and state.

## Claude says the server isn't connected

If no cicada-guide tools are available in the session, Claude says the `guide-public` server isn't
connected rather than answering from general knowledge. See
[the server doesn't show up](#the-server-doesnt-show-up-or-shows-as-disconnected) above: run
`/mcp`, then start a new session.

## Using a host other than Claude Code

The endpoint `https://public.cicada.guide/mcp` is a standard Streamable HTTP MCP server. Any host
that supports remote MCP servers can connect to it directly, with no credentials. Without the
plugin, though, the host doesn't get the skills and agents, only the raw tools.

## Still stuck

Open an issue at <https://github.com/cicada-guide/plugin/issues>. Include the question you asked,
what happened, and the error text if there was one. Keep personal details out of it. Security
issues go through [SECURITY.md](../SECURITY.md) instead.
