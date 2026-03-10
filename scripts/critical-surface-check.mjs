import { readFileSync } from "node:fs"
import { join } from "node:path"

const repoRoot = join(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")
const ciPolicy = readFileSync(join(repoRoot, "docs/CI_POLICY.md"), "utf-8")
const supportMatrix = readFileSync(join(repoRoot, "docs/SUPPORT_MATRIX.md"), "utf-8")
const auditDoc = readFileSync(join(repoRoot, "docs/TEST_COVERAGE_AUDIT.md"), "utf-8")
const ciWorkflow = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf-8")

if (!packageJson.scripts?.["critical:surface"]?.includes("critical-surface-check.mjs")) {
  throw new Error("missing critical:surface script")
}

if (!packageJson.scripts?.["test:critical-surface"]?.includes("tests/runtime/router-navigation.test.ts")) {
  throw new Error("test:critical-surface must cover router navigation regressions")
}

for (const token of [
  "tests/server/compress.test.ts",
  "tests/server/request-preflight.test.ts",
  "tests/server/request-security-policy.test.ts",
  "tests/server/route-request-security.test.ts",
  "tests/reactive/race-contracts.test.ts",
  "tests/runtime/client-runtime-negative.test.ts",
  "tests/runtime/client-hydration-recovery.test.ts",
  "tests/runtime/router-navigation.test.ts",
  "tests/ai/mcp.test.ts",
  "tests/cli/install-matrix.test.ts",
  "tests/cli/release-surface.test.ts",
]) {
  if (!packageJson.scripts["test:critical-surface"].includes(token)) {
    throw new Error(`test:critical-surface missing token: ${token}`)
  }
}

for (const token of [
  "bun run critical:surface",
  "bun run test:critical-surface",
]) {
  if (!packageJson.scripts?.["verify:security"]?.includes(token)) {
    throw new Error(`verify:security must run ${token.replace("bun run ", "")}`)
  }
}

for (const token of [
  "Critical Surface Suite",
  "critical:surface",
  "test:critical-surface",
  "router navigation regressions",
  "Accept-Encoding",
  "MCP default limit",
]) {
  if (!auditDoc.includes(token)) {
    throw new Error(`test coverage audit missing critical-surface token: ${token}`)
  }
}

for (const token of [
  "Critical Surface Suite",
  "bun run critical:surface",
  "bun run test:critical-surface",
]) {
  if (!ciPolicy.includes(token)) {
    throw new Error(`CI policy missing critical-surface token: ${token}`)
  }
}

for (const token of [
  "critical surface suite",
  "test:critical-surface",
]) {
  if (!supportMatrix.includes(token)) {
    throw new Error(`support matrix missing critical-surface token: ${token}`)
  }
}

for (const token of [
  "Critical Surface Suite",
  "critical:surface",
  "test:critical-surface",
]) {
  if (!readme.includes(token)) {
    throw new Error(`README missing critical-surface token: ${token}`)
  }
}

for (const token of [
  "bun run critical:surface",
  "bun run test:critical-surface",
]) {
  if (!ciWorkflow.includes(token)) {
    throw new Error(`CI workflow missing critical-surface token: ${token}`)
  }
}

console.log("critical:surface OK")
