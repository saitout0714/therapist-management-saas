'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTherapistAuth } from '@/contexts/TherapistAuthContext';
import { supabase } from '@/lib/supabase';

interface ShiftItem {
  id?: string;
  date: string;
  start_time: string;
  end_time: string;
  notes?: string;
  isConfirmed: boolean;
}

export default function TherapistSchedulePage() {
  const router = useRouter();
  const { therapist, loading: authLoading, logout } = useTherapistAuth();

  const [dateList, setDateList] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('12:00');
  const [endTime, setEndTime] = useState<string>('21:00');
  const [notes, setNotes] = useState<string>('');
  const [existingShifts, setExistingShifts] = useState<ShiftItem[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !therapist) {
      router.push('/therapist/login');
    }
  }, [therapist, authLoading, router]);

  useEffect(() => {
    // 今日から14日間の日付配列を生成
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    setDateList(dates);
    if (dates.length > 0) {
      setSelectedDate(dates[0]);
    }
  }, []);

  useEffect(() => {
    async function loadShifts() {
      if (!therapist) return;
      const { data } = await supabase
        .from('shifts')
        .select('*')
        .eq('therapist_id', therapist.id)
        .order('date', { ascending: true });

      if (data) {
        setExistingShifts(
          data.map((s) => ({
            id: s.id,
            date: s.date,
            start_time: s.start_time,
            end_time: s.end_time,
            notes: s.notes,
            isConfirmed: s.room_id !== null && s.room_id !== undefined,
          }))
        );
      }
    }
    loadShifts();
  }, [therapist]);

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!therapist) return;

    setSaving(true);
    setMessage('');
    setError('');

    try {
      // 既存の希望の有無を確認して更新または挿入
      const { data: existing } = await supabase
        .from('shifts')
        .select('id')
        .eq('therapist_id', therapist.id)
        .eq('date', selectedDate)
        .maybeSingle();

      if (existing) {
        const { error: updateErr } = await supabase
          .from('shifts')
          .update({
            start_time: startTime,
            end_time: endTime,
            notes: notes.trim() || null,
          })
          .eq('id', existing.id);

        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase.from('shifts').insert([
          {
            therapist_id: therapist.id,
            shop_id: therapist.shopId,
            date: selectedDate,
            start_time: startTime,
            end_time: endTime,
            notes: notes.trim() || null,
          },
        ]);

        if (insertErr) throw insertErr;
      }

      setMessage(`【${selectedDate}】の出勤希望を送信・提出しました！`);

      // 最新シフトを再取得
      const { data: updatedData } = await supabase
        .from('shifts')
        .select('*')
        .eq('therapist_id', therapist.id)
        .order('date', { ascending: true });

      if (updatedData) {
        setExistingShifts(
          updatedData.map((s) => ({
            id: s.id,
            date: s.date,
            start_time: s.start_time,
            end_time: s.end_time,
            notes: s.notes,
            isConfirmed: s.room_id !== null && s.room_id !== undefined,
          }))
        );
      }
    } catch (err: any) {
      setError('送信エラー: ' + (err.message || '出勤希望の保存に失敗しました'));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !therapist) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center text-stone-200 font-serif">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d1b464]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-serif flex flex-col">
      {/* ナビゲーションヘッダー */}
      <header className="bg-stone-900 border-b border-stone-800 p-4 sticky top-0 z-50 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {therapist.avatarUrl && (
              <img
                src={therapist.avatarUrl}
                alt={therapist.name}
                className="w-10 h-10 rounded-full object-cover border border-[#d1b464]"
              />
            )}
            <div>
              <h1 className="font-bold text-sm sm:text-base text-stone-100">{therapist.name} さん</h1>
              <p className="text-[11px] text-stone-400">セラピスト専用マイページ</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              router.push('/therapist/login');
            }}
            className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold rounded-lg border border-stone-700 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* サブナビゲーションタブ */}
      <div className="bg-stone-900/60 border-b border-stone-800/80">
        <div className="max-w-3xl mx-auto flex">
          <Link
            href="/therapist/schedule"
            className="flex-1 text-center py-3 text-xs font-bold text-[#d1b464] border-b-2 border-[#d1b464] bg-stone-900/40"
          >
            📅 出勤希望提出
          </Link>
          <Link
            href="/therapist/blog"
            className="flex-1 text-center py-3 text-xs font-bold text-stone-400 hover:text-stone-200 transition-colors"
          >
            ✏️ 写メ日記・ブログ
          </Link>
        </div>
      </div>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-6">
        
        {/* メッセージ通知 */}
        {message && (
          <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold">
            {message}
          </div>
        )}
        {error && (
          <div className="p-4 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-bold">
            {error}
          </div>
        )}

        {/* 出勤希望提出フォーム */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl space-y-5">
          <h2 className="text-sm font-bold text-[#d1b464] tracking-wider uppercase border-b border-stone-800 pb-2">
            新規出勤希望の送信
          </h2>

          <form onSubmit={handleSaveShift} className="space-y-4">
            {/* 日付選択 */}
            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1.5">出勤希望日</label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 focus:border-[#d1b464] outline-none text-sm font-sans"
              >
                {dateList.map((dStr) => {
                  const dateObj = new Date(dStr);
                  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
                  return (
                    <option key={dStr} value={dStr}>
                      {dStr} ({dayOfWeek})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 出勤時間範囲 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5">開始時間</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 focus:border-[#d1b464] outline-none text-sm font-sans"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5">終了時間</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 focus:border-[#d1b464] outline-none text-sm font-sans"
                />
              </div>
            </div>

            {/* 備考メモ */}
            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1.5">備考・連絡事項（任意）</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="例: 15:00以降部屋移動可、遅れる可能性あり等"
                className="w-full px-4 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 focus:border-[#d1b464] outline-none text-sm font-sans text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 bg-gradient-to-r from-[#d1b464] to-[#a39573] hover:from-[#c2a353] stroke-none text-stone-950 font-bold text-sm tracking-widest rounded-xl shadow-lg transition-all active:scale-98 disabled:opacity-50"
            >
              {saving ? '送信中...' : '出勤希望を提出する'}
            </button>
          </form>
        </div>

        {/* 提出済み出勤一覧 */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-stone-300 tracking-wider uppercase border-b border-stone-800 pb-2">
            提出済み出勤スケジュール一覧
          </h2>

          {existingShifts.length === 0 ? (
            <p className="text-xs text-stone-500 py-4 text-center">提出済みの出勤希望はありません。</p>
          ) : (
            <div className="space-y-2.5">
              {existingShifts.map((s) => (
                <div
                  key={s.id || s.date}
                  className="p-3.5 bg-stone-950 border border-stone-800 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-200 text-sm">{s.date}</span>
                      {s.isConfirmed ? (
                        <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold rounded-md">
                          確定出勤
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold rounded-md">
                          提出中
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-[#d1b464] mt-1">
                      ⏰ {s.start_time} ～ {s.end_time}
                    </p>
                    {s.notes && <p className="text-[11px] text-stone-400 mt-0.5">💬 {s.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
