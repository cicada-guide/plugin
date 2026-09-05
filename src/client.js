"use strict";

/**
 * A thin HTTP client for the cicada.guide API.
 *
 * cicada.guide indexes civic and legislative meetings (e.g. "The Alabama
 * Channel") and exposes search, meeting, member, and bill lookups. This
 * client is intentionally small and dependency-free (it relies on the
 * global `fetch` available in Node.js 18+) so it can be shared by both the
 * MCP server (for Claude) and any HTTP surface (for ChatGPT).
 *
 * The base URL and API key are configurable because cicada.guide's public
 * API endpoint may change; see the README for configuration details.
 */

const DEFAULT_BASE_URL = "https://api.cicada.guide/v1";

class CicadaGuideApiError extends Error {
  constructor(message, { status, url } = {}) {
    super(message);
    this.name = "CicadaGuideApiError";
    this.status = status;
    this.url = url;
  }
}

class CicadaGuideClient {
  /**
   * @param {object} [options]
   * @param {string} [options.baseUrl] Base URL of the cicada.guide API.
   *   Defaults to `CICADA_GUIDE_API_URL` env var, then a public default.
   * @param {string} [options.apiKey] API key/token sent in the
   *   `Authorization` request header. Defaults to the
   *   `CICADA_GUIDE_API_KEY` env var.
   * @param {typeof fetch} [options.fetchImpl] Fetch implementation, mainly
   *   for tests.
   */
  constructor(options = {}) {
    this.baseUrl = (
      options.baseUrl ||
      process.env.CICADA_GUIDE_API_URL ||
      DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
    this.apiKey = options.apiKey || process.env.CICADA_GUIDE_API_KEY || null;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;

    if (typeof this.fetchImpl !== "function") {
      throw new TypeError(
        "No fetch implementation available. Use Node.js 18+ or pass options.fetchImpl."
      );
    }
  }

  async _request(path, { searchParams } = {}) {
    const url = new URL(this.baseUrl + path);
    if (searchParams) {
      for (const [key, value] of Object.entries(searchParams)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers = { Accept: "application/json" };
    if (this.apiKey) {
      headers.Authorization = "Bearer " + this.apiKey;
    }

    const response = await this.fetchImpl(url.toString(), { headers });
    if (!response.ok) {
      throw new CicadaGuideApiError(
        `cicada.guide API request to ${url.pathname} failed with status ${response.status}`,
        { status: response.status, url: url.toString() }
      );
    }
    return response.json();
  }

  /**
   * "Ask the corpus": plain-English search over indexed meetings.
   * @param {string} query
   * @param {object} [options]
   * @param {number} [options.limit]
   */
  async searchMeetings(query, { limit } = {}) {
    if (!query || !query.trim()) {
      throw new TypeError("query is required");
    }
    return this._request("/search", { searchParams: { q: query, limit } });
  }

  /** Read a single meeting, including its transcript segments. */
  async getMeeting(meetingId) {
    if (!meetingId) throw new TypeError("meetingId is required");
    return this._request(`/meetings/${encodeURIComponent(meetingId)}`);
  }

  /** Get a member profile, including appearance stats. */
  async getMember(memberId) {
    if (!memberId) throw new TypeError("memberId is required");
    return this._request(`/members/${encodeURIComponent(memberId)}`);
  }

  /** Get a single bill or resolution. */
  async getBill(billId) {
    if (!billId) throw new TypeError("billId is required");
    return this._request(`/bills/${encodeURIComponent(billId)}`);
  }

  /** List governing bodies and sessions available in the corpus. */
  async listBodies() {
    return this._request("/bodies");
  }
}

module.exports = { CicadaGuideClient, CicadaGuideApiError, DEFAULT_BASE_URL };
