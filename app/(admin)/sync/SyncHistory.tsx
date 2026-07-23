'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type SyncJobStatus = 'processing' | 'completed' | 'failed'
type SyncJobType = 'therapist_single' | 'therapist_batch' | 'shift_manual' | 'cron_urgent_reserve' | 'cron_daily_shift'

interface SyncJob {
  id: string
  target_type: SyncJobType
  status: SyncJobStatus
  result_details: any
  created_at: string
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
      default: return type
    }
  }

  const getStatusBadge = (status: SyncJobStatus) => {
    switch (status) {
      case 'processing': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">処理中</span>
      case 'completed': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">完了</span>
      case 'failed': return <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold">失敗</span>
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{status}</span>
    }
  }

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
              jobs.map(job => (
                <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(job.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{getTypeLabel(job.target_type)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(job.status)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                    {job.result_details ? JSON.stringify(job.result_details) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
