import { Client } from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const dbUrl = process.env.PRODUCTION_DATABASE_URL;
const syncToken = process.env.SYNC_API_TOKEN || 'yoyakl_sync_token_2026'

async function run() {
  if (!dbUrl) {
    console.error('No PRODUCTION_DATABASE_URL');
    return;
  }
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  const reservationId = 'bf0c6781-b99f-475c-bbf8-982ccd0a7aeb'; // Tsujido's 13:38 reservation JST
  
  console.log(`--- Fetching Reservation Details for ${reservationId} ---`);
  
  try {
    const { rows: resList } = await client.query(
      `SELECT r.*, c.name as customer_name, t.name as therapist_name, co.name as course_name, co.duration as course_duration
       FROM public.reservations r
       LEFT JOIN public.customers c ON r.customer_id = c.id
       LEFT JOIN public.therapists t ON r.therapist_id = t.id
       LEFT JOIN public.courses co ON r.course_id = co.id
       WHERE r.id = $1`,
      [reservationId]
    );

    if (resList.length === 0) {
      console.error('Reservation not found');
      return;
    }
    const res = resList[0];

    console.log('Reservation Data fetched:', {
      date: res.date,
      start_time: res.start_time,
      end_time: res.end_time,
      customer_name: res.customer_name,
      course_name: res.course_name,
      course_duration: res.course_duration,
      therapist_name: res.therapist_name
    });

    const { rows: settingsList } = await client.query(
      `SELECT google_calendar_id, gas_calendar_sync_url
       FROM public.system_settings
       WHERE shop_id = $1`,
      [res.shop_id]
    );

    const calendarId = settingsList[0]?.google_calendar_id;
    const gasUrl = settingsList[0]?.gas_calendar_sync_url;

    console.log('Settings:', { calendarId, gasUrl });

    if (!calendarId || !gasUrl) {
      console.error('Calendar ID or GAS URL is missing');
      return;
    }

    const therapistName = res.therapist_name || '指名なし'
    const customerName = res.customer_name || 'ゲスト'
    const courseDuration = res.course_duration || 0
    
    let designationLabel = 'フリー'
    switch (res.designation_type) {
      case 'confirmed': designationLabel = '本指名'; break;
      case 'nomination': designationLabel = '指名'; break;
      case 'first_nomination': designationLabel = '初回指名'; break;
      case 'princess': designationLabel = '姫予約'; break;
    }

    const timeDisplay = `${res.start_time.slice(0, 5)}〜${res.end_time.slice(0, 5)}`
    const title = `${therapistName}さん ${customerName}様 ${courseDuration}分 ${designationLabel} ${timeDisplay}`

    console.log('Constructed title:', title);

    let formattedDate = ''
    if (res.date instanceof Date) {
      formattedDate = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(res.date).replace(/\//g, '-')
    } else if (typeof res.date === 'string') {
      formattedDate = res.date.split('T')[0]
    } else {
      formattedDate = String(res.date).split('T')[0]
    }

    const payload = {
      action: 'create',
      calendarId,
      eventId: res.google_event_id,
      title,
      date: formattedDate,
      startTime: res.start_time.slice(0, 5),
      endTime: res.end_time.slice(0, 5),
      token: syncToken
    };

    console.log('Sending payload to GAS:', payload);

    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const code = response.status;
    const text = await response.text();
    console.log(`GAS Response Code: ${code}`);
    console.log(`GAS Response Body: ${text}`);

    if (code === 200) {
      const result = JSON.parse(text);
      console.log('Parsed GAS Result:', result);
    }
  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    await client.end();
  }
}

run();
