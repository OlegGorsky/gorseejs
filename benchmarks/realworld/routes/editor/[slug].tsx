import type { Context } from "gorsee/server"
import { requireAuth } from "gorsee/server"
import { run, queryOne, query } from "../../lib/db.ts"
import { currentUserId } from "../../lib/auth.ts"

export const guard = requireAuth("/login")

interface Article {
  id: number; slug: string; title: string; description: string; body: string
  author_id: number
}

export function loader(ctx: Context) {
  const { slug } = ctx.params
  const article = queryOne<Article>("SELECT * FROM articles WHERE slug = ?", [slug])
  const tags = article
    ? query<{ name: string }>(
        "SELECT t.name FROM tags t JOIN article_tags at2 ON t.id = at2.tag_id WHERE at2.article_id = ?",
        [article.id],
      )
    : []
  return { article, tagString: tags.map((t) => t.name).join(", ") }
}

export async function POST(ctx: Context) {
  const userId = currentUserId(ctx)
  if (!userId) return ctx.redirect("/login")

  const { slug } = ctx.params
  const article = queryOne<Article>("SELECT * FROM articles WHERE slug = ?", [slug])
  if (!article || article.author_id !== userId) return ctx.redirect("/")

  const form = await ctx.request.formData()
  const title = String(form.get("title") ?? "")
  const description = String(form.get("description") ?? "")
  const body = String(form.get("body") ?? "")
  const newSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")

  run(
    "UPDATE articles SET slug=?, title=?, description=?, body=?, updated_at=datetime('now') WHERE id=?",
    [newSlug, title, description, body, article.id],
  )

  return ctx.redirect(`/article/${newSlug}`)
}

type LoaderData = ReturnType<typeof loader>

export default function EditArticlePage({ data }: { data: LoaderData }) {
  const { article, tagString } = data
  if (!article) return <div class="container"><h2>Article not found</h2></div>

  return (
    <div class="editor-page container">
      <h1>Edit Article</h1>
      <form method="POST" action={`/editor/${article.slug}`}>
        <fieldset>
          <input type="text" name="title" placeholder="Article Title" value={article.title} required />
          <input type="text" name="description" placeholder="Description" value={article.description} required />
          <textarea name="body" placeholder="Write your article" rows={8} required>{article.body}</textarea>
          <input type="text" name="tags" placeholder="Tags (comma separated)" value={tagString} />
          <button type="submit">Update Article</button>
        </fieldset>
      </form>
    </div>
  )
}
