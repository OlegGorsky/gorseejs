import { timingSafeEqual } from "node:crypto"

let cachedKey: CryptoKey | null = null
let cachedSecret = ""

async function getSigningKey(secret: string): Promise<CryptoKey> {
  if (cachedKey && cachedSecret === secret) return cachedKey
  const enc = new TextEncoder()
  cachedKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
  cachedSecret = secret
  return cachedKey
}

export async function signValue(value: string, secret: string): Promise<string> {
  const key = await getSigningKey(secret)
  const enc = new TextEncoder()
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(value))
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return `${value}.${sigHex}`
}

export async function verifySignedValue(signed: string, secret: string): Promise<string | null> {
  const dotIndex = signed.lastIndexOf(".")
  if (dotIndex === -1) return null
  const value = signed.slice(0, dotIndex)
  const expected = await signValue(value, secret)
  if (expected.length !== signed.length) return null
  const a = Buffer.from(expected)
  const b = Buffer.from(signed)
  if (!timingSafeEqual(a, b)) return null
  return value
}

export function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

export function decodeBase64Url(value: string): string {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf-8")
}
