import { createSignal, Head, Link } from "gorsee/client"

export default function HomePage() {
  const [count, setCount] = createSignal(0)

  return (
    <div>
      <Head>
        <title>My Gorsee App</title>
        <meta name="description" content="Built with Gorsee.js" />
      </Head>
      <h1>My Gorsee App</h1>
      <p>Edit routes/index.tsx to get started.</p>
      <nav>
        <Link href="/">Home</Link> | <Link href="/about">About</Link>
      </nav>
      <div>
        <button on:click={() => setCount((c: number) => c + 1)}>Count: {count}</button>
      </div>
    </div>
  )
}
