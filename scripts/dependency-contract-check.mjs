import { readFileSync } from "node:fs"
import { join } from "node:path"

const repoRoot = join(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const manifest = JSON.parse(readFileSync(join(repoRoot, "docs/DEPENDENCY_CONTRACT.json"), "utf-8"))
const dependencyPolicy = readFileSync(join(repoRoot, "docs/DEPENDENCY_POLICY.md"), "utf-8")
const supportMatrix = readFileSync(join(repoRoot, "docs/SUPPORT_MATRIX.md"), "utf-8")
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")

if (!packageJson.scripts?.["dependency:policy"]?.includes("dependency-contract-check.mjs")) {
  throw new Error("missing dependency:policy script")
}

if (!packageJson.scripts?.["verify:security"]?.includes("bun run dependency:policy")) {
  throw new Error("verify:security must run dependency:policy")
}

if (manifest.version !== 1) {
  throw new Error(`dependency contract version must be 1, received ${String(manifest.version)}`)
}

if (packageJson.packageManager !== manifest.packageManager) {
  throw new Error(`packageManager drift: expected ${manifest.packageManager}, received ${packageJson.packageManager}`)
}

if (packageJson.engines?.bun !== manifest.bunEngine) {
  throw new Error(`bun engine drift: expected ${manifest.bunEngine}, received ${packageJson.engines?.bun ?? "missing"}`)
}

for (const [name, version] of Object.entries(manifest.runtimeDependencies ?? {})) {
  if (packageJson.dependencies?.[name] !== version) {
    throw new Error(`runtime dependency drift for ${name}: expected ${version}, received ${packageJson.dependencies?.[name] ?? "missing"}`)
  }
}

for (const [name, version] of Object.entries(manifest.devDependencies ?? {})) {
  if (packageJson.devDependencies?.[name] !== version) {
    throw new Error(`dev dependency drift for ${name}: expected ${version}, received ${packageJson.devDependencies?.[name] ?? "missing"}`)
  }
}

for (const file of manifest.requiredFiles ?? []) {
  if (!packageJson.files?.includes(file)) {
    throw new Error(`package files missing required entry: ${file}`)
  }
}

for (const token of [
  "Dependency Policy",
  "runtime dependencies should stay pinned exactly",
  "publish-time compiled artifacts must not depend on packages that are only present in `devDependencies`",
  "docs/DEPENDENCY_CONTRACT.json",
]) {
  if (!dependencyPolicy.includes(token)) {
    throw new Error(`dependency policy doc missing token: ${token}`)
  }
}

for (const token of [
  "package manager contract: `bun@1.3.9`",
  "exact Bun engine contract: `1.3.9`",
  "docs/DEPENDENCY_CONTRACT.json",
  "dependency:policy",
]) {
  if (!supportMatrix.includes(token)) {
    throw new Error(`support matrix missing dependency token: ${token}`)
  }
}

for (const token of [
  "Dependency Policy",
  "dependency:policy",
  "docs/DEPENDENCY_CONTRACT.json",
]) {
  if (!readme.includes(token)) {
    throw new Error(`README missing dependency token: ${token}`)
  }
}

console.log("dependency:policy OK")
