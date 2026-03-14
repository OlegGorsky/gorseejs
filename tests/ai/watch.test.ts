import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createIDEProjectionWatcher, resolveAIStorePaths, resolveIDEProjectionPaths } from "../../src/ai/index.ts"

const TMP = join(process.cwd(), ".tmp-ai-watch")

describe("ai ide projection watcher", () => {
  beforeEach(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(join(TMP, ".gorsee"), { recursive: true })
  })

  afterEach(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("syncOnce writes projection files", async () => {
    await writeFile(join(TMP, ".gorsee", "ai-events.jsonl"), `${JSON.stringify({
      id: "evt-1",
      kind: "build.summary",
      severity: "info",
      ts: new Date().toISOString(),
      source: "build",
      message: "build completed",
    })}\n`)
    await writeFile(join(TMP, ".gorsee", "rules.md"), "# Watch Rules\n\nStay in inspect mode.\n")

    const watcher = createIDEProjectionWatcher({
      storePaths: resolveAIStorePaths(TMP),
      projectionPaths: resolveIDEProjectionPaths(TMP),
      intervalMs: 50,
      cwd: TMP,
      mode: "inspect",
    })

    const projection = await watcher.syncOnce()

    expect(projection.agent.currentMode).toBe("inspect")
    expect(projection.recentEvents).toHaveLength(1)
    expect(await readFile(join(TMP, ".gorsee", "ide", "events.json"), "utf-8")).toContain("build.summary")
  })
})
