#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runReleaseStep } from "./ai-release-utils.mjs"

const repoRoot = resolve(import.meta.dirname, "..")
const cacheDir = mkdtempSync(join(tmpdir(), "gorsee-npm-cache-"))
const lockfileSource = readFileSync(join(repoRoot, "bun.lock"), "utf-8")

function run(command, args, options = {}) {
  const result = spawnSync([command, ...args].join(" "), {
    cwd: repoRoot,
    encoding: "utf-8",
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  })
  if (result.status !== 0) {
    throw new Error(`command failed: ${command} ${args.join(" ")}\n${result.stderr || result.stdout}`)
  }
  return `${result.stdout ?? ""}${result.stderr ?? ""}`
}

try {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
  const filename = `${packageJson.name}-${packageJson.version}.tgz`
  await runReleaseStep(repoRoot, {
    step: "release.check",
    version: packageJson.version,
    code: "RELEASE_CHECK",
    startMessage: `running release check for ${packageJson.version}`,
    finishMessage: `release check passed for ${packageJson.version}`,
    finishData: { artifact: filename },
    run: async () => {
      run("node", ["scripts/release-vscode-extension.mjs"])
      run("npm", ["pack"], {
        env: { ...process.env, npm_config_cache: cacheDir },
      })
      const tarball = join(repoRoot, filename)
      const packedPackage = JSON.parse(run("tar", ["-xOf", tarball, "package/package.json"]))

      if (packedPackage.bin?.gorsee !== "dist-pkg/bin/gorsee.js") {
        throw new Error(`packed bin.gorsee mismatch: ${packedPackage.bin?.gorsee ?? "missing"}`)
      }
      const requiredPackedExports = {
        ".": "./dist-pkg/index.js",
        "./compat": "./dist-pkg/compat.js",
        "./client": "./dist-pkg/client.js",
        "./server": "./dist-pkg/server-entry.js",
      }
      for (const [key, expected] of Object.entries(requiredPackedExports)) {
        if (packedPackage.exports?.[key] !== expected) {
          throw new Error(`packed export drift for ${key}: expected ${expected}, received ${packedPackage.exports?.[key] ?? "missing"}`)
        }
      }
      const packedFiles = run("tar", ["-tf", tarball])
      if (!packedFiles.includes("package/dist-pkg/index.js")) {
        throw new Error("packed tarball must include dist-pkg/index.js")
      }
      if (!packedFiles.includes("package/dist-pkg/index.d.ts")) {
        throw new Error("packed tarball must include dist-pkg/index.d.ts")
      }
      if (packedFiles.includes("package/src/index.ts")) {
        throw new Error("packed tarball must not ship raw src/index.ts")
      }

      if ("repository" in packedPackage) {
        throw new Error("packed package must not ship a repository field until an explicit public repository path is configured")
      }
      if ("homepage" in packedPackage) {
        throw new Error("packed package must not ship a homepage field until an explicit public homepage is configured")
      }
      if (packageJson.bin?.gorsee !== "bin/gorsee.js") {
        throw new Error(`workspace bin.gorsee mismatch: ${packageJson.bin?.gorsee ?? "missing"}`)
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
    },
  })
  console.log(`release:check OK (${filename})`)
} catch (error) {
  throw error
} finally {
  try {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
    rmSync(join(repoRoot, `${packageJson.name}-${packageJson.version}.tgz`), { force: true })
  } catch {}
  rmSync(cacheDir, { recursive: true, force: true })
}

function readLockedPackageVersion(lockfile, packageName) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = lockfile.match(new RegExp(`"${escaped}": \\["${escaped}@([^"]+)"`))
  return match?.[1] ?? null
}
