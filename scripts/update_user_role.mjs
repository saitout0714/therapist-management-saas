import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // 1. Get the user from public.users
  const { data: users, error: selectError } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('name', '齋藤貴彦');

  if (selectError) {
    console.error('Select error:', selectError);
    return;
  }

  if (!users || users.length === 0) {
    console.error('User not found in public.users');
    return;
  }

  const user = users[0];
  console.log('Found user:', user);

  // 2. Update public.users
  const { error: updateError } = await supabase
    .from('users')
    .update({ role: 'developer' })
    .eq('id', user.id);

  if (updateError) {
    console.error('Error updating public.users:', updateError);
    return;
  }

  console.log('Updated public.users successfully');

  // 3. Update auth.users metadata
  const { data: authData, error: authError } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { name: user.name, role: 'developer' }
  });

  if (authError) {
    console.error('Error updating auth.users:', authError);
    return;
  }

  console.log('Updated auth.users successfully');
}

run();
