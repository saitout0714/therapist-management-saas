'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function EditRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;

  const [smsAddressMode, setSmsAddressMode] = useState<'unified' | 'split_by_membership'>('unified');
  const [webReserveAddressMode, setWebReserveAddressMode] = useState<'unified' | 'split_by_membership'>('unified');

  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    address: '',
    google_map_url: '',
    memo: '',
    template_member: '',
    template_new_customer: '',
    template_web_member: '',
    template_web_new_customer: '',
  });
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 多店舗ルームリンク用
  const [allOtherRooms, setAllOtherRooms] = useState<any[]>([]);
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [originalGroupId, setOriginalGroupId] = useState<string | null>(null);
  const [roomShopId, setRoomShopId] = useState<string>("");

  useEffect(() => {
    const fetchRoom = async () => {
      if (!roomId) return;
      try {
        setInitializing(true);
        const { data, error: fetchError } = await supabase
          .from('rooms')
          .select('shop_id, name, display_name, address, google_map_url, memo, template_member, template_new_customer, template_web_member, template_web_new_customer, linked_room_group_id')
          .eq('id', roomId)
          .single();

        if (fetchError) throw fetchError;

        if (data) {
          setFormData({
            name: data.name || '',
            display_name: data.display_name || '',
            address: data.address || '',
            google_map_url: data.google_map_url || '',
            memo: data.memo || '',
            template_member: data.template_member || '',
            template_new_customer: data.template_new_customer || '',
            template_web_member: data.template_web_member || '',
            template_web_new_customer: data.template_web_new_customer || '',
          });

          setRoomShopId(data.shop_id || "");
          setOriginalGroupId(data.linked_room_group_id || null);

          if (data.shop_id) {
            // 相互リンクが許可されている店舗IDリストを取得
            const { data: linksData } = await supabase
              .from('shop_links')
              .select('shop_id_1, shop_id_2')
              .eq('is_active', true)
              .or(`shop_id_1.eq.${data.shop_id},shop_id_2.eq.${data.shop_id}`);
            const linkedShopIds = (linksData || []).map(l => l.shop_id_1 === data.shop_id ? l.shop_id_2 : l.shop_id_1);

            const [shopRes, otherRoomsRes] = await Promise.all([
              supabase
                .from('shops')
                .select('sms_address_mode, web_reserve_address_mode')
                .eq('id', data.shop_id)
                .single(),
              linkedShopIds.length > 0
                ? supabase
                    .from('rooms')
                    .select('id, name, shop_id, shops(name), linked_room_group_id')
                    .in('shop_id', linkedShopIds)
                    .order('name', { ascending: true })
                : Promise.resolve({ data: [] })
            ]);

            const shopData = shopRes.data;
            if (shopData) {
              setSmsAddressMode(shopData.sms_address_mode || 'unified');
              setWebReserveAddressMode(shopData.web_reserve_address_mode || 'unified');
            }

            const otherRooms = (otherRoomsRes.data || []) as any[];
            setAllOtherRooms(otherRooms);

            if (data.linked_room_group_id) {
              const initialSelected = otherRooms
                .filter((r: any) => r.linked_room_group_id === data.linked_room_group_id)
                .map((r: any) => r.id);
              setSelectedLinkIds(initialSelected);
            }
          }
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
        address: formData.address || null,
        google_map_url: formData.google_map_url || null,
        memo: formData.memo || null,
        template_member: formData.template_member || null,
        template_new_customer: formData.template_new_customer || null,
        template_web_member: formData.template_web_member || null,
        template_web_new_customer: formData.template_web_new_customer || null,
      })
      .eq('id', roomId);

    if (updateError) {
      setError('更新に失敗しました: ' + updateError.message);
      setLoading(false);
      return;
    }

    // === 多店舗ルームリンク同期 ===
    const newLinkIds = selectedLinkIds;

    if (newLinkIds.length > 0) {
      // リンクあり：グループIDを決定（既存のものを使用するか、新規に生成）
      let groupId = originalGroupId;
      if (!groupId) {
        groupId = crypto.randomUUID();
      }

      // 自分と選択された他店舗ルーム全員のグループIDを更新
      const targetIds = [roomId, ...newLinkIds];
      await supabase
        .from("rooms")
        .update({ linked_room_group_id: groupId })
        .in("id", targetIds);

      // それ以外の、以前同じグループだったが選択解除されたルームのグループIDをクリア（NULLに）
      if (originalGroupId) {
        const { data: oldMembers } = await supabase
          .from("rooms")
          .select("id")
          .eq("linked_room_group_id", originalGroupId)
          .not("id", "in", `(${targetIds.join(",")})`);
        
        if (oldMembers && oldMembers.length > 0) {
          const oldMemberIds = oldMembers.map(m => m.id);
          await supabase
            .from("rooms")
            .update({ linked_room_group_id: null })
            .in("id", oldMemberIds);
          
          // 古いグループに残ったメンバーが1人以下になったら、そのグループを解体
          const { data: remainingMembers } = await supabase
            .from("rooms")
            .select("id")
            .eq("linked_room_group_id", originalGroupId);
          if (remainingMembers && remainingMembers.length <= 1) {
            await supabase
              .from("rooms")
              .update({ linked_room_group_id: null })
              .eq("linked_room_group_id", originalGroupId);
          }
        }
      }
    } else {
      // リンクなし：自分のグループIDをクリア
      await supabase
        .from("rooms")
        .update({ linked_room_group_id: null })
        .eq("id", roomId);

      // 以前のグループメンバーの整理
      if (originalGroupId) {
        const { data: remainingMembers } = await supabase
          .from("rooms")
          .select("id")
          .eq("linked_room_group_id", originalGroupId);
        
        if (remainingMembers && remainingMembers.length <= 1) {
          // 残ったメンバーが1人以下ならグループ解体
          await supabase
            .from("rooms")
            .update({ linked_room_group_id: null })
            .eq("linked_room_group_id", originalGroupId);
        }
      }
    }

    setLoading(false);
    router.push('/rooms');
  };

  if (initializing) {
    return (
      <div className="h-full bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">ルームの編集</h1>
            <p className="text-sm text-slate-500 mt-1">ルーム情報とSMS案内テンプレートを編集します。</p>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    住所
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400"
                    placeholder="例: 東京都新宿区新宿X-X-X"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    GoogleマップURL <span className="text-xs text-slate-400 font-normal">スタッフがワンクリックで開けます</span>
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

              {/* 多店舗リンク設定 */}
              {allOtherRooms.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <label className="block text-sm font-medium text-slate-700">🔗 多店舗リンク設定</label>
                  <p className="text-xs text-slate-400">
                    他の連携店舗に登録されている「同一のルーム（部屋）」を選択してください。
                    選択すると、その部屋での予約スケジュールが相互に自動同期（ブロック）されます。
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-100">
                    {allOtherRooms.map((r) => {
                      const isChecked = selectedLinkIds.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-indigo-50 border-indigo-200"
                              : "bg-white border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLinkIds([...selectedLinkIds, r.id]);
                              } else {
                                setSelectedLinkIds(selectedLinkIds.filter((id) => id !== r.id));
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                          <div className="text-xs md:text-sm">
                            <span className="font-bold text-slate-800">{r.name}</span>
                            <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                              {r.shops?.name || "他店舗"}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

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

