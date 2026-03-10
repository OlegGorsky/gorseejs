import { createSignal, type SignalGetter } from "../reactive/signal.ts"

interface TranslationBranch {
  [key: string]: TranslationLeaf
}

type TranslationLeaf = string | TranslationBranch
type LocaleDictionary = Record<string, TranslationLeaf>
type DictionaryLoader = () => Promise<LocaleDictionary>

export interface I18nConfig {
  locales: Record<string, LocaleDictionary>
  defaultLocale?: string
  fallbackLocales?: Record<string, string[]>
  detectLocale?: boolean
  loaders?: Record<string, DictionaryLoader>
  routeStrategy?: "prefix-except-default" | "prefix-always" | "none"
}

export interface LocaleNegotiationInput {
  pathname?: string
  acceptLanguage?: string | null
  cookieLocale?: string | null
  supportedLocales?: string[]
  defaultLocale?: string
}

export interface LocaleNegotiationResult {
  locale: string
  source: "path" | "cookie" | "accept-language" | "default"
}

export interface IntlFormatOptions {
  locale?: string
}

let dictionaries: Record<string, LocaleDictionary> = {}
let loaders: Record<string, DictionaryLoader> = {}
let defaultLocale = "en"
let fallbackLocales: Record<string, string[]> = {}
let routeStrategy: I18nConfig["routeStrategy"] = "prefix-except-default"

const [currentLocale, setCurrentLocaleSignal] = createSignal(defaultLocale)

function uniqueLocales(locales: Array<string | undefined | null>): string[] {
  return [...new Set(locales.filter((locale): locale is string => typeof locale === "string" && locale.length > 0))]
}

function getNestedValue(dict: LocaleDictionary | undefined, key: string): unknown {
  if (!dict) return undefined
  if (!key) return ""
  const parts = key.split(".")
  let value: unknown = dict
  for (const part of parts) {
    if (typeof value !== "object" || value === null) return undefined
    value = (value as Record<string, unknown>)[part]
  }
  return value
}

function interpolate(value: string, params?: Record<string, string | number>): string {
  if (!params) return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    return params[name] !== undefined ? String(params[name]) : `{{${name}}}`
  })
}

function resolveLocaleCandidates(locale: string): string[] {
  const explicitFallbacks = fallbackLocales[locale] ?? []
  return uniqueLocales([locale, ...explicitFallbacks, defaultLocale])
}

function detectBrowserLocale(): string | null {
  if (typeof navigator === "undefined" || !navigator.language) return null
  return navigator.language.split("-")[0] ?? null
}

function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return []
  return header
    .split(",")
    .map((entry) => {
      const [tag, qValue] = entry.trim().split(";q=")
      return {
        locale: tag?.trim().toLowerCase(),
        weight: qValue ? Number(qValue) : 1,
      }
    })
    .filter((entry): entry is { locale: string; weight: number } => typeof entry.locale === "string" && entry.locale.length > 0)
    .sort((left, right) => right.weight - left.weight)
    .flatMap((entry) => uniqueLocales([entry.locale, entry.locale.split("-")[0]]))
}

export function setupI18n(config: I18nConfig): void {
  dictionaries = config.locales
  loaders = config.loaders ?? {}
  defaultLocale = config.defaultLocale ?? "en"
  fallbackLocales = config.fallbackLocales ?? {}
  routeStrategy = config.routeStrategy ?? "prefix-except-default"

  const initialLocale = config.detectLocale
    ? negotiateLocale({
      acceptLanguage: detectBrowserLocale(),
      supportedLocales: Object.keys(dictionaries),
      defaultLocale,
    }).locale
    : defaultLocale

  setCurrentLocaleSignal(initialLocale)
}

export async function loadLocale(locale: string): Promise<void> {
  if (dictionaries[locale] || !loaders[locale]) return
  dictionaries[locale] = await loaders[locale]!()
}

export function getLocale(): SignalGetter<string> {
  return currentLocale
}

export function getLocales(): string[] {
  return Object.keys(dictionaries)
}

export function getDefaultLocale(): string {
  return defaultLocale
}

export function getFallbackLocales(locale: string): string[] {
  return [...(fallbackLocales[locale] ?? [])]
}

export function setLocale(locale: string): void {
  if (!dictionaries[locale] && !loaders[locale]) {
    console.warn(`[gorsee/i18n] Locale "${locale}" not found, available: ${Object.keys(dictionaries).join(", ")}`)
    return
  }
  setCurrentLocaleSignal(locale)
}

export function resolveLocaleFromPath(pathname: string, supportedLocales = Object.keys(dictionaries)): string | null {
  const [, firstSegment] = pathname.split("/")
  if (!firstSegment) return null
  return supportedLocales.includes(firstSegment) ? firstSegment : null
}

export function stripLocalePrefix(pathname: string, supportedLocales = Object.keys(dictionaries)): string {
  const locale = resolveLocaleFromPath(pathname, supportedLocales)
  if (!locale) return pathname || "/"
  const stripped = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), "")
  return stripped || "/"
}

export function withLocalePath(
  pathname: string,
  locale: string,
  options: { defaultLocale?: string; strategy?: I18nConfig["routeStrategy"] } = {},
): string {
  const resolvedDefault = options.defaultLocale ?? defaultLocale
  const strategy = options.strategy ?? routeStrategy
  const supportedLocales = Object.keys(dictionaries)
  const normalized = stripLocalePrefix(pathname.startsWith("/") ? pathname : `/${pathname}`, supportedLocales)

  if (strategy === "none") return normalized
  if (strategy === "prefix-except-default" && locale === resolvedDefault) return normalized
  if (normalized === "/") return `/${locale}`
  return `/${locale}${normalized}`
}

export function negotiateLocale(input: LocaleNegotiationInput): LocaleNegotiationResult {
  const supportedLocales = input.supportedLocales ?? Object.keys(dictionaries)
  const resolvedDefault = input.defaultLocale ?? defaultLocale
  const pathLocale = input.pathname ? resolveLocaleFromPath(input.pathname, supportedLocales) : null
  if (pathLocale) return { locale: pathLocale, source: "path" }

  if (input.cookieLocale && supportedLocales.includes(input.cookieLocale)) {
    return { locale: input.cookieLocale, source: "cookie" }
  }

  for (const locale of parseAcceptLanguage(input.acceptLanguage)) {
    if (supportedLocales.includes(locale)) {
      return { locale, source: "accept-language" }
    }
  }

  return { locale: resolvedDefault, source: "default" }
}

export function t(
  key: string,
  params?: Record<string, string | number>,
  options: { locale?: string } = {},
): string {
  const locale = options.locale ?? currentLocale()
  for (const candidate of resolveLocaleCandidates(locale)) {
    const value = getNestedValue(dictionaries[candidate], key)
    if (typeof value === "string") {
      return interpolate(value, params)
    }
  }
  return key
}

export function plural(
  key: string,
  count: number,
  params?: Record<string, string | number>,
  options: { locale?: string } = {},
): string {
  const locale = options.locale ?? currentLocale()
  const pluralRule = new Intl.PluralRules(locale)
  const category = pluralRule.select(count)
  const resolved = t(`${key}.${category}`, { count, ...params }, { locale })
  if (resolved !== `${key}.${category}`) return resolved
  return t(`${key}.other`, { count, ...params }, { locale })
}

export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}, intl: IntlFormatOptions = {}): string {
  return new Intl.NumberFormat(intl.locale ?? currentLocale(), options).format(value)
}

export function formatDate(value: number | Date, options: Intl.DateTimeFormatOptions = {}, intl: IntlFormatOptions = {}): string {
  return new Intl.DateTimeFormat(intl.locale ?? currentLocale(), options).format(value)
}

export function formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit, options: Intl.RelativeTimeFormatOptions = {}, intl: IntlFormatOptions = {}): string {
  return new Intl.RelativeTimeFormat(intl.locale ?? currentLocale(), options).format(value, unit)
}

export function buildHreflangLinks(
  pathname: string,
  locales = Object.keys(dictionaries),
  options: { defaultLocale?: string; strategy?: I18nConfig["routeStrategy"]; origin?: string } = {},
): Array<{ locale: string; href: string }> {
  return locales.map((locale) => {
    const localized = withLocalePath(stripLocalePrefix(pathname, locales), locale, options)
    const href = options.origin ? `${options.origin.replace(/\/$/, "")}${localized}` : localized
    return { locale, href }
  })
}
