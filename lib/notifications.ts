import nodemailer from 'nodemailer'

type SmtpSettings = {
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_secure?: boolean | null
  smtp_user?: string | null
  smtp_pass?: string | null
  smtp_from?: string | null
}

function getMailTransporter(smtpSettings?: SmtpSettings | null) {
  // If no SMTP host is configured in the database, fallback to environment variables
  if (!smtpSettings?.smtp_host) {
    const host = process.env.SMTP_HOST || 'smtp.example.com'
    const port = parseInt(process.env.SMTP_PORT || '587', 10)
    const secure = process.env.SMTP_SECURE === 'true'
    const user = process.env.SMTP_USER || 'test@example.com'
    const pass = process.env.SMTP_PASS || 'password'

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    })
  }

  const host = smtpSettings.smtp_host
  let port = parseInt(process.env.SMTP_PORT || '587', 10)
  if (smtpSettings.smtp_port !== undefined && smtpSettings.smtp_port !== null) {
    port = smtpSettings.smtp_port
  }

  let secure = process.env.SMTP_SECURE === 'true'
  if (smtpSettings.smtp_secure !== undefined && smtpSettings.smtp_secure !== null) {
    secure = smtpSettings.smtp_secure
  }

  const user = smtpSettings.smtp_user || process.env.SMTP_USER || 'test@example.com'
  const pass = smtpSettings.smtp_pass || process.env.SMTP_PASS || 'password'

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  })
}

/**
 * Send a test email to verify SMTP configuration
 */
export async function sendTestEmail({
  smtpSettings,
  toEmail,
  shopName,
}: {
  smtpSettings?: SmtpSettings | null
  toEmail: string
  shopName: string
}) {
  const transporter = getMailTransporter(smtpSettings)
  let from = smtpSettings?.smtp_from || process.env.SMTP_FROM || '"予約システム" <noreply@example.com>'

  if (!smtpSettings?.smtp_from && shopName) {
    const emailMatch = from.match(/<([^>]+)>/)
    const emailAddress = emailMatch ? emailMatch[1] : (from.includes('@') ? from.trim() : 'noreply@example.com')
    from = `"${shopName} 通知テスト" <${emailAddress}>`
  }

  const mailOptions = {
    from,
    to: toEmail,
    subject: `【テストメール】${shopName} 通知機能テスト`,
    text: `※このメールは店舗管理者様向けの通知機能テストメールです。

このメールが届いている場合、システム設定でのSMTP送信設定および管理者向け通知メール設定は正しく機能しています。

・送信日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
・対象店舗: ${shopName}`,
  }

  await transporter.sendMail(mailOptions)
}

/**
 * Send a test LINE message via LINE Messaging API to verify token/ID config
 */
export async function sendTestLine({
  token,
  toId,
  shopName,
}: {
  token: string
  toId: string
  shopName: string
}) {
  const messageText = `【LINE通知テスト】\n${shopName}の通知機能テストメッセージです。\n\nこのメッセージが届いている場合、LINE APIの連携設定は正常に機能しています。\n\n送信日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: toId,
      messages: [
        {
          type: 'text',
          text: messageText,
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`LINE API responded with status ${response.status}: ${errorBody}`)
  }
}

/**
 * Main function to send reservation notification to the store administrators
 */
export async function sendAdminReservationNotification({
  reservationId,
  shopId,
  supabase,
  isNewCustomer,
}: {
  reservationId: string
  shopId: string
  supabase: any
  isNewCustomer?: boolean
}) {
  try {
    console.log(`[Admin Notification] Fetching data for reservation ID: ${reservationId}`)

    // 1. Fetch system_settings
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select(`
        enable_email_notification,
        admin_notification_email,
        enable_line_notification,
        line_channel_access_token,
        line_to_id,
        smtp_host,
        smtp_port,
        smtp_secure,
        smtp_user,
        smtp_pass,
        smtp_from
      `)
      .eq('shop_id', shopId)
      .maybeSingle()

    if (settingsError) {
      throw new Error(`Failed to fetch system settings: ${settingsError.message}`)
    }

    if (!settings) {
      console.log(`[Admin Notification] No system settings found for shop: ${shopId}`)
      return
    }

    const {
      enable_email_notification,
      admin_notification_email,
      enable_line_notification,
      line_channel_access_token,
      line_to_id,
    } = settings

    const isEmailEnabled = enable_email_notification && admin_notification_email
    const isLineEnabled = enable_line_notification && line_channel_access_token && line_to_id

    if (!isEmailEnabled && !isLineEnabled) {
      console.log('[Admin Notification] Both Email and LINE notifications are disabled or incomplete.')
      return
    }

    // 2. Fetch reservation, customer, therapist, course, shop details
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select(`
        id,
        date,
        start_time,
        end_time,
        total_price,
        payment_method,
        notes,
        source,
        customer_id,
        customers (
          name,
          furigana,
          phone,
          email
        ),
        therapists (
          name
        ),
        courses (
          name
        ),
        shops (
          name
        )
      `)
      .eq('id', reservationId)
      .maybeSingle()

    if (resError || !reservation) {
      throw new Error(`Failed to fetch reservation or reservation not found: ${resError?.message || 'Not found'}`)
    }

    const customer = reservation.customers
    const therapist = reservation.therapists
    const course = reservation.courses
    const shop = reservation.shops

    const shopName = shop?.name || '不明な店舗'
    const customerName = customer?.name || '不明'
    const customerFurigana = customer?.furigana || '不明'
    const customerPhone = customer?.phone || '不明'
    const customerEmail = customer?.email || '未設定'
    const therapistName = therapist?.name || 'フリー（指名なし）'
    const courseName = course?.name || '選択コース'
    const totalPrice = reservation.total_price || 0
    const paymentLabel = reservation.payment_method === 'credit' ? 'クレジットカード決済' : '現地決済（現金）'
    const reservationNotes = reservation.notes || 'なし'

    // 3. Determine if customer is new (if not explicitly passed)
    let isNew = isNewCustomer
    if (isNew === undefined && reservation.customer_id) {
      const { count, error: countError } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', reservation.customer_id)

      if (!countError && count !== null) {
        isNew = count <= 1
      } else {
        isNew = false
      }
    }

    // 4. Construct message text
    const messageText = `【WEB予約通知】新規予約が入りました。

■店舗：${shopName}
■日時：${reservation.date} ${reservation.start_time.slice(0, 5)} ～ ${reservation.end_time.slice(0, 5)}
■お客様：${customerName} 様 (${customerFurigana})
■区分：${isNew ? '新規顧客' : '既存顧客'}
■連絡先：
  ・電話番号：${customerPhone}
  ・メール：${customerEmail}
■コース：${courseName}
■担当：${therapistName}
■お支払い：
  ・合計金額：¥${totalPrice.toLocaleString()} (税込)
  ・決済方法：${paymentLabel}
■備考・ご要望：
${reservationNotes}`

    // 5. Send Email if enabled
    if (isEmailEnabled) {
      try {
        console.log(`[Admin Notification] Sending email to: ${admin_notification_email}`)
        const transporter = getMailTransporter(settings)
        let from = settings.smtp_from || process.env.SMTP_FROM || '"予約システム" <noreply@example.com>'

        if (!settings.smtp_from && shopName) {
          const emailMatch = from.match(/<([^>]+)>/)
          const emailAddress = emailMatch ? emailMatch[1] : (from.includes('@') ? from.trim() : 'noreply@example.com')
          from = `"${shopName} WEB予約通知" <${emailAddress}>`
        }

        const mailOptions = {
          from,
          to: admin_notification_email,
          subject: `【WEB予約通知】新規予約が入りました（${shopName}）`,
          text: messageText,
        }

        await transporter.sendMail(mailOptions)
        console.log('[Admin Notification] Email notification sent successfully.')
      } catch (emailErr) {
        console.error('[Admin Notification Error] Failed to send email:', emailErr)
      }
    }

    // 6. Send LINE message if enabled
    if (isLineEnabled) {
      try {
        console.log(`[Admin Notification] Sending LINE message to: ${line_to_id}`)
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${line_channel_access_token}`,
          },
          body: JSON.stringify({
            to: line_to_id,
            messages: [
              {
                type: 'text',
                text: messageText,
              },
            ],
          }),
        })

        if (!response.ok) {
          const errorBody = await response.text()
          console.error(`[Admin Notification Error] LINE API responded with status ${response.status}: ${errorBody}`)
        } else {
          console.log('[Admin Notification] LINE notification sent successfully.')
        }
      } catch (lineErr) {
        console.error('[Admin Notification Error] Failed to send LINE message:', lineErr)
      }
    }

  } catch (error) {
    console.error('[Admin Notification Main Error] Failed to process admin notifications:', error)
  }
}
