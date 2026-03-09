import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("support matrix", () => {
  test("support matrix doc matches primary runtime and documented command surfaces", async () => {
    const doc = await readFile(join(REPO_ROOT, "docs/SUPPORT_MATRIX.md"), "utf-8")
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf-8")) as {
      packageManager: string
      scripts: Record<string, string>
    }

    expect(doc).toContain("package manager contract: `bun@1.3.9`")
    expect(doc).toContain("primary development/build runtime target: Bun")
    expect(doc).toContain("production build runtime entries: `dist/prod.js` for Bun, `dist/prod-node.js` for Node, `dist/server-handler.js` for Bun-compatible fetch adapters, and `dist/server-handler-node.js` for Node-compatible fetch adapters")
    expect(doc).toContain("operating systems: `ubuntu-latest`, `macos-latest`, `windows-latest`")
    expect(doc).toContain("browser runtime smoke: `chromium`, `firefox`, `webkit`")
    expect(pkg.packageManager).toBe("bun@1.3.9")

    expect(doc).toContain("development server via `gorsee dev`")
    expect(doc).toContain("starter bootstrap via `bunx gorsee create`, `npx create-gorsee`, or `npm create gorsee@latest`")
    expect(doc).toContain("production runtime via `gorsee start`")
    expect(doc).toContain("Node production runtime via `gorsee start --runtime node` or `node dist/prod-node.js`")
    expect(doc).toContain("build pipeline via `gorsee build`")
    expect(doc).toContain("type generation, docs generation, and migrations")

    expect(pkg.scripts.dev).toBe("bun run src/dev.ts")
    expect(pkg.scripts.check).toBe("tsc --noEmit")
  })

  test("support matrix doc matches deploy and install validation surfaces", async () => {
    const doc = await readFile(join(REPO_ROOT, "docs/SUPPORT_MATRIX.md"), "utf-8")
    const deploySource = await readFile(join(REPO_ROOT, "src/cli/cmd-deploy.ts"), "utf-8")
    const installMatrixSource = await readFile(join(REPO_ROOT, "scripts/install-matrix-check.mjs"), "utf-8")

    for (const target of ["Vercel", "Netlify", "Fly.io", "Cloudflare", "Docker"]) {
      expect(doc).toContain(target)
    }

    for (const targetLiteral of ['"vercel"', '"fly"', '"cloudflare"', '"netlify"', '"docker"']) {
      expect(deploySource).toContain(targetLiteral)
    }

    expect(doc).toContain("scaffold/install matrix")
    expect(doc).toContain("starter bootstrap must stay available through `bunx gorsee create`, `npx create-gorsee`, and `npm create gorsee@latest`")
    expect(doc).toContain("browser navigation and client hydration on the production runtime")
    expect(doc).toContain("browser navigation and client hydration on Chromium, Firefox, and WebKit")
    expect(doc).toContain("query-bearing navigation plus form/focus/scroll preservation on the production runtime")
    expect(doc).toContain("generated provider handlers serving built output")
    expect(doc).toContain("built Bun and Node production runtime entries plus Bun/Node-compatible server handler artifacts")
    expect(installMatrixSource).toContain("source-app")
    expect(installMatrixSource).toContain("tarball-app")
    expect(installMatrixSource).toContain('["build"]')
  })
})
