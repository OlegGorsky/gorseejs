import { readFileSync } from "node:fs"
import { join } from "node:path"

const repoRoot = join(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const manifest = JSON.parse(readFileSync(join(repoRoot, "docs/RUNTIME_SECURITY_CONTRACT.json"), "utf-8"))
const securityModel = readFileSync(join(repoRoot, "docs/SECURITY_MODEL.md"), "utf-8")
const adapterSecurity = readFileSync(join(repoRoot, "docs/ADAPTER_SECURITY.md"), "utf-8")
const supportMatrix = readFileSync(join(repoRoot, "docs/SUPPORT_MATRIX.md"), "utf-8")
const ciPolicy = readFileSync(join(repoRoot, "docs/CI_POLICY.md"), "utf-8")
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")

if (!packageJson.scripts?.["runtime:security:policy"]?.includes("runtime-security-contract-check.mjs")) {
  throw new Error("missing runtime:security:policy script")
}

if (!packageJson.scripts?.["verify:security"]?.includes("bun run runtime:security:policy")) {
  throw new Error("verify:security must run runtime:security:policy")
}

if (manifest.version !== 1) {
  throw new Error(`RUNTIME_SECURITY_CONTRACT version must be 1, received ${String(manifest.version)}`)
}

if (!Array.isArray(manifest.requestExecutionOrder) || manifest.requestExecutionOrder.length !== 5) {
  throw new Error("runtime security contract must declare requestExecutionOrder[5]")
}

if (!Array.isArray(manifest.requestKinds) || manifest.requestKinds.length !== 6) {
  throw new Error("runtime security contract must declare six requestKinds")
}

for (const token of [
  "Request Execution Order",
  "Endpoint Classes",
  "Canonical Origin",
  "Proxy / Forwarded Headers",
  "Cache Model",
  "RPC Boundary",
  "docs/RUNTIME_SECURITY_CONTRACT.json",
]) {
  if (!securityModel.includes(token)) {
    throw new Error(`security model missing runtime security token: ${token}`)
  }
}

for (const token of [
  "canonical origin contract",
  "explicit RPC policy wiring",
  "docs/RUNTIME_SECURITY_CONTRACT.json",
]) {
  if (!adapterSecurity.includes(token)) {
    throw new Error(`adapter security missing runtime security token: ${token}`)
  }
}

for (const token of [
  "runtime:security:policy",
  "docs/RUNTIME_SECURITY_CONTRACT.json",
]) {
  if (!supportMatrix.includes(token)) {
    throw new Error(`support matrix missing runtime security token: ${token}`)
  }
  if (!ciPolicy.includes(token)) {
    throw new Error(`CI policy missing runtime security token: ${token}`)
  }
  if (!readme.includes(token)) {
    throw new Error(`README missing runtime security token: ${token}`)
  }
}

console.log("runtime:security:policy OK")
