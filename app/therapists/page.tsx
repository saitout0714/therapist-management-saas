"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useShop } from "@/app/contexts/ShopContext";
import Link from "next/link";

type TherapistItem = {
  id: string;
  name: string;
  order: number | null;
};

export default function TherapistsPage() {
  const { selectedShop } = useShop();
  const [therapists, setTherapists] = useState<TherapistItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

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
      setTherapists((data as TherapistItem[]) || []);
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
  const handleDrop = async (e: React.DragEvent<HTMLLIElement>, targetTherapist: TherapistItem) => {
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

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">セラピスト管理</h1>
            <p className="text-sm text-slate-500 mt-1">所属するセラピストの登録・編集および表示順の並び替えを行います。</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium flex items-start">
            <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

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
            <Link
              href="/therapists/new"
              className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="text-lg leading-none">+</span>
              <span>新規登録</span>
            </Link>
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
                    <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/therapists/${therapist.id}/edit`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>編集</span>
                      </Link>
                    </div>
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
      </div>
    </div>
  );
}

