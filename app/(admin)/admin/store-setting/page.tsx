'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/contexts/AuthContext'
import { useShop } from '@/app/contexts/ShopContext'

interface CampaignItem {
  id?: string
  title: string
  description?: string
  image_url: string
  link_url?: string
  badge_text?: string
  display_order?: number
}

interface NewsItemData {
  id?: string
  title: string
  content: string
  category?: string
  published_at?: string
}

export default function OwnerStoreSettingPage() {
  const { user } = useAuth()
  const { selectedShop } = useShop()
  const [activeTab, setActiveTab] = useState<'banners' | 'news'>('banners')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [shopId, setShopId] = useState<string>('')
  const [shopSlug, setShopSlug] = useState<string>('')

  // 店舗名（見出し表示用）。基本情報の編集は「店舗 ＆ システム設定」に集約した
  const [shopName, setShopName] = useState('')

  // メインバナー一覧＆入力
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([])
  const [newBanner, setNewBanner] = useState<CampaignItem>({
    title: '',
    description: '',
    image_url: '',
    badge_text: '公式',
    link_url: '',
  })
  const [uploadingBanner, setUploadingBanner] = useState(false)

  // トピックス/ニュース一覧＆入力
  const [newsList, setNewsList] = useState<NewsItemData[]>([])
  const [newNews, setNewNews] = useState<NewsItemData>({
    title: '',
    content: '',
    category: 'お知らせ',
  })

  useEffect(() => {
    async function loadOwnerShopData() {
      if (!selectedShop) return
      setLoading(true)
      setError('')

      try {
        // 選択中店舗の最新プロファイルを取得
        const { data: shopData, error: fetchErr } = await supabase
          .from('shops')
          .select('id, name, slug, short_name')
          .eq('id', selectedShop.id)
          .single()

        if (fetchErr) throw fetchErr

        if (shopData) {
          setShopId(shopData.id)
          setShopSlug(shopData.slug || shopData.short_name || 'specialgrade')
          setShopName(shopData.name || '')

          // 2. メインバナー一覧 (campaigns)
          const { data: campData } = await supabase
            .from('campaigns')
            .select('*')
            .eq('shop_id', shopData.id)
            .order('display_order', { ascending: true })

          if (campData) setCampaigns(campData)

          // 3. トピックス一覧 (news_items)
          const { data: newsData } = await supabase
            .from('news_items')
            .select('*')
            .eq('shop_id', shopData.id)
            .order('published_at', { ascending: false })

          if (newsData) setNewsList(newsData)
        }
      } catch (err: any) {
        setError('店舗データの読み込みに失敗しました: ' + err.message)
      } finally {
        setLoading(false)
      }
    }

    loadOwnerShopData()
  }, [selectedShop])

  // バナー画像アップロード
  const handleBannerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !shopId) return
    setUploadingBanner(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const filePath = `shops/${shopId}/banners/${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('therapist-photos')
        .upload(filePath, file, { upsert: true })

      if (uploadErr) throw uploadErr

      const { data: publicUrlData } = supabase.storage
        .from('therapist-photos')
        .getPublicUrl(filePath)

      if (publicUrlData?.publicUrl) {
        setNewBanner((prev) => ({ ...prev, image_url: publicUrlData.publicUrl }))
      }
    } catch (err: any) {
      alert('バナー画像のアップロードに失敗しました: ' + err.message)
    } finally {
      setUploadingBanner(false)
    }
  }

  // メインバナー追加
  const handleAddBanner = async () => {
    if (!newBanner.image_url || !shopId) {
      alert('バナー画像を選択してください。')
      return
    }

    try {
      const { data: created, error: err } = await supabase
        .from('campaigns')
        .insert([
          {
            shop_id: shopId,
            title: newBanner.title || 'イベント・キャンペーン',
            description: newBanner.description || '',
            image_url: newBanner.image_url,
            badge_text: newBanner.badge_text || '公式',
            link_url: newBanner.link_url || '',
            display_order: campaigns.length + 1,
            is_active: true,
          },
        ])
        .select()
        .single()

      if (err) throw err

      if (created) {
        setCampaigns((prev) => [...prev, created])
        setNewBanner({ title: '', description: '', image_url: '', badge_text: '公式', link_url: '' })
        alert('メインバナーを追加・HPへ反映しました！')
      }
    } catch (err: any) {
      alert('バナー追加失敗: ' + err.message)
    }
  }

  // バナー削除
  const handleDeleteBanner = async (bannerId?: string) => {
    if (!bannerId || !confirm('このバナーを削除してもよろしいですか？')) return
    const { error: err } = await supabase.from('campaigns').delete().eq('id', bannerId)
    if (!err) {
      setCampaigns((prev) => prev.filter((c) => c.id !== bannerId))
    } else {
      alert('削除失敗: ' + err.message)
    }
  }

  // トピックス追加
  const handleAddNews = async () => {
    if (!newNews.title || !newNews.content || !shopId) {
      alert('トピックスのタイトルと本文を入力してください。')
      return
    }

    try {
      const { data: created, error: err } = await supabase
        .from('news_items')
        .insert([
          {
            shop_id: shopId,
            title: newNews.title,
            content: newNews.content,
            category: newNews.category || 'お知らせ',
            is_published: true,
          },
        ])
        .select()
        .single()

      if (err) throw err

      if (created) {
        setNewsList((prev) => [created, ...prev])
        setNewNews({ title: '', content: '', category: 'お知らせ' })
        alert('トピックスを投稿・HPへ反映しました！')
      }
    } catch (err: any) {
      alert('トピックス追加失敗: ' + err.message)
    }
  }

  // トピックス削除
  const handleDeleteNews = async (newsId?: string) => {
    if (!newsId || !confirm('このトピックスを削除しますか？')) return
    const { error: err } = await supabase.from('news_items').delete().eq('id', newsId)
    if (!err) {
      setNewsList((prev) => prev.filter((n) => n.id !== newsId))
    } else {
      alert('削除失敗: ' + err.message)
    }
  }

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const isHpModeRequested = searchParams?.get('mode') === 'hp'
  const shopPlan = (selectedShop as any)?.plan || ''
  const shopHasHp = (selectedShop as any)?.has_hp ?? ['hp_web_reserve_plan', 'hp_web_agency_plan'].includes(shopPlan)

  // HP機能専用モードが要求されていて、かつ店舗がHP機能オフの場合のみガード画面を表示
  if (isHpModeRequested && !shopHasHp && selectedShop) {
    return (
      <div className="max-w-3xl mx-auto my-12 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center font-sans space-y-4">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
          🔒
        </div>
        <h1 className="text-lg font-bold text-slate-800">契約プラン対象外機能</h1>
        <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
          選択中の店舗<strong>「{selectedShop.name}」</strong>は、<strong>「代行単体プラン」</strong>のため「HPバナー・コンテンツ設定」機能は含まれておりません。<br />
          店舗基本情報・電話番号・アクセスの確認・変更は「店舗基本情報」メニューから行えます。
        </p>
        <div className="pt-2">
          <a href="/admin/store-setting?mode=basic" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all inline-block">
            店舗基本情報を開く
          </a>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mb-2" />
        <p>店舗管理設定を読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 font-sans space-y-6">
      
      {/* ページヘッダー */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-block px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full mb-1">
            店舗オーナー専用
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            HPコンテンツ管理{shopName && <span className="text-slate-400 font-medium text-base ml-2">{shopName}</span>}
          </h1>
          <p className="text-xs text-slate-500">
            ホームページに表示するメインバナーと新着トピックスを管理します
          </p>
        </div>
        {shopHasHp && (
          <a
            href={`/${shopSlug}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <span>🌐 自店舗HPをプレビュー表示</span>
          </a>
        )}
      </div>

      {/* 店舗名・電話・営業時間・SNS等は「店舗 ＆ システム設定」に集約した */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div>
          <p className="text-xs font-bold text-slate-700">店舗名・電話番号・営業時間・アクセス・SNSリンクの変更</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            これらの店舗基本情報は「店舗 ＆ システム設定」に集約しました。変更するとHPにも反映されます。
          </p>
        </div>
        <Link
          href="/system"
          className="shrink-0 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-all text-center"
        >
          店舗基本情報を開く
        </Link>
      </div>

      {/* タブナビゲーション（HP機能あり店舗のみサブタブを表示） */}
      {shopHasHp && (
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab('banners')}
            className={`px-5 py-3 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'banners'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            メインバナー・スライドショー ({campaigns.length}件)
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`px-5 py-3 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'news'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            新着トピックス・ニュース ({newsList.length}件)
          </button>
        </div>
      )}

      {/* メッセージ */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold">
          {success}
        </div>
      )}

      {/* タブ2: メインバナー・スライドショー管理 */}
      {activeTab === 'banners' && (
        <div className="space-y-6">
          {/* 新規バナー登録 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2">📸 新しいメインバナー画像の追加</h2>
            
            <div className="space-y-3">
              {newBanner.image_url && (
                <div className="w-full aspect-[21/9] bg-slate-900 rounded-xl overflow-hidden border border-slate-300">
                  <img src={newBanner.image_url} alt="Banner Preview" className="w-full h-full object-cover" />
                </div>
              )}

              <label className="cursor-pointer block text-center px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs rounded-xl hover:bg-amber-100 transition-all">
                {uploadingBanner ? 'アップロード中...' : '📂 写真を選択してバナーを追加'}
                <input type="file" accept="image/*" onChange={handleBannerFileUpload} disabled={uploadingBanner} className="hidden" />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">バナータイトル</label>
                <input
                  type="text"
                  value={newBanner.title}
                  onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                  placeholder="例: 当店ご利用初めてのお客様 はじめまして割 ¥1,000-off"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">バッジ表記</label>
                <input
                  type="text"
                  value={newBanner.badge_text}
                  onChange={(e) => setNewBanner({ ...newBanner, badge_text: e.target.value })}
                  placeholder="例: 初回限定 / LINE / 公式"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <button
              onClick={handleAddBanner}
              disabled={!newBanner.image_url || uploadingBanner}
              className="btn-primary w-full"
            >
              ＋ バナーを追加してスライドショーに反映
            </button>
          </div>

          {/* 登録済みバナー一覧 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800">現在HPに表示中のメインバナー一覧 ({campaigns.length}件)</h2>
            {campaigns.length === 0 ? (
              <p className="text-xs text-slate-400">登録されているメインバナーはありません。</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {campaigns.map((c) => (
                  <div key={c.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="aspect-[21/9] bg-slate-900 rounded-lg overflow-hidden border">
                        <img src={c.image_url} alt={c.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex items-center gap-2">
                        {c.badge_text && (
                          <span className="px-2 py-0.5 bg-amber-600 text-white text-[10px] font-bold rounded">
                            {c.badge_text}
                          </span>
                        )}
                        <h3 className="font-bold text-xs text-slate-800 truncate">{c.title}</h3>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteBanner(c.id)}
                      className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg border border-rose-200 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* タブ3: 新着トピックス管理 */}
      {activeTab === 'news' && (
        <div className="space-y-6">
          {/* 新規トピックス投稿 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2">📢 新しいトピックス・ニュースの投稿</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">タイトル *</label>
                <input
                  type="text"
                  value={newNews.title}
                  onChange={(e) => setNewNews({ ...newNews, title: e.target.value })}
                  placeholder="例: ホームページをリニューアルオープンいたしました！"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">カテゴリ</label>
                <input
                  type="text"
                  value={newNews.category}
                  onChange={(e) => setNewNews({ ...newNews, category: e.target.value })}
                  placeholder="例: お知らせ / イベント"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">詳細本文 *</label>
              <textarea
                rows={3}
                value={newNews.content}
                onChange={(e) => setNewNews({ ...newNews, content: e.target.value })}
                placeholder="トピックスの詳細文をここに入力します..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed"
              />
            </div>

            <button
              onClick={handleAddNews}
              disabled={!newNews.title || !newNews.content}
              className="btn-primary w-full"
            >
              ＋ トピックスを投稿してHPに反映
            </button>
          </div>

          {/* 登録済みトピックス一覧 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800">投稿済みトピックス一覧 ({newsList.length}件)</h2>
            {newsList.length === 0 ? (
              <p className="text-xs text-slate-400">投稿されているトピックスはありません。</p>
            ) : (
              <div className="space-y-3">
                {newsList.map((n) => (
                  <div key={n.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded">
                          {n.category || 'お知らせ'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {n.published_at ? n.published_at.slice(0, 10) : ''}
                        </span>
                      </div>
                      <h3 className="font-bold text-xs text-slate-800">{n.title}</h3>
                      <p className="text-xs text-slate-500 line-clamp-1">{n.content}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteNews(n.id)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg border border-rose-200 shrink-0 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
