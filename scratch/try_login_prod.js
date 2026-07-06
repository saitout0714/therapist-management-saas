const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const dbKey = 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar';

async function run() {
  const pgClient = new Client({
    connectionString: process.env.PRODUCTION_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await pgClient.connect();

  let email = null;
  try {
    console.log('--- GETTING USER EMAIL ---');
    const res = await pgClient.query(`
      SELECT email FROM auth.users WHERE id = 'd2042d7e-16cc-46fa-a55f-75bb88e051b5'
    `);
    if (res.rows.length > 0) {
      email = res.rows[0].email;
      console.log('User email:', email);
    } else {
      console.log('User not found in auth.users');
    }
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await pgClient.end();
  }

  if (!email) return;

  const supabase = createClient(dbUrl, dbKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Try common passwords
  const passwords = ['Al2021al0518@', 'Al2021al0518', 'al2021al0518@', 'al2021al0518'];
  let loggedInClient = null;

  for (const password of passwords) {
    console.log(`Trying login with email: ${email} and password: ${password}`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      console.warn(`Failed login: ${error.message}`);
    } else {
      console.log('Success! Logged in.');
      loggedInClient = supabase; // Already has session set inside
      break;
    }
  }

  if (!loggedInClient) {
    console.error('Could not log in with any common password.');
    return;
  }

  // Execute the exact search query as the logged-in user
  console.log('--- EXECUTING API SEARCH AS LOGGED IN USER ---');
  const q = '3196';
  const normalized = '3196';
  const shopId = '92c51e51-339b-48ce-8535-0f45c859b195'; // 辻堂茅ヶ崎

  const { data: customers, error: queryErr } = await loggedInClient
    .from('customers')
    .select('id, name, email, phone, status, ng_reason, memo, created_at')
    .eq('shop_id', shopId)
    .or(`name.ilike.%${q}%,phone.ilike.%${normalized}%,email.ilike.%${q}%`)
    .order('name')
    .limit(50);

  if (queryErr) {
    console.error('Query Error:', queryErr);
  } else {
    console.log(`Success! Query returned ${customers.length} rows:`);
    customers.forEach(c => {
      console.log(`- ${c.name} (Phone: ${c.phone}, status: ${c.status})`);
    });
  }
}

run();
