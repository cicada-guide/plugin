"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CicadaGuideClient, CicadaGuideApiError } = require("../src/client.js");

function makeFetch(handler) {
  return async (url, init) => handler(url, init);
}

test("uses default base URL when none is configured", () => {
  const client = new CicadaGuideClient({ fetchImpl: async () => {} });
  assert.equal(client.baseUrl, "https://api.cicada.guide/v1");
});

test("strips trailing slashes from a configured base URL", () => {
  const client = new CicadaGuideClient({
    baseUrl: "https://example.test/api/",
    fetchImpl: async () => {},
  });
  assert.equal(client.baseUrl, "https://example.test/api");
});

test("searchMeetings sends the query and optional limit as query params", async () => {
  let requestedUrl;
  const client = new CicadaGuideClient({
    baseUrl: "https://example.test",
    fetchImpl: makeFetch(async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({ query: "school funding", results: [] }),
      };
    }),
  });

  const result = await client.searchMeetings("school funding", { limit: 5 });

  assert.equal(
    requestedUrl,
    "https://example.test/search?q=school+funding&limit=5"
  );
  assert.deepEqual(result, { query: "school funding", results: [] });
});

test("searchMeetings rejects an empty query", async () => {
  const client = new CicadaGuideClient({ fetchImpl: async () => {} });
  await assert.rejects(() => client.searchMeetings("   "), TypeError);
});

test("sends an Authorization header when an API key is configured", async () => {
  let receivedHeaders;
  const client = new CicadaGuideClient({
    baseUrl: "https://example.test",
    apiKey: "test-key",
    fetchImpl: makeFetch(async (url, init) => {
      receivedHeaders = init.headers;
      return { ok: true, json: async () => ({}) };
    }),
  });

  await client.listBodies();

  assert.equal(receivedHeaders.Authorization, ["Bearer", "test-key"].join(" "));
});

test("getMeeting encodes the meeting id and fetches the right path", async () => {
  let requestedUrl;
  const client = new CicadaGuideClient({
    baseUrl: "https://example.test",
    fetchImpl: makeFetch(async (url) => {
      requestedUrl = url;
      return { ok: true, json: async () => ({ id: "abc/123" }) };
    }),
  });

  await client.getMeeting("abc/123");

  assert.equal(requestedUrl, "https://example.test/meetings/abc%2F123");
});

test("each id-based lookup requires an id", async () => {
  const client = new CicadaGuideClient({ fetchImpl: async () => {} });
  await assert.rejects(() => client.getMeeting(), TypeError);
  await assert.rejects(() => client.getMember(), TypeError);
  await assert.rejects(() => client.getBill(), TypeError);
});

test("throws a CicadaGuideApiError on a non-OK response", async () => {
  const client = new CicadaGuideClient({
    baseUrl: "https://example.test",
    fetchImpl: makeFetch(async () => ({ ok: false, status: 404 })),
  });

  await assert.rejects(() => client.getBill("hb-1"), (error) => {
    assert.ok(error instanceof CicadaGuideApiError);
    assert.equal(error.status, 404);
    return true;
  });
});

test("throws when no fetch implementation is available", () => {
  const originalFetch = globalThis.fetch;
  // eslint-disable-next-line no-global-assign
  globalThis.fetch = undefined;
  try {
    assert.throws(
      () => new CicadaGuideClient({ baseUrl: "https://example.test" }),
      TypeError
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
