import type { Context } from "gorsee/server"
import { query, queryOne } from "../../lib/db.ts"
import { currentUserId } from "../../lib/auth.ts"

interface ArticleDetail {
  id: number; slug: string; title: string; description: string; body: string
  author_id: number; username: string; image: string; bio: string
  created_at: string; favCount: number
}
interface Comment {
  id: number; body: string; username: string; image: string; created_at: string
}
interface Tag { name: string }

export function loader(ctx: Context) {
  const { slug } = ctx.params
  const article = queryOne<ArticleDetail>(`
    SELECT a.*, u.username, u.image, u.bio,
      (SELECT COUNT(*) FROM favorites f WHERE f.article_id = a.id) as favCount
    FROM articles a JOIN users u ON a.author_id = u.id WHERE a.slug = ?
  `, [slug])

  if (!article) return { article: null, comments: [], tags: [], userId: null }

  const comments = query<Comment>(`
    SELECT c.*, u.username, u.image FROM comments c
    JOIN users u ON c.author_id = u.id WHERE c.article_id = ?
    ORDER BY c.created_at DESC
  `, [article.id])

  const tags = query<Tag>(`
    SELECT t.name FROM tags t
    JOIN article_tags at2 ON t.id = at2.tag_id WHERE at2.article_id = ?
  `, [article.id])

  const userId = currentUserId(ctx)
  return { article, comments, tags, userId }
}

type LoaderData = ReturnType<typeof loader>

export default function ArticlePage({ data }: { data: LoaderData }) {
  const { article, comments, tags, userId } = data
  if (!article) return <div class="container"><h2>Article not found</h2></div>

  return (
    <div class="article-page">
      <div class="banner">
        <div class="container">
          <h1>{article.title}</h1>
          <div class="article-meta">
            <a href={`/profile/${article.username}`}>{article.username}</a>
            <span class="date">{article.created_at}</span>
            <span class="fav-count">{article.favCount} favorites</span>
            {userId === article.author_id && (
              <a href={`/editor/${article.slug}`} class="btn-edit">Edit</a>
            )}
          </div>
        </div>
      </div>
      <div class="container">
        <div class="article-body">
          <p>{article.body}</p>
        </div>
        <div class="tag-list">
          {tags.map((t) => <span class="tag" key={t.name}>{t.name}</span>)}
        </div>
        <hr />
        <div class="comments">
          <h3>Comments</h3>
          {userId && (
            <form method="POST" action={`/api/comment?articleId=${article.id}`}>
              <textarea name="body" placeholder="Write a comment..." rows={3} />
              <button type="submit">Post Comment</button>
            </form>
          )}
          {comments.map((c) => (
            <div class="comment" key={c.id}>
              <div class="comment-meta">
                <a href={`/profile/${c.username}`}>{c.username}</a>
                <span class="date">{c.created_at}</span>
              </div>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
