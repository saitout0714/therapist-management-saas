'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import Link from 'next/link'

interface Room {
  id: string
  name: string
  display_name: string | null
  template_member: string | null
  template_new_customer: string | null
  template_web_member: string | null
  template_web_new_customer: string | null
  created_at: string
  order: number | null
  type?: string
}

export default function RoomsList() {
  const { selectedShop } = useShop()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [smsAddressMode, setSmsAddressMode] = useState<'unified' | 'split_by_membership'>('unified')
  const [webReserveAddressMode, setWebReserveAddressMode] = useState<'unified' | 'split_by_membership'>('unified')
  const [updatingMode, setUpdatingMode] = useState(false)

  /**
   * 案内文の書き分け設定。
   * 送信処理を切り替えるものではなく、各ルームの編集画面で
   * 案内文の入力欄を1つ出すか（一律）、会員用・新規用の2つ出すか（書き分け）を決める。
   */
  const updateMode = async (
    column: 'sms_address_mode' | 'web_reserve_address_mode',
    mode: 'unified' | 'split_by_membership'
  ) => {
    if (!selectedShop) return
    const prevSms = smsAddressMode
    const prevWeb = webReserveAddressMode
    if (column === 'sms_address_mode') setSmsAddressMode(mode)
    else setWebReserveAddressMode(mode)

    setUpdatingMode(true)
    const { error } = await supabase
      .from('shops')
      .update({ [column]: mode, updated_at: new Date().toISOString() })
      .eq('id', selectedShop.id)

    if (error) {
      // 失敗したら画面の選択も戻す（実際と違う状態に見えるのを防ぐ）
      setSmsAddressMode(prevSms)
      setWebReserveAddressMode(prevWeb)
      alert('設定の更新に失敗しました: ' + error.message)
    }
    setUpdatingMode(false)
  }

  async function fetchRooms() {
    if (!selectedShop) return
    setLoading(true)
    const [roomsRes, shopRes] = await Promise.all([
      supabase
        .from('rooms')
        .select('*')
        .eq('shop_id', selectedShop.id)
        .order('order', { ascending: true, nullsFirst: false }),
      supabase
        .from('shops')
        .select('sms_address_mode, web_reserve_address_mode')
        .eq('id', selectedShop.id)
        .single()
    ])

    if (roomsRes.error) {
      console.error('Error fetching rooms:', roomsRes.error)
    } else {
      setRooms((roomsRes.data as Room[]) || [])
    }

    if (shopRes.data) {
      setSmsAddressMode(shopRes.data.sms_address_mode || 'unified')
      setWebReserveAddressMode(shopRes.data.web_reserve_address_mode || 'unified')
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このルームを削除しますか？')) return
    const { error } = await supabase.from('rooms').delete().eq('id', id)
    if (error) {
      alert('削除に失敗しました: ' + error.message)
    } else {
      fetchRooms()
    }
  }

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, roomId: string) => {
    setDraggedId(roomId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => setDraggedId(null)

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent<HTMLTableRowElement>, targetRoom: Room) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetRoom.id) { setDraggedId(null); return }

    const draggedIndex = rooms.findIndex(r => r.id === draggedId)
    const targetIndex = rooms.findIndex(r => r.id === targetRoom.id)
    if (draggedIndex === -1 || targetIndex === -1) { setDraggedId(null); return }

    const newRooms = [...rooms]
    const [draggedItem] = newRooms.splice(draggedIndex, 1)
    newRooms.splice(targetIndex, 0, draggedItem)
    setRooms(newRooms)

    for (let i = 0; i < newRooms.length; i++) {
      await supabase.from('rooms').update({ order: i }).eq('id', newRooms[i].id)
    }
    setDraggedId(null)
  }

  useEffect(() => { fetchRooms() }, [selectedShop])

  return (
    <div className="bg-gray-100 p-2 md:p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-start mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">ルーム管理</h1>
            <p className="text-sm text-slate-500 mt-1">ルームの住所・地図と、ご来店時の案内文をまとめて管理します。ドラッグで並び順を変更できます。</p>
          </div>
          <Link
            href="/rooms/new"
            className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95 flex items-center gap-2 shrink-0 text-sm"
          >
            <span className="text-lg leading-none font-normal">+</span>
            <span>新規登録</span>
          </Link>
        </div>

        {/* 案内文の書き分け設定（各ルーム編集画面の入力欄の出し方を決める） */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
          <div className="mb-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>案内文の書き分け</span>
              {updatingMode && <span className="text-xs font-normal text-indigo-600">保存中...</span>}
            </h2>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              各ルームの案内文を1本にまとめるか、会員様用・新規様用に分けて書くかを選びます。
              分けると、新規のお客様には近くの目印だけ、会員様には住所と部屋番号、といった書き分けができます。
              ここで切り替えると、各ルームの編集画面に出る入力欄の数が変わります。
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { key: 'sms_address_mode' as const, label: 'SMSで送る案内文', current: smsAddressMode },
              { key: 'web_reserve_address_mode' as const, label: 'WEB予約で送る案内文', current: webReserveAddressMode },
            ]).map(({ key, label, current }) => (
              <div key={key} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-500 mb-2.5">{label}</label>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-start gap-2 text-sm cursor-pointer font-bold text-slate-700">
                    <input
                      type="radio"
                      name={key}
                      checked={current === 'unified'}
                      onChange={() => updateMode(key, 'unified')}
                      className="accent-indigo-600 w-4 h-4 cursor-pointer mt-0.5"
                    />
                    <span>
                      1本にまとめる
                      <span className="block text-[10px] font-normal text-slate-400">新規・会員に同じ案内文を送る</span>
                    </span>
                  </label>
                  <label className="inline-flex items-start gap-2 text-sm cursor-pointer font-bold text-slate-700">
                    <input
                      type="radio"
                      name={key}
                      checked={current === 'split_by_membership'}
                      onChange={() => updateMode(key, 'split_by_membership')}
                      className="accent-indigo-600 w-4 h-4 cursor-pointer mt-0.5"
                    />
                    <span>
                      新規／会員で分ける
                      <span className="block text-[10px] font-normal text-slate-400">相手に応じて案内文を書き分ける</span>
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>



        {loading ? (
          <div className="flex justify-center items-center py-20 text-indigo-600">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 font-medium">読み込み中...</span>
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-800 mb-2">ルームが登録されていません</h3>
            <p className="text-slate-500">右上の「新規ルーム登録」ボタンから、店舗のルームを追加してください。</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* PC用テーブル表示 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-sm font-medium text-slate-600">
                    <th className="w-10 px-3 py-4"></th>
                    <th className="px-6 py-4 whitespace-nowrap">ルーム名</th>
                    {selectedShop?.is_dispatch_enabled && <th className="px-6 py-4 whitespace-nowrap">区分</th>}
                    <th className="px-6 py-4 whitespace-nowrap">マンション名</th>
                    <th className="px-6 py-4 whitespace-nowrap hidden md:table-cell">テンプレ</th>
                    <th className="px-6 py-4 whitespace-nowrap w-32 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rooms.map((room) => (
                    <tr
                      key={room.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, room.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, room)}
                      className={`transition-all group ${draggedId === room.id
                          ? 'opacity-40 bg-indigo-50/60'
                          : 'hover:bg-slate-50/50'
                        }`}
                    >
                      <td className="px-3 py-4 w-10">
                        <div className="flex items-center justify-center text-slate-300 group-hover:text-indigo-400 transition-colors cursor-grab active:cursor-grabbing">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-slate-800">{room.name}</span>
                      </td>
                      {selectedShop?.is_dispatch_enabled && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {room.type === 'hotel' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200">
                              🏨 ホテル
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              🏠 ルーム
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {room.display_name || <span className="text-slate-400 italic">未設定</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-600 hidden md:table-cell whitespace-nowrap">
                        <div className="flex flex-col gap-1.5 text-[11px] font-semibold">
                          <div className="flex gap-1.5 items-center">
                            <span className="text-[10px] text-slate-400 w-16">SMS送信:</span>
                            {room.template_member
                              ? <span className="px-1.5 py-0.5 bg-indigo-50/60 text-indigo-600 rounded-md border border-indigo-100">会員あり</span>
                              : <span className="px-1.5 py-0.5 bg-slate-50 text-slate-400 rounded-md border border-slate-100">会員なし</span>
                            }
                            {room.template_new_customer
                              ? <span className="px-1.5 py-0.5 bg-indigo-50/60 text-indigo-600 rounded-md border border-indigo-100">新規あり</span>
                              : <span className="px-1.5 py-0.5 bg-slate-50 text-slate-400 rounded-md border border-slate-100">新規なし</span>
                            }
                          </div>
                          <div className="flex gap-1.5 items-center">
                            <span className="text-[10px] text-slate-400 w-16">WEB自動:</span>
                            {room.template_web_member
                              ? <span className="px-1.5 py-0.5 bg-emerald-50/60 text-emerald-600 rounded-md border border-emerald-100">{webReserveAddressMode === 'unified' ? '設定あり' : '会員あり'}</span>
                              : <span className="px-1.5 py-0.5 bg-slate-50 text-slate-400 rounded-md border border-slate-100">設定なし</span>
                            }
                            {webReserveAddressMode === 'split_by_membership' && (
                              room.template_web_new_customer
                                ? <span className="px-1.5 py-0.5 bg-emerald-50/60 text-emerald-600 rounded-md border border-emerald-100">新規あり</span>
                                : <span className="px-1.5 py-0.5 bg-slate-50 text-slate-400 rounded-md border border-slate-100">新規なし</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/rooms/${room.id}/edit`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                          >
                            <svg className="w-4 h-4 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>編集</span>
                          </Link>
                          <span className="text-slate-300 hidden md:inline">|</span>
                          <button
                            onClick={() => handleDelete(room.id)}
                            className="text-rose-500 hover:text-rose-700 font-medium text-sm transition-colors cursor-pointer"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* スマホ用リスト表示 */}
            <div className="block md:hidden divide-y divide-slate-100">
              {rooms.map((room, idx) => {
                const finalBgClass = idx % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-100 hover:bg-slate-200/80'
                return (
                  <div
                    key={room.id}
                    className={`p-3.5 transition-colors ${finalBgClass}`}
                  >
                    {/* 1行目: ルーム名 ＆ 操作 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-slate-800 text-sm whitespace-nowrap truncate">{room.name}</span>
                        {selectedShop?.is_dispatch_enabled && (
                          room.type === 'hotel' ? (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-violet-50 text-violet-700 border border-violet-200 shrink-0">
                              ホテル
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                              ルーム
                            </span>
                          )
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Link
                          href={`/rooms/${room.id}/edit`}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap"
                        >
                          編集
                        </Link>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={() => handleDelete(room.id)}
                          className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          削除
                        </button>
                      </div>
                    </div>

                    {/* 2行目: マンション名 ＆ テンプレ設定 */}
                    <div className="flex items-center justify-between text-xs text-slate-600 gap-2">
                      <span className="truncate whitespace-nowrap">
                        {room.display_name || <span className="text-slate-400 italic">マンション未設定</span>}
                      </span>
                      <div className="flex flex-col gap-1 text-[10px] shrink-0 font-bold items-end">
                        <div className="flex gap-1 items-center">
                          <span className="text-slate-400 text-[9px]">SMS:</span>
                          {room.template_member
                            ? <span className="px-1 py-0.2 bg-indigo-50/60 text-indigo-600 rounded border border-indigo-100 whitespace-nowrap">会員あり</span>
                            : <span className="px-1 py-0.2 bg-slate-50 text-slate-400 rounded border border-slate-100 whitespace-nowrap">会員なし</span>
                          }
                          {room.template_new_customer
                            ? <span className="px-1 py-0.2 bg-indigo-50/60 text-indigo-600 rounded border border-indigo-100 whitespace-nowrap">新規あり</span>
                            : <span className="px-1 py-0.2 bg-slate-50 text-slate-400 rounded border border-slate-100 whitespace-nowrap">新規なし</span>
                          }
                        </div>
                        <div className="flex gap-1 items-center">
                          <span className="text-slate-400 text-[9px]">WEB:</span>
                          {room.template_web_member
                            ? <span className="px-1 py-0.2 bg-emerald-50/60 text-emerald-600 rounded border border-emerald-100 whitespace-nowrap">{webReserveAddressMode === 'unified' ? '設定あり' : '会員あり'}</span>
                            : <span className="px-1 py-0.2 bg-slate-50 text-slate-400 rounded border border-slate-100 whitespace-nowrap">設定なし</span>
                          }
                          {webReserveAddressMode === 'split_by_membership' && (
                            room.template_web_new_customer
                              ? <span className="px-1 py-0.2 bg-emerald-50/60 text-emerald-600 rounded border border-emerald-100 whitespace-nowrap">新規あり</span>
                              : <span className="px-1 py-0.2 bg-slate-50 text-slate-400 rounded border border-slate-100 whitespace-nowrap">新規なし</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
