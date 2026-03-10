import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { __resetAIObservability, configureAIObservability, resolveAIObservabilityConfig } from "../../src/ai/index.ts"
import { createRedisJobQueue } from "../../src/server/redis-job-queue.ts"
import { defineJob } from "../../src/server/jobs.ts"
import type { RedisLikeClient } from "../../src/server/redis-client.ts"

const TMP = join(process.cwd(), ".tmp-redis-job-telemetry")

afterEach(async () => {
  __resetAIObservability()
  await rm(TMP, { recursive: true, force: true })
})

class FakeRedisJobClient implements RedisLikeClient {
  private readonly store = new Map<string, string>()
  private readonly expiresAt = new Map<string, number>()
  private readonly sortedSets = new Map<string, Map<string, number>>()
  public keysCalls = 0

  async get(key: string): Promise<string | null> {
    this.prune(key)
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key)
    this.expiresAt.delete(key)
    return existed ? 1 : 0
  }

  async keys(pattern: string): Promise<string[]> {
    this.keysCalls += 1
    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern
    return [...this.store.keys()].filter((key) => key.startsWith(prefix))
  }

  async incr(key: string): Promise<number> {
    this.prune(key)
    const next = Number(this.store.get(key) ?? "0") + 1
    this.store.set(key, String(next))
    return next
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.store.has(key)) return 0
    this.expiresAt.set(key, Date.now() + seconds * 1000)
    return 1
  }

  async setnx(key: string, value: string): Promise<number> {
    this.prune(key)
    if (this.store.has(key)) return 0
    this.store.set(key, value)
    return 1
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    const set = this.sortedSets.get(key) ?? new Map<string, number>()
    const existed = set.has(member)
    set.set(member, score)
    this.sortedSets.set(key, set)
    return existed ? 0 : 1
  }

  async zrangebyscore(key: string, min: number | "-inf", max: number | "+inf"): Promise<string[]> {
    const set = this.sortedSets.get(key)
    if (!set) return []
    const minScore = min === "-inf" ? Number.NEGATIVE_INFINITY : min
    const maxScore = max === "+inf" ? Number.POSITIVE_INFINITY : max
    return [...set.entries()]
      .filter(([, score]) => score >= minScore && score <= maxScore)
      .sort((a, b) => (a[1] - b[1]) || a[0].localeCompare(b[0]))
      .map(([member]) => member)
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    const set = this.sortedSets.get(key)
    if (!set) return 0
    let deleted = 0
    for (const member of members) {
      if (set.delete(member)) deleted += 1
    }
    if (set.size === 0) this.sortedSets.delete(key)
    return deleted
  }

  private prune(key: string): void {
    const expiresAt = this.expiresAt.get(key)
    if (expiresAt === undefined || expiresAt > Date.now()) return
    this.store.delete(key)
    this.expiresAt.delete(key)
  }
}

describe("redis job queue", () => {
  test("persists jobs across queue instances and preserves due ordering", async () => {
    const client = new FakeRedisJobClient()
    const seen: string[] = []
    const sendEmail = defineJob<{ id: string }>("send-email", async (payload) => {
      seen.push(payload.id)
    })
    const queueA = createRedisJobQueue(client, { prefix: "tenant-a:jobs", jobs: [sendEmail] })
    const queueB = createRedisJobQueue(client, { prefix: "tenant-a:jobs", jobs: [sendEmail] })

    await queueA.enqueue(sendEmail, { id: "late" }, { runAt: 400 })
    await queueA.enqueue(sendEmail, { id: "early" }, { runAt: 100 })

    const first = await queueB.runNext(100)
    const second = await queueB.runNext(400)

    expect(first).toMatchObject({ name: "send-email", status: "completed", attempts: 1 })
    expect(second).toMatchObject({ name: "send-email", status: "completed", attempts: 1 })
    expect(seen).toEqual(["early", "late"])
  })

  test("retries failed distributed jobs with persisted backoff state", async () => {
    const client = new FakeRedisJobClient()
    let calls = 0
    const job = defineJob("retry-once", async () => {
      calls += 1
      if (calls === 1) throw new Error("temporary")
    })
    const queue = createRedisJobQueue(client, { prefix: "tenant-b:jobs", jobs: [job] })

    await queue.enqueue(job, {}, { runAt: 0, backoffMs: 200, maxAttempts: 2 })
    const first = await queue.runNext(0)
    const second = await queue.runNext(first!.nextRunAt)

    expect(first).toMatchObject({ status: "retrying", attempts: 1, nextRunAt: 200, error: "temporary" })
    expect(second).toMatchObject({ status: "completed", attempts: 2 })
  })

  test("requires Redis atomic primitives needed for distributed claiming", () => {
    expect(() => createRedisJobQueue({
      get: async () => null,
      set: async () => undefined,
      del: async () => 0,
      keys: async () => [],
      incr: async () => 1,
      expire: async () => 1,
    }, {
      prefix: "tenant-c:jobs",
    })).toThrow("Redis job queue requires incr(), expire(), and setnx() support")
  })

  test("uses Redis sorted-set scheduling when the client supports indexed due scans", async () => {
    const client = new FakeRedisJobClient()
    const seen: string[] = []
    const job = defineJob<{ id: string }>("indexed", async (payload) => {
      seen.push(payload.id)
    })
    const queue = createRedisJobQueue(client, { prefix: "tenant-d:jobs", jobs: [job] })

    await queue.enqueue(job, { id: "third" }, { runAt: 300 })
    await queue.enqueue(job, { id: "first" }, { runAt: 100 })
    await queue.enqueue(job, { id: "second" }, { runAt: 200 })

    expect(await queue.runNext(100)).toMatchObject({ status: "completed", attempts: 1 })
    expect(await queue.runNext(200)).toMatchObject({ status: "completed", attempts: 1 })
    expect(await queue.runNext(300)).toMatchObject({ status: "completed", attempts: 1 })
    expect(seen).toEqual(["first", "second", "third"])
    expect(client.keysCalls).toBe(0)
  })

  test("renews Redis claim locks for long-running jobs so a second worker cannot double-run them", async () => {
    const client = new FakeRedisJobClient()
    let started = 0
    let released!: () => void
    const finish = new Promise<void>((resolve) => {
      released = resolve
    })
    const job = defineJob("long-running", async () => {
      started += 1
      await finish
    })
    const queueA = createRedisJobQueue(client, {
      prefix: "tenant-e:jobs",
      jobs: [job],
      lockTtlSeconds: 0.05,
      lockRenewIntervalMs: 10,
    })
    const queueB = createRedisJobQueue(client, {
      prefix: "tenant-e:jobs",
      jobs: [job],
      lockTtlSeconds: 0.05,
      lockRenewIntervalMs: 10,
    })

    await queueA.enqueue(job, {}, { runAt: 0 })
    const firstRun = queueA.runNext(0)
    await new Promise((resolve) => setTimeout(resolve, 80))
    const competingRun = await queueB.runNext(0)
    released()
    const result = await firstRun

    expect(competingRun).toBeNull()
    expect(result).toMatchObject({ status: "completed", attempts: 1 })
    expect(started).toBe(1)
  })

  test("peek and get expose persisted queued jobs without key scans when schedule index exists", async () => {
    const client = new FakeRedisJobClient()
    const job = defineJob<{ id: string }>("inspectable-redis", async () => undefined)
    const queue = createRedisJobQueue(client, { prefix: "tenant-f:jobs", jobs: [job] })

    const late = await queue.enqueue(job, { id: "late" }, { runAt: 300 })
    const early = await queue.enqueue(job, { id: "early" }, { runAt: 100 })
    client.keysCalls = 0

    const peeked = await queue.peek()
    const inspected = await queue.get(late.id)

    expect(peeked.map((entry) => (entry.payload as { id: string }).id)).toEqual(["early", "late"])
    expect(inspected).toMatchObject({
      id: late.id,
      name: "inspectable-redis",
      payload: { id: "late" },
      runAt: 300,
    })
    expect(client.keysCalls).toBe(0)
  })

  test("cancel removes queued distributed jobs and refuses active leased jobs", async () => {
    const client = new FakeRedisJobClient()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const job = defineJob<{ id: string }>("cancel-redis", async (payload) => {
      if (payload.id === "running") {
        await gate
      }
    })
    const queueA = createRedisJobQueue(client, {
      prefix: "tenant-g:jobs",
      jobs: [job],
      lockTtlSeconds: 1,
      lockRenewIntervalMs: 50,
    })
    const queueB = createRedisJobQueue(client, {
      prefix: "tenant-g:jobs",
      jobs: [job],
      lockTtlSeconds: 1,
      lockRenewIntervalMs: 50,
    })

    const cancelled = await queueA.enqueue(job, { id: "cancelled" }, { runAt: 0 })
    const running = await queueA.enqueue(job, { id: "running" }, { runAt: 0 })

    expect(await queueA.cancel(cancelled.id)).toBe(true)
    expect(await queueA.get(cancelled.id)).toBeNull()

    const runningTask = queueA.runNext(0)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(await queueB.cancel(running.id)).toBe(false)
    release()
    await runningTask
  })

  test("recent and failures expose bounded terminal history and retryFailed requeues dead-letter jobs", async () => {
    const client = new FakeRedisJobClient()
    let flakyCalls = 0
    const ok = defineJob("redis-ok", async () => undefined)
    const flaky = defineJob("redis-flaky", async () => {
      flakyCalls += 1
      if (flakyCalls <= 2) throw new Error("redis-boom")
    })
    const queue = createRedisJobQueue(client, {
      prefix: "tenant-h:jobs",
      jobs: [ok, flaky],
      historyLimit: 2,
    })

    await queue.enqueue(ok, { id: "first" }, { runAt: 0 })
    await queue.enqueue(flaky, { id: "failed" }, { runAt: 0, maxAttempts: 1 })
    await queue.enqueue(ok, { id: "second" }, { runAt: 0 })

    await queue.drain(0)

    const recent = await queue.recent()
    const failures = await queue.failures()

    expect(recent).toHaveLength(2)
    expect(recent[0]).toMatchObject({ status: "completed", name: "redis-ok" })
    expect(recent[1]).toMatchObject({ status: "failed", name: "redis-flaky", lastError: "redis-boom" })
    expect(failures).toHaveLength(1)

    const retried = await queue.retryFailed(failures[0]!.id, { runAt: 10, maxAttempts: 2 })
    expect(retried).not.toBeNull()
    const retryFirst = await queue.runNext(10)
    const retrySecond = await queue.runNext(retryFirst!.nextRunAt)
    expect(retryFirst).toMatchObject({ status: "retrying", name: "redis-flaky" })
    expect(retrySecond).toMatchObject({ status: "completed", name: "redis-flaky" })
  })

  test("emits structured lifecycle telemetry for Redis jobs with worker identity", async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(TMP, { recursive: true })
    configureAIObservability(resolveAIObservabilityConfig(TMP, {
      enabled: true,
      app: {
        mode: "server",
        runtimeTopology: "multi-instance",
      },
    }))

    const client = new FakeRedisJobClient()
    let calls = 0
    const job = defineJob("telemetry-redis", async () => {
      calls += 1
      if (calls === 1) throw new Error("retry-me")
    })
    const queue = createRedisJobQueue(client, {
      prefix: "tenant-h:jobs",
      jobs: [job],
      instanceId: "worker-a",
    })

    await queue.enqueue(job, {}, { runAt: 0, backoffMs: 10, maxAttempts: 2 })
    const first = await queue.runNext(0)
    const second = await queue.runNext(first!.nextRunAt)

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
    expect(events.find((event) => event.kind === "job.start")?.data?.workerInstanceId).toBe("worker-a")
    expect(events.find((event) => event.kind === "job.enqueue")?.app).toEqual({
      mode: "server",
      runtimeTopology: "multi-instance",
    })
  })
})
