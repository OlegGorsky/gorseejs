export const REACTIVE_TRACE_SCHEMA_VERSION = 1

type ReactiveNodeKind = "signal" | "computed" | "effect" | "resource" | "mutation"
type ReactiveInvalidationReason = "write" | "resource.invalidate" | "resource.invalidateAll"

export interface ReactiveDiagnosticsSnapshot {
  signalsCreated: number
  signalReads: number
  signalWrites: number
  computedCreated: number
  computedReads: number
  computedRuns: number
  effectCreated: number
  effectRuns: number
  resourcesCreated: number
  resourceLoadsStarted: number
  resourceLoadsSucceeded: number
  resourceLoadsFailed: number
  resourceInvalidations: number
  resourceMutations: number
  mutationsCreated: number
  mutationRuns: number
  mutationSuccesses: number
  mutationFailures: number
  mutationRollbacks: number
  mutationResets: number
}

export interface ReactiveDiagnosticsConfig {
  enabled?: boolean
  captureEvents?: boolean
  maxEvents?: number
}

export interface ReactiveDiagnosticOptions {
  label?: string
}

export interface ReactiveGraphNode {
  id: number
  kind: ReactiveNodeKind
  label?: string
  reads: number
  writes: number
  runs: number
  invalidations: number
}

export interface ReactiveDependencyEdge {
  sourceNodeId: number
  targetNodeId: number
  sourceKind: ReactiveNodeKind
  targetKind: ReactiveNodeKind
  sourceLabel?: string
  targetLabel?: string
  reads: number
}

export interface ReactiveDiagnosticEvent {
  seq: number
  kind:
    | "signal:create"
    | "signal:read"
    | "signal:write"
    | "computed:create"
    | "computed:read"
    | "computed:run"
    | "effect:create"
    | "effect:run"
    | "resource:create"
    | "resource:load.start"
    | "resource:load.success"
    | "resource:load.error"
    | "resource:refetch"
    | "resource:mutate"
    | "resource:invalidate"
    | "mutation:create"
    | "mutation:start"
    | "mutation:success"
    | "mutation:error"
    | "mutation:settled"
    | "mutation:rollback"
    | "mutation:reset"
    | "invalidation"
  nodeId: number
  label?: string
  relatedNodeId?: number
  relatedLabel?: string
  reason?: ReactiveInvalidationReason
  causeNodeIds?: number[]
  causeLabels?: string[]
  cacheKey?: string
  detail?: string
}

export interface ReactiveTraceArtifact {
  schemaVersion: typeof REACTIVE_TRACE_SCHEMA_VERSION
  snapshot: ReactiveDiagnosticsSnapshot
  nodes: ReactiveGraphNode[]
  edges: ReactiveDependencyEdge[]
  events: ReactiveDiagnosticEvent[]
}

interface PendingInvalidationCause {
  sourceNodeId: number
  sourceLabel?: string
  reason: ReactiveInvalidationReason
}

interface ActiveComputation {
  nodeId: number
  kind: "computed" | "effect"
  label?: string
}

let diagnosticsEnabled = false
let captureEvents = false
let maxEvents = 200
let nextNodeId = 1
let nextEventSeq = 1

const snapshot: ReactiveDiagnosticsSnapshot = {
  signalsCreated: 0,
  signalReads: 0,
  signalWrites: 0,
  computedCreated: 0,
  computedReads: 0,
  computedRuns: 0,
  effectCreated: 0,
  effectRuns: 0,
  resourcesCreated: 0,
  resourceLoadsStarted: 0,
  resourceLoadsSucceeded: 0,
  resourceLoadsFailed: 0,
  resourceInvalidations: 0,
  resourceMutations: 0,
  mutationsCreated: 0,
  mutationRuns: 0,
  mutationSuccesses: 0,
  mutationFailures: 0,
  mutationRollbacks: 0,
  mutationResets: 0,
}

const nodes = new Map<number, ReactiveGraphNode>()
const edges = new Map<string, ReactiveDependencyEdge>()
const events: ReactiveDiagnosticEvent[] = []
const activeComputations: ActiveComputation[] = []
const pendingInvalidations = new Map<number, PendingInvalidationCause[]>()
const resourceNodeIdsByKey = new Map<string, Set<number>>()

export function configureReactiveDiagnostics(config: ReactiveDiagnosticsConfig = {}): void {
  diagnosticsEnabled = config.enabled === true
  captureEvents = config.captureEvents === true
  maxEvents = Math.max(1, config.maxEvents ?? 200)
}

export function resetReactiveDiagnostics(): void {
  snapshot.signalsCreated = 0
  snapshot.signalReads = 0
  snapshot.signalWrites = 0
  snapshot.computedCreated = 0
  snapshot.computedReads = 0
  snapshot.computedRuns = 0
  snapshot.effectCreated = 0
  snapshot.effectRuns = 0
  snapshot.resourcesCreated = 0
  snapshot.resourceLoadsStarted = 0
  snapshot.resourceLoadsSucceeded = 0
  snapshot.resourceLoadsFailed = 0
  snapshot.resourceInvalidations = 0
  snapshot.resourceMutations = 0
  snapshot.mutationsCreated = 0
  snapshot.mutationRuns = 0
  snapshot.mutationSuccesses = 0
  snapshot.mutationFailures = 0
  snapshot.mutationRollbacks = 0
  snapshot.mutationResets = 0
  nextNodeId = 1
  nextEventSeq = 1
  nodes.clear()
  edges.clear()
  events.length = 0
  activeComputations.length = 0
  pendingInvalidations.clear()
  resourceNodeIdsByKey.clear()
}

export function getReactiveDiagnosticsSnapshot(): ReactiveDiagnosticsSnapshot {
  return { ...snapshot }
}

export function getReactiveGraphNodes(): ReactiveGraphNode[] {
  return Array.from(nodes.values()).map((node) => ({ ...node }))
}

export function getReactiveDependencyEdges(): ReactiveDependencyEdge[] {
  return Array.from(edges.values()).map((edge) => ({ ...edge }))
}

export function getReactiveDiagnosticsEvents(): ReactiveDiagnosticEvent[] {
  return events.map((event) => ({
    ...event,
    causeNodeIds: event.causeNodeIds ? [...event.causeNodeIds] : undefined,
    causeLabels: event.causeLabels ? [...event.causeLabels] : undefined,
  }))
}

export function getReactiveTraceArtifact(): ReactiveTraceArtifact {
  return {
    schemaVersion: REACTIVE_TRACE_SCHEMA_VERSION,
    snapshot: getReactiveDiagnosticsSnapshot(),
    nodes: getReactiveGraphNodes(),
    edges: getReactiveDependencyEdges(),
    events: getReactiveDiagnosticsEvents(),
  }
}

export function trackSignalCreated(label?: string): number | null {
  if (!diagnosticsEnabled) return null
  snapshot.signalsCreated++
  const nodeId = registerNode("signal", label)
  pushEvent({ kind: "signal:create", nodeId, label })
  return nodeId
}

export function trackSignalRead(nodeId?: number | null, label?: string): void {
  if (!diagnosticsEnabled) return
  snapshot.signalReads++
  updateNode(nodeId, (node) => {
    node.reads++
  })
  if (nodeId != null) {
    registerDependency(nodeId, label)
    pushEvent({ kind: "signal:read", nodeId, label })
  }
}

export function trackSignalWrite(nodeId?: number | null, label?: string): void {
  if (!diagnosticsEnabled) return
  snapshot.signalWrites++
  updateNode(nodeId, (node) => {
    node.writes++
  })
  if (nodeId != null) {
    pushEvent({ kind: "signal:write", nodeId, label })
    propagateInvalidation(nodeId, label, "write")
  }
}

export function trackComputedCreated(label?: string): number | null {
  if (!diagnosticsEnabled) return null
  snapshot.computedCreated++
  const nodeId = registerNode("computed", label)
  pushEvent({ kind: "computed:create", nodeId, label })
  return nodeId
}

export function trackComputedRead(nodeId?: number | null, label?: string): void {
  if (!diagnosticsEnabled) return
  snapshot.computedReads++
  updateNode(nodeId, (node) => {
    node.reads++
  })
  if (nodeId != null) {
    registerDependency(nodeId, label)
    pushEvent({ kind: "computed:read", nodeId, label })
  }
}

export function trackEffectCreated(label?: string): number | null {
  if (!diagnosticsEnabled) return null
  snapshot.effectCreated++
  const nodeId = registerNode("effect", label)
  pushEvent({ kind: "effect:create", nodeId, label })
  return nodeId
}

export function trackResourceCreated(label?: string, cacheKey?: string): number | null {
  if (!diagnosticsEnabled) return null
  snapshot.resourcesCreated++
  const nodeId = registerNode("resource", label)
  if (cacheKey) {
    const existing = resourceNodeIdsByKey.get(cacheKey) ?? new Set<number>()
    existing.add(nodeId)
    resourceNodeIdsByKey.set(cacheKey, existing)
  }
  pushEvent({ kind: "resource:create", nodeId, label, cacheKey })
  return nodeId
}

export function trackResourceLoadStart(nodeId?: number | null, label?: string, cacheKey?: string, detail?: string): void {
  if (!diagnosticsEnabled || nodeId == null) return
  snapshot.resourceLoadsStarted++
  updateNode(nodeId, (node) => {
    node.runs++
  })
  pushEvent({ kind: "resource:load.start", nodeId, label, cacheKey, detail })
}

export function trackResourceLoadSuccess(nodeId?: number | null, label?: string, cacheKey?: string): void {
  if (!diagnosticsEnabled || nodeId == null) return
  snapshot.resourceLoadsSucceeded++
  pushEvent({ kind: "resource:load.success", nodeId, label, cacheKey })
}

export function trackResourceLoadError(nodeId?: number | null, label?: string, cacheKey?: string, detail?: string): void {
  if (!diagnosticsEnabled || nodeId == null) return
  snapshot.resourceLoadsFailed++
  pushEvent({ kind: "resource:load.error", nodeId, label, cacheKey, detail })
}

export function trackResourceRefetch(nodeId?: number | null, label?: string, cacheKey?: string): void {
  if (!diagnosticsEnabled || nodeId == null) return
  pushEvent({ kind: "resource:refetch", nodeId, label, cacheKey })
}

export function trackResourceMutate(nodeId?: number | null, label?: string, cacheKey?: string): void {
  if (!diagnosticsEnabled || nodeId == null) return
  snapshot.resourceMutations++
  updateNode(nodeId, (node) => {
    node.writes++
  })
  pushEvent({ kind: "resource:mutate", nodeId, label, cacheKey })
}

export function trackResourceInvalidation(cacheKey: string, reason: ReactiveInvalidationReason): void {
  if (!diagnosticsEnabled) return
  const nodeIds = resourceNodeIdsByKey.get(cacheKey)
  if (!nodeIds || nodeIds.size === 0) return
  for (const nodeId of nodeIds) {
    snapshot.resourceInvalidations++
    updateNode(nodeId, (node) => {
      node.invalidations++
    })
    const label = nodes.get(nodeId)?.label
    pushEvent({ kind: "resource:invalidate", nodeId, label, cacheKey, reason })
    propagateInvalidation(nodeId, label, reason)
  }
}

export function trackMutationCreated(label?: string): number | null {
  if (!diagnosticsEnabled) return null
  snapshot.mutationsCreated++
  const nodeId = registerNode("mutation", label)
  pushEvent({ kind: "mutation:create", nodeId, label })
  return nodeId
}

export function trackMutationStart(nodeId?: number | null, label?: string): void {
  if (!diagnosticsEnabled || nodeId == null) return
  snapshot.mutationRuns++
  updateNode(nodeId, (node) => {
    node.runs++
  })
  pushEvent({ kind: "mutation:start", nodeId, label })
}

export function trackMutationSuccess(nodeId?: number | null, label?: string): void {
  if (!diagnosticsEnabled || nodeId == null) return
  snapshot.mutationSuccesses++
  pushEvent({ kind: "mutation:success", nodeId, label })
}

export function trackMutationError(nodeId?: number | null, label?: string, detail?: string): void {
  if (!diagnosticsEnabled || nodeId == null) return
  snapshot.mutationFailures++
  pushEvent({ kind: "mutation:error", nodeId, label, detail })
}

export function trackMutationSettled(nodeId?: number | null, label?: string): void {
  if (!diagnosticsEnabled || nodeId == null) return
  pushEvent({ kind: "mutation:settled", nodeId, label })
}

export function trackMutationRollback(nodeId?: number | null, label?: string): void {
  if (!diagnosticsEnabled || nodeId == null) return
  snapshot.mutationRollbacks++
  pushEvent({ kind: "mutation:rollback", nodeId, label })
}

export function trackMutationReset(nodeId?: number | null, label?: string): void {
  if (!diagnosticsEnabled || nodeId == null) return
  snapshot.mutationResets++
  pushEvent({ kind: "mutation:reset", nodeId, label })
}

export function runTrackedComputation<T>(
  nodeId: number | null | undefined,
  kind: "computed" | "effect",
  label: string | undefined,
  fn: () => T,
): T {
  if (!diagnosticsEnabled || nodeId == null) return fn()

  const causes = consumeInvalidationCauses(nodeId)
  if (kind === "computed") snapshot.computedRuns++
  if (kind === "effect") snapshot.effectRuns++
  updateNode(nodeId, (node) => {
    node.runs++
  })
  pushEvent({
    kind: kind === "computed" ? "computed:run" : "effect:run",
    nodeId,
    label,
    causeNodeIds: causes.map((cause) => cause.sourceNodeId),
    causeLabels: causes.map((cause) => cause.sourceLabel).filter((value): value is string => Boolean(value)),
  })

  activeComputations.push({ nodeId, kind, label })
  try {
    return fn()
  } finally {
    activeComputations.pop()
  }
}

function registerNode(kind: ReactiveNodeKind, label?: string): number {
  const id = nextNodeId++
  nodes.set(id, {
    id,
    kind,
    label,
    reads: 0,
    writes: 0,
    runs: 0,
    invalidations: 0,
  })
  return id
}

function updateNode(nodeId: number | null | undefined, update: (node: ReactiveGraphNode) => void): void {
  if (nodeId == null) return
  const node = nodes.get(nodeId)
  if (!node) return
  update(node)
}

function registerDependency(sourceNodeId: number, sourceLabel?: string): void {
  const active = activeComputations[activeComputations.length - 1]
  if (!active) return
  if (active.nodeId === sourceNodeId) return

  const sourceNode = nodes.get(sourceNodeId)
  const targetNode = nodes.get(active.nodeId)
  if (!sourceNode || !targetNode) return

  const key = `${sourceNodeId}->${active.nodeId}`
  const existing = edges.get(key)
  if (existing) {
    existing.reads++
    return
  }

  edges.set(key, {
    sourceNodeId,
    targetNodeId: active.nodeId,
    sourceKind: sourceNode.kind,
    targetKind: targetNode.kind,
    sourceLabel: sourceNode.label ?? sourceLabel,
    targetLabel: targetNode.label ?? active.label,
    reads: 1,
  })
}

function propagateInvalidation(
  sourceNodeId: number,
  sourceLabel: string | undefined,
  reason: ReactiveInvalidationReason,
): void {
  for (const edge of edges.values()) {
    if (edge.sourceNodeId !== sourceNodeId) continue
    updateNode(edge.targetNodeId, (node) => {
      node.invalidations++
    })
    const pending = pendingInvalidations.get(edge.targetNodeId) ?? []
    if (!pending.some((cause) => cause.sourceNodeId === sourceNodeId && cause.reason === reason)) {
      pending.push({ sourceNodeId, sourceLabel, reason })
      pendingInvalidations.set(edge.targetNodeId, pending)
    }
    pushEvent({
      kind: "invalidation",
      nodeId: edge.targetNodeId,
      label: edge.targetLabel,
      relatedNodeId: sourceNodeId,
      relatedLabel: sourceLabel,
      reason,
      causeNodeIds: [sourceNodeId],
      causeLabels: sourceLabel ? [sourceLabel] : undefined,
    })
  }
}

function consumeInvalidationCauses(nodeId: number): PendingInvalidationCause[] {
  const causes = pendingInvalidations.get(nodeId) ?? []
  pendingInvalidations.delete(nodeId)
  return causes
}

function pushEvent(event: Omit<ReactiveDiagnosticEvent, "seq">): void {
  if (!captureEvents) return
  events.push({
    ...event,
    seq: nextEventSeq++,
  })
  if (events.length > maxEvents) {
    events.splice(0, events.length - maxEvents)
  }
}
