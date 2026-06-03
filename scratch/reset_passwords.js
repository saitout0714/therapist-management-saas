const { createClient } = require('@supabase/supabase-js');
const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24';

const supabaseAdmin = createClient(dbUrl, serviceRoleKey);

async function run() {
  const usersToReset = [
    {
      id: 'd2042d7e-16cc-46fa-a55f-75bb88e051b5',
      loginId: 'saitou0714',
      newPassword: 'Saitou0714!'
    },
    {
      id: '54937a7d-db59-42b8-8b00-d10a63e33542',
      loginId: '123456',
      newPassword: 'Tsujido1234!'
    }
  ];

  for (const user of usersToReset) {
    console.log(`Resetting password for ${user.loginId} (${user.id})...`);
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: user.newPassword
    });

    if (error) {
      console.error(`Failed to reset password for ${user.loginId}:`, error.message);
    } else {
      console.log(`Successfully reset password for ${user.loginId}!`);
    }
  }
}

run();
