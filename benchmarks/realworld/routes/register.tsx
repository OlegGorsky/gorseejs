import type { Context } from "gorsee/server"
import { auth } from "../lib/auth.ts"
import { queryOne, run } from "../lib/db.ts"

export function loader() {
  return { error: "" }
}

export async function POST(ctx: Context) {
  const form = await ctx.request.formData()
  const username = String(form.get("username") ?? "")
  const email = String(form.get("email") ?? "")
  const password = String(form.get("password") ?? "")

  const existing = queryOne<{ id: number }>(
    "SELECT id FROM users WHERE email = ? OR username = ?",
    [email, username],
  )
  if (existing) {
    return new Response(null, {
      status: 303,
      headers: { Location: "/register?error=exists" },
    })
  }

  const hash = Bun.password.hashSync(password, { algorithm: "bcrypt", cost: 4 })
  run("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", [username, email, hash])

  const user = queryOne<{ id: number }>("SELECT id FROM users WHERE email = ?", [email])
  if (user) {
    await auth.login(ctx, String(user.id), { username })
  }
  return ctx.redirect("/")
}

export default function RegisterPage() {
  const hasError = typeof window !== "undefined"
    ? location.search.includes("error=") : false

  return (
    <div class="auth-page container">
      <h1>Sign Up</h1>
      <p><a href="/login">Have an account?</a></p>
      {hasError && <div class="error">Username or email already taken.</div>}
      <form method="POST" action="/register">
        <fieldset>
          <input type="text" name="username" placeholder="Username" required />
          <input type="email" name="email" placeholder="Email" required />
          <input type="password" name="password" placeholder="Password" required />
          <button type="submit">Sign up</button>
        </fieldset>
      </form>
    </div>
  )
}
