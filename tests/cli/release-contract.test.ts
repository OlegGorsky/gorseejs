import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("release contract surface", () => {
  test("release contract manifest and scripts stay aligned", async () => {
    const manifest = JSON.parse(await readFile(join(ROOT, "docs", "RELEASE_CONTRACT.json"), "utf-8")) as {
      version: number
      channels: Array<{ name: string; checkScript: string; versionScript: string; npmTag: string }>
      requiredPolicyScripts: string[]
      requiredVerificationScripts: string[]
      requiredReleaseScripts: string[]
      requiredDocs: string[]
      modeContextRequirements: string[]
    }
    const trainScript = await readFile(join(ROOT, "scripts", "release-train-check.mjs"), "utf-8")
    const checklistScript = await readFile(join(ROOT, "scripts", "release-checklist-check.mjs"), "utf-8")

    expect(manifest.version).toBe(1)
    expect(manifest.channels).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "stable", checkScript: "release:stable:check", versionScript: "release:version:stable", npmTag: "latest" }),
      expect.objectContaining({ name: "canary", checkScript: "release:canary:check", versionScript: "release:version:canary", npmTag: "canary" }),
      expect.objectContaining({ name: "rc", checkScript: "release:rc:check", versionScript: "release:version:rc", npmTag: "rc" }),
    ]))
    expect(manifest.requiredPolicyScripts).toEqual(expect.arrayContaining(["api:policy", "adoption:policy", "critical:surface"]))
    expect(manifest.requiredVerificationScripts).toEqual(expect.arrayContaining(["test:critical-surface", "test:confidence", "test"]))
    expect(manifest.requiredReleaseScripts).toEqual(expect.arrayContaining(["release:check", "install:matrix", "release:smoke"]))
    expect(manifest.requiredDocs).toEqual(expect.arrayContaining(["docs/RELEASE_POLICY.md", "docs/RELEASE_CHECKLIST.md", "docs/APPLICATION_MODES.md", "docs/RELEASE_CONTRACT.json"]))
    expect(manifest.modeContextRequirements).toEqual(expect.arrayContaining([
      "app.mode must stay explicit in mature apps",
      "runtime.topology must stay aligned with release diagnostics",
      "deploy target compatibility must stay aligned with frontend/fullstack/server mode contracts",
    ]))
    expect(trainScript).toContain("docs/RELEASE_CONTRACT.json")
    expect(checklistScript).toContain("docs/RELEASE_CONTRACT.json")
  })

  test("release docs and README expose machine-readable release contract", async () => {
    const readme = await readFile(join(ROOT, "README.md"), "utf-8")
    const policy = await readFile(join(ROOT, "docs", "RELEASE_POLICY.md"), "utf-8")
    const checklist = await readFile(join(ROOT, "docs", "RELEASE_CHECKLIST.md"), "utf-8")
    const support = await readFile(join(ROOT, "docs", "SUPPORT_MATRIX.md"), "utf-8")

    expect(readme).toContain("Release Contract")
    expect(policy).toContain("docs/RELEASE_CONTRACT.json")
    expect(policy).toContain("docs/APPLICATION_MODES.md")
    expect(policy).toContain("app.mode")
    expect(checklist).toContain("Machine-readable companion: `docs/RELEASE_CONTRACT.json`")
    expect(checklist).toContain("runtime.topology")
    expect(support).toContain("docs/RELEASE_CONTRACT.json")
  })
})
