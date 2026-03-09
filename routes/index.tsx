import { createSignal } from "gorsee/client"

export default function HomePage() {
  const [count, setCount] = createSignal(0)

  return (
    <div>
      <h1>Welcome to Gorsee.js</h1>
      <p>Full-stack TypeScript framework for human + AI collaboration.</p>
      <div>
        <p>Counter: {count}</p>
        <button on:click={() => setCount((c: number) => c + 1)}>+1</button>
        <button on:click={() => setCount(0)}>Reset</button>
      </div>
      <nav>
        <a href="/users">Users</a>
        {" | "}
        <a href="/api/health">Health API</a>
      </nav>
    </div>
  )
}
