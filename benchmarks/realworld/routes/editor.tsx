import type { Context } from "gorsee/server"
import { requireAuth } from "gorsee/server"
import { run, lastInsertId, queryOne } from "../lib/db.ts"
import { currentUserId } from "../lib/auth.ts"

export const guard = requireAuth("/login")

export function loader() {
  return { article: null as null }
}

export async function POST(ctx: Context) {
  const userId = currentUserId(ctx)
  if (!userId) return ctx.redirect("/login")

  const form = await ctx.request.formData()
  const title = String(form.get("title") ?? "")
  const description = String(form.get("description") ?? "")
  const body = String(form.get("body") ?? "")
  const tagsRaw = String(form.get("tags") ?? "")

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")

  run(
    "INSERT INTO articles (slug, title, description, body, author_id) VALUES (?, ?, ?, ?, ?)",
    [slug, title, description, body, userId],
  )
  const articleId = lastInsertId()

  if (tagsRaw.trim()) {
    for (const tagName of tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)) {
      run("INSERT OR IGNORE INTO tags (name) VALUES (?)", [tagName])
      const tag = queryOne<{ id: number }>("SELECT id FROM tags WHERE name = ?", [tagName])
      if (tag) run("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)", [articleId, tag.id])
    }
  }

  return ctx.redirect(`/article/${slug}`)
}

export default function EditorPage() {
  return (
    <div class="editor-page container">
      <h1>New Article</h1>
      <form method="POST" action="/editor">
        <fieldset>
          <input type="text" name="title" placeholder="Article Title" required />
          <input type="text" name="description" placeholder="What's this article about?" required />
          <textarea name="body" placeholder="Write your article (markdown)" rows={8} required />
          <input type="text" name="tags" placeholder="Tags (comma separated)" />
          <button type="submit">Publish Article</button>
        </fieldset>
      </form>
    </div>
  )
}
