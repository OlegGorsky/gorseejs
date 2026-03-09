# Secure Patterns

These patterns describe the expected application style for a mature Gorsee codebase. They are not optional niceties.

## Auth

Preferred:

- use route middleware and guard for page/route execution
- use explicit `security.rpc.middlewares` for RPC

Avoid:

- assuming `_middleware.ts` protects `/api/_rpc/*`
- placing auth-sensitive logic in loaders/actions/handlers without policy nearby

## Redirects

Preferred:

- keep redirect targets relative when possible
- validate `next`, `returnTo`, `callback` values before use
- configure canonical origin in production

Avoid:

- `redirect(userInput)` with unvalidated absolute URLs
- trusting raw `Host` as canonical origin

## Cache

Preferred:

- assume auth-sensitive responses are private
- declare cache intent explicitly with `mode: "private" | "public" | "shared" | "no-store"`
- vary only on headers that truly affect response identity

Avoid:

- public/shared caching for responses that depend on `Cookie`, `Authorization`, locale, or internal headers
- using document and partial/data responses under the same cache identity

## RPC

Preferred:

- POST-only
- versioned RPC envelope over `application/vnd.gorsee-rpc+json`
- explicit auth/CSRF middleware
- rate limits and body limits

Avoid:

- treating RPC as an implicitly trusted internal endpoint
- unbounded request or response payloads

## File Serving

Preferred:

- normalized path containment
- separate public and internal asset roots

Avoid:

- prefix-based path checks
- assuming encoded paths are harmless

## Origins and Proxy Headers

Preferred:

- set `security.origin`
- explicitly decide whether forwarded headers are trusted
- use a provider preset such as `vercel`, `netlify`, `fly`, or `reverse-proxy` instead of ad-hoc forwarded trust when that matches deployment topology
- set explicit trusted proxy depth with `security.proxy.trustedForwardedHops`
- explicitly decide whether host enforcement is enabled

Avoid:

- trusting `X-Forwarded-*` by default
- relying on raw request `Host`

## Dev Server

Preferred:

- treat dev server as externally reachable unless proven otherwise
- keep HMR and internal dev channels behind origin checks

Avoid:

- assuming dev-only endpoints are harmless because they are "local"

## Product Discipline

If a secure pattern is repeatedly required, prefer promoting it into a framework guarantee or CLI-enforced rule instead of leaving it as tribal knowledge.
