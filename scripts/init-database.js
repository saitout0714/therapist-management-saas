const { createClient } = require('@supabase/supabase-js');

const projectUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar';

const supabase = createClient(projectUrl, serviceRoleKey);

async function initDatabase() {
  try {
    console.log('🚀 Initializing database...');

    // Create rooms table
    const { data: roomsResult, error: roomsError } = await supabase.rpc(
      'exec_sql',
      {
        sql: `
          CREATE TABLE IF NOT EXISTS public.rooms (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            store_id UUID,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `,
      }
    );

    if (roomsError && !roomsError.message.includes('already exists')) {
      console.error('❌ Error creating rooms table:', roomsError);
    } else {
      console.log('✅ Rooms table created or already exists');
    }

    // Add room_id to shifts table
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL;
      `,
    });

    if (alterError && !alterError.message.includes('already exists')) {
      console.error('❌ Error adding room_id to shifts:', alterError);
    } else {
      console.log('✅ room_id column added to shifts table');
    }

    // Create index
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_shifts_room_id ON public.shifts(room_id);
      `,
    });

    if (indexError && !indexError.message.includes('already exists')) {
      console.error('❌ Error creating index:', indexError);
    } else {
      console.log('✅ Index created');
    }

    // Enable RLS
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
      `,
    });

    if (rlsError && !rlsError.message.includes('already exists')) {
      console.error('⚠️  RLS might already be enabled:', rlsError);
    } else {
      console.log('✅ RLS enabled for rooms table');
    }

    console.log('\n✨ Database initialization completed!');
  } catch (error) {
    console.error('❌ Initialization error:', error);
    process.exit(1);
  }
}

initDatabase();
