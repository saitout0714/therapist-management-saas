import { Client } from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'path'

// .env.localを読み込む
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const productionDbUrl = process.env.PRODUCTION_DATABASE_URL
const developmentDbUrl = process.env.DEVELOPMENT_DATABASE_URL

async function runMigration(dbUrl: string, name: string) {
  console.log(`Starting migration for ${name}...`)
  const client = new Client({
    connectionString: dbUrl,
  })
  
  try {
    await client.connect()
    console.log(`Connected to ${name} database`)
    
    // カラム追加SQL
    await client.query(`
      ALTER TABLE system_settings 
      ADD COLUMN IF NOT EXISTS email_template_web_success TEXT;
    `)
    console.log(`Successfully added email_template_web_success to system_settings in ${name}`)
  } catch (err) {
    console.error(`Migration failed for ${name}:`, err)
  } finally {
    await client.end()
  }
}

async function main() {
  if (productionDbUrl) {
    await runMigration(productionDbUrl, 'Production')
  } else {
    console.log('Production database URL not found')
  }

  if (developmentDbUrl) {
    await runMigration(developmentDbUrl, 'Development')
  } else {
    console.log('Development database URL not found')
  }
}

void main()
