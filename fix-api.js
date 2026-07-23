const fs = require('fs');

const estamaPath = 'app/api/sync/therapists/estama/route.ts';
let estamaCode = fs.readFileSync(estamaPath, 'utf8');
estamaCode = estamaCode.replace(
  "import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';\nimport { cookies } from 'next/headers';",
  "import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';"
);
estamaCode = estamaCode.replace(
  "const supabase = createRouteHandlerClient({ cookies });\n    const { data: { session } } = await supabase.auth.getSession();\n    \n    if (!session) {\n      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });\n    }",
  "// Using supabaseAdmin"
);
fs.writeFileSync(estamaPath, estamaCode);

const esthePath = 'app/api/sync/therapists/esthe-ranking/route.ts';
let estheCode = fs.readFileSync(esthePath, 'utf8');
estheCode = estheCode.replace(
  "import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';\nimport { cookies } from 'next/headers';",
  "import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';"
);
estheCode = estheCode.replace(
  "const supabase = createRouteHandlerClient({ cookies });\n    const { data: { session } } = await supabase.auth.getSession();\n    \n    if (!session) {\n      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });\n    }",
  "// Using supabaseAdmin"
);
fs.writeFileSync(esthePath, estheCode);

