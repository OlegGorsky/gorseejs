import { describe, it, expect } from "bun:test"
import { getMimeType } from "../../src/server/mime.ts"

describe("getMimeType", () => {
  it("returns correct type for common extensions", () => {
    expect(getMimeType("index.html")).toBe("text/html; charset=utf-8")
    expect(getMimeType("style.css")).toBe("text/css; charset=utf-8")
    expect(getMimeType("app.js")).toBe("application/javascript; charset=utf-8")
    expect(getMimeType("data.json")).toBe("application/json; charset=utf-8")
  })

  it("returns correct type for images", () => {
    expect(getMimeType("photo.png")).toBe("image/png")
    expect(getMimeType("logo.svg")).toBe("image/svg+xml")
    expect(getMimeType("icon.ico")).toBe("image/x-icon")
  })

  it("returns correct type for fonts", () => {
    expect(getMimeType("font.woff2")).toBe("font/woff2")
    expect(getMimeType("font.ttf")).toBe("font/ttf")
  })

  it("returns octet-stream for unknown extensions", () => {
    expect(getMimeType("file.xyz")).toBe("application/octet-stream")
    expect(getMimeType("archive.tar.gz")).toBe("application/octet-stream")
  })

  it("handles case-insensitive extensions", () => {
    expect(getMimeType("FILE.HTML")).toBe("text/html; charset=utf-8")
    expect(getMimeType("IMG.PNG")).toBe("image/png")
  })

  it("handles paths with directories", () => {
    expect(getMimeType("/public/assets/style.css")).toBe("text/css; charset=utf-8")
  })
})
