'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTherapistAuth } from '@/contexts/TherapistAuthContext';
import { supabase } from '@/lib/supabase';

export default function TherapistLoginPage() {
  const router = useRouter();
  const { therapist, login } = useTherapistAuth();

  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [therapists, setTherapists] = useState<{ id: string; name: string; photo_url?: string }[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // ログイン済みの場合はマイページへリダイレクト
    if (therapist) {
      router.push('/therapist/schedule');
    }
  }, [therapist, router]);

  useEffect(() => {
    async function loadShops() {
      const { data } = await supabase.from('shops').select('id, name').order('name');
      if (data && data.length > 0) {
        setShops(data);
        // デフォルトでSpecialGradeを選択
        const sg = data.find(s => s.name.includes('SpecialGrade')) || data[0];
        setSelectedShopId(sg.id);
      }
    }
    loadShops();
  }, []);

  useEffect(() => {
    async function loadTherapists() {
      if (!selectedShopId) return;
      const { data } = await supabase
        .from('therapists')
        .select('id, name, photo_url')
        .eq('shop_id', selectedShopId)
        .order('name');

      if (data) {
        setTherapists(data);
        if (data.length > 0) {
          setSelectedTherapistId(data[0].id);
        }
      }
    }
    loadTherapists();
  }, [selectedShopId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!selectedTherapistId) {
        setError('セラピストを選択してください。');
        setLoading(false);
        return;
      }

      const selected = therapists.find(t => t.id === selectedTherapistId);
      const selectedShop = shops.find(s => s.id === selectedShopId);

      if (!selected) {
        setError('セラピスト情報が見つかりません。');
        setLoading(false);
        return;
      }

      // セッションログイン
      login({
        id: selected.id,
        name: selected.name,
        shopId: selectedShopId,
        shopSlug: selectedShop?.name || 'specialgrade',
        avatarUrl: selected.photo_url,
      });

      router.push('/therapist/schedule');
    } catch (err: any) {
      setError('ログインに失敗しました: ' + (err.message || 'エラー'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col justify-center items-center p-4 font-serif">
      <div className="w-full max-w-md bg-stone-800/90 backdrop-blur-md border border-[#d1b464]/30 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        <div className="text-center space-y-2">
          <div className="inline-block px-3 py-1 bg-[#d1b464]/20 border border-[#d1b464]/40 rounded-full text-[#d1b464] text-xs font-bold tracking-widest uppercase">
            Therapist Portal
          </div>
          <h1 className="text-2xl font-bold text-stone-100 tracking-wider">セラピスト専用ログイン</h1>
          <p className="text-xs text-stone-400">出勤希望の提出・写メ日記の投稿はこちらから</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {/* 店舗選択 */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">所属店舗</label>
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="w-full px-4 py-3 bg-stone-900 border border-stone-700 rounded-xl text-stone-100 focus:border-[#d1b464] focus:ring-1 focus:ring-[#d1b464] outline-none text-sm font-sans"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* セラピスト名選択 */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">お名前（セラピスト名）</label>
            <select
              value={selectedTherapistId}
              onChange={(e) => setSelectedTherapistId(e.target.value)}
              className="w-full px-4 py-3 bg-stone-900 border border-stone-700 rounded-xl text-stone-100 focus:border-[#d1b464] focus:ring-1 focus:ring-[#d1b464] outline-none text-sm font-sans"
            >
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* パスワード */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">パスワード / 認証ピン</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="初期パスワード: password123"
              className="w-full px-4 py-3 bg-stone-900 border border-stone-700 rounded-xl text-stone-100 focus:border-[#d1b464] focus:ring-1 focus:ring-[#d1b464] outline-none text-sm font-sans"
            />
          </div>

          {/* ログインボタン */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-[#d1b464] to-[#a39573] hover:from-[#c2a353] hover:to-[#928462] text-stone-900 font-bold text-sm tracking-widest rounded-xl shadow-lg transition-all transform active:scale-98 disabled:opacity-50"
          >
            {loading ? '認証中...' : 'マイページへログイン'}
          </button>
        </form>

        <div className="pt-4 border-t border-stone-700/50 text-center">
          <p className="text-[11px] text-stone-500">
            パスワードをお忘れの場合は店舗オーナー・スタッフまでお問い合わせください。
          </p>
        </div>

      </div>
    </div>
  );
}
