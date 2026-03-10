#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { chromium, firefox, webkit } from "playwright"

const repoRoot = resolve(import.meta.dirname, "..")
const cliEntry = join(repoRoot, "src", "cli", "index.ts")
const smokeRoot = mkdtempSync(join(tmpdir(), "gorsee-browser-smoke-"))
const appDir = join(smokeRoot, "app")
const port = 4317
const origin = `http://127.0.0.1:${port}`
const browserName = process.env.PLAYWRIGHT_BROWSER ?? "chromium"

function getBrowserType() {
  switch (browserName) {
    case "chromium":
      return chromium
    case "firefox":
      return firefox
    case "webkit":
      return webkit
    default:
      throw new Error(`unsupported PLAYWRIGHT_BROWSER: ${browserName}`)
  }
}

function resolveBrowserExecutable() {
  if (browserName !== "chromium") return undefined
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

async function waitForServer(url, serverProcess, getLogs = () => "") {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      const logs = getLogs().trim()
      throw new Error(`browser smoke server exited early with code ${serverProcess.exitCode}${logs ? `\n${logs}` : ""}`)
    }
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}
    await delay(250)
  }
  const logs = getLogs().trim()
  throw new Error(`browser smoke server did not become ready: ${url}${logs ? `\n${logs}` : ""}`)
}

function createSmokeApp() {
  mkdirSync(join(appDir, "routes"), { recursive: true })

  writeFileSync(join(appDir, "app.config.ts"), `
    export default {
      security: {
        origin: "${origin}",
      },
    }
  `.trim() + "\n")

  writeFileSync(join(appDir, "routes", "index.tsx"), `
    import { Head, Link, createSignal } from "gorsee/client"

    export default function HomePage() {
      const [count, setCount] = createSignal(0)

      return (
        <>
          <Head><title>Browser Smoke Home</title></Head>
          <main>
            <h1>Browser Smoke Home</h1>
            <div style={{ height: "1400px" }}>
              <label for="draft-home">Draft</label>
              <input id="draft-home" name="draft" data-g-preserve-key="draft" />
            </div>
            <button id="counter" on:click={() => setCount((value) => value + 1)}>
              Count: {count}
            </button>
            <Link id="about-link" href="/about?tab=details">About Page</Link>
            <Link id="post-link" href="/posts/alpha">Post Alpha</Link>
            <Link id="feedback-link" href="/feedback">Feedback</Link>
            <Link id="slow-link" href="/slow">Slow Route</Link>
            <Link id="fast-link" href="/fast">Fast Route</Link>
          </main>
        </>
      )
    }
  `.trim() + "\n")

  writeFileSync(join(appDir, "routes", "about.tsx"), `
    import { Head, Link } from "gorsee/client"

    export default function AboutPage() {
      return (
        <>
          <Head><title>Browser Smoke About</title></Head>
          <main>
            <h1>About Browser Smoke</h1>
            <label for="draft-about">Draft</label>
            <input id="draft-about" name="draft" data-g-preserve-key="draft" />
            <p id="about-copy">client navigation is active</p>
            <p id="about-query">{globalThis.location?.search || ""}</p>
            <Link id="home-link" href="/">Home Page</Link>
          </main>
        </>
      )
    }
  `.trim() + "\n")

  mkdirSync(join(appDir, "routes", "posts"), { recursive: true })
  mkdirSync(join(appDir, "routes", "feedback"), { recursive: true })

  writeFileSync(join(appDir, "routes", "posts", "[slug].tsx"), `
    import { Head, Link } from "gorsee/client"

    export default function PostPage(props) {
      return (
        <>
          <Head><title>Post {props.params.slug}</title></Head>
          <main>
            <h1 id="post-heading">Post {props.params.slug}</h1>
            <p id="post-param">{props.params.slug}</p>
            <Link id="post-home-link" href="/">Home Page</Link>
          </main>
        </>
      )
    }
  `.trim() + "\n")

  writeFileSync(join(appDir, "routes", "feedback.tsx"), `
    import type { Context } from "gorsee/server"
    import { Head, Link } from "gorsee/client"

    export async function POST(ctx: Context) {
      const form = await ctx.request.formData()
      const message = String(form.get("message") ?? "").trim()
      return Response.redirect(new URL("/feedback/sent?message=" + encodeURIComponent(message), ctx.request.url), 303)
    }

    export default function FeedbackPage() {
      return (
        <>
          <Head><title>Feedback</title></Head>
          <main>
            <h1>Feedback</h1>
            <form method="POST" action="/feedback">
              <label for="feedback-message">Message</label>
              <input id="feedback-message" name="message" />
              <button id="feedback-submit" type="submit">Send</button>
            </form>
            <Link href="/">Home Page</Link>
          </main>
        </>
      )
    }
  `.trim() + "\n")

  writeFileSync(join(appDir, "routes", "feedback", "sent.tsx"), `
    import { Head, Link } from "gorsee/client"

    export default function FeedbackSentPage() {
      const message = typeof location === "undefined"
        ? ""
        : new URLSearchParams(location.search).get("message") ?? ""

      return (
        <>
          <Head><title>Feedback Sent</title></Head>
          <main>
            <h1 id="feedback-sent-heading">Feedback Sent</h1>
            <p id="feedback-message-copy">{message}</p>
            <Link href="/">Home Page</Link>
          </main>
        </>
      )
    }
  `.trim() + "\n")

  writeFileSync(join(appDir, "routes", "slow.tsx"), `
    import { Head, Link } from "gorsee/client"

    export async function load() {
      await new Promise((resolve) => setTimeout(resolve, 400))
      return { route: "slow" }
    }

    export default function SlowPage() {
      return (
        <>
          <Head><title>Slow Route</title></Head>
          <main>
            <h1 id="slow-heading">Slow Route</h1>
            <Link href="/">Home Page</Link>
          </main>
        </>
      )
    }
  `.trim() + "\n")

  writeFileSync(join(appDir, "routes", "fast.tsx"), `
    import { Head, Link } from "gorsee/client"

    export default function FastPage() {
      return (
        <>
          <Head><title>Fast Route</title></Head>
          <main>
            <h1 id="fast-heading">Fast Route</h1>
            <Link href="/">Home Page</Link>
          </main>
        </>
      )
    }
  `.trim() + "\n")
}

async function main() {
  let serverProcess = null
  let browser = null

  try {
    await run("bun", ["run", cliEntry, "create", "app"], { cwd: smokeRoot, env: process.env })
    createSmokeApp()
    await run("bun", ["run", cliEntry, "build"], {
      cwd: appDir,
      env: { ...process.env, GORSEE_BUILD_BACKEND: "rolldown" },
    })

    serverProcess = spawn("bun", ["run", cliEntry, "start"], {
      cwd: appDir,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    })

    let serverLogs = ""
    serverProcess.stdout?.on("data", (chunk) => {
      serverLogs += String(chunk)
    })
    serverProcess.stderr?.on("data", (chunk) => {
      serverLogs += String(chunk)
    })

    await waitForServer(origin, serverProcess, () => serverLogs)

    browser = await getBrowserType().launch({
      headless: true,
      executablePath: resolveBrowserExecutable(),
    })
    const page = await browser.newPage()
    await page.goto(origin, { waitUntil: "networkidle" })
    await page.waitForSelector("h1")
    if ((await page.textContent("h1"))?.trim() !== "Browser Smoke Home") {
      throw new Error("browser smoke lost home route heading")
    }
    await page.click("#counter")
    await page.waitForFunction(() => document.querySelector("#counter")?.textContent?.includes("Count: 1"))
    if (!(await page.textContent("#counter"))?.includes("Count: 1")) {
      throw new Error("browser smoke lost client hydration click semantics")
    }

    await page.fill("#draft-home", "kept across navigation")
    await page.focus("#draft-home")
    await page.evaluate(() => window.scrollTo(0, 900))

    await page.click("#about-link")
    await page.waitForURL(`${origin}/about?tab=details`)
    await page.waitForSelector("#about-copy")
    if ((await page.textContent("#about-copy"))?.trim() !== "client navigation is active") {
      throw new Error("browser smoke lost about page copy")
    }
    if ((await page.textContent("h1"))?.trim() !== "About Browser Smoke") {
      throw new Error("browser smoke lost about route heading")
    }
    if ((await page.textContent("#about-query"))?.trim() !== "?tab=details") {
      throw new Error("browser smoke lost query-bearing navigation semantics")
    }
    if ((await page.inputValue("#draft-about")) !== "kept across navigation") {
      throw new Error("browser smoke did not preserve form value across navigation")
    }
    if ((await page.evaluate(() => document.activeElement?.id)) !== "draft-about") {
      throw new Error("browser smoke did not preserve focus across navigation")
    }
    if ((await page.evaluate(() => window.scrollY)) !== 0) {
      throw new Error("browser smoke did not reset scroll on push navigation")
    }

    await page.goBack({ waitUntil: "networkidle" })
    await page.waitForURL(origin + "/")
    await page.waitForSelector("#draft-home")
    if ((await page.inputValue("#draft-home")) !== "kept across navigation") {
      throw new Error("browser smoke did not restore home form value after popstate")
    }
    if ((await page.evaluate(() => document.activeElement?.id)) !== "draft-home") {
      throw new Error("browser smoke did not restore focus after popstate navigation")
    }
    if ((await page.evaluate(() => window.scrollY)) < 800) {
      throw new Error("browser smoke did not restore scroll on popstate navigation")
    }

    await page.click("#post-link")
    await page.waitForURL(`${origin}/posts/alpha`)
    if ((await page.textContent("#post-heading"))?.trim() !== "Post alpha") {
      throw new Error("browser smoke lost dynamic route heading semantics")
    }
    if ((await page.textContent("#post-param"))?.trim() !== "alpha") {
      throw new Error("browser smoke lost dynamic route params")
    }

    await page.click("#post-home-link")
    await page.waitForURL(origin + "/")
    await page.click("#feedback-link")
    await page.waitForURL(`${origin}/feedback`)
    await page.fill("#feedback-message", "smoke-form")
    await page.click("#feedback-submit")
    await page.waitForURL(`${origin}/feedback/sent?message=smoke-form`)
    if ((await page.textContent("#feedback-sent-heading"))?.trim() !== "Feedback Sent") {
      throw new Error("browser smoke lost form redirect contract")
    }
    if ((await page.textContent("#feedback-message-copy"))?.trim() !== "smoke-form") {
      throw new Error("browser smoke lost submitted form data on redirect")
    }

    await page.goto(origin, { waitUntil: "networkidle" })
    const slowClick = page.click("#slow-link")
    await page.click("#fast-link")
    await slowClick.catch(() => {})
    await page.waitForURL(`${origin}/fast`)
    if ((await page.textContent("#fast-heading"))?.trim() !== "Fast Route") {
      throw new Error("browser smoke did not keep the latest navigation result during slow/fast races")
    }
    console.log(`browser:smoke OK (${browserName})`)
  } finally {
    if (browser) await browser.close().catch(() => {})
    if (serverProcess) {
      serverProcess.kill("SIGTERM")
      await new Promise((resolveExit) => serverProcess.once("exit", () => resolveExit(undefined)))
    }
    rmSync(smokeRoot, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
