const https = require('http');

const url = 'http://localhost:3000/api/public/shifts?shop_id=150ee036-bd95-47ab-bf50-8132d3c62bdf&date_from=2026-08-01&date_to=2026-08-10&token=yoyakl_sync_token_2026';

https.get(url, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    try {
      const json = JSON.parse(body);
      console.log('API Response:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Raw Response:', body);
    }
  });
}).on('error', (e) => {
  console.error('Fetch error:', e);
});
