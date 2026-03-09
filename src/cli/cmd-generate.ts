// gorsee generate <entity> -- scaffold CRUD routes + migration
// Example: gorsee generate posts -> routes/posts/index.tsx, routes/posts/[id].tsx, etc.

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createMigration } from "../db/migrate.ts"
import { createProjectContext, type RuntimeOptions } from "../runtime/project.ts"

export type GenerateDataMode = "memory" | "sqlite" | "postgres"

export interface GenerateFlags {
  entity: string | null
  data: GenerateDataMode | null
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function singularize(s: string): string {
  if (s.endsWith("ies")) return s.slice(0, -3) + "y"
  if (s.endsWith("ses") || s.endsWith("xes") || s.endsWith("zes")) return s.slice(0, -2)
  if (s.endsWith("s") && !s.endsWith("ss")) return s.slice(0, -1)
  return s
}

function repoImportPath(entity: string): string {
  return `../../shared/${entity}.ts`
}

export function parseGenerateFlags(args: string[]): GenerateFlags {
  const positional: string[] = []
  let data: GenerateDataMode | null = null

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--data" && args[index + 1]) {
      const value = args[++index]
      if (value === "memory" || value === "sqlite" || value === "postgres") data = value
      continue
    }
    positional.push(arg!)
  }

  return {
    entity: positional[0] ?? null,
    data,
  }
}

async function inferGenerateDataMode(cwd: string): Promise<GenerateDataMode> {
  try {
    const appConfig = await readFile(join(cwd, "app.config.ts"), "utf-8")
    if (/driver\s*:\s*"postgres"/.test(appConfig) || /driver\s*:\s*'postgres'/.test(appConfig)) {
      return "postgres"
    }
    if (/driver\s*:\s*"sqlite"/.test(appConfig) || /driver\s*:\s*'sqlite'/.test(appConfig)) {
      return "sqlite"
    }
  } catch {
    // keep fallback
  }

  return "memory"
}

function listRoute(entity: string, singular: string): string {
  const cap = capitalize(singular)
  const routesName = `${singular}Routes`
  return `import { Head, Link } from "gorsee/client"
import { list${cap}s, ${routesName} } from "${repoImportPath(entity)}"

export async function load() {
  return { ${entity}: await list${cap}s() }
}

export default function ${capitalize(entity)}ListPage(props: { data: { ${entity}: { id: number; title: string }[] } }) {
  return (
    <div>
      <Head><title>${capitalize(entity)}</title></Head>
      <h1>${capitalize(entity)}</h1>
      <Link href={${routesName}.create}>Create New ${cap}</Link>
      <ul>
        {props.data.${entity}.map((item) => (
          <li>
            <Link href={${routesName}.detail} params={{ id: String(item.id) }}>{item.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
`
}

function detailRoute(entity: string, singular: string): string {
  const cap = capitalize(singular)
  const routesName = `${singular}Routes`
  return `import { Head, Link } from "gorsee/client"
import { get${cap}ById, ${routesName} } from "${repoImportPath(entity)}"
import type { Context } from "gorsee/server"

export async function load(ctx: Context) {
  const id = Number(ctx.params.id)
  const ${singular} = await get${cap}ById(id)
  if (!${singular}) {
    throw new Error("${cap} not found")
  }
  return { ${singular} }
}

export default function ${cap}DetailPage(props: { data: { ${singular}: { id: number; title: string } } }) {
  const item = props.data.${singular}
  return (
    <div>
      <Head><title>{item.title}</title></Head>
      <h1>{item.title}</h1>
      <Link href={${routesName}.list}>Back to ${capitalize(entity)}</Link>
    </div>
  )
}
`
}

function newRoute(entity: string, singular: string): string {
  const cap = capitalize(singular)
  const formName = `${singular}Form`
  const routesName = `${singular}Routes`
  return `import { Head, Link } from "gorsee/client"
import { defineFormAction, fieldAttrs } from "gorsee/forms"
import { create${cap}, ${formName}, ${routesName} } from "${repoImportPath(entity)}"

export const action = defineFormAction(${formName}, async ({ ctx, data }) => {
  await create${cap}(data.title)
  return ctx.redirect(${routesName}.list.build())
})

export default function New${cap}Page() {
  const titleField = ${formName}.fields[0]!

  return (
    <div>
      <Head><title>New ${cap}</title></Head>
      <h1>New ${cap}</h1>
      <form method="POST">
        <label>
          Title:
          <input {...fieldAttrs(titleField)} />
        </label>
        <button type="submit">Create</button>
      </form>
      <Link href={${routesName}.list}>Cancel</Link>
    </div>
  )
}
`
}

function repositorySharedPrelude(entity: string, singular: string): string {
  const cap = capitalize(singular)
  const routesName = `${singular}Routes`
  const formName = `${singular}Form`
  return `import { defineForm } from "gorsee/forms"
import { createTypedRoute } from "gorsee/routes"

export interface ${cap}Record {
  id: number
  title: string
}

export const ${routesName} = {
  list: createTypedRoute("/${entity}"),
  detail: createTypedRoute("/${entity}/[id]"),
  create: createTypedRoute("/${entity}/new"),
}

export const ${formName} = defineForm<{ title: string }>([
  {
    name: "title",
    label: "Title",
    rules: {
      required: true,
      minLength: 2,
      maxLength: 120,
    },
  },
])

`
}

function repositoryMemoryModule(entity: string, singular: string): string {
  const cap = capitalize(singular)
  return `${repositorySharedPrelude(entity, singular)}const ${entity}: ${cap}Record[] = [
  { id: 1, title: "First ${cap}" },
  { id: 2, title: "Second ${cap}" },
]

export async function list${cap}s(): Promise<${cap}Record[]> {
  return ${entity}.map((item) => ({ ...item }))
}

export async function get${cap}ById(id: number): Promise<${cap}Record | undefined> {
  const item = ${entity}.find((entry) => entry.id === id)
  return item ? { ...item } : undefined
}

export async function create${cap}(title: string): Promise<${cap}Record> {
  const next: ${cap}Record = {
    id: ${entity}.length === 0 ? 1 : Math.max(...${entity}.map((item) => item.id)) + 1,
    title,
  }
  ${entity}.push(next)
  return { ...next }
}
`
}

function repositorySqliteModule(entity: string, singular: string): string {
  const cap = capitalize(singular)
  return `${repositorySharedPrelude(entity, singular)}import { createDB } from "gorsee/db"
import { SafeSQL } from "gorsee/types"

const db = createDB(process.env.DATABASE_URL ?? "./data.sqlite")

export async function list${cap}s(): Promise<${cap}Record[]> {
  return db.all<${cap}Record>(SafeSQL\`SELECT id, title FROM ${entity} ORDER BY id DESC\`)
}

export async function get${cap}ById(id: number): Promise<${cap}Record | undefined> {
  return db.get<${cap}Record>(SafeSQL\`SELECT id, title FROM ${entity} WHERE id = \${id}\`) ?? undefined
}

export async function create${cap}(title: string): Promise<${cap}Record> {
  db.run(SafeSQL\`INSERT INTO ${entity} (title) VALUES (\${title})\`)
  const created = db.get<${cap}Record>(SafeSQL\`SELECT id, title FROM ${entity} ORDER BY id DESC LIMIT 1\`)
  if (!created) {
    throw new Error("Failed to create ${singular}")
  }
  return created
}
`
}

function repositoryPostgresModule(entity: string, singular: string): string {
  const cap = capitalize(singular)
  return `${repositorySharedPrelude(entity, singular)}import { createPostgresDB, type PostgresPoolLike } from "gorsee/db"
import { SafeSQL } from "gorsee/types"

let postgresPool: PostgresPoolLike | null = null

export function configure${cap}Postgres(pool: PostgresPoolLike): void {
  postgresPool = pool
}

function getDB() {
  if (!postgresPool) {
    throw new Error("Postgres pool is not configured. Call configure${cap}Postgres() during server startup.")
  }
  return createPostgresDB(postgresPool)
}

export async function list${cap}s(): Promise<${cap}Record[]> {
  return getDB().all<${cap}Record>(SafeSQL\`SELECT id, title FROM ${entity} ORDER BY id DESC\`)
}

export async function get${cap}ById(id: number): Promise<${cap}Record | undefined> {
  return (await getDB().get<${cap}Record>(SafeSQL\`SELECT id, title FROM ${entity} WHERE id = \${id}\`)) ?? undefined
}

export async function create${cap}(title: string): Promise<${cap}Record> {
  return getDB().transaction(async (db) => {
    await db.run(SafeSQL\`INSERT INTO ${entity} (title) VALUES (\${title})\`)
    const created = await db.get<${cap}Record>(SafeSQL\`SELECT id, title FROM ${entity} ORDER BY id DESC LIMIT 1\`)
    if (!created) {
      throw new Error("Failed to create ${singular}")
    }
    return created
  })
}
`
}

function repositoryModule(entity: string, singular: string, mode: GenerateDataMode): string {
  switch (mode) {
    case "sqlite":
      return repositorySqliteModule(entity, singular)
    case "postgres":
      return repositoryPostgresModule(entity, singular)
    default:
      return repositoryMemoryModule(entity, singular)
  }
}

function migrationSQL(entity: string, mode: GenerateDataMode): string {
  if (mode === "postgres") {
    return `-- Create ${entity} table
CREATE TABLE IF NOT EXISTS ${entity} (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`
  }

  return `-- Create ${entity} table
CREATE TABLE IF NOT EXISTS ${entity} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`
}

export interface GenerateCommandOptions extends RuntimeOptions {}

export async function generateCrudScaffold(args: string[], options: GenerateCommandOptions = {}) {
  const flags = parseGenerateFlags(args)
  const entity = flags.entity
  if (!entity) {
    console.error("Usage: gorsee generate <entity-name> [--data memory|sqlite|postgres]")
    console.error("Example: gorsee generate posts --data sqlite")
    process.exit(1)
  }

  const { cwd, paths } = createProjectContext(options)
  const dataMode = flags.data ?? await inferGenerateDataMode(cwd)
  const singular = singularize(entity)
  const routeDir = join(paths.routesDir, entity)
  const repoFile = join(paths.sharedDir, `${entity}.ts`)

  console.log(`\n  Generating CRUD for: ${entity}`)
  console.log(`  Data mode: ${dataMode}\n`)

  await mkdir(routeDir, { recursive: true })
  await mkdir(paths.sharedDir, { recursive: true })

  await writeFile(join(routeDir, "index.tsx"), listRoute(entity, singular))
  await writeFile(join(routeDir, "[id].tsx"), detailRoute(entity, singular))
  await writeFile(join(routeDir, "new.tsx"), newRoute(entity, singular))
  await writeFile(repoFile, repositoryModule(entity, singular, dataMode))

  const migrationDir = paths.migrationsDir
  await mkdir(migrationDir, { recursive: true })
  const migrationFile = await createMigration(migrationDir, `create_${entity}`)
  const migrationPath = join(migrationDir, migrationFile)
  await writeFile(migrationPath, migrationSQL(entity, dataMode))

  console.log("  Created:")
  console.log(`    routes/${entity}/index.tsx    -- list page`)
  console.log(`    routes/${entity}/[id].tsx     -- detail page`)
  console.log(`    routes/${entity}/new.tsx      -- validated create form`)
  console.log(`    shared/${entity}.ts           -- ${dataMode} repository + typed routes + form schema`)
  console.log(`    migrations/${migrationFile}`)
  console.log()
  if (dataMode === "postgres") {
    console.log(`  Next: run \`gorsee migrate\` and call \`configure${capitalize(singular)}Postgres(pool)\` during server startup`)
  } else if (dataMode === "memory") {
    console.log("  Next: run `gorsee migrate` and switch --data sqlite|postgres when wiring a production database")
  } else {
    console.log("  Next: run `gorsee migrate` to apply the generated table contract")
  }
  console.log()
}

/** @deprecated Use generateCrudScaffold() for programmatic access. */
export async function runGenerate(args: string[], options: GenerateCommandOptions = {}) {
  return generateCrudScaffold(args, options)
}
