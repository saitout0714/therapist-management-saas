import { Client } from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const dbUrl = process.env.DEVELOPMENT_DATABASE_URL || process.env.DATABASE_URL

if (!dbUrl) {
  console.error('DEVELOPMENT_DATABASE_URL is not set in .env.local')
  process.exit(1)
}

async function run() {
  console.log('Connecting to database:', dbUrl.replace(/:[^:@]+@/, ':****@'))
  const client = new Client({
    connectionString: dbUrl,
  })

  try {
    await client.connect()
    console.log('Connected successfully.')

    const sqlPath = path.join(__dirname, '../supabase/add-reserve-indexes.sql')
    console.log('Reading migration file:', sqlPath)
    const sql = fs.readFileSync(sqlPath, 'utf8')

    console.log('Running SQL...')
    await client.query(sql)
    console.log('Indexes created/verified successfully!')
  } catch (err) {
    console.error('Error running migration:', err)
  } finally {
    await client.end()
  }
}

run()
