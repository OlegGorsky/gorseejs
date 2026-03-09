#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { emitReleaseEvent, runReleaseStep } from "./ai-release-utils.mjs"

const repoRoot = resolve(import.meta.dirname, "..")
const rootPackage = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"))
const extensionPackage = JSON.parse(readFileSync(join(repoRoot, "integrations", "vscode-gorsee-ai", "package.json"), "utf-8"))

if (!extensionPackage.engines?.vscode) {
  await emitReleaseEvent(repoRoot, "release.extension.error", "error", "RELEASE_EXTENSION", {
    message: "VS Code extension manifest missing engines.vscode",
    version: rootPackage.version,
  })
  throw new Error("VS Code extension manifest missing engines.vscode")
}

await runReleaseStep(repoRoot, {
  step: "release.extension",
  version: rootPackage.version,
  code: "RELEASE_EXTENSION",
  startMessage: `building VSIX for ${rootPackage.version}`,
  finishMessage: `VSIX built for ${rootPackage.version}`,
  finishData: {
    artifact: `dist/vscode-gorsee-ai/gorsee-ai-tools-${rootPackage.version}.vsix`,
  },
  run: async () => {
  execFileSync("node", ["scripts/package-vscode-ai-extension.mjs"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, GORSEE_EXTENSION_VERSION: rootPackage.version },
  })
  },
})
