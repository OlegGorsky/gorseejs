import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("deprecation surface", () => {
  test("deprecation policy requires a machine-readable deprecation artifact", async () => {
    const policy = await readFile(join(ROOT, "docs", "DEPRECATION_POLICY.md"), "utf-8")
    expect(policy).toContain("docs/DEPRECATION_SURFACE.json")
  })

  test("deprecation surface tracks canonical replacement entrypoints", async () => {
    const artifact = JSON.parse(await readFile(join(ROOT, "docs", "DEPRECATION_SURFACE.json"), "utf-8")) as {
      schemaVersion: number
      entries: Array<{ entrypoint: string; export: string; replacement: string; status: string }>
    }

    expect(artifact.schemaVersion).toBe(1)
    expect(artifact.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ entrypoint: "gorsee/client", export: "defineForm", replacement: "gorsee/forms", status: "deprecated-reexport" }),
      expect.objectContaining({ entrypoint: "gorsee/client", export: "createTypedRoute", replacement: "gorsee/routes", status: "deprecated-reexport" }),
      expect.objectContaining({ entrypoint: "gorsee/server", export: "createAuth", replacement: "gorsee/auth", status: "deprecated-reexport" }),
      expect.objectContaining({ entrypoint: "gorsee/server", export: "createDB", replacement: "gorsee/db", status: "deprecated-reexport" }),
      expect.objectContaining({ entrypoint: "gorsee/server", export: "cors", replacement: "gorsee/security", status: "deprecated-reexport" }),
    ]))
  })

  test("CLI help descriptions expose autofix and migration-aware upgrade behavior", async () => {
    const cli = await readFile(join(ROOT, "src", "cli", "index.ts"), "utf-8")

    expect(cli).toContain('check: "Check project: types, safety, structure, optional canonical autofix"')
    expect(cli).toContain('upgrade: "Upgrade Gorsee.js with migration audit and canonical rewrites"')
  })
})
