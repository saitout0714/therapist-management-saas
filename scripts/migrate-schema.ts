import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const sourceUrl = process.env.PRODUCTION_DATABASE_URL;
const targetUrl = process.env.DEVELOPMENT_DATABASE_URL;

async function runMigration() {
  if (!sourceUrl || !targetUrl) {
    console.error('❌ Error: PRODUCTION_DATABASE_URL and DEVELOPMENT_DATABASE_URL must be defined in .env.local');
    console.log('\nExample .env.local config:');
    console.log('PRODUCTION_DATABASE_URL="postgresql://postgres:[PROD_PASSWORD]@db.pumkniqtgjsotsxhyvbq.supabase.co:6543/postgres"');
    console.log('DEVELOPMENT_DATABASE_URL="postgresql://postgres:[NEW_DEV_PASSWORD]@db.[NEW_PROJECT_REF].supabase.co:6543/postgres"');
    process.exit(1);
  }

  const sourceClient = new Client({ connectionString: sourceUrl });
  const targetClient = new Client({ connectionString: targetUrl });

  try {
    console.log('🔌 Connecting to Source (Production) Database...');
    await sourceClient.connect();
    console.log('🔌 Connecting to Target (Development) Database...');
    await targetClient.connect();
    console.log('✅ Connected to both databases!');

    const sqlStatements: string[] = [];

    // --- 1. EXTENSIONS ---
    console.log('🔍 Fetching extensions...');
    const extensionsRes = await sourceClient.query(`
      SELECT extname FROM pg_extension WHERE extname != 'plpgsql';
    `);
    sqlStatements.push('-- === 1. EXTENSIONS ===');
    for (const row of extensionsRes.rows) {
      sqlStatements.push(`CREATE EXTENSION IF NOT EXISTS "${row.extname}";`);
    }
    sqlStatements.push('');

    // --- 2. ENUMS / CUSTOM TYPES ---
    console.log('🔍 Fetching custom enums...');
    const enumsRes = await sourceClient.query(`
      SELECT t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) as values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname;
    `);
    sqlStatements.push('-- === 2. ENUMS ===');
    for (const row of enumsRes.rows) {
      const vals = row.values.split(',').map((v: string) => `'${v}'`).join(', ');
      sqlStatements.push(`DO $$ BEGIN
  CREATE TYPE "public"."${row.typname}" AS ENUM (${vals});
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;`);
    }
    sqlStatements.push('');

    // --- 3. CUSTOM FUNCTIONS ---
    console.log('🔍 Fetching user-defined functions...');
    const functionsRes = await sourceClient.query(`
      SELECT p.proname, pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
      WHERE n.nspname = 'public'
      AND d.objid IS NULL
      AND p.prokind = 'f';
    `);
    sqlStatements.push('-- === 3. FUNCTIONS ===');
    for (const row of functionsRes.rows) {
      sqlStatements.push(row.def + ';');
    }
    sqlStatements.push('');

    // --- 4. TABLES (Columns, Defaults, Nullability, Primary Keys) ---
    console.log('🔍 Fetching tables and columns...');
    const tablesRes = await sourceClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map((r: any) => r.table_name);

    sqlStatements.push('-- === 4. TABLES ===');
    for (const table of tables) {
      const colsRes = await sourceClient.query(`
        SELECT 
          column_name, data_type, is_nullable, column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      const pkRes = await sourceClient.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
          AND tc.table_name = kcu.table_name
        WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position;
      `, [table]);
      const pkCols = Array.from(new Set(pkRes.rows.map((r: any) => `"${r.column_name}"`)));


      let tableDDL = `CREATE TABLE IF NOT EXISTS "public"."${table}" (\n`;
      const colDDLs: string[] = [];

      for (const col of colsRes.rows) {
        let colDDL = `  "${col.column_name}" ${col.data_type}`;
        if (col.character_maximum_length) {
          colDDL += `(${col.character_maximum_length})`;
        }
        if (col.is_nullable === 'NO') {
          colDDL += ' NOT NULL';
        }
        if (col.column_default) {
          colDDL += ` DEFAULT ${col.column_default}`;
        }
        colDDLs.push(colDDL);
      }

      if (pkCols.length > 0) {
        colDDLs.push(`  CONSTRAINT "${table}_pkey" PRIMARY KEY (${pkCols.join(', ')})`);
      }

      tableDDL += colDDLs.join(',\n') + '\n);';
      sqlStatements.push(tableDDL);
      sqlStatements.push('');
    }

    // --- 5. VIEWS ---
    console.log('🔍 Fetching views...');
    const viewsRes = await sourceClient.query(`
      SELECT table_name, view_definition
      FROM information_schema.views
      WHERE table_schema = 'public';
    `);
    sqlStatements.push('-- === 5. VIEWS ===');
    for (const row of viewsRes.rows) {
      sqlStatements.push(`CREATE OR REPLACE VIEW "public"."${row.table_name}" AS\n${row.view_definition};`);
      sqlStatements.push('');
    }

    // --- 6. FOREIGN KEYS ---
    console.log('🔍 Fetching foreign keys...');
    const fkRes = await sourceClient.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = rc.unique_constraint_name
      WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY';
    `);
    sqlStatements.push('-- === 6. FOREIGN KEYS ===');
    for (const row of fkRes.rows) {
      sqlStatements.push(`ALTER TABLE "public"."${row.table_name}" 
  DROP CONSTRAINT IF EXISTS "${row.constraint_name}",
  ADD CONSTRAINT "${row.constraint_name}" 
  FOREIGN KEY ("${row.column_name}") 
  REFERENCES "public"."${row.foreign_table_name}" ("${row.foreign_column_name}")
  ON UPDATE ${row.update_rule} ON DELETE ${row.delete_rule};`);
    }
    sqlStatements.push('');

    // --- 7. INDEXES ---
    console.log('🔍 Fetching indexes...');
    const indexesRes = await sourceClient.query(`
      SELECT
        t.relname as table_name,
        i.relname as index_name,
        pg_get_indexdef(idx.indexrelid) as index_def
      FROM pg_index idx
      JOIN pg_class t ON idx.indrelid = t.oid
      JOIN pg_class i ON idx.indexrelid = i.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      LEFT JOIN pg_constraint c ON c.conindid = idx.indexrelid
      WHERE n.nspname = 'public'
      AND c.oid IS NULL;
    `);
    sqlStatements.push('-- === 7. INDEXES ===');
    for (const row of indexesRes.rows) {
      let indexDef = row.index_def;
      if (indexDef.startsWith('CREATE UNIQUE INDEX ')) {
        indexDef = indexDef.replace('CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS ');
      } else if (indexDef.startsWith('CREATE INDEX ')) {
        indexDef = indexDef.replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ');
      }
      sqlStatements.push(`${indexDef};`);
    }

    sqlStatements.push('');

    // --- 8. RLS STATUS & POLICIES ---
    console.log('🔍 Fetching row level security and policies...');
    const rlsRes = await sourceClient.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public';
    `);
    sqlStatements.push('-- === 8. RLS STATUS & POLICIES ===');
    for (const row of rlsRes.rows) {
      if (row.rowsecurity) {
        sqlStatements.push(`ALTER TABLE "public"."${row.tablename}" ENABLE ROW LEVEL SECURITY;`);
      }
    }

    const policiesRes = await sourceClient.query(`
      SELECT tablename, policyname, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public';
    `);
    for (const pol of policiesRes.rows) {
      let pSql = `CREATE POLICY "${pol.policyname}" ON "public"."${pol.tablename}" FOR ${pol.cmd}`;
      if (pol.roles && Array.isArray(pol.roles) && pol.roles.length > 0) {
        pSql += ` TO ${pol.roles.join(', ')}`;
      } else if (pol.roles && typeof pol.roles === 'string') {
        const rolesClean = pol.roles.replace(/[{}]/g, '').split(',').map(r => r.trim()).filter(Boolean);
        if (rolesClean.length > 0) {
          pSql += ` TO ${rolesClean.join(', ')}`;
        }
      }

      if (pol.qual) {
        pSql += ` USING (${pol.qual})`;
      }
      if (pol.with_check) {
        pSql += ` WITH CHECK (${pol.with_check})`;
      }
      sqlStatements.push(`DROP POLICY IF EXISTS "${pol.policyname}" ON "public"."${pol.tablename}";\n${pSql};`);
    }
    sqlStatements.push('');

    // --- 9. TRIGGERS ---
    console.log('🔍 Fetching triggers...');
    const triggersRes = await sourceClient.query(`
      SELECT tgname, pg_get_triggerdef(t.oid) as def
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE (n.nspname = 'public' OR (n.nspname = 'auth' AND c.relname = 'users'))
      AND NOT tgisinternal;
    `);

    sqlStatements.push('-- === 9. TRIGGERS ===');
    for (const row of triggersRes.rows) {
      const tableName = row.def.split(' ON ')[1].split(' ')[0];
      const fullTableName = tableName.includes('.') ? tableName : `"public"."${tableName}"`;
      sqlStatements.push(`DROP TRIGGER IF EXISTS "${row.tgname}" ON ${fullTableName};\n${row.def};`);
    }

    sqlStatements.push('');

    // --- WRITE SQL SNAPSOT FILE ---
    const finalSql = sqlStatements.join('\n');
    const snapshotPath = path.join(process.cwd(), 'supabase', 'current-schema.sql');
    fs.writeFileSync(snapshotPath, finalSql, 'utf8');
    console.log(`\n💾 Schema snapshot saved successfully to: ${snapshotPath}`);

    // --- APPLY TO TARGET DATABASE ---
    console.log('\n🚀 Applying schema to target (Development) Database...');
    // We execute the statements in target database.
    // To handle potential errors with triggers/policies, we run it as a single block or statement by statement.
    // Running it as a single transaction:
    await targetClient.query('BEGIN;');
    
    // We split statements by newline, but since some statements cross multiple lines (functions, policies),
    // it is safer to run the whole block or execute the SQL file as a single query.
    try {
      await targetClient.query(finalSql);
      await targetClient.query('COMMIT;');
      console.log('✅ Schema successfully cloned and applied to target database!');
    } catch (err: any) {
      await targetClient.query('ROLLBACK;');
      console.error('❌ Error applying schema to target database:', err.message);
      console.log('Note: If there are dependency issues, check if extensions are supported in the target project.');
      throw err;
    }

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sourceClient.end();
    await targetClient.end();
    console.log('🔌 Disconnected from databases.');
  }
}

runMigration();
