import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const repoRoot = join(import.meta.dirname, "..")
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const manifest = JSON.parse(readFileSync(join(repoRoot, "docs/DEPLOY_CONTRACT.json"), "utf-8"))
const cmdDeploySource = readFileSync(join(repoRoot, "src/cli/cmd-deploy.ts"), "utf-8")
const deployGuide = readFileSync(join(repoRoot, "docs/DEPLOY_TARGET_GUIDE.md"), "utf-8")
const adapterSecurity = readFileSync(join(repoRoot, "docs/ADAPTER_SECURITY.md"), "utf-8")
const rolloutGuide = readFileSync(join(repoRoot, "docs/FIRST_PRODUCTION_ROLLOUT.md"), "utf-8")
const supportMatrix = readFileSync(join(repoRoot, "docs/SUPPORT_MATRIX.md"), "utf-8")
const readme = readFileSync(join(repoRoot, "README.md"), "utf-8")
const releaseSmoke = readFileSync(join(repoRoot, "scripts/release-smoke.mjs"), "utf-8")
const providerSmoke = readFileSync(join(repoRoot, "tests/deploy/provider-smoke.test.ts"), "utf-8")
const cmdDeployTests = readFileSync(join(repoRoot, "tests/cli/cmd-deploy.test.ts"), "utf-8")

if (!packageJson.scripts?.["deploy:policy"]?.includes("deploy-contract-check.mjs")) {
  throw new Error("missing deploy:policy script")
}

if (!packageJson.scripts?.["verify:security"]?.includes("bun run deploy:policy")) {
  throw new Error("verify:security must run deploy:policy")
}

if (manifest.version !== 1) {
  throw new Error(`DEPLOY_CONTRACT version must be 1, received ${String(manifest.version)}`)
}

if (!Array.isArray(manifest.applicationModes) || manifest.applicationModes.join(",") !== "frontend,fullstack,server") {
  throw new Error("deploy contract must define canonical application modes frontend,fullstack,server")
}

for (const file of manifest.requiredDocs ?? []) {
  statSync(join(repoRoot, file))
}

for (const token of manifest.requiredReadmeTokens ?? []) {
  assertIncludes(readme, token, `README missing deploy token: ${token}`)
}

for (const token of manifest.requiredSupportTokens ?? []) {
  assertIncludes(supportMatrix, token, `support matrix missing deploy token: ${token}`)
}

for (const token of manifest.requiredGuideTokens ?? []) {
  assertIncludes(deployGuide, token, `deploy guide missing token: ${token}`)
}

for (const token of manifest.requiredSecurityTokens ?? []) {
  assertIncludes(adapterSecurity, token, `adapter security missing token: ${token}`)
}

for (const token of manifest.requiredRolloutTokens ?? []) {
  assertIncludes(rolloutGuide, token, `rollout guide missing deploy token: ${token}`)
}

if (!Array.isArray(manifest.processRuntimeProfiles) || manifest.processRuntimeProfiles.join(",") !== "bun,node") {
  throw new Error("deploy contract must define canonical process runtime profiles bun,node")
}

if (!Array.isArray(manifest.targets) || manifest.targets.length !== 5) {
  throw new Error("deploy contract must define exactly five deploy targets")
}

for (const target of manifest.targets) {
  for (const field of ["id", "displayName", "applicationModes", "runtimeProfiles", "generatedFiles", "cmdDeploySourceToken", "guideToken", "securityHeading", "smokeToken", "releaseSmokeCommand", "requiredArtifactTokens"]) {
    if (!(field in target)) {
      throw new Error(`deploy target ${target.id ?? "unknown"} missing field: ${field}`)
    }
  }

  assertIncludes(cmdDeploySource, target.cmdDeploySourceToken, `cmd-deploy source missing target token: ${target.id}`)
  assertIncludes(deployGuide, target.guideToken, `deploy guide missing target entry: ${target.displayName}`)
  assertIncludes(adapterSecurity, target.securityHeading, `adapter security missing heading: ${target.securityHeading}`)
  assertIncludes(providerSmoke, target.smokeToken, `provider smoke missing target evidence: ${target.id}`)
  assertIncludes(releaseSmoke, target.releaseSmokeCommand, `release smoke missing target command: ${target.id}`)

  for (const runtimeProfile of target.runtimeProfiles) {
    if (!manifest.processRuntimeProfiles.includes(runtimeProfile)) {
      throw new Error(`deploy target ${target.id} references unsupported runtime profile: ${runtimeProfile}`)
    }
  }

  for (const appMode of target.applicationModes ?? []) {
    if (!manifest.applicationModes.includes(appMode)) {
      throw new Error(`deploy target ${target.id} references unsupported application mode: ${appMode}`)
    }
  }

  for (const token of target.requiredArtifactTokens ?? []) {
    if (!cmdDeployTests.includes(token) && !releaseSmoke.includes(token)) {
      throw new Error(`deploy evidence missing artifact token for ${target.id}: ${token}`)
    }
  }

  for (const file of target.generatedFiles ?? []) {
    if (!cmdDeployTests.includes(file) && !releaseSmoke.includes(file)) {
      throw new Error(`deploy target ${target.id} missing generated-file evidence for ${file}`)
    }
  }

  for (const runtimeCommand of target.releaseSmokeRuntimeCommands ?? []) {
    assertIncludes(releaseSmoke, runtimeCommand, `release smoke missing runtime-specific deploy command for ${target.id}`)
  }
}

console.log("deploy:policy OK")

function assertIncludes(source, token, message) {
  if (!source.includes(token)) {
    throw new Error(message)
  }
}
