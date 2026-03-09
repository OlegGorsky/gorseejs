// <Link> component -- SPA navigation link with prefetch
// Server: renders <a> tag
// Client: renders <a> tag with router integration

import { navigate, prefetch } from "./router.ts"
import { resolveTypedRouteTarget, type TypedRouteDefinition, type TypedRouteOptions, type TypedRouteParams } from "./typed-routes.ts"
import type { GorseeRenderable } from "./renderable.ts"

export interface LinkProps {
  href: string | TypedRouteDefinition
  params?: TypedRouteParams
  search?: TypedRouteOptions["search"]
  hash?: string
  children?: unknown
  class?: string
  className?: string
  prefetch?: boolean | "hover" | "viewport"
  replace?: boolean
  target?: string
  [key: string]: unknown
}

function composeEventHandlers<TEvent>(
  first: ((event: TEvent) => void) | undefined,
  second: ((event: TEvent) => void) | undefined,
): ((event: TEvent) => void) | undefined {
  if (!first) return second
  if (!second) return first
  return (event: TEvent) => {
    first(event)
    second(event)
  }
}

// Client-side Link component
export function Link(props: LinkProps): GorseeRenderable {
  const { href, params, search, hash, prefetch: prefetchMode, replace, children, ...rest } = props
  const resolvedHref = resolveTypedRouteTarget(href, { params, search, hash })
  const restProps = { ...rest }
  const onClick = restProps["on:click"] as ((event: MouseEvent) => void) | undefined
  const onMouseOver = restProps["on:mouseover"] as ((event: MouseEvent) => void) | undefined
  const onFocus = restProps["on:focus"] as ((event: FocusEvent) => void) | undefined
  delete restProps["on:click"]
  delete restProps["on:mouseover"]
  delete restProps["on:focus"]
  delete restProps["data-g-prefetch"]

  // Eagerly prefetch if requested
  if (prefetchMode === true && typeof window !== "undefined") {
    prefetch(resolvedHref)
  }

  const hoverPrefetchHandler = prefetchMode === "hover"
    ? () => prefetch(resolvedHref)
    : undefined

  return {
    type: "a",
    props: {
      href: resolvedHref,
      ...restProps,
      ...(prefetchMode === "viewport" ? { "data-g-prefetch": "viewport" } : {}),
      "on:click": (e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        const target = (e.currentTarget as HTMLAnchorElement)?.target
        if (target && target !== "_self") return
        e.preventDefault()
        if (replace) {
          history.replaceState({ gorsee: true }, "", resolvedHref)
        }
        navigate(resolvedHref, !replace)
        onClick?.(e)
      },
      ...(prefetchMode === "hover"
        ? {
            "on:mouseover": composeEventHandlers(onMouseOver, hoverPrefetchHandler),
            "on:focus": composeEventHandlers(onFocus, hoverPrefetchHandler),
          }
        : {}),
      children,
    },
  }
}
