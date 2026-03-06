'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useShop } from '@/app/contexts/ShopContext';

interface Therapist {
  id: string;
  name: string;
  avatar?: string;
}

interface Room {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  therapist_id: string;
  room_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
}

interface WeeklyShiftCalendarProps {
  therapists: Therapist[];
  shifts: Shift[];
  onDateClick?: (therapistId: string, date: string) => void;
  onShiftUpdate?: () => void; // シフト更新後のコールバック
  showOnlyWithShift?: boolean; // 追加: シフトがあるセラピストのみ表示
}

// 日付をYYYY-MM-DD形式に変換
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const WeeklyShiftCalendar: React.FC<WeeklyShiftCalendarProps> = ({
  therapists,
  shifts,
  onDateClick,
  onShiftUpdate,
  showOnlyWithShift = false,
}) => {
  const { selectedShop } = useShop();


  // 週の開始日から7日分の日付リスト
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [weekStartDate]);

  // シフト有のみ表示の場合はフィルタ、それ以外は全員表示
  const filteredTherapists = useMemo(() => {
    if (!showOnlyWithShift) return therapists;
    const targetDate = weekDates[0] ? formatDate(weekDates[0]) : null;
    if (!targetDate) return [];
    const therapistIdsWithShift = new Set(
      shifts.filter(s => s.date === targetDate).map(s => s.therapist_id)
    );
    return therapists.filter(t => therapistIdsWithShift.has(t.id));
  }, [therapists, shifts, weekDates, showOnlyWithShift]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedTherapistId, setSelectedTherapistId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [startHour, setStartHour] = useState('');
  const [startMinute, setStartMinute] = useState('00');
  const [endHour, setEndHour] = useState('');
  const [endMinute, setEndMinute] = useState('00');
  const [roomId, setRoomId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ルームを取得
  useEffect(() => {
    const fetchRooms = async () => {
      if (!selectedShop) {
        setRooms([]);
        return;
      }

      const { data } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('shop_id', selectedShop.id);
      setRooms((data as Room[]) || []);
    };
    fetchRooms();
  }, [selectedShop]);

  // 月曜日を取得
  function getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }



  // シフトマップを作成（therapistId_date -> Shift）
  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift>();
    shifts.forEach((shift) => {
      const key = `${shift.therapist_id}_${shift.date}`;
      map.set(key, shift);
    });
    return map;
  }, [shifts]);

  const handlePrevWeek = () => {
    const newDate = new Date(weekStartDate);
    newDate.setDate(newDate.getDate() - 7);
    setWeekStartDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(weekStartDate);
    newDate.setDate(newDate.getDate() + 7);
    setWeekStartDate(newDate);
  };



  const formatDisplayDate = (date: Date): string => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    return `${month}/${day}(${dayOfWeek})`;
  };

  const handleCellClick = (therapistId: string, dateStr: string) => {
    const key = `${therapistId}_${dateStr}`;
    const shift = shiftMap.get(key);

    if (shift) {
      // 編集モード
      setModalMode('edit');
      setShiftId(shift.id);
      const [hour, minute] = shift.start_time.slice(0, 5).split(':');
      // DBは0-23表記。モーダルは24-29を翌日として扱うため補正
      const startHourForSelect = parseInt(hour, 10) < 10 ? String(parseInt(hour, 10) + 24).padStart(2, '0') : hour;
      setStartHour(startHourForSelect);
      setStartMinute(minute);
      const [endHr, endMin] = shift.end_time.slice(0, 5).split(':');
      const endHourForSelect = parseInt(endHr, 10) < 10 ? String(parseInt(endHr, 10) + 24).padStart(2, '0') : endHr;
      setEndHour(endHourForSelect);
      setEndMinute(endMin);
      setRoomId(shift.room_id || '');
    } else {
      // 新規作成モード
      setModalMode('create');
      setShiftId(null);
      setStartHour('');
      setStartMinute('00');
      setEndHour('');
      setEndMinute('00');
      setRoomId('');
    }

    setSelectedTherapistId(therapistId);
    setSelectedDate(dateStr);
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedTherapistId('');
    setSelectedDate('');
    setStartHour('');
    setStartMinute('00');
    setEndHour('');
    setEndMinute('00');
    setShiftId(null);
    setError('');
  };

  const handleSaveShift = async () => {
    setError('');
    setLoading(true);

    try {
      if (!selectedShop) {
        setError('店舗を選択してください');
        setLoading(false);
        return;
      }

      // バリデーション
      if (!startHour || !startMinute || !endHour || !endMinute) {
        setError('開始時刻と終了時刻を入力してください');
        setLoading(false);
        return;
      }

      // タイムライン（10:00起点～翌05:00）での分数に変換して大小比較
      const toTimelineMinutes = (hStr: string, mStr: string) => {
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        if (h >= 24) {
          const nh = h - 24; // 翌日0-5時
          return (14 * 60) + nh * 60 + m; // 10:00から14時間後が翌日0:00
        } else {
          return (h - 10) * 60 + m; // 10:00～23:55 を0基準
        }
      };

      const startMinutes = toTimelineMinutes(startHour, startMinute);
      const endMinutes = toTimelineMinutes(endHour, endMinute);

      if (isNaN(startMinutes) || isNaN(endMinutes)) {
        setError('時刻の形式が不正です');
        setLoading(false);
        return;
      }

      if (endMinutes <= startMinutes) {
        setError('終了時刻は開始時刻より後である必要があります');
        setLoading(false);
        return;
      }

      // DB保存用に 24-29時は 0-5時へ正規化
      const normalizeHourForDb = (hStr: string) => {
        const h = parseInt(hStr, 10);
        const nh = h >= 24 ? h - 24 : h;
        return String(nh).padStart(2, '0');
      };

      const startTime = `${normalizeHourForDb(startHour)}:${startMinute}`;
      const endTime = `${normalizeHourForDb(endHour)}:${endMinute}`;

      if (modalMode === 'create') {
        // 新規作成：重複チェック
        const { data: existingShifts } = await supabase
          .from('shifts')
          .select('id')
          .eq('therapist_id', selectedTherapistId)
          .eq('shop_id', selectedShop.id)
          .eq('date', selectedDate);

        if (existingShifts && existingShifts.length > 0) {
          setError('このセラピストは既にこの日付にシフトが入っています');
          setLoading(false);
          return;
        }

        // 新規登録（同一日付に1件制約のため date は選択日を維持）
        const { error: insertError } = await supabase
          .from('shifts')
          .insert([
            {
              therapist_id: selectedTherapistId,
              room_id: roomId || null,
              shop_id: selectedShop.id,
              date: selectedDate,
              start_time: startTime,
              end_time: endTime,
            },
          ]);

        if (insertError) {
          setError('シフト登録に失敗しました: ' + insertError.message);
          setLoading(false);
          return;
        }
      } else {
        // 編集：更新
        const { error: updateError } = await supabase
          .from('shifts')
          .update({
            room_id: roomId || null,
            start_time: startTime,
            end_time: endTime,
          })
          .eq('id', shiftId);

        if (updateError) {
          setError('シフト更新に失敗しました: ' + updateError.message);
          setLoading(false);
          return;
        }
      }

      closeModal();
      onShiftUpdate?.();
    } catch (err) {
      setError('予期しないエラーが発生しました');
      console.error(err);
    }

    setLoading(false);
  };

  const handleDeleteShift = async () => {
    if (!window.confirm('このシフトを削除しますか？')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('shifts')
        .delete()
        .eq('id', shiftId);

      if (deleteError) {
        setError('シフト削除に失敗しました: ' + deleteError.message);
        setLoading(false);
        return;
      }

      closeModal();
      onShiftUpdate?.();
    } catch (err) {
      setError('予期しないエラーが発生しました');
      console.error(err);
    }

    setLoading(false);
  };

  const selectedTherapist = therapists.find(t => t.id === selectedTherapistId);

  // 時間と分のドロップダウン用リスト生成（モーダル内で使用）

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-md overflow-hidden">
      {/* ヘッダー：週の選択 */}
      <div className="bg-white border-b border-slate-100 p-4 flex items-center justify-between">
        <button
          onClick={handlePrevWeek}
          className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-medium transition-colors border border-slate-200"
        >
          ← 前の週
        </button>
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">
          {weekDates[0].getFullYear()}年 {weekDates[0].getMonth() + 1}月{weekDates[0].getDate()}日 ～ {weekDates[6].getMonth() + 1}月{weekDates[6].getDate()}日
        </h2>
        <button
          onClick={handleNextWeek}
          className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-medium transition-colors border border-slate-200"
        >
          次の週 →
        </button>
      </div>

      {/* メインテーブル */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          {/* ヘッダー：日付 */}
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="w-40 p-3 text-left font-semibold text-slate-600 border-r border-slate-200 bg-slate-50 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                セラピスト
              </th>
              {weekDates.map((date) => (
                <th
                  key={formatDate(date)}
                  className="min-w-[140px] p-3 text-center font-semibold text-slate-600 border-r border-slate-200"
                >
                  {formatDisplayDate(date)}
                </th>
              ))}
            </tr>
          </thead>

          {/* ボディ：セラピスト × 日付 */}
          <tbody className="divide-y divide-slate-100">
            {filteredTherapists.map((therapist) => (
              <tr key={therapist.id} className="hover:bg-slate-50/50 transition-colors group">
                {/* セラピスト名 */}
                <td className="w-40 p-3 font-medium text-slate-800 border-r border-slate-100 bg-white group-hover:bg-slate-50/50 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)] transition-colors">
                  <div className="flex items-center gap-2">
                    {therapist.avatar ? (
                      <img
                        src={therapist.avatar}
                        alt={therapist.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-300" />
                    )}
                    <span className="text-sm truncate">{therapist.name}</span>
                  </div>
                </td>

                {/* シフトセル */}
                {weekDates.map((date) => {
                  const dateStr = formatDate(date);
                  const key = `${therapist.id}_${dateStr}`;
                  const shift = shiftMap.get(key);

                  return (
                    <td
                      key={key}
                      className="min-w-[140px] p-2 text-center border-r border-slate-100 cursor-pointer hover:bg-indigo-50/50 transition-colors"
                      onClick={() => handleCellClick(therapist.id, dateStr)}
                    >
                      {shift ? (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 text-xs shadow-sm group-hover:border-indigo-200 transition-colors">
                          <div className="font-bold text-indigo-700 mb-0.5">
                            {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                          </div>
                          {shift.room_id && (
                            <div className="text-indigo-700/80 font-medium text-xs truncate">
                              {rooms.find(r => r.id === shift.room_id)?.name}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-300 text-xs font-medium">シフトなし</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* モーダル */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={closeModal}
          ></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden transform transition-all">
            <div className="p-6 md:p-8">
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                {modalMode === 'create' ? 'シフト登録' : 'シフト編集'}
              </h2>

              {/* エラーメッセージ */}
              {error && (
                <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium flex items-start">
                  <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <form className="space-y-5">
                {/* セラピスト名と日付 */}
                <div className="bg-slate-50 p-4 rounded-xl flex items-center gap-3 border border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    {selectedTherapist?.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 leading-tight">{selectedTherapist?.name}</p>
                    <p className="text-sm font-medium text-indigo-600 mt-0.5">{selectedDate}</p>
                  </div>
                </div>

                {/* ルーム選択 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    出勤ルーム <span className="ml-2 text-xs text-slate-400 font-normal">任意</span>
                  </label>
                  <div className="relative">
                    <select
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 appearance-none font-medium"
                    >
                      <option value="">ルームを選択しない</option>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>

                {/* 時間入力 */}
                <div className="pt-2 border-t border-slate-100 space-y-4">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">シフト時間</h3>

                  <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center">
                    {/* 開始時間 */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 flex focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                      <select
                        value={startHour}
                        onChange={(e) => setStartHour(e.target.value)}
                        className="w-1/2 p-2 bg-transparent outline-none text-slate-800 font-bold text-center appearance-none cursor-pointer"
                      >
                        <option value="">時</option>
                        {Array.from({ length: 17 }, (_, i) => {
                          const hour = i + 10;
                          const displayHour = hour > 23 ? hour - 24 : hour;
                          const displayText = hour > 23 ? `${String(displayHour).padStart(2, '0')}(翌)` : String(hour).padStart(2, '0');
                          return (
                            <option key={hour} value={String(hour).padStart(2, '0')}>
                              {displayText}
                            </option>
                          );
                        })}
                      </select>
                      <span className="flex items-center text-slate-400 font-bold">:</span>
                      <select
                        value={startMinute}
                        onChange={(e) => setStartMinute(e.target.value)}
                        className="w-1/2 p-2 bg-transparent outline-none text-slate-800 font-bold text-center appearance-none cursor-pointer"
                      >
                        <option value="">分</option>
                        {Array.from({ length: 12 }, (_, i) => {
                          const minute = i * 5;
                          return (
                            <option key={minute} value={String(minute).padStart(2, '0')}>
                              {String(minute).padStart(2, '0')}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <span className="text-slate-400 font-bold">~</span>

                    {/* 終了時間 */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 flex focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                      <select
                        value={endHour}
                        onChange={(e) => setEndHour(e.target.value)}
                        className="w-1/2 p-2 bg-transparent outline-none text-slate-800 font-bold text-center appearance-none cursor-pointer"
                      >
                        <option value="">時</option>
                        {Array.from({ length: 20 }, (_, i) => {
                          const hour = i + 10;
                          const displayHour = hour > 23 ? hour - 24 : hour;
                          const displayText = hour > 23 ? `${String(displayHour).padStart(2, '0')}(翌)` : String(hour).padStart(2, '0');
                          return (
                            <option key={hour} value={String(hour).padStart(2, '0')}>
                              {displayText}
                            </option>
                          );
                        })}
                      </select>
                      <span className="flex items-center text-slate-400 font-bold">:</span>
                      <select
                        value={endMinute}
                        onChange={(e) => setEndMinute(e.target.value)}
                        className="w-1/2 p-2 bg-transparent outline-none text-slate-800 font-bold text-center appearance-none cursor-pointer"
                      >
                        <option value="">分</option>
                        {Array.from({ length: 12 }, (_, i) => {
                          const minute = i * 5;
                          return (
                            <option key={minute} value={String(minute).padStart(2, '0')}>
                              {String(minute).padStart(2, '0')}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* ボタン関係 */}
            <div className="bg-slate-50 p-4 md:px-8 border-t border-slate-100 flex gap-3 justify-end items-center">
              {modalMode === 'edit' && (
                <button
                  onClick={handleDeleteShift}
                  disabled={loading}
                  className="mr-auto px-4 py-2.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  {loading ? '削除中...' : '削除'}
                </button>
              )}
              <button
                onClick={closeModal}
                disabled={loading}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveShift}
                disabled={loading}
                className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    保存中...
                  </span>
                ) : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyShiftCalendar;
