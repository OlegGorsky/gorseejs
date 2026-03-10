import { emitAIEvent } from "../ai/index.ts"

type Awaitable<T> = T | Promise<T>

export type JobQueueKind = "memory" | "redis"

export interface JobContext {
  attempt: number
  maxAttempts: number
}

export interface JobDefinition<Payload> {
  name: string
  handler(payload: Payload, context: JobContext): Awaitable<void>
}

export interface JobEnqueueOptions {
  runAt?: number
  maxAttempts?: number
  backoffMs?: number
}

export interface JobRetryOptions extends JobEnqueueOptions {}

export interface EnqueuedJob<Payload = unknown> {
  id: string
  name: string
  payload: Payload
  runAt: number
  attempts: number
  maxAttempts: number
  backoffMs: number
  lastError?: string
}

export interface QueuedJobRecord<Payload = unknown> extends EnqueuedJob<Payload> {
  createdAt: number
  updatedAt: number
}

export interface JobRunResult {
  id: string
  name: string
  status: "completed" | "retrying" | "failed"
  attempts: number
  nextRunAt?: number
  error?: string
}

export interface TerminalJobRecord<Payload = unknown> extends QueuedJobRecord<Payload> {
  status: "completed" | "failed"
  finishedAt: number
}

export interface MemoryJobQueueOptions {
  historyLimit?: number
}

interface JobLifecycleEventInput {
  kind: "job.enqueue" | "job.start" | "job.retry" | "job.complete" | "job.fail" | "job.cancel" | "job.dead-letter.retry"
  severity: "info" | "warn" | "error"
  queue: JobQueueKind
  id: string
  name: string
  attempts?: number
  maxAttempts?: number
  runAt?: number
  nextRunAt?: number
  error?: string
  workerInstanceId?: string
}

export interface JobQueue {
  enqueue<Payload>(job: JobDefinition<Payload>, payload: Payload, options?: JobEnqueueOptions): Promise<EnqueuedJob<Payload>>
  runNext(now?: number): Promise<JobRunResult | null>
  drain(now?: number): Promise<JobRunResult[]>
  size(): Promise<number>
  get(id: string): Promise<QueuedJobRecord | null>
  peek(limit?: number): Promise<QueuedJobRecord[]>
  cancel(id: string): Promise<boolean>
  recent(limit?: number): Promise<TerminalJobRecord[]>
  failures(limit?: number): Promise<TerminalJobRecord[]>
  retryFailed(id: string, options?: JobRetryOptions): Promise<EnqueuedJob | null>
}

export function defineJob<Payload>(
  name: string,
  handler: (payload: Payload, context: JobContext) => Awaitable<void>,
): JobDefinition<Payload> {
  return { name, handler }
}

export async function emitJobLifecycleEvent(input: JobLifecycleEventInput): Promise<void> {
  await emitAIEvent({
    kind: input.kind,
    severity: input.severity,
    source: "runtime",
    message: buildJobLifecycleMessage(input),
    data: {
      queue: input.queue,
      jobId: input.id,
      jobName: input.name,
      attempts: input.attempts,
      maxAttempts: input.maxAttempts,
      runAt: input.runAt,
      nextRunAt: input.nextRunAt,
      workerInstanceId: input.workerInstanceId,
      error: input.error,
    },
  })
}

function buildJobLifecycleMessage(input: JobLifecycleEventInput): string {
  switch (input.kind) {
    case "job.enqueue":
      return `queued job ${input.name}`
    case "job.start":
      return `started job ${input.name}`
    case "job.retry":
      return `retrying job ${input.name}`
    case "job.complete":
      return `completed job ${input.name}`
    case "job.fail":
      return `failed job ${input.name}`
    case "job.cancel":
      return `cancelled job ${input.name}`
    case "job.dead-letter.retry":
      return `requeued failed job ${input.name}`
    default:
      return `job lifecycle event for ${input.name}`
  }
}

export function createMemoryJobQueue(options: MemoryJobQueueOptions = {}): JobQueue {
  const jobs: Array<QueuedJobRecord & { job: JobDefinition<unknown>; sequence: number }> = []
  const history: Array<TerminalJobRecord & { job: JobDefinition<unknown> }> = []
  let sequence = 0
  const historyLimit = options.historyLimit ?? 100

  function sortJobs(): void {
    jobs.sort((a, b) => (a.runAt - b.runAt) || (a.sequence - b.sequence))
  }

  function pushHistory(entry: QueuedJobRecord & { job: JobDefinition<unknown> }, status: "completed" | "failed"): void {
    history.unshift({
      id: entry.id,
      name: entry.name,
      payload: entry.payload,
      runAt: entry.runAt,
      attempts: entry.attempts,
      maxAttempts: entry.maxAttempts,
      backoffMs: entry.backoffMs,
      lastError: entry.lastError,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      finishedAt: Date.now(),
      status,
      job: entry.job,
    })
    if (history.length > historyLimit) {
      history.length = historyLimit
    }
  }

  return {
    async enqueue(job, payload, options = {}) {
      const now = Date.now()
      const enqueued: QueuedJobRecord<typeof payload> & { job: JobDefinition<unknown>; sequence: number } = {
        id: crypto.randomUUID(),
        name: job.name,
        payload,
        runAt: options.runAt ?? Date.now(),
        attempts: 0,
        maxAttempts: options.maxAttempts ?? 3,
        backoffMs: options.backoffMs ?? 1_000,
        createdAt: now,
        updatedAt: now,
        job: job as JobDefinition<unknown>,
        sequence: sequence++,
      }
      jobs.push(enqueued)
      sortJobs()
      await emitJobLifecycleEvent({
        kind: "job.enqueue",
        severity: "info",
        queue: "memory",
        id: enqueued.id,
        name: enqueued.name,
        attempts: enqueued.attempts,
        maxAttempts: enqueued.maxAttempts,
        runAt: enqueued.runAt,
      })
      return enqueued
    },

    async runNext(now = Date.now()) {
      sortJobs()
      const nextIndex = jobs.findIndex((entry) => entry.runAt <= now)
      if (nextIndex === -1) return null

      const entry = jobs.splice(nextIndex, 1)[0]!
      entry.attempts += 1
      await emitJobLifecycleEvent({
        kind: "job.start",
        severity: "info",
        queue: "memory",
        id: entry.id,
        name: entry.name,
        attempts: entry.attempts,
        maxAttempts: entry.maxAttempts,
        runAt: entry.runAt,
      })

      try {
        await entry.job.handler(entry.payload, {
          attempt: entry.attempts,
          maxAttempts: entry.maxAttempts,
        })
        entry.updatedAt = Date.now()
        pushHistory(entry, "completed")
        await emitJobLifecycleEvent({
          kind: "job.complete",
          severity: "info",
          queue: "memory",
          id: entry.id,
          name: entry.name,
          attempts: entry.attempts,
          maxAttempts: entry.maxAttempts,
          runAt: entry.runAt,
        })
        return {
          id: entry.id,
          name: entry.name,
          status: "completed",
          attempts: entry.attempts,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        entry.lastError = message
        if (entry.attempts < entry.maxAttempts) {
          entry.runAt = now + entry.backoffMs * entry.attempts
          entry.updatedAt = Date.now()
          jobs.push(entry)
          sortJobs()
          await emitJobLifecycleEvent({
            kind: "job.retry",
            severity: "warn",
            queue: "memory",
            id: entry.id,
            name: entry.name,
            attempts: entry.attempts,
            maxAttempts: entry.maxAttempts,
            runAt: now,
            nextRunAt: entry.runAt,
            error: message,
          })
          return {
            id: entry.id,
            name: entry.name,
            status: "retrying",
            attempts: entry.attempts,
            nextRunAt: entry.runAt,
            error: message,
          }
        }
        entry.updatedAt = Date.now()
        pushHistory(entry, "failed")
        await emitJobLifecycleEvent({
          kind: "job.fail",
          severity: "error",
          queue: "memory",
          id: entry.id,
          name: entry.name,
          attempts: entry.attempts,
          maxAttempts: entry.maxAttempts,
          runAt: entry.runAt,
          error: message,
        })
        return {
          id: entry.id,
          name: entry.name,
          status: "failed",
          attempts: entry.attempts,
          error: message,
        }
      }
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
      return jobs.length
    },

    async get(id) {
      const job = jobs.find((entry) => entry.id === id)
      if (!job) return null
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
    },

    async peek(limit = Number.POSITIVE_INFINITY) {
      sortJobs()
      return jobs.slice(0, limit).map((job) => ({
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
      }))
    },

    async cancel(id) {
      const index = jobs.findIndex((entry) => entry.id === id)
      if (index === -1) return false
      const [entry] = jobs.splice(index, 1)
      if (entry) {
        await emitJobLifecycleEvent({
          kind: "job.cancel",
          severity: "info",
          queue: "memory",
          id: entry.id,
          name: entry.name,
          attempts: entry.attempts,
          maxAttempts: entry.maxAttempts,
          runAt: entry.runAt,
        })
      }
      return true
    },

    async recent(limit = 50) {
      return history.slice(0, limit).map((entry) => ({
        id: entry.id,
        name: entry.name,
        payload: entry.payload,
        runAt: entry.runAt,
        attempts: entry.attempts,
        maxAttempts: entry.maxAttempts,
        backoffMs: entry.backoffMs,
        lastError: entry.lastError,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        finishedAt: entry.finishedAt,
        status: entry.status,
      }))
    },

    async failures(limit = 50) {
      return history
        .filter((entry) => entry.status === "failed")
        .slice(0, limit)
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          payload: entry.payload,
          runAt: entry.runAt,
          attempts: entry.attempts,
          maxAttempts: entry.maxAttempts,
          backoffMs: entry.backoffMs,
          lastError: entry.lastError,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          finishedAt: entry.finishedAt,
          status: entry.status,
        }))
    },

    async retryFailed(id, options = {}) {
      const failedEntry = history.find((entry) => entry.id === id && entry.status === "failed")
      if (!failedEntry) return null
      const retried = await this.enqueue(failedEntry.job, failedEntry.payload, {
        runAt: options.runAt ?? Date.now(),
        maxAttempts: options.maxAttempts ?? failedEntry.maxAttempts,
        backoffMs: options.backoffMs ?? failedEntry.backoffMs,
      })
      await emitJobLifecycleEvent({
        kind: "job.dead-letter.retry",
        severity: "warn",
        queue: "memory",
        id: retried.id,
        name: retried.name,
        attempts: retried.attempts,
        maxAttempts: retried.maxAttempts,
        runAt: retried.runAt,
      })
      return retried
    },
  }
}
