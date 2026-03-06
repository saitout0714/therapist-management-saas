"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useShop } from "@/app/contexts/ShopContext";

export default function TherapistsPage() {
  const { selectedShop } = useShop();
  const [therapists, setTherapists] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  // 編集モーダル用
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editProfile, setEditProfile] = useState({
    name: "",
    age: "",
    height: "",
    bust: "",
    waist: "",
    hip: "",
    nomination_fee: "",
    confirmed_nomination_fee: "",
    princess_reservation_fee: "",
  });
  // 編集モーダルを開く
  const openEditModal = async (therapist: any) => {
    setEditTarget(therapist);
    setEditProfile({
      name: therapist.name || "",
      age: therapist.age ? String(therapist.age) : "",
      height: therapist.height ? String(therapist.height) : "",
      bust: therapist.bust ? String(therapist.bust) : "",
      waist: therapist.waist ? String(therapist.waist) : "",
      hip: therapist.hip ? String(therapist.hip) : "",
      nomination_fee: "",
      confirmed_nomination_fee: "",
      princess_reservation_fee: "",
    });
    setEditModalOpen(true);

    const { data, error } = await supabase
      .from("therapist_pricing")
      .select("nomination_fee, confirmed_nomination_fee, princess_reservation_fee")
      .eq("therapist_id", therapist.id)
      .maybeSingle();

    if (!error && data) {
      setEditProfile((prev) => ({
        ...prev,
        nomination_fee: data.nomination_fee ? String(data.nomination_fee) : "",
        confirmed_nomination_fee: data.confirmed_nomination_fee ? String(data.confirmed_nomination_fee) : "",
        princess_reservation_fee: data.princess_reservation_fee ? String(data.princess_reservation_fee) : "",
      }));
    }
  };

  // 編集モーダルを閉じる
  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditTarget(null);
  };

  // 編集フォーム入力変更
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditProfile({ ...editProfile, [e.target.name]: e.target.value });
  };

  // 編集内容を保存（Supabaseに反映＆バリデーション）
  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    // バリデーション
    if (!editProfile.name.trim()) {
      setError("名前は必須です");
      return;
    }
    const numFields = ["age", "height", "bust", "waist", "hip", "nomination_fee", "confirmed_nomination_fee", "princess_reservation_fee"];
    for (const field of numFields) {
      const val = editProfile[field as keyof typeof editProfile];
      if (val && isNaN(Number(val))) {
        setError(`${field}は数値で入力してください`);
        return;
      }
    }
    setError(null);
    // Supabase更新
    const { error } = await supabase
      .from("therapists")
      .update({
        name: editProfile.name,
        age: editProfile.age ? Number(editProfile.age) : null,
        height: editProfile.height ? Number(editProfile.height) : null,
        bust: editProfile.bust ? Number(editProfile.bust) : null,
        waist: editProfile.waist ? Number(editProfile.waist) : null,
        hip: editProfile.hip ? Number(editProfile.hip) : null,
      })
      .eq("id", editTarget.id);
    if (error) {
      setError("保存に失敗しました: " + error.message);
      return;
    }

    const pricingPayload = {
      therapist_id: editTarget.id,
      nomination_fee: editProfile.nomination_fee ? Number(editProfile.nomination_fee) : 0,
      confirmed_nomination_fee: editProfile.confirmed_nomination_fee ? Number(editProfile.confirmed_nomination_fee) : 0,
      princess_reservation_fee: editProfile.princess_reservation_fee ? Number(editProfile.princess_reservation_fee) : 0,
    };

    const { error: pricingError } = await supabase
      .from("therapist_pricing")
      .upsert([pricingPayload], { onConflict: "therapist_id" });
    if (pricingError) {
      setError("料金設定の保存に失敗しました: " + pricingError.message);
      return;
    }
    // 一覧再取得
    await fetchTherapists();
    closeEditModal();
  };

  // 新規登録内容を保存
  const handleNewSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // バリデーション
    if (!editProfile.name.trim()) {
      setError("名前は必須です");
      return;
    }
    const numFields = ["age", "height", "bust", "waist", "hip", "nomination_fee", "confirmed_nomination_fee", "princess_reservation_fee"];
    for (const field of numFields) {
      const val = editProfile[field as keyof typeof editProfile];
      if (val && isNaN(Number(val))) {
        setError(`${field}は数値で入力してください`);
        return;
      }
    }
    setError(null);

    if (!selectedShop) {
      setError("店舗を選択してください");
      return;
    }

    // 現在の最大orderを取得
    const { data: maxOrderData } = await supabase
      .from("therapists")
      .select("order")
      .eq("shop_id", selectedShop.id)
      .order("order", { ascending: false })
      .limit(1);

    const nextOrder = maxOrderData && maxOrderData.length > 0 && maxOrderData[0].order !== null
      ? maxOrderData[0].order + 1
      : 0;

    // Supabase挿入
    const { data: createdTherapist, error } = await supabase
      .from("therapists")
      .insert([{
        name: editProfile.name,
        age: editProfile.age ? Number(editProfile.age) : null,
        height: editProfile.height ? Number(editProfile.height) : null,
        bust: editProfile.bust ? Number(editProfile.bust) : null,
        waist: editProfile.waist ? Number(editProfile.waist) : null,
        hip: editProfile.hip ? Number(editProfile.hip) : null,
        shop_id: selectedShop.id,
        order: nextOrder,
      }])
      .select();
    if (error) {
      setError("登録に失敗しました: " + error.message);
      return;
    }

    const newTherapistId = createdTherapist?.[0]?.id;
    if (newTherapistId) {
      const pricingPayload = {
        therapist_id: newTherapistId,
        nomination_fee: editProfile.nomination_fee ? Number(editProfile.nomination_fee) : 0,
        confirmed_nomination_fee: editProfile.confirmed_nomination_fee ? Number(editProfile.confirmed_nomination_fee) : 0,
        princess_reservation_fee: editProfile.princess_reservation_fee ? Number(editProfile.princess_reservation_fee) : 0,
      };
      const { error: pricingError } = await supabase
        .from("therapist_pricing")
        .upsert([pricingPayload], { onConflict: "therapist_id" });
      if (pricingError) {
        setError("料金設定の保存に失敗しました: " + pricingError.message);
        return;
      }
    }
    // 一覧再取得
    await fetchTherapists();
    closeEditModal();
  };

  // 一覧取得
  const fetchTherapists = async () => {
    if (!selectedShop) return;

    const { data, error } = await supabase
      .from("therapists")
      .select("*")
      .eq("shop_id", selectedShop.id)
      .order("order", { ascending: true, nullsFirst: false });
    if (error) {
      setError(error.message);
    } else {
      setTherapists(data || []);
      setError(null);
    }
  };

  // ドラッグ開始
  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, therapistId: string) => {
    setDraggedId(therapistId);
    e.dataTransfer.effectAllowed = "move";
  };

  // ドラッグ終了
  const handleDragEnd = () => {
    setDraggedId(null);
  };

  // ドラッグ中に許可
  const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // ドロップ時に順序を変更
  const handleDrop = async (e: React.DragEvent<HTMLLIElement>, targetTherapist: any) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetTherapist.id) {
      setDraggedId(null);
      return;
    }

    const draggedIndex = therapists.findIndex((t) => t.id === draggedId);
    const targetIndex = therapists.findIndex((t) => t.id === targetTherapist.id);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    // 配列を並び替え（ドラッグした要素を削除して、ターゲット位置に挿入）
    const newTherapists = [...therapists];
    const [draggedItem] = newTherapists.splice(draggedIndex, 1);
    newTherapists.splice(targetIndex, 0, draggedItem);

    setTherapists(newTherapists);

    // Supabaseに順序を保存
    for (let i = 0; i < newTherapists.length; i++) {
      await supabase
        .from("therapists")
        .update({ order: i })
        .eq("id", newTherapists[i].id);
    }

    setDraggedId(null);
  };

  useEffect(() => {
    fetchTherapists();
  }, [selectedShop]);

  // 登録処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!selectedShop) {
      setError("店舗を選択してください");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("therapists")
      .insert([{ name: name, shop_id: selectedShop.id }]);
    if (error) {
      setError(error.message);
    } else {
      setName("");
      fetchTherapists();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">セラピスト管理</h1>
            <p className="text-sm text-slate-500 mt-1">所属するセラピストの登録・編集、および表示順の並び替えを行います。</p>
          </div>
        </div>

        {/* 一覧表示 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
              登録済みセラピスト
            </h2>
            <button
              onClick={() => {
                setEditTarget(null);
                setEditProfile({
                  name: "",
                  age: "",
                  height: "",
                  bust: "",
                  waist: "",
                  hip: "",
                  nomination_fee: "",
                  confirmed_nomination_fee: "",
                  princess_reservation_fee: "",
                });
                setEditModalOpen(true);
              }}
              className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="text-lg leading-none">+</span>
              <span>新規登録</span>
            </button>
          </div>

          <div className="p-4 md:p-6">
            {therapists && therapists.length > 0 ? (
              <ul className="space-y-3">
                {therapists.map((therapist) => (
                  <li
                    key={therapist.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, therapist.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, therapist)}
                    className={`p-4 bg-white border border-slate-200 rounded-xl flex justify-between items-center cursor-move transition-all hover:bg-slate-50 hover:border-indigo-200 hover:shadow-sm group ${draggedId === therapist.id ? "opacity-50 scale-95 border-dashed border-indigo-400 bg-indigo-50/50" : ""
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 flex items-center justify-center text-slate-300 group-hover:text-indigo-400 transition-colors cursor-grab active:cursor-grabbing">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg shadow-inner">
                          {therapist.name.charAt(0)}
                        </div>
                        <p className="font-bold text-slate-800 text-lg">
                          {therapist.name}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => openEditModal(therapist)}
                      className="px-4 py-2 bg-slate-100 text-slate-600 font-medium rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-sm"
                    >
                      編集
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-10">
                <p className="text-slate-500 font-medium">セラピストが登録されていません</p>
                <p className="text-sm text-slate-400 mt-1">右上の「新規登録」ボタンから追加してください。</p>
              </div>
            )}
          </div>
        </div>

        {/* 編集/新規作成モーダル */}
        {editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
              onClick={closeEditModal}
            ></div>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative z-10 overflow-hidden transform transition-all max-h-[90vh] flex flex-col">
              <div className="p-6 md:p-8 border-b border-slate-100 bg-white sticky top-0 z-20">
                <h2 className="text-xl font-bold text-slate-800">
                  {editTarget ? 'プロフィールの編集' : 'セラピストの新規登録'}
                </h2>
              </div>

              <div className="p-6 md:p-8 overflow-y-auto">
                {error && (
                  <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium flex items-start">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}

                <form id="therapist-form" onSubmit={editTarget ? handleEditSave : handleNewSave} className="space-y-6">
                  {/* 基本プロフィール */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">基本情報</h3>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center">
                        名前 <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600">必須</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={editProfile.name}
                        onChange={handleEditChange}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400"
                        placeholder="山田 花子"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">年齢</label>
                        <div className="relative">
                          <input
                            type="number"
                            name="age"
                            value={editProfile.age}
                            onChange={handleEditChange}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all pr-12 text-slate-800 placeholder-slate-400"
                            placeholder="25"
                            min="0"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">歳</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">身長</label>
                        <div className="relative">
                          <input
                            type="number"
                            name="height"
                            value={editProfile.height}
                            onChange={handleEditChange}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all pr-12 text-slate-800 placeholder-slate-400"
                            placeholder="160"
                            min="0"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">cm</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">スリーサイズ</label>
                      <div className="flex bg-slate-50 rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                        <div className="flex-1 relative flex items-center">
                          <span className="absolute left-3 text-slate-400 text-sm font-bold">B</span>
                          <input
                            type="number" name="bust" value={editProfile.bust} onChange={handleEditChange}
                            className="w-full py-2.5 pl-8 pr-2 bg-transparent outline-none text-slate-800 text-center" min="0" placeholder="-"
                          />
                        </div>
                        <div className="w-px bg-slate-200"></div>
                        <div className="flex-1 relative flex items-center">
                          <span className="absolute left-3 text-slate-400 text-sm font-bold">W</span>
                          <input
                            type="number" name="waist" value={editProfile.waist} onChange={handleEditChange}
                            className="w-full py-2.5 pl-8 pr-2 bg-transparent outline-none text-slate-800 text-center" min="0" placeholder="-"
                          />
                        </div>
                        <div className="w-px bg-slate-200"></div>
                        <div className="flex-1 relative flex items-center">
                          <span className="absolute left-3 text-slate-400 text-sm font-bold">H</span>
                          <input
                            type="number" name="hip" value={editProfile.hip} onChange={handleEditChange}
                            className="w-full py-2.5 pl-8 pr-2 bg-transparent outline-none text-slate-800 text-center" min="0" placeholder="-"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 料金設定 */}
                  <div className="pt-6 border-t border-slate-100 space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      個別料金設定
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 flex justify-between">
                          <span>指名料</span>
                          <span className="text-xs text-slate-400 font-normal">空欄=店舗デフォルト</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number" name="nomination_fee" value={editProfile.nomination_fee} onChange={handleEditChange}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all pr-12 text-slate-800 font-medium"
                            min="0" step="100" placeholder="0"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">円</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 flex justify-between">
                          <span>本指名料</span>
                          <span className="text-xs text-slate-400 font-normal">空欄=店舗デフォルト</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number" name="confirmed_nomination_fee" value={editProfile.confirmed_nomination_fee} onChange={handleEditChange}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all pr-12 text-slate-800 font-medium"
                            min="0" step="100" placeholder="0"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">円</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 flex justify-between">
                          <span>姫予約料</span>
                          <span className="text-xs text-slate-400 font-normal">空欄=店舗デフォルト</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number" name="princess_reservation_fee" value={editProfile.princess_reservation_fee} onChange={handleEditChange}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all pr-12 text-slate-800 font-medium text-indigo-700"
                            min="0" step="100" placeholder="0"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm font-bold">円</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              <div className="bg-slate-50 p-4 md:px-8 border-t border-slate-100 flex gap-3 justify-end sticky bottom-0 z-20">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  form="therapist-form"
                  className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95"
                >
                  {editTarget ? '更新する' : '登録する'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}