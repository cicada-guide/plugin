# Reviewer Handoff Report - Round 1

## Executive Summary
This round performed an adversarial review and hardening pass over the Cicada Guide plugin repository (`cicada-guide/plugin`). We audited the prompt compressions, manifest integrity, documentation references, and the automated verification suite. We identified and fixed 5 distinct defects across prompt guardrails, cross-component link invariants, documentation paths, and verification blind spots. The repository achieves a **40.37% net token reduction** (saving 21,757 characters / ~5,437 tokens) while strictly preserving all capabilities, constraints, schemas, tool dataflows, and edge-case behaviors.

---

## 1. What the Prior Attempt Got Wrong

### Issue 1: Inversion of Error Handling / Retry Logic in `agents/legislator-disambiguator.md`
- **Input:** MCP tool failures during legislator identity resolution.
- **Expected:** The original baseline stated: "Failed calls come back as results in two shapes... Retry once, then report the candidate as unverified instead of dropping them."
- **Actual:** The prior attempt compressed this to: "Retry once on validation errors; otherwise report as unverified."
- **Root Cause:** Inverted retry logic. Schema validation errors (`MCP error -32602`) indicate invalid parameter keys that cannot succeed upon naive retry. Transient handler failures (`Error:`) are what should be retried before marking a candidate unverified.
- **Fix:** Restored clear directive: `- Error handling: handler (`Error:`) vs schema validation (`MCP error -32602:`). Retry once on failed calls; then report candidate as unverified instead of dropping them.`

### Issue 2: Dropped Synopsis vs Operative Text Guardrail in `agents/multi-state-bill-scanner.md`
- **Input:** Policy surveys deepening on 1-3 decisive bills across states.
- **Expected:** Statutory text must be strictly distinguished from synopses and summaries: "Never present a synopsis as the bill's operative text without saying so."
- **Actual:** The prior attempt compressed this section into `Cite bill UUIDs for all referenced legislation.`, dropping the prohibition against presenting synopses as operative law.
- **Root Cause:** Over-aggressive condensation that conflated UUID citation with text labeling accuracy.
- **Fix:** Added explicit quality rule: `- Distinguish operative statutory text from synopsis, headline, or summarization; never present summaries as operative text.`

### Issue 3: Cross-Component Link Invariant Violation in `skills/state-legislation/references/project-settings.md`
- **Input:** `skills/state-legislation/references/project-settings.md` referencing `SKILL.md`.
- **Expected:** Repository invariant documented in `PUBLISHING.md` and `CLAUDE.md`: "Cross-component links use `${CLAUDE_PLUGIN_ROOT}`, never relative paths. A subagent's working directory is the user's project, so `../skills/...` resolves to nothing."
- **Actual:** Prior attempt replaced broken `SKILL.md` with relative path `../SKILL.md`. In subagent execution contexts where working directory is the user project, `../SKILL.md` resolves outside the project or fails.
- **Root Cause:** Misapplying relative file path resolution to a file accessed by subagents.
- **Fix:** Replaced with `${CLAUDE_PLUGIN_ROOT}/skills/state-legislation/SKILL.md`.

### Issue 4: Broken Backtick Manifest References in `PUBLISHING.md`
- **Input:** Inline backtick references `marketplace.json` and `plugin.json` in `PUBLISHING.md` line 13.
- **Expected:** Valid repository file paths resolving to existing files.
- **Actual:** Bare filenames were not found relative to `PUBLISHING.md` or repo root.
- **Root Cause:** Bare filenames used without directory path `.claude-plugin/`.
- **Fix:** Updated to `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json`.

### Issue 5: Significant Blind Spots and Validation Gaps in `scripts/verify.py`
- **Relative path evasion:** `verify.py` contained `if ref_path.startswith("."): continue`, which inadvertently skipped checking all relative links starting with `./` or `../`.
- **Empty string path existence false positives:** In `validate_manifests()`, `REPO_ROOT / interface.get("logo", "")` and `REPO_ROOT / codex_plugin.get("skills", "")` resolved empty string to `REPO_ROOT`, returning `True` even if the configuration key was empty.
- **Missing frontmatter validation:** Failed to validate YAML frontmatter, `name`, `description`, and `model` in `agents/*.md` and `skills/**/SKILL.md`.
- **Missing tool definition consistency check:** Failed to cross-validate tool lists between `skills/state-legislation/SKILL.md` and `skills/state-legislation/references/tool-reference.md`.
- **Missing anchor validation:** Stripped `#anchor` tags from links without checking if the target heading slug actually existed in the document.

---

## 2. What I Changed

1. **`agents/legislator-disambiguator.md`**:
   - Corrected error handling retry rule to target failed calls and prevent premature candidate dropping.
2. **`agents/multi-state-bill-scanner.md`**:
   - Restored operative statutory text vs synopsis/summarization distinction in Quality standards.
3. **`skills/state-legislation/references/project-settings.md`**:
   - Replaced `../SKILL.md` with `${CLAUDE_PLUGIN_ROOT}/skills/state-legislation/SKILL.md` to uphold the repository cross-component linking invariant.
4. **`PUBLISHING.md`**:
   - Fixed bare manifest references in line 13 to `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json`.
5. **`scripts/verify.py`**:
   - Rewrote manifest checks to prevent empty-string false passes and enforce semver format.
   - Added `validate_frontmatter()` checking YAML frontmatter delimiters, `name`, `description`, `model`, and alignment with file/directory stems.
   - Added `validate_tool_consistency()` checking that all 17 MCP tools are synchronized between `SKILL.md` and `tool-reference.md`.
   - Hardened `validate_links()`: added anchor slug extraction and verification, fixed `./` and `../` resolution logic, expanded inline backtick validation across all repo extensions (`.md`, `.json`, `.svg`, `.example`, `.py`, `.yaml`).

---

## 3. Verification Record

### Deep Verification (Programmatic Execution)
- **`python scripts/verify.py`**:
  - Validated all 4 JSON files (`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, `.mcp.json`). All valid JSON, required fields present, semver compliant, version aligned at 0.3.0.
  - Validated YAML frontmatter across all 3 agents and all 3 skills; confirmed names match file/directory stems.
  - Validated tool definition consistency: all 17 MCP tools match between `SKILL.md` and `tool-reference.md`.
  - Validated cross-file links, anchors, and file references: checked 9 markdown links, 1 heading anchor target, 10 `${CLAUDE_PLUGIN_ROOT}` references, and 33 inline file paths across 12 files. Zero broken references.
  - Computed comparative token metrics:
    - Baseline: 53,897 chars (~13,474 tokens)
    - Optimized: 32,140 chars (~8,037 tokens)
    - Net reduction: **21,757 chars (5,437 tokens, 40.37%)**
    - Target >= 15.0% passed.
  - Result: Exit status 0, `ALL VERIFICATION CHECKS PASSED.`
- **`python scripts/verify.py --min-reduction 50.0`**:
  - Verified threshold enforcement: cleanly exited with code 1 (`Net token reduction is 40.37%, which is below target 50.0%`).
- **`python scripts/verify.py --min-reduction 50.0 --no-reduction-check`**:
  - Verified bypass flag: cleanly exited with code 0.
- **Git diff & status**:
  - Confirmed only intended files were modified.

### Shallow Verification (Manual Inspection)
- Inspected all YAML frontmatter blocks across `agents/*.md` and `skills/**/SKILL.md`.
- Verified layout and invariants tables in `CLAUDE.md` and `PUBLISHING.md`.

### Unverified Aspects
- Live connection to the remote MCP server at `https://public.cicada.guide/mcp` (remote service dependency).
- Real-time interactive execution in a GUI Claude Code session (`claude --plugin-dir .`).

---

## 4. Known Issues
- `Minor Robustness Risk`: The remote MCP endpoint `https://public.cicada.guide/mcp` is an external dependency that must be reachable for live host execution; offline environments cannot verify live session handshake.

---

## 5. Comparative Token & Character Metrics

| File | Baseline Chars | Optimized Chars | Net Diff | % Reduction | Baseline Tokens (~c/4) | Optimized Tokens (~c/4) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `agents/bill-brief-researcher.md` | 9,673 | 6,647 | -3,026 | -31.3% | 2,418 | 1,662 |
| `agents/legislator-disambiguator.md` | 7,722 | 4,908 | -2,814 | -36.4% | 1,930 | 1,227 |
| `agents/multi-state-bill-scanner.md` | 7,518 | 4,982 | -2,536 | -33.7% | 1,880 | 1,246 |
| `skills/bill-research/SKILL.md` | 6,888 | 4,262 | -2,626 | -38.1% | 1,722 | 1,066 |
| `skills/state-legislation/SKILL.md` | 14,640 | 7,446 | -7,194 | -49.1% | 3,660 | 1,862 |
| `skills/voting-record/SKILL.md` | 7,456 | 3,895 | -3,561 | -47.8% | 1,864 | 974 |
| **TOTAL** | **53,897** | **32,140** | **-21,757** | **-40.37%** | **13,474** | **8,037** |

Net savings: **21,757 characters** (~**5,437 tokens**), a **40.37% reduction** (well above the 15% target).
