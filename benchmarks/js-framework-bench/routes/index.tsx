import { createSignal, island } from "gorsee/client"

const adjectives = [
  "pretty", "large", "big", "small", "tall", "short", "long", "handsome",
  "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful",
  "mushy", "odd", "unsightly", "adorable",
]
const colours = [
  "red", "yellow", "blue", "green", "pink",
  "brown", "purple", "orange", "white", "black",
]
const nouns = [
  "table", "chair", "house", "bbq", "desk", "car", "pony", "cookie",
  "sandwich", "burger", "pizza", "mouse", "keyboard", "monitor", "speaker",
  "phone", "laptop", "camera", "book", "pencil",
]

function random(max: number) {
  return (Math.random() * max) | 0
}

let nextId = 1

function buildData(count: number) {
  const data = new Array(count)
  for (let i = 0; i < count; i++) {
    data[i] = {
      id: nextId++,
      label: `${adjectives[random(adjectives.length)]} ${colours[random(colours.length)]} ${nouns[random(nouns.length)]}`,
    }
  }
  return data
}

type Row = { id: number; label: string }

function BenchmarkApp() {
  const [data, setData] = createSignal<Row[]>([])
  const [selected, setSelected] = createSignal<number | null>(null)

  const run = () => setData(buildData(1000))
  const runLots = () => setData(buildData(10000))
  const add = () => setData((prev) => [...prev, ...buildData(1000)])

  const update = () =>
    setData((prev) =>
      prev.map((row, i) =>
        i % 10 === 0 ? { ...row, label: row.label + " !!!" } : row,
      ),
    )

  const clear = () => setData([])

  const swapRows = () =>
    setData((prev) => {
      if (prev.length < 999) return prev
      const next = [...prev]
      const tmp = next[1]
      next[1] = next[998]
      next[998] = tmp
      return next
    })

  const select = (id: number) => setSelected(id)

  const remove = (id: number) =>
    setData((prev) => prev.filter((row) => row.id !== id))

  const buttons: [string, string, () => void][] = [
    ["run", "Create 1,000 rows", run],
    ["runlots", "Create 10,000 rows", runLots],
    ["add", "Append 1,000 rows", add],
    ["update", "Update every 10th row", update],
    ["clear", "Clear", clear],
    ["swaprows", "Swap Rows", swapRows],
  ]

  return (
    <div>
      <div class="jumbotron">
        <h1>Gorsee.js -- DOM Benchmark</h1>
      </div>
      <div class="btn-toolbar">
        {buttons.map(([id, label, handler]) => (
          <button id={id} class="btn" onclick={handler}>
            {label}
          </button>
        ))}
      </div>
      <table>
        <tbody id="tbody">
          {() => {
            const rows = data()
            const sel = selected()
            return rows.map((row) => (
              <tr class={row.id === sel ? "danger" : ""}>
                <td>{row.id}</td>
                <td>
                  <a onclick={() => select(row.id)}>{row.label}</a>
                </td>
                <td>
                  <button class="remove-btn" onclick={() => remove(row.id)}>
                    x
                  </button>
                </td>
              </tr>
            ))
          }}
        </tbody>
      </table>
    </div>
  )
}

export default island(BenchmarkApp)
