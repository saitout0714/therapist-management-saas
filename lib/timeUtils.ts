/**
 * 時間文字列 (HH:MM:SS または HH:MM) を受け取り、
 * 00:00〜05:59 の深夜時間帯であれば 24時間 を加算して 24:00〜29:59 の表記に補正した
 * HH:MM 形式の文字列を返します。
 * 
 * 例: "01:30:00" -> "25:30"
 *     "25:00:00" -> "25:00"
 *     "18:00"    -> "18:00"
 */
export function toDisplayTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];
    if (h >= 0 && h < 6) {
      h += 24;
    }
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  return timeStr.slice(0, 5);
}
