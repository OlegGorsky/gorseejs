#!/usr/bin/env node
// create-gorsee — standalone initializer
// Usage: npx create-gorsee my-app

import { runCreate } from "gorsee/cli/cmd-create"

const args = process.argv.slice(2)

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log("\n  Usage:\n")
  console.log("    npx create-gorsee <project-name>")
  console.log("    npm create gorsee@latest <project-name>")
  console.log("    bunx gorsee create <project-name>\n")
  process.exit(0)
}

await runCreate(args)
