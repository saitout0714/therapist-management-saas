'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toDisplayTime } from '@/lib/timeUtils'

const formatShortDate = (dateStr: string) => {
  if (!dateStr) return ''
  const match = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (match) {
    const month = parseInt(match[2], 10)
    const day = parseInt(match[3], 10)
    return `${month}/${day}`
  }
  const match2 = dateStr.match(/^(\d{1,2})[-/](\d{1,2})/)
  if (match2) {
    const month = parseInt(match2[1], 10)
    const day = parseInt(match2[2], 10)
    return `${month}/${day}`
  }
  return dateStr
}

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
  business_date?: string | null
  start_time: string
  end_time: string
  base_price: number
  options_price: number
  nomination_fee: number
  total_price: number
  discount_amount: number
  designation_type: 'free' | 'nomination' | 'first_nomination' | 'confirmed' | 'princess'
  notes: string | null
  status: 'pending' | 'confirmed' | 'cancelled'
  payment_method: 'cash' | 'credit' | null
  options_payment_method: 'cash' | 'credit' | null
  extension_payment_method: 'cash' | 'credit' | null
  credit_fee_amount: number
  extension_count: number
  customers: { name: string; phone: string | null; email: string | null } | null
  courses: { name: string; duration: number; base_price: number } | null
  therapists: { name: string } | null
  reservation_options: CustomOption[]
  reservation_discounts: ReservationDiscount[]
  is_handled?: boolean
  source?: string
  customer_notified?: boolean
  therapist_notified?: boolean
}

type RoomInfo = {
  name: string
  display_name: string | null
  template_member: string | null
  template_new_customer: string | null
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
  const [creditPaymentUrl, setCreditPaymentUrl] = useState<string | null>(null)
  const [googleCalendarId, setGoogleCalendarId] = useState<string | null>(null)
  const [therapistTemplate, setTherapistTemplate] = useState<string | null>(null)

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
          is_handled,
          source,
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
        .maybeSingle()

      if (resError) throw resError
      if (!resData) {
        // 店舗切替などで該当予約が見つからない場合はシフト管理に遷移
        router.push('/shifts')
        return
      }

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

      // 4. Fetch Room from Shift
      const { data: shiftData, error: shiftError } = await supabase
        .from('shifts')
        .select('rooms(name, display_name, template_member, template_new_customer)')
        .eq('therapist_id', resData.therapist_id)
        .eq('date', resData.business_date || resData.date)
        .eq('shop_id', selectedShop.id)
        .maybeSingle()

      if (shiftError) {
        console.warn('ルーム取得エラー:', shiftError.message)
      } else if (shiftData?.rooms) {
        const room = Array.isArray(shiftData.rooms) ? shiftData.rooms[0] : shiftData.rooms
        setRoomInfo({
          name: room?.name || '',
          display_name: room?.display_name || null,
          template_member: room?.template_member || null,
          template_new_customer: room?.template_new_customer || null,
        })
      }

      // 5. Fetch credit_payment_url from system_settings
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('credit_payment_url, google_calendar_id, therapist_template')
        .eq('shop_id', selectedShop.id)
        .maybeSingle()
      setCreditPaymentUrl(settingsData?.credit_payment_url || null)
      setGoogleCalendarId(settingsData?.google_calendar_id || null)
      setTherapistTemplate(settingsData?.therapist_template || null)
    } catch (error) {
      const msg = error instanceof Error ? error.message : JSON.stringify(error)
      console.error('予約詳細の取得に失敗:', msg, error)
      alert('予約詳細の取得に失敗しました: ' + msg)
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

    // 指名料がコース料金に含まれて保存されている場合の表示分離
    const originalCoursePrice = reservation.courses?.base_price || 0
    let displayBasePrice = reservation.base_price
    let displayNominationFee = reservation.nomination_fee
    if (reservation.nomination_fee === 0 && reservation.base_price > originalCoursePrice && originalCoursePrice > 0 && reservation.designation_type !== 'free') {
      displayNominationFee = reservation.base_price - originalCoursePrice
      displayBasePrice = originalCoursePrice
    }

    let text = `【ご予約内容のご確認】\n\n`

    // 日時（日付と時間を別行）
    text += `■ 日時\n${formatShortDate(reservation.business_date || reservation.date)}\n${toDisplayTime(reservation.start_time)} ～ ${toDisplayTime(reservation.end_time)}\n\n`

    // コース（コース名＋料金、オプションも各行）
    text += `■ コース\n`
    text += `${reservation.courses?.name || ''} ${displayBasePrice.toLocaleString()}円\n`
    reservation.reservation_options?.forEach(ro => {
      if (ro.option_id && ro.options) {
        // 通常オプション
        text += `${ro.options.name} ${ro.options.price.toLocaleString()}円\n`
      } else if (!ro.option_id && ro.custom_name) {
        // 手入力オプション
        text += `${ro.custom_name} ${ro.price.toLocaleString()}円\n`
      }
    })

    // 指名
    text += `\n■ 指名\n`
    const isNominated = reservation.designation_type !== 'free'
    if (isNominated && reservation.therapists?.name) {
      text += `${reservation.therapists.name}さん `
    }
    text += `${designationLabel(reservation.designation_type)}`
    if (displayNominationFee > 0) {
      text += ` ${displayNominationFee.toLocaleString()}円`
    }
    text += `\n`


    // お支払い予定金額
    text += `\n■ お支払い予定金額\n`
    text += `基本料金：${displayBasePrice.toLocaleString()}円\n`
    if (reservation.options_price > 0) {
      text += `オプション：${reservation.options_price.toLocaleString()}円\n`
    }
    if (displayNominationFee > 0) {
      text += `指名料：${displayNominationFee.toLocaleString()}円\n`
    }
    if (reservation.discount_amount > 0) {
      const discounts = (reservation.reservation_discounts ?? []).filter(d => d.applied_amount > 0)
      if (discounts.length > 0) {
        discounts.forEach(d => {
          const discountName = d.is_adhoc ? (d.adhoc_name || '割引') : (d.policy?.name || '割引')
          text += `${discountName}：-${d.applied_amount.toLocaleString()}円\n`
        })
      } else {
        text += `割引：-${reservation.discount_amount.toLocaleString()}円\n`
      }
    }
    text += `------------------------\n`
    text += `合計：${reservation.total_price.toLocaleString()}円\n`

    if (reservation.payment_method === 'credit') {
      const creditTotal = reservation.total_price + reservation.credit_fee_amount - (reservation.options_payment_method === 'cash' ? reservation.options_price : 0)
      if (reservation.credit_fee_amount > 0) {
        text += `クレジット手数料：${reservation.credit_fee_amount.toLocaleString()}円\n`
      }
      text += `クレジット決済額：${creditTotal.toLocaleString()}円\n`
      if (reservation.options_payment_method === 'cash' && reservation.options_price > 0) {
        text += `（うちオプション${reservation.options_price.toLocaleString()}円は現金でセラピストへ）\n`
      }
      if (creditPaymentUrl) {
        text += `\n`
        text += `下記のサイトから決済手数料10%込みの金額`
        text += ` ${creditTotal.toLocaleString()}円\n`
        text += `でご決済をご入室前までにお願い致します\n\n`
        text += `${creditPaymentUrl}\n`
      }
    } else {
      if (reservation.credit_fee_amount > 0) {
        text += `クレジット手数料：${reservation.credit_fee_amount.toLocaleString()}円\n`
        text += `💳 クレジット請求額：${(reservation.total_price + reservation.credit_fee_amount).toLocaleString()}円\n`
        if (reservation.options_payment_method === 'cash' && reservation.options_price > 0) {
          text += `（うちオプション${reservation.options_price.toLocaleString()}円は現金でセラピストへ）\n`
        }
      }
    }

    // ルームテンプレート（新規・会員で切替）
    const roomTemplate = activeIsNewCustomer
      ? (roomInfo?.template_new_customer || roomInfo?.template_member)
      : (roomInfo?.template_member || roomInfo?.template_new_customer)

    if (roomTemplate) {
      text += `\n${roomTemplate}`
    }

    return text
  }

  const generateTherapistLineText = () => {
    if (!reservation) return ''

    // 指名料がコース料金に含まれて保存されている場合の表示分離
    const originalCoursePrice = reservation.courses?.base_price || 0
    let displayBasePrice = reservation.base_price
    let displayNominationFee = reservation.nomination_fee
    if (reservation.nomination_fee === 0 && reservation.base_price > originalCoursePrice && originalCoursePrice > 0 && reservation.designation_type !== 'free') {
      displayNominationFee = reservation.base_price - originalCoursePrice
      displayBasePrice = originalCoursePrice
    }

    // オプション（通常＋手入力）
    const allOptions = reservation.reservation_options?.filter(ro =>
      (ro.option_id && ro.options) || (!ro.option_id && ro.custom_name)
    ) ?? []
    let optionsText = ''
    if (allOptions.length > 0) {
      optionsText = `■ オプション\n`
      allOptions.forEach(ro => {
        if (ro.option_id && ro.options) {
          optionsText += `${ro.options.name} ${ro.options.price.toLocaleString()}円\n`
        } else if (!ro.option_id && ro.custom_name) {
          optionsText += `${ro.custom_name} ${ro.price.toLocaleString()}円\n`
        }
      })
    }

    // 割引
    let discountsText = ''
    if (reservation.discount_amount > 0) {
      const discounts = (reservation.reservation_discounts ?? []).filter(d => d.applied_amount > 0)
      discountsText = `■ 割引\n`
      if (discounts.length > 0) {
        discounts.forEach(d => {
          const discountName = d.is_adhoc ? (d.adhoc_name || '手動割引') : (d.policy?.name || '割引')
          discountsText += `${discountName} -${d.applied_amount.toLocaleString()}円\n`
        })
      } else {
        discountsText += `割引 -${reservation.discount_amount.toLocaleString()}円\n`
      }
    }

    const customerPrefix = activeIsNewCustomer ? '新規' : '会員'
    const paymentText = reservation.payment_method === 'credit' ? 'クレジット' : '現金'
    let notesText = ''
    if (reservation.notes) {
      const label = reservation.source === 'web' ? 'その他ご希望' : '備考'
      notesText = `■ ${label}\n${reservation.notes}`
    }

    // カスタムテンプレートが設定されている場合、置換ロジックを使用
    if (therapistTemplate) {
      const dateVal = formatShortDate(reservation.business_date || reservation.date || '')
      const startTimeVal = toDisplayTime(reservation.start_time)
      const endTimeVal = toDisplayTime(reservation.end_time)
      const roomVal = roomInfo?.name || '未定'
      const custNameVal = reservation.customers?.name || '未設定'
      const courseNameVal = reservation.courses?.name || '未設定'
      const courseDurationVal = `${reservation.courses?.duration || 0}分`
      const coursePriceVal = `${displayBasePrice.toLocaleString()}円`
      const designationVal = designationLabel(reservation.designation_type)
      const nominationFeeVal = displayNominationFee > 0 ? `${displayNominationFee.toLocaleString()}円` : '0円'
      const totalVal = `${reservation.total_price.toLocaleString()}円`

      let finalTemplate = therapistTemplate
        .replace(/\[日付\]/g, dateVal)
        .replace(/\[開始時刻\]/g, startTimeVal)
        .replace(/\[終了時刻\]/g, endTimeVal)
        .replace(/\[ルーム\]/g, roomVal)
        .replace(/\[お客様区分\]/g, customerPrefix)
        .replace(/\[お客様名\]/g, custNameVal)
        .replace(/\[コース\]/g, courseNameVal)
        .replace(/\[コース時間\]/g, courseDurationVal)
        .replace(/\[コース料金\]/g, coursePriceVal)
        .replace(/\[指名区分\]/g, designationVal)
        .replace(/\[指名料金\]/g, nominationFeeVal)
        .replace(/\[支払方法\]/g, paymentText)
        .replace(/\[合計料金\]/g, totalVal)

      // 割引がない場合は、[割引]タグが含まれる行全体を削除する
      if (!discountsText) {
        finalTemplate = finalTemplate.replace(/^[^\n]*\[割引\][^\n]*\n?/gm, '')
      } else {
        finalTemplate = finalTemplate.replace(/\[割引\]/g, discountsText)
      }

      // オプションがない場合は、[オプション]タグが含まれる行全体を削除する
      if (!optionsText) {
        finalTemplate = finalTemplate.replace(/^[^\n]*\[オプション\][^\n]*\n?/gm, '')
      } else {
        finalTemplate = finalTemplate.replace(/\[オプション\]/g, optionsText)
      }

      // 備考がない場合は、[備考]タグが含まれる行全体を削除する
      if (!notesText) {
        finalTemplate = finalTemplate.replace(/^[^\n]*\[備考\][^\n]*\n?/gm, '')
      } else {
        finalTemplate = finalTemplate.replace(/\[備考\]/g, notesText)
      }

      return finalTemplate
    }

    // デフォルトのフォールバックテンプレート
    let text = `【${formatShortDate(reservation.business_date || reservation.date)} ご予約詳細】\n\n`

    // 時間
    text += `■ 時間\n${toDisplayTime(reservation.start_time)}-${toDisplayTime(reservation.end_time)}\n\n`

    // ルーム
    text += `■ ルーム\n${roomInfo?.name || '未定'}\n\n`

    // お客様（新規/会員 + 氏名）
    text += `■ お客様\n${customerPrefix} ${reservation.customers?.name || '未設定'} 様\n\n`

    // コース（時間 ￥料金）
    text += `■ コース\n`
    text += `${reservation.courses?.duration || 0}分 ${displayBasePrice.toLocaleString()}円\n\n`

    // 指名（指名タイプ ￥指名料）
    text += `■ 指名\n`
    text += `${designationLabel(reservation.designation_type)}`
    if (displayNominationFee > 0) {
      text += ` ${displayNominationFee.toLocaleString()}円`
    }
    text += `\n\n`

    if (optionsText) {
      text += optionsText + `\n`
    }

    if (discountsText) {
      text += discountsText + `\n`
    }

    text += `------------------------\n`
    if (reservation.payment_method === 'credit') {
      text += `■ お支払い：クレジット\n`
      text += `------------------------\n`
      text += `合計：${reservation.total_price.toLocaleString()}円`
    } else {
      text += `合計：${reservation.total_price.toLocaleString()}円`
    }

    if (reservation.notes) {
      text += `\n\n` + notesText
    }

    return text
  }

  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [customerTypeOverride, setCustomerTypeOverride] = useState<'auto' | 'new' | 'member'>('auto')
  const [showCustomerPreview, setShowCustomerPreview] = useState(false)
  const [showTherapistPreview, setShowTherapistPreview] = useState(false)

  const activeIsNewCustomer = 
    customerTypeOverride === 'new' ? true :
    customerTypeOverride === 'member' ? false :
    isNewCustomer

  const updateNotifiedStatus = async (type: 'customer' | 'therapist', value: boolean) => {
    if (!reservation) return
    const field = type === 'customer' ? 'customer_notified' : 'therapist_notified'
    
    const { error } = await supabase
      .from('reservations')
      .update({ [field]: value })
      .eq('id', reservation.id)
      
    if (error) {
      console.error('Failed to update notification status:', error.message)
    } else {
      setReservation(prev => prev ? { ...prev, [field]: value } : null)
    }
  }

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)

      // 自動的に「送信済」にマークする
      if (key === 'customer') {
        void updateNotifiedStatus('customer', true)
      } else if (key === 'therapist') {
        void updateNotifiedStatus('therapist', true)
      }
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
    
    // 自動的に「送信済」にマークする
    void updateNotifiedStatus('customer', true)

    // iOS は &body=、Android は ?body= → ?& で両対応
    const smsUrl = `sms:${phone}?&body=${encodeURIComponent(text)}`
    window.location.href = smsUrl
  }

  const goBack = () => {
    const targetDate = reservation?.business_date || reservation?.date
    if (fromPage === 'weekly') {
      window.location.href = targetDate ? `/shifts?date=${targetDate}&view=week` : '/shifts?view=week'
    } else if (fromPage === 'vertical') {
      window.location.href = targetDate ? `/shifts?date=${targetDate}&view=vertical` : '/shifts?view=vertical'
    } else if (fromPage === 'shifts') {
      window.location.href = targetDate ? `/shifts?date=${targetDate}` : '/shifts'
    } else {
      router.push('/reservations')
    }
  }

  const handleDelete = async () => {
    if (!confirm('この予約を削除しますか？この操作は元に戻せません。')) return
    
    // 削除前の同期用パラメータ取得
    const eventId = (reservation as any)?.google_event_id
    const calendarId = googleCalendarId

    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', reservationId)
    if (error) {
      alert('削除に失敗しました: ' + error.message)
    } else {
      if (eventId && calendarId) {
        try {
          void fetch('/api/calendar-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'delete',
              deletedEventId: eventId,
              deletedCalendarId: calendarId
            })
          }).catch((syncErr) => {
            console.error('[CalendarSync] カレンダー削除同期に失敗しました:', syncErr)
          })
        } catch (syncErr) {
          console.error('[CalendarSync] カレンダー削除同期のセットアップに失敗しました:', syncErr)
        }
      }
      goBack()
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

  const extensionPrice = reservation.extension_count > 0
    ? Math.max(0, reservation.total_price - reservation.base_price - reservation.options_price - reservation.nomination_fee + reservation.discount_amount)
    : 0

  return (
    <div className="bg-slate-50 p-2 sm:p-4">
      <div className="max-w-4xl mx-auto space-y-3 sm:space-y-6">
        
        {/* クレジット決済URL未設定の警告バナー */}
        {reservation.payment_method === 'credit' && !creditPaymentUrl && (
          <div className="bg-amber-50 rounded-2xl p-4 text-amber-800 shadow-sm border border-amber-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm">クレジット決済URLが設定されていません</h3>
                <p className="text-xs opacity-90 mt-0.5">お支払い方法が「クレジットカード決済」になっていますが、クレジット決済URLが未設定です。このままコピーすると決済URLが空欄になります。</p>
              </div>
            </div>
            <Link
              href={`/system?redirect=/reservations/${reservationId}`}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow active:scale-95 transition-all flex-shrink-0 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              システム管理で設定する
            </Link>
          </div>
        )}

        {/* 電話番号未登録の警告バナー */}
        {!reservation.customers?.phone && (
          <div className="bg-rose-50 rounded-2xl p-4 text-rose-800 shadow-sm border border-rose-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 text-rose-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-sm">お客様の電話番号が登録されていません</h3>
                <p className="text-xs opacity-90 mt-0.5">このお客様は電話番号が登録されていないため、SMSでのご案内を送信できません。</p>
              </div>
            </div>
            <Link
              href={`/customers/${reservation.customer_id}/edit?redirect=/reservations/${reservationId}`}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow active:scale-95 transition-all flex-shrink-0 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              電話番号を登録する
            </Link>
          </div>
        )}
        
        {/* Header */}
        <div className="flex justify-between items-center gap-2 border-b border-slate-100 pb-2 sm:pb-0 sm:border-none">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button 
              onClick={goBack}
              className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm border border-slate-200 flex-shrink-0"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-1.5 sm:gap-3 truncate">
                予約プレビュー
                <span className={`px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-sm rounded-full flex-shrink-0 ${statusStyle(reservation.status)}`}>
                  {statusLabel(reservation.status)}
                </span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={handleDelete}
              className="px-2.5 py-1.5 sm:px-4 sm:py-2.5 bg-white border border-rose-200 text-rose-500 font-medium rounded-lg sm:rounded-xl hover:bg-rose-50 hover:border-rose-300 transition-all active:scale-95 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="hidden xs:inline">削除</span>
            </button>
            <Link
              href={`/reservations/${reservationId}/edit${fromPage ? `?from=${fromPage}` : ''}`}
              className="px-3 py-1.5 sm:px-6 sm:py-2.5 bg-indigo-600 text-white font-medium rounded-lg sm:rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>編集</span>
            </Link>
          </div>
        </div>

        {/* 連絡送信状況パネル */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <div className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border shadow-sm flex flex-col justify-between gap-2 sm:flex-row sm:items-center transition-all bg-white ${
            reservation.customer_notified 
              ? 'border-emerald-200' 
              : 'border-rose-200'
          }`}>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${
                reservation.customer_notified ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-800">お客様連絡</h4>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold mt-0.5 ${
                  reservation.customer_notified ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {reservation.customer_notified ? '送信済' : '未送信'}
                </span>
              </div>
            </div>
            <button
              onClick={() => void updateNotifiedStatus('customer', !reservation.customer_notified)}
              className={`w-full sm:w-auto px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                reservation.customer_notified
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
              }`}
            >
              {reservation.customer_notified ? '未送信に戻す' : '送信済にする'}
            </button>
          </div>

          <div className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border shadow-sm flex flex-col justify-between gap-2 sm:flex-row sm:items-center transition-all bg-white ${
            reservation.therapist_notified 
              ? 'border-emerald-200' 
              : 'border-rose-200'
          }`}>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${
                reservation.therapist_notified ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-800">セラピスト連絡</h4>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold mt-0.5 ${
                  reservation.therapist_notified ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {reservation.therapist_notified ? '送信済' : '未送信'}
                </span>
              </div>
            </div>
            <button
              onClick={() => void updateNotifiedStatus('therapist', !reservation.therapist_notified)}
              className={`w-full sm:w-auto px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                reservation.therapist_notified
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
              }`}
            >
              {reservation.therapist_notified ? '未送信に戻す' : '送信済にする'}
            </button>
          </div>
        </div>

        {/* Web予約のその他ご希望表示 */}
        {reservation.source === 'web' && reservation.notes && (
          <div className="bg-amber-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-amber-800 shadow-sm border border-amber-200">
            <h3 className="font-bold text-xs sm:text-sm flex items-center gap-1.5 mb-1.5 text-amber-900">
              <span className="text-amber-500">💬</span> Web予約時のその他ご希望
            </h3>
            <p className="text-xs sm:text-sm opacity-90 whitespace-pre-wrap leading-relaxed bg-white/60 p-2.5 rounded-lg border border-amber-200/40">
              {reservation.notes}
            </p>
          </div>
        )}

        {/* 送信テンプレート切り替えタブ */}
        <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-bold text-slate-800">案内テンプレート</span>
          </div>
          <div className="bg-slate-100 p-0.5 sm:p-1 rounded-lg sm:rounded-xl flex gap-0.5 sm:gap-1 select-none">
            <button
              onClick={() => setCustomerTypeOverride('auto')}
              className={`flex-1 sm:flex-none px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                customerTypeOverride === 'auto'
                  ? 'bg-white text-primary-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-600 hover:bg-white/50'
              }`}
            >
              自動判定 ({isNewCustomer ? '新規' : '会員'})
            </button>
            <button
              onClick={() => setCustomerTypeOverride('new')}
              className={`flex-1 sm:flex-none px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                customerTypeOverride === 'new'
                  ? 'bg-accent-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/50'
              }`}
            >
              新規用
            </button>
            <button
              onClick={() => setCustomerTypeOverride('member')}
              className={`flex-1 sm:flex-none px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                customerTypeOverride === 'member'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/50'
              }`}
            >
              会員用
            </button>
          </div>
        </div>

        {/* Action Buttons for LINE */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {/* Customer Copy */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between">
            <div className="p-2 sm:p-4 space-y-1.5 sm:space-y-2">
              <button
                onClick={() => handleCopy(generateCustomerLineText(), 'customer')}
                className={`w-full py-2 sm:py-3 text-white font-bold rounded-lg sm:rounded-xl shadow-sm transition-all flex items-center justify-center gap-1 sm:gap-2 text-[10px] xs:text-xs sm:text-sm ${copiedKey === 'customer' ? 'bg-emerald-500' : 'bg-[#06C755] hover:bg-[#05b34c]'}`}
              >
                {copiedKey === 'customer' ? (
                  <>
                    <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    コピー完了
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.5 10.1c0-4.3-4.5-7.8-10.1-7.8C6.9 2.3 2.5 5.8 2.5 10.1c0 3.8 3.5 7.1 8.3 7.7.3.1.8.2.9.5.1.2 0 .6 0 .6l-.3 1.9c0 0-.1.3.1.4.2.1.4 0 .4 0l2.5-1.5c.2-.1.3-.2.5-.2h.2c4.1 0 7.4-3.3 7.4-7.4v-.2z"/>
                    </svg>
                    <span>お客様用<span className="hidden sm:inline">ご案内を</span>コピー</span>
                  </>
                )}
              </button>
              <button
                onClick={handleSendSMS}
                disabled={!reservation?.customers?.phone}
                className="w-full py-2 sm:py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-lg sm:rounded-xl shadow-sm transition-all flex items-center justify-center gap-1 sm:gap-2 text-[10px] xs:text-xs sm:text-sm"
              >
                <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                {reservation?.customers?.phone ? (
                  <span>SMS送信<span className="hidden md:inline"> ({reservation.customers.phone})</span></span>
                ) : (
                  'SMS不可'
                )}
              </button>
            </div>
            
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setShowCustomerPreview(!showCustomerPreview)}
                className="w-full py-1.5 text-[9px] sm:text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 border-t border-slate-100 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>{showCustomerPreview ? 'プレビューを閉じる' : 'プレビューを表示'}</span>
                <svg className={`w-2.5 h-2.5 sm:w-3 sm:h-3 transition-transform ${showCustomerPreview ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showCustomerPreview && (
                <pre className="mx-2 my-2 sm:mx-4 sm:mb-4 sm:mt-3 p-2 text-[10px] sm:text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-lg border border-slate-100 h-28 sm:h-36 overflow-y-auto">
                  {generateCustomerLineText()}
                </pre>
              )}
            </div>
          </div>

          {/* Therapist Copy */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between">
            <div className="p-2 sm:p-4">
              <button
                onClick={() => handleCopy(generateTherapistLineText(), 'therapist')}
                className={`w-full py-2 sm:py-3 text-white font-bold rounded-lg sm:rounded-xl shadow-sm transition-all flex items-center justify-center gap-1 sm:gap-2 text-[10px] xs:text-xs sm:text-sm ${copiedKey === 'therapist' ? 'bg-emerald-500' : 'bg-[#06C755] hover:bg-[#05b34c]'}`}
              >
                {copiedKey === 'therapist' ? (
                  <>
                    <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    コピー完了
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.5 10.1c0-4.3-4.5-7.8-10.1-7.8C6.9 2.3 2.5 5.8 2.5 10.1c0 3.8 3.5 7.1 8.3 7.7.3.1.8.2.9.5.1.2 0 .6 0 .6l-.3 1.9c0 0-.1.3.1.4.2.1.4 0 .4 0l2.5-1.5c.2-.1.3-.2.5-.2h.2c4.1 0 7.4-3.3 7.4-7.4v-.2z"/>
                    </svg>
                    <span>セラピスト用<span className="hidden sm:inline">詳細を</span>コピー</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setShowTherapistPreview(!showTherapistPreview)}
                className="w-full py-1.5 text-[9px] sm:text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 border-t border-slate-100 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>{showTherapistPreview ? 'プレビューを閉じる' : 'プレビューを表示'}</span>
                <svg className={`w-2.5 h-2.5 sm:w-3 sm:h-3 transition-transform ${showTherapistPreview ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showTherapistPreview && (
                <pre className="mx-2 my-2 sm:mx-4 sm:mb-4 sm:mt-3 p-2 text-[10px] sm:text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-lg border border-slate-100 h-28 sm:h-36 overflow-y-auto">
                  {generateTherapistLineText()}
                </pre>
              )}
            </div>
          </div>
        </div>

        {/* Details Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-3 sm:p-5">
            <h2 className="text-sm sm:text-lg font-bold text-slate-800 mb-3 sm:mb-6 flex items-center border-b border-slate-100 pb-2 sm:pb-4">
              <span className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              予約データ詳細
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 text-xs sm:text-sm">
              <div className="space-y-2.5 sm:space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-slate-500 font-medium">日時</div>
                  <div className="col-span-2 text-slate-800 font-bold">
                    {reservation.business_date || reservation.date} <br/> {toDisplayTime(reservation.start_time)} - {toDisplayTime(reservation.end_time)}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 items-start">
                  <div className="text-slate-500 font-medium pt-0.5">お客様</div>
                  <div className="col-span-2">
                    <div className="text-slate-800 font-bold flex items-center gap-2 flex-wrap">
                      <span>{reservation.customers?.name || '未設定'} 様</span>
                      <Link
                        href={`/customers/${reservation.customer_id}/edit?redirect=/reservations/${reservationId}`}
                        className="text-[10px] sm:text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline flex items-center gap-0.5"
                      >
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        情報変更
                      </Link>
                    </div>
                    {reservation.customers?.phone ? (
                      <span className="block text-slate-500 font-normal text-[11px] sm:text-xs mt-0.5">{reservation.customers.phone}</span>
                    ) : (
                      <span className="block text-rose-500 font-bold text-[10px] sm:text-xs mt-1 flex items-center gap-1">
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        電話番号なし (SMS不可)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="text-slate-500 font-medium">セラピスト</div>
                  <div className="col-span-2 text-slate-800 font-bold">
                    {reservation.therapists?.name || '未設定'}
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-slate-100 text-slate-600">
                      {designationLabel(reservation.designation_type)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="text-slate-500 font-medium">ルーム</div>
                  <div className="col-span-2 text-slate-800 font-bold">
                    {roomInfo?.display_name || roomInfo?.name || '未定'}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 sm:space-y-4">
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

                <div className="pt-2.5 sm:pt-4 border-t border-slate-100 text-[11px] sm:text-xs">
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
                  {reservation.extension_count > 0 && (
                    <div className="flex justify-between items-center mb-1 text-slate-600">
                      <span>延長料金 ({reservation.extension_count}回)</span>
                      <span>¥{extensionPrice.toLocaleString()}</span>
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
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 font-bold text-sm sm:text-lg text-indigo-700">
                    <span>合計</span>
                    <span>¥{reservation.total_price.toLocaleString()}</span>
                  </div>
                  {reservation.credit_fee_amount > 0 && (
                    <div className="flex justify-between items-center mt-1 font-bold text-xs sm:text-base text-amber-600">
                      <span>💳 クレジット決済額</span>
                      <span>
                        ¥{(
                          reservation.total_price + reservation.credit_fee_amount
                          - (reservation.options_payment_method === 'cash' ? reservation.options_price : 0)
                          - (reservation.extension_payment_method === 'cash' ? extensionPrice : 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-[10px] sm:text-xs">
                      <span className="text-slate-500 font-medium">支払方法:</span>
                      {reservation.payment_method === 'credit' ? (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] sm:text-xs font-bold">💳 クレジット</span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] sm:text-xs font-bold">💴 現金</span>
                      )}
                      {reservation.payment_method === 'credit' && reservation.options_price > 0 && (
                        <span className="text-slate-400">
                          OP: {reservation.options_payment_method === 'credit' ? '💳 クレ' : '💴 現金（セラへ）'}
                        </span>
                      )}
                      {reservation.payment_method === 'credit' && reservation.extension_count > 0 && (
                        <span className="text-slate-400">
                          延長: {reservation.extension_payment_method === 'credit' ? '💳 クレ' : '💴 現金（セラへ）'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
              </div>
            </div>

            {reservation.notes && (
              <div className="mt-4 pt-3 sm:mt-8 sm:pt-6 border-t border-slate-100">
                <h3 className="text-xs sm:text-sm font-bold text-slate-700 mb-1.5 sm:mb-2">
                  {reservation.source === 'web' ? 'その他ご希望' : '備考'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 bg-slate-50 p-2.5 sm:p-4 rounded-lg sm:rounded-xl whitespace-pre-wrap">
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

