'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type CustomOption = {
  option_id: string | null
  price: number
  custom_name: string | null
  options: {
    name: string
    price: number
    duration: number
  } | null
}

type ReservationDiscount = {
  applied_amount: number
  adhoc_name: string | null
  is_adhoc: boolean
  policy: { name: string } | null
}

type Reservation = {
  id: string
  customer_id: string
  therapist_id: string
  course_id: string
  date: string
  start_time: string
  end_time: string
  base_price: number
  options_price: number
  nomination_fee: number
  total_price: number
  discount_amount: number
  designation_type: 'free' | 'nomination' | 'confirmed' | 'princess'
  notes: string | null
  status: 'pending' | 'confirmed' | 'cancelled'
  payment_method: 'cash' | 'credit' | null
  options_payment_method: 'cash' | 'credit' | null
  credit_fee_amount: number
  customers: { name: string; phone: string | null; email: string | null } | null
  courses: { name: string; duration: number; base_price: number } | null
  therapists: { name: string } | null
  reservation_options: CustomOption[]
  reservation_discounts: ReservationDiscount[]
}

type RoomInfo = {
  name: string
  address: string | null
  google_map_url: string | null
}

export default function ReservationPreviewPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const reservationId = params.id as string
  const fromPage = searchParams.get('from')
  const { selectedShop } = useShop()

  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null)
  const [designationMap, setDesignationMap] = useState<Record<string, string>>({})
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReservationAndRoom()
  }, [selectedShop, reservationId])

  const fetchReservationAndRoom = async () => {
    if (!selectedShop || !reservationId) return
    try {
      // 1. Fetch Reservation
      const { data: resData, error: resError } = await supabase
        .from('reservations')
        .select(`
          *,
          customers(name, phone, email),
          courses(name, duration, base_price),
          therapists!reservations_therapist_id_fkey(name),
          reservation_options(
            option_id, price, custom_name,
            options(name, price, duration)
          ),
          reservation_discounts(
            applied_amount, adhoc_name, is_adhoc,
            policy:discount_policies(name)
          )
        `)
        .eq('id', reservationId)
        .eq('shop_id', selectedShop.id)
        .single()

      if (resError) throw resError
      if (!resData) throw new Error('予約が見つかりません')

      setReservation(resData as unknown as Reservation)

      // 2. 新規/会員判定（当該予約より前の予約があれば会員）
      const { count } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', resData.customer_id)
        .eq('shop_id', selectedShop.id)
        .neq('id', reservationId)
        .lt('date', resData.date)
      setIsNewCustomer((count ?? 0) === 0)

      // 3. Fetch designation_types for display_name mapping
      const { data: dtData } = await supabase
        .from('designation_types')
        .select('slug, display_name')
        .eq('shop_id', selectedShop.id)
      if (dtData) {
        const map: Record<string, string> = {}
        dtData.forEach((d: { slug: string; display_name: string }) => { map[d.slug] = d.display_name })
        setDesignationMap(map)
      }

      // 3. Fetch Room from Shift
      const { data: shiftData, error: shiftError } = await supabase
        .from('shifts')
        .select(`
          rooms(name, address, google_map_url)
        `)
        .eq('therapist_id', resData.therapist_id)
        .eq('date', resData.date)
        .eq('shop_id', selectedShop.id)
        .maybeSingle()

      if (!shiftError && shiftData?.rooms) {
        // Because of Supabase return types of joined tables
        const room = Array.isArray(shiftData.rooms) ? shiftData.rooms[0] : shiftData.rooms
        setRoomInfo({
          name: room?.name || '',
          address: room?.address || null,
          google_map_url: room?.google_map_url || null,
        })
      }
    } catch (error) {
      console.error('予約詳細の取得に失敗:', error)
      alert('予約詳細の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const designationLabel = (type: string) => {
    if (designationMap[type]) return designationMap[type]
    // フォールバック（DBに存在しない場合）
    switch (type) {
      case 'free': return 'フリー'
      case 'nomination': return '指名'
      case 'first_nomination': return '初回指名'
      case 'confirmed': return '本指名'
      case 'princess': return '姫予約'
      default: return type
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '保留中'
      case 'confirmed': return '確定'
      case 'cancelled': return 'キャンセル'
      default: return status
    }
  }

  const statusStyle = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800 border border-amber-200'
      case 'confirmed': return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      case 'cancelled': return 'bg-slate-100 text-slate-800 border border-slate-200'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  const generateCustomerLineText = () => {
    if (!reservation) return ''

    let text = `【ご予約内容のご確認】\n\n`

    // 日時（日付と時間を別行）
    text += `■ 日時\n${reservation.date}\n${reservation.start_time.slice(0, 5)} ～ ${reservation.end_time.slice(0, 5)}\n\n`

    // コース（コース名＋料金、オプションも各行）
    text += `■ コース\n`
    text += `${reservation.courses?.name || ''} ￥${reservation.base_price.toLocaleString()}\n`
    reservation.reservation_options?.forEach(ro => {
      if (ro.option_id && ro.options) {
        // 通常オプション
        text += `${ro.options.name} ￥${ro.options.price.toLocaleString()}\n`
      } else if (!ro.option_id && ro.custom_name) {
        // 手入力オプション
        text += `${ro.custom_name} ￥${ro.price.toLocaleString()}\n`
      }
    })

    // 指名（指名料がある場合のみ）
    if (reservation.nomination_fee > 0) {
      text += `\n■ 指名\n${designationLabel(reservation.designation_type)} ￥${reservation.nomination_fee.toLocaleString()}\n`
    }

    // お支払い予定金額
    text += `\n■ お支払い予定金額\n`
    text += `基本料金：￥${reservation.base_price.toLocaleString()}\n`
    if (reservation.options_price > 0) {
      text += `オプション：￥${reservation.options_price.toLocaleString()}\n`
    }
    if (reservation.nomination_fee > 0) {
      text += `指名料：￥${reservation.nomination_fee.toLocaleString()}\n`
    }
    if (reservation.discount_amount > 0) {
      text += `割引：-￥${reservation.discount_amount.toLocaleString()}\n`
    }
    text += `------------------------\n`
    text += `合計：￥${reservation.total_price.toLocaleString()}\n`
    if (reservation.credit_fee_amount > 0) {
      text += `クレジット手数料：￥${reservation.credit_fee_amount.toLocaleString()}\n`
      text += `💳 クレジット請求額：￥${(reservation.total_price + reservation.credit_fee_amount).toLocaleString()}\n`
      if (reservation.options_payment_method === 'cash' && reservation.options_price > 0) {
        text += `（うちオプション￥${reservation.options_price.toLocaleString()}は現金でセラピストへ）\n`
      }
    }

    // ルーム（末尾、住所 + Google Maps URL）
    text += `\n■ ルーム（ご来店場所）\n`
    if (roomInfo?.address) {
      text += `住所：${roomInfo.address}\n`
    } else {
      text += `${roomInfo?.name || '未定'}\n`
    }
    if (roomInfo?.google_map_url) {
      text += `📍 ${roomInfo.google_map_url}\n`
    }

    text += `\nご来店を心よりお待ちしております。`

    return text
  }

  const generateTherapistLineText = () => {
    if (!reservation) return ''

    let text = `【${reservation.date} ご予約詳細】\n\n`

    // 日時
    text += `■ 日時\n${reservation.start_time.slice(0, 5)} ～ ${reservation.end_time.slice(0, 5)}\n\n`

    // ルーム
    text += `■ ルーム\n${roomInfo?.name || '未定'}\n\n`

    // お客様（新規/会員 + 氏名）
    const customerPrefix = isNewCustomer ? '新規' : '会員'
    text += `■ お客様\n${customerPrefix} ${reservation.customers?.name || '未設定'} 様\n\n`

    // コース（コース名＋料金のみ）
    text += `■ コース\n`
    text += `${reservation.courses?.name || ''} ￥${reservation.base_price.toLocaleString()}\n`

    // 指名料（コースに加算）
    if (reservation.nomination_fee > 0) {
      text += `${designationLabel(reservation.designation_type)} ￥${reservation.nomination_fee.toLocaleString()}\n`
    }

    // オプション（通常＋手入力）
    const allOptions = reservation.reservation_options?.filter(ro =>
      (ro.option_id && ro.options) || (!ro.option_id && ro.custom_name)
    ) ?? []
    if (allOptions.length > 0) {
      text += `\n■ オプション\n`
      allOptions.forEach(ro => {
        if (ro.option_id && ro.options) {
          text += `${ro.options.name} ￥${ro.options.price.toLocaleString()}\n`
        } else if (!ro.option_id && ro.custom_name) {
          text += `${ro.custom_name} ￥${ro.price.toLocaleString()}\n`
        }
      })
    }

    // 割引
    if (reservation.discount_amount > 0) {
      const discounts = (reservation.reservation_discounts ?? []).filter(d => d.applied_amount > 0)
      text += `\n■ 割引\n`
      if (discounts.length > 0) {
        discounts.forEach(d => {
          const discountName = d.is_adhoc ? (d.adhoc_name || '手動割引') : (d.policy?.name || '割引')
          text += `${discountName} -￥${d.applied_amount.toLocaleString()}\n`
        })
      } else {
        text += `割引 -￥${reservation.discount_amount.toLocaleString()}\n`
      }
    }

    text += `------------------------\n`
    text += `合計：￥${reservation.total_price.toLocaleString()}`

    if (reservation.notes) {
      text += `\n\n■ 備考\n${reservation.notes}`
    }

    return text
  }

  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch (err) {
      console.error('コピーに失敗しました', err)
    }
  }

  const handleSendSMS = () => {
    const phone = reservation?.customers?.phone
    if (!phone) {
      alert('この顧客には電話番号が登録されていません')
      return
    }
    const text = generateCustomerLineText()
    // iOS は &body=、Android は ?body= → ?& で両対応
    const smsUrl = `sms:${phone}?&body=${encodeURIComponent(text)}`
    window.location.href = smsUrl
  }

  const goBack = () => {
    if (fromPage === 'shifts') {
      router.push('/shifts')
    } else {
      router.push('/reservations')
    }
  }

  if (loading || !reservation) {
    return (
      <div className="flex justify-center items-center py-20 text-indigo-600">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 font-medium">読み込み中...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={goBack}
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm border border-slate-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                予約プレビュー
                <span className={`px-3 py-1 text-sm rounded-full ${statusStyle(reservation.status)}`}>
                  {statusLabel(reservation.status)}
                </span>
              </h1>
            </div>
          </div>
          <Link
            href={`/reservations/${reservationId}/edit${fromPage === 'shifts' ? '?from=shifts' : ''}`}
            className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            予約内容を編集する
          </Link>
        </div>

        {/* Action Buttons for LINE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer Copy */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 pt-4 space-y-2">
              <button
                onClick={() => handleCopy(generateCustomerLineText(), 'customer')}
                className={`w-full py-3 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 ${copiedKey === 'customer' ? 'bg-emerald-500' : 'bg-[#06C755] hover:bg-[#05b34c]'}`}
              >
                {copiedKey === 'customer' ? (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    コピーしました
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.5 10.1c0-4.3-4.5-7.8-10.1-7.8C6.9 2.3 2.5 5.8 2.5 10.1c0 3.8 3.5 7.1 8.3 7.7.3.1.8.2.9.5.1.2 0 .6 0 .6l-.3 1.9c0 0-.1.3.1.4.2.1.4 0 .4 0l2.5-1.5c.2-.1.3-.2.5-.2h.2c4.1 0 7.4-3.3 7.4-7.4v-.2z"/>
                    </svg>
                    お客様用ご案内をコピー
                  </>
                )}
              </button>
              <button
                onClick={handleSendSMS}
                disabled={!reservation?.customers?.phone}
                className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                {reservation?.customers?.phone ? `SMS送信 (${reservation.customers.phone})` : 'SMS送信（電話番号なし）'}
              </button>
            </div>
            <pre className="mx-4 mb-4 mt-3 p-3 text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-xl border border-slate-100 h-36 overflow-y-auto">
              {generateCustomerLineText()}
            </pre>
          </div>

          {/* Therapist Copy */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 pt-4">
              <button
                onClick={() => handleCopy(generateTherapistLineText(), 'therapist')}
                className={`w-full py-3 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 ${copiedKey === 'therapist' ? 'bg-emerald-500' : 'bg-[#06C755] hover:bg-[#05b34c]'}`}
              >
                {copiedKey === 'therapist' ? (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    コピーしました
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.5 10.1c0-4.3-4.5-7.8-10.1-7.8C6.9 2.3 2.5 5.8 2.5 10.1c0 3.8 3.5 7.1 8.3 7.7.3.1.8.2.9.5.1.2 0 .6 0 .6l-.3 1.9c0 0-.1.3.1.4.2.1.4 0 .4 0l2.5-1.5c.2-.1.3-.2.5-.2h.2c4.1 0 7.4-3.3 7.4-7.4v-.2z"/>
                    </svg>
                    セラピスト用詳細をコピー
                  </>
                )}
              </button>
            </div>
            <pre className="mx-4 mb-4 mt-3 p-3 text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-xl border border-slate-100 h-36 overflow-y-auto">
              {generateTherapistLineText()}
            </pre>
          </div>
        </div>

        {/* Details Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 md:p-8">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center border-b border-slate-100 pb-4">
              <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mr-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              予約データ詳細
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-slate-500 font-medium">日時</div>
                  <div className="col-span-2 text-slate-800 font-bold">
                    {reservation.date} <br/> {reservation.start_time.slice(0, 5)} - {reservation.end_time.slice(0, 5)}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-slate-500 font-medium">お客様</div>
                  <div className="col-span-2 text-slate-800 font-bold">
                    {reservation.customers?.name || '未設定'} 様
                    {reservation.customers?.phone && <span className="block text-slate-500 font-normal text-xs mt-1">{reservation.customers.phone}</span>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="text-slate-500 font-medium">セラピスト</div>
                  <div className="col-span-2 text-slate-800 font-bold">
                    {reservation.therapists?.name || '未設定'}
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                      {designationLabel(reservation.designation_type)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="text-slate-500 font-medium">ルーム</div>
                  <div className="col-span-2 text-slate-800 font-bold">
                    {roomInfo?.name || '未定'}
                    {roomInfo?.address && <span className="block text-slate-500 font-normal text-xs mt-1">{roomInfo.address}</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-slate-500 font-medium">コース</div>
                  <div className="col-span-2 text-slate-800 font-bold">
                    {reservation.courses?.name || '未設定'} ({reservation.courses?.duration || 0}分)
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="text-slate-500 font-medium">オプション</div>
                  <div className="col-span-2 text-slate-600">
                    {reservation.reservation_options?.length > 0 ? (
                      <ul className="list-disc list-inside">
                        {reservation.reservation_options.map((ro, i) => (
                          <li key={i}>{ro.options?.name} (+{ro.options?.duration}分)</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-400">なし</span>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-1 text-slate-600">
                    <span>基本料金</span>
                    <span>¥{reservation.base_price.toLocaleString()}</span>
                  </div>
                  {reservation.options_price > 0 && (
                    <div className="flex justify-between items-center mb-1 text-slate-600">
                      <span>オプション</span>
                      <span>¥{reservation.options_price.toLocaleString()}</span>
                    </div>
                  )}
                  {reservation.nomination_fee > 0 && (
                    <div className="flex justify-between items-center mb-1 text-slate-600">
                      <span>指名料等</span>
                      <span>¥{reservation.nomination_fee.toLocaleString()}</span>
                    </div>
                  )}
                  {reservation.discount_amount > 0 && (
                    <div className="flex justify-between items-center mb-1 text-rose-500">
                      <span>割引</span>
                      <span>-¥{reservation.discount_amount.toLocaleString()}</span>
                    </div>
                  )}
                  {reservation.credit_fee_amount > 0 && (
                    <div className="flex justify-between items-center mb-1 text-amber-600">
                      <span>クレジット手数料</span>
                      <span>+¥{reservation.credit_fee_amount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 font-bold text-lg text-indigo-700">
                    <span>合計</span>
                    <span>¥{reservation.total_price.toLocaleString()}</span>
                  </div>
                  {reservation.credit_fee_amount > 0 && (
                    <div className="flex justify-between items-center mt-1 font-bold text-base text-amber-600">
                      <span>💳 クレジット請求額</span>
                      <span>¥{(reservation.total_price + reservation.credit_fee_amount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">支払方法:</span>
                      {reservation.payment_method === 'credit' ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold">💳 クレジット</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold">💴 現金</span>
                      )}
                      {reservation.payment_method === 'credit' && reservation.options_price > 0 && (
                        <span className="text-xs text-slate-400">
                          OP: {reservation.options_payment_method === 'credit' ? '💳 クレジット' : '💴 現金（セラピストへ）'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
              </div>
            </div>

            {reservation.notes && (
              <div className="mt-8 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-700 mb-2">備考</h3>
                <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl whitespace-pre-wrap">
                  {reservation.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
