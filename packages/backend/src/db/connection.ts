import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import type { Database } from './types.js'

if (!process.env.DATABASE_URL) {
  throw new Error('[FATAL] DATABASE_URL environment variable is not set.')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 2,
  max: 10,
})

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
})
