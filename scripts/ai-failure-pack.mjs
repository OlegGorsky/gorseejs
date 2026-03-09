#!/usr/bin/env node

import { mkdir, appendFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { execFileSync } from "node:child_process"

const repoRoot = resolve(import.meta.dirname, "..")
const [kind = "release.failure", code = "RELEASE", ...messageParts] = process.argv.slice(2)
const message = messageParts.join(" ") || "release/deploy failure"
const eventsPath = join(repoRoot, ".gorsee", "ai-events.jsonl")
const diagnosticsPath = join(repoRoot, ".gorsee", "ai-diagnostics.json")
const ts = new Date().toISOString()
const event = {
  id: crypto.randomUUID(),
  kind,
  severity: "error",
  ts,
  source: "cli",
  message,
  code,
  phase: "release",
  data: { code, message },
}
const snapshot = {
  updatedAt: ts,
  latest: {
    code,
    message,
    severity: "error",
    source: "cli",
  },
}

await mkdir(dirname(eventsPath), { recursive: true })
await appendFile(eventsPath, `${JSON.stringify(event)}\n`, "utf-8")
await writeFile(diagnosticsPath, JSON.stringify(snapshot, null, 2), "utf-8")

try {
  execFileSync("bun", ["run", "src/cli/index.ts", "ai", "pack"], {
    cwd: repoRoot,
    stdio: "ignore",
    env: { ...process.env },
  })
} catch {
  // best-effort only
}
