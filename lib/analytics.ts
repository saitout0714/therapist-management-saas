/** 店舗ごとの GA4 測定ID。値が無い店舗は解析タグを出力しない。 */
export const SHOP_GA_MEASUREMENT_ID: Record<string, string> = {
  onyankospa: 'G-QSPY9RTNZ6',
};

/** 店舗ごとの GA4 レポート画面URL。管理画面の「アクセス解析」ショートカット用。 */
export const SHOP_GA_DASHBOARD_URL: Record<string, string> = {
  onyankospa:
    'https://analytics.google.com/analytics/web/provision/?pli=1&authuser=1#/a405054837p550419958/reports/intelligenthome?params=_u..nav%3Dmaui',
};
