# Gorsee.js -- Implementation Plan

## Overview

6 phases. Each phase produces a working deliverable that can be tested.
Phase 0 is scaffolding. Phases 1-3 produce MVP. Phases 4-5 are DX and production readiness.

---

## Phase 0: Project Bootstrap

Goal: working monorepo, tooling, empty package with subpath exports.

### 0.1 Init project
- bun init
- git init
- package.json with subpath exports structure
- tsconfig.json (strict, JSX preserve for our transform)
- .gitignore

### 0.2 Package structure
```
gorsee-js/
  src/
    reactive/        # signals API (alien-signals wrapper)
      index.ts
      signal.ts
      computed.ts
      effect.ts
      resource.ts
      store.ts
    runtime/          # JSX runtime + DOM operations
      index.ts
      jsx-runtime.ts
      client.ts       # client-side rendering + hydration
      server.ts       # SSR to string/stream
      suspense.ts
    server/           # server() transform runtime, RPC registry
      index.ts
      rpc.ts
      middleware.ts
    types/            # branded types
      index.ts
      safe-sql.ts
      safe-html.ts
      safe-url.ts
      user-input.ts
    db/               # database adapters
      index.ts
      sqlite.ts
      postgres.ts
    router/           # file-based routing
      index.ts
      scanner.ts
      matcher.ts
      params.ts
    log/              # structured logging
      index.ts
    unsafe/           # escape hatches
      index.ts
    errors/           # error catalog + formatters
      index.ts
      catalog.ts
      formatter.ts
  plugins/
    rolldown-plugin-gorsee/    # Rolldown plugin (server() transform, JSX)
      index.ts
      server-transform.ts
      jsx-transform.ts
      hydration-markers.ts
  cli/                         # CLI tool (later phase)
    index.ts
  tests/
    reactive/
    runtime/
    types/
    server/
    integration/
```

### 0.3 Dependencies
- alien-signals (reactive core)
- devalue (serialization)
- oxc-parser (AST for plugin) -- or via solid-jsx-oxc fork
- rolldown (bundler)
- bun:sqlite (built-in, no install)
- bun:test (built-in)

### Deliverable
`bun test` runs, package exports resolve, empty functions return placeholders.

---

## Phase 1: Reactivity + Branded Types

Goal: reactive signals work, branded types enforce safety at compile time.

### 1.1 Reactive primitives (src/reactive/)
- Wrap alien-signals `createReactiveSystem()` into Gorsee API
- `createSignal<T>(value): [getter, setter]`
- `createComputed<T>(fn): getter`
- `createEffect(fn): void`
- `createResource<T>(fetcher): [accessor, { loading, error, refetch }]`
- `createStore<T>(object): [store, setStore]`
- Tests: reactivity graph, diamond dependencies, async resource

### 1.2 Branded types (src/types/)
- `SafeSQL` -- tagged template that returns branded string + params array
- `SafeHTML` -- sanitize() returns branded string
- `SafeURL` -- validate() returns branded URL
- `UserInput<T>` -- validate(schema, raw) returns branded T
- `unsafeHTML()`, `unsafeSQL()` in src/unsafe/
- Tests: compile-time rejections (tsd), runtime escaping

### 1.3 Database layer (src/db/)
- `db.get<T>(query: SafeSQL): T`
- `db.all<T>(query: SafeSQL): T[]`
- `db.run(query: SafeSQL): { changes: number }`
- SQLite adapter using bun:sqlite
- Postgres adapter interface (implementation later)
- Tests: CRUD operations, SQL injection prevented by types

### Deliverable
```ts
import { createSignal, createComputed } from "gorsee/reactive"
import { SafeSQL } from "gorsee/types"
import { db } from "gorsee/db"

const [count, setCount] = createSignal(0)
const doubled = createComputed(() => count() * 2)

const users = db.all<User>(SafeSQL`SELECT * FROM users WHERE age > ${count()}`)
```
All tests pass. Types prevent unsafe operations at compile time.

---

## Phase 2: JSX Runtime + Basic SSR

Goal: JSX compiles to direct DOM operations. Server can render to HTML string.

### 2.1 JSX runtime (src/runtime/)
- Study solid-jsx-oxc and dom-expressions
- Implement jsx-runtime.ts:
  - `createElement(tag, props, ...children)` for client
  - Direct DOM operations: `document.createElement`, `node.textContent`, etc.
  - Reactive bindings: when a prop/child is a signal, create effect that updates DOM node
  - Event handlers: `on:click`, `on:input` etc.
- Implement Suspense component:
  - Shows fallback while resource is loading
  - Swaps to content when resolved

### 2.2 Server-side rendering (src/runtime/server.ts)
- `renderToString(component): string` -- synchronous, waits for all data
- `renderToStream(component): ReadableStream` -- streaming, out-of-order (Phase 4)
- HTML generation from JSX (no DOM API on server)
- Serialize signal values inline via devalue
- Insert hydration markers: `data-g="s{id}"` on reactive DOM nodes

### 2.3 Client hydration (src/runtime/client.ts)
- `hydrate(component, container)` -- attach to existing DOM
- Read serialized signal values from `<script type="gorsee/state">`
- Restore reactive graph: create signals with server values
- Attach effects to marked DOM nodes (data-g attributes)
- Do NOT re-render -- only bind reactivity

### 2.4 Rolldown plugin: JSX transform (plugins/rolldown-plugin-gorsee/)
- Fork/adapt solid-jsx-oxc approach
- Transform JSX into Gorsee runtime calls
- Different output for client build vs server build

### Deliverable
```tsx
function Counter() {
  const [count, setCount] = createSignal(0)
  return (
    <div>
      <p>Count: {count()}</p>
      <button on:click={() => setCount(count() + 1)}>+1</button>
    </div>
  )
}

// Server: renderToString(<Counter />) -> "<div><p>Count: 0</p>..."
// Client: hydrate(<Counter />, document.body) -> reactive, no re-render
```

---

## Phase 3: server() + Routing = MVP

Goal: full-stack app works. Server functions, file routing, middleware.

### 3.1 server() transform (plugins/rolldown-plugin-gorsee/server-transform.ts)
- OXC parse: find all `server()` call expressions
- For each server():
  - Generate RPC ID: hash(file + AST position)
  - Client build: replace body with `__rpc(id, fetch(...))`
  - Server build: wrap with `__registerRPC(id, originalFn)`
- Closure analysis: detect captured client-side variables, emit error E1xx
- Serialization check: verify arg/return types are devalue-compatible

### 3.2 RPC runtime (src/server/rpc.ts)
- Client: `__rpc(id, args)` -> POST /api/_rpc/{id} with devalue-serialized body
- Server: RPC registry, route handler, devalue deserialize/serialize
- Middleware support: `server(fn, { middleware: [auth] })`
- Auto GET/POST detection (no args = GET, args = POST)

### 3.3 File-based router (src/router/)
- Scanner: read routes/ directory, build route tree
- Patterns: `index.tsx` -> `/`, `[id].tsx` -> `/:id`, `[...path].tsx` -> `/*`
- Layouts: `_layout.tsx` wraps children
- Middleware: `_middleware.ts` applies to folder
- Typed params: generate types from file names
- Route matching at runtime

### 3.4 Middleware system (src/server/middleware.ts)
- `middleware(async (ctx, next) => { ... })`
- Typed `ctx`: request, response, cookies, locals, redirect
- `ctx.locals` typed per middleware chain
- Chain execution: folder hierarchy top-down

### 3.5 Dev server
- Bun.serve() as HTTP server
- Rolldown watch mode for rebuilds
- Basic HMR (full page reload first, signal-preserving later)
- Wire everything: router -> middleware -> server functions -> SSR

### Deliverable: Working full-stack app
```tsx
// routes/users/index.tsx
import { createResource, Suspense } from "gorsee"
import { server } from "gorsee/server"
import { db } from "gorsee/db"

const getUsers = server(async () => {
  return db.all<User>(SafeSQL`SELECT * FROM users`)
})

export default function UsersPage() {
  const [users] = createResource(getUsers)
  return (
    <main>
      <h1>Users</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <ul>
          {users()?.map(u => <li>{u.name}</li>)}
        </ul>
      </Suspense>
    </main>
  )
}
```
`bun run dev` -> browser shows working app with SSR + hydration + server functions.

**THIS IS MVP.**

---

## Phase 4: Streaming + Hydration Modes + Security

Goal: production-grade SSR, security defaults, 3-mode hydration.

### 4.1 Out-of-order streaming SSR
- `renderToStream()` implementation
- Shell with Suspense fallbacks sent immediately
- Chunks streamed as resources resolve
- Inline `<script>` per chunk for DOM swap + state restore
- Per-route modes: `export const render = "stream" | "async" | "spa" | "static"`

### 4.2 3-mode hydration
- Compiler analysis: classify components as Static/Stateful/Dynamic
- Static: zero JS shipped
- Stateful: only reactive graph, no template JS
- Dynamic: full JS
- Per-component, automatic, no developer annotation needed

### 4.3 Event replay
- Inline script (~500 bytes) before app content
- Capture: click, input, keydown, submit, change
- Queue events with target + event data
- After hydration: replay in order
- Reference: Angular JSAction

### 4.4 Security defaults
- CSP headers with nonce for framework scripts
- HSTS for production
- CSRF: auto tokens for SSR, Signed Double Submit Cookie for SPA
- Rate limiting: in-memory for Bun, adapter for edge
- Helmet headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- All configurable in app.config.ts

### 4.5 Logging
- JSON structured logger
- Auto request logging: id, timing, status
- server() call logging (sans sensitive data)
- Levels: off/error/info/verbose/debug
- Dev: pretty print. Prod: JSON lines.

### Deliverable
Streaming SSR works. Static components ship 0 JS. Security headers present by default. Events captured before hydration.

---

## Phase 5: DX, CLI, Polish

Goal: developer experience on par with Next.js/SolidStart.

### 5.1 CLI
- `gorsee create my-app` -- scaffold project with correct structure
- `gorsee dev` -- dev server with HMR
- `gorsee build` -- production build (client + server bundles)
- `gorsee check` -- types + safety + structure analysis
- `gorsee routes` -- print route table
- `gorsee migrate` -- run database migrations
- `gorsee generate <entity>` -- CRUD scaffold

### 5.2 Error-as-Prompt system
- Error catalog: E0xx (types), E1xx (server), E2xx (routing), E3xx (reactivity), E4xx (SSR), E5xx (security), E9xx (structure)
- Human-readable output with What/Fix/AI-context
- Machine-readable JSON alongside
- `gorsee check` outputs structured report

### 5.3 FRAMEWORK.md generator
- Generated on `gorsee create` and `gorsee update`
- Contains: API reference, project routes, middleware chain, DB schema, error codes
- Also generates `.cursor/rules/gorsee.mdc` and CLAUDE.md section

### 5.4 Dev overlay
- Browser overlay in dev mode
- Show: signal changes, DOM updates, server request timing, data sizes
- Stripped in production build

### 5.5 HMR with signal preservation
- On file change, replace component function
- Keep existing signal values
- Re-run effects with new dependencies
- Instant feedback, no state loss

### 5.6 Production build + deploy
- Optimized client + server bundles via Rolldown
- Tree shaking, minification, code splitting
- `deploy.target` support: bun (first), then cloudflare, deno, node
- Asset hashing, precompression

### Deliverable
Complete framework with CLI, dev tools, production build, deploy.

---

## Milestone Summary

| Phase | Name | What you get | Key deps |
|-------|------|-------------|----------|
| 0 | Bootstrap | Empty project, structure, tooling | bun, rolldown |
| 1 | Reactivity + Types | Signals work, types enforce safety | alien-signals |
| 2 | JSX + SSR | Components render on server and client | solid-jsx-oxc fork |
| 3 | server() + Router | **MVP: working full-stack app** | OXC, devalue |
| 4 | Streaming + Security | Production SSR, security defaults | - |
| 5 | DX + CLI | Complete developer experience | - |

## Execution order within phases

Each phase is sequential (depends on previous). Within a phase, tasks can be parallelized:

```
Phase 0: [0.1] -> [0.2] -> [0.3]

Phase 1: [1.1 Reactive] -----> can start immediately
         [1.2 Branded types] -> parallel with 1.1
         [1.3 Database] ------> needs 1.2 (SafeSQL)

Phase 2: [2.1 JSX runtime] ---> needs 1.1 (signals)
         [2.2 SSR] -----------> needs 2.1
         [2.3 Hydration] -----> needs 2.1 + 2.2
         [2.4 Rolldown plugin]> parallel with 2.1

Phase 3: [3.1 server() transform] -> needs 2.4 (plugin)
         [3.2 RPC runtime] --------> needs 3.1
         [3.3 Router] -------------> parallel with 3.1
         [3.4 Middleware] ----------> needs 3.3
         [3.5 Dev server] ----------> needs all above

Phase 4: [4.1-4.5] all parallel after Phase 3

Phase 5: [5.1-5.6] all parallel after Phase 4
```
