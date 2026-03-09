import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("runtime smoke surface", () => {
  test("package scripts expose browser and provider smoke gates", async () => {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
      devDependencies: Record<string, string>
    }

    expect(pkg.scripts["test:provider-smoke"]).toBe("bun test tests/deploy/provider-smoke.test.ts")
    expect(pkg.scripts["test:browser-smoke"]).toBe("node scripts/browser-smoke.mjs")
    expect(pkg.devDependencies.playwright).toBe("1.58.2")
  })

  test("browser smoke script exercises production build, start, and browser navigation", async () => {
    const script = await readFile(join(REPO_ROOT, "scripts", "browser-smoke.mjs"), "utf-8")

    expect(script).toContain('from "playwright"')
    expect(script).toContain('["run", cliEntry, "create", "app"]')
    expect(script).toContain('["run", cliEntry, "build"]')
    expect(script).toContain('["run", cliEntry, "start"]')
    expect(script).toContain('await page.click("#counter")')
    expect(script).toContain('await page.click("#about-link")')
    expect(script).toContain('await page.waitForURL(`${origin}/about?tab=details`)')
    expect(script).toContain('page.inputValue("#draft-about")')
    expect(script).toContain('document.activeElement?.id')
    expect(script).toContain("Browser Smoke About")
    expect(script).toContain("browser:smoke OK")
  })
})
