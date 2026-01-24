"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import TimeChart from '../components/TimeChart';

interface Shift {
  id: string;
  therapist_id: string;
  date: string;
  start_time: string;
  end_time: string;
  therapists: any;
}

interface Therapist {
  id: string;
  name: string;
  avatar?: string;
  shiftStart?: string;
  shiftEnd?: string;
}

interface Schedule {
  therapistId: string;
  startTime: string;
  endTime: string;
  title: string;
  color?: string;
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [filterDate, setFilterDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  useEffect(() => {
    fetchTherapists();
    fetchShifts();
  }, [filterDate]);

  const fetchTherapists = async () => {
    try {
      // 表示対象の日付を取得（フィルター日付または本日）
      const targetDate = filterDate || new Date().toISOString().split('T')[0];

      // 1. therapists テーブルからセラピスト一覧を取得
      const { data: therapistsData, error: therapistsError } = await supabase
        .from('therapists')
        .select('id, name');

      if (therapistsError) {
        console.error('Error fetching therapists:', therapistsError);
        return;
      }

      // 2. 指定日付のシフト情報を取得
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('therapist_id, start_time, end_time')
        .eq('date', targetDate);

      if (shiftsError) {
        console.error('Error fetching shifts:', shiftsError);
        return;
      }

      // 3. シフト情報をセラピストIDをキーにしてマッピング
      const shiftMap = new Map();
      shiftsData?.forEach((shift) => {
        const startTime = formatTimeToHHMM(shift.start_time);
        const endTime = formatTimeToHHMM(shift.end_time);
        shiftMap.set(shift.therapist_id, { startTime, endTime });
      });

      // 4. セラピスト情報にシフト情報を結合
      const therapistsWithShift = (therapistsData || []).map((therapist) => {
        const shiftInfo = shiftMap.get(therapist.id);
        return {
          id: therapist.id,
          name: therapist.name,
          avatar: undefined,
          shiftStart: shiftInfo?.startTime || null,
          shiftEnd: shiftInfo?.endTime || null,
        };
      });

      setTherapists(therapistsWithShift as Therapist[]);
    } catch (error) {
      console.error('Unexpected error in fetchTherapists:', error);
    }
  };

  // 時刻文字列をHH:mm形式に変換するヘルパー関数
  const formatTimeToHHMM = (timeStr: string | null): string | null => {
    if (!timeStr) return null;
    
    // ISO形式（"HH:mm:ss"など）からHH:mmを抽出
    const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      const hours = String(parseInt(match[1])).padStart(2, '0');
      const minutes = match[2];
      return `${hours}:${minutes}`;
    }
    return null;
  };

  const fetchShifts = async () => {
    setLoading(true);
    let query = supabase
      .from('shifts')
      .select('id, therapist_id, date, start_time, end_time, therapists(name)')
      .order('date', { ascending: false });

    if (filterDate) {
      query = query.eq('date', filterDate);
    }

    const { data, error } = await query;
    setLoading(false);
    if (error) {
      alert('Error fetching shifts: ' + error.message);
    } else {
      setShifts((data as Shift[]) || []);
    }
  };

  // シフトデータをスケジュール形式に変換
  const schedules: Schedule[] = shifts.map((shift) => ({
    therapistId: shift.therapist_id,
    startTime: shift.start_time.slice(0, 5), // "HH:MM"形式に変換
    endTime: shift.end_time.slice(0, 5),
    title: shift.therapists?.name || 'セッション',
    color: '#3B82F6',
  }));

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">シフト管理</h1>
          <p className="text-gray-600 mt-2">タイムチャート・シフト一覧</p>
        </div>

        {/* フィルターと表示切り替え */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-3">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => setFilterDate('')}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
              >
                フィルター解除
              </button>
            </div>

            {/* 表示モード切り替え */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('chart')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  viewMode === 'chart'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                タイムチャート
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  viewMode === 'table'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                テーブル表示
              </button>
            </div>
          </div>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        )}

        {/* タイムチャートビュー */}
        {!loading && viewMode === 'chart' && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="h-[600px]">
              {therapists.length > 0 ? (
                <TimeChart therapists={therapists} schedules={schedules} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <p>セラピストデータを読み込み中...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* テーブルビュー */}
        {!loading && viewMode === 'table' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4">シフト一覧</h2>
            {shifts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-300">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">
                        セラピスト
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">
                        日付
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">
                        開始時刻
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">
                        終了時刻
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {shifts.map((shift) => (
                      <tr
                        key={shift.id}
                        className="hover:bg-gray-50 transition"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {shift.therapists?.name}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {shift.date}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {shift.start_time.slice(0, 5)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {shift.end_time.slice(0, 5)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 italic text-center py-8">
                シフトデータがありません。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}