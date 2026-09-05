#!/usr/bin/env node
"use strict";

/**
 * MCP (Model Context Protocol) server exposing cicada.guide as tools that
 * Claude Desktop (or any other MCP-compatible client) can call.
 *
 * Configure a client (e.g. Claude Desktop's `claude_desktop_config.json`) to
 * run this file over stdio. See the README for setup instructions and for
 * how to point it at a cicada.guide API deployment via environment
 * variables (`CICADA_GUIDE_API_URL`, `CICADA_GUIDE_API_KEY`).
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const { CicadaGuideClient } = require("../client.js");

function createServer(client = new CicadaGuideClient()) {
  const server = new McpServer({
    name: "cicada-guide",
    version: "0.1.0",
  });

  server.registerTool(
    "search_meetings",
    {
      title: "Search cicada.guide meetings",
      description:
        "Search cicada.guide's indexed civic and legislative meetings " +
        "(\"Ask the corpus\"). Returns an AI summary plus " +
        "speaker-attributed, timestamped result clips with confidence " +
        "scores and related bills.",
      inputSchema: {
        query: z.string().describe("Plain-English search query"),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("Maximum number of results to return"),
      },
    },
    async ({ query, limit }) => {
      const result = await client.searchMeetings(query, { limit });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.registerTool(
    "get_meeting",
    {
      title: "Read a cicada.guide meeting",
      description:
        "Fetch a single indexed meeting, including its transcript " +
        "segments, speakers, and timestamps.",
      inputSchema: {
        meetingId: z.string().describe("The cicada.guide meeting id"),
      },
    },
    async ({ meetingId }) => {
      const result = await client.getMeeting(meetingId);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.registerTool(
    "get_member",
    {
      title: "Get a cicada.guide member profile",
      description:
        "Fetch an elected official's profile, including appearance " +
        "stats and floor-vs-committee consistency by topic.",
      inputSchema: {
        memberId: z.string().describe("The cicada.guide member id"),
      },
    },
    async ({ memberId }) => {
      const result = await client.getMember(memberId);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.registerTool(
    "get_bill",
    {
      title: "Get a cicada.guide bill",
      description: "Fetch a single bill or resolution by id.",
      inputSchema: {
        billId: z.string().describe("The cicada.guide bill id"),
      },
    },
    async ({ billId }) => {
      const result = await client.getBill(billId);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.registerTool(
    "list_bodies",
    {
      title: "List cicada.guide governing bodies",
      description:
        "List the governing bodies and sessions available in the corpus.",
      inputSchema: {},
    },
    async () => {
      const result = await client.listBodies();
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Failed to start cicada.guide MCP server:", error);
    process.exit(1);
  });
}

module.exports = { createServer };
