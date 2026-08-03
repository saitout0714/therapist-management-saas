const fs = require('fs');
const https = require('https');

const url = 'https://pumkniqtgjsotsxhyvbq.supabase.co/storage/v1/object/public/therapist-photos/shops/150ee036-bd95-47ab-bf50-8132d3c62bdf/logo_1785725461653.png';

https.get(url, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Content-Type:', res.headers['content-type']);
  console.log('Content-Length:', res.headers['content-length']);

  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    console.log('Downloaded size in bytes:', buffer.length);
    console.log('First 20 bytes hex:', buffer.slice(0, 20).toString('hex'));
  });
}).on('error', (e) => {
  console.error('Error:', e);
});
