import { escapeHTML } from "./html-escape.ts"
import { getHydrationDiagnostics, type HydrationDiagnostics } from "./hydration.ts"
import { getRouterNavigationDiagnostics, type RouterNavigationDiagnostics } from "./router.ts"
import {
  getReactiveTraceArtifact,
  REACTIVE_TRACE_SCHEMA_VERSION,
  type ReactiveDiagnosticEvent,
  type ReactiveDiagnosticsSnapshot,
  type ReactiveTraceArtifact,
} from "../reactive/diagnostics.ts"

export const RUNTIME_DEVTOOLS_SCHEMA_VERSION = 1 as const

export interface RuntimeDevtoolsRouteEntry {
  path: string
  methods: string[]
  isApi: boolean
  hasLoader: boolean
  hasMiddleware: boolean
  title?: string
}

export interface RuntimeDevtoolsRouteSummary {
  total: number
  pages: number
  apis: number
  loaders: number
  middleware: number
}

export interface RuntimeDevtoolsTopNode {
  id: number
  kind: ReactiveTraceArtifact["nodes"][number]["kind"]
  label?: string
  score: number
  reads: number
  writes: number
  runs: number
  invalidations: number
}

export interface RuntimeDevtoolsSummary {
  navigationState: "idle" | "navigating"
  activeRoute: string
  hydrationState: "stable" | "recovering"
  mismatchCount: number
  topReactiveNode: string | null
  recentReactiveEventKinds: string[]
}

export interface RuntimeDevtoolsSnapshot {
  schemaVersion: typeof RUNTIME_DEVTOOLS_SCHEMA_VERSION
  generatedAt: string
  reactiveTraceSchemaVersion: typeof REACTIVE_TRACE_SCHEMA_VERSION
  navigation: RouterNavigationDiagnostics
  hydration: HydrationDiagnostics
  reactive: {
    snapshot: ReactiveDiagnosticsSnapshot
    topNodes: RuntimeDevtoolsTopNode[]
    recentEvents: ReactiveDiagnosticEvent[]
    trace?: ReactiveTraceArtifact
  }
  routes?: {
    summary: RuntimeDevtoolsRouteSummary
    entries: RuntimeDevtoolsRouteEntry[]
  }
  summary: RuntimeDevtoolsSummary
}

export interface RuntimeDevtoolsOptions {
  includeTrace?: boolean
  maxReactiveEvents?: number
  maxTopNodes?: number
  routes?: RuntimeDevtoolsRouteEntry[]
}

function sortTopNodes(trace: ReactiveTraceArtifact, limit: number): RuntimeDevtoolsTopNode[] {
  return trace.nodes
    .map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.label,
      score: node.reads + node.writes + node.runs + node.invalidations,
      reads: node.reads,
      writes: node.writes,
      runs: node.runs,
      invalidations: node.invalidations,
    }))
    .sort((left, right) => right.score - left.score || right.runs - left.runs || left.id - right.id)
    .slice(0, Math.max(1, limit))
}

function summarizeRoutes(entries: RuntimeDevtoolsRouteEntry[]): RuntimeDevtoolsRouteSummary {
  return {
    total: entries.length,
    pages: entries.filter((entry) => !entry.isApi).length,
    apis: entries.filter((entry) => entry.isApi).length,
    loaders: entries.filter((entry) => entry.hasLoader).length,
    middleware: entries.filter((entry) => entry.hasMiddleware).length,
  }
}

function summarizeSnapshot(
  navigation: RouterNavigationDiagnostics,
  hydration: HydrationDiagnostics,
  topNodes: RuntimeDevtoolsTopNode[],
  recentEvents: ReactiveDiagnosticEvent[],
): RuntimeDevtoolsSummary {
  return {
    navigationState: navigation.navigating ? "navigating" : "idle",
    activeRoute: navigation.activeNavigation?.url ?? navigation.currentPath,
    hydrationState: hydration.recoverableMismatch ? "recovering" : "stable",
    mismatchCount: hydration.mismatches,
    topReactiveNode: topNodes[0]?.label ?? topNodes[0]?.kind ?? null,
    recentReactiveEventKinds: recentEvents.slice(-5).map((event) => event.kind),
  }
}

export function createRuntimeDevtoolsSnapshot(options: RuntimeDevtoolsOptions = {}): RuntimeDevtoolsSnapshot {
  const trace = getReactiveTraceArtifact()
  const maxReactiveEvents = Math.max(1, options.maxReactiveEvents ?? 20)
  const topNodes = sortTopNodes(trace, options.maxTopNodes ?? 5)
  const recentEvents = trace.events.slice(-maxReactiveEvents)
  const navigation = getRouterNavigationDiagnostics()
  const hydration = getHydrationDiagnostics()
  const routes = options.routes
    ? {
      summary: summarizeRoutes(options.routes),
      entries: [...options.routes],
    }
    : undefined

  return {
    schemaVersion: RUNTIME_DEVTOOLS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    reactiveTraceSchemaVersion: REACTIVE_TRACE_SCHEMA_VERSION,
    navigation,
    hydration,
    reactive: {
      snapshot: trace.snapshot,
      topNodes,
      recentEvents,
      trace: options.includeTrace ? trace : undefined,
    },
    routes,
    summary: summarizeSnapshot(navigation, hydration, topNodes, recentEvents),
  }
}

function renderKeyValueGrid(entries: Array<{ key: string; value: string }>): string {
  return `<div class="g-devtools-grid">${entries.map((entry) =>
    `<div class="g-devtools-card"><div class="g-devtools-key">${escapeHTML(entry.key)}</div><div class="g-devtools-value">${escapeHTML(entry.value)}</div></div>`
  ).join("")}</div>`
}

export function renderRuntimeDevtoolsHTML(snapshot: RuntimeDevtoolsSnapshot): string {
  const routeSummary = snapshot.routes
    ? renderKeyValueGrid([
      { key: "Routes", value: String(snapshot.routes.summary.total) },
      { key: "Pages", value: String(snapshot.routes.summary.pages) },
      { key: "API", value: String(snapshot.routes.summary.apis) },
      { key: "Loaders", value: String(snapshot.routes.summary.loaders) },
      { key: "Middleware", value: String(snapshot.routes.summary.middleware) },
    ])
    : ""

  const topNodes = snapshot.reactive.topNodes.length > 0
    ? snapshot.reactive.topNodes.map((node) =>
      `<tr><td>${escapeHTML(node.label ?? `#${node.id}`)}</td><td>${escapeHTML(node.kind)}</td><td>${node.score}</td><td>${node.runs}</td><td>${node.invalidations}</td></tr>`
    ).join("")
    : `<tr><td colspan="5">No reactive activity captured</td></tr>`

  const recentEvents = snapshot.reactive.recentEvents.length > 0
    ? snapshot.reactive.recentEvents.map((event) =>
      `<tr><td>${event.seq}</td><td>${escapeHTML(event.kind)}</td><td>${escapeHTML(event.label ?? "-")}</td><td>${escapeHTML(event.reason ?? event.detail ?? "-")}</td></tr>`
    ).join("")
    : `<tr><td colspan="4">No reactive events captured</td></tr>`

  const routeRows = snapshot.routes?.entries.length
    ? snapshot.routes.entries.map((route) =>
      `<tr><td>${escapeHTML(route.path)}</td><td>${escapeHTML(route.methods.join(", ") || "GET")}</td><td>${route.isApi ? "API" : "Page"}</td><td>${route.hasLoader ? "Yes" : "-"}</td><td>${route.hasMiddleware ? "Yes" : "-"}</td></tr>`
    ).join("")
    : ""

  return `<div class="g-devtools">
  <style>
    .g-devtools{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:linear-gradient(180deg,#0f172a,#111827);color:#e5eefb;padding:24px;border-radius:18px}
    .g-devtools h1,.g-devtools h2{margin:0 0 12px}
    .g-devtools p{margin:0 0 12px;color:#b7c3d9}
    .g-devtools-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:12px 0 20px}
    .g-devtools-card{background:#172033;border:1px solid #30415f;border-radius:12px;padding:12px}
    .g-devtools-key{font-size:11px;text-transform:uppercase;color:#8ea3c7;margin-bottom:6px}
    .g-devtools-value{font-size:18px;font-weight:700}
    .g-devtools-table{width:100%;border-collapse:collapse;margin-top:12px}
    .g-devtools-table th,.g-devtools-table td{padding:10px;border-bottom:1px solid #24324d;text-align:left;vertical-align:top}
    .g-devtools-pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#1d4ed833;color:#93c5fd;font-size:12px}
    .g-devtools-section{margin-top:22px}
  </style>
  <h1>Gorsee Runtime Inspector</h1>
  <p>Path: ${escapeHTML(snapshot.summary.activeRoute || "/")} | Navigation: ${escapeHTML(snapshot.summary.navigationState)} | Hydration: ${escapeHTML(snapshot.summary.hydrationState)}</p>
  ${renderKeyValueGrid([
    { key: "Hydration mismatches", value: String(snapshot.hydration.mismatches) },
    { key: "Signals", value: String(snapshot.reactive.snapshot.signalsCreated) },
    { key: "Computeds", value: String(snapshot.reactive.snapshot.computedCreated) },
    { key: "Effects", value: String(snapshot.reactive.snapshot.effectCreated) },
    { key: "Resources", value: String(snapshot.reactive.snapshot.resourcesCreated) },
    { key: "Mutations", value: String(snapshot.reactive.snapshot.mutationsCreated) },
  ])}
  ${routeSummary}
  <div class="g-devtools-section">
    <h2>Top Reactive Nodes</h2>
    <table class="g-devtools-table">
      <thead><tr><th>Label</th><th>Kind</th><th>Score</th><th>Runs</th><th>Invalidations</th></tr></thead>
      <tbody>${topNodes}</tbody>
    </table>
  </div>
  <div class="g-devtools-section">
    <h2>Recent Reactive Events</h2>
    <table class="g-devtools-table">
      <thead><tr><th>#</th><th>Kind</th><th>Label</th><th>Reason</th></tr></thead>
      <tbody>${recentEvents}</tbody>
    </table>
  </div>
  ${routeRows ? `<div class="g-devtools-section">
    <h2>Route Tree</h2>
    <table class="g-devtools-table">
      <thead><tr><th>Path</th><th>Methods</th><th>Type</th><th>Loader</th><th>Middleware</th></tr></thead>
      <tbody>${routeRows}</tbody>
    </table>
  </div>` : ""}
</div>`
}

export function renderRuntimeDevtoolsOverlay(snapshot: RuntimeDevtoolsSnapshot, nonce = ""): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Gorsee Runtime Inspector</title>
</head>
<body>
  ${nonce ? `<script nonce="${escapeHTML(nonce)}"></script>` : ""}
  ${renderRuntimeDevtoolsHTML(snapshot)}
</body>
</html>`
}
