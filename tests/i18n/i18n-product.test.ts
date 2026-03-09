import { beforeEach, describe, expect, test } from "bun:test"
import {
  buildHreflangLinks,
  formatDate,
  formatNumber,
  formatRelativeTime,
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
})
