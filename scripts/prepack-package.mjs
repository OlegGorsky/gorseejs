#!/usr/bin/env node

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packagePath = join(repoRoot, "package.json")
const backupPath = join(repoRoot, ".package.json.prepack.bak")

if (!existsSync(backupPath)) {
  copyFileSync(packagePath, backupPath)
}

execFileSync("bun", ["run", "scripts/build-publish-artifacts.ts"], {
  cwd: repoRoot,
  stdio: "inherit",
})

const original = JSON.parse(readFileSync(backupPath, "utf-8"))
const packed = {
  ...original,
  exports: rewriteExports(original.exports ?? {}),
  files: [
    "bin/",
    "dist-pkg/",
    "README.md",
    "LICENSE",
  ],
  types: "./dist-pkg/index.d.ts",
}

writeFileSync(packagePath, JSON.stringify(packed, null, 2) + "\n")

function rewriteExports(exportsMap) {
  return Object.fromEntries(
    Object.entries(exportsMap).map(([key, value]) => [key, rewriteExportPath(value)]),
  )
}

function rewriteExportPath(value) {
  return String(value)
    .replace(/^\.\/src\//, "./dist-pkg/")
    .replace(/\.(?:[cm]?ts|tsx)$/, ".js")
}
