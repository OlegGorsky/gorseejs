import { SafeSQL } from "gorsee/types"
import { createDB } from "gorsee/db"

interface User {
  id: number
  name: string
  role: string
}

const db = createDB(":memory:")
db.run(SafeSQL`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, role TEXT)`)
db.run(SafeSQL`INSERT OR IGNORE INTO users (id, name, role) VALUES (${1}, ${"Alice"}, ${"admin"})`)
db.run(SafeSQL`INSERT OR IGNORE INTO users (id, name, role) VALUES (${2}, ${"Bob"}, ${"user"})`)
db.run(SafeSQL`INSERT OR IGNORE INTO users (id, name, role) VALUES (${3}, ${"Charlie"}, ${"user"})`)

export function load(ctx: { params: Record<string, string> }) {
  const user = db.get<User>(SafeSQL`SELECT * FROM users WHERE id = ${Number(ctx.params.id)}`)
  return { user }
}

export default function UserPage(props: { data: { user: User | null }; params: { id: string } }) {
  const user = props.data?.user

  if (!user) {
    return (
      <div>
        <h1>User not found</h1>
        <a href="/users">Back to users</a>
      </div>
    )
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <dl>
        <dt>ID</dt>
        <dd>{String(user.id)}</dd>
        <dt>Role</dt>
        <dd>{user.role}</dd>
      </dl>
      <a href="/users">Back to users</a>
    </div>
  )
}
