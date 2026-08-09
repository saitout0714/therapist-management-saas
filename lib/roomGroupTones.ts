// ルーム順表示のグループ配色 (縦チャート / 横チャート / 週間表示で共通)
// accent: ドット・区切り線 / band: 見出し帯の地色 / border: 見出し帯の枠線 / cell: 出勤セル・行の地色 / text: 見出し文字
export type GroupTone = { accent: string; band: string; border: string; cell: string; text: string };

// ルームごとの色分けは行わず、全ルーム共通の1色を使う。
// 色分けに戻したい場合はこの配列に色を足せば buildRoomToneMap が並び順どおりに割り当てる。
export const ROOM_TONES: GroupTone[] = [
  { accent: '#64748B', band: '#FFFFFF', border: '#CBD5E1', cell: 'transparent', text: '#334155' },
];

export const FREE_TONE: GroupTone = { accent: '#94A3B8', band: '#FFFFFF', border: '#E2E8F0', cell: 'transparent', text: '#475569' };
export const OFF_TONE: GroupTone = { accent: '#FB7185', band: 'rgba(244,63,94,0.14)', border: 'rgba(244,63,94,0.35)', cell: 'transparent', text: '#9F1239' };

export type GroupKind = 'room' | 'free' | 'off';

/**
 * ルーム名の並び順どおりに色を割り当てる。
 * 同じルームは画面・曜日をまたいでも常に同じ色になるよう、名前をキーにしたMapで返す。
 */
export const buildRoomToneMap = (orderedRoomNames: string[]): Map<string, GroupTone> => {
  const map = new Map<string, GroupTone>();
  orderedRoomNames.forEach((name) => {
    if (map.has(name)) return;
    map.set(name, ROOM_TONES[map.size % ROOM_TONES.length]);
  });
  return map;
};

export const toneFor = (kind: GroupKind, name: string, map: Map<string, GroupTone>): GroupTone => {
  if (kind === 'off') return OFF_TONE;
  if (kind === 'free') return FREE_TONE;
  return map.get(name) ?? ROOM_TONES[0];
};
