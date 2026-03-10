import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("create bootstrap surface", () => {
  test("create-gorsee package ships a Node-safe launcher", async () => {
    const pkg = JSON.parse(
      await readFile(join(ROOT, "create-gorsee", "package.json"), "utf-8"),
    ) as {
      bin: Record<string, string>
      dependencies: Record<string, string>
      files: string[]
      engines: Record<string, string>
    }
    const rootPkg = JSON.parse(
      await readFile(join(ROOT, "package.json"), "utf-8"),
    ) as {
      version: string
    }
    const launcher = await readFile(join(ROOT, "create-gorsee", "index.js"), "utf-8")

    expect(pkg.bin["create-gorsee"]).toBe("index.js")
    expect(pkg.dependencies.gorsee).toBe(rootPkg.version)
    expect(pkg.files).toContain("index.js")
    expect(pkg.engines.node).toBe(">=20")
    expect(launcher.startsWith("#!/usr/bin/env node")).toBe(true)
    expect(launcher).toContain('import { runCreate } from "gorsee/cli/cmd-create"')
    expect(launcher).toContain("npx create-gorsee <project-name>")
    expect(launcher).toContain("npm create gorsee@latest <project-name>")
    expect(launcher).toContain("bunx gorsee create <project-name>")
  })

  test("docs advertise Bun and Node bootstrap entry paths", async () => {
    const readme = await readFile(join(ROOT, "README.md"), "utf-8")
    const onboarding = await readFile(join(ROOT, "docs", "STARTER_ONBOARDING.md"), "utf-8")
    const supportMatrix = await readFile(join(ROOT, "docs", "SUPPORT_MATRIX.md"), "utf-8")

    expect(readme).toContain("bunx gorsee create my-app --template secure-saas")
    expect(readme).toContain("bunx gorsee create my-frontend --template frontend")
    expect(readme).toContain("bunx gorsee create my-service --template server-api")
    expect(readme).toContain("bunx gorsee create my-service --template worker-service")
    expect(readme).toContain("gorsee worker")
    expect(readme).toContain("npx create-gorsee my-app")
    expect(readme).toContain("npm create gorsee@latest my-app")

    expect(onboarding).toContain("Canonical bootstrap entry paths")
    expect(onboarding).toContain("npx create-gorsee my-app")
    expect(onboarding).toContain("npm create gorsee@latest my-app")
    expect(onboarding).toContain("worker-service")
    expect(onboarding).toContain("gorsee worker")

    expect(supportMatrix).toContain("starter bootstrap must stay available through `bunx gorsee create`, `npx create-gorsee`, and `npm create gorsee@latest`")
    expect(supportMatrix).toContain("starter bootstrap via `bunx gorsee create`, `npx create-gorsee`, or `npm create gorsee@latest`")
    expect(supportMatrix).toContain("canonical Bun-first server-mode worker runtime via `gorsee worker` or `bun run worker`")
  })
})
