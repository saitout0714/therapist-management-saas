'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Room {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export default function RoomsList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
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

    const { error } = await supabase.from('rooms').insert([formData]);

    if (error) {
      alert('登録に失敗しました: ' + error.message);
    } else {
      alert('ルームを登録しました');
      closeModal();
      fetchRooms();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">ルーム一覧</h1>
          <button
            onClick={handleAddRoom}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            ルームを追加
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">読み込み中...</div>
        ) : rooms.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            ルームが登録されていません
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    ルーム名
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    説明
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {room.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {room.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-3">
                        <button
                          onClick={() => openEditModal(room)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(room.id)}
                          className="text-red-600 hover:text-red-800"
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
        )}
      </div>

      {/* 編集/新規作成モーダル */}
      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingRoom ? 'ルームを編集' : '新しいルームを追加'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ルーム名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ルーム名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ルームの説明（任意）"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-md hover:bg-gray-400"
                >
                  キャンセル
                </button>
                <button
                  onClick={editingRoom ? handleSave : handleAddSave}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
