// Gorsee.js — CLI deploy command

import { writeFile, access, mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { createProjectContext, type RuntimeOptions } from "../runtime/project.ts"
import { runArtifactLifecycleStep, writeArtifactFailurePack } from "../ai/index.ts"
import { assertDeployArtifactConformance } from "../deploy/conformance.ts"
import { isProcessDeployRuntime, type ProcessDeployRuntime } from "../deploy/runtime.ts"

type Target = "vercel" | "fly" | "cloudflare" | "netlify" | "docker"

const TARGETS: Target[] = ["vercel", "fly", "cloudflare", "netlify", "docker"]

const DETECT_FILES: Record<string, Target> = {
  "vercel.json": "vercel",
  "fly.toml": "fly",
  "wrangler.toml": "cloudflare",
  "netlify.toml": "netlify",
  "Dockerfile": "docker",
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function detectTarget(cwd: string): Promise<Target | null> {
  for (const [file, target] of Object.entries(DETECT_FILES)) {
    if (await fileExists(join(cwd, file))) return target
  }
  return null
}

async function writeAndLog(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, "utf-8")
  console.log(`  created ${filePath}`)
}

interface DeployFlags {
  runtime?: ProcessDeployRuntime
}

function parseDeployFlags(args: string[]): DeployFlags {
  const flags: DeployFlags = {}
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === "--runtime" && isProcessDeployRuntime(args[index + 1])) {
      flags.runtime = args[++index] as ProcessDeployRuntime
    }
  }
  return flags
}

function parseDeployTargetArg(args: string[]): Target | undefined {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (!arg) continue
    if (arg === "--runtime") {
      index += 1
      continue
    }
    if (!arg.startsWith("-")) return arg as Target
  }
  return undefined
}

function resolveDeployRuntime(target: Target, requestedRuntime: ProcessDeployRuntime | undefined): ProcessDeployRuntime {
  if (target === "vercel") {
    if (requestedRuntime && requestedRuntime !== "node") {
      throw new Error("Vercel deploy generation requires the Node runtime profile.")
    }
    return "node"
  }

  if (target === "docker" || target === "fly") {
    return requestedRuntime ?? "bun"
  }

  if (requestedRuntime && requestedRuntime !== "bun") {
    throw new Error(`${target} deploy generation does not support a Node process runtime profile.`)
  }

  return "bun"
}

async function validateGeneratedDeployConfig(
  cwd: string,
  target: Target,
  runtime: ProcessDeployRuntime,
): Promise<void> {
  const expectations: Array<{ file: string; pattern: RegExp; message: string }> = []
  switch (target) {
    case "vercel":
      assertDeployArtifactConformance({
        name: "vercel.json",
        format: "json",
        content: await readFile(join(cwd, "vercel.json"), "utf-8"),
        requiredTokens: ["/_gorsee/(.*)", "Cache-Control"],
        requiredPaths: ["routes"],
        requiredValues: [
          { path: "version", value: 2 },
          { path: "buildCommand", value: "bun run build" },
          { path: "outputDirectory", value: ".vercel/output" },
        ],
      })
      expectations.push({
        file: "vercel.json",
        pattern: /"\/_gorsee\/\(\.\*\)"/,
        message: "Vercel config must route immutable client assets through /_gorsee/*",
      })
      expectations.push({
        file: "vercel.json",
        pattern: /"Cache-Control":\s*"public, max-age=31536000, immutable"/,
        message: "Vercel config must keep immutable caching for /_gorsee/*",
      })
      expectations.push({
        file: "api/index.ts",
        pattern: /APP_ORIGIN/,
        message: "Vercel handler must reference APP_ORIGIN",
      })
      expectations.push({
        file: "api/index.ts",
        pattern: /\.\.\/dist\/server-handler-node\.js/,
        message: "Vercel handler must reference the Node-compatible built server handler",
      })
      expectations.push({
        file: "api/index.ts",
        pattern: /handleRequest\(request, \{ vercel: true \}, \{ rpcPolicy \}\)/,
        message: "Vercel handler must forward the explicit RPC policy to the built server handler",
      })
      break
    case "fly":
      assertDeployArtifactConformance({
        name: "fly.toml",
        format: "toml",
        content: await readFile(join(cwd, "fly.toml"), "utf-8"),
        requiredTokens: ["/api/health"],
        requiredValues: [
          { path: "primary_region", value: "iad" },
          { path: "env.APP_ORIGIN", value: "REPLACE_WITH_APP_ORIGIN" },
        ],
      })
      expectations.push({
        file: "fly.toml",
        pattern: /path = "\/api\/health"/,
        message: "Fly config must expose the /api/health readiness check",
      })
      expectations.push({
        file: "fly.toml",
        pattern: /APP_ORIGIN\s*=\s*"REPLACE_WITH_APP_ORIGIN"/,
        message: "Fly config must contain APP_ORIGIN placeholder",
      })
      expectations.push({
        file: "Dockerfile",
        pattern: /ENV APP_ORIGIN=REPLACE_WITH_APP_ORIGIN/,
        message: "Fly Dockerfile must export APP_ORIGIN placeholder",
      })
      expectations.push({
        file: "Dockerfile",
        pattern: /bun install --frozen-lockfile/,
        message: "Fly Dockerfile must install with a frozen Bun lockfile",
      })
      expectations.push({
        file: "Dockerfile",
        pattern: runtime === "node" ? /FROM node:20-bookworm-slim/ : /FROM oven\/bun:1-slim/,
        message: `Fly Dockerfile must use the ${runtime} runtime image`,
      })
      expectations.push({
        file: "Dockerfile",
        pattern: runtime === "node" ? /CMD \["node", "dist\/prod-node\.js"\]/ : /CMD \["bun", "run", "start"\]/,
        message: `Fly Dockerfile must start through the ${runtime} production runtime entrypoint`,
      })
      break
    case "cloudflare":
      assertDeployArtifactConformance({
        name: "wrangler.toml",
        format: "toml",
        content: await readFile(join(cwd, "wrangler.toml"), "utf-8"),
        requiredTokens: ['compatibility_flags = ["nodejs_compat"]'],
        requiredValues: [
          { path: "main", value: "dist/worker.js" },
          { path: "build.command", value: "bun run build" },
          { path: "vars.APP_ORIGIN", value: "REPLACE_WITH_APP_ORIGIN" },
        ],
      })
      expectations.push({
        file: "wrangler.toml",
        pattern: /main = "dist\/worker\.js"/,
        message: "Cloudflare config must target dist/worker.js as the worker entry",
      })
      expectations.push({
        file: "wrangler.toml",
        pattern: /bucket = "\.\/dist\/client"/,
        message: "Cloudflare config must publish dist/client as the static bucket",
      })
      expectations.push({
        file: "wrangler.toml",
        pattern: /APP_ORIGIN\s*=\s*"REPLACE_WITH_APP_ORIGIN"/,
        message: "Cloudflare config must contain APP_ORIGIN placeholder",
      })
      expectations.push({
        file: "wrangler.toml",
        pattern: /compatibility_flags\s*=\s*\["nodejs_compat"\]/,
        message: "Cloudflare config must enable nodejs_compat",
      })
      expectations.push({
        file: "worker.ts",
        pattern: /handleRequest\(request, env, \{ rpcPolicy \}\)/,
        message: "Cloudflare worker must forward explicit RPC policy to the server handler",
      })
      expectations.push({
        file: "_routes.json",
        pattern: /_gorsee\/\*/,
        message: "Cloudflare routes config must exclude /_gorsee/* from edge routing",
      })
      break
    case "netlify":
      assertDeployArtifactConformance({
        name: "netlify.toml",
        format: "toml",
        content: await readFile(join(cwd, "netlify.toml"), "utf-8"),
        requiredTokens: ["excludedPath = true", 'Cache-Control = "public, max-age=31536000, immutable"'],
        requiredValues: [
          { path: "build.command", value: "bun run build" },
          { path: "build.publish", value: "dist/client" },
          { path: "build.environment.APP_ORIGIN", value: "REPLACE_WITH_APP_ORIGIN" },
        ],
      })
      expectations.push({
        file: "netlify.toml",
        pattern: /publish = "dist\/client"/,
        message: "Netlify config must publish dist/client",
      })
      expectations.push({
        file: "netlify.toml",
        pattern: /excludedPath = true/,
        message: "Netlify config must bypass edge handling for /_gorsee/*",
      })
      expectations.push({
        file: "netlify.toml",
        pattern: /APP_ORIGIN\s*=\s*"REPLACE_WITH_APP_ORIGIN"/,
        message: "Netlify config must contain APP_ORIGIN placeholder",
      })
      expectations.push({
        file: "netlify.toml",
        pattern: /Cache-Control = "public, max-age=31536000, immutable"/,
        message: "Netlify config must keep immutable caching for /_gorsee/*",
      })
      expectations.push({
        file: "netlify/edge-functions/gorsee-handler.ts",
        pattern: /handleRequest\(request, \{ netlifyContext: context \}, \{ rpcPolicy \}\)/,
        message: "Netlify edge function must forward explicit RPC policy to the server handler",
      })
      break
    case "docker":
      expectations.push({
        file: "Dockerfile",
        pattern: runtime === "node" ? /CMD \["node", "dist\/prod-node\.js"\]/ : /CMD \["bun", "run", "start"\]/,
        message: `Dockerfile must start through the ${runtime} production entrypoint`,
      })
      expectations.push({
        file: "Dockerfile",
        pattern: /ENV APP_ORIGIN=REPLACE_WITH_APP_ORIGIN/,
        message: "Dockerfile must export APP_ORIGIN placeholder",
      })
      expectations.push({
        file: "Dockerfile",
        pattern: /bun install --frozen-lockfile/,
        message: "Dockerfile must install with a frozen Bun lockfile",
      })
      expectations.push({
        file: "Dockerfile",
        pattern: runtime === "node" ? /FROM node:20-bookworm-slim/ : /FROM oven\/bun:1-slim/,
        message: `Dockerfile must use the ${runtime} runtime image`,
      })
      break
  }

  for (const expectation of expectations) {
    const content = await readFile(join(cwd, expectation.file), "utf-8")
    if (!expectation.pattern.test(content)) {
      throw new Error(expectation.message)
    }
  }
}

async function deployVercel(cwd: string): Promise<void> {
  const { generateVercelConfig, generateVercelServerlessEntry } = await import("../deploy/vercel.ts")
  await writeAndLog(join(cwd, "vercel.json"), JSON.stringify(generateVercelConfig(), null, 2))
  await mkdir(join(cwd, "api"), { recursive: true })
  await writeAndLog(join(cwd, "api/index.ts"), generateVercelServerlessEntry())
  console.log("\n  Next steps:")
  console.log("    1. Install Vercel CLI: npm i -g vercel")
  console.log("    2. Run: vercel")
  console.log("    3. Follow prompts to link your project")
}

async function deployFly(cwd: string, appName: string, runtime: ProcessDeployRuntime): Promise<void> {
  const { generateFlyConfig, generateFlyDockerfile } = await import("../deploy/fly.ts")
  await writeAndLog(join(cwd, "fly.toml"), generateFlyConfig(appName))
  await writeAndLog(join(cwd, "Dockerfile"), generateFlyDockerfile(runtime))
  console.log("\n  Next steps:")
  console.log("    1. Install Fly CLI: curl -L https://fly.io/install.sh | sh")
  console.log(`    2. Run: fly launch --name ${appName}`)
  console.log("    3. Deploy: fly deploy")
}

async function deployCloudflare(cwd: string, name: string): Promise<void> {
  const { generateWranglerConfig, generateCloudflareEntry, generateCloudflareStaticAssets } =
    await import("../deploy/cloudflare.ts")
  await writeAndLog(join(cwd, "wrangler.toml"), generateWranglerConfig(name))
  await writeAndLog(join(cwd, "worker.ts"), generateCloudflareEntry())
  await writeAndLog(join(cwd, "_routes.json"), JSON.stringify(generateCloudflareStaticAssets(), null, 2))
  console.log("\n  Next steps:")
  console.log("    1. Install Wrangler: npm i -g wrangler")
  console.log("    2. Authenticate: wrangler login")
  console.log("    3. Deploy: wrangler deploy")
}

async function deployNetlify(cwd: string): Promise<void> {
  const { generateNetlifyConfig, generateNetlifyFunction } = await import("../deploy/netlify.ts")
  await writeAndLog(join(cwd, "netlify.toml"), generateNetlifyConfig())
  const edgeFnDir = join(cwd, "netlify/edge-functions")
  await mkdir(edgeFnDir, { recursive: true })
  await writeAndLog(join(edgeFnDir, "gorsee-handler.ts"), generateNetlifyFunction())
  console.log("\n  Next steps:")
  console.log("    1. Install Netlify CLI: npm i -g netlify-cli")
  console.log("    2. Run: netlify init")
  console.log("    3. Deploy: netlify deploy --prod")
}

async function deployDocker(cwd: string, runtime: ProcessDeployRuntime): Promise<void> {
  const { generateDockerfile, generateDockerignore } = await import("../deploy/dockerfile.ts")
  await writeAndLog(join(cwd, "Dockerfile"), generateDockerfile(runtime))
  await writeAndLog(join(cwd, ".dockerignore"), generateDockerignore())
  console.log("\n  Next steps:")
  console.log("    1. Build image: docker build -t gorsee-app .")
  console.log("    2. Run: docker run -p 3000:3000 gorsee-app")
}

export interface DeployCommandOptions extends RuntimeOptions {}

export async function generateDeployConfig(args: string[], options: DeployCommandOptions = {}): Promise<void> {
  const { cwd } = createProjectContext(options)
  const initOnly = args.includes("--init")
  const flags = parseDeployFlags(args)
  const targetArg = parseDeployTargetArg(args)

  let target = targetArg ?? null
  if (!target) {
    target = await detectTarget(cwd)
    if (!target) {
      await writeDeployFailurePack(cwd, "DEPLOY_TARGET", "No deploy target specified and none detected.")
      console.error("  No deploy target specified and none detected.")
      console.error(`  Usage: gorsee deploy <${TARGETS.join("|")}> [--init]`)
      process.exit(1)
    }
    console.log(`  Auto-detected target: ${target}`)
  }

  if (!TARGETS.includes(target)) {
    await writeDeployFailurePack(cwd, "DEPLOY_TARGET", `Unknown target: ${target}`)
    console.error(`  Unknown target: ${target}`)
    console.error(`  Available: ${TARGETS.join(", ")}`)
    process.exit(1)
  }

  const projectName = cwd.split("/").pop() ?? "gorsee-app"
  const runtime = resolveDeployRuntime(target, flags.runtime)
  console.log(`\n  Generating ${target} deploy config...\n`)
  await runArtifactLifecycleStep({
    cwd,
    source: "deploy",
    phase: "deploy",
    step: "deploy",
    code: "DEPLOY_GENERATE",
    startMessage: `generating deploy config for ${target}`,
    finishMessage: `deploy config generated for ${target}`,
    data: {
      target,
      runtime,
      initOnly,
      projectName,
      artifact: target === "docker"
        ? "Dockerfile"
        : target === "vercel"
          ? "vercel.json"
          : target === "cloudflare"
            ? "wrangler.toml"
            : target === "netlify"
              ? "netlify.toml"
              : "fly.toml",
    },
    run: async () => {
      switch (target) {
        case "vercel":
          await deployVercel(cwd)
          break
        case "fly":
          await deployFly(cwd, projectName, runtime)
          break
        case "cloudflare":
          await deployCloudflare(cwd, projectName)
          break
        case "netlify":
          await deployNetlify(cwd)
          break
        case "docker":
          await deployDocker(cwd, runtime)
          break
      }
      await validateGeneratedDeployConfig(cwd, target, runtime)
    },
  })

  if (initOnly) {
    console.log("\n  Config generated (--init mode). Deploy manually when ready.")
  }

  console.log()
}

/** @deprecated Use generateDeployConfig() for programmatic access. */
export async function runDeploy(args: string[], options: DeployCommandOptions = {}): Promise<void> {
  return generateDeployConfig(args, options)
}

async function writeDeployFailurePack(cwd: string, code: string, message: string): Promise<void> {
  await writeArtifactFailurePack(cwd, "deploy", "deploy.failure", code, message)
}
