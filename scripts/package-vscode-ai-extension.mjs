import { mkdir, rm, cp, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

const repoRoot = resolve(import.meta.dirname, "..")
const extensionDir = join(repoRoot, "integrations", "vscode-gorsee-ai")
const outDir = join(repoRoot, "dist", "vscode-gorsee-ai")
const stageDir = join(outDir, "stage")
const extensionStageDir = join(stageDir, "extension")
const extensionManifest = JSON.parse(await readFile(join(extensionDir, "package.json"), "utf-8"))
const rootManifest = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf-8"))
const extensionVersion = process.env.GORSEE_EXTENSION_VERSION || rootManifest.version
const shouldBuildVsix = !process.argv.includes("--no-vsix")

await rm(outDir, { recursive: true, force: true })
await mkdir(extensionStageDir, { recursive: true })
await cp(extensionDir, extensionStageDir, { recursive: true })
await writeFile(join(extensionStageDir, "package.json"), JSON.stringify({
  ...extensionManifest,
  version: extensionVersion,
}, null, 2) + "\n", "utf-8")

await writeFile(join(stageDir, "[Content_Types].xml"), buildContentTypesXml(), "utf-8")
await writeFile(join(stageDir, "extension.vsixmanifest"), buildVsixManifest({
  ...extensionManifest,
  version: extensionVersion,
}), "utf-8")

const vsixName = `${extensionManifest.name}-${extensionVersion}.vsix`
const vsixPath = join(outDir, vsixName)
if (shouldBuildVsix) {
  const result = spawnSync("zip", ["-qr", vsixPath, "."], {
    cwd: stageDir,
    stdio: "pipe",
  })
  if (result.status !== 0) {
    throw new Error(`Failed to build VSIX: ${result.stderr?.toString() || result.stdout?.toString() || "zip failed"}`)
  }
}

const manifest = {
  install: [
    "Open VS Code or Cursor",
    shouldBuildVsix
      ? `Run: Extensions: Install from VSIX... and select ${vsixName}`
      : "Package with zip/vsce to produce a .vsix first",
    "Or open dist/vscode-gorsee-ai/stage/extension as an extension development host",
  ],
  devCommand: "bunx gorsee ai ide-sync --watch",
  extensionPath: extensionStageDir,
  stageDir,
  vsixPath: shouldBuildVsix ? vsixPath : null,
  note: "This script stages and packages the Gorsee VS Code/Cursor AI extension.",
}

await mkdir(dirname(join(outDir, "gorsee-ai-extension.json")), { recursive: true })
await writeFile(join(outDir, "gorsee-ai-extension.json"), JSON.stringify(manifest, null, 2), "utf-8")

console.log(JSON.stringify({
  staged: extensionStageDir,
  manifest: join(outDir, "gorsee-ai-extension.json"),
  vsix: manifest.vsixPath,
}, null, 2))

function buildContentTypesXml() {
  return `<?xml version="1.0" encoding="utf-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n  <Default Extension="json" ContentType="application/json" />\n  <Default Extension="js" ContentType="application/javascript" />\n  <Default Extension="md" ContentType="text/markdown" />\n  <Default Extension="txt" ContentType="text/plain" />\n  <Default Extension="xml" ContentType="application/xml" />\n  <Override PartName="/extension.vsixmanifest" ContentType="text/xml" />\n</Types>\n`
}

function buildVsixManifest(manifest) {
  const identity = escapeXml(manifest.name)
  const displayName = escapeXml(manifest.displayName || manifest.name)
  const description = escapeXml(manifest.description || manifest.name)
  const version = escapeXml(manifest.version || "0.1.0")
  const publisher = escapeXml(manifest.publisher || "gorsee")
  return `<?xml version="1.0" encoding="utf-8"?>\n<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">\n  <Metadata>\n    <Identity Language="en-US" Id="${identity}" Version="${version}" Publisher="${publisher}" />\n    <DisplayName>${displayName}</DisplayName>\n    <Description>${description}</Description>\n    <Categories>Other</Categories>\n  </Metadata>\n  <Installation>\n    <InstallationTarget Id="Microsoft.VisualStudio.Code" Version="${escapeXml(manifest.engines?.vscode || '^1.95.0')}" />\n  </Installation>\n  <Assets>\n    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />\n    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />\n    <Asset Type="Microsoft.VisualStudio.Code" Path="extension" />\n  </Assets>\n</PackageManifest>\n`
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
