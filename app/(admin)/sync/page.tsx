'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

export default function SyncPage() {
  const { selectedShop } = useShop()
  const [activeTab, setActiveTab] = useState<'esthe_ranking'>('esthe_ranking')
  
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
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [autoMatching, setAutoMatching] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Load shop settings
  useEffect(() => {
    async function fetchSettings() {
      if (!selectedShop) return
      setLoading(true)
      const { data, error } = await supabase
        .from('shops')
        .select('esthe_ranking_login_id, esthe_ranking_password, esthe_ranking_shop_url')
        .eq('id', selectedShop.id)
        .single()
      
      if (!error && data) {
        setForm({
          esthe_ranking_login_id: data.esthe_ranking_login_id || '',
          esthe_ranking_password: data.esthe_ranking_password || '',
          esthe_ranking_shop_url: data.esthe_ranking_shop_url || '',
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

    const { error } = await supabase
      .from('shops')
      .update({
        esthe_ranking_login_id: form.esthe_ranking_login_id || null,
        esthe_ranking_password: form.esthe_ranking_password || null,
        esthe_ranking_shop_url: form.esthe_ranking_shop_url || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedShop.id)

    if (error) {
      alert('設定の保存に失敗しました')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  const handleAutoMatchTherapists = async () => {
    if (!selectedShop) return
    if (!form.esthe_ranking_shop_url || !form.esthe_ranking_login_id || !form.esthe_ranking_password) {
      alert('先にメンズエステランキングのログイン情報を入力して保存してください');
      return;
    }
    
    if (!confirm('ランキングサイトのセラピスト情報と「名前」で自動マッチングを行い、連携IDを設定します。よろしいですか？\n※既に設定済みのIDは上書きされません。\n※名前が完全に一致するセラピストのみ対象になります。')) {
      return;
    }

    setAutoMatching(true);
    try {
      const res = await fetch('/api/sync/esthe-ranking-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: selectedShop.id })
      });
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('サーバーからの応答が不正です。タイムアウトした可能性があります（処理は裏で続いている場合があります）。');
      }
      
      if (!res.ok) {
        throw new Error(data?.error || '自動マッチングに失敗しました');
      }
      
      alert(data.message || '自動マッチングが完了しました');
    } catch (err: any) {
      alert(err.message || '自動マッチング中にエラーが発生しました');
    } finally {
      setAutoMatching(false);
    }
  }

  const handleSyncRanking = async (isAll = false) => {
    if (!selectedShop) return;
    
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
      ? `今日から14日間のシフト情報をすべてランキングサイトに同期しますか？\n※バックグラウンドでブラウザ処理が走るため約1〜2分かかります。` 
      : `${start} 〜 ${end} のシフト情報をランキングサイトに同期しますか？\n※バックグラウンドでブラウザ処理が走ります。期間により数十秒かかります。`;

    if (!confirm(msg)) return;
    
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync/esthe-ranking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: selectedShop.id, startDate: start, endDate: end }),
      });
      if (!res.ok) {
        let errorData;
        try {
          errorData = await res.json();
        } catch (e) {
          throw new Error('サーバーからの応答が不正です。タイムアウトした可能性があります（処理は裏で続いている場合があります）。');
        }
        throw new Error(errorData?.error || '同期リクエストの送信に失敗しました');
      }
      alert('同期が正常に完了しました！');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-50 p-4 md:p-6 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const tabs = [
    { key: 'esthe_ranking', label: 'メンズエステランキング' },
    // 将来的に { key: 'portal_b', label: '広告ポータルB' } などを追加
  ] as const

  return (
    <div className="bg-slate-50 p-4 md:p-6 min-h-screen">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            サイト同期
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            外部のランキングサイトや広告ポータルと、yoyaklの出勤スケジュール情報を同期します。
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
          <div className="flex items-center px-4 text-xs text-slate-400 border-b-2 border-transparent">
            + 対応サイト随時追加予定
          </div>
        </div>

        {/* コンテンツエリア */}
        <div className="space-y-6">
          {activeTab === 'esthe_ranking' && (
            <>
              {/* 同期実行カード */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">出勤スケジュールの同期</h2>
                    <p className="text-xs text-slate-500 mt-0.5">指定した日付のシフト情報をランキングサイトに自動反映します</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  {/* 「まとめて同期」オプション */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">まとめて一括同期（推奨）</h3>
                      <p className="text-xs text-slate-500 mt-1">「今日から14日間」のシフトをすべてランキングサイトに反映します。</p>
                    </div>
                    <button
                      onClick={() => handleSyncRanking(true)}
                      disabled={isSyncing || !form.esthe_ranking_shop_url}
                      className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 shadow-sm transition-colors font-bold text-sm flex justify-center items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                    >
                      {isSyncing ? '同期処理中...' : '今日から14日間を一括同期'}
                    </button>
                  </div>

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
                      onClick={() => handleSyncRanking(false)}
                      disabled={isSyncing || !form.esthe_ranking_shop_url}
                      className="w-full sm:w-auto px-5 py-2.5 bg-white border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 shadow-sm transition-colors font-bold text-sm flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                      {isSyncing ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          処理中...
                        </>
                      ) : (
                        '指定した期間を同期'
                      )}
                    </button>
                  </div>
                </div>
                {!form.esthe_ranking_shop_url && (
                  <p className="text-xs text-rose-500 mt-2 ml-1">※下の「アカウント設定」を入力・保存してから同期を行ってください。</p>
                )}
              </div>

              {/* アカウント設定カード */}
              <form onSubmit={handleSaveConfig} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6 space-y-6">
                <div>
                  <h2 className="text-base font-bold text-slate-800 mb-1">アカウント設定</h2>
                  <p className="text-xs text-slate-500">店舗管理画面のログイン情報を入力してください。同期機能を使用するために必須となります。</p>
                </div>
                
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

              {/* ID自動連携カード */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
                <div>
                  <h2 className="text-base font-bold text-slate-800 mb-1">セラピストIDの自動連携</h2>
                  <p className="text-xs text-slate-500 mb-4">
                    ランキングサイトのセラピスト情報と、yoyaklのセラピストを「名前」で自動マッチングし、連携IDを設定します。<br />
                    新人セラピストを追加した際などに使用してください。
                  </p>
                  
                  <div className="bg-orange-50 border border-orange-100 text-orange-800 p-3 rounded-lg text-xs mb-4">
                    ※事前にアカウント設定を保存している必要があります。<br/>
                    ※名前が完全に一致するセラピストのみ対象になります。
                  </div>

                  <button
                    type="button"
                    onClick={handleAutoMatchTherapists}
                    disabled={autoMatching || saving || !form.esthe_ranking_shop_url}
                    className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    {autoMatching ? '連携処理中...' : 'セラピストIDを自動設定する'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 将来他のサイトが追加された場合のプレースホルダー */}
          {activeTab !== 'esthe_ranking' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
              <p className="text-slate-500 font-medium">現在準備中です</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
