/**
 * マルチショップ間の「料金設定」「バック設定」共有先を解決するヘルパー。
 * pricing_source_shop_id / back_source_shop_id が設定されている場合、
 * その参照先店舗のデータを共有する（未設定なら自店舗のデータをそのまま使う）。
 */

type PricingShopRef = { id: string; pricing_source_shop_id?: string | null }
type BackShopRef = { id: string; back_source_shop_id?: string | null }

export function getPricingShopId(shop: PricingShopRef): string {
  return shop.pricing_source_shop_id || shop.id
}

export function getBackShopId(shop: BackShopRef): string {
  return shop.back_source_shop_id || shop.id
}
