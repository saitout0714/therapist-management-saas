/**
 * 待機保証の金額を「待機時間」から決めるためのロジック。
 *
 * 店舗によっては「4時間未満なら1,000円、6時間以上なら2,000円」のように
 * 待機した長さで金額が変わる。定額1つでは表せないため、
 * standby_guarantee_tiers に「◯時間以上 → ◯円」の段階を並べて持たせ、
 * 条件を満たす中でいちばん長い段階を採用する。
 *
 * 「4時間未満1,000円 / 4〜6時間1,500円 / 6時間以上2,000円」なら
 *   0時間以上 → 1,000
 *   4時間以上 → 1,500
 *   6時間以上 → 2,000
 * と登録する（「未満」は、その1つ下の段階として表現される）。
 *
 * 段階が1つも登録されていない店舗では system_settings.standby_guarantee_amount
 * （定額の既定額）にフォールバックする。
 */

export interface StandbyGuaranteeTier {
  id?: string | null
  /** この時間数以上のときに適用する（例: 6 なら「6時間以上」） */
  min_hours: number
  amount: number
}

/**
 * 出勤時間の文字列を「その営業日の中での分数」に直す。
 *
 * 深夜0:00〜5:59 は前日から続く営業時間なので24時間を足して扱う
 * （toDisplayTime と同じ基準）。end_time が既に "29:00:00" のように
 * 24時間を超えた表記で入っている行もあるため、その場合はそのまま使う。
 */
function toBusinessMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null
  const m = timeStr.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  let hour = parseInt(m[1], 10)
  if (hour < 6) hour += 24
  return hour * 60 + parseInt(m[2], 10)
}

/**
 * 出勤枠から待機時間（時間単位）を出す。
 * 予約が1本も入らなかった人が対象なので、出勤時間まるごとが待機時間になる。
 * 時刻が取れない・逆転している場合は null（＝段階判定できない）。
 */
export function calcStandbyHours(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): number | null {
  const start = toBusinessMinutes(startTime)
  const end = toBusinessMinutes(endTime)
  if (start === null || end === null) return null
  const diff = end - start
  if (diff <= 0) return null
  return diff / 60
}

/**
 * 待機時間に対応する保証額を返す。
 *
 * @param hours     待機時間。null（時刻不明）のときは段階判定せず既定額を返す
 * @param tiers     店舗に登録された段階
 * @param fallback  段階が未登録／どれにも当てはまらない場合に使う定額
 */
export function resolveStandbyAmount(
  hours: number | null,
  tiers: StandbyGuaranteeTier[],
  fallback: number
): number {
  if (hours === null || tiers.length === 0) return fallback

  const matched = tiers
    .filter(t => hours >= t.min_hours)
    .sort((a, b) => b.min_hours - a.min_hours)[0]

  return matched ? matched.amount : fallback
}

/** 「6時間以上」のような表示用ラベル。0.5刻みの端数も潰さずに出す */
export function formatTierLabel(minHours: number): string {
  const rounded = Math.round(minHours * 10) / 10
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}時間以上`
}
