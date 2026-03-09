import { resetServerHead, getServerHead } from "../runtime/head.ts"
import { renderToString, ssrJsx } from "../runtime/server.ts"
import type { Context } from "./middleware.ts"
import type { MatchResult } from "../router/matcher.ts"

type PageModule = Record<string, unknown>

export interface ResolvedPageRoute {
  component: Function
  pageComponent: Function
  loaderData: unknown
  cssFiles: string[]
  renderMode: string
}

export interface RenderedPage {
  html: string
  headElements: string[]
  title?: string
}

export interface PartialResponsePayload {
  html: string
  data?: unknown
  params?: Record<string, string>
  title?: string
  css?: string[]
  script?: string
}

function resolvePageDataHook(mod: PageModule): ((ctx: Context) => unknown) | undefined {
  if (typeof mod.load === "function") return mod.load as (ctx: Context) => unknown
  if (typeof mod.loader === "function") return mod.loader as (ctx: Context) => unknown
  return undefined
}

export async function resolvePageRoute(
  mod: PageModule,
  match: MatchResult,
  ctx: Context,
): Promise<ResolvedPageRoute | null> {
  const component = mod.default as Function | undefined
  if (typeof component !== "function") return null

  const layoutPaths = match.route.layoutPaths ?? []
  const layoutImportPromises = layoutPaths.map((layoutPath) => import(layoutPath))
  const pageLoaderPromise = resolvePageDataHook(mod)?.(ctx)

  const [layoutMods, loaderData] = await Promise.all([
    Promise.all(layoutImportPromises),
    pageLoaderPromise,
  ])

  const layoutLoaderPromises = layoutMods.map((layoutMod) =>
    resolvePageDataHook(layoutMod)?.(ctx),
  )
  const layoutLoaderResults = await Promise.all(layoutLoaderPromises)

  const cssFiles: string[] = []
  if (typeof mod.css === "string") cssFiles.push(mod.css)
  if (Array.isArray(mod.css)) cssFiles.push(...(mod.css as string[]))

  let pageComponent: Function = component
  for (let i = layoutMods.length - 1; i >= 0; i--) {
      const Layout = layoutMods[i]!.default
      if (typeof Layout === "function") {
        const inner = pageComponent
        const layoutData = layoutLoaderResults[i]
        pageComponent = (props: Record<string, unknown>) =>
        Layout({ ...props, data: layoutData, children: () => inner(props) })
      }
    }

  return {
    component,
    pageComponent,
    loaderData,
    cssFiles,
    renderMode: (mod.render as string) ?? "async",
  }
}

export function createClientScriptPath(entryFile?: string): string | undefined {
  return entryFile ? `/_gorsee/${entryFile}` : undefined
}

export function renderPageDocument(
  pageComponent: Function,
  ctx: Context,
  params: Record<string, string>,
  loaderData: unknown,
): RenderedPage {
  resetServerHead()
  const pageProps = { params, ctx, data: loaderData }
  const vnode = ssrJsx(pageComponent as any, pageProps)
  const html = renderToString(vnode)
  const headElements = getServerHead()

  return {
    html,
    headElements,
    title: extractTitle(headElements),
  }
}

export function buildPartialResponsePayload(
  rendered: RenderedPage,
  loaderData: unknown,
  params: Record<string, string>,
  cssFiles: string[],
  clientScript?: string,
): PartialResponsePayload {
  return {
    html: rendered.html,
    data: loaderData,
    params: Object.keys(params).length > 0 ? params : undefined,
    title: rendered.title,
    css: cssFiles.length > 0 ? cssFiles : undefined,
    script: clientScript,
  }
}

export function extractTitle(headElements: string[]): string | undefined {
  for (const element of headElements) {
    const titleMatch = element.match(/<title>(.+?)<\/title>/)
    if (titleMatch) return titleMatch[1]
  }
  return undefined
}
