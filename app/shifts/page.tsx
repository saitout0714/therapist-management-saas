"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Shift {
  id: string;
  therapist_id: string;
  date: string;
  start_time: string;
  end_time: string;
  therapists: any;
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [filterDate, setFilterDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchShifts();
  }, [filterDate]);

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

  return (
    <div className="max-w-4xl mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-5">シフト管理</h1>
      <div className="mb-4">
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="p-2 border border-gray-300 rounded"
        />
        <button
          onClick={() => setFilterDate('')}
          className="ml-2 bg-gray-500 text-white p-2 rounded hover:bg-gray-600"
        >
          フィルター解除
        </button>
      </div>
      {loading ? (
        <p>読み込み中...</p>
      ) : (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">シフト一覧</h2>
          {shifts.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {shifts.map((shift) => (
                <li key={shift.id} className="py-3 flex justify-between">
                  <span className="font-medium text-gray-700">
                    {shift.therapists?.name} - {shift.date}
                  </span>
                  <span className="text-sm text-gray-400">
                    {shift.start_time} - {shift.end_time}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">シフトデータがありません。</p>
          )}
        </div>
      )}
    </div>
  );
}