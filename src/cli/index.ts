#!/usr/bin/env bun
// Gorsee.js CLI

const args = process.argv.slice(2)
const command = args[0]

const COMMANDS: Record<string, string> = {
  create: "Create a new Gorsee.js project",
  dev: "Start development server with HMR",
  build: "Production build (client + server)",
  start: "Start production server",
  worker: "Run a server-mode worker entry",
  check: "Check project: types, safety, structure, optional canonical autofix",
  routes: "List all routes with render modes",
  migrate: "Run database migrations",
  generate: "Generate CRUD scaffold for entity",
  typegen: "Generate typed route definitions",
  deploy: "Generate deploy config (vercel/fly/cloudflare/netlify/docker)",
  test: "Run tests (unit/integration/e2e)",
  docs: "Generate API documentation from routes",
  ai: "AI-first tooling: init, framework, tail, doctor, export, pack, checkpoint, ide-sync, bridge, mcp",
  upgrade: "Upgrade Gorsee.js with migration audit and canonical rewrites",
  help: "Show this help message",
}

async function main() {
  switch (command) {
    case "create":
      const { runCreate } = await import("./cmd-create.ts")
      await runCreate(args.slice(1))
      break
    case "dev":
      const { runDev } = await import("./cmd-dev.ts")
      await runDev(args.slice(1))
      break
    case "build":
      const { runBuild } = await import("./cmd-build.ts")
      await runBuild(args.slice(1))
      break
    case "start":
      const { runStart } = await import("./cmd-start.ts")
      await runStart(args.slice(1))
      break
    case "worker":
      const { runWorker } = await import("./cmd-worker.ts")
      await runWorker(args.slice(1))
      break
    case "check":
      const { runCheck } = await import("./cmd-check.ts")
      await runCheck(args.slice(1))
      break
    case "routes":
      const { runRoutes } = await import("./cmd-routes.ts")
      await runRoutes(args.slice(1))
      break
    case "migrate":
      const { runMigrate } = await import("./cmd-migrate.ts")
      await runMigrate(args.slice(1))
      break
    case "generate":
      const { runGenerate } = await import("./cmd-generate.ts")
      await runGenerate(args.slice(1))
      break
    case "typegen":
      const { runTypegen } = await import("./cmd-typegen.ts")
      await runTypegen(args.slice(1))
      break
    case "deploy":
      const { runDeploy } = await import("./cmd-deploy.ts")
      await runDeploy(args.slice(1))
      break
    case "test": {
      const { runTest } = await import("./cmd-test.ts")
      await runTest(args.slice(1))
      break
    }
    case "docs": {
      const { runDocs } = await import("./cmd-docs.ts")
      await runDocs(args.slice(1))
      break
    }
    case "ai": {
      const { runAI } = await import("./cmd-ai.ts")
      await runAI(args.slice(1))
      break
    }
    case "upgrade": {
      const { runUpgrade } = await import("./cmd-upgrade.ts")
      await runUpgrade(args.slice(1))
      break
    }
    case "help":
    case undefined:
    case "--help":
    case "-h":
      printHelp()
      break
    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

function printHelp() {
  console.log("\n  gorsee - Full-stack TypeScript framework\n")
  console.log("  Usage: gorsee <command> [options]\n")
  console.log("  Commands:")
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`    ${cmd.padEnd(12)} ${desc}`)
  }
  console.log()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
