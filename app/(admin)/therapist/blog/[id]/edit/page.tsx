'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../../../lib/supabase';
import { uploadBlogImage } from '../../../../../../lib/storage';
import { RichTextEditor } from '../../../../../../components/editor/RichTextEditor';

export default function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const articleId = resolvedParams.id;
  const router = useRouter();

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [therapistName, setTherapistName] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [eyeCatchUrl, setEyeCatchUrl] = useState<string>('');
  const [isPublished, setIsPublished] = useState<boolean>(true);
  const [uploadingEyeCatch, setUploadingEyeCatch] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadArticle() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('blog_articles')
          .select('*, therapists(name)')
          .eq('id', articleId)
          .single();

        if (error || !data) {
          alert('記事が見つかりませんでした。');
          router.push('/therapist/blog');
          return;
        }

        setTitle(data.title || '');
        setContent(data.content || '');
        setEyeCatchUrl(data.eye_catch_url || '');
        setIsPublished(data.is_published ?? true);
        setTagsInput(Array.isArray(data.tags) ? data.tags.join(', ') : '');
        setTherapistName(data.therapists?.name || 'セラピスト');
      } catch (err) {
        console.error('Error loading article:', err);
        alert('記事の読み込みに失敗しました。');
      } finally {
        setLoading(false);
      }
    }
    loadArticle();
  }, [articleId, router]);

  const handleEyeCatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingEyeCatch(true);
    try {
      const url = await uploadBlogImage(file);
      setEyeCatchUrl(url);
    } catch (err) {
      console.error('Eyecatch upload error:', err);
      alert('アイキャッチ画像のアップロードに失敗しました。');
    } finally {
      setUploadingEyeCatch(false);
    }
  };

  const handleUpdate = async (nextPublishStatus: boolean) => {
    if (!title.trim()) {
      alert('タイトルを入力してください。');
      return;
    }
    if (!content.trim()) {
      alert('本文を入力してください。');
      return;
    }

    setSaving(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from('blog_articles')
        .update({
          title,
          content,
          eye_catch_url: eyeCatchUrl || null,
          tags,
          is_published: nextPublishStatus,
          published_at: nextPublishStatus ? new Date().toISOString() : null,
        })
        .eq('id', articleId);

      if (error) throw error;

      alert('記事を更新しました！');
      router.push('/therapist/blog');
    } catch (err) {
      console.error('Failed to update article:', err);
      alert('記事の更新に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans flex items-center justify-center">
        <p className="text-xs text-slate-400">記事データを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/therapist/blog"
            className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1"
          >
            ← 記事一覧に戻る
          </Link>
          <span className="text-xs text-rose-300 font-bold">✏️ 日記の編集（{therapistName}）</span>
        </div>

        <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-700 pb-4">
            <h1 className="text-xl font-bold text-white">記事を編集する</h1>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                isPublished ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              現在の状態: {isPublished ? '公開中' : '下書き'}
            </span>
          </div>

          {/* タイトル */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300">
              記事タイトル <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* アイキャッチ画像 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300">アイキャッチ画像</label>
            <div className="flex items-center gap-4">
              {eyeCatchUrl ? (
                <div className="relative group">
                  <img
                    src={eyeCatchUrl}
                    alt="アイキャッチ"
                    className="w-24 h-24 rounded-xl object-cover border border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => setEyeCatchUrl('')}
                    className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-xl border border-dashed border-slate-600 bg-slate-950 flex flex-col items-center justify-center text-slate-400 hover:border-rose-500 cursor-pointer transition-colors"
                >
                  <span className="text-xl">📷</span>
                  <span className="text-[10px] mt-1">{uploadingEyeCatch ? '受取中...' : '画像変更'}</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleEyeCatchUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* タグ */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300">タグ（カンマ区切り）</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* 本文（リッチテキストエディタ） */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300">
              本文内容 <span className="text-rose-400">*</span>
            </label>
            <RichTextEditor value={content} onChange={setContent} />
          </div>

          {/* 送信アクション */}
          <div className="flex flex-col sm:flex-row gap-4 justify-end pt-4 border-t border-slate-700">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleUpdate(false)}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-600 transition-colors disabled:opacity-50"
            >
              ✏️ 下書きとして保存 (非公開)
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleUpdate(true)}
              className="px-8 py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
            >
              🚀 更新して公開する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
