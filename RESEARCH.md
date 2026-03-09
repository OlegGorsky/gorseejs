# Gorsee.js -- Research & Market Audit

Audit date: 2026-03-05

---

## 1. Reactive Runtime (signals ~800 LOC)

### Ready solutions found

**alien-signals** (StackBlitz) -- https://github.com/stackblitz/alien-signals
- The lightest signal library on the market
- 400% faster than Vue 3.4 reactivity
- API: `signal()`, `computed()`, `effect()`
- Key feature: `createReactiveSystem()` -- lets you build your OWN signal API on top of their core algorithm
- Size: extremely small, push-pull model
- **VERDICT: Best candidate for Gorsee.js reactive core. Use `createReactiveSystem()` to build our API on top, full control without reimplementing the algorithm.**

**Reactively** (Milo M.) -- https://github.com/milomg/reactively
- < 1kb, simple API
- Has performance analysis tooling
- Author is a TC39 Signals proposal contributor and Solid contributor
- Good reference implementation

**maverick-js/signals** -- https://github.com/maverick-js/signals
- ~1kB minzipped, extremely fast
- Good API design

**Minko Gechev's Revolt** -- https://blog.mgechev.com/2025/01/09/minimal-reactive-framework/
- ~200 lines reactive framework
- Excellent educational reference for how to build from scratch
- Same author wrote "LLM-first Web Framework" blog post -- directly relevant to Gorsee.js philosophy

**js-reactivity-benchmark** -- https://github.com/transitive-bullshit/js-reactivity-benchmark
- Benchmark comparing all signal libraries
- Use to validate our choice

**TC39 Signals Proposal** -- https://github.com/tc39/proposal-signals
- Still Stage 0, not advancing fast
- Champions: authors of Angular, Solid, Vue, Qwik, Preact, Ember
- Common model across frameworks -- good to align API with this direction
- Won't be standard anytime soon, but API shape is a good reference

### Decision
Use **alien-signals** `createReactiveSystem()` as the reactive core. Build Gorsee.js signal API on top (`createSignal`, `createComputed`, `createEffect`, `createResource`, `createStore`). This gives us:
- Battle-tested algorithm (used by StackBlitz)
- Full API control
- Tiny bundle size
- No need to write our own push-pull reactive algorithm

---

## 2. JSX Runtime (no VDOM, direct DOM)

### Ready solutions found

**dom-expressions** (Ryan Carniato / Solid) -- https://github.com/ryansolid/dom-expressions
- THE reference implementation for fine-grained JSX runtime
- Compiles JSX to native DOM operations
- Used by SolidJS, tested in production
- Contains: babel plugin, runtime, SSR, hydration

**solid-jsx-oxc** (Frank-III) -- https://github.com/frank-iii/solid-jsx-oxc
- OXC + Rust implementation of SolidJS JSX compiler
- Already has: `rolldown-plugin-solid-oxc` (!)
- NAPI-RS bindings for Node.js
- Covers DOM + SSR builds
- **VERDICT: This is almost exactly what we need. A Rolldown plugin that compiles JSX via OXC into fine-grained DOM operations. Can be forked/adapted for Gorsee.js.**

**swc-plugin-jsx-dom-expressions** -- https://github.com/milomg/swc-plugin-jsx-dom-expressions
- SWC implementation of the same concept
- Alternative if OXC path doesn't work

**VanJS** -- https://vanjs.org/
- 1.0kB framework, no JSX, no VDOM
- Pure vanilla JS DOM operations
- Good reference for minimal DOM manipulation patterns

### Decision
Fork/adapt **solid-jsx-oxc** for Gorsee.js JSX compilation. Already has Rolldown plugin, OXC-based, covers DOM + SSR. Modify to work with our signal API instead of Solid's.

---

## 3. Branded Types (SafeSQL, UserInput, SafeHTML, SafeURL)

### Ready solutions found

**ts-brand** -- https://github.com/kourge/ts-brand
- Reusable type branding library
- Small, well-designed API
- Good reference for branded type patterns

**squid** (Andy Wer) -- https://github.com/andywer/squid
- SQL tagged template strings with schema definitions
- Auto-escapes parameters
- Has `sql.safe()` for explicit escaping
- **Good reference for SafeSQL implementation**

**typescript-sql-tagged-template-plugin** -- https://github.com/frigus02/typescript-sql-tagged-template-plugin
- TypeScript language service plugin
- Adds type checking for sql tagged templates IN THE EDITOR
- Shows how to do IDE integration

**TypeScript issue #33304** -- https://github.com/microsoft/TypeScript/issues/33304
- "Type safety with TemplateStringsArray and tag functions"
- Community discussion on enforcing safety at type level

**csrf-csrf** -- https://github.com/Psifi-Solutions/csrf-csrf
- CSRF protection using Double Submit Cookie Pattern
- Good reference for our security module

### Decision
Implement branded types from scratch (they're simple). Use **ts-brand** patterns as reference. SafeSQL implementation inspired by **squid**. Consider **typescript-sql-tagged-template-plugin** approach for IDE support later.

---

## 4. Reactive Graph Serialization (for hydration)

### Approaches found

**Qwik serialization** -- https://qwik.dev/docs/concepts/resumable/
- Serializes signal values into HTML attributes
- Runtime discovers dependencies at runtime
- Serializes the dependency graph on the server
- Primitives similar to useEffect/useMemo

**Nuxt Payload System** -- https://deepwiki.com/nuxt/nuxt/6.2-payload-system
- Serializes server state into HTML payload
- Client deserializes to restore state without re-execution
- Uses devalue for serialization

**SvelteKit devalue integration** -- https://svelte.dev/docs/svelte/hydratable
- SvelteKit uses devalue to serialize load() data
- Embeds in HTML, client rehydrates from it
- Handles Date, Map, Set, BigInt, URL
- Performance consideration: only serialize what's used, not entire load() result

**Leptos reactive graph** -- https://book.leptos.dev/appendix_reactive_graph.html
- Detailed explanation of how reactive graph works internally
- Useful for understanding serialization points

### Decision
Approach: at compile time, assign stable IDs to signals. At SSR time, collect signal values + dependency edges. Serialize via **devalue** inline with HTML chunks (Marko-style). Client restores graph from serialized data. Reference: Qwik's serialization + SvelteKit's devalue usage.

---

## 5. Event Replay (pre-hydration interaction capture)

### Ready solutions found

**Angular Event Dispatch / JSAction** -- https://github.com/angular/angular/blob/main/packages/core/primitives/event-dispatch/README.md
- Production-proven (powers Google Search!)
- Small inline script before app content
- Registers global event handlers for delegatable events
- Events bubble up, get queued
- After hydration, queued events replay
- **Source code available in Angular repo**

**Original JSAction** -- https://github.com/google/jsaction
- Google's tiny event delegation library
- Decouples event binding from handler code
- Now developed within Angular repo

**Astro discussion** -- https://github.com/withastro/roadmap/discussions/788
- Community discussion on recording clicks before hydration
- Shows demand for this feature

### Decision
Implement event replay inspired by **Angular's JSAction**. Small inline `<script>` (~500 bytes) that:
1. Listens for click, input, keydown, submit at document level
2. Queues events with target element + event data
3. After hydration, replays queued events to correct handlers
This is proven at Google Search scale.

---

## 6. Out-of-Order Streaming SSR

### Approaches found

**React 18 renderToPipeableStream** -- https://github.com/reactwg/react-18/discussions/37
- Pioneered Suspense-based streaming in JS ecosystem
- Sends HTML shell, then streams completed Suspense boundaries
- Uses `<template>` + inline `<script>` to swap content

**Leptos out-of-order streaming** -- https://book.leptos.dev/ssr/23_ssr_modes.html
- Default mode, cleanest implementation
- Per-route mode configuration
- Small JS snippet streams with each chunk
- Shell + fallbacks immediate, data streams as resolved

**Marko streaming** -- https://x.com/markodevteam/status/1481041972190015488
- Streams HTML and hydration init code together
- Each chunk includes component initialization
- Components hydrate as chunks arrive, not all at once

**SolidStart streaming** -- https://www.johal.in/solidstart-solidjs-full-stack-vite-powered-ssr-2026/
- 3.2x faster SSR than Next.js App Router
- TTFB: 42ms mean, p95 78ms (vs Next.js 128ms)

### Key technique (from React 18 architecture)
```html
<!-- Initial shell -->
<div id="suspense-1"><!--$?--><template id="fallback-1">Loading...</template><!--/$--></div>

<!-- Later, streamed chunk -->
<div hidden id="content-1"><actual content here></div>
<script>
  // Swap fallback with content
  let f = document.getElementById('fallback-1');
  let c = document.getElementById('content-1');
  f.parentNode.replaceChild(c, f);
  c.hidden = false;
</script>
```

### Decision
Implement out-of-order streaming using Bun's `ReadableStream`. Each `<Suspense>` boundary = one streaming slot. Shell sent immediately with fallbacks. Chunks streamed with inline `<script>` for DOM swap + reactive graph restoration. Reference: React 18 mechanism + Marko inline init pattern.

---

## 7. Package Structure

### Approaches found

**SolidJS** -- https://github.com/solidjs/solid
- Single package with subpath exports: `solid-js`, `solid-js/web`, `solid-js/store`, `solid-js/html`
- Simple for users, one install

**SolidStart** -- https://github.com/solidjs/solid-start
- Separate package from solid-js
- pnpm monorepo with nested workspaces
- Meta-framework on top of core

**Svelte + SvelteKit**
- `svelte` (core) + `@sveltejs/kit` (meta-framework)
- Clear separation

### Decision
Single package `gorsee` with subpath exports:
```json
{
  "exports": {
    ".": "./src/index.ts",
    "./reactive": "./src/reactive/index.ts",
    "./server": "./src/server/index.ts",
    "./log": "./src/log/index.ts",
    "./unsafe": "./src/unsafe/index.ts",
    "./db": "./src/db/index.ts"
  }
}
```
CLI as separate `gorsee-cli` package or binary. Simpler for users, one `bun add gorsee`.

---

## 8. CSRF for SPA Mode

### Approach found

**Double Submit Cookie Pattern (Signed)** -- OWASP recommended
- Server sets CSRF token in cookie (NOT HttpOnly, JS must read it)
- Client reads cookie, sends same token in X-XSRF-TOKEN header
- Server compares cookie value vs header value
- HMAC-signed to prevent forgery
- Stateless -- no server-side storage needed
- Works perfectly for SPAs without initial HTML render

**csrf-csrf library** -- https://github.com/Psifi-Solutions/csrf-csrf
- Reference implementation for Express
- Double Submit Cookie with HMAC signing

### Decision
SPA mode uses Signed Double Submit Cookie pattern. On first request, server sets `__gorsee_csrf` cookie with HMAC-signed token. Client JS reads cookie, includes in request header. Server validates HMAC. Stateless, no token endpoint needed.

---

## 9. Rate Limiting on Edge

### Approach found

**Cloudflare Durable Objects** -- recommended for consistent rate limiting
- KV is eventually consistent -- unreliable for rate limiting
- Durable Objects are singleton, strongly consistent
- All requests to same DO instance are serialized
- Token bucket pattern inside DO

**Architecture pattern:**
```
Worker (stateless) → Durable Object (stateful, rate counter)
                   → if allowed → origin
                   → if denied → 429
```

**KV limitation**: max 1 write/key/second. Not suitable for high-traffic rate limiting.

### Decision
Rate limiting is **platform-dependent**:
- Bun: in-memory token bucket (simple, single process)
- Cloudflare: Durable Objects adapter
- `gorsee check` warns if rate limiting configured but target is edge without DO binding
This is configured in `app.config.ts`, adapter selected by `deploy.target`.

---

## 10. FRAMEWORK.md / AI Context Generation

### Approaches found

**llm-context.md pattern** -- https://www.donnfelker.com/productive-llm-coding-with-an-llm-context-md-file/
- Dedicated context file for AI assistants
- Contains project structure, conventions, relevant context
- Kept updated manually or auto-generated

**Cursor Rules (.cursor/rules/*.mdc)** -- https://github.com/digitalchild/cursor-best-practices
- Framework-specific rules for Cursor IDE
- MDC format (supercharged Markdown)
- Per-project and per-directory rules

**CLAUDE.md** -- Convention for Claude Code
- Repo-level instructions for AI
- Auto-loaded into context

**llms.txt** -- https://llmstxt.org/
- Proposed standard for LLM-optimized site documentation
- Machine-readable format

**Minko Gechev's "LLM-first Web Framework"** -- https://blog.mgechev.com/2025/04/19/llm-first-web-framework/
- Framework explicitly designed for LLM consumption
- Minimal syntax, orthogonal APIs, single way of doing things
- Uses basic syntax (JS objects instead of JSX) to leverage LLM training data
- **Directly validates Gorsee.js design philosophy**

**Angular's AI docs** -- https://angular.dev/ai/develop-with-ai
- Official LLM prompts and setup docs
- Shows that major frameworks are starting to optimize for AI consumption

### Decision
FRAMEWORK.md generated by CLI, contains:
1. Framework API reference with examples
2. Project-specific info: routes, middleware chain, DB schema from migrations
3. Installed packages and their types
4. Error code reference
5. Optimized for token economy (no verbose explanations, just patterns + examples)

Also generate `.cursor/rules/gorsee.mdc` and update `CLAUDE.md` with Gorsee conventions.

---

## 11. Error Catalog

### Approaches found

**Rust compiler errors** -- gold standard for structured errors
- Error code (E0001), explanation, suggestion with diff
- `rustc --explain E0001` for detailed context
- Machine-parseable output format (`--error-format=json`)

**Angular compiler errors** -- https://angular.dev/errors
- Numbered error codes (NG0100, NG0200, etc.)
- Each with: description, debugging steps, common causes
- IDE integration through language service

**TypeScript custom diagnostics** -- via language service plugins
- Can add custom errors with codes
- Integrated into IDE error panel

**Replit Code Repair** -- https://blog.replit.com/code-repair
- ML model trained on LSP diagnostics
- Structured error → auto-fix pipeline
- Shows that machine-readable errors enable automated repair

### Decision
Define error catalog with format:
```
GORSEE E[category][number]
Categories:
  E0xx -- Type safety (SafeSQL, UserInput, SafeHTML violations)
  E1xx -- Server functions (closures, serialization, RPC)
  E2xx -- Routing (structure, params, middleware)
  E3xx -- Reactivity (signals, effects, resources)
  E4xx -- SSR/Hydration
  E5xx -- Security (CSRF, CSP, headers)
  E9xx -- Project structure violations
```
Each error outputs JSON alongside human-readable text. JSON format enables auto-fix by AI assistants and IDE plugins.

---

## Summary: Key GitHub Repos to Study

| Repo | Relevance | Priority |
|------|-----------|----------|
| [alien-signals](https://github.com/stackblitz/alien-signals) | Reactive core via createReactiveSystem() | P0 |
| [solid-jsx-oxc](https://github.com/frank-iii/solid-jsx-oxc) | OXC JSX compiler + Rolldown plugin | P0 |
| [dom-expressions](https://github.com/ryansolid/dom-expressions) | Reference JSX runtime for fine-grained rendering | P0 |
| [devalue](https://github.com/Rich-Harris/devalue) | Serialization for hydration + RPC | P0 |
| [angular/event-dispatch](https://github.com/angular/angular/tree/main/packages/core/primitives/event-dispatch) | Event replay implementation | P1 |
| [ts-brand](https://github.com/kourge/ts-brand) | Branded types reference | P1 |
| [squid](https://github.com/andywer/squid) | SafeSQL tagged template reference | P1 |
| [csrf-csrf](https://github.com/Psifi-Solutions/csrf-csrf) | CSRF double submit pattern | P2 |
| [js-reactivity-benchmark](https://github.com/transitive-bullshit/js-reactivity-benchmark) | Validate signal performance | P2 |
| [tc39/proposal-signals](https://github.com/tc39/proposal-signals) | API shape reference | P2 |
