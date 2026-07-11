const { Client } = require('pg');

const connectionString = "postgresql://postgres:Al2021al0518@db.pumkniqtgjsotsxhyvbq.supabase.co:6543/postgres";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("Updating trigger function 'handle_new_auth_user'...");
    
    // トリガー関数を更新し、COALESCE のデフォルトフォールバックを 'owner' から 'simple_client_owner' に変更する
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $function$
      BEGIN
        INSERT INTO public.users (id, login_id, password_hash, role, name, created_at, updated_at)
        VALUES (
          new.id,
          -- メールのドメイン部分を除去して login_id とする（SaaSオーナー用）
          split_part(new.email, '@', 1),
          new.encrypted_password,
          COALESCE(new.raw_user_meta_data->>'role', 'simple_client_owner'), -- 'owner' から 'simple_client_owner' へ変更
          COALESCE(new.raw_user_meta_data->>'name', ''),
          new.created_at,
          new.updated_at
        )
        ON CONFLICT (id) DO UPDATE SET
          login_id = EXCLUDED.login_id,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          name = EXCLUDED.name,
          updated_at = NOW();
        RETURN NEW;
      END;
      $function$;
    `);

    console.log("Trigger function updated successfully!");

    // 確認のため関数の定義を表示
    const checkRes = await client.query(`
      SELECT pg_get_functiondef('public.handle_new_auth_user'::regproc);
    `);
    console.log("=== NEW DEFINITION ===");
    console.log(checkRes.rows[0].pg_get_functiondef);

  } catch (err) {
    console.error("Error during update:", err);
  } finally {
    await client.end();
  }
}

main();
