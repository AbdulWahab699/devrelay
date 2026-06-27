import 'dotenv/config'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Kysely, Migrator, FileMigrationProvider, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import type { Database } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function migrateToLatest() {
  if (!process.env.DATABASE_URL) {
    throw new Error('[FATAL] DATABASE_URL is not set.')
  }

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: process.env.DATABASE_URL }),
    }),
  })

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  })

  const { error, results } = await migrator.migrateToLatest()

  results?.forEach(result => {
    if (result.status === 'Success') {
      console.log(`✓ Migration "${result.migrationName}" applied successfully`)
    } else if (result.status === 'Error') {
      console.error(`✗ Migration "${result.migrationName}" failed`)
    }
  })

  if (error) {
    console.error('Migration failed:', error)
    await db.destroy()
    process.exit(1)
  }

  console.log('All migrations complete.')
  await db.destroy()
}

migrateToLatest()
