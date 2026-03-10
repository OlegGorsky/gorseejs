import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("dx policy", () => {
  test("package and verify surface expose dx policy gate", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts["dx:policy"]).toContain("dx-policy-check.mjs")
    expect(pkg.scripts["verify:security"]).toContain("bun run dx:policy")
  })

  test("dx policy script enforces onboarding, upgrade, and rollout docs", async () => {
    const script = await readFile(join(ROOT, "scripts", "dx-policy-check.mjs"), "utf-8")
    expect(script).toContain("docs/STARTER_ONBOARDING.md")
    expect(script).toContain("docs/MIGRATION_GUIDE.md")
    expect(script).toContain("docs/UPGRADE_PLAYBOOK.md")
    expect(script).toContain("docs/DEPLOY_TARGET_GUIDE.md")
    expect(script).toContain("docs/FIRST_PRODUCTION_ROLLOUT.md")
    expect(script).toContain("docs/AUTH_CACHE_DATA_PATHS.md")
    expect(script).toContain("docs/RECIPE_BOUNDARIES.md")
    expect(script).toContain("docs/WORKSPACE_ADOPTION.md")
    expect(script).toContain("docs/TEAM_FAILURES.md")
    expect(script).toContain("dx:policy OK")
  })

  test("dx docs are part of shipped adoption surface", async () => {
    const starter = await readFile(join(ROOT, "docs", "STARTER_ONBOARDING.md"), "utf-8")
    const migration = await readFile(join(ROOT, "docs", "MIGRATION_GUIDE.md"), "utf-8")
    const upgrade = await readFile(join(ROOT, "docs", "UPGRADE_PLAYBOOK.md"), "utf-8")
    const workspace = await readFile(join(ROOT, "docs", "WORKSPACE_ADOPTION.md"), "utf-8")
    const boundaries = await readFile(join(ROOT, "docs", "RECIPE_BOUNDARIES.md"), "utf-8")

    expect(starter).toContain("Choose an App Class")
    expect(migration).toContain("gorsee/client")
    expect(migration).toContain("gorsee/forms")
    expect(migration).toContain("gorsee/routes")
    expect(migration).toContain("UG013")
    expect(migration).toContain("UG009")
    expect(migration).toContain("UG010")
    expect(migration).toContain("UG011")
    expect(upgrade).toContain("canary")
    expect(workspace).toContain("apps/web")
    expect(boundaries).toContain("Do Not Use Secure SaaS")
  })
})
