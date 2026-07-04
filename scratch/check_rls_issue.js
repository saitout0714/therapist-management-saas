const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkDb(url, name) {
  if (!url) {
    console.log(`No URL for ${name}`);
    return;
  }
  console.log(`\n=== Checking ${name} DB ===`);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    // 1. Find user '齋藤貴彦'
    const usersRes = await client.query("SELECT id, login_id, role, name FROM public.users WHERE name LIKE '%齋藤%'");
    console.log("Users matching '齋藤':", usersRes.rows);

    if (usersRes.rows.length === 0) {
      console.log("No user found by name '齋藤' in this DB.");
      return;
    }

    const userId = usersRes.rows[0].id;
    const userRole = usersRes.rows[0].role;

    // 2. Find shops the user is registered as owner for
    const shopOwnersRes = await client.query("SELECT * FROM public.shop_owners WHERE user_id = $1", [userId]);
    console.log(`Shop owners entries for user ${userId}:`, shopOwnersRes.rows);

    // 3. Find all shops to see their names and IDs
    const shopsRes = await client.query("SELECT id, name FROM public.shops");
    console.log("All shops in DB:", shopsRes.rows);

    // 4. Let's see if 'こころリンス浅草橋' is linked in shop_owners for this user
    const targetShop = shopsRes.rows.find(s => s.name.includes("こころリンス浅草橋"));
    if (targetShop) {
      console.log("Target shop 'こころリンス浅草橋' found:", targetShop);
      const specificLink = shopOwnersRes.rows.find(so => so.shop_id === targetShop.id);
      if (specificLink) {
        console.log("Found explicit link in shop_owners:", specificLink);
      } else {
        console.log("WARNING: NO entry in shop_owners for user", userId, "and shop", targetShop.id);
      }
    } else {
      console.log("Target shop 'こころリンス浅草橋' NOT found in DB!");
    }

  } catch (err) {
    console.error("Error checking DB:", err);
  } finally {
    await client.end();
  }
}

async function main() {
  await checkDb(process.env.DEVELOPMENT_DATABASE_URL, "DEVELOPMENT");
  await checkDb(process.env.PRODUCTION_DATABASE_URL, "PRODUCTION");
}

main();
