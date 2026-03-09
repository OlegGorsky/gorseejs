import type { Context } from "gorsee/server"
import { query, queryOne } from "../../lib/db.ts"
import { currentUserId } from "../../lib/auth.ts"

interface User { id: number; username: string; bio: string; image: string }
interface Article {
  id: number; slug: string; title: string; description: string
  created_at: string; favCount: number
}

export function loader(ctx: Context) {
  const { username } = ctx.params
  const user = queryOne<User>("SELECT * FROM users WHERE username = ?", [username])
  if (!user) return { user: null, articles: [], isFollowing: false, userId: null }

  const articles = query<Article>(`
    SELECT a.*, (SELECT COUNT(*) FROM favorites f WHERE f.article_id = a.id) as favCount
    FROM articles a WHERE a.author_id = ? ORDER BY a.created_at DESC
  `, [user.id])

  const userId = currentUserId(ctx)
  const isFollowing = userId
    ? !!queryOne("SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?", [userId, user.id])
    : false

  return { user, articles, isFollowing, userId }
}

type LoaderData = ReturnType<typeof loader>

export default function ProfilePage({ data }: { data: LoaderData }) {
  const { user, articles, isFollowing, userId } = data
  if (!user) return <div class="container"><h2>User not found</h2></div>

  return (
    <div class="profile-page">
      <div class="user-info">
        <div class="container">
          {user.image && <img src={user.image} alt={user.username} class="avatar" />}
          <h2>{user.username}</h2>
          <p>{user.bio}</p>
          {userId && userId !== user.id && (
            <form method="POST" action="/api/follow">
              <input type="hidden" name="followedId" value={String(user.id)} />
              <button type="submit" class="btn-follow">
                {isFollowing ? "Unfollow" : "Follow"} {user.username}
              </button>
            </form>
          )}
        </div>
      </div>
      <div class="container">
        <h3>Articles by {user.username}</h3>
        {articles.map((a) => (
          <div class="article-preview" key={a.slug}>
            <a href={`/article/${a.slug}`}>
              <h2>{a.title}</h2>
              <p>{a.description}</p>
            </a>
            <span class="date">{a.created_at}</span>
            <span class="fav-count">{a.favCount} favorites</span>
          </div>
        ))}
        {articles.length === 0 && <p>No articles yet.</p>}
      </div>
    </div>
  )
}
