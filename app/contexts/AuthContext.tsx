'use client'

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * セッション再取得の失敗が「通信の問題」なのか「リフレッシュトークンの失効」なのかを判定する。
 * 通信の問題でログアウトさせてしまうと、他アプリから戻るたびにログイン画面に飛ばされて
 * 業務にならないため、明確な認証エラー（400/401/403）のときだけ失効とみなす。
 */
function isRefreshTokenExpired(error: unknown): boolean {
  if (!error) return false
  const status = (error as { status?: number }).status
  return status === 400 || status === 401 || status === 403
}

type User = {
  id: string
  loginId: string
  name?: string | null
  role: 'developer' | 'system_admin' | 'agency_staff' | 'agency_client_owner' | 'simple_client_owner'
  ownerId?: string | null
  ownerName?: string | null
  shops?: Array<{
    id: string
    name: string
  }>
  // 契約プランと機能モジュール（未設定なら null。プラン名からの推測にフォールバックする）
  plan?: string | null
  has_hp?: boolean | null
  has_reserve?: boolean | null
  has_agency?: boolean | null
}

type AuthContextType = {
  user: User | null
  loading: boolean
  login: (loginId: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
  /**
   * Supabase のセッション（JWT）が有効かどうか。
   * false の間は RLS の check_shop_access が通らないため、顧客情報など
   * anon 向けポリシーを持たないテーブルが読めない。予約やセラピストは
   * anon でも読めてしまうので、画面は動いているのにお客様名だけ出ない、
   * という分かりにくい状態になる。それを利用者に伝えるためのフラグ。
   */
  sessionValid: boolean
  /**
   * セッションが「切れていた状態から復活した」ときだけ増える世代番号。
   * データ取得の依存に入れておくと、復活時に取り直せる。
   * 定期的なトークン更新では増やさない（毎回増やすと全画面が再取得して重くなる）。
   */
  sessionEpoch: number
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
  const [sessionValid, setSessionValid] = useState(true)
  const [sessionEpoch, setSessionEpoch] = useState(0)

  // null = まだ判定していない / true = セッションあり / false = セッションなし
  const hasSessionRef = useRef<boolean | null>(null)

  const markSessionActive = () => {
    const previous = hasSessionRef.current
    hasSessionRef.current = true
    setSessionValid(true)
    // 「無い」と判定した後に復活したときだけ世代を進める。初回確立では進めないので、
    // 通常のページ読み込みで取得が二度走ることはない。
    if (previous === false) {
      setSessionEpoch((n) => n + 1)
    }
  }

  // 世代管理のうえで「セッションが無い」と記録するだけ。まだ利用者には知らせない。
  // これを復帰の試行前に呼んでおかないと、復帰が成功しても previous が null のままで
  // 世代が進まず、取得済みの空データ（顧客名なし）が画面に残ってしまう。
  const noteSessionMissing = () => {
    hasSessionRef.current = false
  }

  // 復帰に失敗した。この状態では顧客情報が読めないので画面上でも警告する。
  const markSessionLost = () => {
    hasSessionRef.current = false
    setSessionValid(false)
  }

  // ユーザー情報の同期処理
  const syncUserWithSession = async (sessionUser: any) => {
    try {
      const { data: dbUserData, error: dbUserError } = await supabase
        .from('users')
        .select('*, owners(id, name)')
        .eq('id', sessionUser.id)
        .limit(1)

      // 通信エラー等で取得に失敗しただけの場合は、既存のログイン状態を維持する。
      // （ここでログアウトさせると、他アプリから戻った際の再読み込みで
      //   通信が一瞬不安定なだけでログイン画面に飛ばされてしまう）
      if (dbUserError) {
        console.error('ユーザー情報の取得に失敗（セッションは維持）:', dbUserError)
        return
      }

      if (dbUserData && dbUserData.length > 0) {
        const dbUser = dbUserData[0]
        let shops: { id: string; name: string }[] = []
        let ownerName: string | null = null

        if (dbUser.owners) {
          ownerName = (dbUser.owners as any).name || null
        }
        
        // データベースのロール値をフロントエンドのロール値にマッピング/正規化
        let normalizedRole = dbUser.role
        if (normalizedRole === 'admin') normalizedRole = 'system_admin'
        if (normalizedRole === 'owner') normalizedRole = 'simple_client_owner'
        if (normalizedRole === 'staff') normalizedRole = 'agency_staff'

        if (normalizedRole !== 'developer' && normalizedRole !== 'system_admin' && normalizedRole !== 'agency_staff') {
          // グループ店舗と個別紐付けは互いに独立しているので同時に投げる。
          // ここはトークン更新のたびに走るため、往復回数がそのまま体感に響く。
          const [ownerShopsRes, shopOwnersRes] = await Promise.all([
            dbUser.owner_id
              ? supabase
                  .from('shops')
                  .select('id, name')
                  .eq('owner_id', dbUser.owner_id)
                  .eq('is_active', true)
              : Promise.resolve({ data: null as { id: string; name: string }[] | null, error: null }),
            supabase
              .from('shop_owners')
              .select('shops(*)')
              .eq('user_id', dbUser.id),
          ])

          // オーナーグループIDが存在する場合、そのグループの全店舗を取得
          const { data: ownerShopsData, error: ownerShopsError } = ownerShopsRes
          if (!ownerShopsError && ownerShopsData) {
            shops = ownerShopsData.map((s) => ({ id: s.id, name: s.name }))
          }

          // owner_idによる取得結果限らずフォールバックとしてshop_ownersからの個別紐付けも結合
          const { data: shopsData, error: shopsError } = shopOwnersRes

          if (!shopsError && shopsData) {
            const legacyShops = (shopsData as unknown as ShopOwnerRow[])
              .filter((so) => so.shops !== null)
              .map((so) => ({
                id: so.shops!.id,
                name: so.shops!.name,
              }))
            
            // 重複排除して結合
            const shopMap = new Map<string, string>()
            shops.forEach((s) => shopMap.set(s.id, s.name))
            legacyShops.forEach((s) => shopMap.set(s.id, s.name))
            shops = Array.from(shopMap.entries()).map(([id, name]) => ({ id, name }))
          }
        }

        const userObj: User = {
          id: dbUser.id,
          loginId: dbUser.login_id,
          name: dbUser.name,
          role: normalizedRole as User['role'],
          ownerId: dbUser.owner_id || null,
          ownerName: ownerName,
          shops: shops.length > 0 ? shops : undefined,
          plan: dbUser.plan ?? null,
          has_hp: dbUser.has_hp ?? null,
          has_reserve: dbUser.has_reserve ?? null,
          has_agency: dbUser.has_agency ?? null,
        }

        // 内容が同じなら参照を維持する。この同期はトークン更新のたびに走るため、
        // 毎回新しいオブジェクトを渡すと user を依存に持つ画面が一斉に再取得を始め、
        // 動作が重くなるうえ、その応答が画面を上書きしてしまう。
        setUser((prev) => (prev && JSON.stringify(prev) === JSON.stringify(userObj) ? prev : userObj))
        localStorage.setItem('auth_user', JSON.stringify(userObj))
        const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
        document.cookie = `auth_user=${JSON.stringify(userObj)}; path=/; max-age=2592000; SameSite=Lax${isSecure}`
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
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `auth_user=; path=/; max-age=0; SameSite=Lax${isSecure}`
  }

  // セッションの張り直しを試みる。成功すれば顧客情報などが再び読めるようになる。
  // 失敗しても、リフレッシュトークンが明確に失効している場合を除いてログアウトはさせない
  // （通信が一瞬不安定なだけでログイン画面に飛ばさないため）。
  const recoverSession = async (): Promise<boolean> => {
    noteSessionMissing()
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (data?.session?.user) {
        markSessionActive()
        await syncUserWithSession(data.session.user)
        return true
      }
      if (isRefreshTokenExpired(error)) {
        console.warn('リフレッシュトークンが失効しているため、ログイン状態を解除します')
        markSessionLost()
        clearUserSession()
        return false
      }
      console.warn('セッションの再取得に失敗（ログイン状態は維持）:', error)
      markSessionLost()
      return false
    } catch (err) {
      console.error('セッション再取得で例外:', err)
      markSessionLost()
      return false
    }
  }

  // 初期ロード時と認証監視
  useEffect(() => {
    const initializeAuth = async () => {
      let hasValidCache = false

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
              const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
              localStorage.setItem('auth_user', JSON.stringify(finalUser))
              document.cookie = `auth_user=${JSON.stringify(finalUser)}; path=/; max-age=2592000; SameSite=Lax${isSecure}`
              
              setUser(finalUser)
              hasValidCache = true
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
          markSessionActive()
          await syncUserWithSession(session.user)
        } else if (hasValidCache) {
          // ログイン状態のキャッシュはあるが Supabase セッションが無い状態。
          // このまま進むと RLS により顧客情報が読めず、画面は普通に動くのに
          // お客様名だけ unknown になる“半壊”になるため、まず再取得を試みる。
          await recoverSession()
        } else {
          // キャッシュもなく、Supabaseセッションも存在しない場合のみ明確にクリアする
          clearUserSession()
        }
      } catch (err) {
        console.error('セッション取得失敗:', err)
        // エラー時は既存キャッシュを維持し、即時ログアウトは避ける（ネットワーク一時エラー等の対策）
        markSessionLost()
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
          markSessionActive()
          void syncUserWithSession(session.user)
        }
      } else if (event === 'SIGNED_OUT') {
        // 明示的なログアウト、またはセッション無効化のイベント発生時は確実にクリアする
        markSessionLost()
        clearUserSession()
      }
      setLoading(false)
    })

    // 他アプリ（SMS・LINE）から戻ってきたときに、切れていたセッションを張り直す。
    // 旧型iPhoneでは案内のたびにアプリを往復するため、ここで復帰できないと
    // 「お客様名だけ出ない」状態のまま業務を続けてしまう。
    const handleVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (hasSessionRef.current === false) {
        void recoverSession()
      }
    }
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', handleVisible)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('focus', handleVisible)
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

      markSessionActive()

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
      if (normalizedRole !== 'developer' && normalizedRole !== 'system_admin' && normalizedRole !== 'agency_staff') {
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
        plan: dbUser.plan ?? null,
        has_hp: dbUser.has_hp ?? null,
        has_reserve: dbUser.has_reserve ?? null,
        has_agency: dbUser.has_agency ?? null,
      }

      setUser(userObj)
      localStorage.setItem('auth_user', JSON.stringify(userObj))

      // クッキーにも保存（middleware用）
      const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
      document.cookie = `auth_user=${JSON.stringify(userObj)}; path=/; max-age=2592000; SameSite=Lax${isSecure}`
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
    } catch (error) {
      // セッションが既に無効な場合など signOut 自体が失敗しても、
      // ローカルの認証状態は必ずクリアする（ログイン画面に戻れなくなるのを防ぐ）
      console.error('Supabase側のログアウト失敗:', error)
    } finally {
      // 2. ローカル状態とクッキーをクリア
      markSessionLost()
      setUser(null)
      localStorage.removeItem('auth_user')
      document.cookie = 'auth_user=; path=/; max-age=0'
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
        sessionValid,
        sessionEpoch,
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
