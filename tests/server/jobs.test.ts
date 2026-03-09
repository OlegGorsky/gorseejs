import { describe, expect, test } from "bun:test"
import { createMemoryJobQueue, defineJob } from "../../src/server/jobs.ts"

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
})
