'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabase';
import { useShop } from '../../../contexts/ShopContext';
import { Therapist } from '../../../../types/store';

interface ShiftItem {
  id: string;
  therapist_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'requested' | 'confirmed' | 'rejected' | string;
  room_id?: string | null;
  rooms?: { name: string } | null;
  notes?: string | null;
  created_at?: string;
}

export default function TherapistSchedulePage() {
  const { selectedShop } = useShop();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // フォーム状態
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>('13:00');
  const [endTime, setEndTime] = useState<string>('22:00');
  const [therapistNotes, setTherapistNotes] = useState<string>('');

  useEffect(() => {
    async function fetchStoreTherapists() {
      let query = supabase.from('therapists').select('*').eq('is_active', true);
      if (selectedShop?.id) {
        query = query.eq('shop_id', selectedShop.id);
      }
      const { data } = await query;

      if (data && data.length > 0) {
        const mapped: Therapist[] = data.map((t: any) => ({
          id: t.id,
          name: t.name,
          age: t.age || 20,
          height: t.height || 160,
          bustCup: t.bust_cup || 'C',
          avatarUrl: t.avatar_url || t.photo_url || '',
          images: [],
          tags: Array.isArray(t.tags) ? t.tags : [],
          comment: t.comment || '',
        }));
        setTherapists(mapped);
        setSelectedTherapistId(mapped[0].id);
      } else {
        setTherapists([]);
        setSelectedTherapistId('');
      }
    }
    fetchStoreTherapists();
  }, [selectedShop]);


  useEffect(() => {
    if (!selectedTherapistId) return;
    loadShifts(selectedTherapistId);
  }, [selectedTherapistId]);

  async function loadShifts(therapistId: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*, rooms(name)')
        .eq('therapist_id', therapistId)
        .order('date', { ascending: true });

      if (error || !data) {
        setShifts([]);
      } else {
        setShifts(data);
      }
    } catch {
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmitShiftRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTherapistId) {
      alert('セラピストを選択してください。');
      return;
    }
    if (!startDate) {
      alert('日付を選択してください。');
      return;
    }

    setSubmitting(true);
    try {
      const shopId = selectedShop?.id || 'a628f5ad-3bda-442f-9cfe-c5c00c3e65c1';

      // 既存の同日シフト希望があるかチェック
      const existing = shifts.find((s) => s.date === startDate);

      if (existing) {
        // 更新
        const { error } = await supabase
          .from('shifts')
          .update({
            start_time: startTime,
            end_time: endTime,
            status: 'requested',
            notes: therapistNotes || null,
            requested_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // 新規作成
        const { error } = await supabase.from('shifts').insert({
          shop_id: shopId,
          therapist_id: selectedTherapistId,
          date: startDate,
          start_time: startTime,
          end_time: endTime,
          status: 'requested',
          notes: therapistNotes || null,
          requested_at: new Date().toISOString(),
        });

        if (error) throw error;
      }


      alert('出勤希望を提出しました！（オーナーの部屋割り調整待ち状態となります）');
      setTherapistNotes('');
      await loadShifts(selectedTherapistId);
    } catch (err) {
      console.error('Failed to submit shift request:', err);
      alert('出勤希望の提出に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelShiftRequest = async (shiftId: string) => {
    if (!confirm('この出勤希望の提出を取り消してもよろしいですか？')) return;

    try {
      const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
      if (error) throw error;

      setShifts((prev) => prev.filter((s) => s.id !== shiftId));
      alert('出勤希望を取り消しました。');
    } catch (err) {
      console.error('Failed to cancel shift request:', err);
      alert('出勤希望の取り消しに失敗しました。');
    }
  };

  const currentTherapist = therapists.find((t) => t.id === selectedTherapistId);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-2">
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-wide flex items-center gap-2">
            📅 セラピスト出勤希望の提出
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            オーナー宛てに出勤希望日と時間帯を送信します。オーナーによるルーム調整・確定後に公式HPへ自動反映されます。
          </p>
        </div>

        {/* セラピスト選択スコープ */}
        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {selectedShop && (
              <span className="bg-rose-950/80 text-rose-300 border border-rose-800/60 font-bold text-xs px-3 py-1 rounded-lg">
                🏪 対象店舗: {selectedShop.name}
              </span>
            )}
            <label className="text-xs font-bold text-slate-300">提出セラピスト:</label>
            <select
              value={selectedTherapistId}
              onChange={(e) => setSelectedTherapistId(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-rose-300 font-bold text-xs rounded-lg px-4 py-2 focus:outline-none focus:border-rose-500"
            >
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.age}歳)
                </option>
              ))}
            </select>
          </div>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* フォーム入力エリア */}
          <div className="lg:col-span-1 bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-5">
            <h2 className="text-base font-bold text-white border-b border-slate-700 pb-3">
              出勤希望を送信
            </h2>

            <form onSubmit={handleSubmitShiftRequest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">希望日付</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">開始時間</label>
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    {['11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '24:00'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">終了時間</label>
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    {['17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '24:00', '01:00', '02:00', '03:00', '04:00', '05:00'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">オーナー宛て連絡事項（任意）</label>
                <textarea
                  rows={3}
                  placeholder="例: 18時以降の遅番希望です。21時最終受付希望。"
                  value={therapistNotes}
                  onChange={(e) => setTherapistNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50 tracking-wider"
              >
                出勤希望を提出する
              </button>
            </form>
          </div>

          {/* 提出済み出勤状況リスト */}
          <div className="lg:col-span-2 bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white border-b border-slate-700 pb-3 flex items-center justify-between">
              <span>提出済み出勤リスト</span>
              <span className="text-xs font-normal text-slate-400">
                {currentTherapist?.name} さん
              </span>
            </h2>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">読み込み中...</div>
            ) : shifts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
                提出済みの出勤希望はありません。左側から提出してください。
              </div>
            ) : (
              <div className="space-y-3">
                {shifts.map((shift) => {
                  const isConfirmed = shift.status === 'confirmed' || !!shift.room_id;
                  return (
                    <div
                      key={shift.id}
                      className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {shift.date}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              isConfirmed
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                            }`}
                          >
                            {isConfirmed
                              ? `✅ 確定・部屋割完了 ${shift.rooms?.name ? `(${shift.rooms.name})` : ''}`
                              : '⏳ 提出済み（部屋割り調整待ち）'}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-rose-300">
                          ⏰ {shift.start_time.slice(0, 5)} ～ {shift.end_time.slice(0, 5)}
                        </div>

                        {shift.notes && (
                          <div className="text-xs text-slate-400 italic">
                            💬 "{shift.notes}"
                          </div>
                        )}
                      </div>

                      {!isConfirmed && (
                        <button
                          type="button"
                          onClick={() => handleCancelShiftRequest(shift.id)}
                          className="px-3 py-1.5 text-xs font-bold bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-lg border border-rose-800 transition-colors"
                        >
                          提出を取り消す
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
