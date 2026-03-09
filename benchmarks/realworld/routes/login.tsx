import type { Context } from "gorsee/server"
import { auth } from "../lib/auth.ts"
import { queryOne } from "../lib/db.ts"

export function loader() {
  return { error: "" }
}

export async function POST(ctx: Context) {
  const form = await ctx.request.formData()
  const email = String(form.get("email") ?? "")
  const password = String(form.get("password") ?? "")

  const user = queryOne<{ id: number; username: string; password_hash: string }>(
    "SELECT id, username, password_hash FROM users WHERE email = ?",
    [email],
  )

  if (!user || !Bun.password.verifySync(password, user.password_hash)) {
    return new Response(null, {
      status: 303,
      headers: { Location: "/login?error=invalid" },
    })
  }

  await auth.login(ctx, String(user.id), { username: user.username })
  return ctx.redirect("/")
}

export default function LoginPage({ data }: { data: { error: string } }) {
  const hasError = typeof window !== "undefined"
    ? location.search.includes("error=") : false

  return (
    <div class="auth-page container">
      <h1>Sign In</h1>
      <p><a href="/register">Need an account?</a></p>
      {hasError && <div class="error">Invalid email or password.</div>}
      <form method="POST" action="/login">
        <fieldset>
          <input type="email" name="email" placeholder="Email" required />
          <input type="password" name="password" placeholder="Password" required />
          <button type="submit">Sign in</button>
        </fieldset>
      </form>
    </div>
  )
}
