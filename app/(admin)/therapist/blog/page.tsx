'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabase';
import { useShop } from '../../../contexts/ShopContext';
import { Therapist } from '../../../../types/store';

interface ArticleItem {
  id: string;
  therapist_id: string;
  title: string;
  content: string;
  eye_catch_url?: string;
  tags?: string[];
  is_published: boolean;
  published_at?: string;
  created_at?: string;
}

export default function TherapistBlogListPage() {
  const { selectedShop } = useShop();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchStoreTherapists() {
      let query = supabase.from('therapists').select('*').eq('is_active', true);
      if (selectedShop?.id) {
        query = query.eq('shop_id', selectedShop.id);
      }
      const { data } = await query;

      if (data && data.length > 0) {
        const mapped: Therapist[] = data.map((t: any) => ({
          id: t.id,
          name: t.name,
          age: t.age || 20,
          height: t.height || 160,
          bustCup: t.bust_cup || 'C',
          avatarUrl: t.avatar_url || t.photo_url || '',
          images: [],
          tags: Array.isArray(t.tags) ? t.tags : [],
          comment: t.comment || '',
        }));
        setTherapists(mapped);
        setSelectedTherapistId(mapped[0].id);
      } else {
        setTherapists([]);
        setSelectedTherapistId('');
      }
    }
    fetchStoreTherapists();
  }, [selectedShop]);


  useEffect(() => {
    if (!selectedTherapistId) return;
    loadArticles(selectedTherapistId);
  }, [selectedTherapistId]);

  async function loadArticles(therapistId: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blog_articles')
        .select('*')
        .eq('therapist_id', therapistId)
        .order('created_at', { ascending: false });

      if (error || !data) {
        setArticles([]);
      } else {
        setArticles(data);
      }
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }

  const handleTogglePublish = async (article: ArticleItem) => {
    const nextStatus = !article.is_published;
    const actionLabel = nextStatus ? '公開' : '下書きに変更';
    if (!confirm(`この記事を${actionLabel}しますか？`)) return;

    try {
      const { error } = await supabase
        .from('blog_articles')
        .update({
          is_published: nextStatus,
          published_at: nextStatus ? new Date().toISOString() : article.published_at,
        })
        .eq('id', article.id);

      if (error) throw error;

      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, is_published: nextStatus } : a))
      );
    } catch (err) {
      console.error('Failed to toggle publication status:', err);
      alert('ステータスの更新に失敗しました。');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この記事を削除してもよろしいですか？この操作は取り消せません。')) return;

    try {
      const { error } = await supabase.from('blog_articles').delete().eq('id', id);
      if (error) throw error;

      setArticles((prev) => prev.filter((a) => a.id !== id));
      alert('記事を削除しました。');
    } catch (err) {
      console.error('Failed to delete article:', err);
      alert('記事の削除に失敗しました。');
    }
  };

  const currentTherapist = therapists.find((t) => t.id === selectedTherapistId);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ヘッダー ＆ セラピスト切替 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/80 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-wide flex items-center gap-2">
              📝 セラピスト写メ日記・ブログ管理
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              自身が執筆したブログ記事の作成・下書き保存・公開切り替えができます。
            </p>
          </div>

          <Link
            href={`/therapist/blog/new?therapistId=${selectedTherapistId}`}
            className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5"
          >
            ✨ 新しい日記を投稿する
          </Link>
        </div>

        {/* ログイン中のセラピスト選択スコープ */}
        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {selectedShop && (
              <span className="bg-rose-950/80 text-rose-300 border border-rose-800/60 font-bold text-xs px-3 py-1 rounded-lg">
                🏪 対象店舗: {selectedShop.name}
              </span>
            )}
            <label className="text-xs font-bold text-slate-300">セラピスト選択:</label>
            <select
              value={selectedTherapistId}
              onChange={(e) => setSelectedTherapistId(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-rose-300 font-bold text-xs rounded-lg px-4 py-2 focus:outline-none focus:border-rose-500"
            >
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.age}歳)
                </option>
              ))}
            </select>
          </div>
          {currentTherapist && (
            <span className="text-xs text-slate-400">
              全 {articles.length} 件の記事
            </span>
          )}
        </div>


        {/* 記事一覧 */}
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-slate-800/30 rounded-2xl border border-slate-800">
              記事を読み込み中...
            </div>
          ) : articles.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-slate-800/30 rounded-2xl border border-slate-800 space-y-3">
              <p>まだ投稿された日記はありません。</p>
              <Link
                href={`/therapist/blog/new?therapistId=${selectedTherapistId}`}
                className="inline-block px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg"
              >
                最初の記事を書く →
              </Link>
            </div>
          ) : (
            articles.map((article) => (
              <div
                key={article.id}
                className="bg-slate-800/60 rounded-2xl border border-slate-700/60 p-5 shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {article.eye_catch_url && (
                    <img
                      src={article.eye_catch_url}
                      alt={article.title}
                      className="w-16 h-16 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                    />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          article.is_published
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {article.is_published ? '● 公開中' : '✏️ 下書き'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {article.published_at
                          ? new Date(article.published_at).toLocaleString('ja-JP', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '未公開'}
                      </span>
                    </div>

                    <h2 className="text-sm font-bold text-white line-clamp-1">
                      {article.title}
                    </h2>

                    <div className="text-xs text-slate-400 line-clamp-1">
                      {article.content.replace(/<[^>]*>/g, '')}
                    </div>
                  </div>
                </div>

                {/* 操作アクション */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleTogglePublish(article)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                      article.is_published
                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                    }`}
                  >
                    {article.is_published ? '下書きに戻す' : '公開する'}
                  </button>

                  <Link
                    href={`/therapist/blog/${article.id}/edit`}
                    className="px-3 py-1.5 text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg border border-slate-600 transition-colors"
                  >
                    編集
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleDelete(article.id)}
                    className="px-3 py-1.5 text-xs font-bold bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-lg border border-rose-800 transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
