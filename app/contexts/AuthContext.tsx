'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

type User = {
  id: string
  loginId: string
  name?: string | null
  role: 'system_admin' | 'agency_staff' | 'agency_client_owner' | 'simple_client_owner'
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

  // ユーザー情報の同期処理
  const syncUserWithSession = async (sessionUser: any) => {
    try {
      const { data: dbUserData, error: dbUserError } = await supabase
        .from('users')
        .select('*')
        .eq('id', sessionUser.id)
        .limit(1)

      if (dbUserData && dbUserData.length > 0) {
        const dbUser = dbUserData[0]
        let shops: { id: string; name: string }[] = []
        
        // データベースのロール値をフロントエンドのロール値にマッピング/正規化
        let normalizedRole = dbUser.role
        if (normalizedRole === 'admin') normalizedRole = 'system_admin'
        if (normalizedRole === 'owner') normalizedRole = 'simple_client_owner'
        if (normalizedRole === 'staff') normalizedRole = 'agency_staff'

        if (normalizedRole !== 'system_admin' && normalizedRole !== 'agency_staff') {
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
          role: normalizedRole as User['role'],
          shops: shops.length > 0 ? shops : undefined,
        }

        setUser(userObj)
        localStorage.setItem('auth_user', JSON.stringify(userObj))
        document.cookie = `auth_user=${JSON.stringify(userObj)}; path=/; max-age=2592000; SameSite=Lax; Secure`
      } else {
        clearUserSession()
      }
    } catch (err) {
      console.error('ユーザー情報同期失敗:', err)
    }
  }

  // ユーザー情報のクリア
  const clearUserSession = () => {
    setUser(null)
    localStorage.removeItem('auth_user')
    document.cookie = 'auth_user=; path=/; max-age=0; SameSite=Lax'
  }

  // 初期ロード時と認証監視
  useEffect(() => {
    const initializeAuth = async () => {
      // 1. ローカルキャッシュから一時復元（ちらつきとリダイレクト防止）
      try {
        const storedUser = localStorage.getItem('auth_user')
        if (storedUser) {
          const userData = JSON.parse(storedUser)
          if (userData && (userData.loginId || userData.email)) {
            if (!userData.loginId && userData.email) {
              clearUserSession()
            } else {
              let roleChanged = false
              if (userData.role === 'admin') { userData.role = 'system_admin'; roleChanged = true; }
              if (userData.role === 'owner') { userData.role = 'simple_client_owner'; roleChanged = true; }
              if (userData.role === 'staff') { userData.role = 'agency_staff'; roleChanged = true; }
              
              const finalUser = roleChanged ? { ...userData, role: userData.role } : userData;
              if (roleChanged) {
                localStorage.setItem('auth_user', JSON.stringify(finalUser))
                document.cookie = `auth_user=${JSON.stringify(finalUser)}; path=/; max-age=2592000; SameSite=Lax; Secure`
              }
              setUser(finalUser)
            }
          }
        }
      } catch (err) {
        console.error('ローカルキャッシュ復旧失敗:', err)
      } finally {
        setLoading(false)
      }

      // 2. Supabase の現在のセッション状態を確認し同期する
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          await syncUserWithSession(session.user)
        } else {
          // キャッシュもセッションも両方無い場合のみクリアする（自爆を防ぐ）
          const storedUser = localStorage.getItem('auth_user')
          if (!storedUser) {
            clearUserSession()
          }
        }
      } catch (err) {
        console.error('セッション取得失敗:', err)
        const storedUser = localStorage.getItem('auth_user')
        if (!storedUser) {
          clearUserSession()
        }
      } finally {
        setLoading(false)
      }
    }

    void initializeAuth()

    // 3. 認証イベントの監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change event:', event, session?.user?.id)
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          void syncUserWithSession(session.user)
        }
      } else if (event === 'SIGNED_OUT') {
        // 明示的なログアウト（logout() の呼び出し）以外で、
        // localStorage にキャッシュが残っている場合は、一時的なセッション未検出による誤消去を防ぐためクリアをスキップする。
        const storedUser = localStorage.getItem('auth_user')
        if (!storedUser) {
          clearUserSession()
        }
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const login = async (loginId: string, password: string) => {
    try {
      // login_id がメールアドレス形式でない場合は、擬似メールアドレスにする
      const normalizedLoginId = loginId.trim().toLowerCase()
      const email = normalizedLoginId.includes('@') ? normalizedLoginId : `${normalizedLoginId}@yoyakl.tokyo`


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

      // データベースのロール値をフロントエンドのロール値にマッピング/正規化
      let normalizedRole = dbUser.role
      if (normalizedRole === 'admin') normalizedRole = 'system_admin'
      if (normalizedRole === 'owner') normalizedRole = 'simple_client_owner'
      if (normalizedRole === 'staff') normalizedRole = 'agency_staff'

      // 3. 店舗情報を取得（system_admin と agency_staff 以外の場合）
      let shops: { id: string; name: string }[] = []
      if (normalizedRole !== 'system_admin' && normalizedRole !== 'agency_staff') {
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
        role: normalizedRole as User['role'],
        shops: shops.length > 0 ? shops : undefined,
      }

      setUser(userObj)
      localStorage.setItem('auth_user', JSON.stringify(userObj))

      // クッキーにも保存（middleware用）
      document.cookie = `auth_user=${JSON.stringify(userObj)}; path=/; max-age=2592000; SameSite=Lax; Secure`
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
