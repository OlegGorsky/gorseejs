import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("runtime security contract surface", () => {
  test("package and verify surface expose runtime security gate", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }

    expect(pkg.scripts["runtime:security:policy"]).toContain("runtime-security-contract-check.mjs")
    expect(pkg.scripts["verify:security"]).toContain("bun run runtime:security:policy")
  })

  test("runtime security policy script and docs stay aligned", async () => {
    const script = await readFile(join(ROOT, "scripts", "runtime-security-contract-check.mjs"), "utf-8")
    const securityModel = await readFile(join(ROOT, "docs", "SECURITY_MODEL.md"), "utf-8")
    const adapterSecurity = await readFile(join(ROOT, "docs", "ADAPTER_SECURITY.md"), "utf-8")
    const supportMatrix = await readFile(join(ROOT, "docs", "SUPPORT_MATRIX.md"), "utf-8")

    expect(script).toContain("docs/RUNTIME_SECURITY_CONTRACT.json")
    expect(script).toContain("runtime:security:policy OK")
    expect(securityModel).toContain("docs/RUNTIME_SECURITY_CONTRACT.json")
    expect(adapterSecurity).toContain("docs/RUNTIME_SECURITY_CONTRACT.json")
    expect(supportMatrix).toContain("runtime:security:policy")
  })
})
