'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import Link from 'next/link'
import { CourseManagementTab } from './components/CourseManagementTab'
import { OptionManagementTab } from './components/OptionManagementTab'
import { TherapistRankManagementTab } from './components/TherapistRankManagementTab'
import { NominationFeeManagementTab } from './components/NominationFeeManagementTab'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type SystemSettings = {
  id: string
  shop_id: string
  default_nomination_fee: number
  default_confirmed_nomination_fee: number
  default_princess_reservation_fee: number
}

export default function SystemPage() {
  const { selectedShop } = useShop()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'courses' | 'options' | 'ranks' | 'nomination_fees' | 'pricing_defaults'>('courses')
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [courseCount, setCourseCount] = useState(0)
  const [optionCount, setOptionCount] = useState(0)
  const [form, setForm] = useState({
    default_nomination_fee: 0,
    default_confirmed_nomination_fee: 0,
    default_princess_reservation_fee: 0,
  })

  async function fetchSettings() {
    if (!selectedShop) {
      setLoading(false)
      setSettings(null)
      return
    }

    setLoading(true)
    const [settingsRes, coursesRes, optionsRes] = await Promise.all([
      supabase.from('system_settings').select('*').eq('shop_id', selectedShop.id).limit(1),
      supabase.from('courses').select('id', { count: 'exact', head: true }).eq('shop_id', selectedShop.id),
      supabase.from('options').select('id', { count: 'exact', head: true }).eq('shop_id', selectedShop.id),
    ])

    if (settingsRes.error) {
      alert('システム設定の取得に失敗しました')
      setLoading(false)
      return
    }

    const row = (settingsRes.data?.[0] as SystemSettings | undefined) || null
    setSettings(row)
    setCourseCount(coursesRes.count || 0)
    setOptionCount(optionsRes.count || 0)
    setForm({
      default_nomination_fee: row?.default_nomination_fee || 0,
      default_confirmed_nomination_fee: row?.default_confirmed_nomination_fee || 0,
      default_princess_reservation_fee: row?.default_princess_reservation_fee || 0,
    })
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShop) {
      alert('店舗を選択してください')
      return
    }

    const result = settings?.id
      ? await supabase.from('system_settings').update({ ...form, updated_at: new Date().toISOString() }).eq('id', settings.id)
      : await supabase.from('system_settings').insert([{ ...form, shop_id: selectedShop.id }])

    if (result.error) {
      alert('保存に失敗しました')
      return
    }
    alert('保存しました')
    void fetchSettings()
  }

  useEffect(() => {
    void fetchSettings()
  }, [selectedShop])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center py-20 text-indigo-600">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 font-medium">読み込み中...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">システム管理</h1>
          <p className="text-sm text-slate-500 mt-1">サービス設定と店舗の初期料金設定を管理します。</p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('courses')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'courses'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
          >
            コース管理
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('options')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'options'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
          >
            オプション管理
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ranks')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'ranks'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
          >
            ランク設定
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('nomination_fees')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'nomination_fees'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
          >
            指名料ルール
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pricing_defaults')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'pricing_defaults'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
          >
            指名料デフォルト
          </button>
        </div>

        {activeTab === 'courses' && <CourseManagementTab />}

        {activeTab === 'options' && <OptionManagementTab />}

        {activeTab === 'ranks' && <TherapistRankManagementTab />}

        {activeTab === 'nomination_fees' && <NominationFeeManagementTab />}

        {activeTab === 'pricing_defaults' && (
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-3xl">
            <h2 className="text-lg font-bold text-slate-800 mb-2">指名料デフォルト設定</h2>
            <p className="text-sm text-slate-500 mb-6">セラピスト個別設定がない場合に適用される店舗デフォルト料金です。</p>

            <div className="space-y-5">
              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">指名料（通常）</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                  <input
                    type="number"
                    min={0}
                    value={form.default_nomination_fee}
                    onChange={(e) => setForm({ ...form, default_nomination_fee: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl bg-slate-50 pl-8 pr-3 py-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">本指名料</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                  <input
                    type="number"
                    min={0}
                    value={form.default_confirmed_nomination_fee}
                    onChange={(e) => setForm({ ...form, default_confirmed_nomination_fee: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl bg-slate-50 pl-8 pr-3 py-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700">姫予約料金</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                  <input
                    type="number"
                    min={0}
                    value={form.default_princess_reservation_fee}
                    onChange={(e) => setForm({ ...form, default_princess_reservation_fee: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl bg-slate-50 pl-8 pr-3 py-2.5"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors">
                保存する
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
