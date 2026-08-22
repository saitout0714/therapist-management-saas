/**
 * 実在しないセラピスト（「日祝割引2000円」「昼割2000円」などの料金・割引用疑似アカウント）
 * やテスト・ダミー用アカウントをポータル同期の対象から外すための判定ヘルパー
 */
export function isRealTherapist(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;

  // 割引き・料金表記・テスト・ダミーを除外する判定ルール
  // 例: "昼割2000円", "日祝割引2000円", "テストセラピスト", "ダミー"
  if (
    /割\d*円?/.test(trimmed) ||
    /割引/.test(trimmed) ||
    /テスト/.test(trimmed) ||
    /ダミー/.test(trimmed) ||
    /sample/i.test(trimmed) ||
    /test/i.test(trimmed)
  ) {
    return false;
  }

  return true;
}
