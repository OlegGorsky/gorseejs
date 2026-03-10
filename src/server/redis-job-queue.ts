import type {
  EnqueuedJob,
  JobQueueKind,
  JobDefinition,
  JobEnqueueOptions,
  JobQueue,
  JobRetryOptions,
  JobRunResult,
  QueuedJobRecord,
  TerminalJobRecord,
} from "./jobs.ts"
import { emitJobLifecycleEvent } from "./jobs.ts"
import { buildRedisKey, stripRedisPrefix, type RedisLikeClient } from "./redis-client.ts"

interface RedisJobQueueOptions {
  prefix?: string
  lockTtlSeconds?: number
  lockRenewIntervalMs?: number
  historyLimit?: number
  jobs?: Array<JobDefinition<unknown>>
  instanceId?: string
}

interface StoredJob extends QueuedJobRecord {
  sequence: number
  scheduleMember: string
}

interface StoredTerminalJob extends TerminalJobRecord {
  sequence: number
  historyMember: string
}

export function createRedisJobQueue(
  client: RedisLikeClient,
  options: RedisJobQueueOptions = {},
): JobQueue {
  if (!client.incr || !client.expire || !client.setnx) {
    throw new Error("Redis job queue requires incr(), expire(), and setnx() support on the Redis client.")
  }

  const prefix = options.prefix ?? "gorsee:jobs"
  const lockTtlSeconds = options.lockTtlSeconds ?? 30
  const lockRenewIntervalMs = options.lockRenewIntervalMs ?? Math.max(1_000, Math.floor(lockTtlSeconds * 1000 / 3))
  const historyLimit = options.historyLimit ?? 100
  const instanceId = options.instanceId ?? crypto.randomUUID()
  const handlers = new Map<string, JobDefinition<unknown>>()

  for (const job of options.jobs ?? []) handlers.set(job.name, job)

  return {
    async enqueue(job, payload, enqueueOptions = {}) {
      handlers.set(job.name, job as JobDefinition<unknown>)
      const sequence = await client.incr!(buildRedisKey(prefix, "__sequence"))
      const id = `${job.name}:${sequence}:${crypto.randomUUID()}`
      const runAt = enqueueOptions.runAt ?? Date.now()
      const enqueued: EnqueuedJob<typeof payload> = {
        id,
        name: job.name,
        payload,
        runAt,
        attempts: 0,
        maxAttempts: enqueueOptions.maxAttempts ?? 3,
        backoffMs: enqueueOptions.backoffMs ?? 1_000,
      }
      const stored: StoredJob = {
        ...enqueued,
        sequence,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scheduleMember: buildScheduleMember(sequence, id),
      }
      await writeStoredJob(client, prefix, stored)
      await emitJobLifecycleEvent({
        kind: "job.enqueue",
        severity: "info",
        queue: "redis" satisfies JobQueueKind,
        id: stored.id,
        name: stored.name,
        attempts: stored.attempts,
        maxAttempts: stored.maxAttempts,
        runAt: stored.runAt,
        workerInstanceId: instanceId,
      })
      return enqueued
    },

    async runNext(now = Date.now()) {
      const dueJobs = await listDueJobs(client, prefix, now)
      for (const job of dueJobs) {
        const lockKey = claimKey(prefix, job.id)
        const claimed = await client.setnx!(lockKey, instanceId)
        if (claimed !== 1) continue
        await client.expire!(lockKey, lockTtlSeconds)
        const renewTimer = startLockRenewal(client, lockKey, lockTtlSeconds, lockRenewIntervalMs)

        try {
          const current = await readStoredJob(client, prefix, job.id)
          if (!current || current.runAt > now) continue
          await emitJobLifecycleEvent({
            kind: "job.start",
            severity: "info",
            queue: "redis",
            id: current.id,
            name: current.name,
            attempts: current.attempts + 1,
            maxAttempts: current.maxAttempts,
            runAt: current.runAt,
            workerInstanceId: instanceId,
          })

          const handler = handlers.get(current.name)
          if (!handler) {
            await archiveTerminalJob(client, prefix, historyLimit, {
              ...current,
              attempts: current.attempts + 1,
              lastError: `Missing Redis job handler registration for "${current.name}"`,
              finishedAt: Date.now(),
              status: "failed",
              historyMember: buildHistoryMember(current.sequence, current.id),
            })
            await deleteStoredJob(client, prefix, current)
            await emitJobLifecycleEvent({
              kind: "job.fail",
              severity: "error",
              queue: "redis",
              id: current.id,
              name: current.name,
              attempts: current.attempts + 1,
              maxAttempts: current.maxAttempts,
              runAt: current.runAt,
              workerInstanceId: instanceId,
              error: `Missing Redis job handler registration for "${current.name}"`,
            })
            return {
              id: current.id,
              name: current.name,
              status: "failed",
              attempts: current.attempts + 1,
              error: `Missing Redis job handler registration for "${current.name}"`,
            }
          }

          current.attempts += 1
          try {
            await handler.handler(current.payload, {
              attempt: current.attempts,
              maxAttempts: current.maxAttempts,
            })
            current.updatedAt = Date.now()
            await archiveTerminalJob(client, prefix, historyLimit, {
              ...current,
              finishedAt: Date.now(),
              status: "completed",
              historyMember: buildHistoryMember(current.sequence, current.id),
            })
            await deleteStoredJob(client, prefix, current)
            await emitJobLifecycleEvent({
              kind: "job.complete",
              severity: "info",
              queue: "redis",
              id: current.id,
              name: current.name,
              attempts: current.attempts,
              maxAttempts: current.maxAttempts,
              runAt: current.runAt,
              workerInstanceId: instanceId,
            })
            return {
              id: current.id,
              name: current.name,
              status: "completed",
              attempts: current.attempts,
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (current.attempts < current.maxAttempts) {
              current.lastError = message
              current.runAt = now + current.backoffMs * current.attempts
              current.updatedAt = Date.now()
              await writeStoredJob(client, prefix, current)
              await emitJobLifecycleEvent({
                kind: "job.retry",
                severity: "warn",
                queue: "redis",
                id: current.id,
                name: current.name,
                attempts: current.attempts,
                maxAttempts: current.maxAttempts,
                runAt: now,
                nextRunAt: current.runAt,
                workerInstanceId: instanceId,
                error: message,
              })
              return {
                id: current.id,
                name: current.name,
                status: "retrying",
                attempts: current.attempts,
                nextRunAt: current.runAt,
                error: message,
              }
            }
            current.lastError = message
            current.updatedAt = Date.now()
            await archiveTerminalJob(client, prefix, historyLimit, {
              ...current,
              finishedAt: Date.now(),
              status: "failed",
              historyMember: buildHistoryMember(current.sequence, current.id),
            })
            await deleteStoredJob(client, prefix, current)
            await emitJobLifecycleEvent({
              kind: "job.fail",
              severity: "error",
              queue: "redis",
              id: current.id,
              name: current.name,
              attempts: current.attempts,
              maxAttempts: current.maxAttempts,
              runAt: current.runAt,
              workerInstanceId: instanceId,
              error: message,
            })
            return {
              id: current.id,
              name: current.name,
              status: "failed",
              attempts: current.attempts,
              error: message,
            }
          }
        } finally {
          clearLockRenewal(renewTimer)
          await client.del(lockKey)
        }
      }
      return null
    },

    async drain(now = Date.now()) {
      const results: JobRunResult[] = []
      for (;;) {
        const result = await this.runNext(now)
        if (!result) return results
        results.push(result)
      }
    },

    async size() {
      const jobs = await listStoredJobs(client, prefix)
      return jobs.length
    },

    async get(id) {
      const job = await readStoredJob(client, prefix, id)
      if (!job) return null
      return toQueuedJobRecord(job)
    },

    async peek(limit = Number.POSITIVE_INFINITY) {
      const jobs = await listStoredJobs(client, prefix)
      return jobs
        .sort((a, b) => (a.runAt - b.runAt) || (a.sequence - b.sequence))
        .slice(0, limit)
        .map((job) => toQueuedJobRecord(job))
    },

    async cancel(id) {
      const job = await readStoredJob(client, prefix, id)
      if (!job) return false
      const lockOwner = await client.get(claimKey(prefix, id))
      if (lockOwner) return false
      await deleteStoredJob(client, prefix, job)
      await emitJobLifecycleEvent({
        kind: "job.cancel",
        severity: "info",
        queue: "redis",
        id: job.id,
        name: job.name,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        runAt: job.runAt,
        workerInstanceId: instanceId,
      })
      return true
    },

    async recent(limit = 50) {
      const entries = await listTerminalJobs(client, prefix, limit)
      return entries.map(toTerminalJobRecord)
    },

    async failures(limit = 50) {
      const entries = await listFailedTerminalJobs(client, prefix, limit)
      return entries.map(toTerminalJobRecord)
    },

    async retryFailed(id, options: JobRetryOptions = {}) {
      const failed = await readStoredTerminalJob(client, prefix, id)
      if (!failed || failed.status !== "failed") return null
      const handler = handlers.get(failed.name)
      if (!handler) return null
      const retried = await this.enqueue(handler, failed.payload, {
        runAt: options.runAt ?? Date.now(),
        maxAttempts: options.maxAttempts ?? failed.maxAttempts,
        backoffMs: options.backoffMs ?? failed.backoffMs,
      })
      await emitJobLifecycleEvent({
        kind: "job.dead-letter.retry",
        severity: "warn",
        queue: "redis",
        id: retried.id,
        name: retried.name,
        attempts: retried.attempts,
        maxAttempts: retried.maxAttempts,
        runAt: retried.runAt,
        workerInstanceId: instanceId,
      })
      return retried
    },
  }
}

function jobKey(prefix: string, id: string): string {
  return buildRedisKey(prefix, id)
}

function claimKey(prefix: string, id: string): string {
  return buildRedisKey(`${prefix}:lock`, id)
}

function scheduleKey(prefix: string): string {
  return buildRedisKey(prefix, "__schedule")
}

function historyIndexKey(prefix: string): string {
  return buildRedisKey(prefix, "__history")
}

function failedIndexKey(prefix: string): string {
  return buildRedisKey(prefix, "__failed")
}

function historyItemKey(prefix: string, id: string): string {
  return buildRedisKey(`${prefix}:history`, id)
}

async function listStoredJobs(client: RedisLikeClient, prefix: string): Promise<StoredJob[]> {
  if (client.zrangebyscore) {
    const members = await client.zrangebyscore(scheduleKey(prefix), "-inf", "+inf")
    const jobs: StoredJob[] = []
    for (const member of members) {
      const job = await readStoredJob(client, prefix, extractJobIdFromScheduleMember(member))
      if (job) {
        jobs.push(job)
        continue
      }
      if (client.zrem) {
        await client.zrem(scheduleKey(prefix), member)
      }
    }
    return jobs
  }
  const keys = await client.keys(`${prefix}:*`)
  const jobs: StoredJob[] = []
  for (const key of keys) {
    const visibleKey = stripRedisPrefix(prefix, key)
    if (visibleKey.startsWith("lock:") || visibleKey === "__sequence") continue
    const jobId = visibleKey
    const job = await readStoredJob(client, prefix, jobId)
    if (job) jobs.push(job)
  }
  return jobs
}

async function listDueJobs(client: RedisLikeClient, prefix: string, now: number): Promise<StoredJob[]> {
  if (client.zrangebyscore) {
    const members = await client.zrangebyscore(scheduleKey(prefix), "-inf", now)
    const jobs: StoredJob[] = []
    for (const member of members) {
      const job = await readStoredJob(client, prefix, extractJobIdFromScheduleMember(member))
      if (job) {
        jobs.push(job)
        continue
      }
      if (client.zrem) {
        await client.zrem(scheduleKey(prefix), member)
      }
    }
    return jobs
  }
  const jobs = await listStoredJobs(client, prefix)
  return jobs
    .filter((job) => job.runAt <= now)
    .sort((a, b) => (a.runAt - b.runAt) || (a.sequence - b.sequence))
}

async function readStoredJob(client: RedisLikeClient, prefix: string, id: string): Promise<StoredJob | null> {
  const raw = await client.get(jobKey(prefix, id))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredJob>
    const normalized = normalizeStoredJob(parsed, id)
    if (!normalized) {
      await deleteCorruptStoredJob(client, prefix, id)
      return null
    }
    if (!isStoredJob(parsed)) {
      await writeStoredJob(client, prefix, normalized)
    }
    return normalized
  } catch {
    await deleteCorruptStoredJob(client, prefix, id)
    return null
  }
}

async function writeStoredJob(client: RedisLikeClient, prefix: string, job: StoredJob): Promise<void> {
  await client.set(jobKey(prefix, job.id), JSON.stringify(job))
  if (client.zadd) {
    await client.zadd(scheduleKey(prefix), job.runAt, job.scheduleMember)
  }
}

async function deleteStoredJob(client: RedisLikeClient, prefix: string, job: Pick<StoredJob, "id" | "scheduleMember">): Promise<void> {
  await client.del(jobKey(prefix, job.id))
  if (client.zrem) {
    await client.zrem(scheduleKey(prefix), job.scheduleMember)
  }
}

async function deleteCorruptStoredJob(client: RedisLikeClient, prefix: string, id: string): Promise<void> {
  await client.del(jobKey(prefix, id))
  if (client.zrem) {
    await client.zrem(scheduleKey(prefix), ...candidateScheduleMembersForCorruptJob(id))
  }
}

async function archiveTerminalJob(
  client: RedisLikeClient,
  prefix: string,
  historyLimit: number,
  job: StoredTerminalJob,
): Promise<void> {
  await client.set(historyItemKey(prefix, job.id), JSON.stringify(job))
  if (client.zadd) {
    await client.zadd(historyIndexKey(prefix), job.finishedAt, job.historyMember)
    if (job.status === "failed") {
      await client.zadd(failedIndexKey(prefix), job.finishedAt, job.historyMember)
    } else if (client.zrem) {
      await client.zrem(failedIndexKey(prefix), job.historyMember)
    }
    await trimTerminalHistory(client, prefix, historyLimit)
  }
}

async function trimTerminalHistory(client: RedisLikeClient, prefix: string, historyLimit: number): Promise<void> {
  if (!client.zrangebyscore || !client.zrem || historyLimit < 0) return
  const history = await client.zrangebyscore(historyIndexKey(prefix), "-inf", "+inf")
  const overflow = history.length - historyLimit
  if (overflow <= 0) return
  const toDelete = history.slice(0, overflow)
  for (const member of toDelete) {
    const id = extractJobIdFromHistoryMember(member)
    await client.del(historyItemKey(prefix, id))
    await client.zrem(historyIndexKey(prefix), member)
    await client.zrem(failedIndexKey(prefix), member)
  }
}

async function listTerminalJobs(client: RedisLikeClient, prefix: string, limit: number): Promise<StoredTerminalJob[]> {
  return listIndexedTerminalJobs(client, prefix, historyIndexKey(prefix), limit)
}

async function listFailedTerminalJobs(client: RedisLikeClient, prefix: string, limit: number): Promise<StoredTerminalJob[]> {
  return listIndexedTerminalJobs(client, prefix, failedIndexKey(prefix), limit)
}

async function listIndexedTerminalJobs(
  client: RedisLikeClient,
  prefix: string,
  indexKey: string,
  limit: number,
): Promise<StoredTerminalJob[]> {
  if (!client.zrangebyscore) return []
  const members = await client.zrangebyscore(indexKey, "-inf", "+inf")
  const records: StoredTerminalJob[] = []
  for (const member of members.slice(-limit).reverse()) {
    const record = await readStoredTerminalJob(client, prefix, extractJobIdFromHistoryMember(member))
    if (record) {
      records.push(record)
      continue
    }
    if (client.zrem) {
      await client.zrem(indexKey, member)
    }
  }
  return records
}

async function readStoredTerminalJob(client: RedisLikeClient, prefix: string, id: string): Promise<StoredTerminalJob | null> {
  const raw = await client.get(historyItemKey(prefix, id))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredTerminalJob>
    const normalized = normalizeStoredTerminalJob(parsed, id)
    if (!normalized) {
      await client.del(historyItemKey(prefix, id))
      return null
    }
    return normalized
  } catch {
    await client.del(historyItemKey(prefix, id))
    return null
  }
}

function buildScheduleMember(sequence: number, id: string): string {
  return `${String(sequence).padStart(12, "0")}:${id}`
}

function buildHistoryMember(sequence: number, id: string): string {
  return `${String(sequence).padStart(12, "0")}:${id}`
}

function extractJobIdFromScheduleMember(member: string): string {
  const delimiterIndex = member.indexOf(":")
  return delimiterIndex === -1 ? member : member.slice(delimiterIndex + 1)
}

function extractJobIdFromHistoryMember(member: string): string {
  const delimiterIndex = member.indexOf(":")
  return delimiterIndex === -1 ? member : member.slice(delimiterIndex + 1)
}

function candidateScheduleMembersForCorruptJob(id: string): string[] {
  return [
    id,
    `000000000000:${id}`,
  ]
}

function isStoredJob(value: unknown): value is StoredJob {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<StoredJob>
  return typeof candidate.id === "string"
    && typeof candidate.name === "string"
    && typeof candidate.runAt === "number"
    && typeof candidate.attempts === "number"
    && typeof candidate.maxAttempts === "number"
    && typeof candidate.backoffMs === "number"
    && typeof candidate.sequence === "number"
    && typeof candidate.createdAt === "number"
    && typeof candidate.updatedAt === "number"
    && typeof candidate.scheduleMember === "string"
}

function toQueuedJobRecord(job: StoredJob): QueuedJobRecord {
  return {
    id: job.id,
    name: job.name,
    payload: job.payload,
    runAt: job.runAt,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    backoffMs: job.backoffMs,
    lastError: job.lastError,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

function toTerminalJobRecord(job: StoredTerminalJob): TerminalJobRecord {
  return {
    id: job.id,
    name: job.name,
    payload: job.payload,
    runAt: job.runAt,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    backoffMs: job.backoffMs,
    lastError: job.lastError,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt,
    status: job.status,
  }
}

function normalizeStoredJob(value: Partial<StoredJob>, id: string): StoredJob | null {
  if (typeof value.id !== "string" || value.id !== id) return null
  if (typeof value.name !== "string") return null
  if (typeof value.runAt !== "number") return null
  if (typeof value.attempts !== "number") return null
  if (typeof value.maxAttempts !== "number") return null
  if (typeof value.backoffMs !== "number") return null
  if (typeof value.sequence !== "number") return null

  const createdAt = typeof value.createdAt === "number" ? value.createdAt : value.runAt
  const updatedAt = typeof value.updatedAt === "number" ? value.updatedAt : createdAt
  const scheduleMember = typeof value.scheduleMember === "string"
    ? value.scheduleMember
    : buildScheduleMember(value.sequence, value.id)

  return {
    id: value.id,
    name: value.name,
    payload: value.payload,
    runAt: value.runAt,
    attempts: value.attempts,
    maxAttempts: value.maxAttempts,
    backoffMs: value.backoffMs,
    lastError: value.lastError,
    sequence: value.sequence,
    createdAt,
    updatedAt,
    scheduleMember,
  }
}

function normalizeStoredTerminalJob(value: Partial<StoredTerminalJob>, id: string): StoredTerminalJob | null {
  if (typeof value.id !== "string" || value.id !== id) return null
  if (typeof value.name !== "string") return null
  if (typeof value.runAt !== "number") return null
  if (typeof value.attempts !== "number") return null
  if (typeof value.maxAttempts !== "number") return null
  if (typeof value.backoffMs !== "number") return null
  if (typeof value.sequence !== "number") return null
  if (typeof value.createdAt !== "number") return null
  if (typeof value.updatedAt !== "number") return null
  if (typeof value.finishedAt !== "number") return null
  if (value.status !== "completed" && value.status !== "failed") return null
  return {
    id: value.id,
    name: value.name,
    payload: value.payload,
    runAt: value.runAt,
    attempts: value.attempts,
    maxAttempts: value.maxAttempts,
    backoffMs: value.backoffMs,
    lastError: value.lastError,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    finishedAt: value.finishedAt,
    status: value.status,
    sequence: value.sequence,
    historyMember: typeof value.historyMember === "string" ? value.historyMember : buildHistoryMember(value.sequence, value.id),
  }
}

function startLockRenewal(
  client: RedisLikeClient,
  lockKey: string,
  lockTtlSeconds: number,
  renewIntervalMs: number,
): ReturnType<typeof setInterval> | null {
  if (renewIntervalMs <= 0) return null
  const timer = setInterval(() => {
    void client.expire?.(lockKey, lockTtlSeconds)
  }, renewIntervalMs)
  if (typeof timer.unref === "function") timer.unref()
  return timer
}

function clearLockRenewal(timer: ReturnType<typeof setInterval> | null): void {
  if (timer) clearInterval(timer)
}

export type { RedisJobQueueOptions }
