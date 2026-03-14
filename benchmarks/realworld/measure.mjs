#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"

const benchmarkRoot = resolve(import.meta.dirname)
const repoRoot = resolve(import.meta.dirname, "..", "..")
const workspaceAppRoot = resolve(repoRoot, "examples", "workspace-monorepo", "apps", "web")
const cliEntry = join(repoRoot, "src", "cli", "index.ts")
const artifactPath = join(benchmarkRoot, "artifact.json")
const port = 4329
const origin = `http://127.0.0.1:${port}`
const benchOrigin = "http://127.0.0.1:4330"

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    })
    let stdout = ""
    let stderr = ""
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk)
    })
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk)
    })
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun({ stdout, stderr })
        return
      }
      rejectRun(new Error(`command failed: ${command} ${args.join(" ")}\n${stdout}${stderr}`))
    })
  })
}

async function stopProcess(child) {
  if (!child) return
  if (child.exitCode !== null) return
  child.kill("SIGTERM")
  await new Promise((resolveExit) => {
    if (child.exitCode !== null) {
      resolveExit(undefined)
      return
    }
    child.once("exit", () => resolveExit(undefined))
  })
}

async function waitForServer(url, serverProcess) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`benchmark server exited early with code ${serverProcess.exitCode}`)
    }
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}
    await delay(250)
  }
  throw new Error(`benchmark server did not become ready: ${url}`)
}

async function measureAsync(label, fn, repeats = 3) {
  const samples = []
  for (let index = 0; index < repeats; index++) {
    const start = performance.now()
    await fn()
    samples.push(performance.now() - start)
  }
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length
  console.log(`${label}: ${average.toFixed(2)}ms (${samples.map((sample) => sample.toFixed(1)).join(", ")})`)
  return Number(average.toFixed(2))
}

async function measureCommand(label, command, args, options = {}) {
  return measureAsync(label, () => run(command, args, options), 1)
}

async function login() {
  const body = new URLSearchParams({
    email: "jake@example.com",
    password: "password123",
  })
  const response = await fetch(`${origin}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    redirect: "manual",
  })
  const cookie = response.headers.get("set-cookie")
  if (!cookie) {
    throw new Error("benchmark login did not return a session cookie")
  }
  return cookie.split(";", 1)[0]
}

function resolveBrowserExecutable() {
  const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  if (envPath) return envPath
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      const resolved = execFileSync("sh", ["-lc", `command -v ${candidate}`], {
        cwd: repoRoot,
        env: process.env,
        encoding: "utf-8",
      }).trim()
      if (resolved) return resolved
    } catch {}
  }
  return undefined
}

async function measureHydration() {
  const { chromium } = await import("playwright")
  const appRoot = join(tmpdir(), `gorsee-realworld-hydration-${Date.now()}`)
  const appDir = join(appRoot, "app")
  mkdirSync(appRoot, { recursive: true })
  let serverProcess = null
  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveBrowserExecutable(),
  })
  try {
    await run("bun", ["run", cliEntry, "create", "app"], { cwd: appRoot, env: process.env })
    writeFileSync(join(appDir, "routes", "index.tsx"), `
      import { createSignal, island } from "gorsee/client"

      const BenchCounter = island(function BenchCounter(props: { label: string }) {
        const [count, setCount] = createSignal(0)
        return (
          <button data-bench-island={props.label} on:click={() => setCount((value) => value + 1)}>
            {props.label}:{count()}
          </button>
        )
      })

      export default function HydrationBenchPage() {
        return (
          <main>
            <h1>Hydration Bench</h1>
            <BenchCounter label="alpha" />
            <BenchCounter label="beta" />
            <BenchCounter label="gamma" />
          </main>
        )
      }
    `.trim() + "\n", "utf-8")
    writeFileSync(join(appDir, "app.config.ts"), `
      export default {
        security: {
          origin: "http://127.0.0.1:4330",
        },
      }
    `.trim() + "\n", "utf-8")
    await run("bun", ["run", cliEntry, "build"], { cwd: appDir, env: process.env })
    serverProcess = spawn("bun", ["run", cliEntry, "start"], {
      cwd: appDir,
      env: { ...process.env, PORT: "4330", APP_ORIGIN: "http://127.0.0.1:4330" },
      stdio: ["ignore", "pipe", "pipe"],
    })
    await waitForServer("http://127.0.0.1:4330", serverProcess)

    const page = await browser.newPage()
    const startedAt = performance.now()
    await page.goto("http://127.0.0.1:4330", { waitUntil: "networkidle" })
    await page.waitForSelector('[data-bench-island="alpha"]')
    await page.waitForFunction(() =>
      typeof window.__GORSEE_ROUTE_SCRIPT__ === "string"
      && window.__GORSEE_ROUTE_SCRIPT__.includes("index"),
    )
    return Number((performance.now() - startedAt).toFixed(2))
  } finally {
    if (serverProcess) {
      await stopProcess(serverProcess)
    }
    await rm(appRoot, { recursive: true, force: true })
    await browser.close().catch(() => {})
  }
}

function buildBenchComponentsSource() {
  return `
    import { createEffect, createMutation, createResource, createSignal, invalidateResource, island } from "gorsee/client"

    function sleep(ms: number) {
      return new Promise<void>((resolve) => setTimeout(resolve, ms))
    }

    function setBenchState(key: string, value: Record<string, unknown>) {
      if (typeof window === "undefined") return
      const globalBench = ((window as unknown as { __GORSEE_BENCH__?: Record<string, unknown> }).__GORSEE_BENCH__ ??= {})
      globalBench[key] = value
    }

    function registerBenchAction(key: string, action: () => void | Promise<void>) {
      if (typeof window === "undefined") return
      const globalBench = ((window as unknown as { __GORSEE_BENCH__?: Record<string, unknown> }).__GORSEE_BENCH__ ??= {})
      const actions = (globalBench.actions ??= {}) as Record<string, () => void | Promise<void>>
      actions[key] = action
    }

    export const BenchCounter = island(function BenchCounter(props: { label: string }) {
      const [count, setCount] = createSignal(0)
      return (
        <button data-bench-island={props.label} onclick={() => setCount((value) => value + 1)}>
          {props.label}:{count()}
        </button>
      )
    })

    export const ResourcePressureBench = island(function ResourcePressureBench() {
      const [epoch, setEpoch] = createSignal(0)
      const [runId, setRunId] = createSignal(0)
      const [data, state] = createResource(async () => {
        const currentEpoch = epoch()
        const currentRunId = runId()
        await sleep(8)
        return \`epoch-\${currentEpoch}-run-\${currentRunId}\`
      }, {
        key: "resource-bench",
        label: "resource-bench",
      })

      if (typeof window !== "undefined") {
        createEffect(() => {
          setBenchState("resourceReactive", {
            epoch: epoch(),
            loading: state.loading(),
            value: data() ?? null,
            error: state.error()?.message ?? null,
          })
        })
      }

      async function runPressure() {
        setBenchState("resourcePressure", {
          done: false,
          phase: "running",
        })
        const startedAt = performance.now()
        for (let step = 1; step <= 12; step++) {
          setEpoch(step)
          setRunId((value) => value + 1)
          state.refetch()
          if (step % 3 === 0) {
            invalidateResource("resource-bench")
          }
          await sleep(12)
        }
        await sleep(24)
        setBenchState("resourcePressure", {
          done: true,
          phase: "settled",
          durationMs: Number((performance.now() - startedAt).toFixed(2)),
          value: data() ?? null,
          loading: state.loading(),
          error: state.error()?.message ?? null,
        })
      }

      if (typeof window !== "undefined") {
        registerBenchAction("resourcePressure", () => runPressure())
        setBenchState("resourceAction", { ready: true })
      }

      return (
        <section>
          <h2>Resource Pressure</h2>
          <p data-bench-resource-value>{data() ?? "pending"}</p>
          <button id="resource-bench-run" onclick={() => { void runPressure() }}>
            Run resource invalidation pressure
          </button>
        </section>
      )
    })

    function initialPanels() {
      return Array.from({ length: 4 }, (_, index) => ({
        id: index + 1,
        value: index + 1,
      }))
    }

    export const MutationPressureBench = island(function MutationPressureBench() {
      const [panels, setPanels] = createSignal(initialPanels())
      const mutation = createMutation({
        label: "mutation-pressure",
        mutationFn: async ({ step }: { step: number }) => {
          await sleep(8)
          if (step % 2 === 0) {
            throw new Error(\`rollback-\${step}\`)
          }
          return \`ok-\${step}\`
        },
      })

      if (typeof window !== "undefined") {
        createEffect(() => {
          setBenchState("mutationReactive", {
            pending: mutation.isPending(),
            error: mutation.error()?.message ?? null,
            total: panels().reduce((sum, panel) => sum + panel.value, 0),
          })
        })
      }

      async function runPressure() {
        setPanels(initialPanels())
        mutation.reset()
        setBenchState("mutationPressure", {
          done: false,
          phase: "running",
        })
        const startedAt = performance.now()
        for (let step = 1; step <= 10; step++) {
          try {
            await mutation.optimistic(
              panels,
              (next) => setPanels(next),
              (current, variables) => current.map((panel, index) => ({
                ...panel,
                value: panel.value + variables.step + index + 1,
              })),
              { step },
            )
          } catch {}
          await sleep(6)
        }
        await sleep(12)
        setBenchState("mutationPressure", {
          done: true,
          phase: "settled",
          durationMs: Number((performance.now() - startedAt).toFixed(2)),
          total: panels().reduce((sum, panel) => sum + panel.value, 0),
          pending: mutation.isPending(),
          error: mutation.error()?.message ?? null,
        })
      }

      if (typeof window !== "undefined") {
        registerBenchAction("mutationPressure", () => runPressure())
        setBenchState("mutationAction", { ready: true })
      }

      return (
        <section>
          <h2>Mutation Pressure</h2>
          <div>
            {() => panels().map((panel) => (
              <span data-bench-panel={String(panel.id)}>
                Panel {panel.id}:{panel.value}
              </span>
            ))}
          </div>
          <button id="mutation-bench-run" onclick={() => { void runPressure() }}>
            Run mutation rollback pressure
          </button>
        </section>
      )
    })
  `.trim() + "\n"
}

function buildSmallRouteSource() {
  return `
    import { BenchCounter } from "../components/bench"

    export default function HydrationBenchPage() {
      return (
        <main>
          <h1>Hydration Bench</h1>
          <p>Small multi-island route used as the baseline hydration scenario.</p>
          <section>
            <BenchCounter label="alpha" />
            <BenchCounter label="beta" />
            <BenchCounter label="gamma" />
          </section>
        </main>
      )
    }
  `.trim() + "\n"
}

function buildLargeRouteSource() {
  return `
    import { BenchCounter, MutationPressureBench, ResourcePressureBench } from "../components/bench"

    const labels = Array.from({ length: 24 }, (_, index) => \`island-\${index + 1}\`)
    const paragraphs = Array.from({ length: 18 }, (_, index) => \`Mixed-content SSR block \${index + 1} for large route hydration measurement.\`)

    export default function LargeHydrationBenchPage() {
      return (
        <main>
          <h1>Large Route Bench</h1>
          <p>Large mixed-content route used to measure hydration growth and multi-island route expansion.</p>
          <section>
            {paragraphs.map((copy, index) => (
              <article data-bench-copy={String(index + 1)}>
                <h2>Section {index + 1}</h2>
                <p>{copy}</p>
              </article>
            ))}
          </section>
          <section>
            {labels.map((label) => <BenchCounter label={label} />)}
          </section>
          <ResourcePressureBench />
          <MutationPressureBench />
        </main>
      )
    }
  `.trim() + "\n"
}

async function setupBenchApp() {
  const { chromium } = await import("playwright")
  const appRoot = join(tmpdir(), `gorsee-reactive-bench-${Date.now()}`)
  const appDir = join(appRoot, "app")
  mkdirSync(appRoot, { recursive: true })
  let serverProcess = null
  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveBrowserExecutable(),
  })

  try {
    await run("bun", ["run", cliEntry, "create", "app"], { cwd: appRoot, env: process.env })
    mkdirSync(join(appDir, "components"), { recursive: true })
    writeFileSync(join(appDir, "components", "bench.tsx"), buildBenchComponentsSource(), "utf-8")
    writeFileSync(join(appDir, "routes", "index.tsx"), buildSmallRouteSource(), "utf-8")
    writeFileSync(join(appDir, "routes", "large.tsx"), buildLargeRouteSource(), "utf-8")
    writeFileSync(join(appDir, "app.config.ts"), `
      export default {
        security: {
          origin: "${benchOrigin}",
        },
      }
    `.trim() + "\n", "utf-8")
    await run("bun", ["run", cliEntry, "build"], { cwd: appDir, env: process.env })
    serverProcess = spawn("bun", ["run", cliEntry, "start"], {
      cwd: appDir,
      env: { ...process.env, PORT: "4330", APP_ORIGIN: benchOrigin },
      stdio: ["ignore", "pipe", "pipe"],
    })
    await waitForServer(benchOrigin, serverProcess)
    return { appRoot, browser, serverProcess }
  } catch (error) {
    if (serverProcess) {
      serverProcess.kill("SIGTERM")
      await new Promise((resolveExit) => serverProcess.once("exit", () => resolveExit(undefined)))
    }
    await rm(appRoot, { recursive: true, force: true })
    await browser.close().catch(() => {})
    throw error
  }
}

async function teardownBenchApp(benchApp) {
  if (benchApp.serverProcess) {
    await stopProcess(benchApp.serverProcess)
  }
  await rm(benchApp.appRoot, { recursive: true, force: true })
  await benchApp.browser.close().catch(() => {})
}

async function measureBenchPage(browser, path, selector) {
  const page = await browser.newPage()
  try {
    const startedAt = performance.now()
    await page.goto(`${benchOrigin}${path}`, { waitUntil: "networkidle" })
    await page.waitForSelector(selector)
    await page.waitForFunction(() =>
      typeof window.__GORSEE_ROUTE_SCRIPT__ === "string"
      && window.__GORSEE_ROUTE_SCRIPT__.length > 0,
    )
    return Number((performance.now() - startedAt).toFixed(2))
  } finally {
    await page.close()
  }
}

async function measureBenchAction(browser, path, triggerSelector, resultKey, readySelector, readyBenchKey, actionKey) {
  const page = await browser.newPage()
  try {
    await page.goto(`${benchOrigin}${path}`, { waitUntil: "networkidle" })
    await page.waitForSelector(readySelector)
    if (readyBenchKey) {
      await page.waitForFunction((benchKey) => {
        const bench = (window.__GORSEE_BENCH__ ?? {})[benchKey]
        return Boolean(bench)
      }, readyBenchKey)
    }
    await page.waitForFunction((benchActionKey) => {
      const bench = window.__GORSEE_BENCH__ ?? {}
      return Boolean(bench.actions && typeof bench.actions[benchActionKey] === "function")
    }, actionKey)
    await page.evaluate(async (benchActionKey) => {
      const bench = window.__GORSEE_BENCH__ ?? {}
      const action = bench.actions?.[benchActionKey]
      if (typeof action !== "function") {
        throw new Error(`missing benchmark action ${benchActionKey}`)
      }
      await action()
    }, actionKey)
    await page.waitForFunction((benchKey) => {
      const bench = (window.__GORSEE_BENCH__ ?? {})[benchKey]
      return Boolean(bench && bench.done === true)
    }, resultKey)
    return await page.evaluate((benchKey) => {
      const bench = (window.__GORSEE_BENCH__ ?? {})[benchKey]
      if (!bench || typeof bench.durationMs !== "number") {
        throw new Error(`missing benchmark duration for ${benchKey}`)
      }
      return bench.durationMs
    }, resultKey)
  } finally {
    await page.close()
  }
}

async function main() {
  const tmpDir = join(tmpdir(), `gorsee-realworld-bench-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })

  let serverProcess = null
  let benchApp = null

  try {
    await run("bun", ["run", "seed"], { cwd: benchmarkRoot, env: process.env })
    await run("bun", ["run", "build"], { cwd: benchmarkRoot, env: process.env })

    serverProcess = spawn("bun", ["run", "start"], {
      cwd: benchmarkRoot,
      env: { ...process.env, PORT: String(port), APP_ORIGIN: origin },
      stdio: ["ignore", "pipe", "pipe"],
    })

    await waitForServer(origin, serverProcess)

    const sessionCookie = await login()
    const contentRouteTtfbMs = await measureAsync("contentRouteTtfbMs", async () => {
      const response = await fetch(`${origin}/`)
      await response.text()
    })
    const resourceRouteRenderMs = await measureAsync("resourceRouteRenderMs", async () => {
      const response = await fetch(`${origin}/article/getting-started-with-gorsee-js`)
      await response.text()
    })
    const mutationRollbackMs = await measureAsync("mutationRollbackMs", async () => {
      const body = new URLSearchParams({ articleId: "1" })
      const response = await fetch(`${origin}/api/favorite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": sessionCookie,
        },
        body,
      })
      await response.text()
    })
    console.log("phase: baseline-runtime-metrics-complete")
    const multiIslandHydrationMs = await measureHydration()
    console.log("phase: hydration-benchmark-complete")
    benchApp = await setupBenchApp()
    console.log("phase: bench-app-ready")
    const baselineHydrationMs = await measureBenchPage(benchApp.browser, "/", '[data-bench-island="alpha"]')
    console.log(`phase: bench-small-route ${baselineHydrationMs}`)
    const expandedHydrationMs = await measureBenchPage(benchApp.browser, "/large", '[data-bench-island="island-24"]')
    console.log(`phase: bench-large-route ${expandedHydrationMs}`)
    const hydrationGrowthMs = Number(Math.max(0, expandedHydrationMs - baselineHydrationMs).toFixed(2))
    const multiIslandRouteGrowthMs = expandedHydrationMs
    const resourceInvalidationPressureMs = await measureBenchAction(
      benchApp.browser,
      "/large",
      "#resource-bench-run",
      "resourcePressure",
      "#resource-bench-run",
      "resourceReactive",
      "resourcePressure",
    )
    console.log(`phase: resource-pressure ${resourceInvalidationPressureMs}`)
    const rollbackHeavyMutationsMs = await measureBenchAction(
      benchApp.browser,
      "/large",
      "#mutation-bench-run",
      "mutationPressure",
      "#mutation-bench-run",
      "mutationReactive",
      "mutationPressure",
    )
    console.log(`phase: mutation-pressure ${rollbackHeavyMutationsMs}`)
    const workspaceBuildMs = await measureCommand(
      "workspaceBuildMs",
      "bun",
      ["run", cliEntry, "build"],
      { cwd: workspaceAppRoot, env: process.env },
    )

    const artifact = {
      benchmark: "realworld",
      kind: "fullstack-shape",
      ts: new Date().toISOString(),
      environment: {
        runtime: `bun@${execFileSync("bun", ["--version"], { encoding: "utf-8" }).trim()}`,
        os: process.platform,
        cpu: process.arch,
      },
      metrics: {
        scenarioCount: 9,
        contentRouteTtfbMs,
        hydrationGrowthMs,
        multiIslandHydrationMs,
        multiIslandRouteGrowthMs,
        resourceInvalidationPressureMs,
        resourceRouteRenderMs,
        mutationRollbackMs,
        rollbackHeavyMutationsMs,
        workspaceBuildMs,
      },
      notes: "Measured artifact generated by benchmarks/realworld/measure.mjs against the built production runtime, workspace reference app, and dedicated reactive pressure benchmark routes.",
    }

    writeFileSync(artifactPath, JSON.stringify(artifact, null, 2) + "\n", "utf-8")
    console.log(`artifact written: ${artifactPath}`)
  } finally {
    if (benchApp) {
      await teardownBenchApp(benchApp)
    }
    if (serverProcess) {
      await stopProcess(serverProcess)
    }
    await rm(tmpDir, { recursive: true, force: true })
    rmSync(join(benchmarkRoot, ".gorsee"), { recursive: true, force: true })
    rmSync(join(benchmarkRoot, "dist"), { recursive: true, force: true })
    rmSync(join(benchmarkRoot, "realworld.db"), { force: true })
    rmSync(join(benchmarkRoot, "realworld.db-shm"), { force: true })
    rmSync(join(benchmarkRoot, "realworld.db-wal"), { force: true })
    console.log("phase: benchmark-cleanup-complete")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
