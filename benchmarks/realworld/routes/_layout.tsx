import type { Context } from "gorsee/server"

export default function Layout({ children, ctx }: { children: unknown; ctx?: Context }) {
  const session = ctx?.locals.session as { userId: string; data: { username?: string } } | undefined
  const username = session?.data?.username

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Conduit - Gorsee.js</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <nav class="navbar">
          <div class="container">
            <a class="brand" href="/">conduit</a>
            <ul class="nav-links">
              <li><a href="/">Home</a></li>
              {username ? (
                <>
                  <li><a href="/editor">New Article</a></li>
                  <li><a href="/settings">Settings</a></li>
                  <li><a href={`/profile/${username}`}>{username}</a></li>
                </>
              ) : (
                <>
                  <li><a href="/login">Sign in</a></li>
                  <li><a href="/register">Sign up</a></li>
                </>
              )}
            </ul>
          </div>
        </nav>
        <main>{children}</main>
        <footer class="footer">
          <div class="container">
            <a class="brand" href="/">conduit</a>
            <span>Gorsee.js Realworld benchmark</span>
          </div>
        </footer>
      </body>
    </html>
  )
}
