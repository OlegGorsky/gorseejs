import { Database } from "bun:sqlite"
import { readFileSync } from "fs"

const db = new Database("./realworld.db")
db.run("PRAGMA journal_mode=WAL;")

// Run migration
const migration = readFileSync("./migrations/001_init.sql", "utf-8")
db.exec(migration)

// Hash password (simple for benchmark -- use proper bcrypt in production)
const hash = (pw: string) =>
  Bun.password.hashSync(pw, { algorithm: "bcrypt", cost: 4 })

// Seed users
const users = [
  { username: "jake", email: "jake@example.com", bio: "I work at statefarm" },
  { username: "jane", email: "jane@example.com", bio: "Full-stack developer" },
  { username: "bob", email: "bob@example.com", bio: "Blogger and writer" },
]
for (const u of users) {
  db.run(
    "INSERT OR IGNORE INTO users (username, email, password_hash, bio) VALUES (?, ?, ?, ?)",
    [u.username, u.email, hash("password123"), u.bio],
  )
}

// Seed tags
const tagNames = ["typescript", "gorsee", "javascript", "webdev", "tutorial"]
for (const name of tagNames) {
  db.run("INSERT OR IGNORE INTO tags (name) VALUES (?)", [name])
}

// Seed articles
const articles = [
  { title: "Getting Started with Gorsee.js", desc: "A beginner guide", author: 1 },
  { title: "TypeScript Best Practices", desc: "Write better TS", author: 1 },
  { title: "Building Islands Architecture", desc: "Partial hydration guide", author: 2 },
  { title: "Server-Side Rendering Deep Dive", desc: "SSR explained", author: 2 },
  { title: "Reactive Signals in 2026", desc: "Modern reactivity", author: 3 },
  { title: "File-Based Routing Patterns", desc: "Route organization", author: 1 },
  { title: "Auth in Web Frameworks", desc: "Session management", author: 3 },
  { title: "SQLite for Web Apps", desc: "Embedded databases", author: 2 },
  { title: "Branded Types for Safety", desc: "Type-level guarantees", author: 1 },
  { title: "Full-Stack TypeScript", desc: "End-to-end TS", author: 3 },
]
for (const a of articles) {
  const slug = a.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const body = `# ${a.title}\n\n${a.desc}. This is sample content for the Realworld benchmark.`
  db.run(
    "INSERT OR IGNORE INTO articles (slug, title, description, body, author_id) VALUES (?, ?, ?, ?, ?)",
    [slug, a.title, a.desc, body, a.author],
  )
}

// Seed article_tags (assign 2 tags per article)
for (let i = 1; i <= 10; i++) {
  db.run("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)", [i, ((i - 1) % 5) + 1])
  db.run("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)", [i, ((i) % 5) + 1])
}

// Seed some favorites and follows
db.run("INSERT OR IGNORE INTO favorites (user_id, article_id) VALUES (1, 3)")
db.run("INSERT OR IGNORE INTO favorites (user_id, article_id) VALUES (1, 5)")
db.run("INSERT OR IGNORE INTO favorites (user_id, article_id) VALUES (2, 1)")
db.run("INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (1, 2)")
db.run("INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (2, 3)")

// Seed comments
db.run("INSERT OR IGNORE INTO comments (id, body, article_id, author_id) VALUES (1, 'Great article!', 1, 2)")
db.run("INSERT OR IGNORE INTO comments (id, body, article_id, author_id) VALUES (2, 'Very helpful, thanks.', 1, 3)")
db.run("INSERT OR IGNORE INTO comments (id, body, article_id, author_id) VALUES (3, 'Nice write-up.', 3, 1)")

db.close()
console.log("Database seeded successfully!")
