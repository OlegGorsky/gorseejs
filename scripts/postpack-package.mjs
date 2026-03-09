#!/usr/bin/env node

import { existsSync, rmSync, renameSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const packagePath = join(repoRoot, "package.json")
const backupPath = join(repoRoot, ".package.json.prepack.bak")

if (existsSync(backupPath)) {
  rmSync(packagePath, { force: true })
  renameSync(backupPath, packagePath)
}
