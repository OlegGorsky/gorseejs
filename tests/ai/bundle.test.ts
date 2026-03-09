import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  buildAIContextBundle,
  GORSEE_AI_CONTEXT_SCHEMA_VERSION,
  renderAIContextBundleMarkdown,
  resolveAIStorePaths,
} from "../../src/ai/index.ts"

const TMP = join(process.cwd(), ".tmp-ai-bundle")

describe("ai context bundle", () => {
  beforeEach(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, ".gorsee"), { recursive: true })
    await mkdir(join(TMP, "routes"), { recursive: true })
  })

  afterEach(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("builds bundle with focused snippets", async () => {
    await writeFile(join(TMP, "routes", "login.tsx"), [
      "export default function Login() {",
      "  const unsafe = redirectTarget",
      "  return <div>{unsafe}</div>",
      "}",
    ].join("\n"))
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), [
      JSON.stringify({
        id: "evt-1",
        kind: "request.error",
        severity: "error",
        ts: new Date().toISOString(),
        source: "runtime",
        message: "boom",
        file: "routes/login.tsx",
        line: 2,
      }),
      JSON.stringify({
        id: "evt-2",
        kind: "release.extension.finish",
        severity: "info",
        ts: new Date().toISOString(),
        source: "cli",
        message: "VSIX built",
        data: {
          version: "0.2.4",
          artifact: "dist/vscode-gorsee-ai/gorsee-ai-tools-0.2.4.vsix",
        },
      }),
    ].join("\n") + "\n")
    await writeFile(join(TMP, ".gorsee", "ai-diagnostics.json"), JSON.stringify({
      latest: {
        code: "E905",
        message: "unsafe redirect",
        severity: "error",
        file: "routes/login.tsx",
        line: 2,
      },
    }))

    const bundle = await buildAIContextBundle(TMP, resolveAIStorePaths(TMP))

    expect(bundle.schemaVersion).toBe(GORSEE_AI_CONTEXT_SCHEMA_VERSION)
    expect(bundle.rootCauses.length).toBeGreaterThan(0)
    expect(bundle.artifacts.length).toBeGreaterThan(0)
    expect(bundle.artifacts[0]?.path).toContain(".vsix")
    expect(bundle.rootCauses[0]?.file).toBe("routes/login.tsx")
    expect(bundle.snippets).toHaveLength(1)
    expect(bundle.snippets[0]?.content).toContain("redirectTarget")
    expect((bundle.snippets[0]?.score ?? 0) > 0).toBe(true)
    expect(renderAIContextBundleMarkdown(bundle)).toContain(`Bundle Schema: ${GORSEE_AI_CONTEXT_SCHEMA_VERSION}`)
    expect(renderAIContextBundleMarkdown(bundle)).toContain("## Root Causes")
    expect(renderAIContextBundleMarkdown(bundle)).toContain("## Artifacts")
    expect(renderAIContextBundleMarkdown(bundle)).toContain("## Snippets")
  })

  test("route affinity ranks matching route files and layouts", async () => {
    await mkdir(join(TMP, "routes", "account"), { recursive: true })
    await writeFile(join(TMP, "routes", "_layout.tsx"), "export default function RootLayout() { return <main /> }\n")
    await writeFile(join(TMP, "routes", "account", "_layout.tsx"), "export default function AccountLayout() { return <section /> }\n")
    await writeFile(join(TMP, "routes", "account", "settings.tsx"), "export default function Settings() { return <div>settings</div> }\n")
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), `${JSON.stringify({
      id: "evt-2",
      kind: "request.error",
      severity: "error",
      ts: new Date().toISOString(),
      source: "runtime",
      message: "settings failed",
      route: "/account/settings",
    })}\n`)
    await writeFile(join(TMP, ".gorsee", "ai-diagnostics.json"), JSON.stringify({
      latest: {
        code: "E500",
        message: "settings crash",
        severity: "error",
        route: "/account/settings",
      },
    }))

    const bundle = await buildAIContextBundle(TMP, resolveAIStorePaths(TMP))
    const files = bundle.snippets.map((snippet) => snippet.file)

    expect(files).toContain("routes/account/settings.tsx")
    expect(files).toContain("routes/account/_layout.tsx")
  })
})
