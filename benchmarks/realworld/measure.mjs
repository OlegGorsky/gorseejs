#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
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
      serverProcess.kill("SIGTERM")
      await new Promise((resolveExit) => serverProcess.once("exit", () => resolveExit(undefined)))
    }
    await rm(appRoot, { recursive: true, force: true })
    await browser.close().catch(() => {})
  }
}

async function main() {
  const tmpDir = join(tmpdir(), `gorsee-realworld-bench-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })

  let serverProcess = null

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
    const multiIslandHydrationMs = await measureHydration()
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
        scenarioCount: 5,
        contentRouteTtfbMs,
        multiIslandHydrationMs,
        resourceRouteRenderMs,
        mutationRollbackMs,
        workspaceBuildMs,
      },
      notes: "Measured artifact generated by benchmarks/realworld/measure.mjs against the built production runtime and workspace reference app.",
    }

    writeFileSync(artifactPath, JSON.stringify(artifact, null, 2) + "\n", "utf-8")
    console.log(`artifact written: ${artifactPath}`)
  } finally {
    if (serverProcess) {
      serverProcess.kill("SIGTERM")
      await new Promise((resolveExit) => serverProcess.once("exit", () => resolveExit(undefined)))
    }
    await rm(tmpDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
