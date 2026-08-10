require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function applyMigration() {
  const connectionString = process.env.PRODUCTION_DATABASE_URL;
  if (!connectionString) {
    console.error("PRODUCTION_DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  console.log("Connecting to PostgreSQL database...");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully.");

    const sqlPath = path.join(__dirname, "../supabase/add-recruit-and-course-category.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("Executing SQL migration script...");
    await client.query(sql);
    console.log("Migration executed successfully!");

    // Verify columns on courses table
    const resCourses = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'courses' AND column_name = 'category_name';
    `);
    console.log("courses.category_name column check:", resCourses.rows);

    // Verify columns on shops table
    const resShops = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'shops' AND column_name = 'recruit_info';
    `);
    console.log("shops.recruit_info column check:", resShops.rows);

  } catch (err) {
    console.error("Error executing migration:", err);
  } finally {
    await client.end();
  }
}

applyMigration();
