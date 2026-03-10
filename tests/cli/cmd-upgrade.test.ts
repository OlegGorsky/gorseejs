import { afterAll, describe, it, expect } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  collectUpgradeIssues,
  compareVersions,
  performUpgrade,
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
    expect(codes).toContain("UG013")
    expect(codes).toContain("UG009")
    expect(codes).toContain("UG010")
    expect(codes).toContain("UG011")
    expect(codes).toContain("UG012")
  })

  it("writeUpgradeReport emits a machine-readable artifact", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })

    await writeUpgradeReport(TMP, "docs/upgrade-report.json", {
      schemaVersion: 1,
      generatedAt: "2026-03-09T00:00:00.000Z",
      appMode: "server",
      currentVersion: "1.0.0",
      latestVersion: "1.1.0",
      upgradeAvailable: true,
      recommendedDocs: ["docs/APPLICATION_MODES.md"],
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
    expect(artifact.appMode).toBe("server")
    expect(artifact.upgradeAvailable).toBe(true)
    expect(artifact.recommendedDocs).toContain("docs/APPLICATION_MODES.md")
    expect(artifact.issues[0].code).toBe("UG001")
  })

  it("performUpgrade in check mode writes report without installing", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    await writeFile(join(TMP, "package.json"), JSON.stringify({
      name: "tmp-upgrade-app",
      version: "0.0.0",
      packageManager: "bun@1.3.9",
    }, null, 2))
    await writeFile(join(TMP, "app.config.ts"), `export default { app: { mode: "frontend" } }\n`)
    await writeFile(join(TMP, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        jsx: "preserve",
        jsxImportSource: "gorsee",
      },
    }, null, 2))

    let installCalled = false
    let checkCalled = false

    const result = await performUpgrade(TMP, parseUpgradeFlags(["--check"]), {
      getCurrentVersion: async () => "0.2.6",
      fetchLatestVersion: async () => "0.2.7",
      runInstallStep: async () => {
        installCalled = true
        return { command: ["bun", "add", "--exact", "gorsee@0.2.7"], exitCode: 0 }
      },
      runCheckStep: async () => {
        checkCalled = true
        return { command: ["bun", "run", "check"], exitCode: 0 }
      },
    })

    expect(result?.installed).toBe(false)
    expect(result?.reportPath).toBe("docs/upgrade-report.json")
    expect(installCalled).toBe(false)
    expect(checkCalled).toBe(false)

    const artifact = JSON.parse(await Bun.file(join(TMP, "docs/upgrade-report.json")).text())
    expect(artifact.appMode).toBe("frontend")
    expect(artifact.currentVersion).toBe("0.2.6")
    expect(artifact.latestVersion).toBe("0.2.7")
    expect(artifact.upgradeAvailable).toBe(true)
    expect(artifact.recommendedDocs).toContain("docs/APPLICATION_MODES.md")
  })

  it("performUpgrade installs latest, rewrites drift, and runs verification by default", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, "routes"), { recursive: true })
    await writeFile(join(TMP, "package.json"), JSON.stringify({
      name: "tmp-upgrade-app",
      version: "0.0.0",
      packageManager: "bun@1.3.9",
    }, null, 2))
    await writeFile(join(TMP, "app.config.ts"), `export default { app: { mode: "fullstack" } }\n`)
    await writeFile(join(TMP, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        jsx: "preserve",
        jsxImportSource: "gorsee",
      },
    }, null, 2))
    await writeFile(join(TMP, "routes", "index.tsx"), `import { Head, defineForm } from "gorsee/client"
import { createAuth } from "gorsee/server"
export async function loader() { return { ok: true } }
export default function Page() { return <main>{String(!!Head && !!defineForm && !!createAuth)}</main> }`)

    const commands: string[] = []
    let installedVersion = "0.2.6"

    const result = await performUpgrade(TMP, parseUpgradeFlags([]), {
      getCurrentVersion: async () => installedVersion,
      fetchLatestVersion: async () => "0.2.7",
      runInstallStep: async (_cwd, version) => {
        commands.push("install")
        installedVersion = "0.2.7"
        return { command: ["bun", "add", "--exact", `gorsee@${version}`], exitCode: 0 }
      },
      runCheckStep: async () => {
        commands.push("check")
        return { command: ["bun", "run", "check"], exitCode: 0 }
      },
    })

    expect(result?.installed).toBe(true)
    expect(result?.installResult?.command).toEqual(["bun", "add", "--exact", "gorsee@0.2.7"])
    expect(result?.checkResult?.command).toEqual(["bun", "run", "check"])
    expect(commands).toEqual(["install", "check"])
    expect(result?.changedFiles).toContain("routes/index.tsx")

    const rewritten = await Bun.file(join(TMP, "routes", "index.tsx")).text()
    expect(rewritten).toContain('import { Head } from "gorsee/client"')
    expect(rewritten).toContain('import { defineForm } from "gorsee/forms"')
    expect(rewritten).toContain('import { createAuth } from "gorsee/auth"')
    expect(rewritten).toContain("export async function load()")

    const artifact = JSON.parse(await Bun.file(join(TMP, "docs/upgrade-report.json")).text())
    expect(artifact.appMode).toBe("fullstack")
    expect(artifact.currentVersion).toBe("0.2.7")
    expect(artifact.latestVersion).toBe("0.2.7")
    expect(artifact.upgradeAvailable).toBe(false)
    expect(artifact.recommendedDocs).toContain("docs/APPLICATION_MODES.md")
  })
})
