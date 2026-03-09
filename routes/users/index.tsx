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

export function load() {
  return {
    users: db.all<User>(SafeSQL`SELECT * FROM users ORDER BY name`),
  }
}

export default function UsersPage(props: { data: { users: User[] } }) {
  const users = props.data?.users ?? []

  return (
    <div>
      <h1>Users</h1>
      <ul>
        {users.map((u) => (
          <li>
            <a href={`/users/${u.id}`}>{u.name} ({u.role})</a>
          </li>
        ))}
      </ul>
      <p><a href="/">Back to home</a></p>
    </div>
  )
}
