#!/usr/bin/env node

import { appendFile, mkdir } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { dirname, join } from "node:path"

export function parseKeyValueArgs(args) {
  const data = {}
  for (const arg of args) {
    const [key, ...value] = arg.split("=")
    if (!key) continue
    data[key] = value.join("=") || true
  }
  return data
}

export async function emitReleaseEvent(repoRoot, kind, severity = "info", code = "", payload = {}) {
  const message = typeof payload.message === "string" ? payload.message : kind
  const eventsPath = join(repoRoot, ".gorsee", "ai-events.jsonl")
  await mkdir(dirname(eventsPath), { recursive: true })
  await appendFile(eventsPath, `${JSON.stringify({
    id: crypto.randomUUID(),
    kind,
    severity,
    ts: new Date().toISOString(),
    source: "cli",
    message,
    code: code || undefined,
    phase: "release",
    data: payload,
  })}\n`, "utf-8")
}

export const writeArtifactLifecycleEvent = emitReleaseEvent
export const writeArtifactFailurePack = writeReleaseFailurePack
export const writeArtifactSuccessPack = writeReleaseSuccessPack
export const runArtifactLifecycleStep = runReleaseStep

export async function writeReleaseSuccessPack(repoRoot) {
  try {
    execFileSync("bun", ["run", "src/cli/index.ts", "ai", "pack"], {
      cwd: repoRoot,
      stdio: "ignore",
    })
  } catch {
    // best-effort only
  }
}

export async function writeReleaseFailurePack(repoRoot, kind, code, message) {
  try {
    execFileSync("node", ["scripts/ai-failure-pack.mjs", kind, code, message], {
      cwd: repoRoot,
      stdio: "ignore",
    })
  } catch {
    // best-effort only
  }
}

export async function runReleaseStep(repoRoot, options) {
  const { step, version, code, startMessage, finishMessage, finishData = {}, run } = options
  await emitReleaseEvent(repoRoot, `${step}.start`, "info", "", {
    message: startMessage ?? `running ${step} for ${version}`,
    version,
  })

  try {
    const result = await run()
    await emitReleaseEvent(repoRoot, `${step}.finish`, "info", "", {
      message: finishMessage ?? `${step} passed for ${version}`,
      version,
      ...finishData,
    })
    await writeReleaseSuccessPack(repoRoot)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await emitReleaseEvent(repoRoot, `${step}.error`, "error", code ?? "RELEASE_STEP", {
      message,
      version,
      ...finishData,
    })
    await writeReleaseFailurePack(repoRoot, `${step}.failure`, code ?? "RELEASE_STEP", message)
    throw error
  }
}
