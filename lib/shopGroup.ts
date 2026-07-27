import { supabase } from '@/lib/supabase'

// 同一オーナー配下の店舗はコース・オプション・ランク等のマスターデータを共有する運用があるため、
// 単一店舗の shop_id だけでなく、同オーナーの全店舗 shop_id をまとめて取得する。
export async function getGroupShopIds(shopId: string, ownerId?: string | null): Promise<string[]> {
  if (!ownerId) return [shopId]
  const { data } = await supabase.from('shops').select('id').eq('owner_id', ownerId)
  if (data && data.length > 0) return data.map(s => s.id)
  return [shopId]
}
