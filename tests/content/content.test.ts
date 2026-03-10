import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildHreflangLinks, setupI18n, withLocalePath } from "../../src/i18n/index.ts"
import {
  extractExcerpt,
  getContentEntryBySlug,
  loadContentCollection,
  parseFrontmatter,
  queryContent,
} from "../../src/content/index.ts"

const TMP = join(process.cwd(), ".tmp-content-collection")

afterEach(async () => {
  await rm(TMP, { recursive: true, force: true })
})

describe("content collections", () => {
  test("parses frontmatter and excerpt", () => {
    const parsed = parseFrontmatter(`---\ntitle: Hello\ntags: [news, launch]\npublished: true\n---\n# Heading\nBody text`)
    expect(parsed.frontmatter).toEqual({
      title: "Hello",
      tags: ["news", "launch"],
      published: true,
    })
    expect(extractExcerpt(parsed.body)).toContain("Heading Body text")
  })

  test("parses nested objects, markdown lists, and block scalars", () => {
    const parsed = parseFrontmatter([
      "---",
      "title: Launch",
      "summary: >",
      "  First line",
      "  second line",
      "",
      "body: |",
      "  Alpha",
      "  Beta",
      "seo:",
      "  title: Launch SEO",
      "  noindex: false",
      "authors:",
      "  - alice",
      "  - bob",
      "related:",
      "  - slug: intro",
      "    title: Intro",
      "  - slug: deep-dive",
      "    title: Deep Dive",
      "---",
      "Body",
    ].join("\n"))

    expect(parsed.frontmatter).toEqual({
      title: "Launch",
      summary: "First line second line",
      body: "Alpha\nBeta",
      seo: {
        title: "Launch SEO",
        noindex: false,
      },
      authors: ["alice", "bob"],
      related: [
        { slug: "intro", title: "Intro" },
        { slug: "deep-dive", title: "Deep Dive" },
      ],
    })
  })

  test("loads locale-aware content collections and validates frontmatter", async () => {
    await mkdir(join(TMP, "blog"), { recursive: true })
    await writeFile(join(TMP, "blog", "launch.en.md"), `---\ntitle: Launch\ndate: 2026-03-09\nlocale: en\n---\nEnglish body`)
    await writeFile(join(TMP, "blog", "launch.ru.md"), `---\ntitle: Запуск\ndate: 2026-03-08\nlocale: ru\n---\nRussian body`)

    const entries = await loadContentCollection({
      dir: TMP,
      validate(frontmatter, entry) {
        if (typeof frontmatter.title !== "string") throw new Error(`Missing title for ${entry.id}`)
        return {
          title: frontmatter.title,
          date: String(frontmatter.date ?? ""),
          locale: String(frontmatter.locale ?? ""),
        }
      },
    })

    expect(entries).toHaveLength(2)
    expect(entries[0]?.excerpt.length).toBeGreaterThan(0)
    expect(queryContent(entries, { locale: "ru" })[0]?.locale).toBe("ru")
    expect(queryContent(entries, { sortBy: "date-desc" })[0]?.frontmatter.title).toBe("Launch")
    expect(queryContent(entries, { locale: "en" })[0]?.slug).toBe("blog/launch")
  })

  test("finds entries by slug and locale", async () => {
    await mkdir(join(TMP, "posts"), { recursive: true })
    await writeFile(join(TMP, "posts", "hello.md"), `---\ntitle: Hello\nlocale: en\n---\nHello world`)

    const entries = await loadContentCollection({ dir: TMP })
    const entry = getContentEntryBySlug(entries, "posts/hello", "en")
    expect(entry?.frontmatter.title).toBe("Hello")
  })

  test("loads nested frontmatter structures without widening the public API", async () => {
    await mkdir(join(TMP, "guides"), { recursive: true })
    await writeFile(join(TMP, "guides", "advanced.md"), [
      "---",
      "title: Advanced",
      "summary: |",
      "  Deep detail",
      "  for operators",
      "seo:",
      "  title: Advanced SEO",
      "  noindex: true",
      "tags:",
      "  - framework",
      "  - operators",
      "---",
      "Advanced guide body",
    ].join("\n"))

    const entries = await loadContentCollection({ dir: TMP })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.frontmatter).toEqual({
      title: "Advanced",
      summary: "Deep detail\nfor operators",
      seo: {
        title: "Advanced SEO",
        noindex: true,
      },
      tags: ["framework", "operators"],
    })
  })

  test("returns empty frontmatter when the closing fence is missing", () => {
    const parsed = parseFrontmatter(`---\ntitle: Broken\nbody: nope`)
    expect(parsed.frontmatter).toEqual({})
    expect(parsed.body).toBe(`---\ntitle: Broken\nbody: nope`)
  })

  test("validate errors propagate with entry context", async () => {
    await mkdir(join(TMP, "docs"), { recursive: true })
    await writeFile(join(TMP, "docs", "broken.md"), `---\nlocale: en\n---\nBody`)

    await expect(loadContentCollection({
      dir: TMP,
      validate(frontmatter, entry) {
        if (typeof frontmatter.title !== "string") {
          throw new Error(`Missing title for ${entry.slug}`)
        }
        return { title: frontmatter.title }
      },
    })).rejects.toThrow("Missing title for docs/broken")
  })

  test("infers locale from slug when frontmatter locale is absent", async () => {
    await mkdir(join(TMP, "ru", "guides"), { recursive: true })
    await writeFile(join(TMP, "ru", "guides", "intro.md"), `---\ntitle: Введение\n---\nПривет`)

    const entries = await loadContentCollection({ dir: TMP, defaultLocale: "en" })

    expect(entries[0]?.slug).toBe("ru/guides/intro")
    expect(entries[0]?.locale).toBe("ru")
  })

  test("getContentEntryBySlug without locale returns the first matching localized entry", async () => {
    await mkdir(join(TMP, "blog"), { recursive: true })
    await writeFile(join(TMP, "blog", "hello.en.md"), `---\ntitle: Hello\nlocale: en\n---\nHello`)
    await writeFile(join(TMP, "blog", "hello.ru.md"), `---\ntitle: Привет\nlocale: ru\n---\nПривет`)

    const entries = await loadContentCollection({ dir: TMP })
    const match = getContentEntryBySlug(entries, "blog/hello")

    expect(match).not.toBeNull()
    expect(match?.slug).toBe("blog/hello")
  })

  test("respects includeExtensions when loading collections", async () => {
    await mkdir(join(TMP, "notes"), { recursive: true })
    await writeFile(join(TMP, "notes", "a.md"), `---\ntitle: A\n---\nA`)
    await writeFile(join(TMP, "notes", "b.txt"), `---\ntitle: B\n---\nB`)

    const entries = await loadContentCollection({ dir: TMP, includeExtensions: [".md"] })

    expect(entries).toHaveLength(1)
    expect(entries[0]?.id).toBe("notes/a.md")
  })

  test("queryContent supports title-desc sorting", async () => {
    await mkdir(join(TMP, "sort"), { recursive: true })
    await writeFile(join(TMP, "sort", "a.md"), `---\ntitle: Alpha\n---\nA`)
    await writeFile(join(TMP, "sort", "z.md"), `---\ntitle: Zeta\n---\nZ`)

    const entries = await loadContentCollection({ dir: TMP })
    const sorted = queryContent(entries, { sortBy: "title-desc" })

    expect(sorted.map((entry) => entry.frontmatter.title)).toEqual(["Zeta", "Alpha"])
  })

  test("content slugs compose correctly with i18n route helpers and hreflang generation", async () => {
    await mkdir(join(TMP, "en", "blog"), { recursive: true })
    await mkdir(join(TMP, "ru", "blog"), { recursive: true })
    await writeFile(join(TMP, "en", "blog", "launch.md"), `---\ntitle: Launch\n---\nLaunch body`)
    await writeFile(join(TMP, "ru", "blog", "launch.md"), `---\ntitle: Запуск\n---\nЗапуск body`)

    setupI18n({
      locales: {
        en: { title: "Launch" },
        ru: { title: "Запуск" },
      },
      defaultLocale: "en",
      routeStrategy: "prefix-except-default",
    })

    const entries = await loadContentCollection({ dir: TMP, defaultLocale: "en" })
    const localizedPaths = entries.map((entry) => withLocalePath(`/${entry.slug}`, entry.locale ?? "en"))
    const hreflang = buildHreflangLinks("/ru/blog/launch", ["en", "ru"], { origin: "https://example.com" })

    expect(localizedPaths).toEqual(["/blog/launch", "/ru/blog/launch"])
    expect(hreflang).toEqual([
      { locale: "en", href: "https://example.com/blog/launch" },
      { locale: "ru", href: "https://example.com/ru/blog/launch" },
    ])
  })

  test("adversarial frontmatter lines without separators are ignored while valid keys still parse", () => {
    const parsed = parseFrontmatter([
      "---",
      "title: Hardening",
      "this line is invalid yaml-ish noise",
      "locale: en",
      ": also ignored",
      "seo:",
      "  title: Safe",
      "---",
      "Body",
    ].join("\n"))

    expect(parsed.frontmatter).toEqual({
      title: "Hardening",
      locale: "en",
      seo: {
        title: "Safe",
      },
    })
  })

  test("queryContent locale filtering and slug lookup stay stable across localized sibling entries", async () => {
    await mkdir(join(TMP, "blog"), { recursive: true })
    await writeFile(join(TMP, "blog", "guide.en.md"), `---\ntitle: Guide\nlocale: en\ndate: 2026-03-09\n---\nEN`)
    await writeFile(join(TMP, "blog", "guide.ru.md"), `---\ntitle: Руководство\nlocale: ru\ndate: 2026-03-08\n---\nRU`)
    await writeFile(join(TMP, "blog", "guide.de.md"), `---\ntitle: Leitfaden\nlocale: de\ndate: 2026-03-07\n---\nDE`)

    const entries = await loadContentCollection({ dir: TMP, defaultLocale: "en" })

    expect(queryContent(entries, { locale: "ru", sortBy: "date-desc" }).map((entry) => entry.frontmatter.title)).toEqual(["Руководство"])
    expect(getContentEntryBySlug(entries, "blog/guide", "de")?.frontmatter.title).toBe("Leitfaden")
    expect(getContentEntryBySlug(entries, "blog/guide", "fr")).toBeNull()
  })

  test("nested mdx content stays queryable with default-locale fallback in a real collection shape", async () => {
    await mkdir(join(TMP, "guides", "advanced"), { recursive: true })
    await writeFile(join(TMP, "guides", "advanced", "index.mdx"), `---\ntitle: Advanced\n---\n# Deep`)
    await writeFile(join(TMP, "guides", "advanced", "index.ru.mdx"), `---\ntitle: Продвинуто\nlocale: ru\n---\n# Глубоко`)

    const entries = await loadContentCollection({ dir: TMP, defaultLocale: "en", includeExtensions: [".md", ".mdx"] })

    expect(entries.map((entry) => entry.slug).sort()).toEqual(["guides/advanced", "guides/advanced"])
    expect(queryContent(entries, { locale: "en" })[0]?.frontmatter.title).toBe("Advanced")
    expect(queryContent(entries, { locale: "ru" })[0]?.frontmatter.title).toBe("Продвинуто")
    expect(getContentEntryBySlug(entries, "guides/advanced", "en")?.locale).toBe("en")
  })
})
