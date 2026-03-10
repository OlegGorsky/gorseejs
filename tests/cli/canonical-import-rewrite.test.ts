import { afterAll, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  rewriteCanonicalImports,
  rewriteCanonicalImportsInProject,
  rewriteLegacyLoaders,
  rewriteLegacyLoadersInProject,
} from "../../src/cli/canonical-import-rewrite.ts"

const TMP = join(import.meta.dir, "../.tmp-canonical-import-rewrite")

afterAll(async () => {
  await rm(TMP, { recursive: true, force: true })
})

describe("canonical import rewrite", () => {
  test("rewrites mixed gorsee/server imports into runtime and scoped imports", () => {
    const input = [
      'import { createAuth, routeCache, type Context, createDB } from "gorsee/server"',
      'import { Head } from "gorsee/client"',
      "",
      "export function GET(_ctx: Context) {",
      "  return Response.json({ ok: !!createAuth && !!routeCache && !!createDB && !!Head })",
      "}",
    ].join("\n")

    const result = rewriteCanonicalImports(input)

    expect(result.changed).toBe(true)
    expect(result.source).toContain('import { routeCache, type Context } from "gorsee/server"')
    expect(result.source).toContain('import { createAuth } from "gorsee/auth"')
    expect(result.source).toContain('import { createDB } from "gorsee/db"')
  })

  test("rewrites mixed gorsee/client imports into runtime and scoped imports", () => {
    const input = [
      'import { Head, defineForm, createTypedRoute } from "gorsee/client"',
      "",
      "export default function Page() {",
      "  return <main>{String(!!Head && !!defineForm && !!createTypedRoute)}</main>",
      "}",
    ].join("\n")

    const result = rewriteCanonicalImports(input)

    expect(result.changed).toBe(true)
    expect(result.source).toContain('import { Head } from "gorsee/client"')
    expect(result.source).toContain('import { defineForm } from "gorsee/forms"')
    expect(result.source).toContain('import { createTypedRoute } from "gorsee/routes"')
  })

  test("rewrites root gorsee imports into canonical stable entrypoints and compat fallback", () => {
    const result = rewriteCanonicalImports([
      'import { Head, createAuth, definePlugin, LegacyThing } from "gorsee"',
    ].join("\n"))

    expect(result.changed).toBe(true)
    expect(result.source).toContain('import { Head } from "gorsee/client"')
    expect(result.source).toContain('import { createAuth } from "gorsee/auth"')
    expect(result.source).toContain('import { definePlugin } from "gorsee/plugins"')
    expect(result.source).toContain('import { LegacyThing } from "gorsee/compat"')
  })

  test("rewriteCanonicalImportsInProject updates project files in place", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, "routes"), { recursive: true })
    await mkdir(join(TMP, "shared"), { recursive: true })

    await writeFile(join(TMP, "routes", "index.tsx"), [
      'import { Head, defineForm } from "gorsee/client"',
      'import { createAuth, type Session } from "gorsee/server"',
      "",
      "export default function Page() {",
      "  return <main>{String(!!Head && !!defineForm && !!createAuth && !!Session)}</main>",
      "}",
    ].join("\n"))

    const report = await rewriteCanonicalImportsInProject(TMP)
    const rewritten = await readFile(join(TMP, "routes", "index.tsx"), "utf-8")

    expect(report.changedFiles).toEqual(["routes/index.tsx"])
    expect(rewritten).toContain('import { Head } from "gorsee/client"')
    expect(rewritten).toContain('import { defineForm } from "gorsee/forms"')
    expect(rewritten).toContain('import { createAuth, type Session } from "gorsee/auth"')
  })

  test("rewrites legacy loader exports to canonical load", () => {
    const input = [
      "export async function loader() {",
      '  return { ok: true }',
      "}",
    ].join("\n")

    const result = rewriteLegacyLoaders(input)

    expect(result.changed).toBe(true)
    expect(result.source).toContain("export async function load()")
    expect(result.source).not.toContain("export async function loader()")
  })

  test("rewriteLegacyLoadersInProject updates loader exports in place", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, "routes"), { recursive: true })

    await writeFile(join(TMP, "routes", "report.tsx"), [
      "export const loader = async () => ({ ok: true })",
      "export default function ReportPage() {",
      "  return <main>report</main>",
      "}",
    ].join("\n"))

    const report = await rewriteLegacyLoadersInProject(TMP)
    const rewritten = await readFile(join(TMP, "routes", "report.tsx"), "utf-8")

    expect(report.changedFiles).toEqual(["routes/report.tsx"])
    expect(rewritten).toContain("export const load = async () => ({ ok: true })")
  })
})
