import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
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
})
