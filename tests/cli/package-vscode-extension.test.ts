import { afterEach, describe, expect, test } from "bun:test"
import { access, readFile, rm } from "node:fs/promises"
import { join } from "node:path"

describe("vscode extension packaging path", () => {
  afterEach(async () => {
    await rm(join(process.cwd(), "dist", "vscode-gorsee-ai"), { recursive: true, force: true })
  })

  test("extension manifest and packaging script build a VSIX artifact", async () => {
    const manifest = JSON.parse(await readFile(join(process.cwd(), "integrations/vscode-gorsee-ai/package.json"), "utf-8"))
    const script = await readFile(join(process.cwd(), "scripts/package-vscode-ai-extension.mjs"), "utf-8")
    const packageJson = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf-8"))
    const run = Bun.spawn(["node", "scripts/package-vscode-ai-extension.mjs"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(await run.exited).toBe(0)

    expect(manifest.main).toBe("./extension.js")
    expect(script).toContain("extension.vsixmanifest")
    expect(packageJson.scripts["ai:package:vscode"]).toBe("node scripts/package-vscode-ai-extension.mjs")
    expect(packageJson.scripts["release:extension"]).toBe("node scripts/release-vscode-extension.mjs")
    await access(join(process.cwd(), "dist", "vscode-gorsee-ai", `gorsee-ai-tools-${packageJson.version}.vsix`))
  })

  test("release extension script emits structured release events", async () => {
    await rm(join(process.cwd(), ".gorsee"), { recursive: true, force: true })
    const packageJson = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf-8"))
    const run = Bun.spawn(["node", "scripts/release-vscode-extension.mjs"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(await run.exited).toBe(0)
    const events = await readFile(join(process.cwd(), ".gorsee", "ai-events.jsonl"), "utf-8")
    expect(events).toContain("release.extension.start")
    expect(events).toContain("release.extension.finish")
    expect(events).toContain(`gorsee-ai-tools-${packageJson.version}.vsix`)
    const pack = await readFile(join(process.cwd(), ".gorsee", "agent", "latest.json"), "utf-8")
    expect(pack).toContain(`gorsee-ai-tools-${packageJson.version}.vsix`)
  })
})
