#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const channel = process.argv[2] ?? "stable"
const version = packageJson.version

const CHANNEL_RULES = {
  stable: {
    pattern: /^\d+\.\d+\.\d+$/,
    tag: "latest",
    description: "stable releases must use plain semver without prerelease suffixes",
  },
  canary: {
    pattern: /^\d+\.\d+\.\d+-canary\.\d+$/,
    tag: "canary",
    description: 'canary releases must use a version like "1.2.3-canary.1"',
  },
  rc: {
    pattern: /^\d+\.\d+\.\d+-rc\.\d+$/,
    tag: "rc",
    description: 'release candidates must use a version like "1.2.3-rc.1"',
  },
}

if (!(channel in CHANNEL_RULES)) {
  throw new Error(`Unknown release channel: ${channel}`)
}

const rule = CHANNEL_RULES[channel]
if (!rule.pattern.test(version)) {
  throw new Error(`Version ${version} does not match ${channel} release policy: ${rule.description}`)
}

console.log(`release:${channel}:check OK (${version}, npm tag: ${rule.tag})`)
