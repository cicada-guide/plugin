#!/usr/bin/env node
// Reconciles the tool documentation against the live server's `tools/list` (CLAUDE.md: "Tool
// documentation drifts silently"). Needs network access to the endpoint in `.mcp.json`.
//
//   node scripts/check-live-tools.mjs                     # fetch tools/list from the live endpoint
//   node scripts/check-live-tools.mjs --file tools.json   # use a saved tools/list response instead
//
// Exits 1 and lists every mismatch. Runs nightly, never on a pull request: a server outage must
// not block a merge.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(ROOT, file), "utf8");
const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const PROTOCOL_VERSION = "2025-06-18";

// Documents that list every tool — reconcile each against the server, not against each other.
const TOOL_LISTS = ["README.md", "skills/state-legislation/SKILL.md", "skills/state-legislation/references/tool-reference.md"];

function walk(dir) {
  return readdirSync(join(ROOT, dir)).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(join(ROOT, path)).isDirectory() ? walk(path) : path.endsWith(".md") ? [path] : [];
  });
}

function parseRpc(body) {
  const payload = body.trimStart().startsWith("{")
    ? body
    : body.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("");
  return JSON.parse(payload);
}

async function fetchTools(endpoint) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
  };
  const post = (body, extra = {}) =>
    fetch(endpoint, { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body) });

  const init = await post({
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "plugin-docs-check", version: "0" } },
  });
  if (!init.ok) throw new Error(`initialize returned HTTP ${init.status}`);
  const session = init.headers.get("mcp-session-id");
  if (!session) throw new Error("initialize returned no mcp-session-id header");
  await init.text();

  const withSession = { "Mcp-Session-Id": session };
  await (await post({ jsonrpc: "2.0", method: "notifications/initialized" }, withSession)).text();
  const list = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, withSession);
  if (!list.ok) throw new Error(`tools/list returned HTTP ${list.status}`);
  const result = parseRpc(await list.text());

  await fetch(endpoint, { method: "DELETE", headers: { ...headers, ...withSession } }).catch(() => {});
  return result;
}

const fileArg = process.argv.indexOf("--file");
const endpoint = Object.values(JSON.parse(read(".mcp.json")).mcpServers)[0].url;
let response;
try {
  response = fileArg > 0 ? JSON.parse(readFileSync(process.argv[fileArg + 1], "utf8")) : await fetchTools(endpoint);
} catch (error) {
  console.error(`Could not read tools/list from ${fileArg > 0 ? process.argv[fileArg + 1] : endpoint}: ${error.message}`);
  process.exit(2);
}

const tools = new Map((response.result?.tools ?? response.tools ?? []).map((t) => [t.name, t]));
if (!tools.size) {
  console.error("tools/list returned no tools");
  process.exit(2);
}
const params = (name) => new Set(Object.keys(tools.get(name)?.inputSchema?.properties ?? {}));

const failures = [];
const fail = (file, line, message) => failures.push(`${relative(ROOT, join(ROOT, file))}${line ? `:${line}` : ""}: ${message}`);
const docFiles = [...walk("skills"), ...walk("agents"), "README.md"];

// 1. Every live tool appears in each document that lists the tools.
for (const file of TOOL_LISTS) {
  const text = read(file);
  for (const name of tools.keys()) {
    if (!text.includes(`\`${name}\``)) fail(file, 0, `live tool \`${name}\` is not documented here`);
  }
}

// 2. No document names a tool the server does not have.
const TOOL_SHAPE = /`((?:get|search|list|show|open|read)_[a-z_]+)`/g;
for (const file of docFiles) {
  const text = read(file);
  for (const m of text.matchAll(TOOL_SHAPE)) {
    if (!tools.has(m[1])) fail(file, lineOf(text, m.index), `\`${m[1]}\` is not a tool on the live server`);
  }
}

// 3. Call examples pass only parameters the tool's schema declares (schemas reject unknown keys).
for (const file of docFiles) {
  const text = read(file);
  for (const m of text.matchAll(/"tool":\s*"(\w+)",\s*"arguments":\s*\{([^}]*)\}/g)) {
    if (!tools.has(m[1])) continue; // reported by check 2 when backticked; skip unknown example tools
    const allowed = params(m[1]);
    for (const key of m[2].matchAll(/"(\w+)"\s*:/g)) {
      if (!allowed.has(key[1])) fail(file, lineOf(text, m.index), `example passes \`${key[1]}\` to \`${m[1]}\`, which its schema does not declare`);
    }
  }
}

// 4. Parameter tables under each tool's heading in the tool reference list only declared parameters.
{
  const file = "skills/state-legislation/references/tool-reference.md";
  const lines = read(file).split("\n");
  let tool = null;
  let inTable = false;
  lines.forEach((line, i) => {
    const heading = line.match(/^###\s+`(\w+)`/);
    if (heading) [tool, inTable] = [tools.has(heading[1]) ? heading[1] : null, false];
    else if (/^#{1,3}\s/.test(line)) [tool, inTable] = [null, false];
    else if (/^\|\s*Parameter\s*\|/.test(line)) inTable = tool !== null;
    else if (!line.startsWith("|")) inTable = false;
    else if (inTable) {
      const param = line.match(/^\|\s*`(\w+)`/);
      if (param && !params(tool).has(param[1])) fail(file, i + 1, `\`${tool}\` has no \`${param[1]}\` parameter on the live server`);
    }
  });
}

if (failures.length) {
  console.error(`${failures.length} mismatch(es) with the live tools/list (${tools.size} tools):\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`Documentation matches the live tools/list (${tools.size} tools).`);
