import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { generateStaticPages } from "../../src/build/ssg.ts"

const TMP = join(process.cwd(), ".tmp-ssg")
const ROUTES_DIR = join(TMP, "routes")
const OUT_DIR = join(TMP, "dist")

describe("SSG build", () => {
  beforeAll(async () => {
    await rm(TMP, { recursive: true, force: true })
    await mkdir(ROUTES_DIR, { recursive: true })

    await writeFile(join(ROUTES_DIR, "index.tsx"), `
      import { Head } from "gorsee/client"

      export const prerender = true
      export const css = "/page.css"

      export async function loader() {
        return { message: "hello ssg" }
      }

      export default function Page(props: any) {
        return (
          <>
            <Head>
              <title>SSG Title</title>
            </Head>
            <main data-kind="ssg">{props.data.message}</main>
          </>
        )
      }
    `.trim())
  })

  afterAll(async () => {
    await rm(TMP, { recursive: true, force: true })
  })

  test("prerendered page uses shared shell contract", async () => {
    const result = await generateStaticPages({
      routesDir: ROUTES_DIR,
      outDir: OUT_DIR,
    })

    expect(result.errors).toEqual([])
    expect(result.pages.get("/")).toBe(join(OUT_DIR, "index.html"))

    const html = await Bun.file(join(OUT_DIR, "index.html")).text()
    expect(html).toContain("<title>SSG Title</title>")
    expect(html).toContain("<main data-kind=\"ssg\">hello ssg</main>")
    expect(html).toContain("<link rel=\"stylesheet\" href=\"/page.css\" />")
    expect(html).toContain("\"message\":\"hello ssg\"")
    expect(html).toContain("id=\"__GORSEE_DATA__\"")
  })
})
