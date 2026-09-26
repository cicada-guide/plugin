# Dispatch Log

## 2026-09-26T00:28:53Z
Sender: acb5010f-6d62-4084-b198-ac5f18aefb5f

You are the SWE Light Orchestrator (`teamwork_preview_swe`).
Your working directory is: c:\Users\forre\Documents\cicada-guide\plugin\.agents\teamwork\swe_1
The project workspace root is: c:\Users\forre\Documents\cicada-guide\plugin
The authoritative user request is recorded at: c:\Users\forre\Documents\cicada-guide\plugin\.agents\teamwork\ORIGINAL_REQUEST.md

Maintain `BRIEFING.md` and `progress.md` in your working directory.

Here is the task you must execute via the SWE Light loop (single implementer with iterative adversarial review, establishing correctness via tests):

Task: Full-scope optimization of the Cicada Guide plugin repository (c:\Users\forre\Documents\cicada-guide\plugin), streamlining agent prompts and skill definitions for token efficiency, ensuring manifest and packaging correctness, and establishing an automated verification script to validate integrity and track savings.
Integrity mode: development

Requirements:
### R1. Agent & Skill Token Optimization
Audit and streamline all agent system prompts (agents/*.md) and skill instructions (skills/**/SKILL.md), removing redundant explanations, conversational filler, and verbose boilerplate while strictly preserving all capabilities, tool usage rules, trigger conditions, and behavioral edge cases.

### R2. Manifest & Packaging Hygiene
Audit configuration manifests (.claude-plugin/, .codex-plugin/, .mcp.json, and related files) for consistency, clean schema compliance, and elimination of dead or redundant references across plugin environments.

### R3. Documentation & Reference Integrity
Synchronize repository documentation (README.md, CLAUDE.md, PUBLISHING.md) with the optimized structure, ensuring all examples, paths, and referenced skill/agent names are accurate, concise, and up to date.

### R4. Automated Verification & Metrics Reporting
Implement and execute a standalone programmatic verification script that validates JSON/manifest syntax, checks internal cross-file links/paths for broken references, and outputs a comparative metrics report showing before/after character and estimated token counts.

Acceptance Criteria:
### Verification & Schema Validity
- [ ] Automated verification script executes cleanly and exits with status 0.
- [ ] All JSON manifests (plugin.json, marketplace.json, .mcp.json) are syntactically valid and comply with expected schemas.
- [ ] Zero broken relative links or nonexistent file references across all Markdown files.

### Token & Quality Metrics
- [ ] Measurable reduction in character and estimated token counts across agents/ and skills/ files (targeting >= 15% net reduction across prompt text).
- [ ] All core instructions, system prompt constraints, tool definitions, and skill triggers remain functionally intact with no loss of capabilities.

When all work and adversarial reviews are successfully concluded, report back your completion and results to me (sentinel) with full evidence and verification logs.
