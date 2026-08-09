// ルーム順表示のグループ配色 (縦チャート / 横チャート / 週間表示で共通)
// accent: 見出しの下線・ドット・区切り線 / band: 見出し帯の地色 / cell: 出勤セル・行の地色 / text: 見出し文字
export type GroupTone = { accent: string; band: string; cell: string; text: string };

export const ROOM_TONES: GroupTone[] = [
  { accent: '#6366F1', band: 'rgba(99,102,241,0.07)', cell: 'rgba(99,102,241,0.035)', text: '#3730A3' },
  { accent: '#0D9488', band: 'rgba(13,148,136,0.07)', cell: 'rgba(13,148,136,0.035)', text: '#115E59' },
  { accent: '#D97706', band: 'rgba(217,119,6,0.08)', cell: 'rgba(217,119,6,0.04)', text: '#92400E' },
  { accent: '#0284C7', band: 'rgba(2,132,199,0.07)', cell: 'rgba(2,132,199,0.035)', text: '#075985' },
  { accent: '#DB2777', band: 'rgba(219,39,119,0.07)', cell: 'rgba(219,39,119,0.035)', text: '#9D174D' },
  { accent: '#65A30D', band: 'rgba(101,163,13,0.08)', cell: 'rgba(101,163,13,0.04)', text: '#3F6212' },
];

export const FREE_TONE: GroupTone = { accent: '#94A3B8', band: 'rgba(100,116,139,0.08)', cell: 'rgba(100,116,139,0.03)', text: '#475569' };
export const OFF_TONE: GroupTone = { accent: '#FB7185', band: 'rgba(244,63,94,0.07)', cell: 'rgba(244,63,94,0.02)', text: '#9F1239' };

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
