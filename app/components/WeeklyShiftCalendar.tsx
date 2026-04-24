'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

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

/**
 * DB時刻を表示用に変換。終了時刻が開始時刻以下なら +24h して 24:xx 形式にする。
 * @param dbTime  DB の end_time (HH:MM:SS)
 * @param refDbTime DB の start_time (HH:MM:SS)
 */
const dbTimeToDisplay = (dbTime: string, refDbTime: string): string => {
  const base = dbTime.slice(0, 5)
  const ref = refDbTime.slice(0, 5)
  if (toMinutes(base) <= toMinutes(ref)) {
    const [h, m] = base.split(':').map(Number)
    return `${String(h + 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  return base
}

/** 08:00 〜 29:00 を 30 分刻みで列挙 */
const TIME_OPTIONS: string[] = []
for (let h = 8; h <= 29; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 29) TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
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

    const list = showOnlyWithShift
      ? (() => { const ids = new Set(shifts.map((s) => s.therapist_id)); return therapists.filter((t) => ids.has(t.id)) })()
      : therapists

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
  }, [therapists, shifts, showOnlyWithShift, shiftMap, weekDates])

  const openModal = (therapistId: string, date: string) => {
    const existing = shiftMap.get(`${therapistId}_${date}`) || null
    setEditingShift(existing)
    setSelectedTherapistId(therapistId)
    setSelectedDate(date)
    setRoomId(existing?.room_id || '')
    setStartTime(existing?.start_time.slice(0, 5) || '10:00')
    setEndTime(existing ? dbTimeToDisplay(existing.end_time, existing.start_time) : '18:00')
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
      setError('保存に失敗しました: ' + result.error.message)
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
      <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70 flex-shrink-0">
        <button
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          onClick={() => setWeekStartDate(new Date(weekStartDate.getTime() - 7 * 86400000))}
        >
          ← 前の週
        </button>
        <h2 className="font-bold text-slate-800 text-sm md:text-base">
          {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
        </h2>
        <button
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          onClick={() => setWeekStartDate(new Date(weekStartDate.getTime() + 7 * 86400000))}
        >
          次の週 →
        </button>
      </div>

      <div className="overflow-auto flex-1">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 z-10">セラピスト</th>
              {weekDates.map((d) => {
                const dateText = formatDate(d)
                const isToday = dateText === formatDate(new Date())
                return (
                  <th key={dateText} className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider min-w-[110px] ${isToday ? 'text-indigo-600' : 'text-slate-500'}`}>
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
                            <div>{shift.start_time.slice(0, 5)} - {dbTimeToDisplay(shift.end_time, shift.start_time)}</div>
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
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">終了</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
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
