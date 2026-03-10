import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { __resetAIObservability, configureAIObservability, resolveAIObservabilityConfig } from "../../src/ai/index.ts"
import { createMemoryJobQueue, defineJob } from "../../src/server/jobs.ts"

const TMP = join(process.cwd(), ".tmp-memory-job-telemetry")

afterEach(async () => {
  __resetAIObservability()
  await rm(TMP, { recursive: true, force: true })
})

describe("job queue", () => {
  test("runs queued jobs and passes attempt metadata", async () => {
    const queue = createMemoryJobQueue()
    const attempts: number[] = []
    const job = defineJob<{ email: string }>("send-email", async (payload, context) => {
      attempts.push(context.attempt)
      expect(payload.email).toBe("user@example.com")
    })

    await queue.enqueue(job, { email: "user@example.com" })
    const result = await queue.runNext()

    expect(result).toEqual({
      id: expect.any(String),
      name: "send-email",
      status: "completed",
      attempts: 1,
    })
    expect(attempts).toEqual([1])
  })

  test("retries failed jobs with backoff metadata", async () => {
    const queue = createMemoryJobQueue()
    let calls = 0
    const job = defineJob("retry-once", async () => {
      calls += 1
      if (calls === 1) throw new Error("temporary")
    })

    await queue.enqueue(job, {}, { backoffMs: 500, maxAttempts: 2 })

    const first = await queue.runNext()
    expect(first?.status).toBe("retrying")
    expect(first?.attempts).toBe(1)
    expect(first?.nextRunAt).toBeDefined()

    const second = await queue.runNext(first!.nextRunAt)
    expect(second?.status).toBe("completed")
    expect(second?.attempts).toBe(2)
  })

  test("marks jobs as failed when retries are exhausted", async () => {
    const queue = createMemoryJobQueue()
    const job = defineJob("always-fail", async () => {
      throw new Error("fatal")
    })

    await queue.enqueue(job, {}, { maxAttempts: 1 })
    const result = await queue.runNext()

    expect(result).toEqual({
      id: expect.any(String),
      name: "always-fail",
      status: "failed",
      attempts: 1,
      error: "fatal",
    })
  })

  test("drain only runs due jobs and leaves future jobs queued", async () => {
    const queue = createMemoryJobQueue()
    const seen: string[] = []
    const job = defineJob<{ id: string }>("scheduled", async (payload) => {
      seen.push(payload.id)
    })

    await queue.enqueue(job, { id: "due" }, { runAt: 100 })
    await queue.enqueue(job, { id: "future" }, { runAt: 500 })

    const results = await queue.drain(100)

    expect(results).toHaveLength(1)
    expect(seen).toEqual(["due"])
    expect(await queue.size()).toBe(1)
  })

  test("runNext picks the earliest due job even when enqueued out of order", async () => {
    const queue = createMemoryJobQueue()
    const seen: string[] = []
    const job = defineJob<{ id: string }>("ordered", async (payload) => {
      seen.push(payload.id)
    })

    await queue.enqueue(job, { id: "late" }, { runAt: 400 })
    await queue.enqueue(job, { id: "early" }, { runAt: 100 })

    const first = await queue.runNext(100)
    const second = await queue.runNext(400)

    expect(first?.status).toBe("completed")
    expect(second?.status).toBe("completed")
    expect(seen).toEqual(["early", "late"])
  })

  test("retry scheduling scales with the attempt count", async () => {
    const queue = createMemoryJobQueue()
    let calls = 0
    const job = defineJob("retry-twice", async () => {
      calls += 1
      if (calls < 3) throw new Error(`temporary-${calls}`)
    })

    await queue.enqueue(job, {}, { backoffMs: 100, maxAttempts: 3, runAt: 0 })

    const first = await queue.runNext(0)
    const second = await queue.runNext(first!.nextRunAt)
    const third = await queue.runNext(second!.nextRunAt)

    expect(first).toMatchObject({ status: "retrying", attempts: 1, nextRunAt: 100, error: "temporary-1" })
    expect(second).toMatchObject({ status: "retrying", attempts: 2, nextRunAt: 300, error: "temporary-2" })
    expect(third).toMatchObject({ status: "completed", attempts: 3 })
  })

  test("jobs with the same runAt execute in enqueue order", async () => {
    const queue = createMemoryJobQueue()
    const seen: string[] = []
    const job = defineJob<{ id: string }>("same-time", async (payload) => {
      seen.push(payload.id)
    })

    await queue.enqueue(job, { id: "first" }, { runAt: 200 })
    await queue.enqueue(job, { id: "second" }, { runAt: 200 })
    await queue.enqueue(job, { id: "third" }, { runAt: 200 })

    const results = await queue.drain(200)

    expect(results).toHaveLength(3)
    expect(seen).toEqual(["first", "second", "third"])
  })

  test("drain does not execute retried jobs again before their nextRunAt", async () => {
    const queue = createMemoryJobQueue()
    let calls = 0
    const job = defineJob("retry-later", async () => {
      calls += 1
      if (calls === 1) throw new Error("retry-me")
    })

    await queue.enqueue(job, {}, { runAt: 100, backoffMs: 50, maxAttempts: 2 })

    const firstDrain = await queue.drain(100)
    const secondDrain = await queue.drain(149)
    const finalDrain = await queue.drain(150)

    expect(firstDrain).toHaveLength(1)
    expect(firstDrain[0]).toMatchObject({ status: "retrying", attempts: 1, nextRunAt: 150 })
    expect(secondDrain).toHaveLength(0)
    expect(finalDrain).toHaveLength(1)
    expect(finalDrain[0]).toMatchObject({ status: "completed", attempts: 2 })
  })

  test("peek and get expose queued jobs in execution order", async () => {
    const queue = createMemoryJobQueue()
    const job = defineJob<{ id: string }>("inspectable", async () => undefined)

    const late = await queue.enqueue(job, { id: "late" }, { runAt: 400 })
    const early = await queue.enqueue(job, { id: "early" }, { runAt: 100 })

    const peeked = await queue.peek()
    const inspected = await queue.get(early.id)

    expect(peeked.map((entry) => (entry.payload as { id: string }).id)).toEqual(["early", "late"])
    expect(inspected).toMatchObject({
      id: early.id,
      name: "inspectable",
      payload: { id: "early" },
      runAt: 100,
    })
    expect(inspected?.createdAt).toBeTypeOf("number")
    expect(inspected?.updatedAt).toBeTypeOf("number")
    expect(peeked[1]?.id).toBe(late.id)
  })

  test("cancel removes queued jobs before execution", async () => {
    const queue = createMemoryJobQueue()
    const seen: string[] = []
    const job = defineJob<{ id: string }>("cancel-me", async (payload) => {
      seen.push(payload.id)
    })

    const target = await queue.enqueue(job, { id: "cancelled" }, { runAt: 100 })
    await queue.enqueue(job, { id: "keep" }, { runAt: 100 })

    expect(await queue.cancel(target.id)).toBe(true)
    expect(await queue.get(target.id)).toBeNull()
    expect(await queue.cancel(target.id)).toBe(false)

    const results = await queue.drain(100)
    expect(results).toHaveLength(1)
    expect(seen).toEqual(["keep"])
  })

  test("recent and failures expose bounded terminal history and retryFailed can requeue dead-letter jobs", async () => {
    const queue = createMemoryJobQueue({ historyLimit: 2 })
    let flakyCalls = 0
    const completed = defineJob("completed-job", async () => undefined)
    const flaky = defineJob("flaky-job", async () => {
      flakyCalls += 1
      if (flakyCalls <= 2) throw new Error("boom")
    })

    await queue.enqueue(completed, {}, { runAt: 0 })
    await queue.enqueue(flaky, {}, { runAt: 0, maxAttempts: 1 })
    await queue.enqueue(completed, { final: true }, { runAt: 0 })

    await queue.drain(0)

    const recent = await queue.recent()
    const failures = await queue.failures()

    expect(recent).toHaveLength(2)
    expect(recent[0]?.status).toBe("completed")
    expect(recent[1]).toMatchObject({ status: "failed", name: "flaky-job", lastError: "boom" })
    expect(failures).toHaveLength(1)

    const retried = await queue.retryFailed(failures[0]!.id, { runAt: 10, maxAttempts: 2 })
    expect(retried).not.toBeNull()
    const retryFirst = await queue.runNext(10)
    const retrySecond = await queue.runNext(retryFirst!.nextRunAt)
    expect(retryFirst).toMatchObject({ status: "retrying", name: "flaky-job" })
    expect(retrySecond).toMatchObject({ status: "completed", name: "flaky-job" })
  })

  test("emits structured lifecycle telemetry for memory jobs when AI observability is enabled", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    configureAIObservability(resolveAIObservabilityConfig(TMP, {
      enabled: true,
      app: {
        mode: "server",
        runtimeTopology: "single-instance",
      },
    }))

    const queue = createMemoryJobQueue()
    let calls = 0
    const job = defineJob("telemetry-memory", async () => {
      calls += 1
      if (calls === 1) throw new Error("retry-me")
    })

    const enqueued = await queue.enqueue(job, {}, { runAt: 0, backoffMs: 10, maxAttempts: 2 })
    const first = await queue.runNext(0)
    const second = await queue.runNext(first!.nextRunAt)
    await queue.cancel(enqueued.id)

    const events = (await readFile(join(TMP, ".gorsee", "ai-events.jsonl"), "utf-8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { kind: string; data?: Record<string, unknown>; app?: Record<string, unknown> })

    expect(second?.status).toBe("completed")
    expect(events.map((event) => event.kind)).toEqual(expect.arrayContaining([
      "job.enqueue",
      "job.start",
      "job.retry",
      "job.complete",
    ]))
    expect(events.find((event) => event.kind === "job.retry")?.data?.queue).toBe("memory")
    expect(events.find((event) => event.kind === "job.enqueue")?.app).toEqual({
      mode: "server",
      runtimeTopology: "single-instance",
    })
  })
})
