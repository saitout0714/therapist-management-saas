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
  const [activeTab, setActiveTab] = useState<'profile' | 'banners' | 'news' | 'recruit'>('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [shopId, setShopId] = useState<string>('')
  const [shopSlug, setShopSlug] = useState<string>('')
  const [shopName, setShopName] = useState('')

  // 店舗HP基本情報
  const [profileForm, setProfileForm] = useState({
    name: '',
    short_name: '',
    phone: '',
    hp_url: '',
    business_hours: '',
    address: '',
    access_info: '',
    google_map_url: '',
    catchphrase: '',
    description: '',
    notice_banner: '',
    line_url: '',
    x_url: '',
    litlink_url: '',
    terms_of_service: '',
  })

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
  // 編集中のトピックスID。null なら新規投稿モード。
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null)

  // 求人情報入力
  const [recruitForm, setRecruitForm] = useState({
    title: 'セラピスト求人募集',
    catchphrase: '🐾 地域最高水準のバック率 ＆ 全額日払い対応 🐾',
    description: 'ノルマ・ペナルティ一切なし！アットホームで快適な完全個室マンションルーム完備。',
    job_type: 'アロマセラピスト・トリートメント施術',
    qualification: '18歳以上（高校生不可）、未経験者大歓迎！',
    salary: '日給 30,000円 ～ 80,000円可能（全額日払いOK）',
    hours: '12:00 ～ 翌5:00 (週1日・3時間～OKの自由シフト制)',
    notes: '',
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
          .select('id, name, slug, short_name, phone, hp_url, business_hours, address, access_info, google_map_url, catchphrase, description, notice_banner, line_url, x_url, litlink_url, terms_of_service, recruit_info')
          .eq('id', selectedShop.id)
          .single()

        if (fetchErr) throw fetchErr

        if (shopData) {
          setShopId(shopData.id)
          setShopSlug(shopData.slug || shopData.short_name || 'specialgrade')
          setShopName(shopData.name || '')

          setProfileForm({
            name: shopData.name || '',
            short_name: shopData.short_name || '',
            phone: shopData.phone || '',
            hp_url: shopData.hp_url || '',
            business_hours: shopData.business_hours || '',
            address: shopData.address || '',
            access_info: shopData.access_info || '',
            google_map_url: (shopData as any).google_map_url || '',
            catchphrase: shopData.catchphrase || '',
            description: shopData.description || '',
            notice_banner: (shopData as any).notice_banner || '',
            line_url: shopData.line_url || '',
            x_url: shopData.x_url || '',
            litlink_url: shopData.litlink_url || '',
            terms_of_service: (shopData as any).terms_of_service || '',
          })

          if ((shopData as any).recruit_info) {
            const r = (shopData as any).recruit_info
            setRecruitForm({
              title: r.title || 'セラピスト求人募集',
              catchphrase: r.catchphrase || '🐾 地域最高水準のバック率 ＆ 全額日払い対応 🐾',
              description: r.description || 'ノルマ・ペナルティ一切なし！アットホームで快適な完全個室マンションルーム完備。',
              job_type: r.job_type || r.jobType || 'アロマセラピスト・トリートメント施術',
              qualification: r.qualification || '18歳以上（高校生不可）、未経験者大歓迎！',
              salary: r.salary || '日給 30,000円 ～ 80,000円可能（全額日払いOK）',
              hours: r.hours || '12:00 ～ 翌5:00 (週1日・3時間～OKの自由シフト制)',
              notes: r.notes || '',
            })
          }

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

  // 店舗HP基本情報保存
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shopId) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { error: err } = await supabase
        .from('shops')
        .update({
          name: profileForm.name,
          short_name: profileForm.short_name.trim() || null,
          phone: profileForm.phone.trim() || null,
          hp_url: profileForm.hp_url.trim() || null,
          business_hours: profileForm.business_hours.trim() || null,
          address: profileForm.address.trim() || null,
          access_info: profileForm.access_info.trim() || null,
          google_map_url: profileForm.google_map_url.trim() || null,
          catchphrase: profileForm.catchphrase.trim() || null,
          description: profileForm.description || null,
          notice_banner: profileForm.notice_banner.trim() || null,
          line_url: profileForm.line_url.trim() || null,
          x_url: profileForm.x_url.trim() || null,
          litlink_url: profileForm.litlink_url.trim() || null,
          terms_of_service: profileForm.terms_of_service.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shopId)

      if (err) throw err
      setSuccess('店舗HP基本情報を保存し、HPへ反映しました！')
    } catch (err: any) {
      setError('保存に失敗しました: ' + (err.message || '不明なエラー'))
    } finally {
      setSaving(false)
    }
  }

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

  // トピックス投稿・更新（editingNewsId が立っていれば更新、無ければ新規投稿）
  const handleSaveNews = async () => {
    if (!newNews.title || !newNews.content || !shopId) {
      alert('トピックスのタイトルと本文を入力してください。')
      return
    }

    if (editingNewsId) {
      try {
        const { data: updated, error: err } = await supabase
          .from('news_items')
          .update({
            title: newNews.title,
            content: newNews.content,
            category: newNews.category || 'お知らせ',
          })
          .eq('id', editingNewsId)
          .select()
          .single()

        if (err) throw err

        if (updated) {
          setNewsList((prev) => prev.map((n) => (n.id === editingNewsId ? updated : n)))
          handleCancelEditNews()
          alert('トピックスを更新しました！')
        }
      } catch (err: any) {
        alert('トピックス更新失敗: ' + err.message)
      }
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

  // トピックス編集開始（一覧の内容をフォームに読み込む）
  const handleEditNewsClick = (n: NewsItemData) => {
    setEditingNewsId(n.id || null)
    setNewNews({ title: n.title, content: n.content, category: n.category || 'お知らせ' })
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // トピックス編集キャンセル
  const handleCancelEditNews = () => {
    setEditingNewsId(null)
    setNewNews({ title: '', content: '', category: 'お知らせ' })
  }

  // トピックス削除
  const handleDeleteNews = async (newsId?: string) => {
    if (!newsId || !confirm('このトピックスを削除しますか？')) return
    const { error: err } = await supabase.from('news_items').delete().eq('id', newsId)
    if (!err) {
      setNewsList((prev) => prev.filter((n) => n.id !== newsId))
      if (editingNewsId === newsId) handleCancelEditNews()
    } else {
      alert('削除失敗: ' + err.message)
    }
  }

  // 求人情報保存
  const handleSaveRecruit = async () => {
    if (!shopId) return
    try {
      const { error: err } = await supabase
        .from('shops')
        .update({ recruit_info: recruitForm, updated_at: new Date().toISOString() })
        .eq('id', shopId)

      if (err) throw err
      alert('求人情報を保存し、HP求人ページ（/recruit）へ反映しました！')
    } catch (err: any) {
      alert('求人情報の保存失敗: ' + err.message)
    }
  }

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const isHpModeRequested = searchParams?.get('mode') === 'hp'
  const shopPlan = (selectedShop as any)?.plan || ''
  const shopHasHp = (selectedShop as any)?.has_hp ?? ['hp_web_reserve_plan', 'hp_web_agency_plan'].includes(shopPlan)

  if (isHpModeRequested && !shopHasHp && selectedShop) {
    return (
      <div className="max-w-3xl mx-auto my-12 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center font-sans space-y-4">
        <div className="text-4xl mb-2">🔒</div>
        <h2 className="text-lg font-bold text-slate-800">HPコンテンツ管理は未契約です</h2>
        <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
          現在ご利用中のプラン（{selectedShop.name}）では自店舗HPの独自コンテンツ編集機能が含まれておりません。
        </p>
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
          <div className="inline-block px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[11px] font-bold rounded-full mb-1">
            HPコンテンツ一元管理
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            HPコンテンツ管理{shopName && <span className="text-slate-400 font-medium text-base ml-2">{shopName}</span>}
          </h1>
          <p className="text-xs text-slate-500">
            ホームページに掲載される基本情報・コンセプト・告知バナー・画像スライダー・ニュース・求人を管理します
          </p>
        </div>
        {shopHasHp && (
          <a
            href={`/${shopSlug}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <span>🌐 自店舗HPをプレビュー表示 ↗</span>
          </a>
        )}
      </div>

      {/* タブナビゲーション */}
      {shopHasHp && (
        <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-3 font-bold text-xs border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            🌐 店舗HP基本情報・コンセプト・SNS
          </button>
          <button
            onClick={() => setActiveTab('banners')}
            className={`px-5 py-3 font-bold text-xs border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'banners'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            🖼️ メインバナー (${campaigns.length}件)
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`px-5 py-3 font-bold text-xs border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'news'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            📰 新着トピックス (${newsList.length}件)
          </button>
          <button
            onClick={() => setActiveTab('recruit')}
            className={`px-5 py-3 font-bold text-xs border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'recruit'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            🎀 セラピスト求人情報設定
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

      {/* タブ1: 店舗HP基本情報・コンセプト・SNS */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>🌐</span> 店舗HP基本掲載情報・コンセプト・SNS設定
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                HPの最上部告知バナー、キャッチコピー、紹介文、連絡先、住所、各種SNSリンクを管理できます。
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              {saving ? '保存中...' : '店舗HP情報を保存 💾'}
            </button>
          </div>

          <div className="space-y-4">
            {/* 1. 最上部お知らせ告知バナー */}
            <div className="bg-pink-50/70 border border-pink-200 rounded-xl p-4 space-y-2">
              <label className="block text-xs font-bold text-pink-900">
                📢 HP最上部・お知らせ告知バナーテロップ（全ページ共通）
              </label>
              <input
                type="text"
                value={profileForm.notice_banner}
                onChange={(e) => setProfileForm({ ...profileForm, notice_banner: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-pink-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-indigo-600 shadow-xs"
              />
              <p className="text-[11px] text-pink-700">HP全ページの最上部ヘッダーに固定表示される目立つ告知テロップです。</p>
            </div>

            {/* 2. キャッチコピー & コンセプト紹介本文 */}
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">キャッチコピー</label>
                <input
                  type="text"
                  value={profileForm.catchphrase}
                  onChange={(e) => setProfileForm({ ...profileForm, catchphrase: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  店舗コンセプト・紹介本文 (TOPページConceptに反映)
                </label>
                <textarea
                  rows={4}
                  value={profileForm.description}
                  onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                  placeholder="店舗のこだわりやコンセプトを入力してください。改行もそのままHPへ綺麗に反映されます。"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-800"
                />
              </div>
            </div>

            {/* 3. 連絡先 & 住所 & 営業時間 */}
            <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">店舗名</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">お問合せ電話番号</label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="例: 090-0000-0000"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">営業時間</label>
                <input
                  type="text"
                  value={profileForm.business_hours}
                  onChange={(e) => setProfileForm({ ...profileForm, business_hours: e.target.value })}
                  placeholder="例: OPEN/11:00～5:00 (受付/10:30〜2:00)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">住所 / エリア</label>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  placeholder="例: 東京都新宿区歌舞伎町"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">アクセス案内文 (Accessページ表示)</label>
                <input
                  type="text"
                  value={profileForm.access_info}
                  onChange={(e) => setProfileForm({ ...profileForm, access_info: e.target.value })}
                  placeholder="例: 新宿駅東口徒歩3分・渋谷駅ハチ公口徒歩4分"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Google Maps URL 📍</label>
                <input
                  type="text"
                  value={profileForm.google_map_url}
                  onChange={(e) => setProfileForm({ ...profileForm, google_map_url: e.target.value })}
                  placeholder="https://maps.google.com/..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            {/* 4. SNS各種リンク */}
            <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">公式LINE URL</label>
                <input
                  type="text"
                  value={profileForm.line_url}
                  onChange={(e) => setProfileForm({ ...profileForm, line_url: e.target.value })}
                  placeholder="https://line.me/R/ti/p/..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">X (旧Twitter) URL</label>
                <input
                  type="text"
                  value={profileForm.x_url}
                  onChange={(e) => setProfileForm({ ...profileForm, x_url: e.target.value })}
                  placeholder="https://x.com/..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            {/* 5. 利用規約・禁止事項 */}
            <div className="border-t pt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                利用規約・禁止事項 <span className="text-[11px] text-slate-400 font-normal">「システム・料金」ページの末尾に表示されます（未入力の場合は非表示）</span>
              </label>
              <textarea
                rows={10}
                value={profileForm.terms_of_service}
                onChange={(e) => setProfileForm({ ...profileForm, terms_of_service: e.target.value })}
                placeholder="利用規約や禁止事項の全文を入力してください。改行もそのままHPへ反映されます。"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-800 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {saving ? '保存中...' : '店舗HP情報を保存 💾'}
            </button>
          </div>
        </form>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">キャンペーンタイトル</label>
                <input
                  type="text"
                  value={newBanner.title}
                  onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                  placeholder="例: ★新規オープン記念！2,000円割引★"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">バッジテキスト</label>
                <input
                  type="text"
                  value={newBanner.badge_text}
                  onChange={(e) => setNewBanner({ ...newBanner, badge_text: e.target.value })}
                  placeholder="例: 期間限定 / NEW"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddBanner}
              className="btn-primary w-full py-2.5"
            >
              ＋ このバナーをスライドショーに登録
            </button>
          </div>

          {/* 既存バナー一覧 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2">🖼️ 現在登録中のバナースライドショー ({campaigns.length}件)</h2>
            {campaigns.length === 0 ? (
              <p className="text-xs text-slate-500">バナーは登録されていません。上記からバナーを追加してください。</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {campaigns.map((c) => (
                  <div key={c.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col justify-between">
                    <div>
                      <div className="aspect-[21/9] w-full bg-slate-900 overflow-hidden">
                        <img src={c.image_url} alt={c.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3">
                        <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-sm mb-1">
                          {c.badge_text || '公式'}
                        </span>
                        <div className="text-xs font-bold text-slate-800">{c.title}</div>
                      </div>
                    </div>
                    <div className="p-3 pt-0 text-right">
                      <button
                        onClick={() => handleDeleteBanner(c.id)}
                        className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-bold rounded-lg transition-all"
                      >
                        削除 ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* タブ3: 新着トピックス・ニュース管理 */}
      {activeTab === 'news' && (
        <div className="space-y-6">
          {/* 新規投稿 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2">
              {editingNewsId ? '✎ トピックスの編集' : '📝 新しいトピックス（お知らせ）の投稿'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">タイトル</label>
                <input
                  type="text"
                  value={newNews.title}
                  onChange={(e) => setNewNews({ ...newNews, title: e.target.value })}
                  placeholder="例: ★本日新人セラピストデビュー＆特別割引！"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">カテゴリー</label>
                <input
                  type="text"
                  value={newNews.category}
                  onChange={(e) => setNewNews({ ...newNews, category: e.target.value })}
                  placeholder="例: お知らせ / 新人情報"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">本文内容</label>
              <textarea
                rows={3}
                value={newNews.content}
                onChange={(e) => setNewNews({ ...newNews, content: e.target.value })}
                placeholder="トピックスの詳細テキストを入力してください..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-800"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveNews}
                className="btn-primary flex-1 py-2.5"
              >
                {editingNewsId ? '✎ トピックスを更新' : '＋ トピックスを投稿してHPへ即時反映'}
              </button>
              {editingNewsId && (
                <button
                  type="button"
                  onClick={handleCancelEditNews}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all"
                >
                  キャンセル
                </button>
              )}
            </div>
          </div>

          {/* 投稿済みトピックス一覧 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2">📰 投稿済みトピックス一覧 ({newsList.length}件)</h2>
            {newsList.length === 0 ? (
              <p className="text-xs text-slate-500">トピックスはありません。</p>
            ) : (
              <div className="space-y-3">
                {newsList.map((n) => (
                  <div key={n.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-sm">
                          {n.category || 'お知らせ'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {n.published_at ? n.published_at.slice(0, 10) : ''}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800">{n.title}</div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{n.content}</p>
                    </div>
                    <div className="shrink-0 flex gap-2">
                      <button
                        onClick={() => handleEditNewsClick(n)}
                        className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[11px] font-bold rounded-lg transition-all"
                      >
                        編集 ✎
                      </button>
                      <button
                        onClick={() => handleDeleteNews(n.id)}
                        className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-bold rounded-lg transition-all"
                      >
                        削除 ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* タブ4: セラピスト求人情報設定 */}
      {activeTab === 'recruit' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800">🎀 HP求人募集ページ（/recruit）表示コンテンツ編集</h2>
            <p className="text-xs text-slate-500 mt-0.5">求人ページのタイトル、バック率アピール、給与、シフトなどの情報を編集できます。</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">求人ページタイトル</label>
                <input
                  type="text"
                  value={recruitForm.title}
                  onChange={(e) => setRecruitForm({ ...recruitForm, title: e.target.value })}
                  placeholder="例: セラピスト求人募集"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">キャッチコピーバナー見出し</label>
                <input
                  type="text"
                  value={recruitForm.catchphrase}
                  onChange={(e) => setRecruitForm({ ...recruitForm, catchphrase: e.target.value })}
                  placeholder="例: 🐾 地域最高水準のバック率 ＆ 全額日払い対応 🐾"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">求人アピール説明文</label>
              <textarea
                rows={2}
                value={recruitForm.description}
                onChange={(e) => setRecruitForm({ ...recruitForm, description: e.target.value })}
                placeholder="例: ノルマ・ペナルティ一切なし！アットホームで快適な完全個室マンションルーム完備。"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">職種</label>
                <input
                  type="text"
                  value={recruitForm.job_type}
                  onChange={(e) => setRecruitForm({ ...recruitForm, job_type: e.target.value })}
                  placeholder="例: アロマセラピスト・トリートメント施術"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">応募資格</label>
                <input
                  type="text"
                  value={recruitForm.qualification}
                  onChange={(e) => setRecruitForm({ ...recruitForm, qualification: e.target.value })}
                  placeholder="例: 18歳以上（高校生不可）、未経験者大歓迎！"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">給与</label>
                <input
                  type="text"
                  value={recruitForm.salary}
                  onChange={(e) => setRecruitForm({ ...recruitForm, salary: e.target.value })}
                  placeholder="例: 日給 30,000円 ～ 80,000円可能（全額日払いOK）"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">勤務時間・シフト</label>
                <input
                  type="text"
                  value={recruitForm.hours}
                  onChange={(e) => setRecruitForm({ ...recruitForm, hours: e.target.value })}
                  placeholder="例: 12:00 ～ 翌5:00 (週1日・3時間～OKの自由シフト制)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">備考・アピール文</label>
              <input
                type="text"
                value={recruitForm.notes}
                onChange={(e) => setRecruitForm({ ...recruitForm, notes: e.target.value })}
                placeholder="例: 未経験の方でも丁寧な講習があるため安心してご応募ください。"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveRecruit}
              className="btn-primary w-full py-3 mt-2"
            >
              ＋ 求人要項を更新してHPへ即時反映
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
