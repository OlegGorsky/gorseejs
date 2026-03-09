// Stable routes-focused public surface.
// Prefer this subpath when route contracts and typed navigation are the primary concern.

export {
  typedLink,
  typedNavigate,
  typedPrefetch,
  resolveTypedRouteTarget,
  buildSearchParams,
  buildTypedPath,
  createTypedRoute,
  extractRouteParamKeys,
  type TypedRouteDefinition,
  type TypedRouteOptions,
  type TypedRouteParams,
  type TypedRouteSearchValue,
  type TypedRouteTarget,
} from "../runtime/typed-routes.ts"
