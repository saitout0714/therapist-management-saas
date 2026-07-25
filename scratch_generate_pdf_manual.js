const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function generatePdfManual() {
  console.log("=== 綺麗なおすすめPDFマニュアルの自動生成開始 ===");

  const custImgBase64 = fs.readFileSync('manual_customers.png').toString('base64');
  const therImgBase64 = fs.readFileSync('manual_therapists.png').toString('base64');

  const htmlContent = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>【バカラ様向け】YOYAKL 新機能・かんたん操作マニュアル</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    body {
      font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Meiryo", sans-serif;
      color: #1e293b;
      line-height: 1.6;
      background-color: #ffffff;
      padding: 0;
      margin: 0;
    }
    .header {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      color: white;
      padding: 24px 30px;
      border-radius: 16px;
      margin-bottom: 25px;
    }
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 0;
      font-size: 13px;
      opacity: 0.9;
    }
    .badge-bar {
      display: flex;
      gap: 10px;
      margin-bottom: 25px;
    }
    .badge-card {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #4f46e5;
      padding: 12px 15px;
      border-radius: 8px;
    }
    .badge-card h3 {
      margin: 0 0 4px 0;
      font-size: 14px;
      color: #334155;
    }
    .badge-card p {
      margin: 0;
      font-size: 11px;
      color: #64748b;
    }
    .section {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 16px;
      font-weight: bold;
      color: #1e1b4b;
      border-bottom: 2px solid #e0e7ff;
      padding-bottom: 8px;
      margin-top: 0;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .img-box {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
      margin: 15px 0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .img-box img {
      width: 100%;
      display: block;
    }
    .step-list {
      margin: 0;
      padding-left: 20px;
    }
    .step-list li {
      margin-bottom: 8px;
      font-size: 13px;
    }
    .point-box {
      background-color: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 12px 15px;
      font-size: 12px;
      color: #1e40af;
      margin-top: 12px;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 15px;
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>📘【バカラグループ様向け】YOYAKL 新機能・かんたん操作マニュアル</h1>
    <p>バカラ4店舗（山口湯田・周南下松・宇部・岩国）で便利になった顧客共有・セラピスト管理・基本操作の解説書</p>
  </div>

  <div class="badge-bar">
    <div class="badge-card">
      <h3>👥 顧客データ1,800名が全店共有</h3>
      <p>【お名前＋電話下4桁】で綺麗に整頓。どのバカラ店舗からでもすぐ検索・来店履歴を確認できます。</p>
    </div>
    <div class="badge-card">
      <h3>💃 セラピストの1つ化＆店舗別源氏名</h3>
      <p>1人のキャスト様としてデータを統合。店舗ごとに違う名前の自動切り替え表示ができます。</p>
    </div>
    <div class="badge-card">
      <h3>📅 独立予約＆給与自動1発計算</h3>
      <p>予約は店舗ごとに独立して見やすく、給与精算ボタンで他店での売り上げも自動合算集計されます。</p>
    </div>
  </div>

  <!-- SECTION 1 -->
  <div class="section">
    <div class="section-title">📱 1. 顧客管理画面の使い方（全バカラ店舗の1,800名共有）</div>
    <p style="font-size: 13px; margin-bottom: 10px;">
      顧客一覧画面では、全4店舗のお客さまが **「お名前 ＋ 電話番号の下4桁」**（例: <code>藤本さん6601</code>）で整頓されて表示されます。
    </p>

    <div class="img-box">
      <img src="data:image/png;base64,${custImgBase64}" alt="顧客管理画面" />
    </div>

    <ol class="step-list">
      <li><strong>顧客の検索:</strong> 上部の検索バーに「お名前」または「電話番号（下4桁でもOK）」を入力すると即座に絞り込めます。</li>
      <li><strong>来店履歴の確認:</strong> 各お客さまの「来店」ボタンを押すと、過去にバカラのどの店舗に来店したか（例: <code>【バカラ周南下松】</code>）が表示されます。</li>
    </ol>

    <div class="point-box">
      💡 <strong>ポイント:</strong> 電話番号の下4桁が名前の後ろについているので、同姓同名のお客さまでも迷わず識別できます。
    </div>
  </div>

  <!-- SECTION 2 -->
  <div class="section">
    <div class="section-title">💃 2. セラピスト管理画面の使い方（店舗ごとの源氏名・A-Zソート）</div>
    <p style="font-size: 13px; margin-bottom: 10px;">
      1人のキャスト様が複数のバカラ店舗に出勤しても1つのデータで共通管理されます。「🔤 A-Z順」ボタンで五十音順に綺麗に並び替えることができます。
    </p>

    <div class="img-box">
      <img src="data:image/png;base64,${therImgBase64}" alt="セラピスト管理画面" />
    </div>

    <ol class="step-list">
      <li><strong>店舗ごとの源氏名変更:</strong> セラピストの「編集」ボタンを押し、「🏢 店舗ごとの源氏名（別名）設定」欄で各店舗での表示名を入力して保存します。</li>
      <li><strong>並び替え切替:</strong> 検索バー横の「🔤 A-Z順」ボタンを押すことで、名前順で探すことができます。</li>
    </ol>
  </div>

  <!-- SECTION 3 -->
  <div class="section">
    <div class="section-title">📅 3. シフト登録・給与精算の基本</div>
    <ul class="step-list">
      <li><strong>予約カレンダー:</strong> 現在選択している店舗の予約スケジュールのみが表示されるため、現場のオペレーションが混ざりません。</li>
      <li><strong>給与計算・精算:</strong> 「給与・バック計算」画面で精算ボタンを押すと、他のバカラ店舗で上げた売上やバック給与も全自動で1発合算集計されます。</li>
    </ul>
  </div>

  <div class="footer">
    YOYAKL (予約管理システム) - バカラグループ様向け専用マニュアル
  </div>

</body>
</html>
  `;

  fs.writeFileSync('baccarat_owner_manual_print.html', htmlContent);
  console.log("-> baccarat_owner_manual_print.html 書き出し完了");

  // Playwright で PDF化
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });

  const pdfPath = path.join(__dirname, 'baccarat_owner_manual.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
  });

  await browser.close();
  console.log(`=== PDFマニュアル生成完了! パス: ${pdfPath} ===`);
}

generatePdfManual();
