# Runtime Failures

This document defines common production/runtime failures for Gorsee as a mature product.

## Common Runtime Failures

The most important runtime failures today are:

- missing trusted origin for production runtime
- untrusted forwarded host or proxy metadata
- route module without a default export
- route/document/partial response-shape drift
- missing client bundle or stale manifest entry
- RPC boundary left unprotected or misconfigured

## Production Error Message Expectations

Error messages should stay concrete enough for operators and agents to classify the failure quickly.

Expected examples include:

- `Missing trusted origin for production runtime`
- explicit errors when a route has no default export
- explicit errors when streaming page responses are missing `wrapHTML`
- explicit errors when deploy artifacts still contain placeholder origins

Production output must still avoid leaking sensitive internals, but it must remain specific about the failed contract.

## Proxy / Origin / Provider Mistakes

The most common deployment mistakes are:

- `APP_ORIGIN` left as a placeholder
- trusted proxy settings enabled without a real trusted hop
- forwarded host/proto headers accepted from untrusted clients
- deploy adapters generated but not reconciled with the real provider runtime

These are product failures, not edge-case documentation gaps.

## Route / Document / Partial Failure Semantics

Gorsee must keep response shapes explicit even under failure:

- document responses remain HTML-oriented
- partial navigation responses remain JSON-oriented and `Cache-Control: no-store`
- document and partial responses must not collapse into the same cache identity
- failure handling must not accidentally widen a response from private to public cacheability

## AI Artifact Expectations

Runtime failure analysis should continue to rely on structured artifacts, not scraped console logs.

Failure scenarios should be diagnosable through:

- `.gorsee/ai-events.jsonl`
- `.gorsee/ai-diagnostics.json`
- `.gorsee/ide/events.json`
- `.gorsee/agent/latest.json`

At minimum, `request.error`, `build.summary`, and `release.smoke.error` scenarios should remain visible to agents and IDE tooling.
