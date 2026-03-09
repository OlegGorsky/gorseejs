#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runReleaseStep } from "./ai-release-utils.mjs"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const tarballName = `${packageJson.name}-${packageJson.version}.tgz`
const tarballPath = join(repoRoot, tarballName)
const smokeRoot = mkdtempSync(join(tmpdir(), "gorsee-release-smoke-"))
const artifactsRoot = join(smokeRoot, "artifacts")
const standaloneCreateRoot = join(artifactsRoot, "create-gorsee")
const npmCache = mkdtempSync(join(tmpdir(), "gorsee-release-smoke-cache-"))
const bunTempEnv = {
  ...process.env,
  TMPDIR: smokeRoot,
  TMP: smokeRoot,
  TEMP: smokeRoot,
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  })
}

function runIn(dir, command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: dir,
    encoding: "utf-8",
    stdio: "inherit",
    ...options,
  })
}

function patchDependency(appDir, value) {
  const appPackagePath = join(appDir, "package.json")
  const appPackage = JSON.parse(readFileSync(appPackagePath, "utf-8"))
  appPackage.dependencies.gorsee = value
  writeFileSync(appPackagePath, JSON.stringify(appPackage, null, 2) + "\n")
}

function stageStandaloneCreatePackage(packageRoot) {
  rmSync(packageRoot, { recursive: true, force: true })
  mkdirSync(packageRoot, { recursive: true })
  copyFileSync(join(repoRoot, "create-gorsee", "index.js"), join(packageRoot, "index.js"))
  const pkg = JSON.parse(readFileSync(join(repoRoot, "create-gorsee", "package.json"), "utf-8"))
  pkg.dependencies.gorsee = `file:${tarballPath}`
  writeFileSync(join(packageRoot, "package.json"), JSON.stringify(pkg, null, 2) + "\n")
}

function linkStandaloneCreateDependency(packageRoot, gorseeRoot) {
  const nodeModulesRoot = join(packageRoot, "node_modules")
  mkdirSync(nodeModulesRoot, { recursive: true })
  rmSync(join(nodeModulesRoot, "gorsee"), { recursive: true, force: true })
  symlinkSync(gorseeRoot, join(nodeModulesRoot, "gorsee"), "dir")
}

function resolveInstalledGorseeBin(rootDir) {
  const linkedBin = join(rootDir, "node_modules", ".bin", "gorsee")
  if (existsSync(linkedBin)) return linkedBin
  return join(rootDir, "node_modules", "gorsee", "dist-pkg", "bin", "gorsee.js")
}

function exerciseExample(exampleDir, expectedFile, expectedToken) {
  const sandboxRoot = join(smokeRoot, "examples", exampleDir.split("/").pop() ?? "example")
  rmSync(sandboxRoot, { recursive: true, force: true })
  mkdirSync(join(smokeRoot, "examples"), { recursive: true })
  cpSync(exampleDir, sandboxRoot, { recursive: true })
  rmSync(join(sandboxRoot, "bun.lock"), { force: true })
  patchDependency(sandboxRoot, `file:${tarballPath}`)
  runIn(sandboxRoot, "bun", ["install"], { env: bunTempEnv })
  const bin = join(sandboxRoot, "node_modules", ".bin", "gorsee")
  runIn(sandboxRoot, bin, ["check"], { env: bunTempEnv })
  runIn(sandboxRoot, bin, ["build"], { env: bunTempEnv })
  const file = readFileSync(join(sandboxRoot, expectedFile), "utf-8")
  if (!file.includes(expectedToken)) {
    throw new Error(`release smoke example ${exampleDir} lost contract token: ${expectedToken}`)
  }
}

function exerciseWorkspaceExample(exampleDir) {
  const sandboxRoot = join(smokeRoot, "examples", "workspace-monorepo")
  rmSync(sandboxRoot, { recursive: true, force: true })
  mkdirSync(join(smokeRoot, "examples"), { recursive: true })
  cpSync(exampleDir, sandboxRoot, { recursive: true })
  rmSync(join(sandboxRoot, "bun.lock"), { force: true })
  const appPackagePath = join(sandboxRoot, "apps", "web", "package.json")
  const appPackage = JSON.parse(readFileSync(appPackagePath, "utf-8"))
  appPackage.dependencies.gorsee = `file:${tarballPath}`
  writeFileSync(appPackagePath, JSON.stringify(appPackage, null, 2) + "\n")
  runIn(sandboxRoot, "bun", ["install"], { env: bunTempEnv })
  const bin = join(sandboxRoot, "apps", "web", "node_modules", ".bin", "gorsee")
  runIn(join(sandboxRoot, "apps", "web"), bin, ["check"], { env: bunTempEnv })
  runIn(join(sandboxRoot, "apps", "web"), bin, ["build"], { env: bunTempEnv })
}

try {
  await runReleaseStep(repoRoot, {
    step: "release.smoke",
    version: packageJson.version,
    code: "RELEASE_SMOKE",
    startMessage: `running release smoke for ${packageJson.version}`,
    finishMessage: `release smoke passed for ${packageJson.version}`,
    finishData: { artifact: tarballName },
    run: async () => {
      run("node", ["scripts/release-vscode-extension.mjs"])
      run("npm", ["pack"], {
        env: { ...process.env, npm_config_cache: npmCache },
      })
      mkdirSync(artifactsRoot, { recursive: true })
      stageStandaloneCreatePackage(standaloneCreateRoot)

      writeFileSync(join(smokeRoot, "package.json"), JSON.stringify({
        name: "gorsee-release-smoke",
        private: true,
        type: "module",
      }, null, 2))

      runIn(smokeRoot, "npm", ["install", tarballPath], {
        env: { ...process.env, npm_config_cache: npmCache },
      })
      linkStandaloneCreateDependency(standaloneCreateRoot, join(smokeRoot, "node_modules", "gorsee"))

      const gorseeBin = resolveInstalledGorseeBin(smokeRoot)
      runIn(smokeRoot, gorseeBin, ["help"])
      runIn(smokeRoot, gorseeBin, ["create", "app-smoke"])
      runIn(smokeRoot, "node", [join(standaloneCreateRoot, "index.js"), "standalone-smoke-app"])

      const appDir = join(smokeRoot, "app-smoke")
      const standaloneAppDir = join(smokeRoot, "standalone-smoke-app")
      const appPackageJsonPath = join(appDir, "package.json")
      const appPackageJson = JSON.parse(readFileSync(appPackageJsonPath, "utf-8"))
      appPackageJson.dependencies.gorsee = `file:${tarballPath}`
      writeFileSync(appPackageJsonPath, JSON.stringify(appPackageJson, null, 2) + "\n")
      writeFileSync(join(appDir, "routes", "api", "session.ts"), [
        'import type { Context } from "gorsee/server"',
        'import { createAuth, createMemorySessionStore } from "gorsee/auth"',
        "",
        'const auth = createAuth({ secret: "smoke-secret", store: createMemorySessionStore() })',
        "",
        "export async function GET(_ctx: Context): Promise<Response> {",
        '  return Response.json({',
        '    authReady: typeof auth.middleware === "function",',
        '    importPath: "gorsee/auth",',
        "  })",
        "}",
        "",
      ].join("\n"))

      runIn(appDir, "bun", ["install"], { env: bunTempEnv })
      patchDependency(standaloneAppDir, `file:${tarballPath}`)
      runIn(standaloneAppDir, "bun", ["install"], { env: bunTempEnv })

      const appBin = join(appDir, "node_modules", ".bin", "gorsee")
      const standaloneAppBin = join(standaloneAppDir, "node_modules", ".bin", "gorsee")
      runIn(appDir, appBin, ["check"])
      runIn(appDir, appBin, ["typegen"])
      runIn(appDir, appBin, ["docs", "--output", "docs/api.json", "--format", "json"])
      runIn(appDir, appBin, ["build"])
      runIn(appDir, appBin, ["deploy", "fly"])
      runIn(appDir, appBin, ["deploy", "fly", "--runtime", "node"])
      runIn(appDir, appBin, ["deploy", "cloudflare"])
      runIn(appDir, appBin, ["deploy", "netlify"])
      runIn(appDir, appBin, ["deploy", "vercel"])
      runIn(appDir, appBin, ["deploy", "docker"])
      runIn(appDir, appBin, ["deploy", "docker", "--runtime", "node"])
      runIn(standaloneAppDir, standaloneAppBin, ["check"], { env: bunTempEnv })
      runIn(standaloneAppDir, standaloneAppBin, ["build"], { env: bunTempEnv })
      runIn(appDir, "node", [
        "--input-type=module",
        "-e",
        [
          'const prod = await import("./dist/prod-node.js")',
          'const handler = await import("./dist/server-handler-node.js")',
          'if (typeof prod.startNodeProductionServer !== "function") throw new Error("prod-node export missing")',
          'if (typeof handler.handleRequest !== "function") throw new Error("server-handler-node export missing")',
        ].join("; "),
      ])

      const flyConfig = readFileSync(join(appDir, "fly.toml"), "utf-8")
      const dockerfile = readFileSync(join(appDir, "Dockerfile"), "utf-8")
      const wrangler = readFileSync(join(appDir, "wrangler.toml"), "utf-8")
      const routesConfig = readFileSync(join(appDir, "_routes.json"), "utf-8")
      const workerEntry = readFileSync(join(appDir, "worker.ts"), "utf-8")
      const netlify = readFileSync(join(appDir, "netlify.toml"), "utf-8")
      const netlifyHandler = readFileSync(join(appDir, "netlify", "edge-functions", "gorsee-handler.ts"), "utf-8")
      const vercelConfig = readFileSync(join(appDir, "vercel.json"), "utf-8")
      const vercelHandler = readFileSync(join(appDir, "api", "index.ts"), "utf-8")
      const scaffoldedSessionRoute = readFileSync(join(appDir, "routes", "api", "session.ts"), "utf-8")
      const starterReadme = readFileSync(join(appDir, "README.md"), "utf-8")
      const frameworkMd = readFileSync(join(appDir, "FRAMEWORK.md"), "utf-8")
      if (!flyConfig.includes('APP_ORIGIN = "REPLACE_WITH_APP_ORIGIN"')) {
        throw new Error("fly deploy output lost APP_ORIGIN placeholder contract")
      }
      if (!dockerfile.includes("ENV APP_ORIGIN=REPLACE_WITH_APP_ORIGIN")) {
        throw new Error("fly Dockerfile lost APP_ORIGIN placeholder contract")
      }
      if (!dockerfile.includes("bun install --frozen-lockfile")) {
        throw new Error("docker deploy output lost frozen lockfile install contract")
      }
      if (!wrangler.includes('APP_ORIGIN = "REPLACE_WITH_APP_ORIGIN"')) {
        throw new Error("cloudflare deploy output lost APP_ORIGIN placeholder contract")
      }
      if (!wrangler.includes('compatibility_flags = ["nodejs_compat"]')) {
        throw new Error("cloudflare deploy output lost nodejs_compat contract")
      }
      if (!workerEntry.includes("handleRequest(request, env, { rpcPolicy })")) {
        throw new Error("cloudflare deploy output lost explicit RPC policy forwarding")
      }
      if (!routesConfig.includes('"/_gorsee/*"')) {
        throw new Error("cloudflare deploy output lost /_gorsee/* route exclusion contract")
      }
      if (!netlify.includes('APP_ORIGIN = "REPLACE_WITH_APP_ORIGIN"')) {
        throw new Error("netlify deploy output lost APP_ORIGIN placeholder contract")
      }
      if (!netlify.includes('Cache-Control = "public, max-age=31536000, immutable"')) {
        throw new Error("netlify deploy output lost immutable asset cache contract")
      }
      if (!netlifyHandler.includes("handleRequest(request, { netlifyContext: context }, { rpcPolicy })")) {
        throw new Error("netlify deploy output lost explicit RPC policy forwarding")
      }
      if (!vercelConfig.includes('"Cache-Control": "public, max-age=31536000, immutable"')) {
        throw new Error("vercel deploy output lost immutable asset cache contract")
      }
      if (!vercelHandler.includes("APP_ORIGIN")) {
        throw new Error("vercel deploy output lost APP_ORIGIN runtime guidance")
      }
      if (!vercelHandler.includes("../dist/server-handler-node.js")) {
        throw new Error("vercel deploy output lost Node-compatible built server handler path")
      }
      if (!vercelHandler.includes("handleRequest(request, { vercel: true }, { rpcPolicy })")) {
        throw new Error("vercel deploy output lost explicit RPC policy forwarding")
      }
      if (!scaffoldedSessionRoute.includes('from "gorsee/auth"')) {
        throw new Error("release smoke app lost gorsee/auth scaffold import contract")
      }
      if (!scaffoldedSessionRoute.includes('import type { Context } from "gorsee/server"')) {
        throw new Error("release smoke app lost gorsee/server context import contract")
      }
      if (!scaffoldedSessionRoute.includes("createAuth")) {
        throw new Error("release smoke app lost createAuth auth surface contract")
      }
      if (!scaffoldedSessionRoute.includes("createMemorySessionStore")) {
        throw new Error("release smoke app lost createMemorySessionStore auth surface contract")
      }
      if (!starterReadme.includes("AI-first reactive full-stack TypeScript framework")) {
        throw new Error("starter README lost product positioning contract")
      }
      if (!starterReadme.includes("Treat this app as a product codebase")) {
        throw new Error("starter README lost mature product guidance")
      }
      if (!starterReadme.includes("Use `gorsee/server` for `load`, `action`, middleware, cache, RPC, and route execution.")) {
        throw new Error("starter README lost canonical server runtime guidance")
      }
      if (!starterReadme.includes("Use scoped entrypoints such as `gorsee/auth`, `gorsee/db`, `gorsee/security`, `gorsee/env`, and `gorsee/log`")) {
        throw new Error("starter README lost scoped import guidance")
      }
      if (!starterReadme.includes("docs/CANONICAL_RECIPES.md")) {
        throw new Error("starter README lost canonical recipes guidance")
      }
      if (!starterReadme.includes("docs/RUNTIME_FAILURES.md")) {
        throw new Error("starter README lost runtime failures guidance")
      }
      if (!starterReadme.includes("docs/STARTER_FAILURES.md")) {
        throw new Error("starter README lost starter failures guidance")
      }
      if (!starterReadme.includes("docs/AI_WORKFLOWS.md")) {
        throw new Error("starter README lost AI workflows guidance")
      }
      if (!starterReadme.includes("docs/AI_SESSION_PACKS.md")) {
        throw new Error("starter README lost AI session packs guidance")
      }
      if (!starterReadme.includes("docs/UPGRADE_PLAYBOOK.md")) {
        throw new Error("starter README lost upgrade playbook guidance")
      }
      if (!starterReadme.includes("docs/WORKSPACE_ADOPTION.md")) {
        throw new Error("starter README lost workspace adoption guidance")
      }
      const standaloneReadme = readFileSync(join(standaloneAppDir, "README.md"), "utf-8")
      if (!standaloneReadme.includes("Use `gorsee/server` for `load`, `action`, middleware, cache, RPC, and route execution.")) {
        throw new Error("standalone create app lost canonical server runtime guidance")
      }
      if (!standaloneReadme.includes("Use `bun install --frozen-lockfile` in CI and deploy automation once the lockfile exists.")) {
        throw new Error("standalone create app lost lockfile reproducibility guidance")
      }
      if (!frameworkMd.includes("not a pet project")) {
        throw new Error("FRAMEWORK.md lost mature product doctrine")
      }
      if (!frameworkMd.includes("docs/AI_ARTIFACT_CONTRACT.md")) {
        throw new Error("FRAMEWORK.md lost AI artifact contract guidance")
      }
      if (!frameworkMd.includes("docs/CANONICAL_RECIPES.md")) {
        throw new Error("FRAMEWORK.md lost canonical recipes guidance")
      }
      if (!frameworkMd.includes("docs/RUNTIME_TRIAGE.md")) {
        throw new Error("FRAMEWORK.md lost runtime triage guidance")
      }
      if (!frameworkMd.includes("docs/CACHE_INVALIDATION.md")) {
        throw new Error("FRAMEWORK.md lost cache invalidation guidance")
      }
      if (!frameworkMd.includes("docs/AI_WORKFLOWS.md")) {
        throw new Error("FRAMEWORK.md lost AI workflows guidance")
      }
      if (!frameworkMd.includes("docs/AI_SURFACE_STABILITY.md")) {
        throw new Error("FRAMEWORK.md lost AI surface stability guidance")
      }
      if (!frameworkMd.includes("docs/STARTER_ONBOARDING.md")) {
        throw new Error("FRAMEWORK.md lost starter onboarding guidance")
      }
      if (!frameworkMd.includes("docs/DEPLOY_TARGET_GUIDE.md")) {
        throw new Error("FRAMEWORK.md lost deploy target guidance")
      }

      const examplesReadme = readFileSync(join(repoRoot, "examples", "README.md"), "utf-8")
      if (!examplesReadme.includes("examples/secure-saas")) {
        throw new Error("canonical examples surface lost secure-saas reference")
      }
      if (!examplesReadme.includes("examples/content-site")) {
        throw new Error("canonical examples surface lost content-site reference")
      }
      if (!examplesReadme.includes("examples/agent-aware-ops")) {
        throw new Error("canonical examples surface lost agent-aware-ops reference")
      }
      if (!examplesReadme.includes("examples/workspace-monorepo")) {
        throw new Error("canonical examples surface lost workspace-monorepo reference")
      }
      exerciseExample(join(repoRoot, "examples", "secure-saas"), join("routes", "app", "_middleware.ts"), "auth.protect")
      exerciseExample(join(repoRoot, "examples", "content-site"), join("routes", "_middleware.ts"), 'mode: "public"')
      exerciseExample(join(repoRoot, "examples", "agent-aware-ops"), "app.config.ts", "enabled: true")
      const workspaceExampleRoot = join(repoRoot, "examples", "workspace-monorepo")
      exerciseWorkspaceExample(workspaceExampleRoot)
      const workspaceIndex = readFileSync(join(workspaceExampleRoot, "apps", "web", "routes", "index.tsx"), "utf-8")
      const workspaceApi = readFileSync(join(workspaceExampleRoot, "apps", "web", "routes", "api", "session.ts"), "utf-8")
      if (!workspaceIndex.includes("@example/shared")) {
        throw new Error("workspace example lost shared import contract")
      }
      if (!workspaceApi.includes('from "gorsee/auth"')) {
        throw new Error("workspace example lost gorsee/auth contract")
      }
      if (!workspaceApi.includes('import type { Context } from "gorsee/server"')) {
        throw new Error("workspace example lost gorsee/server context contract")
      }
    },
  })
  console.log(`release:smoke OK (${tarballName})`)
} catch (error) {
  throw error
} finally {
  rmSync(join(repoRoot, tarballName), { force: true })
}
