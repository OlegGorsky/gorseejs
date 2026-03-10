import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("deploy contract surface", () => {
  test("package and verify surface expose deploy policy gate", async () => {
    const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>
    }

    expect(pkg.scripts["deploy:policy"]).toContain("deploy-contract-check.mjs")
    expect(pkg.scripts["verify:security"]).toContain("bun run deploy:policy")
  })

  test("deploy contract manifest and policy script stay aligned", async () => {
    const manifest = JSON.parse(await readFile(join(ROOT, "docs", "DEPLOY_CONTRACT.json"), "utf-8")) as {
      version: number
      applicationModes: string[]
      processRuntimeProfiles: string[]
      targets: Array<{ id: string; displayName: string; applicationModes: string[]; runtimeProfiles: string[]; generatedFiles: string[]; cmdDeploySourceToken: string }>
      requiredDocs: string[]
    }
    const script = await readFile(join(ROOT, "scripts", "deploy-contract-check.mjs"), "utf-8")

    expect(manifest.version).toBe(1)
    expect(manifest.applicationModes).toEqual(["frontend", "fullstack", "server"])
    expect(manifest.processRuntimeProfiles).toEqual(["bun", "node"])
    expect(manifest.requiredDocs).toEqual(expect.arrayContaining([
      "docs/DEPLOY_TARGET_GUIDE.md",
      "docs/ADAPTER_SECURITY.md",
      "docs/FIRST_PRODUCTION_ROLLOUT.md",
      "docs/SUPPORT_MATRIX.md",
      "docs/DEPLOY_CONTRACT.json",
    ]))
    expect(manifest.targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "vercel", displayName: "Vercel", applicationModes: ["fullstack", "server"], runtimeProfiles: ["node"] }),
      expect.objectContaining({ id: "cloudflare", displayName: "Cloudflare", applicationModes: ["frontend", "fullstack", "server"], runtimeProfiles: ["bun"] }),
      expect.objectContaining({ id: "netlify", displayName: "Netlify", applicationModes: ["frontend", "fullstack", "server"], runtimeProfiles: ["bun"] }),
      expect.objectContaining({ id: "fly", displayName: "Fly.io", applicationModes: ["fullstack", "server"], runtimeProfiles: ["bun", "node"] }),
      expect.objectContaining({ id: "docker", displayName: "Docker", applicationModes: ["fullstack", "server"], runtimeProfiles: ["bun", "node"] }),
    ]))
    expect(script).toContain("docs/DEPLOY_CONTRACT.json")
    expect(script).toContain("tests/deploy/provider-smoke.test.ts")
    expect(script).toContain("scripts/release-smoke.mjs")
    expect(script).toContain("applicationModes")
    expect(script).toContain("deploy:policy OK")
  })

  test("deploy docs and release contract expose machine-readable deploy contract", async () => {
    const readme = await readFile(join(ROOT, "README.md"), "utf-8")
    const guide = await readFile(join(ROOT, "docs", "DEPLOY_TARGET_GUIDE.md"), "utf-8")
    const adapterSecurity = await readFile(join(ROOT, "docs", "ADAPTER_SECURITY.md"), "utf-8")
    const supportMatrix = await readFile(join(ROOT, "docs", "SUPPORT_MATRIX.md"), "utf-8")
    const rollout = await readFile(join(ROOT, "docs", "FIRST_PRODUCTION_ROLLOUT.md"), "utf-8")
    const releaseContract = await readFile(join(ROOT, "docs", "RELEASE_CONTRACT.json"), "utf-8")

    expect(readme).toContain("Deploy Contract")
    expect(readme).toContain("deploy:policy")
    expect(guide).toContain("docs/DEPLOY_CONTRACT.json")
    expect(guide).toContain("frontend")
    expect(guide).toContain("fullstack")
    expect(guide).toContain("server")
    expect(guide).toContain("Frontend mode: prefer Cloudflare or Netlify until dedicated static-only Docker/Fly generators exist")
    expect(adapterSecurity).toContain("docs/DEPLOY_CONTRACT.json")
    expect(supportMatrix).toContain("docs/DEPLOY_CONTRACT.json")
    expect(supportMatrix).toContain("deploy:policy")
    expect(supportMatrix).toContain("frontend-mode static/prerendered build output")
    expect(supportMatrix).toContain("server-mode process runtime output")
    expect(rollout).toContain("docs/DEPLOY_CONTRACT.json")
    expect(releaseContract).toContain("deploy:policy")
    expect(releaseContract).toContain("docs/DEPLOY_CONTRACT.json")
  })
})
