'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTherapistAuth } from '@/contexts/TherapistAuthContext';
import { supabase } from '@/lib/supabase';

export default function EditTherapistBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const blogId = resolvedParams.id;
  const router = useRouter();
  const { therapist, loading: authLoading } = useTherapistAuth();

  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !therapist) {
      router.push('/therapist/login');
    }
  }, [therapist, authLoading, router]);

  useEffect(() => {
    async function loadBlog() {
      if (!therapist || !blogId) return;
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('therapist_blogs')
        .select('*')
        .eq('id', blogId)
        .eq('therapist_id', therapist.id)
        .single();

      if (fetchErr || !data) {
        setError('記事の読み込みに失敗しました。');
      } else {
        setTitle(data.title);
        setContent(data.content);
        setImageUrl(data.image_url || '');
      }
      setLoading(false);
    }
    loadBlog();
  }, [therapist, blogId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !therapist) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `blogs/${therapist.id}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('therapist-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from('therapist-photos')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setImageUrl(publicUrlData.publicUrl);
      }
    } catch (err: any) {
      alert('画像のアップロードに失敗しました: ' + (err.message || 'エラー'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!therapist) return;

    if (!title.trim() || !content.trim()) {
      setError('タイトルと本文を入力してください。');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { error: updateErr } = await supabase
        .from('therapist_blogs')
        .update({
          title: title.trim(),
          content: content.trim(),
          image_url: imageUrl.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', blogId)
        .eq('therapist_id', therapist.id);

      if (updateErr) throw updateErr;

      router.push('/therapist/blog');
    } catch (err: any) {
      setError('更新に失敗しました: ' + (err.message || 'エラー'));
      setSaving(false);
    }
  };

  if (authLoading || !therapist || loading) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center text-stone-200 font-serif">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d1b464]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-serif flex flex-col">
      <header className="bg-stone-900 border-b border-stone-800 p-4 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/therapist/blog"
            className="text-xs text-stone-400 hover:text-stone-200 flex items-center gap-1"
          >
            ← 一覧に戻る
          </Link>
          <h1 className="font-bold text-sm text-stone-100">写メ日記の編集</h1>
          <div className="w-12" />
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4">
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 写真添付 */}
            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1.5">
                写真（アイキャッチ）画像
              </label>
              <div className="space-y-3 bg-stone-950 p-4 rounded-xl border border-stone-800">
                {imageUrl && (
                  <div className="relative w-full h-48 bg-stone-900 rounded-lg overflow-hidden border border-stone-700">
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-2 right-2 px-2.5 py-1 bg-rose-600 text-white text-xs font-bold rounded shadow"
                    >
                      削除
                    </button>
                  </div>
                )}

                <label className="cursor-pointer block text-center px-4 py-3 bg-stone-800 hover:bg-stone-700 text-[#d1b464] border border-[#d1b464]/40 font-bold text-xs rounded-xl shadow-md transition-all">
                  {uploading ? 'アップロード中...' : '📸 変更する写真を選択'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* タイトル */}
            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1.5">
                ブログタイトル <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 focus:border-[#d1b464] outline-none text-sm font-sans"
                required
              />
            </div>

            {/* 本文 */}
            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1.5">
                日記本文 <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-4 py-3 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 focus:border-[#d1b464] outline-none text-sm font-sans leading-relaxed"
                required
              />
            </div>

            {/* ボタン */}
            <div className="flex gap-3 pt-2">
              <Link
                href="/therapist/blog"
                className="flex-1 py-3 text-center bg-stone-800 text-stone-300 text-xs font-bold rounded-xl border border-stone-700"
              >
                キャンセル
              </Link>
              <button
                type="submit"
                disabled={saving || uploading}
                className="flex-1 py-3 bg-gradient-to-r from-[#d1b464] to-[#a39573] hover:from-[#c2a353] text-stone-950 font-bold text-xs tracking-wider rounded-xl shadow-lg transition-all disabled:opacity-50"
              >
                {saving ? '保存中...' : '変更を保存する'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
