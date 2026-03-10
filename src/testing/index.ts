// Testing utilities for Gorsee.js applications

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { handleAction, type ActionFn, type ActionResult } from "../server/action.ts"
import {
  assertDeployArtifactConformance,
  validateDeployArtifactConformance,
  type DeployArtifactConformanceInput,
  type DeployArtifactConformanceResult,
} from "../deploy/conformance.ts"
import { createContext, type Context, type MiddlewareFn, runMiddlewareChain } from "../server/middleware.ts"
import { createPluginRunner, type GorseePlugin, type PluginCapability, type PluginDescriptor, type PluginPhase } from "../plugins/index.ts"
import type { Component } from "../runtime/jsx-runtime.ts"
import { renderToString, ssrJsx } from "../runtime/server.ts"
import { navigate } from "../runtime/router.ts"

function toRuntimeComponent(component: Function): Component {
  return component as unknown as Component
}

/** Create a mock request for testing */
export function createTestRequest(
  path: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: string | Record<string, unknown>
  } = {},
): Request {
  const { method = "GET", headers = {}, body } = options
  const url = `http://localhost${path}`
  const init: RequestInit = { method, headers }
  if (body) {
    if (typeof body === "object") {
      init.body = JSON.stringify(body)
      ;(init.headers as Record<string, string>)["Content-Type"] = "application/json"
    } else {
      init.body = body
    }
  }
  return new Request(url, init)
}

/** Create a test context for middleware/loader testing */
export function createTestContext(
  path: string,
  options: {
    method?: string
    headers?: Record<string, string>
    params?: Record<string, string>
    body?: string | Record<string, unknown>
  } = {},
): Context {
  const { params = {}, ...reqOpts } = options
  const request = createTestRequest(path, reqOpts)
  return createContext(request, params)
}

/** Run a middleware function with a test context and handler */
export async function runTestMiddleware(
  middleware: MiddlewareFn,
  ctx: Context,
  handler?: () => Promise<Response>,
): Promise<Response> {
  const defaultHandler = async () => new Response("OK")
  return runMiddlewareChain([middleware], ctx, handler ?? defaultHandler)
}

/** Render a component to HTML string for snapshot/assertion testing */
export function renderComponent(
  component: Function,
  props: Record<string, unknown> = {},
): string {
  const vnode = ssrJsx(toRuntimeComponent(component), props)
  return renderToString(vnode)
}

/** Test a loader function directly */
export async function testLoader<T>(
  loader: (ctx: Context) => Promise<T>,
  path: string,
  options: {
    params?: Record<string, string>
    headers?: Record<string, string>
  } = {},
): Promise<T> {
  const ctx = createTestContext(path, options)
  return loader(ctx)
}

/** Test an action function through the same wrapper used by the runtime. */
export async function testAction<T>(
  action: ActionFn<T>,
  path: string,
  options: {
    method?: string
    headers?: Record<string, string>
    params?: Record<string, string>
    body?: string | Record<string, unknown>
  } = {},
): Promise<ActionResult<T>> {
  const ctx = createTestContext(path, {
    method: options.method ?? "POST",
    headers: options.headers,
    params: options.params,
    body: options.body,
  })
  return handleAction(action, ctx)
}

/** Test a route handler directly with a framework context. */
export async function testRouteHandler(
  handler: (ctx: Context) => Response | Promise<Response>,
  path: string,
  options: {
    method?: string
    headers?: Record<string, string>
    params?: Record<string, string>
    body?: string | Record<string, unknown>
  } = {},
): Promise<Response> {
  const ctx = createTestContext(path, options)
  return handler(ctx)
}

/** Validate generated deploy artifacts against explicit contract tokens. */
export function testDeployArtifactConformance(
  input: DeployArtifactConformanceInput,
): DeployArtifactConformanceResult {
  return validateDeployArtifactConformance(input)
}

/** Assert generated deploy artifacts satisfy explicit contract tokens. */
export function assertTestDeployArtifactConformance(
  input: DeployArtifactConformanceInput,
): void {
  assertDeployArtifactConformance(input)
}

export interface FixtureFile {
  path: string
  content: string
}

export interface FixtureAppHarness {
  rootDir: string
  write(): Promise<void>
  read(path: string): Promise<string>
  listFiles(): Promise<string[]>
  cleanup(): Promise<void>
}

export interface WorkspaceFixturePackage {
  path: string
  files: FixtureFile[]
}

export interface WorkspaceFixtureHarness extends FixtureAppHarness {}

export async function createFixtureAppHarness(files: FixtureFile[], rootDir?: string): Promise<FixtureAppHarness> {
  const fixtureRoot = rootDir ?? await mkdtemp(join(tmpdir(), "gorsee-fixture-app-"))

  return {
    rootDir: fixtureRoot,
    async write() {
      for (const file of files) {
        const absolutePath = join(fixtureRoot, file.path)
        await mkdir(join(absolutePath, ".."), { recursive: true })
        await writeFile(absolutePath, file.content, "utf-8")
      }
    },
    read(path: string) {
      return readFile(join(fixtureRoot, path), "utf-8")
    },
    async listFiles() {
      return listRelativeFiles(fixtureRoot)
    },
    cleanup() {
      return rm(fixtureRoot, { recursive: true, force: true })
    },
  }
}

export async function createWorkspaceFixtureHarness(
  packages: WorkspaceFixturePackage[],
  rootFiles: FixtureFile[] = [],
  rootDir?: string,
): Promise<WorkspaceFixtureHarness> {
  const fixtureRoot = rootDir ?? await mkdtemp(join(tmpdir(), "gorsee-fixture-workspace-"))
  const workspaceFiles = [
    ...rootFiles,
    ...packages.flatMap((pkg) => pkg.files.map((file) => ({
      path: join(pkg.path, file.path),
      content: file.content,
    }))),
  ]
  return createFixtureAppHarness(workspaceFiles, fixtureRoot)
}

export interface PluginConformanceExpectation {
  middlewareCount?: number
  routePaths?: string[]
  buildPluginNames?: string[]
  capabilities?: PluginCapability[]
  pluginOrder?: string[]
}

export interface PluginConformanceResult {
  middlewareCount: number
  routePaths: string[]
  buildPluginNames: string[]
  capabilities: PluginCapability[]
  pluginOrder: string[]
  descriptors: PluginDescriptor[]
}

export interface PluginConformanceHarness {
  register(plugin: GorseePlugin): void
  setupAll(): Promise<void>
  runPhase(phase: PluginPhase): Promise<void>
  teardownAll(): Promise<void>
  getResult(): PluginConformanceResult
  testRoute(path: string, requestPath?: string): Promise<Response>
}

export function createPluginConformanceHarness(
  config: Record<string, unknown> = {},
): PluginConformanceHarness {
  const runner = createPluginRunner(config)

  return {
    register(plugin: GorseePlugin) {
      runner.register(plugin)
    },
    setupAll() {
      return runner.setupAll()
    },
    runPhase(phase: PluginPhase) {
      return runner.runPhase(phase)
    },
    teardownAll() {
      return runner.teardownAll()
    },
    getResult() {
      const descriptors = runner.getPluginDescriptors()
      return {
        middlewareCount: runner.getMiddlewares().length,
        routePaths: [...runner.getRoutes().keys()].sort(),
        buildPluginNames: runner.getBuildPlugins().map((plugin) => plugin.name).sort(),
        capabilities: runner.getCapabilities(),
        pluginOrder: descriptors.map((descriptor) => descriptor.name),
        descriptors,
      }
    },
    async testRoute(path: string, requestPath = path) {
      const route = runner.getRoutes().get(path)
      if (!route) throw new Error(`plugin conformance route not found: ${path}`)
      return route(createTestContext(requestPath))
    },
  }
}

export async function validatePluginConformance(
  plugin: GorseePlugin,
  expectation: PluginConformanceExpectation = {},
  config: Record<string, unknown> = {},
): Promise<PluginConformanceResult> {
  const harness = createPluginConformanceHarness(config)
  harness.register(plugin)
  await harness.setupAll()
  try {
    const result = harness.getResult()
    if (expectation.middlewareCount !== undefined && result.middlewareCount !== expectation.middlewareCount) {
      throw new Error(`plugin conformance middleware mismatch: expected ${expectation.middlewareCount}, received ${result.middlewareCount}`)
    }
    if (expectation.routePaths) {
      const expected = [...expectation.routePaths].sort()
      if (JSON.stringify(result.routePaths) !== JSON.stringify(expected)) {
        throw new Error(`plugin conformance routes mismatch: expected ${expected.join(", ")}, received ${result.routePaths.join(", ")}`)
      }
    }
    if (expectation.buildPluginNames) {
      const expected = [...expectation.buildPluginNames].sort()
      if (JSON.stringify(result.buildPluginNames) !== JSON.stringify(expected)) {
        throw new Error(`plugin conformance build plugins mismatch: expected ${expected.join(", ")}, received ${result.buildPluginNames.join(", ")}`)
      }
    }
    if (expectation.capabilities) {
      const expected = [...expectation.capabilities].sort()
      if (JSON.stringify(result.capabilities) !== JSON.stringify(expected)) {
        throw new Error(`plugin conformance capabilities mismatch: expected ${expected.join(", ")}, received ${result.capabilities.join(", ")}`)
      }
    }
    if (expectation.pluginOrder) {
      const expected = [...expectation.pluginOrder]
      if (JSON.stringify(result.pluginOrder) !== JSON.stringify(expected)) {
        throw new Error(`plugin conformance order mismatch: expected ${expected.join(", ")}, received ${result.pluginOrder.join(", ")}`)
      }
    }
    return result
  } finally {
    await harness.teardownAll()
  }
}

export interface RuntimeFixture {
  htmlWrites: string[]
  historyWrites: string[]
  removedCssCount: () => number
  setFetch(handler: typeof fetch): void
  navigate(url: string, pushState?: boolean): Promise<void>
  cleanup(): void
}

/** Install a lightweight browser-like fixture for router/runtime tests. */
export function createRuntimeFixture(): RuntimeFixture {
  const originalDocument = globalThis.document
  const originalWindow = globalThis.window
  const originalHistory = globalThis.history
  const originalLocation = globalThis.location
  const originalFetch = globalThis.fetch

  const htmlWrites: string[] = []
  const historyWrites: string[] = []
  let removedCss = 0

  const dataScript = {
    textContent: "",
    remove() {
      this.textContent = ""
    },
  }

  const container = {
    replaceChildren(...nodes: Array<{ html?: string }>) {
      htmlWrites.push(nodes.map((node) => node.html ?? "").join(""))
    },
    contains() {
      return false
    },
    querySelector() {
      return null
    },
    querySelectorAll() {
      return []
    },
  }

  ;(globalThis as Record<string, unknown>).document = {
    title: "",
    activeElement: null,
    head: { appendChild() {} },
    body: { appendChild() {} },
    createElement(tag: string) {
      if (tag === "template") {
        return {
          content: { childNodes: [] as Array<{ html: string }> },
          set innerHTML(html: string) {
            this.content.childNodes = [{ html }]
          },
        }
      }
      return {
        dataset: {} as Record<string, string>,
        setAttribute() {},
      }
    },
    getElementById(id: string) {
      if (id === "app") return container
      if (id === "__GORSEE_DATA__") return dataScript
      return null
    },
    querySelectorAll() {
      return [{
        remove() {
          removedCss++
        },
      }]
    },
  }

  ;(globalThis as Record<string, unknown>).window = {
    scrollTo() {},
  }
  ;(globalThis as Record<string, unknown>).history = {
    pushState(_state: unknown, _title: string, url: string) {
      historyWrites.push(url)
    },
  }
  ;(globalThis as Record<string, unknown>).location = {
    pathname: "/",
    search: "",
    origin: "http://localhost",
  }

  return {
    htmlWrites,
    historyWrites,
    removedCssCount: () => removedCss,
    setFetch(handler: typeof fetch) {
      globalThis.fetch = handler
    },
    navigate(url: string, pushState = true) {
      return navigate(url, pushState)
    },
    cleanup() {
      ;(globalThis as Record<string, unknown>).document = originalDocument
      ;(globalThis as Record<string, unknown>).window = originalWindow
      ;(globalThis as Record<string, unknown>).history = originalHistory
      ;(globalThis as Record<string, unknown>).location = originalLocation
      globalThis.fetch = originalFetch
    },
  }
}

async function listRelativeFiles(rootDir: string, baseDir = rootDir): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const absolutePath = join(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listRelativeFiles(absolutePath, baseDir))
      continue
    }
    files.push(absolutePath.slice(baseDir.length + 1))
  }
  return files.sort()
}
