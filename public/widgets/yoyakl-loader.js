(function() {
  // すでに読み込まれている場合は再実行しない
  if (window.YoyaklWidgetInitialized) return;
  window.YoyaklWidgetInitialized = true;

  // 1. スクリプトの配信元URLからAPIのベースURLを自動判定
  let apiBase = '';
  const currentScript = document.currentScript;
  if (currentScript && currentScript.src) {
    try {
      const url = new URL(currentScript.src);
      apiBase = url.origin;
    } catch (e) {
      console.error('[Yoyakl] Failed to parse script origin:', e);
    }
  }
  if (!apiBase) {
    apiBase = window.location.origin;
  }

  // CSSスタイルの注入 (スコープ限定・セージグリーンテーマ)
  const styleId = 'yoyakl-widget-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      /* ScrollReveal用初期非表示（対象ウィジェットに data-effect="true" がある場合のみ適用） */
      html.sr .yoyakl-widget[data-effect="1"] .yk-card,
      html.sr .yoyakl-widget[data-effect="true"] .yk-card {
        visibility: hidden;
      }
      .yoyakl-widget {
        --yk-pink: var(--yoyakl-primary, #758e7b); /* セージグリーン */
        --yk-pink-hover: var(--yoyakl-primary-hover, #5d7362);
        --yk-pink-light: var(--yoyakl-primary-light, #f1f4f2);
        --yk-gray-50: #f8fafc;
        --yk-gray-100: #f1f5f9;
        --yk-gray-200: #e2e8f0;
        --yk-gray-300: #cbd5e1;
        --yk-gray-500: #64748b;
        --yk-gray-700: #334155;
        --yk-gray-800: #1e293b;
        --yk-gray-900: #0f172a;
        --yk-radius-lg: 12px;
        --yk-radius-md: 8px;
        --yk-radius-sm: 4px;
        --yk-font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        
        font-family: var(--yk-font);
        color: var(--yk-gray-900);
        margin: 0 auto;
        padding: 0;
        box-sizing: border-box;
      }
      /* テーマ側の ScrollReveal 用初期非表示ルール（html.sr .yk-card { visibility: hidden; }）を打ち消し、
         effect が無効な場合は最初から表示されるようにします */
      html.sr .yoyakl-widget .yk-card {
        visibility: visible;
      }
      .yoyakl-widget * {
        box-sizing: border-box;
      }
      
      /* タブメニュー (モードが 'all' の場合に使用) */
      .yk-tabs-container {
        display: flex;
        justify-content: center;
        margin-bottom: 24px;
      }
      .yk-tabs {
        display: inline-flex;
        background: var(--yk-gray-100);
        padding: 6px;
        border-radius: var(--yk-radius-lg);
        border: 1px solid var(--yk-gray-200);
      }
      .yk-tab-btn {
        border: none;
        background: transparent;
        padding: 10px 24px;
        font-size: 15px;
        font-weight: 600;
        color: var(--yk-gray-500);
        border-radius: var(--yk-radius-md);
        cursor: pointer;
        transition: all 0.25s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .yk-tab-btn:hover {
        color: var(--yk-gray-800);
      }
      .yk-tab-btn.active {
        background: #ffffff;
        color: var(--yk-pink);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      }
      
      /* コンテンツ表示エリア */
      .yk-tab-panel {
        display: none;
        animation: yk-fadeIn 0.3s ease;
      }
      .yk-tab-panel.active {
        display: block;
      }
      
      @keyframes yk-fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      /* セラピスト一覧グリッド */
      .yk-therapist-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      @media (min-width: 600px) {
        .yk-therapist-grid {
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
        }
      }
      .yk-card {
        background: rgba(255, 255, 255, 0.15); /* 透明度を15%に引き上げ、究極のシースルー・ガラス板を再現 */
        backdrop-filter: blur(12px); /* ぼかし強度を12pxに上げて可読性と極上の高級感を両立 */
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.25); /* 極めてクリアなエッジを表現する極薄枠 */
        border-radius: var(--yk-radius-lg);
        overflow: hidden;
        transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        display: flex;
        flex-direction: column;
        box-shadow: 0 12px 28px -5px rgba(0, 0, 0, 0.13), 0 8px 16px -8px rgba(0, 0, 0, 0.08); /* 存在感を際立たせる深く上質な影 */
      }
      .yk-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 22px 38px -5px rgba(0, 0, 0, 0.18), 0 14px 24px -8px rgba(0, 0, 0, 0.12); /* ホバー時はさらに浮遊する立体感に */
        border-color: var(--yk-gray-300);
      }
      
      /* 写真エリア */
      .yk-photo-wrapper {
        position: relative;
        aspect-ratio: 3 / 4;
        background: var(--yk-gray-100);
        overflow: hidden;
      }
      .yk-photo-link {
        display: block;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      .yk-photo {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.4s ease;
      }
      .yk-card:hover .yk-photo {
        transform: scale(1.02);
      }
      
      /* 画像がない場合のプレースホルダー */
      .yk-photo-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--yk-gray-500);
        background: linear-gradient(135deg, var(--yk-gray-50) 0%, var(--yk-gray-100) 100%);
      }
      .yk-photo-placeholder svg {
        width: 40px;
        height: 40px;
        margin-bottom: 8px;
        color: var(--yk-gray-300);
      }
      
      .yk-rank-badge {
        position: absolute;
        top: 10px;
        left: 10px;
        padding: 3px 10px;
        border-radius: 9999px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.05em;
        pointer-events: none; /* 下の写真リンクをクリック可能にする */
        z-index: 2;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .yk-rank-badge-standard {
        background: rgba(117, 142, 123, 0.95); /* セージグリーン */
        color: #ffffff;
      }
      .yk-rank-badge-premium {
        background: linear-gradient(135deg, #bf953f 0%, #fcf6ba 25%, #b38728 50%, #fbf5b7 75%, #aa771c 100%); /* 高級金属風マルチゴールドグラデーション */
        color: #3d2c00; /* 高級感のある深みのあるゴールドブロンズ文字 */
        font-size: 11px; /* 少し大きめに */
        padding: 4px 12px; /* 少し大きめに */
        letter-spacing: 0.1em; /* プレミアムな文字間隔 */
        text-shadow: 0px 1px 0px rgba(255, 255, 255, 0.6);
        box-shadow: 0 4px 10px rgba(170, 124, 17, 0.4), inset 0 1.5px 0px rgba(255, 255, 255, 0.5); /* 3D的なインセットシャドウ */
        border: 1.5px solid #e5c060; /* 明るいゴールド枠 */
      }
      .yk-rookie-badge-img {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 50px;
        height: auto;
        pointer-events: none;
        filter: drop-shadow(0px 2px 5px rgba(0,0,0,0.15));
        z-index: 2;
      }
      .yk-today-work-badge {
        position: absolute;
        bottom: 8px;
        left: 8px;
        background: #22c55e; /* 明るい緑 */
        color: #ffffff;
        padding: 5px 12px;
        border-radius: var(--yk-radius-md);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.05em;
        pointer-events: none;
        box-shadow: 0 4px 6px rgba(34, 197, 94, 0.35);
        z-index: 2;
      }
      
      /* ホバー時にハートビート（心拍）アニメーション */
      .yk-card:hover .yk-rookie-badge-img {
        animation: yk-heartbeat 1.2s infinite ease-in-out;
      }
      
      @keyframes yk-heartbeat {
        0% { transform: scale(1); }
        14% { transform: scale(1.1); }
        28% { transform: scale(1); }
        42% { transform: scale(1.1); }
        70% { transform: scale(1); }
      }
      
      /* カード内情報 */
      .yk-card-info {
        padding: 14px;
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        text-align: center; /* ユーザーサイト風に中央寄せ */
      }
      .yk-name {
        font-size: 16px;
        font-weight: 700;
        color: var(--yk-gray-900);
        margin-bottom: 4px;
      }
      .yk-name-link {
        color: inherit;
        text-decoration: none !important;
        transition: color 0.2s ease;
      }
      .yk-name-link:hover {
        color: var(--yk-pink);
      }
      
      .yk-profile-str {
        font-size: 12px;
        color: var(--yk-gray-500);
        margin-bottom: 10px;
        font-weight: 500;
      }
      .yk-comment {
        font-size: 12px;
        color: var(--yk-gray-500);
        line-height: 1.5;
        margin: 0 0 12px 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        flex-grow: 1;
      }
      
      /* 予約・指名ボタン（一覧カード用） */
      .yk-card-book-btn {
        width: 100%;
        background: var(--yk-pink-light);
        color: var(--yk-pink) !important;
        border: 1px solid rgba(117, 142, 123, 0.2);
        text-align: center;
        text-decoration: none !important;
        padding: 8px 12px;
        border-radius: var(--yk-radius-md);
        font-size: 13px;
        font-weight: 700;
        margin-top: 14px;
        display: block;
        transition: all 0.2s ease;
      }
      .yk-card-book-btn:hover {
        background: var(--yk-pink);
        color: #ffffff !important;
        border-color: var(--yk-pink);
      }
      
      /* 出勤予定 */
      .yk-shifts-title {
        font-size: 10px;
        font-weight: 700;
        color: var(--yk-gray-500);
        margin-bottom: 6px;
        border-bottom: 1px solid var(--yk-gray-100);
        padding-bottom: 4px;
        text-align: left;
      }
      .yk-shift-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .yk-shift-item {
        font-size: 11px;
        display: flex;
        justify-content: space-between;
        color: var(--yk-gray-700);
      }
      .yk-shift-date {
        font-weight: 500;
      }
      .yk-shift-time {
        font-weight: 600;
        color: var(--yk-pink);
      }
      .yk-shift-none {
        font-size: 11px;
        color: var(--yk-gray-500);
        font-style: italic;
      }
      
      /* スケジュール用日付選択タブ (日付ボタン一覧) */
      .yk-sched-date-tabs-container {
        margin-bottom: 20px;
        width: 100%;
      }
      .yk-sched-date-tabs {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
        width: 100%;
      }
      .yk-sched-date-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: var(--yk-gray-100);
        border: 1px solid var(--yk-gray-200);
        border-radius: var(--yk-radius-md);
        padding: 6px 2px;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 0;
      }
      .yk-sched-date-btn:hover {
        background: var(--yk-gray-200);
      }
      .yk-sched-date-btn .yk-date-btn-date {
        font-size: 12px;
        font-weight: 700;
        color: var(--yk-gray-800);
      }
      .yk-sched-date-btn .yk-date-btn-day {
        font-size: 9px;
        font-weight: 700;
        color: var(--yk-gray-500);
        margin-top: 2px;
      }
      .yk-sched-date-btn .yk-date-btn-day.sun {
        color: #ef4444;
      }
      .yk-sched-date-btn .yk-date-btn-day.sat {
        color: #3b82f6;
      }
      .yoyakl-widget .yk-sched-date-btn.active {
        background: var(--yk-pink) !important;
        border-color: var(--yk-pink) !important;
      }
      .yoyakl-widget .yk-sched-date-btn.active .yk-date-btn-date,
      .yoyakl-widget .yk-sched-date-btn.active .yk-date-btn-day,
      .yoyakl-widget .yk-sched-date-btn.active .yk-date-btn-day.sun,
      .yoyakl-widget .yk-sched-date-btn.active .yk-date-btn-day.sat {
        color: #ffffff !important;
      }
      
      /* スケジュール内セラピストカード用の時間帯予約ボタン */
      .yk-card-hours-badge {
        background: var(--yk-pink);
        color: #ffffff !important;
        padding: 8px 12px;
        border-radius: var(--yk-radius-md);
        font-size: 12px;
        font-weight: 700;
        margin-top: auto;
        text-align: center;
        text-decoration: none !important;
        display: block;
        transition: background 0.2s;
      }
      .yk-card-hours-badge:hover {
        background: var(--yk-pink-hover);
      }
      
      /* 個人ページ用レイアウト */
      .yk-single-therapist-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
        max-width: 900px;
        margin: 0 auto;
        width: 100%;
      }
      .yk-single-profile-card {
        width: 100%;
        background: #ffffff;
        border: 1px solid var(--yk-gray-200);
        border-radius: var(--yk-radius-lg);
        padding: 32px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        box-shadow: 0 1px 5px rgba(0,0,0,0.05);
      }
      .yk-single-avatar-wrapper {
        width: 100%;
        max-width: 320px;
        aspect-ratio: 2 / 3;
        border-radius: var(--yk-radius-lg);
        overflow: hidden;
        margin-bottom: 20px;
        background: var(--yk-gray-100);
        border: 1px solid var(--yk-gray-200);
        box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.1);
        position: relative;
      }
      .yk-single-avatar {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s ease;
      }
      .yk-single-avatar-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--yk-gray-200);
        color: var(--yk-gray-500);
        font-size: 36px;
        font-weight: 700;
      }
      .yk-single-thumbnails {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-top: 16px;
        flex-wrap: wrap;
        width: 100%;
        max-width: 320px;
      }
      .yk-single-thumb {
        width: 60px;
        height: 90px;
        object-fit: cover;
        border-radius: var(--yk-radius-sm);
        border: 2px solid var(--yk-gray-200);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .yk-single-thumb:hover, .yk-single-thumb.active {
        border-color: var(--yk-pink);
        transform: scale(1.05);
      }
      .yk-single-profile-info {
        width: 100%;
        margin-top: 20px;
      }
      .yk-single-name {
        font-size: 28px;
        font-weight: 700;
        margin: 0 0 10px 0;
        color: var(--yk-gray-900);
      }
      .yk-single-profile-str {
        font-size: 16px;
        color: var(--yk-pink);
        margin-bottom: 20px;
        font-weight: 700;
      }
      .yk-single-comment-header {
        font-size: 16px;
        font-weight: 700;
        color: var(--yk-gray-800);
        margin: 20px 0 8px;
        border-top: 1px dashed var(--yk-gray-300);
        padding-top: 20px;
        text-align: center;
      }
      .yk-single-comment {
        font-size: 15px;
        color: var(--yk-gray-700);
        line-height: 1.8;
        max-width: 600px;
        margin: 0 auto 30px auto;
        text-align: center;
      }
      
      .yk-general-book-btn-main {
        width: 100%;
        max-width: 320px;
        background: var(--yk-pink);
        color: #ffffff !important;
        text-decoration: none !important;
        padding: 12px 16px;
        border-radius: var(--yk-radius-md);
        font-size: 14px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
        cursor: pointer;
        margin: 0 auto;
      }
      .yk-general-book-btn-main:hover {
        background: var(--yk-pink-hover);
      }
      
      .yk-single-schedule-card {
        width: 100%;
        background: #ffffff;
        border: 1px solid var(--yk-gray-200);
        border-radius: var(--yk-radius-lg);
        padding: 32px;
        box-shadow: 0 1px 5px rgba(0,0,0,0.05);
      }
      .yk-single-schedule-title {
        font-size: 20px;
        font-weight: 700;
        margin: 0 0 24px 0;
        color: var(--yk-gray-900);
        border-left: 4px solid var(--yk-pink);
        padding-left: 12px;
        text-align: left;
      }
      .yk-single-shift-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
      }
      @media (min-width: 768px) {
        .yk-single-shift-list {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 12px;
        }
      }
      .yk-single-shift-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border: 1px solid var(--yk-gray-200);
        border-radius: var(--yk-radius-md);
        background: var(--yk-gray-50);
        font-size: 14px;
        transition: all 0.2s ease;
      }
      @media (min-width: 768px) {
        .yk-single-shift-row {
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 16px 8px;
          min-height: 140px;
        }
      }
      .yk-single-shift-date {
        font-weight: 700;
        color: var(--yk-gray-700);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      @media (min-width: 768px) {
        .yk-single-shift-date {
          flex-direction: column;
          gap: 4px;
          margin-bottom: 12px;
        }
      }
      .yk-single-shift-date.today {
        color: var(--yk-pink);
      }
      .yk-single-today-tag {
        background: var(--yk-pink);
        color: #ffffff;
        font-size: 9px;
        padding: 2px 6px;
        border-radius: 10px;
        font-weight: 700;
      }
      .yk-single-shift-time {
        font-size: 14px;
        margin: 8px 0;
      }
      .yk-single-shift-action {
        width: auto;
      }
      @media (min-width: 768px) {
        .yk-single-shift-action {
          width: 100%;
          margin-top: auto;
        }
      }
      .yk-single-book-btn {
        background: var(--yk-pink-light);
        color: var(--yk-pink) !important;
        border: 1px solid rgba(117, 142, 123, 0.2);
        padding: 8px 16px;
        border-radius: var(--yk-radius-md);
        font-size: 12px;
        font-weight: 700;
        text-decoration: none !important;
        display: inline-block;
        width: 100%;
        text-align: center;
        transition: all 0.2s ease;
      }
      .yk-single-book-btn:hover {
        background: var(--yk-pink);
        color: #ffffff !important;
        border-color: var(--yk-pink);
      }
      
      .yk-no-shifts {
        font-size: 13px;
        color: var(--yk-gray-500);
        text-align: center;
        padding: 32px 0;
        grid-column: 1/-1;
      }
      
      /* ローダー */
      .yk-loader-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
      }
      .yk-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--yk-gray-200);
        border-top-color: var(--yk-pink);
        border-radius: 50%;
        animation: yk-spin 0.8s linear infinite;
        margin-bottom: 12px;
      }
      @keyframes yk-spin {
        to { transform: rotate(360deg); }
      }
      .yk-loading-text {
        font-size: 13px;
        color: var(--yk-gray-500);
      }
      
      /* エラー表示 */
      .yk-error-box {
        border: 1px solid #fca5a5;
        background: #fef2f2;
        color: #991b1b;
        padding: 16px;
        border-radius: var(--yk-radius-lg);
        font-size: 14px;
        font-weight: 500;
        text-align: center;
      }
    `;
    document.head.appendChild(style);
  }

  // 各種ヘルパー関数
  function revealVisibleCards(scope) {
    if (typeof ScrollReveal === 'undefined') return;
    const enableEffect = scope.getAttribute('data-effect') === '1' || scope.getAttribute('data-effect') === 'true';
    if (!enableEffect) return;

    const cards = Array.from(scope.querySelectorAll('.yk-card')).filter(card => {
      const panel = card.closest('.yk-tab-panel');
      if (panel && !panel.classList.contains('active')) {
        return false;
      }
      if (card.getAttribute('data-sr-id')) {
        return false;
      }
      return true;
    });

    if (cards.length > 0) {
      const triggerOffset = Math.round(window.innerHeight / 3);
      ScrollReveal().reveal(cards, {
        origin: 'bottom',
        distance: '25px',
        duration: 3800,
        delay: 350,
        opacity: 0,
        scale: 0.95,
        easing: 'cubic-bezier(0.25, 1, 0.3, 1)',
        interval: 250,
        reset: false,
        viewFactor: 0.05,
        offset: triggerOffset
      });
    }
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return timeStr;
  }

  function resolvePhotoUrl(photoUrl, base, width = null) {
    if (!photoUrl) return null;
    let absoluteUrl = photoUrl;
    if (!photoUrl.startsWith('http://') && !photoUrl.startsWith('https://') && !photoUrl.startsWith('data:')) {
      absoluteUrl = `${base}${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`;
    }
    if (width && base && !absoluteUrl.startsWith('data:')) {
      return `${base}/_next/image?url=${encodeURIComponent(absoluteUrl)}&w=${width}&q=75`;
    }
    return absoluteUrl;
  }

  function getJstDateString(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatShortDate(dateStr, showYear = false) {
    const d = new Date(dateStr);
    const m = d.getMonth() + 1;
    const date = d.getDate();
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOfWeek = days[d.getDay()];
    if (showYear) {
      return `${d.getFullYear()}/${m}/${date}(${dayOfWeek})`;
    }
    return `${m}/${date}(${dayOfWeek})`;
  }

  // ユーザーサイト風のプロフィール文字列整形 (28才 T.167 B.87(E) W.58 H.87)
  function formatProfileString(t) {
    const parts = [];
    if (t.age) parts.push(`${t.age}才`);
    if (t.height) parts.push(`T.${t.height}`);
    if (t.bust && t.bust_cup) {
      parts.push(`B.${t.bust}(${t.bust_cup})`);
    } else if (t.bust_cup) {
      parts.push(`B.(${t.bust_cup})`);
    }
    if (t.waist) parts.push(`W.${t.waist}`);
    if (t.hip) parts.push(`H.${t.hip}`);
    return parts.join(' ');
  }

  // 初期化開始
  document.addEventListener('DOMContentLoaded', initWidget);
  // DOMContentLoadedがすでに発生していた場合のセーフティ
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initWidget();
  }

  function initWidget() {
    const widgets = document.querySelectorAll('.yoyakl-widget, #yoyakl-widget');
    if (widgets.length === 0) return;

    widgets.forEach(widget => {
      if (widget.dataset.initialized) return;
      widget.dataset.initialized = 'true';

      const shopCode = widget.getAttribute('data-shop-code');
      const mode = widget.getAttribute('data-mode') || 'all';
      const therapistName = widget.getAttribute('data-therapist-name');
      const therapistId = widget.getAttribute('data-therapist-id');
      const castUrlPattern = widget.getAttribute('data-cast-url-pattern') || '/cast/{name}/';
      const rookieOnly = widget.getAttribute('data-rookie') === '1' || widget.getAttribute('data-rookie') === 'true';
      const todayOnly = widget.getAttribute('data-today') === '1' || widget.getAttribute('data-today') === 'true';

      if (!shopCode) {
        widget.innerHTML = '<div class="yk-error-box">エラー: data-shop-code が設定されていません。</div>';
        return;
      }

      // ローディング表示
      widget.innerHTML = `
        <div class="yk-loader-container">
          <div class="yk-spinner"></div>
          <div class="yk-loading-text">スケジュール情報を読み込み中...</div>
        </div>
      `;

      // APIからデータ取得
      const apiUrl = `${apiBase}/api/public/${shopCode}`;
      fetch(apiUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error('データの取得に失敗しました');
          }
          return response.json();
        })
        .then(data => {
          renderWidget(widget, data, mode, shopCode, therapistName, therapistId, castUrlPattern, rookieOnly, todayOnly);
          
          // data-effect が有効な場合のみ ScrollReveal の読み込み・初期化を実行
          const enableEffect = widget.getAttribute('data-effect') === '1' || widget.getAttribute('data-effect') === 'true';
          if (enableEffect) {
            let revealAttempts = 0;
            const revealInterval = setInterval(() => {
              revealAttempts++;
              if (typeof ScrollReveal !== 'undefined') {
                clearInterval(revealInterval);
                revealVisibleCards(widget);
              } else if (revealAttempts > 50) { // 最大5秒で監視を解除
                clearInterval(revealInterval);
              }
            }, 100);
          }
        })
        .catch(error => {
          console.error('[Yoyakl] API Error:', error);
          widget.innerHTML = `<div class="yk-error-box">情報の取得に失敗しました。時間をおいて再度お試しください。</div>`;
        });
    });
  }

  function renderWidget(container, data, mode, shopCode, therapistName, therapistId, castUrlPattern, rookieOnly = false, todayOnly = false) {
    const { shifts, therapists } = data;
    const cutoff = data.business_day_cutoff || '06:00';
    const displayTherapists = rookieOnly ? therapists.filter(t => t.is_rookie) : therapists;
    
    // タイムゾーンセーフなJST現在日時の取得と営業日切替判定
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const jstDate = new Date(utcTime + (3600000 * 9));
    
    const cutoffParts = cutoff.split(':');
    const cutH = parseInt(cutoffParts[0] || '6', 10);
    const cutM = parseInt(cutoffParts[1] || '0', 10);
    
    const currentJstMinutes = jstDate.getHours() * 60 + jstDate.getMinutes();
    const cutoffMinutes = cutH * 60 + cutM;
    
    const businessDate = new Date(jstDate);
    if (currentJstMinutes < cutoffMinutes) {
      businessDate.setDate(businessDate.getDate() - 1);
    }
    const todayStr = getJstDateString(businessDate);
    
    // 予約用URLの生成ヘルパー
    const reserveUrl = container.getAttribute('data-reserve-url') || `${apiBase}/reserve/${shopCode}`;
    function getBookUrl(therapistId, dateStr = '') {
      const separator = reserveUrl.includes('?') ? '&' : '?';
      let url = `${reserveUrl}${separator}therapist_id=${therapistId}`;
      if (dateStr) {
        url += `&date=${dateStr}`;
      }
      return url;
    }
    
    // セラピスト個人用詳細ページリンクを生成するヘルパー
    function getTherapistProfileUrl(t) {
      // 本番サーバーURLがDBに入っている場合そちらを優先する仕様でしたが、
      // 動的ページ生成機能を使う場合は無視するようにします
      // if (t.hp_url) {
      //   return t.hp_url;
      // }
      if (!castUrlPattern) return '#';
      const cleanName = t.name.replace(/\s+/g, '');
      return castUrlPattern.replace('{name}', encodeURIComponent(cleanName)).replace('{id}', t.id);
    }

    // 日付スケジュール枠の作成
    const datesList = [];
    const daysCount = todayOnly ? 1 : 7;
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(businessDate);
      d.setDate(businessDate.getDate() + i);
      datesList.push(getJstDateString(d));
    }

    // モードに応じてレイアウトを分岐描画
    if (mode === 'single-therapist') {
      // 個人スケジュール表示モード
      let targetT = null;
      if (therapistId) {
        targetT = therapists.find(t => t.id === therapistId);
      } else if (therapistName) {
        const cleanSearch = therapistName.replace(/\s+/g, '').toLowerCase();
        targetT = therapists.find(t => {
          const cleanName = t.name.replace(/\s+/g, '').toLowerCase();
          return cleanName.includes(cleanSearch) || cleanSearch.includes(cleanName);
        });
      }

      if (!targetT) {
        container.innerHTML = `<div class="yk-error-box">セラピスト「${therapistName || therapistId}」が見つかりません。</div>`;
        return;
      }

      container.innerHTML = renderSingleTherapistHTML(targetT, datesList, shifts, shopCode, getBookUrl);
      
      // サムネイルクリック時のメイン画像切り替えイベント
      const thumbs = container.querySelectorAll('.yk-single-thumb');
      const mainImg = container.querySelector('.yk-single-avatar');
      thumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
          thumbs.forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
          if (mainImg) {
            mainImg.src = thumb.src;
          }
        });
      });
    } else if (mode === 'therapists') {
      // セラピスト一覧ページ専用表示
      container.innerHTML = `
        <div class="yk-therapist-grid">
          ${renderTherapistListHTML(displayTherapists, shopCode, getTherapistProfileUrl, shifts, getBookUrl, todayStr)}
        </div>
      `;
    } else if (mode === 'schedule') {
      // スケジュールページ専用表示 (日付タブ付き)
      container.innerHTML = renderScheduleOnlyHTML(datesList, shifts, shopCode, getTherapistProfileUrl, getBookUrl);
      initScheduleTabEvents(container, datesList);
    } else {
      // 複合表示（両方タブ切り替え）
      container.innerHTML = `
        <div class="yk-tabs-container">
          <div class="yk-tabs" role="tablist">
            <button class="yk-tab-btn active" id="yk-tab-btn-therapists" role="tab" aria-selected="true" aria-controls="yk-panel-therapists">
              <svg style="width:16px;height:16px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              セラピスト一覧
            </button>
            <button class="yk-tab-btn" id="yk-tab-btn-schedule" role="tab" aria-selected="false" aria-controls="yk-panel-schedule">
              <svg style="width:16px;height:16px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              出勤スケジュール
            </button>
          </div>
        </div>
        
        <!-- セラピスト一覧パネル -->
        <div class="yk-tab-panel active" id="yk-panel-therapists" role="tabpanel" aria-labelledby="yk-tab-btn-therapists">
          <div class="yk-therapist-grid">
            ${renderTherapistListHTML(displayTherapists, shopCode, getTherapistProfileUrl, shifts, getBookUrl, todayStr)}
          </div>
        </div>
        
        <!-- スケジュール一覧パネル -->
        <div class="yk-tab-panel" id="yk-panel-schedule" role="tabpanel" aria-labelledby="yk-tab-btn-schedule">
          ${renderScheduleOnlyHTML(datesList, shifts, shopCode, getTherapistProfileUrl, getBookUrl)}
        </div>
      `;

      // メインタブイベントの紐付け
      const tabTherapistsBtn = container.querySelector('#yk-tab-btn-therapists');
      const tabScheduleBtn = container.querySelector('#yk-tab-btn-schedule');
      const panelTherapists = container.querySelector('#yk-panel-therapists');
      const panelSchedule = container.querySelector('#yk-panel-schedule');

      function switchMainTab(showTherapists) {
        if (showTherapists) {
          tabTherapistsBtn.classList.add('active');
          tabTherapistsBtn.setAttribute('aria-selected', 'true');
          tabScheduleBtn.classList.remove('active');
          tabScheduleBtn.setAttribute('aria-selected', 'false');
          panelTherapists.classList.add('active');
          panelSchedule.classList.remove('active');
          setTimeout(() => {
            revealVisibleCards(container);
          }, 50);
        } else {
          tabTherapistsBtn.classList.remove('active');
          tabTherapistsBtn.setAttribute('aria-selected', 'false');
          tabScheduleBtn.classList.add('active');
          tabScheduleBtn.setAttribute('aria-selected', 'true');
          panelTherapists.classList.remove('active');
          panelSchedule.classList.add('active');
          setTimeout(() => {
            revealVisibleCards(container);
          }, 50);
        }
      }

      tabTherapistsBtn.addEventListener('click', () => switchMainTab(true));
      tabScheduleBtn.addEventListener('click', () => switchMainTab(false));

      // スケジュール側の日付サブタブのイベントを紐付け
      initScheduleTabEvents(container, datesList);
    }
  }

  // セラピストカード一覧HTML
  function renderTherapistListHTML(therapists, shopCode, getTherapistProfileUrl, shifts = [], getBookUrl, todayStr) {
    if (therapists.length === 0) {
      return '<div class="yk-no-shifts" style="grid-column:1/-1;">在籍セラピスト情報がありません。</div>';
    }

    return therapists.map(t => {
      const isWorkingToday = shifts.some(s => s.therapists && s.therapists.id === t.id && s.date === todayStr);
      const photoSrc = resolvePhotoUrl(t.photo_url || (t.photos && t.photos[0]), apiBase, 384);
      const hasPhoto = !!photoSrc;
      const profileText = formatProfileString(t);
      const bookUrl = getBookUrl ? getBookUrl(t.id) : `${apiBase}/reserve/${shopCode}?therapist_id=${t.id}`;
      const profileUrl = getTherapistProfileUrl(t);

      let rankBadgeHTML = '';
      if (t.therapist_ranks && t.therapist_ranks.name) {
        const rankName = t.therapist_ranks.name;
        const isPremium = rankName.includes('プレミアム') || rankName.includes('Premium');
        const badgeClass = isPremium ? 'yk-rank-badge-premium' : 'yk-rank-badge-standard';
        rankBadgeHTML = `<span class="yk-rank-badge ${badgeClass}">${rankName}</span>`;
      }

      return `
        <div class="yk-card">
          <div class="yk-photo-wrapper">
            <a href="${profileUrl}" target="_self" class="yk-photo-link" title="${t.name}の個人ページを見る">
              ${hasPhoto ? 
                `<img src="${photoSrc}" alt="${t.name}" class="yk-photo" loading="lazy" />` : 
                `<div class="yk-photo-placeholder">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <span>No Photo</span>
                </div>`
              }
            </a>
            ${rankBadgeHTML}
            ${t.is_rookie ? `<img src="${apiBase}/widgets/rookie.png" alt="新人" class="yk-rookie-badge-img" />` : ''}
            ${isWorkingToday ? `<span class="yk-today-work-badge">本日出勤</span>` : ''}
          </div>
          <div class="yk-card-info">
            <div class="yk-name">
              <a href="${profileUrl}" target="_self" class="yk-name-link" title="${t.name}の個人ページを見る">${t.name}</a>
            </div>
            ${profileText ? `<div class="yk-profile-str">${profileText}</div>` : ''}
            <p class="yk-comment" title="${t.comment || ''}">${t.comment || 'よろしくお願いします。'}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  // スケジュール専用HTML（上部日付タブ ＋ アクティブ日グリッド）
  function renderScheduleOnlyHTML(datesList, shifts, shopCode, getTherapistProfileUrl, getBookUrl) {
    const todayStr = datesList[0];
    
    // 日付ごとにシフトを整理
    const shiftsByDate = {};
    datesList.forEach(d => {
      shiftsByDate[d] = [];
    });
    shifts.forEach(s => {
      if (shiftsByDate[s.date]) {
        shiftsByDate[s.date].push(s);
      }
    });

    // 日付選択タブのHTML
    const tabsHTML = datesList.length <= 1 ? '' : `
      <div class="yk-sched-date-tabs-container">
        <div class="yk-sched-date-tabs">
          ${datesList.map((dateStr, idx) => {
            const d = new Date(dateStr);
            const m = d.getMonth() + 1;
            const date = d.getDate();
            const days = ['日', '月', '火', '水', '木', '金', '土'];
            const dayOfWeek = days[d.getDay()];
            const isToday = dateStr === todayStr;
            const isSunday = dayOfWeek === '日';
            const isSaturday = dayOfWeek === '土';
            const dayClass = isSunday ? 'sun' : (isSaturday ? 'sat' : '');
            const activeClass = idx === 0 ? 'active' : '';
            return `
              <button class="yk-sched-date-btn ${activeClass}" data-date="${dateStr}">
                <span class="yk-date-btn-date">${m}/${date}</span>
                <span class="yk-date-btn-day ${dayClass}">${isToday ? '今日' : dayOfWeek}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // 日付ごとの表示パネルHTML
    const panelsHTML = datesList.map((dateStr, idx) => {
      const activeClass = idx === 0 ? 'active' : '';
      const dayShifts = shiftsByDate[dateStr] || [];
      dayShifts.sort((a, b) => a.start_time.localeCompare(b.start_time));

      return `
        <div class="yk-tab-panel ${activeClass}" id="yk-day-panel-${dateStr}" data-panel-date="${dateStr}">
          <div class="yk-therapist-grid">
            ${dayShifts.length > 0 ? 
              dayShifts.map(s => {
                const t = s.therapists;
                if (!t) return '';
                const photoSrc = resolvePhotoUrl(t.photo_url || (t.photos && t.photos[0]), apiBase, 384);
                const hasPhoto = !!photoSrc;
                const profileText = formatProfileString(t);
                const bookUrl = getBookUrl ? getBookUrl(t.id, dateStr) : `${apiBase}/reserve/${shopCode}?therapist_id=${t.id}&date=${dateStr}`;
                const profileUrl = getTherapistProfileUrl(t);
                
                let rankBadgeHTML = '';
                if (t.therapist_ranks && t.therapist_ranks.name) {
                  const rankName = t.therapist_ranks.name;
                  const isPremium = rankName.includes('プレミアム') || rankName.includes('Premium');
                  const badgeClass = isPremium ? 'yk-rank-badge-premium' : 'yk-rank-badge-standard';
                  rankBadgeHTML = `<span class="yk-rank-badge ${badgeClass}">${rankName}</span>`;
                }
                return `
                  <div class="yk-card">
                    <div class="yk-photo-wrapper">
                      <a href="${profileUrl}" target="_self" class="yk-photo-link" title="${t.name}の個人ページを見る">
                        ${hasPhoto ? 
                          `<img src="${photoSrc}" alt="${t.name}" class="yk-photo" loading="lazy" />` : 
                          `<div class="yk-photo-placeholder">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                            <span>No Photo</span>
                          </div>`
                        }
                      </a>
                      ${rankBadgeHTML}
                      ${t.is_rookie ? `<img src="${apiBase}/widgets/rookie.png" alt="新人" class="yk-rookie-badge-img" />` : ''}
                    </div>
                    <div class="yk-card-info">
                      <div class="yk-name">
                        <a href="${profileUrl}" target="_self" class="yk-name-link" title="${t.name}の個人ページを見る">${t.name}</a>
                      </div>
                      ${profileText ? `<div class="yk-profile-str">${profileText}</div>` : ''}
                      <p class="yk-comment" title="${t.comment || ''}">${t.comment || 'よろしくお願いします。'}</p>
                      
                      <a href="${bookUrl}" target="_self" class="yk-card-hours-badge">
                        ${formatTime(s.start_time)} 〜 ${formatTime(s.end_time)} 指名予約
                      </a>
                    </div>
                  </div>
                `;
              }).join('') :
              `<div class="yk-no-shifts">この日の出勤予定はまだありません。</div>`
            }
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="yk-schedule-wrapper">
        ${tabsHTML}
        <div class="yk-schedule-panels">
          ${panelsHTML}
        </div>
      </div>
    `;
  }

  // 個人スケジュール＆プロフィール表示HTML
  function renderSingleTherapistHTML(therapist, datesList, shifts, shopCode, getBookUrl) {
    const todayStr = datesList[0];
    
    // このセラピストのシフトのみを抽出
    const myShifts = {};
    datesList.forEach(d => {
      myShifts[d] = null;
    });
    
    shifts.forEach(s => {
      if (s.therapists && s.therapists.id === therapist.id) {
        if (myShifts[s.date] === null) {
          myShifts[s.date] = s;
        }
      }
    });

    const photoSrc = resolvePhotoUrl(therapist.photo_url || (therapist.photos && therapist.photos[0]), apiBase, 640);
    const hasPhoto = !!photoSrc;
    const profileText = formatProfileString(therapist);

    // サムネイル画像の処理 (therapist.photos が存在する場合)
    let thumbnailsHTML = '';
    const photos = therapist.photos || [];
    if (photos.length > 1) {
      thumbnailsHTML = `
        <div class="yk-single-thumbnails">
          ${photos.map((p, idx) => `
            <img src="${resolvePhotoUrl(p, apiBase, 256)}" 
                 alt="${therapist.name} サムネイル ${idx + 1}" 
                 class="yk-single-thumb ${idx === 0 ? 'active' : ''}" 
                 data-index="${idx}" />
          `).join('')}
        </div>
      `;
    }

    const scheduleListHTML = datesList.map(dateStr => {
      const shift = myShifts[dateStr];
      const label = formatShortDate(dateStr, true);
      const isToday = dateStr === todayStr;
      
      let shiftText = '<span style="color:var(--yk-gray-500); font-weight:500;">お休み</span>';
      let bookBtn = '';
      
      if (shift) {
        shiftText = `<span style="color:var(--yk-pink); font-weight:700;">${formatTime(shift.start_time)} 〜 ${formatTime(shift.end_time)}</span>`;
        const bookUrl = getBookUrl ? getBookUrl(therapist.id, dateStr) : `${apiBase}/reserve/${shopCode}?therapist_id=${therapist.id}&date=${dateStr}`;
        bookBtn = `<a href="${bookUrl}" target="_self" class="yk-single-book-btn">予約する</a>`;
      }
      
      return `
        <div class="yk-single-shift-row">
          <span class="yk-single-shift-date ${isToday ? 'today' : ''}">
            ${label}
            ${isToday ? '<span class="yk-single-today-tag">本日</span>' : ''}
          </span>
          <span class="yk-single-shift-time">${shiftText}</span>
          <span class="yk-single-shift-action">${bookBtn}</span>
        </div>
      `;
    }).join('');

    let rankBadgeHTML = '';
    if (therapist.therapist_ranks && therapist.therapist_ranks.name) {
      const rankName = therapist.therapist_ranks.name;
      const isPremium = rankName.includes('プレミアム') || rankName.includes('Premium');
      const badgeClass = isPremium ? 'yk-rank-badge-premium' : 'yk-rank-badge-standard';
      rankBadgeHTML = `<span class="yk-rank-badge ${badgeClass}">${rankName}</span>`;
    }

    const generalBookUrl = getBookUrl ? getBookUrl(therapist.id) : `${apiBase}/reserve/${shopCode}?therapist_id=${therapist.id}`;

    return `
      <div class="yk-single-therapist-container">
        <div class="yk-single-profile-card">
          <div class="yk-single-avatar-wrapper">
            ${hasPhoto ? 
              `<img src="${photoSrc}" alt="${therapist.name}" class="yk-single-avatar" />` :
              `<div class="yk-single-avatar-placeholder">${therapist.name ? therapist.name.charAt(0) : 'T'}</div>`
            }
            ${rankBadgeHTML}
            ${therapist.is_rookie ? `<img src="${apiBase}/widgets/rookie.png" alt="新人" class="yk-rookie-badge-img" />` : ''}
          </div>
          ${thumbnailsHTML}
          
          <div class="yk-single-profile-info">
            <h3 class="yk-single-name">${therapist.name}</h3>
            ${profileText ? `<div class="yk-single-profile-str">${profileText}</div>` : ''}
            
            <div class="yk-single-comment-header">♥ 紹介文</div>
            <p class="yk-single-comment">${therapist.comment || 'よろしくお願いします。'}</p>
            <a href="${generalBookUrl}" target="_self" class="yk-general-book-btn-main">
              <svg style="width:16px;height:16px;margin-right:6px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              このキャストを指名してWEB予約
            </a>
          </div>
        </div>
        
        <div class="yk-single-schedule-card">
          <h4 class="yk-single-schedule-title">出勤スケジュール</h4>
          <div class="yk-single-shift-list">
            ${scheduleListHTML}
          </div>
        </div>
      </div>
    `;
  }

  // スケジュール内の日付サブタブ切り替え処理
  function initScheduleTabEvents(container, datesList) {
    const dateButtons = container.querySelectorAll('.yk-sched-date-btn');
    const dayPanels = container.querySelectorAll('[data-panel-date]');

    dateButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetDate = btn.getAttribute('data-date');
        
        // ボタン状態のアクティブ切り替え
        dateButtons.forEach(b => {
          if (b.getAttribute('data-date') === targetDate) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });

        // パネル表示の切り替え
        dayPanels.forEach(panel => {
          if (panel.getAttribute('data-panel-date') === targetDate) {
            panel.classList.add('active');
            setTimeout(() => {
              revealVisibleCards(container);
            }, 50);
          } else {
            panel.classList.remove('active');
          }
        });
      });
    });
  }

})();
