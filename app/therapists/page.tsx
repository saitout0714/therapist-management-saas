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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">セラピスト</h1>

        {/* 一覧表示 */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-blue-600">登録済みセラピスト</h2>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              新規登録
            </button>
          </div>
          {therapists && therapists.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {therapists.map((therapist) => (
                <li
                  key={therapist.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, therapist.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, therapist)}
                  className={`py-3 flex justify-between items-center cursor-move ${
                    draggedId === therapist.id ? "opacity-50 bg-gray-100" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 cursor-grab active:cursor-grabbing text-lg">⋮⋮</span>
                    <p className="font-medium text-gray-900">
                      {therapist.name}
                    </p>
                  </div>
                  <button
                    onClick={() => openEditModal(therapist)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm"
                  >
                    編集
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">データベースは空です。Supabaseの管理画面からデータを1件追加してみてください。</p>
          )}
        </div>

        {/* 編集モーダル */}
        {editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
            <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md relative">
              <h2 className="text-xl font-bold mb-4">{editTarget ? 'プロフィール編集' : 'セラピスト新規登録'}</h2>
              <form onSubmit={editTarget ? handleEditSave : handleNewSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                  <input
                    type="text"
                    name="name"
                    value={editProfile.name}
                    onChange={handleEditChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">年齢</label>
                  <input
                    type="number"
                    name="age"
                    value={editProfile.age}
                    onChange={handleEditChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">身長 (cm)</label>
                  <input
                    type="number"
                    name="height"
                    value={editProfile.height}
                    onChange={handleEditChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    min="0"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">バスト</label>
                    <input
                      type="number"
                      name="bust"
                      value={editProfile.bust}
                      onChange={handleEditChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      min="0"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">ウエスト</label>
                    <input
                      type="number"
                      name="waist"
                      value={editProfile.waist}
                      onChange={handleEditChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      min="0"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">ヒップ</label>
                    <input
                      type="number"
                      name="hip"
                      value={editProfile.hip}
                      onChange={handleEditChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      min="0"
                    />
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm font-semibold text-gray-700 mb-2">個別料金設定</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">指名料（円）</label>
                      <input
                        type="number"
                        name="nomination_fee"
                        value={editProfile.nomination_fee}
                        onChange={handleEditChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        min="0"
                        step="100"
                      />
                      <p className="text-xs text-gray-500 mt-1">空欄または0の場合はデフォルトを適用</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">本指名料（円）</label>
                      <input
                        type="number"
                        name="confirmed_nomination_fee"
                        value={editProfile.confirmed_nomination_fee}
                        onChange={handleEditChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        min="0"
                        step="100"
                      />
                      <p className="text-xs text-gray-500 mt-1">空欄または0の場合はデフォルトを適用</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">姫予約料金（円）</label>
                      <input
                        type="number"
                        name="princess_reservation_fee"
                        value={editProfile.princess_reservation_fee}
                        onChange={handleEditChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        min="0"
                        step="100"
                      />
                      <p className="text-xs text-gray-500 mt-1">空欄または0の場合はデフォルトを適用</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-400 transition"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
                  >
                    {editTarget ? '更新' : '登録'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="mt-8 text-sm text-gray-400">場所: /app/therapists/page.tsx</div>
      </div>
    </div>
  );
}