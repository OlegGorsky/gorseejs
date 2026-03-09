export default function RootLayout(props: { children: unknown }) {
  return (
    <div>
      <header style={{ "border-bottom": "1px solid #eee", "padding-bottom": "1rem", "margin-bottom": "1rem" }}>
        <strong>Gorsee.js</strong>
        <nav style={{ "margin-top": "0.5rem" }}>
          <a href="/">Home</a>
          {" | "}
          <a href="/counter">Counter</a>
          {" | "}
          <a href="/users">Users</a>
          {" | "}
          <a href="/api/health">API</a>
        </nav>
      </header>
      <main>{props.children}</main>
      <footer style={{ "margin-top": "2rem", "border-top": "1px solid #eee", "padding-top": "1rem", color: "#888" }}>
        Built with Gorsee.js v0.1
      </footer>
    </div>
  )
}
