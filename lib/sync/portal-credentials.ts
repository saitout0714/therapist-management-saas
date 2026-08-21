/**
 * ポータルサイト（エステ魂 / メンズエステランキング）の接続情報を一元管理する。
 *
 * 【なぜこのファイルがあるか】
 * 以前は cron・手動同期・一括同期・個別送信の各ルートが、それぞれ独自に
 * shops テーブルから値を読んでログインURLを組み立てていた。その結果:
 *   - cron だけが shop.hp_url（店舗の公式サイト）を渡しており、エステ魂では
 *     なく店舗HPを開いてログインを試み、常に無反映のまま「成功」扱いだった
 *   - 一部のルートは 'https://estama.jp/'、別のルートは
 *     'https://estama.jp/login/?r=/admin/' と、渡す値がバラバラだった
 * といった不具合が繰り返し発生した。
 *
 * ポータルへの接続情報が必要な箇所は、必ずこのモジュール経由で取得すること。
 * 直接 shops テーブルの *_shop_url / *_login_id / *_password を読んで
 * ログインURLを組み立ててはいけない。
 */

export const ESTAMA_LOGIN_URL = 'https://estama.jp/login/?r=/admin/';
export const ESTHE_RANKING_LOGIN_URL = 'https://www.esthe-ranking.jp/login/';
export const ESLOVE_LOGIN_URL = 'https://eslove.jp/admin/login';

export interface PortalCredentials {
  /** ログインページのURL。ポータルへのアクセスは必ずここから始める */
  loginUrl: string;
  loginId: string;
  password: string;
}

/** shops テーブルから読み出す必要のあるカラム。select に渡して使う */
export const PORTAL_CREDENTIAL_COLUMNS =
  'estama_login_id, estama_password, estama_shop_url, esthe_ranking_login_id, esthe_ranking_password, esthe_ranking_shop_url, eslove_login_id, eslove_password, eslove_shop_url';

type ShopRow = {
  estama_login_id?: string | null;
  estama_password?: string | null;
  estama_shop_url?: string | null;
  esthe_ranking_login_id?: string | null;
  esthe_ranking_password?: string | null;
  esthe_ranking_shop_url?: string | null;
  eslove_login_id?: string | null;
  eslove_password?: string | null;
  eslove_shop_url?: string | null;
};

/**
 * エステ魂の接続情報を取り出す。未設定の場合は null。
 * shop は PORTAL_CREDENTIAL_COLUMNS（または '*'）で取得した行を渡すこと。
 */
export function getEstamaCredentials(shop: ShopRow | null | undefined): PortalCredentials | null {
  if (!shop?.estama_login_id || !shop?.estama_password) return null;
  return {
    loginUrl: shop.estama_shop_url || ESTAMA_LOGIN_URL,
    loginId: shop.estama_login_id,
    password: shop.estama_password,
  };
}

/**
 * メンズエステランキングの接続情報を取り出す。未設定の場合は null。
 * shop は PORTAL_CREDENTIAL_COLUMNS（または '*'）で取得した行を渡すこと。
 */
export function getEstheRankingCredentials(shop: ShopRow | null | undefined): PortalCredentials | null {
  if (!shop?.esthe_ranking_login_id || !shop?.esthe_ranking_password) return null;
  return {
    loginUrl: shop.esthe_ranking_shop_url || ESTHE_RANKING_LOGIN_URL,
    loginId: shop.esthe_ranking_login_id,
    password: shop.esthe_ranking_password,
  };
}

/**
 * エステラブの接続情報を取り出す。未設定の場合は null。
 * shop は PORTAL_CREDENTIAL_COLUMNS（または '*'）で取得した行を渡すこと。
 */
export function getEsloveCredentials(shop: ShopRow | null | undefined): PortalCredentials | null {
  if (!shop?.eslove_login_id || !shop?.eslove_password) return null;
  return {
    loginUrl: shop.eslove_shop_url || ESLOVE_LOGIN_URL,
    loginId: shop.eslove_login_id,
    password: shop.eslove_password,
  };
}
