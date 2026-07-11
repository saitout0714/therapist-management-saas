"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useShop } from '@/app/contexts/ShopContext';
import { useAuth } from '@/app/contexts/AuthContext';
import WeeklyShiftCalendar from '@/app/components/WeeklyShiftCalendar';

interface Therapist {
  id: string;
  name: string;
  avatar?: string;
}

interface Room {
  id: string;
  name: string;
}

export default function RegisterShift() {
  const { selectedShop } = useShop();
  const { user } = useAuth();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // AI一括登録モーダル状態
  const [aiModal, setAiModal] = useState<{
    text: string;
    parsing: boolean;
    saving: boolean;
    error: string | null;
    parsedShifts: Array<{
      date: string;
      therapist_id: string | null;
      therapist_name: string;
      room_id: string | null;
      room_name: string | null;
      start_time: string;
      end_time: string;
      matched: boolean;
    }> | null;
  } | null>(null);

  async function fetchTherapists() {
    if (!selectedShop) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('therapists')
        .select('id, name, order')
        .eq('shop_id', selectedShop.id)
        .eq('is_active', true)
        .order('order', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('Error fetching therapists:', error);
        return;
      }

      setTherapists((data || []).map((t) => ({ id: t.id, name: t.name })));
    } catch (error) {
      console.error('Unexpected error in fetchTherapists:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRooms() {
    if (!selectedShop) {
      setRooms([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('shop_id', selectedShop.id)
        .order('order', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('Error fetching rooms:', error);
        return;
      }
      setRooms((data || []).map((r) => ({ id: r.id, name: r.name })));
    } catch (error) {
      console.error('Unexpected error in fetchRooms:', error);
    }
  }

  const handleAiParse = async () => {
    if (!aiModal || !aiModal.text.trim() || !selectedShop) return;
    setAiModal(m => m ? { ...m, parsing: true, error: null } : null);
    try {
      const res = await fetch('/api/parse-shift-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiModal.text, shop_id: selectedShop.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '解析に失敗しました');
      setAiModal(m => m ? { ...m, parsing: false, parsedShifts: data.shifts } : null);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      setAiModal(m => m ? { ...m, parsing: false, error: err.message } : null);
    }
  };

  const handleAiSave = async () => {
    if (!aiModal || !aiModal.parsedShifts || !selectedShop) return;
    
    // バリデーション: セラピストIDが未選択のものをチェック
    const incomplete = aiModal.parsedShifts.some(s => !s.therapist_id);
    if (incomplete) {
      setAiModal(m => m ? { ...m, error: 'セラピストが選択されていないシフトがあります。' } : null);
      return;
    }

    setAiModal(m => m ? { ...m, saving: true, error: null } : null);
    try {
      const res = await fetch('/api/save-bulk-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shifts: aiModal.parsedShifts, shop_id: selectedShop.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '登録に失敗しました');
      
      // スプレッドシート同期の成否をお知らせする
      let message = 'シフトの一括登録が完了しました。';
      if (data.gasSynced) {
        message += `\n\nスプレッドシートの同期も完了しました：\n${data.gasMessage}`;
      } else if (data.gasMessage) {
        message += `\n\n⚠️ スプレッドシート同期エラー:\n${data.gasMessage}`;
      }
      alert(message);

      setAiModal(null);
      setRefreshKey(c => c + 1);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      setAiModal(m => m ? { ...m, saving: false, error: err.message } : null);
    }
  };

  useEffect(() => {
    fetchTherapists();
    fetchRooms();
  }, [selectedShop]);

  return (
    <div className="h-screen overflow-hidden bg-gray-100 flex flex-col p-6 md:p-8">
      <div className="w-full mx-auto flex flex-col flex-1 min-h-0">
        <div className="mb-6 flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">シフト登録</h1>
            <p className="text-sm text-slate-500 mt-1">店舗に所属するセラピストのシフト（出勤枠）を週単位で登録・編集できます。</p>
          </div>
          {/* AIシフト一括登録ボタン */}
          {['developer', 'system_admin'].includes(user?.role || '') && (
            <button
              onClick={() => setAiModal({ text: '', parsing: false, saving: false, error: null, parsedShifts: null })}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm transition-colors font-bold text-xs whitespace-nowrap flex items-center gap-1.5 self-start md:self-auto"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AIシフト一括登録
            </button>
          )}
        </div>

        {loading && (
          <div className="flex justify-center items-center py-20 text-indigo-600">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 font-medium">読み込み中...</span>
          </div>
        )}

        {!loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 min-h-0">
            <div className="h-full">
              {therapists.length > 0 ? (
                <WeeklyShiftCalendar
                  key={refreshKey}
                  therapists={therapists}
                  showOnlyWithShift={false}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 flex-col gap-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex justify-center items-center text-slate-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <p>セラピストデータを読み込み中...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI一括登録モーダル */}
      {aiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !aiModal.parsing && !aiModal.saving && setAiModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {/* ヘッダー */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800">📝 AIシフト一括登録</h3>
                  <p className="text-xs text-slate-500 mt-0.5">LINEやメールの出勤テキストから自動解析し一括登録します</p>
                </div>
                <button 
                  onClick={() => setAiModal(null)} 
                  disabled={aiModal.parsing || aiModal.saving}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-30"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {aiModal.error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                  {aiModal.error}
                </div>
              )}

              {aiModal.parsedShifts === null ? (
                // 1. テキスト入力画面
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-600">シフトテキストを貼り付けてください</label>
                  <textarea
                    value={aiModal.text}
                    onChange={e => setAiModal(m => m ? { ...m, text: e.target.value } : null)}
                    rows={12}
                    placeholder={`ここにクライアントやスタッフから送られてきたシフト情報を貼り付けてください。
例：
5/31
すい 12-21 ルーム1
いちか 18-2 ルーム2
そら 10-18`}
                    disabled={aiModal.parsing}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none disabled:opacity-50"
                  />
                </div>
              ) : (
                // 2. 解析結果プレビュー画面
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-600">解析結果の確認と調整</label>
                  <div className="border border-slate-100 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-600">
                          <th className="p-3">日付</th>
                          <th className="p-3">セラピスト (抽出名)</th>
                          <th className="p-3">時間</th>
                          <th className="p-3">ルーム (抽出名)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {aiModal.parsedShifts.map((s, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-3 font-medium text-slate-600">
                              <input
                                type="date"
                                value={s.date}
                                onChange={e => {
                                  const val = e.target.value;
                                  setAiModal(m => {
                                    if (!m || !m.parsedShifts) return m;
                                    const next = [...m.parsedShifts];
                                    next[idx].date = val;
                                    return { ...m, parsedShifts: next };
                                  });
                                }}
                                className="border border-slate-200 rounded-md px-1.5 py-0.5 bg-white text-xs outline-none"
                              />
                            </td>
                            <td className="p-3">
                              <div className="space-y-1">
                                <select
                                  value={s.therapist_id || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setAiModal(m => {
                                      if (!m || !m.parsedShifts) return m;
                                      const next = [...m.parsedShifts];
                                      next[idx].therapist_id = val || null;
                                      next[idx].matched = !!val;
                                      return { ...m, parsedShifts: next };
                                    });
                                  }}
                                  className={`w-full border rounded-md px-1.5 py-0.5 text-xs bg-white ${s.matched ? 'border-green-300 text-green-800 bg-green-50/30' : 'border-rose-300 text-rose-800 bg-rose-50/30'}`}
                                >
                                  <option value="">-- 未選択 --</option>
                                  {therapists.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                </select>
                                <span className="text-[10px] text-slate-400 block px-1">抽出: {s.therapist_name}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={s.start_time}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setAiModal(m => {
                                      if (!m || !m.parsedShifts) return m;
                                      const next = [...m.parsedShifts];
                                      next[idx].start_time = val;
                                      return { ...m, parsedShifts: next };
                                    });
                                  }}
                                  className="w-12 border border-slate-200 rounded-md px-1 py-0.5 text-center"
                                />
                                <span>-</span>
                                <input
                                  type="text"
                                  value={s.end_time}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setAiModal(m => {
                                      if (!m || !m.parsedShifts) return m;
                                      const next = [...m.parsedShifts];
                                      next[idx].end_time = val;
                                      return { ...m, parsedShifts: next };
                                    });
                                  }}
                                  className="w-12 border border-slate-200 rounded-md px-1 py-0.5 text-center"
                                />
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="space-y-1">
                                <select
                                  value={s.room_id || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setAiModal(m => {
                                      if (!m || !m.parsedShifts) return m;
                                      const next = [...m.parsedShifts];
                                      next[idx].room_id = val || null;
                                      return { ...m, parsedShifts: next };
                                    });
                                  }}
                                  className="w-full border border-slate-200 rounded-md px-1.5 py-0.5 text-xs bg-white"
                                >
                                  <option value="">未指定</option>
                                  {rooms.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                  ))}
                                </select>
                                <span className="text-[10px] text-slate-400 block px-1">抽出: {s.room_name || '(なし)'}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* フッター */}
            <div className="px-6 pb-6 border-t border-slate-100 pt-4 flex gap-2">
              {aiModal.parsedShifts === null ? (
                <>
                  <button
                    onClick={handleAiParse}
                    disabled={aiModal.parsing || !aiModal.text.trim()}
                    className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  >
                    {aiModal.parsing ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        AIで解析中...
                      </>
                    ) : 'AIで解析する'}
                  </button>
                  <button
                    onClick={() => setAiModal(null)}
                    disabled={aiModal.parsing}
                    className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                  >
                    キャンセル
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleAiSave}
                    disabled={aiModal.saving}
                    className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  >
                    {aiModal.saving ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        一括保存中...
                      </>
                    ) : 'この内容で一括登録する'}
                  </button>
                  <button
                    onClick={() => setAiModal(m => m ? { ...m, parsedShifts: null } : null)}
                    disabled={aiModal.saving}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                  >
                    戻る
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
