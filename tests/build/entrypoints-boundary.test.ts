import { describe, test, expect } from "bun:test"
import { join } from "node:path"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { pathToFileURL } from "node:url"

const REPO_ROOT = join(import.meta.dir, "../..")

describe("entrypoint boundaries", () => {
  test("gorsee/client bundle does not pull server-only modules", async () => {
    const root = await mkdtemp(join(tmpdir(), "gorsee-client-boundary-"))
    const entry = join(root, "entry.tsx")
    const outdir = join(root, "dist")

    try {
      await writeFile(
        entry,
        `import { createSignal } from "gorsee/client";
const [count] = createSignal(1);
export default <div>{count()}</div>;
`,
      )

      const result = await Bun.build({
        entrypoints: [entry],
        outdir,
        target: "browser",
        format: "esm",
        splitting: false,
        jsx: {
          runtime: "automatic",
          importSource: "gorsee",
          development: true,
        },
        plugins: [
          {
            name: "gorsee-entrypoint-boundary",
            setup(build) {
              build.onResolve({ filter: /^gorsee\/client$/ }, () => ({
                path: join(REPO_ROOT, "src/client.ts"),
              }))
              build.onResolve({ filter: /^gorsee\/jsx(?:-dev)?-runtime$/ }, () => ({
                path: join(REPO_ROOT, "src/jsx-runtime-client.ts"),
              }))
            },
          },
        ],
      })

      expect(result.success).toBe(true)

      const outputs = result.outputs.filter((o) => o.path.endsWith(".js"))
      expect(outputs.length).toBeGreaterThan(0)
      const text = await outputs[0]!.text()
      expect(text).toContain("createSignal")
      expect(text).not.toContain("node:crypto")
      expect(text).not.toContain("createAuth")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("gorsee/server exports server-facing APIs", async () => {
    const mod = await import(pathToFileURL(join(REPO_ROOT, "src/server-entry.ts")).href)

    expect(typeof mod.server).toBe("function")
    expect(typeof mod.middleware).toBe("function")
    expect(typeof mod.createAuth).toBe("function")
    expect(typeof mod.createDB).toBe("function")
    expect(typeof mod.securityHeaders).toBe("function")
    expect(typeof mod.env).toBe("function")
    expect(typeof mod.log.info).toBe("function")
  })

  test("workspace self-reference gorsee/server resolves the stable server surface", async () => {
    const mod = await import("gorsee/server")

    expect(typeof mod.server).toBe("function")
    expect(typeof mod.middleware).toBe("function")
    expect(typeof mod.createAuth).toBe("function")
    expect(typeof mod.createDB).toBe("function")
    expect(typeof mod.securityHeaders).toBe("function")
    expect(typeof mod.env).toBe("function")
    expect(typeof mod.log.info).toBe("function")
  })

  test("workspace self-reference gorsee/forms resolves the stable forms surface", async () => {
    const mod = await import("gorsee/forms")

    expect(typeof mod.defineForm).toBe("function")
    expect(typeof mod.validateForm).toBe("function")
    expect(typeof mod.useFormAction).toBe("function")
  })

  test("workspace self-reference gorsee/routes resolves the stable routes surface", async () => {
    const mod = await import("gorsee/routes")

    expect(typeof mod.createTypedRoute).toBe("function")
    expect(typeof mod.typedLink).toBe("function")
    expect(typeof mod.typedNavigate).toBe("function")
  })

  test("gorsee/client exports browser-facing APIs only", async () => {
    const mod = await import(pathToFileURL(join(REPO_ROOT, "src/client.ts")).href)

    expect(typeof mod.createSignal).toBe("function")
    expect(typeof mod.Link).toBe("function")
    expect(typeof mod.Head).toBe("function")
    expect(typeof mod.island).toBe("function")
    expect("createAuth" in mod).toBe(false)
    expect("createDB" in mod).toBe(false)
    expect("middleware" in mod).toBe(false)
  })
})
