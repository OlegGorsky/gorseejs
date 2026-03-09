import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")
const PUBLIC_SURFACE_DOC = join(REPO_ROOT, "docs", "PUBLIC_SURFACE_MAP.md")

function extractStableSubpaths(doc: string): string[] {
  const sectionStart = doc.indexOf("### Specialized Stable Subpaths")
  const productRuleStart = doc.indexOf("## Compatibility Entry Points")
  if (sectionStart === -1 || productRuleStart === -1 || productRuleStart <= sectionStart) {
    throw new Error("PUBLIC_SURFACE_MAP.md lost the Specialized Stable Subpaths section")
  }

  const section = doc.slice(sectionStart, productRuleStart)
  return [...section.matchAll(/- `gorsee\/([^`]+)`/g)].map((match) => `./${match[1]}`)
}

describe("package manifest", () => {
  test("bin and repository metadata match publish-time npm normalization", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      bin: Record<string, string>
      packageManager: string
      files: string[]
      dependencies: Record<string, string>
      repository?: { url: string }
      homepage?: string
    }

    expect(pkg.bin.gorsee).toBe("bin/gorsee.js")
    expect(pkg.packageManager).toBe("bun@1.3.9")
    expect(pkg.repository).toBeUndefined()
    expect(pkg.homepage).toBeUndefined()
    expect(pkg.files).toContain("bin/")
    expect(pkg.files).toContain("src/")
    expect(pkg.dependencies["alien-signals"]).toBe("3.1.2")
    expect(pkg.dependencies.devalue).toBe("5.6.3")
    expect(pkg.dependencies["oxc-parser"]).toBe("0.116.0")
    expect(pkg.dependencies.rolldown).toBe("1.0.0-rc.7")
    expect(pkg.dependencies.typescript).toBe("5.9.3")
  })

  test("bin launcher is Bun-first and avoids shell-wrapping arguments", async () => {
    const bin = await readFile(join(REPO_ROOT, "bin/gorsee.js"), "utf-8")
    expect(bin.startsWith("#!/usr/bin/env bun")).toBe(true)
    expect(bin).toContain('../src/cli/index.ts')
    expect(bin).not.toContain("execSync")
  })

  test("documented specialized stable subpaths are published in package exports", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      exports: Record<string, string>
    }
    const publicSurfaceMap = await readFile(PUBLIC_SURFACE_DOC, "utf-8")
    const documentedStableSubpaths = extractStableSubpaths(publicSurfaceMap)

    expect(documentedStableSubpaths.length).toBeGreaterThan(0)
    for (const subpath of documentedStableSubpaths) {
      expect(pkg.exports[subpath]).toBeDefined()
    }
  })
})
