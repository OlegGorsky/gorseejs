import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("dependency contract surface", () => {
  test("package and verify surface expose dependency policy gate", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }

    expect(pkg.scripts["dependency:policy"]).toContain("dependency-contract-check.mjs")
    expect(pkg.scripts["verify:security"]).toContain("bun run dependency:policy")
  })

  test("dependency contract manifest and policy script stay aligned", async () => {
    const manifest = JSON.parse(await readFile(join(ROOT, "docs", "DEPENDENCY_CONTRACT.json"), "utf-8")) as {
      version: number
      packageManager: string
      bunEngine: string
      runtimeDependencies: Record<string, string>
      devDependencies: Record<string, string>
      requiredFiles: string[]
    }
    const script = await readFile(join(ROOT, "scripts", "dependency-contract-check.mjs"), "utf-8")

    expect(manifest.version).toBe(1)
    expect(manifest.packageManager).toBe("bun@1.3.9")
    expect(manifest.bunEngine).toBe("1.3.9")
    expect(manifest.runtimeDependencies).toMatchObject({
      "alien-signals": "3.1.2",
      "devalue": "5.6.3",
      "oxc-parser": "0.116.0",
      "rolldown": "1.0.0-rc.7",
      "typescript": "5.9.3",
    })
    expect(manifest.devDependencies).toMatchObject({
      "@types/bun": "1.3.10",
      "playwright": "1.58.2",
    })
    expect(manifest.requiredFiles).toEqual(expect.arrayContaining(["src/", "bin/", "README.md", "LICENSE"]))
    expect(script).toContain("docs/DEPENDENCY_CONTRACT.json")
    expect(script).toContain("dependency:policy OK")
  })

  test("dependency docs and support matrix expose machine-readable contract", async () => {
    const readme = await readFile(join(ROOT, "README.md"), "utf-8")
    const dependencyPolicy = await readFile(join(ROOT, "docs", "DEPENDENCY_POLICY.md"), "utf-8")
    const supportMatrix = await readFile(join(ROOT, "docs", "SUPPORT_MATRIX.md"), "utf-8")

    expect(readme).toContain("Dependency Contract")
    expect(readme).toContain("dependency:policy")
    expect(dependencyPolicy).toContain("docs/DEPENDENCY_CONTRACT.json")
    expect(supportMatrix).toContain("docs/DEPENDENCY_CONTRACT.json")
    expect(supportMatrix).toContain("dependency:policy")
  })
})
