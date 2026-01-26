"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TherapistsPage() {
  const [therapists, setTherapists] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  });
  // 編集モーダルを開く
  const openEditModal = (therapist: any) => {
    setEditTarget(therapist);
    setEditProfile({
      name: therapist.name || "",
      age: therapist.age ? String(therapist.age) : "",
      height: therapist.height ? String(therapist.height) : "",
      bust: therapist.bust ? String(therapist.bust) : "",
      waist: therapist.waist ? String(therapist.waist) : "",
      hip: therapist.hip ? String(therapist.hip) : "",
    });
    setEditModalOpen(true);
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
    const numFields = ["age", "height", "bust", "waist", "hip"];
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
    // 一覧再取得
    await fetchTherapists();
    closeEditModal();
  };

  // 一覧取得
  const fetchTherapists = async () => {
    const { data, error } = await supabase.from("therapists").select("*");
    if (error) {
      setError(error.message);
    } else {
      setTherapists(data || []);
      setError(null);
    }
  };

  useEffect(() => {
    fetchTherapists();
  }, []);

  // 登録処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase
      .from("therapists")
      .insert([{ name: name, store_id: "550e8400-e29b-41d4-a716-446655440000" }]);
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

        {/* 登録フォーム */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-blue-600">新規登録</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="例：さくらこ"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {loading ? "登録中..." : "登録する"}
            </button>
          </form>
          {error && <div className="text-red-500 mt-2">エラー: {error}</div>}
        </div>

        {/* 一覧表示 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-blue-600">登録済みセラピスト</h2>
          {therapists && therapists.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {therapists.map((therapist) => (
                <li key={therapist.id} className="py-3 flex justify-between items-center">
                  <button
                    className="font-medium text-blue-600 hover:underline text-left"
                    onClick={() => openEditModal(therapist)}
                  >
                    {therapist.name}
                  </button>
                  <span className="text-sm text-gray-400">ID: {therapist.id.slice(0, 8)}...</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">データベースは空です。Supabaseの管理画面からデータを1件追加してみてください。</p>
          )}
        </div>

        {/* 編集モーダル */}
        {editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md relative">
              <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onClick={closeEditModal}>&times;</button>
              <h2 className="text-xl font-bold mb-4">プロフィール編集</h2>
              <form onSubmit={handleEditSave} className="space-y-4">
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
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
                >
                  保存
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="mt-8 text-sm text-gray-400">場所: /app/therapists/page.tsx</div>
      </div>
    </div>
  );
}