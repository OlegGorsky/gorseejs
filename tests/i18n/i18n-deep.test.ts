import { describe, test, expect, beforeEach } from "bun:test"
import { setupI18n, t, plural, setLocale, getLocale } from "../../src/i18n/index.ts"

describe("i18n deep", () => {
  beforeEach(() => {
    setupI18n({
      locales: {
        en: {
          hello: "Hello",
          greeting: "Hi, {{name}}!",
          nav: { home: "Home", about: "About", deep: "Deep value" },
          items: { one: "{{count}} item", other: "{{count}} items" },
          multi: "{{a}} and {{b}}",
        },
        ru: {
          hello: "Привет",
          greeting: "Привет, {{name}}!",
          nav: { home: "Главная" },
        },
        de: {
          hello: "Hallo",
          greeting: "Hallo, {{name}}!",
        },
      },
      defaultLocale: "en",
    })
  })

  test("t returns simple string value", () => {
    expect(t("hello")).toBe("Hello")
  })

  test("t returns key for missing translation", () => {
    expect(t("nonexistent")).toBe("nonexistent")
  })

  test("t returns key for deeply missing nested key", () => {
    expect(t("nav.nonexistent")).toBe("nav.nonexistent")
  })

  test("nested dot-notation access works", () => {
    expect(t("nav.home")).toBe("Home")
    expect(t("nav.about")).toBe("About")
  })

  test("deeply nested keys resolve correctly", () => {
    expect(t("nav.deep")).toBe("Deep value")
  })

  test("interpolation replaces {{param}}", () => {
    expect(t("greeting", { name: "Test" })).toBe("Hi, Test!")
  })

  test("interpolation with number value", () => {
    expect(t("greeting", { name: 42 as any })).toBe("Hi, 42!")
  })

  test("missing interpolation param keeps placeholder", () => {
    expect(t("greeting")).toBe("Hi, {{name}}!")
  })

  test("multiple interpolation params", () => {
    expect(t("multi", { a: "X", b: "Y" })).toBe("X and Y")
  })

  test("partial interpolation params keeps missing placeholder", () => {
    expect(t("multi", { a: "X" })).toBe("X and {{b}}")
  })

  test("setLocale switches active locale", () => {
    setLocale("ru")
    expect(t("hello")).toBe("Привет")
  })

  test("setLocale to third locale", () => {
    setLocale("de")
    expect(t("hello")).toBe("Hallo")
  })

  test("setLocale ignores unknown locale", () => {
    setLocale("fr")
    expect(getLocale()()).toBe("en")
  })

  test("getLocale returns current locale as signal", () => {
    expect(typeof getLocale()).toBe("function")
    expect(getLocale()()).toBe("en")
  })

  test("getLocale updates after setLocale", () => {
    setLocale("de")
    expect(getLocale()()).toBe("de")
  })

  test("plural with count=1 uses .one", () => {
    expect(plural("items", 1)).toBe("1 item")
  })

  test("plural with count!=1 uses .other", () => {
    expect(plural("items", 0)).toBe("0 items")
    expect(plural("items", 99)).toBe("99 items")
  })

  test("plural passes extra params", () => {
    // items.other is "{{count}} items" -- count is auto-injected
    expect(plural("items", 3, {})).toBe("3 items")
  })

  test("empty locales object still works (returns key)", () => {
    setupI18n({ locales: {}, defaultLocale: "en" })
    expect(t("anything")).toBe("anything")
  })

  test("setupI18n defaults to en locale", () => {
    setupI18n({ locales: { en: { ok: "OK" } } })
    expect(t("ok")).toBe("OK")
  })

  test("switching locale and back preserves translations", () => {
    setLocale("ru")
    expect(t("hello")).toBe("Привет")
    setLocale("en")
    expect(t("hello")).toBe("Hello")
  })

  test("t with empty key returns empty key string", () => {
    expect(t("")).toBe("")
  })

  test("accessing object as value returns key", () => {
    // nav is an object, not a string
    expect(t("nav")).toBe("nav")
  })
})
