'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function EditRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;

  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    google_map_url: '',
    memo: '',
    template_member: '',
    template_new_customer: '',
  });
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoom = async () => {
      if (!roomId) return;
      try {
        setInitializing(true);
        const { data, error: fetchError } = await supabase
          .from('rooms')
          .select('name, display_name, google_map_url, memo, template_member, template_new_customer')
          .eq('id', roomId)
          .single();

        if (fetchError) throw fetchError;

        if (data) {
          setFormData({
            name: data.name || '',
            display_name: data.display_name || '',
            google_map_url: data.google_map_url || '',
            memo: data.memo || '',
            template_member: data.template_member || '',
            template_new_customer: data.template_new_customer || '',
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '不明なエラー';
        setError('ルームの取得に失敗しました: ' + message);
      } finally {
        setInitializing(false);
      }
    };

    fetchRoom();
  }, [roomId]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.name.trim()) {
      setError('ルーム名を入力してください');
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('rooms')
      .update({
        name: formData.name,
        display_name: formData.display_name || null,
        google_map_url: formData.google_map_url || null,
        memo: formData.memo || null,
        template_member: formData.template_member || null,
        template_new_customer: formData.template_new_customer || null,
      })
      .eq('id', roomId);

    if (updateError) {
      setError('更新に失敗しました: ' + updateError.message);
      setLoading(false);
    } else {
      router.push('/rooms');
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 md:p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/rooms" className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm border border-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">ルームの編集</h1>
            <p className="text-sm text-slate-500 mt-1">ルーム情報とSMS案内テンプレートを編集します。</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 md:p-8">
            {error && (
              <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium flex items-start">
                <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center">
                    ルーム名 <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600">必須</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400"
                    placeholder="例: 海老名A（管理用）"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    マンション名 <span className="ml-1 text-xs text-slate-400 font-normal">シフト・タイムチャート等に表示</span>
                  </label>
                  <input
                    type="text"
                    name="display_name"
                    value={formData.display_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400"
                    placeholder="例: 海老名ルーム"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">
                  GoogleマップURL <span className="text-xs text-slate-400 font-normal">スタッフがスケジュール画面からワンクリックで開けます</span>
                </label>
                <input
                  type="url"
                  name="google_map_url"
                  value={formData.google_map_url}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400"
                  placeholder="https://maps.app.goo.gl/..."
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">
                  メモ <span className="text-xs text-slate-400 font-normal">スケジュール画面でルーム名にマウスオーバーすると表示されます</span>
                </label>
                <textarea
                  name="memo"
                  value={formData.memo}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-y text-slate-800 placeholder-slate-400"
                  placeholder="例: 駐車場あり、エレベーター不可、鍵の場所など"
                  rows={2}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">
                  会員様テンプレ
                </label>
                <p className="text-xs text-slate-400">2回目以降のお客様に送るルーム案内文。住所・マップURL・注意事項をすべて含めてください。</p>
                <textarea
                  name="template_member"
                  value={formData.template_member}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-y text-slate-800 placeholder-slate-400 font-mono text-sm"
                  placeholder={`例:\n海老名ルームのご案内です。\n\n〒243-0432\n神奈川県海老名市中央１丁目２−２リージア海老名ビナフロント805号室\n\nhttps://maps.app.goo.gl/...\n\n※スタート時間丁度にインターホンをお願い致します。`}
                  rows={10}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">
                  ご新規様テンプレ
                </label>
                <p className="text-xs text-slate-400">初回のお客様に送るルーム案内文。未入力の場合は会員様テンプレが使用されます。</p>
                <textarea
                  name="template_new_customer"
                  value={formData.template_new_customer}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-y text-slate-800 placeholder-slate-400 font-mono text-sm"
                  placeholder={`例:\n海老名ルームのご案内です。\n\n〒243-0432\n神奈川県海老名市中央１丁目３ー１\nガイアネクスト海老名駅前店（パチンコ屋）付近\n\nhttps://maps.app.goo.gl/...\n\nこちらよりお電話ください。`}
                  rows={10}
                />
              </div>

              <div className="pt-6 border-t border-slate-100 flex gap-3 justify-end">
                <Link
                  href="/rooms"
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
                >
                  {loading ? '更新中...' : '更新する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
