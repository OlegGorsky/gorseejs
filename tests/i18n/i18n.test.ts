import { describe, test, expect, beforeEach } from "bun:test"
import { setupI18n, t, plural, setLocale, getLocale } from "../../src/i18n/index.ts"

describe("i18n", () => {
  beforeEach(() => {
    setupI18n({
      locales: {
        en: {
          greeting: "Hello, {{name}}!",
          nav: { home: "Home", about: "About" },
          items: { one: "{{count}} item", other: "{{count}} items" },
        },
        ru: {
          greeting: "Привет, {{name}}!",
          nav: { home: "Главная", about: "О нас" },
          items: { one: "{{count}} элемент", other: "{{count}} элементов" },
        },
      },
      defaultLocale: "en",
    })
  })

  test("translates simple key", () => {
    expect(t("greeting", { name: "World" })).toBe("Hello, World!")
  })

  test("translates nested key", () => {
    expect(t("nav.home")).toBe("Home")
    expect(t("nav.about")).toBe("About")
  })

  test("returns key if not found", () => {
    expect(t("missing.key")).toBe("missing.key")
  })

  test("switches locale", () => {
    setLocale("ru")
    expect(t("greeting", { name: "Мир" })).toBe("Привет, Мир!")
    expect(t("nav.home")).toBe("Главная")
  })

  test("getLocale returns reactive signal", () => {
    expect(getLocale()()).toBe("en")
    setLocale("ru")
    expect(getLocale()()).toBe("ru")
  })

  test("plural helper", () => {
    expect(plural("items", 1)).toBe("1 item")
    expect(plural("items", 5)).toBe("5 items")
  })

  test("plural with locale switch", () => {
    setLocale("ru")
    expect(plural("items", 1)).toBe("1 элемент")
    expect(plural("items", 5)).toBe("5 элементов")
  })

  test("setLocale warns on invalid locale", () => {
    const orig = console.warn
    let warned = false
    console.warn = () => { warned = true }
    setLocale("fr")
    console.warn = orig
    expect(warned).toBe(true)
    expect(getLocale()()).toBe("en") // unchanged
  })
})
