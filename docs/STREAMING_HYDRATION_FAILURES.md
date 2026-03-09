# Streaming and Hydration Failures

This document defines streaming and hydration failure modes for Gorsee as a mature product.

## Streaming Expectations

Streaming is a contract, not a best-effort enhancement.

Current expectations:

- streaming page responses require `wrapHTML`
- the shell must stay structurally compatible with streamed body chunks
- streamed errors must still produce diagnosable output
- streaming must not silently degrade response-shape guarantees
- streaming work from a stale navigation must not overwrite a newer navigation result
- streamed chunk patching must fail closed; if the target Suspense boundary is gone after navigation, the chunk must noop instead of mutating unrelated DOM

## Hydration Failure Modes

The most common hydration failures are:

- hydrating a route too broadly when only an island is needed
- assuming a partial navigation payload is equivalent to a full document shell
- mismatching server-rendered markup and client ownership
- shipping interactivity for UI that should remain SSR-only

## Preferred Mitigations

- prefer the smallest hydration boundary
- use islands for focused interaction
- keep SSR-only sections free of accidental client ownership
- debug streaming and hydration with the same route/document/partial model used by the runtime
- treat hydration mismatches as recovery events; Gorsee should recover through a full client render rather than leaving partial ownership behind
- preserve form/focus intent explicitly with stable `data-g-preserve-key`, `name`, or `id` values when a navigation is expected to carry UI state forward
- treat broken `beforeNavigate` hooks as cancellation events; a failed guard must not allow the navigation to continue
- treat query-string changes as part of route identity during client navigation and history restoration

## Diagnostic Clues

When streaming or hydration drift happens, operators and agents should inspect:

- `renderMode: "stream"` routes
- shell generation via `wrapHTML`
- route bundle presence in the manifest
- partial navigation requests with `X-Gorsee-Navigate: partial`
- `.gorsee/ai-events.jsonl` for request and build failures
