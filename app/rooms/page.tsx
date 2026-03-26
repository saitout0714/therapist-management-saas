'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useShop } from '@/app/contexts/ShopContext';
import Link from 'next/link';

interface Room {
  id: string;
  name: string;
  description: string;
  address: string | null;
  created_at: string;
}

export default function RoomsList() {
  const { selectedShop } = useShop();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchRooms() {
    if (!selectedShop) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('shop_id', selectedShop.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching rooms:', error);
    } else {
      setRooms((data as Room[]) || []);
    }
    setLoading(false);
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このルームを削除しますか？')) return;

    const { error } = await supabase.from('rooms').delete().eq('id', id);

    if (error) {
      alert('削除に失敗しました: ' + error.message);
    } else {
      alert('ルームを削除しました');
      fetchRooms();
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [selectedShop]);

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">ルーム管理</h1>
            <p className="text-sm text-slate-500 mt-1">店舗に紐づくルーム（部屋）の登録・編集を行います。</p>
          </div>
          <Link
            href="/rooms/new"
            className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95 flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span>
            <span>新規ルーム登録</span>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20 text-indigo-600">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 font-medium">読み込み中...</span>
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-800 mb-2">ルームが登録されていません</h3>
            <p className="text-slate-500">右上の「新規ルーム登録」ボタンから、店舗のルームを追加してください。</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-sm font-medium text-slate-600">
                    <th className="px-6 py-4 whitespace-nowrap">ルーム名</th>
                    <th className="px-6 py-4 whitespace-nowrap">住所</th>
                    <th className="px-6 py-4 whitespace-nowrap">説明</th>
                    <th className="px-6 py-4 whitespace-nowrap w-32 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rooms.map((room) => (
                    <tr key={room.id} className="hover:bg-slate-100 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-800">{room.name}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {room.address || <span className="text-slate-400 italic">未入力</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {room.description || <span className="text-slate-400 italic">未設定</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/rooms/${room.id}/edit`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                          >
                            <svg className="w-4 h-4 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>編集</span>
                          </Link>
                          <span className="text-slate-300 hidden md:inline">|</span>
                          <button
                            onClick={() => handleDelete(room.id)}
                            className="text-rose-500 hover:text-rose-700 font-medium text-sm transition-colors"
                          >
                            削除
                          </button>
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
    </div>
  );
}


