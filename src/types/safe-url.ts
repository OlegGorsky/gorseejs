declare const __safeURLBrand: unique symbol

export type SafeURLValue = string & { readonly [__safeURLBrand]: true }

const ALLOWED_PROTOCOLS = ["http:", "https:", "mailto:"]
const DANGEROUS_PROTOCOLS = ["javascript:", "data:", "vbscript:", "blob:"]

export function validateURL(raw: string): SafeURLValue {
  // Check dangerous protocols before URL parsing (handles case-insensitive)
  const lower = raw.trim().toLowerCase()
  for (const proto of DANGEROUS_PROTOCOLS) {
    if (lower.startsWith(proto)) {
      throw new Error(`[GORSEE E005] Dangerous URL protocol: "${proto}" is not allowed`)
    }
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    // Relative URLs are allowed (they don't parse as absolute URLs)
    return raw as SafeURLValue
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    throw new Error(
      `[GORSEE E005] Disallowed URL protocol: "${url.protocol}". Allowed: ${ALLOWED_PROTOCOLS.join(", ")}`
    )
  }

  return raw as SafeURLValue
}

export function SafeURL(
  strings: TemplateStringsArray,
  ...values: unknown[]
): SafeURLValue {
  const raw = String.raw(strings, ...values.map(String))
  return validateURL(raw)
}
