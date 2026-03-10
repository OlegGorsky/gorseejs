import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { __resetAIObservability, configureAIObservability, resolveAIObservabilityConfig } from "../../src/ai/index.ts"
import { defineWorkerService, runWorkerService } from "../../src/server/worker-service.ts"

const TMP = join(process.cwd(), ".tmp-worker-service")

afterEach(async () => {
  __resetAIObservability()
  await rm(TMP, { recursive: true, force: true })
})

describe("worker service", () => {
  test("runs worker lifecycle with ready heartbeat and stop events", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    configureAIObservability(resolveAIObservabilityConfig(TMP, {
      enabled: true,
      app: {
        mode: "server",
        runtimeTopology: "single-instance",
      },
    }))

    let cleanedUp = false
    const service = defineWorkerService("test-worker", async (context) => {
      await context.emitHeartbeat("booting worker")
      await context.emitReady()
      return async () => {
        cleanedUp = true
      }
    })

    const running = await runWorkerService(service, {
      registerSignalHandlers: false,
      workerId: "worker-test",
    })
    await running.ready
    await running.stop()

    const events = (await readFile(join(TMP, ".gorsee", "ai-events.jsonl"), "utf-8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { kind: string; data?: Record<string, unknown>; app?: Record<string, unknown> })

    expect(cleanedUp).toBe(true)
    expect(events.map((event) => event.kind)).toEqual(expect.arrayContaining([
      "worker.start",
      "worker.heartbeat",
      "worker.ready",
      "worker.stop",
    ]))
    expect(events.find((event) => event.kind === "worker.start")?.data?.workerId).toBe("worker-test")
    expect(events.find((event) => event.kind === "worker.start")?.app).toEqual({
      mode: "server",
      runtimeTopology: "single-instance",
    })
  })
})
