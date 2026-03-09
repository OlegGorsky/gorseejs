import type { Context } from "gorsee/server"
import { requireAuth } from "gorsee/server"
import { run, queryOne } from "../lib/db.ts"
import { currentUserId } from "../lib/auth.ts"

export const guard = requireAuth("/login")

interface User { id: number; username: string; email: string; bio: string; image: string }

export function loader(ctx: Context) {
  const userId = currentUserId(ctx)
  if (!userId) return { user: null }
  const user = queryOne<User>("SELECT id, username, email, bio, image FROM users WHERE id = ?", [userId])
  return { user }
}

export async function POST(ctx: Context) {
  const userId = currentUserId(ctx)
  if (!userId) return ctx.redirect("/login")

  const form = await ctx.request.formData()
  const image = String(form.get("image") ?? "")
  const username = String(form.get("username") ?? "")
  const bio = String(form.get("bio") ?? "")
  const email = String(form.get("email") ?? "")
  const password = String(form.get("password") ?? "")

  run("UPDATE users SET image=?, username=?, bio=?, email=? WHERE id=?", [image, username, bio, email, userId])

  if (password) {
    const hash = Bun.password.hashSync(password, { algorithm: "bcrypt", cost: 4 })
    run("UPDATE users SET password_hash=? WHERE id=?", [hash, userId])
  }

  return ctx.redirect(`/profile/${username}`)
}

type LoaderData = ReturnType<typeof loader>

export default function SettingsPage({ data }: { data: LoaderData }) {
  const { user } = data
  if (!user) return <div class="container"><h2>Not logged in</h2></div>

  return (
    <div class="settings-page container">
      <h1>Your Settings</h1>
      <form method="POST" action="/settings">
        <fieldset>
          <input type="text" name="image" placeholder="URL of profile picture" value={user.image} />
          <input type="text" name="username" placeholder="Username" value={user.username} required />
          <textarea name="bio" placeholder="Short bio about you" rows={4}>{user.bio}</textarea>
          <input type="email" name="email" placeholder="Email" value={user.email} required />
          <input type="password" name="password" placeholder="New password (leave blank to keep)" />
          <button type="submit">Update Settings</button>
        </fieldset>
      </form>
    </div>
  )
}
