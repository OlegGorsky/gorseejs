import { afterEach, describe, expect, test } from "bun:test"
import { createRuntimeFixture } from "../../src/testing/index.ts"

let fixture: ReturnType<typeof createRuntimeFixture> | undefined

afterEach(() => {
  fixture?.cleanup()
  fixture = undefined
})

describe("runtime fixture harness", () => {
  test("drives router navigation without ad hoc DOM setup", async () => {
    fixture = createRuntimeFixture()

    fixture.setFetch(((url: string | URL | Request) => {
      return Promise.resolve(new Response(JSON.stringify({
        html: `<div>${String(url)}</div>`,
        data: { ok: true },
        params: {},
        title: "Fixture",
      })))
    }) as typeof fetch)

    await fixture.navigate("/hello")

    expect(fixture.htmlWrites).toEqual(["<div>/hello</div>"])
    expect(fixture.historyWrites).toEqual(["/hello"])
    expect(fixture.removedCssCount()).toBe(1)
  })
})
