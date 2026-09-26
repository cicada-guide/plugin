#!/usr/bin/env python3
"""
Unit and regression test suite for scripts/verify.py.

Tests:
1. Manifest validation (syntax, required fields, semver, 4-way version synchronization).
2. Frontmatter parsing (YAML validity, required fields, stem/folder name matching).
3. Tool consistency across SKILL.md, tool-reference.md, and README.md.
4. Link and reference resolution (slugification, anchor verification, template skipping, line directory context).
5. Token metrics reporting and threshold enforcement.
"""

import os
import sys
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Add scripts directory to sys.path
SCRIPTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPTS_DIR.parent
sys.path.insert(0, str(SCRIPTS_DIR))

import verify


class TestManifestValidation(unittest.TestCase):
    def test_live_manifests_pass(self):
        """Current repository manifests must validate cleanly."""
        passed, errors = verify.validate_manifests()
        self.assertTrue(passed, f"Live manifests failed: {errors}")
        self.assertEqual(errors, [])

    def test_missing_plugin_json(self):
        """Missing plugin.json must be caught."""
        with patch.object(verify, "REPO_ROOT", Path(tempfile.mkdtemp())):
            passed, errors = verify.validate_manifests()
            self.assertFalse(passed)
            self.assertTrue(any("plugin.json does not exist" in e for e in errors))

    def test_version_mismatch(self):
        """Manifest version divergence across the 4 fields must be caught."""
        temp_dir = Path(tempfile.mkdtemp())
        claude_dir = temp_dir / ".claude-plugin"
        codex_dir = temp_dir / ".codex-plugin"
        claude_dir.mkdir()
        codex_dir.mkdir()

        # plugin.json with 0.3.0
        (claude_dir / "plugin.json").write_text(json.dumps({
            "name": "cicada-guide", "version": "0.3.0", "description": "desc",
            "author": {"name": "Author"}, "license": "Apache-2.0"
        }), encoding="utf-8")

        # marketplace.json with 0.3.1 (mismatch)
        (claude_dir / "marketplace.json").write_text(json.dumps({
            "$schema": "https://code.claude.com/schemas/marketplace.json",
            "name": "cicada-guide",
            "metadata": {"version": "0.3.1", "description": "desc"},
            "plugins": [{"name": "cicada-guide", "source": "./", "description": "d", "version": "0.3.1"}]
        }), encoding="utf-8")

        # codex plugin.json with 0.3.0
        (codex_dir / "plugin.json").write_text(json.dumps({
            "name": "cicada-guide", "version": "0.3.0", "description": "desc",
            "author": {"name": "Author", "email": "a@b.com"},
            "skills": "./skills/", "mcpServers": "./.mcp.json",
            "interface": {"logo": "./logo.svg"}
        }), encoding="utf-8")

        (temp_dir / ".mcp.json").write_text(json.dumps({
            "mcpServers": {"guide-public": {"type": "http", "url": "https://public.cicada.guide/mcp"}}
        }), encoding="utf-8")

        with patch.object(verify, "REPO_ROOT", temp_dir):
            passed, errors = verify.validate_manifests()
            self.assertFalse(passed)
            self.assertTrue(any("Version mismatch across manifests" in e for e in errors))


class TestFrontmatterValidation(unittest.TestCase):
    def test_live_frontmatter_passes(self):
        """Current agents and skills must pass frontmatter validation."""
        passed, errors = verify.validate_frontmatter()
        self.assertTrue(passed, f"Frontmatter failed: {errors}")
        self.assertEqual(errors, [])

    def test_yaml_syntax_error_detection(self):
        """Invalid YAML with unquoted colons inside strings must fail."""
        temp_dir = Path(tempfile.mkdtemp())
        skills_dir = temp_dir / "skills" / "my-skill"
        skills_dir.mkdir(parents=True)
        # Unquoted colon in description
        bad_yaml = "---\nname: my-skill\ndescription: Unquoted colon: causes mapping syntax error\n---\n# Body"
        (skills_dir / "SKILL.md").write_text(bad_yaml, encoding="utf-8")

        with patch.object(verify, "REPO_ROOT", temp_dir):
            passed, errors = verify.validate_frontmatter()
            if verify.HAVE_YAML:
                self.assertFalse(passed)
                self.assertTrue(any("invalid YAML frontmatter" in e for e in errors))

    def test_mismatched_agent_name(self):
        """Agent name diverging from file stem must fail."""
        temp_dir = Path(tempfile.mkdtemp())
        agents_dir = temp_dir / "agents"
        agents_dir.mkdir()
        bad_agent = "---\nname: different-name\ndescription: valid\nmodel: inherit\n---\n# Body"
        (agents_dir / "my-agent.md").write_text(bad_agent, encoding="utf-8")

        with patch.object(verify, "REPO_ROOT", temp_dir):
            passed, errors = verify.validate_frontmatter()
            self.assertFalse(passed)
            self.assertTrue(any("name 'different-name' != filename stem 'my-agent'" in e for e in errors))


class TestToolConsistency(unittest.TestCase):
    def test_live_tool_consistency(self):
        """All 17 MCP tools must match across SKILL.md, tool-reference.md, and README.md."""
        passed, errors = verify.validate_tool_consistency()
        self.assertTrue(passed, f"Tool consistency failed: {errors}")
        self.assertEqual(errors, [])

    def test_tool_count_is_17(self):
        """Verify the exact tool count is 17."""
        skill_text = (REPO_ROOT / "skills" / "state-legislation" / "SKILL.md").read_text(encoding="utf-8")
        tools = set(verify.re.findall(r"\|\s*`([a-z_]+)`\s*\|", skill_text))
        self.assertEqual(len(tools), 17)


class TestLinkValidation(unittest.TestCase):
    def test_live_links_pass(self):
        """Current repository markdown files must contain zero broken links or paths."""
        passed, errors = verify.validate_links()
        self.assertTrue(passed, f"Link validation failed: {errors}")
        self.assertEqual(errors, [])

    def test_slugify_heading_variations(self):
        """Slugs must support both underscore preservation (GitHub style) and hyphenation."""
        slug1, slug2 = verify.slugify_heading("### `search_bills`")
        self.assertEqual(slug1, "search_bills")
        self.assertEqual(slug2, "search-bills")

        slug_spaces1, slug_spaces2 = verify.slugify_heading("## Project Settings")
        self.assertEqual(slug_spaces1, "project-settings")
        self.assertEqual(slug_spaces2, "project-settings")

    def test_template_skipping_in_root_refs(self):
        """Illustrative templates like ${CLAUDE_PLUGIN_ROOT}/skills/... must not trigger broken path errors."""
        temp_dir = Path(tempfile.mkdtemp())
        test_file = temp_dir / "test.md"
        test_file.write_text("See `${CLAUDE_PLUGIN_ROOT}/skills/...` for reference.", encoding="utf-8")

        with patch.object(verify, "REPO_ROOT", temp_dir):
            passed, errors = verify.validate_links()
            self.assertTrue(passed, f"Unexpected error on template ref: {errors}")


class TestTokenMetrics(unittest.TestCase):
    def test_reduction_meets_target(self):
        """Token optimization must achieve >= 15% net reduction."""
        passed, errors = verify.report_token_metrics(min_reduction=15.0, enforce=True)
        self.assertTrue(passed, f"Reduction failed: {errors}")
        self.assertEqual(errors, [])

    def test_threshold_enforcement(self):
        """Setting an unreachable threshold must cleanly fail when enforced."""
        passed, errors = verify.report_token_metrics(min_reduction=90.0, enforce=True)
        self.assertFalse(passed)
        self.assertTrue(any("below target 90.0%" in e for e in errors))

    def test_bypass_enforcement(self):
        """enforce=False must pass even if reduction is below threshold."""
        passed, errors = verify.report_token_metrics(min_reduction=90.0, enforce=False)
        self.assertTrue(passed)
        self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
