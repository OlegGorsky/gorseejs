# Gorsee.js -- Technical Specification v0.1

## Mission

First framework designed for human + AI collaboration.
Safe by default, predictable by design, complete out of the box.

## Audience

Developer who writes with AI but reads, reviews, and controls code manually.
Doesn't trust magic, wants to understand what's happening.

## Three Pillars

1. **Full-Stack in one file** -- component contains UI, server logic, DB query, and validation. One file = one feature.
2. **Safety Through Types** -- unsafe code doesn't compile. Branded types for user input, SQL, HTML. TypeScript enforces, not a linter you can ignore.
3. **One way, one structure** -- framework strictly dictates where things go and how they're written. For humans -- predictability, for AI -- deterministic generation.

---

## Tech Stack

| Component        | Solution                      | Rationale                                                    |
| ---------------- | ----------------------------- | ------------------------------------------------------------ |
| Runtime          | **Bun**                       | Native SQLite, fast startup, TypeScript out of the box       |
| Reactivity       | **Custom minimal (~800 LOC)** | Solid-style signals, full control over graph serialization   |
| JSX              | **Custom JSX runtime**        | Compiles to pinpoint DOM operations, no VDOM                 |
| Language         | **TypeScript + JSX**          | Branded types, end-to-end type safety                        |
| Bundler          | **Rolldown** (Rust, 1.0 RC)  | 10-30x faster than Rollup, Vite-compatible plugin API        |
| AST parsing      | **OXC** (Rust)                | 3x faster than SWC, used inside Rolldown plugin              |
| Serialization    | **devalue** (Rich Harris)     | Supports Date, Map, Set, BigInt, cycles                      |
| RPC identity     | **Hash (file + position)**    | Stable, no collisions                                        |

---

## Project Structure

```
my-app/
  routes/
    index.tsx
    about.tsx
    users/
      index.tsx
      [id].tsx
      _components/       # co-located components for this route group
        UserCard.tsx
    api/
      health.ts
    _layout.tsx
    _middleware.ts
  shared/
    types.ts
  middleware/
    auth.ts
  jobs/
    cleanup.ts
  migrations/
    001_init.sql
  public/
    favicon.ico
  app.config.ts
  FRAMEWORK.md           # auto-generated AI system prompt
  package.json
```

Each folder has one purpose. Route files can import from sibling `_components/` for decomposition while preserving co-location.

---

## Reactivity

Solid-style signals. Component function runs once, then only signals work. No re-renders of the whole component, no Virtual DOM, no hook rules, no stale closures.

### Primitives (from `gorsee/reactive`)

| Primitive                  | Purpose                                               |
| -------------------------- | ----------------------------------------------------- |
| `createSignal(value)`      | Reactive value                                        |
| `createComputed(fn)`       | Derived value, auto-recalculates on dependency change |
| `createEffect(fn)`         | Side effect, fires on dependency change               |
| `createResource(fetcher)`  | Async resource with loading/error/data states         |
| `createStore(object)`      | Reactive object for complex state                     |

---

## Server Functions

`server()` wraps a function into a server endpoint. At build time the framework strips the function body from the client bundle and replaces it with a typed fetch call. On the server the function remains as-is.

```tsx
const getUsers = server(async (): Promise<User[]> => {
  return db.all<User>(SafeSQL`SELECT * FROM users`)
})
```

### Build-time transformation (Rolldown + OXC)

Client output:
```ts
const getUsers = __rpc("a1b2c3d4", async (): Promise<User[]> => fetch("/api/_rpc/a1b2c3d4"))
```

Server output:
```ts
__registerRPC("a1b2c3d4", async (): Promise<User[]> => {
  return db.all<User>(SafeSQL`SELECT * FROM users`)
})
```

### RPC identification

ID = hash(file path + position in file). Stable, collision-free, independent of variable names.

### Closure analysis

OXC plugin analyzes scope of `server()` at build time. If a server function captures a client-side variable -- compile error with a structured fix suggestion:

```
GORSEE E003: Server function captures client-side variable

  routes/users/index.tsx:5:18

  `filter` is a client-side signal declared at line 2.
  Server functions cannot access client-side state.

  Fix: Pass it as an argument:
    const search = server(async (filter: string) => { ... })
```

### Serialization boundary

Arguments and return values pass through devalue serialization. At build time `gorsee check` verifies that all types crossing the boundary are serializable. Non-serializable types (ReadableStream, functions, WeakMap) produce a compile error.

### Supported patterns

- GET for reads, POST for mutations (auto-detected or explicit)
- Middleware: `server(fn, { middleware: [auth] })`
- Input validation: branded types for arguments

---

## Type Safety System

Core of security -- branded types. TypeScript types that cannot be created directly, only through validation functions.

### SafeSQL

Tagged template literal for SQL queries. Accepts only template strings with parameters. String concatenation = compile error. Parameters are automatically escaped.

```ts
type SafeSQL = string & { readonly __brand: unique symbol }

// Error:
const q: SafeSQL = "SELECT * FROM users"           // compile error
const q: SafeSQL = `SELECT * WHERE id = ${id}`      // compile error (regular template)

// OK:
const q = SafeSQL`SELECT * FROM users WHERE id = ${id}`  // parameters escaped
```

### UserInput<T>

Branded type for user input. Regular string/object won't pass type checking. Must go through `validate()` with a schema.

### SafeHTML

Branded type for HTML content. Prevents XSS. Raw string won't insert into template, only through `sanitize()`.

### SafeURL

Branded type for URLs. Prevents open redirect. Only validated URLs pass type checking.

### Unsafe escape hatch

If developer truly needs raw HTML -- `unsafeHTML()` from `gorsee/unsafe`. Name screams danger, requires explicit import.

---

## Database

### Drivers

| Environment    | Driver                     | Notes                                    |
| -------------- | -------------------------- | ---------------------------------------- |
| Dev / simple   | **Bun SQLite** (built-in)  | Zero-config, same process                |
| Production     | **Postgres** (typed adapter)| Same interface, different SQL             |
| Edge (CF)      | **D1** (async)             | Different API, adapter handles difference |

Unified interface: `db.get()`, `db.all()`, `db.run()`. SQL is written for the specific driver -- no false promise of transparent swapping. SafeSQL enforced for all queries. No public access to raw connection.

### Migrations

Built-in. Files in `migrations/` folder. Auto-applied on dev start. CLI: `gorsee migrate` for production.

---

## Routing

File-based.

| File                        | Route            |
| --------------------------- | ---------------- |
| `routes/index.tsx`          | `/`              |
| `routes/about.tsx`          | `/about`         |
| `routes/users/[id].tsx`     | `/users/:id`     |
| `routes/users/[...path].tsx`| `/users/*`       |
| `routes/api/health.ts`      | API, no UI       |
| `routes/_layout.tsx`        | Layout wrapper   |
| `routes/_middleware.ts`     | Middleware        |

- Dynamic params: `[id]`, `[slug]`
- Catch-all: `[...path]`
- Layout: `_layout.tsx` wraps all child routes
- Middleware: `_middleware.ts` applies to all routes in folder, chain top-down
- Params are typed: `params.id` is `string`, not `any`

---

## SSR, Streaming, and Hydration

### Rendering Modes (per-route, inspired by Leptos)

```tsx
export const render = "stream"  // Out-of-order streaming (DEFAULT)
export const render = "async"   // Wait for all data, send complete HTML
export const render = "spa"     // Client-only, shell without data
export const render = "static"  // SSG -- generated at build time
```

### Out-of-Order Streaming (default)

Server immediately sends HTML shell with Suspense fallbacks. As data resolves (in ANY order), streams HTML chunks + serialized reactive graph.

```
1. Shell sent immediately (great TTFB):
   <div data-g-suspense="s1"><StatsSkeleton /></div>
   <div data-g-suspense="s2"><TableSkeleton /></div>

2. Stats resolves first:
   <template data-g-chunk="s1"><div class="stats">42</div></template>
   <script>__gorsee.resolve("s1", {signals: {count: 42}})</script>

3. Users resolves second:
   <template data-g-chunk="s2"><table>...</table></template>
   <script>__gorsee.resolve("s2", {signals: {users: [...]}})</script>

4. Stream closed: </body></html>
```

### 3-Mode Hydration (compiler-determined)

Compiler automatically classifies each component:

| Mode         | What ships to client              | When                          |
| ------------ | --------------------------------- | ----------------------------- |
| **Static**   | 0 JS                             | No signals in component       |
| **Stateful** | Reactive graph only (no templates)| Has signals, DOM already correct|
| **Dynamic**  | Full JS                           | Dynamic rendering needed      |

Developer does NOT think about hydration. Compiler decides automatically.

Each Suspense chunk hydrates independently upon arrival -- no waiting for full HTML or full JS bundle.

### Streaming + Hydration combined (unique to Gorsee.js)

Each streaming chunk includes both HTML and serialized state. As a chunk arrives in the browser:
- Static component? Insert HTML, zero JS.
- Stateful component? Insert HTML, restore signals (no template JS shipped).
- Dynamic component? Insert HTML, full hydration.

Inspired by: Marko 6 (streaming + inline init), Solid 2.0 (3-mode partial hydration), Leptos (per-route SSR modes).

### Suspense

```tsx
<Suspense fallback={<Skeleton />}>
  <AsyncComponent />
</Suspense>
```

Defines streaming boundaries. Each Suspense = one streaming chunk. Data from `createResource` serialized into HTML, reused on client -- no double fetch.

### Event Replay

Before hydration completes, user clicks are captured and queued. After hydration, queued events are replayed. No lost interactions.

---

## Middleware

`_middleware.ts` in route folder applies to all nested routes. Chain top-down through folder tree.

```ts
import { middleware } from "gorsee/server"

export default middleware(async (ctx, next) => {
  const session = ctx.cookies.get("session")
  if (!session) return ctx.redirect("/login")
  ctx.locals.user = await getUser(session)
  return next()
})
```

`ctx` is typed. `ctx.locals` is typed storage -- each middleware declares what it adds, TypeScript verifies routes receive correct data.

---

## Security (out of the box)

| Feature          | Default | Notes                                              |
| ---------------- | ------- | -------------------------------------------------- |
| CSP              | ON      | No inline scripts except framework-generated       |
| HSTS             | ON      | Production only                                    |
| CSRF             | ON      | Auto-generated tokens for all POST from server()   |
| Rate limiting    | ON      | Configurable in app.config.ts                      |
| X-Frame-Options  | ON      | DENY                                               |
| X-Content-Type   | ON      | nosniff                                            |
| Referrer-Policy  | ON      | strict-origin-when-cross-origin                    |

All overridable in config. Defaults are secure. Unsafe path is explicit (`gorsee/unsafe`).

---

## Logging

Architectural component, not an afterthought. Built-in JSON logger, compatible with Grafana/Datadog/Loki.

Levels: `off | error | info | verbose | debug`. Config via `LOG=info` in .env or `app.config.ts`.

Auto-logged per request: request ID, timing, status code. Server functions log calls with params (sans sensitive data). Errors logged with stack trace + context.

Dev: formatted console output. Production: clean JSON.

```ts
import { log } from "gorsee/log"
log.info("user created", { userId })
```

---

## Error-as-Prompt System

Every TypeScript and runtime error includes structured AI context:

```
GORSEE E001: SafeSQL violation

  routes/users/[id].tsx:15:3

  What: String concatenation in SQL query
  Fix: Use SafeSQL template literal: SafeSQL`SELECT * FROM users WHERE id = ${id}`

  AI context (copy entire block):
  +---------------------------------------------
  | Framework: Gorsee.js
  | Error: E001 - Raw string passed to db.get()
  | Rule: All queries must use SafeSQL tagged template
  | File: routes/users/[id].tsx:15
  | Current: db.get(`SELECT * FROM users WHERE id = ${id}`)
  | Fixed:   db.get(SafeSQL`SELECT * FROM users WHERE id = ${id}`)
  +---------------------------------------------
```

Machine-readable format for IDE auto-fix:

```json
{
  "code": "E001",
  "fix": {
    "file": "routes/users/[id].tsx",
    "line": 15,
    "replace": "db.get(SafeSQL`SELECT * FROM users WHERE id = ${id}`)"
  }
}
```

---

## Dev Tools

- **Dev overlay**: signals changed, what re-rendered, server request timing, data size. Auto in dev, stripped in production.
- **HMR**: instant reload, signal state preserved between reloads.
- **Route inspector**: `gorsee routes` shows all routes, middleware, render modes.

---

## CLI

| Command                    | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| `gorsee create my-app`    | New project with correct structure + FRAMEWORK.md |
| `gorsee dev`              | Dev server with HMR and overlay                |
| `gorsee build`            | Production build                               |
| `gorsee generate user-crud`| Generate CRUD file for entity                 |
| `gorsee migrate`          | Apply migrations                               |
| `gorsee routes`           | List all routes                                |
| `gorsee check`            | Full project check: types, safety, structure   |
| `gorsee deploy`           | Deploy to target platform                      |

---

## FRAMEWORK.md

Auto-generated file in project root. Optimized as AI system prompt.

Contains:
- Project structure
- All available imports with examples
- Every pattern with code samples
- List of branded types and usage
- Installed middleware and their types (project-specific)
- Database schema from current migrations (project-specific)

Updated on `gorsee create` and `gorsee update`. Not static docs -- reflects current project state.

---

## Config: app.config.ts

```ts
export default {
  port: 3000,

  db: {
    driver: "sqlite",        // "sqlite" | "postgres"
    url: "./data.sqlite"     // or postgres connection string
  },

  log: "info",               // off | error | info | verbose | debug

  security: {
    csp: true,
    hsts: true,
    csrf: true,
    rateLimit: {
      requests: 100,
      window: "1m"
    }
  },

  deploy: {
    target: "bun"            // "bun" | "cloudflare" | "deno" | "node"
  }
}
```

Typed -- autocomplete works. All defaults are secure.

---

## Deploy Targets

| Target               | DB                   | Jobs  | Notes                     |
| -------------------- | -------------------- | ----- | ------------------------- |
| **Bun** (primary)    | SQLite / Postgres    | Yes   | Full feature set          |
| **Cloudflare Workers** | D1 / Postgres      | No    | No fs, 128MB RAM, 30s CPU|
| **Deno Deploy**      | Postgres             | Later | Later                     |
| **Node**             | Postgres             | Yes   | Compatibility, later      |

`deploy.target` in config changes available API. `gorsee check` warns about incompatible features per target.

---

## Performance Targets

- Runtime: < 15kb (reactive core + JSX runtime + hydration)
- Signal updates: pinpoint DOM mutations, no diffing
- SSR: 4x throughput vs Node (Bun advantage)
- Streaming TTFB: < 50ms
- Cold start (edge): < 100ms
- Dev server start: < 500ms (Rolldown)
- Server app memory: 30-60MB

---

## AI Self-Learning Loop

Four mechanisms:

1. **Strict types with JSDoc** -- AI understands API through autocomplete
2. **FRAMEWORK.md in context** -- full docs in one file, project-specific
3. **Errors with prompts** -- TypeScript error -> AI context -> AI fixes
4. **CLI skeleton generation** -- AI works with already-correct code

Closed loop: AI writes -> types catch errors -> errors explain fix -> AI fixes -> code is safe.
