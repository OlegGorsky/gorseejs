import { renderToString, ssrJsx } from "../runtime/server.ts"
import { renderToStream, streamJsx } from "../runtime/stream.ts"
import { getServerHead, resetServerHead } from "../runtime/head.ts"
import type { MatchResult } from "../router/matcher.ts"
import type { Context } from "./middleware.ts"
import { type HTMLWrapOptions } from "./html-shell.ts"
import {
  buildPartialResponsePayload,
  renderPageDocument,
  type ResolvedPageRoute,
} from "./page-render.ts"
import { partialNavigationHeaders } from "./partial-navigation.ts"

interface RouteResponseOptions {
  match: MatchResult
  ctx: Context
  resolved: ResolvedPageRoute
  clientScript?: string
  nonce?: string
  secHeaders?: Record<string, string>
  wrapHTML?: (body: string, nonce: string | undefined, options?: HTMLWrapOptions) => string
}

export async function renderRoutePageResponse(
  options: RouteResponseOptions,
): Promise<Response> {
  const { match, ctx, resolved, clientScript, nonce, secHeaders = {}, wrapHTML } = options
  const { pageComponent, loaderData, cssFiles, renderMode } = resolved
  const pageProps = { params: match.params, ctx, data: loaderData }
  const htmlOptions = {
    clientScript,
    loaderData,
    params: match.params,
    cssFiles,
  } satisfies HTMLWrapOptions

  if (renderMode === "stream") {
    if (!wrapHTML) throw new Error("wrapHTML is required for streaming page responses")
    resetServerHead()
    const vnode = streamJsx(pageComponent as any, pageProps)
    const stream = renderToStream(vnode, {
      shell: (body: string) => wrapHTML(body, nonce, {
        ...htmlOptions,
        headElements: getServerHead(),
      }),
    })
    return new Response(stream, {
      headers: { "Content-Type": "text/html", ...secHeaders },
    })
  }

  const rendered = renderPageDocument(pageComponent, ctx, match.params, loaderData)
  if (!wrapHTML) {
    return new Response(rendered.html, {
      headers: { "Content-Type": "text/html", ...secHeaders },
    })
  }

  const html = wrapHTML(rendered.html, nonce, {
    ...htmlOptions,
    headElements: rendered.headElements,
  })
  return new Response(html, {
    headers: { "Content-Type": "text/html", ...secHeaders },
  })
}

export function renderRoutePartialResponse(
  options: RouteResponseOptions,
): Response {
  const { match, ctx, resolved, clientScript, secHeaders = {} } = options
  const { pageComponent, loaderData, cssFiles } = resolved
  const rendered = renderPageDocument(pageComponent, ctx, match.params, loaderData)
  const payload = buildPartialResponsePayload(
    rendered,
    loaderData,
    match.params,
    cssFiles,
    clientScript,
  )

  return new Response(JSON.stringify(payload), {
    headers: partialNavigationHeaders(secHeaders),
  })
}

export async function renderRouteErrorBoundaryResponse(
  errorPath: string,
  error: Error,
  options: {
    match: MatchResult
    nonce?: string
    secHeaders?: Record<string, string>
    wrapHTML: (body: string, nonce: string | undefined, options?: HTMLWrapOptions) => string
  },
): Promise<Response> {
  const { match, nonce, secHeaders = {}, wrapHTML } = options
  const errorMod = await import(errorPath)
  const ErrorComponent = errorMod.default
  if (typeof ErrorComponent !== "function") throw error

  const vnode = ssrJsx(ErrorComponent as any, { error, params: match.params })
  const body = renderToString(vnode)
  const html = wrapHTML(body, nonce, { title: "Error" })

  return new Response(html, {
    status: 500,
    headers: { "Content-Type": "text/html", ...secHeaders },
  })
}
