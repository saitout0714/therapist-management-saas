import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('Keys in .env.local:');
Object.keys(process.env).forEach(key => {
  if (key.includes('SUPABASE') || key.includes('URL') || key.includes('KEY') || key.includes('DATABASE')) {
    console.log(`- ${key}: ${process.env[key] ? 'Set (length: ' + process.env[key]?.length + ')' : 'Not Set'}`);
  }
});
