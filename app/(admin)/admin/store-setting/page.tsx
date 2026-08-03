'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/contexts/AuthContext'

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
  const [activeTab, setActiveTab] = useState<'basic' | 'banners' | 'news'>('basic')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [shopId, setShopId] = useState<string>('')
  const [shopSlug, setShopSlug] = useState<string>('specialgrade')

  // 店舗基本情報フォーム
  const [form, setForm] = useState({
    name: '',
    short_name: '',
    catchphrase: '',
    description: '',
    phone: '',
    address: '',
    access_info: '',
    business_hours: '',
    google_map_url: '',
    line_url: '',
    x_url: '',
    litlink_url: '',
    notice_banner: '',
    logo_url: '',
    theme_color: '#d1b464',
    template_id: 'luxury',
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

  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    async function loadOwnerShopData() {
      setLoading(true)
      setError('')

      try {
        // SpecialGrade またはログイン中の所属店舗を取得
        let { data: shopData } = await supabase
          .from('shops')
          .select('*')
          .ilike('name', '%SpecialGrade%')
          .maybeSingle()

        if (!shopData) {
          const { data: firstShop } = await supabase
            .from('shops')
            .select('*')
            .limit(1)
            .single()
          shopData = firstShop
        }

        if (shopData) {
          setShopId(shopData.id)
          setShopSlug(shopData.slug || 'specialgrade')

          setForm({
            name: shopData.name || '',
            short_name: shopData.short_name || '',
            catchphrase: shopData.catchphrase || '',
            description: shopData.description || '',
            phone: shopData.phone || shopData.phone_number || '',
            address: shopData.address || '',
            access_info: shopData.access_info || '',
            business_hours: shopData.business_hours || '',
            google_map_url: shopData.google_map_url || shopData.google_maps_url || '',
            line_url: shopData.line_url || '',
            x_url: shopData.x_url || shopData.twitter_url || '',
            litlink_url: shopData.litlink_url || '',
            notice_banner: shopData.notice_banner || '',
            logo_url: shopData.logo_url || '',
            theme_color: typeof shopData.theme_color === 'string' ? shopData.theme_color : (shopData.theme_color?.primary || '#d1b464'),
            template_id: shopData.template_id || 'luxury',
          })

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
  }, [])

  // ロゴファイルアップロード
  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !shopId) return
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const filePath = `shops/${shopId}/logo_${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('therapist-photos')
        .upload(filePath, file, { upsert: true })

      if (uploadErr) throw uploadErr

      const { data: publicUrlData } = supabase.storage
        .from('therapist-photos')
        .getPublicUrl(filePath)

      if (publicUrlData?.publicUrl) {
        setForm((prev) => ({ ...prev, logo_url: publicUrlData.publicUrl }))
      }
    } catch (err: any) {
      alert('ロゴ画像の保存に失敗しました: ' + err.message)
    } finally {
      setUploadingLogo(false)
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

  // 店舗基本保存
  const handleSaveBasic = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shopId) return
    setSaving(true)
    setError('')
    setSuccess('')

    let updatePayload: any = {
      name: form.name,
      short_name: form.short_name.trim() || null,
      catchphrase: form.catchphrase.trim() || null,
      description: form.description || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      access_info: form.access_info.trim() || null,
      business_hours: form.business_hours.trim() || null,
      google_map_url: form.google_map_url.trim() || null,
      line_url: form.line_url.trim() || null,
      x_url: form.x_url.trim() || null,
      litlink_url: form.litlink_url.trim() || null,
      notice_banner: form.notice_banner.trim() || null,
      logo_url: form.logo_url.trim() || null,
      theme_color: form.theme_color.trim() || '#d1b464',
      template_id: form.template_id || 'luxury',
      updated_at: new Date().toISOString(),
    }

    let { error: updateError } = await supabase
      .from('shops')
      .update(updatePayload)
      .eq('id', shopId)

    if (updateError && (updateError.message.includes('template_id') || updateError.message.includes('logo_url'))) {
      delete updatePayload.template_id
      if (updateError.message.includes('logo_url')) {
        delete updatePayload.logo_url
        delete updatePayload.theme_color
      }
      const fallback = await supabase
        .from('shops')
        .update(updatePayload)
        .eq('id', shopId)
      updateError = fallback.error
    }

    if (updateError) {
      setSaving(false)
      setError('保存に失敗しました: ' + updateError.message)
      return
    }

    setSaving(false)
    setSuccess('✨ 店舗設定およびHPの表示内容を更新・保存しました！')
  }

  const isMaster = ['developer', 'system_admin'].includes(user?.role || '')

  if (!isMaster) {
    return (
      <div className="max-w-3xl mx-auto my-12 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center font-sans space-y-4">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
          🔒
        </div>
        <h1 className="text-lg font-bold text-slate-800">準備中・管理者制限機能</h1>
        <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
          「店舗情報 ＆ HP設定」機能は完成までマスター管理者のみに表示・制限されています。
          管理者以下・店舗アカウントからはアクセスできません。
        </p>
        <div className="pt-2">
          <Link href="/" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all inline-block">
            ホームに戻る
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-[#d1b464] border-t-transparent rounded-full mb-2" />
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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">HPコンテンツ & 店舗情報設定</h1>
          <p className="text-xs text-slate-500">店舗基本情報、バナー、トピックス、SNSリンクを自分でカンタンに変更できます</p>
        </div>
        <a
          href={`/${shopSlug}`}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 border border-amber-400/30"
        >
          <span>🌐 自店舗HPをプレビュー表示</span>
        </a>
      </div>

      {/* タブナビゲーション */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('basic')}
          className={`px-5 py-3 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'basic'
              ? 'border-[#d1b464] text-amber-700 bg-amber-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          🏬 店舗基本情報・SNS・デザイン
        </button>
        <button
          onClick={() => setActiveTab('banners')}
          className={`px-5 py-3 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'banners'
              ? 'border-[#d1b464] text-amber-700 bg-amber-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          🖼️ メインバナー・スライドショー ({campaigns.length}件)
        </button>
        <button
          onClick={() => setActiveTab('news')}
          className={`px-5 py-3 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'news'
              ? 'border-[#d1b464] text-amber-700 bg-amber-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          📢 新着トピックス・ニュース ({newsList.length}件)
        </button>
      </div>

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

      {/* タブ1: 店舗基本情報 & SNSリンク & コンセプト */}
      {activeTab === 'basic' && (
        <form onSubmit={handleSaveBasic} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2 tracking-wider">店舗プロフィール設定</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">店舗名 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">お問合せ電話番号</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="例: 070-1462-0389"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">キャッチコピー（HPメイン見出し）</label>
              <input
                type="text"
                value={form.catchphrase}
                onChange={(e) => setForm({ ...form, catchphrase: e.target.value })}
                placeholder="例: 赤羽・川口のメンズエステ SpecialGrade ～上質で優雅な至福の空間～"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">店舗コンセプト・紹介本文</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="最高級をお求めのお客様のために「技術」「ルックス」「性格」の三点を厳選して日本人女性を採用..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">営業時間</label>
                <input
                  type="text"
                  value={form.business_hours}
                  onChange={(e) => setForm({ ...form, business_hours: e.target.value })}
                  placeholder="例: OPEN/11:00～5:00 (受付/10:30〜2:00)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">アクセス案内文</label>
                <input
                  type="text"
                  value={form.access_info}
                  onChange={(e) => setForm({ ...form, access_info: e.target.value })}
                  placeholder="例: 赤羽駅徒歩2分・川口駅徒歩3分"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* SNS ＆ テロップ */}
          <div className="space-y-4 pt-2 border-t">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2 tracking-wider">SNS ＆ 告知テロップ</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">公式LINE URL</label>
                <input
                  type="text"
                  value={form.line_url}
                  onChange={(e) => setForm({ ...form, line_url: e.target.value })}
                  placeholder="https://line.me/R/ti/p/..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">X (旧Twitter) URL</label>
                <input
                  type="text"
                  value={form.x_url}
                  onChange={(e) => setForm({ ...form, x_url: e.target.value })}
                  placeholder="https://x.com/..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ヘッダー最上部・告知テロップ</label>
              <input
                type="text"
                value={form.notice_banner}
                onChange={(e) => setForm({ ...form, notice_banner: e.target.value })}
                placeholder="例: ✨ 赤羽・川口エリアで選ばれ続ける最高級メンズエステ ✨"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold text-amber-700"
              />
            </div>
          </div>

          {/* ロゴ ＆ テンプレート */}
          <div className="space-y-4 pt-2 border-t">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2 tracking-wider">デザイン ＆ ロゴ設定</h2>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">店舗ロゴ画像</label>
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {form.logo_url && (
                  <div className="flex items-center gap-4 bg-white p-3 rounded-lg border">
                    <img src={form.logo_url} alt="Logo" className="h-10 object-contain" />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, logo_url: '' })}
                      className="px-2.5 py-1 text-xs text-rose-600 bg-rose-50 rounded border border-rose-200"
                    >
                      削除
                    </button>
                  </div>
                )}
                <label className="cursor-pointer px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-[#d1b464] font-bold text-xs rounded-xl shadow-sm inline-block border border-[#d1b464]/40">
                  {uploadingLogo ? 'アップロード中...' : '📸 PC・スマホからロゴ画像を選択'}
                  <input type="file" accept="image/*" onChange={handleLogoFileUpload} disabled={uploadingLogo} className="hidden" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">デザインテンプレート</label>
                <select
                  value={form.template_id}
                  onChange={(e) => setForm({ ...form, template_id: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="luxury">✨ ラグジュアリーゴールド (SpecialGrade推奨)</option>
                  <option value="modern">🌙 ダークシック</option>
                  <option value="cute">🌸 キュート & スイート</option>
                  <option value="minimal">🍃 シンプル & 和モダン</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">テーマカラー (Hexコード)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.theme_color.startsWith('#') ? form.theme_color : '#d1b464'}
                    onChange={(e) => setForm({ ...form, theme_color: e.target.value })}
                    className="w-9 h-9 rounded border p-0.5"
                  />
                  <input
                    type="text"
                    value={form.theme_color}
                    onChange={(e) => setForm({ ...form, theme_color: e.target.value })}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-gradient-to-r from-[#d1b464] to-[#a39573] hover:from-[#c2a353] text-stone-950 font-bold text-sm tracking-wider rounded-xl shadow-lg transition-all"
          >
            {saving ? '保存中...' : '店舗設定を保存・HPへ反映'}
          </button>
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
              className="w-full py-3 bg-gradient-to-r from-[#d1b464] to-[#a39573] hover:from-[#c2a353] text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
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
              className="w-full py-3 bg-gradient-to-r from-[#d1b464] to-[#a39573] hover:from-[#c2a353] text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
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
