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
  resolved_at?: string | null;
  resolved_date?: string | null;
  therapists: { name: string } | null;
}

interface MemoCardProps {
  memo: Memo;
  editingId: string | null;
  editForm: { content: string; amount: string };
  setEditForm: React.Dispatch<React.SetStateAction<{ content: string; amount: string }>>;
  updatingId: string | null;
  deletingId: string | null;
  resolvingId: string | null;
  handleResolve: (id: string) => Promise<void>;
  handleUnresolve: (id: string) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleEditStart: (memo: Memo) => void;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  handleUpdate: (id: string) => Promise<void>;
}

const MemoCard = ({
  memo,
  editingId,
  editForm,
  setEditForm,
  updatingId,
  deletingId,
  resolvingId,
  handleResolve,
  handleUnresolve,
  handleDelete,
  handleEditStart,
  setEditingId,
  handleUpdate,
}: MemoCardProps) => {
  const isPositive = memo.amount > 0;
  const isNegative = memo.amount < 0;
  const therapistName = memo.therapists?.name ?? '不明';
  const isEditing = editingId === memo.id;

  if (isEditing) {
    return (
      <div className="bg-white rounded-2xl border border-indigo-200 shadow-md p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            引き継ぎメモを編集
          </span>
          <span className="text-xs text-slate-400">{memo.date} - {therapistName}</span>
        </div>
        <textarea
          value={editForm.content}
          onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
          rows={2}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none"
          placeholder="メモ内容を入力してください"
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={editForm.amount}
              onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
              className="w-28 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
              placeholder="金額"
            />
            <span className="text-xs text-slate-500">円 (正=余剰 / 負=不足)</span>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditingId(null)}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
            >
              キャンセル
            </button>
            <button
              onClick={() => handleUpdate(memo.id)}
              disabled={updatingId === memo.id || !editForm.content.trim()}
              className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-lg transition-all disabled:opacity-50"
            >
              {updatingId === memo.id ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100 flex-shrink-0">精算済み</span>
                {memo.resolved_date && (
                  <span className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
                    {memo.resolved_date.replace(/-/g, '/')}の報酬で精算
                  </span>
                )}
                {memo.resolved_at && (
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    (処理日: {new Date(memo.resolved_at).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })})
                  </span>
                )}
              </div>
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
            onClick={() => handleEditStart(memo)}
            className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-transparent rounded-lg transition-all"
          >
            編集
          </button>
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
        <div className="px-4 pb-3 flex justify-end gap-2">
          <button
            onClick={() => handleUnresolve(memo.id)}
            disabled={resolvingId === memo.id}
            className="px-3 py-1 text-xs font-medium text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-all"
          >
            {resolvingId === memo.id ? '処理中...' : '未精算に戻す'}
          </button>
          <button
            onClick={() => handleEditStart(memo)}
            className="px-3 py-1 text-xs font-medium text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
          >
            編集
          </button>
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

export default function MemosPage() {
  const { selectedShop } = useShop();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 編集用の状態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ content: string; amount: string }>({ content: '', amount: '' });
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchMemos = async () => {
    if (!selectedShop) return;
    setLoading(true);
    const { data } = await supabase
      .from('therapist_memos')
      .select('id, therapist_id, date, content, amount, is_resolved, resolved_at, resolved_date, therapists(name)')
      .eq('shop_id', selectedShop.id)
      .order('is_resolved', { ascending: true })
      .order('date', { ascending: false });
    setMemos((data || []) as unknown as Memo[]);
    setLoading(false);
  };

  useEffect(() => { fetchMemos(); }, [selectedShop]);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    await supabase.from('therapist_memos').update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_date: null
    }).eq('id', id);
    await fetchMemos();
    setResolvingId(null);
  };

  const handleUnresolve = async (id: string) => {
    setResolvingId(id);
    await supabase.from('therapist_memos').update({
      is_resolved: false,
      resolved_at: null,
      resolved_date: null
    }).eq('id', id);
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

  const handleEditStart = (memo: Memo) => {
    setEditingId(memo.id);
    setEditForm({
      content: memo.content ?? '',
      amount: memo.amount != null ? String(memo.amount) : ''
    });
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.content.trim()) return;
    setUpdatingId(id);
    const { error } = await supabase
      .from('therapist_memos')
      .update({
        content: editForm.content.trim(),
        amount: parseInt(editForm.amount || '0', 10) || 0
      })
      .eq('id', id);
    setUpdatingId(null);
    if (error) {
      alert('メモの更新に失敗しました: ' + error.message);
    } else {
      setEditingId(null);
      await fetchMemos();
    }
  };

  const unresolved = memos.filter(m => !m.is_resolved);
  const resolved = memos.filter(m => m.is_resolved);

  const unresolvedTotal = unresolved.reduce((sum, m) => sum + (m.amount || 0), 0);

  return (
    <div className="bg-gray-100 p-4 md:p-4">
      <div className="max-w-3xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">報酬引継ぎメモ</h1>
          <p className="text-sm text-slate-500 mt-1">報酬の過不足を記録し、精算状況を管理します。</p>
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
                  {unresolved.map(memo => (
                    <MemoCard
                      key={memo.id}
                      memo={memo}
                      editingId={editingId}
                      editForm={editForm}
                      setEditForm={setEditForm}
                      updatingId={updatingId}
                      deletingId={deletingId}
                      resolvingId={resolvingId}
                      handleResolve={handleResolve}
                      handleUnresolve={handleUnresolve}
                      handleDelete={handleDelete}
                      handleEditStart={handleEditStart}
                      setEditingId={setEditingId}
                      handleUpdate={handleUpdate}
                    />
                  ))}
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
                  {resolved.map(memo => (
                    <MemoCard
                      key={memo.id}
                      memo={memo}
                      editingId={editingId}
                      editForm={editForm}
                      setEditForm={setEditForm}
                      updatingId={updatingId}
                      deletingId={deletingId}
                      resolvingId={resolvingId}
                      handleResolve={handleResolve}
                      handleUnresolve={handleUnresolve}
                      handleDelete={handleDelete}
                      handleEditStart={handleEditStart}
                      setEditingId={setEditingId}
                      handleUpdate={handleUpdate}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
