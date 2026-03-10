import { getMimeType } from "./mime.ts"
import { fileETag, isNotModified } from "./etag.ts"
import { readFile, realpath } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"

export interface StaticFileOptions {
  contentType?: string
  cacheControl?: string
  request?: Request
  etag?: boolean
  extraHeaders?: Record<string, string>
}

export async function serveStaticFile(
  rootDir: string,
  relativePath: string,
  options: StaticFileOptions = {},
): Promise<Response | null> {
  const {
    contentType,
    cacheControl,
    request,
    etag = false,
    extraHeaders = {},
  } = options

  try {
    const rootPath = await realpath(resolve(rootDir))
    const candidatePath = resolve(rootPath, relativePath)
    const filePath = await realpath(candidatePath).catch(() => candidatePath)
    const relativePathFromRoot = relative(rootPath, filePath)
    if (
      relativePathFromRoot.startsWith("..") ||
      isAbsolute(relativePathFromRoot)
    ) {
      return null
    }

    const fileBuffer = await readFile(filePath).catch(() => null)
    if (!fileBuffer) return null

    const headers: Record<string, string> = {
      "Content-Type": contentType ?? getMimeType(filePath),
      ...extraHeaders,
    }

    if (cacheControl) headers["Cache-Control"] = cacheControl

    if (etag) {
      const tag = await fileETag(filePath)
      if (tag) headers["ETag"] = tag
      if (tag && request && isNotModified(request, tag)) {
        return new Response(null, { status: 304, headers })
      }
    }

    return new Response(fileBuffer, { headers })
  } catch {
    return null
  }
}

export async function servePrefixedStaticFile(
  pathname: string,
  prefix: string,
  rootDir: string,
  options: StaticFileOptions = {},
): Promise<Response | null> {
  if (!pathname.startsWith(prefix)) return null
  const relativePath = pathname.slice(prefix.length)
  return serveStaticFile(rootDir, relativePath, options)
}
