#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

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

function planReleaseVersion(input, channel) {
  const parsed = parseVersion(input)
  switch (channel) {
    case "stable":
      return `${parsed.major}.${parsed.minor}.${parsed.patch}`
    case "canary":
      if (parsed.pre?.tag === "canary") {
        return `${parsed.major}.${parsed.minor}.${parsed.patch}-canary.${parsed.pre.number + 1}`
      }
      if (parsed.pre) {
        return `${parsed.major}.${parsed.minor}.${parsed.patch}-canary.0`
      }
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}-canary.0`
    case "rc":
      if (parsed.pre?.tag === "rc") {
        return `${parsed.major}.${parsed.minor}.${parsed.patch}-rc.${parsed.pre.number + 1}`
      }
      if (parsed.pre) {
        return `${parsed.major}.${parsed.minor}.${parsed.patch}-rc.0`
      }
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}-rc.0`
  }
}

function parseVersion(input) {
  const match = input.match(/^(\d+)\.(\d+)\.(\d+)(?:-(canary|rc)\.(\d+))?$/)
  if (!match) {
    throw new Error(`unsupported version format: ${input}`)
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4]
      ? {
          tag: match[4],
          number: Number(match[5]),
        }
      : undefined,
  }
}
