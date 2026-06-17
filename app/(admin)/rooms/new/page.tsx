'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useShop } from '@/app/contexts/ShopContext';
import Link from 'next/link';

export default function NewRoomPage() {
  const router = useRouter();
  const { selectedShop } = useShop();

  const [smsAddressMode, setSmsAddressMode] = useState<'unified' | 'split_by_membership'>('unified');
  const [webReserveAddressMode, setWebReserveAddressMode] = useState<'unified' | 'split_by_membership'>('unified');

  useEffect(() => {
    const fetchShopMode = async () => {
      if (!selectedShop) return;
      const { data } = await supabase
        .from('shops')
        .select('sms_address_mode, web_reserve_address_mode')
        .eq('id', selectedShop.id)
        .single();
      if (data) {
        setSmsAddressMode(data.sms_address_mode || 'unified');
        setWebReserveAddressMode(data.web_reserve_address_mode || 'unified');
      }
    };
    void fetchShopMode();
  }, [selectedShop]);

  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    google_map_url: '',
    memo: '',
    template_member: '',
    template_new_customer: '',
    template_web_member: '',
    template_web_new_customer: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    if (!selectedShop) {
      setError('店舗を選択してください');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('rooms').insert([
      {
        name: formData.name,
        display_name: formData.display_name || null,
        google_map_url: formData.google_map_url || null,
        memo: formData.memo || null,
        template_member: formData.template_member || null,
        template_new_customer: formData.template_new_customer || null,
        template_web_member: formData.template_web_member || null,
        template_web_new_customer: formData.template_web_new_customer || null,
        shop_id: selectedShop.id,
      },
    ]);

    if (insertError) {
      setError('登録に失敗しました: ' + insertError.message);
      setLoading(false);
    } else {
      router.push('/rooms');
    }
  };

  return (
    <div className="bg-gray-100 p-4 md:p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/rooms" className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm border border-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">新規ルームの登録</h1>
            <p className="text-sm text-slate-500 mt-1">ルーム情報とSMS案内テンプレートを設定します。</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 md:p-5">
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
                    placeholder="例: ルームA（管理用）"
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
                    placeholder="例: 〇〇ルーム"
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

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-indigo-600 border-l-4 border-indigo-500 pl-2 flex items-center gap-2">
                  <span>SMS/手動送信用 案内テンプレート</span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-normal">
                    {smsAddressMode === 'unified' ? '一律送信モード' : '新規/会員切替モード'}
                  </span>
                </h3>
                
                {smsAddressMode === 'unified' ? (
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">
                      テンプレート
                    </label>
                    <p className="text-xs text-slate-400">お客様に送るルーム案内文。部屋番号入り住所などを含めてください。</p>
                    <textarea
                      name="template_member"
                      value={formData.template_member}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-y text-slate-800 placeholder-slate-400 font-mono text-sm"
                      placeholder={`例:\n〇〇ルームのご案内です。\n\n〒000-0000\n〇〇県〇〇市〇〇 1丁目1-1 〇〇マンション101号室\n\nhttps://maps.app.goo.gl/...\n\n※スタート時間丁度にインターホンをお願い致します。`}
                      rows={6}
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">
                        会員様用テンプレート
                      </label>
                      <p className="text-xs text-slate-400">2回目以降のお客様に送るルーム案内文。</p>
                      <textarea
                        name="template_member"
                        value={formData.template_member}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-y text-slate-800 placeholder-slate-400 font-mono text-sm"
                        placeholder={`例:\n〇〇ルームのご案内です。\n\n〒000-0000\n〇〇県〇〇市〇〇 1丁目1-1 〇〇マンション101号室\n\nhttps://maps.app.goo.gl/...\n\n※スタート時間丁度にインターホンをお願い致します。`}
                        rows={6}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">
                        新規様用テンプレート
                      </label>
                      <p className="text-xs text-slate-400">初回のお客様に送るルーム案内文。</p>
                      <textarea
                        name="template_new_customer"
                        value={formData.template_new_customer}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-y text-slate-800 placeholder-slate-400 font-mono text-sm"
                        placeholder={`例:\n〇〇ルームのご案内です。\n\n〒000-0000\n〇〇県〇〇市〇〇 1丁目1-1\n〇〇ビル・〇〇店付近\n\nhttps://maps.app.goo.gl/...\n\nこちらよりお電話ください。`}
                        rows={6}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-indigo-600 border-l-4 border-indigo-500 pl-2 flex items-center gap-2">
                  <span>WEB予約メール自動返信用 テンプレート</span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-normal">
                    {webReserveAddressMode === 'unified' ? '一律送信モード' : '新規/会員切替モード'}
                  </span>
                </h3>
                
                {webReserveAddressMode === 'unified' ? (
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">
                      テンプレート
                    </label>
                    <p className="text-xs text-slate-400">WEB予約完了メールで自動送信する案内文です。部屋番号入り住所などを含めてください。</p>
                    <textarea
                      name="template_web_member"
                      value={formData.template_web_member}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-y text-slate-800 placeholder-slate-400 font-mono text-sm"
                      placeholder={`例:\nご予約ありがとうございます。以下、本日のご案内のお部屋です。\n\n〒000-0000\n〇〇県〇〇市〇〇 1丁目1-1 〇〇マンション101号室`}
                      rows={6}
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">
                        会員様用テンプレート
                      </label>
                      <p className="text-xs text-slate-400">リピーターの会員様にWEB予約完了メールで自動送信する案内文です。部屋番号入り住所などを含めてください。</p>
                      <textarea
                        name="template_web_member"
                        value={formData.template_web_member}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-y text-slate-800 placeholder-slate-400 font-mono text-sm"
                        placeholder={`例:\nご予約ありがとうございます。以下、本日のご案内のお部屋です。\n\n〒000-0000\n〇〇県〇〇市〇〇 1丁目1-1 〇〇マンション101号室`}
                        rows={6}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">
                        新規様用テンプレート
                      </label>
                      <p className="text-xs text-slate-400">ご新規様にWEB予約完了メールで自動送信する案内文です。目印 of 住所のみ記載するか、SMS案内に誘導する文章を含めてください。</p>
                      <textarea
                        name="template_web_new_customer"
                        value={formData.template_web_new_customer}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-y text-slate-800 placeholder-slate-400 font-mono text-sm"
                        placeholder={`例:\nご予約ありがとうございます。\n防犯上の理由により、お部屋の詳細は店舗より別途SMSにてお送りいたします。`}
                        rows={6}
                      />
                    </div>
                  </>
                )}
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
                  {loading ? '登録中...' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
