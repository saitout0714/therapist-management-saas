'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

type User = {
  id: string
  email: string
  role: 'admin' | 'owner'
  shops?: Array<{
    id: string
    name: string
  }>
}

type AuthContextType = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
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
          setUser(userData)
        }
      } catch (error) {
        console.error('セッション復元失敗:', error)
      } finally {
        setLoading(false)
      }
    }

    restoreSession()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      setLoading(true)

      // ユーザーを取得
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .limit(1)

      if (userError || !userData || userData.length === 0) {
        throw new Error('メールアドレスまたはパスワードが正しくありません')
      }

      const dbUser = userData[0]

      // パスワード検証（実装例：bcrypt使用、またはSupabase Authを使用することを推奨）
      const passwordMatch = await bcrypt.compare(password, dbUser.password_hash)
      if (!passwordMatch) {
        throw new Error('メールアドレスまたはパスワードが正しくありません')
      }

      // 店舗情報を取得（owner の場合）
      let shops = []
      if (dbUser.role === 'owner') {
        const { data: shopsData, error: shopsError } = await supabase
          .from('shop_owners')
          .select('shops(*)')
          .eq('user_id', dbUser.id)

        if (!shopsError && shopsData) {
          shops = shopsData.map((so: any) => ({
            id: so.shops.id,
            name: so.shops.name,
          }))
        }
      }

      const userObj: User = {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        shops: shops.length > 0 ? shops : undefined,
      }

      setUser(userObj)
      localStorage.setItem('auth_user', JSON.stringify(userObj))
      
      // クッキーにも保存（middleware用）
      document.cookie = `auth_user=${JSON.stringify(userObj)}; path=/; max-age=86400`
    } catch (error: any) {
      console.error('ログイン失敗:', error)
      throw error
    } finally {
      setLoading(false)
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
