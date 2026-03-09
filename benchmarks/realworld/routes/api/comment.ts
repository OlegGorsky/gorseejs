import type { Context } from "gorsee/server"
import { run } from "../../lib/db.ts"
import { currentUserId } from "../../lib/auth.ts"

export async function POST(ctx: Context) {
  const userId = currentUserId(ctx)
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 })

  const articleId = Number(ctx.url.searchParams.get("articleId"))
  if (!articleId) return Response.json({ error: "missing articleId" }, { status: 400 })

  const form = await ctx.request.formData()
  const body = String(form.get("body") ?? "").trim()
  if (!body) return Response.json({ error: "empty comment" }, { status: 400 })

  run("INSERT INTO comments (body, article_id, author_id) VALUES (?, ?, ?)", [body, articleId, userId])

  // Redirect back to article page
  const referer = ctx.request.headers.get("referer") ?? "/"
  return new Response(null, { status: 303, headers: { Location: referer } })
}
