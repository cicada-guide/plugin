# Original User Request

## Initial Request — 2026-09-26T00:28:20Z

This is a single self-contained fix; keep it small and focused. The user requested a small, focused team (single implementer with iterative adversarial review — ideal for cohesive refactor/cleanup).

Perform a full-scope optimization of the Cicada Guide plugin repository (c:\Users\forre\Documents\cicada-guide\plugin), streamlining agent prompts and skill definitions for token efficiency, ensuring manifest and packaging correctness, and establishing an automated verification script to validate integrity and track savings.

Working directory: c:\Users\forre\Documents\cicada-guide\plugin
Integrity mode: development

## Requirements

### R1. Agent & Skill Token Optimization
Audit and streamline all agent system prompts (agents/*.md) and skill instructions (skills/**/SKILL.md), removing redundant explanations, conversational filler, and verbose boilerplate while strictly preserving all capabilities, tool usage rules, trigger conditions, and behavioral edge cases.

### R2. Manifest & Packaging Hygiene
Audit configuration manifests (.claude-plugin/, .codex-plugin/, .mcp.json, and related files) for consistency, clean schema compliance, and elimination of dead or redundant references across plugin environments.

### R3. Documentation & Reference Integrity
Synchronize repository documentation (README.md, CLAUDE.md, PUBLISHING.md) with the optimized structure, ensuring all examples, paths, and referenced skill/agent names are accurate, concise, and up to date.

### R4. Automated Verification & Metrics Reporting
Implement and execute a standalone programmatic verification script that validates JSON/manifest syntax, checks internal cross-file links/paths for broken references, and outputs a comparative metrics report showing before/after character and estimated token counts.

## Acceptance Criteria

### Verification & Schema Validity
- [ ] Automated verification script executes cleanly and exits with status 0.
- [ ] All JSON manifests (plugin.json, marketplace.json, .mcp.json) are syntactically valid and comply with expected schemas.
- [ ] Zero broken relative links or nonexistent file references across all Markdown files.

### Token & Quality Metrics
- [ ] Measurable reduction in character and estimated token counts across agents/ and skills/ files (targeting >= 15% net reduction across prompt text).
- [ ] All core instructions, system prompt constraints, tool definitions, and skill triggers remain functionally intact with no loss of capabilities.
