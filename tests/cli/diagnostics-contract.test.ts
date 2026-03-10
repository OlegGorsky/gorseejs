import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

describe("diagnostics contract surface", () => {
  test("runtime diagnostics contract manifest and policy script stay aligned", async () => {
    const manifest = JSON.parse(await readFile(join(ROOT, "docs", "DIAGNOSTICS_CONTRACT.json"), "utf-8")) as {
      version: number
      triageOrder: string[]
      recommendedCommands: string[]
      buildArtifacts: string[]
      aiArtifacts: string[]
      modeContextSignals: string[]
      incidentSignals: string[]
    }
    const script = await readFile(join(ROOT, "scripts", "runtime-diagnostics-policy-check.mjs"), "utf-8")

    expect(manifest.version).toBe(1)
    expect(manifest.triageOrder).toEqual(expect.arrayContaining([
      "bun run check",
      "bun run build",
      "dist/manifest.json",
      "dist/release.json",
      ".gorsee/ai-events.jsonl",
      ".gorsee/agent/latest.json",
      ".gorsee/agent/incident-brief.json",
      ".gorsee/agent/incident-snapshot.json",
    ]))
    expect(manifest.recommendedCommands).toEqual(expect.arrayContaining([
      "bun run test:confidence",
      "bunx gorsee ai doctor",
      "bun run release:smoke",
    ]))
    expect(manifest.buildArtifacts).toEqual(expect.arrayContaining([
      "dist/manifest.json",
      "dist/release.json",
      "dist/client/",
      "deploy artifacts",
    ]))
    expect(manifest.aiArtifacts).toEqual(expect.arrayContaining([
      ".gorsee/ai-events.jsonl",
      ".gorsee/ai-diagnostics.json",
      ".gorsee/agent/latest.json",
      ".gorsee/agent/deploy-summary.json",
      ".gorsee/agent/release-brief.json",
      ".gorsee/agent/incident-brief.json",
      ".gorsee/agent/incident-snapshot.json",
    ]))
    expect(manifest.modeContextSignals).toEqual(expect.arrayContaining([
      "app.mode",
      "runtime.topology",
      "AI app context",
    ]))
    expect(manifest.incidentSignals).toEqual(expect.arrayContaining([
      "request.error",
      "build.summary",
      "release.smoke.error",
      "job.fail",
      "job.retry",
    ]))
    expect(script).toContain("docs/DIAGNOSTICS_CONTRACT.json")
  })

  test("diagnostics docs and README expose machine-readable contract", async () => {
    const readme = await readFile(join(ROOT, "README.md"), "utf-8")
    const triage = await readFile(join(ROOT, "docs", "RUNTIME_TRIAGE.md"), "utf-8")
    const buildDiagnostics = await readFile(join(ROOT, "docs", "BUILD_DIAGNOSTICS.md"), "utf-8")
    const runtimeFailures = await readFile(join(ROOT, "docs", "RUNTIME_FAILURES.md"), "utf-8")
    const aiWorkflows = await readFile(join(ROOT, "docs", "AI_WORKFLOWS.md"), "utf-8")
    const support = await readFile(join(ROOT, "docs", "SUPPORT_MATRIX.md"), "utf-8")

    expect(readme).toContain("Diagnostics Contract")
    expect(triage).toContain("docs/DIAGNOSTICS_CONTRACT.json")
    expect(buildDiagnostics).toContain("docs/DIAGNOSTICS_CONTRACT.json")
    expect(runtimeFailures).toContain("docs/DIAGNOSTICS_CONTRACT.json")
    expect(aiWorkflows).toContain("docs/DIAGNOSTICS_CONTRACT.json")
    expect(support).toContain("docs/DIAGNOSTICS_CONTRACT.json")
    expect(aiWorkflows).toContain("runtime.topology")
    expect(runtimeFailures).toContain("app.mode")
    expect(triage).toContain("app.mode")
    expect(triage).toContain("dist/release.json")
    expect(buildDiagnostics).toContain("dist/release.json")
    expect(runtimeFailures).toContain("job.fail")
    expect(support).toContain("structured job lifecycle telemetry")
  })
})
