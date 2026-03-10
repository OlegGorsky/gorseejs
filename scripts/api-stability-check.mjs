import { readFileSync } from "node:fs"
import { join } from "node:path"

const repoRoot = join(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const apiStabilityDoc = readFileSync(join(repoRoot, "docs/API_STABILITY.md"), "utf-8")
const publicSurfaceMap = readFileSync(join(repoRoot, "docs/PUBLIC_SURFACE_MAP.md"), "utf-8")
const manifest = JSON.parse(readFileSync(join(repoRoot, "docs/PUBLIC_SURFACE_MANIFEST.json"), "utf-8"))
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")

if (!packageJson.scripts?.["api:policy"]?.includes("api-stability-check.mjs")) {
  throw new Error("missing api:policy script")
}

if (!packageJson.scripts?.["verify:security"]?.includes("bun run api:policy")) {
  throw new Error("verify:security must run api:policy")
}

if (manifest.version !== 1) {
  throw new Error(`PUBLIC_SURFACE_MANIFEST version must be 1, received ${String(manifest.version)}`)
}

if (!Array.isArray(manifest.entrypoints) || manifest.entrypoints.length < 10) {
  throw new Error("PUBLIC_SURFACE_MANIFEST must declare entrypoints[]")
}

const seen = new Set()
for (const entry of manifest.entrypoints) {
  if (!entry || typeof entry !== "object") {
    throw new Error("PUBLIC_SURFACE_MANIFEST contains a non-object entry")
  }
  const { specifier, tier, source } = entry
  if (typeof specifier !== "string" || !specifier.startsWith("gorsee")) {
    throw new Error(`invalid public surface specifier: ${String(specifier)}`)
  }
  if (!["stable", "compatibility"].includes(tier)) {
    throw new Error(`invalid surface tier for ${specifier}: ${String(tier)}`)
  }
  if (typeof source !== "string" || !source.startsWith("./src/")) {
    throw new Error(`invalid surface source for ${specifier}: ${String(source)}`)
  }
  if (seen.has(specifier)) {
    throw new Error(`duplicate public surface specifier: ${specifier}`)
  }
  seen.add(specifier)

  const exportKey = specifier === "gorsee" ? "." : `./${specifier.slice("gorsee/".length)}`
  if (packageJson.exports?.[exportKey] !== source) {
    throw new Error(`public surface manifest drift for ${specifier}: expected ${source}, received ${packageJson.exports?.[exportKey] ?? "missing"}`)
  }
}

for (const token of [
  "root `gorsee` is compatibility-only",
  "`gorsee/compat` is the explicit compatibility entrypoint",
  "`gorsee/client` is stable and preferred",
  "`gorsee/server` is stable and preferred",
]) {
  if (!apiStabilityDoc.includes(token)) {
    throw new Error(`API stability doc missing token: ${token}`)
  }
}

for (const token of [
  "`gorsee/client`",
  "`gorsee/server`",
  "`gorsee/compat`",
  "Specialized Stable Subpaths",
]) {
  if (!publicSurfaceMap.includes(token)) {
    throw new Error(`public surface map missing token: ${token}`)
  }
}

for (const token of [
  "Keep root `gorsee` only for compatibility",
  "Use `gorsee/compat` only for explicit legacy migration semantics",
]) {
  if (!readme.includes(token)) {
    throw new Error(`README missing API stability token: ${token}`)
  }
}

console.log("api:policy OK")
