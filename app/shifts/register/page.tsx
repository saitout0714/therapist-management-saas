"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface Therapist {
  id: string;
  name: string;
  store_id: string;
}

export default function RegisterShift() {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState('');
  const [storeId, setStoreId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTherapists();
  }, []);

  useEffect(() => {
    if (selectedTherapist) {
      const therapist = therapists.find(t => t.id === selectedTherapist);
      if (therapist) {
        setStoreId(therapist.store_id);
      }
    } else {
      setStoreId('');
    }
  }, [selectedTherapist, therapists]);

  const fetchTherapists = async () => {
    const { data, error } = await supabase.from('therapists').select('id, name, store_id');
    if (error) {
      alert('Error fetching therapists: ' + error.message);
    } else {
      setTherapists(data || []);
    }
  };

// ... 前略 ...

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 新しいスキーマに合わせて、日付・開始・終了を分けて送ります
    const { error } = await supabase.from('shifts').insert([
      {
        therapist_id: selectedTherapist,
        store_id: null, // 外キー制約を外したので null で送信可能
        date: date,          // '2025-12-24' 形式
        start_time: startTime, // '10:00' 形式
        end_time: endTime,     // '22:00' 形式
      },
    ])

    if (error) {
      alert('エラーが発生しました: ' + error.message)
    } else {
      alert('シフトを登録しました！')
      setDate('') 
    }
    setLoading(false)
  }

// ... 後略 ...

  return (
    <div className="max-w-md mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-5">シフト登録</h1>
      <div className="bg-blue-50 p-4 rounded mb-5">
        <h2 className="text-sm font-semibold mb-2">使い方</h2>
        <ul className="text-sm text-gray-700 list-disc list-inside">
          <li>セラピストを選択してください。</li>
          <li>出勤日をカレンダーから選択してください。</li>
          <li>出勤時間と退勤時間を手動入力するか、ショートカットボタンで自動設定してください。</li>
          <li>「シフト登録」ボタンをクリックして保存します。</li>
        </ul>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <select
          value={selectedTherapist}
          onChange={(e) => setSelectedTherapist(e.target.value)}
          required
          className="w-full p-2 border border-gray-300 rounded"
        >
          <option value="">セラピストを選択</option>
          {therapists.map((therapist) => (
            <option key={therapist.id} value={therapist.id}>
              {therapist.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full p-2 border border-gray-300 rounded"
        />
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">出勤時間</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">退勤時間</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">時間帯ショートカット</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setStartTime('09:00'); setEndTime('18:00'); }}
              className="p-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              9:00 - 18:00
            </button>
            <button
              type="button"
              onClick={() => { setStartTime('10:00'); setEndTime('19:00'); }}
              className="p-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              10:00 - 19:00
            </button>
            <button
              type="button"
              onClick={() => { setStartTime('11:00'); setEndTime('20:00'); }}
              className="p-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              11:00 - 20:00
            </button>
            <button
              type="button"
              onClick={() => { setStartTime('12:00'); setEndTime('21:00'); }}
              className="p-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              12:00 - 21:00
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '登録中...' : 'シフト登録'}
        </button>
      </form>
    </div>
  );
}