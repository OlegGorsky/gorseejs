import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("install matrix", () => {
  test("package scripts expose install matrix gate", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8"))
    expect(pkg.scripts["install:matrix"]).toBe("node scripts/install-matrix-check.mjs")
    expect(pkg.scripts["release:verify"]).toContain("npm run install:matrix")
    expect(pkg.scripts.prepublishOnly).toContain("npm run install:matrix")
  })

  test("install matrix script exercises source and tarball app paths", async () => {
    const script = await readFile(join(ROOT, "scripts", "install-matrix-check.mjs"), "utf-8")
    expect(script).toContain("source-app")
    expect(script).toContain("tarball-app")
    expect(script).toContain("standalone-bootstrap-app")
    expect(script).toContain("function exerciseInstalledSubpathImports(rootDir)")
    expect(script).toContain('await import("gorsee/auth")')
    expect(script).toContain('await import("gorsee/forms")')
    expect(script).toContain('await import("gorsee/routes")')
    expect(script).toContain('await import("gorsee/i18n")')
    expect(script).toContain('await import("gorsee/content")')
    expect(script).toContain('await import("gorsee/deploy")')
    expect(script).toContain('await import("gorsee/testing")')
    expect(script).toContain("exerciseInstalledSubpathImports(tarballApp)")
    expect(script).toContain('gorsee/auth packed export missing createAuth')
    expect(script).toContain('gorsee/forms packed export missing defineFormAction')
    expect(script).toContain('gorsee/routes packed export missing createTypedRoute')
    expect(script).toContain('gorsee/i18n packed export missing setupI18n')
    expect(script).toContain('gorsee/content packed export missing parseFrontmatter')
    expect(script).toContain('gorsee/deploy packed export missing generateDockerfile')
    expect(script).toContain('gorsee/testing packed export missing createTestRequest')
    expect(script).toContain('const sandboxRoot = join(matrixRoot, "examples"')
    expect(script).toContain('cpSync(exampleDir, sandboxRoot, { recursive: true })')
    expect(script).toContain("exerciseWorkspaceExample")
    expect(script).toContain("gorsee-workspace-smoke")
    expect(script).toContain('create-gorsee", "package.json')
    expect(script).toContain('runIn(matrixRoot, "node", [join(standaloneCreateRoot, "index.js"), "standalone-bootstrap-app"])')
    expect(script).toContain('@workspace/shared')
    expect(script).toContain("workspace-shared-ready")
    expect(script).toContain('examples", "secure-saas')
    expect(script).toContain('examples", "content-site')
    expect(script).toContain('examples", "agent-aware-ops')
    expect(script).toContain('examples", "frontend-app')
    expect(script).toContain('examples", "server-api')
    expect(script).toContain('examples", "workspace-monorepo')
    expect(script).toContain('const bin = join(sandboxRoot, "node_modules", ".bin", "gorsee")')
    expect(script).toContain('const bin = join(sandboxRoot, "apps", "web", "node_modules", ".bin", "gorsee")')
    expect(script).toContain('["check"]')
    expect(script).toContain('["typegen"]')
    expect(script).toContain('["docs", "--output", "docs/api.json", "--format", "json"]')
    expect(script).toContain('["build"]')
    expect(script).toContain('import("./dist/prod-node.js")')
    expect(script).toContain('import("./dist/server-handler-node.js")')
    expect(script).toContain('from "gorsee/auth"')
    expect(script).toContain('import type { Context } from "gorsee/server"')
    expect(script).toContain("monorepo app lost shared package import contract")
    expect(script).toContain("monorepo app lost gorsee/auth import contract")
    expect(script).toContain("monorepo app lost gorsee/server context contract")
    expect(script).toContain("workspace example lost shared import contract")
    expect(script).toContain("workspace example lost gorsee/auth contract")
    expect(script).toContain("workspace example lost gorsee/server context contract")
  })

  test("workspace example app scripts point at the repo CLI from the actual package depth", async () => {
    const workspaceAppPkg = JSON.parse(
      await readFile(join(ROOT, "examples", "workspace-monorepo", "apps", "web", "package.json"), "utf-8"),
    ) as { scripts: Record<string, string> }

    expect(workspaceAppPkg.scripts.build).toContain("../../../../src/cli/index.ts")
    expect(workspaceAppPkg.scripts.check).toContain("../../../../src/cli/index.ts")
    expect(workspaceAppPkg.scripts.start).toContain("../../../../src/cli/index.ts")
  })
})
