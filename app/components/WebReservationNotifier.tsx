'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

interface NotifItem {
  id: string
  customerName: string
  therapistName: string
  date: string
  startTime: string
  endTime: string
  courseName: string
  receivedAt: Date
}

function playBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const beep = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(0.35, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }
    beep(880, 0, 0.15)
    beep(1100, 0.18, 0.15)
    beep(880, 0.36, 0.25)
  } catch { /* ignore if AudioContext not available */ }
}

export default function WebReservationNotifier() {
  const { selectedShop } = useShop()
  const [items, setItems] = useState<NotifItem[]>([])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const shopIdRef = useRef<string | null>(null)

  const dismiss = useCallback((id: string) => {
    setItems(prev => prev.filter(n => n.id !== id))
  }, [])

  const dismissAll = useCallback(() => setItems([]), [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    if (!selectedShop) return
    if (shopIdRef.current === selectedShop.id) return
    shopIdRef.current = selectedShop.id

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`web-reservations-${selectedShop.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reservations',
        },
        async (payload) => {
          const row = payload.new as Record<string, unknown>
          if (row.shop_id !== selectedShop.id) return
          if (row.source !== 'web') return

          const [custRes, therapistRes, courseRes] = await Promise.all([
            supabase.from('customers').select('name').eq('id', row.customer_id as string).single(),
            supabase.from('therapists').select('name').eq('id', row.therapist_id as string).single(),
            row.course_id
              ? supabase.from('courses').select('name').eq('id', row.course_id as string).single()
              : Promise.resolve({ data: null }),
          ])

          const notif: NotifItem = {
            id: row.id as string,
            customerName: (custRes.data as { name: string } | null)?.name ?? '不明',
            therapistName: (therapistRes.data as { name: string } | null)?.name ?? '不明',
            date: row.date as string,
            startTime: (row.start_time as string)?.slice(0, 5) ?? '',
            endTime: (row.end_time as string)?.slice(0, 5) ?? '',
            courseName: (courseRes.data as { name: string } | null)?.name ?? '',
            receivedAt: new Date(),
          }

          setItems(prev => [notif, ...prev])
          playBeep()

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('新規Web予約が入りました！', {
              body: `${notif.customerName} 様 ／ ${notif.therapistName} ／ ${notif.date} ${notif.startTime}〜${notif.endTime}`,
              icon: '/favicon.ico',
              requireInteraction: true,
            })
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      void supabase.removeChannel(channel)
      channelRef.current = null
      shopIdRef.current = null
    }
  }, [selectedShop])

  if (items.length === 0) return null

  return (
    <>
      {/* 暗いオーバーレイ */}
      <div
        className="fixed inset-0 bg-black/40 z-[9990] backdrop-blur-[2px]"
        onClick={items.length === 1 ? () => dismiss(items[0].id) : undefined}
      />

      {/* 通知スタック */}
      <div className="fixed inset-x-0 top-0 z-[9999] flex flex-col items-center gap-3 pt-4 px-4 pointer-events-none">
        {items.map((notif, i) => (
          <div
            key={notif.id}
            className="pointer-events-auto w-full max-w-lg animate-slide-down"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-red-300"
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 40%, #991b1b 100%)',
              }}
            >
              {/* 脈動するリング */}
              <span className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 animate-ping" />
              <span className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-white/15 animate-ping" style={{ animationDelay: '150ms' }} />

              <div className="relative px-5 py-4">
                {/* ヘッダー行 */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-bounce">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-lg leading-tight tracking-tight">
                      🔔 新規Web予約が入りました！
                    </p>
                    <p className="text-red-200 text-xs font-medium mt-0.5">
                      {notif.receivedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 受信
                    </p>
                  </div>
                  <button
                    onClick={() => dismiss(notif.id)}
                    className="flex-shrink-0 text-white/60 hover:text-white transition-colors p-1"
                    aria-label="閉じる"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* 予約詳細 */}
                <div className="bg-white/15 rounded-xl px-4 py-3 space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-200 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-white font-bold text-base">{notif.customerName} 様</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                    <div className="flex items-center gap-1.5 text-white">
                      <svg className="w-3.5 h-3.5 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="font-semibold">{notif.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white">
                      <svg className="w-3.5 h-3.5 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-semibold">{notif.startTime}〜{notif.endTime}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white">
                      <svg className="w-3.5 h-3.5 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      <span className="font-semibold">{notif.therapistName}</span>
                    </div>
                    {notif.courseName && (
                      <div className="flex items-center gap-1.5 text-white">
                        <svg className="w-3.5 h-3.5 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span className="font-semibold">{notif.courseName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ボタン */}
                <div className="flex gap-2">
                  <button
                    onClick={() => dismiss(notif.id)}
                    className="flex-1 py-2.5 bg-white text-red-700 font-black rounded-xl hover:bg-red-50 transition-colors text-sm shadow-lg"
                  >
                    確認しました
                  </button>
                  {items.length > 1 && i === 0 && (
                    <button
                      onClick={dismissAll}
                      className="px-4 py-2.5 bg-white/20 text-white font-bold rounded-xl hover:bg-white/30 transition-colors text-sm"
                    >
                      全て閉じる
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slide-down {
          from { transform: translateY(-120%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        .animate-slide-down {
          animation: slide-down 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
      `}</style>
    </>
  )
}
