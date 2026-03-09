import { describe, expect, test } from "bun:test"
import { Image, buildImageSrcSet, getImageProps, isAllowedRemoteImage } from "../../src/runtime/image.ts"
import { renderToString } from "../../src/runtime/server.ts"

describe("image runtime", () => {
  test("builds optimized img props with srcset", () => {
    const props = getImageProps({
      src: "/hero.png",
      alt: "Hero",
      width: 800,
      height: 600,
      sizes: "100vw",
    })

    expect(String(props.src)).toContain("/_gorsee/image?")
    expect(String(props.srcset)).toContain("320w")
    expect(String(props.srcset)).toContain("800w")
    expect(props.sizes).toBe("100vw")
  })

  test("supports blur placeholders", () => {
    const props = getImageProps({
      src: "/hero.png",
      alt: "Hero",
      width: 800,
      placeholder: "blur",
      blurDataURL: "data:image/png;base64,abc",
    })

    expect(props.style).toEqual(expect.objectContaining({
      backgroundImage: 'url("data:image/png;base64,abc")',
    }))
  })

  test("fails closed on disallowed remote images", () => {
    expect(() => getImageProps({
      src: "https://cdn.example.com/hero.png",
      alt: "Hero",
      width: 800,
      config: {
        remotePatterns: [{ hostname: "images.example.com" }],
      },
    })).toThrow("Remote image source is not allowed")
  })

  test("allows remote images that match configured patterns", () => {
    expect(isAllowedRemoteImage("https://images.example.com/assets/hero.png", [
      { protocol: "https:", hostname: "images.example.com", pathname: "/assets/**" },
    ])).toBe(true)
  })

  test("renders picture element for multi-format images", () => {
    const html = renderToString(Image({
      src: "/hero.png",
      alt: "Hero",
      width: 800,
      formats: ["avif", "webp", "png"],
    }))

    expect(html).toContain("<picture>")
    expect(html).toContain('type="image/avif"')
    expect(html).toContain('type="image/webp"')
    expect(html).toContain("<img")
  })

  test("buildImageSrcSet keeps width descriptors stable", () => {
    const srcSet = buildImageSrcSet("/hero.png", 640, 75, ({ src, width }) => `${src}?w=${width}`)
    expect(srcSet).toContain("/hero.png?w=320 320w")
    expect(srcSet).toContain("/hero.png?w=640 640w")
  })
})
