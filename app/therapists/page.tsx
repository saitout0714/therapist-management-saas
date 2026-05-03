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
  is_active: boolean;
  age: number | null;
  height: number | null;
  bust: number | null;
  bust_cup: string | null;
  waist: number | null;
  hip: number | null;
  comment: string | null;
  rank_id: string | null;
  therapist_ranks: { name: string } | null;
};

export default function TherapistsPage() {
  const { selectedShop } = useShop();
  const [therapists, setTherapists] = useState<TherapistItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TherapistItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteReservationCount, setDeleteReservationCount] = useState(0);
  const [deleteCountLoading, setDeleteCountLoading] = useState(false);

  const fetchTherapists = async () => {
    if (!selectedShop) return;

    const { data, error } = await supabase
      .from("therapists")
      .select("id, name, order, is_active, age, height, bust, bust_cup, waist, hip, comment, rank_id, therapist_ranks(name)")
      .eq("shop_id", selectedShop.id)
      .order("order", { ascending: true, nullsFirst: false });
    if (error) {
      setError(error.message);
    } else {
      setTherapists((data as TherapistItem[]) || []);
      setError(null);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, therapistId: string) => {
    setDraggedId(therapistId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

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

    const newTherapists = [...therapists];
    const [draggedItem] = newTherapists.splice(draggedIndex, 1);
    newTherapists.splice(targetIndex, 0, draggedItem);

    setTherapists(newTherapists);

    for (let i = 0; i < newTherapists.length; i++) {
      await supabase
        .from("therapists")
        .update({ order: i })
        .eq("id", newTherapists[i].id);
    }

    setDraggedId(null);
  };

  const handleDeleteClick = async (therapist: TherapistItem) => {
    setDeleteTarget(therapist);
    setDeleteReservationCount(0);
    setDeleteCountLoading(true);
    const { count } = await supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("therapist_id", therapist.id);
    setDeleteReservationCount(count ?? 0);
    setDeleteCountLoading(false);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supabase.from("therapist_option_backs").delete().eq("therapist_id", deleteTarget.id);
      await supabase.from("therapist_fee_overrides").delete().eq("therapist_id", deleteTarget.id);
      await supabase.from("therapist_back_overrides").delete().eq("therapist_id", deleteTarget.id);
      await supabase.from("shifts").delete().eq("therapist_id", deleteTarget.id);
      await supabase.from("reservations").delete().eq("therapist_id", deleteTarget.id);
      const { error } = await supabase.from("therapists").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      setDeleteTarget(null);
      await fetchTherapists();
    } catch (err) {
      console.error("削除に失敗:", err);
      alert("削除に失敗しました。もう一度お試しください。");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchTherapists();
  }, [selectedShop]);

  const activeTherapists = therapists.filter((t) => t.is_active !== false);
  const inactiveTherapists = therapists.filter((t) => t.is_active === false);

  const TherapistRow = ({ therapist }: { therapist: TherapistItem }) => {
    const isActive = therapist.is_active !== false;
    const rankName = therapist.therapist_ranks?.name;

    const sizeLabel = (() => {
      const parts: string[] = [];
      if (therapist.bust) parts.push(`B${therapist.bust}${therapist.bust_cup ?? ""}`);
      if (therapist.waist) parts.push(`W${therapist.waist}`);
      if (therapist.hip) parts.push(`H${therapist.hip}`);
      return parts.join(" / ");
    })();

    return (
      <li
        key={therapist.id}
        draggable={isActive}
        onDragStart={(e) => isActive && handleDragStart(e, therapist.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => isActive && handleDragOver(e)}
        onDrop={(e) => isActive && handleDrop(e, therapist)}
        className={`p-4 bg-white border rounded-xl flex justify-between items-start transition-all group ${
          isActive
            ? `border-slate-200 hover:bg-slate-50 hover:border-indigo-200 hover:shadow-sm ${draggedId === therapist.id ? "opacity-50 scale-95 border-dashed border-indigo-400 bg-indigo-50/50" : ""}`
            : "border-slate-100 bg-slate-50/50 opacity-70"
        }`}
      >
        {/* ドラッグハンドル */}
        <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center mt-1 transition-colors ${isActive ? "text-slate-300 group-hover:text-indigo-400 cursor-grab active:cursor-grabbing" : "text-slate-200"}`}>
          {isActive && (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          )}
        </div>

        {/* アバター */}
        <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-lg shadow-inner mt-0.5 ${isActive ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
          {therapist.name.charAt(0)}
        </div>

        {/* 情報エリア */}
        <div className="flex-1 min-w-0 ml-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-bold text-base ${isActive ? "text-slate-800" : "text-slate-400"}`}>
              {therapist.name}
            </p>
            {!isActive && (
              <span className="text-xs text-rose-400 font-medium">退店</span>
            )}
            {rankName && (
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                {rankName}
              </span>
            )}
          </div>

          {/* 身体情報 */}
          {(therapist.age || therapist.height || sizeLabel) && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {therapist.age && (
                <span className="text-xs text-slate-500">{therapist.age}歳</span>
              )}
              {therapist.height && (
                <span className="text-xs text-slate-500">{therapist.height}cm</span>
              )}
              {sizeLabel && (
                <span className="text-xs text-slate-500">{sizeLabel}</span>
              )}
            </div>
          )}

          {/* メモ */}
          {therapist.comment && (
            <p className="mt-1 text-xs text-slate-400 line-clamp-1 max-w-lg">
              {therapist.comment}
            </p>
          )}
        </div>

        {/* アクションボタン */}
        <div className="flex-shrink-0 ml-3 flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
          <Link
            href={`/therapists/${therapist.id}/edit`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>編集</span>
          </Link>
          <button
            onClick={() => handleDeleteClick(therapist)}
            className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
            title="削除"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </li>
    );
  };

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

        {/* 在籍中一覧 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
          <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
              在籍中
              <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{activeTherapists.length}</span>
            </h2>
            <div className="flex gap-2">
              <Link
                href="/therapists/import"
                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>HPから一括取込</span>
              </Link>
              <Link
                href="/therapists/new"
                className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span className="text-lg leading-none">+</span>
                <span>新規登録</span>
              </Link>
            </div>
          </div>

          <div className="p-4 md:p-6">
            {activeTherapists.length > 0 ? (
              <ul className="space-y-3">
                {activeTherapists.map((therapist) => (
                  <TherapistRow key={therapist.id} therapist={therapist} />
                ))}
              </ul>
            ) : (
              <div className="text-center py-10">
                <p className="text-slate-500 font-medium">在籍中のセラピストがいません</p>
                <p className="text-sm text-slate-400 mt-1">右上の「新規登録」ボタンから追加してください。</p>
              </div>
            )}
          </div>
        </div>

        {/* 退店一覧 */}
        {inactiveTherapists.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 md:p-8 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-500 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </span>
                退店
                <span className="ml-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">{inactiveTherapists.length}</span>
              </h2>
            </div>

            <div className="p-4 md:p-6">
              <ul className="space-y-3">
                {inactiveTherapists.map((therapist) => (
                  <TherapistRow key={therapist.id} therapist={therapist} />
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">セラピストを削除する</h2>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center font-bold text-xl flex-shrink-0">
                  {deleteTarget.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-lg">{deleteTarget.name}</p>
                  {deleteTarget.therapist_ranks?.name && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                      {deleteTarget.therapist_ranks.name}
                    </span>
                  )}
                </div>
              </div>

              {deleteCountLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                  予約履歴を確認中...
                </div>
              ) : deleteReservationCount > 0 ? (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                  <svg className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-rose-700">
                    このセラピストには <span className="font-bold">{deleteReservationCount}件</span> の予約履歴があります。
                    削除するとシフト・予約履歴・バック設定もすべて削除されます。この操作は元に戻せません。
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                  <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-slate-600">このセラピストを削除します。この操作は元に戻せません。</p>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={executeDelete}
                disabled={deleting || deleteCountLoading}
                className="px-5 py-2.5 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    削除中...
                  </>
                ) : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
