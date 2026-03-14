#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const lockfileSource = readFileSync(join(repoRoot, "bun.lock"), "utf-8")
const expectedRepositoryUrl = "git+https://github.com/OlegGorsky/gorseejs.git"
const expectedHomepage = "https://github.com/OlegGorsky/gorseejs#readme"
const expectedBugsUrl = "https://github.com/OlegGorsky/gorseejs/issues"
const gitignoreSource = readFileSync(join(repoRoot, ".gitignore"), "utf-8")
const gitignoreLines = gitignoreSource
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)

if (!packageJson.packageManager || !/^bun@\d+\.\d+\.\d+$/.test(packageJson.packageManager)) {
  throw new Error('package.json must declare an exact Bun packageManager version, e.g. "bun@1.3.9"')
}

if (packageJson.repository?.type !== "git" || packageJson.repository?.url !== expectedRepositoryUrl) {
  throw new Error(`package.json repository must be ${expectedRepositoryUrl}`)
}

if (packageJson.homepage !== expectedHomepage) {
  throw new Error(`package.json homepage must be ${expectedHomepage}`)
}

if (packageJson.bugs?.url !== expectedBugsUrl) {
  throw new Error(`package.json bugs.url must be ${expectedBugsUrl}`)
}

if (gitignoreLines.includes("bun.lock")) {
  throw new Error("root .gitignore must not ignore bun.lock because the lockfile is a tracked reproducibility contract")
}

if (!isTracked("bun.lock")) {
  throw new Error("root bun.lock must be tracked in git because the lockfile is a repository reproducibility contract")
}

for (const tarballPath of findPackedTarballArtifacts()) {
  throw new Error(`repository must not retain packed tarball artifacts: ${tarballPath}`)
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

function findPackedTarballArtifacts() {
  const roots = [
    { dir: repoRoot, prefix: "" },
    { dir: join(repoRoot, "create-gorsee"), prefix: "create-gorsee/" },
  ]
  const found = []
  for (const root of roots) {
    for (const entry of readdirSync(root.dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".tgz")) {
        found.push(`${root.prefix}${entry.name}`)
      }
    }
  }
  return found
}

function isTracked(path) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", path], {
      cwd: repoRoot,
      stdio: "ignore",
    })
    return true
  } catch {
    return false
  }
}
