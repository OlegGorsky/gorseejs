import { describe, expect, test } from "bun:test"
import {
  Image,
  buildImageSrcSet,
  getImageCandidateWidths,
  getImageProps,
  isAllowedRemoteImage,
} from "../../src/runtime/image.ts"
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

  test("allows remote images that match a single-level wildcard pattern", () => {
    expect(isAllowedRemoteImage("https://images.example.com/assets/hero.png", [
      { protocol: "https:", hostname: "images.example.com", pathname: "/assets/*" },
    ])).toBe(true)
    expect(isAllowedRemoteImage("https://images.example.com/assets/nested/hero.png", [
      { protocol: "https:", hostname: "images.example.com", pathname: "/assets/*" },
    ])).toBe(false)
  })

  test("does not optimize widthless images", () => {
    const props = getImageProps({
      src: "/hero.png",
      alt: "Hero",
    })

    expect(props.src).toBe("/hero.png")
    expect(props.srcset).toBeUndefined()
  })

  test("does not optimize when optimize is false", () => {
    const props = getImageProps({
      src: "/hero.png",
      alt: "Hero",
      width: 800,
      optimize: false,
    })

    expect(props.src).toBe("/hero.png")
    expect(props.srcset).toBeUndefined()
    expect(props.style).toBeUndefined()
  })

  test("getImageCandidateWidths includes explicit width and stays sorted", () => {
    expect(getImageCandidateWidths(500, [320, 640])).toEqual([320, 500, 640])
    expect(getImageCandidateWidths(undefined, [320, 640])).toEqual([320, 640])
  })

  test("custom loader and requested format shape optimized src and srcset", () => {
    const props = getImageProps({
      src: "/hero.png",
      alt: "Hero",
      width: 640,
      format: "avif",
      config: {
        widths: [320, 640],
        loader: ({ src, width, format }) => `${src}?w=${width}&fm=${format ?? "none"}`,
      },
    })

    expect(props.src).toBe("/hero.png?w=640&fm=avif")
    expect(String(props.srcset)).toContain("/hero.png?w=320&fm=avif 320w")
    expect(String(props.srcset)).toContain("/hero.png?w=640&fm=avif 640w")
  })

  test("Image falls back to img when only one format is requested", () => {
    const html = renderToString(Image({
      src: "/hero.png",
      alt: "Hero",
      width: 800,
      formats: ["webp"],
    }))

    expect(html).toContain("<img")
    expect(html).not.toContain("<picture>")
  })

  test("multi-format picture keeps the last format on the img fallback", () => {
    const html = renderToString(Image({
      src: "/hero.png",
      alt: "Hero",
      width: 800,
      formats: ["avif", "webp", "png"],
    }))

    expect(html).toContain('type="image/avif"')
    expect(html).toContain('type="image/webp"')
    expect(html).toContain("fm=avif")
  })

  test("priority images switch loading/decoding semantics and expose fetchpriority", () => {
    const props = getImageProps({
      src: "/hero.png",
      alt: "Hero",
      width: 1200,
      priority: true,
    })

    expect(props.loading).toBe("eager")
    expect(props.decoding).toBe("sync")
    expect(props.fetchpriority).toBe("high")
  })

  test("placeholder style merges with existing styles and optimized object-fit", () => {
    const props = getImageProps({
      src: "/hero.png",
      alt: "Hero",
      width: 640,
      fit: "contain",
      style: { borderRadius: "12px" },
      placeholder: "blur",
      blurDataURL: "data:image/png;base64,xyz",
    })

    expect(props.style).toEqual({
      borderRadius: "12px",
      backgroundImage: 'url("data:image/png;base64,xyz")',
      backgroundSize: "cover",
      backgroundPosition: "center",
      "object-fit": "contain",
    })
  })

  test("remote image allowlist requires exact protocol and exact pathname when configured", () => {
    expect(isAllowedRemoteImage("https://images.example.com/assets/hero.png", [
      { protocol: "https:", hostname: "images.example.com", pathname: "/assets/hero.png" },
    ])).toBe(true)
    expect(isAllowedRemoteImage("http://images.example.com/assets/hero.png", [
      { protocol: "https:", hostname: "images.example.com", pathname: "/assets/hero.png" },
    ])).toBe(false)
    expect(isAllowedRemoteImage("https://images.example.com/assets/other.png", [
      { protocol: "https:", hostname: "images.example.com", pathname: "/assets/hero.png" },
    ])).toBe(false)
  })

  test("explicit format overrides multi-format source list for the img fallback", () => {
    const props = getImageProps({
      src: "/hero.png",
      alt: "Hero",
      width: 800,
      format: "png",
      formats: ["avif", "webp", "png"],
    })

    expect(String(props.src)).toContain("fm=png")
    expect(String(props.srcset)).toContain("fm=png")
  })

  test("candidate widths stay deduped and sorted even with repeated explicit widths", () => {
    expect(getImageCandidateWidths(640, [320, 640, 640, 960])).toEqual([320, 640, 960])
  })

  test("Image picture sources keep format ordering stable for multi-format output", () => {
    const html = renderToString(Image({
      src: "/hero.png",
      alt: "Hero",
      width: 800,
      formats: ["avif", "webp", "png"],
    }))

    expect(html.indexOf('type="image/avif"')).toBeLessThan(html.indexOf('type="image/webp"'))
    expect(html.indexOf('type="image/webp"')).toBeLessThan(html.indexOf("<img"))
  })
})
