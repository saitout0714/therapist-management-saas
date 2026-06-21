const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const dotenvContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
dotenvContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
});

const prodUrl = env.PRODUCTION_DATABASE_URL;

async function run() {
  console.log('Connecting to Production Database to search for true duplicate customers...');
  const client = new Client({
    connectionString: prodUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const shopsRes = await client.query('SELECT id, name FROM public.shops');
    const shopMap = {};
    shopsRes.rows.forEach(s => { shopMap[s.id] = s.name; });

    const res = await client.query(`
      SELECT id, name, phone, shop_id, created_at 
      FROM public.customers;
    `);
    const customers = res.rows;
    console.log(`Loaded ${customers.length} total customers.`);

    const resCount = await client.query(`
      SELECT customer_id, COUNT(*) as count 
      FROM public.reservations 
      GROUP BY customer_id;
    `);
    const reserveMap = {};
    resCount.rows.forEach(r => {
      reserveMap[r.customer_id] = parseInt(r.count, 10);
    });

    const shopGroup = {};
    customers.forEach(c => {
      if (!shopGroup[c.shop_id]) shopGroup[c.shop_id] = [];
      shopGroup[c.shop_id].push(c);
    });

    let markdownReport = `# 【精緻版】重複顧客データ分析レポート\n\n本番データベースから、重複の可能性が極めて高い顧客データを精査しました。\n\n### 抽出条件\n1. 同一店舗内で「名前が完全一致」し、片方が電話番号未設定のもの\n2. 同一店舗内で「名前 + 数字」(例: なみき6250) と 「名前のみ」(例: なみき) で分かれており、「名前のみ」の側に電話番号が設定されていないもの\n\n`;

    for (const shopId in shopGroup) {
      const shopName = shopMap[shopId] || '不明な店舗';
      const shopCustomers = shopGroup[shopId];
      const duplicates = [];

      for (let i = 0; i < shopCustomers.length; i++) {
        const c1 = shopCustomers[i];

        for (let j = 0; j < shopCustomers.length; j++) {
          if (i === j) continue;
          const c2 = shopCustomers[j];

          // 重複判定ロジック:
          // c1: 基準データ（電話番号あり、または名前が長い側）
          // c2: 重複候補（電話番号なし、かつ名前が短いか完全一致）
          
          if (c2.phone === null && c1.name !== c2.name) {
            // パターン1: c1が「名前＋数字」(例: なみき6250) で、c2が「名前のみ」(例: なみき)
            // 数字を除去した名前が一致するかチェック
            const cleanC1 = c1.name.replace(/\d+$/, '').trim();
            const cleanC2 = c2.name.replace(/\d+$/, '').trim();

            if (cleanC1 === cleanC2 && c1.name.length > c2.name.length) {
              const exists = duplicates.some(d => d.c1.id === c1.id && d.c2.id === c2.id);
              if (!exists) {
                duplicates.push({
                  c1: { id: c1.id, name: c1.name, phone: c1.phone, count: reserveMap[c1.id] || 0, created: c1.created_at },
                  c2: { id: c2.id, name: c2.name, phone: c2.phone, count: reserveMap[c2.id] || 0, created: c2.created_at },
                  type: '名前＋数値と名前のみの重複'
                });
              }
            }
          } else if (c1.name === c2.name && c1.id !== c2.id) {
            // パターン2: 同一店舗で「完全同名」でIDが分かれているケース
            // 片方が電話番号あり、片方がなしの場合のみ検出
            if (c1.phone !== null && c2.phone === null) {
              const exists = duplicates.some(d => d.c1.id === c1.id && d.c2.id === c2.id);
              if (!exists) {
                duplicates.push({
                  c1: { id: c1.id, name: c1.name, phone: c1.phone, count: reserveMap[c1.id] || 0, created: c1.created_at },
                  c2: { id: c2.id, name: c2.name, phone: c2.phone, count: reserveMap[c2.id] || 0, created: c2.created_at },
                  type: '完全同名で片方電話番号なし'
                });
              }
            }
          }
        }
      }

      if (duplicates.length > 0) {
        markdownReport += `## 店舗: ${shopName} (重複の可能性が高いデータ: ${duplicates.length}組)\n\n`;
        markdownReport += `| 統合先 (本データ) | 予約数 | 登録日 | 統合元 (重複候補) | 予約数 | 登録日 | 状態 | タイプ |\n`;
        markdownReport += `| :--- | :---: | :---: | :--- | :---: | :---: | :--- | :--- |\n`;
        
        duplicates.forEach(d => {
          const status = d.c2.count === 0 ? '⚠️ 予約0件（即削除可）' : '⚡ 予約あり（名寄せが必要）';
          const phoneDisplay = d.c1.phone ? d.c1.phone : '設定なし';
          markdownReport += `| **${d.c1.name}** (${phoneDisplay}) | ${d.c1.count}件 | ${new Date(d.c1.created).toISOString().split('T')[0]} | **${d.c2.name}** (設定なし) | ${d.c2.count}件 | ${new Date(d.c2.created).toISOString().split('T')[0]} | ${status} | ${d.type} |\n`;
        });
        markdownReport += `\n`;
      }
    }

    const reportPath = 'C:/Users/saitou-cyberpunk/.gemini/antigravity/brain/3134fe08-f556-4c06-adac-278ff51bd07c/scratch/true_duplicates_report.md';
    fs.writeFileSync(reportPath, markdownReport, 'utf-8');
    console.log(`Report successfully written to ${reportPath}`);

  } catch (err) {
    console.error('Error during duplication search:', err);
  } finally {
    await client.end();
  }
}

run();
