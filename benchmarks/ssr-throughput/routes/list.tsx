// List page -- 100 items with loader data

export function loader() {
  return {
    items: Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      label: `Item #${i + 1}`,
    })),
  }
}

interface Props {
  data: ReturnType<typeof loader>
}

export default function ListPage({ data }: Props) {
  return (
    <main>
      <h1>Item List</h1>
      <ul>
        {data.items.map((item) => (
          <li key={String(item.id)}>
            <span class="item-label">{item.label}</span>
            <span class="item-id">#{item.id}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
