import { emitAIEvent } from "../ai/index.ts"

type Awaitable<T> = T | Promise<T>

export interface WorkerServiceContext {
  name: string
  workerId: string
  startedAt: number
  signal: AbortSignal
  emitReady(): Promise<void>
  emitHeartbeat(message?: string, data?: Record<string, unknown>): Promise<void>
  waitForShutdown(): Promise<void>
}

export interface WorkerServiceStartHandle {
  ready?: Promise<void>
  stop?: () => Awaitable<void>
}

export interface WorkerServiceDefinition {
  name: string
  start(context: WorkerServiceContext): Awaitable<void | (() => Awaitable<void>) | WorkerServiceStartHandle>
}

export interface RunWorkerServiceOptions {
  registerSignalHandlers?: boolean
  workerId?: string
  signal?: AbortSignal
}

export interface RunningWorkerService {
  name: string
  workerId: string
  startedAt: number
  ready: Promise<void>
  stop(): Promise<void>
}

export function defineWorkerService(
  name: string,
  start: WorkerServiceDefinition["start"],
): WorkerServiceDefinition {
  return { name, start }
}

export async function runWorkerService(
  service: WorkerServiceDefinition,
  options: RunWorkerServiceOptions = {},
): Promise<RunningWorkerService> {
  const startedAt = Date.now()
  const workerId = options.workerId ?? crypto.randomUUID()
  const controller = new AbortController()
  const cleanupTasks: Array<() => Awaitable<void>> = []
  let readySettled = false
  let stopPromise: Promise<void> | null = null
  let resolveReady!: () => void
  let rejectReady!: (error?: unknown) => void
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

  if (options.signal) {
    if (options.signal.aborted) controller.abort(options.signal.reason)
    else {
      options.signal.addEventListener("abort", () => controller.abort(options.signal?.reason), { once: true })
    }
  }

  const shutdownPromise = new Promise<void>((resolve) => {
    if (controller.signal.aborted) resolve()
    else controller.signal.addEventListener("abort", () => resolve(), { once: true })
  })

  const context: WorkerServiceContext = {
    name: service.name,
    workerId,
    startedAt,
    signal: controller.signal,
    emitReady: async () => {
      if (readySettled) return
      readySettled = true
      resolveReady()
      await emitAIEvent({
        kind: "worker.ready",
        severity: "info",
        source: "runtime",
        message: `worker ready ${service.name}`,
        data: {
          workerId,
          service: service.name,
          startedAt,
        },
      })
    },
    emitHeartbeat: async (message = `worker heartbeat ${service.name}`, data) => {
      await emitAIEvent({
        kind: "worker.heartbeat",
        severity: "info",
        source: "runtime",
        message,
        data: {
          workerId,
          service: service.name,
          startedAt,
          ...(data ?? {}),
        },
      })
    },
    waitForShutdown: async () => shutdownPromise,
  }

  await emitAIEvent({
    kind: "worker.start",
    severity: "info",
    source: "runtime",
    message: `starting worker ${service.name}`,
    data: {
      workerId,
      service: service.name,
      startedAt,
    },
  })

  try {
    const startResult = await service.start(context)
    if (typeof startResult === "function") {
      cleanupTasks.push(startResult)
    } else if (startResult?.stop) {
      cleanupTasks.push(startResult.stop)
      if (startResult.ready) {
        void startResult.ready.then(() => context.emitReady()).catch((error) => {
          rejectReady(error)
        })
      }
    }

    if (!readySettled && !(typeof startResult === "object" && startResult?.ready)) {
      await context.emitReady()
    }
  } catch (error) {
    rejectReady(error)
    await emitAIEvent({
      kind: "worker.error",
      severity: "error",
      source: "runtime",
      message: error instanceof Error ? error.message : String(error),
      data: {
        workerId,
        service: service.name,
        startedAt,
      },
    })
    throw error
  }

  const stop = async () => {
    if (stopPromise) return stopPromise
    stopPromise = (async () => {
      controller.abort()
      for (const cleanup of cleanupTasks.reverse()) {
        await cleanup()
      }
      await emitAIEvent({
        kind: "worker.stop",
        severity: "info",
        source: "runtime",
        message: `stopped worker ${service.name}`,
        data: {
          workerId,
          service: service.name,
          startedAt,
          stoppedAt: Date.now(),
        },
      })
    })()
    return stopPromise
  }

  if (options.registerSignalHandlers !== false && typeof process.on === "function") {
    const handleSignal = () => {
      void stop()
    }
    process.once("SIGINT", handleSignal)
    process.once("SIGTERM", handleSignal)
  }

  return {
    name: service.name,
    workerId,
    startedAt,
    ready,
    stop,
  }
}
