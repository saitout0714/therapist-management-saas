import { createClient } from '@supabase/supabase-js'

// Supabaseとの接続設定（.env.localから読み込みます）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function TherapistsPage() {
  // 1. Supabaseの「therapists」テーブルからデータを取得
  const { data: therapists, error } = await supabase
    .from('therapists')
    .select('*')

  if (error) {
    return <div className="p-10 text-red-500">エラーが発生しました: {error.message}</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">セラピスト一覧</h1>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-blue-600">登録済みセラピスト</h2>

          {therapists && therapists.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {therapists.map((therapist) => (
                <li key={therapist.id} className="py-3 flex justify-between">
                  <span className="font-medium text-gray-700">{therapist.name}</span>
                  <span className="text-sm text-gray-400">ID: {therapist.id.slice(0, 8)}...</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">
              データベースは空です。Supabaseの管理画面からデータを1件追加してみてください。
            </p>
          )}
        </div>

        <div className="mt-8 text-sm text-gray-400">
          場所: /app/therapists/page.tsx
        </div>
      </div>
    </div>
  )
}