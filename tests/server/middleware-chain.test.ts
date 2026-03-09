import { describe, it, expect } from "bun:test"
import { createRouter } from "../../src/router/scanner.ts"
import { mkdir, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("Middleware chain inheritance", () => {
  const TMP = join(tmpdir(), "gorsee-mw-chain-" + Date.now())

  async function setup() {
    await mkdir(join(TMP, "admin", "settings"), { recursive: true })
    await writeFile(join(TMP, "_middleware.ts"), "export default async (ctx, next) => next()")
    await writeFile(join(TMP, "index.tsx"), "export default () => ({ type: 'div', props: { children: 'home' } })")
    await writeFile(join(TMP, "admin", "_middleware.ts"), "export default async (ctx, next) => next()")
    await writeFile(join(TMP, "admin", "index.tsx"), "export default () => ({ type: 'div', props: { children: 'admin' } })")
    await writeFile(join(TMP, "admin", "settings", "index.tsx"), "export default () => ({ type: 'div', props: { children: 'settings' } })")
  }

  async function cleanup() {
    await rm(TMP, { recursive: true, force: true })
  }

  it("root route has only root middleware", async () => {
    await setup()
    try {
      const routes = await createRouter(TMP)
      const home = routes.find((r) => r.path === "/")
      expect(home).toBeDefined()
      expect(home!.middlewarePaths.length).toBe(1)
    } finally {
      await cleanup()
    }
  })

  it("nested route inherits parent middleware chain", async () => {
    await setup()
    try {
      const routes = await createRouter(TMP)
      const admin = routes.find((r) => r.path === "/admin")
      expect(admin).toBeDefined()
      expect(admin!.middlewarePaths.length).toBe(2)
      // Root middleware comes first, then admin middleware
      expect(admin!.middlewarePaths[0]).toContain("_middleware.ts")
      expect(admin!.middlewarePaths[1]).toContain(join("admin", "_middleware.ts"))
    } finally {
      await cleanup()
    }
  })

  it("deeply nested route inherits ancestor middleware", async () => {
    await setup()
    try {
      const routes = await createRouter(TMP)
      const settings = routes.find((r) => r.path === "/admin/settings")
      expect(settings).toBeDefined()
      // Inherits root + admin (settings dir has no own middleware)
      expect(settings!.middlewarePaths.length).toBe(2)
    } finally {
      await cleanup()
    }
  })
})

describe("Loading path inheritance", () => {
  const TMP = join(tmpdir(), "gorsee-loading-" + Date.now())

  it("inherits _loading.tsx from parent directory", async () => {
    await mkdir(join(TMP, "blog"), { recursive: true })
    await writeFile(join(TMP, "_loading.tsx"), "export default () => ({ type: 'div', props: { children: 'Loading...' } })")
    await writeFile(join(TMP, "index.tsx"), "export default () => ({ type: 'div', props: {} })")
    await writeFile(join(TMP, "blog", "index.tsx"), "export default () => ({ type: 'div', props: {} })")

    try {
      const routes = await createRouter(TMP)
      const home = routes.find((r) => r.path === "/")
      expect(home!.loadingPath).toContain("_loading.tsx")

      const blog = routes.find((r) => r.path === "/blog")
      expect(blog!.loadingPath).toContain("_loading.tsx")
    } finally {
      await rm(TMP, { recursive: true, force: true })
    }
  })
})
