# How to configure a project

For anyone who asks the plugin about the same state, session, or subject again and again in one
project. It shows how to set up `.claude/cicada-guide.local.md` from the template, what each key
does with an example, and what the file cannot do.

The authoritative contract, the one Claude follows, is
[`skills/get-legislation/references/project-settings.md`](../skills/get-legislation/references/project-settings.md).
This page is the how-to; where the two differ, the contract wins.

The file is optional. Without it the plugin behaves exactly as it does out of the box.

## Create the file

1. Copy the template into your project's `.claude/` directory:

   ```bash
   mkdir -p .claude
   cp /path/to/plugin/cicada-guide.local.md.example .claude/cicada-guide.local.md
   ```

   If you installed from the marketplace and have no checkout, the template is at
   <https://github.com/cicada-guide/plugin-anthropic/blob/main/cicada-guide.local.md.example>. The file must
   be named `.claude/cicada-guide.local.md`, at your project's root.

2. Keep it out of version control. It is per-project and per-user:

   ```text
   # .gitignore
   .claude/*.local.md
   ```

3. Edit the keys below. Delete any you don't want; every key is optional, and a missing key means
   no default for that setting.

The file is YAML frontmatter followed by optional free-text notes:

```markdown
---
enabled: true
default_division: Alabama
default_session: 2026 Regular Session
context_prefix: Constituent research desk
response_format: markdown
---

Focus on K-12 education funding. Bills before 2023 are out of scope for this project.
```

## The keys

| Key | Effect | Example |
| --- | --- | --- |
| `enabled` | Must be `true` for the file to count. Anything else ignores the whole file, frontmatter and notes alike | `enabled: true` |
| `default_division` | The state assumed when a question names none | `default_division: Alabama` |
| `default_session` | The session assumed within that state | `default_session: 2026 Regular Session` |
| `context_prefix` | Text prepended to the `context` string sent with each tool call | `context_prefix: Constituent research desk` |
| `response_format` | `markdown` or `json`, used when a question implies neither | `response_format: markdown` |

### `enabled`

Set it to `true` to turn the file on. To switch the settings off temporarily without deleting the
file, set it to `false`: anything but `true` means Claude ignores the file entirely, including the
notes below the frontmatter.

### `default_division`

The jurisdiction Claude assumes when you don't name one. It must be one of the divisions the
dataset holds: the 50 states and the District of Columbia. Territories are not in the dataset.

```yaml
default_division: Alabama
```

Claude looks the name up rather than guessing an id. If it doesn't match a jurisdiction, Claude
names the value and asks you, instead of silently running an unscoped search.

With a default division set, legislator questions test same-name candidates against that state
when you name none. That narrows the candidates; it doesn't on its own confirm who you mean.

### `default_session`

The session assumed within the default jurisdiction. Use a session name exactly as the dataset
lists it. To see the names, ask:

```text
List Alabama's legislative sessions
```

Then copy one:

```yaml
default_session: 2026 Regular Session
```

The template leaves this key commented out, so copying the template as-is pins no session. As with
the division, a session name that doesn't resolve gets a question back, not a silent skip.

### `context_prefix`

Every tool call carries a short `context` string describing why the call is being made, which the
server records in its anonymous usage analytics. `context_prefix` is prepended to that string, so
you can tell your project's calls apart:

```yaml
context_prefix: Constituent research desk
```

Keep it third person, with no names, no credentials, and no personal data. Whatever you put here
is sent to the server with every call; see "Privacy" in the [README](../README.md#privacy).

This key depends on the server's analytics wrapper, which is what adds `context` to each tool. If
that wrapper were ever removed, Claude drops `context` and ignores `context_prefix`; the other keys
are unaffected. The contract describes the recovery.

### `response_format`

The format Claude asks the tools for when your question implies neither:

```yaml
response_format: markdown
```

`markdown` is readable text; `json` is structured data. Claude never sends it to the tools that
lack the parameter (`show_bill`, `show_person_record`, `show_official`, and
`get_rollcall_breakdown`), since passing it there would fail with a validation error. A request
that needs a particular format, such as filtering votes by subject, still uses that format.

## The notes below the frontmatter

Free text after the closing `---` is standing project context: the subject area, a time window,
why the research is being done. Claude folds it into scoping decisions as if you had restated it
in each question.

```markdown
Focus on K-12 education funding. Bills before 2023 are out of scope for this project.
```

It shapes scope; it is not a source of facts. Claims still come only from what the tools return.

## What the file cannot do

- **Override an explicit request.** Asking about Texas gets Texas, whatever `default_division`
  says. The two are not merged, and the default is not added as a second search.
- **Widen scope or lift the plugin's constraints.** Federal bills, municipal ordinances, and ballot
  measures stay out of the dataset. A note asking for a legislator's grade, a ranking, or a
  prediction of passage is still declined.
- **Apply silently.** When a default is used, Claude says so in the answer, for example "Alabama,
  from the project default".

## Check that it's working

Ask a question that names no state:

```text
Find recent bills about school funding
```

With `default_division: Alabama` set, the answer is scoped to Alabama and says the jurisdiction
came from the project default. If it isn't:

- Check that `enabled` is exactly `true`.
- Check the path: `.claude/cicada-guide.local.md` at your project's root.
- Check that the value matches a jurisdiction or session name; Claude asks when it doesn't.

No restart is needed: the skills read the file at the start of a task. If Claude already read the
file earlier in the same session, it may still be working from that copy, so mention the change
when you make one.

## See also

- [Project settings contract](../skills/get-legislation/references/project-settings.md): the
  rules Claude follows, including the `response_format` and `context_prefix` details.
- [`cicada-guide.local.md.example`](../cicada-guide.local.md.example): the template, with comments.
- [Research a bill](howto-research-a-bill.md) and
  [Check a voting record](howto-check-a-voting-record.md): where the defaults take effect.
