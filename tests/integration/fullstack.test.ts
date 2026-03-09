import { describe, test, expect } from "bun:test"
import { createSignal } from "../../src/reactive/signal.ts"
import { createComputed } from "../../src/reactive/computed.ts"
import { ssrJsx as h, renderToString } from "../../src/runtime/server.ts"
import { SafeSQL } from "../../src/types/safe-sql.ts"
import { sanitize } from "../../src/types/safe-html.ts"
import { createDB } from "../../src/db/sqlite.ts"
import { GorseeError, formatError } from "../../src/errors/formatter.ts"

describe("Full-stack integration", () => {
  test("component with signals renders to HTML", () => {
    const [count] = createSignal(0)
    const doubled = createComputed(() => count() * 2)

    function Counter() {
      return h("div", {
        children: [
          h("p", { children: ["Count: ", count] }),
          h("p", { children: ["Doubled: ", doubled] }),
        ],
      })
    }

    const html = renderToString(h(Counter as any, {}))
    expect(html).toBe("<div><p>Count: 0</p><p>Doubled: 0</p></div>")
  })

  test("server function + db query + SSR", () => {
    const db = createDB(":memory:")
    db.run(SafeSQL`CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)`)
    db.run(SafeSQL`INSERT INTO posts (title) VALUES (${"Hello World"})`)
    db.run(SafeSQL`INSERT INTO posts (title) VALUES (${"Second Post"})`)

    const posts = db.all<{ id: number; title: string }>(
      SafeSQL`SELECT * FROM posts ORDER BY id`
    )

    function PostList(props: { posts: { id: number; title: string }[] }) {
      return h("ul", {
        children: props.posts.map((p) =>
          h("li", { children: sanitize(p.title) as unknown as string })
        ),
      })
    }

    const html = renderToString(h(PostList as any, { posts }))
    expect(html).toBe("<ul><li>Hello World</li><li>Second Post</li></ul>")

    db.close()
  })

  test("layout + page composition", () => {
    function Layout(props: { children: unknown }) {
      return h("html", {
        children: [
          h("head", { children: h("title", { children: "My App" }) }),
          h("body", { children: props.children }),
        ],
      })
    }

    function Header() {
      return h("nav", { children: h("a", { href: "/", children: "Home" }) })
    }

    function Page() {
      return h(Layout as any, {
        children: [
          h(Header as any, {}),
          h("main", { children: h("h1", { children: "Welcome" }) }),
        ],
      })
    }

    const html = renderToString(h(Page as any, {}))
    expect(html).toBe(
      '<html><head><title>My App</title></head>' +
      '<body><nav><a href="/">Home</a></nav>' +
      "<main><h1>Welcome</h1></main></body></html>"
    )
  })

  test("layout + page composition preserves lazy children thunks", () => {
    function Layout(props: { children: unknown }) {
      return h("div", {
        class: "layout",
        children: [
          h("header", { children: "Shell" }),
          props.children,
        ],
      })
    }

    function Page() {
      return h(Layout as any, {
        children: () => h("main", { children: h("h1", { children: "Deferred" }) }),
      })
    }

    const html = renderToString(h(Page as any, {}))
    expect(html).toBe('<div class="layout"><header>Shell</header><main><h1>Deferred</h1></main></div>')
  })

  test("error formatting with AI context", () => {
    const err = new GorseeError("E001", {
      filePath: "routes/users/[id].tsx",
      line: 15,
    })

    const formatted = formatError(err)
    expect(formatted.json.code).toBe("E001")
    expect(formatted.json.file).toBe("routes/users/[id].tsx")
    expect(formatted.json.line).toBe(15)
    expect(formatted.human).toContain("GORSEE E001")
    expect(formatted.human).toContain("SafeSQL violation")
    expect(formatted.human).toContain("AI context")
  })

  test("conditional rendering with signals", () => {
    const [loggedIn] = createSignal(true)
    const [username] = createSignal("Alice")

    function UserBadge() {
      // Resolve signals at render time for SSR
      if (loggedIn()) {
        return h("span", { class: "badge", children: username })
      }
      return h("a", { href: "/login", children: "Log in" })
    }

    const html = renderToString(h(UserBadge as any, {}))
    expect(html).toBe('<span class="badge">Alice</span>')
  })

  test("list rendering with map", () => {
    const items = ["TypeScript", "Signals", "SSR"]

    function FeatureList() {
      return h("ul", {
        children: items.map((item, i) =>
          h("li", { children: `${i + 1}. ${item}` })
        ),
      })
    }

    const html = renderToString(h(FeatureList as any, {}))
    expect(html).toBe(
      "<ul><li>1. TypeScript</li><li>2. Signals</li><li>3. SSR</li></ul>"
    )
  })
})
