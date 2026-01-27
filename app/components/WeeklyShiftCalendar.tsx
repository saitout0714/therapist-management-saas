'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

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
}

const WeeklyShiftCalendar: React.FC<WeeklyShiftCalendarProps> = ({
  therapists,
  shifts,
  onDateClick,
  onShiftUpdate,
}) => {
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedTherapistId, setSelectedTherapistId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [startHour, setStartHour] = useState('');
  const [startMinute, setStartMinute] = useState('');
  const [endHour, setEndHour] = useState('');
  const [endMinute, setEndMinute] = useState('');
  const [roomId, setRoomId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ルームを取得
  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await supabase.from('rooms').select('id, name');
      setRooms((data as Room[]) || []);
    };
    fetchRooms();
  }, []);

  // 月曜日を取得
  function getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  // 週の日付を生成（weekStartDateから7日間）
  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [weekStartDate]);

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

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
      setStartMinute('');
      setEndHour('');
      setEndMinute('');
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
    setStartMinute('');
    setEndHour('');
    setEndMinute('');
    setShiftId(null);
    setError('');
  };

  const handleSaveShift = async () => {
    setError('');
    setLoading(true);

    try {
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
              store_id: null,
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
      <div className="bg-gray-50 border-b border-gray-300 p-4 flex items-center justify-between">
        <button
          onClick={handlePrevWeek}
          className="px-3 py-2 bg-gray-300 hover:bg-gray-400 rounded text-sm font-medium"
        >
          ← 前の週
        </button>
        <h2 className="text-lg font-semibold text-gray-800">
          {weekDates[0].getFullYear()}年 {weekDates[0].getMonth() + 1}月{weekDates[0].getDate()}日 ～ {weekDates[6].getMonth() + 1}月{weekDates[6].getDate()}日
        </h2>
        <button
          onClick={handleNextWeek}
          className="px-3 py-2 bg-gray-300 hover:bg-gray-400 rounded text-sm font-medium"
        >
          次の週 →
        </button>
      </div>

      {/* メインテーブル */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          {/* ヘッダー：日付 */}
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-400">
              <th className="w-32 p-3 text-left font-semibold text-gray-700 border-r border-gray-300 bg-gray-50">
                セラピスト
              </th>
              {weekDates.map((date) => (
                <th
                  key={formatDate(date)}
                  className="min-w-[120px] p-3 text-center font-semibold text-gray-700 border-r border-gray-300"
                >
                  {formatDisplayDate(date)}
                </th>
              ))}
            </tr>
          </thead>

          {/* ボディ：セラピスト × 日付 */}
          <tbody>
            {therapists.map((therapist) => (
              <tr key={therapist.id} className="border-b border-gray-200 hover:bg-gray-50">
                {/* セラピスト名 */}
                <td className="w-32 p-3 font-medium text-gray-900 border-r border-gray-300 bg-gray-50">
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
                      className="min-w-[120px] p-2 text-center border-r border-gray-300 cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => handleCellClick(therapist.id, dateStr)}
                    >
                      {shift ? (
                        <div className="bg-blue-100 border-l-4 border-blue-500 rounded p-2 text-xs">
                          <div className="font-semibold text-blue-900">
                            {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                          </div>
                          {shift.room_id && (
                            <div className="text-blue-700 text-xs mt-1">
                              {rooms.find(r => r.id === shift.room_id)?.name}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-gray-400 text-xs">シフトなし</div>
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
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 max-w-full mx-4">
            <h2 className="text-xl font-bold mb-4">
              {modalMode === 'create' ? 'シフト登録' : 'シフト編集'}
            </h2>

            {/* エラーメッセージ */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
                {error}
              </div>
            )}

            {/* セラピスト名と日付 */}
            <div className="bg-gray-50 p-3 rounded mb-4 text-sm">
              <p className="text-gray-600">
                <span className="font-semibold">{selectedTherapist?.name}</span>
                <span className="mx-2">|</span>
                <span className="font-semibold">{selectedDate}</span>
              </p>
            </div>

            {/* ルーム選択 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ルーム
              </label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">ルームを選択</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 時間入力 */}
            <div className="space-y-3 mb-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始時間
                  </label>
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">時</option>
                    {Array.from({ length: 17 }, (_, i) => {
                      const hour = i + 10;
                      const displayHour = hour > 23 ? hour - 24 : hour;
                      const displayText = hour > 23 ? `${String(displayHour).padStart(2, '0')} (翌日)` : String(hour).padStart(2, '0');
                      return (
                        <option key={hour} value={String(hour).padStart(2, '0')}>
                          {displayText}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始分
                  </label>
                  <select
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了時間
                  </label>
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">時</option>
                    {Array.from({ length: 20 }, (_, i) => {
                      const hour = i + 10;
                      const displayHour = hour > 23 ? hour - 24 : hour;
                      const displayText = hour > 23 ? `${String(displayHour).padStart(2, '0')} (翌日)` : String(hour).padStart(2, '0');
                      return (
                        <option key={hour} value={String(hour).padStart(2, '0')}>
                          {displayText}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了分
                  </label>
                  <select
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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

            {/* ボタン */}
            <div className="flex gap-2">
              {modalMode === 'edit' && (
                <button
                  onClick={handleDeleteShift}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 font-medium"
                >
                  {loading ? '削除中...' : '削除'}
                </button>
              )}
              <button
                onClick={closeModal}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50 font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveShift}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 font-medium"
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyShiftCalendar;
