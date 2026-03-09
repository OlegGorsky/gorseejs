import { appendFile, mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

export interface ArtifactLifecycleEventInput {
  cwd: string
  source: "deploy" | "cli" | "build"
  phase: "deploy" | "release" | "build"
  kind: string
  severity: "info" | "warn" | "error"
  message: string
  code?: string
  data?: Record<string, unknown>
}

export async function writeArtifactLifecycleEvent(input: ArtifactLifecycleEventInput): Promise<void> {
  const gorseeDir = join(input.cwd, ".gorsee")
  await mkdir(gorseeDir, { recursive: true })
  const ts = new Date().toISOString()
  await appendFile(join(gorseeDir, "ai-events.jsonl"), `${JSON.stringify({
    id: crypto.randomUUID(),
    kind: input.kind,
    severity: input.severity,
    ts,
    source: input.source,
    message: input.message,
    code: input.code,
    phase: input.phase,
    data: input.data,
  })}\n`, "utf-8")
}

export async function writeArtifactSuccessPack(cwd: string): Promise<void> {
  const repoCliEntry = join(import.meta.dir, "..", "cli", "index.ts")
  try {
    await Bun.$`bun run ${repoCliEntry} ai pack`.cwd(cwd).quiet()
  } catch {
    // best-effort only
  }
}

export async function writeArtifactFailurePack(
  cwd: string,
  source: "deploy" | "cli" | "build",
  kind: string,
  code: string,
  message: string,
): Promise<void> {
  const gorseeDir = join(cwd, ".gorsee")
  await mkdir(gorseeDir, { recursive: true })
  const ts = new Date().toISOString()
  await appendFile(join(gorseeDir, "ai-events.jsonl"), `${JSON.stringify({
    id: crypto.randomUUID(),
    kind,
    severity: "error",
    ts,
    source,
    message,
    code,
  })}\n`, "utf-8")
  await writeFile(join(gorseeDir, "ai-diagnostics.json"), JSON.stringify({
    updatedAt: ts,
    latest: {
      code,
      message,
      severity: "error",
      source,
    },
  }, null, 2), "utf-8")
  await writeArtifactSuccessPack(cwd)
}

export async function runArtifactLifecycleStep<T>(input: {
  cwd: string
  source: "deploy" | "cli" | "build"
  phase: "deploy" | "release" | "build"
  step: string
  version?: string
  code?: string
  startMessage: string
  finishMessage: string
  data?: Record<string, unknown>
  run: () => Promise<T>
}): Promise<T> {
  await writeArtifactLifecycleEvent({
    cwd: input.cwd,
    source: input.source,
    phase: input.phase,
    kind: `${input.step}.start`,
    severity: "info",
    message: input.startMessage,
    data: {
      version: input.version,
      ...(input.data ?? {}),
    },
  })

  try {
    const result = await input.run()
    await writeArtifactLifecycleEvent({
      cwd: input.cwd,
      source: input.source,
      phase: input.phase,
      kind: `${input.step}.finish`,
      severity: "info",
      message: input.finishMessage,
      data: {
        version: input.version,
        ...(input.data ?? {}),
      },
    })
    await writeArtifactSuccessPack(input.cwd)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await writeArtifactLifecycleEvent({
      cwd: input.cwd,
      source: input.source,
      phase: input.phase,
      kind: `${input.step}.error`,
      severity: "error",
      message,
      code: input.code,
      data: {
        version: input.version,
        ...(input.data ?? {}),
      },
    })
    await writeArtifactFailurePack(input.cwd, input.source, `${input.step}.failure`, input.code ?? "ARTIFACT_STEP", message)
    throw error
  }
}
