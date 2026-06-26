import * as cheerio from 'cheerio'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const CASKAN_SHOP_CODE = process.env.CASKAN_SHOP_CODE || 'sparich'
const CASKAN_LOGIN_ID = process.env.CASKAN_LOGIN_ID || 'mts'
const CASKAN_PASSWORD = process.env.CASKAN_PASSWORD || 'MTS'

class FetchSession {
  private cookies: Record<string, string> = {}

  async request(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers || {})
    const cookieHeader = Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
    
    if (cookieHeader) {
      headers.set('Cookie', cookieHeader)
    }
    
    if (!headers.has('User-Agent')) {
      headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    }

    const response = await fetch(url, { ...options, headers })

    const setCookieHeaders = response.headers.getSetCookie 
      ? response.headers.getSetCookie() 
      : (response.headers.get('set-cookie')?.split(/,\s*(?=\w+=)/) || [])

    for (const cookieStr of setCookieHeaders) {
      const parts = cookieStr.split(';')[0].split('=')
      if (parts.length >= 2) {
        const name = parts[0].trim()
        const value = parts.slice(1).join('=').trim()
        this.cookies[name] = value
      }
    }

    return response
  }

  async get(url: string, options: RequestInit = {}): Promise<Response> {
    return this.request(url, { ...options, method: 'GET' })
  }

  async post(url: string, bodyData: Record<string, string>, options: RequestInit = {}): Promise<Response> {
    const formBody = new URLSearchParams()
    for (const [key, value] of Object.entries(bodyData)) {
      formBody.append(key, value)
    }
    return this.request(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(options.headers || {}),
      },
      body: formBody,
    })
  }
}

async function run() {
  const session = new FetchSession()
  await session.get('https://my.caskan.jp/login')
  await session.post('https://my.caskan.jp/login', {
    mode: 'step1',
    shop_code: CASKAN_SHOP_CODE,
    code: CASKAN_LOGIN_ID,
  })
  await session.post('https://my.caskan.jp/login/password', {
    mode: 'step2',
    login_password: CASKAN_PASSWORD,
  })

  // Switch to rabbit_tachikawa (caskanId: 1631)
  await session.get('https://my.caskan.jp/assist_agent/login?shop_id=1631')

  const r = await session.get('https://my.caskan.jp/schedule?date=2026-06-26')
  const html = await r.text()
  const $ = cheerio.load(html)

  $('tr').each((i, row) => {
    const text = $(row).text()
    if (text.includes('みこと')) {
      console.log('=== Mikoto Row (th only) ===')
      console.log($.html($(row).find('th')))
    }
  })
}

run().catch(console.error)
