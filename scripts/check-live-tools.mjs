#!/usr/bin/env node
// Reconciles the tool documentation against the live server's `tools/list` (CLAUDE.md: "Tool
// documentation drifts silently"), and checks that every card resource, and the version before it,
// still reads. Needs network access to the endpoint in `.mcp.json`.
//
//   node scripts/check-live-tools.mjs                     # fetch tools/list from the live endpoint
//   node scripts/check-live-tools.mjs --file tools.json   # use a saved tools/list response instead
//   node scripts/check-live-tools.mjs --endpoint <url>    # a different endpoint, e.g. a local mock
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
const TOOL_LISTS = ["README.md", "skills/get-legislation/SKILL.md", "skills/get-legislation/references/tool-reference.md"];

function walk(dir) {
  return readdirSync(join(ROOT, dir)).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(join(ROOT, path)).isDirectory() ? walk(path) : path.endsWith(".md") ? [path] : [];
  });
}

// A JSON body is one message. An SSE body can carry several events (a notification before the
// result), each on its own `data:` line(s); return the one answering `id`.
function parseRpc(body, id) {
  if (body.trimStart().startsWith("{")) return JSON.parse(body);
  const messages = body
    .split(/\r?\n\r?\n/)
    .map((event) => event.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).replace(/^ /, "")).join("\n"))
    .filter(Boolean)
    .map((data) => JSON.parse(data));
  const answer = messages.find((m) => m.id === id);
  if (!answer) throw new Error(`no response with id ${id} among ${messages.length} event(s)`);
  return answer;
}

// A hung endpoint must fail the run, not hold the job until the runner's own timeout.
const REQUEST_TIMEOUT_MS = 30_000;

// Something in front of the Worker (a proxy, a WAF rule) can refuse a request the Worker never
// sees, so a failure reports enough of the response to tell who answered.
async function describe(response) {
  const headers = ["server", "cf-ray", "cf-mitigated", "content-type"]
    .map((h) => response.headers.get(h) && `${h}: ${response.headers.get(h)}`)
    .filter(Boolean);
  const body = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 300);
  return `HTTP ${response.status}${headers.length ? ` (${headers.join("; ")})` : ""}${body ? ` — ${body}` : ""}`;
}

const headers = {
  "User-Agent": "cicada-guide-plugin-live-tools (+https://github.com/cicada-guide/plugin)",
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  "MCP-Protocol-Version": PROTOCOL_VERSION,
};
const postTo = (endpoint, body, extra = {}) =>
  fetch(endpoint, {
    method: "POST",
    headers: { ...headers, ...extra },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

// The server is stateless, so a resources/read needs no initialize first.
async function readResource(endpoint, uri) {
  const response = await postTo(endpoint, { jsonrpc: "2.0", id: 3, method: "resources/read", params: { uri } });
  if (!response.ok) throw new Error(`resources/read returned ${await describe(response)}`);
  return parseRpc(await response.text(), 3);
}

async function fetchTools(endpoint) {
  const post = (body, extra = {}) => postTo(endpoint, body, extra);

  const init = await post({
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "plugin-docs-check", version: "0" } },
  });
  if (!init.ok) throw new Error(`initialize returned ${await describe(init)}`);
  // The server is stateless and issues no session id. Echo one if it ever
  // does again, so this check works against either kind of server.
  const session = init.headers.get("mcp-session-id");
  await init.text();

  const withSession = session ? { "Mcp-Session-Id": session } : {};
  await (await post({ jsonrpc: "2.0", method: "notifications/initialized" }, withSession)).text();
  const list = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, withSession);
  if (!list.ok) throw new Error(`tools/list returned ${await describe(list)}`);
  const result = parseRpc(await list.text(), 2);

  // Only a session has anything to terminate; a stateless server answers 405.
  if (session) {
    await fetch(endpoint, {
      method: "DELETE",
      headers: { ...headers, ...withSession },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch(() => {});
  }
  return result;
}

const fileArg = process.argv.indexOf("--file");
const endpointArg = process.argv.indexOf("--endpoint");
const endpoint = endpointArg > 0
  ? process.argv[endpointArg + 1]
  : Object.values(JSON.parse(read(".mcp.json")).mcpServers)[0].url;
let response;
try {
  response = fileArg > 0 ? JSON.parse(readFileSync(process.argv[fileArg + 1], "utf8")) : await fetchTools(endpoint);
} catch (error) {
  console.error(`Could not read tools/list from ${fileArg > 0 ? process.argv[fileArg + 1] : endpoint}: ${error.message}`);
  process.exit(2);
}

// A JSON-RPC error is the server's answer, not an empty tool list; report what it said.
if (response.error) {
  console.error(`tools/list returned JSON-RPC error ${response.error.code}: ${response.error.message}`);
  process.exit(2);
}
// Tool names come from the server and are printed into the Actions log, where a line starting with
// `::` is a workflow command. Anything that is not a plain tool identifier is refused outright.
const listed = (response.result?.tools ?? response.tools ?? []).filter((t) => t && typeof t === "object");
const malformed = listed.filter((t) => typeof t.name !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(t.name));
if (malformed.length) {
  console.error(`tools/list returned ${malformed.length} tool(s) with a malformed name`);
  process.exit(2);
}
const tools = new Map(listed.map((t) => [t.name, t]));
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
  const file = "skills/get-legislation/references/tool-reference.md";
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

// 5. Every card URI the docs name is one a live tool links in `_meta.ui.resourceUri`.
const cardUris = new Set([...tools.values()].map((t) => t._meta?.ui?.resourceUri).filter((u) => typeof u === "string"));
for (const file of [...docFiles, ...walk("docs")]) {
  const text = read(file);
  for (const m of text.matchAll(/ui:\/\/cicada-guide\/[a-z0-9-]+\.html/g)) {
    if (!cardUris.has(m[0])) fail(file, lineOf(text, m.index), `\`${m[0]}\` is not a card URI the live tools link`);
  }
}

// 6. Live runs only: every card resource reads, and so does the version before it. A host that
// fetched tools/list before a release still asks for the older URI, and a "not found" leaves the
// card blank (cicada-guide/mcp-anthropic#60).
if (fileArg < 0) {
  for (const uri of cardUris) {
    const version = Number(uri.match(/-v(\d+)\.html$/)?.[1]);
    const uris = version > 1 ? [uri, uri.replace(/-v\d+\.html$/, `-v${version - 1}.html`)] : [uri];
    for (const u of uris) {
      try {
        const answer = await readResource(endpoint, u);
        const html = answer.result?.contents?.[0]?.text;
        if (answer.error || typeof html !== "string" || !/^<!doctype html>/i.test(html)) {
          fail("(live server)", 0, `resources/read ${u} returned ${answer.error ? `error ${answer.error.code}: ${answer.error.message}` : "no card HTML"}`);
        }
      } catch (error) {
        fail("(live server)", 0, `resources/read ${u} failed: ${error.message}`);
      }
    }
  }
}

if (failures.length) {
  console.error(`${failures.length} mismatch(es) with the live tools/list (${tools.size} tools):\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`Documentation matches the live tools/list (${tools.size} tools).`);
