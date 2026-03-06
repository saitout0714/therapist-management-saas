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
  shifts: Shift[]
  onDateClick?: (therapistId: string, date: string) => void
  onShiftUpdate?: () => void
  showOnlyWithShift?: boolean
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const WeeklyShiftCalendar: React.FC<WeeklyShiftCalendarProps> = ({ therapists, shifts, onShiftUpdate, showOnlyWithShift = false }) => {
  const { selectedShop } = useShop()
  const [weekStartDate, setWeekStartDate] = useState(new Date())
  const [rooms, setRooms] = useState<Room[]>([])
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

  const filteredTherapists = useMemo(() => {
    if (!showOnlyWithShift) return therapists
    const ids = new Set(shifts.map((s) => s.therapist_id))
    return therapists.filter((t) => ids.has(t.id))
  }, [therapists, shifts, showOnlyWithShift])

  useEffect(() => {
    const run = async () => {
      if (!selectedShop) {
        setRooms([])
        return
      }
      const { data } = await supabase.from('rooms').select('id, name').eq('shop_id', selectedShop.id)
      setRooms((data as Room[]) || [])
    }
    void run()
  }, [selectedShop])

  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift>()
    shifts.forEach((s) => map.set(`${s.therapist_id}_${s.date}`, s))
    return map
  }, [shifts])

  const openModal = (therapistId: string, date: string) => {
    const existing = shiftMap.get(`${therapistId}_${date}`) || null
    setEditingShift(existing)
    setSelectedTherapistId(therapistId)
    setSelectedDate(date)
    setRoomId(existing?.room_id || '')
    setStartTime(existing?.start_time.slice(0, 5) || '10:00')
    setEndTime(existing?.end_time.slice(0, 5) || '18:00')
    setError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingShift(null)
  }

  const saveShift = async () => {
    if (!selectedShop || !selectedTherapistId || !selectedDate) return
    if (endTime <= startTime) {
      setError('終了時刻は開始時刻より後にしてください')
      return
    }

    setSaving(true)
    const payload = {
      therapist_id: selectedTherapistId,
      shop_id: selectedShop.id,
      date: selectedDate,
      room_id: roomId || null,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
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
    onShiftUpdate?.()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
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

      <div className="overflow-auto">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 z-10">セラピスト</th>
              {weekDates.map((d) => {
                const dateText = formatDate(d)
                return (
                  <th key={dateText} className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[110px]">
                    <div>{dateText.slice(5)}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{dayLabels[d.getDay()]}</div>
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
                        {shift ? `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}` : '未登録'}
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
                <input type="time" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">終了</label>
                <input type="time" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
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
