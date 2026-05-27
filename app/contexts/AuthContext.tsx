'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

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
      // login_id がメールアドレス形式でない場合は、擬似メールアドレスにする
      const email = loginId.includes('@') ? loginId : `${loginId}@yoyakl.tokyo`

      // 1. Supabase Auth で安全にサーバーサイド認証を実行
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        console.error('Supabase Auth エラー:', authError)
        throw new Error('ログインIDまたはパスワードが正しくありません')
      }

      const authUser = authData.user
      if (!authUser) {
        throw new Error('ユーザー情報の取得に失敗しました')
      }

      // 2. 認証に成功したユーザーの付随情報（役割や店舗）を public.users から取得
      const { data: dbUserData, error: dbUserError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .limit(1)

      if (dbUserError || !dbUserData || dbUserData.length === 0) {
        throw new Error('データベースのユーザー情報の取得に失敗しました。管理者にお問い合わせください')
      }

      const dbUser = dbUserData[0]

      // 3. 店舗情報を取得（owner の場合）
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
      // 1. Supabase Auth セッションをログアウト
      await supabase.auth.signOut()

      // 2. ローカル状態とクッキーをクリア
      setUser(null)
      localStorage.removeItem('auth_user')
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
