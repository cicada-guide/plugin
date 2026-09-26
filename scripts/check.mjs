#!/usr/bin/env node
// Offline checks for the invariants in CLAUDE.md. No dependencies, no network.
// Run from anywhere: `node scripts/check.mjs`. Exits 1 and lists every failure.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The endpoint is a published API surface (CLAUDE.md). Changing it breaks every installed user, so
// it moves only with a version bump and a transition period — edit this constant deliberately.
const ENDPOINT = "https://public.cicada.guide/mcp";
const SERVER_KEY = "guide-public";
const PLUGIN_NAME = "cicada-guide";

const failures = [];
const fail = (file, line, message) =>
  failures.push(`${relative(ROOT, join(ROOT, file))}${line ? `:${line}` : ""}: ${message}`);

const read = (file) => readFileSync(join(ROOT, file), "utf8");
const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const flat = (text) => text.replace(/\s+/g, " ");

function walk(dir, predicate) {
  const out = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const path = join(dir, entry);
    if (statSync(join(ROOT, path)).isDirectory()) out.push(...walk(path, predicate));
    else if (predicate(path)) out.push(path);
  }
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(read(file));
  } catch (error) {
    fail(file, 0, `does not parse as JSON: ${error.message}`);
    return null;
  }
}

const skillFiles = readdirSync(join(ROOT, "skills")).map((d) => `skills/${d}/SKILL.md`);
const agentFiles = walk("agents", (p) => p.endsWith(".md"));
const entryPoints = [...skillFiles, ...agentFiles];
const docFiles = [...walk("skills", (p) => p.endsWith(".md")), ...agentFiles, "README.md"];
const allMarkdown = [
  ...docFiles,
  ...["CLAUDE.md", "PUBLISHING.md", "cicada-guide.local.md.example"].filter((f) => existsSync(join(ROOT, f))),
];

// ── Manifests ────────────────────────────────────────────────────────────────────────────────────

const claude = readJson(".claude-plugin/plugin.json");
const marketplace = readJson(".claude-plugin/marketplace.json");
const codex = readJson(".codex-plugin/plugin.json");
const mcp = readJson(".mcp.json");

if (claude && marketplace && codex) {
  const versions = {
    ".claude-plugin/plugin.json version": claude.version,
    ".codex-plugin/plugin.json version": codex.version,
    ".claude-plugin/marketplace.json metadata.version": marketplace.metadata?.version,
    ".claude-plugin/marketplace.json plugins[0].version": marketplace.plugins?.[0]?.version,
  };
  if (new Set(Object.values(versions)).size !== 1) {
    fail(".claude-plugin/marketplace.json", 0, `the four version fields disagree: ${JSON.stringify(versions)}`);
  }
  for (const [file, name] of [
    [".claude-plugin/plugin.json", claude.name],
    [".codex-plugin/plugin.json", codex.name],
    [".claude-plugin/marketplace.json", marketplace.plugins?.[0]?.name],
  ]) {
    if (name !== PLUGIN_NAME) fail(file, 0, `plugin name is ${JSON.stringify(name)}, expected "${PLUGIN_NAME}"`);
  }
  if (marketplace.plugins?.[0]?.source !== "./") {
    fail(".claude-plugin/marketplace.json", 0, 'plugins[0].source must be "./" — the repo root is the plugin');
  }
  for (const key of ["skills", "mcpServers"]) {
    if (codex[key] && !existsSync(join(ROOT, codex[key]))) {
      fail(".codex-plugin/plugin.json", 0, `${key} points at ${codex[key]}, which does not exist`);
    }
  }
  if (codex.interface?.logo && !existsSync(join(ROOT, codex.interface.logo))) {
    fail(".codex-plugin/plugin.json", 0, `interface.logo points at ${codex.interface.logo}, which does not exist`);
  }
}

if (mcp) {
  const servers = Object.keys(mcp.mcpServers ?? {});
  if (servers.length !== 1 || servers[0] !== SERVER_KEY) {
    fail(".mcp.json", 0, `expected exactly one server, "${SERVER_KEY}"; found ${JSON.stringify(servers)}`);
  }
  const url = mcp.mcpServers?.[SERVER_KEY]?.url;
  if (url !== ENDPOINT) {
    fail(".mcp.json", 0, `endpoint is ${url}; the pinned endpoint is ${ENDPOINT} (see CLAUDE.md before changing it)`);
  }
}

// ── Frontmatter ──────────────────────────────────────────────────────────────────────────────────

for (const file of entryPoints) {
  const text = read(file);
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    fail(file, 1, "missing YAML frontmatter");
    continue;
  }
  const fields = {};
  let lastKey = null;
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^([a-z-]+):\s*(.*)$/);
    if (kv) [lastKey, fields[kv[1]]] = [kv[1], kv[2]];
    else if (lastKey === "description" && line.trim()) fields.descriptionWraps = true;
  }
  const expected = file.startsWith("skills/") ? file.split("/")[1] : file.split("/").pop().replace(/\.md$/, "");
  if (fields.name !== expected) fail(file, 2, `frontmatter name is "${fields.name}", expected "${expected}"`);
  if (!fields.description) fail(file, 3, "frontmatter description is missing or empty");
  if (fields.descriptionWraps) fail(file, 3, "frontmatter description must stay on one line");
}

// ── Links ────────────────────────────────────────────────────────────────────────────────────────

for (const file of docFiles) {
  const text = read(file);
  const withinStateLegislation = file.startsWith("skills/state-legislation/");
  if (!withinStateLegislation) {
    for (const m of text.matchAll(/\.\.\//g)) {
      fail(file, lineOf(text, m.index), "relative ../ path — use ${CLAUDE_PLUGIN_ROOT}/...; a subagent runs in the user's project");
    }
  }
  for (const m of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s`)'"]+)/g)) {
    if (!existsSync(join(ROOT, m[1]))) fail(file, lineOf(text, m.index), `\${CLAUDE_PLUGIN_ROOT}/${m[1]} does not exist`);
  }
}

for (const file of allMarkdown) {
  const text = read(file);
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1].split("#")[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    if (!existsSync(join(ROOT, dirname(file), target))) fail(file, lineOf(text, m.index), `link target ${m[1]} does not exist`);
  }
}

// ── Tool names and prose ─────────────────────────────────────────────────────────────────────────

// CLAUDE.md and PUBLISHING.md quote the broken form on purpose, so only runtime files are checked.
for (const file of docFiles) {
  const text = read(file);
  for (const m of text.matchAll(/mcp__plugin_cicada-guide_([\w-]*)/g)) {
    if (!m[1].startsWith(`${SERVER_KEY}__`)) {
      fail(file, lineOf(text, m.index), `tool name ${m[0]} lacks the mandatory "${SERVER_KEY}" server segment`);
    }
  }
}

for (const file of docFiles) {
  const text = read(file);
  for (const m of text.matchAll(/\b\d+ (?:MCP )?tools\b/g)) {
    fail(file, lineOf(text, m.index), `tool count "${m[0]}" in prose goes stale; describe the tools instead`);
  }
}

// The repo is public and does not critique the dataset's quality (CLAUDE.md, Product constraints).
const CRITIQUE = /duplicat|unreliab|coverage gap|coverage varies|stored without (?:its|their) bill|may be missing|missing roll call/gi;
for (const file of [...docFiles, ".codex-plugin/plugin.json"]) {
  const text = read(file);
  for (const m of text.matchAll(CRITIQUE)) {
    fail(file, lineOf(text, m.index), `"${m[0]}" critiques the dataset's quality; describe what the tools return instead`);
  }
}

// ── Dataset rules restated in every entry point ──────────────────────────────────────────────────

// Every stated number must match the server's value, wherever it appears.
const CANONICAL = [
  { pattern: /at most (\d+) distinct bill/g, value: "50", rule: "search_bills full-text bill cap" },
  { pattern: /first (\d+) terms/g, value: "8", rule: "search_bills ILIKE term cap" },
  { pattern: /(\d+) document rows/g, value: "200", rule: "search_bills full-text row cap" },
  { pattern: /rate limited to (\d+) a minute/g, value: "60", rule: "rate limit" },
  { pattern: /Retry in (\d+) seconds/g, value: "60", rule: "rate-limit retry window" },
  { pattern: /batches of (?:up to |at most )(\d+)/g, value: "100", rule: "search_people ids batch cap" },
  { pattern: /truncat\w* at ([\d,]+)|([\d,]+)(?:-| )character truncation|truncates? at ([\d,]+)/g, value: "25,000", rule: "truncation" },
];
for (const file of docFiles) {
  const text = flat(read(file));
  const original = read(file);
  for (const { pattern, value, rule } of CANONICAL) {
    for (const m of text.matchAll(pattern)) {
      const found = m.slice(1).find(Boolean);
      if (found !== value) {
        const loose = new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"));
        const at = original.search(loose);
        fail(file, at >= 0 ? lineOf(original, at) : 0, `${rule} stated as ${found}, the server's value is ${value}`);
      }
    }
  }
}

// Each entry point that relies on a rule carries its own copy (CLAUDE.md, Invariants).
const REQUIRED = [
  {
    rule: "rate limit",
    when: () => true,
    needs: [/rate limited to 60 a minute/, /Retry in 60 seconds/],
  },
  {
    rule: "never add counts across roll calls",
    when: (t) => t.includes("`get_rollcalls`"),
    needs: [/never add counts across roll calls/i],
  },
  {
    rule: "search_people ids batch cap of 100",
    when: (t) => /`search_people`[^.]*`ids`|`ids`[^.]*`search_people`/.test(t),
    needs: [/(?:batches of (?:up to|at most) 100|1-100|up to 100)/],
  },
  {
    rule: "search_bills query caps",
    when: (t) => t.includes("`search_bills`") && t.includes("`query`"),
    needs: [/at most 50 distinct bill/, /first 8 terms/],
  },
  {
    rule: "25,000-character truncation",
    when: (t) => /(?:output|markdown|text|response)[^.]{0,40}truncat/i.test(t),
    needs: [/25,000/],
  },
  {
    rule: "both error shapes",
    when: (t) => t.includes("-32602"),
    needs: [/`Error:`/],
  },
];
for (const file of entryPoints) {
  const text = flat(read(file));
  for (const { rule, when, needs } of REQUIRED) {
    if (!when(text)) continue;
    for (const need of needs) {
      if (!need.test(text)) fail(file, 0, `relies on the ${rule} rule but does not state it (missing ${need})`);
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────────────────────────

if (failures.length) {
  console.error(`${failures.length} check(s) failed:\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`All checks passed (${entryPoints.length} entry points, ${allMarkdown.length} Markdown files).`);
