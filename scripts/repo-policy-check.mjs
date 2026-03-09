#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const lockfileSource = readFileSync(join(repoRoot, "bun.lock"), "utf-8")

if (!packageJson.packageManager || !/^bun@\d+\.\d+\.\d+$/.test(packageJson.packageManager)) {
  throw new Error('package.json must declare an exact Bun packageManager version, e.g. "bun@1.3.9"')
}

if ("repository" in packageJson) {
  throw new Error("package.json must not declare repository until an explicit public repository path is configured")
}

if ("homepage" in packageJson) {
  throw new Error("package.json must not declare homepage until an explicit public homepage is configured")
}

for (const [name, version] of Object.entries(packageJson.dependencies ?? {})) {
  if (typeof version === "string" && /^[\^~><=*]/.test(version)) {
    throw new Error(`runtime dependency must be pinned exactly: ${name}@${version}`)
  }
  const resolved = readLockedPackageVersion(lockfileSource, name)
  if (!resolved) {
    throw new Error(`bun.lock missing resolved runtime dependency: ${name}`)
  }
  if (resolved !== version) {
    throw new Error(`bun.lock drift for ${name}: locked ${resolved}, package.json ${version}`)
  }
}

console.log("repo:policy OK")

function readLockedPackageVersion(lockfile, packageName) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = lockfile.match(new RegExp(`"${escaped}": \\["${escaped}@([^"]+)"`))
  return match?.[1] ?? null
}
