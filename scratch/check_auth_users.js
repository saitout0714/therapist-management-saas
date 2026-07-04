const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkAuthUsers(url, dbName) {
  if (!url) return;
  console.log(`\n=== Checking auth.users vs public.users in ${dbName} ===`);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT 
        au.id as auth_id, 
        au.email as auth_email,
        pu.id as public_id,
        pu.login_id as public_login_id,
        pu.role as public_role,
        pu.name as public_name
      FROM auth.users au
      FULL OUTER JOIN public.users pu ON au.id = pu.id
      WHERE pu.name LIKE '%齋藤%' OR au.email LIKE '%saitou%'
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

async function main() {
  await checkAuthUsers(process.env.DEVELOPMENT_DATABASE_URL, "DEVELOPMENT");
  await checkAuthUsers(process.env.PRODUCTION_DATABASE_URL, "PRODUCTION");
}

main();
