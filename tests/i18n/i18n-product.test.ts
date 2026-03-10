import { beforeEach, describe, expect, test } from "bun:test"
import { createRuntimeFixture } from "../../src/testing/index.ts"
import { createTypedRoute } from "../../src/runtime/typed-routes.ts"
import { getCurrentPath } from "../../src/runtime/router.ts"
import { Link } from "../../src/runtime/link.ts"
import {
  buildHreflangLinks,
  formatDate,
  formatNumber,
  formatRelativeTime,
  getDefaultLocale,
  getLocales,
  getFallbackLocales,
  getLocale,
  loadLocale,
  negotiateLocale,
  plural,
  resolveLocaleFromPath,
  setLocale,
  setupI18n,
  stripLocalePrefix,
  t,
  withLocalePath,
} from "../../src/i18n/index.ts"

describe("i18n product contract", () => {
  beforeEach(() => {
    setupI18n({
      locales: {
        en: {
          hello: "Hello",
          checkout: { title: "Checkout" },
          items: { one: "{{count}} item", other: "{{count}} items" },
        },
        ru: {
          hello: "Привет",
          items: { one: "{{count}} товар", few: "{{count}} товара", many: "{{count}} товаров", other: "{{count}} товара" },
        },
      },
      defaultLocale: "en",
      fallbackLocales: {
        ru: ["en"],
      },
      loaders: {
        de: async () => ({ hello: "Hallo" }),
      },
    })
  })

  test("falls back to configured locale chain", () => {
    setLocale("ru")
    expect(t("checkout.title")).toBe("Checkout")
    expect(getFallbackLocales("ru")).toEqual(["en"])
  })

  test("loads lazy locales on demand", async () => {
    await loadLocale("de")
    setLocale("de")
    expect(t("hello")).toBe("Hallo")
  })

  test("negotiates locale from path, cookie, accept-language and default", () => {
    expect(negotiateLocale({
      pathname: "/ru/docs",
      supportedLocales: ["en", "ru"],
      defaultLocale: "en",
    })).toEqual({ locale: "ru", source: "path" })

    expect(negotiateLocale({
      cookieLocale: "ru",
      supportedLocales: ["en", "ru"],
      defaultLocale: "en",
    })).toEqual({ locale: "ru", source: "cookie" })

    expect(negotiateLocale({
      acceptLanguage: "de-DE,de;q=0.9,ru;q=0.8",
      supportedLocales: ["en", "ru"],
      defaultLocale: "en",
    })).toEqual({ locale: "ru", source: "accept-language" })
  })

  test("builds locale-aware route paths and hreflang links", () => {
    expect(resolveLocaleFromPath("/ru/blog/post", ["en", "ru"])).toBe("ru")
    expect(stripLocalePrefix("/ru/blog/post", ["en", "ru"])).toBe("/blog/post")
    expect(withLocalePath("/blog/post", "ru", { defaultLocale: "en" })).toBe("/ru/blog/post")
    expect(buildHreflangLinks("/blog/post", ["en", "ru"], { origin: "https://example.com" })).toEqual([
      { locale: "en", href: "https://example.com/blog/post" },
      { locale: "ru", href: "https://example.com/ru/blog/post" },
    ])
  })

  test("formats numbers, dates and relative time through Intl", () => {
    setLocale("ru")
    expect(formatNumber(12345.6)).toContain("12")
    expect(formatDate(new Date("2026-03-09T00:00:00Z"), { year: "numeric" })).toContain("2026")
    expect(formatRelativeTime(-1, "day")).toContain("1")
  })

  test("plural uses locale-aware categories", () => {
    setLocale("ru")
    expect(plural("items", 1)).toBe("1 товар")
    expect(plural("items", 2)).toBe("2 товара")
    expect(plural("items", 5)).toBe("5 товаров")
    expect(getLocale()()).toBe("ru")
  })

  test("withLocalePath respects route strategies", () => {
    setupI18n({
      locales: { en: { ok: "OK" }, ru: { ok: "OK" } },
      defaultLocale: "en",
      routeStrategy: "prefix-always",
    })

    expect(withLocalePath("/", "en")).toBe("/en")
    expect(withLocalePath("/docs", "ru")).toBe("/ru/docs")
    expect(withLocalePath("/docs", "ru", { strategy: "none" })).toBe("/docs")
  })

  test("resolve and strip locale helpers ignore unknown prefixes", () => {
    expect(resolveLocaleFromPath("/fr/docs", ["en", "ru"])).toBeNull()
    expect(stripLocalePrefix("/fr/docs", ["en", "ru"])).toBe("/fr/docs")
  })

  test("accept-language negotiation honors q ordering and region fallback", () => {
    expect(negotiateLocale({
      acceptLanguage: "fr-CA;q=0.3,ru-RU;q=0.9,en-US;q=0.8",
      supportedLocales: ["en", "ru"],
      defaultLocale: "en",
    })).toEqual({ locale: "ru", source: "accept-language" })
  })

  test("default negotiation path wins when cookie and headers are unsupported", () => {
    expect(negotiateLocale({
      cookieLocale: "de",
      acceptLanguage: "fr-CA,fr;q=0.8",
      supportedLocales: ["en", "ru"],
      defaultLocale: "en",
    })).toEqual({ locale: "en", source: "default" })
  })

  test("loadLocale is a no-op for unknown loaders and getLocales reflects loaded dictionaries", async () => {
    expect(getDefaultLocale()).toBe("en")
    expect(getLocales()).toEqual(["en", "ru"])

    await loadLocale("fr")
    expect(getLocales()).toEqual(["en", "ru"])

    await loadLocale("de")
    expect(getLocales()).toEqual(["en", "ru", "de"])
  })

  test("buildHreflangLinks strips an existing locale prefix before rebuilding links", () => {
    expect(buildHreflangLinks("/ru/blog/post", ["en", "ru"], { origin: "https://example.com" })).toEqual([
      { locale: "en", href: "https://example.com/blog/post" },
      { locale: "ru", href: "https://example.com/ru/blog/post" },
    ])
  })

  test("buildHreflangLinks respects routeStrategy none without duplicating locale prefixes", () => {
    setupI18n({
      locales: { en: { ok: "OK" }, ru: { ok: "OK" } },
      defaultLocale: "en",
      routeStrategy: "none",
    })

    expect(buildHreflangLinks("/ru/blog/post", ["en", "ru"], {
      origin: "https://example.com",
      strategy: "none",
    })).toEqual([
      { locale: "en", href: "https://example.com/blog/post" },
      { locale: "ru", href: "https://example.com/blog/post" },
    ])
  })

  test("typed routes compose with localized paths for default and non-default locales", () => {
    const articleRoute = createTypedRoute("/blog/[slug]")
    const canonical = articleRoute.buildStrict({
      params: { slug: "launch-notes" },
      search: { tab: "overview" },
      hash: "top",
    })

    expect(withLocalePath(canonical, "en")).toBe("/blog/launch-notes?tab=overview#top")
    expect(withLocalePath(canonical, "ru")).toBe("/ru/blog/launch-notes?tab=overview#top")
  })

  test("hreflang rebuilding stays canonical for localized typed route outputs with query and hash", () => {
    const articleRoute = createTypedRoute("/docs/[slug]")
    const localized = withLocalePath(articleRoute.build({
      params: { slug: "guide" },
      search: { section: "api" },
      hash: "usage",
    }), "ru")

    expect(localized).toBe("/ru/docs/guide?section=api#usage")
    expect(buildHreflangLinks(localized, ["en", "ru"], {
      origin: "https://example.com",
    })).toEqual([
      { locale: "en", href: "https://example.com/docs/guide?section=api#usage" },
      { locale: "ru", href: "https://example.com/ru/docs/guide?section=api#usage" },
    ])
  })

  test("localized typed route navigation keeps router state canonical with query and hash", async () => {
    const fixture = createRuntimeFixture()
    const articleRoute = createTypedRoute("/docs/[slug]")
    const localized = withLocalePath(articleRoute.build({
      params: { slug: "guide" },
      search: { section: "api" },
      hash: "usage",
    }), "ru")

    fixture.setFetch(((url: string | URL | Request) => {
      expect(String(url)).toBe("/ru/docs/guide?section=api#usage")
      return Promise.resolve(new Response(JSON.stringify({
        html: "<main>localized docs</main>",
        data: { locale: "ru" },
        params: { slug: "guide" },
        title: "Localized Guide",
      })))
    }) as typeof fetch)

    try {
      await fixture.navigate(localized)

      expect(fixture.historyWrites).toEqual(["/ru/docs/guide?section=api#usage"])
      expect(fixture.htmlWrites).toEqual(["<main>localized docs</main>"])
      expect(getCurrentPath()).toBe("/ru/docs/guide?section=api#usage")
    } finally {
      fixture.cleanup()
    }
  })

  test("Link preserves localized typed route hrefs for router-managed navigation", () => {
    const articleRoute = createTypedRoute("/blog/[slug]")
    const localized = withLocalePath(articleRoute.build({
      params: { slug: "launch-notes" },
      search: { tab: "overview" },
      hash: "top",
    }), "ru")

    const node = Link({
      href: localized,
      children: "Localized Article",
    })

    expect(node).toEqual({
      type: "a",
      props: expect.objectContaining({
        href: "/ru/blog/launch-notes?tab=overview#top",
        children: "Localized Article",
      }),
    })
  })

  test("lazy-loaded locale switching keeps hreflang and path helpers canonical", async () => {
    await loadLocale("de")
    setLocale("de")

    expect(withLocalePath("/pricing", "de")).toBe("/de/pricing")
    expect(buildHreflangLinks("/de/pricing", ["en", "ru", "de"], {
      origin: "https://example.com",
    })).toEqual([
      { locale: "en", href: "https://example.com/pricing" },
      { locale: "ru", href: "https://example.com/ru/pricing" },
      { locale: "de", href: "https://example.com/de/pricing" },
    ])
  })
})
