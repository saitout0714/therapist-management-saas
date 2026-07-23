'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import SyncHistory from './SyncHistory'

type SyncTab = 'esthe_ranking' | 'estama' | 'history'

export default function SyncPage() {
  const { selectedShop } = useShop()
  const [activeTab, setActiveTab] = useState<SyncTab>('esthe_ranking')
  
  // Date selection for sync
  const [syncStartDate, setSyncStartDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  })
  const [syncEndDate, setSyncEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7); // Default 1 week
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  })

  // Esthe ranking states
  const [form, setForm] = useState({
    esthe_ranking_login_id: '',
    esthe_ranking_password: '',
    esthe_ranking_shop_url: '',
    estama_login_id: '',
    estama_password: '',
    estama_shop_url: 'https://estama.jp/login/?r=/admin/',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [syncProgressText, setSyncProgressText] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)

  // Load shop settings
  useEffect(() => {
    async function fetchSettings() {
      if (!selectedShop) return
      setLoading(true)
      let { data, error } = await supabase
        .from('shops')
        .select('esthe_ranking_login_id, esthe_ranking_password, esthe_ranking_shop_url, estama_login_id, estama_password, estama_shop_url')
        .eq('id', selectedShop.id)
        .single()
      
      if (error) {
        // Fallback: If estama columns do not exist in DB yet, query esthe_ranking columns only
        const fallback = await supabase
          .from('shops')
          .select('esthe_ranking_login_id, esthe_ranking_password, esthe_ranking_shop_url')
          .eq('id', selectedShop.id)
          .single()
        
        if (!fallback.error && fallback.data) {
          data = fallback.data as any
          error = null
        }
      }

      if (!error && data) {
        setForm({
          esthe_ranking_login_id: data.esthe_ranking_login_id || '',
          esthe_ranking_password: data.esthe_ranking_password || '',
          esthe_ranking_shop_url: data.esthe_ranking_shop_url || '',
          estama_login_id: (data as any).estama_login_id || '',
          estama_password: (data as any).estama_password || '',
          estama_shop_url: (data as any).estama_shop_url || 'https://estama.jp/login/?r=/admin/',
        })
      }
      setLoading(false)
    }
    void fetchSettings()
  }, [selectedShop])

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShop) return
    setSaving(true)

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    if (activeTab === 'esthe_ranking') {
      updatePayload.esthe_ranking_login_id = form.esthe_ranking_login_id || null
      updatePayload.esthe_ranking_password = form.esthe_ranking_password || null
      updatePayload.esthe_ranking_shop_url = form.esthe_ranking_shop_url || null
    } else if (activeTab === 'estama') {
      updatePayload.estama_login_id = form.estama_login_id || null
      updatePayload.estama_password = form.estama_password || null
      updatePayload.estama_shop_url = form.estama_shop_url || 'https://estama.jp/login/?r=/admin/'
    }

    const { error } = await supabase
      .from('shops')
      .update(updatePayload)
      .eq('id', selectedShop.id)

    if (error) {
      console.error('Save config error:', error)
      if (error.message?.includes('estama') || error.code === '42703') {
        alert('設定の保存に失敗しました。\nSupabaseデータベースにエステ魂用のカラムが追加されていません。SQL Editorで add-estama-sync.sql を実行してください。')
      } else {
        alert(`設定の保存に失敗しました: ${error.message || '通信エラー'}`)
      }
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  const handleSyncShifts = async (isAll = false) => {
    if (!selectedShop) return;
    
    const apiEndpoint = activeTab === 'esthe_ranking' ? '/api/sync/esthe-ranking' : '/api/sync/estama'
    const siteName = activeTab === 'esthe_ranking' ? 'メンズエステランキング' : 'エステ魂'

    let start = syncStartDate;
    let end = syncEndDate;

    if (isAll) {
      const today = new Date();
      start = today.toISOString().split('T')[0];
      const future = new Date(today);
      future.setDate(future.getDate() + 13); // 今日を含む14日間
      end = future.toISOString().split('T')[0];
    } else {
      if (!start || !end) {
        alert('開始日と終了日を選択してください');
        return;
      }
      const d1 = new Date(start);
      const d2 = new Date(end);
      if (d1 > d2) {
        alert('終了日は開始日以降の日付を選択してください');
        return;
      }
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 14) {
        alert('一度に指定できる期間は最大14日間までです');
        return;
      }
    }

    const msg = isAll 
      ? `今日から14日間のシフト情報を${siteName}に同期しますか？\n※タイムアウト防止のため分割実行されます。` 
      : `${start} 〜 ${end} のシフト情報を${siteName}に同期しますか？\n※処理に数十秒〜数分かかります。`;

    if (!confirm(msg)) return;
    
    setIsSyncing(true);
    setSyncProgressText('同期の準備中...');

    try {
      // 一度リクエストを投げるだけでバックグラウンド実行される
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: selectedShop.id, startDate: start, endDate: end }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || '同期リクエストの送信に失敗しました');
      }
      
      setSyncProgressText('');
      alert(`バックグラウンドで${siteName}へのシフト同期を開始しました。\n完了状態は「同期履歴」から確認できます。`);
    } catch (err: any) {
      setSyncProgressText('');
      alert(err.message);
    } finally {
      setIsSyncing(false);
      setSyncProgressText('');
    }
  };

  const handleBatchSyncTherapists = async () => {
    if (!selectedShop) return;
    
    const targetSite = activeTab === 'esthe_ranking' ? 'esthe_ranking' : 'estama';
    const siteName = activeTab === 'esthe_ranking' ? 'メンズエステランキング' : 'エステ魂';

    if (!confirm(`yoyaklに登録されている全セラピストの情報を${siteName}に一括同期（新規登録または上書き更新）しますか？\n※人数が多い場合は数分かかることがあります。`)) return;

    setIsSyncing(true);
    setSyncProgressText('対象セラピストを取得中...');

    try {
      const { data: therapists, error } = await supabase
        .from('therapists')
        .select('id, name')
        .eq('shop_id', selectedShop.id)
        .eq('is_active', true)
        .order('order', { ascending: true });

      if (error || !therapists || therapists.length === 0) {
        throw new Error('同期するセラピストが見つかりませんでした。');
      }

      const therapistIds = therapists.map(t => t.id);

      const res = await fetch('/api/sync/therapists/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: selectedShop.id, targetSite, therapistIds }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'リクエスト失敗');
      }

      setSyncProgressText('');
      alert(`バックグラウンドで全キャスト（${therapists.length}人）の${siteName}への同期を開始しました！\n完了状態は「同期履歴」から確認できます。`);
    } catch (err: any) {
      setSyncProgressText('');
      alert(err.message);
    } finally {
      setIsSyncing(false);
      setSyncProgressText('');
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-50 p-4 md:p-6 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const tabs: { key: SyncTab; label: string }[] = [
    { key: 'esthe_ranking', label: 'メンズエステランキング' },
    { key: 'estama', label: 'エステ魂' },
    { key: 'history', label: '同期履歴' },
  ]

  const isCurrentTabConfigured = activeTab === 'esthe_ranking' 
    ? !!(form.esthe_ranking_shop_url && form.esthe_ranking_login_id && form.esthe_ranking_password)
    : !!(form.estama_login_id && form.estama_password)

  return (
    <div className="bg-slate-50 p-4 md:p-6 min-h-screen">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            サイト同期
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            外部のランキングサイトやポータルサイト（メンズエステランキング、エステ魂等）と、yoyaklの出勤スケジュール情報を同期します。
          </p>
        </div>

        {/* タブナビゲーション */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 rounded-t-xl text-sm font-bold transition-colors whitespace-nowrap border-b-2 ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* コンテンツエリア */}
        <div className="space-y-6">
          {activeTab === 'history' ? (
            <SyncHistory shopId={selectedShop?.id || ''} />
          ) : (
            <>
              {/* 同期実行カード */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  出勤スケジュールの同期（{activeTab === 'esthe_ranking' ? 'メンズエステランキング' : 'エステ魂'}）
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">指定した日付のシフト情報を対象ポータルサイトに自動反映します</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              {/* 「まとめて同期」オプション */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">まとめて一括同期（推奨）</h3>
                  <p className="text-xs text-slate-500 mt-1">「今日から14日間」のシフトをすべてポータルサイトに反映します。</p>
                </div>
                <button
                  onClick={() => handleSyncShifts(true)}
                  disabled={isSyncing || !isCurrentTabConfigured}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 shadow-sm transition-colors font-bold text-sm flex justify-center items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                >
                  {isSyncing ? (syncProgressText || '同期処理中...') : '今日から14日間を一括同期'}
                </button>
              </div>
              {/* 「期間指定同期」オプション */}

              {/* 「期間指定同期」オプション */}
              <div className="flex flex-col sm:flex-row items-end gap-4 pt-1">
                <div className="w-full sm:w-auto">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">期間を指定して同期（最大14日間）</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={syncStartDate}
                      onChange={(e) => setSyncStartDate(e.target.value)}
                      className="w-full sm:w-auto border border-slate-200 rounded-lg bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                    <span className="text-slate-400 font-bold">〜</span>
                    <input
                      type="date"
                      value={syncEndDate}
                      onChange={(e) => setSyncEndDate(e.target.value)}
                      className="w-full sm:w-auto border border-slate-200 rounded-lg bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleSyncShifts(false)}
                  disabled={isSyncing || !isCurrentTabConfigured}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 shadow-sm transition-colors font-bold text-sm flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {isSyncing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      {syncProgressText || '処理中...'}
                    </>
                  ) : (
                    '指定した期間を同期'
                  )}
                </button>
              </div>
            </div>
            {!isCurrentTabConfigured && (
              <p className="text-xs text-rose-500 mt-2 ml-1">※下の「アカウント設定」を入力・保存してから同期を行ってください。</p>
            )}
          </div>

          {/* セラピスト情報の同期カード */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-pink-50 text-pink-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  セラピスト情報の同期（{activeTab === 'esthe_ranking' ? 'メンズエステランキング' : 'エステ魂'}）
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">yoyaklに登録されているキャスト情報を対象ポータルサイトに自動反映（新規登録・上書き）します</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">まとめて一括同期（推奨）</h3>
                  <p className="text-xs text-slate-500 mt-1">yoyakl上の「すべての有効なキャスト」をポータルサイトに一括送信します。</p>
                </div>
                <button
                  onClick={handleBatchSyncTherapists}
                  disabled={isSyncing || !isCurrentTabConfigured}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 shadow-sm transition-colors font-bold text-sm flex justify-center items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                >
                  {isSyncing ? (syncProgressText || '同期処理中...') : '全キャストを一括同期'}
                </button>
              </div>
              
              <div className="text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-200">
                <p className="font-bold mb-1">【同期される項目】</p>
                <ul className="list-disc list-inside space-y-1 ml-1 text-[11px]">
                  <li>名前・年齢・T/B/W/H・カップ数</li>
                  <li>一言コメント（自己紹介）</li>
                  <li>プロフィール写真（画像の自動アップロード）</li>
                </ul>
                <p className="mt-2 text-[10px] text-slate-400">※ポータルサイトに同名のキャストが既にいる場合は情報を上書き更新し、いない場合は新規登録として追加します。個別の同期は「キャスト管理 ＞ キャスト編集」画面からも実行可能です。</p>
              </div>
            </div>
          </div>

          {/* アカウント設定カード */}
          <form onSubmit={handleSaveConfig} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-800 mb-1">
                アカウント設定（{activeTab === 'esthe_ranking' ? 'メンズエステランキング' : 'エステ魂'}）
              </h2>
              <p className="text-xs text-slate-500">店舗管理画面のログイン情報を入力してください。同期機能を使用するために必須となります。</p>
            </div>
            
            {activeTab === 'esthe_ranking' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">管理画面URL（ログインページ）</label>
                  <input
                    type="text"
                    placeholder="https://www.esthe-ranking.jp/shop/login/"
                    value={form.esthe_ranking_shop_url}
                    onChange={(e) => setForm({ ...form, esthe_ranking_shop_url: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">ログインID</label>
                  <input
                    type="text"
                    placeholder="ログインID"
                    value={form.esthe_ranking_login_id}
                    onChange={(e) => setForm({ ...form, esthe_ranking_login_id: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">パスワード</label>
                  <input
                    type="password"
                    placeholder="パスワード"
                    value={form.esthe_ranking_password}
                    onChange={(e) => setForm({ ...form, esthe_ranking_password: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">エステ魂 管理画面URL（ログインページ）</label>
                  <input
                    type="text"
                    placeholder="https://estama.jp/login/?r=/admin/"
                    value={form.estama_shop_url}
                    onChange={(e) => setForm({ ...form, estama_shop_url: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">ログインメールアドレス / ID</label>
                  <input
                    type="text"
                    placeholder="ログインIDまたはメールアドレス"
                    value={form.estama_login_id}
                    onChange={(e) => setForm({ ...form, estama_login_id: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">パスワード</label>
                  <input
                    type="password"
                    placeholder="パスワード"
                    value={form.estama_password}
                    onChange={(e) => setForm({ ...form, estama_password: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors disabled:opacity-50 text-sm"
              >
                {saving ? '保存中...' : 'アカウント設定を保存'}
              </button>
              {saved && (
                <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  保存しました
                </span>
              )}
            </div>
          </form>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
