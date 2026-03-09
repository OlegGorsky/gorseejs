import type { Context } from "gorsee/server"
import { queryOne, run } from "../../lib/db.ts"
import { currentUserId } from "../../lib/auth.ts"

export async function POST(ctx: Context) {
  const userId = currentUserId(ctx)
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 })

  const form = await ctx.request.formData()
  const articleId = Number(form.get("articleId"))
  if (!articleId) return Response.json({ error: "missing articleId" }, { status: 400 })

  const existing = queryOne(
    "SELECT 1 FROM favorites WHERE user_id = ? AND article_id = ?",
    [userId, articleId],
  )

  if (existing) {
    run("DELETE FROM favorites WHERE user_id = ? AND article_id = ?", [userId, articleId])
  } else {
    run("INSERT INTO favorites (user_id, article_id) VALUES (?, ?)", [userId, articleId])
  }

  const countRow = queryOne<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM favorites WHERE article_id = ?",
    [articleId],
  )

  return Response.json({ favorited: !existing, count: countRow?.cnt ?? 0 })
}
