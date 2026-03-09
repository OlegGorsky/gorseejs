import type { Context } from "gorsee/server"
import { query } from "../lib/db.ts"
import { currentUserId } from "../lib/auth.ts"

interface Article {
  id: number; slug: string; title: string; description: string
  username: string; image: string; created_at: string; favCount: number
}
interface Tag { name: string }

export function loader(ctx: Context) {
  const page = Number(ctx.url.searchParams.get("page") ?? "1")
  const tag = ctx.url.searchParams.get("tag")
  const limit = 10
  const offset = (page - 1) * limit
  const userId = currentUserId(ctx)

  let articleQuery = `
    SELECT a.*, u.username, u.image,
      (SELECT COUNT(*) FROM favorites f WHERE f.article_id = a.id) as favCount
    FROM articles a JOIN users u ON a.author_id = u.id
  `
  const params: unknown[] = []
  if (tag) {
    articleQuery += ` WHERE a.id IN (SELECT at2.article_id FROM article_tags at2
      JOIN tags t ON t.id = at2.tag_id WHERE t.name = ?)`
    params.push(tag)
  }
  articleQuery += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const articles = query<Article>(articleQuery, params)
  const tags = query<Tag>("SELECT name FROM tags ORDER BY name")
  const totalRow = query<{ cnt: number }>("SELECT COUNT(*) as cnt FROM articles")
  const total = totalRow[0]?.cnt ?? 0

  return { articles, tags, page, totalPages: Math.ceil(total / limit), tag, userId }
}

type LoaderData = ReturnType<typeof loader>

export default function HomePage({ data }: { data: LoaderData }) {
  const { articles, tags, page, totalPages, tag } = data

  return (
    <div class="home-page">
      <div class="banner">
        <div class="container">
          <h1>conduit</h1>
          <p>A place to share your knowledge.</p>
        </div>
      </div>
      <div class="container page-content">
        <div class="feed">
          {tag && <h3 class="tag-filter">Filtered by: #{tag}</h3>}
          {articles.map((a) => (
            <div class="article-preview" key={a.slug}>
              <div class="article-meta">
                <a href={`/profile/${a.username}`}>{a.username}</a>
                <span class="date">{a.created_at}</span>
                <span class="fav-count">{a.favCount}</span>
              </div>
              <a href={`/article/${a.slug}`}>
                <h2>{a.title}</h2>
                <p>{a.description}</p>
              </a>
            </div>
          ))}
          {articles.length === 0 && <p>No articles yet.</p>}
          <div class="pagination">
            {page > 1 && <a href={`/?page=${page - 1}`}>Prev</a>}
            <span>Page {page} of {totalPages}</span>
            {page < totalPages && <a href={`/?page=${page + 1}`}>Next</a>}
          </div>
        </div>
        <div class="sidebar">
          <h3>Popular Tags</h3>
          <div class="tag-list">
            {tags.map((t) => (
              <a href={`/?tag=${t.name}`} class="tag" key={t.name}>
                {t.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
