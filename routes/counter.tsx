import { createSignal } from "gorsee/client"
import { server } from "gorsee/server"

// Server function -- runs on server, called via RPC from client
const saveCount = server(async (count: number) => {
  console.log(`[server] Count saved: ${count}`)
  return { saved: true, count }
})

export default function CounterPage() {
  const [count, setCount] = createSignal(0)
  const [status, setStatus] = createSignal("")

  const increment = () => setCount((c: number) => c + 1)
  const decrement = () => setCount((c: number) => c - 1)

  const save = async () => {
    setStatus("Saving...")
    const result = await saveCount(count())
    setStatus(`Saved! (count: ${result.count})`)
  }

  return (
    <div>
      <h1>Interactive Counter</h1>
      <p>This page demonstrates client-side reactivity + server() functions.</p>
      <div>
        <button on:click={decrement}>-</button>
        <span style={{ padding: "0 1rem", "font-size": "1.5rem" }}>{count}</span>
        <button on:click={increment}>+</button>
      </div>
      <div style={{ "margin-top": "1rem" }}>
        <button on:click={save}>Save to Server</button>
        <span style={{ "margin-left": "0.5rem" }}>{status}</span>
      </div>
      <nav>
        <a href="/">Home</a>
      </nav>
    </div>
  )
}
