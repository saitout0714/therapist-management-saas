'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

type User = {
  id: string
  loginId: string
  name?: string | null
  role: 'admin' | 'owner' | 'staff'
  shops?: Array<{
    id: string
    name: string
  }>
}

type AuthContextType = {
  user: User | null
  loading: boolean
  login: (loginId: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
}

type ShopOwnerRow = {
  shops: {
    id: string
    name: string
  } | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // ローカルストレージからユーザー情報を復元
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedUser = localStorage.getItem('auth_user')
        if (storedUser) {
          const userData = JSON.parse(storedUser)
          // 互換性チェック（email形式からloginId形式への移行対応）
          if (userData && (userData.loginId || userData.email)) {
            // 古い形式の場合はloginIdにマッピングするか、あるいはクリアする
            // ここでは安全のため、loginIdがない場合は再ログインを促す（クリアする）
            if (!userData.loginId && userData.email) {
              localStorage.removeItem('auth_user')
              document.cookie = 'auth_user=; path=/; max-age=0'
              setUser(null)
            } else {
              setUser(userData)
            }
          }
        }
      } catch (error) {
        console.error('セッション復元失敗:', error)
      } finally {
        setLoading(false)
      }
    }

    restoreSession()
  }, [])

  const login = async (loginId: string, password: string) => {
    try {
      // ユーザーを取得
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('login_id', loginId)
        .limit(1)

      if (userError) {
        // ネットワーク障害やSupabase設定不備は認証失敗と区別して表示する
        throw new Error('認証サーバーに接続できません。SupabaseのURL/キー設定とネットワークをご確認ください')
      }

      if (!userData || userData.length === 0) {
        throw new Error('ログインIDまたはパスワードが正しくありません')
      }

      const dbUser = userData[0]

      // パスワード検証（実装例：bcrypt使用、またはSupabase Authを使用することを推奨）
      const passwordMatch = await bcrypt.compare(password, dbUser.password_hash)
      if (!passwordMatch) {
        throw new Error('ログインIDまたはパスワードが正しくありません')
      }

      // 店舗情報を取得（owner の場合）
      let shops: { id: string; name: string }[] = []
      if (dbUser.role === 'owner') {
        const { data: shopsData, error: shopsError } = await supabase
          .from('shop_owners')
          .select('shops(*)')
          .eq('user_id', dbUser.id)

        if (!shopsError && shopsData) {
          shops = (shopsData as unknown as ShopOwnerRow[])
            .filter((so) => so.shops !== null)
            .map((so) => ({
              id: so.shops!.id,
              name: so.shops!.name,
            }))
        }
      }

      const userObj: User = {
        id: dbUser.id,
        loginId: dbUser.login_id,
        name: dbUser.name,
        role: dbUser.role,
        shops: shops.length > 0 ? shops : undefined,
      }

      setUser(userObj)
      localStorage.setItem('auth_user', JSON.stringify(userObj))

      // クッキーにも保存（middleware用）
      document.cookie = `auth_user=${JSON.stringify(userObj)}; path=/; max-age=86400`
    } catch (error: unknown) {
      console.error('ログイン失敗:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('ログインに失敗しました')
    }
  }

  const logout = async () => {
    try {
      setUser(null)
      localStorage.removeItem('auth_user')

      // クッキーも削除
      document.cookie = 'auth_user=; path=/; max-age=0'
    } catch (error) {
      console.error('ログアウト失敗:', error)
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: user !== null,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
