const { Client } = require('pg');

const connectionString = "postgresql://postgres:Al2021al0518@db.pumkniqtgjsotsxhyvbq.supabase.co:6543/postgres";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("Fetching test users...");
    const testUsersRes = await client.query(`
      SELECT id, email FROM auth.users WHERE email LIKE 'test_%'
    `);
    const testUsers = testUsersRes.rows;
    console.log("Found test users:", testUsers);

    if (testUsers.length === 0) {
      console.log("No test users found.");
      return;
    }

    const testUserIds = testUsers.map(u => u.id);

    // 1. shop_owners の削除
    console.log("Deleting from shop_owners...");
    const deleteShopOwnersRes = await client.query(`
      DELETE FROM public.shop_owners WHERE user_id = ANY($1::uuid[])
    `, [testUserIds]);
    console.log(`Deleted ${deleteShopOwnersRes.rowCount} shop_owners records.`);

    // 2. public.users の削除
    console.log("Deleting from public.users...");
    const deletePublicUsersRes = await client.query(`
      DELETE FROM public.users WHERE id = ANY($1::uuid[])
    `, [testUserIds]);
    console.log(`Deleted ${deletePublicUsersRes.rowCount} public.users records.`);

    // 3. auth.users の削除
    console.log("Deleting from auth.users...");
    const deleteAuthUsersRes = await client.query(`
      DELETE FROM auth.users WHERE id = ANY($1::uuid[])
    `, [testUserIds]);
    console.log(`Deleted ${deleteAuthUsersRes.rowCount} auth.users records.`);

    console.log("Cleanup completed successfully!");

  } catch (err) {
    console.error("Error during cleanup:", err);
  } finally {
    await client.end();
  }
}

main();
