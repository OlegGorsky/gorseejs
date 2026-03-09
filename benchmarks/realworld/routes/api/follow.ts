import type { Context } from "gorsee/server"
import { queryOne, run } from "../../lib/db.ts"
import { currentUserId } from "../../lib/auth.ts"

export async function POST(ctx: Context) {
  const userId = currentUserId(ctx)
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 })

  const form = await ctx.request.formData()
  const followedId = Number(form.get("followedId"))
  if (!followedId || followedId === userId) {
    return Response.json({ error: "invalid followedId" }, { status: 400 })
  }

  const existing = queryOne(
    "SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?",
    [userId, followedId],
  )

  if (existing) {
    run("DELETE FROM follows WHERE follower_id = ? AND followed_id = ?", [userId, followedId])
  } else {
    run("INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)", [userId, followedId])
  }

  return Response.json({ following: !existing })
}
