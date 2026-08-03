'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTherapistAuth } from '@/contexts/TherapistAuthContext';
import { fetchStoreConfig } from '@/lib/storeApi';
import { supabase } from '@/lib/supabase';
import { StoreConfig } from '@/types/store';

export default function ShopTherapistLoginPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const router = useRouter();
  const { therapist, login } = useTherapistAuth();

  const [store, setStore] = useState<StoreConfig | null>(null);
  const [loginInput, setLoginInput] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function loadShop() {
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);
    }
    loadShop();
  }, [shopSlug]);

  useEffect(() => {
    if (therapist) {
      router.push('/therapist/schedule');
    }
  }, [therapist, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const queryTerm = loginInput.trim();

    if (!queryTerm) {
      setError('ログインIDまたはセラピスト名を入力してください。');
      return;
    }

    if (!store) {
      setError('店舗情報のロード中です。少々お待ちください。');
      return;
    }

    setLoading(true);

    try {
      // 該当店舗 (shop.id) のセラピストのみに限定してログイン検索
      let { data: therapistMatch } = await supabase
        .from('therapists')
        .select('*')
        .eq('shop_id', store.id)
        .or(`login_id.eq.${queryTerm},name.eq.${queryTerm}`)
        .maybeSingle();

      if (!therapistMatch) {
        const { data: fallbackList } = await supabase
          .from('therapists')
          .select('*')
          .eq('shop_id', store.id)
          .ilike('name', `%${queryTerm}%`)
          .limit(1);

        if (fallbackList && fallbackList.length > 0) {
          therapistMatch = fallbackList[0];
        }
      }

      if (!therapistMatch) {
        setError(`「${store.name}」に所属する対象のセラピストが見つかりません。`);
        setLoading(false);
        return;
      }

      // セッションログイン
      login({
        id: therapistMatch.id,
        name: therapistMatch.name,
        shopId: store.id,
        shopSlug: store.slug || shopSlug,
        avatarUrl: therapistMatch.photo_url || therapistMatch.avatar_url,
      });

      router.push('/therapist/schedule');
    } catch (err: any) {
      setError('ログイン処理中にエラーが発生しました: ' + (err.message || 'エラー'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col justify-center items-center p-4 font-serif">
      <div className="w-full max-w-md bg-stone-800/90 backdrop-blur-md border border-[#d1b464]/30 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        <div className="text-center space-y-2">
          <div className="inline-block px-3 py-1 bg-[#d1b464]/20 border border-[#d1b464]/40 rounded-full text-[#d1b464] text-xs font-bold tracking-widest uppercase">
            {store?.name || 'Therapist Portal'}
          </div>
          <h1 className="text-2xl font-bold text-stone-100 tracking-wider">セラピスト専用ログイン</h1>
          <p className="text-xs text-stone-400">
            {store ? `${store.name} のスタッフ専用ポータル` : '出勤希望の提出・写メ日記の投稿'}
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-medium leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">
              ログインID または セラピスト名
            </label>
            <input
              type="text"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              placeholder="例: みく、あおい、またはログインID"
              className="w-full px-4 py-3 bg-stone-900 border border-stone-700 rounded-xl text-stone-100 focus:border-[#d1b464] focus:ring-1 focus:ring-[#d1b464] outline-none text-sm font-sans"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">パスワード / 認証ピン</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              className="w-full px-4 py-3 bg-stone-900 border border-stone-700 rounded-xl text-stone-100 focus:border-[#d1b464] focus:ring-1 focus:ring-[#d1b464] outline-none text-sm font-sans"
            />
          </div>

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
