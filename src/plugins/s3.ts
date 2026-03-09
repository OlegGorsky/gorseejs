// S3-compatible object storage plugin -- uses native fetch, no AWS SDK

import type { GorseePlugin } from "./index.ts"
import { definePlugin } from "./index.ts"

export interface S3PluginConfig {
  bucket: string
  region?: string
  endpoint?: string
  accessKeyId?: string
  secretAccessKey?: string
}

export interface StorageClient {
  upload(key: string, body: ArrayBuffer | ReadableStream | string, contentType?: string): Promise<string>
  download(key: string): Promise<Response>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<string[]>
}

let storageClient: StorageClient | null = null

/** Returns the storage client (available after setup) */
export function getStorage(): StorageClient {
  if (!storageClient) {
    throw new Error("S3 not initialized. Did you register s3Plugin?")
  }
  return storageClient
}

function buildEndpoint(config: S3PluginConfig): string {
  if (config.endpoint) return config.endpoint.replace(/\/$/, "")
  const region = config.region ?? "us-east-1"
  return `https://${config.bucket}.s3.${region}.amazonaws.com`
}

function createStorageClient(config: S3PluginConfig): StorageClient {
  const baseUrl = buildEndpoint(config)
  const headers: Record<string, string> = {}

  // Basic auth headers (simplified -- production should use AWS Signature V4)
  if (config.accessKeyId) {
    headers["x-amz-access-key"] = config.accessKeyId
  }

  return {
    async upload(key: string, body: ArrayBuffer | ReadableStream | string, contentType?: string) {
      const url = `${baseUrl}/${encodeURIComponent(key)}`
      const ct = contentType ?? "application/octet-stream"
      const fetchBody: BodyInit = body instanceof ArrayBuffer
        ? new Blob([body], { type: ct })
        : body
      const res = await fetch(url, {
        method: "PUT",
        headers: { ...headers, "Content-Type": ct },
        body: fetchBody,
      })
      if (!res.ok) throw new Error(`S3 upload failed: ${res.status} ${res.statusText}`)
      return url
    },

    async download(key) {
      const url = `${baseUrl}/${encodeURIComponent(key)}`
      const res = await fetch(url, { headers })
      if (!res.ok) throw new Error(`S3 download failed: ${res.status} ${res.statusText}`)
      return res
    },

    async delete(key) {
      const url = `${baseUrl}/${encodeURIComponent(key)}`
      const res = await fetch(url, { method: "DELETE", headers })
      if (!res.ok) throw new Error(`S3 delete failed: ${res.status} ${res.statusText}`)
    },

    async list(prefix) {
      const params = prefix ? `?list-type=2&prefix=${encodeURIComponent(prefix)}` : "?list-type=2"
      const res = await fetch(`${baseUrl}${params}`, { headers })
      if (!res.ok) throw new Error(`S3 list failed: ${res.status} ${res.statusText}`)
      const xml = await res.text()
      const keys: string[] = []
      const regex = /<Key>([^<]+)<\/Key>/g
      let match: RegExpExecArray | null
      while ((match = regex.exec(xml)) !== null) keys.push(match[1]!)
      return keys
    },
  }
}

/** Creates an S3-compatible storage plugin */
export function s3Plugin(config: S3PluginConfig): GorseePlugin {
  return definePlugin({
    name: "gorsee-s3",
    capabilities: ["storage"],

    async setup() {
      storageClient = createStorageClient(config)
    },

    async teardown() {
      storageClient = null
    },
  })
}
