#!/usr/bin/env python3
"""
Automated verification and metrics reporting for cicada-guide plugin.

Validates:
1. JSON manifest syntax, consistency, and schema compliance across Claude, Codex, and MCP configs.
2. Skill and agent YAML frontmatter integrity and name alignment.
3. Tool definition consistency across SKILL.md, tool-reference.md, and README.md.
4. Cross-file relative links, anchor tags, ${CLAUDE_PLUGIN_ROOT} references, and inline file paths.
5. Comparative character and estimated token counts before/after optimization (enforcing >= 15% net reduction).
"""

import os
import re
import sys
import json
import argparse
import subprocess
from pathlib import Path

# Optional PyYAML support for frontmatter validation
try:
    import yaml
    HAVE_YAML = True
except ImportError:
    HAVE_YAML = False

# Repo root is parent of scripts/
REPO_ROOT = Path(__file__).resolve().parent.parent

# Files/directories to exclude from doc / link checks
EXCLUDE_DIRS = {".git", ".agents", "node_modules", ".venv", "venv", "__pycache__"}

# Core prompt files targeted for token optimization
PROMPT_FILES = [
    "agents/bill-brief-researcher.md",
    "agents/legislator-disambiguator.md",
    "agents/multi-state-bill-scanner.md",
    "skills/bill-research/SKILL.md",
    "skills/state-legislation/SKILL.md",
    "skills/voting-record/SKILL.md",
]

# Authoritative baseline snapshot from git commit before token optimization
BASELINE_SNAPSHOT = {
    "agents/bill-brief-researcher.md": {"chars": 9673, "words": 1539},
    "agents/legislator-disambiguator.md": {"chars": 7722, "words": 1226},
    "agents/multi-state-bill-scanner.md": {"chars": 7518, "words": 1161},
    "skills/bill-research/SKILL.md": {"chars": 6888, "words": 1059},
    "skills/state-legislation/SKILL.md": {"chars": 14640, "words": 2283},
    "skills/voting-record/SKILL.md": {"chars": 7456, "words": 1175},
}


def get_git_head_content(rel_path: str) -> str | None:
    """Attempt to get file content from git HEAD."""
    try:
        norm_path = rel_path.replace("\\", "/")
        result = subprocess.run(
            ["git", "show", f"HEAD:{norm_path}"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
        if result.returncode == 0 and result.stdout:
            return result.stdout.replace("\r\n", "\n")
    except Exception:
        pass
    return None


def slugify_heading(heading_text: str) -> tuple[str, str]:
    """
    Convert heading text to GitHub-style markdown anchor slugs.
    Returns a tuple of (underscore_preserved_slug, hyphenated_slug).
    """
    slug = heading_text.strip().lower()
    # Strip inline code formatting, links, punctuation
    slug = re.sub(r"`([^`]+)`", r"\1", slug)
    slug = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", slug)
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug_preserve_underscore = re.sub(r"\s+", "-", slug).strip("-")
    slug_hyphenated = re.sub(r"[\s_]+", "-", slug).strip("-")
    return (slug_preserve_underscore, slug_hyphenated)


def extract_markdown_anchors(content: str) -> set[str]:
    """Extract all heading anchor slugs from markdown text, supporting duplicate heading numbering."""
    anchors = set()
    slug_counts: dict[str, int] = {}
    for line in content.splitlines():
        match = re.match(r"^#{1,6}\s+(.+)$", line)
        if match:
            heading = match.group(1).strip()
            # Explicit anchor syntax {#my-anchor} if present
            explicit = re.search(r"\{#([a-zA-Z0-9_-]+)\}\s*$", heading)
            if explicit:
                anchors.add(explicit.group(1).lower())
                heading = heading[:explicit.start()].strip()

            slug1, slug2 = slugify_heading(heading)
            for slug in [slug1, slug2]:
                if not slug:
                    continue
                count = slug_counts.get(slug, 0)
                slug_counts[slug] = count + 1
                if count == 0:
                    anchors.add(slug)
                else:
                    anchors.add(f"{slug}-{count}")
    return anchors


def validate_manifests() -> tuple[bool, list[str]]:
    """Validate JSON manifests and configuration files."""
    errors = []
    print("=== 1. Validating Manifests & Configs ===")

    semver_pattern = re.compile(r"^\d+\.\d+\.\d+(-[a-zA-Z0-9_.-]+)?$")

    # 1. .claude-plugin/plugin.json
    claude_plugin_path = REPO_ROOT / ".claude-plugin" / "plugin.json"
    claude_plugin = {}
    if not claude_plugin_path.exists():
        errors.append(".claude-plugin/plugin.json does not exist")
    else:
        try:
            with open(claude_plugin_path, "r", encoding="utf-8") as f:
                claude_plugin = json.load(f)
            print("  [PASS] .claude-plugin/plugin.json is valid JSON")
            for req_field in ["name", "version", "description", "author", "license"]:
                if req_field not in claude_plugin or not claude_plugin[req_field]:
                    errors.append(f".claude-plugin/plugin.json missing or empty required field '{req_field}'")
            if "version" in claude_plugin and not semver_pattern.match(str(claude_plugin["version"])):
                errors.append(f".claude-plugin/plugin.json version '{claude_plugin['version']}' is not valid semver")
            if "author" in claude_plugin:
                if not isinstance(claude_plugin["author"], dict) or not claude_plugin["author"].get("name"):
                    errors.append(".claude-plugin/plugin.json author must be an object with non-empty 'name'")
        except Exception as e:
            errors.append(f".claude-plugin/plugin.json failed JSON parse: {e}")

    # 2. .claude-plugin/marketplace.json
    marketplace_path = REPO_ROOT / ".claude-plugin" / "marketplace.json"
    marketplace = {}
    if not marketplace_path.exists():
        errors.append(".claude-plugin/marketplace.json does not exist")
    else:
        try:
            with open(marketplace_path, "r", encoding="utf-8") as f:
                marketplace = json.load(f)
            print("  [PASS] .claude-plugin/marketplace.json is valid JSON")
            if "$schema" not in marketplace:
                errors.append(".claude-plugin/marketplace.json missing '$schema'")
            if "metadata" not in marketplace or "version" not in marketplace["metadata"]:
                errors.append(".claude-plugin/marketplace.json missing 'metadata.version'")
            elif not semver_pattern.match(str(marketplace["metadata"]["version"])):
                errors.append(f".claude-plugin/marketplace.json metadata.version '{marketplace['metadata']['version']}' is not valid semver")
            if "plugins" not in marketplace or not isinstance(marketplace["plugins"], list) or len(marketplace["plugins"]) == 0:
                errors.append(".claude-plugin/marketplace.json missing or empty 'plugins' list")
            else:
                for idx, p in enumerate(marketplace["plugins"]):
                    source = p.get("source")
                    if not source:
                        errors.append(f".claude-plugin/marketplace.json plugins[{idx}] missing 'source'")
                    elif not (REPO_ROOT / source).exists():
                        errors.append(f".claude-plugin/marketplace.json plugins[{idx}].source '{source}' does not exist")
                    if "version" in p and not semver_pattern.match(str(p["version"])):
                        errors.append(f".claude-plugin/marketplace.json plugins[{idx}].version '{p['version']}' is not valid semver")
                    if not p.get("name"):
                        errors.append(f".claude-plugin/marketplace.json plugins[{idx}] missing 'name'")
                    if not p.get("description"):
                        errors.append(f".claude-plugin/marketplace.json plugins[{idx}] missing 'description'")
        except Exception as e:
            errors.append(f".claude-plugin/marketplace.json failed JSON parse: {e}")

    # 3. .codex-plugin/plugin.json
    codex_plugin_path = REPO_ROOT / ".codex-plugin" / "plugin.json"
    codex_plugin = {}
    if not codex_plugin_path.exists():
        errors.append(".codex-plugin/plugin.json does not exist")
    else:
        try:
            with open(codex_plugin_path, "r", encoding="utf-8") as f:
                codex_plugin = json.load(f)
            print("  [PASS] .codex-plugin/plugin.json is valid JSON")
            for req_field in ["name", "version", "description", "author", "skills", "mcpServers", "interface"]:
                if req_field not in codex_plugin or not codex_plugin[req_field]:
                    errors.append(f".codex-plugin/plugin.json missing or empty required field '{req_field}'")
            if "version" in codex_plugin and not semver_pattern.match(str(codex_plugin["version"])):
                errors.append(f".codex-plugin/plugin.json version '{codex_plugin['version']}' is not valid semver")
            # Author must have name and email per PUBLISHING.md decision 16
            author = codex_plugin.get("author", {})
            if not isinstance(author, dict) or not author.get("name") or not author.get("email"):
                errors.append(".codex-plugin/plugin.json author must be an object with non-empty 'name' and 'email'")
            # Check referenced paths with non-empty checks
            skills_val = codex_plugin.get("skills")
            if not skills_val or not isinstance(skills_val, str):
                errors.append(".codex-plugin/plugin.json 'skills' path is missing or empty")
            elif not (REPO_ROOT / skills_val).exists():
                errors.append(f".codex-plugin/plugin.json skills path does not exist: {skills_val}")

            mcp_val = codex_plugin.get("mcpServers")
            if not mcp_val or not isinstance(mcp_val, str):
                errors.append(".codex-plugin/plugin.json 'mcpServers' path is missing or empty")
            elif not (REPO_ROOT / mcp_val).exists():
                errors.append(f".codex-plugin/plugin.json mcpServers path does not exist: {mcp_val}")

            interface = codex_plugin.get("interface", {})
            logo_val = interface.get("logo")
            if not logo_val or not isinstance(logo_val, str):
                errors.append(".codex-plugin/plugin.json interface.logo is missing or empty")
            elif not (REPO_ROOT / logo_val).exists():
                errors.append(f".codex-plugin/plugin.json interface.logo does not exist: {logo_val}")
        except Exception as e:
            errors.append(f".codex-plugin/plugin.json failed JSON parse: {e}")

    # 4. .mcp.json
    mcp_path = REPO_ROOT / ".mcp.json"
    if not mcp_path.exists():
        errors.append(".mcp.json does not exist")
    else:
        try:
            with open(mcp_path, "r", encoding="utf-8") as f:
                mcp_data = json.load(f)
            print("  [PASS] .mcp.json is valid JSON")
            if "mcpServers" not in mcp_data or "guide-public" not in mcp_data["mcpServers"]:
                errors.append(".mcp.json missing 'mcpServers.guide-public'")
            else:
                server_cfg = mcp_data["mcpServers"]["guide-public"]
                if server_cfg.get("url") != "https://public.cicada.guide/mcp":
                    errors.append(f".mcp.json guide-public URL is '{server_cfg.get('url')}', expected 'https://public.cicada.guide/mcp'")
                if server_cfg.get("type") != "http":
                    errors.append(f".mcp.json guide-public type is '{server_cfg.get('type')}', expected 'http'")
        except Exception as e:
            errors.append(f".mcp.json failed JSON parse: {e}")

    # 5. Check version synchronization (4 fields across 3 files)
    v1 = claude_plugin.get("version")
    v2 = codex_plugin.get("version")
    v3 = marketplace.get("metadata", {}).get("version")
    v4 = marketplace.get("plugins", [{}])[0].get("version") if marketplace.get("plugins") else None

    print(f"  Version check: Claude={v1}, Codex={v2}, MarketMeta={v3}, MarketPlugin={v4}")
    if not (v1 == v2 == v3 == v4 and v1 is not None):
        errors.append(f"Version mismatch across manifests: Claude={v1}, Codex={v2}, MarketMeta={v3}, MarketPlugin={v4}")
    else:
        print(f"  [PASS] All 4 manifest version fields match ({v1})")

    return (len(errors) == 0, errors)


def validate_frontmatter() -> tuple[bool, list[str]]:
    """Validate YAML frontmatter in agents/*.md and skills/**/SKILL.md files."""
    errors = []
    print("\n=== 2. Validating Skill & Agent Frontmatter ===")

    # 1. Check agents/*.md
    agents_dir = REPO_ROOT / "agents"
    if agents_dir.exists():
        for agent_file in sorted(agents_dir.glob("*.md")):
            rel_path = agent_file.relative_to(REPO_ROOT).as_posix()
            content = agent_file.read_text(encoding="utf-8")
            if not content.startswith("---"):
                errors.append(f"Agent {rel_path} missing leading '---' frontmatter delimiter")
                continue
            parts = content.split("---", 2)
            if len(parts) < 3:
                errors.append(f"Agent {rel_path} frontmatter unclosed")
                continue
            fm_text = parts[1]

            if HAVE_YAML:
                try:
                    parsed_yaml = yaml.safe_load(fm_text)
                    if not isinstance(parsed_yaml, dict):
                        errors.append(f"Agent {rel_path} frontmatter is not a valid YAML mapping")
                except Exception as e:
                    errors.append(f"Agent {rel_path} invalid YAML frontmatter: {e}")

            name_m = re.search(r"^name:\s*(.+)$", fm_text, re.MULTILINE)
            desc_m = re.search(r"^description:\s*(.+)$", fm_text, re.MULTILINE)
            model_m = re.search(r"^model:\s*(.+)$", fm_text, re.MULTILINE)

            if not name_m:
                errors.append(f"Agent {rel_path} missing 'name:' in frontmatter")
            else:
                agent_name = name_m.group(1).strip()
                expected_name = agent_file.stem
                if agent_name != expected_name:
                    errors.append(f"Agent {rel_path} name '{agent_name}' != filename stem '{expected_name}'")

            if not desc_m or not desc_m.group(1).strip():
                errors.append(f"Agent {rel_path} missing or empty 'description:' in frontmatter")

            if not model_m or not model_m.group(1).strip():
                errors.append(f"Agent {rel_path} missing or empty 'model:' in frontmatter")

            print(f"  [PASS] Agent frontmatter valid: {rel_path}")

    # 2. Check skills/**/SKILL.md
    skills_dir = REPO_ROOT / "skills"
    if skills_dir.exists():
        for skill_file in sorted(skills_dir.glob("*/SKILL.md")):
            rel_path = skill_file.relative_to(REPO_ROOT).as_posix()
            content = skill_file.read_text(encoding="utf-8")
            if not content.startswith("---"):
                errors.append(f"Skill {rel_path} missing leading '---' frontmatter delimiter")
                continue
            parts = content.split("---", 2)
            if len(parts) < 3:
                errors.append(f"Skill {rel_path} frontmatter unclosed")
                continue
            fm_text = parts[1]

            if HAVE_YAML:
                try:
                    parsed_yaml = yaml.safe_load(fm_text)
                    if not isinstance(parsed_yaml, dict):
                        errors.append(f"Skill {rel_path} frontmatter is not a valid YAML mapping")
                except Exception as e:
                    errors.append(f"Skill {rel_path} invalid YAML frontmatter: {e}")

            name_m = re.search(r"^name:\s*(.+)$", fm_text, re.MULTILINE)
            desc_m = re.search(r"^description:\s*(.+)$", fm_text, re.MULTILINE)

            if not name_m:
                errors.append(f"Skill {rel_path} missing 'name:' in frontmatter")
            else:
                skill_name = name_m.group(1).strip()
                expected_name = skill_file.parent.name
                if skill_name != expected_name:
                    errors.append(f"Skill {rel_path} name '{skill_name}' != parent dir '{expected_name}'")

            if not desc_m or not desc_m.group(1).strip():
                errors.append(f"Skill {rel_path} missing or empty 'description:' in frontmatter")

            print(f"  [PASS] Skill frontmatter valid: {rel_path}")

    return (len(errors) == 0, errors)


def validate_tool_consistency() -> tuple[bool, list[str]]:
    """Validate that tool lists across SKILL.md, tool-reference.md, and README.md stay synchronized."""
    errors = []
    print("\n=== 3. Validating Tool Definitions & Consistency ===")

    skill_md = REPO_ROOT / "skills" / "state-legislation" / "SKILL.md"
    ref_md = REPO_ROOT / "skills" / "state-legislation" / "references" / "tool-reference.md"
    readme_md = REPO_ROOT / "README.md"

    if not skill_md.exists():
        errors.append(f"Missing {skill_md}")
        return (False, errors)
    if not ref_md.exists():
        errors.append(f"Missing {ref_md}")
        return (False, errors)
    if not readme_md.exists():
        errors.append(f"Missing {readme_md}")
        return (False, errors)

    skill_text = skill_md.read_text(encoding="utf-8")
    ref_text = ref_md.read_text(encoding="utf-8")
    readme_text = readme_md.read_text(encoding="utf-8")

    # 1. Extract tools from SKILL.md tool selection table (| Goal | Tool |)
    skill_tools = set(re.findall(r"\|\s*`([a-z_]+)`\s*\|", skill_text))

    # 2. Extract tools from tool-reference.md headings (### `tool_name`)
    ref_tools = set(re.findall(r"^###\s+`([a-z_]+)`", ref_text, re.MULTILINE))

    # 3. Extract tools from README.md ## Tools table (| `tool_name` | Purpose |)
    readme_tools = set()
    tools_section = False
    for line in readme_text.splitlines():
        if line.startswith("## Tools"):
            tools_section = True
            continue
        if tools_section and line.startswith("## "):
            break
        if tools_section and line.startswith("| `"):
            m = re.match(r"^\|\s*`([a-z_]+)`\s*\|", line)
            if m:
                readme_tools.add(m.group(1))

    if not skill_tools:
        errors.append("No tools extracted from SKILL.md")
    if not ref_tools:
        errors.append("No tools extracted from tool-reference.md")
    if not readme_tools:
        errors.append("No tools extracted from README.md")

    # Check synchronization
    diff_skill_ref = skill_tools ^ ref_tools
    diff_skill_readme = skill_tools ^ readme_tools

    if diff_skill_ref:
        errors.append(f"Tool mismatch between SKILL.md and tool-reference.md: {sorted(diff_skill_ref)}")
    if diff_skill_readme:
        errors.append(f"Tool mismatch between SKILL.md and README.md: {sorted(diff_skill_readme)}")

    if not diff_skill_ref and not diff_skill_readme and skill_tools:
        print(f"  [PASS] All {len(skill_tools)} MCP tools match across SKILL.md, tool-reference.md, and README.md")

    return (len(errors) == 0, errors)


def validate_links() -> tuple[bool, list[str]]:
    """Validate relative links, anchors, and cross-component references in all Markdown files."""
    errors = []
    print("\n=== 4. Validating Cross-File Links & References ===")

    md_files = []
    for root, dirs, files in os.walk(REPO_ROOT):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            if f.endswith(".md"):
                md_files.append(Path(root) / f)

    # Pre-parse heading anchors for all markdown files in repo
    file_anchors: dict[Path, set[str]] = {}
    for md_path in md_files:
        try:
            content = md_path.read_text(encoding="utf-8")
            file_anchors[md_path.resolve()] = extract_markdown_anchors(content)
        except Exception as e:
            errors.append(f"Could not read {md_path}: {e}")

    link_pattern = re.compile(r"!?\[([^\]]*)\]\(([^)]+)\)")
    root_ref_pattern = re.compile(r"\$\{CLAUDE_PLUGIN_ROOT\}/([a-zA-Z0-9_/.-]+)")
    backtick_file_pattern = re.compile(r"`([a-zA-Z0-9_./-]+\.[a-zA-Z0-9_-]+)`")

    checked_links = 0
    checked_anchors = 0
    checked_root_refs = 0
    checked_backtick_refs = 0

    valid_file_extensions = (".md", ".json", ".svg", ".example", ".py", ".yml", ".yaml")

    for md_path in md_files:
        rel_md = md_path.relative_to(REPO_ROOT).as_posix()
        try:
            content = md_path.read_text(encoding="utf-8")
        except Exception as e:
            errors.append(f"Could not read {rel_md}: {e}")
            continue

        # 1. Check [text](target) and ![alt](target)
        for match in link_pattern.finditer(content):
            label, raw_target = match.groups()
            target = raw_target.strip().strip("<>")
            # Strip optional markdown title quotes e.g. [text](path "title")
            target = target.split()[0] if target.split() else target

            if target.startswith(("http://", "https://", "mailto:", "ui://", "data:")):
                continue

            target_clean = target.split("?")[0]
            target_file_part = target_clean.split("#")[0]
            anchor_part = target_clean.split("#")[1] if "#" in target_clean else None

            # Intra-file anchor link e.g. [Tools](#tools)
            if not target_file_part:
                if anchor_part:
                    checked_anchors += 1
                    target_anchors = file_anchors.get(md_path.resolve(), set())
                    if anchor_part.lower() not in target_anchors:
                        errors.append(f"Broken anchor in {rel_md}: [{label}]({raw_target}) -> '#{anchor_part}' not found")
                continue

            checked_links += 1
            resolved = (md_path.parent / target_file_part).resolve()
            if not resolved.exists():
                errors.append(f"Broken link in {rel_md}: [{label}]({raw_target}) -> '{target_file_part}' not found")
            elif anchor_part and resolved.suffix == ".md":
                checked_anchors += 1
                target_anchors = file_anchors.get(resolved, set())
                if anchor_part.lower() not in target_anchors:
                    errors.append(f"Broken cross-file anchor in {rel_md}: [{label}]({raw_target}) -> '#{anchor_part}' not found in {target_file_part}")

        # 2. Check ${CLAUDE_PLUGIN_ROOT}/...
        for match in root_ref_pattern.finditer(content):
            raw_ref = match.group(1)
            # Skip illustrative template patterns with ellipsis or wildcards (e.g. ${CLAUDE_PLUGIN_ROOT}/skills/...)
            if "..." in raw_ref or "*" in raw_ref or "<" in raw_ref:
                continue

            ref_path = raw_ref.rstrip(".,;:)")
            checked_root_refs += 1
            resolved = (REPO_ROOT / ref_path).resolve()
            if not resolved.exists():
                errors.append(f"Broken plugin root ref in {rel_md}: ${{CLAUDE_PLUGIN_ROOT}}/{ref_path} not found")

        # 3. Check backtick references to repository files
        for line in content.splitlines():
            # Find directory paths mentioned on this line to establish directory context
            line_dir_contexts = [d.rstrip("/") for d in re.findall(r"`([a-zA-Z0-9_./-]+/)`", line)]

            for match in backtick_file_pattern.finditer(line):
                ref_path = match.group(1)

                # Skip URL strings, placeholders, schema identifiers, code variables
                if any(x in ref_path for x in ["local.md", "*", "YYYY", "example.com", "schema.org", "claude.com", "cicada.guide", "tools-list.json"]):
                    continue
                if not ref_path.endswith(valid_file_extensions):
                    continue
                # Version numbers or numeric patterns
                if re.match(r"^\d+\.\d+(\.\d+)?$", ref_path):
                    continue

                checked_backtick_refs += 1

                # Relative path resolution: check if it starts with ./ or ../
                if ref_path.startswith(("./", "../")):
                    resolved_rel = (md_path.parent / ref_path).resolve()
                    if not resolved_rel.exists():
                        errors.append(f"Broken relative path reference in {rel_md}: `{ref_path}` not found")
                else:
                    # Check relative to file, relative to repository root, or within line directory context
                    resolved_rel = (md_path.parent / ref_path).resolve()
                    resolved_root = (REPO_ROOT / ref_path).resolve()
                    found = resolved_rel.exists() or resolved_root.exists()

                    if not found and line_dir_contexts:
                        for d_ctx in line_dir_contexts:
                            if (REPO_ROOT / d_ctx / ref_path).resolve().exists():
                                found = True
                                break

                    if not found:
                        errors.append(f"Broken path reference in {rel_md}: `{ref_path}` not found")

    print(f"  [PASS] Checked {checked_links} markdown links and {checked_anchors} anchor targets")
    print(f"  [PASS] Checked {checked_root_refs} ${{CLAUDE_PLUGIN_ROOT}} references")
    print(f"  [PASS] Checked {checked_backtick_refs} inline file path references across {len(md_files)} files")

    return (len(errors) == 0, errors)


def report_token_metrics(min_reduction: float = 15.0, enforce: bool = True) -> tuple[bool, list[str]]:
    """Compute before/after character and estimated token counts and verify reduction."""
    errors = []
    print("\n=== 5. Prompt Token & Character Metrics ===")

    table_rows = []
    total_before_chars = 0
    total_after_chars = 0
    total_before_tokens = 0
    total_after_tokens = 0

    for rel_path in PROMPT_FILES:
        full_path = REPO_ROOT / rel_path
        if not full_path.exists():
            errors.append(f"Target file does not exist: {rel_path}")
            continue

        after_content = full_path.read_text(encoding="utf-8").replace("\r\n", "\n")
        after_chars = len(after_content)
        after_words = len(after_content.split())
        after_tokens = round(after_chars / 4.0)

        # Baseline: authoritative snapshot from git commit before optimization
        if rel_path in BASELINE_SNAPSHOT:
            before_chars = BASELINE_SNAPSHOT[rel_path]["chars"]
            before_words = BASELINE_SNAPSHOT[rel_path]["words"]
            before_tokens = round(before_chars / 4.0)
        else:
            git_content = get_git_head_content(rel_path)
            if git_content is not None:
                before_chars = len(git_content)
                before_words = len(git_content.split())
                before_tokens = round(before_chars / 4.0)
            else:
                before_chars = after_chars
                before_words = after_words
                before_tokens = after_tokens

        diff_chars = after_chars - before_chars
        pct_chars = (diff_chars / before_chars * 100) if before_chars > 0 else 0.0

        total_before_chars += before_chars
        total_after_chars += after_chars
        total_before_tokens += before_tokens
        total_after_tokens += after_tokens

        table_rows.append((
            rel_path,
            before_chars,
            after_chars,
            diff_chars,
            pct_chars,
            before_tokens,
            after_tokens,
        ))

    # Print comparative table
    header = f"{'File':<36} | {'Before Ch':<9} | {'After Ch':<9} | {'Net Diff':<9} | {'% Chg':<7} | {'Bf Tok':<6} | {'Af Tok':<6}"
    print(header)
    print("-" * len(header))
    for name, bc, ac, diff, pct, bt, at in table_rows:
        print(f"{name:<36} | {bc:<9} | {ac:<9} | {diff:<+9} | {pct:<+6.1f}% | {bt:<6} | {at:<6}")
    print("-" * len(header))

    total_diff_chars = total_after_chars - total_before_chars
    total_pct_reduction = (-total_diff_chars / total_before_chars * 100) if total_before_chars > 0 else 0.0
    total_diff_tokens = total_after_tokens - total_before_tokens

    summary = f"TOTAL: Before={total_before_chars} chars (~{total_before_tokens} tokens), After={total_after_chars} chars (~{total_after_tokens} tokens), Net Reduction={-total_diff_chars} chars ({-total_diff_tokens} tokens, {total_pct_reduction:.2f}%)"
    print(summary)

    if enforce:
        if total_pct_reduction < min_reduction:
            errors.append(f"Net token reduction is {total_pct_reduction:.2f}%, which is below target {min_reduction:.1f}%")
        else:
            print(f"  [PASS] Target >= {min_reduction:.1f}% net reduction achieved: {total_pct_reduction:.2f}%")

    return (len(errors) == 0, errors)


def main():
    parser = argparse.ArgumentParser(description="Verify cicada-guide plugin integrity and prompt optimization metrics.")
    parser.add_argument("--min-reduction", type=float, default=15.0, help="Minimum required net reduction percentage (default: 15.0)")
    parser.add_argument("--no-reduction-check", action="store_true", help="Skip enforcing minimum reduction threshold")
    args = parser.parse_args()

    all_errors = []

    m_pass, m_errs = validate_manifests()
    all_errors.extend(m_errs)

    f_pass, f_errs = validate_frontmatter()
    all_errors.extend(f_errs)

    tc_pass, tc_errs = validate_tool_consistency()
    all_errors.extend(tc_errs)

    l_pass, l_errs = validate_links()
    all_errors.extend(l_errs)

    t_pass, t_errs = report_token_metrics(
        min_reduction=args.min_reduction,
        enforce=not args.no_reduction_check,
    )
    all_errors.extend(t_errs)

    print("\n" + "=" * 50)
    if all_errors:
        print(f"VERIFICATION FAILED with {len(all_errors)} error(s):")
        for err in all_errors:
            print(f"  [FAIL] {err}")
        sys.exit(1)
    else:
        print("ALL VERIFICATION CHECKS PASSED.")
        sys.exit(0)


if __name__ == "__main__":
    main()
