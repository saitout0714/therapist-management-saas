const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24';
const supabase = createClient(supabaseUrl, supabaseKey);

async function exportRawData() {
  const shopUrban = '7d430288-8aed-4381-b3bf-f35fad962d2f';
  const shopHimitsu = '774101be-d8c5-4ca5-ba4a-fc61c039fbaa';

  const { data: allRes, error: resErr } = await supabase
    .from('reservations')
    .select('*, customers(*), designation_types(*)')
    .in('shop_id', [shopUrban, shopHimitsu])
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (resErr) {
    console.error('Error fetching reservations:', resErr);
    return;
  }

  const { data: allTherapists } = await supabase.from('therapists').select('id, name');
  const therapistMap = {};
  (allTherapists || []).forEach(t => { therapistMap[t.id] = t.name; });

  const { data: allCust } = await supabase
    .from('customers')
    .select('*')
    .in('shop_id', [shopUrban, shopHimitsu]);

  const custHistory = {};
  allRes.forEach(r => {
    if (!r.customer_id) return;
    if (!custHistory[r.customer_id]) custHistory[r.customer_id] = [];
    custHistory[r.customer_id].push(r);
  });

  const resTarget = allRes.filter(r => r.date >= '2026-06-28');

  function getCustomerType(r) {
    if (r.customer_type_override === 'new') return '新規';
    if (r.customer_type_override === 'member') return '会員';
    
    if (r.customer_id && custHistory[r.customer_id]) {
      const prior = custHistory[r.customer_id].filter(pr => pr.date < r.date || (pr.date === r.date && pr.start_time < r.start_time));
      if (prior.length > 0) return '会員';
    }
    
    if (r.designation_type === 'first_nomination') return '新規';

    const c = (allCust || []).find(cust => cust.id === r.customer_id);
    if (c && c.created_at < '2026-06-28T00:00:00') {
      return '会員';
    }
    return '新規';
  }

  const rows = [];
  resTarget.forEach(r => {
    if (r.status === 'blocked') return; // Skip admin block slots
    
    const shopName = r.shop_id === shopUrban ? 'アーバンスパ' : '新宿秘密妻';
    const customerType = getCustomerType(r);
    const customerName = r.customers?.name || '未登録';
    const customerPhone = r.customers?.phone || '';
    const therapistName = therapistMap[r.therapist_id] || '未設定';
    const designationName = r.designation_types?.display_name || r.designation_type || '';
    
    rows.push({
      date: r.date,
      start_time: r.start_time,
      end_time: r.end_time,
      shop_name: shopName,
      customer_type: customerType,
      customer_name: customerName,
      customer_phone: customerPhone,
      therapist_name: therapistName,
      designation_type: designationName,
      status: r.status === 'confirmed' ? '確定' : (r.status === 'cancelled' || r.status === 'canceled' ? 'キャンセル' : r.status),
      total_price: r.total_price || 0,
      notes: (r.notes || '').replace(/\r?\n/g, ' ')
    });
  });

  const artifactDir = 'C:\\Users\\saitou-cyberpunk\\.gemini\\antigravity\\brain\\72c73b01-be75-4cae-a01f-d66898a28c99';
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  // Generate CSV
  const csvHeaders = ['日付', '開始時間', '終了時間', '店舗名', '顧客区分', '顧客名', '電話番号', '担当セラピスト', '指名種別', 'ステータス', '合計料金', '備考'];
  const csvLines = [
    csvHeaders.join(','),
    ...rows.map(r => [
      r.date,
      r.start_time,
      r.end_time,
      `"${r.shop_name}"`,
      `"${r.customer_type}"`,
      `"${r.customer_name}"`,
      `"${r.customer_phone}"`,
      `"${r.therapist_name}"`,
      `"${r.designation_type}"`,
      `"${r.status}"`,
      r.total_price,
      `"${r.notes}"`
    ].join(','))
  ];

  const csvPath = path.join(artifactDir, 'reservation_raw_data.csv');
  fs.writeFileSync(csvPath, '\uFEFF' + csvLines.join('\n'), 'utf8');

  // Generate MD artifact
  const mdLines = [
    '# 予約生データ一覧（2026年6月28日〜現在）',
    '',
    `対象店舗: **アーバンスパ** / **新宿秘密妻** | 総件数: **${rows.length}件**`,
    '',
    '| 日付 | 時間 | 店舗名 | 区分 | 顧客名 | 電話番号 | 担当セラピスト | 指名種別 | ステータス | 料金 |',
    '| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: | ---: |',
    ...rows.map(r => `| ${r.date} | ${r.start_time.substring(0,5)}-${r.end_time.substring(0,5)} | ${r.shop_name} | **${r.customer_type}** | ${r.customer_name} | ${r.customer_phone} | ${r.therapist_name} | ${r.designation_type} | ${r.status} | ${r.total_price.toLocaleString()}円 |`)
  ];

  const mdPath = path.join(artifactDir, 'reservation_raw_data.md');
  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

  console.log('Successfully generated CSV & MD artifact files! Total rows:', rows.length);
}

exportRawData();
