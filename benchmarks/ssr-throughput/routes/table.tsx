// Table page -- 100 rows x 5 columns with loader data

export function loader() {
  return {
    rows: Array.from({ length: 100 }, (_, r) => ({
      id: r + 1,
      cells: Array.from({ length: 5 }, (_, c) => `R${r + 1}C${c + 1}`),
    })),
  }
}

interface Props {
  data: ReturnType<typeof loader>
}

export default function TablePage({ data }: Props) {
  return (
    <main>
      <h1>Data Table</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Col 1</th>
            <th>Col 2</th>
            <th>Col 3</th>
            <th>Col 4</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={String(row.id)}>
              <td>{row.id}</td>
              {row.cells.map((cell, i) => (
                <td key={String(i)}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
