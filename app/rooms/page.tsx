'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useShop } from '@/app/contexts/ShopContext';

interface Room {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export default function RoomsList() {
  const { selectedShop } = useShop();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchRooms();
  }, [selectedShop]);

  const fetchRooms = async () => {
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
  };

  const openEditModal = (room: Room) => {
    setEditingRoom(room);
    setFormData({ name: room.name, description: room.description });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRoom(null);
    setFormData({ name: '', description: '' });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!editingRoom) return;
    if (!formData.name.trim()) {
      alert('ルーム名を入力してください');
      return;
    }

    const { error } = await supabase
      .from('rooms')
      .update({
        name: formData.name,
        description: formData.description,
      })
      .eq('id', editingRoom.id);

    if (error) {
      alert('更新に失敗しました: ' + error.message);
    } else {
      alert('ルームを更新しました');
      closeModal();
      fetchRooms();
    }
  };

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

  const handleAddRoom = () => {
    setEditingRoom(null);
    setFormData({ name: '', description: '' });
    setModalOpen(true);
  };

  const handleAddSave = async () => {
    if (!formData.name.trim()) {
      alert('ルーム名を入力してください');
      return;
    }

    if (!selectedShop) {
      alert('店舗を選択してください');
      return;
    }

    const { error } = await supabase.from('rooms').insert([
      {
        ...formData,
        shop_id: selectedShop.id,
      },
    ]);

    if (error) {
      alert('登録に失敗しました: ' + error.message);
    } else {
      alert('ルームを登録しました');
      closeModal();
      fetchRooms();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">ルーム管理</h1>
            <p className="text-sm text-slate-500 mt-1">店舗に紐づくルーム（部屋）の登録・編集を行います。</p>
          </div>
          <button
            onClick={handleAddRoom}
            className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95 flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span>
            <span>新規ルーム登録</span>
          </button>
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
                    <th className="px-6 py-4 whitespace-nowrap">説明</th>
                    <th className="px-6 py-4 whitespace-nowrap w-32 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rooms.map((room) => (
                    <tr key={room.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-800">{room.name}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {room.description || <span className="text-slate-400 italic">未設定</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(room)}
                            className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
                          >
                            編集
                          </button>
                          <span className="text-slate-300">|</span>
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

      {/* 編集/新規作成モーダル */}
      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={closeModal}
          ></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden transform transition-all">
            <div className="p-6 md:p-8">
              <h2 className="text-xl font-bold text-slate-800 mb-6">
                {editingRoom ? 'ルーム設定の編集' : '新規ルームの登録'}
              </h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center">
                    ルーム名 <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600">必須</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400"
                    placeholder="例: ルームA, VIPルーム等"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center">
                    説明 <span className="ml-2 text-xs text-slate-400 font-normal">任意</span>
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-y text-slate-800 placeholder-slate-400"
                    placeholder="設備や特徴などのメモ（内部のみ表示）"
                    rows={4}
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 md:px-8 border-t border-slate-100 flex gap-3 justify-end">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={editingRoom ? handleSave : handleAddSave}
                className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
