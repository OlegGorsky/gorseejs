import { createSignal, Head, Link } from "gorsee/client"

export const prerender = true

export default function HomePage() {
  const [count, setCount] = createSignal(0)

  return (
    <section>
      <Head>
        <title>Gorsee Frontend Example</title>
        <meta name="description" content="Browser-first frontend app built with Gorsee.js" />
      </Head>
      <h1>Frontend-First Gorsee Example</h1>
      <p>Static, browser-first, and ready for CDN-style deployment.</p>
      <nav>
        <Link href="/">Home</Link> | <Link href="/about">About</Link>
      </nav>
      <button on:click={() => setCount((value: number) => value + 1)}>Clicks: {count()}</button>
    </section>
  )
}
