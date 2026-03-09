type Awaitable<T> = T | Promise<T>

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

export interface JobRunResult {
  id: string
  name: string
  status: "completed" | "retrying" | "failed"
  attempts: number
  nextRunAt?: number
  error?: string
}

export interface JobQueue {
  enqueue<Payload>(job: JobDefinition<Payload>, payload: Payload, options?: JobEnqueueOptions): Promise<EnqueuedJob<Payload>>
  runNext(now?: number): Promise<JobRunResult | null>
  drain(now?: number): Promise<JobRunResult[]>
  size(): Promise<number>
}

export function defineJob<Payload>(
  name: string,
  handler: (payload: Payload, context: JobContext) => Awaitable<void>,
): JobDefinition<Payload> {
  return { name, handler }
}

export function createMemoryJobQueue(): JobQueue {
  const jobs: Array<EnqueuedJob & { job: JobDefinition<unknown> }> = []

  function sortJobs(): void {
    jobs.sort((a, b) => a.runAt - b.runAt)
  }

  return {
    async enqueue(job, payload, options = {}) {
      const enqueued: EnqueuedJob<typeof payload> & { job: JobDefinition<unknown> } = {
        id: crypto.randomUUID(),
        name: job.name,
        payload,
        runAt: options.runAt ?? Date.now(),
        attempts: 0,
        maxAttempts: options.maxAttempts ?? 3,
        backoffMs: options.backoffMs ?? 1_000,
        job: job as JobDefinition<unknown>,
      }
      jobs.push(enqueued)
      sortJobs()
      return enqueued
    },

    async runNext(now = Date.now()) {
      sortJobs()
      const nextIndex = jobs.findIndex((entry) => entry.runAt <= now)
      if (nextIndex === -1) return null

      const entry = jobs.splice(nextIndex, 1)[0]!
      entry.attempts += 1

      try {
        await entry.job.handler(entry.payload, {
          attempt: entry.attempts,
          maxAttempts: entry.maxAttempts,
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
          jobs.push(entry)
          sortJobs()
          return {
            id: entry.id,
            name: entry.name,
            status: "retrying",
            attempts: entry.attempts,
            nextRunAt: entry.runAt,
            error: message,
          }
        }
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
  }
}
