#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runReleaseStep } from "./ai-release-utils.mjs"

const repoRoot = resolve(import.meta.dirname, "..")
const cacheDir = mkdtempSync(join(tmpdir(), "gorsee-npm-cache-"))
const lockfileSource = readFileSync(join(repoRoot, "bun.lock"), "utf-8")
const expectedRepositoryUrl = "git+https://github.com/OlegGorsky/gorseejs.git"
const expectedHomepage = "https://github.com/OlegGorsky/gorseejs#readme"
const expectedBugsUrl = "https://github.com/OlegGorsky/gorseejs/issues"

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

      if (packedPackage.bin?.gorsee !== "bin/gorsee.js") {
        throw new Error(`packed bin.gorsee mismatch: ${packedPackage.bin?.gorsee ?? "missing"}`)
      }
      if (packedPackage.types !== "./dist-pkg/index.d.ts") {
        throw new Error(`packed types mismatch: ${packedPackage.types ?? "missing"}`)
      }
      const requiredPackedExports = {
        ".": "./dist-pkg/index.js",
        "./compat": "./dist-pkg/compat.js",
        "./client": "./dist-pkg/client.js",
        "./server": "./dist-pkg/server-entry.js",
        "./auth": "./dist-pkg/auth/index.js",
        "./forms": "./dist-pkg/forms/index.js",
        "./routes": "./dist-pkg/routes/index.js",
        "./i18n": "./dist-pkg/i18n/index.js",
        "./content": "./dist-pkg/content/index.js",
        "./deploy": "./dist-pkg/deploy/index.js",
        "./testing": "./dist-pkg/testing/index.js",
      }
      const packedFiles = new Set(run("tar", ["-tf", tarball]).trim().split("\n").filter(Boolean))
      for (const [key, expected] of Object.entries(requiredPackedExports)) {
        if (packedPackage.exports?.[key] !== expected) {
          throw new Error(`packed export drift for ${key}: expected ${expected}, received ${packedPackage.exports?.[key] ?? "missing"}`)
        }
      }
      for (const [key, exportPath] of Object.entries(packedPackage.exports ?? {})) {
        if (typeof exportPath !== "string" || !exportPath.endsWith(".js")) {
          throw new Error(`packed export must remain a direct JS entry for ${key}: ${String(exportPath)}`)
        }
        const declarationPath = exportPath.replace(/\.js$/, ".d.ts")
        if (!packedFiles.has(`package/${exportPath.slice(2)}`)) {
          throw new Error(`packed tarball missing JS entry for ${key}: ${exportPath}`)
        }
        if (!packedFiles.has(`package/${declarationPath.slice(2)}`)) {
          throw new Error(`packed tarball missing declaration entry for ${key}: ${declarationPath}`)
        }
      }
      if (!packedFiles.has("package/dist-pkg/index.js")) {
        throw new Error("packed tarball must include dist-pkg/index.js")
      }
      if (!packedFiles.has("package/dist-pkg/index.d.ts")) {
        throw new Error("packed tarball must include dist-pkg/index.d.ts")
      }
      if (!packedFiles.has("package/bin/gorsee.js")) {
        throw new Error("packed tarball must include bin/gorsee.js")
      }
      if (packedFiles.has("package/src/index.ts")) {
        throw new Error("packed tarball must not ship raw src/index.ts")
      }

      if (packedPackage.repository?.type !== "git" || packedPackage.repository?.url !== expectedRepositoryUrl) {
        throw new Error(`packed package repository must be ${expectedRepositoryUrl}`)
      }
      if (packedPackage.homepage !== expectedHomepage) {
        throw new Error(`packed package homepage must be ${expectedHomepage}`)
      }
      if (packedPackage.bugs?.url !== expectedBugsUrl) {
        throw new Error(`packed package bugs.url must be ${expectedBugsUrl}`)
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
