'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../../lib/supabase';
import { useShop } from '../../../../contexts/ShopContext';
import { uploadBlogImage } from '../../../../../lib/storage';
import { RichTextEditor } from '../../../../../components/editor/RichTextEditor';
import { Therapist } from '../../../../../types/store';

function NewBlogForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTherapistId = searchParams.get('therapistId') || '';
  const { selectedShop } = useShop();

  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [therapistId, setTherapistId] = useState<string>(initialTherapistId);
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [tagsInput, setTagsInput] = useState<string>('出勤情報, 日記');
  const [eyeCatchUrl, setEyeCatchUrl] = useState<string>('');
  const [uploadingEyeCatch, setUploadingEyeCatch] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        if (!therapistId) {
          setTherapistId(mapped[0].id);
        }
      } else {
        setTherapists([]);
        setTherapistId('');
      }
    }
    fetchStoreTherapists();
  }, [selectedShop, therapistId]);


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

  const handleSave = async (isPublished: boolean) => {
    if (!title.trim()) {
      alert('タイトルを入力してください。');
      return;
    }
    if (!content.trim()) {
      alert('本文を入力してください。');
      return;
    }
    if (!therapistId) {
      alert('セラピストが選択されていません。');
      return;
    }

    setSaving(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const shopId = selectedShop?.id || 'a628f5ad-3bda-442f-9cfe-c5c00c3e65c1';

      const { error } = await supabase.from('blog_articles').insert({
        shop_id: shopId,
        therapist_id: therapistId,
        title,
        content,
        eye_catch_url: eyeCatchUrl || null,
        tags,
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null,
      });


      if (error) throw error;

      alert(isPublished ? '記事を公開しました！' : '記事を下書き保存しました！');
      router.push('/therapist/blog');
    } catch (err) {
      console.error('Failed to save article:', err);
      alert('記事の保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/therapist/blog"
          className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1"
        >
          ← 記事一覧に戻る
        </Link>
        <span className="text-xs text-rose-300 font-bold">✨ 新規日記の作成</span>
      </div>

      <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 sm:p-8 shadow-xl space-y-6">
        <h1 className="text-xl font-bold text-white border-b border-slate-700 pb-4">
          新しい日記・ブログを投稿する
        </h1>

        {/* セラピスト選択 */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">
            投稿者（セラピスト） <span className="text-rose-400">*</span>
          </label>
          <select
            value={therapistId}
            onChange={(e) => setTherapistId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs font-bold text-rose-300 focus:outline-none focus:border-rose-500"
          >
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.age}歳)
              </option>
            ))}
          </select>
        </div>

        {/* タイトル */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">
            記事タイトル <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            placeholder="例: 本日も出勤しています♡ 新しいオイル入荷しました！"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
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
                <span className="text-[10px] mt-1">{uploadingEyeCatch ? '受取中...' : '画像選択'}</span>
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
            placeholder="例: 出勤情報, オイル紹介, 日記"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
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
            onClick={() => handleSave(false)}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-600 transition-colors disabled:opacity-50"
          >
            ✏️ 下書きとして保存 (非公開)
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(true)}
            className="px-8 py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
          >
            🚀 公開する
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewBlogPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-8 font-sans">
      <Suspense fallback={<div className="text-xs text-slate-400 p-8 text-center">読み込み中...</div>}>
        <NewBlogForm />
      </Suspense>
    </div>
  );
}
