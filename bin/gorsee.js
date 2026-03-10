#!/usr/bin/env node

import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { spawnSync } from "node:child_process"

const binDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(binDir, "..")
const publishedCliEntry = join(packageRoot, "dist-pkg", "cli", "index.js")
const sourceCliEntry = join(packageRoot, "src", "cli", "index.ts")

function runWithBun(entry) {
  const result = spawnSync("bun", ["run", entry, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    stdio: "inherit",
  })
  process.exit(result.status ?? 1)
}

function hasBun() {
  const result = spawnSync("bun", ["--version"], {
    cwd: packageRoot,
    stdio: "ignore",
  })
  return result.status === 0
}

if (existsSync(publishedCliEntry) && hasBun()) {
  runWithBun(publishedCliEntry)
} else if (existsSync(sourceCliEntry) && hasBun()) {
  runWithBun(sourceCliEntry)
} else if (existsSync(publishedCliEntry)) {
  await import(pathToFileURL(publishedCliEntry).href)
} else {
  console.error("gorsee launcher could not find a runnable CLI entrypoint.")
  process.exit(1)
}
