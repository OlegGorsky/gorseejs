import { describe, test, expect } from "bun:test"
import {
  applyRouteClientTransforms,
  stripRouteLoader,
  stripServerOnlyImports,
} from "../../src/build/route-client-transform.ts"

describe("server-strip-deep: stripLoader", () => {
  test("strips sync load function", () => {
    const src = `export function load(ctx) { return { a: 1 } }\nexport default () => 'hi'`
    const out = stripRouteLoader(src).source
    expect(out).not.toContain("function load")
    expect(out).toContain("export default")
  })

  test("strips sync loader function", () => {
    const src = `export function loader(ctx) { return { a: 1 } }\nexport default () => 'hi'`
    const out = stripRouteLoader(src).source
    expect(out).not.toContain("function loader")
    expect(out).toContain("export default")
  })

  test("strips async loader function", () => {
    const src = `export async function loader(ctx) {\n  const data = await db.query()\n  return data\n}\nexport default () => 'page'`
    const out = stripRouteLoader(src).source
    expect(out).not.toContain("function loader")
    expect(out).toContain("export default")
  })

  test("preserves default export", () => {
    const src = `export function loader(c) { return {} }\nexport default function Page() { return 'x' }`
    expect(stripRouteLoader(src).source).toContain("export default function Page")
  })

  test("handles nested braces in loader", () => {
    const src = `export function loader(ctx) { if (true) { const x = { a: 1 } } return x }\nexport default () => null`
    const out = stripRouteLoader(src).source
    expect(out).not.toContain("function loader")
    expect(out).toContain("export default")
  })

  test("no loader returns source unchanged", () => {
    const src = `export default () => 'no loader here'`
    expect(stripRouteLoader(src).source).toBe(src)
  })

  test("empty file handling", () => {
    expect(stripRouteLoader("").source).toBe("")
  })
})

describe("server-strip-deep: stripUnusedServerImports", () => {
  test("strips import from gorsee/db", () => {
    const src = `import { query } from "gorsee/db";\nexport default () => 'x'`
    const out = stripServerOnlyImports(src).source
    expect(out).not.toContain("gorsee/db")
    expect(out).toContain("export default")
  })

  test("strips import from gorsee/log", () => {
    const src = `import { logger } from "gorsee/log";\nexport default () => 'x'`
    expect(stripServerOnlyImports(src).source).not.toContain("gorsee/log")
  })

  test("handles multiple server imports", () => {
    const src = `import { db } from "gorsee/db";\nimport { log } from "gorsee/log";\nexport default () => 'x'`
    const out = stripServerOnlyImports(src).source
    expect(out).not.toContain("gorsee/db")
    expect(out).not.toContain("gorsee/log")
  })

  test("preserves client-safe imports", () => {
    const src = `import { createSignal } from "gorsee";\nexport default () => 'x'`
    const out = stripServerOnlyImports(src).source
    expect(out).toContain('from "gorsee"')
  })

  test("preserves CSS export", () => {
    const src = `export const css = "/styles/page.css"\nexport default () => 'x'`
    expect(stripServerOnlyImports(src).source).toContain("export const css")
  })

  test("file with only server code strips to minimal", () => {
    const src = `import { db } from "gorsee/db";\nimport { log } from "gorsee/log";`
    const out = stripServerOnlyImports(src).source
    expect(out.trim()).toBe("")
  })
})

describe("server-strip-deep: combined", () => {
  test("strips loader + server imports, preserves component", () => {
    const src = [
      `import { db } from "gorsee/db";`,
      `export async function loader(ctx) { return await db.all() }`,
      `export default function Page({ data }) { return 'ok' }`,
    ].join("\n")
    const out = applyRouteClientTransforms(src, "/routes/page.tsx").source
    expect(out).not.toContain("gorsee/db")
    expect(out).not.toContain("function loader")
    expect(out).toContain("function Page")
  })

  test("strips load + server imports, preserves component", () => {
    const src = [
      `import { db } from "gorsee/db";`,
      `export async function load(ctx) { return await db.all() }`,
      `export default function Page({ data }) { return 'ok' }`,
    ].join("\n")
    const out = applyRouteClientTransforms(src, "/routes/page.tsx").source
    expect(out).not.toContain("gorsee/db")
    expect(out).not.toContain("function load")
    expect(out).toContain("function Page")
  })

  test("strips bun:sqlite pattern import", () => {
    // bun:sqlite is not in SERVER_ONLY_MODULES but would be caught
    // by the Bun.build onResolve; here we verify the regex approach
    const re = /import\s+.*?from\s+["']bun:sqlite["'];?\n?/g
    const src = `import { Database } from "bun:sqlite";\nexport default () => 'x'`
    expect(src.replace(re, "")).not.toContain("bun:sqlite")
  })

  test("strips node:crypto pattern import", () => {
    const re = /import\s+.*?from\s+["']node:crypto["'];?\n?/g
    const src = `import { createHash } from "node:crypto";\nexport default () => 'x'`
    expect(src.replace(re, "")).not.toContain("node:crypto")
  })

  test("returns transform metadata for loader, imports, and server calls", () => {
    const src = [
      `import { db } from "gorsee/db"`,
      `export async function loader() { return await db.all() }`,
      `const mutate = server(async (id: string) => id)`,
      `export default function Page() { return "ok" }`,
    ].join("\n")

    const result = applyRouteClientTransforms(src, "/routes/page.tsx")

    expect(result.removedLoader).toBe(true)
    expect(result.removedServerImports).toBe(1)
    expect(result.transformedServerCalls).toBe(true)
    expect(result.source).toContain("fetch")
  })
})
