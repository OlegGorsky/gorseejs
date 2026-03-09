const vscode = require("vscode")
const fs = require("node:fs")
const path = require("node:path")

let diagnosticsCollection
let diagnosticsWatcher
let contextWatcher
let statusBarItem

function activate(context) {
  diagnosticsCollection = vscode.languages.createDiagnosticCollection("gorsee-ai")
  context.subscriptions.push(diagnosticsCollection)
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  statusBarItem.command = "gorseeAi.showContext"
  statusBarItem.text = "$(pulse) Gorsee AI"
  statusBarItem.tooltip = "Gorsee AI context is waiting for diagnostics."
  statusBarItem.show()
  context.subscriptions.push(statusBarItem)

  context.subscriptions.push(vscode.commands.registerCommand("gorseeAi.refresh", async () => {
    await refreshDiagnostics()
  }))

  context.subscriptions.push(vscode.commands.registerCommand("gorseeAi.showContext", async () => {
    const workspacePath = getWorkspacePath()
    if (!workspacePath) return
    const contextPath = path.join(workspacePath, ".gorsee", "ide", "context.md")
    const content = await readFileSafe(contextPath)
    const panel = vscode.window.createWebviewPanel(
      "gorseeAiContext",
      "Gorsee AI Context",
      vscode.ViewColumn.Beside,
      { enableFindWidget: true }
    )
    panel.webview.html = `<html><body><pre>${escapeHtml(content || "No AI context found. Run `gorsee ai ide-sync`.")}</pre></body></html>`
  }))

  context.subscriptions.push(vscode.commands.registerCommand("gorseeAi.showArtifacts", async () => {
    const workspacePath = getWorkspacePath()
    if (!workspacePath) return
    const eventsPath = path.join(workspacePath, ".gorsee", "ide", "events.json")
    const raw = await readFileSafe(eventsPath)
    let parsed
    try {
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      parsed = null
    }
    const regressions = Array.isArray(parsed?.artifactRegressions) ? parsed.artifactRegressions : []
    const content = regressions.length === 0
      ? "No artifact regressions found. Run `gorsee ai ide-sync` after build/release/deploy activity."
      : regressions
          .map((entry) => {
            const details = [entry.version, entry.path].filter(Boolean).join(" ")
            return `- ${entry.phase}: errors=${entry.errors} warnings=${entry.warnings} successes=${entry.successes}${details ? ` (${details})` : ""}`
          })
          .join("\n")
    const panel = vscode.window.createWebviewPanel(
      "gorseeAiArtifacts",
      "Gorsee AI Artifact Regressions",
      vscode.ViewColumn.Beside,
      { enableFindWidget: true }
    )
    panel.webview.html = `<html><body><pre>${escapeHtml(content)}</pre></body></html>`
  }))

  wireWatchers(context)
  refreshDiagnostics()
}

function deactivate() {
  if (diagnosticsWatcher) diagnosticsWatcher.dispose()
  if (contextWatcher) contextWatcher.dispose()
  if (diagnosticsCollection) diagnosticsCollection.dispose()
  if (statusBarItem) statusBarItem.dispose()
}

async function refreshDiagnostics() {
  const workspacePath = getWorkspacePath()
  if (!workspacePath || !diagnosticsCollection) return

  const diagnosticsPath = path.join(workspacePath, ".gorsee", "ide", "diagnostics.json")
  const raw = await readFileSafe(diagnosticsPath)
  diagnosticsCollection.clear()
  if (!raw) return

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return
  }

  const grouped = new Map()
  for (const diagnostic of parsed.diagnostics || []) {
    if (!diagnostic.file) continue
    const uri = vscode.Uri.file(path.isAbsolute(diagnostic.file) ? diagnostic.file : path.join(workspacePath, diagnostic.file))
    const range = new vscode.Range(
      Math.max((diagnostic.line || 1) - 1, 0),
      0,
      Math.max((diagnostic.line || 1) - 1, 0),
      200
    )
    const item = new vscode.Diagnostic(
      range,
      diagnostic.code ? `${diagnostic.code}: ${diagnostic.message}` : diagnostic.message,
      diagnostic.severity === "error" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
    )
    item.source = "gorsee-ai"
    item.code = diagnostic.code
    const list = grouped.get(uri.toString()) || []
    list.push(item)
    grouped.set(uri.toString(), list)
  }

  for (const [uriString, list] of grouped.entries()) {
    diagnosticsCollection.set(vscode.Uri.parse(uriString), list)
  }
  updateStatusBar(parsed)
}

function wireWatchers(context) {
  const workspacePath = getWorkspacePath()
  if (!workspacePath) return
  const diagnosticsGlob = new vscode.RelativePattern(workspacePath, ".gorsee/ide/diagnostics.json")
  const contextGlob = new vscode.RelativePattern(workspacePath, ".gorsee/ide/context.md")

  diagnosticsWatcher = vscode.workspace.createFileSystemWatcher(diagnosticsGlob)
  contextWatcher = vscode.workspace.createFileSystemWatcher(contextGlob)

  for (const watcher of [diagnosticsWatcher, contextWatcher]) {
    watcher.onDidChange(() => refreshDiagnostics(), null, context.subscriptions)
    watcher.onDidCreate(() => refreshDiagnostics(), null, context.subscriptions)
    watcher.onDidDelete(() => refreshDiagnostics(), null, context.subscriptions)
    context.subscriptions.push(watcher)
  }
}

function getWorkspacePath() {
  return vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
    ? vscode.workspace.workspaceFolders[0].uri.fsPath
    : null
}

function readFileSafe(file) {
  return fs.promises.readFile(file, "utf-8").catch(() => null)
}

function updateStatusBar(parsed) {
  if (!statusBarItem) return
  const diagnostics = Array.isArray(parsed.diagnostics) ? parsed.diagnostics : []
  const artifactRegressions = Array.isArray(parsed.artifactRegressions) ? parsed.artifactRegressions : []
  const errorCount = diagnostics.filter((item) => item.severity === "error").length

  if (errorCount > 0 || artifactRegressions.length > 0) {
    statusBarItem.text = `$(warning) Gorsee AI ${errorCount} diag / ${artifactRegressions.length} artifacts`
    const lines = []
    if (errorCount > 0) lines.push(`Diagnostics: ${errorCount}`)
    if (artifactRegressions.length > 0) {
      const top = artifactRegressions[0]
      lines.push(`Artifacts: ${artifactRegressions.length}`)
      if (top && (top.path || top.version)) {
        lines.push(`Top artifact: ${[top.version, top.path].filter(Boolean).join(" ")}`)
      }
    }
    statusBarItem.tooltip = lines.join("\n")
    return
  }

  statusBarItem.text = "$(check) Gorsee AI clean"
  statusBarItem.tooltip = "No current diagnostics or artifact regressions."
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

module.exports = { activate, deactivate }
