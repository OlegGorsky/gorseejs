import type { GorseeRenderable } from "./renderable.ts"

export type ImageFormat = "avif" | "webp" | "jpeg" | "png"
export type ImageFit = "cover" | "contain" | "fill" | "inside" | "outside"

export interface ImageRemotePattern {
  protocol?: "http:" | "https:"
  hostname: string
  pathname?: string
}

export interface ImageLoaderParams {
  src: string
  width: number
  quality: number
  format?: ImageFormat
}

export type ImageLoader = (params: ImageLoaderParams) => string

export interface ImageRuntimeConfig {
  widths?: number[]
  formats?: ImageFormat[]
  quality?: number
  fit?: ImageFit
  loader?: ImageLoader
  remotePatterns?: ImageRemotePattern[]
}

export interface ImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  loading?: "lazy" | "eager"
  priority?: boolean
  sizes?: string
  quality?: number
  fit?: ImageFit
  format?: ImageFormat
  formats?: ImageFormat[]
  optimize?: boolean
  placeholder?: "empty" | "blur"
  blurDataURL?: string
  class?: string
  className?: string
  config?: ImageRuntimeConfig
  [key: string]: unknown
}

const DEFAULT_IMAGE_CONFIG: Required<Pick<ImageRuntimeConfig, "widths" | "formats" | "quality" | "fit">> = {
  widths: [320, 640, 960, 1200, 1600, 2048],
  formats: ["webp"],
  quality: 75,
  fit: "cover",
}

function isRemoteSource(src: string): boolean {
  return /^https?:\/\//.test(src)
}

function matchesRemotePattern(url: URL, pattern: ImageRemotePattern): boolean {
  if (pattern.protocol && url.protocol !== pattern.protocol) return false
  if (pattern.hostname !== url.hostname) return false
  if (!pattern.pathname) return true

  if (pattern.pathname.endsWith("/**")) {
    const prefix = pattern.pathname.slice(0, -3)
    return url.pathname.startsWith(prefix)
  }

  if (pattern.pathname.endsWith("/*")) {
    const prefix = pattern.pathname.slice(0, -1)
    return url.pathname.startsWith(prefix) && !url.pathname.slice(prefix.length).includes("/")
  }

  return url.pathname === pattern.pathname
}

export function isAllowedRemoteImage(src: string, patterns: ImageRemotePattern[] = []): boolean {
  if (!isRemoteSource(src)) return true
  const url = new URL(src)
  return patterns.some((pattern) => matchesRemotePattern(url, pattern))
}

export function defaultImageLoader(params: ImageLoaderParams): string {
  const search = new URLSearchParams({
    src: params.src,
    w: String(params.width),
    q: String(params.quality),
  })
  if (params.format) search.set("fm", params.format)
  return `/_gorsee/image?${search.toString()}`
}

export function getImageCandidateWidths(
  width: number | undefined,
  widths: number[] = DEFAULT_IMAGE_CONFIG.widths,
): number[] {
  if (!width) return [...widths]
  const candidates = widths.filter((candidate) => candidate <= width * 2)
  if (!candidates.includes(width)) candidates.push(width)
  return [...new Set(candidates)].sort((a, b) => a - b)
}

export function buildImageSrcSet(
  src: string,
  width: number | undefined,
  quality: number,
  loader: ImageLoader,
  format?: ImageFormat,
  widths: number[] = DEFAULT_IMAGE_CONFIG.widths,
): string | undefined {
  const candidates = getImageCandidateWidths(width, widths)
  if (candidates.length === 0) return undefined
  return candidates.map((candidate) =>
    `${loader({ src, width: candidate, quality, format })} ${candidate}w`
  ).join(", ")
}

function buildPlaceholderStyle(props: ImageProps): Record<string, string> | undefined {
  if (props.placeholder !== "blur" || !props.blurDataURL) return undefined
  return {
    backgroundImage: `url("${props.blurDataURL}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  }
}

function resolveImageConfig(props: ImageProps): Required<Pick<ImageRuntimeConfig, "widths" | "formats" | "quality" | "fit">> & Pick<ImageRuntimeConfig, "loader" | "remotePatterns"> {
  const config = props.config ?? {}
  return {
    widths: config.widths ?? DEFAULT_IMAGE_CONFIG.widths,
    formats: config.formats ?? DEFAULT_IMAGE_CONFIG.formats,
    quality: props.quality ?? config.quality ?? DEFAULT_IMAGE_CONFIG.quality,
    fit: props.fit ?? config.fit ?? DEFAULT_IMAGE_CONFIG.fit,
    loader: config.loader,
    remotePatterns: config.remotePatterns,
  }
}

export function getImageProps(props: ImageProps): Record<string, unknown> {
  const {
    src,
    alt,
    width,
    height,
    loading: loadingProp,
    priority,
    sizes,
    format,
    formats,
    optimize = true,
    placeholder,
    blurDataURL,
    config,
    style,
    ...rest
  } = props
  const resolved = resolveImageConfig(props)
  const loading = priority ? "eager" : (loadingProp ?? "lazy")
  const fetchpriority = priority ? "high" : undefined
  const decoding = priority ? "sync" : "async"
  const loader = resolved.loader ?? defaultImageLoader

  if (isRemoteSource(src) && !isAllowedRemoteImage(src, resolved.remotePatterns ?? [])) {
    throw new Error(`Remote image source is not allowed: ${src}`)
  }

  const shouldOptimize = optimize && Boolean(width)
  const primaryFormat = format ?? formats?.[0] ?? resolved.formats[0]
  const optimizedSrc = shouldOptimize
    ? loader({ src, width: width!, quality: resolved.quality, format: primaryFormat })
    : src
  const srcSet = shouldOptimize
    ? buildImageSrcSet(src, width, resolved.quality, loader, primaryFormat, resolved.widths)
    : undefined

  const imgProps: Record<string, unknown> = {
    src: optimizedSrc,
    alt,
    loading,
    decoding,
    ...rest,
  }

  if (width !== undefined) imgProps.width = String(width)
  if (height !== undefined) imgProps.height = String(height)
  if (sizes) imgProps.sizes = sizes
  if (fetchpriority) imgProps.fetchpriority = fetchpriority
  if (srcSet) imgProps.srcset = srcSet

  const placeholderStyle = buildPlaceholderStyle({ ...props, placeholder, blurDataURL })
  const mergedStyle = {
    ...(typeof style === "object" && style !== null ? style as Record<string, string> : {}),
    ...(placeholderStyle ?? {}),
    ...(shouldOptimize ? { "object-fit": resolved.fit } : {}),
  }
  if (Object.keys(mergedStyle).length > 0) imgProps.style = mergedStyle

  return imgProps
}

export function Image(props: ImageProps): GorseeRenderable {
  const resolved = resolveImageConfig(props)
  const requestedFormats = props.formats ?? resolved.formats
  const primaryFormat = props.format ?? requestedFormats[0]

  if (props.optimize === false || !props.width || requestedFormats.length <= 1) {
    return { type: "img", props: getImageProps({ ...props, format: primaryFormat }) }
  }

  const loader = resolved.loader ?? defaultImageLoader
  const sources = requestedFormats.slice(0, -1).map((candidateFormat) => ({
    type: "source",
    props: {
      type: `image/${candidateFormat}`,
      srcset: buildImageSrcSet(props.src, props.width, resolved.quality, loader, candidateFormat, resolved.widths),
      sizes: props.sizes,
    },
  }))

  return {
    type: "picture",
    props: {
      children: [
        ...sources,
        { type: "img", props: getImageProps({ ...props, format: primaryFormat }) },
      ],
    },
  }
}
