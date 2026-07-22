'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import TimeSelectHM from './TimeSelectHM'

interface Therapist {
  id: string
  name: string
  avatar?: string
}

interface Room {
  id: string
  name: string
}

interface Shift {
  id: string
  therapist_id: string
  room_id: string | null
  date: string
  start_time: string
  end_time: string
}


interface WeeklyShiftCalendarProps {
  therapists: Therapist[]
  onShiftUpdate?: () => void
  showOnlyWithShift?: boolean
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** HH:MM 形式（24:00+ 含む）を分に変換 */
const toMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** 表示用時刻 (24:00+ 含む) → DB用 HH:MM:SS */
const displayToDbTime = (t: string): string => {
  const [h, m] = t.split(':').map(Number)
  const actualH = h >= 24 ? h - 24 : h
  return `${String(actualH).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

/** DBの時刻 (HH:MM:SS) を表示用 (HH:MM) に変換。6:00未満は翌日扱いとして +24 する */
const dbToDisplay = (dbTime: string): string => {
  if (!dbTime) return ''
  const [h, m] = dbTime.slice(0, 5).split(':').map(Number)
  if (h < 6) {
    return `${String(h + 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  return dbTime.slice(0, 5)
}


const WeeklyShiftCalendar: React.FC<WeeklyShiftCalendarProps> = ({ therapists, onShiftUpdate, showOnlyWithShift = false }) => {
  const { selectedShop } = useShop()
  const [weekStartDate, setWeekStartDate] = useState(new Date())
  const [rooms, setRooms] = useState<Room[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [selectedTherapistId, setSelectedTherapistId] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [roomId, setRoomId] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('18:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const dayLabels = ['日', '月', '火', '水', '木', '金', '土']

  const weekDates = useMemo(() => {
    const dates: Date[] = []
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(weekStartDate)
      d.setDate(weekStartDate.getDate() + i)
      dates.push(d)
    }
    return dates
  }, [weekStartDate])

  // 部屋の取得
  useEffect(() => {
    const run = async () => {
      if (!selectedShop) {
        setRooms([])
        return
      }
      const { data } = await supabase.from('rooms').select('id, name').eq('shop_id', selectedShop.id).order('order', { ascending: true, nullsFirst: false })
      setRooms((data as Room[]) || [])
    }
    void run()
  }, [selectedShop])

  // 週のシフトを取得
  const fetchWeeklyShifts = async () => {
    if (!selectedShop) return
    const startDate = formatDate(weekDates[0])
    const endDate = formatDate(weekDates[6])
    const { data } = await supabase
      .from('shifts')
      .select('id, therapist_id, room_id, date, start_time, end_time')
      .eq('shop_id', selectedShop.id)
      .gte('date', startDate)
      .lte('date', endDate)
    setShifts((data as Shift[]) || [])
  }

  useEffect(() => {
    void fetchWeeklyShifts()
  }, [selectedShop, weekDates])

  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift>()
    shifts.forEach((s) => map.set(`${s.therapist_id}_${s.date}`, s))
    return map
  }, [shifts])

  const filteredTherapists = useMemo(() => {
    const todayStr = formatDate(new Date())
    // 当日以降の日付リスト（表示週内で今日以降）
    const upcomingDates = weekDates.map(formatDate).filter(d => d >= todayStr)

    // まず showOnlyWithShift でフィルター
    const listByShift = showOnlyWithShift
      ? (() => { const ids = new Set(shifts.map((s) => s.therapist_id)); return therapists.filter((t) => ids.has(t.id)) })()
      : therapists

    // 検索クエリでフィルター（空白区切り複数ワード対応）
    const query = searchQuery.trim()
    const list = query
      ? listByShift.filter((t) =>
          query.split(/\s+/).every((word) =>
            t.name.toLowerCase().includes(word.toLowerCase())
          )
        )
      : listByShift

    // セラピストごとに「当日以降で最初にあるシフト」を取得（当日優先）
    const firstShift = (therapistId: string): Shift | null => {
      for (const d of upcomingDates) {
        const s = shiftMap.get(`${therapistId}_${d}`)
        if (s) return s
      }
      return null
    }

    return [...list].sort((a, b) => {
      const sa = firstShift(a.id)
      const sb = firstShift(b.id)
      if (!sa && !sb) return 0
      if (!sa) return 1
      if (!sb) return -1
      // 日付が違う場合は日付優先、同日なら開始時刻で比較
      if (sa.date !== sb.date) return sa.date.localeCompare(sb.date)
      return sa.start_time.localeCompare(sb.start_time)
    })
  }, [therapists, shifts, showOnlyWithShift, shiftMap, weekDates, searchQuery])

  const openModal = (therapistId: string, date: string) => {
    const existing = shiftMap.get(`${therapistId}_${date}`) || null
    setEditingShift(existing)
    setSelectedTherapistId(therapistId)
    setSelectedDate(date)
    setRoomId(existing?.room_id || '')
    setStartTime(existing ? dbToDisplay(existing.start_time) : '10:00')
    setEndTime(existing ? dbToDisplay(existing.end_time) : '18:00')
    setError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingShift(null)
  }

  const saveShift = async () => {
    if (!selectedShop || !selectedTherapistId || !selectedDate) return
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      setError('終了時刻は開始時刻より後にしてください')
      return
    }

    setSaving(true)
    const payload = {
      therapist_id: selectedTherapistId,
      shop_id: selectedShop.id,
      date: selectedDate,
      room_id: roomId || null,
      start_time: displayToDbTime(startTime),
      end_time: displayToDbTime(endTime),
    }

    const result = editingShift
      ? await supabase.from('shifts').update(payload).eq('id', editingShift.id)
      : await supabase.from('shifts').insert([payload])

    setSaving(false)
    if (result.error) {
      let msg = result.error.message
      if (msg.includes('duplicate key value violates unique constraint') || msg.includes('shifts_therapist_id_date_start_time_end_time_key')) {
        msg = 'このセラピストは、指定された日に同じ時間帯で既にシフトが登録されています。'
      }
      setError('保存に失敗しました: ' + msg)
      return
    }

    closeModal()
    void fetchWeeklyShifts()
    onShiftUpdate?.()
  }

  const deleteShift = async () => {
    if (!editingShift) return
    if (!confirm('このシフトを削除しますか？')) return
    setSaving(true)
    const { error: deleteError } = await supabase.from('shifts').delete().eq('id', editingShift.id)
    setSaving(false)
    if (deleteError) {
      setError('削除に失敗しました: ' + deleteError.message)
      return
    }
    closeModal()
    void fetchWeeklyShifts()
    onShiftUpdate?.()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col h-full">
      {/* ナビゲーションバー */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70 flex-shrink-0 gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <button
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors shadow-sm flex items-center gap-1"
            onClick={() => setWeekStartDate(new Date())}
          >
            今日
          </button>
          <div className="flex items-center gap-1.5">
            <button
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              onClick={() => setWeekStartDate(new Date(weekStartDate.getTime() - 7 * 86400000))}
            >
              ← 前の週
            </button>
            <button
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              onClick={() => setWeekStartDate(new Date(weekStartDate.getTime() + 7 * 86400000))}
            >
              次の週 →
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
          <div className="flex items-center gap-1.5">
            <label htmlFor="calendar-start-date-input" className="text-xs text-slate-500 font-medium whitespace-nowrap">日付指定:</label>
            <input
              id="calendar-start-date-input"
              type="date"
              value={formatDate(weekStartDate)}
              onChange={(e) => {
                const val = e.target.value
                if (val) {
                  setWeekStartDate(parseLocalDate(val))
                }
              }}
              className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white shadow-sm font-medium text-slate-700 cursor-pointer"
            />
          </div>
          <h2 className="font-bold text-slate-800 text-sm md:text-base whitespace-nowrap border-l border-slate-200 pl-3">
            {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
          </h2>
        </div>
      </div>

      {/* セラピスト検索バー */}
      <div className="px-5 py-3 border-b border-slate-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              id="therapist-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="セラピスト名で絞り込み..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="検索をクリア"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery.trim() ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {filteredTherapists.length}名表示中
              </span>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-500 hover:text-indigo-600 underline transition-colors"
              >
                全員表示
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-400">
              全{therapists.length}名
            </span>
          )}
        </div>
      </div>

      <div className="overflow-auto flex-1">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 left-0 bg-slate-50 z-20 border-b border-slate-100">セラピスト</th>
              {weekDates.map((d) => {
                const dateText = formatDate(d)
                const isToday = dateText === formatDate(new Date())
                return (
                  <th key={dateText} className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider min-w-[110px] sticky top-0 bg-slate-50 z-10 border-b border-slate-100 ${isToday ? 'text-indigo-600' : 'text-slate-500'}`}>
                    <div className={isToday ? 'font-bold' : ''}>{d.getMonth()+1}/{d.getDate()}</div>
                    <div className={`text-[10px] mt-1 ${isToday ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}>{dayLabels[d.getDay()]}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filteredTherapists.map((t) => (
              <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-800 sticky left-0 bg-white z-10">{t.name}</td>
                {weekDates.map((d) => {
                  const dateStr = formatDate(d)
                  const shift = shiftMap.get(`${t.id}_${dateStr}`)
                  return (
                    <td key={dateStr} className="p-2 text-center">
                      <button
                        className={`w-full rounded-xl border px-2.5 py-2 text-xs font-medium transition-all ${
                          shift
                            ? 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                        onClick={() => openModal(t.id, dateStr)}
                      >
                        {shift ? (
                          <div className="flex flex-col gap-0.5">
                            <div>{dbToDisplay(shift.start_time)} - {dbToDisplay(shift.end_time)}</div>
                            {shift.room_id && (
                              <div className="text-[10px] text-indigo-400 font-bold truncate">
                                {rooms.find(r => r.id === shift.room_id)?.name || 'ルーム不明'}
                              </div>
                            )}
                          </div>
                        ) : '未登録'}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
            {filteredTherapists.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-slate-500">表示できるセラピストがいません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5 border border-slate-100 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">{editingShift ? 'シフト編集' : 'シフト登録'}</h3>
            {error && <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">ルーム</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">未選択</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">開始</label>
                <TimeSelectHM
                  value={startTime}
                  onChange={setStartTime}
                  selectClassName="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">終了</label>
                <TimeSelectHM
                  value={endTime}
                  onChange={setEndTime}
                  selectClassName="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              {editingShift && <button className="px-4 py-2.5 text-rose-600 hover:bg-rose-50 rounded-lg" onClick={() => void deleteShift()} disabled={saving}>削除</button>}
              <button className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50" onClick={closeModal}>キャンセル</button>
              <button className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700" onClick={() => void saveShift()} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default WeeklyShiftCalendar
