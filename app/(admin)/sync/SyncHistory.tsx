'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type SyncJobStatus = 'processing' | 'completed' | 'failed'
type SyncJobType = 'therapist_single' | 'therapist_batch' | 'shift_manual' | 'cron_urgent_reserve' | 'cron_daily_shift' | 'news_post'

interface SyncJob {
  id: string
  target_type: SyncJobType
  status: SyncJobStatus
  result_details: any
  created_at: string
}

/** サイト単位の結果。1ジョブで両サイトを同期することがあるため配列で持つ */
interface SiteOutcome {
  siteLabel: string
  ok: boolean
  detail: string
}

const ESTAMA = 'エステ魂'
const RANKING = 'ランキング'

/**
 * 生のエラーメッセージを担当者が読める文言に変換する。
 * 判別できないものは原文をそのまま返す（情報を失わせない）。
 */
function humanizeError(raw: string): string {
  if (!raw) return '原因不明のエラー'
  if (raw.includes('403')) return 'ポータル側にアクセスを拒否されました(403)。時間をおいて自動的に再試行されます'
  if (raw.includes('Timeout') || raw.includes('timeout')) return 'ポータルサイトの応答がありませんでした（タイムアウト）'
  if (raw.includes('ログインに失敗')) return 'ログインに失敗しました。アカウント設定をご確認ください'
  if (raw.includes('ログイン情報')) return 'ログイン情報が未設定です'
  return raw.length > 120 ? raw.slice(0, 120) + '…' : raw
}

/**
 * result_details はジョブ種別ごとに形が違うため、ここでサイト単位の結果に正規化する。
 *  - cron          : { estama: {...}, estheRanking: {...} }
 *  - シフト手動同期 : { target: 'estama' | 'esthe_ranking', message | error }
 *  - キャスト一括   : { targetSite, successCount, errorCount }
 *  - キャスト個別   : { target, message | error }
 */
function toSiteOutcomes(job: SyncJob): SiteOutcome[] {
  const rd = job.result_details
  if (!rd || typeof rd !== 'object') return []

  // 1) cron形式（両サイトを1ジョブで処理）
  if (rd.estama || rd.estheRanking) {
    const out: SiteOutcome[] = []
    if (rd.estama) {
      out.push({
        siteLabel: ESTAMA,
        ok: !!rd.estama.success,
        detail: rd.estama.success ? (rd.estama.message || '同期しました') : humanizeError(rd.estama.error || ''),
      })
    }
    if (rd.estheRanking) {
      out.push({
        siteLabel: RANKING,
        ok: !!rd.estheRanking.success,
        detail: rd.estheRanking.success ? (rd.estheRanking.message || '同期しました') : humanizeError(rd.estheRanking.error || ''),
      })
    }
    return out
  }

  const siteLabel = (rd.target === 'estama' || rd.targetSite === 'estama') ? ESTAMA
    : (rd.target || rd.targetSite) ? RANKING
    : ''

  // 2) キャスト一括同期（人数の内訳を持つ）
  if (typeof rd.successCount === 'number') {
    const ok = !rd.errorCount
    return [{
      siteLabel: siteLabel || RANKING,
      ok,
      detail: ok ? `${rd.successCount}人を同期しました` : `成功 ${rd.successCount}人 / 失敗 ${rd.errorCount}人`,
    }]
  }

  // 3) 単一サイト形式
  if (siteLabel || rd.message || rd.error) {
    return [{
      siteLabel,
      ok: !rd.error && job.status !== 'failed',
      detail: rd.error ? humanizeError(rd.error) : (rd.message || '同期しました'),
    }]
  }

  return []
}

export default function SyncHistory({ shopId }: { shopId: string }) {
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [loading, setLoading] = useState(true)

  const fetchJobs = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setJobs(data as SyncJob[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchJobs()
  }, [shopId])

  const getTypeLabel = (type: SyncJobType) => {
    switch (type) {
      case 'therapist_single': return 'キャスト同期 (個別)'
      case 'therapist_batch': return 'キャスト同期 (一括)'
      case 'shift_manual': return 'シフト同期 (手動)'
      case 'cron_urgent_reserve': return '自動同期 (直近予約)'
      case 'cron_daily_shift': return '自動同期 (1日1回全体)'
      case 'news_post': return 'ニュース投稿'
      default: return type
    }
  }

  const siteBadge = (o: SiteOutcome, i: number) => (
    <span
      key={i}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
        o.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
      }`}
    >
      {o.siteLabel && <span className="font-normal opacity-80">{o.siteLabel}</span>}
      {o.ok ? '成功' : '失敗'}
    </span>
  )

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr)
    return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-slate-800">同期履歴</h2>
        <button
          onClick={fetchJobs}
          disabled={loading}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          更新
        </button>
      </div>

      <p className="text-xs text-slate-500 mb-3">
        1回の同期でエステ魂とメンズエステランキングの両方に送信します。ステータスはサイトごとに表示されます。
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold">日時</th>
              <th className="px-4 py-3 font-semibold">種類</th>
              <th className="px-4 py-3 font-semibold">ステータス</th>
              <th className="px-4 py-3 font-semibold">詳細</th>
            </tr>
          </thead>
          <tbody>
            {loading && jobs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">読み込み中...</td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">同期履歴はありません</td>
              </tr>
            ) : (
              jobs.map(job => {
                const outcomes = toSiteOutcomes(job)
                return (
                  <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50/50 align-top">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(job.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{getTypeLabel(job.target_type)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {job.status === 'processing' ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">処理中</span>
                      ) : outcomes.length > 0 ? (
                        <div className="flex flex-col gap-1 items-start">{outcomes.map(siteBadge)}</div>
                      ) : job.status === 'completed' ? (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">完了</span>
                      ) : (
                        <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold">失敗</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-md">
                      {outcomes.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {outcomes.map((o, i) => (
                            <div key={i} className={o.ok ? 'text-slate-500' : 'text-rose-600'}>{o.detail}</div>
                          ))}
                        </div>
                      ) : job.result_details?.error ? (
                        <span className="text-rose-600">{humanizeError(job.result_details.error)}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
