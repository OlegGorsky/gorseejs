import type { SafeSQLValue } from "../types/safe-sql.ts"

type Awaitable<T> = T | Promise<T>

export interface PostgresQueryResult<Row = unknown> {
  rows: Row[]
  rowCount?: number | null
}

export interface PostgresClientLike {
  query<Row = unknown>(text: string, params?: readonly unknown[]): Awaitable<PostgresQueryResult<Row>>
}

export interface PostgresConnectionLike extends PostgresClientLike {
  release?(): Awaitable<void>
}

export interface PostgresPoolLike extends PostgresClientLike {
  connect?(): Promise<PostgresConnectionLike>
}

export interface PostgresDB {
  get<T>(query: SafeSQLValue): Promise<T | null>
  all<T>(query: SafeSQLValue): Promise<T[]>
  run(query: SafeSQLValue): Promise<{ changes: number }>
  transaction<T>(handler: (db: PostgresDB) => Promise<T>): Promise<T>
}

export function toPostgresSQL(query: SafeSQLValue): { text: string; params: readonly unknown[] } {
  let index = 0
  return {
    text: query.text.replace(/\?/g, () => `$${++index}`),
    params: query.params,
  }
}

function createBoundPostgresDB(client: PostgresClientLike, beginTransaction: boolean): PostgresDB {
  return {
    async get<T>(query: SafeSQLValue) {
      const { text, params } = toPostgresSQL(query)
      const result = await client.query<T>(text, params)
      return result.rows[0] ?? null
    },

    async all<T>(query: SafeSQLValue) {
      const { text, params } = toPostgresSQL(query)
      const result = await client.query<T>(text, params)
      return result.rows
    },

    async run(query) {
      const { text, params } = toPostgresSQL(query)
      const result = await client.query(text, params)
      return { changes: result.rowCount ?? 0 }
    },

    async transaction<T>(handler: (db: PostgresDB) => Promise<T>) {
      if (!beginTransaction) {
        return handler(createBoundPostgresDB(client, false))
      }

      await client.query("BEGIN")
      try {
        const result = await handler(createBoundPostgresDB(client, false))
        await client.query("COMMIT")
        return result
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      }
    },
  }
}

export function createPostgresDB(client: PostgresPoolLike): PostgresDB {
  return {
    async get<T>(query: SafeSQLValue) {
      return createBoundPostgresDB(client, true).get<T>(query)
    },

    async all<T>(query: SafeSQLValue) {
      return createBoundPostgresDB(client, true).all<T>(query)
    },

    async run(query) {
      return createBoundPostgresDB(client, true).run(query)
    },

    async transaction<T>(handler: (db: PostgresDB) => Promise<T>) {
      if (!client.connect) {
        return createBoundPostgresDB(client, true).transaction(handler)
      }

      const connection = await client.connect()
      try {
        return await createBoundPostgresDB(connection, true).transaction(handler)
      } finally {
        await connection.release?.()
      }
    },
  }
}
