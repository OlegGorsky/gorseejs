// File watcher for dev mode -- triggers rebuild on changes

import { watch, type FSWatcher } from "node:fs"
import { join } from "node:path"
import { log } from "../log/index.ts"

export interface WatcherOptions {
  dirs: string[]
  onChange: (path: string) => void
  debounceMs?: number
}

export function startWatcher(options: WatcherOptions): () => void {
  const { dirs, onChange, debounceMs = 100 } = options
  const watchers: FSWatcher[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingPath = ""

  function handle(filename: string | null, dir: string) {
    if (!filename) return
    if (!filename.match(/\.(tsx?|jsx?|css)$/)) return

    pendingPath = join(dir, filename)

    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      log.info("file changed", { file: pendingPath })
      onChange(pendingPath)
      timer = null
    }, debounceMs)
  }

  for (const dir of dirs) {
    try {
      const w = watch(dir, { recursive: true }, (_event, filename) => {
        handle(filename as string | null, dir)
      })
      watchers.push(w)
    } catch {
      // directory may not exist
    }
  }

  return () => {
    for (const w of watchers) w.close()
    if (timer) clearTimeout(timer)
  }
}
