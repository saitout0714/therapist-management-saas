'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ImportResult = {
  imported: number
  skipped: number
  errors: number
  log: string[]
}

const DEFAULT_START = new Date(new Date().getFullYear() - 1, 0, 1).toISOString().split('T')[0]
const DEFAULT_END   = new Date().toISOString().split('T')[0]

export default function ImportCalendarPage() {
  const router = useRouter()
  const [startDate, setStartDate] = useState(DEFAULT_START)
  const [endDate, setEndDate]     = useState(DEFAULT_END)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg]   = useState<string | null>(null)
  const [showLog, setShowLog]     = useState(false)

  const handleImport = async () => {
    if (!startDate || !endDate) {
      setErrorMsg('開始日と終了日を入力してください')
      return
    }
    if (startDate > endDate) {
      setErrorMsg('開始日は終了日より前にしてください')
      return
    }

    setLoading(true)
    setResult(null)
    setErrorMsg(null)
    setShowLog(false)

    try {
      const res = await fetch('/api/admin/import-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      })
      const json = await res.json()

      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'インポートに失敗しました')
        return
      }

      setResult(json.result as ImportResult)
      setShowLog(true)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '不明なエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const logLines = result?.log ?? []
  const successLines = logLines.filter(l => l.startsWith('[成功]'))
  const skipLines    = logLines.filter(l => l.startsWith('[スキップ'))
  const errorLines   = logLines.filter(l => l.startsWith('[エラー]'))
  const infoLines    = logLines.filter(l => l.startsWith('[準備]') || l.startsWith('[警告]'))

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin')}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-white rounded-xl transition-colors"
            title="戻る"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Googleカレンダーインポート
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              過去の予約データをGoogleカレンダーからSupabaseへ一括インポートします
            </p>
          </div>
        </div>

        {/* セットアップ手順 */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
          <h2 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            セットアップ手順
          </h2>
          <ol className="space-y-3 text-sm text-indigo-800">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <span className="font-semibold">GASスクリプトをコピー</span>
                <br />
                プロジェクト内の <code className="bg-indigo-100 px-1.5 py-0.5 rounded text-xs font-mono">gas/import_calendar.gs</code> を
                <a
                  href="https://script.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 underline ml-1"
                >
                  Google Apps Script
                </a>
                にコピーしてください
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <span className="font-semibold">Supabase Service Role Key を設定</span>
                <br />
                GASエディタの「プロジェクトの設定」→「スクリプトプロパティ」に
                <br />
                <code className="bg-indigo-100 px-1.5 py-0.5 rounded text-xs font-mono">SUPABASE_SERVICE_ROLE_KEY</code> を追加してください
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <span className="font-semibold">ウェブアプリとしてデプロイ</span>
                <br />
                GASエディタで [デプロイ] → [新しいデプロイ] → 種類: ウェブアプリ
                <br />
                「次のユーザーとして実行: <strong>自分</strong>」に設定してデプロイ
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
              <div>
                <span className="font-semibold">.env.local に GAS_IMPORT_ENDPOINT を追加</span>
                <br />
                デプロイ後に表示されたURLを以下の形式で <code className="bg-indigo-100 px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code> に追加:
                <br />
                <code className="block mt-1 bg-indigo-100 px-2 py-1.5 rounded text-xs font-mono text-indigo-900">
                  GAS_IMPORT_ENDPOINT=https://script.google.com/macros/s/XXX/exec
                </code>
                追加後 <code className="bg-indigo-100 px-1 rounded text-xs font-mono">npm run dev</code> を再起動してください
              </div>
            </li>
          </ol>

          <div className="mt-4 pt-4 border-t border-indigo-200 text-xs text-indigo-700">
            <span className="font-semibold">注意:</span> GASを使わず手動実行する場合は、
            <code className="bg-indigo-100 px-1 rounded font-mono">gas/import_calendar.gs</code> の
            <code className="bg-indigo-100 px-1 rounded font-mono">importCalendarToSupabase()</code>
            関数のstartDate・endDateを変更し、GASエディタから直接実行することも可能です。
          </div>
        </div>

        {/* インポートフォーム */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="font-bold text-slate-800 mb-5 text-lg">インポート設定</h2>

          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  開始日 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  終了日 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <ul className="space-y-1.5 font-medium">
                <li>・インポート対象: <code className="bg-amber-100 px-1 rounded font-mono text-xs">yokkaichicrystalspa@gmail.com</code> カレンダー</li>
                <li>・登録ステータス: <code className="bg-amber-100 px-1 rounded font-mono text-xs">completed</code>（完了）</li>
                <li>・同日・同時刻・同セラピストの重複はスキップされます</li>
                <li>・未登録顧客は自動作成されます（電話番号・メールなし）</li>
                <li>・料金は 0円 で登録されます（後から修正可能）</li>
              </ul>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700 font-medium">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{errorMsg}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={loading || !startDate || !endDate}
              className="w-full px-5 py-4 bg-indigo-600 text-white rounded-xl font-bold text-base hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  インポート実行中...（数分かかる場合があります）
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  インポート実行
                </>
              )}
            </button>
          </div>
        </div>

        {/* 結果表示 */}
        {result && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
            <h2 className="font-bold text-slate-800 text-lg">インポート結果</h2>

            {/* サマリーカード */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-extrabold text-emerald-600">{result.imported}</div>
                <div className="text-sm font-semibold text-emerald-700 mt-1">成功</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-extrabold text-slate-500">{result.skipped}</div>
                <div className="text-sm font-semibold text-slate-600 mt-1">スキップ</div>
              </div>
              <div className={`border rounded-xl p-4 text-center ${result.errors > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-3xl font-extrabold ${result.errors > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{result.errors}</div>
                <div className={`text-sm font-semibold mt-1 ${result.errors > 0 ? 'text-rose-700' : 'text-slate-500'}`}>エラー</div>
              </div>
            </div>

            {result.imported > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800 font-medium">
                {result.imported} 件の予約をインポートしました。
                <a href="/reservations" className="underline ml-2 text-emerald-700">予約一覧で確認する →</a>
              </div>
            )}

            {/* ログトグル */}
            <button
              onClick={() => setShowLog(v => !v)}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              <svg className={`w-4 h-4 transition-transform ${showLog ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              詳細ログ ({result.log.length} 行) を{showLog ? '非表示' : '表示'}
            </button>

            {showLog && (
              <div className="space-y-3">
                {/* 準備ログ */}
                {infoLines.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">初期化</div>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-1 font-mono text-xs text-slate-600">
                      {infoLines.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                  </div>
                )}

                {/* 成功ログ */}
                {successLines.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-emerald-600 uppercase mb-1">成功 ({successLines.length}件)</div>
                    <div className="bg-emerald-50 rounded-xl p-4 space-y-1 font-mono text-xs text-emerald-800 max-h-60 overflow-y-auto">
                      {successLines.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                  </div>
                )}

                {/* スキップログ */}
                {skipLines.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">スキップ ({skipLines.length}件)</div>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-1 font-mono text-xs text-slate-600 max-h-60 overflow-y-auto">
                      {skipLines.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                  </div>
                )}

                {/* エラーログ */}
                {errorLines.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-rose-600 uppercase mb-1">エラー ({errorLines.length}件)</div>
                    <div className="bg-rose-50 rounded-xl p-4 space-y-1 font-mono text-xs text-rose-800 max-h-60 overflow-y-auto">
                      {errorLines.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
