'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTherapistAuth } from '@/contexts/TherapistAuthContext';
import { supabase } from '@/lib/supabase';

interface BlogPost {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  created_at: string;
  is_published: boolean;
}

export default function TherapistBlogListPage() {
  const router = useRouter();
  const { therapist, loading: authLoading, logout } = useTherapistAuth();

  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!authLoading && !therapist) {
      router.push('/therapist/login');
    }
  }, [therapist, authLoading, router]);

  useEffect(() => {
    async function loadBlogs() {
      if (!therapist) return;
      setLoading(true);
      const { data } = await supabase
        .from('therapist_blogs')
        .select('*')
        .eq('therapist_id', therapist.id)
        .order('created_at', { ascending: false });

      if (data) {
        setBlogs(data);
      }
      setLoading(false);
    }
    loadBlogs();
  }, [therapist]);

  const handleDelete = async (id: string) => {
    if (!confirm('この写メ日記・ブログを削除してもよろしいですか？')) return;

    const { error } = await supabase.from('therapist_blogs').delete().eq('id', id);
    if (!error) {
      setBlogs((prev) => prev.filter((b) => b.id !== id));
    } else {
      alert('削除に失敗しました: ' + error.message);
    }
  };

  if (authLoading || !therapist) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center text-stone-200 font-serif">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d1b464]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-serif flex flex-col">
      {/* ヘッダー */}
      <header className="bg-stone-900 border-b border-stone-800 p-4 sticky top-0 z-50 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {therapist.avatarUrl && (
              <img
                src={therapist.avatarUrl}
                alt={therapist.name}
                className="w-10 h-10 rounded-full object-cover border border-[#d1b464]"
              />
            )}
            <div>
              <h1 className="font-bold text-sm sm:text-base text-stone-100">{therapist.name} さん</h1>
              <p className="text-[11px] text-stone-400">写メ日記・ブログ投稿管理</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              router.push('/therapist/login');
            }}
            className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold rounded-lg border border-stone-700 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* タブナビゲーション */}
      <div className="bg-stone-900/60 border-b border-stone-800/80">
        <div className="max-w-3xl mx-auto flex">
          <Link
            href="/therapist/schedule"
            className="flex-1 text-center py-3 text-xs font-bold text-stone-400 hover:text-stone-200 transition-colors"
          >
            📅 出勤希望提出
          </Link>
          <Link
            href="/therapist/blog"
            className="flex-1 text-center py-3 text-xs font-bold text-[#d1b464] border-b-2 border-[#d1b464] bg-stone-900/40"
          >
            ✏️ 写メ日記・ブログ
          </Link>
        </div>
      </div>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-5">
        
        {/* 新規投稿ボタン */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-100">投稿した写メ日記一覧</h2>
          <Link
            href="/therapist/blog/new"
            className="px-4 py-2.5 bg-gradient-to-r from-[#d1b464] to-[#a39573] hover:from-[#c2a353] text-stone-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新規日記を投稿する
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#d1b464]" />
          </div>
        ) : blogs.length === 0 ? (
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 text-center space-y-3">
            <p className="text-stone-400 text-sm">まだ投稿した写メ日記はありません。</p>
            <Link
              href="/therapist/blog/new"
              className="inline-block px-5 py-2.5 bg-[#d1b464] text-stone-950 font-bold text-xs rounded-xl shadow-md"
            >
              最初の写メ日記を書く 📸
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {blogs.map((b) => (
              <div
                key={b.id}
                className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row gap-4 justify-between items-start"
              >
                {b.image_url && (
                  <div className="w-full sm:w-32 h-32 bg-stone-950 rounded-xl overflow-hidden shrink-0 border border-stone-800">
                    <img src={b.image_url} alt={b.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-stone-400">
                      {new Date(b.created_at).toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {b.is_published ? (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded">
                        公開中
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-stone-700 text-stone-300 text-[10px] font-bold rounded">
                        下書き
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-base text-stone-100 truncate">{b.title}</h3>
                  <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed whitespace-pre-wrap">
                    {b.content}
                  </p>
                </div>
                <div className="flex sm:flex-col gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-800">
                  <Link
                    href={`/therapist/blog/${b.id}/edit`}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold text-center rounded-lg border border-stone-700 transition-colors"
                  >
                    編集
                  </Link>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold text-center rounded-lg border border-rose-500/30 transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
