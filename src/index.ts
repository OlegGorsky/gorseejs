// Gorsee.js -- compatibility entry point.
// Prefer "gorsee/client" for browser-safe APIs, "gorsee/server" for server-only APIs,
// or "gorsee/compat" when you need an explicit legacy migration path.

/** @deprecated Import from "gorsee/client" instead. */
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

/** @deprecated Import from "gorsee/client" instead. */
export { Suspense } from "./runtime/suspense.ts"
/** @deprecated Import from "gorsee/client" instead. */
export { Link } from "./runtime/link.ts"
/** @deprecated Import from "gorsee/client" instead. */
export { Head } from "./runtime/head.ts"
/** @deprecated Import from "gorsee/client" instead. */
export { navigate, onNavigate, beforeNavigate, getCurrentPath } from "./runtime/router.ts"
/** @deprecated Import from "gorsee/client" instead. */
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
/** @deprecated Import from "gorsee/client" instead. */
export { useFormAction, type FormActionResult, type FormState, type FormSubmitOptions } from "./runtime/form.ts"
/** @deprecated Import from "gorsee/client" instead. */
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
/** @deprecated Import from "gorsee/client" instead. */
export { ErrorBoundary } from "./runtime/error-boundary.ts"
/** @deprecated Import from "gorsee/client" instead. */
export { island } from "./runtime/island.ts"
/** @deprecated Import from "gorsee/client" instead. */
export { createEventSource } from "./runtime/event-source.ts"
/** @deprecated Import from "gorsee/server" instead. */
export { createAuth } from "./auth/index.ts"
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
/** @deprecated Import from "gorsee/client" instead. */
export {
  typedLink,
  typedNavigate,
  typedPrefetch,
  buildSearchParams,
  buildTypedPath,
  createTypedRoute,
  extractRouteParamKeys,
} from "./runtime/typed-routes.ts"
/** @deprecated Import from "gorsee/client" instead. */
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
  loadContentCollection,
  parseFrontmatter,
  extractExcerpt,
  queryContent,
  getContentEntryBySlug,
  type ContentCollectionOptions,
  type ContentEntry,
  type ContentQueryOptions,
} from "./content/index.ts"
/** @deprecated Import from "gorsee/server" instead. */
export { definePlugin, createPluginRunner, type GorseePlugin, type PluginContext } from "./plugins/index.ts"
