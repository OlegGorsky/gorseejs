export default function RootLayout(props: { children: unknown }) {
  return (
    <div class="layout">
      <header>
        <nav class="main-nav">
          <strong>Gorsee App</strong>
        </nav>
      </header>
      <main>{props.children}</main>
      <footer>
        <p>Built with Gorsee.js</p>
      </footer>
    </div>
  )
}
