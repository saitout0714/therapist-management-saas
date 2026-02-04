'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useShop } from '@/app/contexts/ShopContext';

export default function RegisterRoom() {
  const router = useRouter();
  const { selectedShop } = useShop();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!selectedShop) {
        setError('店舗を選択してください');
        return;
      }

      const { error: insertError } = await supabase
        .from('rooms')
        .insert([
          {
            ...formData,
            shop_id: selectedShop.id,
          },
        ]);

      if (insertError) {
        setError(insertError.message);
        return;
      }

      alert('ルームを登録しました');
      setFormData({ name: '', description: '' });
      router.push('/rooms');
    } catch (err) {
      console.error('Error registering room:', err);
      setError('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">ルーム登録</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ルーム名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
              placeholder="例：スペースA、スペースB"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              説明
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
              placeholder="ルームの説明（任意）"
              rows={4}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? '登録中...' : 'ルームを登録'}
          </button>
        </form>
      </div>
    </div>
  );
}
