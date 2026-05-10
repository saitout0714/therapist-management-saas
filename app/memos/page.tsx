'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useShop } from '@/app/contexts/ShopContext';

interface Memo {
  id: string;
  therapist_id: string;
  date: string;
  content: string;
  amount: number;
  is_resolved: boolean;
  therapists: { name: string } | null;
}

export default function MemosPage() {
  const { selectedShop } = useShop();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMemos = async () => {
    if (!selectedShop) return;
    setLoading(true);
    const { data } = await supabase
      .from('therapist_memos')
      .select('id, therapist_id, date, content, amount, is_resolved, therapists(name)')
      .eq('shop_id', selectedShop.id)
      .order('is_resolved', { ascending: true })
      .order('date', { ascending: false });
    setMemos((data || []) as unknown as Memo[]);
    setLoading(false);
  };

  useEffect(() => { fetchMemos(); }, [selectedShop]);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    await supabase.from('therapist_memos').update({ is_resolved: true }).eq('id', id);
    await fetchMemos();
    setResolvingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このメモを削除しますか？この操作は元に戻せません。')) return;
    setDeletingId(id);
    await supabase.from('therapist_memos').delete().eq('id', id);
    await fetchMemos();
    setDeletingId(null);
  };

  const unresolved = memos.filter(m => !m.is_resolved);
  const resolved = memos.filter(m => m.is_resolved);

  const unresolvedTotal = unresolved.reduce((sum, m) => sum + (m.amount || 0), 0);

  const MemoCard = ({ memo }: { memo: Memo }) => {
    const isPositive = memo.amount > 0;
    const isNegative = memo.amount < 0;
    const therapistName = memo.therapists?.name ?? '不明';

    return (
      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${memo.is_resolved ? 'border-slate-100 opacity-70' : 'border-slate-200 hover:shadow-md hover:border-indigo-100'}`}>
        <div className="p-4 flex items-start gap-3">
          {/* アバター */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 ${memo.is_resolved ? 'bg-slate-100 text-slate-400' : 'bg-indigo-100 text-indigo-600'}`}>
            {therapistName[0]}
          </div>

          {/* コンテンツ */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`font-bold text-sm ${memo.is_resolved ? 'text-slate-500' : 'text-slate-800'}`}>{therapistName}</span>
              <span className="text-xs text-slate-400">{memo.date}</span>
              {memo.is_resolved && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">精算済み</span>
              )}
            </div>
            <p className={`text-sm leading-relaxed ${memo.is_resolved ? 'text-slate-400' : 'text-slate-600'}`}>{memo.content}</p>
          </div>

          {/* 金額 */}
          {memo.amount !== 0 && (
            <div className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-bold ${
              isPositive ? 'bg-blue-50 text-blue-700 border border-blue-100' :
              isNegative ? 'bg-rose-50 text-rose-700 border border-rose-100' :
              'bg-slate-50 text-slate-600'
            }`}>
              {isPositive ? '+' : ''}{memo.amount.toLocaleString()}円
            </div>
          )}
        </div>

        {/* アクションバー */}
        {!memo.is_resolved && (
          <div className="px-4 pb-4 flex justify-end gap-2">
            <button
              onClick={() => handleDelete(memo.id)}
              disabled={deletingId === memo.id}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-all disabled:opacity-50"
            >
              削除
            </button>
            <button
              onClick={() => handleResolve(memo.id)}
              disabled={resolvingId === memo.id}
              className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 active:scale-95 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm shadow-emerald-200"
            >
              {resolvingId === memo.id ? (
                <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />処理中...</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>精算済みにする</>
              )}
            </button>
          </div>
        )}
        {memo.is_resolved && (
          <div className="px-4 pb-3 flex justify-end">
            <button
              onClick={() => handleDelete(memo.id)}
              disabled={deletingId === memo.id}
              className="px-3 py-1 text-xs font-medium text-slate-300 hover:text-rose-400 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-50"
            >
              削除
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">給与引継ぎメモ</h1>
          <p className="text-sm text-slate-500 mt-1">給与の過不足を記録し、精算状況を管理します。</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* 未精算セクション */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </span>
                    未精算
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{unresolved.length}件</span>
                </div>
                {unresolved.length > 0 && unresolvedTotal !== 0 && (
                  <div className={`px-3 py-1.5 rounded-xl text-sm font-bold ${unresolvedTotal > 0 ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                    合計 {unresolvedTotal > 0 ? '+' : ''}{unresolvedTotal.toLocaleString()}円
                  </div>
                )}
              </div>

              {unresolved.length > 0 ? (
                <div className="space-y-3">
                  {unresolved.map(memo => <MemoCard key={memo.id} memo={memo} />)}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 py-12 flex flex-col items-center gap-2">
                  <svg className="w-10 h-10 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-slate-500 font-medium">未精算のメモはありません</p>
                </div>
              )}
            </div>

            {/* 精算済みセクション */}
            {resolved.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-base font-bold text-slate-500 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </span>
                    精算済み
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">{resolved.length}件</span>
                </div>
                <div className="space-y-3">
                  {resolved.map(memo => <MemoCard key={memo.id} memo={memo} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
