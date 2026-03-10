import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { configureAIObservability } from "../../src/ai/index.ts"
import { parseWorkerFlags, runWorker } from "../../src/cli/cmd-worker.ts"

const TMP = join(process.cwd(), ".tmp-cmd-worker")

describe("cmd-worker", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
  })

  afterEach(() => {
    configureAIObservability({ enabled: false })
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("parseWorkerFlags defaults to canonical worker entry", () => {
    expect(parseWorkerFlags([])).toEqual({
      entry: "workers/main.ts",
    })
  })

  test("parseWorkerFlags accepts explicit worker entry", () => {
    expect(parseWorkerFlags(["--entry", "workers/custom.ts"])).toEqual({
      entry: "workers/custom.ts",
    })
    expect(parseWorkerFlags(["--entry=workers/ops.ts"])).toEqual({
      entry: "workers/ops.ts",
    })
  })

  test("runWorker imports the canonical server worker entry and emits AI lifecycle events", async () => {
    const cwd = join(TMP, "worker-happy")
    await mkdir(join(cwd, "workers"), { recursive: true })
    await writeFile(join(cwd, "app.config.ts"), `
      export default {
        app: {
          mode: "server",
        },
        ai: {
          enabled: true,
        },
      }
    `.trim())
    await writeFile(join(cwd, "workers", "main.ts"), `
      import { writeFile } from "node:fs/promises"
      import { join } from "node:path"

      await writeFile(join(import.meta.dir, "..", "worker-ran.txt"), "ok", "utf-8")
    `.trim())

    await runWorker([], { cwd })

    const marker = await readFile(join(cwd, "worker-ran.txt"), "utf-8")
    const events = await readFile(join(cwd, ".gorsee", "ai-events.jsonl"), "utf-8")

    expect(marker).toBe("ok")
    expect(events).toContain("\"kind\":\"worker.command.start\"")
    expect(events).toContain("\"kind\":\"worker.command.finish\"")
    expect(events).toContain("\"mode\":\"server\"")
    expect(events).toContain("\"runtimeTopology\":\"single-instance\"")
  })

  test("runWorker fails closed for non-server app modes", async () => {
    const cwd = join(TMP, "worker-frontend")
    await mkdir(cwd, { recursive: true })
    await writeFile(join(cwd, "app.config.ts"), `
      export default {
        app: {
          mode: "frontend",
        },
      }
    `.trim())

    const originalExit = process.exit
    const originalError = console.error
    const errors: string[] = []
    let exitCode = 0

    console.error = ((message?: unknown) => {
      errors.push(String(message ?? ""))
    }) as typeof console.error
    process.exit = ((code?: number) => {
      exitCode = code ?? 0
      throw new Error("process.exit")
    }) as typeof process.exit

    try {
      await expect(runWorker([], { cwd })).rejects.toThrow("process.exit")
    } finally {
      process.exit = originalExit
      console.error = originalError
    }

    expect(exitCode).toBe(1)
    expect(errors.join("\n")).toContain("only available for server-mode apps")
    expect(errors.join("\n")).toContain("frontend")
  })

  test("runWorker fails closed when the worker entry is missing", async () => {
    const cwd = join(TMP, "worker-missing-entry")
    await mkdir(cwd, { recursive: true })
    await writeFile(join(cwd, "app.config.ts"), `
      export default {
        app: {
          mode: "server",
        },
      }
    `.trim())

    const originalExit = process.exit
    const originalError = console.error
    const errors: string[] = []
    let exitCode = 0

    console.error = ((message?: unknown) => {
      errors.push(String(message ?? ""))
    }) as typeof console.error
    process.exit = ((code?: number) => {
      exitCode = code ?? 0
      throw new Error("process.exit")
    }) as typeof process.exit

    try {
      await expect(runWorker(["--entry", "workers/missing.ts"], { cwd })).rejects.toThrow("process.exit")
    } finally {
      process.exit = originalExit
      console.error = originalError
    }

    expect(exitCode).toBe(1)
    expect(errors.join("\n")).toContain("Worker entry not found: workers/missing.ts")
  })

  test("runWorker supports explicit alternate entry paths", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "gorsee-worker-alt-"))
    await mkdir(join(cwd, "workers"), { recursive: true })
    await writeFile(join(cwd, "app.config.ts"), `
      export default {
        app: {
          mode: "server",
        },
      }
    `.trim())
    await writeFile(join(cwd, "workers", "custom.ts"), `
      import { writeFile } from "node:fs/promises"
      import { join } from "node:path"

      await writeFile(join(import.meta.dir, "..", "custom-worker-ran.txt"), "custom", "utf-8")
    `.trim())

    try {
      await runWorker(["--entry", "workers/custom.ts"], { cwd })
      const marker = await readFile(join(cwd, "custom-worker-ran.txt"), "utf-8")
      expect(marker).toBe("custom")
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
