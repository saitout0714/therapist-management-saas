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

/**
 * 共有するかどうかはオーナー単位の設定（owners.pricing_mode / back_mode）が正。
 * 店舗ごとの *_source_shop_id は旧方式で、店舗が増えるたびに新店側で基準店を
 * 指し直す操作が必要だったため廃止していく。参照が残っている間の互換のために列は残す。
 *
 * 下の2つはオーナー設定を「その店舗にとっての参照先」に翻訳する。
 * 結果を shop.pricing_source_shop_id に詰めれば、getPricingShopId 以降は変更不要。
 */
type OwnerSharingRef = {
  pricing_mode?: string | null
  pricing_base_shop_id?: string | null
  back_mode?: string | null
  back_base_shop_id?: string | null
} | null | undefined

export function resolvePricingSourceShopId(owner: OwnerSharingRef, fallback?: string | null): string | null {
  // オーナー設定が取得できていない場合のみ、旧方式の値にフォールバックする
  if (!owner || owner.pricing_mode == null) return fallback ?? null
  return owner.pricing_mode === 'shared' ? owner.pricing_base_shop_id ?? null : null
}

export function resolveBackSourceShopId(owner: OwnerSharingRef, fallback?: string | null): string | null {
  if (!owner || owner.back_mode == null) return fallback ?? null
  return owner.back_mode === 'shared' ? owner.back_base_shop_id ?? null : null
}
