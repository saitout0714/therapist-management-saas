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

  console.log('Fetching /shift/index/page:2/sort:Cast.sort/direction:ASC?date=2026-06-22...')
  const r = await session.get('https://my.caskan.jp/shift/index/page:2/sort:Cast.sort/direction:ASC?date=2026-06-22')
  const html = await r.text()
  const $ = cheerio.load(html)

  const names = ['いちか', 'もえか', 'みこと', 'みなみ']
  console.log('Searching in page 2 HTML...')
  for (const name of names) {
    const count = (html.match(new RegExp(name, 'g')) || []).length
    console.log(`- Occurrences of "${name}" in page 2 /shift HTML: ${count}`)
  }

  // Let's print out all cast names on page 2
  const page2Casts: string[] = []
  $('.tbl-calendar tr').each((_, row) => {
    const nameLink = $(row).find('a[href^="/cast/view"]')
    const castName = nameLink.text().trim()
    if (castName) page2Casts.push(castName)
  })
  console.log('Casts on page 2:', page2Casts.slice(0, 10))
  // check if any of the target names is in page2Casts
  for (const name of names) {
    const matched = page2Casts.find(c => c.includes(name))
    if (matched) {
      console.log(`Matched cast on page 2: "${matched}" for name "${name}"`)
    }
  }
}

run().catch(console.error)
