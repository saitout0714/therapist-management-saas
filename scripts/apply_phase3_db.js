const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) envVars[k.trim()] = v.trim();
});

const url = envVars.NEXT_PUBLIC_SUPABASE_URL || 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, serviceKey);

async function run() {
  console.log('Testing/Applying Phase 3 schema checks...');

  // Ensure is_published on blog_articles
  const { data: blogSample, error: blogErr } = await supabase.from('blog_articles').select('*').limit(1);
  console.log('Blog articles sample:', blogSample, blogErr);

  // Ensure shifts sample
  const { data: shiftsSample, error: shiftErr } = await supabase.from('shifts').select('*').limit(1);
  console.log('Shifts sample:', shiftsSample, shiftErr);

  // Check Storage bucket
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  console.log('Storage buckets:', buckets, bucketErr);

  let hasBlogBucket = Array.isArray(buckets) && buckets.some(b => b.name === 'blog-images');
  if (!hasBlogBucket) {
    console.log('Creating blog-images bucket via Storage API...');
    const { data: newBucket, error: createErr } = await supabase.storage.createBucket('blog-images', {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    });
    console.log('Bucket creation result:', newBucket, createErr);
  }
}

run().catch(console.error);
