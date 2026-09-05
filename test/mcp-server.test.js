"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  InMemoryTransport,
} = require("@modelcontextprotocol/sdk/inMemory.js");
const { createServer } = require("../src/mcp/server.js");
const { CicadaGuideClient } = require("../src/client.js");

async function connectedClient(cicadaClient) {
  const server = createServer(cicadaClient);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, server };
}

test("registers the expected cicada.guide tools", async () => {
  const cicadaClient = new CicadaGuideClient({
    baseUrl: "https://example.test",
    fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
  });
  const { client, server } = await connectedClient(cicadaClient);

  try {
    const { tools } = await client.listTools();
    const toolNames = tools.map((tool) => tool.name).sort();
    assert.deepEqual(toolNames, [
      "get_bill",
      "get_meeting",
      "get_member",
      "list_bodies",
      "search_meetings",
    ]);
  } finally {
    await client.close();
    await server.close();
  }
});

test("search_meetings tool calls the cicada.guide client and returns JSON", async () => {
  let receivedUrl;
  const cicadaClient = new CicadaGuideClient({
    baseUrl: "https://example.test",
    fetchImpl: async (url) => {
      receivedUrl = url;
      return {
        ok: true,
        json: async () => ({ query: "budget", results: [] }),
      };
    },
  });
  const { client, server } = await connectedClient(cicadaClient);

  try {
    const result = await client.callTool({
      name: "search_meetings",
      arguments: { query: "budget", limit: 3 },
    });

    assert.equal(receivedUrl, "https://example.test/search?q=budget&limit=3");
    assert.equal(result.isError, undefined);
    assert.deepEqual(JSON.parse(result.content[0].text), {
      query: "budget",
      results: [],
    });
  } finally {
    await client.close();
    await server.close();
  }
});
