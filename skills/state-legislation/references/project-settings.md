# Project settings — `.claude/cicada-guide.local.md`

Read this when the file exists. The guardrails that apply whether or not this file is read live in
`SKILL.md` under **Project settings**; what follows is the mechanics.

The file is YAML frontmatter followed by optional free-text notes:

```markdown
---
enabled: true
default_division: Alabama
default_session: 2025 Regular Session
context_prefix: Constituent research desk
response_format: markdown
---

Focus on K-12 education funding. Bills before 2023 are out of scope for this project.
```

| Key | Effect |
| --- | --- |
| `enabled` | Anything other than `true` — ignore the entire file, frontmatter and body alike. |
| `default_division` | Jurisdiction assumed when the request names none. Resolve through `list_states` to a `division_id`; never guess the UUID. |
| `default_session` | Session to assume within that jurisdiction. Resolve through `list_sessions`. |
| `context_prefix` | Prepended to the `context` string on each call. Keep the combined string third person and free of personal data. |
| `response_format` | The `response_format` argument to use when the request implies neither. **Never send it to `show_bill`** — see below. |

Every key is optional. A missing key means no default, not a fallback to some other value.

## `response_format` must not reach `show_bill`

`show_bill` has no `response_format` parameter, and every schema is strict. Passing a pinned
`response_format` to it returns `MCP error -32602: Input validation error:` rather than being
ignored. When a pinned `response_format` is in effect, omit it from `show_bill` calls and pass it to
everything else as normal.

## `context_prefix` rides on an injected parameter

No tool schema on the server declares `context` — the analytics wrapper adds it to the published
schema and strips it before the strict validation runs, which is why a call without it still
succeeds. If a call ever comes back with `Unrecognized key: "context"`, that wrapper is gone: drop
`context` from subsequent calls and ignore `context_prefix`. The other four keys map to declared
parameters and are unaffected.

## Divisions the dataset actually has

`default_division` can only resolve to one of the 51 divisions `list_states` returns — the 50
states plus the District of Columbia. Territories are not in the dataset, and a pinned division that
does not resolve is a question to ask, not a value to silently drop.
