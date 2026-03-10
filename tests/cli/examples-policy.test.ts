import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("examples policy", () => {
  test("package and verify surface expose examples policy gate", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts["examples:policy"]).toContain("examples-policy-check.mjs")
    expect(pkg.scripts["verify:security"]).toContain("bun run examples:policy")
  })

  test("examples policy script enforces canonical examples surface", async () => {
    const script = await readFile(join(ROOT, "scripts", "examples-policy-check.mjs"), "utf-8")
    expect(script).toContain("examples/secure-saas")
    expect(script).toContain("examples/content-site")
    expect(script).toContain("examples/agent-aware-ops")
    expect(script).toContain("examples/workspace-monorepo")
    expect(script).toContain("packageManager")
    expect(script).toContain("file:../../")
    expect(script).toContain("createAuth")
    expect(script).toContain('from "gorsee/auth"')
    expect(script).toContain('mode: "public"')
    expect(script).toContain('@types/bun')
    expect(script).toContain("1.3.10")
    expect(script).toContain("must not commit bun.lock")
    expect(script).toContain("generated/install artifact")
    expect(script).toContain("node_modules")
    expect(script).toContain(".gorsee")
    expect(script).toContain("examples:policy OK")
  })

  test("examples policy doc defines examples as product surface", async () => {
    const doc = await readFile(join(ROOT, "docs", "EXAMPLES_POLICY.md"), "utf-8")
    expect(doc).toContain("Examples Policy")
    expect(doc).toContain("mature product surface")
    expect(doc).toContain("examples/secure-saas")
    expect(doc).toContain("examples/content-site")
    expect(doc).toContain("examples/agent-aware-ops")
    expect(doc).toContain("examples/workspace-monorepo")
    expect(doc).toContain("clean, reproducible proof surfaces")
    expect(doc).toContain("bun run examples:policy")
  })
})
