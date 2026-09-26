---
title: "Cloudflare WAF HTTP 403 Diagnostics and User-Agent in Live Tools Test"
date: "2026-09-26"
category: "docs/solutions/integration-issues"
module: "testing"
problem_type: "integration_issue"
component: "testing_framework"
severity: "high"
symptoms:
  - "`initialize returned HTTP 403` during live-tools CI verification against public MCP endpoint"
  - "Opaque HTTP 403 error provided no diagnostic visibility into whether Cloudflare WAF, a proxy, or the Worker refused the request"
root_cause: "incomplete_setup"
resolution_type: "test_fix"
tags:
  - "live-tools"
  - "cloudflare-waf"
  - "mcp-client"
  - "user-agent"
  - "ci-testing"
  - "http-403"
---

# Cloudflare WAF HTTP 403 Diagnostics and User-Agent in Live Tools Test

## Problem
The automated nightly CI workflow (`check-live-tools.mjs`) failed when querying the public MCP endpoint with `initialize returned HTTP 403`. Because the underlying Cloudflare Worker application never returns 403 status codes, an intermediary edge layer (Cloudflare WAF / bot management) was rejecting requests, while the script's minimal error reporting obscured what entity refused the request and why.

## Symptoms
- `check-live-tools.mjs` failed with `initialize returned HTTP 403`.
- GitHub Actions logs showed no diagnostic response headers (`server`, `cf-ray`, `cf-mitigated`) or response body text to determine the refusal reason.
- Developers could not tell if the failure was a network outage, authentication issue, Cloudflare challenge/block, or endpoint misconfiguration.

## What Didn't Work
- Relying on default `fetch()` headers: Node.js standard fetch does not send a custom `User-Agent`, leaving requests identifiable as generic automated script traffic that Cloudflare edge security rules frequently block or challenge with HTTP 403.
- Minimal HTTP status logging (`throw new Error(\`initialize returned HTTP \${init.status}\`)`): Only showed `403` without response headers or error body payloads, preventing triage without external curl inspection.

## Solution
1. **Added diagnostic response introspection:** Implemented a `describe(response)` helper that inspects diagnostic headers (`server`, `cf-ray`, `cf-mitigated`, `content-type`) and captures the first 300 characters of the response body.
2. **Configured descriptive `User-Agent`:** Explicitly identified requests with `User-Agent: cicada-guide-plugin-live-tools (+https://github.com/cicada-guide/plugin)` to satisfy bot protection requirements and establish client provenance.
3. **Added `--endpoint <url>` override flag:** Allowed redirection of `check-live-tools.mjs` to local mock servers or staging environments for deterministic testing without relying exclusively on the live endpoint.

```javascript
// scripts/check-live-tools.mjs

// Something in front of the Worker (a proxy, a WAF rule) can refuse a request the Worker never
// sees, so a failure reports enough of the response to tell who answered.
async function describe(response) {
  const headers = ["server", "cf-ray", "cf-mitigated", "content-type"]
    .map((h) => response.headers.get(h) && `${h}: ${response.headers.get(h)}`)
    .filter(Boolean);
  const body = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 300);
  return `HTTP ${response.status}${headers.length ? ` (${headers.join("; ")})` : ""}${body ? ` — ${body}` : ""}`;
}

async function fetchTools(endpoint) {
  const headers = {
    "User-Agent": "cicada-guide-plugin-live-tools (+https://github.com/cicada-guide/plugin)",
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
  };
  // ...
  if (!init.ok) throw new Error(`initialize returned ${await describe(init)}`);
  // ...
  if (!list.ok) throw new Error(`tools/list returned ${await describe(list)}`);
}
```

## Why This Works
Cloudflare edge infrastructure evaluates inbound client headers before passing requests to Workers. Providing a well-formed, transparent `User-Agent` distinguishes benign automated verification from suspicious generic web scrapers. When requests are still challenged or refused by edge security rules, inspecting `cf-ray`, `cf-mitigated`, and response body text immediately informs maintainers whether Cloudflare WAF, rate limits, or managed challenge rules blocked the traffic.

## Prevention
- Always specify an informative, repository-linked `User-Agent` for automated CI test scripts making requests to public APIs.
- Log diagnostic edge headers (`server`, `cf-ray`, `cf-mitigated`) and truncated response bodies in network client error handlers instead of logging bare HTTP status codes.
- Provide CLI flags (`--endpoint`) in test scripts so live endpoints can be substituted with local mocks or debug proxies during local troubleshooting.

## Related Issues
- Pull Request #7: `Report who refused the live-tools request` (commit `0a92643`)
- `.github/workflows/live-tools.yml`: Nightly reconciliation workflow
