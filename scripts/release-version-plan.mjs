#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { planReleaseVersion } from "../src/cli/release-version.ts"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const channel = process.argv[2]
const inputVersion = process.argv[3] ?? packageJson.version

if (import.meta.main) {
  if (!channel || !["stable", "canary", "rc"].includes(channel)) {
    throw new Error("usage: node scripts/release-version-plan.mjs <stable|canary|rc> [version]")
  }

  const version = planReleaseVersion(inputVersion, channel)
  console.log(version)
}
