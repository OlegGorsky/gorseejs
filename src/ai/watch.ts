import { watch as watchFS } from "node:fs"
import type { AIStorePaths } from "./store.ts"
import type { IDEProjection, IDEProjectionPaths } from "./ide.ts"
import { buildIDEProjection, writeIDEProjection } from "./ide.ts"
import type { AIOperationMode } from "./rules.ts"

export interface IDEProjectionWatcherOptions {
  storePaths: AIStorePaths
  projectionPaths: IDEProjectionPaths
  intervalMs?: number
  limit?: number
  cwd?: string
  mode?: AIOperationMode
  onSync?: (projection: IDEProjection) => void | Promise<void>
}

export interface IDEProjectionWatcher {
  syncOnce(): Promise<IDEProjection>
  start(): void
  stop(): void
}

export function createIDEProjectionWatcher(options: IDEProjectionWatcherOptions): IDEProjectionWatcher {
  let timer: ReturnType<typeof setInterval> | undefined
  let watchers: Array<ReturnType<typeof watchFS>> = []
  let lastStamp = ""
  let syncing = false

  return {
    async syncOnce() {
      syncing = true
      try {
        const projection = await buildIDEProjection(options.storePaths, {
          limit: options.limit ?? 100,
          cwd: options.cwd,
          mode: options.mode,
        })
        await writeIDEProjection(options.projectionPaths, projection)
        if (options.onSync) await options.onSync(projection)
        return projection
      } finally {
        syncing = false
      }
    },
    start() {
      if (timer || watchers.length > 0) return
      try {
        const triggerSync = async () => {
          if (syncing) return
          const stamp = await computeStamp(options.storePaths)
          if (stamp === lastStamp) return
          lastStamp = stamp
          await this.syncOnce()
        }

        watchers = [
          watchFS(options.storePaths.eventsPath, () => { void triggerSync() }),
          watchFS(options.storePaths.diagnosticsPath, () => { void triggerSync() }),
        ]
      } catch {
        timer = setInterval(async () => {
          const stamp = await computeStamp(options.storePaths)
          if (stamp === lastStamp || syncing) return
          lastStamp = stamp
          await this.syncOnce()
        }, options.intervalMs ?? 1000)
      }
    },
    stop() {
      for (const watcher of watchers) watcher.close()
      watchers = []
      if (!timer) return
      clearInterval(timer)
      timer = undefined
    },
  }
}

async function computeStamp(paths: AIStorePaths): Promise<string> {
  const [eventsMtime, diagnosticsMtime] = await Promise.all([
    Bun.file(paths.eventsPath).exists().then((exists) => exists ? Bun.file(paths.eventsPath).lastModified : 0),
    Bun.file(paths.diagnosticsPath).exists().then((exists) => exists ? Bun.file(paths.diagnosticsPath).lastModified : 0),
  ])
  return `${eventsMtime}:${diagnosticsMtime}`
}
