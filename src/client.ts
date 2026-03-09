// Explicit browser-safe public entrypoint.
// Use this in route components and client-facing modules.

export {
  createSignal,
  createComputed,
  createEffect,
  createResource,
  createDataQuery,
  createDataMutation,
  createStore,
  createLive,
  invalidateResource,
  invalidateAll,
  createMutation,
} from "./reactive/index.ts"

export { Suspense } from "./runtime/suspense.ts"
export { Link } from "./runtime/link.ts"
export { Head } from "./runtime/head.ts"
export { navigate, onNavigate, beforeNavigate, getCurrentPath } from "./runtime/router.ts"
export {
  RUNTIME_DEVTOOLS_SCHEMA_VERSION,
  createRuntimeDevtoolsSnapshot,
  renderRuntimeDevtoolsHTML,
  renderRuntimeDevtoolsOverlay,
  type RuntimeDevtoolsOptions,
  type RuntimeDevtoolsRouteEntry,
  type RuntimeDevtoolsRouteSummary,
  type RuntimeDevtoolsSnapshot,
  type RuntimeDevtoolsSummary,
  type RuntimeDevtoolsTopNode,
} from "./runtime/devtools.ts"
export { useFormAction, type FormActionResult, type FormState, type FormSubmitOptions } from "./runtime/form.ts"
export {
  Image,
  getImageProps,
  buildImageSrcSet,
  getImageCandidateWidths,
  isAllowedRemoteImage,
  defaultImageLoader,
  type ImageProps,
  type ImageLoader,
  type ImageLoaderParams,
  type ImageRuntimeConfig,
  type ImageRemotePattern,
  type ImageFormat,
} from "./runtime/image.ts"
export { ErrorBoundary } from "./runtime/error-boundary.ts"
export { island } from "./runtime/island.ts"
export { createEventSource, type EventSourceSignal } from "./runtime/event-source.ts"
/** @deprecated Import from "gorsee/routes" when route contracts are the primary concern. */
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
  type TypedRouteTarget,
} from "./runtime/typed-routes.ts"
/** @deprecated Import from "gorsee/forms" when form contracts are the primary concern. */
export {
  defineForm,
  validateForm,
  validateAction,
  toFieldErrors,
  fieldAttrs,
  type FormField,
  type FormSchema,
  type ValidationResult,
  type ActionValidationResult,
  type ValidationError,
} from "./runtime/validated-form.ts"
export {
  setupI18n,
  loadLocale,
  getLocale,
  getLocales,
  getDefaultLocale,
  getFallbackLocales,
  setLocale,
  t,
  plural,
  negotiateLocale,
  resolveLocaleFromPath,
  stripLocalePrefix,
  withLocalePath,
  buildHreflangLinks,
  formatNumber,
  formatDate,
  formatRelativeTime,
  type I18nConfig,
  type LocaleNegotiationInput,
  type LocaleNegotiationResult,
} from "./i18n/index.ts"
