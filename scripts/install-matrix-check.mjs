#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const tarballName = `${packageJson.name}-${packageJson.version}.tgz`
const matrixRoot = mkdtempSync(join(tmpdir(), "gorsee-install-matrix-"))
const artifactsRoot = join(matrixRoot, "artifacts")
const tarballPath = join(artifactsRoot, tarballName)
const sourcePackageRoot = join(artifactsRoot, "source-package")
const standaloneCreateRoot = join(artifactsRoot, "create-gorsee")
const npmCache = mkdtempSync(join(tmpdir(), "gorsee-install-matrix-cache-"))
const cliEntry = join(repoRoot, "src", "cli", "index.ts")
const bunTempEnv = {
  ...process.env,
  TMPDIR: matrixRoot,
  TMP: matrixRoot,
  TEMP: matrixRoot,
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  })
}

function runIn(cwd, command, args, options = {}) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  })
}

function patchDependency(appDir, value) {
  const appPackagePath = join(appDir, "package.json")
  const appPackage = JSON.parse(readFileSync(appPackagePath, "utf-8"))
  appPackage.dependencies.gorsee = value
  writeFileSync(appPackagePath, JSON.stringify(appPackage, null, 2) + "\n")
}

function exerciseApp(appDir, options = {}) {
  const bin = join(appDir, "node_modules", ".bin", "gorsee")
  if (!options.skipCheck) {
    runIn(appDir, bin, ["check"])
  }
  runIn(appDir, bin, ["typegen"])
  runIn(appDir, bin, ["docs", "--output", "docs/api.json", "--format", "json"])
  runIn(appDir, bin, ["build"])
  const docs = readFileSync(join(appDir, "docs", "api.json"), "utf-8")
  const appConfig = readFileSync(join(appDir, "app.config.ts"), "utf-8")
  if (!docs.includes('"path": "/api/health"')) {
    throw new Error("install matrix app is missing generated docs for /api/health")
  }
  if (!appConfig.includes('preset: "none"')) {
    throw new Error("scaffolded app lost proxy preset contract")
  }
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
}

function exerciseExample(exampleDir, expectedFile, expectedToken) {
  const sandboxRoot = join(matrixRoot, "examples", exampleDir.split("/").pop() ?? "example")
  rmSync(sandboxRoot, { recursive: true, force: true })
  mkdirSync(join(matrixRoot, "examples"), { recursive: true })
  cpSync(exampleDir, sandboxRoot, { recursive: true })
  rmSync(join(sandboxRoot, "bun.lock"), { force: true })
  patchDependency(sandboxRoot, `file:${sourcePackageRoot}`)
  runIn(sandboxRoot, "bun", ["install"], { env: bunTempEnv })
  const bin = join(sandboxRoot, "node_modules", ".bin", "gorsee")
  runIn(sandboxRoot, bin, ["check"], { env: bunTempEnv })
  runIn(sandboxRoot, bin, ["build"], { env: bunTempEnv })
  const file = readFileSync(join(sandboxRoot, expectedFile), "utf-8")
  if (!file.includes(expectedToken)) {
    throw new Error(`example ${exampleDir} lost contract token: ${expectedToken}`)
  }
}

function exerciseWorkspaceExample(exampleDir) {
  const sandboxRoot = join(matrixRoot, "examples", "workspace-monorepo")
  rmSync(sandboxRoot, { recursive: true, force: true })
  mkdirSync(join(matrixRoot, "examples"), { recursive: true })
  cpSync(exampleDir, sandboxRoot, { recursive: true })
  rmSync(join(sandboxRoot, "bun.lock"), { force: true })
  const appPackagePath = join(sandboxRoot, "apps", "web", "package.json")
  const appPackage = JSON.parse(readFileSync(appPackagePath, "utf-8"))
  appPackage.dependencies.gorsee = `file:${sourcePackageRoot}`
  writeFileSync(appPackagePath, JSON.stringify(appPackage, null, 2) + "\n")
  runIn(sandboxRoot, "bun", ["install"], { env: bunTempEnv })
  const bin = join(sandboxRoot, "apps", "web", "node_modules", ".bin", "gorsee")
  runIn(join(sandboxRoot, "apps", "web"), bin, ["check"], { env: bunTempEnv })
  runIn(join(sandboxRoot, "apps", "web"), bin, ["build"], { env: bunTempEnv })
}

function configureMonorepoApp(appDir) {
  const packagePath = join(appDir, "package.json")
  const pkg = JSON.parse(readFileSync(packagePath, "utf-8"))
  pkg.name = "@workspace/web"
  pkg.dependencies.gorsee = `file:${sourcePackageRoot}`
  pkg.dependencies["@workspace/shared"] = "workspace:*"
  writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n")

  writeFileSync(join(appDir, "routes", "index.tsx"), [
    'import { createSignal, Head } from "gorsee/client"',
    'import { describeWorkspace } from "@workspace/shared"',
    "",
    "export default function HomePage() {",
    "  const [count, setCount] = createSignal(0)",
    "  const info = describeWorkspace()",
    "  return (",
    "    <div>",
    "      <Head><title>Workspace App</title></Head>",
    "      <h1>{info}</h1>",
    '      <button on:click={() => setCount((c: number) => c + 1)}>Count: {count}</button>',
    "    </div>",
    "  )",
    "}",
    "",
  ].join("\n"))

  writeFileSync(join(appDir, "routes", "api", "session.ts"), [
    'import { createAuth, createMemorySessionStore } from "gorsee/auth"',
    'import type { Context } from "gorsee/server"',
    'import { describeWorkspace } from "@workspace/shared"',
    "",
    'const auth = createAuth({ secret: "workspace-secret", store: createMemorySessionStore() })',
    "",
    "export function GET(_ctx: Context): Response {",
    "  return Response.json({",
    "    workspace: describeWorkspace(),",
    '    authReady: typeof auth.middleware === "function",',
    "  })",
    "}",
    "",
  ].join("\n"))
}

function stageSourcePackage(packageRoot) {
  rmSync(packageRoot, { recursive: true, force: true })
  mkdirSync(packageRoot, { recursive: true })
  copyFileSync(join(repoRoot, "package.json"), join(packageRoot, "package.json"))
  copyFileSync(join(repoRoot, "README.md"), join(packageRoot, "README.md"))
  copyFileSync(join(repoRoot, "LICENSE"), join(packageRoot, "LICENSE"))
  cpSync(join(repoRoot, "src"), join(packageRoot, "src"), { recursive: true })
  cpSync(join(repoRoot, "bin"), join(packageRoot, "bin"), { recursive: true })
  cpSync(join(repoRoot, "node_modules"), join(packageRoot, "node_modules"), { recursive: true })
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

try {
  mkdirSync(artifactsRoot, { recursive: true })
  stageSourcePackage(sourcePackageRoot)
  run("npm", ["pack", "--pack-destination", artifactsRoot], { cwd: repoRoot, env: { ...process.env, npm_config_cache: npmCache } })
  stageStandaloneCreatePackage(standaloneCreateRoot)
  linkStandaloneCreateDependency(standaloneCreateRoot, sourcePackageRoot)

  const sourceApp = join(matrixRoot, "source-app")
  runIn(matrixRoot, "bun", ["run", cliEntry, "create", "source-app"])
  patchDependency(sourceApp, `file:${sourcePackageRoot}`)
  runIn(sourceApp, "bun", ["install"], { env: bunTempEnv })
  exerciseApp(sourceApp, { skipCheck: true })

  const tarballApp = join(matrixRoot, "tarball-app")
  runIn(matrixRoot, "bun", ["run", cliEntry, "create", "tarball-app"])
  patchDependency(tarballApp, `file:${tarballPath}`)
  runIn(tarballApp, "bun", ["install"], { env: bunTempEnv })
  exerciseApp(tarballApp)

  const standaloneBootstrapApp = join(matrixRoot, "standalone-bootstrap-app")
  runIn(matrixRoot, "node", [join(standaloneCreateRoot, "index.js"), "standalone-bootstrap-app"])
  patchDependency(standaloneBootstrapApp, `file:${tarballPath}`)
  runIn(standaloneBootstrapApp, "bun", ["install"], { env: bunTempEnv })
  exerciseApp(standaloneBootstrapApp)

  const monorepoRoot = join(matrixRoot, "workspace")
  mkdirSync(join(monorepoRoot, "apps"), { recursive: true })
  mkdirSync(join(monorepoRoot, "packages", "shared"), { recursive: true })
  writeFileSync(join(monorepoRoot, "package.json"), JSON.stringify({
    name: "gorsee-workspace-smoke",
    private: true,
    packageManager: "bun@1.3.9",
    workspaces: ["apps/*", "packages/*"],
  }, null, 2) + "\n")
  writeFileSync(join(monorepoRoot, "packages", "shared", "package.json"), JSON.stringify({
    name: "@workspace/shared",
    version: "0.0.0",
    type: "module",
    exports: "./index.ts",
  }, null, 2) + "\n")
  writeFileSync(join(monorepoRoot, "packages", "shared", "index.ts"), [
    "export function describeWorkspace(): string {",
    '  return "workspace-shared-ready"',
    "}",
    "",
  ].join("\n"))

  runIn(join(monorepoRoot, "apps"), "bun", ["run", cliEntry, "create", "web"])
  const monorepoApp = join(monorepoRoot, "apps", "web")
  configureMonorepoApp(monorepoApp)
  runIn(monorepoRoot, "bun", ["install"], { env: bunTempEnv })
  exerciseApp(monorepoApp)
  const monorepoIndex = readFileSync(join(monorepoApp, "routes", "index.tsx"), "utf-8")
  const monorepoSession = readFileSync(join(monorepoApp, "routes", "api", "session.ts"), "utf-8")
  if (!monorepoIndex.includes('@workspace/shared')) {
    throw new Error("monorepo app lost shared package import contract")
  }
  if (!monorepoSession.includes('from "gorsee/auth"')) {
    throw new Error("monorepo app lost gorsee/auth import contract")
  }
  if (!monorepoSession.includes('import type { Context } from "gorsee/server"')) {
    throw new Error("monorepo app lost gorsee/server context contract")
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

  console.log(`install:matrix OK (${tarballName})`)
} finally {
  rmSync(tarballPath, { force: true })
}
