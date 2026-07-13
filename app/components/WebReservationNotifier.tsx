'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import { useAuth } from '@/app/contexts/AuthContext'
import { useRouter } from 'next/navigation'

interface NotifItem {
  id: string
  shopName: string
  customerName: string
  therapistName: string
  date: string
  startTime: string
  endTime: string
  courseName: string
  receivedAt: Date
  source: string
}

function playBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
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
  } catch { /* AudioContext が使えない環境では無視 */ }
}

export default function WebReservationNotifier() {
  const { shops } = useShop()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<NotifItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  
  // stale closure 対策：最新の shops を ref で保持
  const shopsRef = useRef(shops)
  useEffect(() => { shopsRef.current = shops }, [shops])

  // 通知許可リクエスト
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isMobile) return;

    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [])

  // 初期ロード：未処理(is_handled === false)のWEB予約を取得
  useEffect(() => {
    if (shops.length === 0 || authLoading || !user) return

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isMobile) return

    async function loadUnhandled() {
      const shopIds = shopsRef.current.map(s => s.id)
      if (shopIds.length === 0) return

      try {
        const { data, error } = await supabase
          .from('reservations')
          .select(`
            id,
            date,
            start_time,
            end_time,
            source,
            notes,
            customer_id,
            therapist_id,
            course_id,
            shop_id,
            created_at
          `)
          .in('shop_id', shopIds)
          .eq('source', 'web')
          .eq('is_handled', false)
          .order('created_at', { ascending: false })

        if (error) throw error

        if (data && data.length > 0) {
          const loadedItems: NotifItem[] = []
          for (const row of data) {
            const shop = shopsRef.current.find(s => s.id === row.shop_id)
            if (!shop) continue

            // 顧客名、セラピスト名、コース名を取得
            const [custRes, therapistRes, courseRes] = await Promise.all([
              row.customer_id
                ? supabase.from('customers').select('name').eq('id', row.customer_id).maybeSingle()
                : Promise.resolve({ data: null }),
              row.therapist_id
                ? supabase.from('therapists').select('name').eq('id', row.therapist_id).maybeSingle()
                : Promise.resolve({ data: null }),
              row.course_id
                ? supabase.from('courses').select('name').eq('id', row.course_id).maybeSingle()
                : Promise.resolve({ data: null }),
            ])

            const isMail = row.notes?.includes('【メール同期自動登録】')
            loadedItems.push({
              id: row.id,
              shopName: shop.name,
              customerName: custRes.data?.name ?? '不明',
              therapistName: therapistRes.data?.name ?? 'フリー（未割当）',
              date: row.date,
              startTime: row.start_time?.slice(0, 5) ?? '',
              endTime: row.end_time?.slice(0, 5) ?? '',
              courseName: courseRes.data?.name ?? '',
              receivedAt: new Date(row.created_at || new Date()),
              source: isMail ? 'mail_sync' : row.source,
            })
          }
          setItems(loadedItems)
        }
      } catch (err) {
        console.error('Failed to load unhandled reservations:', err)
      }
    }

    void loadUnhandled()
  }, [shops.length, authLoading, user?.id])

  // Realtime 購読
  useEffect(() => {
    if (shops.length === 0 || authLoading || !user) return

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isMobile) return

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel('web-reservations-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reservations' },
        async (payload) => {
          try {
            const row = payload.new as any
            if (row.source !== 'web' || row.is_handled === true) return

            const shop = shopsRef.current.find(s => s.id === row.shop_id)
            if (!shop) return

            const [custRes, therapistRes, courseRes] = await Promise.all([
              row.customer_id
                ? supabase.from('customers').select('name').eq('id', row.customer_id).maybeSingle()
                : Promise.resolve({ data: null }),
              row.therapist_id
                ? supabase.from('therapists').select('name').eq('id', row.therapist_id).maybeSingle()
                : Promise.resolve({ data: null }),
              row.course_id
                ? supabase.from('courses').select('name').eq('id', row.course_id).maybeSingle()
                : Promise.resolve({ data: null }),
            ])

            const isMail = row.notes?.includes('【メール同期自動登録】')
            const notif: NotifItem = {
              id: row.id,
              shopName: shop.name,
              customerName: custRes.data?.name ?? '不明',
              therapistName: therapistRes.data?.name ?? 'フリー（未割当）',
              date: row.date,
              startTime: row.start_time?.slice(0, 5) ?? '',
              endTime: row.end_time?.slice(0, 5) ?? '',
              courseName: courseRes.data?.name ?? '',
              receivedAt: new Date(),
              source: isMail ? 'mail_sync' : row.source,
            }

            setItems(prev => {
              if (prev.some(item => item.id === notif.id)) return prev
              return [notif, ...prev]
            })
            playBeep()

            // ブラウザ通知
            if ('Notification' in window && Notification.permission === 'granted') {
              const isMail = notif.source === 'mail_sync'
              new Notification(`【${shop.name}】新規${isMail ? 'メール' : 'Web'}予約！`, {
                body: `${notif.customerName} 様 ／ ${notif.therapistName} ／ ${notif.date} ${notif.startTime}〜${notif.endTime}`,
                icon: '/favicon.ico',
                requireInteraction: true,
              })
            }
          } catch (err) {
            console.error('Realtime notification insert error:', err)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reservations' },
        async (payload) => {
          const row = payload.new as any
          if (row.is_handled === true) {
            // 他の端末で処理されたらリストから自動削除
            setItems(prev => prev.filter(item => item.id !== row.id))
          } else if (row.is_handled === false && row.source === 'web') {
            // 処理済みから未処理に戻された場合は通知リストに追加する
            const shop = shopsRef.current.find(s => s.id === row.shop_id)
            if (!shop) return

            const [custRes, therapistRes, courseRes] = await Promise.all([
              row.customer_id
                ? supabase.from('customers').select('name').eq('id', row.customer_id).maybeSingle()
                : Promise.resolve({ data: null }),
              row.therapist_id
                ? supabase.from('therapists').select('name').eq('id', row.therapist_id).maybeSingle()
                : Promise.resolve({ data: null }),
              row.course_id
                ? supabase.from('courses').select('name').eq('id', row.course_id).maybeSingle()
                : Promise.resolve({ data: null }),
            ])

            const isMail = row.notes?.includes('【メール同期自動登録】')
            const notif: NotifItem = {
              id: row.id,
              shopName: shop.name,
              customerName: custRes.data?.name ?? '不明',
              therapistName: therapistRes.data?.name ?? 'フリー（未割当）',
              date: row.date,
              startTime: row.start_time?.slice(0, 5) ?? '',
              endTime: row.end_time?.slice(0, 5) ?? '',
              courseName: courseRes.data?.name ?? '',
              receivedAt: new Date(),
              source: isMail ? 'mail_sync' : row.source,
            }

            setItems(prev => {
              if (prev.some(item => item.id === notif.id)) return prev
              return [notif, ...prev]
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reservations' },
        async (payload) => {
          const row = payload.old as any
          setItems(prev => prev.filter(item => item.id !== row.id))
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      void supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [shops.length, authLoading, user?.id])

  if (items.length === 0) return null

  const handleCardClick = (id: string) => {
    router.push(`/reservations/${id}`)
    setIsOpen(false)
  }

  return (
    <div className="fixed right-6 bottom-6 z-[9990] flex flex-col items-end gap-3 pointer-events-none">
      {/* 展開された予約通知カードリスト */}
      {isOpen && (
        <div className="pointer-events-auto w-80 max-h-[400px] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 space-y-3 animate-slide-up mb-2">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              未対応のWEB予約 ({items.length})
            </span>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors text-xs font-semibold"
            >
              閉じる
            </button>
          </div>
          <div className="space-y-2">
            {items.map((notif) => (
              <div 
                key={notif.id}
                onClick={() => handleCardClick(notif.id)}
                className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 hover:bg-indigo-50/50 hover:border-indigo-200 transition-all duration-200 cursor-pointer text-left space-y-1 group"
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black">
                    {notif.source === 'mail_sync' ? 'メール予約' : 'WEB予約'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {notif.receivedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs font-black text-slate-700 truncate group-hover:text-indigo-600">
                  {notif.customerName} 様 ({notif.therapistName})
                </p>
                <p className="text-[10px] text-slate-500 font-bold">
                  {notif.date} {notif.startTime}〜{notif.endTime}
                </p>
                <p className="text-[9px] text-slate-400 truncate">
                  {notif.courseName}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* フローティング通知警告バッジ */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-full text-white shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
        style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 40%, #991b1b 100%)'
        }}
      >
        <div className="relative">
          <svg className="w-5 h-5 animate-swing" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute -top-1.5 -right-1.5 bg-white text-red-600 text-[10px] font-black rounded-full h-4 w-4 flex items-center justify-center border border-red-600 shadow-sm">
            {items.length}
          </span>
        </div>
        <span className="text-xs font-black tracking-tight">未対応のWEB予約があります</span>
      </button>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes swing {
          0%, 100% { transform: rotate(0); }
          10%, 30% { transform: rotate(15deg); }
          20% { transform: rotate(-15deg); }
          40% { transform: rotate(-10deg); }
          50% { transform: rotate(10deg); }
          60% { transform: rotate(-5deg); }
          70% { transform: rotate(5deg); }
          80%, 90% { transform: rotate(0); }
        }
        .animate-swing {
          animation: swing 2s ease infinite;
          transform-origin: top center;
        }
      `}</style>
    </div>
  )
}
