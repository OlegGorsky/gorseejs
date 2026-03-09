// Simple baseline page -- minimal elements for SSR throughput floor

export default function IndexPage() {
  return (
    <main>
      <h1>Gorsee.js Benchmark</h1>
      <p>
        A full-stack TypeScript framework designed for human + AI collaboration.
      </p>
      <p>Safe by default, predictable by design, complete out of the box.</p>
      <nav>
        <a href="/list">List</a>
        <a href="/table">Table</a>
        <a href="/nested">Nested</a>
      </nav>
    </main>
  )
}
