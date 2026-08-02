/**
 * クレジット / PayPay 決済の「未決済・決済完了」判定を一箇所にまとめたヘルパー。
 *
 * 予約登録時点ではカードを通していないため未決済であり、後から入金を確認して
 * 「決済完了」にする運用を想定している。判定はタイムチャート（横・縦）と
 * 予約詳細ページの3箇所で使うため、ここに集約している。
 */

export type CashlessMethod = 'credit' | 'paypay';

export interface PaymentMethodFields {
  payment_method?: string | null;
  options_payment_method?: string | null;
  extension_payment_method?: string | null;
}

/**
 * 予約に含まれるキャッシュレス決済の種類を返す。
 * 本体 → オプション → 延長 の順に見て、最初に見つかったものを代表とする。
 * 現金のみの予約なら null。
 */
export function getCashlessMethod(r: PaymentMethodFields): CashlessMethod | null {
  const candidates = [r.payment_method, r.options_payment_method, r.extension_payment_method];
  for (const m of candidates) {
    if (m === 'credit' || m === 'paypay') return m;
  }
  return null;
}

/** 「クレジット」「PayPay」の表示名 */
export function cashlessLabel(method: CashlessMethod): string {
  return method === 'credit' ? 'クレジット' : 'PayPay';
}

/** カード等に出す決済完了の文言（例: 「クレジット決済完了」） */
export function settledLabel(method: CashlessMethod): string {
  return `${cashlessLabel(method)}決済完了`;
}

/**
 * 未決済かどうか。キャッシュレス決済を含み、かつ入金確認がまだの場合に true。
 * 現金のみの予約は常に false（未決済という概念を持たない）。
 */
export function isUnpaid(
  r: PaymentMethodFields & { payment_settled_at?: string | null }
): boolean {
  return getCashlessMethod(r) !== null && !r.payment_settled_at;
}
