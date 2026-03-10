import { readFileSync } from "node:fs"
import { join } from "node:path"

const repoRoot = join(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")
const ciPolicy = readFileSync(join(repoRoot, "docs/CI_POLICY.md"), "utf-8")
const supportMatrix = readFileSync(join(repoRoot, "docs/SUPPORT_MATRIX.md"), "utf-8")
const auditDoc = readFileSync(join(repoRoot, "docs/TEST_COVERAGE_AUDIT.md"), "utf-8")

if (!packageJson.scripts?.["coverage:audit"]?.includes("coverage-audit-check.mjs")) {
  throw new Error("missing coverage:audit script")
}

if (!packageJson.scripts?.["verify:security"]?.includes("bun run coverage:audit")) {
  throw new Error("verify:security must run coverage:audit")
}

for (const token of [
  "Coverage Model",
  "Current Surface Map",
  "Gap Backlog",
  "Priority Order",
  "Canonical Enforcement Surface",
  "COV-RUNTIME-001",
  "COV-RUNTIME-002",
  "COV-REACTIVE-001",
  "COV-SECURITY-001",
  "COV-CLI-001",
  "COV-PLUGIN-001",
  "COV-CONTENT-001",
  "COV-I18N-001",
  "COV-IMAGE-001",
  "COV-PUBLISH-001",
  "COV-GATE-001",
  "`bun run coverage:audit`",
  "`bun run critical:surface`",
  "`bun run test:critical-surface`",
  "`scripts/coverage-audit-check.mjs`",
]) {
  if (!auditDoc.includes(token)) {
    throw new Error(`coverage audit doc missing token: ${token}`)
  }
}

for (const token of [
  "Test Coverage Audit",
  "coverage:audit",
]) {
  if (!readme.includes(token)) {
    throw new Error(`README missing coverage audit token: ${token}`)
  }
}

for (const token of [
  "bun run coverage:audit",
  "Coverage Audit Surface",
  "docs/TEST_COVERAGE_AUDIT.md",
]) {
  if (!ciPolicy.includes(token)) {
    throw new Error(`CI policy missing coverage audit token: ${token}`)
  }
}

for (const token of [
  "test coverage audit",
  "docs/TEST_COVERAGE_AUDIT.md",
  "coverage:audit",
]) {
  if (!supportMatrix.includes(token)) {
    throw new Error(`support matrix missing coverage audit token: ${token}`)
  }
}

console.log("coverage:audit OK")
