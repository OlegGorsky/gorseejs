# Gorsee.js Realworld (Conduit) Benchmark

A Medium.com clone built with Gorsee.js, following the [Realworld spec](https://github.com/gothinkster/realworld).

Demonstrates: file-based routing, SSR, islands architecture, auth, guards, middleware, SQLite, signals.

## Setup

```bash
bun install
bun run seed    # creates realworld.db with sample data
bun run dev     # starts dev server at http://localhost:3000
```

## Production

```bash
bun run build
bun run start
bun run bench:artifact
```

## Features

- Home page with article feed, pagination, tag filtering
- User registration and login (session-based auth)
- Article CRUD (create, read, update)
- Comments on articles
- Favorite articles (island with client-side reactivity)
- Follow users (island with client-side reactivity)
- User profiles and settings
- API endpoints (health, favorite, follow, comment)

## Sample accounts

After seeding, use any of these with password `password123`:
- jake@example.com
- jane@example.com
- bob@example.com
