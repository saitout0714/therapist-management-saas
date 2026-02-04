'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'

export default function LoginPage() {
  const router = useRouter()
  const { login, isAuthenticated, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 既にログイン済みの場合はダッシュボードへリダイレクト
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push('/')
    }
  }, [isAuthenticated, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      router.push('/')
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* ロゴ・タイトル */}
          <div className="text-center mb-8">
            <div className="bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold">管</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">管理システム</h1>
            <p className="text-gray-600 mt-2">セラピスト管理・予約管理システム</p>
          </div>

          {/* エラーメッセージ */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* ログインフォーム */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          {/* テスト用情報 */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-xs text-gray-600 mb-3 font-semibold">テストアカウント:</p>
            <div className="space-y-2 text-xs text-gray-600">
              <p>メール: admin@example.com</p>
              <p>パス: admin123</p>
            </div>
          </div>
        </div>

        {/* フッターのリンク */}
        <div className="text-center mt-6 text-sm text-gray-600">
          <p>何かお困りですか？ <a href="#" className="text-blue-600 hover:underline">サポートに連絡</a></p>
        </div>
      </div>
    </div>
  )
}
