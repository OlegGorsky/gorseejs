import { afterAll, describe, it, expect } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  collectUpgradeIssues,
  compareVersions,
  parseUpgradeFlags,
  NPM_REGISTRY_URL,
  writeUpgradeReport,
} from "../../src/cli/cmd-upgrade.ts"

const TMP = join(import.meta.dir, "../.tmp-cmd-upgrade")

afterAll(async () => {
  await rm(TMP, { recursive: true, force: true })
})

describe("cmd-upgrade", () => {
  it("compareVersions equal", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0)
    expect(compareVersions("v1.0.0", "1.0.0")).toBe(0)
  })

  it("compareVersions less than", () => {
    expect(compareVersions("1.0.0", "1.0.1")).toBe(-1)
    expect(compareVersions("1.0.0", "1.1.0")).toBe(-1)
    expect(compareVersions("1.0.0", "2.0.0")).toBe(-1)
  })

  it("compareVersions greater than", () => {
    expect(compareVersions("1.0.1", "1.0.0")).toBe(1)
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1)
  })

  it("parseUpgradeFlags --check", () => {
    const flags = parseUpgradeFlags(["--check"])
    expect(flags.check).toBe(true)
    expect(flags.force).toBe(false)
  })

  it("parseUpgradeFlags --force", () => {
    const flags = parseUpgradeFlags(["--force"])
    expect(flags.force).toBe(true)
    expect(flags.check).toBe(false)
    expect(flags.report).toBeNull()
  })

  it("parseUpgradeFlags --report", () => {
    const flags = parseUpgradeFlags(["--check", "--report", "docs/upgrade-report.json"])
    expect(flags.check).toBe(true)
    expect(flags.report).toBe("docs/upgrade-report.json")
  })

  it("parseUpgradeFlags --rewrite-imports", () => {
    const flags = parseUpgradeFlags(["--rewrite-imports", "--check"])
    expect(flags.rewriteImports).toBe(true)
    expect(flags.check).toBe(true)
  })

  it("npm registry URL is correct", () => {
    expect(NPM_REGISTRY_URL).toBe("https://registry.npmjs.org/gorsee/latest")
  })

  it("collectUpgradeIssues audits canonical migration drift", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, "routes"), { recursive: true })
    await writeFile(join(TMP, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
      },
    }, null, 2))
    await writeFile(join(TMP, "app.config.ts"), `export default { ssr: true, security: { origin: "https://example.com" } }`)
    await writeFile(join(TMP, "package.json"), JSON.stringify({
      name: "tmp-upgrade-app",
      version: "0.0.0",
    }, null, 2))
    await writeFile(join(TMP, "routes", "index.tsx"), `import { Head, defineForm } from "gorsee/client"
import { createAuth } from "gorsee/server"
import { Link } from "gorsee"
export async function loader() { return { ok: true } }
export default function Page() { return <main>{String(!!Head && !!defineForm && !!createAuth && !!Link)}</main> }`)

    const issues = await collectUpgradeIssues(TMP)
    const codes = issues.map((entry) => entry.code)

    expect(codes).toContain("UG001")
    expect(codes).toContain("UG002")
    expect(codes).toContain("UG004")
    expect(codes).toContain("UG005")
    expect(codes).toContain("UG007")
    expect(codes).toContain("UG008")
    expect(codes).toContain("UG009")
    expect(codes).toContain("UG010")
    expect(codes).toContain("UG011")
  })

  it("writeUpgradeReport emits a machine-readable artifact", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })

    await writeUpgradeReport(TMP, "docs/upgrade-report.json", {
      schemaVersion: 1,
      generatedAt: "2026-03-09T00:00:00.000Z",
      currentVersion: "1.0.0",
      latestVersion: "1.1.0",
      upgradeAvailable: true,
      issues: [{
        code: "UG001",
        file: "tsconfig.json",
        severity: "warn",
        message: "test",
        fix: "fix",
      }],
    })

    const artifact = JSON.parse(await Bun.file(join(TMP, "docs/upgrade-report.json")).text())
    expect(artifact.schemaVersion).toBe(1)
    expect(artifact.upgradeAvailable).toBe(true)
    expect(artifact.issues[0].code).toBe("UG001")
  })
})
