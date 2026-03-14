import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

const args = process.argv.slice(2)
const flags = parseFlags(args)
const cwd = resolve(flags.cwd ?? process.cwd())
const repoRoot = resolve(import.meta.dirname, "..")
const type = flags.type === "migration" ? "migration" : "reference"
const id = flags.id ?? `${type}-candidate`
const title = flags.title ?? humanizeId(id)
const draftsDir = join(cwd, ".gorsee", "external-proof", "drafts")
const markdownPath = join(draftsDir, `${id}.md`)
const metaPath = join(draftsDir, `${id}.meta.json`)

const claimsCatalog = JSON.parse(readFileSync(join(repoRoot, "docs/EXTERNAL_PROOF_CLAIMS.json"), "utf-8"))
const templateName = type === "migration" ? "EXTERNAL_MIGRATION_CASE_STUDY.md" : "EXTERNAL_REFERENCE_PROFILE.md"
const template = readFileSync(join(repoRoot, "docs", "templates", templateName), "utf-8")

mkdirSync(draftsDir, { recursive: true })

const claimIds = claimsCatalog.claims.map((claim) => claim.id)
const markdown = renderDraftMarkdown(template, { id, title, type, claimIds })
const meta = {
  schemaVersion: 1,
  kind: "gorsee.external-proof-draft",
  id,
  type,
  title,
  claimsCatalog: "docs/EXTERNAL_PROOF_CLAIMS.json",
  nextSteps: [
    "fill the public source URL",
    "map validated claims using claim ids from docs/EXTERNAL_PROOF_CLAIMS.json",
    "promote to docs/EXTERNAL_PROOF_OUTREACH.json only when the lead is factual",
    "promote to docs/EXTERNAL_PROOF_PIPELINE.json only after public evidence exists",
  ],
}

writeFileSync(markdownPath, markdown, "utf-8")
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf-8")

if (flags.json) {
  console.log(JSON.stringify({
    cwd,
    type,
    id,
    markdownPath,
    metaPath,
    claimIds,
  }, null, 2))
} else {
  console.log("\n  External Proof Scaffold\n")
  console.log(`  type        -> ${type}`)
  console.log(`  id          -> ${id}`)
  console.log(`  markdown    -> ${relativeToCwd(cwd, markdownPath)}`)
  console.log(`  metadata    -> ${relativeToCwd(cwd, metaPath)}`)
  console.log(`  claims      -> ${claimIds.join(", ")}`)
  console.log()
}

function parseFlags(argv) {
  const result = { json: false }
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === "--json") {
      result.json = true
      continue
    }
    if (!current.startsWith("--")) continue
    const key = current.slice(2)
    const value = argv[index + 1]
    if (value && !value.startsWith("--")) {
      result[key] = value
      index += 1
    } else {
      result[key] = true
    }
  }
  return result
}

function humanizeId(value) {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ")
}

function renderDraftMarkdown(template, context) {
  const replaced = template
    .replace("- title:", `- title: ${context.title}`)
    .replace("- public_url:", "- public_url: ")
    .replace("- repo_url:", "- repo_url: ")
  return [
    `<!-- external-proof draft id: ${context.id}; type: ${context.type} -->`,
    replaced.trimEnd(),
    "",
    "## Claim Catalog",
    "",
    ...context.claimIds.map((claimId) => `- ${claimId}`),
    "",
  ].join("\n")
}

function relativeToCwd(cwdPath, absolutePath) {
  return absolutePath.startsWith(cwdPath) ? absolutePath.slice(cwdPath.length + 1) : absolutePath
}
