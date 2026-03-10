// Client-side SPA router
// Intercepts link clicks, fetches partial pages from server, swaps content
// Uses History API for back/forward navigation

import { hydrate } from "./client.ts"

interface NavigationResult {
  html: string
  data?: unknown
  params?: Record<string, string>
  title?: string
  css?: string[]
  script?: string
}

type NavigateCallback = (url: string) => void
type BeforeNavigateCallback = (url: string) => boolean | void
type PreservedControlState = { key: string; mode: "value" | "checked"; value: string | boolean }
type HMRUpdate = {
  kind: "full-reload" | "route-refresh" | "css-update"
  changedPath: string
  timestamp: number
  reason?: string
  routePaths?: string[]
  entryScripts?: string[]
  refreshCurrentRoute?: boolean
}

export interface RouterNavigationDiagnostics {
  currentPath: string
  navigating: boolean
  pendingPopScrollY: number | null
  latestNavigationToken: number
  activeNavigation: {
    url: string
    pushState: boolean
  } | null
}

export interface NavigationSnapshot {
  focusKey?: string
  controls: PreservedControlState[]
}

let currentPath = ""
const subscribers: NavigateCallback[] = []
const beforeNavigateHooks: BeforeNavigateCallback[] = []
let navigating = false
let loadingElement: HTMLElement | null = null
let activeNavigationController: AbortController | null = null
let latestNavigationToken = 0
let pendingPopScrollY: number | null = null
let activeNavigationUrl: string | null = null
let activeNavigationPushState = true
let lastFocusedPreserveKey: string | null = null
let currentRouteScript: string | null = null
let initializedDocument: Document | null = null
let initializedWindow: Window | null = null

export function createHTMLFragment(html: string): DocumentFragment {
  const template = document.createElement("template")
  template.innerHTML = html
  return template.content
}

export function replaceHTMLFragment(container: Element, html: string): void {
  const fragment = createHTMLFragment(html)
  container.replaceChildren(...Array.from(fragment.childNodes))
}

function getPreserveKey(element: Element | null): string | null {
  if (!element) return null
  const preserveKey = element.getAttribute("data-g-preserve-key")
  if (preserveKey) return preserveKey
  if ("name" in element && typeof element.name === "string" && element.name) return element.name
  if ("id" in element && typeof element.id === "string" && element.id) return element.id
  return null
}

function isCheckableInput(element: Element): element is HTMLInputElement {
  return "type" in element && (element as HTMLInputElement).type === "checkbox"
}

function isFormControlElement(element: Element | null): boolean {
  if (!element) return false
  const tagName = element.tagName?.toLowerCase()
  return tagName === "input" || tagName === "textarea" || tagName === "select"
}

function getFocusablePreserveKey(element: Element | null): string | null {
  if (!element) return null
  if (element.getAttribute("data-g-preserve-key")) {
    return getPreserveKey(element)
  }
  if (isFormControlElement(element)) {
    return getPreserveKey(element)
  }
  return null
}

function getControlSelector(key: string): string {
  return `[data-g-preserve-key="${key}"], [name="${key}"], #${key}`
}

function focusPreservedTarget(target: Element): void {
  const focusable = target as Element & {
    focus?: () => void
    isConnected?: boolean
  }
  const runFocus = () => {
    if (focusable.isConnected === false) return false
    if (typeof focusable.focus === "function") {
      focusable.focus?.()
    } else if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) {
      HTMLElement.prototype.focus.call(target)
    }
    if (typeof document === "undefined" || !("activeElement" in document)) return false
    return document.activeElement === target
  }

  if (runFocus()) return
  const retryDelays = [0, 16, 48, 96, 160]
  for (const delayMs of retryDelays) {
    setTimeout(() => {
      if (typeof document !== "undefined" && "activeElement" in document && document.activeElement === target) return
      runFocus()
    }, delayMs)
  }
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      if (typeof document !== "undefined" && "activeElement" in document && document.activeElement === target) return
      runFocus()
    })
  }
}

function schedulePostNavigationFocusRestore(container: Element, snapshot: NavigationSnapshot): void {
  const focusKey = snapshot.focusKey ?? snapshot.controls[0]?.key
  if (!focusKey) return
  const selector = getControlSelector(focusKey)
  const commit = () => {
    const target = container.querySelector(selector)
    if (!target) return
    focusPreservedTarget(target)
    lastFocusedPreserveKey = focusKey
  }
  commit()
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => commit())
  }
  setTimeout(() => commit(), 32)
}

export function captureNavigationSnapshot(container: Element): NavigationSnapshot {
  const controls: PreservedControlState[] = []
  const canContainActiveElement = typeof container.contains === "function"
  const activeFocusKey = canContainActiveElement && container.contains(document.activeElement)
    ? getFocusablePreserveKey(document.activeElement as Element | null) ?? undefined
    : undefined
  const formControls = typeof container.querySelectorAll === "function"
    ? container.querySelectorAll("input, textarea, select")
    : []

  for (const control of formControls) {
    const key = getPreserveKey(control)
    if (!key) continue
    if (isCheckableInput(control)) {
      controls.push({ key, mode: "checked", value: control.checked })
      continue
    }
    if ("value" in control && typeof control.value === "string") {
      controls.push({ key, mode: "value", value: control.value })
    }
  }

  const focusKey = activeFocusKey ?? lastFocusedPreserveKey ?? controls[0]?.key
  return { focusKey, controls }
}

export function restoreNavigationSnapshot(container: Element, snapshot: NavigationSnapshot): void {
  for (const controlState of snapshot.controls) {
    const control = container.querySelector(getControlSelector(controlState.key))
    if (!control) continue
    if (controlState.mode === "checked" && "checked" in control) {
      ;(control as HTMLInputElement).checked = controlState.value === true
      continue
    }
    if (controlState.mode === "value" && "value" in control && typeof controlState.value === "string") {
      ;(control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value = controlState.value
    }
  }

  const focusKey = snapshot.focusKey ?? snapshot.controls[0]?.key
  if (focusKey) {
    const focusTarget = container.querySelector(getControlSelector(focusKey))
    if (focusTarget) {
      focusPreservedTarget(focusTarget)
      lastFocusedPreserveKey = focusKey
    }
  }
}

function readCurrentScrollY(): number {
  if (typeof window === "undefined") return 0
  if (typeof window.scrollY === "number") return window.scrollY
  const windowWithPageOffset = window as Window & { pageYOffset?: number }
  if (typeof windowWithPageOffset.pageYOffset === "number") return windowWithPageOffset.pageYOffset
  return 0
}

function rememberCurrentHistoryScroll(url: string): void {
  if (typeof history === "undefined" || typeof history.replaceState !== "function") return
  const currentState = typeof history.state === "object" && history.state !== null
    ? history.state as Record<string, unknown>
    : {}
  history.replaceState({
    ...currentState,
    gorsee: true,
    gorseeScrollY: readCurrentScrollY(),
  }, "", url)
}

function applyNavigationScroll(pushState: boolean): void {
  if (pushState) {
    window.scrollTo(0, 0)
    return
  }
  if (pendingPopScrollY !== null) {
    window.scrollTo(0, pendingPopScrollY)
    pendingPopScrollY = null
  }
}

/** Set a loading indicator element to show during navigation */
export function setLoadingElement(el: HTMLElement): void {
  loadingElement = el
}

function showLoading(): void {
  if (loadingElement) {
    loadingElement.style.display = ""
    loadingElement.removeAttribute("hidden")
  }
}

function hideLoading(): void {
  if (loadingElement) {
    loadingElement.style.display = "none"
  }
}

export function onNavigate(fn: NavigateCallback): () => void {
  subscribers.push(fn)
  return () => {
    const i = subscribers.indexOf(fn)
    if (i >= 0) subscribers.splice(i, 1)
  }
}

export function beforeNavigate(fn: BeforeNavigateCallback): () => void {
  beforeNavigateHooks.push(fn)
  return () => {
    const i = beforeNavigateHooks.indexOf(fn)
    if (i >= 0) beforeNavigateHooks.splice(i, 1)
  }
}

export function getCurrentPath(): string {
  return currentPath
}

export function getRouterNavigationDiagnostics(): RouterNavigationDiagnostics {
  return {
    currentPath,
    navigating,
    pendingPopScrollY,
    latestNavigationToken,
    activeNavigation: activeNavigationController && activeNavigationUrl
      ? { url: activeNavigationUrl, pushState: activeNavigationPushState }
      : null,
  }
}

async function fetchPage(url: string, signal?: AbortSignal): Promise<NavigationResult> {
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "X-Gorsee-Navigate": "partial",
    },
    signal,
  })
  if (!res.ok) throw new Error(`Navigation failed: ${res.status}`)
  return res.json()
}

function updateHead(result: NavigationResult): void {
  if (result.title) document.title = result.title

  // Remove old route CSS
  document.querySelectorAll("link[data-g-route-css]").forEach((el) => el.remove())

  // Add new route CSS
  if (result.css) {
    for (const href of result.css) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = href
      link.dataset.gRouteCss = ""
      document.head.appendChild(link)
    }
  }
}

function updateDataScript(result: NavigationResult): void {
  // Update __GORSEE_DATA__
  let dataEl = document.getElementById("__GORSEE_DATA__")
  if (result.data !== undefined) {
    if (!dataEl) {
      const script = document.createElement("script")
      script.id = "__GORSEE_DATA__"
      script.type = "application/json"
      document.body.appendChild(script)
      dataEl = script
    }
    dataEl.textContent = JSON.stringify(result.data)
  } else if (dataEl) {
    dataEl.remove()
  }

  // Update __GORSEE_PARAMS__
  if (result.params) {
    (globalThis as unknown as Record<string, unknown>).__GORSEE_PARAMS__ = result.params
  }
}

function normalizeRouteScript(script: string | null | undefined): string | null {
  if (!script) return null
  try {
    return new URL(script, location.origin).pathname
  } catch {
    return script
  }
}

export function setCurrentRouteScript(script: string | null | undefined): void {
  currentRouteScript = normalizeRouteScript(script)
  ;(globalThis as Record<string, unknown>).__GORSEE_ROUTE_SCRIPT__ = currentRouteScript
}

async function navigateInternal(url: string, pushState: boolean, force = false): Promise<void> {
  if (!force && url === currentPath) return

  // Before-navigate hooks (can cancel)
  for (const hook of beforeNavigateHooks) {
    try {
      if (hook(url) === false) return
    } catch {
      return
    }
  }

  const container = document.getElementById("app")
  const snapshot = container ? captureNavigationSnapshot(container) : { controls: [] as PreservedControlState[] }

  if (pushState) {
    rememberCurrentHistoryScroll(currentPath || (location.pathname + location.search))
  }

  activeNavigationController?.abort()
  const controller = new AbortController()
  activeNavigationController = controller
  activeNavigationUrl = url
  activeNavigationPushState = pushState
  const navigationToken = ++latestNavigationToken
  navigating = true
  showLoading()
  try {
    const result = await fetchPage(url, controller.signal)
    if (controller.signal.aborted || navigationToken !== latestNavigationToken) return
    if (!container) return

    // Update DOM
    replaceHTMLFragment(container, result.html)
    updateHead(result)
    updateDataScript(result)
    if (result.script) {
      setCurrentRouteScript(result.script)
    }
    restoreNavigationSnapshot(container, snapshot)

    // Update history
    if (pushState) {
      history.pushState({ gorsee: true }, "", url)
    }
    currentPath = url

    // Hydrate new content
    if (result.script) {
      ;(globalThis as Record<string, unknown>).__GORSEE_SUPPRESS_ENTRY_BOOTSTRAP__ = true
      let mod: { default?: unknown }
      try {
        mod = await import(/* @vite-ignore */ result.script)
      } finally {
        ;(globalThis as Record<string, unknown>).__GORSEE_SUPPRESS_ENTRY_BOOTSTRAP__ = false
      }
      if (controller.signal.aborted || navigationToken !== latestNavigationToken) return
      const renderRoute = mod.default
      if (renderRoute && typeof renderRoute === "function") {
        const data = result.data ?? {}
        const params = result.params ?? {}
        hydrate(() => renderRoute({ data, params }), container)
        restoreNavigationSnapshot(container, snapshot)
      }
    }

    applyNavigationScroll(pushState)

    // Notify subscribers
    for (const fn of subscribers) fn(url)
    observeViewportPrefetchAnchors(container)
    schedulePostNavigationFocusRestore(container, snapshot)
  } catch (error) {
    if (controller.signal.aborted) return
    throw error
  } finally {
    if (activeNavigationController === controller) {
      activeNavigationController = null
      activeNavigationUrl = null
      activeNavigationPushState = true
      hideLoading()
      navigating = false
    }
  }
}

export async function navigate(url: string, pushState = true): Promise<void> {
  await navigateInternal(url, pushState, false)
}

export async function refreshCurrentRoute(): Promise<void> {
  const target = currentPath || readLocationPath()
  if (!target) return
  await navigateInternal(target, false, true)
}

function refreshStylesheets(timestamp: number): void {
  const links = document.querySelectorAll?.('link[rel="stylesheet"]') ?? []
  for (const link of links) {
    if (!("href" in link) || typeof link.href !== "string") continue
    try {
      const nextURL = new URL(link.href, location.origin)
      if (nextURL.origin !== location.origin) continue
      nextURL.searchParams.set("gorsee-hmr", String(timestamp))
      link.href = nextURL.toString()
    } catch {}
  }
}

function currentPathMatchesRoute(routePath: string): boolean {
  const pathname = readLocationPath().split("?")[0] ?? readLocationPath()
  return pathname === routePath
}

function hmrTouchesCurrentRoute(update: HMRUpdate): boolean {
  if (update.refreshCurrentRoute) return true
  if (update.entryScripts?.length && currentRouteScript) {
    return update.entryScripts.some((script) => normalizeRouteScript(script) === currentRouteScript)
  }
  if (update.routePaths?.length) {
    return update.routePaths.some((routePath) => currentPathMatchesRoute(routePath))
  }
  return false
}

export async function applyHMRUpdate(update: HMRUpdate): Promise<void> {
  if (!update || typeof update.kind !== "string") {
    location.reload()
    return
  }

  if (update.kind === "full-reload") {
    location.reload()
    return
  }

  if (update.kind === "css-update") {
    refreshStylesheets(update.timestamp)
  }

  if (!hmrTouchesCurrentRoute(update)) return
  await refreshCurrentRoute()
}

// Prefetch cache
const prefetchCache = new Set<string>()
const observedViewportPrefetchAnchors = new WeakSet<Element>()
let viewportPrefetchObserver: IntersectionObserver | null = null

function normalizePrefetchURL(url: string): string {
  const [withoutHash] = url.split("#", 1)
  return withoutHash || url
}

export function prefetch(url: string): void {
  const normalizedURL = normalizePrefetchURL(url)
  if (prefetchCache.has(normalizedURL)) return
  prefetchCache.add(normalizedURL)
  // Use low-priority fetch
  const link = document.createElement("link")
  link.rel = "prefetch"
  link.href = normalizedURL
  link.setAttribute("as", "fetch")
  link.setAttribute("crossorigin", "")
  document.head.appendChild(link)
}

function ensureViewportPrefetchObserver(): IntersectionObserver | null {
  if (viewportPrefetchObserver) return viewportPrefetchObserver
  if (typeof IntersectionObserver === "undefined") return null
  viewportPrefetchObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      const target = entry.target as HTMLAnchorElement
      prefetch(target.pathname + target.search)
      viewportPrefetchObserver?.unobserve(target)
    }
  }, {
    rootMargin: "200px",
  })
  return viewportPrefetchObserver
}

function observeViewportPrefetchAnchors(root: ParentNode | Element | Document = document): void {
  const observer = ensureViewportPrefetchObserver()
  if (!observer || typeof root.querySelectorAll !== "function") return
  const anchors = root.querySelectorAll('a[data-g-prefetch="viewport"][href]')
  for (const anchor of anchors) {
    if (!anchor || typeof anchor !== "object" || observedViewportPrefetchAnchors.has(anchor as Element)) continue
    observedViewportPrefetchAnchors.add(anchor as Element)
    observer.observe(anchor as Element)
  }
}

function shouldHandleClick(e: MouseEvent, anchor: HTMLAnchorElement): boolean {
  // Don't handle modified clicks (new tab, etc.)
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false
  if (e.button !== 0) return false

  // Don't handle links with target
  if (anchor.target && anchor.target !== "_self") return false

  // Only handle same-origin
  if (anchor.origin !== location.origin) return false

  // Don't handle downloads
  if (anchor.hasAttribute("download")) return false

  // Don't handle hash-only links
  if (anchor.pathname === location.pathname && anchor.search === location.search && anchor.hash) return false

  return true
}

function readLocationPath(): string {
  return `${location.pathname}${location.search}`
}

export function initRouter(): void {
  currentPath = readLocationPath()
  setCurrentRouteScript((globalThis as Record<string, unknown>).__GORSEE_ROUTE_SCRIPT__ as string | null | undefined)
  ;(globalThis as Record<string, unknown>).__gorseeHandleHMR = (update: HMRUpdate) => {
    void applyHMRUpdate(update)
  }
  if (typeof history.replaceState === "function") {
    const currentState = typeof history.state === "object" && history.state !== null
      ? history.state as Record<string, unknown>
      : {}
    history.replaceState({
      ...currentState,
      gorsee: true,
      gorseeScrollY: readCurrentScrollY(),
    }, "", readLocationPath())
  }

  if (initializedDocument !== document) {
    initializedDocument = document

    // Intercept link clicks
    document.addEventListener("click", (e) => {
      const anchor = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.dataset.gNoRouter !== undefined) return

      if (shouldHandleClick(e, anchor)) {
        e.preventDefault()
        navigate(anchor.pathname + anchor.search)
      }
    })

    document.addEventListener("focusin", (e) => {
      const target = e.target as Element | null
      const container = document.getElementById("app")
      if (!target || !container || !container.contains(target)) return
      const key = getFocusablePreserveKey(target)
      if (key) lastFocusedPreserveKey = key
    })
  }

  if (initializedWindow !== window) {
    initializedWindow = window

    // Handle back/forward
    window.addEventListener("popstate", (e) => {
      const nextPath = readLocationPath()
      if (e.state?.gorsee || currentPath !== nextPath) {
        pendingPopScrollY = typeof e.state?.gorseeScrollY === "number" ? e.state.gorseeScrollY : 0
        navigate(nextPath, false)
      }
    })
  }
  observeViewportPrefetchAnchors(document)
}
