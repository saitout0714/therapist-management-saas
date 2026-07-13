import ReserveClient from './ReserveClient'

interface PageProps {
  params: Promise<{ code: string }>
}

// サーバー側でのDB問い合わせを完全に排除し、HTML を瞬時に返す
export default async function ReservePage({ params }: PageProps) {
  const { code } = await params

  // 初期データは空の状態でクライアントに渡す
  // すべてのデータはクライアント側で /api/public/[code] から非同期取得する
  const initialData = {
    shop: null,
    courses: [],
    shifts: [],
    reservations: [],
    system_interval_minutes: 20,
    allow_new_customers: true,
    code,
  }

  return <ReserveClient initialData={initialData} />
}
